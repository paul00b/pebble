// Deterministic unit tests for Château Combo. No server/network needed.
import { chateau } from "../server/src/games/chateau.js";
import {
  CHATEAU_CARDS,
  CHATEAU_SHIELDS,
  chateauCardById,
  chateauFamilyCounts,
} from "../shared/src/chateauCards.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🏰", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

const P = { now: 1000, isHost: false };
const OPTS = { language: "en" as const, settings: {} };

const fresh = (...ids: string[]): any => chateau.init(players(...ids), 1000, OPTS);

const fdCell = (x: number, y: number) => ({ x, y, cardId: null, faceDown: true, purse: 0 });
const cardCell = (id: string, x: number, y: number) => ({ x, y, cardId: id, faceDown: false, purse: 0 });

/** Lay out a 9-slot row-major template (id, "fd", or null) on the 3×3 plane. */
function fillGrid(s: any, pid: string, tpl: (string | null)[]) {
  const p = s.players[pid];
  p.cells = [];
  tpl.forEach((e, i) => {
    if (e === null) return;
    const x = i % 3, y = Math.floor(i / 3);
    p.cells.push(e === "fd" ? fdCell(x, y) : cardCell(e, x, y));
  });
  p.placed = p.cells.length;
}

/** Rig the active market and let `pid` buy slot 0 onto plane (x,y). */
function rigBuyAt(s: any, pid: string, cardId: string, x: number, y: number, faceDown = false): boolean {
  s.market[s.messenger][0] = cardId;
  return chateau.action(s, pid, { type: "buy", index: 0, x, y, faceDown }, P);
}

/** Score of a specific card in pid's final tableau. */
const scoreOf = (s: any, pid: string, cardId: string): number => {
  const i = s.players[pid].cells.findIndex((c: any) => c.cardId === cardId);
  return s.scores[pid].cells[i];
};

// A. Card database sanity.
{
  const castle = CHATEAU_CARDS.filter((c) => c.deck === "castle");
  const village = CHATEAU_CARDS.filter((c) => c.deck === "village");
  ok(castle.length === 39 && village.length === 39, "ch: 39 Château + 39 Village cards (full deck)");
  ok(new Set(CHATEAU_CARDS.map((c) => c.id)).size === CHATEAU_CARDS.length, "ch: card ids unique");
  ok(CHATEAU_CARDS.every((c) => (c.score.t === "purse") === (c.purseMax != null)),
    "ch: purse caps exactly on purse-scoring cards");
  ok(CHATEAU_CARDS.every((c) => typeof c.switchMessenger === "boolean"),
    "ch: every card declares a messenger-switch flag");
  ok(CHATEAU_CARDS.every((c) => c.shields.every((s) => CHATEAU_SHIELDS.includes(s))),
    "ch: all blasons belong to the six families");
  // Family blason totals (derived) — spot-check the noble/peasant counts.
  const fam = chateauFamilyCounts();
  ok(fam.noble.castle === 14 && fam.noble.village === 1, "ch: noble family = 14 château + 1 village");
  ok(fam.peasant.castle === 0 && fam.peasant.village === 20, "ch: peasant family = 0 château + 20 village");
}

// B. Setup per the rules.
{
  const s = fresh("a", "b", "c");
  ok(Object.values(s.players).every((p: any) => p.gold === 15 && p.keys === 2),
    "ch: everyone starts with 15 gold and 2 keys");
  ok(s.messenger === "village", "ch: the Messenger starts on the Village side");
  ok(s.market.castle.filter(Boolean).length === 3 && s.market.village.filter(Boolean).length === 3,
    "ch: both market rows open with 3 cards");
  ok(s.decks.castle.length === 36 && s.decks.village.length === 36, "ch: decks hold the rest");
}

// C. Key actions: move the Messenger / refresh the row.
{
  const s = fresh("a", "b");
  chateau.action(s, "a", { type: "messenger" }, P);
  ok(s.messenger === "castle" && s.players.a.keys === 1, "ch: 1 key moves the Messenger");
  const before = s.market.castle.slice();
  chateau.action(s, "a", { type: "refresh" }, P);
  ok(s.players.a.keys === 0 && s.discards.castle.length === 3 &&
     s.market.castle.every((id: string) => id && !before.includes(id)),
    "ch: 1 key refreshes the active row into the discard");
  ok(chateau.action(s, "a", { type: "messenger" }, P) === false, "ch: no keys, no key action");
  ok(chateau.action(s, "b", { type: "refresh" }, P) === false, "ch: only the current player acts");
}

