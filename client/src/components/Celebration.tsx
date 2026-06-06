import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Confetti } from "./Confetti";
import { playSound } from "@/lib/sound";
import { useStore } from "@/lib/store";

const COLORS = ["#6ee7d6", "#7dd3fc", "#a78bfa", "#f4a8c7", "#fbbf72", "#86efac"];

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
 *  everyone fling confetti by clicking/tapping anywhere on the screen. Bursts are
 *  synchronized — a tap lands in the same relative spot on every player's screen.
 *  `auto` toggles the initial top-down confetti rain (e.g. only for the winner). */
export function Celebration({
  auto = true,
  sound = true,
}: {
  auto?: boolean;
  sound?: boolean;
}) {
  const confetti = useStore((s) => s.confetti);
  const pushConfetti = useStore((s) => s.pushConfetti);
  const sendConfetti = useStore((s) => s.sendConfetti);

  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));
  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 0 : window.innerHeight));

  // Play the fanfare once, just after any final game SFX (e.g. the bomb) lands.
  useEffect(() => {
    if (!sound) return;
    const id = window.setTimeout(() => playSound("win"), 300);
    return () => clearTimeout(id);
  }, [sound]);

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Anyone clicking/tapping spawns a confetti pop — shown here immediately and
  // relayed to everyone else at the same relative spot (normalized 0–1 coords).
  useEffect(() => {
    let last = 0;
    const onDown = (e: PointerEvent) => {
      if (e.timeStamp - last < 120) return; // light throttle against spam
      last = e.timeStamp;
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      const color = useStore.getState().identity.color;
      pushConfetti(x, y, color); // show ours immediately…
      sendConfetti({ x, y, color }); // …and relay it to everyone else
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [pushConfetti, sendConfetti]);

  return (
    <>
      {auto && <Confetti />}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
        {confetti.map((c) => (
          <ConfettiBurst key={c.id} x={c.x * vw} y={c.y * vh} color={c.color} />
        ))}
      </div>
    </>
  );
}
