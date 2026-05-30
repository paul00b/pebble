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

/* ── Unions ──────────────────────────────────────────────────────────────── */

export type GameView = BombPartyView | PetitBacView;
export type GameAction = BombPartyAction | PetitBacAction;
