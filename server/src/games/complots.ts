// Complots — a one-card Coup. Everyone holds a single hidden role card and two
// coins. On your turn you take an action — and you may CLAIM any role to take
// its action, whether you hold it or not. Claimed actions open a short reaction
// window where others can block (with a counter-claim) or call you a liar.
// A challenge flips the card: the liar — or the wrongful accuser — is out.
// One card = one life; last player standing wins.
//
// Actions:
//   income   +1 coin, unstoppable
//   foreign  +2 coins, blockable by a Duke claim (no role claimed → no challenge)
//   tax      +3 coins, claims Duke
//   steal    take 2 from a target, claims Captain — the target may counter-claim Captain
//   assassin pay 3, kill a target, claims Assassin — the target may counter-claim Contessa
//   coup     pay 7, kill a target, unstoppable. At 10+ coins, coup is mandatory.
//
// Phase machine: action → (react → blockReact?) → resolve(pause) → next turn.

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
/** Dramatic pause after a verification / elimination, before the next turn. */
const RESOLVE_MS = 4_000;

const ROLES: ComplotsRole[] = ["duke", "assassin", "captain", "contessa"];
const COPIES = 3;

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
  card: ComplotsRole | null;
  alive: boolean;
  revealed: ComplotsRole | null;
}

interface CState {
  phase: "action" | "react" | "blockReact" | "resolve" | "over";
  order: string[];
  players: Record<string, CPlayer>;
  deck: ComplotsRole[];
  /** Seat index of the player whose turn it is. */
  turnIdx: number;
  pending: ComplotsPending | null;
  passed: string[];
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

const alive = (s: CState, pid: string) => s.players[pid]?.alive === true;
const aliveIds = (s: CState) => s.order.filter((id) => alive(s, id));
const currentId = (s: CState) => s.order[s.turnIdx];

function eliminate(s: CState, pid: string) {
  const p = s.players[pid];
  if (!p || !p.alive) return;
  p.alive = false;
  p.revealed = p.card;
  p.card = null;
}

/** A truthful claimer proves their card, then trades it for a fresh one. */
function swapCard(s: CState, pid: string) {
  const p = s.players[pid];
  if (!p?.card) return;
  s.deck.push(p.card);
  shuffle(s.deck);
  p.card = s.deck.pop() ?? null;
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

/** The pending action goes through (all passed, or a challenge failed). */
function applyAction(s: CState, now: number) {
  const p = s.pending!;
  const actor = s.players[p.actorId];
  const target = p.targetId ? s.players[p.targetId] : null;

  if (p.act === "foreign" || p.act === "tax") {
    const amount = p.act === "foreign" ? 2 : 3;
    if (actor.alive) actor.coins += amount;
    s.lastEvent = { type: p.act, actorId: p.actorId, act: p.act, amount, at: now };
    endTurn(s);
    return;
  }
  if (p.act === "steal") {
    const amount = target?.alive ? Math.min(2, target.coins) : 0;
    if (target?.alive && actor.alive) {
      target.coins -= amount;
      actor.coins += amount;
    }
    s.lastEvent = { type: "steal", actorId: p.actorId, act: "steal", targetId: p.targetId, amount, at: now };
    endTurn(s);
    return;
  }
  if (p.act === "assassin") {
    const victim = p.targetId && alive(s, p.targetId) ? p.targetId : null;
    if (victim) eliminate(s, victim);
    s.lastEvent = {
      type: "assassinated",
      actorId: p.actorId,
      act: "assassin",
      targetId: p.targetId,
      eliminatedId: victim,
      at: now,
    };
    pause(s, now);
  }
}

/** Verify a "liar!" call against whoever made the live claim. */
function resolveChallenge(s: CState, challengerId: string, now: number) {
  const p = s.pending!;
  const onBlock = s.phase === "blockReact";
  const challengedId = onBlock ? p.blockerId! : p.actorId;
  const claimed = onBlock ? p.blockRole! : p.claim!;
  const challenged = s.players[challengedId];
  const truthful = challenged.card === claimed;
  const shown = (challenged.card ?? challenged.revealed)!;

  if (truthful) {
    eliminate(s, challengerId);
    swapCard(s, challengedId); // proved it — trade the exposed card for a new one
  } else {
    eliminate(s, challengedId);
  }
  s.lastEvent = {
    type: "challenge",
    actorId: p.actorId,
    act: p.act,
    targetId: p.targetId,
    challengerId,
    challengedId,
    claimed,
    shown,
    truthful,
    eliminatedId: truthful ? challengerId : challengedId,
    blockerId: p.blockerId,
    blockRole: p.blockRole,
    at: now,
  };

  // Does the action still go through?
  //  - action claim was truthful  → yes (the challenger is out of the way)
  //  - action claim was a lie     → no
  //  - block was truthful         → no (the block stands)
  //  - block was a lie            → yes (the blocker is out of the way)
  const goesThrough = onBlock ? !truthful : truthful;
  if (goesThrough) {
    applyEffectSilently(s, now);
  }
  pause(s, now);
}

/** Apply the pending action's effect without overwriting the challenge event. */
function applyEffectSilently(s: CState, _now: number) {
  const p = s.pending!;
  const actor = s.players[p.actorId];
  const target = p.targetId ? s.players[p.targetId] : null;
  if (p.act === "foreign") actor.coins += 2;
  if (p.act === "tax") actor.coins += 3;
  if (p.act === "steal" && target?.alive && actor.alive) {
    const amount = Math.min(2, target.coins);
    target.coins -= amount;
    actor.coins += amount;
  }
  if (p.act === "assassin" && p.targetId && alive(s, p.targetId)) {
    eliminate(s, p.targetId);
  }
}

/** Everyone (still eligible) has passed → the action or block goes through. */
function windowDone(s: CState, now: number) {
  if (s.phase === "react") {
    applyAction(s, now);
    return;
  }
  // blockReact: nobody dared challenge the block — the action is canceled.
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
      deadline: 0,
      duration: 0,
      lastEvent: null,
      winnerId: null,
    };
    for (const p of players) {
      state.players[p.id] = { coins: 2, card: deck.pop() ?? null, alive: true, revealed: null };
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
        eliminate(state, targetId!);
        state.lastEvent = {
          type: "coup",
          actorId: pid,
          act: "coup",
          targetId,
          eliminatedId: targetId,
          at: ctx.now,
        };
        pause(state, ctx.now);
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
    if (state.phase === "resolve") {
      endTurn(state);
      return true;
    }
    return false;
  },

  onLeave(state, pid, now): boolean {
    if (!(pid in state.players)) return false;
    const wasAlive = alive(state, pid);
    eliminate(state, pid);
    if (state.phase === "over" || !wasAlive) return true;

    const p = state.pending;
    if (p && (p.actorId === pid || p.targetId === pid || p.blockerId === pid)) {
      // A principal walked out mid-stand-off — drop the action and move on.
      endTurn(state);
      return true;
    }
    if (state.phase === "action" && currentId(state) === pid) {
      endTurn(state);
      return true;
    }
    if (state.phase === "react" || state.phase === "blockReact") {
      // One fewer reactor — the window may now be unanimous.
      checkAllPassed(state, now);
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
  const inWindow = state.phase === "react" || state.phase === "blockReact";
  const isReactor =
    !!viewer &&
    !!me?.alive &&
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
      alive: state.players[id].alive,
      revealed: state.players[id].revealed,
    })),
    currentId: currentId(state),
    youCard: me?.card ?? null,
    deckCount: state.deck.length,
    pending: state.pending,
    deadline: state.deadline,
    duration: state.duration,
    passed: state.passed,
    youCanPass: isReactor,
    youCanChallenge,
    youCanBlock,
    mustCoup:
      state.phase === "action" && state.players[currentId(state)].coins >= MUST_COUP_AT,
    lastEvent: state.lastEvent,
    winnerId: state.winnerId,
    over: state.phase === "over",
  };
}
