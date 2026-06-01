import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Confetti } from "@/components/Confetti";
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

type CardSize = "seat" | "center";
// Responsive: cards shrink on small screens so circular seating never overlaps.
const SIZES: Record<CardSize, string> = {
  seat: "h-8 w-6 text-[0.6rem] sm:h-10 sm:w-7 sm:text-xs md:h-11 md:w-8 md:text-sm",
  center: "h-14 w-10 text-lg sm:h-16 sm:w-12 sm:text-xl",
};

function CardCell({
  cell,
  onClick,
  clickable,
  size = "seat",
}: {
  cell: SkyjoCell;
  onClick?: () => void;
  clickable?: boolean;
  size?: CardSize;
}) {
  const dim = SIZES[size];
  if (cell === null) return <div className={`${dim} rounded-lg`} />; // cleared
  const faceUp = cell.up && cell.value != null;
  const color = faceUp ? valueColor(cell.value!) : "#3a4a52";
  return (
    <motion.button
      layout
      disabled={!clickable}
      onClick={onClick}
      whileHover={clickable ? { scale: 1.1, y: -2 } : undefined}
      whileTap={clickable ? { scale: 0.94 } : undefined}
      className={`grid ${dim} place-items-center rounded-lg font-display font-semibold ${
        clickable ? "cursor-pointer ring-2 ring-accent" : ""
      }`}
      style={{
        background: faceUp ? `${color}30` : "rgba(255,255,255,0.06)",
        border: `1px solid ${faceUp ? color + "88" : "rgba(255,255,255,0.12)"}`,
        color: faceUp ? color : "var(--color-faint)",
      }}
    >
      {faceUp ? cell.value : "?"}
    </motion.button>
  );
}

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
  return (
    <div className="grid grid-cols-4 gap-1">
      {cells.map((c, i) => (
        <CardCell
          key={i}
          cell={c}
          size={size}
          clickable={cellClickable?.(i)}
          onClick={() => onCell?.(i)}
        />
      ))}
    </div>
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
      className={`relative grid ${SIZES.center} place-items-center rounded-lg ${
        clickable ? "cursor-pointer ring-2 ring-accent/80" : ""
      }`}
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: clickable
          ? "0 0 14px -2px var(--color-accent), 3px 3px 0 -1px rgba(255,255,255,0.05), 6px 6px 0 -2px rgba(255,255,255,0.04)"
          : "3px 3px 0 -1px rgba(255,255,255,0.05), 6px 6px 0 -2px rgba(255,255,255,0.04)",
      }}
    >
      <span className="text-sm font-medium text-faint tabular-nums">{count}</span>
    </motion.button>
  );
}

