import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { playSound } from "@/lib/sound";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import type { SkyjoCell, SkyjoView, Player, RoomState } from "@shared";

/** Card-value → color, from cool (low/good) to hot (high/bad). */
function valueColor(v: number): string {
  if (v < 0) return "#6ee7d6";
  if (v === 0) return "#9fb2b6";
  if (v <= 4) return "#7dd3fc";
  if (v <= 8) return "#fbbf72";
  return "#fb7185";
}

type CardSize = "seat" | "you" | "center";
// Responsive: cards grow on larger screens. "you" (your own grid) is the biggest.
// Kept moderate so a flowing top→bottom layout always fits the viewport.
const SIZES: Record<CardSize, string> = {
  seat: "h-9 w-[1.7rem] text-[0.72rem] sm:h-10 sm:w-[1.95rem] sm:text-sm lg:h-11 lg:w-[2.15rem] lg:text-[1rem]",
  you: "h-11 w-[2.05rem] text-base sm:h-12 sm:w-[2.3rem] sm:text-lg lg:h-14 lg:w-[2.6rem] lg:text-xl",
  center: "h-14 w-10 text-lg sm:h-16 sm:w-12 sm:text-xl lg:h-[4.4rem] lg:w-[3.3rem] lg:text-2xl",
};
// Matching gap so spacing is identical horizontally (between columns) and
// vertically (between rows).
const GAP = "gap-1 sm:gap-1.5 lg:gap-2";

function CardCell({
  cell,
  onClick,
  clickable,
  size = "seat",
  colIndex = 0,
}: {
  cell: SkyjoCell;
  onClick?: () => void;
  clickable?: boolean;
  size?: CardSize;
  colIndex?: number;
}) {
  const dim = SIZES[size];
  if (cell === null) return <div className={`${dim} rounded-lg`} />; // cleared (safety)
  const faceUp = cell.up && cell.value != null;
  const color = faceUp ? valueColor(cell.value!) : "#3a4a52";
  const ring = clickable ? "0 0 0 2px var(--color-accent)" : undefined;
  return (
    <motion.button
      layout
      disabled={!clickable}
      onClick={onClick}
      whileHover={clickable ? { scale: 1.1, y: -2 } : undefined}
      whileTap={clickable ? { scale: 0.94 } : undefined}
      className={`relative ${dim} ${clickable ? "cursor-pointer" : "cursor-default"}`}
      style={{ perspective: 600 }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: colIndex * 0.05 }}
      >
        {/* front — the value */}
        <span
          className="absolute inset-0 grid place-items-center rounded-lg font-display font-semibold"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: `${color}30`,
            border: `1px solid ${color}88`,
            color,
            boxShadow: ring,
          }}
        >
          {cell.value}
        </span>
        {/* back — face-down */}
        <span
          className="absolute inset-0 grid place-items-center rounded-lg text-faint"
          style={{
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: ring,
          }}
        >
          ?
        </span>
      </motion.div>
    </motion.button>
  );
}

/** A 3×4 grid rendered column-by-column so a cleared column can animate out and
 *  the remaining columns slide together toward the centre. */
