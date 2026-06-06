// Deterministic unit tests for Gartic, with a controlled secret word.
import { gartic } from "../server/src/games/gartic.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🎨", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

// Advance past the choosing phase into drawing, then pin the secret word so
// guessing is deterministic.
function fresh(ids: string[]): any {
  const s = gartic.init(players(...ids), 0, { language: "en" });
  gartic.action(s, s.order[0], { type: "choose", index: 0 }, { now: 0, isHost: false });
  s.word = "apple";
  return s;
}

// 1. Setup: the first player picks a word from two options (one always easy).
{
  const s = gartic.init(players("a", "b", "c"), 0, { language: "en" });
  ok(s.phase === "choosing" && s.drawerIndex === 0, "gartic: starts in the choosing phase for the first drawer");
  ok(s.choices.length === 2, "gartic: the drawer is offered two words");
  ok(s.choices.some((c: any) => c.difficulty === "easy"), "gartic: at least one option is easy");
  ok(s.totalRounds === 3, "gartic: one lap = one round per player");
  ok(s.scores.a === 0 && s.scores.b === 0, "gartic: everyone starts at zero");

  ok(gartic.action(s, "b", { type: "choose", index: 0 }, { now: 0, isHost: false }) === false,
    "gartic: non-drawers cannot choose the word");
  const chosen = s.choices[1].word;
  gartic.action(s, "a", { type: "choose", index: 1 }, { now: 0, isHost: false });
  ok(s.phase === "drawing" && s.word === chosen, "gartic: choosing a word starts the drawing phase");
}

// 1b. Failing to pick within the 15s window passes the turn to the next drawer.
{
  const s = gartic.init(players("a", "b"), 0, { language: "en" });
  ok(s.phase === "choosing", "gartic: a new turn opens in the choosing phase");
  ok(gartic.tick(s, s.deadline - 1) === false, "gartic: no skip before the choose deadline");
  gartic.tick(s, s.deadline);
  ok(s.phase === "choosing" && s.drawerIndex === 1 && s.round === 2,
    "gartic: missing the pick window passes to the next drawer");
}

// 2. The drawer cannot guess; a correct guess scores guesser + drawer bonus.
{
  const s = fresh(["a", "b", "c"]);
  ok(gartic.action(s, "a", { type: "guess", text: "apple" }, { now: 0, isHost: false }) === false,
    "gartic: the drawer cannot guess");
  gartic.action(s, "b", { type: "guess", text: "Apple" }, { now: 0, isHost: false });
  ok(s.guessed.has("b"), "gartic: a correct guess (case-insensitive) marks the guesser");
  ok(s.scores.b > 0 && s.scores.a === 20, "gartic: guesser scores and the drawer earns the bonus");
}

// 3. A wrong guess records a message but no points, and doesn't mark the player.
{
  const s = fresh(["a", "b", "c"]);
  gartic.action(s, "b", { type: "guess", text: "banana" }, { now: 0, isHost: false });
  ok(!s.guessed.has("b") && s.scores.b === 0, "gartic: a wrong guess scores nothing");
  ok(s.messages.length === 1 && s.messages[0].correct === false, "gartic: the wrong guess shows in the feed");
}

// 4. When every non-drawer has it, the round ends early.
{
  const s = fresh(["a", "b", "c"]);
  gartic.action(s, "b", { type: "guess", text: "apple" }, { now: 0, isHost: false });
  ok(s.phase === "drawing", "gartic: still drawing while someone hasn't guessed");
  gartic.action(s, "c", { type: "guess", text: "apple" }, { now: 0, isHost: false });
  ok(s.phase === "reveal", "gartic: round reveals once all non-drawers have guessed");
}

// 5. The timer expiring flips drawing → reveal.
{
  const s = fresh(["a", "b"]);
  ok(gartic.tick(s, s.deadline - 1) === false, "gartic: no tick change before the deadline");
  gartic.tick(s, s.deadline);
  ok(s.phase === "reveal", "gartic: the deadline ends the drawing phase");
}

// 6. Host-only "next" rotates the drawer; the final round finishes the game.
{
  const s = fresh(["a", "b"]);
  s.phase = "reveal";
  ok(gartic.action(s, "a", { type: "next" }, { now: 0, isHost: false }) === false,
    "gartic: only the host can advance");
  gartic.action(s, "a", { type: "next" }, { now: 0, isHost: true });
  ok(s.round === 2 && s.drawerIndex === 1 && s.phase === "choosing", "gartic: next rotates the drawer into a new choice");
  s.phase = "reveal";
  s.scores.a = 100; s.scores.b = 30;
  gartic.action(s, "a", { type: "next" }, { now: 0, isHost: true });
  ok(s.over && s.phase === "done", "gartic: the last round ends the game");
  ok(s.winnerId === "a", "gartic: the top score wins");
}

// 7. Drawing ops: only the drawer, only while drawing; clear wipes the buffer.
{
  const s = fresh(["a", "b"]);
  const line: any = { t: "line", x0: 0, y0: 0, x1: 1, y1: 1, c: "#000", w: 0.01 };
  ok(gartic.applyDrawOp!(s, "b", line) === false, "gartic: non-drawers cannot draw");
  gartic.applyDrawOp!(s, "a", line);
  ok(gartic.drawOps!(s).length === 1, "gartic: the drawer's op is stored");
  gartic.applyDrawOp!(s, "a", { t: "clear" } as any);
  ok(gartic.drawOps!(s).length === 0, "gartic: clear wipes the canvas");
}

console.log(`\n🎉 All ${pass} gartic checks passed.`);
