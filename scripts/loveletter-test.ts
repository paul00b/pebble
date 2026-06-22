// Deterministic unit tests for Love Letter (2019 rules). No server needed.
import { loveletter } from "../server/src/games/loveletter.js";
import { LL_COUNTS } from "../shared/src/games.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "💌", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

const P = { now: 1000, isHost: false };
const HOST = { now: 1000, isHost: true };
const OPTS = { language: "en" as const, settings: {} };

const fresh = (...ids: string[]): any => loveletter.init(players(...ids), 1000, OPTS);

/** Force a clean, known table state. */
function rig(s: any, opts: { hands: Record<string, string[]>; deck?: string[]; current?: string }) {
  for (const [id, hand] of Object.entries(opts.hands)) {
    s.players[id].hand = [...hand];
  }
  if (opts.deck) s.deck = [...opts.deck];
  if (opts.current) s.turnIdx = s.order.indexOf(opts.current);
  s.phase = "turn";
}

// A. Setup: deck composition, deal, tokens target.
{
  const total = Object.values(LL_COUNTS).reduce((a, b) => a + b, 0);
  ok(total === 21, "ll: the deck holds 21 cards");

  const s4 = fresh("a", "b", "c", "d");
  ok(s4.tokensToWin === 4, "ll: 4 players race to 4 tokens");
  ok(s4.removed !== null && s4.faceUp.length === 0, "ll: one card set aside face-down");
  ok(s4.players.a.hand.length === 2 && s4.players.b.hand.length === 1,
    "ll: everyone holds 1 card, the opener drew a 2nd");
  ok(s4.deck.length === 21 - 1 - 4 - 1, "ll: deck count adds up (4p)");

  const s2 = fresh("a", "b");
  ok(s2.tokensToWin === 6 && s2.faceUp.length === 3, "ll: 2 players → 6 tokens, 3 cards face-up");
}

// B. Guard: right guess eliminates; Guard can't be named; protection blocks.
{
  const s = fresh("a", "b", "c");
  rig(s, { hands: { a: ["guard", "spy"], b: ["princess"], c: ["baron"] }, current: "a", deck: ["guard", "guard", "guard"] });
  ok(loveletter.action(s, "a", { type: "play", card: "guard", target: "b", guess: "guard" }, P) === false,
    "ll: the Guard can't name a Guard");
  loveletter.action(s, "a", { type: "play", card: "guard", target: "b", guess: "princess" }, P);
  ok(s.players.b.alive === false && s.lastEvent.eliminatedId === "b",
    "ll: a correct Guard guess eliminates");
  ok(s.players.b.discards.includes("princess"), "ll: the victim's hand is revealed face-up");

  const s2 = fresh("a", "b", "c");
  rig(s2, { hands: { a: ["guard", "spy"], b: ["princess"], c: ["baron"] }, current: "a", deck: ["guard", "guard"] });
  s2.players.b.shielded = true;
  ok(loveletter.action(s2, "a", { type: "play", card: "guard", target: "b", guess: "princess" }, P) === false,
    "ll: the Handmaid blocks targeting");
  loveletter.action(s2, "a", { type: "play", card: "guard", target: "c", guess: "king" }, P);
  ok(s2.players.c.alive === true, "ll: a wrong guess is harmless");
}

// C. Priest: knowledge gained, then invalidated when the hand changes.
{
  const s = fresh("a", "b", "c");
  rig(s, { hands: { a: ["priest", "spy"], b: ["king"], c: ["baron"] }, current: "a", deck: ["guard", "guard", "guard", "guard"] });
  loveletter.action(s, "a", { type: "play", card: "priest", target: "b" }, P);
  ok(s.knowledge.a.b === "king", "ll: the Priest peeks at the hand");
  const viewA = loveletter.playerView!(s, "a") as any;
  const viewC = loveletter.playerView!(s, "c") as any;
  ok(viewA.youKnow.b === "king" && viewC.youKnow.b === undefined,
    "ll: intel is private to the peeker");
  // b plays prince on themself → hand changes → intel is stale.
  rig(s, { hands: { b: ["prince", "king"] }, current: "b" });
  loveletter.action(s, "b", { type: "play", card: "prince", target: "b" }, P);
  ok(s.knowledge.a.b === undefined, "ll: intel dies when the hand changes");
}

