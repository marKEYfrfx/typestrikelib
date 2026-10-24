import { eq, ok, test } from "./harness";
import { CustomHudLayout } from "cs_script/point_script";
import { addEntity, addPlayer, mock } from "./mock/point_script";
import layoutXml from "../panorama/layout/custom_game/typestrike_debug.xml";
import { DebugIds } from "../src/lib/ui/debugMenu/layout";
export { run } from "./harness";

// Runs src/index.ts (the example map script) against the mock to make sure it loads and works.
test("example entry point loads, opens the debug menu and answers chat commands", async () => {
    const hud: any = addEntity(new CustomHudLayout(), "typestrike_debug");
    hud.loadLayout(layoutXml);
    await import("../src/index");
    ok(mock.logs.some((l) => l === "[typestrikelib] loaded"), "top level ran");

    const player = addPlayer(0, "Mark", 3);
    player.pawn.velocity = { x: 300, y: 400, z: 0 };
    mock.emit("PlayerChat", { player, text: "!debug watch", team: 0 });
    ok(!hud.hasClass(0, DebugIds.menu, "hidden"), "menu open");
    eq(hud.text(0, DebugIds.tabLabel(4)), "Watch", "five tabs: Players, Props, Named, Tools, Watch");
    eq(hud.text(0, DebugIds.cell(0, 0)), "Speed");
    eq(hud.text(0, DebugIds.cell(0, 1)), "500");

    mock.emit("PlayerChat", { player, text: "!hp 55", team: 0 });
    eq(player.pawn.health, 55);
    eq(hud.text(0, DebugIds.status), "Health set to 55", "status shown in the menu");

    // Press F (inspect) for the cursor, then let timers and polling run.
    player.pawn.justPressed = 1 << 12;
    mock.advance(1 / 64);
    player.pawn.justPressed = 0;
    ok(hud.IsInputCaptureEnabled(0), "F gives the mouse");
    const errorsBefore = mock.logs.filter((l) => l.includes("ERROR")).length;
    for (let tab = 0; tab < 5; tab++) {
        mock.emit("CustomHudClicked", { player, layout: hud, buttonId: DebugIds.tab(tab) });
        mock.advance(0.5);
    }
    eq(mock.logs.filter((l) => l.includes("ERROR")).length, errorsBefore, "every tab renders without errors");
});
