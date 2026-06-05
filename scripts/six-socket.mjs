// Integration test for 6 Qui Prend, focused on per-player private hands.
import { io } from "socket.io-client";

const URL = "http://localhost:3001";
let pass = 0;
const ok = (c, m) => { if (!c) { console.error("❌", m); process.exit(1); } pass++; console.log("✅", m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error("❌ timed out"); process.exit(1); }, 20_000).unref?.();

function mk(name) {
  const sock = io(URL, { transports: ["websocket"], forceNew: true });
  const c = { sock, state: null };
  sock.on("room:state", (s) => (c.state = s));
  return c;
}
const connected = (c) => new Promise((res) => (c.sock.connected ? res() : c.sock.once("connect", res)));
const ident = (n) => ({ sessionId: `six-${n}-${Math.random().toString(36).slice(2)}`, name: n, avatar: "🐂", color: "#6ee7d6" });

const a = mk("Ana"), b = mk("Bo");
await connected(a); await connected(b);

const created = await new Promise((r) => a.sock.emit("room:create", { identity: ident("Ana"), game: "sixquiprend" }, r));
const code = created.room.code;
await new Promise((r) => b.sock.emit("room:join", { code, identity: ident("Bo") }, r));
const started = await new Promise((r) => a.sock.emit("room:start", r));
ok(started.ok, "six: host started the game");
await wait(300);

ok(a.state.game?.kind === "sixquiprend", "six: game view broadcast");
ok(a.state.game.hand.length === 10 && b.state.game.hand.length === 10, "six: each player dealt 10 cards");

// Privacy: hands are personalized and disjoint; neither sees the other's cards.
const aHand = a.state.game.hand, bHand = b.state.game.hand;
const overlap = aHand.filter((c) => bHand.includes(c));
ok(overlap.length === 0, "six: players hold different (private) cards");
ok(a.state.game.players.every((p) => p.handCount === 10 && !p.hasChosen), "six: public info shows counts, not cards");
ok(a.state.game.rows.length === 4 && a.state.game.rows.every((r) => r.length === 1), "six: four rows seeded with one card each");

// One player picks → others see only that they've chosen.
a.sock.emit("game:action", { type: "choose", card: aHand[0] });
await wait(250);
ok(b.state.game.players.some((p) => p.hasChosen), "six: a choice is visible as 'chosen' to others");
ok(b.state.game.phase === "choosing", "six: round waits for everyone");
ok(a.state.game.youChoseCard === aHand[0], "six: chooser sees its own tentative card");

// Take the card back → no longer chosen, card returns to play.
a.sock.emit("game:action", { type: "unchoose" });
await wait(200);
ok(a.state.game.youChoseCard == null, "six: unchoose clears the tentative card");
ok(b.state.game.players.every((p) => !p.hasChosen), "six: unchoose is visible to others");

// Re-pick, then second player picks → the turn resolves; both hands drop to 9.
a.sock.emit("game:action", { type: "choose", card: aHand[0] });
await wait(200);
b.sock.emit("game:action", { type: "choose", card: bHand[0] });
await wait(300);
ok(a.state.game.hand.length === 9, "six: chosen card leaves the hand after resolution");
ok(a.state.game.turn === 2 || a.state.game.phase === "takeRow", "six: turn advanced (or paused for a row choice)");
ok(Array.isArray(a.state.game.lastStartRows) && a.state.game.lastStartRows.length === 4,
   "six: pre-turn row snapshot broadcast for replay");
// lastTurn carries the placed-card log for replay; it's empty only when the
// very first (lowest) card was below every row and paused for a choice.
ok(a.state.game.turn === 2
     ? Array.isArray(a.state.game.lastTurn) && a.state.game.lastTurn.length >= 1
     : a.state.game.phase === "takeRow",
   "six: resolution log (lastTurn) broadcast for replay");

console.log(`\n🎉 All ${pass} six-qui-prend socket checks passed.`);
process.exit(0);
