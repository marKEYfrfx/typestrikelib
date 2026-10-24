import { deepEq, eq, ok, test } from "./harness";
import { mock } from "./mock/point_script";
import { Timers, wait, waitTicks, waitUntil } from "../src/lib/core/scheduler";
export { run } from "./harness";

test("after() fires once at the right time", () => {
    const hits: number[] = [];
    Timers.after(1, () => void hits.push(mock.time));
    mock.advance(0.5);
    eq(hits.length, 0);
    mock.advance(0.6);
    eq(hits.length, 1);
    ok(Math.abs(hits[0] - 1) <= 1 / 64, `fired at ${hits[0]}`);
    mock.advance(2);
    eq(hits.length, 1);
});

test("timers run in time order and the engine is asked to think only when needed", () => {
    const order: string[] = [];
    Timers.after(0.5, () => void order.push("b"));
    Timers.after(0.25, () => void order.push("a"));
    Timers.after(0.75, () => void order.push("c"));
    ok(mock.nextThink !== undefined && Math.abs(mock.nextThink - (mock.time + 0.25)) < 1e-9, "next think is the earliest timer");
    mock.advance(1);
    deepEq(order, ["a", "b", "c"]);
    eq(mock.nextThink, undefined, "no think scheduled when nothing is pending");
});

test("every() repeats, honours times, and stops when the callback returns false", () => {
    let a = 0;
    let b = 0;
    let c = 0;
    Timers.every(0.1, () => void a++);
    Timers.every(0.1, () => void b++, { times: 3 });
    Timers.every(0.1, () => ++c < 2);
    mock.advance(1.0);
    ok(a >= 9 && a <= 11, `a ran ${a} times`);
    eq(b, 3);
    eq(c, 2);
    Timers.cancelAll();
});

test("everyTick runs once per tick and cancel works from inside the callback", () => {
    let n = 0;
    const t = Timers.everyTick((self) => {
        n++;
        if (n === 5) self.cancel();
    });
    mock.advance(1);
    eq(n, 5);
    eq(t.active, false);
});

test("a timer scheduled from inside a timer runs on a later tick", () => {
    const log: string[] = [];
    Timers.nextTick(() => {
        log.push("outer");
        Timers.nextTick(() => void log.push("inner"));
    });
    mock.advance(1 / 64);
    deepEq(log, ["outer"]);
    mock.advance(1 / 64);
    deepEq(log, ["outer", "inner"]);
});

test("an earlier timer added later reschedules the think", () => {
    const hits: string[] = [];
    Timers.after(5, () => void hits.push("late"));
    Timers.after(0.2, () => void hits.push("early"));
    mock.advance(0.3);
    deepEq(hits, ["early"]);
    mock.advance(5);
    deepEq(hits, ["early", "late"]);
});

test("a throwing timer doesn't stop the others", () => {
    let ran = false;
    Timers.after(0.1, () => {
        throw new Error("boom");
    });
    Timers.after(0.1, () => void (ran = true));
    mock.advance(0.2);
    ok(ran);
    ok(mock.logs.some((l) => l.includes("boom")), "error was logged");
});

test("recovers if a requested think never happened", () => {
    let ran = false;
    Timers.after(0.5, () => {});
    mock.nextThink = undefined; // simulate the engine dropping our think
    mock.time += 2;
    Timers.after(1, () => void (ran = true));
    mock.advance(1.1);
    ok(ran);
});

test("wait, waitTicks and waitUntil resolve", async () => {
    const start = mock.time;
    const p1 = wait(0.5).then(() => mock.time - start);
    let flag = false;
    Timers.after(0.3, () => void (flag = true));
    const p2 = waitUntil(() => flag, { timeout: 2 });
    const p3 = waitUntil(() => false, { timeout: 0.2 });
    const p4 = waitTicks(3).then(() => mock.time - start);
    for (let i = 0; i < 80; i++) {
        mock.advance(1 / 64);
        await Promise.resolve();
    }
    ok((await p1) >= 0.49, "wait");
    eq(await p2, true);
    eq(await p3, false);
    ok(Math.abs((await p4) - 3 / 64) < 1e-9, "waitTicks(3)");
});
