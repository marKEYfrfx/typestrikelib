import type { CSPlayerController, CSPlayerPawn } from "cs_script/point_script";
import { Events, type Unsubscribe } from "../core/events";
import { libLog } from "../core/log";
import { teamShortName } from "../game/constants";
import { Cooldown } from "../util/time";
import { Chat } from "./chat";
import { findPlayer, getPlayerName } from "./players";

/**
 * Split command text into arguments. Whitespace separates arguments; double quotes group them.
 * `tokenize('give "big gun" 2')` -> `["give", "big gun", "2"]`.
 */
export function tokenize(text: string): string[] {
    const out: string[] = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push(m[1] !== undefined ? m[1] : m[2]);
    return out;
}

/** What a command handler receives. */
export interface CommandContext {
    /** The player who typed the command. */
    readonly player: CSPlayerController;
    /** Their pawn, if they have one. */
    readonly pawn: CSPlayerPawn | undefined;
    /** The command name as registered (not the alias typed). */
    readonly command: string;
    /** Arguments after the command name. */
    readonly args: readonly string[];
    /** Everything after the command name, unsplit. */
    readonly argString: string;
    /** The full chat message. */
    readonly text: string;
    /** `true` if sent to team chat. */
    readonly teamChat: boolean;
    /** Send a response using the router's reply handler. */
    reply(message: string): void;
    /** Argument `i` as a string. */
    arg(i: number): string | undefined;
    /** Argument `i` as an integer, or `fallback` if missing or not a number. */
    int(i: number, fallback?: number): number | undefined;
    /** Argument `i` as a number, or `fallback`. */
    float(i: number, fallback?: number): number | undefined;
    /** Argument `i` as a player (`#slot`, exact name or unique partial name). */
    targetPlayer(i: number): CSPlayerController | undefined;
}

export interface CommandDefinition {
    /** Shown by the built-in help command. */
    description?: string;
    /** Argument hint, e.g. `"<player> [amount]"`. */
    usage?: string;
    aliases?: readonly string[];
    /** Minimum number of arguments; fewer prints the usage. */
    minArgs?: number;
    /** Only players on these teams may use it. */
    teams?: readonly number[];
    /** Only players with a living pawn may use it. */
    requireAlive?: boolean;
    /** Seconds between uses, per player. */
    cooldown?: number;
    /** Leave it out of the help list. */
    hidden?: boolean;
    handler: (ctx: CommandContext) => void;
}

interface RegisteredCommand extends CommandDefinition {
    name: string;
    cooldownTracker?: Cooldown<number>;
}

/** How replies reach the player. The default broadcasts with {@link Chat.say}. */
export type ReplyHandler = (player: CSPlayerController, message: string) => void;

/**
 * Chat commands such as `!spawn door` or `/hp`.
 *
 * ```ts
 * ChatCommands.register("hp", {
 *     description: "Set your health",
 *     usage: "<amount>",
 *     minArgs: 1,
 *     requireAlive: true,
 *     handler: (ctx) => ctx.pawn!.SetHealth(ctx.int(0, 100)!),
 * });
 * ```
 */
export class CommandRouter {
    /** Characters that start a command. */
    prefixes: string[] = ["!", "/"];
    private readonly commands = new Map<string, RegisteredCommand>();
    private readonly aliases = new Map<string, string>();
    private listening = false;
    private replyHandler: ReplyHandler = (player, message) => Chat.say(`[${getPlayerName(player)}] ${message}`);

    /** Register a command (case-insensitive). Returns a function that unregisters it. */
    register(name: string, definition: CommandDefinition | ((ctx: CommandContext) => void)): Unsubscribe {
        const def: CommandDefinition = typeof definition === "function" ? { handler: definition } : definition;
        const key = name.toLowerCase();
        if (this.commands.has(key)) libLog.warn(`Chat command "${key}" registered twice; the last one wins.`);
        const cmd: RegisteredCommand = { ...def, name: key };
        if (def.cooldown && def.cooldown > 0) cmd.cooldownTracker = new Cooldown<number>(def.cooldown);
        this.commands.set(key, cmd);
        for (const alias of def.aliases ?? []) this.aliases.set(alias.toLowerCase(), key);
        this.listen();
        return () => this.unregister(key);
    }

