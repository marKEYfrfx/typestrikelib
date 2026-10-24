import { deepEq, eq, ok, test } from "./harness";
import { CSDamageFlags, CSPlayerPawn } from "cs_script/point_script";
import { mock } from "./mock/point_script";
import { Events, type GameEventListener, type GameEventPayload } from "../src/lib/core/events";
import type { ModfiyPlayerDamageResult } from "cs_script/point_script";
import { Scope, Signal } from "../src/lib/core/signal";
import { Timers } from "../src/lib/core/scheduler";
import { preventDamage, scaleDamage, pierceArmor } from "../src/lib/game/damage";
export { run } from "./harness";

test("one engine registration, many listeners", () => {
    const seen: string[] = [];
    Events.on("PlayerJump", () => void seen.push("a"));
    Events.on("PlayerJump", () => void seen.push("b"));
    ok(mock.handlers.has("OnPlayerJump"), "registered with Instance");
    mock.emit("PlayerJump", { player: new CSPlayerPawn() });
    deepEq(seen, ["a", "b"]);
    Events.clear("PlayerJump");
});

test("unsubscribe, once and off", () => {
    let a = 0;
    let b = 0;
    let c = 0;
    const offA = Events.on("RoundStart", () => void a++);
    Events.once("RoundStart", () => void b++);
    const fnC = () => void c++;
    Events.on("RoundStart", fnC);
    mock.emit("RoundStart");
    offA();
    offA(); // twice is fine
    Events.off("RoundStart", fnC);
    mock.emit("RoundStart");
    deepEq([a, b, c], [1, 1, 1]);
    eq(Events.listenerCount("RoundStart"), 0);
});

test("a listener that unsubscribes another during dispatch", () => {
    const seen: string[] = [];
    let offB = () => {};
    Events.on("RoundEnd", () => {
        seen.push("a");
        offB();
    });
    offB = Events.on("RoundEnd", () => void seen.push("b"));
    mock.emit("RoundEnd", { winningTeam: 2, reason: 9 });
    deepEq(seen, ["a"]);
    Events.clear("RoundEnd");
});

test("errors are isolated and logged", () => {
    let after = false;
    Events.on("PlayerLand", () => {
        throw new Error("listener exploded");
    });
    Events.on("PlayerLand", () => void (after = true));
    mock.emit("PlayerLand", { player: new CSPlayerPawn() });
    ok(after);
    ok(mock.logs.some((l) => l.includes("listener exploded") && l.includes("PlayerLand")));
    Events.clear("PlayerLand");
});

test("ModifyPlayerDamage results are combined in order", () => {
    const base = { player: new CSPlayerPawn(), damage: 40, damageTypes: 0, damageFlags: 0, hitGroup: 2 };
    eq(mock.emit("ModifyPlayerDamage", base), undefined, "no listeners: no result");

    const offScale = scaleDamage(() => 0.5);
    const seenDamage: number[] = [];
    Events.on("ModifyPlayerDamage", (e) => void seenDamage.push(e.damage));
    const offPierce = pierceArmor();
    deepEq(mock.emit("ModifyPlayerDamage", base), { damage: 20, damageFlags: CSDamageFlags.IGNORE_ARMOR });
    deepEq(seenDamage, [20], "later listeners see earlier changes");

    let god = true;
    const offGod = preventDamage(() => god);
    deepEq(mock.emit("ModifyPlayerDamage", base), { abort: true });
    god = false;
    deepEq(mock.emit("ModifyPlayerDamage", base), { damage: 20, damageFlags: CSDamageFlags.IGNORE_ARMOR });
    offScale();
    offPierce();
    offGod();
    Events.clear("ModifyPlayerDamage");
    eq(mock.emit("ModifyPlayerDamage", base), undefined);
});

test("only changed fields are returned", () => {
    Events.on("ModifyPlayerDamage", (e) => ({ damageFlags: e.damageFlags | CSDamageFlags.IGNORE_ARMOR }));
    const r = mock.emit("ModifyPlayerDamage", { player: new CSPlayerPawn(), damage: 10, damageTypes: 0, damageFlags: 0, hitGroup: 1 });
    deepEq(r, { damageFlags: CSDamageFlags.IGNORE_ARMOR });
    Events.clear("ModifyPlayerDamage");
});

test("Events.next resolves with the payload", async () => {
    const p = Events.next("PlayerPing");
    mock.emit("PlayerPing", { player: "x", position: { x: 1, y: 2, z: 3 } });
    deepEq((await p).position, { x: 1, y: 2, z: 3 });
});

test("script inputs are routed by name", () => {
    const got: string[] = [];
    Events.onScriptInput("start", () => void got.push("start1"));
    Events.onScriptInput("start", () => void got.push("start2"));
    Events.onScriptInput("stop", () => void got.push("stop"));
    mock.scriptInputs.get("start")!({});
    mock.scriptInputs.get("stop")!({});
    deepEq(got, ["start1", "start2", "stop"]);
});

test("Signal connect / once / emit", () => {
    const s = new Signal<number>();
    const got: number[] = [];
    const off = s.connect((v) => void got.push(v));
    s.once((v) => void got.push(v * 10));
    s.emit(1);
    s.emit(2);
    off();
    s.emit(3);
    deepEq(got, [1, 10, 2]);
    eq(s.size, 0);
});

test("Scope disposes listeners and timers together", () => {
    const scope = new Scope();
    let jumps = 0;
    let ticks = 0;
    scope.add(Events.on("PlayerJump", () => void jumps++));
    scope.add(Timers.every(0.1, () => void ticks++));
    mock.emit("PlayerJump", { player: new CSPlayerPawn() });
    mock.advance(0.35);
    scope.dispose();
    mock.emit("PlayerJump", { player: new CSPlayerPawn() });
    const before = ticks;
    mock.advance(0.5);
    eq(jumps, 1);
    eq(ticks, before);
    eq(scope.size, 0);
});

// Compile-time checks of the event types derived from point_script.d.ts (checked by `npm run typecheck`).
type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
export type EventTypeChecks = [
    Expect<Equal<GameEventPayload<"RoundStart">, void>>,
    Expect<Equal<GameEventPayload<"PlayerJump">, { player: CSPlayerPawn }>>,
    Expect<Equal<GameEventPayload<"PlayerDisconnect">, { playerSlot: number }>>,
    Expect<Equal<ReturnType<GameEventListener<"ModifyPlayerDamage">>, ModfiyPlayerDamageResult | void>>,
];
