// Local guest identity, persisted so a refresh reclaims the same seat.
// (Designed to coexist with optional accounts later: an account would simply
//  supply the same fields from the server instead of localStorage.)

import type { PlayerIdentity } from "@shared";

const KEY = "pebble.identity.v1";

export const AVATARS = [
  "🦊", "🐧", "🐸", "🦉", "🐙", "🦄", "🐳", "🦁",
  "🐼", "🦖", "🐝", "🦜", "🐲", "🦩", "🐺", "🦚",
];

export const COLORS = [
  "#6ee7d6", "#7dd3fc", "#a78bfa", "#f4a8c7",
  "#fbbf72", "#86efac", "#fca5a5", "#c4b5fd",
];

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function freshIdentity(): PlayerIdentity {
  return {
    sessionId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
    name: "",
    avatar: randomOf(AVATARS),
    color: randomOf(COLORS),
  };
}

export function loadIdentity(): PlayerIdentity {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerIdentity>;
      if (parsed.sessionId) return { ...freshIdentity(), ...parsed } as PlayerIdentity;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const id = freshIdentity();
  saveIdentity(id);
  return id;
}

export function saveIdentity(identity: PlayerIdentity): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    /* storage may be unavailable (private mode); identity still works in-memory */
  }
}
