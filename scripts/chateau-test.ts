// Deterministic unit tests for Château Combo. No server/network needed.
import { chateau } from "../server/src/games/chateau.js";
import { CHATEAU_CARDS, chateauCardById } from "../shared/src/chateauCards.js";

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

const faceDownCell = () => ({ cardId: null, faceDown: true, purse: 0 });
const cardCell = (id: string) => ({ cardId: id, faceDown: false, purse: 0 });

/** Fill a player's grid from a 9-slot spec ("fd", a card id, or null). */
function fill(s: any, pid: string, cells: (string | null)[]) {
  const p = s.players[pid];
  p.grid = cells.map((c) => (c === null ? null : c === "fd" ? faceDownCell() : cardCell(c)));
  p.placed = p.grid.filter(Boolean).length;
}

/** Rig the active market and let `pid` buy slot 0 into `cell`. */
function rigBuy(s: any, pid: string, cardId: string, cell: number, faceDown = false): boolean {
  s.market[s.messenger][0] = cardId;
  return chateau.action(s, pid, { type: "buy", index: 0, cell, faceDown }, P);
}

// A. Card database sanity.
{
  const castle = CHATEAU_CARDS.filter((c) => c.deck === "castle");
  const village = CHATEAU_CARDS.filter((c) => c.deck === "village");
  ok(castle.length === 39 && village.length === 38,
    "ch: 39 Château + 38 Village cards transcribed (one Village card missing from the spec photos)");
  ok(new Set(CHATEAU_CARDS.map((c) => c.id)).size === CHATEAU_CARDS.length, "ch: card ids unique");
  ok(CHATEAU_CARDS.every((c) => (c.score.t === "purse") === (c.purseMax != null)),
    "ch: purse caps exactly on purse-scoring cards");
}

