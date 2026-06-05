import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Confetti } from "./Confetti";
import { playSound } from "@/lib/sound";

const COLORS = ["#6ee7d6", "#7dd3fc", "#a78bfa", "#f4a8c7", "#fbbf72", "#86efac"];

interface Burst {
  id: number;
  x: number;
  y: number;
}

/** A radial confetti pop centered on a point — used for click/tap bursts.
 *  Pass `color` to tint roughly half the pieces with that player's color. */
export function ConfettiBurst({
  x,
  y,
  count = 26,
  color,
}: {
  x: number;
  y: number;
  count?: number;
  color?: string;
}) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 150;
        return {
          id: i,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          drop: 100 + Math.random() * 220, // gravity pulls the pieces down after the pop
          rotate: Math.random() * 720 - 360,
          color: color && i % 2 === 0 ? color : COLORS[i % COLORS.length],
          size: 6 + Math.random() * 7,
          duration: 1.0 + Math.random() * 0.7,
        };
      }),
    [count, color]
  );

  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: [0, p.dx * 0.7, p.dx],
            y: [0, p.dy, p.dy + p.drop],
            opacity: [1, 1, 0],
            rotate: [0, p.rotate * 0.5, p.rotate],
          }}
          transition={{ duration: p.duration, ease: "easeOut", times: [0, 0.35, 1] }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size * 1.4,
            borderRadius: 2,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}

/** Drop onto any game's results screen: plays the victory fanfare once, and lets
 *  everyone fling confetti by clicking/tapping anywhere on the screen.
 *  `auto` toggles the initial top-down confetti rain (e.g. only for the winner). */
export function Celebration({
  auto = true,
  sound = true,
}: {
  auto?: boolean;
  sound?: boolean;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seq = useRef(0);

  // Play the fanfare once, just after any final game SFX (e.g. the bomb) lands.
  useEffect(() => {
    if (!sound) return;
    const id = window.setTimeout(() => playSound("win"), 300);
    return () => clearTimeout(id);
  }, [sound]);

  // Anyone clicking/tapping anywhere spawns a confetti pop at the pointer.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const id = ++seq.current;
      setBursts((b) => [...b, { id, x: e.clientX, y: e.clientY }]);
      window.setTimeout(
        () => setBursts((b) => b.filter((p) => p.id !== id)),
        2200
      );
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <>
      {auto && <Confetti />}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {bursts.map((b) => (
          <ConfettiBurst key={b.id} x={b.x} y={b.y} />
        ))}
      </div>
    </>
  );
}
