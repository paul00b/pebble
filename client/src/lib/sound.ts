// A tiny synthesized sound engine — zero audio assets, everything is generated
// live with the Web Audio API. Keeps the app lightweight and offline-friendly.
//
// Usage:  playSound("right")   — fire a named effect (no-ops when muted/unsupported)
//         useMuted() / toggleMuted()  — React mute toggle, persisted to localStorage
//
// Adding a game's sounds later = add entries to SOUND_NAMES + SYNTHS below.

import { useSyncExternalStore } from "react";

export const SOUND_NAMES = ["right", "wrong", "used", "explode", "win", "place", "scoop"] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

/* ── Mute state (persisted, observable) ──────────────────────────────────── */

const MUTE_KEY = "pebble.muted";
let muted = ((): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function isMuted(): boolean {
  return muted;
}
export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  emit();
}
export function toggleMuted(): void {
  setMuted(!muted);
}

/** React binding for the mute flag. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    isMuted,
    isMuted
  );
}

/* ── Audio context (lazy, gesture-unlocked) ──────────────────────────────── */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// Browsers start the audio context suspended until a user gesture. Sounds here
// are triggered by game events (not direct clicks), so unlock on the first
// interaction anywhere in the app.
if (typeof window !== "undefined") {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

/* ── Synth primitives ────────────────────────────────────────────────────── */

interface ToneOpts {
  freq: number;
  /** Glide target frequency (exponential ramp over the tone's duration). */
  to?: number;
  type?: OscillatorType;
  /** Seconds to wait before this tone starts (for little melodies). */
  delay?: number;
  dur: number;
  gain?: number;
  attack?: number;
}

function tone(c: AudioContext, dest: AudioNode, o: ToneOpts): void {
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);

  const g = c.createGain();
  const peak = o.gain ?? 0.2;
  const atk = o.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

/** A filtered white-noise burst with a frequency sweep — the body of an explosion. */
function noise(
  c: AudioContext,
  dest: AudioNode,
  o: {
    dur: number;
    gain: number;
    from: number;
    to: number;
    type?: BiquadFilterType;
    attack?: number;
    delay?: number;
  }
): void {
  const t0 = c.currentTime + (o.delay ?? 0);
  const frames = Math.floor(c.sampleRate * o.dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = o.type ?? "lowpass";
  filter.frequency.setValueAtTime(o.from, t0);
  filter.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);

  const g = c.createGain();
  const atk = o.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  src.connect(filter).connect(g).connect(dest);
  src.start(t0);
  src.stop(t0 + o.dur);
}

/** A soft-clipping curve for waveshaper grit (makes the boom punch). */
function distortionCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

/* ── The sound bank ──────────────────────────────────────────────────────── */

const SYNTHS: Record<SoundName, (c: AudioContext, dest: AudioNode) => void> = {
  // Accepted word: a bright, rising two-note "ding".
  right: (c, d) => {
    tone(c, d, { freq: 660, type: "triangle", dur: 0.12, gain: 0.2 });
    tone(c, d, { freq: 988, type: "triangle", delay: 0.1, dur: 0.2, gain: 0.2 });
  },
  // Invalid word: a short descending buzz.
  wrong: (c, d) => {
    tone(c, d, { freq: 220, to: 120, type: "sawtooth", dur: 0.24, gain: 0.13 });
  },
  // Already used: a neutral double blip, distinct from the buzz.
  used: (c, d) => {
    tone(c, d, { freq: 420, type: "square", dur: 0.07, gain: 0.09 });
    tone(c, d, { freq: 420, type: "square", delay: 0.12, dur: 0.07, gain: 0.09 });
  },
  // Boom: a layered explosion — sharp crack, saturated body, low rumble tail,
  // and a pitch-dropping sub thump underneath.
  explode: (c, d) => {
    // Grit bus: the body runs through a soft-clipper for punch.
    const shaper = c.createWaveShaper();
    shaper.curve = distortionCurve(50) as Float32Array<ArrayBuffer>;
    shaper.connect(d);

    // 1) Sharp initial crack (bright, very short).
    noise(c, d, { dur: 0.09, gain: 0.7, from: 7000, to: 1800, type: "highpass", attack: 0.001 });
    // 2) Main body — full-spectrum blast sweeping down, distorted.
    noise(c, shaper, { dur: 1.0, gain: 0.6, from: 2200, to: 80, type: "lowpass", attack: 0.004 });
    // 3) Long low rumble tail.
    noise(c, d, { dur: 1.5, gain: 0.32, from: 500, to: 40, type: "lowpass", attack: 0.03, delay: 0.04 });
    // 4) Sub-bass thump, dropping in pitch.
    tone(c, d, { freq: 140, to: 30, type: "sine", dur: 0.7, gain: 0.5 });
    tone(c, d, { freq: 80, to: 22, type: "sine", dur: 1.0, gain: 0.38, delay: 0.02 });
  },
  // Victory: a cheerful rising major arpeggio capped with a held chord + sparkle.
  win: (c, d) => {
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    chord.forEach((f, i) =>
      tone(c, d, { freq: f, type: "triangle", delay: i * 0.1, dur: 0.24, gain: 0.18 })
    );
    // Held major chord to land the fanfare.
    chord.forEach((f) =>
      tone(c, d, { freq: f, type: "triangle", delay: 0.42, dur: 0.7, gain: 0.11 })
    );
    // High sparkle on top.
    tone(c, d, { freq: 1567.98, type: "sine", delay: 0.44, dur: 0.6, gain: 0.08 });
    tone(c, d, { freq: 2093, type: "sine", delay: 0.56, dur: 0.5, gain: 0.06 });
  },
  // A card landing on the table: a short, dry, slightly noisy tick.
  place: (c, d) => {
    noise(c, d, { dur: 0.07, gain: 0.16, from: 3200, to: 700, type: "lowpass", attack: 0.001 });
    tone(c, d, { freq: 180, to: 90, type: "sine", dur: 0.08, gain: 0.12 });
  },
  // Scooping a row: a quick upward "swish" + soft thump as the cards gather.
  scoop: (c, d) => {
    noise(c, d, { dur: 0.28, gain: 0.22, from: 500, to: 3600, type: "bandpass", attack: 0.01 });
    tone(c, d, { freq: 300, to: 520, type: "triangle", dur: 0.22, gain: 0.12 });
    tone(c, d, { freq: 130, to: 70, type: "sine", dur: 0.18, gain: 0.16, delay: 0.16 });
  },
};

/* ── Public API ──────────────────────────────────────────────────────────── */

const MASTER_GAIN = 0.7;

export function playSound(name: SoundName): void {
  if (muted) return;
  const c = audio();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(c.destination);
  try {
    SYNTHS[name]?.(c, master);
  } catch {
    /* never let a sound throw into the UI */
  }
}
