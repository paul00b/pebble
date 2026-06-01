// Bomb Party — the live-turn game. A bomb passes around the circle; the holder
// must type a real word containing the given syllable before the fuse runs out.
// The fuse PERSISTS across passes (classic, tense) and only resets when the
// bomb explodes — but every pass is guaranteed at least `minTurnMs` (the host's
// "minimum turn duration"), so a fast pass can never instantly kill the next
// player. Server owns the timer; clients just animate toward `deadline`.

import type { Player } from "../../../shared/src/types.js";
import type {
  BombPartyAction,
  BombPartyView,
  GameAction,
  Language,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";
import { isValidWord, normalize, preload, randomPrompt } from "./dictionary.js";
import {
  BOMB_BONUS_ALPHABET,
  sanitizeBombParty,
  type BombPartySettings,
} from "../../../shared/src/settings.js";

/** Extra randomness on top of the guaranteed minimum, at each fresh bomb. */
const FUSE_SPREAD_MS = 20_000;
const BONUS_SET = new Set(BOMB_BONUS_ALPHABET);

interface BombState {
  language: Language;
  order: string[]; // alive players, in seating order
  current: string;
  prompt: string;
  /** How many turns the current syllable has already survived. */
  promptAge: number;
  typed: string;
  deadline: number;
  fuseStart: number;
  lives: Record<string, number>;
  used: Set<string>;
  /** Bonus-alphabet letters banked per player (resets when the bonus fires). */
  letters: Record<string, Set<string>>;
  /** Most recent accepted word per player (for the floating chip). */
  recent: Record<string, { word: string; syllable: string; at: number }>;
  lastEvent?: BombPartyView["lastEvent"];
  round: number;
  over: boolean;
  winnerId: string | null;
  /** Host-configured rules, baked in at init (so mid-game changes don't apply). */
  minWordsPerPrompt: number;
  minTurnMs: number;
  syllableMaxAge: number;
  startLives: number;
  maxLives: number;
}

/** A fresh bomb: the guaranteed minimum plus a random spread. */
const freshFuse = (now: number, minMs: number) =>
  now + minMs + Math.floor(Math.random() * FUSE_SPREAD_MS);

function nextAlive(order: string[], current: string): string {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

export const bombParty: GameEngine<BombState> = {
  init(players: Player[], now: number, opts: InitOptions): BombState {
    const language: Language = opts.language;
    const rules: BombPartySettings = sanitizeBombParty(
      (opts.settings ?? {}) as Partial<BombPartySettings>
    );
    const minTurnMs = rules.minTurnSec * 1000;
    preload(language);
    const order = players.map((p) => p.id);
    const lives: Record<string, number> = {};
    const letters: Record<string, Set<string>> = {};
    for (const id of order) {
      lives[id] = rules.startLives;
      letters[id] = new Set();
    }
    return {
      language,
      order,
      current: order[0],
      prompt: randomPrompt(language, rules.minWordsPerPrompt),
      promptAge: 0,
      typed: "",
      deadline: freshFuse(now, minTurnMs),
      fuseStart: now,
      lives,
      used: new Set(),
      letters,
      recent: {},
      round: 1,
      over: false,
      winnerId: null,
      minWordsPerPrompt: rules.minWordsPerPrompt,
      minTurnMs,
      syllableMaxAge: rules.syllableMaxAge,
      startLives: rules.startLives,
      maxLives: rules.maxLives,
    };
  },

  action(state, playerId, action: GameAction, ctx: ActionContext): boolean {
    if (state.over) return false;
    const a = action as BombPartyAction;
    const now = ctx.now;

    if (a.type === "type") {
      if (playerId !== state.current) return false;
      state.typed = a.value.slice(0, 60);
      return true;
    }

    if (a.type === "submit") {
      if (playerId !== state.current) return false;
      const word = a.word;
      const norm = normalize(word);

      if (norm.length < 2) return false;
      if (state.used.has(norm)) {
        state.lastEvent = { type: "used", playerId, word, at: now };
        return true;
      }
      if (!isValidWord(state.language, word, state.prompt)) {
        state.lastEvent = { type: "invalid", playerId, word, at: now };
        return true;
      }

      // Valid! Bank the word + alphabet progress, pass the bomb onward.
      state.used.add(norm);
      const bonus = bankLetters(state, playerId, norm);
      state.recent[playerId] = { word, syllable: state.prompt, at: now };
      state.lastEvent = { type: "valid", playerId, word, syllable: state.prompt, bonus, at: now };
      state.typed = "";
      state.current = nextAlive(state.order, state.current);

      // Guarantee the next holder at least the minimum turn time.
      if (state.deadline - now < state.minTurnMs) {
        state.deadline = now + state.minTurnMs;
        state.fuseStart = now;
      }
      ageSyllable(state);
      return true;
    }

    return false;
  },

  tick(state, now): boolean {
    if (state.over) return false;
    if (now < state.deadline) return false;

    // Boom. Current holder loses a life; the bomb moves on with a fresh fuse.
    const exploded = state.current;
    const nextId = nextAlive(state.order, exploded);
    state.lives[exploded] = Math.max(0, (state.lives[exploded] ?? 0) - 1);
    state.lastEvent = { type: "explode", playerId: exploded, at: now };

    if (state.lives[exploded] <= 0) {
      state.order = state.order.filter((id) => id !== exploded);
    }

    if (state.order.length <= 1) {
      state.over = true;
      state.winnerId = state.order[0] ?? null;
      return true;
    }

    state.current = nextId;
    state.round += 1;
    state.prompt = randomPrompt(state.language, state.minWordsPerPrompt);
    state.promptAge = 0;
    state.typed = "";
    state.fuseStart = now;
    state.deadline = freshFuse(now, state.minTurnMs);
    return true;
  },

  onLeave(state, playerId, now): boolean {
    if (state.over) return false;
    const idx = state.order.indexOf(playerId);
    if (idx < 0) return false;

    const wasCurrent = playerId === state.current;
    state.order = state.order.filter((id) => id !== playerId);

    if (state.order.length <= 1) {
      state.over = true;
      state.winnerId = state.order[0] ?? null;
      return true;
    }

    if (wasCurrent) {
      // Hand the bomb to whoever now sits in that seat, with a fair fresh fuse.
      state.current = state.order[idx % state.order.length];
      state.prompt = randomPrompt(state.language, state.minWordsPerPrompt);
      state.promptAge = 0;
      state.typed = "";
      state.fuseStart = now;
      state.deadline = freshFuse(now, state.minTurnMs);
    }
    return true;
  },

  isOver: (state) => state.over,

  view(state): BombPartyView {
    const alphabet: Record<string, string> = {};
    for (const id of state.order) {
      alphabet[id] = [...(state.letters[id] ?? [])].sort().join("");
    }
    return {
      kind: "bombparty",
      language: state.language,
      prompt: state.prompt,
      order: state.order,
      current: state.current,
      typed: state.typed,
      deadline: state.deadline,
      fuseStart: state.fuseStart,
      lives: state.lives,
      startLives: state.startLives,
      maxLives: state.maxLives,
      alphabet,
      recent: state.recent,
      lastEvent: state.lastEvent,
      round: state.round,
      over: state.over,
      winnerId: state.winnerId,
    };
  },
};

/** Add a word's bonus letters; award (and reset) a life when the set completes. */
function bankLetters(state: BombState, playerId: string, norm: string): boolean {
  const set = state.letters[playerId] ?? (state.letters[playerId] = new Set());
  for (const ch of norm) if (BONUS_SET.has(ch)) set.add(ch);
  if (!BOMB_BONUS_ALPHABET.every((c) => set.has(c))) return false;
  set.clear();
  if (state.lives[playerId] < state.maxLives) state.lives[playerId] += 1;
  return true;
}

/** Retire a syllable that has lived past its max age (keeps prompts fresh). */
function ageSyllable(state: BombState): void {
  state.promptAge += 1;
  if (state.promptAge >= state.syllableMaxAge) {
    state.prompt = randomPrompt(state.language, state.minWordsPerPrompt);
    state.promptAge = 0;
  }
}
