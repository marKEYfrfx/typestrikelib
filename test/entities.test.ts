import { deepEq, eq, ok, test, throws } from "./harness";
import { BaseModelEntity, CSPlayerPawn, Entity, PointTemplate } from "cs_script/point_script";
import { addEntity, mock } from "./mock/point_script";
import { castEntity, EntityRef, tryCastEntity } from "../src/lib/entities/cast";
import { describeEntity, findAllByName, findByName, findInRadius, findNearest, requireByName } from "../src/lib/entities/find";
import { fire, onOutput, onceOutput, waitForOutput } from "../src/lib/entities/io";
import { CFuncTrackTrain, CMathCounter, CPathTrack } from "../src/lib/entities/hammer";
import { spawnTemplate } from "../src/lib/entities/templates";
import { isModelEntity, isPlayerPawn, isPointTemplate, isValid } from "../src/lib/entities/guards";
export { run } from "./harness";

/** A wrapper defined the way a map script would define its own. */
class CCrate extends BaseModelEntity {
    static readonly classNames = ["prop_physics_multiplayer", "prop_physics"] as const;
    label(): string {
        return `crate ${this.GetEntityName()}`;
    }
}

const train = addEntity(new Entity(), "train_main", "func_tracktrain");
const node = addEntity(new Entity(), "path_1", "path_track");
const crate = addEntity(new BaseModelEntity(), "crate_1", "prop_physics_multiplayer");
crate.origin = { x: 100, y: 0, z: 0 };
const crate2 = addEntity(new BaseModelEntity(), "crate_2", "prop_physics");
crate2.origin = { x: 300, y: 0, z: 0 };

test("castEntity swaps the prototype and keeps native methods", () => {
    const t = castEntity(train, CFuncTrackTrain);
    ok(t === (train as unknown), "same object");
    ok(t instanceof CFuncTrackTrain);
    eq(t.GetEntityName(), "train_main", "native method still works");
    t.teleportToPathAndStart(castEntity(node, CPathTrack), 250);
    deepEq(
        mock.fired.slice(-3).map((f) => [f.target, f.input, f.value]),
        [
            ["train_main", "TeleportToPathNode", "path_1"],
            ["train_main", "SetSpeedReal", 250],
            ["train_main", "StartForward", undefined],
        ],
    );
});

test("castEntity rejects the wrong classname", () => {
    throws(() => castEntity(node, CFuncTrackTrain), /expected classname func_tracktrain/);
    eq(tryCastEntity(node, CFuncTrackTrain), undefined);
    ok(castEntity(node, CFuncTrackTrain, { checkClassName: false }));
    castEntity(node, CPathTrack); // put it back
});

test("find helpers", () => {
    eq(findByName("crate_1"), crate);
    eq(findByName("missing"), undefined);
    eq(findAllByName("crate_*").length, 2);
    eq(findByName("crate_2", CCrate)?.label(), "crate crate_2");
    throws(() => requireByName("nope"), /"nope" was not found/);
    eq(describeEntity(crate), `prop_physics_multiplayer "crate_1"`);
    eq(describeEntity(undefined), "<none>");
});

test("spatial queries", () => {
    const near = findInRadius({ x: 0, y: 0, z: 0 }, 200, { name: "crate_*" });
    deepEq(near.map((e) => e.GetEntityName()), ["crate_1"]);
    const all = findInRadius({ x: 400, y: 0, z: 0 }, 1000, [crate, crate2]);
    deepEq(all.map((e) => e.GetEntityName()), ["crate_2", "crate_1"], "nearest first");
    eq(findNearest({ x: 250, y: 0, z: 0 }, { name: "crate_*" })?.GetEntityName(), "crate_2");
    eq(findNearest({ x: 0, y: 0, z: 0 }, { name: "crate_*" }, { maxDistance: 50 }), undefined);
});

