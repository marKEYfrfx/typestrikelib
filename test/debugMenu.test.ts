import { deepEq, eq, ok, test } from "./harness";
import { BaseModelEntity, CSInputs, CustomHudLayout } from "cs_script/point_script";
import { addEntity, addPlayer, mock } from "./mock/point_script";
import layoutXml from "../panorama/layout/custom_game/typestrike_debug.xml";
import layoutCss from "../panorama/styles/custom_game/typestrike_debug.css";
import { DebugMenu, formatCell, type DebugTab } from "../src/lib/ui/debugMenu/DebugMenu";
import { DEBUG_LAYOUT, DebugIds, allButtonIds, allLabelIds } from "../src/lib/ui/debugMenu/layout";
import { entityTab, playersTab, toolsTab } from "../src/lib/ui/debugMenu/tabs";
import { HudSync } from "../src/lib/ui/hudSync";
import { ENGINE_EXPORTS, missingEngineExports } from "../src/lib/core/engine";
import * as Mock from "./mock/point_script";
export { run } from "./harness";

// ---------------------------------------------------------------- the layout files

test("every label and button DebugMenu uses exists in the XML", () => {
    for (const id of allLabelIds()) ok(layoutXml.includes(`<Label id="${id}" `) && layoutXml.includes(`text="{s:${id}}"`), `label ${id}`);
    for (const id of allButtonIds()) ok(layoutXml.includes(`<Button id="${id}" `), `button ${id}`);
    const ids = [...layoutXml.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    eq(new Set(ids).size, ids.length, "ids are unique");
    ok(/<Panel id="tsd_menu" class="[^"]*\bhidden\b/.test(layoutXml), "menu starts hidden");
    ok(layoutXml.includes('src="file://{resources}/styles/custom_game/typestrike_debug.css"'), "includes the stylesheet");
    eq((layoutXml.match(/<Button id="tsd_row_/g) ?? []).length, DEBUG_LAYOUT.rows);
});

test("the CSS styles every class DebugMenu toggles", () => {
    for (const sel of [".hidden", ".TsdMenu.interactive", ".TsdTab.on", ".TsdRow.selected", ".TsdAction.on", ".TsdAction.off", ".TsdAction.danger", ".TsdPageButton.off", ".pos-left", ".pos-center", ".HUD_SCOREBOARD_VISIBLE"]) {
        ok(layoutCss.includes(sel), `css has ${sel}`);
    }
    for (let n = 1; n < DEBUG_LAYOUT.columns; n++) ok(layoutCss.includes(`.TsdTable.cols-${n} .c${DEBUG_LAYOUT.columns - 1}`), `cols-${n} hides the last column`);
    // Every class used in the XML is styled.
    const classes = new Set([...layoutXml.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)));
    for (const c of classes) if (!/^(c\d|cols-\d)$/.test(c)) ok(layoutCss.includes(`.${c}`), `css has .${c}`);
});

test("formatCell formats and truncates", () => {
    eq(formatCell(12), "12");
    eq(formatCell(12.345), "12.3");
    eq(formatCell(true), "yes");
    eq(formatCell(undefined), "");
    eq(formatCell({ x: 1, y: 2, z: 3 }), "(1, 2, 3)");
    eq(formatCell("a very long entity name indeed", 10), "a very l..");
    eq(formatCell("two\nlines"), "two lines");
});

// ---------------------------------------------------------------- behaviour

const hud: any = addEntity(new CustomHudLayout(), "typestrike_debug");
hud.loadLayout(layoutXml);
const mark = addPlayer(0, "Mark", 3);
const bob = addPlayer(1, "Bob", 2);
const stranger = addPlayer(2, "Stranger", 2);
mark.pawn.origin = { x: 0, y: 0, z: 0 };

const sees = (p: any, panel: string, cls: string) => hud.hasClass(p.slot, panel, cls);
const textOf = (p: any, label: string) => hud.text(p.slot, label);
const click = (p: any, buttonId: string) => mock.emit("CustomHudClicked", { player: p, layout: hud, buttonId });
const chat = (p: any, text: string) => mock.emit("PlayerChat", { player: p, text, team: 0 });

const numbers: DebugTab<number> = {
    title: "Numbers",
    columns: ["N", "Square", "Even"],
    rows: () => Array.from({ length: 20 }, (_, i) => ({ key: `n${i}`, data: i, cells: [`n${i}`, i * i, i % 2 === 0] })),
    onSelect: (row) => `picked ${row.data}`,
    actions: [
        { label: "Plain", run: () => "plain ran" },
        { label: (ctx) => `Double ${ctx.selected?.data ?? "?"}`, needsSelection: true, run: (ctx) => `double is ${ctx.selected!.data! * 2}` },
        { label: "Toggle", active: () => toggled, run: () => void (toggled = !toggled) },
    ],
};
let toggled = false;

const menu = new DebugMenu({ cursorKey: CSInputs.USE, allow: (p) => p.GetPlayerName() !== "Stranger" });
menu.addTab(numbers);
menu.addTab(playersTab());

test("!debug opens the menu only for that player and resets the HUD first", () => {
    chat(mark, "!debug");
    eq(hud.resets, 1, "Reset() on first use");
    ok(!sees(mark, DebugIds.menu, "hidden"), "Mark sees the menu");
    ok(sees(bob, DebugIds.menu, "hidden"), "Bob doesn't");
    eq(textOf(mark, DebugIds.title), "typestrike debug");
    eq(textOf(mark, DebugIds.tabLabel(0)), "Numbers");
    eq(textOf(mark, DebugIds.tabLabel(1)), "Players");
    ok(sees(mark, DebugIds.tab(2), "hidden"), "unused tab slots hidden");
    ok(sees(mark, DebugIds.tab(0), "on"), "first tab active");
    ok(sees(mark, DebugIds.table, "cols-3") && !sees(mark, DebugIds.table, "cols-5"), "3 columns");
    eq(textOf(mark, DebugIds.headCell(1)), "Square");
    eq(textOf(mark, DebugIds.cell(3, 0)), "n3");
    eq(textOf(mark, DebugIds.cell(3, 1)), "9");
    eq(textOf(mark, DebugIds.cell(4, 2)), "yes");
    eq(textOf(mark, DebugIds.page), "1 / 2");
    ok(sees(mark, DebugIds.prev, "off") && !sees(mark, DebugIds.next, "off"));
});

test("!debug logs what it did", () => {
    ok(mock.logs.some((l) => l.includes("!debug: opened the debug menu for Mark")), mock.logs.slice(-3).join(" / "));
});

test("ts_debug console command works for the first human player", () => {
    const cmd = mock.cheatCommands.get("ts_debug")!;
    ok(cmd, "registered as a cheat command");
    cmd("players");
    ok(sees(mark, DebugIds.tab(1), "on"), "switched tab");
    cmd("numbers");
    ok(sees(mark, DebugIds.tab(0), "on"));
    ok(mock.logs.some((l) => l.includes(`ts_debug numbers: opened tab "numbers" for Mark`)));
});

test("players who aren't allowed can't open it", () => {
    chat(stranger, "!debug");
    ok(sees(stranger, DebugIds.menu, "hidden"));
    eq(menu.isOpen(stranger), false);
});

test("paging", () => {
    click(mark, DebugIds.next);
    eq(textOf(mark, DebugIds.page), "2 / 2");
    eq(textOf(mark, DebugIds.cell(0, 0)), "n12");
    ok(!sees(mark, DebugIds.row(7), "hidden") && sees(mark, DebugIds.row(8), "hidden"), "8 rows on page 2");
    click(mark, DebugIds.next); // already last page
    eq(textOf(mark, DebugIds.page), "2 / 2");
    click(mark, DebugIds.prev);
    eq(textOf(mark, DebugIds.page), "1 / 2");
});

test("selecting rows and running actions", () => {
    ok(sees(mark, DebugIds.action(1), "off"), "needs-selection action starts disabled");
    eq(textOf(mark, DebugIds.actionLabel(1)), "Double ?");
    click(mark, DebugIds.action(1));
    eq(textOf(mark, DebugIds.status), "Select a row first");

    click(mark, DebugIds.row(5));
    ok(sees(mark, DebugIds.row(5), "selected"));
    eq(textOf(mark, DebugIds.status), "picked 5");
    ok(!sees(mark, DebugIds.action(1), "off"));
    eq(textOf(mark, DebugIds.actionLabel(1)), "Double 5");
    click(mark, DebugIds.action(1));
    eq(textOf(mark, DebugIds.status), "double is 10");

    ok(!sees(mark, DebugIds.action(2), "on"));
    click(mark, DebugIds.action(2));
    ok(sees(mark, DebugIds.action(2), "on"), "toggle shows as on");
    ok(sees(mark, DebugIds.action(3), "hidden"), "unused action slots hidden");
    ok(sees(mark, DebugIds.actionRow(1), "hidden"), "second action row hidden with 3 actions");

    click(mark, DebugIds.row(5));
    ok(!sees(mark, DebugIds.row(5), "selected"), "clicking again deselects");
});

test("status messages expire", () => {
    menu.setStatus(mark, "hello", 1);
    eq(textOf(mark, DebugIds.status), "hello");
    mock.advance(1.3);
    eq(textOf(mark, DebugIds.status), "");
});

test("mouse cursor: header button, key, and close", () => {
    click(mark, DebugIds.mouse);
    ok(hud.IsInputCaptureEnabled(0), "capture on");
    ok(sees(mark, DebugIds.menu, "interactive"));
    eq(textOf(mark, DebugIds.mouseLabel), "MOUSE ON");
    mark.pawn.justPressed = CSInputs.USE;
    mock.advance(1 / 64);
    mark.pawn.justPressed = 0;
    ok(!hud.IsInputCaptureEnabled(0), "cursor key toggles it off");
    menu.setCursor(mark, true);
    click(mark, DebugIds.close);
    ok(!hud.IsInputCaptureEnabled(0), "closing releases the mouse");
    ok(sees(mark, DebugIds.menu, "hidden"));
    eq(menu.isOpen(mark), false);
});

test("tabs by click and by chat, with the selection cleared", () => {
    chat(mark, "!debug players");
    ok(menu.isOpen(mark));
    ok(sees(mark, DebugIds.tab(1), "on"));
    ok(sees(mark, DebugIds.table, "cols-5"));
    eq(textOf(mark, DebugIds.cell(0, 0)), "Bob", "sorted by team (T first)");
    eq(textOf(mark, DebugIds.cell(2, 0)), "Mark");
    eq(textOf(mark, DebugIds.cell(2, 1)), "CT");
    click(mark, DebugIds.tab(0));
    ok(sees(mark, DebugIds.tab(0), "on"));
    chat(mark, "!debug 2");
    ok(sees(mark, DebugIds.tab(1), "on"), "1-based tab number");
});

test("redraws only send what changed", () => {
    mock.advance(0.5);
    const before = hud.calls.length;
    mock.advance(0.5);
    const perRefresh = (hud.calls.length - before) / Math.round(0.5 / 0.2);
    ok(perRefresh <= 3, `about ${perRefresh} writes per refresh when nothing changes (the clock)`);
});

test("nothing runs per tick (refresh, cursor key polling) when nobody has the menu open", () => {
    menu.close(mark);
    mock.advance(1);
    eq(mock.nextThink, undefined);
});

test("a player leaving clears their HUD overrides and mouse capture", () => {
    menu.open(bob, { cursor: true });
    ok(hud.IsInputCaptureEnabled(1));
    mock.emit("PlayerDisconnect", { playerSlot: 1 });
    ok(hud.playerResets.includes(1));
    ok(!hud.IsInputCaptureEnabled(1));
    eq(menu.isOpen(bob), false);
});

test("watch values are per viewer", () => {
    const m = new DebugMenu({ command: false, layout: "typestrike_debug" });
    m.watch("Name", (ctx) => ctx.viewer.GetPlayerName());
    m.watch("Fixed", 42);
    m.open(mark, { tab: "watch" });
    eq(textOf(mark, DebugIds.cell(0, 1)), "Mark");
    eq(textOf(mark, DebugIds.cell(1, 1)), "42");
    m.dispose();
});

test("entity tab: nearest first, with select, glow and go-to actions", () => {
    const near: any = addEntity(new BaseModelEntity(), "crate_near", "prop_physics");
    near.origin = { x: 100, y: 0, z: 0 };
    const far: any = addEntity(new BaseModelEntity(), "crate_far", "prop_physics");
    far.origin = { x: 900, y: 0, z: 0 };
    const m = new DebugMenu({ command: false });
    m.addTab(entityTab("Crates", { name: "crate_*" }));
    m.open(mark);
    eq(textOf(mark, DebugIds.cell(0, 0)), "crate_near");
    eq(textOf(mark, DebugIds.cell(1, 0)), "crate_far");
    eq(textOf(mark, DebugIds.cell(0, 3)), "100", "distance column");
    click(mark, DebugIds.row(1));
    ok(textOf(mark, DebugIds.status).includes(`prop_physics "crate_far" at`));
    click(mark, DebugIds.action(2)); // Glow
    ok(far.glowing);
    ok(sees(mark, DebugIds.action(2), "on"));
    click(mark, DebugIds.action(0)); // Go to
    ok(Math.abs(mark.pawn.origin.x - 900) <= 64 * 2 + 1, `moved near the crate (x=${mark.pawn.origin.x})`);
    click(mark, DebugIds.action(3)); // Remove
    eq(far.valid, false);
    m.dispose();
});

test("tools tab: god mode blocks damage for that player only", () => {
    const m = new DebugMenu({ command: false });
    m.addTab(toolsTab());
    m.open(mark);
    eq(textOf(mark, DebugIds.cell(0, 1)), "mock_map");
    click(mark, DebugIds.action(1)); // God mode
    ok(sees(mark, DebugIds.action(1), "on"));
    deepEq(mock.emit("ModifyPlayerDamage", { player: mark.pawn, damage: 50, damageTypes: 0, damageFlags: 0, hitGroup: 1 }), { abort: true });
    eq(mock.emit("ModifyPlayerDamage", { player: stranger.pawn, damage: 50, damageTypes: 0, damageFlags: 0, hitGroup: 1 }), undefined);
    click(mark, DebugIds.action(0)); // Noclip
    ok(mark.pawn.IsNoclipping());
    m.dispose();
});

test("announces at map load whether the HUD entity was found", () => {
    const m = new DebugMenu({ command: "dbg3", consoleCommand: false });
    mock.emit("Activate");
    ok(mock.logs.some((l) => l.includes(`Debug menu ready (HUD entity "typestrike_debug" found): type !dbg3 in chat`)));
    m.dispose();
});

test("missing HUD entity: warns once and explains in chat", () => {
    const m = new DebugMenu({ layout: "nope", command: "dbg2" });
    const warnings = () => mock.logs.filter((l) => l.includes(`no custom_hud_layout named "nope"`)).length;
    eq(m.open(mark), false);
    m.open(mark);
    eq(warnings(), 1);
    const before = mock.serverCommands.length;
    chat(mark, "!dbg2");
    ok(mock.serverCommands.slice(before).some((c) => c.includes("typestrike_debug.vxml")), "chat reply names the layout asset");
    m.dispose();
});

test("only 6 tabs fit", () => {
    const m = new DebugMenu({ command: false });
    for (let i = 0; i < 7; i++) m.addTab({ title: `T${i}`, columns: ["a"], rows: () => [] });
    eq(m.tabs.length, 6);
    ok(mock.logs.some((l) => l.includes(`"T6" was not added`)));
    m.dispose();
});

test("HudSync skips repeated writes and resends after forget()", () => {
    const layout: any = new CustomHudLayout();
    const sync = new HudSync(layout);
    sync.text("a", "1", 0);
    sync.text("a", "1", 0);
    sync.cls("p", "on", true);
    sync.cls("p", "on", true);
    eq(layout.calls.length, 2);
    sync.forget(0);
    sync.text("a", "1", 0);
    eq(layout.calls.length, 3);
    eq(sync.skipped, 2);
});

test("engine exports: none missing in the mock, all reported for an empty module", () => {
    deepEq(missingEngineExports(Mock), []);
    deepEq(missingEngineExports({}), [...ENGINE_EXPORTS]);
});
