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
  /** Hard cap on lives (heart row length; bonus lives can grow up to here). */
  maxLives: number;
  /** Bonus-alphabet letters each player has banked so far (normalized a–z). */
  alphabet: Record<string, string>;
  /** Each player's most recently accepted word + the syllable it matched —
   *  floated above their avatar for a moment. */
  recent: Record<string, { word: string; syllable: string; at: number }>;
  /** Last thing that happened, for feedback + animation cues. */
  lastEvent?: {
    type: "valid" | "invalid" | "used" | "explode";
    playerId: string;
    word?: string;
    /** The syllable a valid word matched (so the client can highlight it). */
    syllable?: string;
    /** True when this valid word completed the alphabet → a life was gained. */
    bonus?: boolean;
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

export type PetitBacStage = "writing" | "review" | "reveal" | "done";

export interface PetitBacCell {
  playerId: string;
  answer: string;
  points: number;
  valid: boolean;
  unique: boolean;
}

/** One answer being checked during the vote-based review stage. */
export interface PetitBacReviewCell {
  playerId: string;
  answer: string;
  /** Currently counted as valid? Valid by default; a majority of "bad" votes strikes it. */
  valid: boolean;
  /** How many players have voted this answer invalid. */
  badVotes: number;
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
  /** Earliest epoch-ms at which a player may Stop / lock in (the host-set
   *  minimum write time). Before this, the "I'm done" button is disabled. */
  canStopAt: number;
  /** How many players have locked in their answers. */
  finishedCount: number;
  totalPlayers: number;
  /** Player id who slammed "Stop!", if any. */
  stoppedBy?: string | null;
  /** During "review": the single category being checked + everyone's answer.
   *  `votesNeeded` is the bad-vote count that strikes an answer (majority). */
  review?: {
    index: number;
    total: number;
    category: string;
    cells: PetitBacReviewCell[];
    votesNeeded: number;
  };
  /** Reveal grid: reveal[categoryIndex] = rows of cells. */
  reveal?: PetitBacCell[][];
  /** Points scored this round, per player id. */
  roundScores?: Record<string, number>;
  /** Cumulative score per player id. */
  scores: Record<string, number>;
  over: boolean;
}

export type PetitBacAction =
  /** Lock in answers (Stop / everyone-done) — also marks the player finished. */
  | { type: "submit"; answers: string[] }
  /** Live sync of in-progress answers (so partials are saved if someone Stops). */
  | { type: "draft"; answers: string[] }
  | { type: "stop" }
  /** Cast/retract a "this answer is wrong" vote (current category only). */
  | { type: "toggle"; category: number; playerId: string }
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
  /** The viewer's tentatively chosen card this turn (null until they pick). */
  youChoseCard?: number | null;
  /** During "takeRow": the player who must pick a row to take. */
  pendingPlayerId?: string | null;
  /** Summary of the most recently resolved turn. */
  lastTurn?: SixTurnEntry[];
  /** Snapshot of the rows at the START of the last resolution — lets the client
   *  forward-replay each placement in `lastTurn` as an animation (scoops destroy
   *  the pre-scoop row content, so it can't be reconstructed from `rows` alone). */
  lastStartRows?: number[][];
  over: boolean;
  winnerId?: string | null;
}

export type SixQuiPrendAction =
  | { type: "choose"; card: number }
  | { type: "unchoose" }
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
  /** Player ids who voted for each card this turn (current team's operatives). */
  votes: string[][];
  /** Card index the viewer is currently voting for, or null. */
  youVote: number | null;
  winner: CodenamesTeam | null;
  /** Reason the game ended (e.g. assassin), for display. */
  endReason?: "swept" | "assassin" | null;
}

export type CodenamesAction =
  | { type: "setTeam"; team: CodenamesTeam }
  | { type: "setRole"; role: CodenamesRole }
  | { type: "begin" }
  | { type: "clue"; word: string; count: number }
  | { type: "vote"; index: number }
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

/* ── Gartic (draw & guess) ───────────────────────────────────────────────── */

export type GarticPhase = "choosing" | "drawing" | "reveal" | "done";

