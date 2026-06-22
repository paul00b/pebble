// Uno — the classic shedding card game. Match the discard top by color, number
// or symbol; action cards skip, reverse, or force draws; wilds recolor the pile.
// First to empty their hand wins the round; play a single round or to a points
// target. House-rule toggles (stacking +2/+4, draw-to-match, force-play) live in
// the room settings. Hands are private — each player gets a tailored view.

import type { Player } from "../../../shared/src/types.js";
import {
  unoCardPoints,
  UNO_COLORS,
  type GameAction,
  type UnoAction,
  type UnoCard,
  type UnoCardKind,
  type UnoColor,
  type UnoPlayerPublic,
  type UnoView,
} from "../../../shared/src/games.js";
import { sanitizeUno, type UnoSettings } from "../../../shared/src/settings.js";
import type { ActionContext, GameEngine } from "./engine.js";

type LastEvent = NonNullable<UnoView["lastEvent"]>;

interface UnoState {
  order: string[];
  hands: Record<string, UnoCard[]>;
  drawPile: UnoCard[];
  discard: UnoCard[];
  currentColor: UnoColor;
  dir: 1 | -1;
  currentIdx: number;
  /** Accumulated +2/+4 the current player must eat (or stack onto). */
  pendingDraw: number;
  pendingDrawKind: "two" | "four" | null;
  phase: "play" | "decideDrawn" | "roundOver" | "over";
  /** The card the current player just drew and may play (decideDrawn). */
  drawnCardId: string | null;
  /** Who has declared "Uno!" (protected from a catch). */
  uno: Record<string, boolean>;
  scores: Record<string, number>;
  round: number;
  roundWinnerId: string | null;
  roundPoints: Record<string, number> | null;
  matchWinnerId: string | null;
  /** Index in `order` that leads the next round (previous round's winner). */
  startIdx: number;
  lastEvent: LastEvent | null;
  settings: UnoSettings;
}

/* ── deck ──────────────────────────────────────────────────────────────────── */

let idSeq = 0;
const mkCard = (color: UnoColor | null, kind: UnoCardKind, value: number | null): UnoCard => ({
  id: `c${idSeq++}`,
  color,
  kind,
  value,
});

function buildDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    deck.push(mkCard(color, "num", 0)); // one 0
    for (let v = 1; v <= 9; v++) {
      deck.push(mkCard(color, "num", v), mkCard(color, "num", v)); // two of 1–9
    }
    for (const kind of ["skip", "reverse", "draw2"] as const) {
      deck.push(mkCard(color, kind, null), mkCard(color, kind, null)); // two each
    }
  }
  for (let i = 0; i < 4; i++) deck.push(mkCard(null, "wild", null), mkCard(null, "wild4", null));
  return shuffle(deck);
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── engine ────────────────────────────────────────────────────────────────── */

