// Love Letter (2019 edition, 21 cards, 2-6 players). Each round: one secret
// card in hand; on your turn draw a second and play one, resolving its effect.
// Last player standing - or highest card when the deck runs dry - wins the
// round and a favor token. First to the token target wins the match.
//
// Card rules implemented (values in parentheses):
//   Espionne (0)  no effect; at round end, if exactly ONE player still in the
//                 round has played/discarded a Spy, they gain a bonus token.
//   Garde (1)     name a card (not Guard): if the target holds it, they're out.
//   Prêtre (2)    secretly look at a target's hand.
//   Baron (3)     secretly compare hands; the lower value is eliminated.
//   Servante (4)  protected from all targeting until your next turn.
//   Prince (5)    a player (yourself allowed) discards their hand and redraws
//                 (from the set-aside card if the deck is empty). A discarded
//                 Princess eliminates.
//   Chancelier (6) draw 2, keep 1 of the 3, return the rest under the deck.
//   Roi (7)       trade hands with a target.
//   Comtesse (8)  must be played if your other card is the King or the Prince.
//   Princesse (9) discarding her - however it happens - eliminates you.
//
// Targeted cards with no legal target (everyone else out or protected) are
// played with no effect. Knowledge from Priest/Baron/King is tracked per
// player and invalidated as soon as the seen hand changes.

