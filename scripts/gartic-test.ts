// Deterministic unit tests for Gartic, with a controlled secret word.
import { gartic } from "../server/src/games/gartic.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🎨", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

function fresh(ids: string[]): any {
  const s = gartic.init(players(...ids), 0, { language: "en" });
  s.word = "apple"; // pin the secret for deterministic guessing
  return s;
}

// 1. Setup: first player draws, one lap, everyone at zero.
{
  const s = fresh(["a", "b", "c"]);
  ok(s.phase === "drawing" && s.drawerIndex === 0, "gartic: starts in drawing with the first player as drawer");
  ok(s.totalRounds === 3, "gartic: one lap = one round per player");
  ok(s.scores.a === 0 && s.scores.b === 0, "gartic: everyone starts at zero");
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
  ok(s.round === 2 && s.drawerIndex === 1 && s.phase === "drawing", "gartic: next rotates the drawer");
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
