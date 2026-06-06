// Deterministic unit tests for Codenames, with a controlled key and teams.
import { codenames } from "../server/src/games/codenames.js";
import { sanitizeCodenames } from "../shared/src/settings.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🕵️", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

const HOST = { now: 0, isHost: true };
const P = { now: 0, isHost: false };

const fixedMembers = {
  a: { team: "red", role: "spymaster" },
  b: { team: "red", role: "operative" },
  c: { team: "blue", role: "spymaster" },
  d: { team: "blue", role: "operative" },
};

const key = (overrides: Record<number, string>): string[] => {
  const k = Array(25).fill("neutral");
  for (const [i, c] of Object.entries(overrides)) k[Number(i)] = c;
  return k;
};

function base(): any {
  const s: any = codenames.init(players("a", "b", "c", "d"), 0, { language: "en" });
  s.members = JSON.parse(JSON.stringify(fixedMembers));
  s.order = ["a", "b", "c", "d"];
  return s;
}

function started(keyArr: string[], remaining: { red: number; blue: number }, turn = "red"): any {
  const s = base();
  s.key = keyArr;
  s.revealed = Array(25).fill(null);
  s.remaining = remaining;
  s.turnTeam = turn;
  s.phase = "guess";
  s.clue = { word: "x", count: 5 };
  s.guessesLeft = 5;
  return s;
}

// A. Setup → begin validation.
{
  const s = base(); // phase "setup"
  ok(codenames.action(s, "b", { type: "begin" }, P) === false, "cn: non-host can't begin");
  ok(codenames.action(s, "a", { type: "begin" }, HOST) === true && s.phase === "clue",
    "cn: host begins when both teams are staffed");

  const bad = base();
  bad.members.c.role = "operative"; // blue has no spymaster
  ok(codenames.action(bad, "a", { type: "begin" }, HOST) === false && bad.phase === "setup",
    "cn: can't begin without a spymaster on each team");
}

// B. Clue then a correct guess continues the turn.
{
  const s = base();
  codenames.action(s, "a", { type: "begin" }, HOST);
  s.key = key({ 0: "red", 1: "red", 5: "blue", 6: "blue", 24: "assassin" });
  s.remaining = { red: 2, blue: 2 };
  s.turnTeam = "red";
  ok(codenames.action(s, "c", { type: "clue", word: "tree", count: 2 }, P) === false,
    "cn: only the active spymaster may give a clue");
  codenames.action(s, "a", { type: "clue", word: "tree", count: 2 }, P);
  ok(s.phase === "guess" && s.guessesLeft === 3, "cn: clue grants count+1 guesses");
  codenames.action(s, "b", { type: "guess", index: 0 }, P);
  ok(s.revealed[0] === "red" && s.remaining.red === 1 && s.turnTeam === "red",
    "cn: correct guess reveals red and keeps the turn");
}

// C. Sweeping the last card wins.
{
  const s = started(key({ 0: "red" }), { red: 1, blue: 5 });
  codenames.action(s, "b", { type: "guess", index: 0 }, P);
  ok(s.phase === "over" && s.winner === "red" && s.endReason === "swept",
    "cn: revealing your last agent wins the game");
}

// D. Neutral ends the turn.
{
  const s = started(key({ 7: "neutral" }), { red: 3, blue: 3 });
  codenames.action(s, "b", { type: "guess", index: 7 }, P);
  ok(s.turnTeam === "blue" && s.phase === "clue", "cn: a neutral guess ends the turn");
}

// E. Guessing the other team's card helps them and ends the turn.
{
  const s = started(key({ 8: "blue" }), { red: 3, blue: 3 });
  codenames.action(s, "b", { type: "guess", index: 8 }, P);
  ok(s.remaining.blue === 2 && s.turnTeam === "blue", "cn: wrong-color guess gives the other team a card");
}

// F. Assassin = instant loss.
{
  const s = started(key({ 9: "assassin" }), { red: 3, blue: 3 });
  codenames.action(s, "b", { type: "guess", index: 9 }, P);
  ok(s.phase === "over" && s.winner === "blue" && s.endReason === "assassin",
    "cn: hitting the assassin loses immediately");
}

