// In-memory authoritative room store. The server is the single source of truth:
// it owns every room's state, mutates it in response to validated events, and
// notifies listeners to re-broadcast. No database — rooms are ephemeral.

import { generateRoomCode } from "./roomCode.js";
import { ENGINES } from "./games/registry.js";
import { randomWord } from "./games/garticWords.js";
import type { GameEngine } from "./games/engine.js";
import {
  DEFAULT_SETTINGS,
  GAMES,
  gameById,
  sanitizeSettings,
  type AllSettings,
  type ChatMessage,
  type DrawOp,
  type GameAction,
  type GameId,
  type Language,
  type Player,
  type PlayerIdentity,
  type RoomState,
} from "../../shared/src/index.js";

/** Seconds a disconnected player's seat is held before removal. */
const RECONNECT_GRACE_MS = 30_000;
/** Max chat lines retained per room. */
const CHAT_HISTORY = 50;
/** Max lobby-whiteboard ops retained (oldest dropped past this). */
const MAX_BOARD_OPS = 8000;

const freshSettings = (): AllSettings =>
  JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AllSettings;

interface Room {
  code: string;
  phase: RoomState["phase"];
  hostId: string;
  selectedGame: GameId;
  /** Per-player game votes (keyed by sessionId). */
  votes: Map<string, GameId>;
  gameLanguage: Language;
  /** Host-configured rules for every game. */
  settings: AllSettings;
  /** Lobby whiteboard: shared strokes + the "draw this" prompt word. */
  boardOps: DrawOp[];
  boardWord: string;
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

  /**
   * Serialize a room into the client-facing snapshot. Pass `forPlayer` to get a
   * personalized game view (hidden hands etc.) for games that support it.
   */
  snapshot(code: string, forPlayer?: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    let game = null;
    if (room.engine && room.gameState !== undefined) {
      game =
        forPlayer && room.engine.playerView
          ? room.engine.playerView(room.gameState, forPlayer)
          : room.engine.view(room.gameState);
    }
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      selectedGame: room.selectedGame,
      votes: Object.fromEntries(room.votes),
      gameLanguage: room.gameLanguage,
      settings: room.settings,
      boardWord: room.boardWord,
      players: [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt),
      chat: room.chat,
      game,
      version: room.version,
    };
  }

  /** True if the active game serves personalized (per-player) views. */
  hasPrivateViews(code: string): boolean {
    const room = this.rooms.get(code);
    return !!room?.engine?.playerView;
  }

  private touch(room: Room) {
    room.version++;
    this.onChange(room.code);
  }

  /** Effective join cap: the game's hard max, tightened by any host setting. */
  private maxPlayersFor(room: Room): number {
    const meta = gameById(room.selectedGame);
    if (room.selectedGame === "bombparty") {
      return Math.min(meta.maxPlayers, room.settings.bombparty.maxPlayers);
    }
    return meta.maxPlayers;
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

  createRoom(
    identity: PlayerIdentity,
    game: GameId = "bombparty",
    language: Language = "fr"
  ): RoomState {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const host = this.makePlayer(identity, true);
    const room: Room = {
      code,
      phase: "lobby",
      hostId: host.id,
      selectedGame: game,
      votes: new Map(),
      gameLanguage: language,
      settings: freshSettings(),
      boardOps: [],
      boardWord: randomWord(language),
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
      return { ok: true, room: this.snapshot(code, identity.sessionId)! };
    }

    if (room.phase !== "lobby") {
      return { ok: false, reason: "That game is already in progress." };
    }
    const cap = this.maxPlayersFor(room);
    if (room.players.size >= cap) {
      return { ok: false, reason: `Room is full (max ${cap}).` };
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
    room.votes.delete(sessionId);

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

  /** Toggle a player's vote for a game. Anyone in the lobby may vote. */
  vote(code: string, sessionId: string, game: GameId) {
    const room = this.rooms.get(code);
    if (!room || !room.players.has(sessionId) || room.phase !== "lobby") return;
    if (room.votes.get(sessionId) === game) room.votes.delete(sessionId);
    else room.votes.set(sessionId, game);
    this.touch(room);
  }

  /** Host picks a game at random — weighted by votes when any have been cast. */
  randomGame(code: string, requesterId: string) {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== requesterId || room.phase !== "lobby") return;
    const voted = [...room.votes.values()];
    const pool = voted.length ? voted : GAMES.map((g) => g.id);
    room.selectedGame = pool[Math.floor(Math.random() * pool.length)];
    this.touch(room);
  }

  setLanguage(code: string, requesterId: string, language: Language) {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== requesterId || room.phase !== "lobby") return;
    room.gameLanguage = language;
    // Keep the whiteboard prompt in the room's game-content language.
    room.boardWord = randomWord(language);
    this.touch(room);
  }

  /** Host edits a game's rules. The patch is clamped/validated server-side. */
  updateSettings(
    code: string,
    requesterId: string,
    game: GameId,
    patch: Record<string, unknown>
  ) {
    const room = this.rooms.get(code);
    if (!room || room.hostId !== requesterId || room.phase !== "lobby") return;
    room.settings[game] = sanitizeSettings(game, room.settings[game], patch) as never;
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
    room.gameState = room.engine.init(participants, Date.now(), {
      language: room.gameLanguage,
      settings: room.settings[room.selectedGame],
    });
    room.phase = "playing";
    room.votes.clear(); // fresh slate when we next return to the lobby
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

  /** Apply a drawing op (Gartic). Returns true if accepted → relay it. */
  drawOp(code: string, sessionId: string, op: DrawOp): boolean {
    const room = this.rooms.get(code);
    if (!room?.engine?.applyDrawOp || room.gameState === undefined || room.phase !== "playing")
      return false;
    return room.engine.applyDrawOp(room.gameState, sessionId, op);
  }

  /** Current drawing ops for a room (for syncing a late/reconnecting viewer). */
  drawOps(code: string): DrawOp[] {
    const room = this.rooms.get(code);
    if (!room?.engine?.drawOps || room.gameState === undefined) return [];
    return room.engine.drawOps(room.gameState);
  }

  /** A stroke on the shared lobby whiteboard. Any room member may draw. Returns
   *  true if accepted → relay it to everyone else. */
  boardOp(code: string, sessionId: string, op: DrawOp): boolean {
    const room = this.rooms.get(code);
    if (!room || !room.players.has(sessionId)) return false;
    if (op.t === "clear") {
      room.boardOps = [];
      return true;
    }
    room.boardOps.push(op);
    if (room.boardOps.length > MAX_BOARD_OPS) {
      room.boardOps.splice(0, room.boardOps.length - MAX_BOARD_OPS);
    }
    return true;
  }

  /** The current lobby whiteboard strokes (for late join / reconnect sync). */
  boardOps(code: string): DrawOp[] {
    return this.rooms.get(code)?.boardOps ?? [];
  }

  /** Shuffle the whiteboard's prompt word (any member may do this). */
  newBoardWord(code: string, sessionId: string) {
    const room = this.rooms.get(code);
    if (!room || !room.players.has(sessionId)) return;
    room.boardWord = randomWord(room.gameLanguage);
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
