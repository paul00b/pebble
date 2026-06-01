// Deterministic unit tests for the game engines, driving time by hand.
import { createRequire } from "node:module";
import { bombParty } from "../server/src/games/bombparty.js";
import { petitBac } from "../server/src/games/petitbac.js";
import { normalize } from "../server/src/games/dictionary.js";
import { BOMB_BONUS_ALPHABET } from "../shared/src/settings.js";

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
  const s: any = bombParty.init(players("a", "b", "c"), 1000, { language: "fr" });
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
  const s2: any = bombParty.init(players("x", "y"), 0, { language: "fr" });
  s2.lives.x = 1; s2.lives.y = 1;
  while (!s2.over) bombParty.tick(s2, s2.deadline + 1);
  ok(s2.over && (s2.winnerId === "x" || s2.winnerId === "y"), "bomb: last player standing wins");

  // Host-configured rules: starting lives + min turn time honored, baked at init.
  const s3: any = bombParty.init(players("a", "b"), 0, {
    language: "fr",
    settings: { startLives: 4, maxLives: 5, minTurnSec: 8, syllableMaxAge: 3 },
  });
  ok(s3.lives.a === 4 && s3.lives.b === 4, "bomb: startLives setting applied");
  ok(s3.maxLives === 5, "bomb: maxLives setting applied");
  ok(s3.deadline >= 8_000, "bomb: fuse honors the minimum turn time");

  // Out-of-range settings clamp (startLives 99 → 6; maxLives can't fall below startLives).
  const s4: any = bombParty.init(players("a", "b"), 0, {
    language: "fr",
    settings: { startLives: 99, maxLives: 0, minTurnSec: 0 },
  });
  ok(s4.lives.a === 6, "bomb: oversized startLives clamped to 6");
  ok(s4.maxLives >= 6, "bomb: maxLives floored up to startLives");
  ok(s4.deadline >= 1_000, "bomb: undersized min turn clamped to floor");

  // Minimum-turn floor: a fast pass still guarantees the next holder minTurnSec.
  const s5: any = bombParty.init(players("a", "b"), 0, {
    language: "fr",
    settings: { minTurnSec: 6, syllableMaxAge: 3 },
  });
  s5.deadline = 100; // almost no time left on the bomb
  bombParty.action(s5, "a", { type: "submit", word: frWordWith(s5.prompt) }, { now: 1_000, isHost: false });
  ok(s5.current === "b" && s5.deadline >= 1_000 + 6_000, "bomb: min-turn floor applied on pass");

  // Syllable aging: maxAge=1 retires the syllable right after a pass.
  const s6: any = bombParty.init(players("a", "b"), 0, {
    language: "fr",
    settings: { syllableMaxAge: 1 },
  });
  bombParty.action(s6, "a", { type: "submit", word: frWordWith(s6.prompt) }, { now: 10, isHost: false });
  ok(s6.promptAge === 0, "bomb: syllable retired after maxAge turns");

  // Alphabet bonus: completing the bonus alphabet grants a (capped) life.
  const s7: any = bombParty.init(players("a", "b"), 0, { language: "fr" });
  const holder7 = s7.current;
  s7.letters[holder7] = new Set(BOMB_BONUS_ALPHABET);
  bombParty.action(s7, holder7, { type: "submit", word: frWordWith(s7.prompt) }, { now: 10, isHost: false });
  ok(s7.lives[holder7] === 3 && s7.lastEvent.bonus === true, "bomb: alphabet bonus grants a life");
  ok(s7.letters[holder7].size === 0, "bomb: alphabet resets after the bonus");
}

// ── Petit Bac ──────────────────────────────────────────────────────────────
const HOST = (now: number) => ({ now, isHost: true });
const GUEST = (now: number) => ({ now, isHost: false });
// Walk the host through every category to wrap review into reveal.
const finishReview = (st: any) => {
  for (let k = 0; k < st.categories.length; k++) petitBac.action(st, "a", { type: "next" }, HOST(0));
};

