// Pebble game server — authoritative Socket.IO server with in-memory rooms.
// Clients send intents; the server validates, mutates room state, and
// broadcasts the full snapshot back to everyone in the room.

import { createServer, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { RoomManager } from "./rooms.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../../shared/src/index.js";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "*";

// In production we serve the built client from the same origin (one container,
// one hostname — friendly to reverse proxies / Cloudflare tunnels). Defaults to
// the workspace's client/dist; only enabled if that folder actually exists, so
// local `npm run dev` (Vite serves the client) is unaffected.
const PUBLIC_DIR =
  process.env.PUBLIC_DIR ?? fileURLToPath(new URL("../../client/dist", import.meta.url));
const SERVE_STATIC = existsSync(PUBLIC_DIR);
const PUBLIC_ROOT = resolve(PUBLIC_DIR);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

function sendFile(res: ServerResponse, filePath: string) {
  const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  // Vite fingerprints asset filenames, so they're safe to cache forever; the
  // HTML entry point must always be revalidated.
  const cache = filePath.endsWith("index.html")
    ? "no-cache"
    : "public, max-age=31536000, immutable";
  res.writeHead(200, { "content-type": type, "cache-control": cache });
  createReadStream(filePath).pipe(res);
}

const httpServer = createServer((req, res) => {
  const url = (req.url ?? "/").split("?")[0];

  if (url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: manager.roomCount }));
    return;
  }

  if (!SERVE_STATIC) {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Pebble server is running. Connect via the web client.");
    return;
  }

  // Resolve the URL to a file inside PUBLIC_DIR, guarding against traversal.
  const rel = normalize(decodeURIComponent(url)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(PUBLIC_ROOT, rel);
  if (filePath === PUBLIC_ROOT || !filePath.startsWith(PUBLIC_ROOT + "/")) {
    filePath = join(PUBLIC_ROOT, "index.html");
  }
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }
  // Unknown path → hand back the SPA shell so client-side routing can take over.
  sendFile(res, join(PUBLIC_ROOT, "index.html"));
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
    // Games with hidden info (e.g. card hands) get a per-player snapshot;
    // everything else shares one broadcast.
    if (!manager.hasPrivateViews(code)) {
      const snap = manager.snapshot(code);
      if (snap) io.to(code).emit("room:state", snap);
      return;
    }
    void io
      .in(code)
      .fetchSockets()
      .then((sockets) => {
        for (const s of sockets) {
          const snap = manager.snapshot(code, s.data.sessionId);
          if (snap) s.emit("room:state", snap);
        }
      });
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

  socket.on("room:create", ({ identity, game, language }, ack) => {
    const room = manager.createRoom(identity, game, language);
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
      key: "notice.playerJoined",
      params: { name: identity.name },
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

  socket.on("room:setLanguage", (language) => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.setLanguage(roomCode, sessionId, language);
  });

  socket.on("room:updateSettings", ({ game, patch }) => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.updateSettings(roomCode, sessionId, game, patch);
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

  socket.on("draw:op", (op) => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId && manager.drawOp(roomCode, sessionId, op)) {
      socket.to(roomCode).emit("draw:op", op);
    }
  });

  socket.on("draw:request", () => {
    const { roomCode } = socket.data;
    if (roomCode) socket.emit("draw:sync", manager.drawOps(roomCode));
  });

  // ── Lobby whiteboard (collaborative; separate from the Gartic draw channel) ──
  socket.on("board:op", (op) => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId && manager.boardOp(roomCode, sessionId, op)) {
      socket.to(roomCode).emit("board:op", op);
    }
  });

  socket.on("board:request", () => {
    const { roomCode } = socket.data;
    if (roomCode) socket.emit("board:sync", manager.boardOps(roomCode));
  });

  socket.on("board:newWord", () => {
    const { roomCode, sessionId } = socket.data;
    if (roomCode && sessionId) manager.newBoardWord(roomCode, sessionId);
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
  console.log(`\n  🪨  Pebble server listening on http://localhost:${PORT}`);
  console.log(
    SERVE_STATIC
      ? `      serving client from ${PUBLIC_ROOT}\n`
      : `      (client served separately — dev mode)\n`
  );
});
