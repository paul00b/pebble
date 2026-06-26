// ── Host-configurable game rules ───────────────────────────────────────────
// Each game has its own settings shape. The room stores a full AllSettings map
// (one entry per game) so a host can pre-tune any game before starting it.
// Bounds live here so the client (stepper limits) and server (clamping) agree.

import type { GameId } from "./types";
import type { Language } from "./games";

/* ── Bomb Party ──────────────────────────────────────────────────────────── */

export interface BombPartySettings {
  /** Syllable rarity: the minimum number of distinct words a syllable must
   *  appear in to be eligible. Lower = rarer syllables = harder. */
  minWordsPerPrompt: number;
  /** Each player is guaranteed at least this many seconds when the bomb lands
   *  on them (a floor enforced on every pass). */
  minTurnSec: number;
  /** The syllable is replaced after it has survived this many turns. */
  syllableMaxAge: number;
  /** Lives each player starts with. */
  startLives: number;
  /** Cap on lives - the alphabet bonus can raise a player up to here. */
  maxLives: number;
  /** Maximum players allowed to join while this game is selected. */
  maxPlayers: number;
}

/** Difficulty tiers for the syllable rarity dropdown (label keys live in i18n). */
export const BOMB_DIFFICULTIES = [
  { key: "beginner", minWords: 500 },
  { key: "easy", minWords: 250 },
  { key: "medium", minWords: 100 },
  { key: "hard", minWords: 30 },
] as const;

/** Letters that count toward the bonus life. The rarest letters are excluded so
 *  the bonus stays achievable in both French and English. Shared so the engine
 *  awards it and the client renders the same strip. */
export const BOMB_BONUS_ALPHABET = "abcdefghijlmnoprstuv".split("");

/* ── Codenames ───────────────────────────────────────────────────────────── */

export interface CodenamesSettings {
  /** Host-supplied word pool. Used when it holds at least CN_WORDS.minToUse
   *  distinct words; otherwise the built-in bank fills the board. */
  customWords: string[];
}

/** Limits for a custom Codenames word list, shared by client UI + server. */
export const CN_WORDS = { minToUse: 25, maxWords: 400, maxLen: 24 } as const;

/* ── Petit Bac ───────────────────────────────────────────────────────────── */

export interface PetitBacSettings {
  /** Categories to play with. Empty (or fewer than PB_CATEGORIES.min) falls back
   *  to the built-in defaults for the room's game-content language. */
  categories: string[];
  /** Seconds a player must wait before "I'm done"/Stop unlocks (a floor on how
   *  early a round can be ended). */
  minWriteSec: number;
}

/** Limits for the custom category list, shared by client UI + server. */
export const PB_CATEGORIES = { min: 6, max: 20, maxLen: 32 } as const;

export const PB_BOUNDS = {
  minWriteSec: { min: 0, max: 90 },
} as const;

/** Built-in category suggestions per language - also the fallback set when the
 *  host hasn't picked a valid custom list. */
export const PB_DEFAULT_CATEGORIES: Record<Language, string[]> = {
  fr: ["Pays", "Ville", "Animal", "Prénom", "Métier", "Fruit ou légume"],
  en: ["Country", "City", "Animal", "First name", "Job", "Fruit or vegetable"],
};

/* ── Devine 9 ────────────────────────────────────────────────────────────── */

export interface Devine9Settings {
  /** Seconds a team gets to guess once the checker launches the timer. */
  turnSec: number;
  /** How many themes each team plays (total turns = roundsPerTeam × 2). */
  roundsPerTeam: number;
}

export const D9_BOUNDS = {
  turnSec: { min: 20, max: 120 },
  roundsPerTeam: { min: 1, max: 8 },
} as const;

/* ── Spyfall ─────────────────────────────────────────────────────────────── */

export interface SpyfallSettings {
  /** Length of the questioning round, in seconds. */
  roundSec: number;
}

export const SF_BOUNDS = {
  roundSec: { min: 120, max: 600 },
} as const;

/* ── Uno ─────────────────────────────────────────────────────────────────── */

export interface UnoSettings {
  /** Cards dealt to each player at the start of a round. */
  startingHand: number;
  /** Allow stacking +2 on +2 and +4 on +4 (the next player adds instead of eating). */
  stacking: boolean;
  /** When you can't (or won't) play, keep drawing until you hit a playable card. */
  drawToMatch: boolean;
  /** If a freshly drawn card is playable, you must play it (no keeping it). */
  forcePlay: boolean;
  /** Cards drawn by a player caught not calling Uno. */
  unoPenalty: number;
  /** Points target to win the match. 0 = a single round, first to empty wins. */
  scoreTarget: number;
}

