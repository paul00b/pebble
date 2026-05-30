// Petit Bac — the simultaneous-round game. A letter + fixed categories; everyone
// races to fill an answer for each that starts with the letter. A round ends on
// the timer or when someone slams "Stop!". Scoring is automatic: a valid answer
// scores 2 if no one else gave the same one, 1 if shared, 0 if blank/wrong.

import type { Player } from "../../../shared/src/types.js";
import type {
  GameAction,
  Language,
  PetitBacAction,
  PetitBacCell,
  PetitBacStage,
  PetitBacView,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";
import { normalize } from "./dictionary.js";

const WRITE_MS = 100_000;
const TOTAL_ROUNDS = 4;
// Skip awkward letters (K, Q, W, X, Y, Z) so every round is playable.
const LETTERS = "ABCDEFGHILMNOPRSTUV";
const CATEGORIES: Record<Language, string[]> = {
  fr: ["Pays", "Ville", "Animal", "Prénom", "Métier", "Fruit ou légume"],
  en: ["Country", "City", "Animal", "First name", "Job", "Fruit or vegetable"],
};

interface PBState {
  letter: string;
  categories: string[];
  round: number;
  totalRounds: number;
  stage: PetitBacStage;
  deadline: number;
  players: string[]; // participating player ids
  answers: Record<string, string[]>; // playerId -> answer per category
  submitted: Set<string>;
  stoppedBy: string | null;
  scores: Record<string, number>;
  reveal?: PetitBacCell[][];
  roundScores?: Record<string, number>;
  over: boolean;
}

const randomLetter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)];

function beginRound(state: PBState, round: number, now: number) {
  state.round = round;
  state.letter = randomLetter();
  state.stage = "writing";
  state.deadline = now + WRITE_MS;
  state.answers = {};
  state.submitted = new Set();
  state.stoppedBy = null;
  state.reveal = undefined;
  state.roundScores = undefined;
}

function endWriting(state: PBState) {
  const letter = state.letter.toLowerCase();
  const reveal: PetitBacCell[][] = [];
  const roundScores: Record<string, number> = {};
  for (const id of state.players) roundScores[id] = 0;

  state.categories.forEach((_cat, c) => {
    // First pass: validity per player for this category.
    const rows = state.players.map((id) => {
      const answer = (state.answers[id]?.[c] ?? "").trim();
      const norm = normalize(answer);
      const valid = norm.length > 0 && norm.startsWith(letter);
      return { id, answer, norm, valid };
    });

    // Count occurrences of each valid normalized answer for uniqueness.
    const counts = new Map<string, number>();
    for (const r of rows) if (r.valid) counts.set(r.norm, (counts.get(r.norm) ?? 0) + 1);

    const cells: PetitBacCell[] = rows.map((r) => {
      const unique = r.valid && counts.get(r.norm) === 1;
      const points = r.valid ? (unique ? 2 : 1) : 0;
      roundScores[r.id] += points;
      return {
        playerId: r.id,
        answer: r.answer,
        points,
        valid: r.valid,
        unique,
      };
    });
    reveal.push(cells);
  });

  for (const id of state.players) state.scores[id] += roundScores[id];
  state.reveal = reveal;
  state.roundScores = roundScores;
  state.stage = "reveal";
}

export const petitBac: GameEngine<PBState> = {
  init(players: Player[], now: number, opts: InitOptions): PBState {
    const ids = players.map((p) => p.id);
    const scores: Record<string, number> = {};
    for (const id of ids) scores[id] = 0;
    const state: PBState = {
      letter: "",
      categories: CATEGORIES[opts.language],
      round: 0,
      totalRounds: TOTAL_ROUNDS,
      stage: "writing",
      deadline: 0,
      players: ids,
      answers: {},
      submitted: new Set(),
      stoppedBy: null,
      scores,
      over: false,
    };
    beginRound(state, 1, now);
    return state;
  },

  action(state, playerId, action: GameAction, ctx: ActionContext): boolean {
    if (state.over) return false;
    const a = action as PetitBacAction;

    if (a.type === "submit") {
      if (state.stage !== "writing") return false;
      state.answers[playerId] = a.answers
        .slice(0, state.categories.length)
        .map((s) => String(s).slice(0, 40));
      state.submitted.add(playerId);
      // Everyone locked in → reveal early.
      if (state.players.every((id) => state.submitted.has(id))) endWriting(state);
      return true;
    }

    if (a.type === "stop") {
      if (state.stage !== "writing") return false;
      state.stoppedBy = playerId;
      endWriting(state);
      return true;
    }

    if (a.type === "next") {
      if (state.stage !== "reveal" || !ctx.isHost) return false;
      if (state.round >= state.totalRounds) {
        state.stage = "done";
        state.over = true;
      } else {
        beginRound(state, state.round + 1, ctx.now);
      }
      return true;
    }

    return false;
  },

  tick(state, now): boolean {
    if (state.over) return false;
    if (state.stage === "writing" && now >= state.deadline) {
      endWriting(state);
      return true;
    }
    return false;
  },

  onLeave(state, playerId): boolean {
    if (state.over) return false;
    const i = state.players.indexOf(playerId);
    if (i < 0) return false;
    state.players.splice(i, 1);
    state.submitted.delete(playerId);
    delete state.answers[playerId];
    if (state.players.length === 0) {
      state.over = true;
      return true;
    }
    // If the leaver was the last holdout, the round can resolve now.
    if (state.stage === "writing" && state.players.every((id) => state.submitted.has(id))) {
      endWriting(state);
    }
    return true;
  },

  isOver: (state) => state.over,

  view(state): PetitBacView {
    return {
      kind: "petitbac",
      stage: state.stage,
      letter: state.letter,
      categories: state.categories,
      round: state.round,
      totalRounds: state.totalRounds,
      deadline: state.deadline,
      finishedCount: state.submitted.size,
      totalPlayers: state.players.length,
      stoppedBy: state.stoppedBy,
      reveal: state.reveal,
      roundScores: state.roundScores,
      scores: state.scores,
      over: state.over,
    };
  },
};
