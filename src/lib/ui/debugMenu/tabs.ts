import { Console, Instance } from "../../core/engine";
import type { CSPlayerController, CSPlayerPawn, Entity, Vector } from "cs_script/point_script";
import { Events } from "../../core/events";
import { describeEntity, type EntitySource } from "../../entities/find";
import { isModelEntity, isPlayerPawn } from "../../entities/guards";
import { teamShortName } from "../../game/constants";
import { Round } from "../../game/round";
import { refillAllAmmo } from "../../game/weapons";
import { forward } from "../../math/angles";
import { add, distance, format, vec } from "../../math/vector";
import * as Pawn from "../../players/pawn";
import { getPawn, getPlayers } from "../../players/players";
import { canPlayerFit } from "../../world/trace";
import { formatTime } from "../../util/time";
import type { DebugAction, DebugCell, DebugContext, DebugRow, DebugTab } from "./DebugMenu";

/*
 * Ready-made tabs for DebugMenu. Use them as they are, or as examples for your own.
 */

// ---------------------------------------------------------------- shared helpers

/** A position near `target` where `pawn` fits, trying a ring of spots around it, then above it. */
export function findSpotNear(pawn: CSPlayerPawn, target: Vector, radius = 64): Vector | undefined {
    for (const r of [radius, radius * 1.5, radius * 2]) {
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const spot = vec(target.x + Math.cos(a) * r, target.y + Math.sin(a) * r, target.z + 8);
            if (canPlayerFit(pawn, spot)) return spot;
        }
    }
    const above = vec(target.x, target.y, target.z + 80);
    return canPlayerFit(pawn, above) ? above : undefined;
}

/** A point `dist` units in front of a pawn, at its feet height. */
function inFrontOf(pawn: CSPlayerPawn, dist: number): Vector {
    const angles = pawn.GetEyeAngles();
    const f = forward({ pitch: 0, yaw: angles.yaw, roll: 0 });
    return add(pawn.GetAbsOrigin(), vec(f.x * dist, f.y * dist, 0));
}

function needPawn(ctx: DebugContext<any>): CSPlayerPawn | string {
    return ctx.pawn && ctx.pawn.IsValid() && ctx.pawn.IsAlive() ? ctx.pawn : "You need to be alive";
}

const entityIds = new WeakMap<object, number>();
let nextEntityId = 1;
/** A stable key per entity object (entity variables are stable, so this survives refreshes). */
export function entityKey(e: Entity): string {
    let id = entityIds.get(e);
    if (id === undefined) entityIds.set(e, (id = nextEntityId++));
    return `e${id}`;
}

// ---------------------------------------------------------------- entity actions

/** Teleport the viewer next to the selected entity. */
export function goToAction<T extends Entity>(): DebugAction<T> {
    return {
        label: "Go to",
        needsSelection: true,
        run: (ctx) => {
            const pawn = needPawn(ctx);
            if (typeof pawn === "string") return pawn;
            const target = ctx.selected?.data;
            if (!target || !target.IsValid()) return "That entity is gone";
            const spot = findSpotNear(pawn, target.GetAbsOrigin());
            if (!spot) return "No free spot near it";
            Pawn.teleport(pawn, { position: spot, stop: true });
            Pawn.lookAt(pawn, target.GetAbsOrigin());
            return `Moved to ${describeEntity(target)}`;
        },
    };
}

/** Teleport the selected entity in front of the viewer. */
export function bringAction<T extends Entity>(): DebugAction<T> {
    return {
        label: "Bring",
        needsSelection: true,
        run: (ctx) => {
            const pawn = needPawn(ctx);
            if (typeof pawn === "string") return pawn;
            const target = ctx.selected?.data;
            if (!target || !target.IsValid()) return "That entity is gone";
            let spot = add(inFrontOf(pawn, 96), vec(0, 0, 16));
            if (isPlayerPawn(target)) spot = findSpotNear(target, spot, 16) ?? spot;
            Pawn.teleport(target, { position: spot, stop: true });
            return `Brought ${describeEntity(target)}`;
        },
    };
}

