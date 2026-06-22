// Deterministic unit tests for Uno, with controlled hands, draw pile and discard.
import { uno } from "../server/src/games/uno.js";
import type { UnoCard, UnoCardKind, UnoColor } from "../shared/src/games.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🎴", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));
const A = { now: 0, isHost: false };
const HOST = { now: 0, isHost: true };
const card = (color: UnoColor | null, kind: UnoCardKind, value: number | null, id: string): UnoCard =>
  ({ id, color, kind, value });
const top = (s: any): UnoCard => s.discard[s.discard.length - 1];

function fresh(ids: string[], settings: Record<string, unknown> = {}): any {
  return uno.init(players(...ids), 0, { language: "en", settings });
}

// 1. Init deals the configured hand and flips a number card.
{
  const s = fresh(["a", "b", "c"], { startingHand: 7 });
  ok(s.order.length === 3, "uno: three seats");
  ok(["a", "b", "c"].every((id) => s.hands[id].length === 7), "uno: 7 cards dealt each");
  ok(s.discard.length === 1 && top(s).kind === "num", "uno: opening card is a plain number");
  ok(s.drawPile.length === 108 - 21 - 1, "uno: draw pile holds the rest of a 108-card deck");
}

// 2. Play a color match; turn advances clockwise.
{
  const s = fresh(["a", "b", "c"]);
  s.currentIdx = 0; s.phase = "play"; s.pendingDraw = 0;
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "num", 9, "a1"), card("blue", "num", 2, "a2")];
  ok(uno.action(s, "a", { type: "play", cardId: "a1" }, A), "uno: a plays red 9 on red 5");
  ok(top(s).id === "a1" && s.currentColor === "red", "uno: discard + color updated");
  ok(s.currentIdx === 1, "uno: turn passes to b");
  ok(!uno.action(s, "a", { type: "play", cardId: "a2" }, A), "uno: off-turn play rejected");
}

// 3. A mismatched card is rejected.
{
  const s = fresh(["a", "b"]);
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("blue", "num", 2, "a1")];
  ok(!uno.action(s, "a", { type: "play", cardId: "a1" }, A), "uno: blue 2 illegal on red 5");
}

// 4. Skip jumps the next player.
{
  const s = fresh(["a", "b", "c"]);
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "skip", null, "a1")];
  uno.action(s, "a", { type: "play", cardId: "a1" }, A);
  ok(s.currentIdx === 2, "uno: skip lands on c, skipping b");
}

// 5. Reverse with two players acts like a skip (mover goes again).
{
  const s = fresh(["a", "b"]);
  s.currentIdx = 0; s.phase = "play"; s.dir = 1;
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "reverse", null, "a1"), card("red", "num", 1, "a2")];
  uno.action(s, "a", { type: "play", cardId: "a1" }, A);
  ok(s.dir === -1 && s.currentIdx === 0, "uno: 2-player reverse returns to the mover");
}

// 6. Draw Two without stacking: the next player eats two and is skipped.
{
  const s = fresh(["a", "b", "c"], { stacking: false });
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "draw2", null, "a1"), card("red", "num", 0, "a-x")];
  s.hands.b = [card("blue", "num", 1, "b1")];
  s.drawPile = [card("green", "num", 3, "d1"), card("green", "num", 4, "d2")];
  uno.action(s, "a", { type: "play", cardId: "a1" }, A);
  ok(s.pendingDraw === 2 && s.currentIdx === 1, "uno: +2 pending lands on b");
  ok(!uno.action(s, "b", { type: "play", cardId: "b1" }, A), "uno: b can't play a normal card over a pending draw");
  uno.action(s, "b", { type: "draw" }, A);
  ok(s.hands.b.length === 3 && s.pendingDraw === 0, "uno: b eats two cards");
  ok(s.currentIdx === 2, "uno: b is skipped after eating");
}

// 7. Stacking: +2 on +2 accumulates, then the third player eats four.
{
  const s = fresh(["a", "b", "c"], { stacking: true });
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "draw2", null, "a1"), card("red", "num", 0, "a-x")];
  s.hands.b = [card("blue", "draw2", null, "b1"), card("blue", "num", 0, "b-x")];
  s.hands.c = [card("green", "num", 1, "c1")];
  s.drawPile = Array.from({ length: 6 }, (_, i) => card("yellow", "num", i % 10, "p" + i));
  uno.action(s, "a", { type: "play", cardId: "a1" }, A);
  ok(uno.action(s, "b", { type: "play", cardId: "b1" }, A), "uno: b stacks a +2 (color ignored)");
  ok(s.pendingDraw === 4 && s.currentIdx === 2, "uno: stack totals four on c");
  uno.action(s, "c", { type: "draw" }, A);
  ok(s.hands.c.length === 5 && s.pendingDraw === 0, "uno: c eats four");
}

