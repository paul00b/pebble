import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard, cx } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import {
  LL_CARD_ORDER,
  LL_VALUES,
  type LoveLetterCard,
  type LoveLetterView,
  type Player,
  type RoomState,
} from "@shared";

type T = (k: string, p?: Record<string, string | number>) => string;

const CARD_EMOJI: Record<LoveLetterCard, string> = {
  spy: "🕵️",
  guard: "💂",
  priest: "🙏",
  baron: "⚖️",
  handmaid: "🛡️",
  prince: "🤴",
  chancellor: "📜",
  king: "👑",
  countess: "👸",
  princess: "💖",
};

const needsOther = (c: LoveLetterCard) =>
  c === "guard" || c === "priest" || c === "baron" || c === "king";

export function LoveLetter({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as LoveLetterView;
  const youId = useStore((s) => s.youId);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;

  if (game.over) return <GameOver game={game} players={players} t={t} />;
  return <Round game={game} players={players} youId={youId} t={t} />;
}

const cardName = (c: LoveLetterCard, t: T) => `${CARD_EMOJI[c]} ${t(`ll.card.${c}`)}`;

/* ── A hand card ──────────────────────────────────────────────────────────── */
function HandCard({
  card,
  t,
  selected,
  disabled,
  onClick,
}: {
  card: LoveLetterCard;
  t: T;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={cx(
        "flex w-36 flex-col items-center gap-1 rounded-2xl border p-3 text-center transition",
        selected
          ? "border-accent bg-accent/15 ring-2 ring-accent"
          : "border-white/15 bg-white/5",
        disabled ? "opacity-40" : "hover:bg-white/10"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-display text-lg font-bold tabular-nums text-accent">
          {LL_VALUES[card]}
        </span>
        <span className="text-2xl">{CARD_EMOJI[card]}</span>
      </div>
      <div className="font-display text-sm font-semibold text-cloud">{t(`ll.card.${card}`)}</div>
      <div className="text-[0.65rem] leading-snug text-mist">{t(`ll.fx.${card}`)}</div>
    </motion.button>
  );
}

/* ── The round ────────────────────────────────────────────────────────────── */
function Round({
  game,
  players,
  youId,
  t,
}: {
  game: LoveLetterView;
  players: Record<string, Player>;
  youId: string | null;
  t: T;
}) {
  const room = useStore((s) => s.room);
  const gameAction = useStore((s) => s.gameAction);
  const isHost = room?.hostId === youId;
  const [sel, setSel] = useState<LoveLetterCard | null>(null);
  const [guess, setGuess] = useState<LoveLetterCard | null>(null);

  const you = game.players.find((p) => p.id === youId);
  const yourTurn = game.currentId === youId && game.phase === "turn";
  const chancellor = game.currentId === youId && game.phase === "chancellor";
  const roundEnd = game.phase === "roundEnd";
  const hasCountess = game.yourHand.includes("countess");

  const legalTargets = game.players
    .filter((p) => p.alive && !p.shielded && p.id !== youId)
    .map((p) => p.id);
  const selNeedsTarget = sel != null && (needsOther(sel) || sel === "prince");
  const selFizzles = sel != null && needsOther(sel) && legalTargets.length === 0;
  const awaitingGuess = sel === "guard" && !selFizzles && guess == null;
  const awaitingTarget = selNeedsTarget && !selFizzles && !awaitingGuess;

  const pick = (card: LoveLetterCard) => {
    if (!yourTurn) return;
    if (sel === card) {
      setSel(null);
      setGuess(null);
      return;
    }
    setSel(card);
    setGuess(null);
    if (!needsOther(card) && card !== "prince") {
      gameAction({ type: "play", card });
      setSel(null);
    }
  };

  const target = (id: string) => {
    if (!sel || !awaitingTarget) return;
    const valid = sel === "prince" ? id === youId || legalTargets.includes(id) : legalTargets.includes(id);
    if (!valid) return;
    gameAction({ type: "play", card: sel, target: id, guess: guess ?? undefined });
    setSel(null);
    setGuess(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* header */}
      <div className="flex items-center justify-between text-xs text-faint">
        <span>{t("ll.round", { n: game.round })}</span>
        <span>
          🂠 {t("ll.deck", { n: game.deckCount })} · ❤️ {t("ll.toWin", { n: game.tokensToWin })}
        </span>
      </div>

      {/* players */}
      <div className="flex flex-wrap justify-center gap-2">
        {game.players.map((p) => {
          const pl = players[p.id];
          const turn = p.id === game.currentId && !roundEnd;
          const targetable =
            awaitingTarget &&
            (sel === "prince" ? p.alive && (p.id === youId || legalTargets.includes(p.id)) : legalTargets.includes(p.id));
          const known = game.youKnow[p.id];
          return (
            <motion.button
              key={p.id}
              disabled={!targetable}
              onClick={() => target(p.id)}
              animate={targetable ? { scale: [1, 1.05, 1] } : {}}
              transition={targetable ? { repeat: Infinity, duration: 1.1 } : undefined}
              className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-center"
              style={{
                background: targetable
                  ? "rgba(251,113,133,0.12)"
                  : turn
                    ? "rgba(110,231,214,0.1)"
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  targetable ? "#fb7185" : turn ? "rgba(110,231,214,0.5)" : "rgba(255,255,255,0.08)"
                }`,
                opacity: p.alive ? 1 : 0.5,
              }}
            >
              <div className="flex items-center gap-1.5">
                <Avatar emoji={pl?.avatar ?? "👤"} color={pl?.color ?? "#888"} size={28} dim={!p.alive} />
                <div className="text-left">
                  <div className="max-w-20 truncate text-xs font-medium text-cloud">
                    {pl?.name ?? "?"}
                  </div>
                  <div className="text-[0.65rem] tabular-nums text-rose-300">
                    {"❤️".repeat(Math.min(p.tokens, 6))}
                    {p.tokens === 0 && <span className="text-faint">-</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[0.65rem]">
                {!p.alive && <span>☠️ {t("ll.out")}</span>}
                {p.alive && p.shielded && <span className="text-sky-300">🛡️ {t("ll.protected")}</span>}
                {known && (
                  <span className="rounded bg-amber-300/15 px-1 text-amber-300">
                    🤫 {cardName(known, t)}
                  </span>
                )}
              </div>
              {/* face-up discard trail */}
              {p.discards.length > 0 && (
                <div className="flex max-w-36 flex-wrap justify-center gap-0.5 text-[0.7rem]">
                  {p.discards.map((c, i) => (
                    <span key={i} title={t(`ll.card.${c}`)}>
                      {CARD_EMOJI[c]}
                    </span>
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* 2-player face-up removals */}
      {game.faceUp.length > 0 && (
        <div className="text-center text-xs text-faint">
          {t("ll.faceUp")} {game.faceUp.map((c) => cardName(c, t)).join(" · ")}
        </div>
      )}

      {/* last event narration */}
      {game.lastEvent && !roundEnd && <EventLine game={game} players={players} t={t} />}

      {/* round end reveal */}
      {roundEnd && game.roundResult && (
        <GlassCard strong className="space-y-2 p-4 text-center">
          <div className="font-display text-xl font-semibold text-cloud">
            💌 {t("ll.roundWon", { name: players[game.roundResult.winnerId ?? ""]?.name ?? "?" })}
          </div>
          <div className="text-xs text-mist">{t(`ll.reason.${game.roundResult.reason}`)}</div>
          <div className="flex flex-wrap justify-center gap-2 text-sm">
            {Object.entries(game.roundResult.revealed).map(([id, c]) => (
              <span key={id} className="rounded-xl bg-white/5 px-2 py-1">
                {players[id]?.name}: {cardName(c, t)} ({LL_VALUES[c]})
              </span>
            ))}
          </div>
          {game.roundResult.spyBonusId && (
            <div className="text-xs text-amber-300">
              🕵️ {t("ll.spyBonus", { name: players[game.roundResult.spyBonusId]?.name ?? "?" })}
            </div>
          )}
          {isHost ? (
            <Button full onClick={() => gameAction({ type: "next" })}>
              {t("ll.nextRound")}
            </Button>
          ) : (
            <div className="text-sm text-mist">{t("common.waitingHost")}</div>
          )}
        </GlassCard>
      )}

      {/* your hand / prompts */}
      <div className="mt-auto space-y-2">
        {!roundEnd && (
          <>
            {chancellor && (
              <p className="text-center text-sm text-accent">{t("ll.keepOne")}</p>
            )}
            {yourTurn && !sel && you?.alive && (
              <p className="text-center text-sm text-accent">{t("ll.yourTurn")}</p>
            )}
            {yourTurn && hasCountess && (game.yourHand.includes("king") || game.yourHand.includes("prince")) && (
              <p className="text-center text-xs text-amber-300">{t("ll.countessLock")}</p>
            )}
            {awaitingGuess && (
              <GuessGrid t={t} onGuess={(g) => setGuess(g)} />
            )}
            {awaitingTarget && (
              <p className="text-center text-sm text-rose-300">{t("ll.pickTarget")}</p>
            )}
            {selFizzles && sel && (
              <Button full variant="ghost" onClick={() => { gameAction({ type: "play", card: sel }); setSel(null); }}>
                {t("ll.noTarget")}
              </Button>
            )}
            {!yourTurn && !chancellor && you?.alive && (
              <p className="text-center text-sm text-mist">
                {t("ll.waiting", { name: players[game.currentId]?.name ?? "…" })}
              </p>
            )}
            {you && !you.alive && (
              <p className="text-center text-sm text-faint">☠️ {t("ll.youAreOut")}</p>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              {game.yourHand.map((card, i) => (
                <HandCard
                  key={`${card}-${i}`}
                  card={card}
                  t={t}
                  selected={sel === card}
                  disabled={
                    chancellor
                      ? false
                      : !yourTurn ||
                        ((card === "king" || card === "prince") && hasCountess)
                  }
                  onClick={() => (chancellor ? gameAction({ type: "keep", card }) : pick(card))}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Guard guess menu ─────────────────────────────────────────────────────── */
function GuessGrid({ t, onGuess }: { t: T; onGuess: (g: LoveLetterCard) => void }) {
  return (
    <GlassCard className="p-3">
      <p className="mb-2 text-center text-xs text-mist">{t("ll.pickGuess")}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {LL_CARD_ORDER.filter((c) => c !== "guard").map((c) => (
          <button
            key={c}
            onClick={() => onGuess(c)}
            className="rounded-lg bg-white/5 px-2 py-1.5 text-xs text-cloud transition hover:bg-white/10"
          >
            {LL_VALUES[c]} · {cardName(c, t)}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

/* ── Last-play narration ──────────────────────────────────────────────────── */
function EventLine({
  game,
  players,
  t,
}: {
  game: LoveLetterView;
  players: Record<string, Player>;
  t: T;
}) {
  const e = game.lastEvent!;
  const name = (id?: string | null) => (id && players[id]?.name) || "?";
  let line = t("ll.ev.played", { name: name(e.actor), card: cardName(e.card, t) });
  if (e.targetId) line += " " + t("ll.ev.target", { target: name(e.targetId) });
  if (e.guess) line += " " + t("ll.ev.guess", { guess: cardName(e.guess, t) });
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={e.at}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-mist"
      >
        {line}
        {e.noEffect && <span className="text-faint"> · {t("ll.ev.noEffect")}</span>}
        {e.tie && <span className="text-faint"> · {t("ll.ev.tie")}</span>}
        {e.eliminatedId && (
          <div className="mt-0.5 font-semibold text-rose-300">
            ☠️ {t("ll.ev.eliminated", { name: name(e.eliminatedId) })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Match over ───────────────────────────────────────────────────────────── */
function GameOver({
  game,
  players,
  t,
}: {
  game: LoveLetterView;
  players: Record<string, Player>;
  t: T;
}) {
  const room = useStore((s) => s.room);
  const youId = useStore((s) => s.youId);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const isHost = room?.hostId === youId;
  const winner = game.winnerId ? players[game.winnerId] : null;
  const youWon = game.winnerId === youId;
  const ranked = [...game.players].sort((a, b) => b.tokens - a.tokens);

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
        <div className="text-5xl">💌</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">
          {t("ll.matchWin", { name: winner ? `${winner.avatar} ${winner.name}` : "?" })}
        </div>
        <div className="mt-4 space-y-1.5 text-left text-sm">
          {ranked.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
              <span className="text-cloud">
                {players[p.id]?.avatar} {players[p.id]?.name}
              </span>
              <span className="tabular-nums text-rose-300">{"❤️".repeat(p.tokens) || "-"}</span>
            </div>
          ))}
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