export type GarticDifficulty = "easy" | "medium" | "hard";

/** A word the drawer may pick during the choosing phase. */
export interface GarticChoice {
  word: string;
  difficulty: GarticDifficulty;
}

export interface GarticPlayerScore {
  id: string;
  score: number;
  guessed: boolean;
}

export interface GarticMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  /** True if this was a correct guess (text is hidden from others). */
  correct: boolean;
}

export interface GarticView {
  kind: "gartic";
  phase: GarticPhase;
  drawerId: string;
  round: number;
  totalRounds: number;
  /** Deadline (epoch ms) for the current timed phase (choosing or drawing). */
  deadline: number;
  /** Full length (ms) of the current timed phase — for animating the timer. */
  duration: number;
  /** Full word for the drawer & during reveal; otherwise a masked pattern. */
  word: string;
  wordMasked: boolean;
  /** The drawer's two word options — populated only for the drawer while choosing. */
  choices: GarticChoice[];
  players: GarticPlayerScore[];
  messages: GarticMessage[];
  youAreDrawer: boolean;
  youGuessed: boolean;
  over: boolean;
  winnerId?: string | null;
}

export type GarticAction =
  | { type: "choose"; index: number }
  | { type: "guess"; text: string }
  | { type: "next" };

/** Real-time drawing operation (normalized 0–1 coordinates). `w` is stroke
 *  width as a fraction of canvas width; `c` is the colour (eraser = background). */
export type DrawOp =
  | { t: "line"; x0: number; y0: number; x1: number; y1: number; c: string; w: number }
  | { t: "rect"; x0: number; y0: number; x1: number; y1: number; c: string; w: number }
  | { t: "ellipse"; x0: number; y0: number; x1: number; y1: number; c: string; w: number }
  | { t: "fill"; x: number; y: number; c: string }
  | { t: "clear" };

/* ── Devine 9 (guess 9) ──────────────────────────────────────────────────── */

export type Devine9Team = "red" | "blue";
export type Devine9Phase = "setup" | "play" | "reveal" | "over";

export interface Devine9Member {
  id: string;
  team: Devine9Team | null;
}

export interface Devine9View {
  kind: "devine9";
  phase: Devine9Phase;
  members: Devine9Member[];
  /** Team currently guessing aloud. The other team holds the card (checker). */
  activeTeam: Devine9Team;
  /** 1-based current turn / total turns to play. */
  turn: number;
  totalTurns: number;
  /** The theme prompt — shown to the checker team (play) and everyone (reveal). */
  prompt: string | null;
  /** The 9 answers — only revealed to the checker (play) or everyone (reveal). */
  answers: string[] | null;
  /** The bomb word — same visibility as `answers`. */
  bomb: string | null;
  /** Which of the 9 answers have been ticked (aligned to `answers`). */
  found: boolean[];
  foundCount: number;
  /** Whether the bomb word has been said. */
  bombHit: boolean;
  /** Has the checker launched the timer yet? */
  started: boolean;
  /** Epoch ms when the turn ends (0 before the timer starts). */
  deadline: number;
  /** Configured turn length in seconds (for the timer ring). */
  turnSec: number;
  scores: Record<Devine9Team, number>;
  /** Points scored on the just-finished turn (shown on the reveal). */
  roundPoints: number | null;
  youTeam: Devine9Team | null;
  /** True when the viewer is on the team holding the card this turn. */
  youAreChecker: boolean;
  winner: Devine9Team | "tie" | null;
}

export type Devine9Action =
  | { type: "setTeam"; team: Devine9Team }
  | { type: "begin" }
  | { type: "start" }
  | { type: "validate"; index: number }
  | { type: "bomb" }
  | { type: "next" };

/* ── Unions ──────────────────────────────────────────────────────────────── */

export type GameView =
  | BombPartyView
  | PetitBacView
  | SixQuiPrendView
  | CodenamesView
  | SkyjoView
  | GarticView
  | Devine9View;
export type GameAction =
  | BombPartyAction
  | PetitBacAction
  | SixQuiPrendAction
  | CodenamesAction
  | SkyjoAction
  | GarticAction
  | Devine9Action;
