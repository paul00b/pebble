# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Pebble — a no-signup web app to play party minigames with friends over a shared room code. Server-authoritative Node + Socket.IO backend holding ephemeral in-memory rooms; React + Vite client. See `plan.md` for the product plan and `plan.md §13` for the living build-status log.

## Commands

```bash
npm install          # installs both workspaces (client + server)
npm run dev          # runs server (:3001) AND client (:5173) together via concurrently
npm run dev:server   # server only (tsx watch)
npm run dev:client   # client only (vite)
npm run build        # production build of the client (Vite); server runs from source via tsx
npm run start        # run the server from source (tsx, no build step)
npm run typecheck    # tsc --noEmit on BOTH server and client tsconfigs
```

Tests:
```bash
npm run test:engine  # deterministic engine logic, NO server needed (tsx scripts)
npm run test:lobby   # live socket e2e: create/join/chat/start — server must be running
npm run test:games   # live socket e2e: full Bomb Party + Petit Bac + 6 Qui Prend rounds
```

- **Run a single engine test suite directly:** `npx tsx scripts/skyjo-test.ts` (each game has its own `scripts/<game>-test.ts`).
- `test:engine` is the fast inner loop — pure reducer logic, no network. `test:lobby`/`test:games` need `npm run dev` running first.
- There is **no lint step** and **no compiled build for the server** — it runs straight from TypeScript source via `tsx` in dev and prod.

## Architecture

The whole platform is built around one idea: **the server is the single source of truth, and each game is a pluggable engine.**

### Three workspaces, one shared protocol
- `shared/src/` — the **single source of truth for the wire format**. Domain types (`types.ts`), per-game view/action types (`games.ts`), and the typed Socket.IO event contracts (`protocol.ts`). Both sides import these so client and server can never disagree.
- `server/src/` — authoritative Socket.IO server. In-memory rooms, game engines, dictionaries.
- `client/src/` — React app: design system, lobby flow, and one view component per game.

**Import quirk that matters:** `shared` is *not* a built package. The **server** imports it by relative path with `.js` extensions (`../../shared/src/index.js`) — required because the server is ESM (`"type": "module"`) run through `tsx`. The **client** imports it via the `@shared` alias (configured in `vite.config.ts` and `client/tsconfig.json`). When adding shared types, keep both import styles working.

### Server-authoritative flow
1. Client emits an *intent* (`game:action`, `room:start`, etc.) — never mutates game state itself.
2. `server/src/index.ts` is a thin socket-event router; all logic lives in `RoomManager` (`server/src/rooms.ts`).
3. `RoomManager` validates, mutates the room's authoritative state, bumps `version`, and calls `touch()` → the `onChange` listener re-broadcasts the snapshot.
4. Clients render exactly the broadcast `RoomState`. The Zustand store (`client/src/lib/store.ts`) just stuffs every `room:state` into state; views are pure functions of it.

A single shared `setInterval` (200ms tick in `index.ts`) drives **all** active games' time-based state (bomb fuse, round deadlines) via `engine.tick()`. Clients only *animate* timers — the server owns the clock. Deadlines are sent as epoch-ms so clients can render rings/bars locally.

### The GameEngine abstraction (how to add a game)
Every game implements `GameEngine<State>` in `server/src/games/engine.ts`: `init`, `view`, `isOver`, `action`, `tick`, `onLeave`. The room is game-agnostic — it routes validated actions into the active engine and broadcasts `engine.view(state)`. Adding a game is mechanical:

1. **Shared** (`shared/src/`): add the id to `GameId` (`types.ts`), add a `GAMES` metadata entry (min/max players, emoji, taglines), and add the game's `View` + `Action` types to `games.ts` (union them into `GameView`/`GameAction`).
2. **Server**: write `server/src/games/<game>.ts` implementing `GameEngine`, then register it in `server/src/games/registry.ts` (`ENGINES` map, keyed by `GameId`).
3. **Client**: write `client/src/games/<Game>.tsx` and wire it into the `room.game?.kind === "..."` dispatch in `client/src/games/GamePlay.tsx`.
4. **i18n**: add string keys to `client/src/lib/i18n.ts` (EN + FR, see below).
5. **Test**: add `scripts/<game>-test.ts` and append it to the `test:engine` script in root `package.json`.

