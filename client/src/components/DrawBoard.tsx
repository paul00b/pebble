import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/primitives";
import { socket } from "@/lib/socket";
import { useT } from "@/lib/useT";
import type { DrawOp } from "@shared";

/* Canvas background — also what the eraser paints with. */
const BG = "#f7faf9";

/* Palette + brush sizes (CSS px at the canvas's displayed width). */
const COLORS = [
  "#0b0f12", "#ffffff", "#fb7185", "#fb923c", "#facc15",
  "#4ade80", "#38bdf8", "#a78bfa", "#f472b6", "#a16207",
];
const BRUSHES = [2, 5, 12, 28];

type Tool = "pencil" | "line" | "rect" | "ellipse" | "fill" | "eraser";
const TOOLS: Tool[] = ["pencil", "line", "rect", "ellipse", "fill", "eraser"];

const svg = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function ToolIcon({ id }: { id: Tool }): ReactNode {
  const p = { viewBox: "0 0 24 24", className: "h-4 w-4", ...svg } as const;
  switch (id) {
    case "pencil":
      return <svg {...p}><path d="M4 20l3.6-.9L19 7.7a2 2 0 0 0-2.8-2.8L4.9 16.4 4 20z" /></svg>;
    case "line":
      return <svg {...p}><line x1="5" y1="19" x2="19" y2="5" /></svg>;
    case "rect":
      return <svg {...p}><rect x="4" y="6" width="16" height="12" rx="1.5" /></svg>;
    case "ellipse":
      return <svg {...p}><circle cx="12" cy="12" r="8" /></svg>;
    case "fill":
      return <svg {...p}><path d="M12 3s6 6.6 6 10.5a6 6 0 0 1-12 0C6 9.6 12 3 12 3z" /></svg>;
    case "eraser":
      return (
        <svg {...p}>
          <rect x="3.5" y="10.5" width="13" height="8" rx="1.6" transform="rotate(-22 10 14.5)" />
          <path d="M10 21h10" />
        </svg>
      );
  }
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Flood-fill the contiguous region at (px,py) — normalized — with `hex`. */
function floodFill(ctx: CanvasRenderingContext2D, W: number, H: number, px: number, py: number, hex: string) {
  const x = Math.round(px * W);
  const y = Math.round(py * H);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const start = (y * W + x) * 4;
  const tr = d[start], tg = d[start + 1], tb = d[start + 2], ta = d[start + 3];
  const [fr, fg, fb] = hexToRgb(hex);
  // Nothing to do if the spot already holds the target colour.
  if (Math.abs(tr - fr) < 4 && Math.abs(tg - fg) < 4 && Math.abs(tb - fb) < 4 && ta === 255) return;

  const TOL = 48 * 48; // squared tolerance, soaks up anti-aliased edges
  const matches = (i: number) => {
    const dr = d[i] - tr, dg = d[i + 1] - tg, db = d[i + 2] - tb, da = d[i + 3] - ta;
    return dr * dr + dg * dg + db * db + da * da <= TOL;
  };

  const stack = [y * W + x];
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    if (!matches(i)) continue;
    d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
    const cx = p % W, cy = (p / W) | 0;
    if (cx > 0) stack.push(p - 1);
    if (cx < W - 1) stack.push(p + 1);
    if (cy > 0) stack.push(p - W);
    if (cy < H - 1) stack.push(p + W);
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Reusable real-time drawing surface. Ops are emitted as normalized (0–1)
 * drawing ops on a `<channel>:*` Socket.IO side-channel; every viewer replays
 * them. Tools: freehand pencil, straight line, rectangle, ellipse, flood fill
 * and an eraser (paints the background). Used by Gartic (`channel="draw"`).
 */
export function DrawBoard({
  canDraw,
  channel = "draw",
  wrapClassName = "w-full max-w-2xl self-center",
}: {
  canDraw: boolean;
  channel?: "draw" | "board";
  wrapClassName?: string;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opsRef = useRef<DrawOp[]>([]);
  const drawing = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null); // shape anchor
  const last = useRef<{ x: number; y: number } | null>(null); // previous / current point
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState(COLORS[0]);
  const [brush, setBrush] = useState(BRUSHES[1]);
  // Keep the latest tool settings reachable from pointer handlers.
  const settings = useRef({ tool, color, brush });
  settings.current = { tool, color, brush };

  // Event names for this channel. Both channels share signatures, so we cast to
  // the `draw:*` literals at the socket boundary.
  const evOp = `${channel}:op` as "draw:op";
  const evSync = `${channel}:sync` as "draw:sync";
  const evRequest = `${channel}:request` as "draw:request";

  const applyOp = (ctx: CanvasRenderingContext2D, op: DrawOp, W: number, H: number) => {
    if (op.t === "clear") return;
    if (op.t === "fill") {
      floodFill(ctx, W, H, op.x, op.y, op.c);
      return;
    }
    ctx.strokeStyle = op.c;
    ctx.lineWidth = Math.max(1, op.w * W);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (op.t === "line") {
      ctx.beginPath();
      ctx.moveTo(op.x0 * W, op.y0 * H);
      ctx.lineTo(op.x1 * W, op.y1 * H);
      ctx.stroke();
    } else if (op.t === "rect") {
      ctx.strokeRect(
        Math.min(op.x0, op.x1) * W,
        Math.min(op.y0, op.y1) * H,
        Math.abs(op.x1 - op.x0) * W,
        Math.abs(op.y1 - op.y0) * H
      );
    } else if (op.t === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        ((op.x0 + op.x1) / 2) * W,
        ((op.y0 + op.y1) / 2) * H,
        Math.max(1, (Math.abs(op.x1 - op.x0) / 2) * W),
        Math.max(1, (Math.abs(op.y1 - op.y0) / 2) * H),
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  };

  const paintBg = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
  };

  const redraw = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    paintBg(ctx, c.width, c.height);
    for (const op of opsRef.current) applyOp(ctx, op, c.width, c.height);
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
        applyOp(ctx, op, c.width, c.height);
      }
    };
    const onSync = (ops: DrawOp[]) => {
      opsRef.current = ops.slice();
      redraw();
    };

    socket.on(evOp, onOp);
    socket.on(evSync, onSync);
    // Pull whatever has already been drawn (late join / reconnect).
    socket.emit(evRequest);

    return () => {
      ro.disconnect();
      socket.off(evOp, onOp);
      socket.off(evSync, onSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  /** Stroke width as a fraction of canvas width (so it scales on resize). */
  const strokeW = () => settings.current.brush / canvasRef.current!.getBoundingClientRect().width;

  /** Build the op for the current shape tool between two normalized points. */
  const shapeOp = (a: { x: number; y: number }, b: { x: number; y: number }): DrawOp => {
    const base = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, c: settings.current.color, w: strokeW() };
    const tl = settings.current.tool;
    if (tl === "rect") return { t: "rect", ...base };
    if (tl === "ellipse") return { t: "ellipse", ...base };
    return { t: "line", ...base };
  };

  const commit = (op: DrawOp) => {
    opsRef.current.push(op);
    const c = canvasRef.current!;
    const ctx = c.getContext("2d");
    if (ctx) applyOp(ctx, op, c.width, c.height);
    socket.emit(evOp, op);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!canDraw) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pos(e);

    if (settings.current.tool === "fill") {
      commit({ t: "fill", x: p.x, y: p.y, c: settings.current.color });
      return;
    }
    drawing.current = true;
    start.current = p;
    last.current = p;
  };

  const onMove = (e: React.PointerEvent) => {
    if (!canDraw || !drawing.current || !last.current) return;
    const p = pos(e);
    const tl = settings.current.tool;

    if (tl === "pencil" || tl === "eraser") {
      const op: DrawOp = {
        t: "line",
        x0: last.current.x,
        y0: last.current.y,
        x1: p.x,
        y1: p.y,
        c: tl === "eraser" ? BG : settings.current.color,
        w: strokeW(),
      };
      last.current = p;
      commit(op);
    } else {
      // Shape tools: live preview without emitting until the pointer lifts.
      last.current = p;
      redraw();
      const c = canvasRef.current!;
      const ctx = c.getContext("2d");
      if (ctx && start.current) applyOp(ctx, shapeOp(start.current, p), c.width, c.height);
    }
  };

  const onUp = () => {
    const tl = settings.current.tool;
    if (drawing.current && start.current && last.current &&
        (tl === "line" || tl === "rect" || tl === "ellipse")) {
      commit(shapeOp(start.current, last.current));
    }
    drawing.current = false;
    start.current = null;
    last.current = null;
  };

  const clear = () => {
    opsRef.current = [];
    redraw();
    socket.emit(evOp, { t: "clear" });
  };

  return (
    <div className={`flex flex-col gap-2 ${wrapClassName}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        className="aspect-[4/3] w-full rounded-2xl border border-white/15 bg-[#f7faf9] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
        style={{ touchAction: "none", cursor: canDraw ? "crosshair" : "default" }}
      />
      {canDraw && (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl glass px-3 py-2">
          {/* tools */}
          <div className="flex flex-wrap gap-1">
            {TOOLS.map((id) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                title={t(`ga.tool.${id}`)}
                aria-label={t(`ga.tool.${id}`)}
                aria-pressed={tool === id}
                className={`grid h-7 w-7 place-items-center rounded-lg transition ${
                  tool === id ? "bg-accent text-ink-900" : "bg-white/5 text-cloud hover:bg-white/10"
                }`}
              >
                <ToolIcon id={id} />
              </button>
            ))}
          </div>
          <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          {/* colours */}
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
          <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          {/* brush sizes */}
          <div className="flex items-center gap-1.5">
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
