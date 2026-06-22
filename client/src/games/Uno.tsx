import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { playSound, type SoundName } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import type { UnoCard, UnoColor, UnoView, Player, RoomState } from "@shared";

/* ── palette ─────────────────────────────────────────────────────────────── */
const COLOR: Record<UnoColor, string> = {
  red: "#e0392b",
  yellow: "#f1b500",
  green: "#33a23a",
  blue: "#2a6fd6",
};
const COLOR_GLOW: Record<UnoColor, string> = {
  red: "rgba(224,57,43,0.55)",
  yellow: "rgba(241,181,0,0.55)",
  green: "rgba(51,162,58,0.55)",
  blue: "rgba(42,111,214,0.55)",
};

/** The big glyph in a card's centre (and its corners). */
function glyph(card: UnoCard): string {
  switch (card.kind) {
    case "num":
      return String(card.value ?? "");
    case "skip":
      return "⊘";
    case "reverse":
      return "⇄";
    case "draw2":
      return "+2";
    case "wild":
      return "★";
    case "wild4":
      return "+4";
  }
}

type CardSize = "hand" | "table" | "mini";
const SIZE: Record<CardSize, string> = {
  hand: "w-[3.15rem] h-[4.7rem] sm:w-[3.6rem] sm:h-[5.4rem]",
  table: "w-[3.9rem] h-[5.8rem] sm:w-[4.6rem] sm:h-[6.8rem]",
  mini: "w-6 h-[2.1rem] sm:w-7 sm:h-[2.5rem]",
};
const GLYPH_SIZE: Record<CardSize, string> = {
  hand: "text-2xl sm:text-3xl",
  table: "text-3xl sm:text-4xl",
  mini: "text-[0.6rem]",
};

/* ── a single Uno card face ──────────────────────────────────────────────── */
function CardFace({ card, size = "hand" }: { card: UnoCard; size?: CardSize }) {
  const isWild = card.kind === "wild" || card.kind === "wild4";
  // Wilds keep the four-colour wheel as their backdrop; coloured cards use their hue.
  const bg = isWild
    ? "conic-gradient(from 45deg, #e0392b 0deg 90deg, #f1b500 90deg 180deg, #33a23a 180deg 270deg, #2a6fd6 270deg 360deg)"
    : `linear-gradient(150deg, ${COLOR[card.color ?? "red"]}, ${shade(COLOR[card.color ?? "red"])})`;
  const ink = isWild ? "#fff" : COLOR[card.color ?? "red"];
  const g = glyph(card);
  const corner = size === "mini" ? "" : "block";

  return (
    <div
      className={`relative ${SIZE[size]} overflow-hidden rounded-xl shadow-md`}
      style={{ background: bg, border: "2px solid rgba(255,255,255,0.85)" }}
    >
      {/* tilted white oval */}
      {!isWild && (
        <span className="absolute left-1/2 top-1/2 h-[118%] w-[58%] -translate-x-1/2 -translate-y-1/2 rotate-[32deg] rounded-[50%] bg-white/90" />
      )}
      {isWild && (
        <span className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35" />
      )}
      {/* centre glyph */}
      <span
        className={`absolute inset-0 grid place-items-center font-display font-extrabold leading-none ${GLYPH_SIZE[size]}`}
        style={{ color: ink, textShadow: isWild ? "0 1px 3px rgba(0,0,0,0.6)" : "none" }}
      >
        {g}
      </span>
      {/* corners */}
      <span
        className={`absolute left-1 top-0.5 ${corner === "block" ? "block" : "hidden"} font-display text-[0.6rem] font-bold leading-none`}
        style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      >
        {g}
      </span>
      <span
        className={`absolute bottom-0.5 right-1 ${corner === "block" ? "block" : "hidden"} rotate-180 font-display text-[0.6rem] font-bold leading-none`}
        style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      >
        {g}
      </span>
    </div>
  );
}

/** Face-down Uno card back. */
function CardBack({ size = "mini" }: { size?: CardSize }) {
  return (
    <div
      className={`relative ${SIZE[size]} overflow-hidden rounded-xl shadow-md`}
      style={{ background: "linear-gradient(150deg, #1a1f24, #0c0f12)", border: "2px solid rgba(255,255,255,0.8)" }}
    >
      <span className="absolute left-1/2 top-1/2 h-[118%] w-[58%] -translate-x-1/2 -translate-y-1/2 rotate-[32deg] rounded-[50%] bg-rose-600/90" />
      {size !== "mini" && (
        <span className="absolute inset-0 grid place-items-center -rotate-[20deg] font-display text-base font-extrabold italic text-white">
          UNO
        </span>
      )}
    </div>
  );
}

