import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { DrawBoard } from "@/components/DrawBoard";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import type {
  CodenamesCardColor,
  CodenamesTeam,
  CodenamesView,
  Player,
  RoomState,
} from "@shared";

const TEAM_HEX: Record<CodenamesTeam, string> = { red: "#fb7185", blue: "#7dd3fc" };
const otherTeam = (team: CodenamesTeam): CodenamesTeam => (team === "red" ? "blue" : "red");

function colorStyle(color: CodenamesCardColor): CSSProperties {
  switch (color) {
    case "red":
      return { background: "rgba(251,113,133,0.85)", color: "#1a0a0d" };
    case "blue":
      return { background: "rgba(125,211,252,0.85)", color: "#08151c" };
    case "neutral":
      return { background: "rgba(214,200,168,0.8)", color: "#241f12" };
    case "assassin":
      return { background: "#0c0c0f", color: "#fff", border: "1px solid #444" };
  }
}

export function Codenames({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as CodenamesView;
  const youId = useStore((s) => s.youId);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;
  const teamName = (team: CodenamesTeam) => t(team === "red" ? "cn.red" : "cn.blue");

  return (
    <>
      {game.phase === "setup" ? (
        <Setup game={game} players={players} youId={youId} teamName={teamName} t={t} />
      ) : (
        <Board game={game} players={players} youId={youId} teamName={teamName} t={t} />
      )}
      {/* Floating waiting-room whiteboard — the team that isn't playing can doodle. */}
      <WhiteboardDock game={game} teamName={teamName} t={t} />
    </>
  );
}

/* ── Floating waiting-room whiteboard ────────────────────────────────────────
 * A collapsible drawing surface (same tools as Gartic) for whoever is waiting.
 * Only the team that isn't taking its turn can draw; everyone sees the strokes,
 * which persist across turns. Purely a way to pass the time — no game rules. */
function WhiteboardDock({
  game,
  teamName,
  t,
}: {
  game: CodenamesView;
  teamName: (team: CodenamesTeam) => string;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(false);
  if (game.phase === "over") return null;

  // Mirror the server's rule (see codenames.ts `mayDraw`).
  const canDraw =
    game.youTeam != null && (game.phase === "setup" || game.youTeam !== game.turnTeam);
  // Whose turn it is to draw = the team that isn't playing.
  const drawingTeam = game.phase === "setup" ? null : otherTeam(game.turnTeam);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="glass-strong w-[min(92vw,26rem)] rounded-2xl p-3 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.7)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-sm font-semibold text-cloud">
                  🎨 {t("cn.wb")}
                </div>
                <div className="truncate text-[0.7rem] text-faint">
                  {canDraw
                    ? t("cn.wbDraw")
                    : drawingTeam
                      ? t("cn.wbWaiting", { team: teamName(drawingTeam) })
                      : t("cn.wbWatch")}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("cn.wbClose")}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-cloud transition hover:bg-white/10"
              >
                ✕
              </button>
            </div>
            <DrawBoard channel="draw" canDraw={canDraw} wrapClassName="w-full" />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-2 rounded-full glass-strong px-4 py-2.5 text-sm font-medium text-cloud shadow-lg transition hover:bg-white/10 active:scale-95"
      >
        🎨 <span className="hidden sm:inline">{t("cn.wb")}</span>
        {/* gentle nudge when it's your team's turn to doodle */}
        {!open && canDraw && (
          <motion.span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          />
        )}
      </button>
    </div>
  );
}

