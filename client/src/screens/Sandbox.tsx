import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import Matter from "matter-js";
import { playSound } from "@/lib/sound";
import { useT } from "@/lib/useT";

/* Local-only physics playground that runs *on top of the live screen*: the
 * transparent canvas overlays the lobby (or landing), and every element marked
 * `.sandbox-solid` (the cards, panels…) becomes a static rigid body, so dropped
 * shapes collide with and pile up on the real UI. Pointer events pass straight
 * through to the page except when you're hovering/dragging a shape. No network. */

type Shape = "circle" | "square" | "flat" | "triangle" | "pentagon" | "hexagon";

const SHAPES: Shape[] = ["circle", "square", "flat", "triangle", "pentagon", "hexagon"];

/** Playful fill palette, cycled as shapes spawn. */
const PALETTE = [
  "#fb7185", "#fb923c", "#facc15", "#4ade80",
  "#38bdf8", "#a78bfa", "#f472b6", "#6ee7d6",
];

const MAX_BODIES = 200; // keep the sim snappy; oldest is recycled past this

function ShapeIcon({ shape }: { shape: Shape }): ReactNode {
  const p = { viewBox: "0 0 32 32", className: "h-6 w-6", fill: "currentColor" } as const;
  switch (shape) {
    case "circle":
      return <svg {...p}><circle cx="16" cy="16" r="11" /></svg>;
    case "square":
      return <svg {...p}><rect x="6" y="6" width="20" height="20" rx="2.5" /></svg>;
    case "flat":
      return <svg {...p}><rect x="3" y="12" width="26" height="8" rx="3" /></svg>;
    case "triangle":
      return <svg {...p}><path d="M16 5l11 21H5z" /></svg>;
    case "pentagon":
      return <svg {...p}><path d="M16 4l12 8.7-4.6 14.1H8.6L4 12.7z" /></svg>;
    case "hexagon":
      return <svg {...p}><path d="M16 4l10.4 6v12L16 28 5.6 22V10z" /></svg>;
  }
}

export function Sandbox({ onBack }: { onBack: () => void }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Imperative handle into the running sim, set up inside the effect below.
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
      canvas,
      engine,
      options: { width: w, height: h, background: "transparent", wireframes: false, pixelRatio: pr },
    });
    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    // ── Boundary walls (viewport edges; a high ceiling so tosses come back) ──
    const wallOpts = { isStatic: true, render: { visible: false } } as const;
    let walls: Matter.Body[] = [];
    const buildWalls = () => {
      if (walls.length) Composite.remove(engine.world, walls);
      const T = 400;
      walls = [
        Bodies.rectangle(w / 2, h + T / 2, w + 2 * T, T, wallOpts), // floor
        Bodies.rectangle(-T / 2, h / 2, T, h + 6 * T, wallOpts), // left
        Bodies.rectangle(w + T / 2, h / 2, T, h + 6 * T, wallOpts), // right
        Bodies.rectangle(w / 2, -T - 400, w + 2 * T, T, wallOpts), // high ceiling
      ];
      Composite.add(engine.world, walls);
    };
    buildWalls();

    // ── Solids mirrored from the real DOM (cards become blocks) ──────────────
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

    // Re-read the DOM rects on scroll/resize/layout shifts (throttled to a frame).
    let queued = false;
    const scheduleSync = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; syncSolids(); });
    };
    window.addEventListener("scroll", scheduleSync, true);
    const syncTimer = window.setInterval(syncSolids, 500);

    // ── Mouse drag/throw — only when actually over a shape, so the page below
    //    stays clickable. We toggle the canvas's pointer-events on hover. ──────
    const mouse = Mouse.create(canvas);
    const mc = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    Composite.add(engine.world, mc);
    render.mouse = mouse;
    canvas.style.pointerEvents = "none";

    const spawned: Matter.Body[] = [];
    const overShape = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return Query.point(spawned, { x: clientX - rect.left, y: clientY - rect.top }).length > 0;
    };
    const refreshHit = (clientX: number, clientY: number) => {
      canvas.style.pointerEvents = mc.body || overShape(clientX, clientY) ? "auto" : "none";
    };
    const onWinMove = (e: PointerEvent) => refreshHit(e.clientX, e.clientY);
    const onWinUp = (e: PointerEvent) =>
      // Let matter clear mc.body first, then re-evaluate so a missed click falls through.
      requestAnimationFrame(() => refreshHit(e.clientX, e.clientY));
    window.addEventListener("pointermove", onWinMove);
    window.addEventListener("pointerup", onWinUp);

    let colorIdx = 0;
    const spawn = (shape: Shape) => {
      const color = PALETTE[colorIdx++ % PALETTE.length];
      const x = w / 2 + (Math.random() - 0.5) * Math.min(w * 0.6, 360);
      const y = 80;
      const opts: Matter.IBodyDefinition = {
        restitution: 0.45,
        friction: 0.3,
        frictionAir: 0.005,
        render: { fillStyle: color, strokeStyle: "rgba(255,255,255,0.3)", lineWidth: 2 },
      };
      let body: Matter.Body;
      switch (shape) {
        case "circle": body = Bodies.circle(x, y, 26, opts); break;
        case "square": body = Bodies.rectangle(x, y, 52, 52, { ...opts, chamfer: { radius: 4 } }); break;
        case "flat": body = Bodies.rectangle(x, y, 104, 22, { ...opts, chamfer: { radius: 6 } }); break;
        case "triangle": body = Bodies.polygon(x, y, 3, 34, opts); break;
        case "pentagon": body = Bodies.polygon(x, y, 5, 30, opts); break;
        case "hexagon": body = Bodies.polygon(x, y, 6, 30, opts); break;
      }
      Body.setAngle(body, (Math.random() - 0.5) * Math.PI);
      Composite.add(engine.world, body);
      spawned.push(body);
      playSound("pop");
      if (spawned.length > MAX_BODIES) {
        const old = spawned.shift();
        if (old) Composite.remove(engine.world, old);
      }
      setCount(spawned.length);
    };

    const clear = () => {
      if (spawned.length) Composite.remove(engine.world, spawned);
      spawned.length = 0;
      setCount(0);
    };

    api.current = { spawn, clear };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      render.options.width = w;
      render.options.height = h;
      render.bounds.max.x = w;
      render.bounds.max.y = h;
      Render.setPixelRatio(render, pr);
      buildWalls();
      syncSolids();
    };
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", scheduleSync, true);
      window.removeEventListener("pointermove", onWinMove);
      window.removeEventListener("pointerup", onWinUp);
      window.clearInterval(syncTimer);
      api.current = null;
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none fixed inset-0 z-40"
    >
      {/* transparent physics surface over the live page */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {/* right-hand shape sidebar (the only always-interactive part) */}
      <div className="pointer-events-auto absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-2xl glass-strong p-2 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.7)]">
        <span className="px-1 pb-0.5 text-base" title={t("landing.sandbox")}>🧩</span>
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
