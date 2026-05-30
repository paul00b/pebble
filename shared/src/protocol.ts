// ── Socket.IO event contracts shared by client and server ──────────────────
// Typed event maps so the client and server can never disagree on the wire
// format. Import these into `io<...>()` (server) and `Socket<...>()` (client).

import type { GameId, RoomState } from "./types";
import type { DrawOp, GameAction, Language } from "./games";

/** Identity a client presents when creating or joining a room. */
export interface PlayerIdentity {
  /** Persisted client-side; lets a refresh reclaim the same seat. */
  sessionId: string;
  name: string;
  avatar: string;
  color: string;
}

export interface CreateRoomPayload {
  identity: PlayerIdentity;
  game?: GameId;
  /** Initial game-content language (defaults server-side if omitted). */
  language?: Language;
}

export interface JoinRoomPayload {
  code: string;
  identity: PlayerIdentity;
}

/** Result of a create/join attempt. `ok: false` carries a user-facing reason. */
export type JoinResult =
  | { ok: true; room: RoomState; you: string }
  | { ok: false; reason: string };

/** Events the client emits to the server. Callbacks give acknowledgements. */
export interface ClientToServerEvents {
  "room:create": (
    payload: CreateRoomPayload,
    ack: (result: JoinResult) => void
  ) => void;
  "room:join": (
    payload: JoinRoomPayload,
    ack: (result: JoinResult) => void
  ) => void;
  "room:leave": () => void;
  "room:selectGame": (game: GameId) => void;
  /** Host sets the game-content language (Bomb Party dict, Petit Bac categories). */
  "room:setLanguage": (language: Language) => void;
  "room:start": (ack: (result: { ok: boolean; reason?: string }) => void) => void;
  /** Host returns the room to the lobby (e.g. after a game ends). */
  "room:toLobby": () => void;
  "room:kick": (playerId: string) => void;
  "chat:send": (text: string) => void;
  /** A move within the active game. The server validates against its state. */
  "game:action": (action: GameAction) => void;
  /** Real-time drawing op from the current drawer (Gartic). */
  "draw:op": (op: DrawOp) => void;
  /** Ask the server for the current drawing (e.g. after joining mid-round). */
  "draw:request": () => void;
}

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  /** Full authoritative snapshot. Clients render exactly this. */
  "room:state": (room: RoomState) => void;
  /** Transient toast/notice. `key` is an i18n key the client localizes. */
  "room:notice": (notice: {
    kind: "info" | "warn" | "error";
    key: string;
    params?: Record<string, string | number>;
  }) => void;
  /** Server is shutting the room down (host left with no successor, etc.). */
  "room:closed": (reason: string) => void;
  /** A relayed drawing op (Gartic), or the full op list as a sync. */
  "draw:op": (op: DrawOp) => void;
  "draw:sync": (ops: DrawOp[]) => void;
}

/** Per-socket data the server tracks. */
export interface SocketData {
  roomCode?: string;
  sessionId?: string;
}
