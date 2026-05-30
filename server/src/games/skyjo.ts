// Skyjo — keep your 3×4 grid as low as possible. Each turn: draw from the deck
// (then keep-and-replace, or discard-and-flip) or take the discard (and replace).
// Three equal face-up cards in a column clear it. When someone reveals their
// whole grid the round ends after everyone's last turn; lowest total wins, and
// the player who ended it gets doubled if they aren't strictly lowest.

import type { Player } from "../../../shared/src/types.js";
import type {
  GameAction,
  SkyjoAction,
  SkyjoCell,
  SkyjoPlayerPublic,
  SkyjoView,
} from "../../../shared/src/games.js";
import type { GameEngine } from "./engine.js";

const COLS = 4;
const ROWS = 3;
const SIZE = COLS * ROWS; // 12

interface Cell {
  value: number;
  up: boolean;
  gone: boolean; // cleared column
}

interface SkyjoState {
  deck: number[];
  discard: number[];
  grids: Record<string, Cell[]>;
  order: string[];
  phase: "flip2" | "turn" | "done";
  currentId: string;
  stage: "await" | "resolveDraw";
  held: number | null;
  closerId: string | null;
  finalScores: Record<string, number> | null;
  winnerId: string | null;
}

function buildDeck(): number[] {
  const deck: number[] = [];
  const add = (v: number, n: number) => {
    for (let i = 0; i < n; i++) deck.push(v);
  };
  add(-2, 5);
  add(-1, 10);
  add(0, 15);
  for (let v = 1; v <= 12; v++) add(v, 10);
  shuffle(deck);
  return deck;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const live = (cells: Cell[]) => cells.filter((c) => !c.gone);

function draw(state: SkyjoState): number {
  if (state.deck.length === 0) {
    const top = state.discard.pop();
    state.deck = shuffle(state.discard);
    state.discard = top != null ? [top] : [];
  }
  return state.deck.pop()!;
}

export const skyjo: GameEngine<SkyjoState> = {
  init(players: Player[]): SkyjoState {
    const deck = buildDeck();
    const grids: Record<string, Cell[]> = {};
    for (const p of players) {
      grids[p.id] = deck.splice(0, SIZE).map((value) => ({ value, up: false, gone: false }));
    }
    return {
      deck,
      discard: [deck.pop()!],
      grids,
      order: players.map((p) => p.id),
      phase: "flip2",
      currentId: players[0].id,
      stage: "await",
      held: null,
      closerId: null,
      finalScores: null,
      winnerId: null,
    };
  },

  action(state, pid, action: GameAction): boolean {
    if (state.phase === "done") return false;
    const a = action as SkyjoAction;
    const grid = state.grids[pid];
    if (!grid) return false;

    // Setup: everyone flips two of their own cards.
    if (state.phase === "flip2") {
      if (a.type !== "flip") return false;
      const cell = grid[a.index];
      const upCount = grid.filter((c) => c.up && !c.gone).length;
      if (!cell || cell.gone || cell.up || upCount >= 2) return false;
      cell.up = true;
      // Once all players have flipped two, the highest pair starts.
      if (state.order.every((id) => state.grids[id].filter((c) => c.up && !c.gone).length >= 2)) {
        const sum = (id: string) =>
          state.grids[id].filter((c) => c.up).reduce((s, c) => s + c.value, 0);
        state.currentId = [...state.order].sort((x, y) => sum(y) - sum(x))[0];
        state.phase = "turn";
        state.stage = "await";
      }
      return true;
    }

    // Turns: only the current player acts.
    if (pid !== state.currentId) return false;

    if (state.stage === "await") {
      if (a.type === "drawDeck") {
        state.held = draw(state);
        state.stage = "resolveDraw";
        return true;
      }
      if (a.type === "takeDiscard") {
        if (state.discard.length === 0) return false;
        const cell = grid[a.index];
        if (!cell || cell.gone) return false;
        const card = state.discard.pop()!;
        replaceCell(state, grid, a.index, card);
        resolveTurn(state, pid);
        return true;
      }
      return false;
    }

    if (state.stage === "resolveDraw" && state.held != null) {
      if (a.type === "keepReplace") {
        const cell = grid[a.index];
        if (!cell || cell.gone) return false;
        replaceCell(state, grid, a.index, state.held);
        state.held = null;
        state.stage = "await";
        resolveTurn(state, pid);
        return true;
      }
      if (a.type === "discardFlip") {
        const faceDown = grid.filter((c) => !c.gone && !c.up);
        state.discard.push(state.held);
        state.held = null;
        if (faceDown.length > 0) {
          const cell = grid[a.index];
          if (!cell || cell.gone || cell.up) return false;
          cell.up = true;
        }
        state.stage = "await";
        resolveTurn(state, pid);
        return true;
      }
    }
    return false;
  },

  tick: () => false,

  onLeave(state, pid): boolean {
    if (!state.grids[pid]) return false;
    const wasCurrent = state.currentId === pid;
    delete state.grids[pid];
    state.order = state.order.filter((id) => id !== pid);
    if (state.closerId === pid) state.closerId = null;
    if (state.order.length === 0) {
      state.phase = "done";
      return true;
    }
    if (state.phase === "turn" && wasCurrent) {
      state.held = null;
      state.stage = "await";
      state.currentId = state.order[0];
    } else if (state.phase === "flip2") {
      if (state.order.every((id) => state.grids[id].filter((c) => c.up && !c.gone).length >= 2)) {
        state.phase = "turn";
        state.currentId = state.order[0];
      }
    }
    return true;
  },

  isOver: (state) => state.phase === "done",

  view: (state) => skyjoView(state),
};

/* ── internals ─────────────────────────────────────────────────────────────── */

function replaceCell(state: SkyjoState, grid: Cell[], index: number, card: number) {
  const cell = grid[index];
  state.discard.push(cell.value); // old card to discard (revealed)
  cell.value = card;
  cell.up = true;
}

function clearColumns(grid: Cell[]) {
  for (let col = 0; col < COLS; col++) {
    const idx = [col, col + COLS, col + 2 * COLS];
    const cells = idx.map((i) => grid[i]);
    if (cells.every((c) => !c.gone && c.up) && cells[0].value === cells[1].value && cells[1].value === cells[2].value) {
      for (const c of cells) c.gone = true;
    }
  }
}

const isComplete = (grid: Cell[]) => live(grid).every((c) => c.up);

function resolveTurn(state: SkyjoState, pid: string) {
  clearColumns(state.grids[pid]);
  if (state.closerId === null && isComplete(state.grids[pid])) state.closerId = pid;

  const i = state.order.indexOf(pid);
  const nextId = state.order[(i + 1) % state.order.length];
  if (state.closerId !== null && nextId === state.closerId) {
    endRound(state);
    return;
  }
  state.currentId = nextId;
  state.stage = "await";
}

function endRound(state: SkyjoState) {
  // Reveal everything and tally.
  const raw: Record<string, number> = {};
  for (const id of state.order) {
    const grid = state.grids[id];
    for (const c of grid) if (!c.gone) c.up = true;
    raw[id] = live(grid).reduce((s, c) => s + c.value, 0);
  }
  // Closer penalty: doubled unless strictly the lowest.
  const scores = { ...raw };
  if (state.closerId && state.order.length > 1) {
    const closerScore = raw[state.closerId];
    const strictlyLowest = state.order
      .filter((id) => id !== state.closerId)
      .every((id) => closerScore < raw[id]);
    if (!strictlyLowest) scores[state.closerId] = closerScore * 2;
  }
  state.finalScores = scores;
  state.winnerId = [...state.order].sort((a, b) => scores[a] - scores[b])[0] ?? null;
  state.phase = "done";
}

function skyjoView(state: SkyjoState): SkyjoView {
  const players: SkyjoPlayerPublic[] = state.order.map((id) => {
    const grid = state.grids[id];
    const cells: SkyjoCell[] = grid.map((c) =>
      c.gone ? null : { up: c.up, value: c.up ? c.value : null }
    );
    const score = grid.filter((c) => !c.gone && c.up).reduce((s, c) => s + c.value, 0);
    return { id, grid: cells, score, complete: isComplete(grid) };
  });
  return {
    kind: "skyjo",
    phase: state.phase,
    players,
    currentId: state.currentId,
    stage: state.stage,
    held: state.held,
    discardTop: state.discard.length ? state.discard[state.discard.length - 1] : null,
    deckCount: state.deck.length,
    closerId: state.closerId,
    finalScores: state.finalScores ?? undefined,
    over: state.phase === "done",
    winnerId: state.winnerId,
  };
}
