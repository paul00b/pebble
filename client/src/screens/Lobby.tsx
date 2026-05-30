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
import { GAMES, gameById, type RoomState } from "@shared";

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
    <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
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

      <main className="grid flex-1 gap-5 pb-8 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Left: code + game picker + start ─────────────────────────── */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <RoomCodePill code={room.code} />
            <div className="text-right">
              <div className="font-display text-3xl font-semibold text-cloud">
                {connected}
                <span className="text-faint">/{meta.maxPlayers}</span>
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

