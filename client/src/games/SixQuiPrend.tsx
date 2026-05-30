import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Confetti } from "@/components/Confetti";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { bullHeads, type Player, type RoomState, type SixQuiPrendView } from "@shared";

/** Bull-count → card accent. More bulls = hotter. */
function bullColor(b: number): string {
  if (b >= 5) return "#fb7185";
  if (b === 3) return "#fb923c";
  if (b === 2) return "#fbbf72";
  return "#9fb2b6";
}

function Card({
  value,
  size = "md",
  dim,
}: {
  value: number;
  size?: "sm" | "md";
  dim?: boolean;
}) {
  const b = bullHeads(value);
  const color = bullColor(b);
  const dims = size === "sm" ? "h-12 w-9 text-base" : "h-16 w-12 text-xl";
  return (
    <div
      className={`relative grid ${dims} shrink-0 place-items-center rounded-xl font-display font-semibold text-cloud`}
      style={{
        background: `linear-gradient(160deg, ${color}33, ${color}14)`,
        border: `1px solid ${color}66`,
        opacity: dim ? 0.4 : 1,
      }}
    >
      {value}
      <span className="absolute -top-1.5 -right-1.5 rounded-full bg-ink-800 px-1 text-[0.6rem]" style={{ color }}>
        {b}🐂
      </span>
    </div>
  );
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

  if (game.over) return <SixResults game={game} players={players} youId={youId} t={t} />;

  const myTakeRow = game.phase === "takeRow" && game.pendingPlayerId === youId;
  const otherTakeRow = game.phase === "takeRow" && game.pendingPlayerId !== youId;
  const pendingName = players[game.pendingPlayerId ?? ""]?.name ?? "…";

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      {/* status line */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-faint">{t("sixqp.round", { round: game.turn })} / {game.totalTurns}</div>
        <div className="text-sm font-medium" style={{ color: myTakeRow ? "#fb7185" : "var(--color-mist)" }}>
          {myTakeRow
            ? t("sixqp.chooseRow")
            : otherTakeRow
              ? t("sixqp.waitingChooseRow", { name: pendingName })
              : game.youChose
                ? t("sixqp.locked")
                : t("sixqp.chooseCard")}
        </div>
      </div>

      {/* four rows */}
      <div className="flex flex-col gap-2">
        {game.rows.map((row, i) => (
          <motion.button
            key={i}
            disabled={!myTakeRow}
            onClick={() => myTakeRow && gameAction({ type: "takeRow", rowIndex: i })}
            whileHover={myTakeRow ? { scale: 1.01 } : undefined}
            className={`flex items-center gap-2 rounded-2xl border p-2 transition ${
              myTakeRow
                ? "cursor-pointer border-accent/50 bg-accent/5 hover:bg-accent/10"
                : "border-white/8 bg-white/5"
            }`}
          >
            <AnimatePresence initial={false}>
              {row.map((c) => (
                <motion.div key={c} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <Card value={c} size="sm" />
                </motion.div>
              ))}
            </AnimatePresence>
            {/* empty slots up to 5 */}
            {Array.from({ length: 5 - row.length }).map((_, k) => (
              <div key={`e${k}`} className="h-12 w-9 shrink-0 rounded-xl border border-dashed border-white/10" />
            ))}
            <span className="ml-auto pr-1 text-xs text-faint">{row.length}/5</span>
          </motion.button>
        ))}
      </div>

      {/* last turn summary */}
      {game.lastTurn && game.lastTurn.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs">
          {game.lastTurn.map((e, idx) => (
            <span key={idx} className="flex items-center gap-1">
              <span>{players[e.playerId]?.avatar}</span>
              <span className="text-mist">{e.card}</span>
              {e.tookRow && <span className="text-rose-300">+{e.gained}🐂</span>}
            </span>
          ))}
        </div>
      )}

      {/* players */}
      <div className="flex flex-wrap gap-2">
        {game.players.map((p) => {
          const info = players[p.id];
          return (
            <div key={p.id} className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5">
              {info && <Avatar emoji={info.avatar} color={info.color} size={26} />}
              <span className="text-xs text-cloud">{info?.name}</span>
              <span className="text-xs text-faint">{p.bulls}🐂</span>
              {p.hasChosen && game.phase === "choosing" && <span className="text-accent">✓</span>}
            </div>
          );
        })}
      </div>

      {/* my hand */}
      <div className="mt-auto">
        <div className="mb-1.5 text-xs uppercase tracking-wider text-faint">{t("sixqp.yourHand")}</div>
        <div className="flex flex-wrap gap-2">
          {game.hand.map((c) => {
            const selectable = game.phase === "choosing" && !game.youChose;
            return (
              <motion.button
                key={c}
                disabled={!selectable}
                onClick={() => selectable && gameAction({ type: "choose", card: c })}
                whileHover={selectable ? { y: -6 } : undefined}
                whileTap={selectable ? { scale: 0.95 } : undefined}
                className={selectable ? "cursor-pointer" : "cursor-default"}
              >
                <Card value={c} dim={game.youChose} />
              </motion.button>
            );
          })}
          {game.hand.length === 0 && <span className="text-sm text-faint">—</span>}
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

  return (
    <div className="grid flex-1 place-items-center">
      <Confetti />
      <GlassCard
        strong
        className="w-full max-w-sm p-7 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-5xl">🏆</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">
          {t("sixqp.finalScores")}
        </div>
        <div className="mt-1 text-xs text-faint">{t("sixqp.lowestWins")}</div>
        <ul className="mt-4 flex flex-col gap-1.5 text-left">
          {rows.map((r, i) => {
            const p = players[r.id];
            return (
              <li
                key={r.id}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  i === 0 ? "bg-accent/15" : "bg-white/5"
                }`}
              >
                <span className="w-5 text-center text-sm text-faint">{i + 1}</span>
                {p && <Avatar emoji={p.avatar} color={p.color} size={28} />}
                <span className={`flex-1 truncate text-sm ${r.id === youId ? "text-accent" : "text-cloud"}`}>
                  {p?.name ?? "—"}
                </span>
                <span className="font-display text-lg tabular-nums text-cloud">{r.bulls}🐂</span>
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
