import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import Matter from "matter-js";
import { SANDBOX_SHAPES, type SandboxOp, type SandboxShape } from "@shared";
import { socket } from "@/lib/socket";
import { playSound } from "@/lib/sound";
import { useT } from "@/lib/useT";

/* A transparent physics layer over the live page: the real cards (.sandbox-solid)
 * become rigid blocks you stack shapes on. Clicks pass through to the page except
 * when over a shape. In a room (`shared`), spawns and clears are broadcast so the
 * same shapes appear for everyone — each on their own card layout, so positions
 * drift a little, but the cards-as-blocks feel is preserved. */

type Shape = SandboxShape;
const SHAPES = SANDBOX_SHAPES;

/** Shared fill palette (colorIdx indexes into it, so colors match across peers). */
const PALETTE = [
  "#fb7185", "#fb923c", "#facc15", "#4ade80",
  "#38bdf8", "#a78bfa", "#f472b6", "#6ee7d6",
];

const MAX_BODIES = 180;

/* Uniform geometry so every field is reachable without narrowing. */
const GEO: Record<Shape, { r: number; w: number; h: number; sides: number }> = {
  circle: { r: 26, w: 52, h: 52, sides: 0 },
  square: { r: 26, w: 52, h: 52, sides: 4 },
  flat: { r: 52, w: 104, h: 22, sides: 4 },
  triangle: { r: 34, w: 0, h: 0, sides: 3 },
  pentagon: { r: 30, w: 0, h: 0, sides: 5 },
  hexagon: { r: 30, w: 0, h: 0, sides: 6 },
};

function ShapeIcon({ shape }: { shape: Shape }): ReactNode {
  const p = { viewBox: "0 0 32 32", className: "h-6 w-6", fill: "currentColor" } as const;
  switch (shape) {
    case "circle": return <svg {...p}><circle cx="16" cy="16" r="11" /></svg>;
    case "square": return <svg {...p}><rect x="6" y="6" width="20" height="20" rx="2.5" /></svg>;
    case "flat": return <svg {...p}><rect x="3" y="12" width="26" height="8" rx="3" /></svg>;
    case "triangle": return <svg {...p}><path d="M16 5l11 21H5z" /></svg>;
    case "pentagon": return <svg {...p}><path d="M16 4l12 8.7-4.6 14.1H8.6L4 12.7z" /></svg>;
    case "hexagon": return <svg {...p}><path d="M16 4l10.4 6v12L16 28 5.6 22V10z" /></svg>;
  }
}

