// Live smoke test: drive Spyfall and Complots through the socket server
// exactly as browser clients would — three players, per-player hidden views.
import { io } from "socket.io-client";

const URL = "http://localhost:3001";
let pass = 0;
const ok = (c, m) => { if (!c) { console.error("❌", m); process.exit(1); } pass++; console.log("✅", m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error("❌ timed out"); process.exit(1); }, 25_000).unref?.();

function mkClient(id) {
  const sock = io(URL, { transports: ["websocket"], forceNew: true });
  const c = { sock, state: null, id };
  sock.on("room:state", (s) => (c.state = s));
  return c;
}
const connected = (c) => new Promise((res) => (c.sock.connected ? res() : c.sock.once("connect", res)));
const ident = (name) => ({ sessionId: `ng-${name}-${Math.random().toString(36).slice(2)}`, name, avatar: "🦊", color: "#6ee7d6" });

// ── Spyfall ────────────────────────────────────────────────────────────────
{
  const a = mkClient("a"), b = mkClient("b"), c = mkClient("c");
  await connected(a); await connected(b); await connected(c);

  const created = await new Promise((r) => a.sock.emit("room:create", { identity: ident("Alice"), game: "spyfall" }, r));
  const code = created.room.code;
  await new Promise((r) => b.sock.emit("room:join", { code, identity: ident("Bob") }, r));
  await new Promise((r) => c.sock.emit("room:join", { code, identity: ident("Cleo") }, r));

  // Host tunes the round length before starting.
  a.sock.emit("room:updateSettings", { game: "spyfall", patch: { roundSec: 240 } });
  await wait(200);
  ok(a.state.settings.spyfall.roundSec === 240, "spyfall: host setting applied");

  const started = await new Promise((r) => a.sock.emit("room:start", r));
  ok(started.ok, "spyfall: host started the game");
  await wait(300);

  const clients = [a, b, c];
  ok(clients.every((x) => x.state.game?.kind === "spyfall" && x.state.game.phase === "playing"),
    "spyfall: everyone got a playing view");

  const spies = clients.filter((x) => x.state.game.youAreSpy);
  const crew = clients.filter((x) => !x.state.game.youAreSpy);
  ok(spies.length === 1, "spyfall: exactly one client is the spy");
  ok(crew.every((x) => x.state.game.location && x.state.game.role),
    "spyfall: crew clients see location + role");
  ok(spies[0].state.game.location === null && spies[0].state.game.spyId === null,
    "spyfall: the spy's view hides the location (and identity)");
  ok(crew[0].state.game.spyId === null, "spyfall: crew can't see who the spy is");
  ok(crew[0].state.game.locations.length > 10, "spyfall: the public location list is shared");

  // A crew member calls the vote; everyone votes for the spy.
  const spySession = spies[0].state.players.find((p) => p.name === { a: "Alice", b: "Bob", c: "Cleo" }[spies[0].id])?.id;
  crew[0].sock.emit("game:action", { type: "callVote" });
  await wait(250);
  ok(a.state.game.phase === "voting", "spyfall: emergency vote opened for everyone");

  for (const x of clients) {
    const me = x.state.players.find((p) => p.name === { a: "Alice", b: "Bob", c: "Cleo" }[x.id]).id;
    const target = x === spies[0] ? crew[0] : spies[0];
    const targetId = x.state.players.find((p) => p.name === { a: "Alice", b: "Bob", c: "Cleo" }[target.id]).id;
    x.sock.emit("game:action", { type: "vote", playerId: targetId });
  }
  await wait(300);
  ok(a.state.game.phase === "spyguess", "spyfall: the spy was caught → steal window");
  ok(crew[0].state.game.spyId === spySession, "spyfall: the spy is unmasked");

  // The spy bricks the steal on purpose: guess whatever isn't the location.
  const spyView = spies[0].state.game;
  spies[0].sock.emit("game:action", { type: "spyGuess", index: 0 });
  await wait(300);
  ok(a.state.game.over, "spyfall: the steal guess ended the game");
  ok(["caught", "steal"].includes(a.state.game.reason), "spyfall: outcome reported");
  ok(a.state.game.location != null && spies[0].state.game.location != null,
    "spyfall: full reveal at the end");

  a.sock.close(); b.sock.close(); c.sock.close();
}

// ── Complots ───────────────────────────────────────────────────────────────
{
  const a = mkClient("a"), b = mkClient("b"), c = mkClient("c");
  await connected(a); await connected(b); await connected(c);

  const created = await new Promise((r) => a.sock.emit("room:create", { identity: ident("Alice"), game: "complots" }, r));
  const code = created.room.code;
  const aId = created.you;
  const jb = await new Promise((r) => b.sock.emit("room:join", { code, identity: ident("Bob") }, r));
  const bId = jb.you;
  await new Promise((r) => c.sock.emit("room:join", { code, identity: ident("Cleo") }, r));

  const started = await new Promise((r) => a.sock.emit("room:start", r));
  ok(started.ok, "complots: host started the game");
  await wait(300);

  ok(a.state.game?.kind === "complots" && a.state.game.phase === "action",
    "complots: action phase broadcast");
  ok(a.state.game.youCard != null, "complots: you see your own card");
  ok(b.state.game.youCard !== undefined && b.state.game.players.every((p) => p.revealed === null),
    "complots: nobody's card is public");
  ok(a.state.game.currentId === aId, "complots: first joiner opens");

  // Alice claims the Duke (tax). Bob calls liar; the server verifies.
  a.sock.emit("game:action", { type: "act", act: "tax" });
  await wait(250);
  ok(b.state.game.phase === "react" && b.state.game.pending?.claim === "duke",
    "complots: the claim opened a reaction window for everyone");
  ok(b.state.game.youCanChallenge === true && a.state.game.youCanChallenge === false,
    "complots: per-player eligibility is tailored");

  b.sock.emit("game:action", { type: "challenge" });
  await wait(250);
  ok(a.state.game.phase === "resolve" && a.state.game.lastEvent?.type === "challenge",
    "complots: the challenge was verified live");
  const ev = a.state.game.lastEvent;
  const someoneOut = a.state.game.players.some((p) => !p.alive && p.revealed);
  ok(someoneOut && (ev.eliminatedId === aId || ev.eliminatedId === bId),
    "complots: the loser's card is face-up for the room");

  // The resolve pause is server-timed; wait for the next turn to open.
  await wait(4500);
  ok(["action", "over"].includes(a.state.game.phase), "complots: play moved on after the pause");

  a.sock.close(); b.sock.close(); c.sock.close();
}

console.log(`\nSmoke: all ${pass} live-socket checks passed.`);
process.exit(0);