### Hidden-information games (per-player views)
Most games broadcast one snapshot to the whole room. Games with secret state (card hands in Skyjo/6 Qui Prend, the spymaster key in Codenames) implement the optional `playerView(state, playerId)`. When present, `RoomManager.hasPrivateViews()` is true and `index.ts` sends each socket its own tailored snapshot instead of a single room broadcast. Never put secret state in `view()`.

### Gartic's drawing side-channel
Drawing strokes are high-frequency and must **not** ride the heavy room snapshot. They travel on dedicated `draw:op` / `draw:sync` / `draw:request` Socket.IO events (defined in `protocol.ts`, relayed in `index.ts`, backed by the optional `drawOps()`/`applyDrawOp()` engine methods). This is the pattern for any future real-time stream that shouldn't bloat `room:state`.

### Player lifecycle
- Identity is a client-persisted `sessionId` (in `localStorage`, see `client/src/lib/session.ts`). Rejoining with the same `sessionId` reclaims the seat — this is how refresh/reconnect works.
- Disconnect holds the seat for a 30s grace window (`RECONNECT_GRACE_MS`) before removal; the client auto-rejoins `activeCode` on socket reconnect (`wireSocket` in `store.ts`).
- Host migration is automatic: if the host leaves, the earliest-joined remaining player becomes host.

## Conventions

- **Two languages, two axes.** The *UI* language (EN/FR) is a client-side `locale` toggle driving `client/src/lib/i18n.ts` (`translate`/`useT`). The *game-content* language (`Language = "fr" | "en"`) is a per-room setting controlling Bomb Party's dictionary and Petit Bac's categories — passed into `engine.init()`. Don't conflate them. Server-originated notices send i18n **keys** (`room:notice`), which the client localizes.
- Engines must be **pure-ish reducers**: mutate the passed state, return `true` if anything changed (so `RoomManager` knows whether to re-broadcast). No I/O, no sockets inside an engine.
- The Bomb Party dictionary (`server/src/games/dictionary.ts`) loads ~275k EN / ~323k FR words from `an-array-of-*-words` into accent-insensitive `Set`s.
- Styling is Tailwind v4 (via `@tailwindcss/vite`, configured in CSS, no `tailwind.config.js`) plus a custom glass design language. Animations are Framer Motion; keep them GPU-only (`transform`/`opacity`) and respect `prefers-reduced-motion` per the design goals in `plan.md §4`.

## Config

| Variable | Side | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `3001` | Listen port |
| `CLIENT_ORIGIN` | server | `*` | CORS origin (set to your domain in prod) |
| `VITE_SERVER_URL` | client | `http://localhost:3001` | Socket server URL |

Health check: `GET /health` returns `{ ok, rooms }`.

## Deployment

Production runs as a **single Docker container**: the server also serves the built client
(`client/dist`) from the same origin, so API + WebSocket + site share one hostname. The
client auto-targets `window.location.origin` in prod (no `VITE_SERVER_URL` needed). See
`Dockerfile`, `docker-compose.yml`, and `DEPLOY.md`.

Live instance: **https://pebble.paulbr.fr** — a CasaOS home server behind a *locally
configured* Cloudflare tunnel (`cloudflared` as a host systemd service, ingress in
`/etc/cloudflared/config.yml` routing `pebble.paulbr.fr → http://127.0.0.1:3001`).

**Updating the live server is manual** (no auto-deploy/CI). On the box, the `pebble-update`
shell alias runs:

```bash
cd ~/pebble && git pull && docker compose up -d --build
```

A rebuild restarts the container, and room state is **in-memory** — redeploying drops every
in-progress game. Deploy when nobody's mid-party.
