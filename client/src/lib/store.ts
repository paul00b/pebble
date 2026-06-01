import { create } from "zustand";
import { socket } from "./socket";
import { loadIdentity, saveIdentity } from "./session";
import { detectLocale, translate, type Locale } from "./i18n";
import type {
  GameAction,
  GameId,
  JoinResult,
  PlayerIdentity,
  RoomState,
} from "@shared";

export type ConnStatus = "connecting" | "online" | "offline";

export interface Notice {
  id: number;
  kind: "info" | "warn" | "error";
  text: string;
}

const LOCALE_KEY = "pebble.locale";
function loadLocale(): Locale {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    if (v === "en" || v === "fr") return v;
  } catch {
    /* ignore */
  }
  return detectLocale();
}

interface PebbleState {
  identity: PlayerIdentity;
  room: RoomState | null;
  youId: string | null;
  status: ConnStatus;
  notices: Notice[];
  locale: Locale;

  setLocale: (locale: Locale) => void;
  setIdentity: (patch: Partial<PlayerIdentity>) => void;
  createRoom: (game?: GameId) => Promise<JoinResult>;
  setGameLanguage: (language: Locale) => void;
  joinRoom: (code: string) => Promise<JoinResult>;
  leaveRoom: () => void;
  selectGame: (game: GameId) => void;
  updateSettings: (game: GameId, patch: Record<string, unknown>) => void;
  newBoardWord: () => void;
  start: () => Promise<{ ok: boolean; reason?: string }>;
  toLobby: () => void;
  gameAction: (action: GameAction) => void;
  kick: (playerId: string) => void;
  sendChat: (text: string) => void;
  pushNotice: (kind: Notice["kind"], text: string) => void;
  dismissNotice: (id: number) => void;
}

let noticeSeq = 0;
/** Remembered so an automatic socket reconnect can reclaim the same seat. */
let activeCode: string | null = null;

export const useStore = create<PebbleState>((set, get) => ({
  identity: loadIdentity(),
  room: null,
  youId: null,
  status: "connecting",
  notices: [],
  locale: loadLocale(),

  setLocale: (locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      /* ignore */
    }
    set({ locale });
  },

  setIdentity: (patch) => {
    const next = { ...get().identity, ...patch };
    saveIdentity(next);
    set({ identity: next });
  },

  createRoom: (game) =>
    new Promise<JoinResult>((resolve) => {
      socket.emit(
        "room:create",
        { identity: get().identity, game, language: get().locale },
        (res) => {
        if (res.ok) {
          activeCode = res.room.code;
          set({ room: res.room, youId: res.you });
        }
        resolve(res);
      });
    }),

  joinRoom: (code) =>
    new Promise<JoinResult>((resolve) => {
      socket.emit(
        "room:join",
        { code, identity: get().identity },
        (res) => {
          if (res.ok) {
            activeCode = res.room.code;
            set({ room: res.room, youId: res.you });
          }
          resolve(res);
        }
      );
    }),

  leaveRoom: () => {
    socket.emit("room:leave");
    activeCode = null;
    set({ room: null, youId: null });
  },

  selectGame: (game) => socket.emit("room:selectGame", game),

  updateSettings: (game, patch) =>
    socket.emit("room:updateSettings", { game, patch }),

  newBoardWord: () => socket.emit("board:newWord"),

  setGameLanguage: (language) => socket.emit("room:setLanguage", language),

  start: () =>
    new Promise((resolve) => socket.emit("room:start", resolve)),

  toLobby: () => socket.emit("room:toLobby"),

  gameAction: (action) => socket.emit("game:action", action),

  kick: (playerId) => socket.emit("room:kick", playerId),

  sendChat: (text) => socket.emit("chat:send", text),

  pushNotice: (kind, text) => {
    const id = ++noticeSeq;
    set((s) => ({ notices: [...s.notices, { id, kind, text }] }));
    setTimeout(() => get().dismissNotice(id), 4200);
  },

  dismissNotice: (id) =>
    set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
}));

/** Register socket listeners exactly once (called from main.tsx). */
let wired = false;
export function wireSocket() {
  if (wired) return;
  wired = true;

  socket.on("connect", () => {
    useStore.setState({ status: "online" });
    // Reclaim our seat after an automatic reconnect.
    if (activeCode) {
      const { identity } = useStore.getState();
      socket.emit("room:join", { code: activeCode, identity }, (res) => {
        if (res.ok) useStore.setState({ room: res.room, youId: res.you });
      });
    }
  });

  socket.on("disconnect", () => useStore.setState({ status: "offline" }));
  socket.io.on("reconnect_attempt", () =>
    useStore.setState({ status: "connecting" })
  );

  socket.on("room:state", (room) => useStore.setState({ room }));

  socket.on("room:notice", (notice) => {
    const { locale, pushNotice } = useStore.getState();
    pushNotice(notice.kind, translate(locale, notice.key, notice.params));
  });

  socket.on("room:closed", () => {
    activeCode = null;
    const { locale, pushNotice } = useStore.getState();
    useStore.setState({ room: null, youId: null });
    pushNotice("warn", translate(locale, "notice.roomClosed"));
  });
}
