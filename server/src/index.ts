// Pebble game server — authoritative Socket.IO server with in-memory rooms.
// Clients send intents; the server validates, mutates room state, and
// broadcasts the full snapshot back to everyone in the room.

import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomManager } from "./rooms.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../../shared/src/index.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "*";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: manager.roomCount }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("Pebble server is running. Connect via the web client.");
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(
  httpServer,
  {
    cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
  }
);

const manager = new RoomManager();

// Defense-in-depth: a single malformed client message must never take the
// whole server (and everyone's game) down. Log and keep serving.
process.on("uncaughtException", (err) =>
  console.error("[uncaughtException]", err)
);
process.on("unhandledRejection", (err) =>
  console.error("[unhandledRejection]", err)
);

/** Call an acknowledgement callback only if the client actually sent one. */
function reply<T>(ack: ((v: T) => void) | undefined, value: T) {
  if (typeof ack === "function") ack(value);
}

// Re-broadcast a room's snapshot to everyone in it whenever it changes.
manager.setListeners(
  (code) => {
    const snap = manager.snapshot(code);
    if (snap) io.to(code).emit("room:state", snap);
  },
  (code, reason) => {
    io.to(code).emit("room:closed", reason);
    io.in(code).socketsLeave(code);
  }
);

io.on("connection", (socket) => {
  const bind = (code: string, sessionId: string) => {
    socket.data.roomCode = code;
    socket.data.sessionId = sessionId;
    socket.join(code);
  };

  socket.on("room:create", ({ identity, game }, ack) => {
    const room = manager.createRoom(identity, game);
    bind(room.code, identity.sessionId);
    reply(ack, { ok: true, room, you: identity.sessionId });
  });

  socket.on("room:join", ({ code, identity }, ack) => {
    const normalized = code.trim().toUpperCase();
    const result = manager.joinRoom(normalized, identity);
    if (!result.ok) {
      reply(ack, { ok: false, reason: result.reason });
      return;
    }
    bind(normalized, identity.sessionId);
    reply(ack, { ok: true, room: result.room, you: identity.sessionId });
    socket.to(normalized).emit("room:notice", {
      kind: "info",
      text: `${identity.name} joined.`,
    });
  });

  socket.on("room:leave", () => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) {
      manager.leave(roomCode, sessionId);
      socket.leave(roomCode);
      socket.data.roomCode = undefined;
    }
  });

  socket.on("room:selectGame", (game) => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.selectGame(roomCode, sessionId, game);
  });

  socket.on("room:start", (ack) => {
    const { roomCode, sessionId } = socket.data;
    if (!roomCode || !sessionId)
      return reply(ack, { ok: false, reason: "Not in a room." });
    reply(ack, manager.start(roomCode, sessionId));
  });

  socket.on("room:toLobby", () => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.toLobby(roomCode, sessionId);
  });

  socket.on("game:action", (action) => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.gameAction(roomCode, sessionId, action);
  });

  socket.on("room:kick", (targetId) => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.kick(roomCode, sessionId, targetId);
  });

  socket.on("chat:send", (text) => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.chat(roomCode, sessionId, text);
  });

  socket.on("disconnect", () => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.handleDisconnect(roomCode, sessionId);
  });
});

// Authoritative game clock: drives every active game's timers (bomb fuse,
// round deadlines). One shared interval keeps things tidy at our scale.
const TICK_MS = 200;
setInterval(() => manager.tickAll(), TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`\n  🪨  Pebble server listening on http://localhost:${PORT}\n`);
});
