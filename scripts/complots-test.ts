// Deterministic unit tests for Complots (one-card Coup). No server needed.
import { complots } from "../server/src/games/complots.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🎭", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

const at = (now: number) => ({ now, isHost: false });
const P = at(1000);

const fresh = (): any =>
  complots.init(players("a", "b", "c", "d"), 1000, { language: "en", settings: {} });

// A. Init: one card + two coins each, deck holds the rest.
{
  const s = fresh();
  ok(s.order.length === 4 && s.deck.length === 12 - 4, "cp: 3×4 roles dealt, 8 left in deck");
  ok(s.order.every((id: string) => s.players[id].card && s.players[id].coins === 2),
    "cp: everyone starts with a hidden card and 2 coins");
  ok(s.phase === "action" && s.order[s.turnIdx] === "a", "cp: first seat opens");
}

// B. Income is instant and unstoppable.
{
  const s = fresh();
  ok(complots.action(s, "b", { type: "act", act: "income" }, P) === false, "cp: only the current player acts");
  complots.action(s, "a", { type: "act", act: "income" }, P);
  ok(s.players.a.coins === 3 && s.order[s.turnIdx] === "b" && s.phase === "action",
    "cp: income pays 1 and passes the turn");
}

// C. Tax opens a reaction window; unanimous passes let it through.
{
  const s = fresh();
  complots.action(s, "a", { type: "act", act: "tax" }, P);
  ok(s.phase === "react" && s.pending.claim === "duke" && s.deadline === 1000 + 15_000,
    "cp: tax claims the Duke and opens the window");
  ok(complots.action(s, "a", { type: "pass" }, P) === false, "cp: the actor doesn't react");
  complots.action(s, "b", { type: "pass" }, P);
  complots.action(s, "c", { type: "pass" }, P);
  ok(s.phase === "react", "cp: window stays open until everyone reacted");
  complots.action(s, "d", { type: "pass" }, P);
  ok(s.players.a.coins === 5 && s.phase === "action" && s.order[s.turnIdx] === "b",
    "cp: unchallenged tax pays 3");
}

// D. A truthful claim kills the challenger (and the action goes through).
{
  const s = fresh();
  s.players.a.card = "duke";
  complots.action(s, "a", { type: "act", act: "tax" }, P);
  complots.action(s, "b", { type: "challenge" }, P);
  ok(s.phase === "resolve", "cp: a challenge resolves immediately");
  ok(s.players.b.alive === false && s.players.b.revealed != null,
    "cp: the wrongful accuser is eliminated");
  ok(s.players.a.alive && s.players.a.card != null, "cp: the truthful claimer draws a fresh card");
  ok(s.players.a.coins === 5, "cp: the surviving action still pays");
  ok(s.lastEvent.type === "challenge" && s.lastEvent.truthful === true && s.lastEvent.shown === "duke",
    "cp: the verification is narrated");
  complots.tick(s, s.deadline);
  ok(s.phase === "action" && s.order[s.turnIdx] === "c", "cp: play resumes after the pause, skipping the dead");
}

// E. A bluff caught costs the bluffer their card.
{
  const s = fresh();
  s.players.a.card = "assassin"; // not the Duke they claim
  complots.action(s, "a", { type: "act", act: "tax" }, P);
  complots.action(s, "c", { type: "challenge" }, P);
  ok(s.players.a.alive === false && s.players.a.revealed === "assassin", "cp: the liar is eliminated");
  ok(s.players.a.coins === 2, "cp: a busted tax pays nothing");
}

// F. Steal: the target can counter-claim the Captain; an unchallenged block stands.
{
  const s = fresh();
  complots.action(s, "a", { type: "act", act: "steal", target: "b" }, P);
  ok(s.phase === "react" && s.pending.targetId === "b", "cp: steal targets a player");
  ok(complots.action(s, "c", { type: "block" }, P) === false, "cp: only the target may block a steal");
  complots.action(s, "b", { type: "block" }, P);
  ok(s.phase === "blockReact" && s.pending.blockRole === "captain", "cp: the block is a Captain claim");
  complots.action(s, "a", { type: "pass" }, P);
  complots.action(s, "c", { type: "pass" }, P);
  complots.action(s, "d", { type: "pass" }, P);
  ok(s.phase === "resolve" && s.lastEvent.type === "blocked", "cp: nobody dares - the block stands");
  ok(s.players.a.coins === 2 && s.players.b.coins === 2, "cp: a blocked steal moves nothing");
}