export function Sandbox({ onBack, shared }: { onBack: () => void; shared: boolean }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const api = useRef<{ spawn: (s: Shape) => void; clear: () => void } | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const { Engine, Render, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Query } = Matter;
    const canvas = canvasRef.current!;
    const pr = window.devicePixelRatio || 1;
    const engine = Engine.create();
    engine.gravity.y = 1;
    let w = window.innerWidth;
    let h = window.innerHeight;

    const render = Render.create({
      canvas, engine,
      options: { width: w, height: h, background: "transparent", wireframes: false, pixelRatio: pr },
    });
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    // Boundary walls (viewport edges; a high ceiling so tosses come back).
    const wallOpts = { isStatic: true, render: { visible: false } } as const;
    let walls: Matter.Body[] = [];
    const buildWalls = () => {
      if (walls.length) Composite.remove(engine.world, walls);
      const T = 400;
      walls = [
        Bodies.rectangle(w / 2, h + T / 2, w + 2 * T, T, wallOpts),
        Bodies.rectangle(-T / 2, h / 2, T, h + 6 * T, wallOpts),
        Bodies.rectangle(w + T / 2, h / 2, T, h + 6 * T, wallOpts),
        Bodies.rectangle(w / 2, -T - 400, w + 2 * T, T, wallOpts),
      ];
      Composite.add(engine.world, walls);
    };
    buildWalls();

    // Real DOM cards → static rigid blocks (re-read on scroll/resize/layout).
    let solids: Matter.Body[] = [];
    const syncSolids = () => {
      if (solids.length) Composite.remove(engine.world, solids);
      solids = [];
      document.querySelectorAll<HTMLElement>(".sandbox-solid").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 12 || r.height < 12 || r.bottom < 0 || r.top > h) return;
        solids.push(
          Bodies.rectangle(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, {
            isStatic: true,
            chamfer: { radius: Math.min(16, r.width / 2, r.height / 2) },
            render: { visible: false },
          })
        );
      });
      if (solids.length) Composite.add(engine.world, solids);
    };
    syncSolids();
    let queued = false;
    const scheduleSync = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; syncSolids(); });
    };
    window.addEventListener("scroll", scheduleSync, true);
    const syncTimer = window.setInterval(syncSolids, 500);

    // Drag/throw — only over a shape, so the page stays clickable elsewhere.
    const mouse = Mouse.create(canvas);
    const mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
    Composite.add(engine.world, mc);
    render.mouse = mouse;
    canvas.style.pointerEvents = "none";

    const spawned: Matter.Body[] = [];
    const overShape = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect();
      return Query.point(spawned, { x: cx - rect.left, y: cy - rect.top }).length > 0;
    };
    const refreshHit = (cx: number, cy: number) => {
      canvas.style.pointerEvents = mc.body || overShape(cx, cy) ? "auto" : "none";
    };
    const onWinMove = (e: PointerEvent) => refreshHit(e.clientX, e.clientY);
    const onWinUp = (e: PointerEvent) => requestAnimationFrame(() => refreshHit(e.clientX, e.clientY));
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);

    let colorIdx = 0;
    /** Drop a shape. `remote` carries a peer's normalized x / color / angle so
     *  the same shape appears here; local spawns broadcast it on (shared). */
    const spawn = (shape: Shape, remote?: { x: number; c: number; a: number }) => {
      const cIdx = remote ? remote.c % PALETTE.length : colorIdx++ % PALETTE.length;
      const color = PALETTE[cIdx];
      const normX = remote ? remote.x : 0.2 + Math.random() * 0.6;
      const x = Math.max(40, Math.min(w - 40, normX * w));
      const angle = remote ? remote.a : (Math.random() - 0.5) * Math.PI;
      const g = GEO[shape];
      const opts: Matter.IBodyDefinition = {
        restitution: 0.45, friction: 0.3, frictionAir: 0.005,
        render: { fillStyle: color, strokeStyle: "rgba(255,255,255,0.3)", lineWidth: 2 },
      };
      let body: Matter.Body;
      switch (shape) {
        case "circle": body = Bodies.circle(x, 80, g.r, opts); break;
        case "square": body = Bodies.rectangle(x, 80, g.w, g.h, { ...opts, chamfer: { radius: 4 } }); break;
        case "flat": body = Bodies.rectangle(x, 80, g.w, g.h, { ...opts, chamfer: { radius: 6 } }); break;
        default: body = Bodies.polygon(x, 80, g.sides, g.r, opts);
      }
      Body.setAngle(body, angle);
      Composite.add(engine.world, body);
      spawned.push(body);
      playSound("pop");
      if (spawned.length > MAX_BODIES) {
        const old = spawned.shift();
        if (old) Composite.remove(engine.world, old);
      }
      setCount(spawned.length);
      if (shared && !remote) {
        socket.emit("sandbox:op", {
          t: "spawn", s: SHAPES.indexOf(shape), x: normX, c: cIdx, a: Math.round(angle * 1000) / 1000,
        });
      }
    };

    const clear = (broadcast = true) => {
      if (spawned.length) Composite.remove(engine.world, spawned);
      spawned.length = 0;
      setCount(0);
      if (shared && broadcast) socket.emit("sandbox:op", { t: "clear" });
    };

    api.current = { spawn, clear: () => clear(true) };

    // Mirror peers' spawns/clears (shared rooms only).
    const onOp = (op: SandboxOp) => {
      if (op.t === "spawn") spawn(SHAPES[op.s] ?? "circle", { x: op.x, c: op.c, a: op.a });
      else if (op.t === "clear") clear(false);
    };
    if (shared) socket.on("sandbox:op", onOp);

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      render.options.width = w; render.options.height = h;
      render.bounds.max.x = w; render.bounds.max.y = h;
      Render.setPixelRatio(render, pr);
      buildWalls(); syncSolids();
    };
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scheduleSync, true);
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.clearInterval(syncTimer);
      if (shared) socket.off("sandbox:op", onOp);
      api.current = null;
      Render.stop(render); Runner.stop(runner);
      Composite.clear(engine.world, false); Engine.clear(engine);
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [shared]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none fixed inset-0 z-40"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      <div className="pointer-events-auto absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-2xl glass-strong p-2 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.7)]">
        <span className="px-1 pb-0.5 text-base" title={t("landing.sandbox")}>{shared ? "🌐" : "🧩"}</span>
        {SHAPES.map((shape) => (
          <motion.button
            key={shape}
            onClick={() => api.current?.spawn(shape)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            title={t(`sb.shape.${shape}`)}
            aria-label={t(`sb.shape.${shape}`)}
            className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-cloud transition hover:bg-white/12"
          >
            <ShapeIcon shape={shape} />
          </motion.button>
        ))}
        <span className="mx-1 my-0.5 h-px w-7 bg-white/10" />
        <span className="text-[0.6rem] tabular-nums text-faint">{count}</span>
        <button
          onClick={() => api.current?.clear()}
          title={t("sb.clear")}
          aria-label={t("sb.clear")}
          className="grid h-9 w-11 place-items-center rounded-xl bg-white/5 text-cloud transition hover:bg-white/12"
        >
          🗑
        </button>
        <button
          onClick={onBack}
          title={t("sb.back")}
          aria-label={t("sb.back")}
          className="grid h-9 w-11 place-items-center rounded-xl bg-white/5 text-cloud transition hover:bg-rose-500/20"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}
