// 6 Qui Prend (6 nimmt!) - a language-free card game. Cards 1–104 each carry
// "bull head" penalties. Every turn all players secretly pick a card; cards are
// then placed left-to-right in ascending order onto four rows. Lay the 6th card
// in a row and you scoop its 5 cards (their bulls). Play a card lower than every
// row and you must take a whole row of your choice. Fewest bulls wins.

import type { Player } from "../../../shared/src/types.js";
import {
  bullHeads,
  type GameAction,
  type SixPlayerPublic,
  type SixQuiPrendAction,
  type SixQuiPrendView,
  type SixTurnEntry,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine } from "./engine.js";

const HAND_SIZE = 10;
const ROWS = 4;
const ROW_LIMIT = 5; // a 6th card scoops the row

interface SixState {
  rows: number[][];
  hands: Record<string, number[]>;
  chosen: Record<string, number | null>;
  bulls: Record<string, number>;
  order: string[];
  phase: "choosing" | "takeRow" | "done";
  /** Cards still to resolve this turn, ascending. */
  queue: { pid: string; card: number }[];
  pending: { playerId: string; card: number } | null;
  lastTurn: SixTurnEntry[];
  /** Rows snapshot captured at the start of the current resolution (for replay). */
  lastStartRows: number[][];
  turn: number;
  totalTurns: number;
  over: boolean;
  winnerId: string | null;
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sumBulls = (cards: number[]) => cards.reduce((s, c) => s + bullHeads(c), 0);

/** Row whose tail is the highest value still below `card`, or -1 if none. */
function pickRow(rows: number[][], card: number): number {
  let best = -1;
  let bestTail = -1;
  rows.forEach((r, i) => {
    const tail = r[r.length - 1];
    if (tail < card && tail > bestTail) {
      bestTail = tail;
      best = i;
    }
  });
  return best;
}

export const sixQuiPrend: GameEngine<SixState> = {
  init(players: Player[]): SixState {
    const deck = shuffled(104);
    const order = players.map((p) => p.id);
    const hands: Record<string, number[]> = {};
    const chosen: Record<string, number | null> = {};
    const bulls: Record<string, number> = {};
    for (const id of order) {
      hands[id] = deck.splice(0, HAND_SIZE).sort((a, b) => a - b);
      chosen[id] = null;
      bulls[id] = 0;
    }
    const rows = Array.from({ length: ROWS }, () => [deck.pop()!]);
    return {
      rows,
      hands,
      chosen,
      bulls,
      order,
      phase: "choosing",
      queue: [],
      pending: null,
      lastTurn: [],
      lastStartRows: [],
      turn: 1,
      totalTurns: HAND_SIZE,
      over: false,
      winnerId: null,
    };
  },

  action(state, playerId, action: GameAction, _ctx: ActionContext): boolean {
    if (state.over) return false;
    const a = action as SixQuiPrendAction;

    if (a.type === "choose") {
      if (state.phase !== "choosing") return false;
      if (!state.order.includes(playerId)) return false;
      if (!state.hands[playerId]?.includes(a.card)) return false;
      state.chosen[playerId] = a.card;
      if (state.order.every((id) => state.chosen[id] != null)) beginResolve(state);
      return true;
    }

    if (a.type === "unchoose") {
      // Take a tentatively-played card back into the hand - only possible while
      // still choosing (once everyone has locked in, resolution has begun).
      if (state.phase !== "choosing") return false;
      if (state.chosen[playerId] == null) return false;
      state.chosen[playerId] = null;
      return true;
    }

    if (a.type === "takeRow") {
      if (state.phase !== "takeRow" || state.pending?.playerId !== playerId) return false;
      if (a.rowIndex < 0 || a.rowIndex >= state.rows.length) return false;
      takeRow(state, playerId, a.rowIndex, state.pending.card);
      state.pending = null;
      resolveQueue(state);
      return true;
    }

    return false;
  },

  tick: () => false,

  onLeave(state, playerId): boolean {
    if (state.over) return false;
    if (!state.order.includes(playerId)) return false;

    // If the player who owed a row choice leaves, auto-take the cheapest row.
    if (state.phase === "takeRow" && state.pending?.playerId === playerId) {
      const cheapest = state.rows
        .map((r, i) => ({ i, b: sumBulls(r) }))
        .sort((x, y) => x.b - y.b)[0].i;
      takeRow(state, playerId, cheapest, state.pending.card);
      state.pending = null;
    }

    state.order = state.order.filter((id) => id !== playerId);
    delete state.hands[playerId];
    delete state.chosen[playerId];

    if (state.order.length === 0) {
      state.over = true;
      return true;
    }
    // Their pending pick (if any) is dropped from the queue.
    state.queue = state.queue.filter((q) => q.pid !== playerId);

    if (state.phase === "takeRow") {
      resolveQueue(state);
    } else if (state.phase === "choosing" && state.order.every((id) => state.chosen[id] != null)) {
      beginResolve(state);
    }
    return true;
  },

  isOver: (state) => state.over,

  view: (state) => publicView(state, null),
  playerView: (state, playerId) => publicView(state, playerId),
};

/* ── internals ─────────────────────────────────────────────────────────────── */

function beginResolve(state: SixState) {
  // Snapshot the table before any card lands - the client replays from here.
  state.lastStartRows = state.rows.map((r) => [...r]);
  state.queue = state.order
    .map((pid) => ({ pid, card: state.chosen[pid]! }))
    .sort((x, y) => x.card - y.card);
  // Remove chosen cards from hands, clear selections.
  for (const { pid, card } of state.queue) {
    state.hands[pid] = state.hands[pid].filter((c) => c !== card);
  }
  for (const id of state.order) state.chosen[id] = null;
  state.lastTurn = [];
  resolveQueue(state);
}

function resolveQueue(state: SixState) {
  while (state.queue.length) {
    const { pid, card } = state.queue[0];
    const target = pickRow(state.rows, card);
    if (target === -1) {
      // Lower than every row → this player must choose a row to take.
      state.queue.shift();
      state.pending = { playerId: pid, card };
      state.phase = "takeRow";
      return;
    }
    state.queue.shift();
    const row = state.rows[target];
    if (row.length >= ROW_LIMIT) {
      const gained = sumBulls(row);
      state.bulls[pid] += gained;
      state.rows[target] = [card];
      state.lastTurn.push({ playerId: pid, card, rowIndex: target, tookRow: true, gained });
    } else {
      row.push(card);
      state.lastTurn.push({ playerId: pid, card, rowIndex: target, tookRow: false, gained: 0 });
    }
  }
  endTurn(state);
}

function takeRow(state: SixState, pid: string, rowIndex: number, card: number) {
  const gained = sumBulls(state.rows[rowIndex]);
  state.bulls[pid] += gained;
  state.rows[rowIndex] = [card];
  state.lastTurn.push({ playerId: pid, card, rowIndex, tookRow: true, gained });
}

function endTurn(state: SixState) {
  const empty = state.order.every((id) => (state.hands[id]?.length ?? 0) === 0);
  if (empty || state.turn >= state.totalTurns) {
    state.over = true;
    state.phase = "done";
    state.winnerId =
      state.order.length > 0
        ? [...state.order].sort((a, b) => state.bulls[a] - state.bulls[b])[0]
        : null;
    return;
  }
  state.turn += 1;
  state.phase = "choosing";
  state.pending = null;
}

function publicView(state: SixState, viewer: string | null): SixQuiPrendView {
  const players: SixPlayerPublic[] = state.order.map((id) => ({
    id,
    bulls: state.bulls[id] ?? 0,
    handCount: state.hands[id]?.length ?? 0,
    hasChosen: state.chosen[id] != null,
  }));
  return {
    kind: "sixquiprend",
    phase: state.phase,
    rows: state.rows,
    turn: state.turn,
    totalTurns: state.totalTurns,
    players,
    hand: viewer ? [...(state.hands[viewer] ?? [])] : [],
    youChose: viewer ? state.chosen[viewer] != null : false,
    youChoseCard: viewer ? state.chosen[viewer] ?? null : null,
    pendingPlayerId: state.pending?.playerId ?? null,
    lastTurn: state.lastTurn.length ? state.lastTurn : undefined,
    lastStartRows: state.lastStartRows.length ? state.lastStartRows : undefined,
    over: state.over,
    winnerId: state.winnerId,
  };
}
