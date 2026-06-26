import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard, cx } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { remaining, useClock } from "@/lib/useClock";
import type { ExplodingCard, ExplodingView, Player, RoomState } from "@shared";

type T = (k: string, p?: Record<string, string | number>) => string;

const CARD_EMOJI: Record<ExplodingCard, string> = {
  ek: "🙀",
  defuse: "✂️",
  attack: "💢",
  skip: "⏭️",
  favor: "🤲",
  shuffle: "🔀",
  future: "🔮",
  nope: "🚫",
  tacocat: "🌮",
  cattermelon: "🍉",
  potatocat: "🥔",
  beardcat: "🧔",
  rainbowcat: "🌈",
};
const CARD_HEX: Record<ExplodingCard, string> = {
  ek: "#fb7185",
  defuse: "#86efac",
  attack: "#fca5a5",
  skip: "#7dd3fc",
  favor: "#fcd34d",
  shuffle: "#c4b5fd",
  future: "#a5b4fc",
  nope: "#fb7185",
  tacocat: "#fbbf24",
  cattermelon: "#4ade80",
  potatocat: "#fdba74",
  beardcat: "#d6b89a",
  rainbowcat: "#f0abfc",
};
const CAT_CARDS: ExplodingCard[] = ["tacocat", "cattermelon", "potatocat", "beardcat", "rainbowcat"];
const SOLO: ExplodingCard[] = ["attack", "skip", "favor", "shuffle", "future"];
const isCat = (c: ExplodingCard) => CAT_CARDS.includes(c);

const cardName = (t: T, c: ExplodingCard) => t(`ek.card.${c}`);

/* ── A single card tile ───────────────────────────────────────────────────── */
function Card({
  card,
  count,
  size = "md",
  badge,
  onClick,
  selected,
  t,
}: {
  card: ExplodingCard;
  count?: number;
  size?: "sm" | "md";
  badge?: string;
  onClick?: () => void;
  selected?: boolean;
  t: T;
}) {
  const w = size === "sm" ? 52 : 68;
  return (
    <motion.button
      whileTap={onClick ? { scale: 0.94 } : undefined}
      onClick={onClick}
      disabled={!onClick}
      className={cx("relative flex flex-col items-center justify-center gap-0.5 rounded-xl p-1 text-center", selected && "ring-2 ring-accent")}
      style={{
        width: w,
        height: w * 1.4,
        background: `${CARD_HEX[card]}1f`,
        border: `1px solid ${CARD_HEX[card]}66`,
      }}
    >
      <span style={{ fontSize: w * 0.5 }}>{CARD_EMOJI[card]}</span>
      <span className="w-full truncate px-0.5 leading-tight text-cloud" style={{ fontSize: Math.max(7, w * 0.13) }}>
        {cardName(t, card)}
      </span>
      {count != null && count > 1 && (
        <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-bold text-ink-900">
          {count}
        </span>
      )}
      {badge && (
        <span className="absolute -left-1 -top-1 rounded-full bg-ink-900/80 px-1 text-[0.6rem] text-cloud">{badge}</span>
      )}
    </motion.button>
  );
}

/* ── Countdown bar ────────────────────────────────────────────────────────── */
function Countdown({ game }: { game: ExplodingView }) {
  const clock = useClock();
  if (!game.deadline) return null;
  const { seconds, fraction } = remaining(clock, game.deadline - game.duration, game.deadline);
  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ width: `${fraction * 100}%`, background: fraction < 0.25 ? "#fb7185" : "var(--color-accent)" }}
        />
      </div>
      <div className="text-center text-xs tabular-nums text-faint">{Math.ceil(Math.max(0, seconds))}s</div>
    </div>
  );
}