export const uno: GameEngine<UnoState> = {
  init(players: Player[], _now, opts): UnoState {
    const settings = sanitizeUno((opts?.settings as Partial<UnoSettings>) ?? {});
    const order = players.map((p) => p.id);
    const state: UnoState = {
      order,
      hands: {},
      drawPile: [],
      discard: [],
      currentColor: "red",
      dir: 1,
      currentIdx: 0,
      pendingDraw: 0,
      pendingDrawKind: null,
      phase: "play",
      drawnCardId: null,
      uno: Object.fromEntries(order.map((id) => [id, false])),
      scores: Object.fromEntries(order.map((id) => [id, 0])),
      round: 1,
      roundWinnerId: null,
      roundPoints: null,
      matchWinnerId: null,
      startIdx: 0,
      lastEvent: null,
      settings,
    };
    dealRound(state);
    return state;
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    const a = action as UnoAction;

    // Off-turn social actions (allowed any time the round is live).
    if (a.type === "callUno") return callUno(state, pid);
    if (a.type === "catch") return catchPlayer(state, pid, a.targetId);
    if (a.type === "next") return nextRound(state, ctx);

    if (state.phase !== "play" && state.phase !== "decideDrawn") return false;
    if (state.order[state.currentIdx] !== pid) return false;

    if (a.type === "play") return playCard(state, pid, a.cardId, a.color);
    if (a.type === "draw") return drawTurn(state, pid);
    if (a.type === "pass") return passDrawn(state, pid);
    return false;
  },

  tick: () => false,

  onLeave(state, pid): boolean {
    if (!state.order.includes(pid)) return false;
    const idx = state.order.indexOf(pid);
    const wasCurrent = state.order[state.currentIdx] === pid;

    delete state.hands[pid];
    delete state.uno[pid];
    state.order.splice(idx, 1);

    if (state.order.length === 0) {
      state.phase = "over";
      state.matchWinnerId = null;
      return true;
    }
    if (state.order.length === 1 && state.phase !== "over") {
      // Last player standing takes the match.
      state.phase = "over";
      state.matchWinnerId = state.order[0];
      return true;
    }

    // Keep currentIdx pointing at the right seat after the splice.
    if (idx < state.currentIdx) state.currentIdx -= 1;
    if (state.currentIdx >= state.order.length) state.currentIdx = 0;
    if (state.startIdx >= state.order.length) state.startIdx = 0;

    if (wasCurrent && (state.phase === "play" || state.phase === "decideDrawn")) {
      // The mover left mid-turn: drop any half-resolved state, next seat plays.
      state.pendingDraw = 0;
      state.pendingDrawKind = null;
      state.drawnCardId = null;
      state.phase = "play";
    }
    return true;
  },

  isOver: (state) => state.phase === "over",

  view: (state) => buildView(state, null),
  playerView: (state, pid) => buildView(state, pid),
};

/* ── round lifecycle ─────────────────────────────────────────────────────── */

function dealRound(state: UnoState) {
  state.drawPile = buildDeck();
  state.discard = [];
  for (const id of state.order) {
    state.hands[id] = state.drawPile.splice(0, state.settings.startingHand);
    state.uno[id] = false;
  }
  // Flip the first card; keep drawing until it's a plain number so we never have
  // to resolve an action/wild as the opening card.
  let first = state.drawPile.pop()!;
  while (first.kind !== "num") {
    state.drawPile.unshift(first);
    first = state.drawPile.pop()!;
  }
  state.discard.push(first);
  state.currentColor = first.color!;
  state.dir = 1;
  state.currentIdx = state.startIdx % state.order.length;
  state.pendingDraw = 0;
  state.pendingDrawKind = null;
  state.drawnCardId = null;
  state.phase = "play";
  state.roundWinnerId = null;
  state.roundPoints = null;
  state.lastEvent = null;
}

function nextRound(state: UnoState, ctx: ActionContext): boolean {
  if (state.phase !== "roundOver") return false;
  if (!ctx.isHost) return false;
  state.round += 1;
  dealRound(state);
  return true;
}

function endRound(state: UnoState, winnerId: string) {
  let points = 0;
  for (const id of state.order) {
    if (id === winnerId) continue;
    points += (state.hands[id] ?? []).reduce((s, c) => s + unoCardPoints(c), 0);
  }
  state.scores[winnerId] = (state.scores[winnerId] ?? 0) + points;
  state.roundWinnerId = winnerId;
  state.roundPoints = { [winnerId]: points };
  state.startIdx = Math.max(0, state.order.indexOf(winnerId));

  const target = state.settings.scoreTarget;
  if (target > 0 && state.scores[winnerId] < target) {
    state.phase = "roundOver"; // scoreboard interstitial, host starts the next round
  } else {
    state.phase = "over";
    state.matchWinnerId = winnerId;
  }
}

/* ── moves ───────────────────────────────────────────────────────────────── */

