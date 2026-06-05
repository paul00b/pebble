// Integration test: drive Bomb Party and Petit Bac through the live socket
// server exactly as the browser client would.
import { io } from "socket.io-client";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FR = require("an-array-of-french-words");

const URL = "http://localhost:3001";
let pass = 0;
const ok = (c, m) => { if (!c) { console.error("❌", m); process.exit(1); } pass++; console.log("✅", m); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.error("❌ timed out"); process.exit(1); }, 25_000).unref?.();

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
const frWordWith = (prompt) => {
  const p = norm(prompt);
  for (const w of FR) { const n = norm(w); if (n.length >= 3 && n.includes(p)) return n; }
  throw new Error("no word for " + prompt);
};

function mkClient(id) {
  const sock = io(URL, { transports: ["websocket"], forceNew: true });
  const c = { sock, state: null, id };
  sock.on("room:state", (s) => (c.state = s));
  return c;
}
const connected = (c) => new Promise((res) => (c.sock.connected ? res() : c.sock.once("connect", res)));
const ident = (name) => ({ sessionId: `gt-${name}-${Math.random().toString(36).slice(2)}`, name, avatar: "🦊", color: "#6ee7d6" });

// ── Bomb Party ─────────────────────────────────────────────────────────────
{
  const a = mkClient("a"), b = mkClient("b");
  await connected(a); await connected(b);

  const created = await new Promise((r) => a.sock.emit("room:create", { identity: ident("Alice"), game: "bombparty" }, r));
  const code = created.room.code;
  const aId = created.you;
  const joined = await new Promise((r) => b.sock.emit("room:join", { code, identity: ident("Bob") }, r));
  const bId = joined.you;
  const started = await new Promise((r) => a.sock.emit("room:start", r));
  ok(started.ok, "bomb: host started the game");
  await wait(300);

  ok(a.state.game?.kind === "bombparty", "bomb: game view broadcast");
  ok(a.state.game.current === aId, "bomb: Alice goes first");

  // Alice plays a valid word → bomb passes to Bob.
  const w1 = frWordWith(a.state.game.prompt);
  a.sock.emit("game:action", { type: "submit", word: w1 });
  await wait(300);
  ok(a.state.game.current === bId && a.state.game.lastEvent?.type === "valid",
     `bomb: valid word "${w1}" passed bomb to Bob`);

  // Bob plays an invalid word → stays his turn.
  b.sock.emit("game:action", { type: "submit", word: "zzzqxk" });
  await wait(250);
  ok(a.state.game.current === bId && a.state.game.lastEvent?.type === "invalid",
     "bomb: invalid word rejected, turn stays with Bob");

  // Live typing is mirrored to other players.
  b.sock.emit("game:action", { type: "type", value: "hel" });
  await wait(200);
  ok(a.state.game.typed === "hel", "bomb: live typing broadcast to the room");

  a.sock.close(); b.sock.close();
}

// ── Petit Bac ──────────────────────────────────────────────────────────────
{
  const a = mkClient("a2"), b = mkClient("b2");
  await connected(a); await connected(b);

  const created = await new Promise((r) => a.sock.emit("room:create", { identity: ident("Cara"), game: "petitbac" }, r));
  const code = created.room.code;
  const aId = created.you;
  await new Promise((r) => b.sock.emit("room:join", { code, identity: ident("Dan") }, r));
  const started = await new Promise((r) => a.sock.emit("room:start", r));
  ok(started.ok, "petitbac: host started the game");
  await wait(250);

  ok(a.state.game?.kind === "petitbac" && a.state.game.stage === "writing", "petitbac: writing phase broadcast");
  const L = a.state.game.letter;
  const n = a.state.game.categories.length;

  // Both submit valid answers; uniqueness differs so scores are non-zero.
  a.sock.emit("game:action", { type: "submit", answers: Array.from({ length: n }, (_, i) => `${L}alpha${i}`) });
  b.sock.emit("game:action", { type: "submit", answers: Array.from({ length: n }, (_, i) => `${L}beta${i}`) });
  await wait(300);

  ok(a.state.game.stage === "review", "petitbac: advances to review once all submit");

  // Host skips through every category's vote window → finalize + reveal.
  for (let i = 0; i < n; i++) {
    a.sock.emit("game:action", { type: "next" });
    await wait(120);
  }
  ok(a.state.game.stage === "reveal", "petitbac: review finalized → reveal");
  ok(a.state.game.reveal?.length === n, "petitbac: reveal grid has every category");
  ok(a.state.game.scores[aId] > 0, "petitbac: scores computed");

  // Host advances the round.
  a.sock.emit("game:action", { type: "next" });
  await wait(250);
  ok(a.state.game.stage === "writing" && a.state.game.round === 2, "petitbac: host advanced to round 2");

  a.sock.close(); b.sock.close();
}

console.log(`\n🎉 All ${pass} game integration checks passed.`);
process.exit(0);
