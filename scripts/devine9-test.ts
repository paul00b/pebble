// Deterministic unit tests for Devine 9. No server/network needed.
import { devine9 } from "../server/src/games/devine9.js";
import { pickRound, themeCount } from "../server/src/games/devine9Themes.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🎯", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

const HOST = { now: 1000, isHost: true };
const P = { now: 1000, isHost: false };

// a,b,c,d → red,blue,red,blue. Active team starts "red"; "blue" (b,d) holds the card.
const fresh = (): any =>
  devine9.init(players("a", "b", "c", "d"), 0, {
    language: "en",
    settings: { turnSec: 60, roundsPerTeam: 2 },
  });

const begun = (): any => {
  const s = fresh();
  devine9.action(s, "a", { type: "begin" }, HOST);
  return s;
};

// A. Init: balanced teams, derived turn count.
{
  const s = fresh();
  ok(s.members.a === "red" && s.members.b === "blue", "d9: teams auto-balance red/blue");
  ok(s.totalTurns === 4 && s.activeTeam === "red", "d9: totalTurns = roundsPerTeam × 2");
  ok(s.phase === "setup", "d9: starts in setup");
}

// B. Begin needs host + both teams staffed.
{
  const s = fresh();
  ok(devine9.action(s, "b", { type: "begin" }, P) === false, "d9: non-host can't begin");
  ok(devine9.action(s, "a", { type: "begin" }, HOST) === true && s.phase === "play",
    "d9: host begins with both teams staffed");
  ok(s.round && s.round.answers.length === 9 && typeof s.round.bomb === "string",
    "d9: a turn draws 9 answers + a bomb");

  const lonely = fresh();
  lonely.members = { a: "red", b: "red", c: "red", d: "red" };
  ok(devine9.action(lonely, "a", { type: "begin" }, HOST) === false,
    "d9: can't begin when a team is empty");
}

// C. Only the checker team can start / validate / bomb.
{
  const s = begun(); // active red guesses, blue (b,d) checks
  ok(devine9.action(s, "a", { type: "start" }, P) === false, "d9: the guessing team can't start the timer");
  ok(devine9.action(s, "b", { type: "start" }, { now: 1000, isHost: false }) === true && s.started,
    "d9: the checker launches the timer");
  ok(s.deadline === 1000 + 60_000, "d9: deadline = now + turn length");

  ok(devine9.action(s, "a", { type: "validate", index: 0 }, P) === false,
    "d9: the guessing team can't tick answers");
  devine9.action(s, "b", { type: "validate", index: 0 }, P);
  ok(s.found[0] === true, "d9: the checker ticks an answer");
  devine9.action(s, "b", { type: "validate", index: 0 }, P);
  ok(s.found[0] === false, "d9: ticking again un-ticks (misclick-safe)");
}

// D. Bomb costs −5 but the timer keeps running.
{
  const s = begun();
  devine9.action(s, "b", { type: "start" }, P);
  devine9.action(s, "b", { type: "validate", index: 0 }, P);
  devine9.action(s, "b", { type: "validate", index: 1 }, P);
  devine9.action(s, "b", { type: "bomb" }, P);
  ok(s.bombHit === true && s.phase === "play" && s.started,
    "d9: saying the bomb is flagged and the turn continues");
}

// E. Timer expiry ends the turn and banks points for the guessing team.
{
  const s = begun();
  devine9.action(s, "b", { type: "start" }, P);
  s.found = [true, true, true, false, false, false, false, false, false]; // 3 found
  s.bombHit = true; // −5
  ok(devine9.tick(s, s.deadline) === true, "d9: tick fires at the deadline");
  ok(s.phase === "reveal" && s.scores.red === 3 - 5, "d9: points = found − 5 go to the guessing team");
  ok(s.roundPoints === -2, "d9: round points recorded for the reveal");
}

// F. Finding all 9 ends the turn early.
{
  const s = begun();
  devine9.action(s, "b", { type: "start" }, P);
  s.found = [true, true, true, true, true, true, true, true, false];
  devine9.action(s, "b", { type: "validate", index: 8 }, P);
  ok(s.phase === "reveal" && s.scores.red === 9, "d9: all 9 found ends the turn with +9");
}

