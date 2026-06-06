import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { DrawBoard } from "@/components/DrawBoard";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { remaining, useClock } from "@/lib/useClock";
import type { GarticView, Player, RoomState } from "@shared";

export function Gartic({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as GarticView;
  const youId = useStore((s) => s.youId);
  const gameAction = useStore((s) => s.gameAction);

  const players = useMemo(
    () => Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>,
    [room.players]
  );

  const clock = useClock();
  const { seconds, fraction } = remaining(clock, game.deadline - game.duration, game.deadline);

  const [guess, setGuess] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Reset the guess field as rounds turn over.
  useEffect(() => setGuess(""), [game.round]);
  // Keep the guess feed pinned to the latest message.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [game.messages.length]);

  if (game.phase === "done")
    return <GarticResults game={game} players={players} youId={youId} t={t} />;

  const drawerName = players[game.drawerId]?.name ?? "…";
  const choosing = game.phase === "choosing";
  const timed = choosing || game.phase === "drawing";
  const canGuess = game.phase === "drawing" && !game.youAreDrawer && !game.youGuessed;

  const submit = () => {
    const text = guess.trim();
    if (!text) return;
    gameAction({ type: "guess", text });
    setGuess("");
  };

  const isHost = room.hostId === youId;
  const lastRound = game.round >= game.totalRounds;

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6 lg:flex-row">
      {/* Stage: word, timer, canvas */}
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-faint">
            {t("ga.round", { round: game.round, total: game.totalRounds })}
          </span>
          <div className="text-center">
            <div className="font-display text-2xl font-bold tracking-[0.3em] text-cloud">
              {choosing
                ? game.youAreDrawer
                  ? t("ga.youChoose")
                  : "✏️"
                : game.word}
            </div>
            <div className="text-[0.65rem] text-faint">
              {choosing
                ? game.youAreDrawer
                  ? t("ga.youChooseSub")
                  : t("ga.choosing", { name: drawerName })
                : game.youAreDrawer
                  ? t("ga.youDraw")
                  : t("ga.drawing", { name: drawerName })}
            </div>
          </div>
          {timed ? (
            <span
              className="font-display text-lg tabular-nums"
              style={{ color: fraction > 0.5 ? "#6ee7d6" : fraction > 0.22 ? "#fbbf72" : "#fb7185" }}
            >
              {Math.max(0, seconds).toFixed(0)}s
            </span>
          ) : (
            <span className="w-8" />
          )}
        </div>

        {/* timer bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${(timed ? fraction : 0) * 100}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
            style={{
              background: fraction > 0.5 ? "#6ee7d6" : fraction > 0.22 ? "#fbbf72" : "#fb7185",
            }}
          />
        </div>

        {choosing ? (
          <WordChoice
            game={game}
            drawerName={drawerName}
            t={t}
            onChoose={(index) => gameAction({ type: "choose", index })}
          />
        ) : (
          <DrawBoard key={game.round} channel="draw" canDraw={game.youAreDrawer} />
        )}

        {/* reveal banner / host controls */}
        <AnimatePresence>
          {game.phase === "reveal" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 rounded-2xl glass-strong p-3 text-center"
            >
              <div className="text-sm text-mist">
                {t("ga.theWordWas")}{" "}
                <span className="font-display text-lg font-semibold text-accent">{game.word}</span>
              </div>
              {isHost ? (
                <Button onClick={() => gameAction({ type: "next" })} className="px-5 py-2 text-sm">
                  {lastRound ? t("ga.seeResults") : t("ga.next")}
                </Button>
              ) : (
                <div className="text-xs text-faint">{t("common.waitingHost")}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar: scores + guess feed + input */}
      <div className="flex w-full flex-col gap-3 lg:w-72">
        <GlassCard className="p-3">
          <ul className="flex flex-col gap-1.5">
            {[...game.players]
              .sort((a, b) => b.score - a.score)
              .map((p) => {
                const info = players[p.id];
                const isDrawer = p.id === game.drawerId;
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    {info && <Avatar emoji={info.avatar} color={info.color} size={24} />}
                    <span
                      className={`flex-1 truncate text-sm ${
                        p.id === youId ? "text-accent" : "text-cloud"
                      }`}
                    >
                      {info?.name ?? "—"}
                    </span>
                    {isDrawer && <span title="drawing">✏️</span>}
                    {p.guessed && !isDrawer && <span>✅</span>}
                    <span className="w-8 text-right font-display tabular-nums text-cloud">
                      {p.score}
                    </span>
                  </li>
                );
              })}
          </ul>
        </GlassCard>

        <GlassCard className="flex min-h-0 flex-1 flex-col p-2">
          <div ref={feedRef} className="flex max-h-48 flex-1 flex-col gap-1 overflow-y-auto px-1 py-1 lg:max-h-none">
            {game.messages.map((m) => {
              const name = players[m.playerId]?.name ?? "?";
              return m.correct ? (
                <div key={m.id} className="text-sm text-emerald-300">
                  <span className="font-medium">{name}</span> {t("ga.guessedIt")}
                </div>
              ) : (
                <div key={m.id} className="text-sm text-mist">
                  <span className="font-medium text-cloud">{name}:</span> {m.text}
                </div>
              );
            })}
          </div>
          {game.phase === "drawing" && (
            <div className="mt-1">
              {game.youAreDrawer ? (
                <div className="px-1 py-2 text-center text-xs text-faint">{t("ga.youDraw")}</div>
              ) : game.youGuessed ? (
                <div className="px-1 py-2 text-center text-sm text-emerald-300">
                  {t("ga.youGuessed")}
                </div>
              ) : (
                <input
                  ref={inputRef}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  disabled={!canGuess}
                  placeholder={t("ga.guessPh")}
                  autoComplete="off"
                  className="w-full rounded-xl border border-accent/40 bg-white/10 px-3 py-2 text-sm text-cloud outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

const DIFF_STYLE: Record<string, { ring: string; text: string; bg: string }> = {
  easy: { ring: "#34d399", text: "#6ee7b7", bg: "rgba(52,211,153,0.12)" },
  medium: { ring: "#fbbf72", text: "#fcd9a8", bg: "rgba(251,191,114,0.12)" },
  hard: { ring: "#f472b6", text: "#f9a8d4", bg: "rgba(244,114,182,0.12)" },
};

/** The drawer's two-word picker (and a waiting card for everyone else). */
function WordChoice({
  game,
  drawerName,
  t,
  onChoose,
}: {
  game: GarticView;
  drawerName: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onChoose: (index: number) => void;
}) {
  if (!game.youAreDrawer) {
    return (
      <div className="grid flex-1 place-items-center rounded-2xl glass p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            className="text-4xl"
            animate={{ rotate: [-8, 8, -8] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          >
            🖍️
          </motion.div>
          <div className="text-sm text-mist">{t("ga.choosing", { name: drawerName })}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid flex-1 place-items-center rounded-2xl glass p-5">
      <div className="w-full max-w-md">
        <div className="mb-3 text-center text-sm font-medium text-cloud">{t("ga.youChooseSub")}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {game.choices.map((c, i) => {
            const d = DIFF_STYLE[c.difficulty] ?? DIFF_STYLE.medium;
            return (
              <motion.button
                key={i}
                onClick={() => onChoose(i)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex flex-col items-center gap-2 rounded-2xl border p-5 text-center"
                style={{ borderColor: d.ring, background: d.bg }}
              >
                <span
                  className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide"
                  style={{ color: d.text, border: `1px solid ${d.ring}` }}
                >
                  {t(`ga.diff.${c.difficulty}`)}
                </span>
                <span className="font-display text-xl font-bold leading-tight text-cloud">
                  {c.word}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GarticResults({
  game,
  players,
  youId,
  t,
}: {
  game: GarticView;
  players: Record<string, Player>;
  youId: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const isHost = room?.hostId === youId;
  const rows = [...game.players].sort((a, b) => b.score - a.score);

  return (
    <div className="grid flex-1 place-items-center">
      <Celebration auto={game.winnerId === youId} />
      <GlassCard
        strong
        className="w-full max-w-sm p-7 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-5xl">🏆</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">
          {t("ga.finalScores")}
        </div>
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
                <span
                  className={`flex-1 truncate text-sm ${
                    r.id === youId ? "text-accent" : "text-cloud"
                  }`}
                >
                  {p?.name ?? "—"}
                </span>
                <span className="font-display text-lg tabular-nums text-cloud">{r.score}</span>
              </li>
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
