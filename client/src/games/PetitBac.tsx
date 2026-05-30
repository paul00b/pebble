import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Confetti } from "@/components/Confetti";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { useClock } from "@/lib/useClock";
import type { PetitBacView, Player, RoomState } from "@shared";

const WRITE_MS = 100_000;

export function PetitBac({ room }: { room: RoomState }) {
  const game = room.game as PetitBacView;
  const youId = useStore((s) => s.youId);
  const players = useMemo(
    () => Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>,
    [room.players]
  );

  if (game.stage === "done") return <FinalScores game={game} players={players} youId={youId} />;
  if (game.stage === "reveal") return <Reveal game={game} players={players} youId={youId} />;
  return <Writing game={game} />;
}

/* ── Writing phase ─────────────────────────────────────────────────────────── */
function Writing({ game }: { game: PetitBacView }) {
  const t = useT();
  const gameAction = useStore((s) => s.gameAction);
  const [answers, setAnswers] = useState<string[]>(() => game.categories.map(() => ""));
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    setAnswers(game.categories.map(() => ""));
    setStopped(false);
  }, [game.round, game.letter, game.categories]);

  const clock = useClock(250);
  const secondsLeft = Math.max(0, (game.deadline - clock) / 1000);
  const frac = Math.min(1, secondsLeft / (WRITE_MS / 1000));

  const set = (i: number, v: string) =>
    setAnswers((a) => a.map((x, idx) => (idx === i ? v : x)));

  const filled = answers.filter((a) => a.trim()).length;

  const stop = () => {
    setStopped(true);
    gameAction({ type: "submit", answers });
    gameAction({ type: "stop" });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(180deg,#9af3e4,#4fd6c0)] font-display text-4xl font-bold text-ink-900"
          >
            {game.letter}
          </motion.div>
          <div>
            <div className="font-display text-xl text-cloud">
              {t("pb.wordsIn", { letter: game.letter })}
            </div>
            <div className="text-xs text-faint">
              {t("pb.roundInfo", {
                round: game.round,
                total: game.totalRounds,
                done: game.finishedCount,
                players: game.totalPlayers,
              })}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl tabular-nums text-cloud">
            {Math.ceil(secondsLeft)}s
          </div>
        </div>
      </div>

      {/* time bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{
            width: `${frac * 100}%`,
            background: frac > 0.3 ? "var(--color-accent)" : "#fb7185",
          }}
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {game.categories.map((cat, i) => {
          const valid = answers[i].trim() &&
            answers[i].trim().toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")
              .startsWith(game.letter.toLowerCase());
          return (
            <label key={cat} className="glass flex items-center gap-3 rounded-2xl px-3 py-2.5">
              <span className="w-28 shrink-0 text-sm text-mist">{cat}</span>
              <input
                value={answers[i]}
                disabled={stopped}
                onChange={(e) => set(i, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && stop()}
                placeholder={`${game.letter}…`}
                autoComplete="off"
                className="w-full bg-transparent text-cloud outline-none placeholder:text-faint disabled:opacity-50"
              />
              {answers[i].trim() && (
                <span className={valid ? "text-accent" : "text-rose-300"}>
                  {valid ? "✓" : "✗"}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-3">
        <Button full onClick={stop} disabled={stopped} variant={stopped ? "ghost" : "primary"}>
          {stopped
            ? t("pb.locked")
            : t("pb.stop", { filled, total: game.categories.length })}
        </Button>
      </div>
    </div>
  );
}

/* ── Reveal phase ──────────────────────────────────────────────────────────── */
function Reveal({
  game,
  players,
  youId,
}: {
  game: PetitBacView;
  players: Record<string, Player>;
  youId: string | null;
}) {
  const t = useT();
  const room = useStore((s) => s.room);
  const gameAction = useStore((s) => s.gameAction);
  const isHost = room?.hostId === youId;
  const last = game.round >= game.totalRounds;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <div className="flex items-center justify-between">
        <div className="font-display text-2xl text-cloud">
          {t("pb.results", { letter: game.letter })}
        </div>
        <div className="text-sm text-faint">
          {t("pb.round", { round: game.round, total: game.totalRounds })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {game.categories.map((cat, c) => (
          <GlassCard key={cat} className="p-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-faint">{cat}</div>
            <div className="flex flex-col gap-1.5">
              {(game.reveal?.[c] ?? []).map((cell) => {
                const p = players[cell.playerId];
                return (
                  <div key={cell.playerId} className="flex items-center gap-2 text-sm">
                    <span>{p?.avatar ?? "👤"}</span>
                    <span className="w-20 shrink-0 truncate text-mist">{p?.name}</span>
                    <span
                      className={
                        cell.valid
                          ? cell.unique
                            ? "text-cloud"
                            : "text-mist"
                          : "text-faint line-through"
                      }
                    >
                      {cell.answer || "—"}
                    </span>
                    <span
                      className="ml-auto rounded-md px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        background:
                          cell.points === 2
                            ? "rgba(110,231,214,0.22)"
                            : cell.points === 1
                              ? "rgba(255,255,255,0.1)"
                              : "transparent",
                        color: cell.points === 2 ? "#6ee7d6" : "var(--color-mist)",
                      }}
                    >
                      +{cell.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </div>

      <Scoreboard game={game} players={players} youId={youId} compact />

      {isHost ? (
        <Button full onClick={() => gameAction({ type: "next" })}>
          {last ? t("pb.finalResults") : t("pb.nextRound")}
        </Button>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-3 text-center text-sm text-mist">
          {t("pb.waitingContinue")}
        </div>
      )}
    </div>
  );
}

/* ── Final scoreboard ──────────────────────────────────────────────────────── */
function FinalScores({
  game,
  players,
  youId,
}: {
  game: PetitBacView;
  players: Record<string, Player>;
  youId: string | null;
}) {
  const t = useT();
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const isHost = room?.hostId === youId;

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
          {t("pb.finalScores")}
        </div>
        <div className="mt-4">
          <Scoreboard game={game} players={players} youId={youId} />
        </div>
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

function Scoreboard({
  game,
  players,
  youId,
  compact,
}: {
  game: PetitBacView;
  players: Record<string, Player>;
  youId: string | null;
  compact?: boolean;
}) {
  const rows = Object.entries(game.scores)
    .map(([id, total]) => ({ id, total, round: game.roundScores?.[id] ?? 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <ul className={`flex flex-col gap-1.5 ${compact ? "" : "text-left"}`}>
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
            {compact && r.round > 0 && (
              <span className="text-xs text-faint">+{r.round}</span>
            )}
            <span className="font-display text-lg tabular-nums text-cloud">{r.total}</span>
          </li>
        );
      })}
    </ul>
  );
}
