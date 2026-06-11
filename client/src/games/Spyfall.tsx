import { useState } from "react";
import { motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { remaining, useClock } from "@/lib/useClock";
import type { Player, RoomState, SpyfallView } from "@shared";

type T = (k: string, p?: Record<string, string | number>) => string;

export function Spyfall({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as SpyfallView;
  const youId = useStore((s) => s.youId);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;

  if (game.phase === "over") return <Results game={game} players={players} t={t} />;
  if (game.phase === "voting") return <Voting game={game} players={players} youId={youId} t={t} />;
  if (game.phase === "spyguess") return <SpyGuess game={game} players={players} t={t} />;

  return <Round game={game} players={players} youId={youId} t={t} />;
}

/* ── Timer bar ────────────────────────────────────────────────────────────── */
function TimerBar({ game }: { game: SpyfallView }) {
  const clock = useClock();
  const { seconds, fraction } = remaining(clock, game.deadline - game.duration, game.deadline);
  const mm = Math.floor(Math.max(0, seconds) / 60);
  const ss = Math.floor(Math.max(0, seconds) % 60);
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{
            width: `${fraction * 100}%`,
            background: fraction < 0.2 ? "#fb7185" : "var(--color-accent)",
          }}
        />
      </div>
      <div className="text-center font-display text-sm tabular-nums text-mist">
        {mm}:{ss.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

/* ── Your secret card (tap to peek, so shoulder-surfers see nothing) ──────── */
function SecretCard({ game, t }: { game: SpyfallView; t: T }) {
  const [shown, setShown] = useState(false);
  return (
    <motion.button
      onClick={() => setShown((v) => !v)}
      whileTap={{ scale: 0.98 }}
      className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/8"
    >
      {shown ? (
        game.youAreSpy ? (
          <div className="text-center">
            <div className="text-3xl">🕶️</div>
            <div className="mt-1 font-display text-xl font-semibold text-rose-300">
              {t("sf.youAreSpy")}
            </div>
            <div className="mt-1 text-xs text-mist">{t("sf.spyHint")}</div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.15em] text-faint">{t("sf.location")}</div>
            <div className="font-display text-xl font-semibold text-cloud">{game.location}</div>
            <div className="mt-1 text-sm text-accent">
              {t("sf.yourRole", { role: game.role ?? "" })}
            </div>
          </div>
        )
      ) : (
        <div className="py-2 text-center">
          <div className="text-2xl">🪪</div>
          <div className="mt-1 text-sm text-mist">{t("sf.tapToPeek")}</div>
        </div>
      )}
    </motion.button>
  );
}

/* ── The questioning round ────────────────────────────────────────────────── */
function Round({
  game,
  players,
  youId,
  t,
}: {
  game: SpyfallView;
  players: Record<string, Player>;
  youId: string | null;
  t: T;
}) {
  const room = useStore((s) => s.room);
  const gameAction = useStore((s) => s.gameAction);
  const isHost = room?.hostId === youId;
  const [guessing, setGuessing] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const youAsk = game.askerId === youId;
  const asker = players[game.askerId];

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      <TimerBar game={game} />

      {/* who's asking */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-mist">
          {youAsk ? t("sf.youAsk") : t("sf.asks", { name: asker?.name ?? "…" })}
        </span>
        {(youAsk || isHost) && (
          <button
            onClick={() => gameAction({ type: "nextAsker" })}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-cloud transition hover:bg-white/10 active:scale-95"
          >
            {t("sf.nextAsker")} →
          </button>
        )}
      </div>

      <SecretCard game={game} t={t} />

      {/* players, asker highlighted */}
      <div className="flex flex-wrap justify-center gap-2">
        {game.order.map((id) => {
          const p = players[id];
          if (!p) return null;
          const asking = id === game.askerId;
          return (
            <div
              key={id}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              style={{
                background: asking ? "rgba(110,231,214,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${asking ? "rgba(110,231,214,0.5)" : "rgba(255,255,255,0.1)"}`,
              }}
            >
              <span>{p.avatar}</span>
              <span className={asking ? "text-accent" : "text-mist"}>{p.name}</span>
              {asking && <span>🗣️</span>}
            </div>
          );
        })}
      </div>

      {/* every possible location - the common reference & the spy's menu */}
      <GlassCard className="p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-[0.15em] text-faint">
            {t("sf.allLocations")}
          </span>
          {game.youAreSpy && (
            <button
              onClick={() => {
                setGuessing((v) => !v);
                setPick(null);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${
                guessing ? "bg-rose-400/20 text-rose-300" : "bg-accent text-ink-900"
              }`}
            >
              {guessing ? t("common.cancel") : t("sf.guessBtn")}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {game.locations.map((loc, i) => (
            <button
              key={loc}
              disabled={!guessing}
              onClick={() => setPick(i)}
              className={`truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                pick === i
                  ? "bg-accent font-semibold text-ink-900"
                  : "bg-white/5 text-mist"
              } ${guessing ? "cursor-pointer hover:bg-white/10" : ""}`}
            >
              {loc}
            </button>
          ))}
        </div>
        {guessing && (
          <Button
            full
            className="mt-3"
            disabled={pick == null}
            onClick={() => pick != null && gameAction({ type: "spyGuess", index: pick })}
          >
            {t("sf.confirmGuess")}
          </Button>
        )}
        {game.youAreSpy && !guessing && (
          <p className="mt-2 text-center text-xs text-faint">{t("sf.guessWarning")}</p>
        )}
      </GlassCard>

      {/* call an emergency vote */}
      <div className="mt-auto">
        {game.canCallVote ? (
          <Button full variant="ghost" onClick={() => gameAction({ type: "callVote" })}>
            🚨 {t("sf.callVote")}
          </Button>
        ) : (
          <p className="text-center text-xs text-faint">{t("sf.voteUsed")}</p>
        )}
      </div>
    </div>
  );
}

/* ── The vote ─────────────────────────────────────────────────────────────── */
function Voting({
  game,
  players,
  youId,
  t,
}: {
  game: SpyfallView;
  players: Record<string, Player>;
  youId: string | null;
  t: T;
}) {
  const gameAction = useStore((s) => s.gameAction);
  const caller = game.calledBy ? players[game.calledBy] : null;

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      <TimerBar game={game} />
      <div className="text-center">
        <div className="font-display text-2xl font-semibold text-cloud">🚨 {t("sf.voteTitle")}</div>
        <div className="mt-1 text-sm text-mist">
          {caller ? t("sf.calledBy", { name: caller.name }) : t("sf.timeUp")}
        </div>
        <div className="mt-1 text-xs text-faint">
          {t("sf.votedCount", { n: game.voted.length, total: game.order.length })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {game.order.map((id) => {
          const p = players[id];
          if (!p || id === youId) return null;
          const mine = game.youVote === id;
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.97 }}
              onClick={() => gameAction({ type: "vote", playerId: id })}
              className="flex items-center gap-3 rounded-2xl p-3 text-left transition"
              style={{
                background: mine ? "rgba(251,113,133,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${mine ? "#fb7185" : "rgba(255,255,255,0.1)"}`,
              }}
            >
              <Avatar emoji={p.avatar} color={p.color} size={36} />
              <span className="flex-1 truncate text-sm font-medium text-cloud">{p.name}</span>
              {game.voted.includes(id) && <span className="text-xs text-faint">🗳️</span>}
              {mine && <span className="text-rose-300">👈</span>}
            </motion.button>
          );
        })}
      </div>

      <p className="text-center text-xs text-faint">
        {game.youVote ? t("sf.voteLocked") : t("sf.votePrompt")}
      </p>
    </div>
  );
}

