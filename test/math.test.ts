import { deepEq, eq, near, ok, test } from "./harness";
import * as Vec from "../src/lib/math/vector";
import * as Ang from "../src/lib/math/angles";
import { approach, clamp, remap, wrap, roundTo } from "../src/lib/math/math";
import { hex, hsv, lerpColor, toHex } from "../src/lib/math/color";
import { pick, randomInt, seededRandom, shuffle, weightedPick } from "../src/lib/math/random";
export { run } from "./harness";

test("vector arithmetic", () => {
    const a = Vec.vec(1, 2, 3);
    const b = Vec.vec(4, -5, 6);
    deepEq(Vec.add(a, b), { x: 5, y: -3, z: 9 });
    deepEq(Vec.sub(a, b), { x: -3, y: 7, z: -3 });
    eq(Vec.dot(a, b), 4 - 10 + 18);
    deepEq(Vec.cross(Vec.FORWARD, Vec.LEFT), { x: 0, y: 0, z: 1 });
    near(Vec.length(Vec.vec(3, 4, 12)), 13);
    near(Vec.length2D(Vec.vec(3, 4, 12)), 5);
    near(Vec.distance(a, b), Math.sqrt(9 + 49 + 9));
    deepEq(a, { x: 1, y: 2, z: 3 }, "inputs unchanged");
});

test("normalize handles zero and clampLength shortens", () => {
    deepEq(Vec.normalize(Vec.vec()), { x: 0, y: 0, z: 0 });
    near(Vec.length(Vec.normalize(Vec.vec(5, 5, 5))), 1);
    near(Vec.length(Vec.clampLength(Vec.vec(30, 40, 0), 10)), 10);
    deepEq(Vec.clampLength(Vec.vec(1, 0, 0), 10), { x: 1, y: 0, z: 0 });
});

test("reflect, project, moveTowards, closest point", () => {
    deepEq(Vec.reflect(Vec.vec(1, 0, -1), Vec.UP), { x: 1, y: 0, z: 1 });
    deepEq(Vec.project(Vec.vec(3, 4, 0), Vec.FORWARD), { x: 3, y: 0, z: 0 });
    deepEq(Vec.moveTowards(Vec.vec(), Vec.vec(10, 0, 0), 3), { x: 3, y: 0, z: 0 });
    deepEq(Vec.moveTowards(Vec.vec(), Vec.vec(2, 0, 0), 3), { x: 2, y: 0, z: 0 });
    deepEq(Vec.closestPointOnSegment(Vec.vec(5, 5, 0), Vec.vec(0, 0, 0), Vec.vec(10, 0, 0)), { x: 5, y: 0, z: 0 });
});

test("vector parse / format / inBox / rotateZ", () => {
    deepEq(Vec.parse("1 -2.5 3"), { x: 1, y: -2.5, z: 3 });
    deepEq(Vec.parse("1, 2, 3"), { x: 1, y: 2, z: 3 });
    eq(Vec.parse("1 2"), undefined);
    eq(Vec.toInputString(Vec.vec(1, 2, 3)), "1 2 3");
    eq(Vec.format(Vec.vec(1, 2, 3)), "(1.0, 2.0, 3.0)");
    ok(Vec.inBox(Vec.vec(1, 1, 1), Vec.vec(0, 0, 0), Vec.vec(2, 2, 2)));
    ok(!Vec.inBox(Vec.vec(3, 1, 1), Vec.vec(0, 0, 0), Vec.vec(2, 2, 2)));
    const r = Vec.rotateZ(Vec.FORWARD, 90);
    near(r.x, 0);
    near(r.y, 1);
});

test("angle basis matches Source conventions", () => {
    const b = Ang.basis(Ang.ang(0, 0, 0));
    deepEq(Vec.round(b.forward, 6), { x: 1, y: 0, z: 0 });
    deepEq(Vec.round(b.right, 6), { x: 0, y: -1, z: 0 }, "right is -Y");
    deepEq(Vec.round(b.up, 6), { x: 0, y: 0, z: 1 });
    const down = Ang.forward(Ang.ang(90, 0, 0));
    near(down.z, -1, 1e-9, "positive pitch looks down");
    const left = Ang.forward(Ang.ang(0, 90, 0));
    near(left.y, 1, 1e-9, "positive yaw turns left");
});

test("fromDirection round-trips forward()", () => {
    for (const a of [Ang.ang(30, 45, 0), Ang.ang(-60, -170, 0), Ang.ang(0, 180, 0)]) {
        const back = Ang.fromDirection(Ang.forward(a));
        ok(Ang.anglesEqual(back, a), `round trip ${Ang.formatAngles(a)} -> ${Ang.formatAngles(back)}`);
    }
    const look = Ang.lookAt(Vec.vec(0, 0, 0), Vec.vec(0, 10, -10));
    near(look.yaw, 90);
    near(look.pitch, 45);
});

test("normalize, diff and lerp take the short way round", () => {
    eq(Ang.normalizeDegrees(190), -170);
    eq(Ang.normalizeDegrees(-190), 170);
    eq(Ang.normalizeDegrees(180), 180);
    eq(Ang.angleDiff(170, -170), 20);
    near(Ang.lerpDegrees(170, -170, 0.5), 180);
});

test("localToWorld / worldToLocal are inverses", () => {
    const origin = Vec.vec(100, 50, 10);
    const angles = Ang.ang(10, 37, 5);
    const local = Vec.vec(32, -8, 16);
    const world = Ang.localToWorld(origin, angles, local);
    ok(Vec.equals(Ang.worldToLocal(origin, angles, world), local, 1e-9));
    // yaw 90: local forward (x) is world +Y, local left (y) is world -X
    const w = Ang.localToWorld(Vec.vec(), Ang.ang(0, 90, 0), Vec.vec(10, 5, 0));
    near(w.x, -5);
    near(w.y, 10);
});

test("scalar helpers", () => {
    eq(clamp(5, 0, 3), 3);
    eq(remap(5, 0, 10, 100, 200), 150);
    eq(remap(20, 0, 10, 0, 1, true), 1);
    eq(approach(0, 10, 3), 3);
    eq(approach(10, 0, 30), 0);
    eq(wrap(370, 0, 360), 10);
    eq(wrap(-10, 0, 360), 350);
    eq(roundTo(1.23456, 2), 1.23);
});

test("colors", () => {
    deepEq(hex("#ff8000"), { r: 255, g: 128, b: 0, a: 255 });
    deepEq(hex("f80"), { r: 255, g: 136, b: 0, a: 255 });
    deepEq(hex("#11223344"), { r: 17, g: 34, b: 51, a: 68 });
    eq(hex("zzz"), undefined);
    eq(toHex({ r: 255, g: 128, b: 0 }), "#ff8000");
    deepEq(hsv(120, 1, 1), { r: 0, g: 255, b: 0, a: 255 });
    deepEq(lerpColor({ r: 0, g: 0, b: 0 }, { r: 200, g: 100, b: 50 }, 0.5), { r: 100, g: 50, b: 25, a: 255 });
});

test("seeded random is deterministic and in range", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 20; i++) eq(a(), b());
    const rng = seededRandom(7);
    for (let i = 0; i < 500; i++) {
        const n = randomInt(1, 6, rng);
        ok(n >= 1 && n <= 6 && Number.isInteger(n), `randomInt out of range: ${n}`);
    }
    const items = [1, 2, 3, 4, 5];
    deepEq([...shuffle(items, rng)].sort(), items);
    eq(pick([], rng), undefined);
    eq(weightedPick(["a", "b"], (x) => (x === "b" ? 1 : 0), rng), "b");
});