/** Seat position on an ellipse around the centre. Index 0 = you, bottom. */
function seatStyle(i: number, n: number): React.CSSProperties {
  const a = (i / n) * 2 * Math.PI + Math.PI / 2; // i=0 → bottom
  const left = 50 + 36 * Math.cos(a);
  const top = 50 + 40 * Math.sin(a);
  return { left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" };
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
      animate={{ scale: current ? 1.04 : 1 }}
      className={`rounded-2xl p-2 ring-1 transition-colors ${
        current ? "bg-white/[0.08] ring-accent/70" : "bg-white/[0.03] ring-white/5"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-center gap-1">
        {info && <Avatar emoji={info.avatar} color={info.color} size={18} />}
        <span className={`max-w-[5rem] truncate text-xs ${isYou ? "text-accent" : "text-cloud"}`}>
          {info?.name}
        </span>
        {current && <span className="text-[0.7rem]">⏳</span>}
        <span className="font-display text-xs tabular-nums text-faint">{player.score}</span>
      </div>
      <PlayerGrid cells={player.grid} cellClickable={cellClickable} onCell={onCell} />
    </motion.div>
  );
}

export function Skyjo({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as SkyjoView;
  const youId = useStore((s) => s.youId);
  const gameAction = useStore((s) => s.gameAction);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;

  // Local interaction mode layered on top of the server stage.
  const [mode, setMode] = useState<"idle" | "takeDiscard" | "keep" | "flipAfterDiscard">("idle");
  useEffect(() => setMode("idle"), [game.stage, game.currentId]);

  const myTurn = game.currentId === youId && game.phase === "turn";
  const me = game.players.find((p) => p.id === youId);

  if (game.phase === "done")
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
    game.phase === "flip2"
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

  // Seat the players around an ellipse, you first (bottom), keeping turn order.
  const n = game.players.length;
  const meIdx = game.players.findIndex((p) => p.id === youId);
  const ordered =
    meIdx >= 0 ? [...game.players.slice(meIdx), ...game.players.slice(0, meIdx)] : game.players;

  const deckClickable = myTurn && game.stage === "await" && mode === "idle";
  const discardClickable =
    myTurn && game.stage === "await" && mode === "idle" && game.discardTop != null;

  return (
    <div className="flex flex-1 flex-col gap-2 pb-4">
      {/* status banner */}
      <div className="text-center">
        <div className="font-display text-lg font-semibold text-cloud">{status}</div>
        {hint && <div className="mt-0.5 text-xs text-accent">{hint}</div>}
      </div>

      {/* ── the round table ── seats on a circle, piles at the centre ── */}
      <div className="relative mx-auto w-full max-w-[680px] flex-1 min-h-[420px] sm:min-h-[480px]">
        {/* seats */}
        {ordered.map((p, i) => {
          const isYou = p.id === youId;
          return (
            <div key={p.id} className="absolute" style={seatStyle(i, n)}>
              <Seat
                player={p}
                info={players[p.id]}
                current={p.id === game.currentId}
                isYou={isYou}
                cellClickable={isYou ? cellClickableForMe : undefined}
                onCell={isYou ? onMyCell : undefined}
              />
            </div>
          );
        })}

        {/* centre: deck + discard (+ drawn card with Keep / Discard) */}
        <div
          className="absolute flex items-start justify-center gap-4"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        >
          <div className="text-center">
            <DeckPile
              count={game.deckCount}
              clickable={deckClickable}
              onClick={() => gameAction({ type: "drawDeck" })}
            />
            <div className="mt-1 text-[0.65rem] text-faint">{t("sk.deck")}</div>
          </div>

          <div className="text-center">
            {game.discardTop != null ? (
              <CardCell
                cell={{ up: true, value: game.discardTop }}
                size="center"
                clickable={discardClickable}
                onClick={discardClickable ? () => setMode("takeDiscard") : undefined}
              />
            ) : (
              <div className={`${SIZES.center} rounded-lg border border-dashed border-white/15`} />
            )}
            <div className="mt-1 text-[0.65rem] text-faint">{t("sk.discard")}</div>
          </div>

          {/* drawn card hovering with its two actions */}
          {myTurn && game.stage === "resolveDraw" && game.held != null && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="text-center"
            >
              <CardCell cell={{ up: true, value: game.held }} size="center" />
              <div className="mt-1 text-[0.65rem] text-accent">{t("sk.drawnCard")}</div>
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
        </div>
      </div>
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

  return (
    <div className="grid flex-1 place-items-center">
      {game.winnerId === youId && <Confetti />}
      <GlassCard
        strong
        className="w-full max-w-sm p-7 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-5xl">🏆</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">{t("sk.finalScores")}</div>
        <div className="mt-1 text-xs text-faint">{t("sk.lowestWins")}</div>
        <ul className="mt-4 flex flex-col gap-1.5 text-left">
          {rows.map((r, i) => {
            const p = players[r.id];
            return (
              <li
                key={r.id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${i === 0 ? "bg-accent/15" : "bg-white/5"}`}
              >
                <span className="w-5 text-center text-sm text-faint">{i + 1}</span>
                {p && <Avatar emoji={p.avatar} color={p.color} size={28} />}
                <span className={`flex-1 truncate text-sm ${r.id === youId ? "text-accent" : "text-cloud"}`}>
                  {p?.name ?? "—"}
                  {r.id === game.closerId && <span className="ml-1 text-xs text-faint">🏁</span>}
                </span>
                <span className="font-display text-lg tabular-nums text-cloud">{scores[r.id] ?? 0}</span>
              </li>
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
