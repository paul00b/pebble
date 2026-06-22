// Complots - a tabletop Coup. Everyone holds TWO hidden role cards (influence)
// and two coins. On your turn you take an action - and you may CLAIM any role to
// take its action, whether you hold it or not. Claimed actions open a short
// reaction window where others can block (with a counter-claim) or call you a
// liar. A challenge flips a card: the liar - or the wrongful accuser - loses an
// influence. Lose an influence and you choose which of your two cards to reveal;
// lose both and you're out. Last player with influence wins.
//
// Actions:
//   income   +1 coin, unstoppable
//   foreign  +2 coins, blockable by a Duke claim (no role claimed → no challenge)
//   tax      +3 coins, claims Duke
//   steal    take 2 from a target, claims Captain - the target may counter-claim Captain
//   assassin pay 3, kill a target, claims Assassin - the target may counter-claim Contessa
//   coup     pay 7, kill a target, unstoppable. At 10+ coins, coup is mandatory.
//
// Phase machine: action → (react → blockReact?) → lose(pick)* → resolve(pause) → next turn.

import type { Player } from "../../../shared/src/types.js";
import type {
  ComplotsAction,
  ComplotsActKind,
  ComplotsEvent,
  ComplotsPending,
  ComplotsRole,
  ComplotsView,
  GameAction,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";

/** How long a reaction window stays open before everyone is assumed to pass. */
const REACT_MS = 15_000;
/** How long a player has to choose which influence to lose before it auto-picks. */
const LOSE_MS = 20_000;
/** Dramatic pause after a verification / elimination, before the next turn. */
const RESOLVE_MS = 4_000;

const ROLES: ComplotsRole[] = ["duke", "assassin", "captain", "contessa"];
const COPIES = 3;
/** Influence cards each player is dealt. */
const START_CARDS = 2;

/** The counter-claim that blocks each blockable action. */
const BLOCK_ROLE: Partial<Record<ComplotsActKind, ComplotsRole>> = {
  foreign: "duke",
  steal: "captain",
  assassin: "contessa",
};

/** The role an actor claims when taking a role action. */
const CLAIM_ROLE: Partial<Record<ComplotsActKind, ComplotsRole>> = {
  tax: "duke",
  steal: "captain",
  assassin: "assassin",
};

const ASSASSIN_COST = 3;
const COUP_COST = 7;
const MUST_COUP_AT = 10;

interface CPlayer {
  coins: number;
  /** Face-down influence still held (0–2). */
  cards: ComplotsRole[];
  /** Face-up lost influence, in the order they fell. */
  revealed: ComplotsRole[];
}

interface CState {
  phase: "action" | "react" | "blockReact" | "lose" | "resolve" | "over";
  order: string[];
  players: Record<string, CPlayer>;
  deck: ComplotsRole[];
  /** Seat index of the player whose turn it is. */
  turnIdx: number;
  pending: ComplotsPending | null;
  passed: string[];
  /** Players who still owe an influence; the head picks during the "lose" phase. */
  lossQueue: string[];
  deadline: number;
  duration: number;
  lastEvent: ComplotsEvent | null;
  winnerId: string | null;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const alive = (s: CState, pid: string) => (s.players[pid]?.cards.length ?? 0) > 0;
const aliveIds = (s: CState) => s.order.filter((id) => alive(s, id));
const currentId = (s: CState) => s.order[s.turnIdx];

/** Reveal one face-down card (the player's pick, or the first by default). */
function revealCard(s: CState, pid: string, index: number) {
  const p = s.players[pid];
  if (!p || p.cards.length === 0) return;
  const i = index >= 0 && index < p.cards.length ? index : 0;
  const [card] = p.cards.splice(i, 1);
  p.revealed.push(card);
  const eliminated = p.cards.length === 0;
  if (s.lastEvent) {
    (s.lastEvent.losses ??= []).push({ id: pid, card, eliminated });
    if (eliminated) s.lastEvent.eliminatedId = pid;
  }
}

/** Knock a player fully out (used when they leave mid-game). */
function eliminateFully(s: CState, pid: string) {
  const p = s.players[pid];
  if (!p) return;
  while (p.cards.length > 0) p.revealed.push(p.cards.pop()!);
}

/** Queue an influence loss for `pid` (resolved via the lose phase / auto-pick). */
function enqueueLoss(s: CState, pid: string) {
  if (alive(s, pid)) s.lossQueue.push(pid);
}

/** A truthful claimer proves the named card, then trades it for a fresh one. */
function swapCard(s: CState, pid: string, role: ComplotsRole) {
  const p = s.players[pid];
  const i = p?.cards.indexOf(role) ?? -1;
  if (i === -1) return;
  s.deck.push(p.cards[i]);
  shuffle(s.deck);
  p.cards[i] = s.deck.pop()!;
}

/** Everyone alive who may still react to the pending action/block. */
function reactors(s: CState): string[] {
  if (!s.pending) return [];
  const waitingOn = s.phase === "blockReact" ? s.pending.blockerId : s.pending.actorId;
  return aliveIds(s).filter((id) => id !== waitingOn);
}

function openWindow(s: CState, now: number) {
  s.passed = [];
  s.deadline = now + REACT_MS;
  s.duration = REACT_MS;
}

/** Pause on the event so clients can stage the reveal, then move on. */
function pause(s: CState, now: number) {
  s.phase = "resolve";
  s.deadline = now + RESOLVE_MS;
  s.duration = RESOLVE_MS;
}

function endTurn(s: CState) {
  s.pending = null;
  s.passed = [];
  s.lossQueue = [];
  s.deadline = 0;
  const living = aliveIds(s);
  if (living.length <= 1) {
    s.phase = "over";
    s.winnerId = living[0] ?? null;
    return;
  }
  // Next alive seat after the turn holder (who may just have been eliminated).
  do {
    s.turnIdx = (s.turnIdx + 1) % s.order.length;
  } while (!alive(s, currentId(s)));
  s.phase = "action";
}

/**
 * Work through queued influence losses. A loser with two cards picks which to
 * reveal (the "lose" phase); with one card it auto-reveals; with none we skip.
 * When the queue empties we settle into the resolve pause.
 */
function processLosses(s: CState, now: number) {
  while (s.lossQueue.length > 0) {
    const pid = s.lossQueue[0];
    const p = s.players[pid];
    if (!p || p.cards.length === 0) {
      s.lossQueue.shift();
      continue;
    }
    if (p.cards.length === 1) {
      revealCard(s, pid, 0);
      s.lossQueue.shift();
      continue;
    }
    // Two cards: the player chooses which influence to give up.
    s.phase = "lose";
    s.deadline = now + LOSE_MS;
    s.duration = LOSE_MS;
    return;
  }
  pause(s, now);
}

/** The pending action goes through (all passed, or a challenge failed). */
function applyAction(s: CState, now: number) {
  const p = s.pending!;
  const actor = s.players[p.actorId];
  const target = p.targetId ? s.players[p.targetId] : null;

  if (p.act === "foreign" || p.act === "tax") {
    const amount = p.act === "foreign" ? 2 : 3;
    if (alive(s, p.actorId)) actor.coins += amount;
    s.lastEvent = { type: p.act, actorId: p.actorId, act: p.act, amount, at: now };
    endTurn(s);
    return;
  }
  if (p.act === "steal") {
    const canSteal = !!p.targetId && alive(s, p.targetId) && alive(s, p.actorId);
    const amount = canSteal ? Math.min(2, target!.coins) : 0;
    if (canSteal) {
      target!.coins -= amount;
      actor.coins += amount;
    }
    s.lastEvent = { type: "steal", actorId: p.actorId, act: "steal", targetId: p.targetId, amount, at: now };
    endTurn(s);
    return;
  }
  if (p.act === "assassin") {
    const victim = p.targetId && alive(s, p.targetId) ? p.targetId : null;
    s.lastEvent = {
      type: "assassinated",
      actorId: p.actorId,
      act: "assassin",
      targetId: p.targetId,
      losses: [],
      at: now,
    };
    if (victim) enqueueLoss(s, victim);
    processLosses(s, now);
  }
}

/** Verify a "liar!" call against whoever made the live claim. */
function resolveChallenge(s: CState, challengerId: string, now: number) {
  const p = s.pending!;
  const onBlock = s.phase === "blockReact";
  const challengedId = onBlock ? p.blockerId! : p.actorId;
  const claimed = onBlock ? p.blockRole! : p.claim!;
  const challenged = s.players[challengedId];
  const truthful = challenged.cards.includes(claimed);

  if (truthful) {
    swapCard(s, challengedId, claimed); // proved it - trade the exposed card for a new one
  }
  s.lastEvent = {
    type: "challenge",
    actorId: p.actorId,
    act: p.act,
    targetId: p.targetId,
    challengerId,
    challengedId,
    claimed,
    shown: truthful ? claimed : null,
    truthful,
    losses: [],
    blockerId: p.blockerId,
    blockRole: p.blockRole,
    at: now,
  };

  // The challenge loser gives up an influence (their choice of which).
  enqueueLoss(s, truthful ? challengerId : challengedId);

  // Does the action still go through?
  //  - action claim was truthful  → yes (the challenger is out of the way)
  //  - action claim was a lie     → no
  //  - block was truthful         → no (the block stands)
  //  - block was a lie            → yes (the blocker is out of the way)
  const goesThrough = onBlock ? !truthful : truthful;
  if (goesThrough) {
    applyEffectSilently(s, now);
  }
  processLosses(s, now);
}

/** Apply the pending action's effect without overwriting the challenge event. */
function applyEffectSilently(s: CState, _now: number) {
  const p = s.pending!;
  const actor = s.players[p.actorId];
  const target = p.targetId ? s.players[p.targetId] : null;
  if (p.act === "foreign") actor.coins += 2;
  if (p.act === "tax") actor.coins += 3;
  if (p.act === "steal" && target && alive(s, p.targetId!) && alive(s, p.actorId)) {
    const amount = Math.min(2, target.coins);
    target.coins -= amount;
    actor.coins += amount;
  }
  if (p.act === "assassin" && p.targetId && alive(s, p.targetId)) {
    enqueueLoss(s, p.targetId);
  }
}

/** Everyone (still eligible) has passed → the action or block goes through. */
function windowDone(s: CState, now: number) {
  if (s.phase === "react") {
    applyAction(s, now);
    return;
  }
  // blockReact: nobody dared challenge the block - the action is canceled.
  const p = s.pending!;
  s.lastEvent = {
    type: "blocked",
    actorId: p.actorId,
    act: p.act,
    targetId: p.targetId,
    blockerId: p.blockerId,
    blockRole: p.blockRole,
    at: now,
  };
  pause(s, now);
}

function checkAllPassed(s: CState, now: number) {
  const waiting = reactors(s).filter((id) => !s.passed.includes(id));
  if (waiting.length === 0) windowDone(s, now);
}

export const complots: GameEngine<CState> = {
  init(players: Player[], _now: number, _opts: InitOptions): CState {
    const deck = shuffle(ROLES.flatMap((r) => Array(COPIES).fill(r) as ComplotsRole[]));
    const state: CState = {
      phase: "action",
      order: players.map((p) => p.id),
      players: {},
      deck,
      turnIdx: 0,
      pending: null,
      passed: [],
      lossQueue: [],
      deadline: 0,
      duration: 0,
      lastEvent: null,
      winnerId: null,
    };
    for (const p of players) {
      const cards = Array.from({ length: START_CARDS }, () => deck.pop()!).filter(Boolean);
      state.players[p.id] = { coins: 2, cards, revealed: [] };
    }
    return state;
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    if (state.phase === "over" || !alive(state, pid)) return false;
    const a = action as ComplotsAction;

    if (a.type === "act") {
      if (state.phase !== "action" || pid !== currentId(state)) return false;
      const me = state.players[pid];
      if (me.coins >= MUST_COUP_AT && a.act !== "coup") return false;

      const needsTarget = a.act === "steal" || a.act === "assassin" || a.act === "coup";
      const targetId = needsTarget ? a.target ?? null : null;
      if (needsTarget && (!targetId || targetId === pid || !alive(state, targetId))) return false;

      if (a.act === "income") {
        me.coins += 1;
        state.lastEvent = { type: "income", actorId: pid, act: "income", amount: 1, at: ctx.now };
        endTurn(state);
        return true;
      }
      if (a.act === "coup") {
        if (me.coins < COUP_COST) return false;
        me.coins -= COUP_COST;
        state.lastEvent = {
          type: "coup",
          actorId: pid,
          act: "coup",
          targetId,
          losses: [],
          at: ctx.now,
        };
        enqueueLoss(state, targetId!);
        processLosses(state, ctx.now);
        return true;
      }
      if (a.act === "assassin" && me.coins < ASSASSIN_COST) return false;
      if (a.act === "assassin") me.coins -= ASSASSIN_COST; // paid up front, lost even if blocked

      state.pending = {
        act: a.act,
        actorId: pid,
        targetId,
        claim: CLAIM_ROLE[a.act] ?? null,
        blockerId: null,
        blockRole: null,
      };
      state.phase = "react";
      openWindow(state, ctx.now);
      return true;
    }

    if (a.type === "lose") {
      if (state.phase !== "lose" || state.lossQueue[0] !== pid) return false;
      const me = state.players[pid];
      if (a.index < 0 || a.index >= me.cards.length) return false;
      revealCard(state, pid, a.index);
      state.lossQueue.shift();
      processLosses(state, ctx.now);
      return true;
    }

    if (!state.pending) return false;

    if (a.type === "pass") {
      if (state.phase !== "react" && state.phase !== "blockReact") return false;
      if (!reactors(state).includes(pid) || state.passed.includes(pid)) return false;
      state.passed.push(pid);
      checkAllPassed(state, ctx.now);
      return true;
    }

    if (a.type === "block") {
      if (state.phase !== "react") return false;
      const p = state.pending;
      const role = BLOCK_ROLE[p.act];
      if (!role || pid === p.actorId) return false;
      // Targeted actions: only the target may block. Foreign aid: anyone.
      if (p.targetId && pid !== p.targetId) return false;
      p.blockerId = pid;
      p.blockRole = role;
      state.phase = "blockReact";
      openWindow(state, ctx.now);
      return true;
    }

    if (a.type === "challenge") {
      if (state.phase === "react") {
        if (!state.pending.claim) return false; // foreign aid claims nothing
        if (!reactors(state).includes(pid)) return false;
        resolveChallenge(state, pid, ctx.now);
        return true;
      }
      if (state.phase === "blockReact") {
        if (!reactors(state).includes(pid)) return false;
        resolveChallenge(state, pid, ctx.now);
        return true;
      }
      return false;
    }

    return false;
  },

  tick(state, now): boolean {
    if (state.phase === "over" || state.deadline === 0 || now < state.deadline) return false;
    if (state.phase === "react" || state.phase === "blockReact") {
      windowDone(state, now); // silence is consent
      return true;
    }
    if (state.phase === "lose") {
      const loser = state.lossQueue[0];
      if (loser) revealCard(state, loser, 0); // dithered too long → first card falls
      state.lossQueue.shift();
      processLosses(state, now);
      return true;
    }
    if (state.phase === "resolve") {
      endTurn(state);
      return true;
    }
    return false;
  },

  onLeave(state, pid, now): boolean {
    if (!(pid in state.players)) return false;
    const wasAlive = alive(state, pid);
    eliminateFully(state, pid);
    state.lossQueue = state.lossQueue.filter((id) => id !== pid);
    if (state.phase === "over" || !wasAlive) return true;

    const p = state.pending;
    if (p && (p.actorId === pid || p.targetId === pid || p.blockerId === pid)) {
      // A principal walked out mid-stand-off - drop the action and move on.
      endTurn(state);
      return true;
    }
    if (state.phase === "action" && currentId(state) === pid) {
      endTurn(state);
      return true;
    }
    if (state.phase === "react" || state.phase === "blockReact") {
      // One fewer reactor - the window may now be unanimous.
      checkAllPassed(state, now);
    } else if (state.phase === "lose") {
      // The player on the spot left - settle the (now shorter) loss queue.
      processLosses(state, now);
    }
    const living = aliveIds(state);
    if ((state.phase as CState["phase"]) !== "over" && living.length <= 1) {
      state.phase = "over";
      state.winnerId = living[0] ?? null;
    }
    return true;
  },

  isOver: (state) => state.phase === "over",

  view: (state) => cpView(state, null),
  playerView: (state, pid) => cpView(state, pid),
};

function cpView(state: CState, viewer: string | null): ComplotsView {
  const me = viewer ? state.players[viewer] : undefined;
  const meAlive = (me?.cards.length ?? 0) > 0;
  const inWindow = state.phase === "react" || state.phase === "blockReact";
  const isReactor =
    !!viewer &&
    meAlive &&
    inWindow &&
    reactors(state).includes(viewer) &&
    !state.passed.includes(viewer);

  let youCanBlock = false;
  if (isReactor && state.phase === "react" && state.pending) {
    const p = state.pending;
    youCanBlock =
      !!BLOCK_ROLE[p.act] && (p.targetId ? viewer === p.targetId : viewer !== p.actorId);
  }
  const youCanChallenge =
    isReactor && (state.phase === "blockReact" || state.pending?.claim != null);

  return {
    kind: "complots",
    phase: state.phase,
    players: state.order.map((id) => ({
      id,
      coins: state.players[id].coins,
      alive: alive(state, id),
      influence: state.players[id].cards.length,
      revealed: state.players[id].revealed,
    })),
    currentId: currentId(state),
    youCards: me?.cards ?? [],
    deckCount: state.deck.length,
    pending: state.pending,
    deadline: state.deadline,
    duration: state.duration,
    passed: state.passed,
    youCanPass: isReactor,
    youCanChallenge,
    youCanBlock,
    losingId: state.phase === "lose" ? state.lossQueue[0] ?? null : null,
    youMustLose: state.phase === "lose" && !!viewer && state.lossQueue[0] === viewer,
    mustCoup:
      state.phase === "action" && alive(state, currentId(state)) &&
      state.players[currentId(state)].coins >= MUST_COUP_AT,
    lastEvent: state.lastEvent,
    winnerId: state.winnerId,
    over: state.phase === "over",
  };
}
