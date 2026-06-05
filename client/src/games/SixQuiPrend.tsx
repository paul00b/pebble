import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { playSound } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { bullHeads, type Player, type RoomState, type SixQuiPrendView } from "@shared";

/* ── Card sizing presets (responsive — bigger on large screens) ───────────── */
const TABLE_CARD =
  "h-[4.25rem] w-[3.05rem] rounded-xl text-lg sm:h-[5.25rem] sm:w-[3.8rem] sm:rounded-2xl sm:text-2xl lg:h-[5.9rem] lg:w-[4.25rem]";
const HAND_CARD =
  "h-[5.5rem] w-[3.9rem] rounded-2xl text-2xl sm:h-[6.9rem] sm:w-[4.9rem] sm:text-[1.9rem]";
const MINI_CARD = "h-9 w-[1.6rem] rounded-md text-[0.65rem] sm:h-10 sm:w-[1.8rem]";

/** Bull-count → card accent. More bulls = hotter. */
function bullColor(b: number): string {
  if (b >= 5) return "#fb7185";
  if (b === 3) return "#fb923c";
  if (b === 2) return "#fbbf72";
  return "#9fb2b6";
}

function Card({
  value,
  faceDown,
  dim,
  glow,
  className = TABLE_CARD,
}: {
  value?: number;
  faceDown?: boolean;
  dim?: boolean;
  glow?: boolean;
  className?: string;
}) {
  if (faceDown || value == null) {
    return (
      <div
        className={`relative grid shrink-0 place-items-center ${className}`}
        style={{
          background:
            "repeating-linear-gradient(135deg, #16212a, #16212a 6px, #1f2e39 6px, #1f2e39 12px)",
          border: "1px solid rgba(110,231,214,0.28)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-accent/50 shadow-[0_0_10px_rgba(110,231,214,0.6)]" />
      </div>
    );
  }
  const b = bullHeads(value);
  const color = bullColor(b);
  return (
    <div
      className={`relative grid shrink-0 place-items-center font-display font-semibold text-cloud ${className}`}
      style={{
        background: `linear-gradient(160deg, ${color}33, ${color}14)`,
        border: `1px solid ${color}66`,
        opacity: dim ? 0.4 : 1,
        boxShadow: glow ? `0 0 0 2px ${color}aa, 0 12px 34px -10px ${color}99` : undefined,
        transition: "opacity .2s",
      }}
    >
      {value}
      <span
        className="absolute -top-1.5 -right-1.5 rounded-full bg-ink-800 px-1 text-[0.6rem] sm:text-[0.7rem]"
        style={{ color }}
      >
        {b}🐂
      </span>
    </div>
  );
}

/* ── Resolution animation ──────────────────────────────────────────────────
   The server resolves a whole turn atomically: every chosen card lands on its
   row (and rows may be scooped) in one snapshot. To make it feel like cards
   being dealt onto the table, we replay `lastTurn` step-by-step on the client,
   starting from `lastStartRows` (the pre-turn snapshot — scoops destroy the
   pre-scoop content, so the final `rows` alone can't be rewound).            */

const DROP_MS = 380; // a card falling onto its row
const GAP_MS = 230; // pause between two placements
const SCOOP_MS = 720; // a full row gathering into the player
const BANNER_MS = 1900; // "X scoops N 🐂" stays up

interface Banner {
  playerId: string;
  gained: number;
  key: number;
}

function useResolution(game: SixQuiPrendView) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState<number[][]>(() => game.rows.map((r) => [...r]));
  const [scoopRow, setScoopRow] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [animating, setAnimating] = useState(false);

  const gameRef = useRef(game);
  gameRef.current = game;

  // Treat whatever resolution exists on first mount as already shown (avoids
  // replaying a stale `lastTurn` after a refresh/reconnect).
  const ctl = useRef({
    baseKey: JSON.stringify(game.lastStartRows ?? null),
    done: game.lastTurn?.length ?? 0,
    rows: game.rows.map((r) => [...r]),
    timers: [] as number[],
  });

  const baseKey = JSON.stringify(game.lastStartRows ?? null);
  const sig = `${game.turn}|${game.lastTurn?.length ?? 0}|${baseKey}`;

  useEffect(() => {
    const g = gameRef.current;
    const c = ctl.current;
    const entries = g.lastTurn ?? [];
    const clearTimers = () => {
      c.timers.forEach((t) => clearTimeout(t));
      c.timers = [];
    };

    // No resolution in flight → mirror the authoritative table.
    if (!g.lastStartRows || entries.length === 0) {
      clearTimers();
      c.baseKey = baseKey;
      c.done = 0;
      c.rows = g.rows.map((r) => [...r]);
      setRows(c.rows.map((r) => [...r]));
      setScoopRow(null);
      setAnimating(false);
      return;
    }

    // A brand-new resolution → rewind the displayed table to the pre-turn state.
    if (baseKey !== c.baseKey) {
      clearTimers();
      c.baseKey = baseKey;
      c.done = 0;
      c.rows = g.lastStartRows.map((r) => [...r]);
      setRows(c.rows.map((r) => [...r]));
      setScoopRow(null);
    }

    if (c.done >= entries.length) return;

    // Reduced motion: jump straight to the final table.
    if (reduce) {
      c.rows = g.rows.map((r) => [...r]);
      c.done = entries.length;
      setRows(c.rows.map((r) => [...r]));
      setAnimating(false);
      return;
    }

    setAnimating(true);
    const step = () => {
      const cur = ctl.current;
      const list = gameRef.current.lastTurn ?? [];
      if (cur.done >= list.length) {
        setAnimating(false);
        return;
      }
      const e = list[cur.done];
      cur.done += 1;
      const bkey = cur.done;
      if (e.tookRow) {
        // The cards on that row gather into the scooping player.
        setScoopRow(e.rowIndex);
        setBanner({ playerId: e.playerId, gained: e.gained, key: bkey });
        playSound("scoop");
        cur.timers.push(
          window.setTimeout(() => {
            cur.rows[e.rowIndex] = [e.card];
            setRows(cur.rows.map((r) => [...r]));
            setScoopRow(null);
            cur.timers.push(
              window.setTimeout(
                () => setBanner((b) => (b && b.key === bkey ? null : b)),
                BANNER_MS
              )
            );
            cur.timers.push(window.setTimeout(step, GAP_MS));
          }, SCOOP_MS)
        );
      } else {
        cur.rows[e.rowIndex] = [...cur.rows[e.rowIndex], e.card];
        setRows(cur.rows.map((r) => [...r]));
        playSound("place");
        cur.timers.push(window.setTimeout(step, DROP_MS + GAP_MS));
      }
    };
    step();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return { rows, scoopRow, banner, animating };
}

export function SixQuiPrend({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as SixQuiPrendView;
  const youId = useStore((s) => s.youId);
  const gameAction = useStore((s) => s.gameAction);
  const players = useMemo(
    () => Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>,
    [room.players]
  );

  const { rows, scoopRow, banner, animating } = useResolution(game);

  if (game.over) return <SixResults game={game} players={players} youId={youId} t={t} />;

  const myTakeRow = game.phase === "takeRow" && game.pendingPlayerId === youId;
  const otherTakeRow = game.phase === "takeRow" && game.pendingPlayerId !== youId;
  const canTakeRow = myTakeRow && !animating;
  const pendingName = players[game.pendingPlayerId ?? ""]?.name ?? "…";

  const myChosen = game.youChoseCard ?? null;
  const canUnchoose = game.phase === "choosing" && myChosen != null;
  const selectable = game.phase === "choosing" && myChosen == null && !animating;
  const handCards = game.hand.filter((c) => c !== myChosen);

  const status = animating
    ? t("sixqp.resolving")
    : myTakeRow
      ? t("sixqp.chooseRow")
      : otherTakeRow
        ? t("sixqp.waitingChooseRow", { name: pendingName })
        : myChosen != null
          ? t("sixqp.locked")
          : t("sixqp.chooseCard");

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6 sm:gap-5">
      {/* status line */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-faint sm:text-base">
          {t("sixqp.round", { round: game.turn })} / {game.totalTurns}
        </div>
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-medium sm:text-base"
          style={{ color: myTakeRow ? "#fb7185" : "var(--color-mist)" }}
        >
          {status}
        </motion.div>
      </div>

      {/* the table — four rows */}
      <div className="relative rounded-[var(--radius-pebble)] border border-white/8 bg-white/[0.03] p-3 sm:p-4">
        <div className="mb-2 text-xs uppercase tracking-[0.2em] text-faint">{t("sixqp.table")}</div>
        <div className="flex flex-col gap-2 sm:gap-3">
          {rows.map((row, i) => {
            const scooping = scoopRow === i;
            return (
              <motion.button
                key={i}
                disabled={!canTakeRow}
                onClick={() => canTakeRow && gameAction({ type: "takeRow", rowIndex: i })}
                whileHover={canTakeRow ? { scale: 1.01 } : undefined}
                animate={
                  scooping
                    ? { boxShadow: "0 0 0 2px rgba(251,113,133,0.8)", backgroundColor: "rgba(251,113,133,0.10)" }
                    : { boxShadow: "0 0 0 0px rgba(251,113,133,0)" }
                }
                className={`flex items-center gap-1.5 rounded-2xl border p-2 transition sm:gap-2.5 sm:p-2.5 ${
                  canTakeRow
                    ? "cursor-pointer border-accent/50 bg-accent/5 hover:bg-accent/10"
                    : "border-white/8 bg-white/5"
                }`}
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {row.map((c) => (
                    <motion.div
                      key={c}
                      layout
                      initial={{ y: -54, opacity: 0, rotateZ: -8 }}
                      animate={{ y: 0, opacity: 1, rotateZ: 0 }}
                      exit={{ y: 64, opacity: 0, scale: 0.7 }}
                      transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    >
                      <Card value={c} className={TABLE_CARD} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {Array.from({ length: Math.max(0, 5 - row.length) }).map((_, k) => (
                  <div
                    key={`e${k}`}
                    className={`shrink-0 rounded-xl border border-dashed border-white/10 ${TABLE_CARD}`}
                  />
                ))}
                <span className="ml-auto pr-1 text-xs text-faint sm:text-sm">{row.length}/5</span>
              </motion.button>
            );
          })}
        </div>

        {/* scoop banner — floats over the table */}
        <AnimatePresence>
          {banner && (
            <motion.div
              key={banner.key}
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -8 }}
              transition={{ type: "spring", stiffness: 280, damping: 20 }}
              className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center"
            >
              <div className="glass-strong flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-cloud shadow-xl sm:text-base">
                {players[banner.playerId] && (
                  <Avatar
                    emoji={players[banner.playerId].avatar}
                    color={players[banner.playerId].color}
                    size={26}
                  />
                )}
                <span className="text-rose-200">
                  {t("sixqp.scooped", {
                    name: players[banner.playerId]?.name ?? "—",
                    n: banner.gained,
                  })}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* players around the table */}
      <div>
        <div className="mb-1.5 text-xs uppercase tracking-[0.2em] text-faint">{t("sixqp.players")}</div>
        <div className="flex flex-wrap gap-2">
          {game.players.map((p) => {
            const info = players[p.id];
            const isYou = p.id === youId;
            return (
              <div
                key={p.id}
                className={`glass flex items-center gap-2 rounded-2xl px-3 py-2 ${
                  isYou ? "ring-1 ring-accent/40" : ""
                }`}
              >
                {info && <Avatar emoji={info.avatar} color={info.color} size={30} ring={isYou} />}
                <div className="flex flex-col leading-tight">
                  <span className="text-sm text-cloud">{info?.name}</span>
                  <span className="text-xs text-faint">{p.bulls} 🐂</span>
                </div>
                <AnimatePresence>
                  {p.hasChosen && game.phase === "choosing" && (
                    <motion.div
                      initial={{ scale: 0.3, y: -14, opacity: 0, rotateZ: -12 }}
                      animate={{ scale: 1, y: 0, opacity: 1, rotateZ: 0 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 360, damping: 22 }}
                      className="ml-0.5"
                    >
                      {/* your own pick reads face-up; everyone else is hidden */}
                      <Card value={isYou ? myChosen ?? undefined : undefined} faceDown={!isYou} className={MINI_CARD} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* my play zone + hand */}
      <div className="mt-auto flex flex-col gap-3">
        <AnimatePresence>
          {myChosen != null && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col items-center gap-1.5 overflow-visible"
            >
              <motion.button
                layoutId={`six-card-${myChosen}`}
                onClick={() => canUnchoose && gameAction({ type: "unchoose" })}
                whileHover={canUnchoose ? { y: -4 } : undefined}
                whileTap={canUnchoose ? { scale: 0.95 } : undefined}
                className={canUnchoose ? "cursor-pointer" : "cursor-default"}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              >
                <Card value={myChosen} className={HAND_CARD} glow />
              </motion.button>
              <span className="text-xs text-faint">
                {canUnchoose ? t("sixqp.takeBack") : t("sixqp.locked")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <div className="mb-1.5 text-xs uppercase tracking-[0.2em] text-faint">{t("sixqp.yourHand")}</div>
          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            <AnimatePresence mode="popLayout">
              {handCards.map((c) => (
                <motion.button
                  key={c}
                  layoutId={`six-card-${c}`}
                  layout
                  disabled={!selectable}
                  onClick={() => selectable && gameAction({ type: "choose", card: c })}
                  whileHover={selectable ? { y: -8 } : undefined}
                  whileTap={selectable ? { scale: 0.95 } : undefined}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className={selectable ? "cursor-pointer" : "cursor-default"}
                >
                  <Card value={c} className={HAND_CARD} dim={!selectable && myChosen != null} />
                </motion.button>
              ))}
            </AnimatePresence>
            {handCards.length === 0 && myChosen == null && (
              <span className="text-sm text-faint">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SixResults({
  game,
  players,
  youId,
  t,
}: {
  game: SixQuiPrendView;
  players: Record<string, Player>;
  youId: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const isHost = room?.hostId === youId;
  const rows = [...game.players].sort((a, b) => a.bulls - b.bulls);
  const maxBulls = Math.max(1, ...rows.map((r) => r.bulls));

  return (
    <div className="grid flex-1 place-items-center">
      <Celebration />
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
          {t("sixqp.finalScores")}
        </div>
        <div className="mt-1 text-xs text-faint sm:text-sm">{t("sixqp.lowestWins")}</div>
        <ul className="mt-5 flex flex-col gap-2 text-left">
          {rows.map((r, i) => {
            const p = players[r.id];
            const pct = Math.round((r.bulls / maxBulls) * 100);
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.12, type: "spring", stiffness: 220, damping: 22 }}
                className={`relative overflow-hidden rounded-xl px-3 py-2.5 ${
                  i === 0 ? "bg-accent/15" : "bg-white/5"
                }`}
              >
                {/* bull-count bar */}
                <motion.div
                  className="absolute inset-y-0 left-0 -z-0"
                  style={{ background: i === 0 ? "rgba(110,231,214,0.12)" : "rgba(251,113,133,0.10)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.4 + i * 0.12, duration: 0.7, ease: "easeOut" }}
                />
                <div className="relative flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm text-faint">
                    {i === 0 ? "👑" : i + 1}
                  </span>
                  {p && <Avatar emoji={p.avatar} color={p.color} size={30} ring={i === 0} />}
                  <span
                    className={`flex-1 truncate text-sm sm:text-base ${
                      r.id === youId ? "text-accent" : "text-cloud"
                    }`}
                  >
                    {p?.name ?? "—"}
                  </span>
                  <span className="font-display text-lg tabular-nums text-cloud sm:text-xl">
                    {r.bulls}🐂
                  </span>
                </div>
              </motion.li>
            );
          })}
        </ul>
        {isHost ? (
          <Button full className="mt-6" onClick={toLobby}>
            {t("common.backToLobby")}
          </Button>
        ) : (
          <div className="mt-6 text-sm text-mist">{t("common.waitingHost")}</div>
        )}
      </GlassCard>
    </div>
  );
}