export const UNO_BOUNDS = {
  startingHand: { min: 5, max: 10 },
  unoPenalty: { min: 1, max: 6 },
  scoreTarget: { min: 0, max: 1000 },
} as const;

/** One settings object per game. Games without options use an empty object. */
export interface AllSettings {
  bombparty: BombPartySettings;
  petitbac: PetitBacSettings;
  sixquiprend: Record<string, never>;
  codenames: CodenamesSettings;
  skyjo: Record<string, never>;
  gartic: Record<string, never>;
  devine9: Devine9Settings;
  spyfall: SpyfallSettings;
  complots: Record<string, never>;
  chateau: Record<string, never>;
  loveletter: Record<string, never>;
  uno: UnoSettings;
  exploding: Record<string, never>;
}

export const DEFAULT_SETTINGS: AllSettings = {
  bombparty: {
    minWordsPerPrompt: 500,
    minTurnSec: 5,
    syllableMaxAge: 2,
    startLives: 2,
    maxLives: 3,
    maxPlayers: 16,
  },
  petitbac: { categories: [], minWriteSec: 45 },
  sixquiprend: {},
  codenames: { customWords: [] },
  skyjo: {},
  gartic: {},
  devine9: { turnSec: 60, roundsPerTeam: 3 },
  spyfall: { roundSec: 360 },
  complots: {},
  chateau: {},
  loveletter: {},
  uno: {
    startingHand: 7,
    stacking: false,
    drawToMatch: false,
    forcePlay: false,
    unoPenalty: 2,
    scoreTarget: 0,
  },
  exploding: {},
};

/** Editable ranges, shared by the client UI and server validation. */
export const BOMB_BOUNDS = {
  minWordsPerPrompt: { min: 30, max: 500 },
  minTurnSec: { min: 1, max: 30 },
  syllableMaxAge: { min: 1, max: 8 },
  startLives: { min: 1, max: 6 },
  maxLives: { min: 1, max: 8 },
  maxPlayers: { min: 2, max: 16 },
} as const;

const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(hi, Math.max(lo, n));
};

/** Clamp an (untrusted) Bomb Party settings patch into valid, complete settings. */
export function sanitizeBombParty(patch: Partial<BombPartySettings>): BombPartySettings {
  const d = DEFAULT_SETTINGS.bombparty;
  const minWordsPerPrompt = clampInt(
    patch.minWordsPerPrompt,
    BOMB_BOUNDS.minWordsPerPrompt.min,
    BOMB_BOUNDS.minWordsPerPrompt.max,
    d.minWordsPerPrompt
  );
  const minTurnSec = clampInt(patch.minTurnSec, BOMB_BOUNDS.minTurnSec.min, BOMB_BOUNDS.minTurnSec.max, d.minTurnSec);
  const syllableMaxAge = clampInt(
    patch.syllableMaxAge,
    BOMB_BOUNDS.syllableMaxAge.min,
    BOMB_BOUNDS.syllableMaxAge.max,
    d.syllableMaxAge
  );
  const startLives = clampInt(patch.startLives, BOMB_BOUNDS.startLives.min, BOMB_BOUNDS.startLives.max, d.startLives);
  // Max lives can never sit below the starting lives.
  const maxLives = clampInt(patch.maxLives, startLives, BOMB_BOUNDS.maxLives.max, Math.max(startLives, d.maxLives));
  const maxPlayers = clampInt(patch.maxPlayers, BOMB_BOUNDS.maxPlayers.min, BOMB_BOUNDS.maxPlayers.max, d.maxPlayers);
  return { minWordsPerPrompt, minTurnSec, syllableMaxAge, startLives, maxLives, maxPlayers };
}

/** Clean an (untrusted) custom Codenames word list: trim, collapse spaces,
 *  upper-case, drop blanks/dupes, and cap the length. */
export function sanitizeCodenames(patch: Partial<CodenamesSettings>): CodenamesSettings {
  const raw = Array.isArray(patch.customWords) ? patch.customWords : [];
  const seen = new Set<string>();
  const customWords: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const clean = entry.trim().replace(/\s+/g, " ").slice(0, CN_WORDS.maxLen).toUpperCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    customWords.push(clean);
    if (customWords.length >= CN_WORDS.maxWords) break;
  }
  return { customWords };
}

/** Clean an (untrusted) Petit Bac settings patch: trim/collapse/dedupe the
 *  category list (case-insensitively) and clamp the minimum write time. A list
 *  shorter than PB_CATEGORIES.min is kept as-is here - the engine falls back to
 *  the language defaults - so the host can clear it to "use defaults". */
