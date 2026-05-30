import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Confetti } from "@/components/Confetti";
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

  if (game.phase === "setup") return <Setup game={game} players={players} youId={youId} teamName={teamName} t={t} />;

  return <Board game={game} players={players} youId={youId} teamName={teamName} t={t} />;
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

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* score + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 font-display text-lg">
          <span style={{ color: TEAM_HEX.red }}>{game.remaining.red}</span>
          <span className="text-faint">·</span>
          <span style={{ color: TEAM_HEX.blue }}>{game.remaining.blue}</span>
        </div>
        <div className="text-sm" style={{ color: TEAM_HEX[game.turnTeam] }}>
          {game.phase === "over"
            ? game.endReason === "assassin"
              ? t("cn.assassinHit")
              : ""
            : game.clue
              ? `${t("cn.clue")}: ${game.clue.word} · ${game.clue.count}`
              : myClue
                ? ""
                : game.phase === "clue"
                  ? t("cn.waitingClue", { team: teamName(game.turnTeam) })
                  : t("cn.guessing", { team: teamName(game.turnTeam) })}
        </div>
      </div>

      {isSpymaster && game.phase !== "over" && (
        <div className="text-center text-xs text-faint">{t("cn.spymasterPeek")}</div>
      )}

      {/* 5×5 grid */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {game.words.map((word, i) => {
          const revealed = game.revealed[i];
          const keyColor = game.key[i]; // non-null only for spymaster
          const clickable = myGuess && !revealed;
          const baseStyle: CSSProperties = revealed
            ? colorStyle(revealed)
            : keyColor
              ? { ...colorStyle(keyColor), opacity: 0.42 }
              : {};
          return (
            <motion.button
              key={i}
              disabled={!clickable}
              onClick={() => clickable && gameAction({ type: "guess", index: i })}
              whileHover={clickable ? { scale: 1.04 } : undefined}
              whileTap={clickable ? { scale: 0.96 } : undefined}
              className={`grid aspect-[7/5] place-items-center rounded-lg px-1 text-center font-display text-[0.62rem] font-semibold uppercase leading-tight tracking-tight sm:text-sm ${
                revealed || keyColor ? "" : "glass text-cloud"
              } ${clickable ? "cursor-pointer ring-1 ring-white/20" : ""}`}
              style={baseStyle}
            >
              {revealed === "assassin" ? "💀" : word}
            </motion.button>
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
  const isHost = room?.hostId === youId;
  const youWon = game.winner && game.youTeam === game.winner;

  return (
    <div className="mt-2 text-center">
      {youWon && <Confetti />}
      <div
        className="rounded-2xl py-4 font-display text-2xl font-semibold"
        style={{ background: game.winner ? `${TEAM_HEX[game.winner]}22` : undefined, color: game.winner ? TEAM_HEX[game.winner] : "#fff" }}
      >
        {game.winner ? t("cn.teamWins", { team: teamName(game.winner) }) : "—"}
      </div>
      {isHost ? (
        <Button full className="mt-3" onClick={toLobby}>
          {t("common.backToLobby")}
        </Button>
      ) : (
        <div className="mt-3 text-sm text-mist">{t("common.waitingHost")}</div>
      )}
    </div>
  );
}