/** Toggle a glow outline on the selected (model) entity. */
export function glowAction<T extends Entity>(): DebugAction<T> {
    return {
        label: "Glow",
        needsSelection: true,
        active: (ctx) => {
            const e = ctx.selected?.data;
            return !!e && e.IsValid() && isModelEntity(e) && e.IsGlowing();
        },
        run: (ctx) => {
            const e = ctx.selected?.data;
            if (!e || !e.IsValid()) return "That entity is gone";
            if (!isModelEntity(e)) return `${describeEntity(e)} has no model to glow`;
            if (e.IsGlowing()) e.Unglow();
            else e.Glow({ r: 245, g: 184, b: 61 });
            return undefined;
        },
    };
}

/** Remove the selected entity. */
export function removeAction<T extends Entity>(): DebugAction<T> {
    return {
        label: "Remove",
        needsSelection: true,
        danger: true,
        run: (ctx) => {
            const e = ctx.selected?.data;
            if (!e || !e.IsValid()) return "That entity is gone";
            if (isPlayerPawn(e)) return "Use Slay for players";
            const name = describeEntity(e);
            e.Remove();
            return `Removed ${name}`;
        },
    };
}

// ---------------------------------------------------------------- entity tab

export interface EntityColumn<T extends Entity> {
    header: string;
    value: (entity: T, ctx: DebugContext<T>) => DebugCell;
}

export interface EntityTabOptions<T extends Entity> {
    /** Columns after the name. Default: Class, HP, Dist. Up to 4. */
    columns?: readonly EntityColumn<T>[];
    /** Nearest to the viewer first. Default `true`. */
    sortByDistance?: boolean;
    /** Text for the name column. Default: targetname, or the classname if unnamed. */
    name?: (entity: T) => string;
    /** Called when a row is selected. Default: shows the entity and its position in the status line. */
    onSelect?: (entity: T, ctx: DebugContext<T>) => string | void;
    /** Default: Go to, Bring, Glow, Remove. */
    actions?: readonly DebugAction<T>[];
    empty?: string;
}

function resolve<T extends Entity>(source: EntitySource<T> | (() => readonly T[])): readonly T[] {
    if (typeof source === "function") return source();
    if (Array.isArray(source)) return source as readonly T[];
    const s = source as { className?: string; name?: string };
    if (s.className !== undefined) return Instance.FindEntitiesByClass(s.className) as T[];
    if (s.name !== undefined) return Instance.FindEntitiesByName(s.name) as T[];
    return [];
}

/**
 * A tab listing entities: an array, a function returning one, `{ className }` or `{ name }`
 * (wildcards allowed).
 *
 * ```ts
 * debug.addTab(entityTab("Doors", { name: "door_*" }));
 * debug.addTab(entityTab("Props", { className: "prop_physics_multiplayer" }, {
 *     columns: [{ header: "HP", value: (p) => p.GetHealth() }],
 * }));
 * ```
 */
export function entityTab<T extends Entity = Entity>(
    title: string,
    source: EntitySource<T> | (() => readonly T[]),
    options: EntityTabOptions<T> = {},
): DebugTab<T> {
    const columns: readonly EntityColumn<T>[] = options.columns ?? [
        { header: "Class", value: (e) => e.GetClassName() },
        { header: "HP", value: (e) => (e.GetMaxHealth() > 0 ? e.GetHealth() : "-") },
        { header: "Dist", value: (e, ctx) => (ctx.pawn ? Math.round(distance(e.GetAbsOrigin(), ctx.pawn.GetAbsOrigin())) : "-") },
    ];
    const name = options.name ?? ((e: T) => e.GetEntityName() || e.GetClassName());
    return {
        title,
        columns: ["Entity", ...columns.map((c) => c.header)],
        empty: options.empty ?? "No matching entities",
        rows: (ctx) => {
            let list = resolve(source).filter((e) => e.IsValid());
            if (options.sortByDistance !== false && ctx.pawn) {
                const from = ctx.pawn.GetAbsOrigin();
                list = list
                    .map((e) => ({ e, d: distance(e.GetAbsOrigin(), from) }))
                    .sort((a, b) => a.d - b.d)
                    .map((x) => x.e);
            }
            return list.map((e): DebugRow<T> => ({ key: entityKey(e), data: e, cells: [name(e), ...columns.map((c) => c.value(e, ctx))] }));
        },
        onSelect: (row, ctx) => {
            const e = row.data;
            if (!e || !e.IsValid()) return "That entity is gone";
            if (options.onSelect) return options.onSelect(e, ctx);
            return `${describeEntity(e)} at ${format(e.GetAbsOrigin(), 0)}`;
        },
        actions: options.actions ?? [goToAction<T>(), bringAction<T>(), glowAction<T>(), removeAction<T>()],
    };
}