function shade(hex: string): string {
  // Darken a hex colour ~22% for the card gradient bottom.
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.78);
  const g = Math.round(((n >> 8) & 255) * 0.78);
  const b = Math.round((n & 255) * 0.78);
  return `rgb(${r},${g},${b})`;
}

/* ── opponent seat ───────────────────────────────────────────────────────── */
function Seat({
  p,
  info,
  current,
  catchable,
  onCatch,
  catchLabel,
}: {
  p: UnoView["players"][number];
  info?: Player;
  current: boolean;
  catchable: boolean;
  onCatch: () => void;
  catchLabel: string;
}) {
  const backs = Math.min(p.count, 6);
  return (
    <motion.div
      layout
      animate={{ scale: current ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`relative rounded-2xl p-2 ring-1 transition-colors sm:p-2.5 ${
        current
          ? "bg-white/[0.08] ring-accent/70 shadow-[0_0_24px_-6px_var(--color-accent)]"
          : "bg-white/[0.03] ring-white/5"
      }`}
    >
      <div className="mb-1 flex items-center justify-center gap-1.5">
        {info && <Avatar emoji={info.avatar} color={info.color} size={20} ring={current} />}
        <span className="max-w-[5.5rem] truncate text-xs text-cloud sm:text-sm">{info?.name}</span>
        {current && <span className="text-[0.7rem]">⏳</span>}
      </div>
      {/* fanned card backs */}
      <div className="flex justify-center">
        {Array.from({ length: backs }).map((_, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : "-0.7rem" }}>
            <CardBack size="mini" />
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] font-medium tabular-nums text-mist">
          {p.count} 🎴
        </span>
        <AnimatePresence>
          {p.saidUno && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.6rem] font-extrabold text-ink-900"
            >
              UNO
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {/* catch button — fires when this player sat on one card without calling */}
      <AnimatePresence>
        {catchable && (
          <motion.button
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: [1, 1.08, 1] }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ scale: { repeat: Infinity, duration: 1.1 } }}
            onClick={onCatch}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-500 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-lg"
          >
            {catchLabel}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── sounds + transient toasts driven by lastEvent ───────────────────────── */
const EVENT_SOUND: Record<string, SoundName> = {
  play: "place",
  stack: "place",
  draw: "pop",
  skip: "used",
  reverse: "flip",
  wild: "place",
  uno: "alert",
  catch: "scoop",
};

function useUnoFeedback(game: UnoView, names: Record<string, Player>) {
  const prevAt = useRef<number>(0);
  const [toast, setToast] = useState<{ id: number; text: string; tone: string } | null>(null);
  useEffect(() => {
    const ev = game.lastEvent;
    if (!ev || ev.at === prevAt.current) return;
    prevAt.current = ev.at;
    playSound(EVENT_SOUND[ev.type] ?? "place");
    const who = names[ev.playerId]?.name ?? "?";
    if (ev.type === "uno")
      setToast({ id: ev.at, text: `${who} · UNO!`, tone: "amber" });
    else if (ev.type === "catch")
      setToast({ id: ev.at, text: `${who} +${ev.count}`, tone: "rose" });
    else if (ev.type === "skip")
      setToast({ id: ev.at, text: "⊘", tone: "slate" });
    // auto-dismiss
    const id = window.setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [game.lastEvent, names]);
  return toast;
}

/* ── main view ───────────────────────────────────────────────────────────── */
export function Uno({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as UnoView;
  const youId = useStore((s) => s.youId);
  const gameAction = useStore((s) => s.gameAction);
  const players = useMemo(
    () => Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>,
    [room.players]
  );

  const toast = useUnoFeedback(game, players);
  const [pendingWild, setPendingWild] = useState<string | null>(null);
  // Clear a half-opened colour picker whenever the turn/phase moves on.
  useEffect(() => setPendingWild(null), [game.currentId, game.phase]);

  const myTurn = game.currentId === youId && (game.phase === "play" || game.phase === "decideDrawn");
  const me = game.players.find((p) => p.id === youId);
  const playable = useMemo(() => new Set(game.playableIds), [game.playableIds]);

  if (game.phase === "over")
    return <UnoResults game={game} players={players} youId={youId} t={t} />;

  const onCardClick = (c: UnoCard) => {
    if (!myTurn || !playable.has(c.id)) return;
    if (c.kind === "wild" || c.kind === "wild4") setPendingWild(c.id);
    else gameAction({ type: "play", cardId: c.id });
  };
  const chooseColor = (color: UnoColor) => {
    if (!pendingWild) return;
    gameAction({ type: "play", cardId: pendingWild, color });
    setPendingWild(null);
  };
  const draw = () => gameAction({ type: "draw" });
  const pass = () => gameAction({ type: "pass" });
  const callUno = () => gameAction({ type: "callUno" });

  // Seat ordering: opponents in play order, you anchored at the bottom.
  const meIdx = game.order.indexOf(youId ?? "");
  const orderedIds =
    meIdx >= 0 ? [...game.order.slice(meIdx + 1), ...game.order.slice(0, meIdx)] : game.order;
  const opponents = orderedIds
    .map((id) => game.players.find((p) => p.id === id))
    .filter((p): p is UnoView["players"][number] => !!p && p.id !== youId);

  const canCallUno = !!me && me.count <= 2 && !me.saidUno && game.phase !== "roundOver";
  const drawnCard = game.drawnCardId ? game.hand.find((c) => c.id === game.drawnCardId) : null;

  // Status + hint text.
  const status = myTurn
    ? game.phase === "decideDrawn"
      ? t("uno.youDrew")
      : t("uno.yourTurn")
    : t("uno.waitingTurn", { name: players[game.currentId]?.name ?? "…" });
  const hint =
    !myTurn
      ? null
      : game.pendingDraw > 0
        ? t("uno.pendingHint", { n: game.pendingDraw })
        : game.phase === "decideDrawn"
          ? game.mustPlayDrawn
            ? t("uno.mustPlay")
            : t("uno.keepOrPlay")
          : playable.size === 0
            ? t("uno.noMoves")
            : t("uno.playHint");

  return (
    <div className="relative flex flex-1 flex-col gap-2 pb-2">
      {/* status */}
      <div className="text-center">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-lg font-semibold text-cloud sm:text-xl"
        >
          {status}
        </motion.div>
        {hint && <div className="mt-0.5 text-xs text-accent sm:text-sm">{hint}</div>}
      </div>

      {/* opponents */}
      <div className="flex flex-wrap items-start justify-center gap-2 sm:gap-3">
        {opponents.map((p) => (
          <Seat
            key={p.id}
            p={p}
            info={players[p.id]}
            current={p.id === game.currentId}
            catchable={game.catchable.includes(p.id)}
            onCatch={() => gameAction({ type: "catch", targetId: p.id })}
            catchLabel={t("uno.catch")}
          />
        ))}
      </div>

      {/* centre table: deck · discard · direction · colour */}
      <div className="relative flex flex-1 items-center justify-center gap-5 py-1 sm:gap-8">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${COLOR_GLOW[game.currentColor]}, transparent 70%)` }}
        />

        {/* draw pile */}
        <div className="relative z-10 text-center">
          <motion.button
            disabled={!myTurn || game.phase === "decideDrawn"}
            onClick={draw}
            whileHover={myTurn && game.phase !== "decideDrawn" ? { scale: 1.05, y: -2 } : undefined}
            whileTap={myTurn ? { scale: 0.95 } : undefined}
            animate={
              myTurn && (game.pendingDraw > 0 || playable.size === 0) && game.phase !== "decideDrawn"
                ? { boxShadow: "0 0 22px -2px var(--color-accent)" }
                : { boxShadow: "0 0 0 0 transparent" }
            }
            className={`relative rounded-xl ${myTurn && game.phase !== "decideDrawn" ? "cursor-pointer ring-2 ring-accent/70" : "cursor-default"}`}
          >
            <CardBack size="table" />
          </motion.button>
          <div className="mt-1 text-[0.65rem] text-faint sm:text-xs">
            {game.pendingDraw > 0 && myTurn ? t("uno.drawN", { n: game.pendingDraw }) : t("uno.draw")} · {game.drawCount}
          </div>
        </div>

        {/* discard top */}
        <div className="relative z-10 text-center">
          <div style={{ perspective: 600 }}>
            <AnimatePresence mode="popLayout" initial={false}>
              {game.topCard && (
                <motion.div
                  key={game.topCard.id}
                  initial={{ rotateZ: -12, scale: 0.8, opacity: 0, y: -8 }}
                  animate={{ rotateZ: 0, scale: 1, opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 20 }}
                  style={{ filter: `drop-shadow(0 6px 14px ${COLOR_GLOW[game.currentColor]})` }}
                >
                  <CardFace card={game.topCard} size="table" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* pending +N badge */}
          <AnimatePresence>
            {game.pendingDraw > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-3 -top-3 grid h-9 w-9 place-items-center rounded-full bg-rose-500 font-display text-sm font-extrabold text-white shadow-lg"
              >
                +{game.pendingDraw}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* direction + active colour */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <motion.div
            key={game.dir}
            initial={{ rotate: -40, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            className="text-2xl text-mist"
            title={t("uno.direction")}
          >
            {game.dir === 1 ? "↻" : "↺"}
          </motion.div>
          <div
            className="h-6 w-6 rounded-full ring-2 ring-white/40"
            style={{ background: COLOR[game.currentColor] }}
            title={t(`uno.color.${game.currentColor}`)}
          />
        </div>
      </div>

      {/* your hand */}
      <div className="flex flex-col items-center gap-2">
        {/* decide-drawn actions */}
        <AnimatePresence>
          {myTurn && game.phase === "decideDrawn" && drawnCard && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs text-mist"
            >
              <span>{t("uno.drewCard")}</span>
              {!game.mustPlayDrawn && (
                <Button variant="ghost" onClick={pass} className="px-3 py-1 text-xs">
                  {t("uno.keep")}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex w-full flex-wrap items-end justify-center gap-1.5 sm:gap-2">
          {game.hand.length === 0 && (
            <div className="py-4 text-sm text-faint">{t("uno.emptyHand")}</div>
          )}
          {game.hand.map((c) => {
            const can = myTurn && playable.has(c.id);
            const isDrawn = c.id === game.drawnCardId;
            return (
              <motion.button
                key={c.id}
                layout
                onClick={() => onCardClick(c)}
                disabled={!can}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: can ? -8 : 0 }}
                whileHover={can ? { y: -16, scale: 1.05 } : undefined}
                whileTap={can ? { scale: 0.96 } : undefined}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className={`relative rounded-xl ${can ? "cursor-pointer" : "cursor-default"}`}
                style={{
                  filter: myTurn && !can ? "brightness(0.55) saturate(0.7)" : "none",
                  boxShadow: isDrawn ? "0 0 0 3px var(--color-accent)" : can ? "0 0 14px -3px var(--color-accent)" : "none",
                  borderRadius: "0.75rem",
                }}
              >
                <CardFace card={c} size="hand" />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* UNO! call button */}
      <AnimatePresence>
        {canCallUno && (
          <motion.button
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: [1, 1.1, 1], rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ scale: { repeat: Infinity, duration: 1 } }}
            onClick={callUno}
            className="fixed bottom-20 right-4 z-40 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 font-display text-base font-extrabold italic text-ink-900 shadow-[0_8px_28px_-4px_rgba(245,158,11,0.7)] sm:bottom-6"
          >
            UNO!
          </motion.button>
        )}
      </AnimatePresence>

      {/* colour picker (wilds) */}
      <AnimatePresence>
        {pendingWild && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-ink-900/70 backdrop-blur-sm"
            onClick={() => setPendingWild(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-3xl p-5 text-center"
            >
              <div className="mb-3 font-display text-lg font-semibold text-cloud">{t("uno.pickColor")}</div>
              <div className="grid grid-cols-2 gap-3">
                {(["red", "yellow", "green", "blue"] as const).map((c) => (
                  <motion.button
                    key={c}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => chooseColor(c)}
                    className="h-20 w-20 rounded-2xl ring-2 ring-white/40 sm:h-24 sm:w-24"
                    style={{ background: COLOR[c] }}
                    aria-label={t(`uno.color.${c}`)}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* transient event toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, scale: 0.7, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none fixed inset-x-0 top-24 z-40 flex justify-center"
          >
            <span
              className={`rounded-full px-4 py-1.5 font-display text-lg font-bold shadow-xl ${
                toast.tone === "amber"
                  ? "bg-amber-400 text-ink-900"
                  : toast.tone === "rose"
                    ? "bg-rose-500 text-white"
                    : "bg-white/15 text-cloud"
              }`}
            >
              {toast.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* round scoreboard interstitial (points-match only) */}
      <AnimatePresence>
        {game.phase === "roundOver" && (
          <RoundOver game={game} players={players} youId={youId} t={t} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── round-over interstitial (match to a points target) ──────────────────── */
function RoundOver({
  game,
  players,
  youId,
  t,
}: {
  game: UnoView;
  players: Record<string, Player>;
  youId: string | null;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const gameAction = useStore((s) => s.gameAction);
  const isHost = room?.hostId === youId;
  const winner = game.roundWinnerId ? players[game.roundWinnerId] : null;
  const gained = game.roundWinnerId ? game.roundPoints?.[game.roundWinnerId] ?? 0 : 0;
  const rows = [...game.players].sort((a, b) => b.score - a.score);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/70 p-4 backdrop-blur-sm"
    >
      <GlassCard
        strong
        className="w-full max-w-sm p-6 text-center"
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
      >
        <div className="text-5xl">🎴</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">
          {winner ? t("uno.roundWon", { name: winner.name }) : t("uno.roundOver")}
        </div>
        <div className="mt-1 text-sm text-accent">+{gained} {t("uno.points")}</div>
        <div className="mt-1 text-xs text-faint">{t("uno.target", { n: game.scoreTarget })}</div>
        <ul className="mt-4 flex flex-col gap-2 text-left">
          {rows.map((r) => {
            const p = players[r.id];
            const pct = Math.min(100, Math.round((r.score / Math.max(1, game.scoreTarget)) * 100));
            return (
              <li key={r.id} className="relative overflow-hidden rounded-xl bg-white/5 px-3 py-2">
                <div
                  className="absolute inset-y-0 left-0 -z-0 bg-accent/15"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center gap-2.5">
                  {p && <Avatar emoji={p.avatar} color={p.color} size={26} />}
                  <span className={`flex-1 truncate text-sm ${r.id === youId ? "text-accent" : "text-cloud"}`}>
                    {p?.name ?? "—"}
                  </span>
                  <span className="font-display tabular-nums text-cloud">{r.score}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {isHost ? (
          <Button full onClick={() => gameAction({ type: "next" })} className="mt-5">
            {t("uno.nextRound")}
          </Button>
        ) : (
          <div className="mt-5 text-sm text-mist">{t("common.waitingHost")}</div>
        )}
      </GlassCard>
    </motion.div>
  );
}

/* ── final results ───────────────────────────────────────────────────────── */
function UnoResults({
  game,
  players,
  youId,
  t,
}: {
  game: UnoView;
  players: Record<string, Player>;
  youId: string | null;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const isHost = room?.hostId === youId;
  const winnerId = game.matchWinnerId;
  // Single round → lowest cards / the emptied hand won; match → highest score.
  const rows = [...game.players].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    return b.score - a.score;
  });

  return (
    <div className="grid flex-1 place-items-center">
      <Celebration auto={winnerId === youId} />
      <GlassCard
        strong
        className="w-full max-w-md p-7 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <motion.div
          className="text-6xl"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 14, delay: 0.15 }}
        >
          🏆
        </motion.div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud sm:text-3xl">
          {winnerId ? t("uno.winner", { name: players[winnerId]?.name ?? "—" }) : t("uno.gameOver")}
        </div>
        <ul className="mt-5 flex flex-col gap-2 text-left">
          {rows.map((r, i) => {
            const p = players[r.id];
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 220, damping: 22 }}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
                  r.id === winnerId ? "bg-accent/15" : "bg-white/5"
                }`}
              >
                <span className="w-5 text-center text-sm text-faint">{i === 0 ? "👑" : i + 1}</span>
                {p && <Avatar emoji={p.avatar} color={p.color} size={30} ring={r.id === winnerId} />}
                <span className={`flex-1 truncate text-sm sm:text-base ${r.id === youId ? "text-accent" : "text-cloud"}`}>
                  {p?.name ?? "—"}
                </span>
                {game.scoreTarget > 0 && (
                  <span className="font-display text-lg tabular-nums text-cloud">{r.score}</span>
                )}
              </motion.li>
            );
          })}
        </ul>
        {isHost ? (
          <div className="mt-6 flex flex-col gap-2">
            <Button full onClick={toLobby}>
              {t("common.backToLobby")}
            </Button>
            <Button full variant="ghost" onClick={retry}>
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <div className="mt-6 text-sm text-mist">{t("common.waitingHost")}</div>
        )}
      </GlassCard>
    </div>
  );
}
