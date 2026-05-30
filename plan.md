# Minigames Platform — Project Plan

> A free, beautiful website to play party minigames online with friends. Share a room ID, hop in, play. No signups, no friction, gorgeous Apple-grade UI.

---

## 1. Decisions locked in

These are settled from the kickoff Q&A and drive everything below.

| Topic | Decision | Implication |
|---|---|---|
| **Build mode** | Claude writes nearly all code; you steer + test | Plan is written so you can follow along and run things, but you won't have to author logic |
| **Hosting** | You have a VPS, need guidance | Single authoritative game server runs on your VPS. Guidance for setup is in §9 |
| **Realtime arch** | My call → authoritative Node + WebSocket server, in-memory rooms | Simplest mental model, lowest latency, no per-message cloud cost, fits a VPS perfectly |
| **MVP games** | **Bomb Party** + **Petit Bac** | Two games that stress-test the two core multiplayer patterns (live turns + simultaneous rounds) |
| **Devices** | Phone & desktop equally | Responsive, touch-first AND keyboard. Mobile portrait is a first-class layout |
| **Identity** | Guest now, optional accounts later | Nickname + avatar to join. Data model leaves room for accounts without a rewrite |
| **Branding** | I suggest names | See §3 |

---

## 2. Vision & experience goals

- **3-click rule:** Land → "Create room" → share ID → friends join. Nothing else required to play.
- **Wow on arrival:** The landing page should make someone go "what *is* this." Animated glass, depth, motion, a confident font. (§4)
- **Buttery smooth:** 60fps animations, no layout jank, instant-feel interactions even on a mid-range phone. Latency hidden with optimistic UI + reconnection.
- **Works everywhere:** Latest Chrome/Safari/Firefox/Edge on desktop and mobile. No installs.
- **Disposable & private:** Rooms are ephemeral. No data needed to play. A room ID is the only thing you share.

---

## 3. Name suggestions

