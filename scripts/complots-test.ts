// Deterministic unit tests for Complots (two-influence Coup). No server needed.
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

/** Force a player's hidden hand to a known pair (or single). */
const setCards = (s: any, id: string, ...roles: string[]) => {
  s.players[id].cards = [...roles];
};

// A. Init: two influence + two coins each, deck holds the rest.
{
  const s = fresh();
  ok(s.order.length === 4 && s.deck.length === 12 - 8, "cp: 3×4 roles dealt 2 each, 4 left in deck");
  ok(s.order.every((id: string) => s.players[id].cards.length === 2 && s.players[id].coins === 2),
    "cp: everyone starts with two hidden cards and 2 coins");
  ok(s.order.every((id: string) => s.players[id].revealed.length === 0), "cp: nothing revealed yet");
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

// D. A truthful claim costs the challenger an influence (and the action lands).
{
  const s = fresh();
  setCards(s, "a", "duke", "captain");
  setCards(s, "b", "assassin", "contessa");
  complots.action(s, "a", { type: "act", act: "tax" }, P);
  complots.action(s, "b", { type: "challenge" }, P);
  ok(s.phase === "lose" && s.lossQueue[0] === "b", "cp: the wrongful accuser must drop an influence");
  // b chooses which card to reveal.
  complots.action(s, "b", { type: "lose", index: 1 }, P);
  ok(s.players.b.revealed.length === 1 && s.players.b.revealed[0] === "contessa" && s.players.b.cards.length === 1,
    "cp: the accuser reveals the card of their choice but lives on");
  ok(s.phase === "resolve" && s.players.a.cards.length === 2,
    "cp: the truthful claimer keeps two cards (one freshly drawn)");
  ok(s.players.a.coins === 5, "cp: the surviving action still pays");
  ok(s.lastEvent.type === "challenge" && s.lastEvent.truthful === true && s.lastEvent.shown === "duke",
    "cp: the verification is narrated");
  complots.tick(s, s.deadline);
  ok(s.phase === "action" && s.order[s.turnIdx] === "b", "cp: play resumes after the pause");
}

// E. A bluff caught costs the bluffer an influence (their pick).
{
  const s = fresh();
  setCards(s, "a", "assassin", "captain"); // no Duke - the tax is a lie
  complots.action(s, "a", { type: "act", act: "tax" }, P);
  complots.action(s, "c", { type: "challenge" }, P);
  ok(s.phase === "lose" && s.lossQueue[0] === "a", "cp: the liar owes an influence");
  complots.action(s, "a", { type: "lose", index: 0 }, P);
  ok(s.players.a.revealed[0] === "assassin" && s.players.a.cards.length === 1, "cp: the bluffer flips a card");
  ok(s.players.a.coins === 2 && s.lastEvent.truthful === false && s.lastEvent.shown === null,
    "cp: a busted tax pays nothing and shows no proof");
}

// F. Losing your LAST influence eliminates you (auto-reveal, no choice).
{
  const s = fresh();
  setCards(s, "a", "assassin"); // down to one card already
  complots.action(s, "a", { type: "act", act: "tax" }, P);
  complots.action(s, "b", { type: "challenge" }, P);
  ok(s.phase === "resolve", "cp: a one-card loser doesn't get a choice");
  ok(s.players.a.cards.length === 0 && s.players.a.revealed[0] === "assassin",
    "cp: the bluffer's last card falls automatically");
  ok(s.lastEvent.eliminatedId === "a" && s.lastEvent.losses.some((l: any) => l.eliminated),
    "cp: a full knockout is recorded");
}

// G. Steal: the target can counter-claim the Captain; an unchallenged block stands.
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

// H. Challenging a truthful block backfires; a lying block loses an influence + the action lands.
{
  const s = fresh();
  setCards(s, "b", "captain", "duke");
  setCards(s, "a", "assassin", "contessa");
  complots.action(s, "a", { type: "act", act: "steal", target: "b" }, P);
  complots.action(s, "b", { type: "block" }, P);
  complots.action(s, "a", { type: "challenge" }, P);
  ok(s.phase === "lose" && s.lossQueue[0] === "a", "cp: challenging a real Captain costs the challenger");
  complots.action(s, "a", { type: "lose", index: 0 }, P);
  ok(s.players.a.cards.length === 1 && s.players.b.cards.length === 2, "cp: the protected blocker is untouched");
  ok(s.players.b.coins === 2, "cp: the protected coins stay put");

  const s2 = fresh();
  setCards(s2, "b", "contessa", "duke"); // bluffing the Captain
  complots.action(s2, "a", { type: "act", act: "steal", target: "b" }, P);
  complots.action(s2, "b", { type: "block" }, P);
  complots.action(s2, "c", { type: "challenge" }, P);
  ok(s2.phase === "lose" && s2.lossQueue[0] === "b", "cp: the lying blocker owes an influence");
  complots.action(s2, "b", { type: "lose", index: 0 }, P);
  ok(s2.players.a.coins === 4, "cp: with the block busted, the steal lands (+2)");
}

// I. Assassination costs 3 up front; a successful one costs the target an influence.
{
  const s = fresh();
  s.players.a.coins = 3;
  complots.action(s, "a", { type: "act", act: "assassin", target: "c" }, P);
  ok(s.players.a.coins === 0, "cp: the contract is paid on declaration");
  complots.action(s, "b", { type: "pass" }, P);
  complots.action(s, "c", { type: "pass" }, P);
  complots.action(s, "d", { type: "pass" }, P);
  ok(s.phase === "lose" && s.lossQueue[0] === "c" && s.lastEvent.type === "assassinated",
    "cp: an unblocked assassination forces the target to reveal");
  complots.action(s, "c", { type: "lose", index: 0 }, P);
  ok(s.players.c.cards.length === 1 && s.phase === "resolve", "cp: the target loses one of two influence");

  const s2 = fresh();
  s2.players.a.coins = 3;
  complots.action(s2, "a", { type: "act", act: "assassin", target: "c" }, P);
  complots.action(s2, "c", { type: "block" }, P);
  ok(s2.pending.blockRole === "contessa", "cp: the target hides behind the Contessa");
  for (const id of ["a", "b", "d"]) complots.action(s2, id, { type: "pass" }, P);
  ok(s2.players.c.cards.length === 2 && s2.players.a.coins === 0,
    "cp: a standing Contessa block saves the target (coins stay spent)");
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

// K. Coup costs 7, mandatory at 10, and the target chooses which influence to drop.
{
  const s = fresh();
  ok(complots.action(s, "a", { type: "act", act: "coup", target: "b" }, P) === false,
    "cp: no coup without 7 coins");
  s.players.a.coins = 10;
  ok(complots.action(s, "a", { type: "act", act: "tax" }, P) === false,
    "cp: at 10+ coins only coup is legal");
  complots.action(s, "a", { type: "act", act: "coup", target: "b" }, P);
  ok(s.phase === "lose" && s.lossQueue[0] === "b" && s.players.a.coins === 3, "cp: coup pays 7 and forces a reveal");
  complots.action(s, "b", { type: "lose", index: 1 }, P);
  ok(s.players.b.cards.length === 1 && s.phase === "resolve", "cp: a coup knocks out one influence");
}

// L. A lose-pick timer auto-reveals the first card.
{
  const s = fresh();
  s.players.a.coins = 7;
  complots.action(s, "a", { type: "act", act: "coup", target: "b" }, P);
  ok(s.phase === "lose", "cp: coup opens a lose-pick window");
  complots.tick(s, s.deadline);
  ok(s.players.b.cards.length === 1 && s.players.b.revealed.length === 1 && s.phase === "resolve",
    "cp: dithering past the timer drops the first card");
}

// M. Last player with influence wins.
{
  const s = fresh();
  setCards(s, "b"); // already out
  setCards(s, "c"); // already out
  s.players.a.coins = 7;
  complots.action(s, "a", { type: "act", act: "coup", target: "d" }, P); // d has 2 → lose phase
  complots.action(s, "d", { type: "lose", index: 0 }, P); // down to 1
  // d still alive with one card, a alive — not over yet.
  ok(s.phase === "resolve", "cp: d survives the first coup with one influence");
}

// N. Departures forfeit all influence.
{
  const s = fresh();
  complots.onLeave(s, "b", 2000);
  ok(s.players.b.cards.length === 0 && s.players.b.revealed.length === 2, "cp: leaving forfeits both cards");
  complots.onLeave(s, "c", 2000);
  complots.onLeave(s, "d", 2000);
  ok(s.phase === "over" && s.winnerId === "a", "cp: the last one in the room wins");
}

console.log(`\nComplots: all ${pass} checks passed.`);