export function sanitizePetitBac(patch: Partial<PetitBacSettings>): PetitBacSettings {
  const d = DEFAULT_SETTINGS.petitbac;
  const minWriteSec = clampInt(patch.minWriteSec, PB_BOUNDS.minWriteSec.min, PB_BOUNDS.minWriteSec.max, d.minWriteSec);
  let categories = d.categories;
  if (Array.isArray(patch.categories)) {
    const seen = new Set<string>();
    categories = [];
    for (const entry of patch.categories) {
      if (typeof entry !== "string") continue;
      const clean = entry.trim().replace(/\s+/g, " ").slice(0, PB_CATEGORIES.maxLen);
      const k = clean.toLowerCase();
      if (!clean || seen.has(k)) continue;
      seen.add(k);
      categories.push(clean);
      if (categories.length >= PB_CATEGORIES.max) break;
    }
  }
  return { categories, minWriteSec };
}

/** Clamp an (untrusted) Devine 9 settings patch into valid, complete settings. */
export function sanitizeDevine9(patch: Partial<Devine9Settings>): Devine9Settings {
  const d = DEFAULT_SETTINGS.devine9;
  return {
    turnSec: clampInt(patch.turnSec, D9_BOUNDS.turnSec.min, D9_BOUNDS.turnSec.max, d.turnSec),
    roundsPerTeam: clampInt(
      patch.roundsPerTeam,
      D9_BOUNDS.roundsPerTeam.min,
      D9_BOUNDS.roundsPerTeam.max,
      d.roundsPerTeam
    ),
  };
}

/** Clamp an (untrusted) Spyfall settings patch into valid, complete settings. */
export function sanitizeSpyfall(patch: Partial<SpyfallSettings>): SpyfallSettings {
  const d = DEFAULT_SETTINGS.spyfall;
  return {
    roundSec: clampInt(patch.roundSec, SF_BOUNDS.roundSec.min, SF_BOUNDS.roundSec.max, d.roundSec),
  };
}

const asBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

/** Clamp an (untrusted) Uno settings patch into valid, complete settings. */
export function sanitizeUno(patch: Partial<UnoSettings>): UnoSettings {
  const d = DEFAULT_SETTINGS.uno;
  return {
    startingHand: clampInt(
      patch.startingHand,
      UNO_BOUNDS.startingHand.min,
      UNO_BOUNDS.startingHand.max,
      d.startingHand
    ),
    stacking: asBool(patch.stacking, d.stacking),
    drawToMatch: asBool(patch.drawToMatch, d.drawToMatch),
    forcePlay: asBool(patch.forcePlay, d.forcePlay),
    unoPenalty: clampInt(patch.unoPenalty, UNO_BOUNDS.unoPenalty.min, UNO_BOUNDS.unoPenalty.max, d.unoPenalty),
    // Snap the points target to the nearest 100 (matching the stepper).
    scoreTarget:
      clampInt(patch.scoreTarget, UNO_BOUNDS.scoreTarget.min, UNO_BOUNDS.scoreTarget.max, d.scoreTarget) < 50
        ? 0
        : Math.round(
            clampInt(patch.scoreTarget, UNO_BOUNDS.scoreTarget.min, UNO_BOUNDS.scoreTarget.max, d.scoreTarget) / 100
          ) * 100,
  };
}

/** Merge a patch into a game's current settings and return validated settings. */
export function sanitizeSettings<G extends GameId>(
  game: G,
  current: AllSettings[G],
  patch: Record<string, unknown>
): AllSettings[G] {
  if (game === "bombparty") {
    return sanitizeBombParty({ ...(current as BombPartySettings), ...patch } as Partial<BombPartySettings>) as AllSettings[G];
  }
  if (game === "codenames") {
    return sanitizeCodenames({ ...(current as CodenamesSettings), ...patch } as Partial<CodenamesSettings>) as AllSettings[G];
  }
  if (game === "petitbac") {
    return sanitizePetitBac({ ...(current as PetitBacSettings), ...patch } as Partial<PetitBacSettings>) as AllSettings[G];
  }
  if (game === "devine9") {
    return sanitizeDevine9({ ...(current as Devine9Settings), ...patch } as Partial<Devine9Settings>) as AllSettings[G];
  }
  if (game === "spyfall") {
    return sanitizeSpyfall({ ...(current as SpyfallSettings), ...patch } as Partial<SpyfallSettings>) as AllSettings[G];
  }
  if (game === "uno") {
    return sanitizeUno({ ...(current as UnoSettings), ...patch } as Partial<UnoSettings>) as AllSettings[G];
  }
  // Games without options ignore patches.
  return current;
}
