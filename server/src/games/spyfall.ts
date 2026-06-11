// Spyfall — everyone secretly shares a location (and a role in it) except one
// player: the spy. The group asks each other questions out loud; the app keeps
// the clock, the secret cards, the "who's asking" cue and the endgame votes.
//
// Round flow:
//   playing  — the timer runs; players interrogate each other. At any moment
//              the spy may guess the location (right = spy wins, wrong = crew
//              wins) and any player may call ONE emergency vote. The timer
//              running out also triggers the vote.
//   voting   — everyone secretly picks a suspect. A unique plurality accuses;
//              a tie (or apathy) lets the spy escape.
//   spyguess — the vote landed on the spy: they get one last-chance location
//              guess to steal the win.
//   over     — full reveal.

import type { Player } from "../../../shared/src/types.js";
import type {
  GameAction,
  SpyfallAction,
  SpyfallReason,
  SpyfallView,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";
import { sanitizeSpyfall, type SpyfallSettings } from "../../../shared/src/settings.js";
import { locationNames, pickLocation } from "./spyfallLocations.js";

/** How long the secret vote stays open before it resolves with the cast votes. */
const VOTE_MS = 60_000;
/** How long a caught spy gets for the steal guess. */
const STEAL_MS = 40_000;

interface SFState {
  phase: "playing" | "voting" | "spyguess" | "over";
  order: string[];
  askerIdx: number;
  spyId: string;
  location: string;
  /** Secret role per non-spy player. */
  roles: Record<string, string>;
  /** The public list of every possible location. */
  locations: string[];
  deadline: number;
  duration: number;
  /** Players who already used their one emergency-vote call. */
  calledVote: string[];
  calledBy: string | null;
  /** Secret ballots: voter → suspect. */
  votes: Record<string, string>;
  accusedId: string | null;
  spyGuess: string | null;
  winner: "spy" | "crew" | null;
  reason: SpyfallReason | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function finish(s: SFState, winner: "spy" | "crew", reason: SpyfallReason) {
  s.phase = "over";
  s.winner = winner;
  s.reason = reason;
  s.deadline = 0;
}

function startVoting(s: SFState, now: number, calledBy: string | null) {
  s.phase = "voting";
  s.calledBy = calledBy;
  s.votes = {};
  s.deadline = now + VOTE_MS;
  s.duration = VOTE_MS;
}

/** Tally the ballots; a unique plurality accuses, anything else lets the spy slip. */
function resolveVotes(s: SFState, now: number) {
  const tally = new Map<string, number>();
  for (const target of Object.values(s.votes)) {
    tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [id, n] of tally) {
    if (n > bestCount) {
      best = id;
      bestCount = n;
      tied = false;
    } else if (n === bestCount) {
      tied = true;
    }
  }
  if (!best || tied) {
    finish(s, "spy", "escaped");
    return;
  }
  s.accusedId = best;
  if (best === s.spyId) {
    // Caught — but the spy gets one shot at naming the location.
    s.phase = "spyguess";
    s.deadline = now + STEAL_MS;
    s.duration = STEAL_MS;
  } else {
    finish(s, "spy", "innocent");
  }
}

export const spyfall: GameEngine<SFState> = {
  init(players: Player[], now: number, opts: InitOptions): SFState {
    const rules: SpyfallSettings = sanitizeSpyfall(
      (opts.settings ?? {}) as Partial<SpyfallSettings>
    );
    const order = players.map((p) => p.id);
    const spot = pickLocation(opts.language);
    const spyId = order[Math.floor(Math.random() * order.length)];
    const roles: Record<string, string> = {};
    const pool = shuffle(spot.roles);
    let i = 0;
    for (const id of order) {
      if (id === spyId) continue;
      roles[id] = pool[i % pool.length];
      i++;
    }
    const roundMs = rules.roundSec * 1000;
    return {
      phase: "playing",
      order,
      askerIdx: Math.floor(Math.random() * order.length),
      spyId,
      location: spot.name,
      roles,
      locations: locationNames(opts.language),
      deadline: now + roundMs,
      duration: roundMs,
      calledVote: [],
      calledBy: null,
      votes: {},
      accusedId: null,
      spyGuess: null,
      winner: null,
      reason: null,
    };
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    if (state.phase === "over" || !state.order.includes(pid)) return false;
    const a = action as SpyfallAction;

    if (a.type === "nextAsker") {
      if (state.phase !== "playing") return false;
      if (state.order[state.askerIdx] !== pid && !ctx.isHost) return false;
      state.askerIdx = (state.askerIdx + 1) % state.order.length;
      return true;
    }

    if (a.type === "callVote") {
      if (state.phase !== "playing" || state.calledVote.includes(pid)) return false;
      state.calledVote.push(pid);
      startVoting(state, ctx.now, pid);
      return true;
    }

    if (a.type === "vote") {
      if (state.phase !== "voting") return false;
      if (!state.order.includes(a.playerId) || a.playerId === pid) return false;
      state.votes[pid] = a.playerId;
      if (Object.keys(state.votes).length >= state.order.length) {
        resolveVotes(state, ctx.now);
      }
      return true;
    }

    if (a.type === "spyGuess") {
      if (pid !== state.spyId) return false;
      if (a.index < 0 || a.index >= state.locations.length) return false;
      const guess = state.locations[a.index];
      if (state.phase === "playing") {
        state.spyGuess = guess;
        finish(state, guess === state.location ? "spy" : "crew", guess === state.location ? "guess" : "wrongGuess");
        return true;
      }
      if (state.phase === "spyguess") {
        state.spyGuess = guess;
        finish(state, guess === state.location ? "spy" : "crew", guess === state.location ? "steal" : "caught");
        return true;
      }
      return false;
    }

    return false;
  },

  tick(state, now): boolean {
    if (state.phase === "over" || now < state.deadline) return false;
    if (state.phase === "playing") {
      startVoting(state, now, null);
      return true;
    }
    if (state.phase === "voting") {
      resolveVotes(state, now);
      return true;
    }
    // spyguess timeout — the spy froze, the crew takes it.
    finish(state, "crew", "caught");
    return true;
  },

  onLeave(state, pid): boolean {
    if (!state.order.includes(pid)) return false;
    const wasAsker = state.order[state.askerIdx] === pid;
    const idx = state.order.indexOf(pid);
    state.order = state.order.filter((id) => id !== pid);
    delete state.roles[pid];
    delete state.votes[pid];
    for (const [voter, target] of Object.entries(state.votes)) {
      if (target === pid) delete state.votes[voter];
    }
    if (state.phase === "over") return true;

    if (pid === state.spyId) {
      finish(state, "crew", "left");
      return true;
    }
    if (state.order.length < 2) {
      finish(state, "spy", "escaped");
      return true;
    }
    // Keep the asking cue pointing at a real player.
    if (idx < state.askerIdx || (wasAsker && state.askerIdx >= state.order.length)) {
      state.askerIdx = Math.max(0, state.askerIdx - 1);
    }
    state.askerIdx %= state.order.length;
    // The departure may have completed the ballot.
    if (state.phase === "voting" && Object.keys(state.votes).length >= state.order.length) {
      resolveVotes(state, Date.now());
    }
    return true;
  },

  isOver: (state) => state.phase === "over",

  view: (state) => sfView(state, null),
  playerView: (state, pid) => sfView(state, pid),
};

function sfView(state: SFState, viewer: string | null): SpyfallView {
  const over = state.phase === "over";
  const youAreSpy = viewer === state.spyId;
  const spyRevealed = over || state.phase === "spyguess";
  // Your secret card: non-spies always see it; everyone sees it at the reveal.
  const showLocation = (viewer != null && !youAreSpy) || over;
  return {
    kind: "spyfall",
    phase: state.phase,
    order: state.order,
    askerId: state.order[state.askerIdx] ?? "",
    deadline: state.deadline,
    duration: state.duration,
    locations: state.locations,
    youAreSpy,
    location: showLocation ? state.location : null,
    role: viewer != null && !youAreSpy ? state.roles[viewer] ?? null : null,
    calledBy: state.calledBy,
    canCallVote:
      viewer != null && state.phase === "playing" && !state.calledVote.includes(viewer),
    voted: Object.keys(state.votes),
    youVote: viewer != null ? state.votes[viewer] ?? null : null,
    spyId: spyRevealed ? state.spyId : null,
    accusedId: state.accusedId,
    spyGuess: over ? state.spyGuess : null,
    winner: state.winner,
    reason: state.reason,
    over,
  };
}