function PlayerGrid({
  cells,
  size = "seat",
  cellClickable,
  onCell,
}: {
  cells: SkyjoCell[];
  size?: CardSize;
  cellClickable?: (i: number) => boolean;
  onCell?: (i: number) => void;
}) {
  const columns: { key: number; cells: { i: number; cell: SkyjoCell }[] }[] = [];
  for (let col = 0; col < 4; col++) {
    const colCells = [col, col + 4, col + 8].map((i) => ({ i, cell: cells[i] }));
    if (colCells.every((x) => x.cell === null)) continue; // cleared → drop the column
    columns.push({ key: col, cells: colCells });
  }
  return (
    <motion.div layout className={`flex justify-center ${GAP}`}>
      <AnimatePresence initial={false} mode="popLayout">
        {columns.map((column) => (
          <motion.div
            key={column.key}
            layout
            initial={{ opacity: 0, scaleY: 0.6 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, width: 0, scale: 0.4, marginLeft: 0, marginRight: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className={`flex flex-col ${GAP}`}
          >
            {column.cells.map(({ i, cell }) => (
              <CardCell
                key={i}
                cell={cell}
                size={size}
                colIndex={column.key}
                clickable={cellClickable?.(i)}
                onClick={() => onCell?.(i)}
              />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

/** Face-down pile (the deck) — a little stack of card backs. */
function DeckPile({
  count,
  clickable,
  onClick,
}: {
  count: number;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      disabled={!clickable}
      onClick={onClick}
      whileHover={clickable ? { scale: 1.06, y: -2 } : undefined}
      whileTap={clickable ? { scale: 0.95 } : undefined}
      animate={clickable ? { boxShadow: "0 0 18px -2px var(--color-accent)" } : { boxShadow: "0 0 0 0 transparent" }}
      className={`relative grid ${SIZES.center} place-items-center rounded-lg ${
        clickable ? "cursor-pointer ring-2 ring-accent/80" : ""
      }`}
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.16)",
      }}
    >
      <span className="text-sm font-medium text-faint tabular-nums">{count}</span>
    </motion.button>
  );
}

function Seat({
  player,
  info,
  current,
  isYou,
  cellClickable,
  onCell,
}: {
  player: SkyjoView["players"][number];
  info?: Player;
  current: boolean;
  isYou: boolean;
  cellClickable?: (i: number) => boolean;
  onCell?: (i: number) => void;
}) {
  return (
    <motion.div
      layout
      animate={{ scale: current ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`rounded-2xl p-2 ring-1 transition-colors sm:p-2.5 ${
        current
          ? "bg-white/[0.08] ring-accent/70 shadow-[0_0_24px_-6px_var(--color-accent)]"
          : "bg-white/[0.03] ring-white/5"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-center gap-1">
        {info && <Avatar emoji={info.avatar} color={info.color} size={isYou ? 22 : 18} ring={current} />}
        <span
          className={`max-w-[6rem] truncate text-xs sm:text-sm ${isYou ? "text-accent" : "text-cloud"}`}
        >
          {info?.name}
        </span>
        {current && <span className="text-[0.7rem]">⏳</span>}
        <span className="font-display text-xs tabular-nums text-faint sm:text-sm">{player.score}</span>
      </div>
      <PlayerGrid
        cells={player.grid}
        size={isYou ? "you" : "seat"}
        cellClickable={cellClickable}
        onCell={onCell}
      />
    </motion.div>
  );
}

/* ── Table-wide sound effects, driven by snapshot diffs ──────────────────── */
function countUp(g: SkyjoView): number {
  return g.players.reduce((s, p) => s + p.grid.filter((c) => c && c.up).length, 0);
}
function countGone(g: SkyjoView): number {
  return g.players.reduce((s, p) => s + p.grid.filter((c) => c === null).length, 0);
}

function useSkyjoSounds(game: SkyjoView) {
  const prev = useRef<SkyjoView | null>(null);
  useEffect(() => {
    const p = prev.current;
    if (p) {
      const moved = p.discardTop !== game.discardTop || p.deckCount !== game.deckCount;
      const upGain = countUp(game) - countUp(p);
      const goneGain = countGone(game) - countGone(p);
      if (moved) playSound("place");
      if (upGain > 0 && goneGain === 0) playSound("flip");
      if (goneGain > 0) window.setTimeout(() => playSound("clear"), 160);
    }
    prev.current = game;
  }, [game]);
}

/** Fires once when someone closes the round → big "last turn!" banner + chime. */
function useCloserAlert(game: SkyjoView): boolean {
  const [show, setShow] = useState(false);
  const prevCloser = useRef<string | null>(game.closerId ?? null);
  useEffect(() => {
    const prev = prevCloser.current;
    const cur = game.closerId ?? null;
    prevCloser.current = cur;
    if (!prev && cur && game.phase === "turn") {
      setShow(true);
      playSound("alert");
      const id = window.setTimeout(() => setShow(false), 3200);
      return () => clearTimeout(id);
    }
  }, [game.closerId, game.phase]);
  return show;
}

export function Skyjo({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as SkyjoView;
  const youId = useStore((s) => s.youId);
  const gameAction = useStore((s) => s.gameAction);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;

  useSkyjoSounds(game);
  const lastTurnAlert = useCloserAlert(game);

  // Local interaction mode layered on top of the server stage.
  const [mode, setMode] = useState<"idle" | "takeDiscard" | "keep" | "flipAfterDiscard">("idle");
  useEffect(() => setMode("idle"), [game.stage, game.currentId]);

  // When the round closes, linger on the revealed table for a beat before the
  // results card slides in — so everyone sees the final grids turn over.
  const [showResults, setShowResults] = useState(false);
  useEffect(() => {
    if (game.phase !== "done") {
      setShowResults(false);
      return;
    }
    const id = window.setTimeout(() => setShowResults(true), 2400);
    return () => clearTimeout(id);
  }, [game.phase]);

  const myTurn = game.currentId === youId && game.phase === "turn";
  const me = game.players.find((p) => p.id === youId);

  if (game.phase === "done" && showResults)
    return <SkyjoResults game={game} players={players} youId={youId} t={t} />;

  /* cell-click handler depending on phase/stage/mode */
  const cellClickableForMe = (i: number): boolean => {
    if (!me || me.grid[i] === null) return false;
    if (game.phase === "flip2") return !me.grid[i]!.up; // flip a face-down
    if (!myTurn) return false;
    if (game.stage === "await") return mode === "takeDiscard";
    if (game.stage === "resolveDraw") {
      if (mode === "keep") return true; // replace anywhere
      if (mode === "flipAfterDiscard") return !me.grid[i]!.up; // flip a hidden card
    }
    return false;
  };

  const onMyCell = (i: number) => {
    if (game.phase === "flip2") return gameAction({ type: "flip", index: i });
    if (game.stage === "await" && mode === "takeDiscard")
      return gameAction({ type: "takeDiscard", index: i });
    if (game.stage === "resolveDraw") {
      if (mode === "keep") return gameAction({ type: "keepReplace", index: i });
      if (mode === "flipAfterDiscard") return gameAction({ type: "discardFlip", index: i });
    }
  };

  const discardCard = () => {
    // If every card is already face-up there's nothing to flip — discard straight away.
    const hasHidden = me?.grid.some((c) => c && !c.up);
    if (hasHidden) setMode("flipAfterDiscard");
    else gameAction({ type: "discardFlip", index: 0 });
  };

  const flippedCount = me ? me.grid.filter((c) => c && c.up).length : 0;

  const status =
    game.phase === "done"
      ? t("sk.revealing")
      : game.phase === "flip2"
        ? t("sk.flipTwo", { n: Math.min(2, flippedCount) })
        : myTurn
          ? t("sk.yourTurn")
          : t("sk.waitingTurn", { name: players[game.currentId]?.name ?? "…" });

  // Hint shown under the status while the player is mid-action.
  const hint =
    !myTurn || game.phase !== "turn"
      ? null
      : game.stage === "await"
        ? mode === "takeDiscard"
          ? t("sk.tapToReplace")
          : null
        : mode === "keep"
          ? t("sk.tapToSwap")
          : mode === "flipAfterDiscard"
            ? t("sk.tapToFlip")
            : t("sk.chooseAction");

  // Turn order, you first; split into opponents (top) vs you (bottom).
  const meIdx = game.players.findIndex((p) => p.id === youId);
  const ordered =
    meIdx >= 0 ? [...game.players.slice(meIdx), ...game.players.slice(0, meIdx)] : game.players;
  const opponents = ordered.filter((p) => p.id !== youId);
  const youSeat = ordered.find((p) => p.id === youId);

  const deckClickable = myTurn && game.stage === "await" && mode === "idle";
  const discardClickable =
    myTurn && game.stage === "await" && mode === "idle" && game.discardTop != null;

  const closerName = game.closerId ? players[game.closerId]?.name ?? null : null;
  const closing = game.closerId != null && game.phase === "turn";

  return (
    <div className="relative flex flex-1 flex-col gap-3 pb-4">
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
        {closing && !lastTurnAlert && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs text-rose-200">
            🏁 {t("sk.lastTurn")}
            {closerName ? ` · ${closerName}` : ""}
          </div>
        )}
      </div>

      {/* opponents, wrapping across the top */}
      <div className="flex flex-wrap items-start justify-center gap-2 sm:gap-3">
        {opponents.map((p) => (
          <Seat
            key={p.id}
            player={p}
            info={players[p.id]}
            current={p.id === game.currentId && game.phase !== "done"}
            isYou={false}
          />
        ))}
      </div>

      {/* centre: deck + discard (+ drawn card with Keep / Discard) — vertically
          centred in whatever space is left between the opponents and your grid */}
      <div className="relative flex flex-1 items-center justify-center gap-5 py-1 sm:gap-7">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-36 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-44 sm:w-72"
          style={{ background: "radial-gradient(circle, rgba(110,231,214,0.10), transparent 70%)" }}
        />
        <div className="relative text-center">
          <DeckPile
            count={game.deckCount}
            clickable={deckClickable}
            onClick={() => gameAction({ type: "drawDeck" })}
          />
          <div className="mt-1 text-[0.65rem] text-faint sm:text-xs">{t("sk.deck")}</div>
        </div>

        <div className="relative text-center">
          {game.discardTop != null ? (
            <div className="grid place-items-center" style={{ perspective: 600 }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={game.discardTop}
                  initial={{ rotateY: 90, opacity: 0, y: -6 }}
                  animate={{ rotateY: 0, opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 280, damping: 22 }}
                >
                  <CardCell
                    cell={{ up: true, value: game.discardTop }}
                    size="center"
                    clickable={discardClickable}
                    onClick={discardClickable ? () => setMode("takeDiscard") : undefined}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <div className={`${SIZES.center} rounded-lg border border-dashed border-white/15`} />
          )}
          <div className="mt-1 text-[0.65rem] text-faint sm:text-xs">{t("sk.discard")}</div>
        </div>

        {/* drawn card hovering with its two actions */}
        <AnimatePresence>
          {myTurn && game.stage === "resolveDraw" && game.held != null && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="relative text-center"
            >
              <CardCell cell={{ up: true, value: game.held }} size="center" />
              <div className="mt-1 text-[0.65rem] text-accent sm:text-xs">{t("sk.drawnCard")}</div>
              {mode === "idle" && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <Button onClick={() => setMode("keep")} className="px-3 py-1 text-xs">
                    {t("sk.keep")}
                  </Button>
                  <Button variant="ghost" onClick={discardCard} className="px-3 py-1 text-xs">
                    {t("sk.discardCard")}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* you, anchored to the bottom */}
      {youSeat && (
        <div className="flex justify-center">
          <Seat
            player={youSeat}
            info={players[youId ?? ""]}
            current={myTurn}
            isYou
            cellClickable={cellClickableForMe}
            onCell={onMyCell}
          />
        </div>
      )}

      {/* big "last turn!" banner */}
      <AnimatePresence>
        {lastTurnAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center px-4"
          >
            <div className="glass-strong flex flex-col items-center gap-0.5 rounded-2xl px-6 py-3 text-center shadow-xl">
              <span className="font-display text-2xl font-bold text-rose-200 sm:text-3xl">
                🏁 {t("sk.lastTurnTitle")}
              </span>
              {closerName && (
                <span className="text-sm text-mist">{t("sk.lastTurnBy", { name: closerName })}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SkyjoResults({
  game,
  players,
  youId,
  t,
}: {
  game: SkyjoView;
  players: Record<string, Player>;
  youId: string | null;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const isHost = room?.hostId === youId;
  const scores = game.finalScores ?? {};
  const rows = [...game.players].sort((a, b) => (scores[a.id] ?? 0) - (scores[b.id] ?? 0));
  const maxScore = Math.max(1, ...rows.map((r) => Math.abs(scores[r.id] ?? 0)));

  return (
    <div className="grid flex-1 place-items-center">
      <Celebration auto={game.winnerId === youId} />
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
          {t("sk.finalScores")}
        </div>
        <div className="mt-1 text-xs text-faint sm:text-sm">{t("sk.lowestWins")}</div>
        <ul className="mt-5 flex flex-col gap-2 text-left">
          {rows.map((r, i) => {
            const p = players[r.id];
            const score = scores[r.id] ?? 0;
            const pct = Math.round((Math.abs(score) / maxScore) * 100);
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
                <motion.div
                  className="absolute inset-y-0 left-0 -z-0"
                  style={{ background: i === 0 ? "rgba(110,231,214,0.12)" : "rgba(251,113,133,0.10)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.4 + i * 0.12, duration: 0.7, ease: "easeOut" }}
                />
                <div className="relative flex items-center gap-2.5">
                  <span className="w-5 text-center text-sm text-faint">{i === 0 ? "👑" : i + 1}</span>
                  {p && <Avatar emoji={p.avatar} color={p.color} size={30} ring={i === 0} />}
                  <span
                    className={`flex-1 truncate text-sm sm:text-base ${
                      r.id === youId ? "text-accent" : "text-cloud"
                    }`}
                  >
                    {p?.name ?? "—"}
                    {r.id === game.closerId && <span className="ml-1 text-xs text-faint">🏁</span>}
                  </span>
                  <span className="font-display text-lg tabular-nums text-cloud sm:text-xl">{score}</span>
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
