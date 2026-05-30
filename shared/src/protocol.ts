// ── Socket.IO event contracts shared by client and server ──────────────────
// Typed event maps so the client and server can never disagree on the wire
// format. Import these into `io<...>()` (server) and `Socket<...>()` (client).

import type { GameId, RoomState } from "./types";
import type { GameAction } from "./games";

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
  "room:start": (ack: (result: { ok: boolean; reason?: string }) => void) => void;
  /** Host returns the room to the lobby (e.g. after a game ends). */
  "room:toLobby": () => void;
  "room:kick": (playerId: string) => void;
  "chat:send": (text: string) => void;
  /** A move within the active game. The server validates against its state. */
  "game:action": (action: GameAction) => void;
}

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  /** Full authoritative snapshot. Clients render exactly this. */
  "room:state": (room: RoomState) => void;
  /** Transient toast/notice (player joined, kicked, errors). */
  "room:notice": (notice: { kind: "info" | "warn" | "error"; text: string }) => void;
  /** Server is shutting the room down (host left with no successor, etc.). */
  "room:closed": (reason: string) => void;
}

/** Per-socket data the server tracks. */
export interface SocketData {
  roomCode?: string;
  sessionId?: string;
}