// B. Setup per the rules.
{
  const s = fresh("a", "b", "c");
  ok(Object.values(s.players).every((p: any) => p.gold === 15 && p.keys === 2),
    "ch: everyone starts with 15 gold and 2 keys");
  ok(s.messenger === "village", "ch: the Messenger starts on the Village side");
  ok(s.market.castle.filter(Boolean).length === 3 && s.market.village.filter(Boolean).length === 3,
    "ch: both market rows open with 3 cards");
  ok(s.decks.castle.length === 36 && s.decks.village.length === 35, "ch: decks hold the rest");
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

// D. Placement: first card anywhere, then orthogonal adjacency.
{
  const s = fresh("a", "b");
  ok(rigBuy(s, "a", "bouffon", 4), "ch: first card goes anywhere (center)");
  ok(s.players.a.grid[4]?.cardId === "bouffon" && s.players.a.placed === 1, "ch: card placed");
  // b's turn - skip back to a.
  rigBuy(s, "b", "nonne", 0);
  ok(rigBuy(s, "a", "nonne", 0) === false, "ch: diagonal-only placement rejected");
  ok(rigBuy(s, "a", "nonne", 1), "ch: orthogonally adjacent placement accepted");
}

// E. Buying: cost, banner discount, floor at zero.
{
  const s = fresh("a", "b");
  s.players.a.banners = 2;
  const gold = s.players.a.gold;
  rigBuy(s, "a", "templier", 4); // cost 5 - 2 banners = 3; its fx pays keys, not gold
  ok(s.players.a.gold === gold - 3, "ch: banners discount the price");
  const s2 = fresh("a", "b");
  s2.players.a.banners = 9;
  const g2 = s2.players.a.gold;
  rigBuy(s2, "a", "bouffon", 4); // cost 3, discount 9 → free
  ok(s2.players.a.gold >= g2, "ch: the price never goes negative");
  const s3 = fresh("a", "b");
  s3.players.a.gold = 2;
  ok(rigBuy(s3, "a", "saintete", 4) === false, "ch: can't buy beyond your gold");
}

// F. Face-down: free, +6 gold +2 keys, occupies a cell, never scores.
{
  const s = fresh("a", "b");
  const { gold, keys } = s.players.a;
  ok(rigBuy(s, "a", "saintete", 4, true), "ch: an unaffordable card can be taken face-down");
  ok(s.players.a.gold === gold + 6 && s.players.a.keys === keys + 2,
    "ch: face-down pays +6 gold +2 keys");
  ok(s.players.a.grid[4]?.faceDown && s.players.a.grid[4]?.cardId === null,
    "ch: the face-down card has no identity");
}

// G. Immediate effects fire after placement.
{
  const s = fresh("a", "b");
  fill(s, "a", ["altesse", "reine", null, null, null, null, null, null, null]); // 2 crowns... altesse crown+castle, reine crown
  const gold = s.players.a.gold;
  rigBuy(s, "a", "bouffon", 2); // 2 gold per crown; bouffon adds a crown itself → 3 crowns
  ok(s.players.a.gold === gold - 3 + 6, "ch: gold-per-shield counts the new card too");

  const s2 = fresh("a", "b");
  const g2 = s2.players.b.gold;
  rigBuy(s2, "a", "altesse", 4); // opponents gain 1 gold
  ok(s2.players.b.gold === g2 + 1, "ch: opponent gifts are paid out");

  const s3 = fresh("a", "b");
  fill(s3, "a", ["apiculteur", null, null, null, null, null, null, null, null]);
  rigBuy(s3, "a", "doyenne", 1); // +2 gold on each purse (apiculteur max 9, doyenne max 5)
  ok(s3.players.a.grid[0].purse === 2 && s3.players.a.grid[1].purse === 2,
    "ch: purse effects feed every purse card");

  const s4 = fresh("a", "b");
  fill(s4, "b", ["reine", "altesse", null, null, null, null, null, null, null]); // rival has 2 crowns
  const g4 = s4.players.a.gold;
  rigBuy(s4, "a", "forgeronne", 4); // +1 gold per crown at best rival, or +2 keys
  ok(s4.players.a.gold === g4 - 5 && s4.players.a.keys === 4,
    "ch: a neighbor count not above the key offer takes the keys (2 crowns → +2 🗝️)");
}

// H. End of game: scoring formulas on real grids.
{
  // Player a: top row pelerin|architecte|nonne, all sharing black shields.
  const s = fresh("a", "b");
  fill(s, "b", ["fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd"]);
  fill(s, "a", ["pelerin", "architecte", "nonne", "scribe", "devot", "bouffon", "fd", "fd", null]);
  s.players.a.keys = 0;
  s.players.b.keys = 0;
  s.turnIdx = 0;
  rigBuy(s, "a", "humble", 8); // fills a's grid → game over
  ok(s.phase === "over" && s.scores, "ch: 9th card ends the game with scores");

  const sc = s.scores.a;
  // pelerin: 4 PV per black shield.
  // Blacks: pelerin, architecte, nonne, scribe, bouffon, humble = 6.
  ok(sc.cells[0] === 24, "ch: per-shield scoring counts shield instances (Pèlerin 6×4)");
  // architecte: 2 PV per black = 12.
  ok(sc.cells[1] === 12, "ch: Architecte scores 2 per black shield");
  // nonne at cell 2: 3 PV per castle orthogonally adjacent (cells 1, 5).
  // architecte (no castle), bouffon (no castle) → 0.
  ok(sc.cells[2] === 0, "ch: adjacency scoring reads only neighbors");
  // devot: 10 PV if no cross in the grid - none present → 10.
  ok(sc.cells[4] === 10, "ch: absence scoring pays without the shield");
  // b: all face-down → 0 card points.
  ok(s.scores.b.cardPts === 0, "ch: face-down cards score nothing");
  ok(s.winnerId === "a", "ch: highest total takes the château");
}

// I. Row/column/2×2 conditions + purse + leftover keys.
{
  const s = fresh("a", "b");
  fill(s, "b", ["fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd"]);
  // duchesse in a full top row; apiculteur with a fed purse; pecheur in a full 2x2.
  fill(s, "a", ["duchesse", "apiculteur", "pecheur", "fd", "fd", "fd", "fd", "fd", null]);
  s.players.a.grid[1].purse = 4;
  s.players.a.keys = 3;
  s.players.b.keys = 0;
  s.turnIdx = 0;
  rigBuy(s, "a", "charpentier", 8); // +2 keys; 8 PV with a face-down card present
  const sc = s.scores.a;
  ok(sc.cells[0] === 8, "ch: a full row pays the row bonus (Duchesse)");
  ok(sc.cells[1] === 8, "ch: purse scoring pays per stored gold (4×2)");
  ok(sc.cells[2] === 4, "ch: a full 2×2 square pays (Pêcheur)");
  ok(sc.cells[8] === 8, "ch: the face-down bonus pays (Charpentier)");
  ok(sc.keyPts === 5, "ch: 1 leftover key = 1 point (3 + 2 from Charpentier)");
}

// J. Sets and exhausted rows.
{
  const s = fresh("a", "b");
  fill(s, "b", ["fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd"]);
  // officier scores 4 per crown+swords pair: crowns: officier, garde(2 with officier...) ↓
  fill(s, "a", ["officier", "garde", "capitaine", "fd", "fd", "fd", "fd", "fd", null]);
  s.players.a.keys = 0; s.players.b.keys = 0;
  s.turnIdx = 0;
  rigBuy(s, "a", "fermiere", 8);
  // crowns: officier 1 + garde 1 = 2; swords: officier 1 + garde 1 + capitaine 2 = 4 → 2 pairs.
  ok(s.scores.a.cells[0] === 8, "ch: set scoring uses min over the set (2 crown+swords pairs)");

  // An exhausted active row flips the Messenger for free on the next turn.
  const s2 = fresh("a", "b");
  s2.messenger = "castle";
  s2.market.castle = ["bouffon", null, null];
  s2.decks.castle = [];
  s2.discards.castle = [];
  chateau.action(s2, "a", { type: "buy", index: 0, cell: 4 }, P);
  ok(s2.market.castle.every((c: string | null) => c === null) && s2.messenger === "village",
    "ch: an exhausted active row flips the Messenger for free");
}

// K. Departures.
{
  const s = fresh("a", "b", "c");
  chateau.onLeave(s, "b", 2000);
  ok(s.order.length === 2 && !("b" in s.players), "ch: a leaver is removed");
  chateau.onLeave(s, "c", 2000);
  ok(s.phase === "over" && s.scores, "ch: left alone, the table is scored and closed");
}

// L. Full coverage: every card can be bought, fire its effect, and be scored.
{
  for (const card of CHATEAU_CARDS) {
    const s = fresh("a", "b");
    fill(s, "b", ["fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd"]);
    fill(s, "a", ["fd", "fd", "fd", "fd", "fd", "fd", "fd", "fd", null]);
    s.players.a.gold = 99;
    s.turnIdx = 0;
    s.messenger = card.deck;
    const okBuy = rigBuy(s, "a", card.id, 8);
    if (!okBuy || s.phase !== "over" || typeof s.scores?.a?.total !== "number") {
      console.error("❌ ch: card failed the buy/score cycle:", card.id);
      process.exit(1);
    }
  }
  pass++;
  console.log(`✅ ch: all ${CHATEAU_CARDS.length} cards buy, resolve and score cleanly`);
}

console.log(`\nChâteau Combo: all ${pass} checks passed.`);