// D. Baron: lower card falls; tie reveals both, eliminates nobody.
{
  const s = fresh("a", "b", "c");
  rig(s, { hands: { a: ["baron", "king"], b: ["priest"], c: ["spy"] }, current: "a", deck: ["guard", "guard", "guard"] });
  loveletter.action(s, "a", { type: "play", card: "baron", target: "b" }, P);
  ok(s.players.b.alive === false, "ll: the Baron eliminates the lower card");

  const s2 = fresh("a", "b", "c");
  rig(s2, { hands: { a: ["baron", "priest"], b: ["priest"], c: ["spy"] }, current: "a", deck: ["guard", "guard", "guard"] });
  loveletter.action(s2, "a", { type: "play", card: "baron", target: "b" }, P);
  ok(s2.players.b.alive && s2.players.a.alive && s2.lastEvent.tie === true,
    "ll: a Baron tie spares both");
  ok(s2.knowledge.a.b === "priest" && s2.knowledge.b.a === "priest",
    "ll: both duelists see each other's card");
}

// E. Countess locks King/Prince; Princess is suicide; Handmaid shields.
{
  const s = fresh("a", "b");
  rig(s, { hands: { a: ["countess", "king"], b: ["spy"] }, current: "a", deck: ["guard", "guard"] });
  ok(loveletter.action(s, "a", { type: "play", card: "king", target: "b" }, P) === false,
    "ll: the Countess forbids playing the King");
  ok(loveletter.action(s, "a", { type: "play", card: "countess" }, P) === true,
    "ll: playing the Countess herself is fine");

  const s2 = fresh("a", "b", "c");
  rig(s2, { hands: { a: ["princess", "spy"], b: ["guard"], c: ["guard"] }, current: "a", deck: ["guard", "guard"] });
  loveletter.action(s2, "a", { type: "play", card: "princess" }, P);
  ok(s2.players.a.alive === false, "ll: discarding the Princess is fatal");

  const s3 = fresh("a", "b", "c");
  rig(s3, { hands: { a: ["handmaid", "spy"], b: ["guard"], c: ["guard"] }, current: "a", deck: ["guard", "guard", "guard", "guard"] });
  loveletter.action(s3, "a", { type: "play", card: "handmaid" }, P);
  ok(s3.players.a.shielded === true, "ll: the Handmaid raises the shield");
  // The shield holds while the other players take their turns…
  rig(s3, { hands: { b: ["guard"], c: ["spy"] }, current: "b" });
  loveletter.action(s3, "b", { type: "play", card: "guard", target: "c", guess: "king" }, P);
  ok(s3.players.a.shielded === true, "ll: the Handmaid shield holds through other turns");
  // …and drops only when a's own turn comes back around.
  rig(s3, { hands: { b: ["spy"], c: ["guard"] }, current: "c" });
  loveletter.action(s3, "c", { type: "play", card: "guard", target: "b", guess: "king" }, P);
  ok(s3.players.a.shielded === false, "ll: the shield drops when your turn comes back");
}

// F. Prince: forced discard + redraw; Princess discard kills; empty deck uses the set-aside card.
{
  const s = fresh("a", "b", "c");
  rig(s, { hands: { a: ["prince", "spy"], b: ["king"], c: ["spy"] }, current: "a", deck: ["baron", "guard", "guard"] });
  // Target the last player in turn order so their fresh hand isn't immediately
  // topped up by their own turn's draw — we want to see just the redraw.
  loveletter.action(s, "a", { type: "play", card: "prince", target: "c" }, P);
  ok(s.players.c.discards.includes("spy") && s.players.c.hand.length === 1,
    "ll: the Prince forces a discard and a redraw");

  const s2 = fresh("a", "b", "c");
  rig(s2, { hands: { a: ["prince", "spy"], b: ["princess"], c: ["spy"] }, current: "a", deck: ["guard", "guard"] });
  loveletter.action(s2, "a", { type: "play", card: "prince", target: "b" }, P);
  ok(s2.players.b.alive === false, "ll: a Prince-forced Princess discard eliminates");

  const s3 = fresh("a", "b", "c");
  rig(s3, { hands: { a: ["prince", "spy"], b: ["king"], c: ["spy"] }, current: "a", deck: ["guard"] });
  s3.removed = "baron";
  loveletter.action(s3, "a", { type: "play", card: "prince", target: "b" }, P);
  // deck had 1 card: prince redraw takes it... deck empties → round ends.
  ok(s3.players.b.hand[0] === "guard" || s3.players.b.hand[0] === "baron",
    "ll: the Prince redraw came from somewhere legal");

  const s4 = fresh("a", "b", "c");
  rig(s4, { hands: { a: ["prince", "king"], b: ["spy"], c: ["spy"] }, current: "a", deck: [] });
  s4.removed = "baron";
  loveletter.action(s4, "a", { type: "play", card: "prince", target: "a" }, P);
  ok(s4.players.a.discards.includes("king") &&
     (s4.players.a.hand[0] === "baron" || s4.phase !== "turn"),
    "ll: an empty deck redraws the set-aside card (Prince on yourself)");
}