test("EntityRef finds a respawned entity by name", () => {
    const ref = new EntityRef("respawning", CCrate);
    eq(ref.get(), undefined);
    const first = addEntity(new BaseModelEntity(), "respawning", "prop_physics");
    eq(ref.get(), first as unknown);
    first.Remove();
    const second = addEntity(new BaseModelEntity(), "respawning", "prop_physics");
    eq(ref.get(), second as unknown, "re-resolved after the old one became invalid");
    ok(ref.get() instanceof CCrate);
});

test("fire() leaves out unset options", () => {
    fire("door", "Open");
    deepEq(mock.fired.at(-1), { target: "door", input: "Open", value: undefined, delay: undefined });
    fire(crate, "Break", undefined, { delay: 2 });
    eq(mock.fired.at(-1)!.delay, 2);
});

test("outputs connect, disconnect and fire once", async () => {
    let n = 0;
    const off = onOutput(crate, "OnBreak", () => void n++);
    mock.fireOutput(crate, "OnBreak");
    off();
    off();
    mock.fireOutput(crate, "OnBreak");
    eq(n, 1);

    let m = 0;
    onceOutput(crate, "OnHealthChanged", () => void m++);
    mock.fireOutput(crate, "OnHealthChanged", { value: 5 });
    mock.fireOutput(crate, "OnHealthChanged", { value: 4 });
    eq(m, 1);
    eq([...mock.outputs.values()].filter((o) => o.output === "OnHealthChanged").length, 0, "once disconnects");

    const p = waitForOutput(crate, "OnPlayerUse");
    mock.fireOutput(crate, "OnPlayerUse", { value: "hi" });
    eq((await p)?.value, "hi");
    const timeout = waitForOutput(crate, "Never", 0.1);
    mock.advance(0.2);
    eq(await timeout, undefined);
});

test("output wrappers only pass numeric values (CMathCounter.onValueChanged)", () => {
    const counter = castEntity(addEntity(new Entity(), "score_counter", "math_counter"), CMathCounter);
    const seen: number[] = [];
    const off = counter.onValueChanged((v) => void seen.push(v));
    mock.fireOutput(counter, "OutValue", { value: 3 });
    mock.fireOutput(counter, "OutValue", { value: "not a number" });
    off();
    mock.fireOutput(counter, "OutValue", { value: 4 });
    deepEq(seen, [3]);
});

test("spawnTemplate finds parts by name prefix", () => {
    const tpl = addEntity(new PointTemplate(), "template.troop.door", "point_template");
    tpl.spawns = () => [
        addEntity(new Entity(), "train.1", "func_tracktrain"),
        addEntity(new BaseModelEntity(), "mdl.door", "prop_physics_multiplayer"),
    ];
    const group = spawnTemplate("template.troop.door")!;
    ok(group.require("train.", CFuncTrackTrain) instanceof CFuncTrackTrain);
    eq(group.find("mdl.")?.GetEntityName(), "mdl.door");
    eq(group.find("nothing."), undefined);
    group.removeAll();
    eq(group.alive.length, 0);
    throws(() => spawnTemplate("crate_1"), /not a point_template/);
});

test("type guards", () => {
    ok(isPlayerPawn(new CSPlayerPawn()));
    ok(!isPlayerPawn(crate));
    ok(isModelEntity(crate));
    ok(isPointTemplate(new PointTemplate()));
    ok(!isValid(undefined));
    const gone = new Entity();
    gone.Remove();
    ok(!isValid(gone));
});

test("EntityRef warns once (instead of throwing) when the entity is the wrong class", () => {
    addEntity(new Entity(), "not_a_prop", "info_target");
    const ref = new EntityRef("not_a_prop", CCrate);
    const logsBefore = mock.logs.length;
    eq(ref.get(), undefined);
    eq(ref.get(), undefined);
    eq(mock.logs.length - logsBefore, 1, "one warning");
    throws(() => ref.require(), /expected classname/);
});
