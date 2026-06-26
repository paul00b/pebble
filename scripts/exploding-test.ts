// Deterministic unit tests for Exploding Kittens. No server/network needed.
import { exploding } from "../server/src/games/exploding.js";
import type { ExplodingCard } from "../shared/src/games.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🐱", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

const P = (now = 1000) => ({ now, isHost: false });
const OPTS = { language: "en" as const, settings: {} };
const fresh = (...ids: string[]): any => exploding.init(players(...ids), 1000, OPTS);

const setHand = (s: any, id: string, hand: ExplodingCard[]) => { s.players[id].hand = hand.slice(); };
const handCount = (c: ExplodingCard[], card: ExplodingCard) => c.filter((x) => x === card).length;
/** Resolve the open reaction/sub-step window via its deadline. */
const closeWindow = (s: any) => exploding.tick(s, s.deadline);
const cur = (s: any): string => s.order[s.turnIdx];

// A. Setup.
{
  const s = fresh("a", "b", "c");
  const n = 3;
  ok(s.order.every((id: string) => s.players[id].hand.length === 8), "ek: everyone is dealt 7 + 1 Defuse = 8 cards");
  ok(s.order.every((id: string) => handCount(s.players[id].hand, "defuse") === 1), "ek: each hand holds exactly one Defuse");
  const deckEk = handCount(s.deck, "ek");
  ok(deckEk === n - 1, "ek: the deck holds players − 1 Exploding Kittens");
  const totalDefuse = handCount(s.deck, "defuse") + s.order.reduce((t: number, id: string) => t + handCount(s.players[id].hand, "defuse"), 0);
  ok(totalDefuse === 6, "ek: six Defuse cards total are in play");
  ok(s.deck.length === 46 - 7 * n + (6 - n) + (n - 1), "ek: deck size accounts for deals, leftover defuses and kittens");
  ok(s.players.a.hand.every((c: ExplodingCard) => c !== "ek"), "ek: nobody is dealt a kitten");
}

// B. Drawing a normal card ends the turn.
{
  const s = fresh("a", "b");
  s.deck = ["skip"]; // 'a' will draw this
  const before = s.players.a.hand.length;
  exploding.action(s, "a", { type: "draw" }, P());
  ok(s.players.a.hand.length === before + 1, "ek: a drawn card joins your hand");
  ok(cur(s) === "b", "ek: drawing ends your turn");
}

// C. Attack stacks turns onto the next player; chained attacks add up.
{
  const s = fresh("a", "b");
  setHand(s, "a", ["attack"]);
  exploding.action(s, "a", { type: "play", card: "attack" }, P());
  closeWindow(s);
  ok(cur(s) === "b" && s.turnsLeft === 2, "ek: Attack forces the next player to take two turns");
  setHand(s, "b", ["attack"]);
  exploding.action(s, "b", { type: "play", card: "attack" }, P(2000));
  closeWindow(s);
  ok(cur(s) === "a" && s.turnsLeft === 4, "ek: an Attack while attacked stacks to four turns");
}

// D. Skip ends one turn without drawing.
{
  const s = fresh("a", "b");
  setHand(s, "a", ["skip", "skip"]);
  s.turnsLeft = 2; // pretend 'a' is under attack
  exploding.action(s, "a", { type: "play", card: "skip" }, P());
  closeWindow(s);
  ok(cur(s) === "a" && s.turnsLeft === 1, "ek: Skip burns one owed turn, keeping you on");
  exploding.action(s, "a", { type: "play", card: "skip" }, P(2000));
  closeWindow(s);
  ok(cur(s) === "b", "ek: the last Skip passes the turn");
}

// E. See the Future peeks the top three - privately.
{
  const s = fresh("a", "b");
  setHand(s, "a", ["future"]);
  s.deck = ["x1", "x2", "x3", "skip", "favor", "attack"] as ExplodingCard[]; // top = last
  exploding.action(s, "a", { type: "play", card: "future" }, P());
  closeWindow(s);
  const av = exploding.playerView(s, "a") as any;
  const bv = exploding.playerView(s, "b") as any;
  ok(JSON.stringify(av.future) === JSON.stringify(["attack", "favor", "skip"]), "ek: See the Future shows the top three, top first");
  ok(bv.future === null, "ek: the peek is private to the player who looked");
}

