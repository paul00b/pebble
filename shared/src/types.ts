// ── Core domain types shared by client and server ──────────────────────────
// This is the single source of truth for the shape of a room and its players.

import type { GameView, Language } from "./games";

/** Identifiers for every game the platform can host. */
export type GameId =
  | "bombparty"
  | "petitbac"
  | "sixquiprend"
  | "codenames"
  | "skyjo";

/** High-level phase of a room. */
export type RoomPhase = "lobby" | "playing" | "results";

/** A connected (or recently disconnected) participant in a room. */
export interface Player {
  /** Stable per-session id, persisted client-side so a refresh keeps the seat. */
  id: string;
  name: string;
  /** Emoji used as the avatar. */
  avatar: string;
  /** Accent color (hex) chosen for this player. */
  color: string;
  isHost: boolean;
  /** False while the socket is gone but the seat is held during the grace period. */
  connected: boolean;
  /** Order of joining, used for turn order and stable sorting. */
  joinedAt: number;
}

/** Per-game metadata for the lobby game picker. */
export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  emoji: string;
  minPlayers: number;
  maxPlayers: number;
  /** Roughly how long a session lasts, for display only. */
  duration: string;
}

/** A chat message in the room. */
export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  avatar: string;
  text: string;
  at: number;
}

/** The full, authoritative state of a room as broadcast to clients. */
export interface RoomState {
  code: string;
  phase: RoomPhase;
  hostId: string;
  selectedGame: GameId;
  /** Language of game *content* (Bomb Party dictionary, Petit Bac categories). */
  gameLanguage: Language;
  players: Player[];
  chat: ChatMessage[];
  /** Public projection of the in-progress game, or null while in the lobby. */
  game: GameView | null;
  /** Bumped on every authoritative change for simple client-side diffing. */
  version: number;
}

/** The catalogue of games, used by the lobby picker. */
export const GAMES: GameMeta[] = [
  {
    id: "bombparty",
    name: "Bomb Party",
    tagline: "Type a word with the syllable before the bomb blows.",
    emoji: "💣",
    minPlayers: 2,
    maxPlayers: 16,
    duration: "5–10 min",
  },
  {
    id: "petitbac",
    name: "Petit Bac",
    tagline: "A letter, some categories, race to fill them in.",
    emoji: "✏️",
    minPlayers: 2,
    maxPlayers: 12,
    duration: "8–15 min",
  },
  {
    id: "sixquiprend",
    name: "6 Qui Prend",
    tagline: "Lay cards in rows — just don't take the sixth.",
    emoji: "🐂",
    minPlayers: 2,
    maxPlayers: 10,
    duration: "10–20 min",
  },
  {
    id: "codenames",
    name: "Codenames",
    tagline: "Two teams, secret words, one-word clues from your spymaster.",
    emoji: "🕵️",
    minPlayers: 4,
    maxPlayers: 8,
    duration: "15–25 min",
  },
  {
    id: "skyjo",
    name: "Skyjo",
    tagline: "Swap and flip to keep your grid as low as possible.",
    emoji: "🃏",
    minPlayers: 2,
    maxPlayers: 8,
    duration: "10–15 min",
  },
];

export const gameById = (id: GameId): GameMeta =>
  GAMES.find((g) => g.id === id) ?? GAMES[0];
