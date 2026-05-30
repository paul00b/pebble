// In-memory authoritative room store. The server is the single source of truth:
// it owns every room's state, mutates it in response to validated events, and
// notifies listeners to re-broadcast. No database — rooms are ephemeral.

import { generateRoomCode } from "./roomCode.js";
import { ENGINES } from "./games/registry.js";
import type { GameEngine } from "./games/engine.js";
import {
  gameById,
  type ChatMessage,
  type GameAction,
  type GameId,
  type Player,
  type PlayerIdentity,
  type RoomState,
} from "../../shared/src/index.js";

/** Seconds a disconnected player's seat is held before removal. */
const RECONNECT_GRACE_MS = 30_000;
/** Max chat lines retained per room. */
const CHAT_HISTORY = 50;

interface Room {
  code: string;
  phase: RoomState["phase"];
  hostId: string;
  selectedGame: GameId;
  /** Keyed by player sessionId. */
  players: Map<string, Player>;
  chat: ChatMessage[];
  version: number;
  /** Pending removal timers for disconnected players. */
  graceTimers: Map<string, NodeJS.Timeout>;
  /** Active game engine + its authoritative state (only while phase==="playing"). */
  engine?: GameEngine<unknown>;
  gameState?: unknown;
}

type ChangeListener = (code: string) => void;
type CloseListener = (code: string, reason: string) => void;

let msgCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(msgCounter++).toString(36)}`;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private onChange: ChangeListener = () => {};
  private onClose: CloseListener = () => {};

  setListeners(onChange: ChangeListener, onClose: CloseListener) {
    this.onChange = onChange;
    this.onClose = onClose;
  }

  has(code: string) {
    return this.rooms.has(code);
  }

  /** Serialize a room into the client-facing snapshot. */
  snapshot(code: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      selectedGame: room.selectedGame,
      players: [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt),
      chat: room.chat,
      game:
        room.engine && room.gameState !== undefined
          ? room.engine.view(room.gameState)
          : null,
      version: room.version,
    };
  }

  private touch(room: Room) {
    room.version++;
    this.onChange(room.code);
  }

  private makePlayer(identity: PlayerIdentity, isHost: boolean): Player {
    return {
      id: identity.sessionId,
      name: identity.name.slice(0, 24) || "Player",
      avatar: identity.avatar || "🐧",
      color: identity.color || "#6ee7d6",
      isHost,
      connected: true,
      joinedAt: Date.now(),
    };
  }

  createRoom(identity: PlayerIdentity, game: GameId = "bombparty"): RoomState {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const host = this.makePlayer(identity, true);
    const room: Room = {
      code,
      phase: "lobby",
      hostId: host.id,
      selectedGame: game,
      players: new Map([[host.id, host]]),
      chat: [],
      version: 0,
      graceTimers: new Map(),
    };
    this.rooms.set(code, room);
    return this.snapshot(code)!;
  }

  /**
   * Join (or reconnect to) a room. Returns the snapshot on success, or an
   * error reason. Reconnect is detected by a matching sessionId.
   */
  joinRoom(
    code: string,
    identity: PlayerIdentity
  ): { ok: true; room: RoomState } | { ok: false; reason: string } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: "Room not found. Check the code?" };

    const existing = room.players.get(identity.sessionId);
    if (existing) {
      // Reconnect: cancel pending removal, refresh profile, mark connected.
      const timer = room.graceTimers.get(identity.sessionId);
      if (timer) {
        clearTimeout(timer);
        room.graceTimers.delete(identity.sessionId);
      }
      existing.connected = true;
      existing.name = identity.name.slice(0, 24) || existing.name;
      existing.avatar = identity.avatar || existing.avatar;
      existing.color = identity.color || existing.color;
      this.touch(room);
      return { ok: true, room: this.snapshot(code)! };
    }

    if (room.phase !== "lobby") {
      return { ok: false, reason: "That game is already in progress." };
    }
    const meta = gameById(room.selectedGame);
    if (room.players.size >= meta.maxPlayers) {
      return { ok: false, reason: `Room is full (max ${meta.maxPlayers}).` };
    }

    room.players.set(identity.sessionId, this.makePlayer(identity, false));
    this.touch(room);
    return { ok: true, room: this.snapshot(code)! };
  }

  /** Mark a player disconnected and schedule seat removal after the grace window. */
  handleDisconnect(code: string, sessionId: string) {
    const room = this.rooms.get(code);
    const player = room?.players.get(sessionId);
    if (!room || !player) return;

    player.connected = false;
    this.touch(room);

    const timer = setTimeout(() => {
      this.removePlayer(code, sessionId);
    }, RECONNECT_GRACE_MS);
    room.graceTimers.set(sessionId, timer);
  }

  /** Immediate, intentional leave (clicked "Leave"). */
  leave(code: string, sessionId: string) {
    this.removePlayer(code, sessionId);
  }

  private removePlayer(code: string, sessionId: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    const timer = room.graceTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      room.graceTimers.delete(sessionId);
    }
    if (!room.players.delete(sessionId)) return;

    if (room.players.size === 0) {
      this.closeRoom(code, "Everyone left.");
      return;
    }
    // Let the active game react to the departure (skip turn, rescore, etc.).
    if (room.engine && room.gameState !== undefined) {
      room.engine.onLeave(room.gameState, sessionId, Date.now());
    }
    // Host migration: hand off to the earliest-joined remaining player.
    if (room.hostId === sessionId) {
      const next = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      next.isHost = true;
      room.hostId = next.id;
    }
    this.touch(room);
  }

  kick(code: string, requesterId: string, targetId: string) {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== requesterId || requesterId === targetId) return;
    this.removePlayer(code, targetId);
  }

  selectGame(code: string, requesterId: string, game: GameId) {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== requesterId || room.phase !== "lobby") return;
    room.selectedGame = game;
    this.touch(room);
  }

  start(code: string, requesterId: string): { ok: boolean; reason?: string } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: "Room not found." };
    if (room.hostId !== requesterId) return { ok: false, reason: "Only the host can start." };
    const meta = gameById(room.selectedGame);
    const participants = [...room.players.values()]
      .filter((p) => p.connected)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    if (participants.length < meta.minPlayers) {
      return { ok: false, reason: `Need at least ${meta.minPlayers} players.` };
    }
    room.engine = ENGINES[room.selectedGame];
    room.gameState = room.engine.init(participants, Date.now());
    room.phase = "playing";
    this.touch(room);
    return { ok: true };
  }

  /** Route a validated in-game move into the active engine. */
  gameAction(code: string, sessionId: string, action: GameAction) {
    const room = this.rooms.get(code);
    if (!room?.engine || room.gameState === undefined || room.phase !== "playing") return;
    const changed = room.engine.action(room.gameState, sessionId, action, {
      now: Date.now(),
      isHost: room.hostId === sessionId,
    });
    if (changed) this.touch(room);
  }

  /** Host sends everyone back to the lobby (e.g. after results). */
  toLobby(code: string, requesterId: string) {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== requesterId) return;
    room.engine = undefined;
    room.gameState = undefined;
    room.phase = "lobby";
    this.touch(room);
  }

  /** Drive every active game's time-based state. Called on a fixed interval. */
  tickAll() {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      if (room.engine && room.gameState !== undefined && room.phase === "playing") {
        if (room.engine.tick(room.gameState, now)) this.touch(room);
      }
    }
  }

  chat(code: string, sessionId: string, text: string) {
    const room = this.rooms.get(code);
    const player = room?.players.get(sessionId);
    if (!room || !player) return;
    const clean = text.trim().slice(0, 280);
    if (!clean) return;
    const msg: ChatMessage = {
      id: nextId("m"),
      playerId: player.id,
      name: player.name,
      avatar: player.avatar,
      text: clean,
      at: Date.now(),
    };
    room.chat.push(msg);
    if (room.chat.length > CHAT_HISTORY) room.chat.splice(0, room.chat.length - CHAT_HISTORY);
    this.touch(room);
  }

  private closeRoom(code: string, reason: string) {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const t of room.graceTimers.values()) clearTimeout(t);
    this.rooms.delete(code);
    this.onClose(code, reason);
  }

  get roomCount() {
    return this.rooms.size;
  }
}
