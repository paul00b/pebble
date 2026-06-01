# ── Build stage: install everything and build the client ────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install deps first (better layer caching). Workspaces need every package.json.
COPY package.json package-lock.json* ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm install

# Build the client (Vite → client/dist).
COPY . .
RUN npm run build

# ── Run stage: the server runs from TS source via tsx and serves client/dist ─
FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV PUBLIC_DIR=/app/client/dist

# Bring over installed deps + sources + the built client.
COPY --from=build /app /app

EXPOSE 3001

# Lightweight liveness probe (no curl in slim images — use Node).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
