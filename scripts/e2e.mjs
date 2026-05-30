// Headless end-to-end check of the room protocol against the running server.
import { io } from "socket.io-client";

const URL = "http://localhost:3001";
const log = (...a) => console.log(...a);
const fail = (m) => { console.error("❌ FAIL:", m); process.exit(1); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const mk = (name) =>
  io(URL, { transports: ["websocket"], forceNew: true });

// Resolve immediately if already connected, else on the next connect event.
const connected = (sock) =>
  new Promise((res) => (sock.connected ? res() : sock.once("connect", res)));

// Safety net: never hang the CI/dev loop.
setTimeout(() => fail("timed out after 10s"), 10_000).unref?.();

const identity = (name, i) => ({
  sessionId: `test-${name}-${i}`,
  name,
  avatar: "🦊",
  color: "#6ee7d6",
});

const emitAck = (sock, ev, payload) =>
  new Promise((res) => sock.emit(ev, payload, res));

let passed = 0;
const ok = (m) => { passed++; log("✅", m); };

const a = mk("A");
const b = mk("B");

// Track the latest broadcast each client sees.
let aState = null, bState = null;
a.on("room:state", (s) => (aState = s));
b.on("room:state", (s) => (bState = s));

await connected(a);
await connected(b);
ok("both sockets connected");

// 1. A creates a room
const created = await emitAck(a, "room:create", { identity: identity("Alice", 1) });
if (!created.ok) fail("create room: " + created.reason);
const code = created.room.code;
if (!/^[A-Z0-9]{4}$/.test(code)) fail("room code format: " + code);
if (created.room.players.length !== 1) fail("creator should be alone");
if (created.room.hostId !== created.you) fail("creator should be host");
ok(`room created with code ${code}, creator is host`);

// 2. B joins
const joined = await emitAck(b, "room:join", { code, identity: identity("Bob", 2) });
if (!joined.ok) fail("join room: " + joined.reason);
if (joined.room.players.length !== 2) fail("room should have 2 players");
ok("second player joined");

// 3. A should have received the broadcast of B joining
await wait(150);
if (!aState || aState.players.length !== 2) fail("host did not receive live update of join");
ok("live broadcast reached the host (2 players)");

// 4. Host selects a game; both see it
a.emit("room:selectGame", "petitbac");
await wait(150);
if (aState.selectedGame !== "petitbac" || bState.selectedGame !== "petitbac")
  fail("game selection not broadcast to both");
ok("game selection broadcast to everyone");

// 5. Non-host cannot change the game
b.emit("room:selectGame", "bombparty");
await wait(150);
if (aState.selectedGame !== "petitbac") fail("non-host was able to change game");
ok("non-host blocked from changing game (server authority)");

// 6. Chat round-trips to both
b.emit("chat:send", "hello room");
await wait(150);
if (!aState.chat.some((m) => m.text === "hello room") ||
    !bState.chat.some((m) => m.text === "hello room"))
  fail("chat not delivered to both clients");
ok("chat delivered to all players");

// 7. Start the game (2 players, petitbac min 2)
const started = await new Promise((res) => a.emit("room:start", res));
if (!started.ok) fail("start failed: " + started.reason);
await wait(150);
if (aState.phase !== "playing") fail("phase did not advance to playing");
ok("host started the game; phase = playing");

log(`\n🎉 All ${passed} checks passed.`);
a.close();
b.close();
process.exit(0);
