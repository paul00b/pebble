// ── Socket.IO event contracts shared by client and server ──────────────────
// Typed event maps so the client and server can never disagree on the wire
// format. Import these into `io<...>()` (server) and `Socket<...>()` (client).

import type { GameId, RoomState } from "./types";
import type { DrawOp, GameAction, Language, SandboxOp } from "./games";

/** Patch to a single game's host-configured rules. */
export interface UpdateSettingsPayload {
  game: GameId;
  /** Partial set of setting values (numbers, or e.g. a custom word list); the
   *  server clamps/sanitizes + validates per game. */
  patch: Record<string, unknown>;
}

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
  /** Toggle this player's vote for a game in the lobby (anyone may vote). */
  "room:vote": (game: GameId) => void;
  /** Host: pick a game at random (weighted by votes when there are any). */
  "room:randomGame": () => void;
  /** Fling synchronized confetti from a point (normalized 0–1 viewport coords). */
  "room:confetti": (burst: { x: number; y: number; color?: string }) => void;
  /** Host sets the game-content language (Bomb Party dict, Petit Bac categories). */
  "room:setLanguage": (language: Language) => void;
  /** Host tweaks a game's rules (start lives, timers, …). */
  "room:updateSettings": (payload: UpdateSettingsPayload) => void;
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
  /** A stroke on the shared lobby whiteboard (anyone can draw). */
  "board:op": (op: DrawOp) => void;
  /** Ask the server for the current lobby whiteboard (late join / reconnect). */
  "board:request": () => void;
  /** Shuffle the lobby whiteboard's "draw this" prompt word. */
  "board:newWord": () => void;
  /** Shared physics sandbox op (host broadcasts state; anyone sends intents). */
  "sandbox:op": (op: SandboxOp) => void;
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
  /** A confetti burst relayed from another player (normalized 0–1 coords). */
  "room:confetti": (burst: { x: number; y: number; color?: string }) => void;
  /** A relayed drawing op (Gartic), or the full op list as a sync. */
  "draw:op": (op: DrawOp) => void;
  "draw:sync": (ops: DrawOp[]) => void;
  /** A relayed lobby-whiteboard stroke, or the full op list as a sync. */
  "board:op": (op: DrawOp) => void;
  "board:sync": (ops: DrawOp[]) => void;
  /** A relayed sandbox op (state broadcast from the host, or an intent). */
  "sandbox:op": (op: SandboxOp) => void;
}

/** Per-socket data the server tracks. */
export interface SocketData {
  roomCode?: string;
  sessionId?: string;
}
