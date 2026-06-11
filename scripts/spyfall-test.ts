// Deterministic unit tests for Spyfall. No server/network needed.
import { spyfall } from "../server/src/games/spyfall.js";
import { locationNames } from "../server/src/games/spyfallLocations.js";

let pass = 0;
const ok = (c: unknown, m: string) => {
  if (!c) { console.error("❌", m); process.exit(1); }
  pass++; console.log("✅", m);
};

const players = (...ids: string[]) =>
  ids.map((id) => ({ id, name: id, avatar: "🔎", color: "#fff", isHost: false, connected: true, joinedAt: 0 }));

const HOST = { now: 1000, isHost: true };
const P = { now: 1000, isHost: false };

const fresh = (): any =>
  spyfall.init(players("a", "b", "c", "d"), 1000, {
    language: "en",
    settings: { roundSec: 300 },
  });

/** Pin the round to a known setup so tests are deterministic. */
const rigged = (): any => {
  const s = fresh();
  s.spyId = "d";
  s.location = s.locations[0];
  s.roles = { a: "Role A", b: "Role B", c: "Role C" };
  s.askerIdx = 0;
  return s;
};

// A. Init: one spy, everyone else has a role at the location.
{
  const s = fresh();
  ok(s.order.length === 4 && s.order.includes(s.spyId), "sf: a spy is drawn from the players");
  const nonSpies = s.order.filter((id: string) => id !== s.spyId);
  ok(nonSpies.every((id: string) => typeof s.roles[id] === "string" && s.roles[id].length > 0),
    "sf: every non-spy has a role");
  ok(s.roles[s.spyId] === undefined, "sf: the spy has no role");
  ok(s.locations.includes(s.location), "sf: the location comes from the public list");
  ok(s.locations.length === locationNames("en").length, "sf: the full bank is exposed");
  ok(s.deadline === 1000 + 300_000 && s.phase === "playing", "sf: round timer set from settings");
}

// B. Per-player views keep the secrets straight.
{
  const s = rigged();
  const crew = spyfall.playerView!(s, "a") as any;
  ok(crew.location === s.location && crew.role === "Role A" && !crew.youAreSpy,
    "sf: crew sees the location + own role");
  ok(crew.spyId === null, "sf: the spy's identity stays hidden");
  const spy = spyfall.playerView!(s, "d") as any;
  ok(spy.youAreSpy && spy.location === null && spy.role === null,
    "sf: the spy sees nothing but the list");
}

// C. The asking cue rotates (asker or host only).
{
  const s = rigged(); // asker = a
  ok(spyfall.action(s, "b", { type: "nextAsker" }, P) === false, "sf: only the asker can pass the cue");
  ok(spyfall.action(s, "a", { type: "nextAsker" }, P) === true && s.askerIdx === 1,
    "sf: the asker passes the cue");
}

// D. Spy guessing mid-round ends it instantly.
{
  const s = rigged();
  ok(spyfall.action(s, "a", { type: "spyGuess", index: 0 }, P) === false, "sf: crew can't guess");
  spyfall.action(s, "d", { type: "spyGuess", index: 0 }, P);
  ok(s.phase === "over" && s.winner === "spy" && s.reason === "guess",
    "sf: right guess → spy wins");

  const s2 = rigged();
  spyfall.action(s2, "d", { type: "spyGuess", index: 1 }, P);
  ok(s2.phase === "over" && s2.winner === "crew" && s2.reason === "wrongGuess",
    "sf: wrong guess → crew wins");
}

// E. Emergency vote: one per player; accusing an innocent loses the round.
{
  const s = rigged();
  ok(spyfall.action(s, "a", { type: "callVote" }, P) === true && s.phase === "voting",
    "sf: a player calls the vote");
  ok(s.calledBy === "a" && s.deadline === 1000 + 60_000, "sf: vote window opens");

  for (const v of ["a", "b", "d"]) spyfall.action(s, v, { type: "vote", playerId: "c" }, P);
  ok(s.phase === "voting", "sf: vote stays open until everyone voted");
  spyfall.action(s, "c", { type: "vote", playerId: "a" }, P);
  ok(s.phase === "over" && s.winner === "spy" && s.reason === "innocent" && s.accusedId === "c",
    "sf: plurality on an innocent → spy wins");

  const s2 = rigged();
  spyfall.action(s2, "b", { type: "callVote" }, P);
  ok(spyfall.action(s2, "b", { type: "vote", playerId: "b" }, P) === false, "sf: no self-votes");
}

// F. Catching the spy opens the steal guess.
{
  const s = rigged();
  spyfall.action(s, "a", { type: "callVote" }, P);
  for (const v of ["a", "b", "c"]) spyfall.action(s, v, { type: "vote", playerId: "d" }, P);
  spyfall.action(s, "d", { type: "vote", playerId: "a" }, P);
  ok(s.phase === "spyguess" && s.accusedId === "d", "sf: spy caught → steal window");
  const view = spyfall.playerView!(s, "a") as any;
  ok(view.spyId === "d", "sf: the spy is unmasked during the steal");

  spyfall.action(s, "d", { type: "spyGuess", index: 0 }, P);
  ok(s.winner === "spy" && s.reason === "steal", "sf: steal guess right → spy still wins");

  const s2 = rigged();
  spyfall.action(s2, "a", { type: "callVote" }, P);
  for (const v of ["a", "b", "c"]) spyfall.action(s2, v, { type: "vote", playerId: "d" }, P);
  spyfall.action(s2, "d", { type: "vote", playerId: "a" }, P);
  spyfall.action(s2, "d", { type: "spyGuess", index: 2 }, P);
  ok(s2.winner === "crew" && s2.reason === "caught", "sf: steal guess wrong → crew wins");
}

// G. Ties let the spy escape.
{
  const s = rigged();
  spyfall.action(s, "a", { type: "callVote" }, P);
  spyfall.action(s, "a", { type: "vote", playerId: "d" }, P);
  spyfall.action(s, "b", { type: "vote", playerId: "c" }, P);
  spyfall.action(s, "c", { type: "vote", playerId: "d" }, P);
  spyfall.action(s, "d", { type: "vote", playerId: "c" }, P);
  ok(s.phase === "over" && s.winner === "spy" && s.reason === "escaped",
    "sf: tied vote → the spy escapes");
}

// H. The clock drives the phases.
{
  const s = rigged();
  ok(spyfall.tick(s, s.deadline - 1) === false, "sf: tick before the deadline is a no-op");
  spyfall.tick(s, s.deadline);
  ok(s.phase === "voting" && s.calledBy === null, "sf: timer expiry opens the final vote");
  spyfall.action(s, "a", { type: "vote", playerId: "d" }, P);
  spyfall.tick(s, s.deadline);
  ok(s.phase === "spyguess", "sf: vote timeout resolves with the cast ballots");
  spyfall.tick(s, s.deadline);
  ok(s.phase === "over" && s.winner === "crew" && s.reason === "caught",
    "sf: a frozen spy loses the steal");
}

// I. Departures.
{
  const s = rigged();
  spyfall.onLeave(s, "d", 2000);
  ok(s.phase === "over" && s.winner === "crew" && s.reason === "left",
    "sf: the spy leaving hands the crew the win");

  const s2 = rigged();
  spyfall.onLeave(s2, "a", 2000);
  ok(s2.phase === "playing" && s2.order.length === 3 && !(("a") in s2.roles),
    "sf: a crew departure keeps the round going");
}

console.log(`\nSpyfall: all ${pass} checks passed.`);
