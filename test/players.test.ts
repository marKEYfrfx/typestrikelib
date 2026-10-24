import { deepEq, eq, ok, test } from "./harness";
import { CSInputs, CSMoveType, Entity } from "cs_script/point_script";
import { addPlayer, asMock, mock } from "./mock/point_script";
import { countPlayers, findPlayer, getController, getPawn, getPawns, getPlayers, getSlot, playerFromEntity } from "../src/lib/players/players";
import { PlayerData } from "../src/lib/players/playerData";
import { Input } from "../src/lib/players/input";
import * as Pawn from "../src/lib/players/pawn";
export { run } from "./harness";

const alice = addPlayer(0, "Alice", 2);
const bob = addPlayer(1, "Bob", 3);
const botty = addPlayer(2, "BOT Botty", 3, { bot: true, alive: false });
const gone = addPlayer(3, "Gone", 2);
gone.connected = false;

test("getPlayers filters", () => {
    eq(getPlayers().length, 3, "disconnected excluded");
    eq(getPlayers({ disconnected: true }).length, 4);
    deepEq(getPlayers({ team: 3 }).map((c) => c.GetPlayerName()), ["Bob", "BOT Botty"]);
    deepEq(getPlayers({ bots: false, team: [2, 3] }).map((c) => c.GetPlayerName()), ["Alice", "Bob"]);
    deepEq(getPlayers({ alive: false }).map((c) => c.GetPlayerName()), ["BOT Botty"]);
    eq(getPawns().length, 2, "living pawns only by default");
    eq(countPlayers({ where: (c) => c.GetPlayerName().startsWith("A") }), 1);
});

test("conversions between controller, pawn and slot", () => {
    eq(getController(1), bob);
    eq(getController(bob.pawn), bob);
    eq(getPawn(alice), alice.pawn);
    eq(getPawn(0), alice.pawn);
    eq(getSlot(bob.pawn), 1);
    const grenade = asMock(new Entity());
    grenade.owner = alice.pawn;
    eq(playerFromEntity(grenade), alice, "follows owner chain");
    eq(playerFromEntity(new Entity()), undefined);
});

test("findPlayer by slot, exact and partial name", () => {
    eq(findPlayer("#1"), bob);
    eq(findPlayer("alice"), alice);
    eq(findPlayer("bott"), botty);
    eq(findPlayer("b"), undefined, "ambiguous: Bob and BOT Botty");
    eq(findPlayer("#3"), undefined, "disconnected slot");
});

test("PlayerData creates lazily and resets on disconnect / reconnect", () => {
    const data = new PlayerData(() => ({ kills: 0 }));
    data.get(alice).kills += 2;
    data.get(bob.pawn!).kills += 1;
    eq(data.get(0).kills, 2);
    eq(data.size, 2);
    mock.emit("PlayerDisconnect", { playerSlot: 0 });
    eq(data.peek(alice), undefined);
    mock.emit("PlayerConnect", { player: bob });
    eq(data.has(bob), false);
});

test("Input fires on press and stops polling when no listeners remain", () => {
    const pressed: string[] = [];
    const held: string[] = [];
    const offA = Input.onPressed(CSInputs.USE, (p, c) => void pressed.push(c!.GetPlayerName()));
    const offB = Input.onHeld(CSInputs.ATTACK, (p, c) => void held.push(c!.GetPlayerName()));
    alice.pawn!.justPressed = CSInputs.USE;
    bob.pawn!.pressed = CSInputs.ATTACK;
    mock.advance(1 / 64);
    alice.pawn!.justPressed = 0;
    mock.advance(2 / 64);
    deepEq(pressed, ["Alice"]);
    eq(held.length, 3, "held fires on each of the 3 ticks");
    offA();
    offB();
    eq(Input.listenerCount, 0);
    mock.advance(2 / 64);
    eq(mock.nextThink, undefined, "poller stopped");
});

test("pawn helpers: heal, freeze, noclip, push", () => {
    const pawn = alice.pawn!;
    pawn.health = 50;
    eq(Pawn.heal(pawn, 80), 100, "capped at max health");
    pawn.moveType = CSMoveType.WALK;
    pawn.velocity = { x: 300, y: 0, z: 0 };
    Pawn.freeze(pawn);
    ok(Pawn.isFrozen(pawn));
    deepEq(pawn.velocity, { x: 0, y: 0, z: 0 });
    Pawn.freeze(pawn); // freezing twice must not lose the original move type
    Pawn.unfreeze(pawn);
    eq(pawn.moveType, CSMoveType.WALK);
    eq(Pawn.setNoclip(pawn), true);
    eq(pawn.moveType, CSMoveType.NOCLIP);
    eq(Pawn.setNoclip(pawn), false);
    Pawn.push(pawn, { x: 0, y: 0, z: 300 });
    Pawn.push(pawn, { x: 10, y: 0, z: 0 });
    deepEq(pawn.velocity, { x: 10, y: 0, z: 300 });
    eq(Pawn.speed2D(pawn), 10);
});
