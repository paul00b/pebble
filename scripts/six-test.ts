// Deterministic unit tests for 6 Qui Prend, using controlled board states.
import { sixQuiPrend } from "../server/src/games/sixquiprend.js";
import { bullHeads } from "../shared/src/games.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🐂", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

const ctx = { now: 0, isHost: true };

function controlled(rows: number[][], hands: Record<string, number[]>): any {
  const s: any = sixQuiPrend.init(players(...Object.keys(hands)), 0, { language: "en" });
  s.rows = rows.map((r) => [...r]);
  s.hands = Object.fromEntries(Object.entries(hands).map(([k, v]) => [k, [...v]]));
  s.chosen = Object.fromEntries(Object.keys(hands).map((k) => [k, null]));
  s.bulls = Object.fromEntries(Object.keys(hands).map((k) => [k, 0]));
  s.order = Object.keys(hands);
  s.queue = [];
  s.pending = null;
  s.turn = 1;
  return s;
}

// bull-head scoring sanity
ok(bullHeads(55) === 7 && bullHeads(11) === 5 && bullHeads(10) === 3 && bullHeads(5) === 2 && bullHeads(3) === 1,
  "six: bull-head values (55→7, 11→5, 10→3, 5→2, 3→1)");

// 1. Simple placement, ascending order, into nearest-lower row.
{
  const s = controlled([[10], [20], [30], [40]], { a: [11], b: [25] });
  sixQuiPrend.action(s, "a", { type: "choose", card: 11 }, ctx);
  sixQuiPrend.action(s, "b", { type: "choose", card: 25 }, ctx);
  ok(s.rows[0].join() === "10,11", "six: 11 placed after 10");
  ok(s.rows[1].join() === "20,25", "six: 25 placed after 20");
  ok(s.bulls.a === 0 && s.bulls.b === 0, "six: no penalties on clean placement");
  ok(s.over === true, "six: game ends when hands are empty");
}

// 2. Sixth card scoops the row.
{
  const s = controlled([[1, 2, 3, 4, 5], [10], [20], [30]], { a: [6], b: [100] });
  sixQuiPrend.action(s, "a", { type: "choose", card: 6 }, ctx);
  sixQuiPrend.action(s, "b", { type: "choose", card: 100 }, ctx);
  ok(s.bulls.a === 6, "six: 6th card scoops the row (1+1+1+1+2 = 6 bulls)");
  ok(s.rows[0].join() === "6", "six: scooped row restarts with the played card");
  ok(s.rows[3].join() === "30,100", "six: high card placed on highest row");
}

// 3. A card below all rows forces a row choice.
{
  const s = controlled([[10], [20], [30], [40]], { a: [5], b: [50] });
  sixQuiPrend.action(s, "a", { type: "choose", card: 5 }, ctx);
  sixQuiPrend.action(s, "b", { type: "choose", card: 50 }, ctx);
  ok(s.phase === "takeRow" && s.pending?.playerId === "a", "six: low card pauses for a row choice");
  sixQuiPrend.action(s, "a", { type: "takeRow", rowIndex: 0 }, ctx);
  ok(s.bulls.a === bullHeads(10), "six: taking a row adds its bulls");
  ok(s.rows[0].join() === "5", "six: taken row restarts with the played card");
  ok(s.rows[3].join() === "40,50" && s.over, "six: resolution resumes after the choice, then ends");
  ok(s.winnerId === "b", "six: fewest bulls wins (b=0 beats a)");
}

console.log(`\n🎉 All ${pass} six-qui-prend checks passed.`);
