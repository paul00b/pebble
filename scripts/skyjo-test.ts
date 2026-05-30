// Deterministic unit tests for Skyjo, with controlled grids, deck and discard.
import { skyjo } from "../server/src/games/skyjo.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🃏", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));
const cells = (vals: number[], up = false) => vals.map((value) => ({ value, up, gone: false }));
const A = { now: 0, isHost: false };
const top = (arr: number[]) => arr[arr.length - 1];

function fresh(ids: string[]): any {
  return skyjo.init(players(...ids), 0, { language: "en" });
}

// 1. Flip-two setup picks the highest pair to start.
{
  const s = fresh(["a", "b"]);
  s.grids.a = cells([5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  s.grids.b = cells([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  skyjo.action(s, "a", { type: "flip", index: 0 }, A);
  skyjo.action(s, "a", { type: "flip", index: 1 }, A);
  ok(s.phase === "flip2", "skyjo: still in setup until everyone flips two");
  skyjo.action(s, "b", { type: "flip", index: 0 }, A);
  skyjo.action(s, "b", { type: "flip", index: 1 }, A);
  ok(s.phase === "turn" && s.currentId === "a", "skyjo: highest flipped pair starts (a:10 > b:2)");
}

// 2. Draw from deck, keep & replace a card.
{
  const s = fresh(["a", "b"]);
  s.phase = "turn"; s.stage = "await"; s.currentId = "a";
  s.grids.a = cells([9, 1, 2, 3, 4, 5, 6, 7, 8, 0, 0, 0], true);
  s.deck = [7];
  s.discard = [0];
  skyjo.action(s, "a", { type: "drawDeck" }, A);
  ok(s.held === 7 && s.stage === "resolveDraw", "skyjo: drawing reveals the held card");
  skyjo.action(s, "a", { type: "keepReplace", index: 0 }, A);
  ok(s.grids.a[0].value === 7 && top(s.discard) === 9, "skyjo: keep-replace swaps the card and discards the old");
}

// 3. Draw, then discard it and flip a face-down card instead.
{
  const s = fresh(["a", "b"]);
  s.phase = "turn"; s.stage = "await"; s.currentId = "a";
  s.grids.a = cells([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], true);
  s.grids.a[5].up = false; // one face-down
  s.deck = [3];
  skyjo.action(s, "a", { type: "drawDeck" }, A);
  skyjo.action(s, "a", { type: "discardFlip", index: 5 }, A);
  ok(top(s.discard) === 3 && s.grids.a[5].up === true, "skyjo: discard-and-flip discards the draw and flips a card");
}

// 4. Take the top of the discard pile.
{
  const s = fresh(["a", "b"]);
  s.phase = "turn"; s.stage = "await"; s.currentId = "a";
  s.grids.a = cells([9, 1, 2, 3, 4, 5, 6, 7, 8, 0, 11, 12], true);
  s.discard = [4];
  skyjo.action(s, "a", { type: "takeDiscard", index: 0 }, A);
  ok(s.grids.a[0].value === 4 && top(s.discard) === 9, "skyjo: take-discard replaces a card with the discard top");
}

// 5. A column of three equal face-up cards clears.
{
  const s = fresh(["a", "b"]);
  s.phase = "turn"; s.stage = "await"; s.currentId = "a";
  // Column 0 = indices 0,4,8 all = 5; rest varied & one face-down so not complete.
  s.grids.a = cells([5, 1, 2, 3, 5, 6, 7, 8, 5, 9, 10, 11], true);
  s.grids.a[11].up = false;
  s.deck = [0];
  skyjo.action(s, "a", { type: "drawDeck" }, A);
  skyjo.action(s, "a", { type: "keepReplace", index: 1 }, A); // touch a different cell
  ok(s.grids.a[0].gone && s.grids.a[4].gone && s.grids.a[8].gone, "skyjo: a matching column clears");
}

// 6. Round end + closer penalty (doubled if not strictly lowest).
{
  const s = fresh(["a", "b"]);
  s.grids.a = cells([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], true); // sum 66, complete
  s.grids.b = cells([-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], true); // sum 42, complete
  s.phase = "turn"; s.stage = "await"; s.currentId = "b"; s.closerId = "a";
  s.deck = [5]; s.discard = [9];
  skyjo.action(s, "b", { type: "drawDeck" }, A);
  skyjo.action(s, "b", { type: "discardFlip", index: 0 }, A); // b has no face-down → just discards
  ok(s.phase === "done", "skyjo: round ends when play returns to the closer");
  ok(s.finalScores.a === 132 && s.finalScores.b === 42, "skyjo: closer doubled (66→132) for not being lowest");
  ok(s.winnerId === "b", "skyjo: lowest final score wins");
}

console.log(`\n🎉 All ${pass} skyjo checks passed.`);
