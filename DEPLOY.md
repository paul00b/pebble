# Deploying Pebble on CasaOS + Cloudflare

Pebble ships as **one Docker container**: the Node server serves both the API/WebSocket
*and* the built web client on the same port (`3001`). That single origin is exactly what a
Cloudflare tunnel wants — one hostname, no CORS, WebSockets included.

## 1. Build & run on the CasaOS host (CLI — recommended)

SSH into your CasaOS box, then:

```bash
git clone <your-repo-url> pebble      # or copy the project folder over
cd pebble
docker compose up -d --build          # builds the image and starts it
```

Check it's healthy:

```bash
docker compose ps                     # STATUS should show "healthy"
curl http://localhost:3001/health     # → {"ok":true,"rooms":0}
```

Open `http://<casaos-lan-ip>:3001` from a device on your LAN to confirm the UI loads and
you can create a room.

> **Updating later:** `git pull && docker compose up -d --build`.

### Alternative: manage it from the CasaOS UI
The CasaOS app store imports *images*, not build contexts. If you want it to appear there,
build the image first (`docker compose build`), then in CasaOS use **Custom Install**, set
the image to `pebble:latest`, container port `3001`, and a restart policy of
`unless-stopped`. The CLI route above is simpler and the container is still visible in the
CasaOS Docker view either way.

## 2. Expose it through your Cloudflare tunnel

You already run Cloudflare on the box, so add a **public hostname** to your existing tunnel —
no router port-forwarding needed (the tunnel dials out).

**Cloudflare Zero Trust dashboard → Networks → Tunnels → your tunnel → Public Hostname →
Add a public hostname:**

| Field | Value |
|---|---|
| Subdomain / Domain | e.g. `pebble` · `yourdomain.com` |
| Type | `HTTP` |
| URL | `http://<casaos-lan-ip>:3001` |

- Use the CasaOS host's LAN IP (e.g. `http://192.168.1.50:3001`) since the container
  publishes `3001` on the host. If your `cloudflared` runs as a container **on the same
  Docker network** as Pebble, you can instead use `http://pebble:3001`.
- **WebSockets** are on by default for proxied hostnames and tunnels — no extra setting.
  (If you use a local `config.yml` tunnel instead of the dashboard, the equivalent is:
  `service: http://<casaos-lan-ip>:3001` under that hostname's `ingress` rule.)

That's it — visit `https://pebble.yourdomain.com`. The client auto-connects its socket to the
same origin over `wss://`, so nothing else needs configuring.

### Optional hardening
Once the public URL works, you can lock the Socket.IO handshake to it: in
`docker-compose.yml` set `CLIENT_ORIGIN=https://pebble.yourdomain.com`, then
`docker compose up -d`.

## Notes

- **Don't** forward port 3001 on your router. Keep it LAN-only; Cloudflare reaches it
  through the tunnel.
- **Memory:** Bomb Party loads large word lists on first play (~600k words, a few hundred MB
  RAM). Give the container a little headroom (≈512 MB–1 GB).
- **State is in-memory and ephemeral** by design — rooms vanish on restart. No database or
  volume needed.
- **Env vars** (all optional): `PORT` (default `3001`), `CLIENT_ORIGIN` (default `*`),
  `PUBLIC_DIR` (default `/app/client/dist` in the image).
