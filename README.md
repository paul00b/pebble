# 🪨 Pebble

A free, beautiful website to play party minigames online with friends. Spin up a
room, share the 4-letter code, and drop straight into a game together - no app,
no signup.

> Current build: design system, landing page, a fully live multiplayer lobby,
> full **🇬🇧/🇫🇷 bilingual UI**, and three playable games: **Bomb Party**,
> **Petit Bac**, and **6 Qui Prend**. See [`plan.md`](./plan.md).

## Stack

- **Client** - React + TypeScript + Vite, Tailwind v4, Framer Motion, Zustand
- **Server** - Node + Socket.IO, authoritative in-memory rooms
- **Shared** - one TypeScript package of types + the socket protocol, imported by
  both sides so the wire format can never drift

```
pebble/
├─ shared/    # types + socket event contracts (source of truth)
├─ server/    # authoritative Socket.IO game server
└─ client/    # React web app (design system + lobby)
```

## Run it locally

Requires Node 20+.

```bash
npm install      # installs client + server workspaces
npm run dev      # starts BOTH the server (:3001) and client (:5173)
```

Then open **http://localhost:5173**.

To try multiplayer on one machine: open the app, click **Create a room**, copy the
invite, and paste it into a second browser window (or an incognito window, or
your phone on the same network).

### Run them separately

```bash
npm run dev:server   # Socket.IO server on :3001
npm run dev:client   # Vite dev server on :5173
```

## Configuration

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `PORT` | server | `3001` | Server listen port |
| `CLIENT_ORIGIN` | server | `*` | CORS origin (set to your domain in prod) |
| `VITE_SERVER_URL` | client | `http://localhost:3001` (dev) | Socket server URL |

## What works today

- Animated frosted-glass UI (aurora background, Clash Display / General Sans)
- Create a room → shareable 4-letter code + invite link
- Join via code or a shared `/r/CODE` link
- Live player list, presence, and in-room chat
- Host controls: pick the game, start, kick
- Automatic reconnection (refresh keeps your seat) + host migration
- **Bomb Party** - type a real word containing the syllable before the fuse
  blows; persistent bomb, lives, live typing shown to spectators, FR/EN
  dictionaries (~275k EN / ~323k FR words, accent-insensitive)
- **Petit Bac** - a letter + categories, race to fill them in, "Stop!" to end
  the round, automatic scoring (unique = 2, shared = 1), multi-round scoreboard
- **6 Qui Prend** (6 nimmt!) - secretly pick a card each turn; lay them in four
  rows; take the 6th and you scoop the bulls. Language-free; private hands
- **Bilingual UI** (English / French) with an in-app toggle, plus a per-room
  *game-content* language for Bomb Party's dictionary and Petit Bac's categories

## Tests

The server must be running (`npm run dev`) for the socket tests.

```bash
npm run typecheck     # type-check client + server
npm run test:engine   # deterministic engine logic (no server needed)
npm run test:lobby    # live: create/join/chat/start
npm run test:games    # live: full Bomb Party + Petit Bac rounds
```

## Next

More games build on the `GameEngine` abstraction (`plan.md §6`) - each is one
server engine + one client view. Deployment to your VPS is `plan.md §9`.