// D. Placement: first at origin, orthogonal adjacency, bounding box ≤ 3×3.
{
  const s = fresh("a", "b");
  s.messenger = "village";
  ok(rigBuyAt(s, "a", "vigneron", 1, 1) === false, "ch: the first card must go to the origin (0,0)");
  ok(rigBuyAt(s, "a", "vigneron", 0, 0), "ch: first card placed at origin");
  s.turnIdx = 0; s.messenger = "village";
  ok(rigBuyAt(s, "a", "inventeur", 1, 1) === false, "ch: diagonal-only placement rejected");
  ok(rigBuyAt(s, "a", "inventeur", 1, 0), "ch: orthogonally adjacent placement accepted");
  s.turnIdx = 0; s.messenger = "village";
  ok(rigBuyAt(s, "a", "maitre_armes", 2, 0), "ch: extend the row to (2,0)");
  s.turnIdx = 0; s.messenger = "village";
  ok(rigBuyAt(s, "a", "philosophe", 3, 0) === false, "ch: a placement widening the box past 3 is rejected");
}

// E. Buying: per-deck discount, floor at zero, can't overspend.
{
  const s = fresh("a", "b");
  s.players.a.discountCastle = 2; s.messenger = "castle";
  const g = s.players.a.gold;
  rigBuyAt(s, "a", "juge", 0, 0); // castle cost 4 − 2 = 2 (juge has no gold effect)
  ok(s.players.a.gold === g - 2, "ch: the castle discount lowers castle prices");

  const s2 = fresh("a", "b");
  s2.players.a.discountVillage = 2; s2.messenger = "castle";
  const g2 = s2.players.a.gold;
  rigBuyAt(s2, "a", "juge", 0, 0); // village discount must NOT touch a castle price
  ok(s2.players.a.gold === g2 - 4, "ch: the village discount does not apply to castle cards");

  const s3 = fresh("a", "b");
  s3.players.a.discountCastle = 9; s3.messenger = "castle";
  const g3 = s3.players.a.gold;
  rigBuyAt(s3, "a", "juge", 0, 0); // 4 − 9 floored at 0
  ok(s3.players.a.gold === g3, "ch: the price never goes negative");

  const s4 = fresh("a", "b");
  s4.players.a.gold = 2; s4.messenger = "castle";
  ok(rigBuyAt(s4, "a", "prince", 0, 0) === false, "ch: can't buy beyond your gold");
}

// F. Face-down: free, +6 gold +2 keys, occupies a cell, never scores.
{
  const s = fresh("a", "b");
  const { gold, keys } = s.players.a;
  ok(rigBuyAt(s, "a", "prince", 0, 0, true), "ch: any card can be taken face-down");
  ok(s.players.a.gold === gold + 6 && s.players.a.keys === keys + 2, "ch: face-down pays +6 gold +2 keys");
  const c = s.players.a.cells[0];
  ok(c.faceDown && c.cardId === null, "ch: the face-down card has no identity");
}