// ---------------------------------------------------------------- players tab

/**
 * Connected players: name, team, health, speed and slot. Actions: Go to, Bring, Heal, Slay.
 */
export function playersTab(title = "Players"): DebugTab<CSPlayerController> {
    const selectedPawn = (ctx: DebugContext<CSPlayerController>) => {
        const p = getPawn(ctx.selected?.data);
        return p && p.IsValid() && p.IsAlive() ? p : undefined;
    };
    return {
        title,
        columns: ["Player", "Team", "HP", "Speed", "Slot"],
        empty: "No players",
        rows: () =>
            getPlayers()
                .sort((a, b) => a.GetTeamNumber() - b.GetTeamNumber() || a.GetPlayerName().localeCompare(b.GetPlayerName()))
                .map((c) => {
                    const pawn = c.GetPlayerPawn();
                    const alive = !!pawn && pawn.IsValid() && pawn.IsAlive();
                    return {
                        key: `slot${c.GetPlayerSlot()}`,
                        data: c,
                        cells: [
                            c.IsBot() && !/^bot\b/i.test(c.GetPlayerName()) ? `${c.GetPlayerName()} (bot)` : c.GetPlayerName(),
                            teamShortName(c.GetTeamNumber()),
                            alive ? pawn!.GetHealth() : "dead",
                            alive ? Math.round(Pawn.speed2D(pawn!)) : "-",
                            `#${c.GetPlayerSlot()}`,
                        ],
                    };
                }),
        onSelect: (row) => {
            const pawn = getPawn(row.data);
            return pawn && pawn.IsValid() ? `${row.data!.GetPlayerName()} at ${format(pawn.GetAbsOrigin(), 0)}` : `${row.data?.GetPlayerName()} has no pawn`;
        },
        actions: [
            {
                label: "Go to",
                needsSelection: true,
                run: (ctx) => {
                    const me = needPawn(ctx);
                    if (typeof me === "string") return me;
                    const target = selectedPawn(ctx);
                    if (!target) return "They aren't alive";
                    if (target === me) return "That's you";
                    const spot = findSpotNear(me, target.GetAbsOrigin());
                    if (!spot) return "No free spot near them";
                    Pawn.teleport(me, { position: spot, stop: true });
                    Pawn.lookAt(me, target.GetEyePosition());
                    return `Moved to ${ctx.selected!.data!.GetPlayerName()}`;
                },
            },
            {
                label: "Bring",
                needsSelection: true,
                run: (ctx) => {
                    const me = needPawn(ctx);
                    if (typeof me === "string") return me;
                    const target = selectedPawn(ctx);
                    if (!target) return "They aren't alive";
                    if (target === me) return "That's you";
                    const spot = findSpotNear(target, inFrontOf(me, 96), 16) ?? inFrontOf(me, 96);
                    Pawn.teleport(target, { position: spot, stop: true });
                    return `Brought ${ctx.selected!.data!.GetPlayerName()}`;
                },
            },
            {
                label: "Heal",
                run: (ctx) => {
                    const target = selectedPawn(ctx) ?? (ctx.pawn && ctx.pawn.IsAlive() ? ctx.pawn : undefined);
                    if (!target) return "Nobody to heal";
                    Pawn.restore(target);
                    return `Healed ${target.GetPlayerController()?.GetPlayerName() ?? "player"}`;
                },
            },
            {
                label: "Slay",
                needsSelection: true,
                danger: true,
                run: (ctx) => {
                    const target = selectedPawn(ctx);
                    if (!target) return "They aren't alive";
                    target.Kill();
                    return `Slayed ${ctx.selected!.data!.GetPlayerName()}`;
                },
            },
        ],
    };
}

// ---------------------------------------------------------------- tools tab

const godSlots = new Set<number>();
let godListener = false;