function playCard(state: UnoState, pid: string, cardId: string, color?: UnoColor): boolean {
  const hand = state.hands[pid];
  if (!hand) return false;
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return false;
  // While deciding on a freshly drawn card, only that card may be played.
  if (state.phase === "decideDrawn" && cardId !== state.drawnCardId) return false;
  const card = hand[idx];
  if (!isPlayable(state, card)) return false;
  const isWild = card.kind === "wild" || card.kind === "wild4";
  if (isWild && !UNO_COLORS.includes(color as UnoColor)) return false;

  hand.splice(idx, 1);
  const stacked = state.pendingDraw > 0;
  if (isWild) card.color = color!;
  state.discard.push(card);
  state.currentColor = isWild ? color! : card.color!;
  state.drawnCardId = null;
  state.phase = "play";

  if (hand.length === 0) {
    applyEffect(state, card); // still flip direction / set pending so the view is coherent
    state.lastEvent = { type: eventType(card), playerId: pid, card, at: Date.now() };
    endRound(state, pid);
    return true;
  }

  applyEffect(state, card);
  state.lastEvent = {
    type: stacked ? "stack" : eventType(card),
    playerId: pid,
    card,
    at: Date.now(),
  };
  return true;
}

function drawTurn(state: UnoState, pid: string): boolean {
  if (state.phase !== "play") return false; // can't draw again while deciding

  // Eat a pending +2/+4 stack and forfeit the turn.
  if (state.pendingDraw > 0) {
    const n = state.pendingDraw;
    drawCards(state, pid, n);
    state.pendingDraw = 0;
    state.pendingDrawKind = null;
    state.lastEvent = { type: "draw", playerId: pid, count: n, at: Date.now() };
    advance(state, 1);
    return true;
  }

  // Normal draw. With draw-to-match, keep going until a playable card surfaces.
  let drawn = 0;
  let last: UnoCard | null = null;
  do {
    const card = drawOne(state);
    if (!card) break;
    state.hands[pid].push(card);
    state.uno[pid] = false;
    last = card;
    drawn += 1;
  } while (state.settings.drawToMatch && last && !isPlayable(state, last) && drawn < 200);

  if (drawn === 0) {
    // Pile fully exhausted — nothing to do but pass.
    advance(state, 1);
    state.lastEvent = { type: "draw", playerId: pid, count: 0, at: Date.now() };
    return true;
  }

  state.lastEvent = { type: "draw", playerId: pid, count: drawn, at: Date.now() };
  if (last && isPlayable(state, last)) {
    state.drawnCardId = last.id;
    state.phase = "decideDrawn";
  } else {
    advance(state, 1);
  }
  return true;
}

function passDrawn(state: UnoState, pid: string): boolean {
  if (state.phase !== "decideDrawn") return false;
  if (state.settings.forcePlay) return false; // must play the drawn card
  state.drawnCardId = null;
  state.phase = "play";
  advance(state, 1);
  state.lastEvent = { type: "draw", playerId: pid, count: 0, at: Date.now() };
  return true;
}

function callUno(state: UnoState, pid: string): boolean {
  if (state.phase === "roundOver" || state.phase === "over") return false;
  if (!state.order.includes(pid)) return false;
  if ((state.hands[pid]?.length ?? 0) > 2) return false;
  state.uno[pid] = true;
  state.lastEvent = { type: "uno", playerId: pid, at: Date.now() };
  return true;
}

function catchPlayer(state: UnoState, pid: string, targetId: string): boolean {
  if (state.phase === "roundOver" || state.phase === "over") return false;
  if (pid === targetId) return false;
  if (!state.order.includes(pid) || !isCatchable(state, targetId)) return false;
  const n = state.settings.unoPenalty;
  drawCards(state, targetId, n);
  state.lastEvent = { type: "catch", playerId: targetId, count: n, at: Date.now() };
  return true;
}

/* ── rules helpers ───────────────────────────────────────────────────────── */

function isPlayable(state: UnoState, card: UnoCard): boolean {
  // A pending draw stack can only be answered by stacking a matching card.
  if (state.pendingDraw > 0) {
    if (!state.settings.stacking) return false;
    if (state.pendingDrawKind === "two") return card.kind === "draw2";
    if (state.pendingDrawKind === "four") return card.kind === "wild4";
    return false;
  }
  if (card.kind === "wild" || card.kind === "wild4") return true;
  if (card.color === state.currentColor) return true;
  const top = state.discard[state.discard.length - 1];
  if (!top) return true;
  if (card.kind === "num" && top.kind === "num" && card.value === top.value) return true;
  if ((card.kind === "skip" || card.kind === "reverse" || card.kind === "draw2") && top.kind === card.kind)
    return true;
  return false;
}

