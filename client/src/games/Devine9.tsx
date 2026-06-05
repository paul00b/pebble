import { motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { remaining, useClock } from "@/lib/useClock";
import type { Devine9Team, Devine9View, Player, RoomState } from "@shared";

const TEAM_HEX: Record<Devine9Team, string> = { red: "#fb7185", blue: "#7dd3fc" };
const other = (t: Devine9Team): Devine9Team => (t === "red" ? "blue" : "red");

type T = (k: string, p?: Record<string, string | number>) => string;

export function Devine9({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as Devine9View;
  const youId = useStore((s) => s.youId);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;
  const teamName = (team: Devine9Team) => t(team === "red" ? "d9.red" : "d9.blue");

  if (game.phase === "setup")
    return <Setup game={game} players={players} youId={youId} teamName={teamName} t={t} />;
  if (game.phase === "over")
    return <Results game={game} youId={youId} teamName={teamName} t={t} />;

  return <Round game={game} players={players} youId={youId} teamName={teamName} t={t} />;
}

/* ── Setup: pick a team ───────────────────────────────────────────────────── */
function Setup({
  game,
  players,
  youId,
  teamName,
  t,
}: {
  game: Devine9View;
  players: Record<string, Player>;
  youId: string | null;
  teamName: (team: Devine9Team) => string;
  t: T;
}) {
  const room = useStore((s) => s.room);
  const gameAction = useStore((s) => s.gameAction);
  const isHost = room?.hostId === youId;
  const ready = (["red", "blue"] as const).every((team) =>
    game.members.some((m) => m.team === team)
  );
  const roster = (team: Devine9Team) => game.members.filter((m) => m.team === team);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <h2 className="text-center font-display text-2xl text-cloud">{t("d9.chooseTeam")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["red", "blue"] as const).map((team) => (
          <GlassCard key={team} className="p-4" style={{ borderColor: `${TEAM_HEX[team]}55` }}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg font-semibold" style={{ color: TEAM_HEX[team] }}>
                {teamName(team)}
              </span>
              <Button
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                onClick={() => gameAction({ type: "setTeam", team })}
              >
                {t("d9.join", { team: teamName(team) })}
              </Button>
            </div>
            <div className="space-y-1.5">
              {roster(team).map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <span>{players[m.id]?.avatar}</span>
                  <span className="text-cloud">{players[m.id]?.name}</span>
                </div>
              ))}
              {roster(team).length === 0 && <div className="text-xs text-faint">—</div>}
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-auto">
        {isHost ? (
          <Button full disabled={!ready} onClick={() => gameAction({ type: "begin" })}>
            {ready ? t("d9.begin") : t("d9.needTeams")}
          </Button>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-3 text-center text-sm text-mist">
            {t("common.waitingHost")}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── A turn (play + reveal) ───────────────────────────────────────────────── */
function Round({
  game,
  players,
  youId,
  teamName,
  t,
}: {
  game: Devine9View;
  players: Record<string, Player>;
  youId: string | null;
  teamName: (team: Devine9Team) => string;
  t: T;
}) {
  const room = useStore((s) => s.room);
  const gameAction = useStore((s) => s.gameAction);
  const isHost = room?.hostId === youId;
  const clock = useClock();

  const checkTeam = other(game.activeTeam);
  const reveal = game.phase === "reveal";
  const points = game.found.filter(Boolean).length - (game.bombHit ? 5 : 0);
  const { seconds, fraction } = remaining(
    clock,
    game.deadline - game.turnSec * 1000,
    game.deadline
  );
  const showCard = game.prompt != null; // checker (play) or everyone (reveal)

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* scoreboard + turn */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 font-display text-xl tabular-nums">
          <span style={{ color: TEAM_HEX.red }}>{game.scores.red}</span>
          <span className="text-faint">·</span>
          <span style={{ color: TEAM_HEX.blue }}>{game.scores.blue}</span>
        </div>
        <div className="text-xs text-faint">
          {t("d9.turnOf", { n: game.turn, total: game.totalTurns })}
        </div>
      </div>

      {/* who's guessing */}
      <div className="text-center text-sm">
        <span style={{ color: TEAM_HEX[game.activeTeam] }} className="font-semibold">
          {teamName(game.activeTeam)}
        </span>{" "}
        <span className="text-mist">{t("d9.guesses")}</span>
        <span className="mx-1 text-faint">·</span>
        <span className="text-faint">{t("d9.holdsCard", { team: teamName(checkTeam) })}</span>
      </div>

      {/* timer (once started, until reveal) */}
      {game.started && !reveal && (
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${fraction * 100}%`,
                background: fraction < 0.25 ? "#fb7185" : "var(--color-accent)",
              }}
            />
          </div>
          <div className="text-center font-display text-sm tabular-nums text-mist">
            {Math.max(0, seconds).toFixed(0)}s · {game.foundCount}/9
          </div>
        </div>
      )}

      {/* ── checker's card / reveal card ── */}
      {showCard ? (
        <>
          <GlassCard strong className="p-4 text-center">
            <div className="text-xs uppercase tracking-[0.15em] text-faint">{t("d9.theme")}</div>
            <div className="mt-1 font-display text-xl font-semibold text-cloud">{game.prompt}</div>
          </GlassCard>

          {/* before the timer: read aloud + start (checker only) */}
          {!game.started && !reveal && game.youAreChecker && (
            <Button full onClick={() => gameAction({ type: "start" })}>
              {t("d9.startTimer")}
            </Button>
          )}
          {!game.started && !reveal && game.youAreChecker && (
            <p className="text-center text-xs text-faint">{t("d9.readAloud")}</p>
          )}

          {/* the 9 answers */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(game.answers ?? []).map((word, i) => {
              const found = game.found[i];
              const clickable = game.youAreChecker && game.started && !reveal;
              return (
                <motion.button
                  key={i}
                  disabled={!clickable}
                  onClick={() => clickable && gameAction({ type: "validate", index: i })}
                  whileTap={clickable ? { scale: 0.95 } : undefined}
                  className={`flex items-center justify-between gap-1 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    clickable ? "cursor-pointer" : ""
                  }`}
                  style={{
                    background: found ? "rgba(110,231,214,0.18)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${found ? "rgba(110,231,214,0.6)" : "rgba(255,255,255,0.1)"}`,
                    color: found ? "#6ee7d6" : reveal ? "var(--color-faint)" : "var(--color-cloud)",
                  }}
                >
                  <span className="truncate">{word}</span>
                  <span className="shrink-0">{found ? "✓" : ""}</span>
                </motion.button>
              );
            })}
          </div>

          {/* the bomb word */}
          {game.bomb != null && (
            <motion.button
              disabled={!(game.youAreChecker && game.started && !reveal)}
              onClick={() =>
                game.youAreChecker && game.started && !reveal && gameAction({ type: "bomb" })
              }
              whileTap={game.youAreChecker && game.started && !reveal ? { scale: 0.97 } : undefined}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{
                background: game.bombHit ? "rgba(251,113,133,0.22)" : "rgba(251,113,133,0.06)",
                border: `1px solid ${game.bombHit ? "#fb7185" : "rgba(251,113,133,0.4)"}`,
                color: "#fb7185",
              }}
            >
              💣 {game.bomb} {game.bombHit && <span className="tabular-nums">−5</span>}
            </motion.button>
          )}
        </>
      ) : (
        // Guessing team / spectators during play: no words, just the heat.
        <GlassCard strong className="grid flex-1 place-items-center p-8 text-center">
          <div>
            <div className="text-5xl">👂</div>
            <div className="mt-3 font-display text-lg text-cloud">
              {game.youTeam === game.activeTeam ? t("d9.yourTeamGuess") : t("d9.listen")}
            </div>
            <div className="mt-1 text-sm text-faint">
              {game.started ? t("d9.foundSoFar", { n: game.foundCount }) : t("d9.getReady")}
            </div>
          </div>
        </GlassCard>
      )}

      {/* reveal footer: points + advance */}
      {reveal && (
        <div className="mt-1 space-y-3">
          <div className="text-center font-display text-lg">
            <span style={{ color: TEAM_HEX[game.activeTeam] }}>{teamName(game.activeTeam)}</span>{" "}
            <span className="text-cloud">
              {t("d9.scored", { n: game.roundPoints ?? points })}
            </span>
            {game.bombHit && <span className="ml-2 text-sm text-rose-300">💣 −5</span>}
          </div>
          {isHost ? (
            <Button full onClick={() => gameAction({ type: "next" })}>
              {game.turn >= game.totalTurns ? t("d9.seeResults") : t("d9.nextTurn")}
            </Button>
          ) : (
            <div className="text-center text-sm text-mist">{t("common.waitingHost")}</div>
          )}
        </div>
      )}

      {/* tiny roster so you know who's where */}
      <div className="mt-auto flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-xs">
        {game.members.map((m) => (
          <span
            key={m.id}
            className="flex items-center gap-1"
            style={{ color: m.team ? TEAM_HEX[m.team] : "var(--color-faint)" }}
          >
            {players[m.id]?.avatar} {players[m.id]?.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */
function Results({
  game,
  youId,
  teamName,
  t,
}: {
  game: Devine9View;
  youId: string | null;
  teamName: (team: Devine9Team) => string;
  t: T;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const isHost = room?.hostId === youId;
  const youWon = game.winner !== "tie" && game.winner != null && game.youTeam === game.winner;

  return (
    <div className="grid flex-1 place-items-center">
      <Celebration auto={!!youWon} />
      <GlassCard
        strong
        className="w-full max-w-sm p-7 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-5xl">🏆</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">
          {game.winner === "tie"
            ? t("d9.tie")
            : t("d9.teamWins", { team: teamName(game.winner as Devine9Team) })}
        </div>
        <div className="mt-4 flex items-center justify-center gap-6 font-display text-3xl tabular-nums">
          <span style={{ color: TEAM_HEX.red }}>{game.scores.red}</span>
          <span className="text-faint text-xl">·</span>
          <span style={{ color: TEAM_HEX.blue }}>{game.scores.blue}</span>
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
