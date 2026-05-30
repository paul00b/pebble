// ── Public, client-facing projections of in-progress games ─────────────────
// The server owns the full authoritative state; these are the trimmed views it
// broadcasts. Clients render exactly what's here and send back GameActions.

export type Language = "fr" | "en";

/* ── Bomb Party ──────────────────────────────────────────────────────────── */

export interface BombPartyView {
  kind: "bombparty";
  language: Language;
  /** The syllable the current player must include in a real word. */
  prompt: string;
  /** Turn order (player ids), still-alive players only. */
  order: string[];
  /** Whose turn it is. */
  current: string;
  /** Live, in-progress text from the current player (for spectator tension). */
  typed: string;
  /** Epoch ms when the bomb explodes. */
  deadline: number;
  /** Epoch ms when the current fuse started (lets clients draw a ring %). */
  fuseStart: number;
  /** Remaining lives per player id. */
  lives: Record<string, number>;
  /** Lives every player started with (for heart rows). */
  startLives: number;
  /** Last thing that happened, for feedback + animation cues. */
  lastEvent?: {
    type: "valid" | "invalid" | "used" | "explode";
    playerId: string;
    word?: string;
    at: number;
  };
  /** Bomb number (increments each explosion). */
  round: number;
  over: boolean;
  winnerId?: string | null;
}

export type BombPartyAction =
  | { type: "type"; value: string }
  | { type: "submit"; word: string };

/* ── Petit Bac ───────────────────────────────────────────────────────────── */

export type PetitBacStage = "writing" | "reveal" | "done";

export interface PetitBacCell {
  playerId: string;
  answer: string;
  points: number;
  valid: boolean;
  unique: boolean;
}

export interface PetitBacView {
  kind: "petitbac";
  stage: PetitBacStage;
  letter: string;
  categories: string[];
  round: number;
  totalRounds: number;
  /** Writing-phase deadline (epoch ms). */
  deadline: number;
  /** How many players have locked in their answers. */
  finishedCount: number;
  totalPlayers: number;
  /** Player id who slammed "Stop!", if any. */
  stoppedBy?: string | null;
  /** Reveal grid: reveal[categoryIndex] = rows of cells. */
  reveal?: PetitBacCell[][];
  /** Points scored this round, per player id. */
  roundScores?: Record<string, number>;
  /** Cumulative score per player id. */
  scores: Record<string, number>;
  over: boolean;
}

export type PetitBacAction =
  | { type: "submit"; answers: string[] }
  | { type: "stop" }
  | { type: "next" };

/* ── 6 Qui Prend (6 nimmt!) ──────────────────────────────────────────────── */

/** Penalty "bull heads" on a card (1–104). Shared by server scoring + client. */
export function bullHeads(card: number): number {
  if (card === 55) return 7;
  if (card % 11 === 0) return 5;
  if (card % 10 === 0) return 3;
  if (card % 5 === 0) return 2;
  return 1;
}

export interface SixPlayerPublic {
  id: string;
  bulls: number;
  handCount: number;
  hasChosen: boolean;
}

/** One card's placement during a turn's resolution, for display. */
export interface SixTurnEntry {
  playerId: string;
  card: number;
  rowIndex: number;
  /** True if the player had to take the row (gaining its bulls). */
  tookRow: boolean;
  gained: number;
}

export interface SixQuiPrendView {
  kind: "sixquiprend";
  phase: "choosing" | "takeRow" | "done";
  /** The four rows on the table (each 1–5 cards). */
  rows: number[][];
  turn: number;
  totalTurns: number;
  players: SixPlayerPublic[];
  /** The viewer's own hand (sorted) — personalized per player. */
  hand: number[];
  /** Whether the viewer has locked a card this turn. */
  youChose: boolean;
  /** During "takeRow": the player who must pick a row to take. */
  pendingPlayerId?: string | null;
  /** Summary of the most recently resolved turn. */
  lastTurn?: SixTurnEntry[];
  over: boolean;
  winnerId?: string | null;
}

export type SixQuiPrendAction =
  | { type: "choose"; card: number }
  | { type: "takeRow"; rowIndex: number };

/* ── Codenames ───────────────────────────────────────────────────────────── */

export type CodenamesTeam = "red" | "blue";
export type CodenamesCardColor = "red" | "blue" | "neutral" | "assassin";
export type CodenamesRole = "spymaster" | "operative";
export type CodenamesPhase = "setup" | "clue" | "guess" | "over";

export interface CodenamesMember {
  id: string;
  team: CodenamesTeam | null;
  role: CodenamesRole;
}

export interface CodenamesView {
  kind: "codenames";
  phase: CodenamesPhase;
  /** The 25 code words. */
  words: string[];
  /** Revealed color per cell, or null if still face-down. */
  revealed: (CodenamesCardColor | null)[];
  /** Full key — populated only for spymasters (else all null). Personalized. */
  key: (CodenamesCardColor | null)[];
  members: CodenamesMember[];
  turnTeam: CodenamesTeam;
  clue: { word: string; count: number } | null;
  /** Guesses the current team has left this turn. */
  guessesLeft: number;
  /** Cards each team still needs to find. */
  remaining: { red: number; blue: number };
  /** Viewer's own assignment. */
  youTeam: CodenamesTeam | null;
  youRole: CodenamesRole;
  winner: CodenamesTeam | null;
  /** Reason the game ended (e.g. assassin), for display. */
  endReason?: "swept" | "assassin" | null;
}

export type CodenamesAction =
  | { type: "setTeam"; team: CodenamesTeam }
  | { type: "setRole"; role: CodenamesRole }
  | { type: "begin" }
  | { type: "clue"; word: string; count: number }
  | { type: "guess"; index: number }
  | { type: "endTurn" };

/* ── Skyjo ───────────────────────────────────────────────────────────────── */

/** A grid slot: null = cleared column, else face-down (value hidden) or up. */
export type SkyjoCell = null | { up: boolean; value: number | null };

export interface SkyjoPlayerPublic {
  id: string;
  grid: SkyjoCell[];
  /** Sum of currently face-up cards (live, visible score). */
  score: number;
  /** Whether this player's grid is fully revealed (round-ender). */
  complete: boolean;
}

export interface SkyjoView {
  kind: "skyjo";
  phase: "flip2" | "turn" | "done";
  players: SkyjoPlayerPublic[];
  currentId: string;
  /** Current player's sub-stage: pick a source, or resolve a drawn card. */
  stage: "await" | "resolveDraw";
  /** The drawn card awaiting placement (visible to all), or null. */
  held: number | null;
  discardTop: number | null;
  deckCount: number;
  closerId?: string | null;
  finalScores?: Record<string, number>;
  over: boolean;
  winnerId?: string | null;
}

export type SkyjoAction =
  | { type: "flip"; index: number }
  | { type: "drawDeck" }
  | { type: "takeDiscard"; index: number }
  | { type: "keepReplace"; index: number }
  | { type: "discardFlip"; index: number };

/* ── Unions ──────────────────────────────────────────────────────────────── */

export type GameView =
  | BombPartyView
  | PetitBacView
  | SixQuiPrendView
  | CodenamesView
  | SkyjoView;
export type GameAction =
  | BombPartyAction
  | PetitBacAction
  | SixQuiPrendAction
  | CodenamesAction
  | SkyjoAction;
