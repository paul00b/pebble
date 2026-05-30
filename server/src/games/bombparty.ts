// Bomb Party — the live-turn game. A bomb passes around the circle; the holder
// must type a real word containing the given syllable before the fuse runs out.
// The fuse PERSISTS across passes (classic, tense) and only resets when the
// bomb explodes. Server owns the timer; clients just animate toward `deadline`.

import type { Player } from "../../../shared/src/types.js";
import type {
  BombPartyAction,
  BombPartyView,
  GameAction,
  Language,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";
import { isValidWord, normalize, preload, randomPrompt } from "./dictionary.js";

const START_LIVES = 2;
const MIN_FUSE_MS = 10_000;
const MAX_FUSE_MS = 26_000;

interface BombState {
  language: Language;
  order: string[]; // alive players, in seating order
  current: string;
  prompt: string;
  typed: string;
  deadline: number;
  fuseStart: number;
  lives: Record<string, number>;
  used: Set<string>;
  lastEvent?: BombPartyView["lastEvent"];
  round: number;
  over: boolean;
  winnerId: string | null;
}

const randomFuse = (now: number) =>
  now + MIN_FUSE_MS + Math.floor(Math.random() * (MAX_FUSE_MS - MIN_FUSE_MS));

function nextAlive(order: string[], current: string): string {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length];
}

export const bombParty: GameEngine<BombState> = {
  init(players: Player[], now: number, opts: InitOptions): BombState {
    const language: Language = opts.language;
    preload(language);
    const order = players.map((p) => p.id);
    const lives: Record<string, number> = {};
    for (const id of order) lives[id] = START_LIVES;
    return {
      language,
      order,
      current: order[0],
      prompt: randomPrompt(language),
      typed: "",
      deadline: randomFuse(now),
      fuseStart: now,
      lives,
      used: new Set(),
      round: 1,
      over: false,
      winnerId: null,
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

      // Valid! Bank the word, pass the (still-ticking) bomb onward.
      state.used.add(norm);
      state.lastEvent = { type: "valid", playerId, word, at: now };
      state.typed = "";
      state.current = nextAlive(state.order, state.current);
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
    state.prompt = randomPrompt(state.language);
    state.typed = "";
    state.fuseStart = now;
    state.deadline = randomFuse(now);
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
      state.prompt = randomPrompt(state.language);
      state.typed = "";
      state.fuseStart = now;
      state.deadline = randomFuse(now);
    }
    return true;
  },

  isOver: (state) => state.over,

  view(state): BombPartyView {
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
      startLives: START_LIVES,
      lastEvent: state.lastEvent,
      round: state.round,
      over: state.over,
      winnerId: state.winnerId,
    };
  },
};