// G. Immediate effects fire after placement.
{
  // gold-per-shield counts the freshly placed card.
  const s = fresh("a", "b");
  fillGrid(s, "a", ["prince", "reine", null, null, null, null, null, null, null]); // 2 nobles
  s.messenger = "castle"; s.turnIdx = 0;
  const gold = s.players.a.gold;
  rigBuyAt(s, "a", "bouffon", 2, 0); // +2 gold per noble; bouffon is itself noble → 3 nobles
  ok(s.players.a.gold === gold - 3 + 6, "ch: gold-per-shield counts the new card too");

  // Opponent gifts are paid out.
  const s2 = fresh("a", "b");
  s2.messenger = "castle";
  const g2 = s2.players.b.gold;
  rigBuyAt(s2, "a", "altesse", 0, 0); // opponents gain 1 gold
  ok(s2.players.b.gold === g2 + 1, "ch: opponent gifts are paid out");

  // Purse effects feed every purse card.
  const s3 = fresh("a", "b");
  fillGrid(s3, "a", ["apiculteur", null, null, null, null, null, null, null, null]);
  s3.messenger = "village"; s3.turnIdx = 0;
  rigBuyAt(s3, "a", "aubergiste", 1, 0); // purseAll +2 → both purses to 2
  ok(s3.players.a.cells[0].purse === 2 && s3.players.a.cells[1].purse === 2,
    "ch: purse effects feed every purse card (incl. the new one)");

  // Neighbor count beating the key offer takes the gold.
  const s4 = fresh("a", "b");
  fillGrid(s4, "b", ["prince", "reine", "duchesse", null, null, null, null, null, null]); // 4 nobles
  s4.messenger = "village"; s4.turnIdx = 0;
  const g4 = s4.players.a.gold;
  rigBuyAt(s4, "a", "forgeronne", 0, 0); // +1 gold per noble at best rival (4) vs +2 keys → gold
  ok(s4.players.a.gold === g4 - 5 + 4 && s4.players.a.keys === 2,
    "ch: a strong neighbor count beats the key offer (4 nobles → +4 🪙)");

  // Discount effect splits by scope.
  const s5 = fresh("a", "b");
  s5.messenger = "village"; s5.turnIdx = 0;
  rigBuyAt(s5, "a", "armuriere", 0, 0); // reduction on château AND village
  ok(s5.players.a.discountCastle === 1 && s5.players.a.discountVillage === 1,
    "ch: a 'both' reduction raises both discounts");

  // marketTake grabs the priciest card of the named row.
  const s6 = fresh("a", "b");
  s6.messenger = "village"; s6.turnIdx = 0;
  s6.market.castle = ["reine", "baron", null]; s6.decks.castle = ["mecene"]; s6.discards.castle = [];
  const g6 = s6.players.a.gold;
  rigBuyAt(s6, "a", "bourreau", 0, 0); // gain priciest château card's cost (reine = 7) in gold
  ok(s6.players.a.gold === g6 + 7 && s6.discards.castle.includes("reine"),
    "ch: marketTake gains the priciest row card's cost and discards it");

  // The messenger switches at the end of a flagged card's resolution.
  const s7 = fresh("a", "b");
  s7.messenger = "village"; s7.turnIdx = 0;
  rigBuyAt(s7, "a", "serrurier", 0, 0); // serrurier has the switch flag
  ok(s7.messenger === "castle", "ch: a switch-flagged card flips the Messenger when resolved");
  const s8 = fresh("a", "b");
  s8.messenger = "village"; s8.turnIdx = 0;
  rigBuyAt(s8, "a", "vigneron", 0, 0); // vigneron has no flag
  ok(s8.messenger === "village", "ch: a card without the flag leaves the Messenger put");
}

/** Build a full 9-card grid for `a` (8 preset + a 9th placed) and finalize. */
function finalizeWith(preset: (string | null)[], ninth: string, deck: "castle" | "village",
  tweak?: (s: any) => void): any {
  const s = fresh("a", "b");
  fillGrid(s, "b", Array(9).fill("fd"));
  fillGrid(s, "a", preset);
  s.players.a.keys = 0; s.players.b.keys = 0;
  s.messenger = deck; s.turnIdx = 0;
  tweak?.(s);
  const idx = preset.indexOf(null);
  rigBuyAt(s, "a", ninth, idx % 3, Math.floor(idx / 3));
  return s;
}