/* ── Setup ─────────────────────────────────────────────────────────────────── */
function Setup({
  game,
  players,
  youId,
  teamName,
  t,
}: {
  game: CodenamesView;
  players: Record<string, Player>;
  youId: string | null;
  teamName: (team: CodenamesTeam) => string;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const gameAction = useStore((s) => s.gameAction);
  const isHost = room?.hostId === youId;
  const me = game.members.find((m) => m.id === youId);

  const ready = (["red", "blue"] as const).every(
    (team) =>
      game.members.some((m) => m.team === team && m.role === "spymaster") &&
      game.members.some((m) => m.team === team && m.role === "operative")
  );

  const roster = (team: CodenamesTeam) =>
    game.members.filter((m) => m.team === team);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <h2 className="text-center font-display text-2xl text-cloud">{t("cn.chooseTeam")}</h2>

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
                {t("cn.join", { team: teamName(team) })}
              </Button>
            </div>
            <div className="space-y-1.5">
              {roster(team).map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <span>{players[m.id]?.avatar}</span>
                  <span className="text-cloud">{players[m.id]?.name}</span>
                  <span className="ml-auto text-xs text-faint">
                    {m.role === "spymaster" ? `🕵️ ${t("cn.spymaster")}` : t("cn.operative")}
                  </span>
                </div>
              ))}
              {roster(team).length === 0 && <div className="text-xs text-faint">—</div>}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* my role toggle */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-faint">{me?.team ? teamName(me.team) : "—"}:</span>
        <Button
          variant={me?.role === "spymaster" ? "primary" : "ghost"}
          className="px-4 py-2 text-sm"
          onClick={() => gameAction({ type: "setRole", role: "spymaster" })}
        >
          🕵️ {t("cn.makeSpymaster")}
        </Button>
        <Button
          variant={me?.role === "operative" ? "primary" : "ghost"}
          className="px-4 py-2 text-sm"
          onClick={() => gameAction({ type: "setRole", role: "operative" })}
        >
          {t("cn.makeOperative")}
        </Button>
      </div>

      <div className="mt-auto">
        {isHost ? (
          <Button full disabled={!ready} onClick={() => gameAction({ type: "begin" })}>
            {ready ? t("cn.begin") : t("cn.needTeams")}
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

/* ── Board ─────────────────────────────────────────────────────────────────── */
function Board({
  game,
  players,
  youId,
  teamName,
  t,
}: {
  game: CodenamesView;
  players: Record<string, Player>;
  youId: string | null;
  teamName: (team: CodenamesTeam) => string;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const gameAction = useStore((s) => s.gameAction);
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);

  const myClue = game.phase === "clue" && game.youTeam === game.turnTeam && game.youRole === "spymaster";
  const myGuess = game.phase === "guess" && game.youTeam === game.turnTeam && game.youRole === "operative";
  const isSpymaster = game.youRole === "spymaster";

  const submitClue = () => {
    if (!clueWord.trim()) return;
    gameAction({ type: "clue", word: clueWord.trim(), count: clueCount });
    setClueWord("");
    setClueCount(1);
  };

  const youTeam = game.youTeam;

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* your team & role — always visible */}
      {youTeam && (
        <div
          className="flex items-center justify-center gap-2 rounded-xl py-2 font-display text-sm font-semibold"
          style={{
            background: `${TEAM_HEX[youTeam]}22`,
            color: TEAM_HEX[youTeam],
            border: `1px solid ${TEAM_HEX[youTeam]}66`,
          }}
        >
          <span className="opacity-70">{t("cn.youAre")}</span>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TEAM_HEX[youTeam] }} />
          {teamName(youTeam)} ·{" "}
          {game.youRole === "spymaster" ? `🕵️ ${t("cn.spymaster")}` : t("cn.operative")}
        </div>
      )}

      {/* score */}
      <div className="flex items-center justify-center gap-3 font-display text-2xl font-bold">
        <span style={{ color: TEAM_HEX.red, opacity: game.turnTeam === "red" ? 1 : 0.5 }}>
          {game.remaining.red}
        </span>
        <span className="text-faint text-base">·</span>
        <span style={{ color: TEAM_HEX.blue, opacity: game.turnTeam === "blue" ? 1 : 0.5 }}>
          {game.remaining.blue}
        </span>
      </div>

      {/* big clue / status banner */}
      {game.phase === "over" ? null : game.clue ? (
        <div
          className="rounded-2xl border py-3 text-center"
          style={{ borderColor: `${TEAM_HEX[game.turnTeam]}55`, background: `${TEAM_HEX[game.turnTeam]}14` }}
        >
          <div className="text-[0.65rem] font-semibold uppercase tracking-widest text-faint">
            {t("cn.clue")}
          </div>
          <div
            className="font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl"
            style={{ color: TEAM_HEX[game.turnTeam] }}
          >
            {game.clue.word} <span className="opacity-60">· {game.clue.count}</span>
          </div>
        </div>
      ) : (
        <div className="text-center text-sm font-medium" style={{ color: TEAM_HEX[game.turnTeam] }}>
          {myClue
            ? t("cn.giveClueTitle", { team: teamName(game.turnTeam) })
            : game.phase === "clue"
              ? t("cn.waitingClue", { team: teamName(game.turnTeam) })
              : t("cn.guessing", { team: teamName(game.turnTeam) })}
        </div>
      )}

      {isSpymaster && game.phase !== "over" && (
        <div className="text-center text-xs text-faint">{t("cn.spymasterPeek")}</div>
      )}

      {/* 5×5 grid */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {game.words.map((word, i) => {
          const revealed = game.revealed[i];
          const keyColor = game.key[i]; // non-null only for spymaster
          const votable = myGuess && !revealed;
          const voters = game.votes[i] ?? [];
          const youVoted = game.youVote === i;
          const baseStyle: CSSProperties = revealed
            ? colorStyle(revealed)
            : keyColor
              ? { ...colorStyle(keyColor), opacity: 0.42 }
              : {};
          return (
            <div key={i} className="relative">
              <motion.button
                disabled={!votable}
                onClick={() => votable && gameAction({ type: "vote", index: i })}
                whileHover={votable ? { scale: 1.04 } : undefined}
                whileTap={votable ? { scale: 0.96 } : undefined}
                className={`grid aspect-[7/5] w-full place-items-center rounded-lg px-1 text-center font-display text-[0.62rem] font-semibold uppercase leading-tight tracking-tight sm:text-sm ${
                  revealed || keyColor ? "" : "glass text-cloud"
                } ${votable ? "cursor-pointer" : ""} ${
                  youVoted ? "ring-2 ring-white" : votable ? "ring-1 ring-white/20" : ""
                }`}
                style={baseStyle}
              >
                {revealed === "assassin" ? "💀" : word}
              </motion.button>

              {/* voter avatars */}
              {!revealed && voters.length > 0 && (
                <div className="pointer-events-none absolute -right-1 -top-1 flex -space-x-1">
                  {voters.slice(0, 3).map((id) => (
                    <span
                      key={id}
                      className="grid h-4 w-4 place-items-center rounded-full bg-black/50 text-[0.5rem] ring-1 ring-white/60"
                    >
                      {players[id]?.avatar ?? "•"}
                    </span>
                  ))}
                </div>
              )}

              {/* validate the voted card */}
              {votable && voters.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => gameAction({ type: "guess", index: i })}
                  className="absolute inset-x-1 bottom-1 rounded-md bg-white/90 py-0.5 text-[0.5rem] font-bold uppercase tracking-wide text-black shadow-sm hover:bg-white sm:text-[0.6rem]"
                >
                  ✓ {t("cn.validate")}
                </motion.button>
              )}
            </div>
          );
        })}
      </div>

      {/* controls */}
      {game.phase === "over" ? (
        <Results game={game} players={players} youId={youId} teamName={teamName} t={t} />
      ) : myClue ? (
        <div className="mt-1 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-faint">{t("cn.clueWord")}</label>
            <input
              value={clueWord}
              onChange={(e) => setClueWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitClue()}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-cloud outline-none focus:border-accent/50"
            />
          </div>
          <div className="w-20">
            <label className="text-xs text-faint">{t("cn.clueCount")}</label>
            <input
              type="number"
              min={0}
              max={9}
              value={clueCount}
              onChange={(e) => setClueCount(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-cloud outline-none focus:border-accent/50"
            />
          </div>
          <Button onClick={submitClue} className="px-4 py-2.5">
            {t("cn.submitClue")}
          </Button>
        </div>
      ) : myGuess ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="text-sm text-mist">
            {t("cn.yourGuess")} · {t("cn.guessesLeft", { n: game.guessesLeft })}
          </span>
          <Button variant="ghost" onClick={() => gameAction({ type: "endTurn" })} className="px-4 py-2 text-sm">
            {t("cn.endTurn")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Results({
  game,
  players,
  youId,
  teamName,
  t,
}: {
  game: CodenamesView;
  players: Record<string, Player>;
  youId: string | null;
  teamName: (team: CodenamesTeam) => string;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const isHost = room?.hostId === youId;
  const youWon = game.winner && game.youTeam === game.winner;

  return (
    <div className="mt-2 text-center">
      <Celebration auto={!!youWon} />
      <div
        className="rounded-2xl py-4 font-display text-2xl font-semibold"
        style={{ background: game.winner ? `${TEAM_HEX[game.winner]}22` : undefined, color: game.winner ? TEAM_HEX[game.winner] : "#fff" }}
      >
        {game.winner ? t("cn.teamWins", { team: teamName(game.winner) }) : "—"}
      </div>
      {isHost ? (
        <div className="mt-3 flex flex-col gap-2">
          <Button full onClick={toLobby}>
            {t("common.backToLobby")}
          </Button>
          <Button full variant="ghost" onClick={retry}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 text-sm text-mist">{t("common.waitingHost")}</div>
      )}
    </div>
  );
}