Pick a direction; we can refine. (I'd flag the top 3.)

| Name | Vibe | Notes |
|---|---|---|
| **Salon** ⭐ | Chic French "living room" — where friends gather to play | Elegant, fits party-game-night feel, .games/.gg available-ish |
| **Frolic** ⭐ | Playful, light, English | Fun, ownable, easy to say |
| **Pebble** ⭐ | Soft, friendly, glassy | Pairs great with the frosted-glass aesthetic |
| **Knack** | Quick, smart, snappy | Short, brandable |
| **Huddle** | Friends grouping up | Slightly corporate (Slack-y) |
| **Confetti / Konfetti** | Celebration, color | Fun but maybe loud |
| **Plàzy** | Play + lazy/cozy evening | Coined, distinctive |
| **Roomies** | Casual, room-based | Maybe too cute |

**Working title used in code until you choose:** `Salon`. Branding is centralized (one config + token file) so renaming is a 5-minute change.

---

## 4. Design language — "ultra high-end, Apple-like, glassy"

The design system is built **once** and every game inherits it. This is what creates the cohesive "wow."

### Visual direction
- **Glassmorphism done right:** layered frosted panels (`backdrop-filter: blur()` + saturation), subtle 1px inner/outer borders, soft large-radius corners (20–28px), realistic drop shadows with color bleed.
- **Depth & light:** a slow-moving animated mesh-gradient / aurora background behind frosted foreground. Light source consistency across cards.
- **Restraint:** lots of negative space, few colors, strong hierarchy. Apple's confidence comes from *not* cluttering.
- **Motion as polish:** spring-based transitions (not linear), micro-interactions on every tap/hover, shared-element transitions between screens, tasteful confetti/particle moments on wins.
- **Dark-first**, with an equally premium light mode. System-preference aware.

### Typography
- **Display/headings:** a characterful but clean face — candidates: *Clash Display*, *General Sans*, *Satoshi* (all have free weights). Big, tight tracking.
- **UI/body:** *Inter* or *Geist* — neutral, legible at small sizes on mobile.
- Fluid type scale (clamp-based) so it breathes on desktop and stays readable on phones.

### Design tokens (single source of truth)
A `tokens` file defines: color palette (incl. per-game accent), blur levels, shadow ladder, radii, spacing scale, motion durations/easings, z-index ladder. Everything references tokens — no magic numbers.

### Reusable UI kit (built in Phase 1, used by all games)
`GlassCard`, `Button` (primary/ghost/danger), `Avatar`, `PlayerList`, `Modal/Sheet` (bottom-sheet on mobile), `Toast`, `Timer ring`, `Input`, `RoomCodePill` (tap-to-copy), `Confetti`, `LobbyShell`, `GameShell` (header + players + stage), `ConnectionBadge` (live/reconnecting).

### Performance guardrails for "fluid"
- Animate only `transform`/`opacity`; never animate layout properties.
- Respect `prefers-reduced-motion`.
- Lazy-load each game's code (route-level code splitting) so the landing page is tiny and instant.
- Cap blur layers; test on a real mid-range Android.

---

## 5. Tech stack

Chosen for: smooth UI, one language end-to-end, great DX, free-tier/VPS friendly.

### Frontend
- **React + TypeScript + Vite** — fast, huge ecosystem, easy code-splitting per game.
- **Tailwind CSS** + a small custom layer for the glass tokens — rapid, consistent styling.
- **Framer Motion** — spring animations, shared-element transitions, the "wow" motion.
- **Zustand** — tiny, simple client state (room state, my player, UI state).
- **PWA** (installable, offline shell) — feels like a native app, optional.

### Backend (authoritative game server)
- **Node + TypeScript**, **Fastify** (HTTP) + **`ws`** (raw WebSockets) — lean and fast.
  - Alt considered: Socket.IO (nicer reconnection/rooms out of the box, slightly heavier). We'll likely **start with Socket.IO** for its built-in reconnection + room semantics, which buys us reliability cheaply, then optimize if needed.
- **In-memory room store** (a `Map` of rooms) — authoritative game state lives here. No DB needed for MVP.
- **Shared types package** — game state & message contracts defined once, imported by client and server (monorepo). This is the single biggest reliability win: client and server can't disagree on the protocol.

### Why this beats serverless for us
You have a VPS → an always-on Node process holding rooms in memory is the simplest correct design: no cold starts, no per-message billing, trivial to reason about, lowest latency. (Serverless realtime would force us into an external state store and add cost/complexity for zero benefit at our scale.)

### Repo shape (monorepo, pnpm workspaces)
```
salon/
├─ packages/
│  ├─ shared/        # TS types: messages, game state, validation (zod)
│  └─ ui/            # design tokens + reusable glass components
├─ apps/
│  ├─ web/           # React client (Vite)
│  └─ server/        # Node game server (Fastify + ws/Socket.IO)
├─ plan.md
└─ README.md
```

---

## 6. Multiplayer architecture

### Model: server-authoritative
The server is the **single source of truth** for every room's game state. Clients send *intents* ("submit word", "pass turn"); the server validates, mutates state, and **broadcasts the new state** (or a delta) to everyone in the room. Clients render what the server says. This prevents cheating and desync — critical for "super fluid" with no glitches.

### Rooms
- `createRoom()` → generates a **short, human-friendly ID** (e.g. `BRAVO-7` or 4 uppercase letters, avoiding ambiguous chars/profanity). That's the share link: `salon.app/r/BRAVO7`.
- Room holds: players, host, chosen game, settings, phase (`lobby` → `playing` → `results`), and game-specific state.
- Max players is **per-game** (Bomb Party ~16, Petit Bac ~12 — tunable).

### Player lifecycle & resilience (the "never breaks" part)
- Each player gets a **session token** (stored in `localStorage`) so a refresh or dropped connection **rejoins the same seat** with state intact.
- **Reconnection:** on disconnect, the seat is held for a grace period (e.g. 30s) showing "reconnecting…"; on timeout the player is marked away/removed depending on phase.
- **Host migration:** if the host leaves, host transfers to the next player automatically.
- **Heartbeats** (ping/pong) detect dead connections fast.
- **Optimistic UI** for the actor's own input (instant feedback), reconciled when the server confirms.

### Message protocol (typed, in `shared`)
- Client→Server: `JOIN`, `LEAVE`, `CHOOSE_GAME`, `UPDATE_SETTINGS`, `START`, `GAME_ACTION` (game-specific payload), `CHAT`.
- Server→Client: `ROOM_STATE` (full snapshot), `STATE_PATCH` (delta), `ERROR`, `TOAST`, `PLAYER_JOINED/LEFT`, `GAME_EVENT` (e.g. "bomb exploded" for animation/sound cues).
- All payloads validated with **zod** on the server — malformed/abusive messages are rejected.

### Game engine abstraction (so adding games is cheap)
Every game implements a small interface:
```ts
interface GameEngine<State, Action> {
  maxPlayers: number; minPlayers: number;
  init(players, settings): State;
  reducer(state, action, playerId): { state, events };  // pure, authoritative
  isOver(state): boolean;
  summary(state): Results;
}
```
The server is game-agnostic: it routes `GAME_ACTION`s into the active engine's reducer and broadcasts results. Adding "6 qui prend" later = write one engine + one React view. **This abstraction is the core of the whole platform.**

---

## 7. The two MVP games

### A. Bomb Party (live-turn pattern)
- **Loop:** players in a circle; a "bomb" passes around. Active player must type a word containing the given **syllable** (e.g. "TIO") before the timer explodes. Valid word → bomb passes to next player with a new syllable. Timer explodes → that player loses a life. Last player standing wins.
- **Server owns:** turn order, current syllable, timer, dictionary validation, lives, used-words set.
- **Dictionary:** bundled word lists (start with **French + English**, switchable per room). Fast lookup via a `Set`. Syllables chosen so enough valid words exist.
- **Feel:** ticking bomb SFX, screen-shake intensifies as timer runs down, explosion + confetti for survivors. Big satisfying input on mobile.
- **Tests:** rapid turn handoff, sub-second latency, timer authority on server (clients only animate).

### B. Petit Bac (simultaneous-round pattern)
- **Loop:** a random **letter** + a set of **categories** (Country, Animal, Food, Celebrity, …). Everyone fills answers **simultaneously** before the timer ends. Then a **scoring/voting phase**: answers revealed, players validate each other's (or auto-rules), points awarded (unique valid = more points). Multiple rounds, cumulative score, winner.
- **Server owns:** the letter, categories, timer, collected answers, voting tally, scores.
- **Phases:** `writing` → `reveal/vote` → `scoreboard` → next round.
- **Feel:** clean multi-field form on mobile, live "X players finished" indicators, satisfying reveal animation, scoreboard with motion.
- **Tests:** simultaneous input from all players, a multi-phase round state machine, peer voting UI.

Together these two cover **both** fundamental realtime patterns, so the engine is proven before we scale to more games.

---

## 8. Roadmap (phased, shippable increments)

> Each phase ends with something you can actually open in a browser and try.

### Phase 0 — Foundations (scaffold)
- Monorepo, TypeScript, Vite client, Node server, shared package, lint/format.
- "Hello round-trip": client connects via WebSocket, server echoes. Confirms the pipe works end-to-end.

### Phase 1 — Design system + lobby (the "wow" shell)
- Design tokens, glass UI kit, animated aurora background, fonts.
- **Landing page** with the wow effect + "Create room" / "Join with code".
- **Lobby:** create room → get shareable ID, join via ID, guest nickname + avatar picker, live player list, host controls, game picker, chat. Reconnection + session tokens working.
- *Deliverable: you can make a room, share the code, and friends appear in the lobby in real time — no game yet.*

### Phase 2 — Game engine + Bomb Party
- Implement `GameEngine` abstraction and server routing.
- Build Bomb Party engine + React view + dictionary + SFX/animation.
- *Deliverable: first fully playable game online with friends.*

### Phase 3 — Petit Bac
- Multi-phase round state machine, simultaneous input, voting/scoring, scoreboard.
- *Deliverable: second game; engine proven for both patterns.*

### Phase 4 — Polish & deploy to your VPS
- End-to-end reconnection/host-migration hardening, error/empty/disconnect states, sound toggle, reduced-motion, PWA, mobile QA on real devices.
- Deploy to VPS with HTTPS + a domain (§9). Friends play for real.

### Phase 5 — More games (post-MVP, one at a time)
- Codenames (teams + roles), 6 qui prend / Skyjo (hidden hands + card animations), Gartic-style draw-and-guess (canvas streaming), Codenames, Just-One, etc. Each = one engine + one view.

### Phase 6 — Optional accounts & extras
- Optional login, persistent stats/history, friends, room reconnect links, spectator mode, emotes/reactions, localization toggle in UI.

---

## 9. VPS deployment guidance (for you, when we reach Phase 4)

I'll walk you through each step live, but here's the shape so you know what's coming:

1. **Domain + DNS:** point a domain (or subdomain) at your VPS IP.
2. **Server runtime:** install Node (via `nvm`), run the game server under **PM2** (auto-restart, survives reboots) or a `systemd` service.
3. **Reverse proxy + HTTPS:** **Caddy** (recommended — automatic Let's Encrypt TLS, dead simple config) or Nginx. It serves the static React build and proxies `/ws` to the Node server, including the WebSocket upgrade headers.
4. **Static client:** build the React app to static files, served by Caddy/CDN.
5. **Firewall:** open 80/443 only; keep the Node port internal.
6. **Deploys:** a small `git pull && build && pm2 reload` script (later: a GitHub Actions deploy).
7. **Basics:** log rotation, a health-check endpoint, optional uptime monitor.

No database needed for MVP (rooms are in memory). If/when accounts arrive, add **SQLite** (zero-config, file-based, perfect for a VPS) or Postgres.

---

## 10. Cross-cutting concerns

- **Reliability:** server-authoritative state + typed/validated messages + reconnection are designed in from day one, not bolted on. This is what makes it "never glitch."
- **Performance budget:** landing JS kept tiny via per-game code splitting; animations GPU-only; tested on mid-range mobile.
- **Accessibility:** keyboard navigable, focus states, `prefers-reduced-motion`, sufficient contrast even on glass (we'll add scrims behind text).
- **Anti-grief (light):** room IDs unguessable enough; host can kick; basic rate-limiting on messages; profanity-filtered room codes.
- **Privacy:** no PII required; ephemeral rooms; clear that nothing is stored (until optional accounts).
- **i18n-ready:** strings centralized; FR/EN from the start given the game choices.

---

## 11. Open questions / things to decide as we go

1. **Final name** (§3) — pick when ready; code uses `Salon` placeholder.
2. **Primary language of the UI** — FR, EN, or bilingual toggle? (Games support both dictionaries regardless.)
3. **Socket.IO vs raw `ws`** — I recommend starting with Socket.IO for reliability; revisit if we ever need to shave bytes.
4. **Sound on by default?** — party games are better with sound, but autoplay policies mean we enable after first interaction.
5. **Max players per game** — sensible defaults proposed; you can tune once we playtest.

---

## 12. Immediate next step

On your go, I'll start **Phase 0 + Phase 1**: scaffold the monorepo and build the design system + landing + lobby so you can create a room and watch friends join in real time. That's the fastest path to a tangible "wow" you can show people — before any game logic exists.
