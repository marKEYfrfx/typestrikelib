import { deepEq, eq, ok, test } from "./harness";
import { addPlayer, mock } from "./mock/point_script";
import { CommandRouter, ChatCommands, tokenize } from "../src/lib/players/commands";
import { Chat, sanitizeCommandText } from "../src/lib/players/chat";
export { run } from "./harness";

const alice = addPlayer(0, "Alice", 2);
const bob = addPlayer(1, "Bobby", 3, { alive: false });

function router() {
    const r = new CommandRouter();
    const replies: string[] = [];
    r.setReplyHandler((p, m) => void replies.push(`${p.GetPlayerName()}: ${m}`));
    return { r, replies };
}

test("tokenize splits on spaces and honours quotes", () => {
    deepEq(tokenize(`give "big gun" 2`), ["give", "big gun", "2"]);
    deepEq(tokenize("   a   b  "), ["a", "b"]);
    deepEq(tokenize(`""`), [""]);
});

test("routes by prefix, name and alias, case-insensitively", () => {
    const { r } = router();
    const calls: string[] = [];
    r.register("spawn", { aliases: ["s"], handler: (ctx) => void calls.push(`${ctx.command}:${ctx.args.join(",")}`) });
    ok(r.handle(alice, "!spawn door 2"));
    ok(r.handle(alice, "/S vase"));
    ok(r.handle(alice, "  !SPAWN  "));
    ok(!r.handle(alice, "spawn door"), "no prefix");
    ok(!r.handle(alice, "!unknown"), "unknown command");
    ok(!r.handle(undefined, "!spawn"), "console chat ignored");
    deepEq(calls, ["spawn:door,2", "spawn:vase", "spawn:"]);
});

test("argument helpers", () => {
    const { r } = router();
    let seen: unknown[] = [];
    r.register("t", (ctx) => {
        seen = [ctx.int(0), ctx.int(1, 7), ctx.float(2), ctx.arg(3), ctx.targetPlayer(4)?.GetPlayerName(), ctx.argString];
    });
    r.handle(alice, `!t 12 nope 1.5 "two words" bob`);
    deepEq(seen, [12, 7, 1.5, "two words", "Bobby", `12 nope 1.5 "two words" bob`]);
});

test("minArgs, teams, requireAlive and cooldown", () => {
    const { r, replies } = router();
    let runs = 0;
    r.register("kick", { usage: "<player>", minArgs: 1, handler: () => void runs++ });
    r.register("ct", { teams: [3], handler: () => void runs++ });
    r.register("alive", { requireAlive: true, handler: () => void runs++ });
    r.register("slow", { cooldown: 2, handler: () => void runs++ });

    r.handle(alice, "!kick");
    r.handle(alice, "!ct");
    r.handle(bob, "!alive");
    r.handle(alice, "!slow");
    r.handle(alice, "!slow");
    eq(runs, 1, "only the first !slow ran");
    ok(replies[0].includes("Usage: !kick <player>"), replies[0]);
    ok(replies[1].includes("only for CT"), replies[1]);
    ok(replies[2].includes("must be alive"), replies[2]);
    ok(replies[3].includes("Wait"), replies[3]);

    mock.advance(2.1);
    r.handle(alice, "!slow");
    eq(runs, 2, "cooldown expired");
});

test("help lists visible commands", () => {
    const { r, replies } = router();
    r.register("zeta", { description: "last", handler: () => {} });
    r.register("alpha", { usage: "<x>", description: "first", handler: () => {} });
    r.register("secret", { hidden: true, handler: () => {} });
    r.enableHelp();
    r.handle(alice, "!help");
    deepEq(replies, ["Alice: !alpha <x> - first", "Alice: !help - List chat commands", "Alice: !zeta - last"]);
});

test("unregister removes the command and its aliases", () => {
    const { r } = router();
    const off = r.register("x", { aliases: ["y"], handler: () => {} });
    ok(r.has("y"));
    off();
    ok(!r.has("x") && !r.has("y"));
});

test("the shared router listens to PlayerChat", () => {
    let got = "";
    ChatCommands.setReplyHandler(() => {});
    ChatCommands.register("echo", (ctx) => void (got = ctx.argString));
    mock.emit("PlayerChat", { player: alice, text: "!echo hello there", team: 0 });
    eq(got, "hello there");
});

test("sanitizeCommandText blocks command injection", () => {
    eq(sanitizeCommandText('hi; quit "x"\nrcon'), "hi quit x rcon");
    Chat.say("gg; disconnect");
    eq(mock.serverCommands.at(-1), "say gg disconnect");
    const before = mock.serverCommands.length;
    Chat.say(" ; ");
    eq(mock.serverCommands.length, before, "empty message not sent");
});
