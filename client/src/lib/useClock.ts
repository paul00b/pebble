import { useEffect, useState } from "react";

/**
 * A ticking clock for animating countdowns toward a server `deadline`.
 * Returns the current epoch ms, refreshed at `everyMs` (default ~16fps-ish).
 */
export function useClock(everyMs = 80): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Seconds (one decimal) and 0–1 fraction remaining between start and deadline. */
export function remaining(now: number, start: number, deadline: number) {
  const total = Math.max(1, deadline - start);
  const left = Math.max(0, deadline - now);
  return { seconds: left / 1000, fraction: Math.min(1, left / total) };
}