// F. Favor: the target chooses a card to give; timeout takes a random one.
{
  const s = fresh("a", "b");
  setHand(s, "a", ["favor"]);
  setHand(s, "b", ["skip", "attack"]);
  exploding.action(s, "a", { type: "play", card: "favor", target: "b" }, P());
  closeWindow(s);
  ok(s.phase === "favor" && s.favorGiverId === "b", "ek: Favor waits for the target to give a card");
  exploding.action(s, "b", { type: "give", index: 1 }, P(2000)); // gives 'attack'
  ok(s.players.a.hand.includes("attack") && s.players.b.hand.length === 1, "ek: the chosen card moves to the asker");
  ok(s.phase === "play" && cur(s) === "a", "ek: after a Favor the asker keeps playing");

  const s2 = fresh("a", "b");
  setHand(s2, "a", ["favor"]);
  setHand(s2, "b", ["skip"]);
  exploding.action(s2, "a", { type: "play", card: "favor", target: "b" }, P());
  closeWindow(s2);
  exploding.tick(s2, s2.deadline); // dithered → random card taken
  ok(s2.players.a.hand.includes("skip") && s2.players.b.hand.length === 0, "ek: a dithering target loses a random card");
}

// G. Nope cancels; a Nope-on-the-Nope (Yup) lets it through.
{
  const s = fresh("a", "b");
  setHand(s, "a", ["favor"]);
  setHand(s, "b", ["skip", "nope"]);
  exploding.action(s, "a", { type: "play", card: "favor", target: "b" }, P());
  ok(s.phase === "react", "ek: a played action opens a reaction window");
  exploding.action(s, "b", { type: "nope" }, P(1500));
  closeWindow(s);
  ok(s.phase === "play" && s.players.b.hand.includes("skip"), "ek: a single Nope cancels the action");
  ok(handCount(s.players.b.hand, "nope") === 0, "ek: the Nope is spent");

  const s2 = fresh("a", "b");
  setHand(s2, "a", ["favor", "nope"]);
  setHand(s2, "b", ["skip", "nope"]);
  exploding.action(s2, "a", { type: "play", card: "favor", target: "b" }, P());
  exploding.action(s2, "b", { type: "nope" }, P(1500)); // 1 nope
  exploding.action(s2, "a", { type: "nope" }, P(2000)); // Yup → 2
  closeWindow(s2);
  ok(s2.phase === "favor" && s2.favorGiverId === "b", "ek: a Yup (Nope on a Nope) re-enables the action");
}

// H. Cat combos steal cards.
{
  const s = fresh("a", "b");
  setHand(s, "a", ["tacocat", "tacocat"]);
  setHand(s, "b", ["skip"]);
  exploding.action(s, "a", { type: "play", card: "tacocat", combo: "pair", target: "b" }, P());
  closeWindow(s);
  ok(s.players.a.hand.includes("skip") && s.players.b.hand.length === 0, "ek: a matching pair steals a random card");

  const s2 = fresh("a", "b");
  setHand(s2, "a", ["beardcat", "beardcat", "beardcat"]);
  setHand(s2, "b", ["attack", "skip"]);
  exploding.action(s2, "a", { type: "play", card: "beardcat", combo: "triple", target: "b", named: "skip" }, P());
  closeWindow(s2);
  ok(s2.players.a.hand.includes("skip") && !s2.players.b.hand.includes("skip"), "ek: a triple takes the named card");
  ok(s2.players.b.hand.includes("attack"), "ek: a triple takes only the named card");
}

// I. Defuse keeps you in; a drawn kitten with no defuse explodes you.
{
  const s = fresh("a", "b");
  setHand(s, "a", ["defuse"]);
  s.deck = ["ek"] as ExplodingCard[];
  exploding.action(s, "a", { type: "draw" }, P());
  ok(s.phase === "insert" && s.inserterId === "a", "ek: drawing a kitten with a Defuse opens the insert step");
  exploding.action(s, "a", { type: "insert", index: 0 }, P(2000));
  ok(s.deck[s.deck.length - 1] === "ek" && s.players.a.alive, "ek: the kitten is slipped back on top and you survive");
  ok(cur(s) === "b", "ek: defusing still ends your turn");

  const s2 = fresh("a", "b");
  setHand(s2, "a", []); // no defuse
  s2.deck = ["ek"] as ExplodingCard[];
  exploding.action(s2, "a", { type: "draw" }, P());
  ok(!s2.players.a.alive && s2.players.a.exploded, "ek: no Defuse → you explode");
  ok(s2.phase === "over" && s2.winnerId === "b", "ek: last survivor wins");
}

// J. Departures.
{
  const s = fresh("a", "b", "c");
  exploding.onLeave(s, "b", 2000);
  ok(!s.players.b.alive, "ek: a leaver is knocked out");
  ok(s.phase !== "over", "ek: the game continues with two players");
  exploding.onLeave(s, "c", 3000);
  ok(s.phase === "over" && s.winnerId === "a", "ek: left alone, the last player wins");
}

console.log(`\nExploding Kittens: all ${pass} checks passed.`);