import type { Player } from "../../../shared/src/types.js";
import type {
  GameAction,
  LoveLetterAction,
  LoveLetterCard,
  LoveLetterEvent,
  LoveLetterRoundResult,
  LoveLetterView,
} from "../../../shared/src/games.js";
import {
  LL_COUNTS,
  LL_CARD_ORDER,
  LL_TOKENS_TO_WIN,
  LL_VALUES,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";

interface LLPlayer {
  hand: LoveLetterCard[];
  discards: LoveLetterCard[];
  alive: boolean;
  shielded: boolean;
  tokens: number;
  /** Played or discarded a Spy this round. */
  spy: boolean;
}

interface LLState {
  phase: "turn" | "chancellor" | "roundEnd" | "over";
  order: string[];
  players: Record<string, LLPlayer>;
  turnIdx: number;
  deck: LoveLetterCard[];
  /** The face-down set-aside card (drawn by a deck-empty Prince). */
  removed: LoveLetterCard | null;
  /** 2-player games: three more cards removed face-up. */
  faceUp: LoveLetterCard[];
  round: number;
  tokensToWin: number;
  /** knowledge[viewer][target] = card legitimately seen, still current. */
  knowledge: Record<string, Record<string, LoveLetterCard>>;
  lastEvent: LoveLetterEvent | null;
  roundResult: LoveLetterRoundResult | null;
  winnerId: string | null;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fullDeck = (): LoveLetterCard[] =>
  shuffle(LL_CARD_ORDER.flatMap((c) => Array(LL_COUNTS[c]).fill(c) as LoveLetterCard[]));

const currentId = (s: LLState) => s.order[s.turnIdx];
const aliveIds = (s: LLState) => s.order.filter((id) => s.players[id].alive);

/** Anything seen about `pid` is stale once their hand changes. */
function forgetHand(s: LLState, pid: string) {
  for (const viewer of Object.keys(s.knowledge)) delete s.knowledge[viewer][pid];
}

function discard(s: LLState, pid: string, card: LoveLetterCard) {
  const p = s.players[pid];
  p.discards.push(card);
  if (card === "spy") p.spy = true;
}

function eliminate(s: LLState, pid: string) {
  const p = s.players[pid];
  p.alive = false;
  // The hand goes face-up on the discard pile.
  for (const card of p.hand) discard(s, pid, card);
  p.hand = [];
  forgetHand(s, pid);
}

/** Legal targets for guard/priest/baron/king: other living, unprotected players. */
function targetsFor(s: LLState, pid: string): string[] {
  return aliveIds(s).filter((id) => id !== pid && !s.players[id].shielded);
}

function startRound(s: LLState, starterId: string | null) {
  s.deck = fullDeck();
  s.removed = s.deck.pop() ?? null;
  s.faceUp = s.order.length === 2 ? [s.deck.pop()!, s.deck.pop()!, s.deck.pop()!] : [];
  for (const id of s.order) {
    const p = s.players[id];
    p.hand = [s.deck.pop()!];
    p.discards = [];
    p.alive = true;
    p.shielded = false;
    p.spy = false;
  }
  s.knowledge = Object.fromEntries(s.order.map((id) => [id, {}]));
  s.round += 1;
  s.roundResult = null;
  s.lastEvent = null;
  const startIdx = starterId ? s.order.indexOf(starterId) : 0;
  s.turnIdx = startIdx === -1 ? 0 : startIdx;
  s.phase = "turn";
  beginTurn(s);
}

/** The current player's turn opens: shield drops, they draw their 2nd card. */
function beginTurn(s: LLState) {
  const p = s.players[currentId(s)];
  p.shielded = false;
  p.hand.push(s.deck.pop()!);
  // NB: drawing a 2nd card does NOT stale others' intel — the peeked card is
  // still in hand. Knowledge is cleared only when a card actually leaves the
  // hand (play/swap/forced discard/elimination), handled at those sites.
}

function endRound(s: LLState) {
  const alive = aliveIds(s);
  let winnerId: string | null = null;
  let reason: LoveLetterRoundResult["reason"] = "lastAlive";
  const revealed: Record<string, LoveLetterCard> = {};
  for (const id of alive) revealed[id] = s.players[id].hand[0];

  if (alive.length === 1) {
    winnerId = alive[0];
  } else {
    reason = "highest";
    // Highest card wins; ties break on the sum of discarded values.
    const strength = (id: string) => {
      const p = s.players[id];
      const sum = p.discards.reduce((acc, c) => acc + LL_VALUES[c], 0);
      return LL_VALUES[p.hand[0]] * 1000 + sum;
    };
    winnerId = alive.reduce((best, id) => (strength(id) > strength(best) ? id : best), alive[0]);
  }

  // Spy bonus: exactly one player still in the round played/discarded a Spy.
  const spies = alive.filter((id) => s.players[id].spy);
  const spyBonusId = spies.length === 1 ? spies[0] : null;

  if (winnerId) s.players[winnerId].tokens += 1;
  if (spyBonusId) s.players[spyBonusId].tokens += 1;

  s.roundResult = { winnerId, reason, revealed, spyBonusId };

  const champion = s.order.find((id) => s.players[id].tokens >= s.tokensToWin) ?? null;
  if (champion) {
    s.phase = "over";
    s.winnerId = champion;
  } else {
    s.phase = "roundEnd";
  }
}

/** After a resolved play: round over, or pass the turn and draw. */
function endTurn(s: LLState) {
  if (aliveIds(s).length <= 1) {
    endRound(s);
    return;
  }
  if (s.deck.length === 0) {
    endRound(s);
    return;
  }
  do {
    s.turnIdx = (s.turnIdx + 1) % s.order.length;
  } while (!s.players[currentId(s)].alive);
  s.phase = "turn";
  beginTurn(s);
}

export const loveletter: GameEngine<LLState> = {
  init(players: Player[], _now: number, _opts: InitOptions): LLState {
    const state: LLState = {
      phase: "turn",
      order: players.map((p) => p.id),
      players: {},
      turnIdx: 0,
      deck: [],
      removed: null,
      faceUp: [],
      round: 0,
      tokensToWin: LL_TOKENS_TO_WIN[players.length] ?? 3,
      knowledge: {},
      lastEvent: null,
      roundResult: null,
      winnerId: null,
    };
    for (const p of players) {
      state.players[p.id] = {
        hand: [],
        discards: [],
        alive: true,
        shielded: false,
        tokens: 0,
        spy: false,
      };
    }
    startRound(state, null);
    return state;
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    if (state.phase === "over") return false;
    const a = action as LoveLetterAction;
    const p = state.players[pid];
    if (!p) return false;

    if (a.type === "next") {
      if (state.phase !== "roundEnd" || !ctx.isHost) return false;
      startRound(state, state.roundResult?.winnerId ?? null);
      return true;
    }

    if (pid !== currentId(state)) return false;

    if (a.type === "keep") {
      if (state.phase !== "chancellor" || !p.hand.includes(a.card)) return false;
      // Keep one; the rest slide under the deck in hand order.
      const keepIdx = p.hand.indexOf(a.card);
      const rest = p.hand.filter((_, i) => i !== keepIdx);
      p.hand = [a.card];
      state.deck.unshift(...rest);
      endTurn(state);
      return true;
    }

    if (a.type !== "play" || state.phase !== "turn") return false;
    const idx = p.hand.indexOf(a.card);
    if (idx === -1) return false;

    // The Countess locks the King and the Prince while she's in hand.
    if ((a.card === "king" || a.card === "prince") && p.hand.includes("countess")) return false;

    const needsOther = a.card === "guard" || a.card === "priest" || a.card === "baron" || a.card === "king";
    const legal = targetsFor(state, pid);
    let target: string | null = null;
    if (needsOther) {
      if (a.target) {
        if (!legal.includes(a.target)) return false;
        target = a.target;
      } else if (legal.length > 0) {
        return false; // a target exists, you must pick one
      }
      // No legal target → the card is played with no effect.
    }
    if (a.card === "prince") {
      if (!a.target) return false;
      const ok = a.target === pid || legal.includes(a.target);
      if (!ok || !state.players[a.target].alive) return false;
      target = a.target;
    }
    if (a.card === "guard" && target) {
      if (!a.guess || a.guess === "guard") return false;
    }

    // The card leaves the hand, face-up.
    p.hand.splice(idx, 1);
    discard(state, pid, a.card);
    forgetHand(state, pid);

    const event: LoveLetterEvent = {
      actor: pid,
      card: a.card,
      targetId: target,
      guess: a.card === "guard" ? a.guess ?? null : null,
      at: ctx.now,
    };

    if (a.card === "princess") {
      // Playing her voluntarily is legal - and fatal.
      eliminate(state, pid);
      event.eliminatedId = pid;
    } else if (a.card === "handmaid") {
      p.shielded = true;
    } else if (a.card === "spy") {
      // No effect now; counted at round end.
    } else if (a.card === "countess") {
      // No effect.
    } else if (a.card === "chancellor") {
      const drawn = Math.min(2, state.deck.length);
      for (let i = 0; i < drawn; i++) p.hand.push(state.deck.pop()!);
      if (drawn > 0) {
        state.phase = "chancellor";
        state.lastEvent = event;
        return true; // the turn finishes after the "keep" choice
      }
      event.noEffect = true;
    } else if (needsOther && !target) {
      event.noEffect = true;
    } else if (a.card === "guard") {
      const t = state.players[target!];
      if (t.hand[0] === a.guess) {
        eliminate(state, target!);
        event.eliminatedId = target;
      }
    } else if (a.card === "priest") {
      state.knowledge[pid][target!] = state.players[target!].hand[0];
    } else if (a.card === "baron") {
      const mine = LL_VALUES[p.hand[0]];
      const theirs = LL_VALUES[state.players[target!].hand[0]];
      // Both duelists see each other's card, whatever the outcome.
      state.knowledge[pid][target!] = state.players[target!].hand[0];
      state.knowledge[target!][pid] = p.hand[0];
      if (mine > theirs) {
        eliminate(state, target!);
        event.eliminatedId = target;
      } else if (theirs > mine) {
        eliminate(state, pid);
        event.eliminatedId = pid;
      } else {
        event.tie = true;
      }
    } else if (a.card === "prince") {
      const t = state.players[target!];
      const dropped = t.hand.pop()!;
      discard(state, target!, dropped);
      if (dropped === "princess") {
        eliminate(state, target!);
        event.eliminatedId = target;
      } else {
        // Redraw - from the set-aside card when the deck is dry.
        const fresh = state.deck.pop() ?? state.removed;
        if (fresh === state.removed) state.removed = null;
        if (fresh) t.hand.push(fresh);
        forgetHand(state, target!);
      }
    } else if (a.card === "king") {
      const t = state.players[target!];
      const mine = p.hand[0];
      p.hand[0] = t.hand[0];
      t.hand[0] = mine;
      forgetHand(state, pid);
      forgetHand(state, target!);
      // Both traders know exactly what they handed over.
      state.knowledge[pid][target!] = t.hand[0];
      state.knowledge[target!][pid] = p.hand[0];
    }

    state.lastEvent = event;
    endTurn(state);
    return true;
  },

  tick: () => false,

  onLeave(state, pid): boolean {
    const idx = state.order.indexOf(pid);
    if (idx === -1) return false;
    const wasCurrent = state.phase !== "roundEnd" && state.phase !== "over" && currentId(state) === pid;
    if (state.players[pid].alive) eliminate(state, pid);
    state.order.splice(idx, 1);
    delete state.players[pid];
    for (const viewer of Object.keys(state.knowledge)) delete state.knowledge[viewer][pid];
    delete state.knowledge[pid];

    if (state.order.length === 0) {
      state.phase = "over";
      return true;
    }
    if (idx < state.turnIdx) state.turnIdx -= 1;
    state.turnIdx %= state.order.length;

    if (state.order.length === 1) {
      state.phase = "over";
      state.winnerId = state.order[0];
      return true;
    }
    if (state.phase === "turn" || state.phase === "chancellor") {
      if (aliveIds(state).length <= 1) {
        endRound(state);
      } else if (wasCurrent) {
        // It was their turn: hand discarded with them; play moves on.
        if (state.deck.length === 0) endRound(state);
        else {
          // turnIdx now points at the next seat already.
          state.turnIdx = (state.turnIdx + state.order.length - 1) % state.order.length;
          state.phase = "turn";
          endTurnAfterLeave(state);
        }
      }
    }
    return true;
  },

  isOver: (state) => state.phase === "over",

  view: (state) => llView(state, null),
  playerView: (state, pid) => llView(state, pid),
};

/** Advance past the seat that just vanished (mirrors endTurn's walk). */
function endTurnAfterLeave(s: LLState) {
  do {
    s.turnIdx = (s.turnIdx + 1) % s.order.length;
  } while (!s.players[currentId(s)].alive);
  beginTurn(s);
}

function llView(state: LLState, viewer: string | null): LoveLetterView {
  const me = viewer ? state.players[viewer] : undefined;
  return {
    kind: "loveletter",
    phase: state.phase,
    players: state.order.map((id) => ({
      id,
      tokens: state.players[id].tokens,
      alive: state.players[id].alive,
      shielded: state.players[id].shielded,
      handCount: state.players[id].hand.length,
      discards: state.players[id].discards,
    })),
    currentId: currentId(state) ?? "",
    round: state.round,
    tokensToWin: state.tokensToWin,
    deckCount: state.deck.length,
    faceUp: state.faceUp,
    yourHand: me?.hand ?? [],
    youKnow: viewer ? { ...(state.knowledge[viewer] ?? {}) } : {},
    lastEvent: state.lastEvent,
    roundResult: state.phase === "roundEnd" || state.phase === "over" ? state.roundResult : null,
    winnerId: state.winnerId,
    over: state.phase === "over",
  };
}