// 8. Wild sets the active color and needs a chosen color.
{
  const s = fresh(["a", "b"]);
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card(null, "wild", null, "a1"), card("red", "num", 1, "a2")];
  ok(!uno.action(s, "a", { type: "play", cardId: "a1" }, A), "uno: a wild needs a color");
  uno.action(s, "a", { type: "play", cardId: "a1", color: "blue" }, A);
  ok(s.currentColor === "blue" && top(s).color === "blue", "uno: wild recolors the pile to blue");
}

// 9. Draw-to-match keeps drawing until a playable card surfaces.
{
  const s = fresh(["a", "b"], { drawToMatch: true });
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("blue", "num", 1, "a1")];
  // pop() pulls from the end: yellow8 (no), green3 (no), red7 (yes → stop).
  s.drawPile = [card("red", "num", 7, "d-yes"), card("green", "num", 3, "d-no2"), card("yellow", "num", 8, "d-no1")];
  uno.action(s, "a", { type: "draw" }, A);
  ok(s.hands.a.length === 4, "uno: drew 3 until a playable card appeared");
  ok(s.phase === "decideDrawn" && s.drawnCardId === "d-yes", "uno: stops on the playable draw");
}

// 10. Force-play forbids passing on a drawn playable card.
{
  const s = fresh(["a", "b"], { forcePlay: true });
  s.currentIdx = 0; s.phase = "decideDrawn"; s.drawnCardId = "a1";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "num", 9, "a1")];
  ok(!uno.action(s, "a", { type: "pass" }, A), "uno: force-play rejects a pass");
  uno.action(s, "a", { type: "play", cardId: "a1" }, A);
  ok(top(s).id === "a1", "uno: the drawn card is played");
}

// 11. Uno calls + catching.
{
  const s = fresh(["a", "b"], { unoPenalty: 2 });
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "num", 1, "a1")]; s.uno.a = false;
  s.hands.b = [card("blue", "num", 2, "b1"), card("blue", "num", 3, "b2")];
  s.drawPile = [card("green", "num", 1, "x1"), card("green", "num", 2, "x2")];
  ok(uno.action(s, "b", { type: "catch", targetId: "a" }, A), "uno: b catches a (no Uno called)");
  ok(s.hands.a.length === 3, "uno: caught player draws the penalty");
  // After drawing back up, a is no longer catchable.
  ok(!uno.action(s, "b", { type: "catch", targetId: "a" }, A), "uno: a is safe once back above one card");
}

// 12. Calling Uno protects from a catch.
{
  const s = fresh(["a", "b"]);
  s.currentIdx = 0; s.phase = "play";
  s.hands.a = [card("red", "num", 1, "a1")];
  uno.action(s, "a", { type: "callUno" }, A);
  ok(s.uno.a === true, "uno: a declares Uno");
  ok(!uno.action(s, "b", { type: "catch", targetId: "a" }, A), "uno: a can't be caught after calling");
}

// 13. Emptying your hand ends a single round; winner scores opponents' cards.
{
  const s = fresh(["a", "b"], { scoreTarget: 0 });
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "num", 9, "a1")];
  s.hands.b = [card("blue", "skip", null, "b1"), card("blue", "num", 4, "b2")]; // 20 + 4 = 24
  uno.action(s, "a", { type: "play", cardId: "a1" }, A);
  ok(s.phase === "over" && s.matchWinnerId === "a", "uno: single round ends the match");
  ok(s.scores.a === 24, "uno: winner scores the opponents' remaining card points");
}

// 14. With a points target, a round-win shows a scoreboard; host deals the next.
{
  const s = fresh(["a", "b"], { scoreTarget: 500 });
  s.currentIdx = 0; s.phase = "play";
  s.discard = [card("red", "num", 5, "top")]; s.currentColor = "red";
  s.hands.a = [card("red", "num", 9, "a1")];
  s.hands.b = [card("blue", "num", 4, "b1")];
  uno.action(s, "a", { type: "play", cardId: "a1" }, A);
  ok(s.phase === "roundOver" && s.matchWinnerId === null, "uno: below target → scoreboard, not over");
  ok(!uno.action(s, "a", { type: "next" }, A), "uno: non-host can't start the next round");
  uno.action(s, "a", { type: "next" }, HOST);
  ok(s.phase === "play" && s.round === 2, "uno: host deals round two");
  ok(s.hands.a.length === 7 && s.hands.b.length === 7, "uno: fresh hands dealt");
}

console.log(`\n🎉 All ${pass} uno checks passed.`);
