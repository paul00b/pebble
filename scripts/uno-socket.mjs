// Integration test: drive Uno through the live socket server, exercising the
// create → start → private-view → action path exactly as the browser would.
import { io } from "socket.io-client";

const URL = "http://localhost:3001";
let pass = 0;
const ok = (c, m) => { if (!c) { console.error("❌", m); process.exit(1); } pass++; console.log("✅", m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error("❌ timed out"); process.exit(1); }, 20_000).unref?.();

function mkClient(id) {
  const sock = io(URL, { transports: ["websocket"], forceNew: true });
  const c = { sock, state: null, id };
  sock.on("room:state", (s) => (c.state = s));
  return c;
}
const connected = (c) => new Promise((res) => (c.sock.connected ? res() : c.sock.once("connect", res)));
const ident = (name) => ({ sessionId: `un-${name}-${Math.random().toString(36).slice(2)}`, name, avatar: "🎴", color: "#6ee7d6" });

{
  const a = mkClient("a"), b = mkClient("b"), c = mkClient("c");
  await connected(a); await connected(b); await connected(c);

  const created = await new Promise((r) => a.sock.emit("room:create", { identity: ident("Alice"), game: "uno" }, r));
  const code = created.room.code;
  a.you = created.you;
  b.you = (await new Promise((r) => b.sock.emit("room:join", { code, identity: ident("Bob") }, r))).you;
  c.you = (await new Promise((r) => c.sock.emit("room:join", { code, identity: ident("Cara") }, r))).you;
  const byId = { [a.you]: a, [b.you]: b, [c.you]: c };

  // Tighten the starting hand to make assertions crisp.
  a.sock.emit("room:updateSettings", { game: "uno", patch: { startingHand: 5 } });
  await wait(150);

  const started = await new Promise((r) => a.sock.emit("room:start", r));
  ok(started.ok, "uno: host started the game");
  await wait(300);

  ok(a.state.game?.kind === "uno", "uno: game view broadcast");
  ok(a.state.game.hand.length === 5, "uno: Alice sees her 5-card hand");
  ok(a.state.game.players.every((p) => p.count === 5), "uno: every seat holds 5 cards");
  ok(a.state.game.topCard && a.state.game.topCard.kind === "num", "uno: opening discard is a number");

  // Private views: each player only sees their own cards.
  const aIds = new Set(a.state.game.hand.map((x) => x.id));
  const bIds = b.state.game.hand.map((x) => x.id);
  ok(b.state.game.hand.length === 5, "uno: Bob sees his own 5-card hand");
  ok(bIds.every((id) => !aIds.has(id)), "uno: hands are private (no overlap leaked)");

  // The current player draws — their hand grows and the table stays coherent.
  const me = byId[a.state.game.currentId];
  ok(!!me, "uno: current player resolves to a known seat");
  const before = me.state.game.hand.length;
  me.sock.emit("game:action", { type: "draw" });
  await wait(250);
  ok(me.state.game.hand.length === before + 1, "uno: drawing adds a card to the actor's hand");

  a.sock.close(); b.sock.close(); c.sock.close();
}

console.log(`\n🎉 All ${pass} uno socket checks passed.`);
process.exit(0);
