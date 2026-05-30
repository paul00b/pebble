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

function CardCell({
  cell,
  onClick,
  clickable,
  big,
}: {
  cell: SkyjoCell;
  onClick?: () => void;
  clickable?: boolean;
  big?: boolean;
}) {
  const dim = big ? "h-12 w-9 text-lg" : "h-8 w-6 text-xs";
  if (cell === null) return <div className={`${dim} rounded-md`} />; // cleared
  const faceUp = cell.up && cell.value != null;
  const color = faceUp ? valueColor(cell.value!) : "#3a4a52";
  return (
    <motion.button
      layout
      disabled={!clickable}
      onClick={onClick}
      whileHover={clickable ? { scale: 1.08 } : undefined}
      whileTap={clickable ? { scale: 0.94 } : undefined}
      className={`grid ${dim} place-items-center rounded-md font-display font-semibold ${
        clickable ? "cursor-pointer ring-2 ring-accent/70" : ""
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
  big,
  cellClickable,
  onCell,
}: {
  cells: SkyjoCell[];
  big?: boolean;
  cellClickable?: (i: number) => boolean;
  onCell?: (i: number) => void;
}) {
  return (
    <div className={`grid grid-cols-4 ${big ? "gap-1.5" : "gap-1"}`}>
      {cells.map((c, i) => (
        <CardCell
          key={i}
          cell={c}
          big={big}
          clickable={cellClickable?.(i)}
          onClick={() => onCell?.(i)}
        />
      ))}
    </div>
  );
}

export function Skyjo({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as SkyjoView;
  const youId = useStore((s) => s.youId);
  const gameAction = useStore((s) => s.gameAction);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;

  // Local interaction mode layered on top of the server stage.
  const [mode, setMode] = useState<"idle" | "takeDiscard" | "flipAfterDiscard">("idle");
  useEffect(() => setMode("idle"), [game.stage, game.currentId]);

  const myTurn = game.currentId === youId && game.phase === "turn";
  const me = game.players.find((p) => p.id === youId);

  if (game.phase === "done") return <SkyjoResults game={game} players={players} youId={youId} t={t} />;

  /* cell-click handler depending on phase/stage/mode */
  const cellClickableForMe = (i: number): boolean => {
    if (!me || me.grid[i] === null) return false;
    if (game.phase === "flip2") return !me.grid[i]!.up; // flip a face-down
    if (!myTurn) return false;
    if (game.stage === "await") return mode === "takeDiscard";
    if (game.stage === "resolveDraw")
      return mode === "flipAfterDiscard" ? !me.grid[i]!.up : true; // keepReplace anywhere
    return false;
  };

  const onMyCell = (i: number) => {
    if (game.phase === "flip2") return gameAction({ type: "flip", index: i });
    if (game.stage === "await" && mode === "takeDiscard")
      return gameAction({ type: "takeDiscard", index: i });
    if (game.stage === "resolveDraw") {
      if (mode === "flipAfterDiscard") return gameAction({ type: "discardFlip", index: i });
      return gameAction({ type: "keepReplace", index: i });
    }
  };

  const flippedCount = me ? me.grid.filter((c) => c && c.up).length : 0;

  const status =
    game.phase === "flip2"
      ? t("sk.flipTwo", { n: Math.min(2, flippedCount) })
      : myTurn
        ? t("sk.yourTurn")
        : t("sk.waitingTurn", { name: players[game.currentId]?.name ?? "…" });

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* deck / discard / held + status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="grid h-12 w-9 place-items-center rounded-md border border-white/15 bg-white/5 text-xs text-faint">
              {game.deckCount}
            </div>
            <div className="mt-0.5 text-[0.6rem] text-faint">{t("sk.deck")}</div>
          </div>
          <div className="text-center">
            {game.discardTop != null ? (
              <CardCell cell={{ up: true, value: game.discardTop }} big />
            ) : (
              <div className="h-12 w-9 rounded-md border border-dashed border-white/15" />
            )}
            <div className="mt-0.5 text-[0.6rem] text-faint">{t("sk.discard")}</div>
          </div>
          {game.held != null && (
            <div className="text-center">
              <CardCell cell={{ up: true, value: game.held }} big />
              <div className="mt-0.5 text-[0.6rem] text-accent">✋</div>
            </div>
          )}
        </div>
        <div className="text-right text-sm font-medium text-mist">{status}</div>
      </div>

      {/* my turn controls */}
      {myTurn && game.stage === "await" && (
        <div className="flex gap-2">
          <Button onClick={() => gameAction({ type: "drawDeck" })} className="px-4 py-2 text-sm">
            {t("sk.draw")}
          </Button>
          <Button
            variant="ghost"
            disabled={game.discardTop == null}
            onClick={() => setMode("takeDiscard")}
            className="px-4 py-2 text-sm"
          >
            {t("sk.takeDiscard")}
          </Button>
          {mode === "takeDiscard" && (
            <span className="self-center text-xs text-accent">{t("sk.tapToReplace")}</span>
          )}
        </div>
      )}
      {myTurn && game.stage === "resolveDraw" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-accent">
            {mode === "flipAfterDiscard" ? t("sk.tapToFlip") : t("sk.tapToSwap")}
          </span>
          {mode !== "flipAfterDiscard" && (
            <Button
              variant="ghost"
              onClick={() => setMode("flipAfterDiscard")}
              className="px-3 py-1.5 text-xs"
            >
              {t("sk.discardAndFlip")}
            </Button>
          )}
        </div>
      )}

      {/* my grid (big) */}
      {me && (
        <GlassCard strong className="self-center p-3">
          <PlayerGrid cells={me.grid} big cellClickable={cellClickableForMe} onCell={onMyCell} />
        </GlassCard>
      )}

      {/* other players */}
      <div className="flex flex-wrap justify-center gap-3">
        {game.players
          .filter((p) => p.id !== youId)
          .map((p) => {
            const info = players[p.id];
            const current = p.id === game.currentId;
            return (
              <div
                key={p.id}
                className={`rounded-2xl p-2 ${current ? "glass-strong ring-1 ring-accent/50" : "glass"}`}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  {info && <Avatar emoji={info.avatar} color={info.color} size={20} />}
                  <span className="text-xs text-cloud">{info?.name}</span>
                  <span className="ml-auto text-xs text-faint">{p.score}</span>
                </div>
                <PlayerGrid cells={p.grid} />
              </div>
            );
          })}
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
