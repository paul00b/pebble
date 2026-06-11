// Devine 9 - two teams take turns. On a turn, one team (the "checker") holds the
// card: they see the theme, the 9 answers and the bomb word, read the theme aloud
// and tick answers as the OTHER team (the active/guessing team) shouts them out.
// Each ticked answer = +1; saying the bomb word = −5 (the timer keeps running).
// When the timer runs out - or all 9 are found - points go to the guessing team
// and the card is revealed to everyone. Highest total after N turns each wins.

import type { Player } from "../../../shared/src/types.js";
import type {
  Devine9Action,
  Devine9Member,
  Devine9Team,
  Devine9View,
  GameAction,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";
import { sanitizeDevine9, type Devine9Settings } from "../../../shared/src/settings.js";
import { pickRound, type Devine9Round } from "./devine9Themes.js";

const BOMB_PENALTY = 5;
const WORDS = 9;

const other = (t: Devine9Team): Devine9Team => (t === "red" ? "blue" : "red");

interface D9State {
  language: InitOptions["language"];
  phase: "setup" | "play" | "reveal" | "over";
  members: Record<string, Devine9Team | null>;
  order: string[];
  /** Team currently guessing aloud; the other team holds the card. */
  activeTeam: Devine9Team;
  turnIndex: number; // 0-based
  totalTurns: number;
  round: Devine9Round | null;
  found: boolean[];
  bombHit: boolean;
  started: boolean;
  deadline: number;
  scores: Record<Devine9Team, number>;
  roundPoints: number | null;
  turnMs: number;
  turnSec: number;
  winner: Devine9Team | "tie" | null;
  usedPrompts: string[];
}

const teamHasPlayers = (s: D9State, team: Devine9Team) =>
  s.order.some((id) => s.members[id] === team);

const checkerTeam = (s: D9State): Devine9Team => other(s.activeTeam);

function beginTurn(s: D9State, now: number) {
  s.round = pickRound(s.language, new Set(s.usedPrompts));
  s.usedPrompts.push(s.round.prompt);
  s.found = Array(WORDS).fill(false);
  s.bombHit = false;
  s.started = false;
  s.deadline = 0;
  s.roundPoints = null;
  s.phase = "play";
}

function turnPoints(s: D9State): number {
  const found = s.found.filter(Boolean).length;
  return found - (s.bombHit ? BOMB_PENALTY : 0);
}

/** Close the current turn: commit points to the guessing team, reveal the card. */
function endTurn(s: D9State) {
  s.roundPoints = turnPoints(s);
  s.scores[s.activeTeam] += s.roundPoints;
  s.started = false;
  s.phase = "reveal";
}

/** Re-bank the turn's points after a reveal-time correction (the checker fixing
 *  answers they didn't hear before the buzzer). Applies only the delta so the
 *  committed score stays consistent. */
function syncRevealScore(s: D9State) {
  const prev = s.roundPoints ?? 0;
  const next = turnPoints(s);
  s.scores[s.activeTeam] += next - prev;
  s.roundPoints = next;
}

function finish(s: D9State) {
  s.phase = "over";
  s.winner =
    s.scores.red === s.scores.blue ? "tie" : s.scores.red > s.scores.blue ? "red" : "blue";
}

export const devine9: GameEngine<D9State> = {
  init(players: Player[], _now: number, opts: InitOptions): D9State {
    const rules: Devine9Settings = sanitizeDevine9(
      (opts.settings ?? {}) as Partial<Devine9Settings>
    );
    const members: Record<string, Devine9Team | null> = {};
    // Auto-balance: alternate red/blue so teams are roughly even from the start.
    players.forEach((p, i) => {
      members[p.id] = i % 2 === 0 ? "red" : "blue";
    });
    return {
      language: opts.language,
      phase: "setup",
      members,
      order: players.map((p) => p.id),
      activeTeam: "red",
      turnIndex: 0,
      totalTurns: rules.roundsPerTeam * 2,
      round: null,
      found: Array(WORDS).fill(false),
      bombHit: false,
      started: false,
      deadline: 0,
      scores: { red: 0, blue: 0 },
      roundPoints: null,
      turnMs: rules.turnSec * 1000,
      turnSec: rules.turnSec,
      winner: null,
      usedPrompts: [],
    };
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    if (state.phase === "over") return false;
    const a = action as Devine9Action;
    if (!(pid in state.members)) return false;

    if (a.type === "setTeam") {
      if (state.phase !== "setup") return false;
      state.members[pid] = a.team;
      return true;
    }

    if (a.type === "begin") {
      if (state.phase !== "setup" || !ctx.isHost) return false;
      if (!teamHasPlayers(state, "red") || !teamHasPlayers(state, "blue")) return false;
      beginTurn(state, ctx.now);
      return true;
    }

    // Only the checker team drives a turn (start / validate / bomb).
    const isChecker = state.members[pid] === checkerTeam(state);

    if (a.type === "start") {
      if (state.phase !== "play" || state.started || !isChecker) return false;
      state.started = true;
      state.deadline = ctx.now + state.turnMs;
      return true;
    }

    if (a.type === "validate") {
      if (!isChecker) return false;
      if (a.index < 0 || a.index >= WORDS) return false;
      if (state.phase === "play" && state.started) {
        state.found[a.index] = !state.found[a.index];
        if (state.found.every(Boolean)) endTurn(state); // all 9 → end early
        return true;
      }
      // Correction window: tick / untick mis-heard answers after the buzzer,
      // while the card is revealed. The team's banked points adjust live.
      if (state.phase === "reveal") {
        state.found[a.index] = !state.found[a.index];
        syncRevealScore(state);
        return true;
      }
      return false;
    }

    if (a.type === "bomb") {
      if (!isChecker) return false;
      if (state.phase === "play" && state.started) {
        state.bombHit = !state.bombHit; // toggle (misclick-safe); timer keeps running
        return true;
      }
      if (state.phase === "reveal") {
        state.bombHit = !state.bombHit;
        syncRevealScore(state);
        return true;
      }
      return false;
    }

    if (a.type === "next") {
      if (state.phase !== "reveal" || !ctx.isHost) return false;
      if (state.turnIndex + 1 >= state.totalTurns) {
        finish(state);
      } else {
        state.turnIndex += 1;
        state.activeTeam = other(state.activeTeam);
        beginTurn(state, ctx.now);
      }
      return true;
    }

    return false;
  },

  tick(state, now): boolean {
    if (state.phase !== "play" || !state.started) return false;
    if (now < state.deadline) return false;
    endTurn(state);
    return true;
  },

  onLeave(state, pid): boolean {
    if (!(pid in state.members)) return false;
    delete state.members[pid];
    state.order = state.order.filter((id) => id !== pid);
    if (state.phase === "setup" || state.phase === "over") return true;
    // A team can no longer play → end the match on current scores.
    if (state.order.length === 0 || !teamHasPlayers(state, "red") || !teamHasPlayers(state, "blue")) {
      finish(state);
    }
    return true;
  },

  isOver: (state) => state.phase === "over",

  view: (state) => d9View(state, null),
  playerView: (state, pid) => d9View(state, pid),
};

function d9View(state: D9State, viewer: string | null): Devine9View {
  const myTeam = viewer ? state.members[viewer] ?? null : null;
  const isChecker = myTeam === checkerTeam(state);
  const revealAll = state.phase === "reveal" || state.phase === "over";
  const showCard = (state.phase === "play" && isChecker) || revealAll;

  const members: Devine9Member[] = state.order.map((id) => ({
    id,
    team: state.members[id] ?? null,
  }));

  return {
    kind: "devine9",
    phase: state.phase,
    members,
    activeTeam: state.activeTeam,
    turn: state.turnIndex + 1,
    totalTurns: state.totalTurns,
    prompt: showCard ? state.round?.prompt ?? null : null,
    answers: showCard ? state.round?.answers ?? null : null,
    bomb: showCard ? state.round?.bomb ?? null : null,
    found: state.found.slice(),
    foundCount: state.found.filter(Boolean).length,
    bombHit: state.bombHit,
    started: state.started,
    deadline: state.deadline,
    turnSec: state.turnSec,
    scores: { ...state.scores },
    roundPoints: state.phase === "reveal" ? state.roundPoints : null,
    youTeam: myTeam,
    // The card-holder can tick answers both during the timer and in the reveal
    // correction window, so this stays true across play + reveal.
    youAreChecker: (state.phase === "play" || state.phase === "reveal") && isChecker,
    winner: state.winner,
  };
}