    unregister(name: string): void {
        const key = name.toLowerCase();
        const cmd = this.commands.get(key);
        if (!cmd) return;
        this.commands.delete(key);
        for (const alias of cmd.aliases ?? []) if (this.aliases.get(alias.toLowerCase()) === key) this.aliases.delete(alias.toLowerCase());
    }

    /** Replace how replies are delivered (for example, a HUD message or a log). */
    setReplyHandler(handler: ReplyHandler): void {
        this.replyHandler = handler;
    }

    /** Add a help command listing every visible command. */
    enableHelp(name = "help"): Unsubscribe {
        return this.register(name, {
            description: "List chat commands",
            aliases: ["commands"],
            handler: (ctx) => {
                const p = this.prefixes[0] ?? "!";
                const lines = this.list()
                    .filter((c) => !c.hidden)
                    .map((c) => `${p}${c.name}${c.usage ? ` ${c.usage}` : ""}${c.description ? ` - ${c.description}` : ""}`);
                for (const line of lines) ctx.reply(line);
            },
        });
    }

    /** Registered commands, sorted by name. */
    list(): readonly (CommandDefinition & { name: string })[] {
        return [...this.commands.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    has(name: string): boolean {
        const key = name.toLowerCase();
        return this.commands.has(key) || this.aliases.has(key);
    }

    /**
     * Handle a chat message. Called automatically for `PlayerChat` events; call it yourself to
     * run commands from somewhere else. Returns `true` if the text was a known command.
     */
    handle(player: CSPlayerController | undefined, text: string, team?: number): boolean {
        if (!player) return false;
        const trimmed = text.trim();
        const prefix = this.prefixes.find((p) => trimmed.startsWith(p));
        if (prefix === undefined) return false;
        const body = trimmed.slice(prefix.length);
        const nameMatch = /^(\S+)\s*/.exec(body);
        if (!nameMatch) return false;
        const typed = nameMatch[1].toLowerCase();
        const key = this.commands.has(typed) ? typed : this.aliases.get(typed);
        const cmd = key ? this.commands.get(key) : undefined;
        if (!cmd) return false;

        const argString = body.slice(nameMatch[0].length);
        const args = tokenize(argString);
        const pawn = player.GetPlayerPawn();
        const reply = (message: string) => this.replyHandler(player, message);
        const ctx: CommandContext = {
            player,
            pawn,
            command: cmd.name,
            args,
            argString,
            text,
            teamChat: team !== undefined && team === player.GetTeamNumber(),
            reply,
            arg: (i) => args[i],
            int: (i, fallback) => {
                const n = args[i] !== undefined ? Number.parseInt(args[i], 10) : NaN;
                return Number.isFinite(n) ? n : fallback;
            },
            float: (i, fallback) => {
                const n = args[i] !== undefined ? Number.parseFloat(args[i]) : NaN;
                return Number.isFinite(n) ? n : fallback;
            },
            targetPlayer: (i) => (args[i] !== undefined ? findPlayer(args[i]) : undefined),
        };

        const usage = `Usage: ${prefix}${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ""}`;
        if (cmd.teams && !cmd.teams.includes(player.GetTeamNumber())) {
            reply(`${prefix}${cmd.name} is only for ${cmd.teams.map(teamShortName).join("/")}.`);
            return true;
        }
        if (cmd.requireAlive && !(pawn && pawn.IsValid() && pawn.IsAlive())) {
            reply(`You must be alive to use ${prefix}${cmd.name}.`);
            return true;
        }
        if (cmd.minArgs !== undefined && args.length < cmd.minArgs) {
            reply(usage);
            return true;
        }
        if (cmd.cooldownTracker) {
            const slot = player.GetPlayerSlot();
            if (!cmd.cooldownTracker.tryUse(slot)) {
                reply(`Wait ${cmd.cooldownTracker.remaining(slot).toFixed(1)}s before using ${prefix}${cmd.name} again.`);
                return true;
            }
        }
        try {
            cmd.handler(ctx);
        } catch (err) {
            libLog.error(`Chat command "${cmd.name}" threw:`, err);
        }
        return true;
    }

    private listen(): void {
        if (this.listening) return;
        this.listening = true;
        Events.on("PlayerChat", ({ player, text, team }) => {
            this.handle(player, text, team);
        });
    }
}

/** The shared chat command router. */
export const ChatCommands = new CommandRouter();