// Default-valid flow: nobody strikes anything → classic unique/shared scoring.
{
  const s: any = petitBac.init(players("a", "b"), 0, { language: "fr" });
  ok(s.stage === "writing" && s.round === 1, "petitbac: opens in writing, round 1");
  const L = s.letter;
  const n = s.categories.length;

  // a: all valid answers; b: same answers (duplicates) except one blank.
  const aAns = Array.from({ length: n }, (_, i) => `${L}alpha${i}`);
  const bAns = Array.from({ length: n }, (_, i) => (i === 0 ? "" : `${L}alpha${i}`));
  petitBac.action(s, "a", { type: "submit", answers: aAns }, HOST(1));
  ok(s.stage === "writing", "petitbac: still writing after one submission");
  petitBac.action(s, "b", { type: "submit", answers: bAns }, GUEST(2));
  ok(s.stage === "review" && s.reviewIndex === 0, "petitbac: review opens once everyone submits");

  // Non-host can't step review; host walks through every category.
  ok(petitBac.action(s, "b", { type: "next" }, GUEST(3)) === false, "petitbac: non-host can't advance review");
  finishReview(s);
  ok(s.stage === "reveal", "petitbac: review wraps into reveal after the last category");

  // Category 0: a valid+unique (2), b blank (0). Others: both same → shared (1 each).
  ok(s.reveal[0][0].points === 2 && s.reveal[0][1].points === 0, "petitbac: unique=2, blank=0");
  ok(s.reveal[1][0].points === 1 && s.reveal[1][1].points === 1, "petitbac: shared answers = 1 each");
  ok(s.roundScores.a === 2 + (n - 1) * 1, "petitbac: round score sums correctly");

  // Non-host cannot advance reveal; host can.
  ok(petitBac.action(s, "b", { type: "next" }, GUEST(4)) === false, "petitbac: non-host can't advance reveal");
  petitBac.action(s, "a", { type: "next" }, HOST(5));
  ok(s.stage === "writing" && s.round === 2, "petitbac: host advances to round 2");

  // Play out remaining rounds → game ends after totalRounds.
  for (let r = 2; r <= s.totalRounds; r++) {
    const La = s.letter;
    const ans = Array.from({ length: n }, (_, i) => `${La}alpha${i}`);
    petitBac.action(s, "a", { type: "submit", answers: ans }, HOST(10));
    petitBac.action(s, "b", { type: "submit", answers: ans }, GUEST(11));
    finishReview(s);
    petitBac.action(s, "a", { type: "next" }, HOST(12));
  }
  ok(s.over && s.stage === "done", "petitbac: game ends after final round");
}

// Manual validation: striking a word changes the score, and re-counts uniqueness.
{
  const m: any = petitBac.init(players("a", "b"), 0, { language: "fr" });
  const n = m.categories.length;
  const L = m.letter;
  const aAns = Array.from({ length: n }, (_, i) => `${L}aaa${i}`); // a + b distinct everywhere
  const bAns = Array.from({ length: n }, (_, i) => `${L}bbb${i}`);
  petitBac.action(m, "a", { type: "submit", answers: aAns }, HOST(1));
  petitBac.action(m, "b", { type: "submit", answers: bAns }, GUEST(2));
  ok(m.stage === "review", "petitbac: distinct-answers game enters review");

  // Only the open category is toggleable, blanks aren't.
  ok(petitBac.action(m, "b", { type: "toggle", category: 1, playerId: "a" }, GUEST(3)) === false,
    "petitbac: can't toggle a category that isn't on screen");

  // Toggling is collaborative and reversible.
  petitBac.action(m, "b", { type: "toggle", category: 0, playerId: "a" }, GUEST(3));
  petitBac.action(m, "b", { type: "toggle", category: 0, playerId: "a" }, GUEST(3));
  petitBac.action(m, "b", { type: "toggle", category: 0, playerId: "a" }, GUEST(3)); // a struck out
  const rv: any = petitBac.view(m);
  ok(rv.review.cells.find((c: any) => c.playerId === "a").valid === false,
    "petitbac: a struck-out answer reads as invalid in the review view");

  finishReview(m);
  ok(m.reveal[0][0].points === 0, "petitbac: a struck-out word scores 0");
  ok(m.reveal[0][1].points === 2, "petitbac: the remaining distinct answer stays unique (2)");
  ok(m.reveal[1][0].points === 2 && m.reveal[1][1].points === 2, "petitbac: untouched distinct answers score 2 each");
}

console.log(`\n🎉 All ${pass} engine checks passed.`);
