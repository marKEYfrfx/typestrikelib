/**
 * Example map script. `npm run build` bundles this file and the library into scripts/bundle.js.
 *
 * Map setup (Hammer):
 * - a point_script whose cs_script is scripts/bundle.vjs
 * - a custom_hud_layout named "typestrike_debug" whose layout is
 *   panorama/layout/custom_game/typestrike_debug.vxml (for the debug menu)
 *
 * In game: type !debug in chat (or ts_debug in the console with sv_cheats 1) to open the menu,
 * press F (inspect) or click MOUSE for the cursor.
 */
import {
    CSInputs,
    ChatCommands,
    DebugMenu,
    Events,
    Logger,
    Pawn,
    Vec,
    describeEntity,
    entityTab,
    findAllByClass,
    getAimTarget,
    getPlayerName,
    playersTab,
    toolsTab,
} from "./lib";

const log = new Logger("typestrikelib");

// ---------------------------------------------------------------- debug menu

const debug = new DebugMenu({ cursorKey: CSInputs.LOOK_AT_WEAPON });

debug.addTab(playersTab());
debug.addTab(
    entityTab("Props", () => [
        ...findAllByClass("prop_physics_multiplayer"),
        ...findAllByClass("prop_physics"),
        ...findAllByClass("prop_dynamic"),
    ]),
);
// Every entity with a targetname, nearest first: handy for exploring a map.
debug.addTab(entityTab("Named", { name: "*" }));
debug.addTab(toolsTab());

// Per-viewer live values in the Watch tab.
debug.watch("Speed", ({ pawn }) => (pawn ? Math.round(Pawn.speed2D(pawn)) : "-"));
debug.watch("On ground", ({ pawn }) => (pawn ? Pawn.isOnGround(pawn) : "-"));
debug.watch("Position", ({ pawn }) => pawn?.GetAbsOrigin());
debug.watch("Looking at", ({ pawn }) => {
    const target = pawn && getAimTarget(pawn, 4096);
    return target ? describeEntity(target) : "nothing";
});

// ---------------------------------------------------------------- a few chat commands

ChatCommands.enableHelp();

ChatCommands.register("hp", {
    description: "Set your health",
    usage: "[amount]",
    requireAlive: true,
    handler: (ctx) => {
        const hp = ctx.int(0, 100)!;
        ctx.pawn!.SetHealth(hp);
        debug.setStatus(ctx.player, `Health set to ${hp}`);
    },
});

ChatCommands.register("where", {
    description: "Print your position",
    requireAlive: true,
    handler: (ctx) => ctx.reply(Vec.format(ctx.pawn!.GetAbsOrigin())),
});

Events.on("PlayerActivate", ({ player }) => log.info(getPlayerName(player), "joined - type !debug for the debug menu"));

log.info("loaded");