// G. Next swaps the guessing team; the final turn ends the game.
{
  const s = begun(); // turn 1, active red
  s.phase = "reveal";
  ok(devine9.action(s, "b", { type: "next" }, P) === false, "d9: non-host can't advance");
  devine9.action(s, "a", { type: "next" }, HOST);
  ok(s.turnIndex === 1 && s.activeTeam === "blue" && s.phase === "play",
    "d9: next advances the turn and swaps the guessing team");

  // Jump to the last turn and finish.
  s.turnIndex = 3; // totalTurns - 1
  s.phase = "reveal";
  s.scores = { red: 12, blue: 7 };
  devine9.action(s, "a", { type: "next" }, HOST);
  ok(s.phase === "over" && s.winner === "red", "d9: the final turn ends the game, higher score wins");
}

// H. The card is hidden from the guessing team, shown to the checker.
{
  const s = begun();
  devine9.action(s, "b", { type: "start" }, P);
  const guesser = devine9.playerView!(s, "a") as any; // red, guessing
  const checker = devine9.playerView!(s, "b") as any; // blue, holds card
  ok(guesser.answers === null && guesser.prompt === null, "d9: the guessing team never sees the words");
  ok(checker.answers && checker.answers.length === 9 && checker.bomb,
    "d9: the checker sees the answers + bomb");
  ok(checker.youAreChecker === true && guesser.youAreChecker === false,
    "d9: youAreChecker is true only for the card-holding team");

  s.phase = "reveal";
  const reveal = devine9.playerView!(s, "a") as any;
  ok(reveal.answers && reveal.bomb, "d9: everyone sees the card at the reveal");
}

// I. A team emptying mid-game ends it.
{
  const s = begun();
  devine9.onLeave(s, "b", 1000);
  ok(s.phase === "play", "d9: losing one of two checkers keeps the game going");
  devine9.onLeave(s, "d", 1000);
  ok(s.phase === "over", "d9: emptying a whole team ends the game");
}

// K. Reveal correction window: the checker can still tick/untick after the buzzer.
{
  const s = begun(); // red guesses, blue (b,d) holds the card
  devine9.action(s, "b", { type: "start" }, P);
  s.found = [true, true, false, false, false, false, false, false, false];
  devine9.tick(s, s.deadline); // → reveal, red banks 2
  ok(s.phase === "reveal" && s.scores.red === 2, "d9: turn banks 2 at the buzzer");

  ok(devine9.action(s, "a", { type: "validate", index: 2 }, P) === false,
    "d9: the guessing team can't edit during reveal");

  ok(devine9.action(s, "b", { type: "validate", index: 2 }, P) === true && s.found[2] === true,
    "d9: the checker can tick a missed answer in the reveal window");
  ok(s.scores.red === 3 && s.roundPoints === 3, "d9: the banked score adjusts up by the correction");

  devine9.action(s, "b", { type: "validate", index: 0 }, P); // untick
  ok(s.scores.red === 2 && s.roundPoints === 2, "d9: unticking during reveal lowers the score");

  devine9.action(s, "b", { type: "bomb" }, P); // a late bomb realization
  ok(s.bombHit === true && s.scores.red === -3 && s.roundPoints === -3,
    "d9: toggling the bomb during reveal re-banks −5");
}

// J. Theme bank integrity: every drawn round has 9 distinct answers + a bomb
//    that isn't one of the answers. Sampling each theme many times covers all.
for (const lang of ["fr", "en"] as const) {
  ok(themeCount(lang) >= 20, `d9: ${lang} bank has a healthy number of themes`);
  let bad = 0;
  for (let i = 0; i < 2000; i++) {
    const r = pickRound(lang, new Set());
    const distinct = new Set(r.answers);
    if (r.answers.length !== 9 || distinct.size !== 9) bad++;
    if (!r.bomb || distinct.has(r.bomb)) bad++;
  }
  ok(bad === 0, `d9: ${lang} every theme yields 9 distinct answers + a clean bomb`);
}

console.log(`\n🎉 All ${pass} devine9 checks passed.`);
