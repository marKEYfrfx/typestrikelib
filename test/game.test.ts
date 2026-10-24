import { deepEq, eq, ok, test } from "./harness";
import { BaseModelEntity, CSRoundEndReason, CustomHudLayout } from "cs_script/point_script";
import { GameRules, addEntity, addPlayer, mock } from "./mock/point_script";
import { Convars, ConvarPresets } from "../src/lib/game/convars";
import { Round } from "../src/lib/game/round";
import { Team, otherTeam, parseTeam, teamName } from "../src/lib/game/constants";
import { SaveStore, _resetSaveCache } from "../src/lib/util/save";
import { Cooldown, Stopwatch, formatTime } from "../src/lib/util/time";
import { clearPersistentState, onReload, persistentState } from "../src/lib/core/reload";
import { HudLayout } from "../src/lib/ui/hud";
import { inspect, Logger } from "../src/lib/core/log";
export { run } from "./harness";

test("Convars.apply returns a snapshot that restores", () => {
    mock.convars.set("sv_gravity", 800);
    mock.convars.set("sv_enablebunnyhopping", false);
    mock.convars.set("sv_airaccelerate", 12);
    const saved = Convars.apply({ sv_gravity: 400, sv_enablebunnyhopping: true, sv_airaccelerate: 100, not_a_cvar: 1 });
    eq(mock.convars.get("sv_gravity"), 400);
    eq(mock.convars.get("sv_enablebunnyhopping"), true);
    eq(mock.convars.has("not_a_cvar"), false, "unknown convars are skipped, not created");
    Convars.restore(saved);
    deepEq([mock.convars.get("sv_gravity"), mock.convars.get("sv_enablebunnyhopping"), mock.convars.get("sv_airaccelerate")], [800, false, 12]);
    eq(Convars.number("sv_gravity", 1), 800);
    eq(Convars.number("missing", 1), 1);
    eq(Object.keys(ConvarPresets.kz).length, 20, "all 20 KZ settings from CKZExec");
});

test("Round.win adds score and ends with the team's reason", () => {
    Round.win(Team.CT, { delay: 3 });
    eq(GameRules.scores[3], 1);
    deepEq(GameRules.terminated.at(-1), [CSRoundEndReason.CTS_WIN, 3]);
    Round.win(Team.T, { addScore: false });
    eq(GameRules.scores[2], 0);
    deepEq(GameRules.terminated.at(-1), [CSRoundEndReason.TERRORISTS_WIN, undefined]);
    Round.addTime(-500);
    eq(Round.timeLeft(), 0, "never negative");
});

test("team helpers", () => {
    eq(otherTeam(Team.T), Team.CT);
    eq(otherTeam(Team.SPECTATOR), Team.SPECTATOR);
    eq(parseTeam("ct"), Team.CT);
    eq(parseTeam("banana"), undefined);
    eq(teamName(2), "Terrorist");
});

test("SaveStore: defaults, save, reload from disk, debounce", () => {
    mock.saveData = "";
    _resetSaveCache();
    const store = new SaveStore("records", { best: 0, runs: 0, names: [] as string[] });
    eq(store.data.runs, 0);
    store.data.runs = 3;
    store.data.names.push("alice");
    store.save();
    const other = new SaveStore("settings", { volume: 5 });
    other.update((d) => void (d.volume = 7), true);

    _resetSaveCache();
    const again = new SaveStore("records", { best: 0, runs: 0, names: [] as string[], added: "default" });
    deepEq(again.data, { best: 0, runs: 3, names: ["alice"], added: "default" }, "new keys filled from defaults");
    eq(new SaveStore("settings", { volume: 5 }).data.volume, 7, "stores don't overwrite each other");

    const writes = mock.saveWrites;
    again.saveSoon(1);
    again.saveSoon(1);
    again.saveSoon(1);
    mock.advance(1.1);
    eq(mock.saveWrites - writes, 1, "saveSoon merges writes");
});

