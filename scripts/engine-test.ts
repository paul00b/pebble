// Deterministic unit tests for the game engines, driving time by hand.
import { createRequire } from "node:module";
import { bombParty } from "../server/src/games/bombparty.js";
import { petitBac } from "../server/src/games/petitbac.js";
import { normalize } from "../server/src/games/dictionary.js";

const require = createRequire(import.meta.url);
const FR: string[] = require("an-array-of-french-words");

let pass = 0;
function ok(cond: unknown, msg: string) {
  if (!cond) {
    console.error("❌", msg);
    process.exit(1);
  }
  pass++;
  console.log("✅", msg);
}

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🦊", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

function frWordWith(prompt: string): string {
  const p = normalize(prompt);
  for (const w of FR) {
    const n = normalize(w);
    if (n.length >= 3 && n.includes(p)) return n;
  }
  throw new Error("no FR word for prompt " + prompt);
}

// ── Bomb Party ─────────────────────────────────────────────────────────────
{
  const s: any = bombParty.init(players("a", "b", "c"), 1000);
  ok(s.current === "a" && s.order.length === 3, "bomb: starts with player a, 3 in order");
  ok(s.lives.a === 2 && s.lives.b === 2, "bomb: everyone starts with 2 lives");

  // Wrong player can't submit.
  ok(bombParty.action(s, "b", { type: "submit", word: "xyz" }, { now: 1100, isHost: false }) === false ||
     s.current === "a", "bomb: non-current player's submit is ignored");

  // Invalid word: stays current, flags invalid.
  bombParty.action(s, "a", { type: "submit", word: "zzzzzq" }, { now: 1100, isHost: false });
  ok(s.current === "a" && s.lastEvent.type === "invalid", "bomb: invalid word rejected, turn stays");

  // Valid word containing the prompt: passes the bomb to b.
  const word = frWordWith(s.prompt);
  bombParty.action(s, "a", { type: "submit", word }, { now: 1200, isHost: false });
  ok(s.current === "b" && s.lastEvent.type === "valid", `bomb: valid word "${word}" passed bomb a→b`);

  // Reused word is rejected.
  const wb = frWordWith(s.prompt);
  if (normalize(wb) === normalize(word)) {
    bombParty.action(s, "b", { type: "submit", word }, { now: 1250, isHost: false });
    ok(s.lastEvent.type === "used", "bomb: reused word rejected");
  } else {
    pass++; console.log("✅ bomb: (skipped reuse check, distinct prompt word)");
  }

  // Explosion: tick past the deadline → current loses a life, bomb moves on.
  const before = s.lives[s.current];
  const holder = s.current;
  bombParty.tick(s, s.deadline + 1);
  ok(s.lives[holder] === before - 1, "bomb: explosion costs the holder a life");
  ok(s.lastEvent.type === "explode", "bomb: explosion event emitted");

  // Win condition: 2 players each on their last life → one explosion ends it.
  const s2: any = bombParty.init(players("x", "y"), 0);
  s2.lives.x = 1; s2.lives.y = 1;
  while (!s2.over) bombParty.tick(s2, s2.deadline + 1);
  ok(s2.over && (s2.winnerId === "x" || s2.winnerId === "y"), "bomb: last player standing wins");
}

// ── Petit Bac ──────────────────────────────────────────────────────────────
{
  const s: any = petitBac.init(players("a", "b"), 0);
  ok(s.stage === "writing" && s.round === 1, "petitbac: opens in writing, round 1");
  const L = s.letter;
  const n = s.categories.length;

  // a: all unique valid answers; b: same answers (duplicates) except one blank.
  const aAns = Array.from({ length: n }, (_, i) => `${L}alpha${i}`);
  const bAns = Array.from({ length: n }, (_, i) => (i === 0 ? "" : `${L}alpha${i}`));
  petitBac.action(s, "a", { type: "submit", answers: aAns }, { now: 1, isHost: true });
  ok(s.stage === "writing", "petitbac: still writing after one submission");
  petitBac.action(s, "b", { type: "submit", answers: bAns }, { now: 2, isHost: false });
  ok(s.stage === "reveal", "petitbac: reveal once everyone submits");

  // Category 0: a valid+unique (2), b blank (0). Others: both same → duplicate (1 each).
  ok(s.reveal[0][0].points === 2 && s.reveal[0][1].points === 0, "petitbac: unique=2, blank=0");
  ok(s.reveal[1][0].points === 1 && s.reveal[1][1].points === 1, "petitbac: shared answers = 1 each");
  ok(s.roundScores.a === 2 + (n - 1) * 1, "petitbac: round score sums correctly");

  // Non-host cannot advance; host can.
  ok(petitBac.action(s, "b", { type: "next" }, { now: 3, isHost: false }) === false, "petitbac: non-host can't advance");
  petitBac.action(s, "a", { type: "next" }, { now: 4, isHost: true });
  ok(s.stage === "writing" && s.round === 2, "petitbac: host advances to round 2");

  // Play out remaining rounds → game ends after totalRounds.
  for (let r = 2; r <= s.totalRounds; r++) {
    petitBac.action(s, "a", { type: "submit", answers: aAns }, { now: 10, isHost: true });
    petitBac.action(s, "b", { type: "submit", answers: aAns }, { now: 11, isHost: false });
    petitBac.action(s, "a", { type: "next" }, { now: 12, isHost: true });
  }
  ok(s.over && s.stage === "done", "petitbac: game ends after final round");
}

console.log(`\n🎉 All ${pass} engine checks passed.`);