function applyEffect(state: UnoState, card: UnoCard) {
  switch (card.kind) {
    case "skip":
      advance(state, 2);
      break;
    case "reverse":
      state.dir = (state.dir * -1) as 1 | -1;
      // Two-handed, a reverse plays like a skip (the mover goes again).
      advance(state, state.order.length === 2 ? 2 : 1);
      break;
    case "draw2":
      state.pendingDraw += 2;
      state.pendingDrawKind = "two";
      advance(state, 1);
      break;
    case "wild4":
      state.pendingDraw += 4;
      state.pendingDrawKind = "four";
      advance(state, 1);
      break;
    default:
      advance(state, 1); // num + wild
  }
}

function advance(state: UnoState, steps: number) {
  const n = state.order.length;
  if (n === 0) return;
  state.currentIdx = ((state.currentIdx + state.dir * steps) % n + n) % n;
}

function drawOne(state: UnoState): UnoCard | null {
  if (state.drawPile.length === 0) {
    // Reshuffle the discard (minus its top) back into the draw pile.
    const top = state.discard.pop();
    state.drawPile = shuffle(state.discard);
    state.discard = top ? [top] : [];
  }
  return state.drawPile.pop() ?? null;
}

function drawCards(state: UnoState, pid: string, n: number) {
  const hand = state.hands[pid];
  if (!hand) return;
  for (let i = 0; i < n; i++) {
    const card = drawOne(state);
    if (!card) break;
    hand.push(card);
  }
  state.uno[pid] = false; // gaining cards drops your Uno protection
}

const isCatchable = (state: UnoState, id: string): boolean =>
  (state.hands[id]?.length ?? 0) === 1 && !state.uno[id];

function eventType(card: UnoCard): LastEvent["type"] {
  if (card.kind === "skip") return "skip";
  if (card.kind === "reverse") return "reverse";
  if (card.kind === "wild" || card.kind === "wild4") return "wild";
  return "play";
}

/* ── view ────────────────────────────────────────────────────────────────── */

function buildView(state: UnoState, viewer: string | null): UnoView {
  const players: UnoPlayerPublic[] = state.order.map((id) => ({
    id,
    count: state.hands[id]?.length ?? 0,
    saidUno: state.uno[id] ?? false,
    score: state.scores[id] ?? 0,
  }));
  const current = state.order[state.currentIdx] ?? "";
  const decideForViewer = viewer === current && state.phase === "decideDrawn";
  const hand = viewer ? [...(state.hands[viewer] ?? [])] : [];

  // What the viewer may legally play right now (their turn only).
  let playableIds: string[] = [];
  if (viewer === current && (state.phase === "play" || state.phase === "decideDrawn")) {
    playableIds = decideForViewer
      ? hand.filter((c) => c.id === state.drawnCardId).map((c) => c.id)
      : hand.filter((c) => isPlayable(state, c)).map((c) => c.id);
  }

  return {
    kind: "uno",
    phase: state.phase,
    players,
    order: [...state.order],
    hand,
    playableIds,
    currentId: current,
    dir: state.dir,
    topCard: state.discard[state.discard.length - 1] ?? null,
    currentColor: state.currentColor,
    drawCount: state.drawPile.length,
    pendingDraw: state.pendingDraw,
    drawnCardId: decideForViewer ? state.drawnCardId : null,
    mustPlayDrawn: decideForViewer && state.settings.forcePlay,
    catchable: viewer
      ? state.order.filter((id) => id !== viewer && isCatchable(state, id))
      : [],
    lastEvent: state.lastEvent ?? undefined,
    round: state.round,
    roundWinnerId: state.roundWinnerId,
    roundPoints: state.roundPoints ?? undefined,
    scoreTarget: state.settings.scoreTarget,
    matchWinnerId: state.matchWinnerId,
    over: state.phase === "over",
  };
}