test("SaveStore: versions, migration and foreign data", () => {
    mock.saveData = JSON.stringify({ typestrike: 1, stores: { s: { v: 1, d: { hp: 10 } } } });
    _resetSaveCache();
    const migrated = new SaveStore("s", { health: 0 }, { version: 2, migrate: (old) => ({ health: (old as { hp: number }).hp * 10 }) });
    eq(migrated.data.health, 100);

    mock.saveData = "legacy save string";
    _resetSaveCache();
    const s = new SaveStore("x", { a: 1 });
    s.save();
    const parsed = JSON.parse(mock.saveData);
    eq(parsed.raw, "legacy save string", "foreign data preserved");
    eq(parsed.stores.x.d.a, 1);
});

test("formatTime, Stopwatch and Cooldown", () => {
    eq(formatTime(7.25), "0:07.250");
    eq(formatTime(65), "1:05.000");
    eq(formatTime(3723.004), "1:02:03.004");
    eq(formatTime(59.9996), "1:00.000");
    eq(formatTime(65.4, 0), "1:05");
    eq(formatTime(65.9, 0), "1:06", "rounds to nearest");
    eq(formatTime(-1.5, 1), "-0:01.5");

    const sw = new Stopwatch().start();
    mock.advance(1);
    const t = sw.stop();
    ok(Math.abs(t - 1) < 0.02, `stopwatch ${t}`);
    mock.advance(1);
    eq(sw.elapsed, t, "paused");

    const cd = new Cooldown(2);
    ok(cd.tryUse(1));
    ok(!cd.tryUse(1));
    ok(cd.ready(2), "keys are independent");
    mock.advance(2.1);
    ok(cd.tryUse(1));
});

test("reload hooks and persistent state", () => {
    let score = 5;
    onReload("score", { before: () => score, after: (saved) => void (score = (saved ?? 0) + 1) });
    const memory = mock.reload!.before!();
    score = 0;
    mock.reload!.after!(memory);
    eq(score, 6);

    clearPersistentState();
    const a = persistentState("wave", () => ({ n: 1 }));
    a.n = 4;
    eq(persistentState("wave", () => ({ n: 1 })).n, 4, "same object on second call (as after a reload)");
});

test("HudLayout routes per-player calls by slot", () => {
    const layout = addEntity(new CustomHudLayout(), "hud", "custom_hud_layout");
    const player = addPlayer(5, "Hud Guy");
    const hud = HudLayout.require("hud");
    hud.setText("dialog", "title", "Hi");
    hud.setText("dialog", "money", 800, player);
    hud.hide("dialog", player.pawn);
    deepEq(layout.calls, [
        ["text", "dialog", "title", "Hi"],
        ["textFor", 5, "dialog", "money", "800"],
        ["classFor", 5, "dialog", "Hidden", true],
    ]);
    let clicked = "";
    hud.onClick("btn_ok", (p, id) => void (clicked = `${p.GetPlayerName()}:${id}`));
    mock.emit("CustomHudClicked", { player, layout, buttonId: "btn_ok" });
    mock.emit("CustomHudClicked", { player, layout: new CustomHudLayout(), buttonId: "btn_ok" });
    eq(clicked, "Hud Guy:btn_ok");
    eq(HudLayout.find("prop1"), undefined, "not a hud layout");
});

test("inspect and Logger formatting", () => {
    const e = addEntity(new BaseModelEntity(), "crate", "prop_physics");
    eq(inspect(e), `prop_physics "crate"`);
    eq(inspect({ x: 1, y: 2.5, z: 3 }), "(1, 2.50, 3)");
    eq(inspect({ pitch: 0, yaw: 90, roll: 0 }), "[0, 90, 0]");
    eq(inspect({ a: [1, "b"], m: new Map([["k", 1]]) }), `{ a: [1, "b"], m: Map(1) {"k" => 1} }`);
    const cyc: Record<string, unknown> = {};
    cyc.self = cyc;
    eq(inspect(cyc), "{ self: [Circular] }");
    const log = new Logger("map");
    log.info("spawned", e, "at", { x: 0, y: 0, z: 0 });
    eq(mock.logs.at(-1), `[map] spawned prop_physics "crate" at (0, 0, 0)`);
    log.debug("hidden by default");
    eq(mock.logs.at(-1), `[map] spawned prop_physics "crate" at (0, 0, 0)`);
    log.child("waves").warn("late");
    eq(mock.logs.at(-1), "[map:waves] WARN: late");
});