// F2. Voting: a tap registers a vote, re-tapping retracts it, votes surface in the view.
{
  const s = started(key({ 0: "red" }), { red: 3, blue: 3 });
  ok(codenames.action(s, "a", { type: "vote", index: 0 }, P) === false,
    "cn: a spymaster can't vote");
  ok(codenames.action(s, "d", { type: "vote", index: 0 }, P) === false,
    "cn: an off-turn operative can't vote");
  ok(codenames.action(s, "b", { type: "vote", index: 0 }, P) === true && s.votes.b === 0,
    "cn: the active operative votes for a card");
  const v = codenames.playerView!(s, "b") as any;
  ok(v.votes[0].includes("b") && v.youVote === 0, "cn: votes & youVote surface in the view");
  codenames.action(s, "b", { type: "vote", index: 0 }, P); // re-tap
  ok(s.votes.b === undefined, "cn: re-tapping the same card retracts the vote");
  // Validating (guess) clears the slate.
  codenames.action(s, "b", { type: "vote", index: 0 }, P);
  codenames.action(s, "b", { type: "guess", index: 0 }, P);
  ok(Object.keys(s.votes).length === 0, "cn: validating a card clears all votes");
}

// G. The key is hidden from operatives, visible to spymasters.
{
  const s = started(key({ 0: "red" }), { red: 3, blue: 3 });
  const opView = codenames.playerView!(s, "b") as any;
  const spyView = codenames.playerView!(s, "a") as any;
  ok(opView.key.every((c: unknown) => c === null), "cn: operatives never see the key");
  ok(spyView.key[0] === "red", "cn: spymasters see the full key");
}

// H. Host-supplied custom words.
{
  const custom = Array.from({ length: 30 }, (_, i) => `WORD${i}`);
  const s: any = codenames.init(players("a", "b", "c", "d"), 0, {
    language: "en",
    settings: { customWords: custom },
  });
  const set = new Set(custom);
  ok(
    s.words.length === 25 && s.words.every((w: string) => set.has(w)),
    "cn: a 25+ custom list fills the whole board"
  );

  // Too few custom words → fall back to the built-in bank.
  const few = ["ONLY", "A", "FEW"];
  const s2: any = codenames.init(players("a", "b", "c", "d"), 0, {
    language: "en",
    settings: { customWords: few },
  });
  ok(
    s2.words.length === 25 && s2.words.some((w: string) => !few.includes(w)),
    "cn: fewer than 25 custom words falls back to the bank"
  );

  // Sanitize: trims, upper-cases, dedupes, drops blanks.
  const clean = sanitizeCodenames({ customWords: [" cat ", "CAT", "dog", "", "  ", "cat"] });
  ok(
    JSON.stringify(clean.customWords) === JSON.stringify(["CAT", "DOG"]),
    "cn: custom words are trimmed, upper-cased and de-duplicated"
  );
}

// I. Waiting-room whiteboard: only the team that isn't playing may draw.
{
  const s = started(key({ 0: "red" }), { red: 3, blue: 3 }, "red"); // red's turn
  const line: any = { t: "line", x0: 0, y0: 0, x1: 1, y1: 1, c: "#000", w: 0.01 };

  ok(codenames.applyDrawOp!(s, "b", line) === false, "cn: the playing team can't draw");
  ok(codenames.applyDrawOp!(s, "c", line) === true, "cn: the waiting team can draw");
  ok(codenames.applyDrawOp!(s, "d", line) === true, "cn: any waiting-team member can draw");
  ok(codenames.drawOps!(s).length === 2, "cn: the waiting team's strokes are stored");

  // No team → no drawing.
  s.members.e = { team: null, role: "operative" };
  ok(codenames.applyDrawOp!(s, "e", line) === false, "cn: a teamless player can't draw");

  // Strokes persist across the turn flip, but now the other team draws.
  codenames.action(s, "b", { type: "guess", index: 0 }, P); // red reveals red → keeps turn
  s.turnTeam = "blue"; // simulate a handover to blue
  ok(codenames.drawOps!(s).length === 2, "cn: strokes survive the turn change");
  ok(codenames.applyDrawOp!(s, "c", line) === false, "cn: the new playing team can't draw");
  ok(codenames.applyDrawOp!(s, "a", line) === true, "cn: the new waiting team draws");

  // Clear wipes the board.
  codenames.applyDrawOp!(s, "a", { t: "clear" } as any);
  ok(codenames.drawOps!(s).length === 0, "cn: clear wipes the whiteboard");

  // During setup, anyone with a team may doodle.
  const setup = base(); // phase "setup", turnTeam set
  ok(codenames.applyDrawOp!(setup, "a", line) === true && codenames.applyDrawOp!(setup, "c", line) === true,
    "cn: both teams can doodle during setup");
}

console.log(`\n🎉 All ${pass} codenames checks passed.`);
