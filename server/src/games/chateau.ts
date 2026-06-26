// Château Combo - each player builds a personal tableau (growing outward from
// a first card, bounding box never exceeding 3×3) of cards bought from two
// shared markets (Château / Village). A Messenger pawn marks which market row
// is active; keys move it, and some cards move it themselves when resolved.
// Cards cost gold (minus per-deck discounts), fire an immediate effect when
// placed, and score at the end through combo formulas (shields, adjacency,
// purses, positions, deck sets…).
//
// Everything is public information - one shared view, no playerView needed.
// The game is untimed (tick is a no-op); turns advance on purchases.
//
// Auto-resolved choices (see shared/src/chateauCards.ts) keep the buy atomic:
// "chez 1 voisin au choix" → best opponent, "OU" → the better side,
// "l'une des 3 cartes au choix" → the most expensive of the row.

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
  CHATEAU_SHIELDS,
  CHATEAU_START,
  chateauCardById,
  type ChateauCard,
  type ChateauDeck,
  type ChateauScore,
  type ChateauShield,
} from "../../../shared/src/chateauCards.js";

const GRID = 9; // a full tableau holds nine cards

interface CHPlayer {
  gold: number;
  keys: number;
  discountCastle: number;
  discountVillage: number;
  cells: ChateauCell[]; // placed cards, in placement order
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

/* ── Tableau helpers (floating coordinate plane) ────────────────────────────── */

const cellAt = (p: CHPlayer, x: number, y: number): ChateauCell | null =>
  p.cells.find((c) => c.x === x && c.y === y) ?? null;

interface BBox { minX: number; maxX: number; minY: number; maxY: number; }
function bbox(p: CHPlayer): BBox {
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  let first = true;
  for (const c of p.cells) {
    if (first) { minX = maxX = c.x; minY = maxY = c.y; first = false; continue; }
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
  }
  return { minX, maxX, minY, maxY };
}

/** A placement is legal if empty, orthogonally adjacent (after the first card),
 *  and keeps the tableau's bounding box within 3×3. */
function validPlacement(p: CHPlayer, x: number, y: number): boolean {
  if (cellAt(p, x, y)) return false;
  if (p.placed === 0) return x === 0 && y === 0;
  const adjacent =
    cellAt(p, x - 1, y) || cellAt(p, x + 1, y) || cellAt(p, x, y - 1) || cellAt(p, x, y + 1);
  if (!adjacent) return false;
  const b = bbox(p);
  const minX = Math.min(b.minX, x), maxX = Math.max(b.maxX, x);
  const minY = Math.min(b.minY, y), maxY = Math.max(b.maxY, y);
  return maxX - minX <= 2 && maxY - minY <= 2;
}

/** Face-up cards in a tableau, with their cells. */
function faceUp(p: CHPlayer): { cell: ChateauCell; card: ChateauCard }[] {
  const out: { cell: ChateauCell; card: ChateauCard }[] = [];
  for (const cell of p.cells) {
    if (cell.cardId) out.push({ cell, card: chateauCardById(cell.cardId) });
  }
  return out;
}

const countShield = (p: CHPlayer, s: ChateauShield): number =>
  faceUp(p).reduce((sum, v) => sum + v.card.shields.filter((x) => x === s).length, 0);

const distinctCount = (p: CHPlayer): number =>
  CHATEAU_SHIELDS.filter((s) => countShield(p, s) > 0).length;

const deckCount = (p: CHPlayer, deck: ChateauDeck): number =>
  faceUp(p).filter((v) => v.card.deck === deck).length;

const purseCards = (p: CHPlayer) => p.cells.filter((c) => c.cardId && chateauCardById(c.cardId).purseMax != null);

const cardsWithShieldCount = (p: CHPlayer, count: number): number =>
  faceUp(p).filter((v) => v.card.shields.length === count).length;

const reductionCards = (p: CHPlayer): number =>
  faceUp(p).filter((v) => v.card.fx.some((f) => f.t === "discount")).length;

const costCount = (p: CHPlayer, c: number, min: boolean): number =>
  faceUp(p).filter((v) => (min ? v.card.cost >= c : v.card.cost === c)).length;

/* ── Immediate effects ────────────────────────────────────────────────────── */

function bestNeighborShield(s: CHState, pid: string, shield: ChateauShield): number {
  let best = 0;
  for (const id of s.order) {
    if (id === pid) continue;
    best = Math.max(best, countShield(s.players[id], shield));
  }
  return best;
}

function bestNeighborDeck(s: CHState, pid: string, deck: ChateauDeck): number {
  let best = 0;
  for (const id of s.order) {
    if (id === pid) continue;
    best = Math.max(best, deckCount(s.players[id], deck));
  }
  return best;
}

function addToPurses(p: CHPlayer, n: number) {
  for (const c of purseCards(p)) {
    const max = chateauCardById(c.cardId!).purseMax!;
    c.purse = Math.min(max, c.purse + n);
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
      case "goldPerDistinct": gold += fx.n * distinctCount(p); break;
      case "keysPerDistinct": keys += fx.n * distinctCount(p); break;
      case "keysPerAbsent": keys += fx.n * (CHATEAU_SHIELDS.length - distinctCount(p)); break;
      case "goldPerEmpty": gold += fx.n * (GRID - p.placed); break;
      case "goldPerOccupied": gold += fx.n * p.placed; break;
      case "goldPerCost": gold += fx.n * costCount(p, fx.c, false); break;
      case "goldPerDeckCard": gold += fx.n * deckCount(p, fx.deck); break;
      case "keysPerDeckCard": keys += fx.n * deckCount(p, fx.deck); break;
      case "perCardShield": {
        const cnt = cardsWithShieldCount(p, fx.count);
        if (fx.res === "gold") gold += fx.n * cnt; else keys += fx.n * cnt;
        break;
      }
      case "keysPerPurseCard": keys += fx.n * purseCards(p).length; break;
      case "discount":
        if (fx.scope === "both" || fx.scope === "castle") p.discountCastle += 1;
        if (fx.scope === "both" || fx.scope === "village") p.discountVillage += 1;
        break;
      case "purseAll": addToPurses(p, fx.n); break;
      case "fillPurses": {
        const open = purseCards(p)
          .map((c) => ({ c, room: chateauCardById(c.cardId!).purseMax! - c.purse }))
          .sort((a, b) => b.room - a.room)
          .slice(0, fx.n);
        for (const { c } of open) c.purse = chateauCardById(c.cardId!).purseMax!;
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
        for (const id of s.order) if (id !== pid) s.players[id].keys += fx.n;
        keys += fx.n; // self share, folded into the toast delta
        break;
      case "neighborGoldOrKeys": {
        const nb = bestNeighborShield(s, pid, fx.s);
        if (nb > fx.k) gold += nb; else keys += fx.k;
        break;
      }
      case "neighborKeysPerShield": keys += bestNeighborShield(s, pid, fx.s); break;
      case "neighborKeysPerDeckCard": keys += bestNeighborDeck(s, pid, fx.deck); break;
      case "neighborGoldOrKeysShield": {
        const g = bestNeighborShield(s, pid, fx.gs);
        const k = countShield(p, fx.ks);
        if (g >= k) gold += g; else keys += k;
        break;
      }
      case "marketTake": {
        const row = s.market[fx.deck];
        let idx = -1, bestCost = -1;
        for (let i = 0; i < row.length; i++) {
          const id = row[i];
          if (id && chateauCardById(id).cost > bestCost) { bestCost = chateauCardById(id).cost; idx = i; }
        }
        if (idx >= 0) {
          const taken = row[idx]!;
          if (fx.res === "gold") gold += chateauCardById(taken).cost;
          else keys += chateauCardById(taken).cost;
          s.discards[fx.deck].push(taken);
          row[idx] = draw(s, fx.deck);
        }
        break;
      }
    }
  }
  p.gold += gold;
  p.keys += keys;
  return { gold, keys };
}

/* ── End-game scoring ─────────────────────────────────────────────────────── */

function neighborCoords(cell: ChateauCell, dir: "h" | "v" | "o"): [number, number][] {
  const out: [number, number][] = [];
  if (dir !== "v") { out.push([cell.x - 1, cell.y], [cell.x + 1, cell.y]); }
  if (dir !== "h") { out.push([cell.x, cell.y - 1], [cell.x, cell.y + 1]); }
  return out;
}

function shieldsInDir(p: CHPlayer, cell: ChateauCell, dir: "h" | "v" | "o", s: ChateauShield): number {
  return neighborCoords(cell, dir).reduce((sum, [x, y]) => {
    const other = cellAt(p, x, y);
    if (!other?.cardId) return sum;
    return sum + chateauCardById(other.cardId).shields.filter((z) => z === s).length;
  }, 0);
}

function distinctInDir(p: CHPlayer, cell: ChateauCell, dir: "h" | "v" | "o"): number {
  const fam = new Set<ChateauShield>();
  for (const [x, y] of neighborCoords(cell, dir)) {
    const other = cellAt(p, x, y);
    if (other?.cardId) for (const s of chateauCardById(other.cardId).shields) fam.add(s);
  }
  return fam.size;
}

/** Distinct families among face-up cards sharing this card's row (axis "y") or
 *  column (axis "x"), including the card itself. */
function distinctInLine(p: CHPlayer, cell: ChateauCell, axis: "x" | "y"): number {
  const fam = new Set<ChateauShield>();
  for (const v of faceUp(p)) {
    if (v.cell[axis] === cell[axis]) for (const s of v.card.shields) fam.add(s);
  }
  return fam.size;
}

function scoreCard(p: CHPlayer, cell: ChateauCell, b: BBox): number {
  if (!cell.cardId) return 0; // face-down cards score nothing themselves
  const sc: ChateauScore = chateauCardById(cell.cardId).score;

  const r = cell.y - b.minY, c = cell.x - b.minX;
  const width = b.maxX - b.minX + 1, height = b.maxY - b.minY + 1;
  const atTop = r === 0, atBottom = r === height - 1, atRowMid = 2 * r === height - 1;
  const atLeft = c === 0, atRight = c === width - 1, atColMid = 2 * c === width - 1;

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
    case "perTripletAny":
      return sc.n * CHATEAU_SHIELDS.reduce((sum, s) => sum + Math.floor(countShield(p, s) / 3), 0);
    case "adj": return sc.n * shieldsInDir(p, cell, sc.dir, sc.s);
    case "distinctAdj": return sc.n * distinctInDir(p, cell, sc.dir);
    case "distinctRowShield": return sc.n * distinctInLine(p, cell, "y");
    case "distinctColShield": return sc.n * distinctInLine(p, cell, "x");
    case "perDistinctShield": return sc.n * distinctCount(p);
    case "perAbsentShield": return sc.n * (CHATEAU_SHIELDS.length - distinctCount(p));
    case "perMultiShieldCard": return sc.n * cardsWithShieldCount(p, 2);
    case "purse": return sc.per * Math.min(cell.purse, sc.max);
    case "totalPurse": return sc.n * purseCards(p).reduce((sum, c) => sum + c.purse, 0);
    case "perCost": return sc.n * costCount(p, sc.c, !!sc.min);
    case "perDeckCard": return sc.n * deckCount(p, sc.deck);
    case "perDeckPair": return sc.n * Math.min(deckCount(p, "castle"), deckCount(p, "village"));
    case "perDeckSet": return sc.n * Math.floor(deckCount(p, sc.deck) / sc.size);
    case "perReductionCard": return sc.n * reductionCards(p);
    case "faceDown": return p.cells.some((c) => c.faceDown) ? sc.n : 0;
    case "position": {
      let hit = false;
      switch (sc.where) {
        case "rowTop": hit = atTop; break;
        case "rowBottom": hit = atBottom; break;
        case "rowCenter": hit = atRowMid; break;
        case "colLeft": hit = atLeft; break;
        case "colRight": hit = atRight; break;
        case "colCenter": hit = atColMid; break;
        case "corners": hit = (atTop || atBottom) && (atLeft || atRight); break;
        case "plusCenters":
          hit = (atColMid && (atTop || atBottom)) || (atRowMid && (atLeft || atRight));
          break;
      }
      return hit ? sc.n : 0;
    }
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
    const b = bbox(p);
    const cells = p.cells.map((cell) => scoreCard(p, cell, b));
    const cardPts = cells.reduce<number>((sum, v) => sum + v, 0);
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

const flipMessenger = (s: CHState) => {
  s.messenger = s.messenger === "castle" ? "village" : "castle";
};

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
        discountCastle: 0,
        discountVillage: 0,
        cells: [],
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
      flipMessenger(state);
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
      if (a.index < 0 || a.index > 2 || !validPlacement(p, a.x, a.y)) return false;
      const deck = state.messenger;
      const cardId = state.market[deck][a.index];
      if (!cardId) return false;

      if (a.faceDown) {
        // Resource card: free, no shields, no effect - just gold and keys.
        state.market[deck][a.index] = null; // consumed before refill
        p.cells.push({ x: a.x, y: a.y, cardId: null, faceDown: true, purse: 0 });
        p.placed += 1;
        p.gold += CHATEAU_FACEDOWN.gold;
        p.keys += CHATEAU_FACEDOWN.keys;
        state.lastEvent = {
          playerId: pid,
          cardId: null,
          x: a.x,
          y: a.y,
          gold: CHATEAU_FACEDOWN.gold,
          keys: CHATEAU_FACEDOWN.keys,
          at: ctx.now,
        };
      } else {
        const card = chateauCardById(cardId);
        const discount = deck === "castle" ? p.discountCastle : p.discountVillage;
        const cost = Math.max(0, card.cost - discount);
        if (p.gold < cost) return false;
        p.gold -= cost;
        state.market[deck][a.index] = null;
        p.cells.push({ x: a.x, y: a.y, cardId, faceDown: false, purse: 0 });
        p.placed += 1;
        const gained = resolveFx(state, pid, card);
        // The Messenger moves at the very end of the card's resolution.
        if (card.switchMessenger) flipMessenger(state);
        state.lastEvent = {
          playerId: pid,
          cardId,
          x: a.x,
          y: a.y,
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
        discountCastle: state.players[id].discountCastle,
        discountVillage: state.players[id].discountVillage,
        cells: state.players[id].cells,
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
