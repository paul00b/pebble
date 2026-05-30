import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Confetti } from "@/components/Confetti";
import { useStore } from "@/lib/store";
import { remaining, useClock } from "@/lib/useClock";
import type { BombPartyView, Player, RoomState } from "@shared";

export function BombParty({ room }: { room: RoomState }) {
  const game = room.game as BombPartyView;
  const youId = useStore((s) => s.youId);
  const gameAction = useStore((s) => s.gameAction);

  const players = useMemo(
    () => Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>,
    [room.players]
  );

  const clock = useClock();
  const { seconds, fraction } = remaining(clock, game.fuseStart, game.deadline);
  const isMyTurn = game.current === youId && !game.over;

  const [input, setInput] = useState("");
  const lastEmit = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear + focus the field as the turn changes.
  useEffect(() => {
    if (isMyTurn) inputRef.current?.focus();
    else setInput("");
  }, [game.current, isMyTurn]);

  // Rejection feedback (only for my own attempts).
  const [reject, setReject] = useState<{ text: string; key: number } | null>(null);
  const seenEvent = useRef(0);
  useEffect(() => {
    const e = game.lastEvent;
    if (!e || e.at === seenEvent.current) return;
    seenEvent.current = e.at;
    if (e.playerId === youId && (e.type === "invalid" || e.type === "used")) {
      setReject({
        text: e.type === "used" ? "Already used!" : `Not a word with “${game.prompt}”`,
        key: e.at,
      });
    }
  }, [game.lastEvent, youId, game.prompt]);

  const onChange = (v: string) => {
    setInput(v);
    const now = Date.now();
    if (now - lastEmit.current > 70) {
      lastEmit.current = now;
      gameAction({ type: "type", value: v });
    }
  };

  const submit = () => {
    const word = input.trim();
    if (!word) return;
    gameAction({ type: "submit", word });
  };

  // Ring + bomb visuals escalate as the fuse burns down.
  const danger = 1 - fraction; // 0 (safe) → 1 (about to blow)
  const ringColor = fraction > 0.5 ? "#6ee7d6" : fraction > 0.22 ? "#fbbf72" : "#fb7185";
  const R = 120;
  const C = 2 * Math.PI * R;

  if (game.over) return <BombResults game={game} players={players} youId={youId} />;

  return (
    <div className="flex flex-1 flex-col items-center justify-between gap-6 pb-6">
      {/* Players + lives */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {game.order
          .map((id) => players[id])
          .filter(Boolean)
          .map((p) => {
            const isCurrent = p.id === game.current;
            const lives = game.lives[p.id] ?? 0;
            return (
              <motion.div
                key={p.id}
                animate={{ scale: isCurrent ? 1.06 : 1 }}
                className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${
                  isCurrent ? "glass-strong" : "glass"
                }`}
                style={
                  isCurrent
                    ? { boxShadow: `0 0 0 2px ${p.color}, 0 10px 30px -8px ${p.color}77` }
                    : undefined
                }
              >
                <Avatar emoji={p.avatar} color={p.color} size={34} />
                <div>
                  <div className="text-sm font-medium text-cloud">{p.name}</div>
                  <div className="text-xs leading-none">
                    {Array.from({ length: game.startLives }).map((_, i) => (
                      <span key={i} style={{ opacity: i < lives ? 1 : 0.25 }}>
                        ❤️
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
      </div>

      {/* Bomb + ring + prompt */}
      <div className="relative grid place-items-center">
        <svg width="280" height="280" className="-rotate-90">
          <circle cx="140" cy="140" r={R} stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
          <circle
            cx="140"
            cy="140"
            r={R}
            stroke={ringColor}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
            style={{ filter: `drop-shadow(0 0 8px ${ringColor})`, transition: "stroke 0.4s" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <motion.div
            animate={{ rotate: [-(2 + danger * 14), 2 + danger * 14, -(2 + danger * 14)] }}
            transition={{ repeat: Infinity, duration: 0.45 - danger * 0.32 }}
            className="text-6xl"
            style={{ filter: `drop-shadow(0 0 ${danger * 20}px #fb7185)` }}
          >
            💣
          </motion.div>
          <div className="mt-2 font-display text-5xl font-bold tracking-[0.15em] text-cloud">
            {game.prompt}
          </div>
          <div
            className="mt-1 font-display text-lg tabular-nums"
            style={{ color: ringColor }}
          >
            {seconds.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* Input / spectator */}
      <div className="w-full max-w-md">
        {isMyTurn ? (
          <motion.div
            key={reject?.key ?? "ok"}
            animate={reject ? { x: [0, -10, 10, -6, 6, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={`Type a word with “${game.prompt}”`}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-2xl border-2 border-accent/50 bg-white/10 px-5 py-4 text-center font-display text-2xl text-cloud outline-none placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/20"
            />
            <div className="mt-2 h-5 text-center text-sm">
              {reject ? (
                <span className="text-rose-300">{reject.text}</span>
              ) : (
                <span className="text-faint">Hit Enter to send</span>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="text-center">
            <div className="text-sm text-faint">
              {players[game.current]?.name ?? "Someone"} is typing…
            </div>
            <div className="mt-1 min-h-[2.5rem] font-display text-2xl text-cloud">
              {game.typed || <span className="text-faint">…</span>}
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
              >
                |
              </motion.span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BombResults({
  game,
  players,
  youId,
}: {
  game: BombPartyView;
  players: Record<string, Player>;
  youId: string | null;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const isHost = room?.hostId === youId;
  const winner = game.winnerId ? players[game.winnerId] : null;

  return (
    <div className="grid flex-1 place-items-center">
      <Confetti />
      <GlassCard
        strong
        className="max-w-sm p-8 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-6xl">🏆</div>
        <div className="mt-3 text-sm uppercase tracking-[0.25em] text-faint">Winner</div>
        {winner ? (
          <>
            <div className="mt-2 flex items-center justify-center gap-3">
              <Avatar emoji={winner.avatar} color={winner.color} size={48} ring />
              <span className="font-display text-3xl font-semibold text-cloud">
                {winner.name}
              </span>
            </div>
            {game.winnerId === youId && (
              <div className="mt-2 text-accent">Last one standing — that's you! 🎉</div>
            )}
          </>
        ) : (
          <div className="mt-2 font-display text-2xl text-cloud">Game over</div>
        )}
        {isHost ? (
          <Button full className="mt-6" onClick={toLobby}>
            Back to lobby
          </Button>
        ) : (
          <div className="mt-6 text-sm text-mist">Waiting for the host…</div>
        )}
      </GlassCard>
    </div>
  );
}