// G. Challenging a truthful block backfires; a lying block dies and the action lands.
{
  const s = fresh();
  s.players.b.card = "captain";
  complots.action(s, "a", { type: "act", act: "steal", target: "b" }, P);
  complots.action(s, "b", { type: "block" }, P);
  complots.action(s, "a", { type: "challenge" }, P);
  ok(s.players.a.alive === false && s.players.b.alive, "cp: challenging a real Captain is fatal");
  ok(s.players.b.coins === 2, "cp: the protected coins stay put");

  const s2 = fresh();
  s2.players.b.card = "contessa"; // bluffing the Captain
  complots.action(s2, "a", { type: "act", act: "steal", target: "b" }, P);
  complots.action(s2, "b", { type: "block" }, P);
  complots.action(s2, "c", { type: "challenge" }, P);
  ok(s2.players.b.alive === false, "cp: the lying blocker is eliminated");
}

// H. Assassination costs 3 up front; the Contessa claim can save the target.
{
  const s = fresh();
  s.players.a.coins = 3;
  complots.action(s, "a", { type: "act", act: "assassin", target: "c" }, P);
  ok(s.players.a.coins === 0, "cp: the contract is paid on declaration");
  complots.action(s, "b", { type: "pass" }, P);
  complots.action(s, "c", { type: "pass" }, P);
  complots.action(s, "d", { type: "pass" }, P);
  ok(s.players.c.alive === false && s.lastEvent.type === "assassinated",
    "cp: an unblocked assassination kills");

  const s2 = fresh();
  s2.players.a.coins = 3;
  complots.action(s2, "a", { type: "act", act: "assassin", target: "c" }, P);
  complots.action(s2, "c", { type: "block" }, P);
  ok(s2.pending.blockRole === "contessa", "cp: the target hides behind the Contessa");
  for (const id of ["a", "b", "d"]) complots.action(s2, id, { type: "pass" }, P);
  ok(s2.players.c.alive && s2.players.a.coins === 0,
    "cp: a standing Contessa block saves the target (coins stay spent)");
}

// I. Coup is unstoppable; 7 coins required, mandatory at 10.
{
  const s = fresh();
  ok(complots.action(s, "a", { type: "act", act: "coup", target: "b" }, P) === false,
    "cp: no coup without 7 coins");
  s.players.a.coins = 10;
  ok(complots.action(s, "a", { type: "act", act: "tax" }, P) === false,
    "cp: at 10+ coins only coup is legal");
  complots.action(s, "a", { type: "act", act: "coup", target: "b" }, P);
  ok(s.players.b.alive === false && s.players.a.coins === 3 && s.phase === "resolve",
    "cp: coup pays 7 and kills outright");
}

// J. Reaction timers: silence is consent.
{
  const s = fresh();
  complots.action(s, "a", { type: "act", act: "foreign" }, P);
  ok(s.pending.claim === null, "cp: foreign aid claims no role");
  ok(complots.action(s, "b", { type: "challenge" }, P) === false,
    "cp: you can't challenge an action with no claim");
  complots.tick(s, s.deadline);
  ok(s.players.a.coins === 4 && s.phase === "action", "cp: the window closing grants the aid");
}

// K. Last card standing wins.
{
  const s = fresh();
  s.players.b.alive = false;
  s.players.c.alive = false;
  s.players.a.coins = 7;
  complots.action(s, "a", { type: "act", act: "coup", target: "d" }, P);
  complots.tick(s, s.deadline);
  ok(s.phase === "over" && s.winnerId === "a", "cp: one player left → game over");
}

// L. Departures count as eliminations.
{
  const s = fresh();
  complots.onLeave(s, "b", 2000);
  ok(s.players.b.alive === false, "cp: leaving forfeits your card");
  complots.onLeave(s, "c", 2000);
  complots.onLeave(s, "d", 2000);
  ok(s.phase === "over" && s.winnerId === "a", "cp: the last one in the room wins");
}

console.log(`\nComplots: all ${pass} checks passed.`);
