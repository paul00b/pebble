import { motion, type HTMLMotionProps } from "framer-motion";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ── GlassCard ──────────────────────────────────────────────────────────── */
export function GlassCard({
  children,
  className,
  strong,
  ...rest
}: { children: ReactNode; className?: string; strong?: boolean } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={cx(
        strong ? "glass-strong" : "glass",
        "glass-edge rounded-[var(--radius-pebble)]",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ── Button ─────────────────────────────────────────────────────────────── */
type Variant = "primary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "text-ink-900 font-semibold bg-[linear-gradient(180deg,#9af3e4,#4fd6c0)] shadow-[0_10px_30px_-8px_rgba(78,214,192,0.6)] hover:brightness-105",
  ghost:
    "text-cloud glass hover:bg-white/10 border border-white/10",
  danger:
    "text-rose-50 bg-rose-500/20 border border-rose-300/30 hover:bg-rose-500/30",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", full, className, children, ...rest },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cx(
        "relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[0.95rem] tracking-tight transition-[filter,background] outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        full && "w-full",
        className
      )}
      {...(rest as HTMLMotionProps<"button">)}
    >
      {children}
    </motion.button>
  );
});

/* ── Avatar ─────────────────────────────────────────────────────────────── */
export function Avatar({
  emoji,
  color,
  size = 44,
  dim,
  ring,
}: {
  emoji: string;
  color: string;
  size?: number;
  dim?: boolean;
  ring?: boolean;
}) {
  return (
    <span
      className="relative inline-grid place-items-center rounded-2xl"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: `radial-gradient(120% 120% at 30% 20%, ${color}33, ${color}10)`,
        border: `1px solid ${color}55`,
        boxShadow: ring ? `0 0 0 2px ${color}aa, 0 8px 24px -8px ${color}88` : undefined,
        opacity: dim ? 0.45 : 1,
        filter: dim ? "grayscale(0.5)" : undefined,
        transition: "opacity .25s, filter .25s",
      }}
    >
      {emoji}
    </span>
  );
}

export { cx };