/* ── The caught spy's last-chance guess ───────────────────────────────────── */
function SpyGuess({
  game,
  players,
  t,
}: {
  game: SpyfallView;
  players: Record<string, Player>;
  t: T;
}) {
  const gameAction = useStore((s) => s.gameAction);
  const [pick, setPick] = useState<number | null>(null);
  const spy = game.spyId ? players[game.spyId] : null;

  if (!game.youAreSpy) {
    return (
      <div className="flex flex-1 flex-col gap-3 pb-6">
        <TimerBar game={game} />
        <GlassCard strong className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <div className="text-5xl">🕶️</div>
            <div className="mt-3 font-display text-xl text-cloud">
              {t("sf.spyCaught", { name: spy?.name ?? "?" })}
            </div>
            <div className="mt-1 text-sm text-mist">{t("sf.stealWatch")}</div>
          </div>
        </GlassCard>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      <TimerBar game={game} />
      <div className="text-center">
        <div className="font-display text-xl font-semibold text-rose-300">{t("sf.caughtYou")}</div>
        <div className="mt-1 text-sm text-mist">{t("sf.stealPrompt")}</div>
      </div>
      <GlassCard className="p-4">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {game.locations.map((loc, i) => (
            <button
              key={loc}
              onClick={() => setPick(i)}
              className={`truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-white/10 ${
                pick === i ? "bg-accent font-semibold text-ink-900" : "bg-white/5 text-mist"
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
        <Button
          full
          className="mt-3"
          disabled={pick == null}
          onClick={() => pick != null && gameAction({ type: "spyGuess", index: pick })}
        >
          {t("sf.confirmGuess")}
        </Button>
      </GlassCard>
    </div>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */
function Results({
  game,
  players,
  t,
}: {
  game: SpyfallView;
  players: Record<string, Player>;
  t: T;
}) {
  const room = useStore((s) => s.room);
  const youId = useStore((s) => s.youId);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const isHost = room?.hostId === youId;
  const spy = game.spyId ? players[game.spyId] : null;
  const spyWon = game.winner === "spy";
  const youWon = game.youAreSpy ? spyWon : !spyWon;

  return (
    <div className="grid flex-1 place-items-center">
      <Celebration auto={youWon} />
      <GlassCard
        strong
        className="w-full max-w-sm p-7 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-5xl">{spyWon ? "🕶️" : "🎉"}</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">
          {spyWon ? t("sf.spyWins") : t("sf.crewWins")}
        </div>
        <div className="mt-1 text-sm text-mist">{t(`sf.reason.${game.reason ?? "escaped"}`)}</div>

        <div className="mt-4 space-y-2 rounded-2xl bg-white/5 p-4 text-sm">
          <div className="flex items-center justify-center gap-2">
            <span className="text-faint">{t("sf.theSpyWas")}</span>
            <span className="font-semibold text-rose-300">
              {spy ? `${spy.avatar} ${spy.name}` : "?"}
            </span>
          </div>
          <div>
            <span className="text-faint">{t("sf.location")} : </span>
            <span className="font-semibold text-accent">{game.location}</span>
          </div>
          {game.spyGuess && (
            <div>
              <span className="text-faint">{t("sf.spyGuessed")} : </span>
              <span className={game.spyGuess === game.location ? "text-accent" : "text-rose-300"}>
                {game.spyGuess}
              </span>
            </div>
          )}
        </div>

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
