// Gartic — one player draws a secret word while everyone races to guess it in
// the chat. Faster guesses score more; the drawer earns a bonus per correct
// guesser. Drawing pixels travel on a separate real-time channel (draw ops),
// kept out of the heavy room snapshot.

import type { Player } from "../../../shared/src/types.js";
import type {
  DrawOp,
  GameAction,
  GarticAction,
  GarticChoice,
  GarticMessage,
  GarticView,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";
import { normalize } from "./dictionary.js";
import { randomWord, wordChoices } from "./garticWords.js";

const DRAW_MS = 80_000;
const CHOOSE_MS = 15_000; // the drawer's window to pick one of two words
const DRAWER_BONUS = 20;
const MAX_OPS = 6000;
const MAX_MESSAGES = 40;

interface GarticState {
  language: InitOptions["language"];
  order: string[];
  phase: "choosing" | "drawing" | "reveal" | "done";
  drawerIndex: number;
  round: number;
  totalRounds: number;
  word: string;
  choices: GarticChoice[];
  deadline: number;
  scores: Record<string, number>;
  guessed: Set<string>;
  messages: GarticMessage[];
  ops: DrawOp[];
  over: boolean;
  winnerId: string | null;
}

let msgSeq = 0;

const drawerId = (s: GarticState) => s.order[s.drawerIndex % s.order.length];
const mask = (word: string) => word.replace(/[^\s]/g, "_");

function nonDrawers(s: GarticState): string[] {
  const d = drawerId(s);
  return s.order.filter((id) => id !== d);
}

/** Open a fresh turn in the "choosing" phase: the drawer gets two word options
 *  and 15s to pick one (else the turn passes on, see {@link advanceTurn}). */
function beginRound(s: GarticState, now: number) {
  s.word = "";
  s.choices = wordChoices(s.language);
  s.deadline = now + CHOOSE_MS;
  s.guessed = new Set();
  s.messages = [];
  s.ops = [];
  s.phase = "choosing";
}

/** Move to the next drawer, or end the game after a full lap. Used both by the
 *  host's "next" and by an automatic skip when a drawer doesn't pick in time. */
function advanceTurn(s: GarticState, now: number) {
  if (s.round >= s.totalRounds) {
    s.phase = "done";
    s.over = true;
    s.winnerId =
      [...s.order].sort((x, y) => (s.scores[y] ?? 0) - (s.scores[x] ?? 0))[0] ?? null;
  } else {
    s.round += 1;
    s.drawerIndex = (s.drawerIndex + 1) % s.order.length;
    beginRound(s, now);
  }
}

export const gartic: GameEngine<GarticState> = {
  init(players: Player[], now: number, opts: InitOptions): GarticState {
    const order = players.map((p) => p.id);
    const scores: Record<string, number> = {};
    for (const id of order) scores[id] = 0;
    const s: GarticState = {
      language: opts.language,
      order,
      phase: "drawing",
      drawerIndex: 0,
      round: 1,
      totalRounds: order.length, // one lap: everyone draws once
      word: "",
      choices: [],
      deadline: 0,
      scores,
      guessed: new Set(),
      messages: [],
      ops: [],
      over: false,
      winnerId: null,
    };
    beginRound(s, now);
    return s;
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    if (state.over) return false;
    const a = action as GarticAction;

    if (a.type === "choose") {
      if (state.phase !== "choosing" || pid !== drawerId(state)) return false;
      const choice = state.choices[a.index];
      if (!choice) return false;
      state.word = choice.word;
      state.choices = [];
      state.deadline = ctx.now + DRAW_MS;
      state.phase = "drawing";
      return true;
    }

    if (a.type === "guess") {
      if (state.phase !== "drawing") return false;
      if (pid === drawerId(state) || state.guessed.has(pid)) return false;
      const text = String(a.text).trim().slice(0, 60);
      if (!text) return false;

      const correct = normalize(text) === normalize(state.word);
      if (correct) {
        state.guessed.add(pid);
        const left = Math.max(0, state.deadline - ctx.now);
        const pts = Math.max(10, Math.round((left / DRAW_MS) * 100));
        state.scores[pid] = (state.scores[pid] ?? 0) + pts;
        state.scores[drawerId(state)] = (state.scores[drawerId(state)] ?? 0) + DRAWER_BONUS;
        push(state, { playerId: pid, text: "", correct: true });
        // Everyone (besides the drawer) has it → end early.
        if (nonDrawers(state).every((id) => state.guessed.has(id))) state.phase = "reveal";
      } else {
        push(state, { playerId: pid, text, correct: false });
      }
      return true;
    }

    if (a.type === "next") {
      if (state.phase !== "reveal" || !ctx.isHost) return false;
      advanceTurn(state, ctx.now);
      return true;
    }
    return false;
  },

  tick(state, now): boolean {
    if (state.over) return false;
    // The drawer dawdled past the 15s pick window — skip to the next player.
    if (state.phase === "choosing" && now >= state.deadline) {
      advanceTurn(state, now);
      return true;
    }
    if (state.phase === "drawing" && now >= state.deadline) {
      state.phase = "reveal";
      return true;
    }
    return false;
  },

  onLeave(state, pid): boolean {
    const i = state.order.indexOf(pid);
    if (i < 0) return false;
    const wasDrawer = pid === drawerId(state);
    state.order.splice(i, 1);
    state.guessed.delete(pid);
    if (i < state.drawerIndex) state.drawerIndex -= 1;
    if (state.order.length === 0) {
      state.over = true;
      state.phase = "done";
      return true;
    }
    state.drawerIndex %= state.order.length;
    // If the drawer bailed mid-round, jump to the reveal so the host can move on.
    if (wasDrawer && (state.phase === "drawing" || state.phase === "choosing")) {
      if (!state.word) state.word = state.choices[0]?.word ?? ""; // show something at reveal
      state.choices = [];
      state.phase = "reveal";
    }
    return true;
  },

  isOver: (state) => state.over,

  // Drawing side-channel (kept out of the broadcast view).
  drawOps: (state) => state.ops,
  applyDrawOp(state, pid, op: DrawOp): boolean {
    if (state.phase !== "drawing" || pid !== drawerId(state)) return false;
    if (op.t === "clear") state.ops = [];
    else if (state.ops.length < MAX_OPS) state.ops.push(op);
    return true;
  },

  view: (state) => garticView(state, null),
  playerView: (state, pid) => garticView(state, pid),
};

function push(state: GarticState, m: Omit<GarticMessage, "id" | "name">) {
  state.messages.push({ id: `m${msgSeq++}`, name: "", ...m });
  if (state.messages.length > MAX_MESSAGES)
    state.messages.splice(0, state.messages.length - MAX_MESSAGES);
}

function garticView(state: GarticState, viewer: string | null): GarticView {
  const d = drawerId(state);
  const showWord = viewer === d || state.phase !== "drawing";
  const isDrawer = viewer === d;
  return {
    kind: "gartic",
    phase: state.phase,
    drawerId: d,
    round: state.round,
    totalRounds: state.totalRounds,
    deadline: state.deadline,
    duration: state.phase === "choosing" ? CHOOSE_MS : DRAW_MS,
    word: showWord ? state.word : mask(state.word),
    wordMasked: !showWord,
    choices: isDrawer && state.phase === "choosing" ? state.choices : [],
    players: state.order.map((id) => ({
      id,
      score: state.scores[id] ?? 0,
      guessed: state.guessed.has(id),
    })),
    messages: state.messages,
    youAreDrawer: viewer === d,
    youGuessed: viewer ? state.guessed.has(viewer) : false,
    over: state.over,
    winnerId: state.winnerId,
  };
}
