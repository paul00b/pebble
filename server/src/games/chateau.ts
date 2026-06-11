// Château Combo - each player builds a personal 3×3 grid of cards bought from
// two shared markets (Château / Village). A Messenger pawn marks which market
// row is active; keys move it or refresh it. Cards cost gold (minus banner
// discounts), fire an immediate effect when placed, and score at the end
// through combo formulas (shields, adjacency, purses, full rows...).
//
// Everything is public information - one shared view, no playerView needed.
// The game is untimed (tick is a no-op); turns advance on purchases.
//
// Interpretations of spec-flagged uncertainties are documented in
// shared/src/chateauCards.ts next to the card data.

import type { Player } from "../../../shared/src/types.js";
import type {
  ChateauAction,
  ChateauCell,
  ChateauPlayerScore,
  ChateauView,
  GameAction,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";
import {
  CHATEAU_CARDS,
  CHATEAU_FACEDOWN,
  CHATEAU_START,
  chateauCardById,
  type ChateauCard,
  type ChateauDeck,
  type ChateauScore,
  type ChateauShield,
} from "../../../shared/src/chateauCards.js";

const GRID = 9;

interface CHPlayer {
  gold: number;
  keys: number;
  banners: number;
  grid: (ChateauCell | null)[];
  placed: number;
}

interface CHState {
  phase: "playing" | "over";
  order: string[];
  players: Record<string, CHPlayer>;
  turnIdx: number;
  messenger: ChateauDeck;
  decks: Record<ChateauDeck, string[]>;
  discards: Record<ChateauDeck, string[]>;
  market: Record<ChateauDeck, (string | null)[]>;
  lastEvent: ChateauView["lastEvent"];
  scores: Record<string, ChateauPlayerScore> | null;
  winnerId: string | null;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function draw(s: CHState, deck: ChateauDeck): string | null {
  if (s.decks[deck].length === 0 && s.discards[deck].length > 0) {
    s.decks[deck] = shuffle(s.discards[deck]);
    s.discards[deck] = [];
  }
  return s.decks[deck].pop() ?? null;
}

const currentId = (s: CHState) => s.order[s.turnIdx];

/* ── Grid helpers ─────────────────────────────────────────────────────────── */

const row = (cell: number) => Math.floor(cell / 3);
const col = (cell: number) => cell % 3;

function neighbors(cell: number, dir: "h" | "v" | "o"): number[] {
  const out: number[] = [];
  if (dir !== "v") {
    if (col(cell) > 0) out.push(cell - 1);
    if (col(cell) < 2) out.push(cell + 1);
  }
  if (dir !== "h") {
    if (row(cell) > 0) out.push(cell - 3);
    if (row(cell) < 2) out.push(cell + 3);
  }
  return out;
}

function validPlacement(p: CHPlayer, cell: number): boolean {
  if (cell < 0 || cell >= GRID || p.grid[cell] !== null) return false;
  if (p.placed === 0) return true;
  return neighbors(cell, "o").some((n) => p.grid[n] !== null);
}

/** Face-up cards in a grid, with their cells. */
function visible(p: CHPlayer): { cell: number; card: ChateauCard; slot: ChateauCell }[] {
  const out: { cell: number; card: ChateauCard; slot: ChateauCell }[] = [];
  p.grid.forEach((slot, cell) => {
    if (slot?.cardId) out.push({ cell, card: chateauCardById(slot.cardId), slot });
  });
  return out;
}

/** Total shield instances of a kind across a player's face-up cards. */
function countShield(p: CHPlayer, s: ChateauShield): number {
  return visible(p).reduce(
    (sum, v) => sum + v.card.shields.filter((x) => x === s).length,
    0
  );
}

/** Face-up purse-bearing cards. */
const purseCards = (p: CHPlayer) => visible(p).filter((v) => v.card.purseMax != null);

/* ── Immediate effects ────────────────────────────────────────────────────── */

/** Best opponent's shield count (for "chez 1 voisin" effects). */
function bestNeighborCount(s: CHState, pid: string, shield: ChateauShield): number {
  let best = 0;
  for (const id of s.order) {
    if (id === pid) continue;
    best = Math.max(best, countShield(s.players[id], shield));
  }
  return best;
}

function bestNeighborBanners(s: CHState, pid: string): number {
  let best = 0;
  for (const id of s.order) {
    if (id === pid) continue;
    best = Math.max(best, s.players[id].banners);
  }
  return best;
}

/** Priciest card on display in either market (the "carte X" reading). */
function topMarketCost(s: CHState): number {
  let best = 0;
  for (const deck of ["castle", "village"] as const) {
    for (const id of s.market[deck]) {
      if (id) best = Math.max(best, chateauCardById(id).cost);
    }
  }
  return best;
}

function addToPurses(p: CHPlayer, n: number) {
  for (const v of purseCards(p)) {
    v.slot.purse = Math.min(v.card.purseMax!, v.slot.purse + n);
  }
}

/** Resolve a card's immediate effects. Returns the buyer's gold/key delta for
 *  the event toast (purse gold and opponent gains aren't counted there). */
function resolveFx(s: CHState, pid: string, card: ChateauCard): { gold: number; keys: number } {
  const p = s.players[pid];
  let gold = 0;
  let keys = 0;
  for (const fx of card.fx) {
    switch (fx.t) {
      case "gold": gold += fx.n; break;
      case "keys": keys += fx.n; break;
      case "goldPerShield": gold += fx.n * countShield(p, fx.s); break;
      case "keysPerShield": keys += fx.n * countShield(p, fx.s); break;
      case "goldPerBanner": gold += p.banners; break;
      case "keysPerBanner": keys += p.banners; break;
      case "goldPerEmpty": gold += GRID - p.placed; break;
      case "goldPerOccupied": gold += p.placed; break;
      case "goldPerCost":
        gold += fx.n * visible(p).filter((v) => v.card.cost === fx.c).length;
        break;
      case "banner": p.banners += fx.n; break;
      case "purseAll": addToPurses(p, fx.n); break;
      case "fillPurses": {
        // Fill the n purses with the most room left.
        const open = purseCards(p)
          .map((v) => ({ v, room: v.card.purseMax! - v.slot.purse }))
          .sort((a, b) => b.room - a.room)
          .slice(0, fx.n);
        for (const { v } of open) v.slot.purse = v.card.purseMax!;
        break;
      }
      case "purseAllOrKeys":
        if (purseCards(p).length > 0) addToPurses(p, fx.n);
        else keys += fx.k;
        break;
      case "oppGold":
        for (const id of s.order) if (id !== pid) s.players[id].gold += fx.n;
        break;
      case "oppKeys":
        for (const id of s.order) if (id !== pid) s.players[id].keys += fx.n;
        break;
      case "allKeys":
        for (const id of s.order) s.players[id].keys += fx.n;
        break;
      case "neighborGoldOrKeys": {
        const n = bestNeighborCount(s, pid, fx.s);
        if (n > fx.k) gold += n;
        else keys += fx.k;
        break;
      }
      case "neighborKeys": keys += bestNeighborCount(s, pid, fx.s); break;
      case "neighborKeysBanners": keys += bestNeighborBanners(s, pid); break;
      case "marketCost":
        if (fx.res === "gold") gold += topMarketCost(s);
        else keys += topMarketCost(s);
        break;
      case "keysPerPurse": keys += purseCards(p).length; break;
    }
  }
  p.gold += gold;
  p.keys += keys;
  return { gold, keys };
}

/* ── End-game scoring ─────────────────────────────────────────────────────── */

function scoreCell(p: CHPlayer, cell: number): number {
  const slot = p.grid[cell];
  if (!slot?.cardId) return 0; // face-down cards score nothing themselves
  const card = chateauCardById(slot.cardId);
  const sc: ChateauScore = card.score;

  const shieldsInCells = (cells: number[], shield: ChateauShield) =>
    cells.reduce((sum, c) => {
      const other = p.grid[c];
      if (!other?.cardId) return sum;
      return sum + chateauCardById(other.cardId).shields.filter((x) => x === shield).length;
    }, 0);

  const cellsOfRow = [0, 1, 2].map((c) => row(cell) * 3 + c);
  const cellsOfCol = [0, 1, 2].map((r) => r * 3 + col(cell));

  switch (sc.t) {
    case "perShield": return sc.n * countShield(p, sc.s);
    case "absent": return countShield(p, sc.s) === 0 ? sc.n : 0;
    case "perKey": return sc.n * p.keys;
    case "perSet": {
      const need = new Map<ChateauShield, number>();
      for (const s of sc.set) need.set(s, (need.get(s) ?? 0) + 1);
      let sets = Infinity;
      for (const [s, n] of need) sets = Math.min(sets, Math.floor(countShield(p, s) / n));
      return Number.isFinite(sets) ? sc.n * sets : 0;
    }
    case "adj": return sc.n * shieldsInCells(neighbors(cell, sc.dir), sc.s);
    case "rowShield":
      return sc.n * shieldsInCells(cellsOfRow.filter((c) => c !== cell), sc.s);
    case "colShield":
      return sc.n * shieldsInCells(cellsOfCol.filter((c) => c !== cell), sc.s);
    case "perBanner": return sc.n * p.banners;
    case "perBannerSet": return sc.n * Math.floor(p.banners / sc.size);
    case "purse": return sc.per * Math.min(slot.purse, sc.max);
    case "perCost":
      return (
        sc.n *
        visible(p).filter((v) => (sc.min ? v.card.cost >= sc.c : v.card.cost === sc.c)).length
      );
    case "rowFull": return cellsOfRow.every((c) => p.grid[c] !== null) ? sc.n : 0;
    case "colFull": return cellsOfCol.every((c) => p.grid[c] !== null) ? sc.n : 0;
    case "square": {
      // Part of any fully-occupied 2×2 block?
      for (const tl of [0, 1, 3, 4]) {
        const block = [tl, tl + 1, tl + 3, tl + 4];
        if (block.includes(cell) && block.every((c) => p.grid[c] !== null)) return sc.n;
      }
      return 0;
    }
    case "faceDown": return p.grid.some((c) => c?.faceDown) ? sc.n : 0;
  }
}

function finalize(s: CHState) {
  s.phase = "over";
  s.scores = {};
  let bestId: string | null = null;
  let bestTotal = -Infinity;
  let bestGold = -Infinity;
  for (const id of s.order) {
    const p = s.players[id];
    const cells = p.grid.map((slot, cell) => (slot ? scoreCell(p, cell) : null));
    const cardPts = cells.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const keyPts = p.keys; // 1 leftover key = 1 point
    const total = cardPts + keyPts;
    s.scores[id] = { cells, cardPts, keyPts, total };
    // Ties break on leftover gold, then on seat order.
    if (total > bestTotal || (total === bestTotal && p.gold > bestGold)) {
      bestTotal = total;
      bestGold = p.gold;
      bestId = id;
    }
  }
  s.winnerId = bestId;
}

/* ── Turn flow ────────────────────────────────────────────────────────────── */

function advanceTurn(s: CHState) {
  if (s.order.every((id) => s.players[id].placed >= GRID)) {
    finalize(s);
    return;
  }
  do {
    s.turnIdx = (s.turnIdx + 1) % s.order.length;
  } while (s.players[currentId(s)].placed >= GRID);
  // Never strand a player on an exhausted row: flip the Messenger for free.
  if (s.market[s.messenger].every((c) => c === null)) {
    s.messenger = s.messenger === "castle" ? "village" : "castle";
  }
}

export const chateau: GameEngine<CHState> = {
  init(players: Player[], _now: number, _opts: InitOptions): CHState {
    const decks: Record<ChateauDeck, string[]> = {
      castle: shuffle(CHATEAU_CARDS.filter((c) => c.deck === "castle").map((c) => c.id)),
      village: shuffle(CHATEAU_CARDS.filter((c) => c.deck === "village").map((c) => c.id)),
    };
    const state: CHState = {
      phase: "playing",
      order: players.map((p) => p.id),
      players: {},
      turnIdx: 0,
      messenger: "village", // the Messenger starts on the Village side
      decks,
      discards: { castle: [], village: [] },
      market: { castle: [], village: [] },
      lastEvent: null,
      scores: null,
      winnerId: null,
    };
    for (const p of players) {
      state.players[p.id] = {
        gold: CHATEAU_START.gold,
        keys: CHATEAU_START.keys,
        banners: 0,
        grid: Array(GRID).fill(null),
        placed: 0,
      };
    }
    for (const deck of ["castle", "village"] as const) {
      state.market[deck] = [draw(state, deck), draw(state, deck), draw(state, deck)];
    }
    return state;
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    if (state.phase !== "playing" || pid !== currentId(state)) return false;
    const a = action as ChateauAction;
    const p = state.players[pid];

    if (a.type === "messenger") {
      if (p.keys < 1) return false;
      p.keys -= 1;
      state.messenger = state.messenger === "castle" ? "village" : "castle";
      return true;
    }

    if (a.type === "refresh") {
      if (p.keys < 1) return false;
      p.keys -= 1;
      const deck = state.messenger;
      for (const id of state.market[deck]) {
        if (id) state.discards[deck].push(id);
      }
      state.market[deck] = [draw(state, deck), draw(state, deck), draw(state, deck)];
      return true;
    }

    if (a.type === "buy") {
      if (a.index < 0 || a.index > 2 || !validPlacement(p, a.cell)) return false;
      const deck = state.messenger;
      const cardId = state.market[deck][a.index];
      if (!cardId) return false;

      if (a.faceDown) {
        // Resource card: free, no shields, no effect - just gold and keys.
        state.market[deck][a.index] = null; // consumed before refill
        p.grid[a.cell] = { cardId: null, faceDown: true, purse: 0 };
        p.placed += 1;
        p.gold += CHATEAU_FACEDOWN.gold;
        p.keys += CHATEAU_FACEDOWN.keys;
        state.lastEvent = {
          playerId: pid,
          cardId: null,
          cell: a.cell,
          gold: CHATEAU_FACEDOWN.gold,
          keys: CHATEAU_FACEDOWN.keys,
          at: ctx.now,
        };
      } else {
        const card = chateauCardById(cardId);
        const cost = Math.max(0, card.cost - p.banners);
        if (p.gold < cost) return false;
        p.gold -= cost;
        state.market[deck][a.index] = null;
        p.grid[a.cell] = { cardId, faceDown: false, purse: 0 };
        p.placed += 1;
        const gained = resolveFx(state, pid, card);
        state.lastEvent = {
          playerId: pid,
          cardId,
          cell: a.cell,
          gold: gained.gold,
          keys: gained.keys,
          at: ctx.now,
        };
      }

      state.market[deck][a.index] = draw(state, deck);
      advanceTurn(state);
      return true;
    }

    return false;
  },

  tick: () => false,

  onLeave(state, pid): boolean {
    const idx = state.order.indexOf(pid);
    if (idx === -1) return false;
    const wasCurrent = currentId(state) === pid;
    state.order.splice(idx, 1);
    delete state.players[pid];
    if (state.order.length === 0) {
      state.phase = "over";
      return true;
    }
    if (idx < state.turnIdx) state.turnIdx -= 1;
    state.turnIdx %= state.order.length;
    if (state.phase === "playing") {
      if (state.order.length === 1) {
        // Alone at the table - score what's built and call it.
        finalize(state);
      } else if (state.order.every((id) => state.players[id].placed >= GRID)) {
        finalize(state);
      } else if (wasCurrent && state.players[currentId(state)].placed >= GRID) {
        advanceTurn(state);
      }
    }
    return true;
  },

  isOver: (state) => state.phase === "over",

  view(state): ChateauView {
    return {
      kind: "chateau",
      phase: state.phase,
      players: state.order.map((id) => ({
        id,
        gold: state.players[id].gold,
        keys: state.players[id].keys,
        banners: state.players[id].banners,
        grid: state.players[id].grid,
        placed: state.players[id].placed,
      })),
      currentId: currentId(state) ?? "",
      messenger: state.messenger,
      market: state.market,
      deckCounts: {
        castle: state.decks.castle.length + state.discards.castle.length,
        village: state.decks.village.length + state.discards.village.length,
      },
      lastEvent: state.lastEvent,
      scores: state.scores,
      winnerId: state.winnerId,
      over: state.phase === "over",
    };
  },
};
