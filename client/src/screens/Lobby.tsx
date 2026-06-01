import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button, GlassCard } from "@/components/primitives";
import { Wordmark } from "@/components/Wordmark";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { RoomCodePill } from "@/components/RoomCodePill";
import { PlayerList } from "@/components/PlayerList";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { GamePlay } from "@/games/GamePlay";
import {
  BOMB_BOUNDS,
  BOMB_DIFFICULTIES,
  CN_WORDS,
  D9_BOUNDS,
  GAMES,
  gameById,
  type BombPartySettings,
  type CodenamesSettings,
  type Devine9Settings,
  type RoomState,
} from "@shared";

export function Lobby({ room }: { room: RoomState }) {
  const t = useT();
  const youId = useStore((s) => s.youId);
  const selectGame = useStore((s) => s.selectGame);
  const setGameLanguage = useStore((s) => s.setGameLanguage);
  const start = useStore((s) => s.start);
  const kick = useStore((s) => s.kick);
  const leaveRoom = useStore((s) => s.leaveRoom);
  const pushNotice = useStore((s) => s.pushNotice);

  const isHost = room.hostId === youId;
  const meta = gameById(room.selectedGame);
  // Bomb Party lets the host tighten the join cap below the game's hard max.
  const maxPlayers =
    room.selectedGame === "bombparty"
      ? Math.min(meta.maxPlayers, room.settings.bombparty.maxPlayers)
      : meta.maxPlayers;
  const gameName = t(`game.${room.selectedGame}.name`);
  const connected = room.players.filter((p) => p.connected).length;
  const canStart = isHost && connected >= meta.minPlayers;

  const onStart = async () => {
    const res = await start();
    if (!res.ok) pushNotice("warn", res.reason ?? "Can't start yet.");
  };

  const leave = () => {
    leaveRoom();
    window.history.replaceState({}, "", "/");
  };

  if (room.phase === "playing") return <GamePlay room={room} onLeave={leave} />;

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6 lg:h-dvh lg:overflow-hidden">
      <header className="flex items-center justify-between py-5">
        <Wordmark size={24} />
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <LanguageToggle />
          <Button variant="ghost" onClick={leave} className="px-4 py-2 text-sm">
            {t("common.leave")}
          </Button>
        </div>
      </header>

      <main className="grid flex-1 gap-5 pb-8 lg:min-h-0 lg:grid-cols-[1.4fr_1fr] lg:grid-rows-1">
        {/* ── Left: code + game picker + start ─────────────────────────── */}
        <div className="flex flex-col gap-5 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <RoomCodePill code={room.code} />
            <div className="text-right">
              <div className="font-display text-3xl font-semibold text-cloud">
                {connected}
                <span className="text-faint">/{maxPlayers}</span>
              </div>
              <div className="text-xs text-faint">{t("lobby.playersInRoom")}</div>
            </div>
          </div>

          <GlassCard className="p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold text-cloud">
                {t("lobby.chooseGame")}
              </h2>
              {!isHost && (
                <span className="text-xs text-faint">{t("lobby.hostPicks")}</span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {GAMES.map((g) => {
                const active = g.id === room.selectedGame;
                return (
                  <motion.button
                    key={g.id}
                    disabled={!isHost}
                    onClick={() => selectGame(g.id)}
                    whileHover={isHost ? { y: -3 } : undefined}
                    whileTap={isHost ? { scale: 0.98 } : undefined}
                    className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-accent/60 bg-accent/10"
                        : "border-white/10 bg-white/5 hover:bg-white/8"
                    } ${!isHost && "cursor-default"}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{g.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-display text-lg font-semibold text-cloud">
                          {t(`game.${g.id}.name`)}
                        </div>
                        <div className="truncate text-xs text-mist">
                          {g.minPlayers}–{g.maxPlayers} · {t(`game.${g.id}.duration`)}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-snug text-mist">
                      {t(`game.${g.id}.tagline`)}
                    </p>
                    {active && (
                      <motion.span
                        layoutId="game-active"
                        className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[0.62rem] font-semibold text-ink-900"
                      >
                        {t("lobby.selected")}
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Game-content language (words & categories) */}
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-2.5">
              <div>
                <div className="text-sm text-cloud">{t("lobby.gameLanguage")}</div>
                <div className="text-xs text-faint">{t("lobby.gameLanguageHint")}</div>
              </div>
              <div className="flex gap-1">
                {(["fr", "en"] as const).map((l) => (
                  <button
                    key={l}
                    disabled={!isHost}
                    onClick={() => setGameLanguage(l)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium uppercase transition ${
                      room.gameLanguage === l
                        ? "bg-accent text-ink-900"
                        : "bg-white/5 text-mist hover:bg-white/10"
                    } ${!isHost ? "cursor-default opacity-70" : ""}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-game rules, host-configurable */}
            <GameRules room={room} isHost={isHost} />

            <div className="mt-4">
              {isHost ? (
                <Button full onClick={onStart} disabled={!canStart}>
                  {canStart
                    ? t("lobby.start", { game: gameName })
                    : t("lobby.needPlayers", { n: meta.minPlayers })}
                </Button>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 py-3 text-center text-sm text-mist">
                  {t("lobby.waitingStart", { game: gameName })}
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* ── Right: players + chat ────────────────────────────────────── */}
        <div className="flex min-h-0 flex-col gap-5">
          <GlassCard className="p-5">
            <h2 className="mb-3 font-display text-xl font-semibold text-cloud">
              {t("lobby.players")}
            </h2>
            <PlayerList
              players={room.players}
              youId={youId}
              hostId={room.hostId}
              canKick={isHost}
              onKick={kick}
            />
          </GlassCard>

          <Chat room={room} youId={youId} />
        </div>
      </main>
    </div>
  );
}

/* ── Chat ───────────────────────────────────────────────────────────────── */
function Chat({ room, youId }: { room: RoomState; youId: string | null }) {
  const t = useT();
  const sendChat = useStore((s) => s.sendChat);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [room.chat.length]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    sendChat(t);
    setText("");
  };

  return (
    <GlassCard className="flex min-h-[16rem] flex-1 flex-col p-5">
      <h2 className="mb-3 font-display text-xl font-semibold text-cloud">{t("lobby.chat")}</h2>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {room.chat.length === 0 && (
          <p className="text-sm text-faint">{t("lobby.chatEmpty")}</p>
        )}
        {room.chat.map((m) => (
          <div key={m.id} className="flex gap-2 text-sm">
            <span className="shrink-0">{m.avatar}</span>
            <p className="text-mist">
              <span className={m.playerId === youId ? "text-accent" : "text-cloud"}>
                {m.name}
              </span>{" "}
              {m.text}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          maxLength={280}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("lobby.chatPh")}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-cloud outline-none placeholder:text-faint focus:border-accent/50 focus:ring-2 focus:ring-accent/30"
        />
        <Button onClick={send} className="px-4 py-2.5 text-sm">
          {t("common.send")}
        </Button>
      </div>
    </GlassCard>
  );
}

/* ── Game rules (host-configurable, per game) ────────────────────────────── */
function GameRules({ room, isHost }: { room: RoomState; isHost: boolean }) {
  const t = useT();
  const updateSettings = useStore((s) => s.updateSettings);
  // Only some games expose host-tunable options; others just show how to play.
  const editable =
    room.selectedGame === "bombparty" ||
    room.selectedGame === "codenames" ||
    room.selectedGame === "devine9";

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-mist">
          {t("lobby.rules")}
        </h3>
        {!isHost && editable && (
          <span className="text-xs text-faint">{t("lobby.rulesReadonly")}</span>
        )}
      </div>

      {room.selectedGame === "bombparty" ? (
        <BombPartyRules
          s={room.settings.bombparty}
          isHost={isHost}
          onChange={(patch) => updateSettings("bombparty", patch)}
        />
      ) : room.selectedGame === "codenames" ? (
        <CodenamesRules
          s={room.settings.codenames}
          isHost={isHost}
          onChange={(patch) => updateSettings("codenames", patch)}
        />
      ) : room.selectedGame === "devine9" ? (
        <Devine9Rules
          s={room.settings.devine9}
          isHost={isHost}
          onChange={(patch) => updateSettings("devine9", patch)}
        />
      ) : room.selectedGame === "sixquiprend" ? (
        <RulesList prefix="sixqp" steps={["pick", "place", "sixth", "low", "win"]} />
      ) : room.selectedGame === "skyjo" ? (
        <RulesList prefix="sk" steps={["grid", "turn", "column", "close", "win"]} />
      ) : (
        <p className="text-sm text-faint">{t("lobby.noRules")}</p>
      )}
    </div>
  );
}

/** Static "how to play" blurb, visible to everyone in the lobby. */
function RulesList({ prefix, steps }: { prefix: string; steps: string[] }) {
  const t = useT();
  return (
    <ul className="flex flex-col gap-2">
      {steps.map((s) => (
        <li key={s} className="flex gap-2 text-sm leading-snug text-mist">
          <span aria-hidden className="mt-0.5 text-accent">•</span>
          <span>{t(`${prefix}.rule.${s}`)}</span>
        </li>
      ))}
    </ul>
  );
}

function BombPartyRules({
  s,
  isHost,
  onChange,
}: {
  s: BombPartySettings;
  isHost: boolean;
  onChange: (patch: Record<string, number>) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      {/* Syllable difficulty (rarity) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-cloud">{t("set.bombparty.difficulty")}</span>
        <div className="flex gap-1.5">
          {BOMB_DIFFICULTIES.map((d) => {
            const active = s.minWordsPerPrompt === d.minWords;
            return (
              <button
                key={d.key}
                disabled={!isHost}
                onClick={() => onChange({ minWordsPerPrompt: d.minWords })}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-accent text-ink-900"
                    : "bg-white/5 text-mist enabled:hover:bg-white/10"
                } ${!isHost ? "cursor-default opacity-70" : ""}`}
              >
                {t(`set.bombparty.diff.${d.key}`)}
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-snug text-faint">{t("set.bombparty.difficultyHint")}</p>
      </div>

      <Stepper
        label={t("set.bombparty.minTurn")}
        value={s.minTurnSec}
        format={(v) => t("set.seconds", { n: v })}
        min={BOMB_BOUNDS.minTurnSec.min}
        max={BOMB_BOUNDS.minTurnSec.max}
        disabled={!isHost}
        onChange={(v) => onChange({ minTurnSec: v })}
      />
      <Stepper
        label={t("set.bombparty.syllableAge")}
        value={s.syllableMaxAge}
        format={(v) => t("set.bombparty.turns", { n: v })}
        min={BOMB_BOUNDS.syllableMaxAge.min}
        max={BOMB_BOUNDS.syllableMaxAge.max}
        disabled={!isHost}
        onChange={(v) => onChange({ syllableMaxAge: v })}
      />
      <Stepper
        label={t("set.bombparty.startLives")}
        value={s.startLives}
        min={BOMB_BOUNDS.startLives.min}
        max={BOMB_BOUNDS.startLives.max}
        disabled={!isHost}
        onChange={(v) => onChange({ startLives: v })}
      />
      <Stepper
        label={t("set.bombparty.maxLives")}
        value={s.maxLives}
        min={s.startLives}
        max={BOMB_BOUNDS.maxLives.max}
        disabled={!isHost}
        onChange={(v) => onChange({ maxLives: v })}
      />
      <Stepper
        label={t("set.bombparty.maxPlayers")}
        value={s.maxPlayers}
        min={BOMB_BOUNDS.maxPlayers.min}
        max={BOMB_BOUNDS.maxPlayers.max}
        disabled={!isHost}
        onChange={(v) => onChange({ maxPlayers: v })}
      />
    </div>
  );
}

function CodenamesRules({
  s,
  isHost,
  onChange,
}: {
  s: CodenamesSettings;
  isHost: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const t = useT();
  const [text, setText] = useState(s.customWords.join("\n"));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const parse = (raw: string) =>
    raw
      .split(/[\n,]/)
      .map((w) => w.trim())
      .filter(Boolean);

  const onText = (v: string) => {
    setText(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ customWords: parse(v) }), 400);
  };

  // Non-host: read-only summary that reflects the host's current list.
  if (!isHost) {
    const n = s.customWords.length;
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-cloud">{t("set.cn.custom")}</span>
        <p className="text-xs text-faint">
          {n >= CN_WORDS.minToUse ? t("set.cn.usingCustom", { n }) : t("set.cn.usingBank")}
        </p>
      </div>
    );
  }

  const count = parse(text).length;
  const enough = count >= CN_WORDS.minToUse;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-cloud">{t("set.cn.custom")}</span>
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        rows={5}
        placeholder={t("set.cn.placeholder")}
        className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-cloud outline-none placeholder:text-faint focus:border-accent/50 focus:ring-2 focus:ring-accent/30"
      />
      <p className={`text-xs ${enough ? "text-emerald-300" : "text-faint"}`}>
        {enough
          ? t("set.cn.ready", { n: count })
          : t("set.cn.need", { n: count, min: CN_WORDS.minToUse })}
      </p>
    </div>
  );
}

function Devine9Rules({
  s,
  isHost,
  onChange,
}: {
  s: Devine9Settings;
  isHost: boolean;
  onChange: (patch: Record<string, number>) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <Stepper
        label={t("set.d9.turnSec")}
        value={s.turnSec}
        step={5}
        format={(v) => t("set.seconds", { n: v })}
        min={D9_BOUNDS.turnSec.min}
        max={D9_BOUNDS.turnSec.max}
        disabled={!isHost}
        onChange={(v) => onChange({ turnSec: v })}
      />
      <Stepper
        label={t("set.d9.roundsPerTeam")}
        value={s.roundsPerTeam}
        min={D9_BOUNDS.roundsPerTeam.min}
        max={D9_BOUNDS.roundsPerTeam.max}
        disabled={!isHost}
        onChange={(v) => onChange({ roundsPerTeam: v })}
      />
      <p className="text-xs leading-snug text-faint">{t("set.d9.hint")}</p>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const btn =
    "grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-lg leading-none text-cloud transition enabled:hover:bg-white/10 disabled:cursor-default disabled:opacity-30";

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-cloud">{label}</span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={disabled || value <= min} onClick={dec} aria-label="−">
          −
        </button>
        <span className="w-12 text-center font-display tabular-nums text-cloud">
          {format ? format(value) : value}
        </span>
        <button className={btn} disabled={disabled || value >= max} onClick={inc} aria-label="+">
          +
        </button>
      </div>
    </div>
  );
}