// G. King swaps hands and both players know it.
{
  const s = fresh("a", "b", "c");
  rig(s, { hands: { a: ["king", "spy"], b: ["princess"], c: ["guard"] }, current: "a", deck: ["guard", "guard", "guard"] });
  loveletter.action(s, "a", { type: "play", card: "king", target: "b" }, P);
  ok(s.players.a.hand[0] === "princess" && s.players.b.hand[0] === "spy",
    "ll: the King trades hands");
  ok(s.knowledge.a.b === "spy" && s.knowledge.b.a === "princess",
    "ll: both traders know what they handed over");
}

// H. Chancellor: draw 2, keep 1, the rest goes under the deck.
{
  const s = fresh("a", "b", "c");
  rig(s, { hands: { a: ["chancellor", "spy"], b: ["guard"], c: ["guard"] }, current: "a",
           deck: ["baron", "priest", "handmaid", "guard"] });
  loveletter.action(s, "a", { type: "play", card: "chancellor" }, P);
  ok(s.phase === "chancellor" && s.players.a.hand.length === 3,
    "ll: the Chancellor draws 2 and holds 3");
  ok(loveletter.action(s, "b", { type: "keep", card: "guard" }, P) === false,
    "ll: only the Chancellor player chooses");
  const deckBefore = s.deck.length;
  loveletter.action(s, "a", { type: "keep", card: "spy" }, P);
  ok(s.players.a.hand.length === 1, // kept spy alone; the turn then passed on.
    "ll: keep resolves" );
  ok(s.deck.length === deckBefore + 2 - 1, // +2 returned, -1 drawn by next player
    "ll: the two rejected cards slid under the deck");
}

// I. Round end by deck exhaustion: highest card wins, discards break ties.
{
  const s = fresh("a", "b", "c");
  rig(s, { hands: { a: ["spy", "guard"], b: ["king"], c: ["priest"] }, current: "a", deck: [] });
  s.players.a.tokens = 0;
  loveletter.action(s, "a", { type: "play", card: "guard", target: "b", guess: "baron" }, P);
  ok(s.phase === "roundEnd" && s.roundResult.winnerId === "b" && s.roundResult.reason === "highest",
    "ll: empty deck → highest card takes the round");
  ok(s.players.b.tokens === 1, "ll: the round winner banks a token");

  // host advances; the winner opens the next round.
  ok(loveletter.action(s, "a", { type: "next" }, P) === false, "ll: only the host advances");
  loveletter.action(s, "a", { type: "next" }, HOST);
  ok(s.phase === "turn" && s.order[s.turnIdx] === "b" && s.round === 2,
    "ll: the round winner opens the next round");
}

// J. Spy bonus: exactly one surviving spy-player earns +1.
{
  const s = fresh("a", "b", "c");
  rig(s, { hands: { a: ["spy", "guard"], b: ["king"], c: ["priest"] }, current: "a", deck: [] });
  loveletter.action(s, "a", { type: "play", card: "spy" }, P);
  ok(s.phase === "roundEnd" && s.roundResult.spyBonusId === "a" && s.players.a.tokens === 1,
    "ll: the lone Spy player earns the bonus token");
  ok(s.players.b.tokens === 1, "ll: the round still goes to the highest card");
}

// K. Match victory at the token target.
{
  const s = fresh("a", "b", "c"); // race to 5
  s.players.b.tokens = 4;
  rig(s, { hands: { a: ["spy", "guard"], b: ["king"], c: ["priest"] }, current: "a", deck: [] });
  loveletter.action(s, "a", { type: "play", card: "guard", target: "c", guess: "baron" }, P);
  ok(s.phase === "over" && s.winnerId === "b", "ll: reaching the target wins the match");
}

// L. Last alive wins the round instantly.
{
  const s = fresh("a", "b");
  rig(s, { hands: { a: ["guard", "spy"], b: ["princess"] }, current: "a", deck: ["guard", "guard"] });
  loveletter.action(s, "a", { type: "play", card: "guard", target: "b", guess: "princess" }, P);
  ok(s.roundResult?.winnerId === "a" && s.roundResult?.reason === "lastAlive",
    "ll: last one standing takes the round");
}

// M. Departures: leaver is eliminated; alone = match over.
{
  const s = fresh("a", "b", "c");
  loveletter.onLeave(s, "b", 2000);
  ok(!s.order.includes("b") && s.order.length === 2, "ll: a leaver is removed from the match");
  loveletter.onLeave(s, "c", 2000);
  ok(s.phase === "over" && s.winnerId === "a", "ll: the last player in the room wins");
}

console.log(`\nLove Letter: all ${pass} checks passed.`);
