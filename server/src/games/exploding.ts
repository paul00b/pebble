// Exploding Kittens - draw cards until someone draws an Exploding Kitten. Draw
// one and you're out, unless you play a Defuse (then you secretly slip the
// kitten back into the deck). Action cards bend the turn: Attack dumps extra
// turns on the next player, Skip ends yours without drawing, See the Future
// peeks the top three, Shuffle scrambles the deck, Favor begs a card off
// someone, and matching Cat cards steal cards. Almost any play can be Noped.
//
// Phase machine: play → (react → resolve)* → {favor | insert} → play → next.
// The reaction window, favor-give and kitten-insert are tick-driven deadlines.

import type { Player } from "../../../shared/src/types.js";
import type {
  ExplodingAction,
  ExplodingCard,
  ExplodingPending,
  ExplodingView,
  GameAction,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";

/** Reaction window for Nopes (reset every time someone Nopes). */
const NOPE_MS = 7_000;
/** How long the favor target has to hand a card over before one is taken. */
const GIVE_MS = 25_000;
/** How long a defuser has to choose where the kitten goes before it's random. */
const INSERT_MS = 25_000;

const CAT_CARDS: ExplodingCard[] = ["tacocat", "cattermelon", "potatocat", "beardcat", "rainbowcat"];
const NOPEABLE = new Set(["attack", "skip", "favor", "shuffle", "future", "pair", "triple"]);

const START_HAND = 7;
const TOTAL_DEFUSE = 6;

interface EKPlayer {
  hand: ExplodingCard[];
  alive: boolean;
  exploded: boolean;
}

interface EKState {
  phase: "play" | "react" | "favor" | "insert" | "over";
  order: string[];
  players: Record<string, EKPlayer>;
  deck: ExplodingCard[];      // top of deck = last element (we pop from the end)
  discard: ExplodingCard[];
  turnIdx: number;
  turnsLeft: number;
  pending: ExplodingPending | null;
  /** A defused kitten waiting to be reinserted. */
  kitten: ExplodingCard | null;
  favorGiverId: string | null;
  inserterId: string | null;
  /** See-the-Future peek owned by a single player (top card first). */
  future: { playerId: string; cards: ExplodingCard[] } | null;
  deadline: number;
  duration: number;
  lastEvent: ExplodingView["lastEvent"];
  winnerId: string | null;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const alive = (s: EKState, id: string) => s.players[id]?.alive ?? false;
const aliveIds = (s: EKState) => s.order.filter((id) => alive(s, id));
const currentId = (s: EKState) => s.order[s.turnIdx];
const discardTop = (s: EKState) => s.discard[s.discard.length - 1] ?? null;

function removeOne(hand: ExplodingCard[], card: ExplodingCard): boolean {
  const i = hand.indexOf(card);
  if (i === -1) return false;
  hand.splice(i, 1);
  return true;
}

/* ── Turn flow ────────────────────────────────────────────────────────────── */

function checkWin(s: EKState): boolean {
  const living = aliveIds(s);
  if (living.length <= 1) {
    s.phase = "over";
    s.winnerId = living[0] ?? null;
    s.pending = null;
    s.deadline = 0;
    s.future = null;
    return true;
  }
  return false;
}

/** Hand the turn to the next living seat with `startTurns` turns to take. */
function advance(s: EKState, startTurns: number) {
  s.future = null;
  do {
    s.turnIdx = (s.turnIdx + 1) % s.order.length;
  } while (!alive(s, currentId(s)));
  s.turnsLeft = startTurns;
  s.phase = "play";
}

/** Finish one of the current player's turns (after a draw or a Skip). */
function endOneTurn(s: EKState) {
  s.turnsLeft -= 1;
  if (s.turnsLeft > 0) {
    s.phase = "play";
    s.future = null;
  } else {
    advance(s, 1);
  }
}

/** Attack ends your turn(s) and stacks two onto the next player. */
function attackResolve(s: EKState, now: number) {
  const carry = s.turnsLeft > 1 ? s.turnsLeft : 0;
  s.lastEvent = { type: "attacked", actorId: currentId(s), n: carry + 2, at: now };
  advance(s, carry + 2);
}

/* ── Reaction window ──────────────────────────────────────────────────────── */

function openWindow(s: EKState, now: number) {
  s.phase = "react";
  s.deadline = now + NOPE_MS;
  s.duration = NOPE_MS;
}

/** Someone alive (other than the actor on an even nope count) may still Nope. */
function canNope(s: EKState, pid: string): boolean {
  if (s.phase !== "react" || !s.pending || !alive(s, pid)) return false;
  if (!s.players[pid].hand.includes("nope")) return false;
  // The actor can only "Yup" (nope a nope), never cancel their own action.
  if (pid === s.pending.actorId && s.pending.nopes % 2 === 0) return false;
  return true;
}

/** Move a random card from `fromId` to `toId`; returns the moved card. */
function stealRandom(s: EKState, fromId: string, toId: string): ExplodingCard | null {
  const from = s.players[fromId];
  if (!from || from.hand.length === 0) return null;
  const i = Math.floor(Math.random() * from.hand.length);
  const [card] = from.hand.splice(i, 1);
  s.players[toId].hand.push(card);
  return card;
}

/** The pending action survived the window (or was Yup'd back) - apply it. */
function applyPending(s: EKState, now: number) {
  const p = s.pending!;
  const actor = p.actorId;
  // Favor keeps `pending` alive across its give sub-step; everything else is
  // fully resolved here, so clear it.
  if (p.kind !== "favor") { s.pending = null; s.deadline = 0; }

  switch (p.kind) {
    case "attack":
      attackResolve(s, now);
      return;
    case "skip":
      s.lastEvent = { type: "skipped", actorId: actor, at: now };
      endOneTurn(s);
      return;
    case "shuffle":
      shuffle(s.deck);
      s.future = null;
      s.lastEvent = { type: "shuffled", actorId: actor, at: now };
      s.phase = "play";
      return;
    case "future":
      s.future = { playerId: actor, cards: s.deck.slice(-3).reverse() };
      s.lastEvent = { type: "future", actorId: actor, at: now };
      s.phase = "play";
      return;
    case "favor": {
      const target = p.targetId;
      if (target && alive(s, target) && s.players[target].hand.length > 0) {
        s.phase = "favor";
        s.favorGiverId = target;
        s.deadline = now + GIVE_MS;
        s.duration = GIVE_MS;
      } else {
        s.pending = null;
        s.deadline = 0;
        s.lastEvent = { type: "favorGiven", actorId: actor, targetId: target, card: null, at: now };
        s.phase = "play";
      }
      return;
    }
    case "pair": {
      const card = p.targetId ? stealRandom(s, p.targetId, actor) : null;
      s.lastEvent = { type: "stole", actorId: actor, targetId: p.targetId, card, at: now };
      s.phase = "play";
      return;
    }
    case "triple": {
      let card: ExplodingCard | null = null;
      const target = p.targetId ? s.players[p.targetId] : null;
      if (target && p.named && removeOne(target.hand, p.named)) {
        s.players[actor].hand.push(p.named);
        card = p.named;
      }
      s.lastEvent = { type: "stole", actorId: actor, targetId: p.targetId, card, at: now };
      s.phase = "play";
      return;
    }
  }
}

function resolveReact(s: EKState, now: number) {
  if (s.pending!.nopes % 2 === 1) {
    // Negated: the cards are already discarded, the action simply fizzles.
    s.pending = null;
    s.deadline = 0;
    s.phase = "play";
    return;
  }
  applyPending(s, now);
}

/* ── Drawing ──────────────────────────────────────────────────────────────── */

function drawCard(s: EKState, pid: string, now: number) {
  const card = s.deck.pop()!;
  const me = s.players[pid];
  s.future = null;

  if (card !== "ek") {
    me.hand.push(card);
    s.lastEvent = { type: "drew", actorId: pid, at: now };
    endOneTurn(s);
    return;
  }

  // Drew the kitten.
  if (removeOne(me.hand, "defuse")) {
    s.discard.push("defuse");
    s.kitten = "ek";
    s.inserterId = pid;
    s.phase = "insert";
    s.deadline = now + INSERT_MS;
    s.duration = INSERT_MS;
    s.lastEvent = { type: "defused", actorId: pid, at: now };
    return;
  }

  // No defuse - boom.
  me.alive = false;
  me.exploded = true;
  s.discard.push("ek");
  s.lastEvent = { type: "exploded", actorId: pid, at: now };
  if (checkWin(s)) return;
  advance(s, 1);
}

/* ── Engine ───────────────────────────────────────────────────────────────── */

export const exploding: GameEngine<EKState> = {
  init(players: Player[], _now: number, _opts: InitOptions): EKState {
    const n = players.length;
    // Base deck: everything except kittens and defuses.
    const deck: ExplodingCard[] = [
      ...Array(4).fill("attack"),
      ...Array(4).fill("skip"),
      ...Array(4).fill("favor"),
      ...Array(4).fill("shuffle"),
      ...Array(5).fill("future"),
      ...Array(5).fill("nope"),
      ...CAT_CARDS.flatMap((c) => Array(4).fill(c) as ExplodingCard[]),
    ];
    shuffle(deck);

    const state: EKState = {
      phase: "play",
      order: players.map((p) => p.id),
      players: {},
      deck,
      discard: [],
      turnIdx: 0,
      turnsLeft: 1,
      pending: null,
      kitten: null,
      favorGiverId: null,
      inserterId: null,
      future: null,
      deadline: 0,
      duration: 0,
      lastEvent: null,
      winnerId: null,
    };

    // Deal 7 cards, then hand everyone exactly one Defuse.
    for (const p of players) {
      const hand = Array.from({ length: START_HAND }, () => deck.pop()!).filter(Boolean);
      hand.push("defuse");
      state.players[p.id] = { hand, alive: true, exploded: false };
    }
    // Remaining defuses go back into the deck, plus one kitten per player bar one.
    for (let i = 0; i < TOTAL_DEFUSE - n; i++) deck.push("defuse");
    for (let i = 0; i < n - 1; i++) deck.push("ek");
    shuffle(deck);

    return state;
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    if (state.phase === "over") return false;
    const a = action as ExplodingAction;
    const now = ctx.now;

    // Nope: usable by anyone eligible during the reaction window.
    if (a.type === "nope") {
      if (!canNope(state, pid)) return false;
      removeOne(state.players[pid].hand, "nope");
      state.discard.push("nope");
      state.pending!.nopes += 1;
      state.lastEvent = { type: "noped", actorId: pid, at: now };
      state.deadline = now + NOPE_MS; // re-open for a Yup
      state.duration = NOPE_MS;
      return true;
    }

    // Favor target hands a card over.
    if (a.type === "give") {
      if (state.phase !== "favor" || pid !== state.favorGiverId) return false;
      const giver = state.players[pid];
      if (a.index < 0 || a.index >= giver.hand.length) return false;
      const [card] = giver.hand.splice(a.index, 1);
      const askerId = state.pending?.actorId ?? null;
      if (askerId) state.players[askerId].hand.push(card);
      state.favorGiverId = null;
      state.pending = null;
      state.deadline = 0;
      state.lastEvent = { type: "favorGiven", actorId: askerId ?? pid, targetId: pid, card, at: now };
      state.phase = "play";
      return true;
    }

    // Reinsert a defused kitten.
    if (a.type === "insert") {
      if (state.phase !== "insert" || pid !== state.inserterId) return false;
      const pos = Math.max(0, Math.min(state.deck.length, Math.floor(a.index)));
      state.deck.splice(state.deck.length - pos, 0, "ek"); // pos from the top
      state.kitten = null;
      state.inserterId = null;
      state.deadline = 0;
      endOneTurn(state); // drawing the kitten was this turn's draw
      return true;
    }

    // The rest are only legal on your own turn in the play phase.
    if (state.phase !== "play" || pid !== currentId(state)) return false;

    if (a.type === "draw") {
      if (state.deck.length === 0) return false;
      drawCard(state, pid, now);
      return true;
    }

    if (a.type === "play") {
      const me = state.players[pid];
      const combo = a.combo ?? "single";

      if (combo === "single") {
        const solo = new Set(["attack", "skip", "favor", "shuffle", "future"]);
        if (!solo.has(a.card) || !me.hand.includes(a.card)) return false;
        let targetId: string | null = null;
        if (a.card === "favor") {
          targetId = a.target ?? null;
          if (!targetId || targetId === pid || !alive(state, targetId)) return false;
        }
        removeOne(me.hand, a.card);
        state.discard.push(a.card);
        state.pending = { kind: a.card as ExplodingPending["kind"], actorId: pid, targetId, named: null, nopes: 0 };
        state.lastEvent = { type: "play", actorId: pid, card: a.card, targetId, at: now };
        openWindow(state, now);
        return true;
      }

      // Cat combos: steal from a target.
      if (!CAT_CARDS.includes(a.card)) return false;
      const targetId = a.target ?? null;
      if (!targetId || targetId === pid || !alive(state, targetId)) return false;
      const have = me.hand.filter((c) => c === a.card).length;
      const need = combo === "pair" ? 2 : 3;
      if (have < need) return false;
      if (combo === "triple" && !a.named) return false;
      for (let i = 0; i < need; i++) { removeOne(me.hand, a.card); state.discard.push(a.card); }
      state.pending = {
        kind: combo,
        actorId: pid,
        targetId,
        named: combo === "triple" ? a.named ?? null : null,
        nopes: 0,
      };
      state.lastEvent = { type: "play", actorId: pid, card: a.card, targetId, at: now };
      openWindow(state, now);
      return true;
    }

    return false;
  },

  tick(state, now): boolean {
    if (state.phase === "over" || state.deadline === 0 || now < state.deadline) return false;
    if (state.phase === "react") {
      resolveReact(state, now);
      return true;
    }
    if (state.phase === "favor") {
      // Dithered: a random card is taken instead.
      const giver = state.favorGiverId;
      const askerId = state.pending?.actorId ?? null;
      const card = giver && askerId ? stealRandom(state, giver, askerId) : null;
      state.favorGiverId = null;
      state.pending = null;
      state.deadline = 0;
      state.lastEvent = { type: "favorGiven", actorId: askerId ?? "", targetId: giver, card, at: now };
      state.phase = "play";
      return true;
    }
    if (state.phase === "insert") {
      const pos = Math.floor(Math.random() * (state.deck.length + 1));
      state.deck.splice(state.deck.length - pos, 0, "ek");
      state.kitten = null;
      state.inserterId = null;
      state.deadline = 0;
      endOneTurn(state);
      return true;
    }
    return false;
  },

  onLeave(state, pid, now): boolean {
    if (!(pid in state.players)) return false;
    const wasAlive = alive(state, pid);
    const me = state.players[pid];
    // Their cards leave with them.
    me.hand = [];
    me.alive = false;
    if (state.phase === "over" || !wasAlive) return true;

    const p = state.pending;
    const involved =
      (p && (p.actorId === pid || p.targetId === pid)) ||
      state.favorGiverId === pid ||
      state.inserterId === pid;
    const wasCurrent = currentId(state) === pid;

    if (checkWin(state)) return true;

    if (involved || wasCurrent) {
      // Drop whatever was mid-flight and hand the turn on.
      state.pending = null;
      state.favorGiverId = null;
      state.inserterId = null;
      state.kitten = null;
      state.deadline = 0;
      // Step back so advance() lands on the seat after the one who left.
      state.turnIdx = (state.turnIdx - 1 + state.order.length) % state.order.length;
      advance(state, 1);
    } else if (state.phase === "react") {
      // One fewer potential noper - the window may now resolve early, but the
      // tick deadline handles that; nothing to do here.
    }
    return true;
  },

  isOver: (state) => state.phase === "over",

  view: (state) => ekView(state, null),
  playerView: (state, pid) => ekView(state, pid),
};

function ekView(state: EKState, viewer: string | null): ExplodingView {
  const me = viewer ? state.players[viewer] : undefined;
  return {
    kind: "exploding",
    phase: state.phase,
    players: state.order.map((id) => ({
      id,
      handCount: state.players[id].hand.length,
      alive: state.players[id].alive,
      exploded: state.players[id].exploded,
    })),
    currentId: currentId(state),
    turnsLeft: state.turnsLeft,
    deckCount: state.deck.length,
    discardTop: discardTop(state),
    youHand: me?.hand ?? [],
    pending: state.pending,
    deadline: state.deadline,
    duration: state.duration,
    youCanNope: !!viewer && canNope(state, viewer),
    favorGiverId: state.favorGiverId,
    youMustGive: state.phase === "favor" && state.favorGiverId === viewer,
    inserterId: state.inserterId,
    youMustInsert: state.phase === "insert" && state.inserterId === viewer,
    future: state.future && state.future.playerId === viewer ? state.future.cards : null,
    lastEvent: state.lastEvent,
    winnerId: state.winnerId,
    over: state.phase === "over",
  };
}