export function Exploding({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as ExplodingView;
  const youId = useStore((s) => s.youId);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;
  if (game.over) return <Results game={game} players={players} t={t} />;
  return <Table game={game} players={players} youId={youId} t={t} />;
}

const nameOf = (players: Record<string, Player>, id?: string | null) => (id && players[id]?.name) || "?";

function eventText(game: ExplodingView, players: Record<string, Player>, t: T): string | null {
  const e = game.lastEvent;
  if (!e) return null;
  const who = nameOf(players, e.actorId);
  const whom = nameOf(players, e.targetId);
  switch (e.type) {
    case "play": return t("ek.log.play", { who, card: e.card ? cardName(t, e.card) : "?" });
    case "noped": return t("ek.log.noped", { who });
    case "attacked": return t("ek.log.attacked", { who, n: e.n ?? 2 });
    case "skipped": return t("ek.log.skipped", { who });
    case "shuffled": return t("ek.log.shuffled", { who });
    case "future": return t("ek.log.future", { who });
    case "favorGiven": return e.card ? t("ek.log.favor", { who: whom, whom: who }) : t("ek.log.favorNone", { who });
    case "stole": return e.card ? t("ek.log.stole", { who, whom }) : t("ek.log.stoleNone", { who, whom });
    case "drew": return t("ek.log.drew", { who });
    case "defused": return t("ek.log.defused", { who });
    case "exploded": return t("ek.log.exploded", { who });
    default: return null;
  }
}

function Table({ game, players, youId, t }: { game: ExplodingView; players: Record<string, Player>; youId: string | null; t: T }) {
  const gameAction = useStore((s) => s.gameAction);
  const [sel, setSel] = useState<ExplodingCard | null>(null);
  const [mode, setMode] = useState<"pair" | "triple" | null>(null);
  const [target, setTarget] = useState<string | null>(null);

  const yourTurn = game.currentId === youId;
  const inPlay = game.phase === "play" && yourTurn;
  const you = game.players.find((p) => p.id === youId);

  // Collapse the hand into unique types + counts.
  const counts = new Map<ExplodingCard, number>();
  for (const c of game.youHand) counts.set(c, (counts.get(c) ?? 0) + 1);
  const hand = [...counts.entries()];

  const opponents = game.players.filter((p) => p.id !== youId && p.alive);

  const reset = () => { setSel(null); setMode(null); setTarget(null); };

  const playSolo = (card: ExplodingCard, tgt?: string) => {
    gameAction({ type: "play", card, combo: "single", target: tgt });
    reset();
  };
  const playCombo = (card: ExplodingCard, combo: "pair" | "triple", tgt: string, named?: ExplodingCard) => {
    gameAction({ type: "play", card, combo, target: tgt, named });
    reset();
  };

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* players */}
      <div className="flex flex-wrap justify-center gap-2">
        {game.players.map((p) => {
          const pl = players[p.id];
          const turn = p.id === game.currentId && p.alive;
          return (
            <div
              key={p.id}
              className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs"
              style={{
                background: turn ? "rgba(110,231,214,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${turn ? "rgba(110,231,214,0.5)" : "rgba(255,255,255,0.08)"}`,
                opacity: p.alive ? 1 : 0.45,
              }}
            >
              <Avatar emoji={pl?.avatar ?? "👤"} color={pl?.color ?? "#888"} size={22} />
              <span className={cx("max-w-16 truncate", turn ? "text-accent" : "text-mist")}>{pl?.name ?? "?"}</span>
              {p.alive ? (
                <span className="tabular-nums text-faint">🂠{p.handCount}</span>
              ) : (
                <span title="out">💥</span>
              )}
              {turn && game.turnsLeft > 1 && <span className="tabular-nums text-rose-300">×{game.turnsLeft}</span>}
            </div>
          );
        })}
      </div>

      {/* deck + discard */}
      <GlassCard className="flex items-center justify-around p-3">
        <button
          onClick={() => inPlay && gameAction({ type: "draw" })}
          disabled={!inPlay || game.deckCount === 0}
          className={cx(
            "flex flex-col items-center gap-1 rounded-2xl px-5 py-3 transition",
            inPlay ? "bg-accent/15 ring-1 ring-accent/50 hover:bg-accent/25" : "bg-white/5"
          )}
        >
          <span className="text-3xl">🂠</span>
          <span className="text-xs tabular-nums text-mist">{t("ek.deckLeft", { n: game.deckCount })}</span>
          {inPlay && <span className="text-[0.65rem] font-semibold text-accent">{t("ek.draw")}</span>}
        </button>
        <div className="flex flex-col items-center gap-1">
          {game.discardTop ? <Card card={game.discardTop} t={t} /> : <div className="grid h-24 w-16 place-items-center rounded-xl border border-dashed border-white/10 text-faint">·</div>}
          <span className="text-[0.65rem] text-faint">{t("ek.discard")}</span>
        </div>
      </GlassCard>

      {/* turn / status banner */}
      <div className="rounded-xl px-3 py-2 text-center text-sm" style={{ background: yourTurn ? "rgba(110,231,214,0.12)" : "rgba(255,255,255,0.04)" }}>
        {inPlay ? (
          <span className="text-accent">{game.turnsLeft > 1 ? t("ek.yourTurnN", { n: game.turnsLeft }) : t("ek.yourTurn")}</span>
        ) : (
          <span className="text-mist">{t("ek.waiting", { name: nameOf(players, game.currentId) })}</span>
        )}
      </div>

      {/* See the Future peek */}
      {game.future && (
        <GlassCard strong className="space-y-2 p-3">
          <div className="text-center text-xs text-faint">{t("ek.futureTitle")}</div>
          <div className="flex justify-center gap-2">
            {game.future.map((c, i) => <Card key={i} card={c} size="sm" badge={`${i + 1}`} t={t} />)}
          </div>
        </GlassCard>
      )}

      {/* Reaction window (everyone sees it) */}
      {game.phase === "react" && game.pending && (
        <GlassCard strong className="space-y-2 p-3">
          <div className="text-center text-sm text-cloud">
            {t("ek.pending", {
              who: nameOf(players, game.pending.actorId),
              card: t(`ek.kind.${game.pending.kind}`),
            })}
            {game.pending.targetId && <> → {nameOf(players, game.pending.targetId)}</>}
            {game.pending.nopes % 2 === 1 && <span className="ml-1 font-bold text-rose-300">{t("ek.noped")}</span>}
          </div>
          <Countdown game={game} />
          {game.youCanNope && (
            <Button full variant="danger" onClick={() => gameAction({ type: "nope" })}>
              🚫 {t("ek.nope")}
            </Button>
          )}
        </GlassCard>
      )}

      {/* Favor: you must give */}
      {game.youMustGive && (
        <GlassCard strong className="space-y-2 p-3">
          <div className="text-center text-sm text-cloud">{t("ek.giveTo", { name: nameOf(players, game.pending?.actorId) })}</div>
          <Countdown game={game} />
          <div className="flex flex-wrap justify-center gap-2">
            {game.youHand.map((c, i) => (
              <Card key={i} card={c} size="sm" t={t} onClick={() => gameAction({ type: "give", index: i })} />
            ))}
          </div>
        </GlassCard>
      )}

      {/* Insert: place the defused kitten */}
      {game.youMustInsert && (
        <GlassCard strong className="space-y-2 p-3">
          <div className="text-center text-sm text-rose-200">🙀 {t("ek.insertTitle")}</div>
          <Countdown game={game} />
          <div className="grid grid-cols-2 gap-2">
            {([
              ["ek.insTop", 0],
              ["ek.insSecond", 1],
              ["ek.insMiddle", Math.floor(game.deckCount / 2)],
              ["ek.insBottom", game.deckCount],
            ] as const).map(([key, idx]) => (
              <Button key={key} variant="ghost" className="text-xs" onClick={() => gameAction({ type: "insert", index: idx })}>
                {t(key)}
              </Button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Your hand + action panel */}
      {you && (
        <div className="mt-auto space-y-2">
          {sel && (
            <GlassCard strong className="space-y-2 p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{CARD_EMOJI[sel]}</span>
                <div>
                  <div className="text-sm font-semibold text-cloud">{cardName(t, sel)}</div>
                  <div className="text-xs text-mist">{t(`ek.cardDesc.${sel}`)}</div>
                </div>
              </div>

              {/* Solo, no target */}
              {SOLO.includes(sel) && sel !== "favor" && (
                <Button full onClick={() => playSolo(sel)}>{t("ek.play")}</Button>
              )}

              {/* Favor → pick a target */}
              {sel === "favor" && (
                <TargetRow label={t("ek.askWhom")} opponents={opponents} players={players} onPick={(id) => playSolo("favor", id)} />
              )}

              {/* Cat → pick pair/triple then target (+named) */}
              {isCat(sel) && (
                <div className="space-y-2">
                  {!mode && (
                    <div className="flex gap-2">
                      <Button full variant="ghost" className="text-xs" disabled={(counts.get(sel) ?? 0) < 2} onClick={() => setMode("pair")}>
                        {t("ek.comboPair")}
                      </Button>
                      <Button full variant="ghost" className="text-xs" disabled={(counts.get(sel) ?? 0) < 3} onClick={() => setMode("triple")}>
                        {t("ek.comboTriple")}
                      </Button>
                    </div>
                  )}
                  {mode === "pair" && (
                    <TargetRow label={t("ek.stealFrom")} opponents={opponents} players={players} onPick={(id) => playCombo(sel, "pair", id)} />
                  )}
                  {mode === "triple" && !target && (
                    <TargetRow label={t("ek.demandFrom")} opponents={opponents} players={players} onPick={(id) => setTarget(id)} />
                  )}
                  {mode === "triple" && target && (
                    <div className="space-y-1">
                      <div className="text-center text-xs text-faint">{t("ek.demandWhat", { name: nameOf(players, target) })}</div>
                      <div className="flex flex-wrap justify-center gap-1">
                        {([...SOLO, ...CAT_CARDS, "defuse", "nope"] as ExplodingCard[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => playCombo(sel, "triple", target, c)}
                            className="rounded-lg px-2 py-1 text-xs"
                            style={{ background: `${CARD_HEX[c]}22`, border: `1px solid ${CARD_HEX[c]}66` }}
                          >
                            {CARD_EMOJI[c]} {cardName(t, c)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button full variant="ghost" className="text-xs" onClick={reset}>{t("ek.cancel")}</Button>
            </GlassCard>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {hand.map(([card, count]) => {
              const playable = inPlay && (SOLO.includes(card) || isCat(card));
              return (
                <Card
                  key={card}
                  card={card}
                  count={count}
                  t={t}
                  selected={sel === card}
                  onClick={playable ? () => { setSel(sel === card ? null : card); setMode(null); setTarget(null); } : undefined}
                />
              );
            })}
            {game.youHand.length === 0 && <span className="py-4 text-sm text-faint">{t("ek.emptyHand")}</span>}
          </div>

          {eventText(game, players, t) && (
            <div className="text-center text-xs text-faint">{eventText(game, players, t)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function TargetRow({
  label,
  opponents,
  players,
  onPick,
}: {
  label: string;
  opponents: ExplodingView["players"];
  players: Record<string, Player>;
  onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-center text-xs text-faint">{label}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {opponents.map((p) => {
          const pl = players[p.id];
          return (
            <button key={p.id} onClick={() => onPick(p.id)} className="flex items-center gap-1.5 rounded-xl bg-white/5 px-2 py-1.5 text-xs text-cloud hover:bg-white/10">
              <Avatar emoji={pl?.avatar ?? "👤"} color={pl?.color ?? "#888"} size={20} />
              {pl?.name ?? "?"} <span className="text-faint">🂠{p.handCount}</span>
            </button>
          );
        })}
        {opponents.length === 0 && <span className="text-xs text-faint">—</span>}
      </div>
    </div>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */
function Results({ game, players, t }: { game: ExplodingView; players: Record<string, Player>; t: T }) {
  const room = useStore((s) => s.room);
  const youId = useStore((s) => s.youId);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const isHost = room?.hostId === youId;
  const winner = game.winnerId ? players[game.winnerId] : null;
  const youWon = game.winnerId === youId;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-6">
      <Celebration auto={youWon} />
      <div className="text-center">
        <div className="text-5xl">🐱</div>
        <div className="font-display text-2xl font-semibold text-cloud">
          {t("ek.wins", { name: winner ? `${winner.avatar} ${winner.name}` : "?" })}
        </div>
        <div className="mt-1 text-sm text-mist">{t("ek.lastStanding")}</div>
      </div>
      <AnimatePresence>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xs">
          {isHost ? (
            <div className="flex flex-col gap-2">
              <Button full onClick={toLobby}>{t("common.backToLobby")}</Button>
              <Button full variant="ghost" onClick={retry}>{t("common.retry")}</Button>
            </div>
          ) : (
            <div className="text-center text-sm text-mist">{t("common.waitingHost")}</div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