// H. End-game scoring formulas.
{
  // absent: no scholar present → full points.
  let s = finalizeWith(["fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd", null], "barbare", "village");
  ok(s.phase === "over" && s.scores, "ch: the 9th card ends the game with scores");
  ok(scoreOf(s, "a", "barbare") === 10, "ch: absence scoring pays when the shield is missing");

  // position: top-left placement satisfies rowTop / colLeft / corners.
  s = finalizeWith([null, "fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd"], "duchesse", "castle");
  ok(scoreOf(s, "a", "duchesse") === 8, "ch: a top-row card scores its rowTop bonus (Duchesse)");
  s = finalizeWith([null, "fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd"], "pecheur", "village");
  ok(scoreOf(s, "a", "pecheur") === 4, "ch: a corner card scores its corners bonus (Pêcheur)");
  s = finalizeWith(["fd", "fd", null, "fd", "fd", "fd", "fd", "fd", "fd"], "capitaine", "castle");
  ok(scoreOf(s, "a", "capitaine") === 8, "ch: a right-column card scores colRight (Capitaine)");
  s = finalizeWith(["fd", null, "fd", "fd", "fd", "fd", "fd", "fd", "fd"], "boulangere", "village");
  ok(scoreOf(s, "a", "boulangere") === 3, "ch: an edge-centre card scores plusCenters (Boulangère)");

  // adjacency: bouffon between two nobles (duchesse=2, prince=1) → 3 × 2.
  s = finalizeWith(["duchesse", null, "prince", "fd", "fd", "fd", "fd", "fd", "fd"], "bouffon", "castle");
  ok(scoreOf(s, "a", "bouffon") === 6, "ch: adjacency scoring counts neighbouring shields (Bouffon)");

  // distinctAdj: veilleur with a noble above and an artisan below → 2 × 4.
  s = finalizeWith(["prince", "fd", "fd", null, "fd", "fd", "horlogere", "fd", "fd"], "veilleur", "castle");
  ok(scoreOf(s, "a", "veilleur") === 8, "ch: distinct-adjacency counts distinct neighbour families (Veilleur)");

  // perDeckCard: usurpateur scores 2 per château card (prince, reine = 2) → 4.
  s = finalizeWith(["prince", "reine", "fd", "fd", "fd", "fd", "fd", "fd", null], "usurpateur", "village");
  ok(scoreOf(s, "a", "usurpateur") === 4, "ch: per-deck-card scoring counts your château cards (Usurpateur)");

  // perDeckPair: juge → min(castle, village) pairs. castle: prince,reine,juge=3; village: vigneron,inventeur=2 → 2×3.
  s = finalizeWith(["prince", "reine", "vigneron", "inventeur", "fd", "fd", "fd", "fd", null], "juge", "castle");
  ok(scoreOf(s, "a", "juge") === 6, "ch: deck-pair scoring uses the minority deck (Juge)");

  // perSet: officier → min(noble, military). prince+garde nobles=2; garde+officier military=2 → 2×4.
  s = finalizeWith(["prince", "garde", "fd", "fd", "fd", "fd", "fd", "fd", null], "officier", "castle");
  ok(scoreOf(s, "a", "officier") === 8, "ch: set scoring uses the min over the set (Officier)");

  // perTripletAny: générale with 4 nobles → one triplet → 6.
  s = finalizeWith(["prince", "reine", "duchesse", "fd", "fd", "fd", "fd", "fd", null], "generale", "castle");
  ok(scoreOf(s, "a", "generale") === 6, "ch: triplet scoring counts sets of three same shields (Générale)");

  // faceDown: charpentier pays because face-down cards are present.
  s = finalizeWith(["fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd", null], "charpentier", "village");
  ok(scoreOf(s, "a", "charpentier") === 8, "ch: the face-down bonus pays (Charpentier)");

  // purse + leftover keys.
  s = finalizeWith(["apiculteur", "fd", "fd", "fd", "fd", "fd", "fd", "fd", null], "philosophe", "village",
    (st) => { st.players.a.cells[0].purse = 5; st.players.a.keys = 3; });
  ok(scoreOf(s, "a", "apiculteur") === 10, "ch: purse scoring pays per stored gold (5 × 2)");
  ok(s.scores.a.keyPts === 3, "ch: 1 leftover key = 1 point");
}

// I. Exhausted active row flips the Messenger for free on the next turn.
{
  const s = fresh("a", "b");
  s.messenger = "castle";
  s.market.castle = ["bouffon", null, null];
  s.decks.castle = []; s.discards.castle = [];
  chateau.action(s, "a", { type: "buy", index: 0, x: 0, y: 0 }, P);
  // bouffon also has the switch flag → flips to village; the empty-row guard keeps it sane.
  ok(s.market.castle.every((c: string | null) => c === null) && s.messenger === "village",
    "ch: an exhausted active row never strands the next player");
}

// J. Departures.
{
  const s = fresh("a", "b", "c");
  chateau.onLeave(s, "b", 2000);
  ok(s.order.length === 2 && !("b" in s.players), "ch: a leaver is removed");
  chateau.onLeave(s, "c", 2000);
  ok(s.phase === "over" && s.scores, "ch: left alone, the table is scored and closed");
}

// K. Full coverage: every card can be bought, fire its effect, and be scored.
{
  for (const card of CHATEAU_CARDS) {
    const s = fresh("a", "b");
    fillGrid(s, "b", Array(9).fill("fd"));
    fillGrid(s, "a", ["fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd", null]);
    s.players.a.gold = 99;
    s.turnIdx = 0;
    s.messenger = card.deck;
    const okBuy = rigBuyAt(s, "a", card.id, 2, 2);
    if (!okBuy || s.phase !== "over" || typeof s.scores?.a?.total !== "number") {
      console.error("❌ ch: card failed the buy/score cycle:", card.id);
      process.exit(1);
    }
  }
  pass++;
  console.log(`✅ ch: all ${CHATEAU_CARDS.length} cards buy, resolve and score cleanly`);
}

console.log(`\nChâteau Combo: all ${pass} checks passed.`);
