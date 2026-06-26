import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, GlassCard } from "@/components/primitives";
import { ConfettiBurst } from "@/components/Celebration";
import { Wordmark } from "@/components/Wordmark";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SoundToggle } from "@/components/SoundToggle";
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
  PB_BOUNDS,
  PB_CATEGORIES,
  PB_DEFAULT_CATEGORIES,
  SF_BOUNDS,
  UNO_BOUNDS,
  type BombPartySettings,
  type CodenamesSettings,
  type Devine9Settings,
  type Language,
  type PetitBacSettings,
  type SpyfallSettings,
  type RoomState,
  type UnoSettings,
} from "@shared";

export function Lobby({
  room,
  onSandbox,
  sandboxOpen,
}: {
  room: RoomState;
  onSandbox: () => void;
  sandboxOpen: boolean;
}) {
  const t = useT();
  const youId = useStore((s) => s.youId);
  const selectGame = useStore((s) => s.selectGame);
  const vote = useStore((s) => s.vote);
  const randomGame = useStore((s) => s.randomGame);
  const sendConfetti = useStore((s) => s.sendConfetti);
  const pushConfetti = useStore((s) => s.pushConfetti);
  const setGameLanguage = useStore((s) => s.setGameLanguage);
  const start = useStore((s) => s.start);
  const kick = useStore((s) => s.kick);
  const leaveRoom = useStore((s) => s.leaveRoom);
  const pushNotice = useStore((s) => s.pushNotice);

  // Tally votes per game (playerId → gameId) for the bubble counters.
  const voteCounts = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const g of Object.values(room.votes ?? {})) counts[g] = (counts[g] ?? 0) + 1;
    return counts;
  }, [room.votes]);
  const myVote = youId ? room.votes?.[youId] : undefined;

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

  // Tapping the empty space around the cards flings confetti that everyone
  // in the room sees, at the same relative spot on each screen.
  useEffect(() => {
    // While the physics sandbox is open, clicks drive the shapes - don't also
    // fling confetti. It re-arms automatically when the sandbox closes.
    if (room.phase !== "lobby" || sandboxOpen) return;
    const INTERACTIVE = "button, a, input, textarea, select, [role='button'], [contenteditable]";
    let last = 0;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE)) return; // leave clickable elements alone
      if (e.timeStamp - last < 120) return; // light throttle against spam
      last = e.timeStamp;
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      const color = useStore.getState().identity.color;
      pushConfetti(x, y, color); // show ours immediately…
      sendConfetti({ x, y, color }); // …and relay it to everyone else
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [room.phase, pushConfetti, sendConfetti, sandboxOpen]);

  if (room.phase === "playing") return <GamePlay room={room} onLeave={leave} />;

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6 lg:h-dvh lg:overflow-hidden">
      <LobbyConfetti />
      <header className="flex items-center justify-between py-5">
        <Wordmark size={24} />
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <SoundToggle />
          <LanguageToggle />
          <Button
            variant="ghost"
            onClick={onSandbox}
            title={t("landing.sandbox")}
            className="px-3 py-2 text-sm"
          >
            🧩 <span className="hidden sm:inline">{t("landing.sandbox")}</span>
          </Button>
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

          <GlassCard className="sandbox-solid p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-cloud">
                {t("lobby.chooseGame")}
              </h2>
              {isHost ? (
                <button
                  onClick={randomGame}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-cloud transition hover:bg-white/10 active:scale-95"
                >
                  🎲 {t("lobby.random")}
                </button>
              ) : (
                <span className="shrink-0 text-xs text-faint">{t("lobby.voteHint")}</span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {GAMES.map((g) => {
                const active = g.id === room.selectedGame;
                const votes = voteCounts[g.id] ?? 0;
                const mine = myVote === g.id;
                return (
                  <motion.button
                    key={g.id}
                    onClick={() => {
                      vote(g.id);
                      if (isHost) selectGame(g.id);
                    }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative overflow-visible rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-accent/60 bg-accent/10"
                        : "border-white/10 bg-white/5 hover:bg-white/8"
                    }`}
                  >
                    {/* Vote bubble - grows with the number of votes. */}
                    <AnimatePresence>
                      {votes > 0 && (
                        <motion.span
                          key={votes}
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{
                            scale: Math.min(1 + (votes - 1) * 0.12, 1.7),
                            opacity: 1,
                          }}
                          exit={{ scale: 0.4, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className={`absolute -right-2 -top-2 z-10 grid h-6 min-w-[1.5rem] origin-center place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums shadow-lg ${
                            mine
                              ? "bg-accent text-ink-900 ring-2 ring-white/70"
                              : "bg-accent text-ink-900"
                          }`}
                          title={t("lobby.votes", { n: votes })}
                        >
                          {votes}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{g.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-display text-lg font-semibold text-cloud">
                            {t(`game.${g.id}.name`)}
                          </div>
                          {active && (
                            <motion.span
                              layoutId="game-active"
                              className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.62rem] font-semibold text-ink-900"
                            >
                              {t("lobby.selected")}
                            </motion.span>
                          )}
                        </div>
                        <div className="truncate text-xs text-mist">
                          {g.minPlayers}–{g.maxPlayers} · {t(`game.${g.id}.duration`)}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-snug text-mist">
                      {t(`game.${g.id}.tagline`)}
                    </p>
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
          <GlassCard className="sandbox-solid p-5">
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

/* ── Synchronized confetti overlay ───────────────────────────────────────── */
/** Renders every live confetti burst (ours + relayed) over the whole lobby.
 *  Normalized coords are mapped to this client's viewport so a tap lands in the
 *  same relative spot for everyone. */
function LobbyConfetti() {
  const confetti = useStore((s) => s.confetti);
  const [vw, setVw] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth
  );
  const [vh, setVh] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerHeight
  );

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {confetti.map((c) => (
        <ConfettiBurst key={c.id} x={c.x * vw} y={c.y * vh} color={c.color} />
      ))}
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
    <GlassCard className="sandbox-solid flex min-h-[16rem] flex-1 flex-col p-5">
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
    room.selectedGame === "petitbac" ||
    room.selectedGame === "devine9" ||
    room.selectedGame === "spyfall" ||
    room.selectedGame === "uno";

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
      ) : room.selectedGame === "petitbac" ? (
        <PetitBacRules
          s={room.settings.petitbac}
          language={room.gameLanguage}
          isHost={isHost}
          onChange={(patch) => updateSettings("petitbac", patch)}
        />
      ) : room.selectedGame === "devine9" ? (
        <Devine9Rules
          s={room.settings.devine9}
          isHost={isHost}
          onChange={(patch) => updateSettings("devine9", patch)}
        />
      ) : room.selectedGame === "spyfall" ? (
        <SpyfallRules
          s={room.settings.spyfall}
          isHost={isHost}
          onChange={(patch) => updateSettings("spyfall", patch)}
        />
      ) : room.selectedGame === "complots" ? (
        <RulesList
          prefix="cp"
          steps={["setup", "turn", "roles", "bluff", "liar", "block", "coup", "win"]}
        />
      ) : room.selectedGame === "chateau" ? (
        <RulesList prefix="ch" steps={["goal", "market", "place", "facedown", "combo", "score"]} />
      ) : room.selectedGame === "loveletter" ? (
        <RulesList prefix="ll" steps={["deal", "turn", "out", "end", "spy", "tokens"]} />
      ) : room.selectedGame === "uno" ? (
        <UnoRules
          s={room.settings.uno}
          isHost={isHost}
          onChange={(patch) => updateSettings("uno", patch)}
        />
      ) : room.selectedGame === "sixquiprend" ? (
        <RulesList prefix="sixqp" steps={["pick", "place", "sixth", "low", "win"]} />
      ) : room.selectedGame === "skyjo" ? (
        <RulesList prefix="sk" steps={["grid", "turn", "column", "close", "win"]} />
      ) : room.selectedGame === "exploding" ? (
        <RulesList prefix="ek" steps={["goal", "turn", "draw", "defuse", "cards", "nope"]} />
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

function PetitBacRules({
  s,
  language,
  isHost,
  onChange,
}: {
  s: PetitBacSettings;
  language: Language;
  isHost: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");

  const lower = (x: string) => x.trim().toLowerCase();
  const defaults = PB_DEFAULT_CATEGORIES[language];
  // Empty settings → play the language defaults (all checked).
  const selected = s.categories.length ? s.categories : defaults;
  const selectedSet = useMemo(() => new Set(selected.map(lower)), [selected]);

  // Pool shown as toggles: every default, plus any custom the host has added.
  const pool = useMemo(() => {
    const out = [...defaults];
    const have = new Set(defaults.map(lower));
    for (const c of selected) {
      if (!have.has(lower(c))) {
        out.push(c);
        have.add(lower(c));
      }
    }
    return out;
  }, [defaults, selected]);

  const count = selected.length;
  const atMin = count <= PB_CATEGORIES.min;
  const atMax = count >= PB_CATEGORIES.max;

  const toggle = (cat: string) => {
    if (!isHost) return;
    const on = selectedSet.has(lower(cat));
    if (on && atMin) return; // never drop below the minimum
    const next = on ? selected.filter((c) => lower(c) !== lower(cat)) : [...selected, cat];
    onChange({ categories: next });
  };

  const add = () => {
    if (!isHost) return;
    const clean = draft.trim().replace(/\s+/g, " ").slice(0, PB_CATEGORIES.maxLen);
    if (!clean || atMax || selectedSet.has(clean.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange({ categories: [...selected, clean] });
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-4">
      <Stepper
        label={t("set.pb.minWrite")}
        value={s.minWriteSec}
        step={5}
        format={(v) => t("set.seconds", { n: v })}
        min={PB_BOUNDS.minWriteSec.min}
        max={PB_BOUNDS.minWriteSec.max}
        disabled={!isHost}
        onChange={(v) => onChange({ minWriteSec: v })}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-cloud">{t("set.pb.categories")}</span>
          <span className={`text-xs ${atMin ? "text-amber-300" : "text-faint"}`}>
            {t("set.pb.count", { n: count, min: PB_CATEGORIES.min })}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {pool.map((cat) => {
            const on = selectedSet.has(lower(cat));
            const lockedOff = on && atMin; // can't uncheck the last allowed ones
            return (
              <button
                key={cat}
                disabled={!isHost || lockedOff}
                onClick={() => toggle(cat)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "bg-accent text-ink-900"
                    : "bg-white/5 text-mist enabled:hover:bg-white/10"
                } ${!isHost || lockedOff ? "cursor-default" : ""} ${
                  !isHost ? "opacity-80" : ""
                }`}
              >
                {on ? "✓ " : ""}
                {cat}
              </button>
            );
          })}
        </div>

        {isHost && (
          <div className="flex gap-2">
            <input
              value={draft}
              maxLength={PB_CATEGORIES.maxLen}
              disabled={atMax}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={t("set.pb.addPlaceholder")}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-cloud outline-none placeholder:text-faint focus:border-accent/50 focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
            />
            <Button onClick={add} variant="ghost" className="px-4 py-2 text-sm" disabled={atMax || !draft.trim()}>
              {t("set.pb.add")}
            </Button>
          </div>
        )}
        <p className="text-xs leading-snug text-faint">{t("set.pb.hint")}</p>
      </div>
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

function SpyfallRules({
  s,
  isHost,
  onChange,
}: {
  s: SpyfallSettings;
  isHost: boolean;
  onChange: (patch: Record<string, number>) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <Stepper
        label={t("set.sf.roundSec")}
        value={s.roundSec}
        step={30}
        format={(v) => `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, "0")}`}
        min={SF_BOUNDS.roundSec.min}
        max={SF_BOUNDS.roundSec.max}
        disabled={!isHost}
        onChange={(v) => onChange({ roundSec: v })}
      />
      <p className="text-xs leading-snug text-faint">{t("set.sf.hint")}</p>
    </div>
  );
}

function UnoRules({
  s,
  isHost,
  onChange,
}: {
  s: UnoSettings;
  isHost: boolean;
  onChange: (patch: Record<string, number | boolean>) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <Stepper
        label={t("set.uno.startingHand")}
        value={s.startingHand}
        format={(v) => t("set.uno.cards", { n: v })}
        min={UNO_BOUNDS.startingHand.min}
        max={UNO_BOUNDS.startingHand.max}
        disabled={!isHost}
        onChange={(v) => onChange({ startingHand: v })}
      />
      <Toggle
        label={t("set.uno.stacking")}
        hint={t("set.uno.stackingHint")}
        value={s.stacking}
        disabled={!isHost}
        onChange={(v) => onChange({ stacking: v })}
      />
      <Toggle
        label={t("set.uno.drawToMatch")}
        value={s.drawToMatch}
        disabled={!isHost}
        onChange={(v) => onChange({ drawToMatch: v })}
      />
      <Toggle
        label={t("set.uno.forcePlay")}
        value={s.forcePlay}
        disabled={!isHost}
        onChange={(v) => onChange({ forcePlay: v })}
      />
      <Stepper
        label={t("set.uno.unoPenalty")}
        value={s.unoPenalty}
        format={(v) => t("set.uno.cards", { n: v })}
        min={UNO_BOUNDS.unoPenalty.min}
        max={UNO_BOUNDS.unoPenalty.max}
        disabled={!isHost}
        onChange={(v) => onChange({ unoPenalty: v })}
      />
      <Stepper
        label={t("set.uno.scoreTarget")}
        value={s.scoreTarget}
        step={100}
        format={(v) => (v === 0 ? t("set.uno.singleRound") : t("set.uno.points", { n: v }))}
        min={UNO_BOUNDS.scoreTarget.min}
        max={UNO_BOUNDS.scoreTarget.max}
        disabled={!isHost}
        onChange={(v) => onChange({ scoreTarget: v })}
      />
      <p className="text-xs leading-snug text-faint">{t("set.uno.hint")}</p>
    </div>
  );
}

/** A pill on/off switch for boolean rules (host-only). */
function Toggle({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-sm text-cloud">{label}</span>
        {hint && <p className="text-xs leading-snug text-faint">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          value ? "bg-accent" : "bg-white/10"
        } ${disabled ? "cursor-default opacity-70" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            value ? "left-[1.4rem]" : "left-0.5"
          }`}
        />
      </button>
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

