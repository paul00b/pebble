import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Confetti } from "@/components/Confetti";
import { socket } from "@/lib/socket";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { remaining, useClock } from "@/lib/useClock";
import type { DrawOp, GarticView, Player, RoomState } from "@shared";

/* Drawer palette + brush sizes (CSS px at the canvas's displayed width). */
const COLORS = [
  "#0b0f12", "#ffffff", "#fb7185", "#fb923c", "#facc15",
  "#4ade80", "#38bdf8", "#a78bfa", "#f472b6", "#a16207",
];
const BRUSHES = [2, 5, 12, 28];

/**
 * Real-time drawing surface. The drawer's pointer strokes are emitted as
 * normalized (0–1) line ops on the `draw:*` side-channel; viewers replay them.
 * Keyed on the round by the parent, so a new round remounts → blank canvas.
 */
function DrawCanvas({ drawer }: { drawer: boolean }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opsRef = useRef<DrawOp[]>([]);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [brush, setBrush] = useState(BRUSHES[1]);
  // Keep the latest tool settings reachable from pointer handlers.
  const tool = useRef({ color, brush });
  tool.current = { color, brush };

  const strokeOne = (ctx: CanvasRenderingContext2D, op: DrawOp, W: number, H: number) => {
    if (op.t === "clear") return;
    ctx.strokeStyle = op.c;
    ctx.lineWidth = Math.max(1, op.w * W);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(op.x0 * W, op.y0 * H);
    ctx.lineTo(op.x1 * W, op.y1 * H);
    ctx.stroke();
  };

  const paintBg = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    ctx.fillStyle = "#f7faf9";
    ctx.fillRect(0, 0, W, H);
  };

  const redraw = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    paintBg(ctx, c.width, c.height);
    for (const op of opsRef.current) strokeOne(ctx, op, c.width, c.height);
  };

  // Fit the backing store to the displayed size (× dpr) and repaint.
  const fit = () => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    redraw();
  };

  useEffect(() => {
    fit();
    const ro = new ResizeObserver(fit);
    if (canvasRef.current) ro.observe(canvasRef.current);

    const onOp = (op: DrawOp) => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      if (op.t === "clear") {
        opsRef.current = [];
        paintBg(ctx, c.width, c.height);
      } else {
        opsRef.current.push(op);
        strokeOne(ctx, op, c.width, c.height);
      }
    };
    const onSync = (ops: DrawOp[]) => {
      opsRef.current = ops.slice();
      redraw();
    };

    socket.on("draw:op", onOp);
    socket.on("draw:sync", onSync);
    // Pull whatever has already been drawn this round (late join / reconnect).
    socket.emit("draw:request");

    return () => {
      ro.disconnect();
      socket.off("draw:op", onOp);
      socket.off("draw:sync", onSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!drawer) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawer || !drawing.current || !last.current) return;
    const p = pos(e);
    const c = canvasRef.current!;
    const op: DrawOp = {
      t: "line",
      x0: last.current.x,
      y0: last.current.y,
      x1: p.x,
      y1: p.y,
      c: tool.current.color,
      w: tool.current.brush / c.getBoundingClientRect().width,
    };
    last.current = p;
    opsRef.current.push(op);
    const ctx = c.getContext("2d");
    if (ctx) strokeOne(ctx, op, c.width, c.height);
    socket.emit("draw:op", op);
  };
  const onUp = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const op: DrawOp = { t: "clear" };
    opsRef.current = [];
    redraw();
    socket.emit("draw:op", op);
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2 self-center">
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="aspect-[4/3] w-full rounded-2xl border border-white/15 bg-[#f7faf9] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
        style={{ touchAction: "none", cursor: drawer ? "crosshair" : "default" }}
      />
      {drawer && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl glass px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                className={`h-6 w-6 rounded-full transition-transform ${
                  color === c ? "scale-110 ring-2 ring-accent" : "ring-1 ring-white/20"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mx-1 flex items-center gap-1.5">
            {BRUSHES.map((b) => (
              <button
                key={b}
                onClick={() => setBrush(b)}
                className={`grid h-7 w-7 place-items-center rounded-full transition ${
                  brush === b ? "bg-white/15 ring-2 ring-accent" : "bg-white/5"
                }`}
              >
                <span
                  className="rounded-full bg-cloud"
                  style={{ width: Math.min(18, b), height: Math.min(18, b) }}
                />
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={clear} className="ml-auto px-3 py-1.5 text-xs">
            {t("ga.clear")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function Gartic({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as GarticView;
  const youId = useStore((s) => s.youId);
  const gameAction = useStore((s) => s.gameAction);

  const players = useMemo(
    () => Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>,
    [room.players]
  );

  const clock = useClock();
  const { seconds, fraction } = remaining(clock, game.deadline - 80_000, game.deadline);

  const [guess, setGuess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Reset the guess field as rounds turn over.
  useEffect(() => setGuess(""), [game.round]);
  // Keep the guess feed pinned to the latest message.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [game.messages.length]);

  if (game.phase === "done")
    return <GarticResults game={game} players={players} youId={youId} t={t} />;

  const drawerName = players[game.drawerId]?.name ?? "…";
  const canGuess = game.phase === "drawing" && !game.youAreDrawer && !game.youGuessed;

  const submit = () => {
    const text = guess.trim();
    if (!text) return;
    gameAction({ type: "guess", text });
    setGuess("");
  };

  const isHost = room.hostId === youId;
  const lastRound = game.round >= game.totalRounds;

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6 lg:flex-row">
      {/* Stage: word, timer, canvas */}
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-faint">
            {t("ga.round", { round: game.round, total: game.totalRounds })}
          </span>
          <div className="text-center">
            <div className="font-display text-2xl font-bold tracking-[0.3em] text-cloud">
              {game.word}
            </div>
            <div className="text-[0.65rem] text-faint">
              {game.youAreDrawer ? t("ga.youDraw") : t("ga.drawing", { name: drawerName })}
            </div>
          </div>
          <span
            className="font-display text-lg tabular-nums"
            style={{ color: fraction > 0.5 ? "#6ee7d6" : fraction > 0.22 ? "#fbbf72" : "#fb7185" }}
          >
            {Math.max(0, seconds).toFixed(0)}s
          </span>
        </div>

        {/* timer bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${fraction * 100}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
            style={{
              background: fraction > 0.5 ? "#6ee7d6" : fraction > 0.22 ? "#fbbf72" : "#fb7185",
            }}
          />
        </div>

        <DrawCanvas key={game.round} drawer={game.youAreDrawer} />

        {/* reveal banner / host controls */}
        <AnimatePresence>
          {game.phase === "reveal" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 rounded-2xl glass-strong p-3 text-center"
            >
              <div className="text-sm text-mist">
                {t("ga.theWordWas")}{" "}
                <span className="font-display text-lg font-semibold text-accent">{game.word}</span>
              </div>
              {isHost ? (
                <Button onClick={() => gameAction({ type: "next" })} className="px-5 py-2 text-sm">
                  {lastRound ? t("ga.seeResults") : t("ga.next")}
                </Button>
              ) : (
                <div className="text-xs text-faint">{t("common.waitingHost")}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar: scores + guess feed + input */}
      <div className="flex w-full flex-col gap-3 lg:w-72">
        <GlassCard className="p-3">
          <ul className="flex flex-col gap-1.5">
            {[...game.players]
              .sort((a, b) => b.score - a.score)
              .map((p) => {
                const info = players[p.id];
                const isDrawer = p.id === game.drawerId;
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    {info && <Avatar emoji={info.avatar} color={info.color} size={24} />}
                    <span
                      className={`flex-1 truncate text-sm ${
                        p.id === youId ? "text-accent" : "text-cloud"
                      }`}
                    >
                      {info?.name ?? "—"}
                    </span>
                    {isDrawer && <span title="drawing">✏️</span>}
                    {p.guessed && !isDrawer && <span>✅</span>}
                    <span className="w-8 text-right font-display tabular-nums text-cloud">
                      {p.score}
                    </span>
                  </li>
                );
              })}
          </ul>
        </GlassCard>

        <GlassCard className="flex min-h-0 flex-1 flex-col p-2">
          <div ref={feedRef} className="flex max-h-48 flex-1 flex-col gap-1 overflow-y-auto px-1 py-1 lg:max-h-none">
            {game.messages.map((m) => {
              const name = players[m.playerId]?.name ?? "?";
              return m.correct ? (
                <div key={m.id} className="text-sm text-emerald-300">
                  <span className="font-medium">{name}</span> {t("ga.guessedIt")}
                </div>
              ) : (
                <div key={m.id} className="text-sm text-mist">
                  <span className="font-medium text-cloud">{name}:</span> {m.text}
                </div>
              );
            })}
          </div>
          {game.phase === "drawing" && (
            <div className="mt-1">
              {game.youAreDrawer ? (
                <div className="px-1 py-2 text-center text-xs text-faint">{t("ga.youDraw")}</div>
              ) : game.youGuessed ? (
                <div className="px-1 py-2 text-center text-sm text-emerald-300">
                  {t("ga.youGuessed")}
                </div>
              ) : (
                <input
                  ref={inputRef}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  disabled={!canGuess}
                  placeholder={t("ga.guessPh")}
                  autoComplete="off"
                  className="w-full rounded-xl border border-accent/40 bg-white/10 px-3 py-2 text-sm text-cloud outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function GarticResults({
  game,
  players,
  youId,
  t,
}: {
  game: GarticView;
  players: Record<string, Player>;
  youId: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const isHost = room?.hostId === youId;
  const rows = [...game.players].sort((a, b) => b.score - a.score);

  return (
    <div className="grid flex-1 place-items-center">
      {game.winnerId === youId && <Confetti />}
      <GlassCard
        strong
        className="w-full max-w-sm p-7 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-5xl">🏆</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">
          {t("ga.finalScores")}
        </div>
        <ul className="mt-4 flex flex-col gap-1.5 text-left">
          {rows.map((r, i) => {
            const p = players[r.id];
            return (
              <li
                key={r.id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  i === 0 ? "bg-accent/15" : "bg-white/5"
                }`}
              >
                <span className="w-5 text-center text-sm text-faint">{i + 1}</span>
                {p && <Avatar emoji={p.avatar} color={p.color} size={28} />}
                <span
                  className={`flex-1 truncate text-sm ${
                    r.id === youId ? "text-accent" : "text-cloud"
                  }`}
                >
                  {p?.name ?? "—"}
                </span>
                <span className="font-display text-lg tabular-nums text-cloud">{r.score}</span>
              </li>
            );
          })}
        </ul>
        {isHost ? (
          <Button full className="mt-6" onClick={toLobby}>
            {t("common.backToLobby")}
          </Button>
        ) : (
          <div className="mt-6 text-sm text-mist">{t("common.waitingHost")}</div>
        )}
      </GlassCard>
    </div>
  );
}