function ensureGodListener(): void {
    if (godListener) return;
    godListener = true;
    Events.on("ModifyPlayerDamage", (e) => {
        const slot = e.player.GetOriginalPlayerController()?.GetPlayerSlot();
        return slot !== undefined && godSlots.has(slot) ? { abort: true } : undefined;
    });
    Events.on("PlayerDisconnect", ({ playerSlot }) => godSlots.delete(playerSlot));
}

/** `true` if god mode (from the tools tab) is on for this slot. */
export function hasGodMode(slot: number): boolean {
    return godSlots.has(slot);
}

/**
 * Match info and common cheats for testing: noclip, god mode, heal, ammo, bots, round control.
 * Server commands used here are fixed strings (bot_add, bot_kick, mp_restartgame).
 */
export function toolsTab(title = "Tools"): DebugTab<never> {
    return {
        title,
        columns: ["Info", "Value"],
        rows: (ctx) => {
            const players = getPlayers();
            // Each value on its own, so one missing engine API shows "n/a" instead of breaking the tab.
            const safe = (get: () => DebugCell): DebugCell => {
                try {
                    return get();
                } catch {
                    return "n/a";
                }
            };
            const rows: Array<[string, DebugCell]> = [
                ["Map", safe(() => Instance.GetMapName())],
                ["Game time", formatTime(Instance.GetGameTime(), 1)],
                ["Round time left", safe(() => formatTime(Round.timeLeft(), 0))],
                ["Rounds played", safe(() => Round.roundsPlayed())],
                ["Phase", safe(() => (Round.isWarmup() ? "warmup" : Round.isFreezeTime() ? "freeze time" : Round.isTeamIntro() ? "team intro" : "live"))],
                ["Score T / CT", safe(() => `${Round.score(2)} / ${Round.score(3)}`)],
                ["Players / bots", `${players.filter((c) => !c.IsBot()).length} / ${players.filter((c) => c.IsBot()).length}`],
                ["Your position", ctx.pawn ? ctx.pawn.GetAbsOrigin() : "-"],
                ["Your angles", ctx.pawn ? ctx.pawn.GetEyeAngles() : "-"],
            ];
            return rows.map(([k, v]) => ({ key: k, cells: [k, v] }));
        },
        actions: [
            {
                label: "Noclip",
                active: (ctx) => !!ctx.pawn && ctx.pawn.IsValid() && ctx.pawn.IsNoclipping(),
                run: (ctx) => {
                    const pawn = needPawn(ctx);
                    if (typeof pawn === "string") return pawn;
                    return Pawn.setNoclip(pawn) ? "Noclip on" : "Noclip off";
                },
            },
            {
                label: "God mode",
                active: (ctx) => godSlots.has(ctx.viewer.GetPlayerSlot()),
                run: (ctx) => {
                    ensureGodListener();
                    const slot = ctx.viewer.GetPlayerSlot();
                    if (godSlots.delete(slot)) return "God mode off";
                    godSlots.add(slot);
                    return "God mode on";
                },
            },
            {
                label: "Heal",
                run: (ctx) => {
                    const pawn = needPawn(ctx);
                    if (typeof pawn === "string") return pawn;
                    Pawn.restore(pawn);
                    return "Health and armor restored";
                },
            },
            {
                label: "Refill ammo",
                run: (ctx) => {
                    const pawn = needPawn(ctx);
                    if (typeof pawn === "string") return pawn;
                    refillAllAmmo(pawn);
                    return "Ammo refilled";
                },
            },
            {
                label: "Add bot",
                run: () => {
                    Console.ServerCommand("bot_add");
                    return "Bot added";
                },
            },
            {
                label: "Kick bots",
                danger: true,
                run: () => {
                    Console.ServerCommand("bot_kick");
                    return "Bots kicked";
                },
            },
            {
                label: "End warmup",
                run: () => {
                    if (!Round.isWarmup()) return "Not in warmup";
                    Round.endWarmup();
                    return "Ending warmup";
                },
            },
            {
                label: "Restart",
                danger: true,
                run: () => {
                    Console.ServerCommand("mp_restartgame 1");
                    return "Restarting in 1s";
                },
            },
        ],
    };
}
