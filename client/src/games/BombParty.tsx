import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { remaining, useClock } from "@/lib/useClock";
import { playSound } from "@/lib/sound";
import { BOMB_BONUS_ALPHABET } from "@shared";
import type { BombPartyView, Player, RoomState } from "@shared";

export function BombParty({ room }: { room: RoomState }) {
  const t = useT();
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

  // Rejection feedback (only for my own attempts) + room-wide sound cues.
  const [reject, setReject] = useState<{ text: string; key: number } | null>(null);
  // Seed from the current event so a mid-game joiner doesn't replay a stale one.
  const seenEvent = useRef(game.lastEvent?.at ?? 0);
  useEffect(() => {
    const e = game.lastEvent;
    if (!e || e.at === seenEvent.current) return;
    seenEvent.current = e.at;

    // Everyone in the room hears what just happened.
    if (e.type === "valid") playSound("right");
    else if (e.type === "explode") playSound("explode");
    else if (e.type === "used") playSound("used");
    else if (e.type === "invalid") playSound("wrong");

    if (e.playerId === youId && (e.type === "invalid" || e.type === "used")) {
      setReject({
        text:
          e.type === "used"
            ? t("bomb.used")
            : t("bomb.notWord", { prompt: game.prompt }),
        key: e.at,
      });
    }
  }, [game.lastEvent, youId, game.prompt]);

  // After a rejected word the shake wrapper remounts the input — pull focus back
  // (and select the text) so the player can immediately retype.
  useEffect(() => {
    if (reject && isMyTurn) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [reject?.key, isMyTurn]);

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

  if (game.over) return <BombResults game={game} players={players} youId={youId} t={t} />;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 pb-6">
      {/* Players + lives */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {game.order
          .map((id) => players[id])
          .filter(Boolean)
          .map((p) => {
            const isCurrent = p.id === game.current;
            const lives = game.lives[p.id] ?? 0;
            const recent = game.recent[p.id];
            const last = game.lastEvent;
            const bonus =
              !!recent && last?.type === "valid" && last.playerId === p.id && !!last.bonus && last.at === recent.at;
            return (
              <motion.div
                key={p.id}
                animate={{ scale: isCurrent ? 1.06 : 1 }}
                className={`relative flex items-center gap-2 rounded-2xl px-3 py-2 ${
                  isCurrent ? "glass-strong" : "glass"
                }`}
                style={
                  isCurrent
                    ? { boxShadow: `0 0 0 2px ${p.color}, 0 10px 30px -8px ${p.color}77` }
                    : undefined
                }
              >
                <RecentChip entry={recent} bonus={bonus} clock={clock} />
                <Avatar emoji={p.avatar} color={p.color} size={34} />
                <div>
                  <div className="text-sm font-medium text-cloud">{p.name}</div>
                  <div className="text-xs leading-none">
                    {Array.from({ length: game.maxLives }).map((_, i) => (
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

      {/* Bomb, last word, and input stay grouped together so the gap below the
          bomb never balloons on tall screens. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
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

      {/* Last accepted word — centered so the whole room sees the catch. */}
      <LastWord game={game} players={players} clock={clock} />

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
              placeholder={t("bomb.placeholder", { prompt: game.prompt })}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-2xl border-2 border-accent/50 bg-white/10 px-5 py-4 text-center font-display text-2xl text-cloud outline-none placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/20"
            />
            <div className="mt-2 h-5 text-center text-sm">
              {reject ? (
                <span className="text-rose-300">{reject.text}</span>
              ) : (
                <span className="text-faint">{t("bomb.enterToSend")}</span>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="text-center">
            <div className="text-sm text-faint">
              {t("bomb.typing", { name: players[game.current]?.name ?? "…" })}
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
        {youId && game.order.includes(youId) && (
          <div className="mt-3">
            <AlphabetStrip used={game.alphabet[youId] ?? ""} hint={t("bomb.alphabetHint")} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/** Split a word into [before, matched-syllable, after], accent-insensitively, so
 *  the matched syllable can be highlighted in the player's actual spelling. */
function splitSyllable(word: string, syllable: string): [string, string, string] | null {
  const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const map: number[] = []; // normalized-char-index → original-char-index
  let norm = "";
  for (let i = 0; i < word.length; i++) {
    const n = strip(word[i]);
    for (let k = 0; k < n.length; k++) map.push(i);
    norm += n;
  }
  const target = strip(syllable);
  const at = norm.indexOf(target);
  if (at < 0) return null;
  const start = map[at];
  const end = map[at + target.length - 1] + 1;
  return [word.slice(0, start), word.slice(start, end), word.slice(end)];
}

function SyllableWord({ word, syllable }: { word: string; syllable: string }) {
  const seg = splitSyllable(word, syllable);
  if (!seg) return <span>{word}</span>;
  const [before, match, after] = seg;
  return (
    <span>
      {before}
      <span className="rounded bg-accent/30 px-0.5 text-accent">{match}</span>
      {after}
    </span>
  );
}

/** Centered, prominent badge of the most recently accepted word — sits between
 *  the bomb and the input so spectators see exactly what the last player typed. */
function LastWord({
  game,
  players,
  clock,
}: {
  game: BombPartyView;
  players: Record<string, Player>;
  clock: number;
}) {
  const e = game.lastEvent;
  const show = !!e && e.type === "valid" && !!e.word && clock - e.at < 3200;
  const author = e ? players[e.playerId] : undefined;
  return (
    <div className="flex h-9 items-center justify-center">
      <AnimatePresence mode="popLayout">
        {show && e && (
          <motion.div
            key={e.at}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="flex items-center gap-2 rounded-full glass-strong px-4 py-1.5 font-display text-lg text-cloud shadow-lg"
          >
            {author && <Avatar emoji={author.avatar} color={author.color} size={22} />}
            <SyllableWord word={e.word!} syllable={e.syllable ?? ""} />
            {e.bonus && <span>❤️</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Floats a player's most recent accepted word above their card for a moment. */
function RecentChip({
  entry,
  bonus,
  clock,
}: {
  entry?: { word: string; syllable: string; at: number };
  bonus: boolean;
  clock: number;
}) {
  const show = !!entry && clock - entry.at < 2600;
  return (
    <AnimatePresence>
      {show && entry && (
        <motion.div
          key={entry.at}
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: "spring", stiffness: 360, damping: 24 }}
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg glass-strong px-2.5 py-1 text-sm font-medium shadow-lg"
        >
          <SyllableWord word={entry.word} syllable={entry.syllable} />
          {bonus && <span className="ml-1">❤️</span>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The local player's bonus-alphabet progress. Letters still to use glow green
 *  (your remaining targets); letters already banked fade grey — so it reads at a
 *  glance which ones you still need. */
function AlphabetStrip({ used, hint }: { used: string; hint: string }) {
  const set = new Set(used);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-wrap justify-center gap-1">
        {BOMB_BONUS_ALPHABET.map((c) => (
          <span
            key={c}
            className={`grid h-7 w-7 place-items-center rounded-md text-sm font-bold uppercase transition-colors ${
              set.has(c)
                ? "bg-white/5 text-faint"
                : "bg-emerald-400/20 text-emerald-300"
            }`}
          >
            {c}
          </span>
        ))}
      </div>
      <span className="text-[0.65rem] text-faint">{hint}</span>
    </div>
  );
}

function BombResults({
  game,
  players,
  youId,
  t,
}: {
  game: BombPartyView;
  players: Record<string, Player>;
  youId: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const room = useStore((s) => s.room);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const isHost = room?.hostId === youId;
  const winner = game.winnerId ? players[game.winnerId] : null;

  return (
    <div className="grid flex-1 place-items-center">
      <Celebration />
      <GlassCard
        strong
        className="max-w-sm p-8 text-center"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="text-6xl">🏆</div>
        <div className="mt-3 text-sm uppercase tracking-[0.25em] text-faint">
          {t("bomb.winner")}
        </div>
        {winner ? (
          <>
            <div className="mt-2 flex items-center justify-center gap-3">
              <Avatar emoji={winner.avatar} color={winner.color} size={48} ring />
              <span className="font-display text-3xl font-semibold text-cloud">
                {winner.name}
              </span>
            </div>
            {game.winnerId === youId && (
              <div className="mt-2 text-accent">{t("bomb.youWin")}</div>
            )}
          </>
        ) : (
          <div className="mt-2 font-display text-2xl text-cloud">{t("bomb.gameOver")}</div>
        )}
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
