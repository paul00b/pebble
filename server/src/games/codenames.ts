// Codenames — two teams race to contact all their agents. Each team's spymaster
// (who alone sees the key) gives a one-word clue + a number; their operatives
// guess words on the 5×5 grid. Hit the assassin and you lose instantly.

import type { Player } from "../../../shared/src/types.js";
import type {
  CodenamesAction,
  CodenamesCardColor,
  CodenamesMember,
  CodenamesTeam,
  CodenamesView,
  GameAction,
} from "../../../shared/src/games.js";
import type { ActionContext, GameEngine, InitOptions } from "./engine.js";
import { pickCodenamesWords } from "./codenamesWords.js";

const other = (t: CodenamesTeam): CodenamesTeam => (t === "red" ? "blue" : "red");

interface CNState {
  phase: "setup" | "clue" | "guess" | "over";
  words: string[];
  key: CodenamesCardColor[];
  revealed: (CodenamesCardColor | null)[];
  members: Record<string, { team: CodenamesTeam | null; role: "spymaster" | "operative" }>;
  order: string[];
  turnTeam: CodenamesTeam;
  clue: { word: string; count: number } | null;
  guessesLeft: number;
  remaining: { red: number; blue: number };
  winner: CodenamesTeam | null;
  endReason: "swept" | "assassin" | null;
}

function buildKey(startTeam: CodenamesTeam): CodenamesCardColor[] {
  const cells: CodenamesCardColor[] = [
    ...Array(9).fill(startTeam),
    ...Array(8).fill(other(startTeam)),
    ...Array(7).fill("neutral"),
    "assassin",
  ];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

/** Each team needs ≥1 spymaster and ≥1 operative to begin. */
function teamsReady(state: CNState): boolean {
  const has = (team: CodenamesTeam, role: "spymaster" | "operative") =>
    state.order.some((id) => state.members[id].team === team && state.members[id].role === role);
  return (
    has("red", "spymaster") && has("red", "operative") &&
    has("blue", "spymaster") && has("blue", "operative")
  );
}

export const codenames: GameEngine<CNState> = {
  init(players: Player[], _now: number, opts: InitOptions): CNState {
    const startTeam: CodenamesTeam = Math.random() < 0.5 ? "red" : "blue";
    const members: CNState["members"] = {};
    // Auto-balance starting teams so setup is fast: alternate red/blue.
    players.forEach((p, i) => {
      members[p.id] = { team: i % 2 === 0 ? "red" : "blue", role: "operative" };
    });
    return {
      phase: "setup",
      words: pickCodenamesWords(opts.language),
      key: buildKey(startTeam),
      revealed: Array(25).fill(null),
      members,
      order: players.map((p) => p.id),
      turnTeam: startTeam,
      clue: null,
      guessesLeft: 0,
      remaining: { red: startTeam === "red" ? 9 : 8, blue: startTeam === "blue" ? 9 : 8 },
      winner: null,
      endReason: null,
    };
  },

  action(state, pid, action: GameAction, ctx: ActionContext): boolean {
    if (state.phase === "over") return false;
    const a = action as CodenamesAction;
    const me = state.members[pid];
    if (!me) return false;

    if (a.type === "setTeam") {
      if (state.phase !== "setup") return false;
      me.team = a.team;
      return true;
    }
    if (a.type === "setRole") {
      if (state.phase !== "setup") return false;
      me.role = a.role;
      return true;
    }
    if (a.type === "begin") {
      if (state.phase !== "setup" || !ctx.isHost || !teamsReady(state)) return false;
      state.phase = "clue";
      return true;
    }
    if (a.type === "clue") {
      if (state.phase !== "clue" || me.team !== state.turnTeam || me.role !== "spymaster")
        return false;
      const count = Math.max(0, Math.min(9, Math.floor(a.count)));
      state.clue = { word: a.word.trim().slice(0, 30), count };
      state.guessesLeft = count + 1; // one bonus guess, per the rules
      state.phase = "guess";
      return true;
    }
    if (a.type === "endTurn") {
      if (state.phase !== "guess" || me.team !== state.turnTeam || me.role !== "operative")
        return false;
      endTurn(state);
      return true;
    }
    if (a.type === "guess") {
      if (state.phase !== "guess" || me.team !== state.turnTeam || me.role !== "operative")
        return false;
      if (a.index < 0 || a.index >= 25 || state.revealed[a.index] !== null) return false;

      const color = state.key[a.index];
      state.revealed[a.index] = color;

      if (color === "assassin") {
        state.winner = other(state.turnTeam);
        state.endReason = "assassin";
        state.phase = "over";
        return true;
      }
      if (color === "neutral") {
        endTurn(state);
        return true;
      }
      // A team-colored card.
      state.remaining[color] = Math.max(0, state.remaining[color] - 1);
      if (state.remaining[color] === 0) {
        state.winner = color;
        state.endReason = "swept";
        state.phase = "over";
        return true;
      }
      if (color === state.turnTeam) {
        state.guessesLeft -= 1;
        if (state.guessesLeft <= 0) endTurn(state);
      } else {
        // Helped the other team — turn ends immediately.
        endTurn(state);
      }
      return true;
    }
    return false;
  },

  tick: () => false,

  onLeave(state, pid): boolean {
    if (!state.members[pid]) return false;
    delete state.members[pid];
    state.order = state.order.filter((id) => id !== pid);
    if (state.order.length === 0 && state.phase !== "over") {
      state.phase = "over";
      state.winner = null;
    }
    return true;
  },

  isOver: (state) => state.phase === "over",

  view: (state) => cnView(state, null),
  playerView: (state, pid) => cnView(state, pid),
};

function endTurn(state: CNState) {
  state.turnTeam = other(state.turnTeam);
  state.clue = null;
  state.guessesLeft = 0;
  state.phase = "clue";
}

function cnView(state: CNState, viewer: string | null): CodenamesView {
  const me = viewer ? state.members[viewer] : undefined;
  const isSpymaster = me?.role === "spymaster";
  const showKey = isSpymaster && state.phase !== "setup";

  const members: CodenamesMember[] = state.order.map((id) => ({
    id,
    team: state.members[id].team,
    role: state.members[id].role,
  }));

  return {
    kind: "codenames",
    phase: state.phase,
    words: state.words,
    revealed: state.revealed,
    key: showKey ? state.key.slice() : Array(25).fill(null),
    members,
    turnTeam: state.turnTeam,
    clue: state.clue,
    guessesLeft: state.guessesLeft,
    remaining: state.remaining,
    youTeam: me?.team ?? null,
    youRole: me?.role ?? "operative",
    winner: state.winner,
    endReason: state.endReason,
  };
}
