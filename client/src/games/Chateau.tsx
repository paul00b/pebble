import { useState } from "react";
import { motion } from "framer-motion";
import { Avatar, Button, GlassCard, cx } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import {
  chateauCardById,
  type ChateauCard,
  type ChateauDeck,
  type ChateauFx,
  type ChateauPlayerPublic,
  type ChateauScore,
  type ChateauShield,
  type ChateauView,
  type Player,
  type RoomState,
} from "@shared";

type T = (k: string, p?: Record<string, string | number>) => string;

const SHIELD_EMOJI: Record<ChateauShield, string> = {
  crown: "👑",
  castle: "🏰",
  feather: "🪶",
  cross: "✚",
  swords: "⚔️",
  black: "🛡️",
  wheat: "🌾",
};
const SHIELD_HEX: Record<ChateauShield, string> = {
  crown: "#7dd3fc",
  castle: "#c4b5fd",
  feather: "#86efac",
  cross: "#fdba74",
  swords: "#fb7185",
  black: "#94a3b8",
  wheat: "#fde047",
};
const DECK_HEX: Record<ChateauDeck, string> = { castle: "#c4b5fd", village: "#86efac" };

const sEmoji = (s: ChateauShield) => SHIELD_EMOJI[s];

/* ── Generated card text (always matches the engine) ─────────────────────── */
function fxLine(fx: ChateauFx, t: T): string {
  switch (fx.t) {
    case "gold": return t("ch.fx.gold", { n: fx.n });
    case "keys": return t("ch.fx.keys", { n: fx.n });
    case "goldPerShield": return t("ch.fx.goldPerShield", { n: fx.n, s: sEmoji(fx.s) });
    case "keysPerShield": return t("ch.fx.keysPerShield", { n: fx.n, s: sEmoji(fx.s) });
    case "goldPerBanner": return t("ch.fx.goldPerBanner");
    case "keysPerBanner": return t("ch.fx.keysPerBanner");
    case "goldPerEmpty": return t("ch.fx.goldPerEmpty");
    case "goldPerOccupied": return t("ch.fx.goldPerOccupied");
    case "goldPerCost": return t("ch.fx.goldPerCost", { n: fx.n, c: fx.c });
    case "banner": return t("ch.fx.banner", { n: fx.n });
    case "purseAll": return t("ch.fx.purseAll", { n: fx.n });
    case "fillPurses": return t("ch.fx.fillPurses", { n: fx.n });
    case "purseAllOrKeys": return t("ch.fx.purseAllOrKeys", { n: fx.n, k: fx.k });
    case "oppGold": return t("ch.fx.oppGold", { n: fx.n });
    case "oppKeys": return t("ch.fx.oppKeys", { n: fx.n });
    case "allKeys": return t("ch.fx.allKeys", { n: fx.n });
    case "neighborGoldOrKeys": return t("ch.fx.neighborGoldOrKeys", { s: sEmoji(fx.s), k: fx.k });
    case "neighborKeys": return t("ch.fx.neighborKeys", { s: sEmoji(fx.s) });
    case "neighborKeysBanners": return t("ch.fx.neighborKeysBanners");
    case "marketCost": return t(fx.res === "gold" ? "ch.fx.marketGold" : "ch.fx.marketKeys");
    case "keysPerPurse": return t("ch.fx.keysPerPurse");
  }
}
const fxText = (card: ChateauCard, t: T) => card.fx.map((f) => fxLine(f, t)).join(" · ");

function scoreText(sc: ChateauScore, t: T): string {
  switch (sc.t) {
    case "perShield": return t("ch.sc.perShield", { n: sc.n, s: sEmoji(sc.s) });
    case "absent": return t("ch.sc.absent", { n: sc.n, s: sEmoji(sc.s) });
    case "perKey": return t("ch.sc.perKey", { n: sc.n });
    case "perSet": return t("ch.sc.perSet", { n: sc.n, s: sc.set.map(sEmoji).join("") });
    case "adj":
      return t(sc.dir === "h" ? "ch.sc.adjH" : sc.dir === "v" ? "ch.sc.adjV" : "ch.sc.adjO", {
        n: sc.n,
        s: sEmoji(sc.s),
      });
    case "rowShield": return t("ch.sc.rowShield", { n: sc.n, s: sEmoji(sc.s) });
    case "colShield": return t("ch.sc.colShield", { n: sc.n, s: sEmoji(sc.s) });
    case "perBanner": return t("ch.sc.perBanner", { n: sc.n });
    case "perBannerSet": return t("ch.sc.perBannerSet", { n: sc.n, k: sc.size });
    case "purse":
      return sc.max >= 99
        ? t("ch.sc.purseNoMax", { n: sc.per })
        : t("ch.sc.purse", { n: sc.per, m: sc.max });
    case "perCost":
      return t(sc.min ? "ch.sc.perCostMin" : "ch.sc.perCost", { n: sc.n, c: sc.c });
    case "rowFull": return t("ch.sc.rowFull", { n: sc.n });
    case "colFull": return t("ch.sc.colFull", { n: sc.n });
    case "square": return t("ch.sc.square", { n: sc.n });
    case "faceDown": return t("ch.sc.faceDown", { n: sc.n });
  }
}

function Shields({ shields, size = 20 }: { shields: ChateauShield[]; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {shields.map((s, i) => (
        <span
          key={i}
          className="grid place-items-center rounded-md"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.62,
            background: `${SHIELD_HEX[s]}26`,
            border: `1px solid ${SHIELD_HEX[s]}66`,
          }}
        >
          {SHIELD_EMOJI[s]}
        </span>
      ))}
    </span>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export function Chateau({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as ChateauView;
  const youId = useStore((s) => s.youId);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;

  if (game.over) return <Results game={game} players={players} t={t} />;
  return <Table game={game} players={players} youId={youId} t={t} />;
}

function Table({
  game,
  players,
  youId,
  t,
}: {
  game: ChateauView;
  players: Record<string, Player>;
  youId: string | null;
  t: T;
}) {
  const gameAction = useStore((s) => s.gameAction);
  const [sel, setSel] = useState<number | null>(null);
  const [faceDown, setFaceDown] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const you = game.players.find((p) => p.id === youId) ?? null;
  const yourTurn = game.currentId === youId;
  const viewed = game.players.find((p) => p.id === (viewing ?? youId)) ?? game.players[0];
  const viewingSelf = viewed.id === youId;
  const selCard = sel != null ? game.market[game.messenger][sel] : null;

  const validCell = (cell: number): boolean => {
    if (!you || you.grid[cell] !== null) return false;
    if (you.placed === 0) return true;
    const r = Math.floor(cell / 3), c = cell % 3;
    return (
      (c > 0 && you.grid[cell - 1] !== null) ||
      (c < 2 && you.grid[cell + 1] !== null) ||
      (r > 0 && you.grid[cell - 3] !== null) ||
      (r < 2 && you.grid[cell + 3] !== null)
    );
  };

  const place = (cell: number) => {
    if (sel == null || !yourTurn || !viewingSelf || !validCell(cell)) return;
    gameAction({ type: "buy", index: sel, cell, faceDown });
    setSel(null);
    setFaceDown(false);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* players strip */}
      <div className="flex flex-wrap justify-center gap-2">
        {game.players.map((p) => {
          const pl = players[p.id];
          const turn = p.id === game.currentId;
          const isViewed = p.id === viewed.id;
          return (
            <button
              key={p.id}
              onClick={() => setViewing(p.id === youId ? null : p.id)}
              className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs transition"
              style={{
                background: turn ? "rgba(110,231,214,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  isViewed ? "rgba(255,255,255,0.45)" : turn ? "rgba(110,231,214,0.5)" : "rgba(255,255,255,0.08)"
                }`,
              }}
            >
              <Avatar emoji={pl?.avatar ?? "👤"} color={pl?.color ?? "#888"} size={24} />
              <span className={cx("max-w-16 truncate", turn ? "text-accent" : "text-mist")}>
                {pl?.name ?? "?"}
              </span>
              <span className="tabular-nums text-amber-300">🪙{p.gold}</span>
              <span className="tabular-nums text-sky-300">🗝️{p.keys}</span>
              {p.banners > 0 && <span className="tabular-nums text-violet-300">🚩{p.banners}</span>}
              <span className="tabular-nums text-faint">{p.placed}/9</span>
            </button>
          );
        })}
      </div>

      {/* market */}
      <GlassCard className="space-y-2 p-3">
        {(["castle", "village"] as const).map((deck) => {
          const active = game.messenger === deck;
          return (
            <div
              key={deck}
              className="rounded-xl p-2"
              style={{
                background: active ? `${DECK_HEX[deck]}14` : "transparent",
                border: `1px solid ${active ? `${DECK_HEX[deck]}55` : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold" style={{ color: DECK_HEX[deck] }}>
                  {active && "📜 "}
                  {t(`ch.deck.${deck}`)}
                </span>
                <span className="text-faint">{t("ch.deckLeft", { n: game.deckCounts[deck] })}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {game.market[deck].map((id, i) => {
                  if (!id)
                    return (
                      <div
                        key={i}
                        className="grid h-20 place-items-center rounded-lg border border-dashed border-white/10 text-faint"
                      >
                        ·
                      </div>
                    );
                  const card = chateauCardById(id);
                  const selectable = yourTurn && active;
                  const isSel = active && sel === i;
                  return (
                    <motion.button
                      key={`${id}-${i}`}
                      whileTap={selectable ? { scale: 0.96 } : undefined}
                      onClick={() => {
                        if (!selectable) return;
                        setSel(isSel ? null : i);
                        setFaceDown(false);
                      }}
                      className={cx(
                        "flex h-20 flex-col items-start justify-between rounded-lg p-1.5 text-left transition",
                        isSel ? "ring-2 ring-accent" : "",
                        selectable ? "bg-white/8 hover:bg-white/12" : "bg-white/4 opacity-80"
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <span className="truncate text-[0.7rem] font-semibold text-cloud">
                          {card.name}
                        </span>
                        <span className="shrink-0 rounded bg-amber-300/20 px-1 text-[0.65rem] font-bold tabular-nums text-amber-300">
                          {card.cost}
                        </span>
                      </div>
                      <Shields shields={card.shields} size={16} />
                      <div className="w-full truncate text-[0.6rem] leading-tight text-faint">
                        🎯 {scoreText(card.score, t)}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </GlassCard>

      {/* selected card detail + buy mode */}
      {yourTurn && selCard && you && (
        <GlassCard strong className="space-y-2 p-3">
          {(() => {
            const card = chateauCardById(selCard);
            const cost = Math.max(0, card.cost - you.banners);
            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-semibold text-cloud">{card.name}</span>
                    <Shields shields={card.shields} size={18} />
                  </div>
                  <span className="text-sm tabular-nums text-amber-300">
                    🪙 {cost}
                    {cost !== card.cost && (
                      <span className="ml-1 text-xs text-violet-300">({t("ch.discounted", { n: card.cost })})</span>
                    )}
                  </span>
                </div>
                <div className="text-xs text-mist">⚡ {fxText(card, t)}</div>
                <div className="text-xs text-mist">🎯 {scoreText(card.score, t)}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFaceDown(false)}
                    className={cx(
                      "flex-1 rounded-xl px-3 py-2 text-xs font-medium transition",
                      !faceDown ? "bg-accent text-ink-900" : "bg-white/5 text-mist hover:bg-white/10"
                    )}
                    disabled={you.gold < cost && !faceDown}
                  >
                    {you.gold >= cost ? t("ch.buyCard", { n: cost }) : t("ch.cantAfford")}
                  </button>
                  <button
                    onClick={() => setFaceDown(true)}
                    className={cx(
                      "flex-1 rounded-xl px-3 py-2 text-xs font-medium transition",
                      faceDown ? "bg-accent text-ink-900" : "bg-white/5 text-mist hover:bg-white/10"
                    )}
                  >
                    {t("ch.takeFaceDown")}
                  </button>
                </div>
                <p className="text-center text-xs text-accent">
                  {you.gold >= cost || faceDown ? t("ch.pickCell") : t("ch.orFaceDown")}
                </p>
              </>
            );
          })()}
        </GlassCard>
      )}

      {/* key actions */}
      {yourTurn && you && (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            full
            className="px-2 py-2 text-xs"
            disabled={you.keys < 1}
            onClick={() => gameAction({ type: "messenger" })}
          >
            📜 {t("ch.moveMessenger")} (1🗝️)
          </Button>
          <Button
            variant="ghost"
            full
            className="px-2 py-2 text-xs"
            disabled={you.keys < 1}
            onClick={() => gameAction({ type: "refresh" })}
          >
            🔄 {t("ch.refreshRow")} (1🗝️)
          </Button>
        </div>
      )}
      {!yourTurn && (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-2 text-center text-sm text-mist">
          {t("ch.waitingTurn", { name: players[game.currentId]?.name ?? "…" })}
        </div>
      )}

      {/* viewed grid */}
      <div className="text-center text-xs text-faint">
        {viewingSelf
          ? t("ch.yourGrid")
          : t("ch.gridOf", { name: players[viewed.id]?.name ?? "?" })}
      </div>
      <Grid
        player={viewed}
        t={t}
        highlight={viewingSelf && yourTurn && sel != null ? validCell : undefined}
        onCell={place}
      />
    </div>
  );
}

/* ── A 3×3 grid ───────────────────────────────────────────────────────────── */
function Grid({
  player,
  t,
  highlight,
  onCell,
  points,
}: {
  player: ChateauPlayerPublic;
  t: T;
  highlight?: (cell: number) => boolean;
  onCell?: (cell: number) => void;
  points?: (number | null)[];
}) {
  return (
    <div className="mx-auto grid w-full max-w-sm grid-cols-3 gap-1.5">
      {player.grid.map((slot, i) => {
        const hot = highlight?.(i) ?? false;
        const card = slot?.cardId ? chateauCardById(slot.cardId) : null;
        return (
          <motion.button
            key={i}
            disabled={!hot}
            onClick={() => onCell?.(i)}
            whileTap={hot ? { scale: 0.95 } : undefined}
            animate={hot ? { opacity: [0.7, 1, 0.7] } : {}}
            transition={hot ? { repeat: Infinity, duration: 1.4 } : undefined}
            className="relative flex aspect-[4/3] flex-col items-center justify-center gap-0.5 rounded-xl p-1 text-center"
            style={{
              background: slot
                ? slot.faceDown
                  ? "rgba(255,255,255,0.05)"
                  : `${DECK_HEX[card!.deck]}12`
                : hot
                  ? "rgba(110,231,214,0.12)"
                  : "rgba(255,255,255,0.03)",
              border: `1px solid ${
                hot
                  ? "rgba(110,231,214,0.7)"
                  : slot
                    ? "rgba(255,255,255,0.14)"
                    : "rgba(255,255,255,0.07)"
              }`,
            }}
          >
            {slot ? (
              slot.faceDown ? (
                <span className="text-xl">🂠</span>
              ) : (
                <>
                  <span className="w-full truncate text-[0.62rem] font-semibold leading-tight text-cloud">
                    {card!.name}
                  </span>
                  <Shields shields={card!.shields} size={14} />
                  {card!.purseMax != null && (
                    <span className="text-[0.6rem] tabular-nums text-amber-300">
                      👛 {slot.purse}
                    </span>
                  )}
                </>
              )
            ) : (
              <span className="text-faint">·</span>
            )}
            {points && points[i] != null && (
              <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[0.65rem] font-bold tabular-nums text-ink-900">
                {points[i]}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */
function Results({
  game,
  players,
  t,
}: {
  game: ChateauView;
  players: Record<string, Player>;
  t: T;
}) {
  const room = useStore((s) => s.room);
  const youId = useStore((s) => s.youId);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const isHost = room?.hostId === youId;
  const youWon = game.winnerId === youId;
  const ranked = [...game.players].sort(
    (a, b) => (game.scores?.[b.id]?.total ?? 0) - (game.scores?.[a.id]?.total ?? 0)
  );
  const winner = game.winnerId ? players[game.winnerId] : null;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <Celebration auto={youWon} />
      <div className="text-center">
        <div className="text-4xl">🏰</div>
        <div className="font-display text-2xl font-semibold text-cloud">
          {t("ch.wins", { name: winner ? `${winner.avatar} ${winner.name}` : "?" })}
        </div>
      </div>

      {ranked.map((p) => {
        const sc = game.scores?.[p.id];
        const pl = players[p.id];
        return (
          <GlassCard key={p.id} className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Avatar emoji={pl?.avatar ?? "👤"} color={pl?.color ?? "#888"} size={28} />
                <span className="font-medium text-cloud">{pl?.name ?? "?"}</span>
                {p.id === game.winnerId && <span>👑</span>}
              </div>
              <div className="text-right">
                <span className="font-display text-xl font-bold tabular-nums text-accent">
                  {sc?.total ?? 0}
                </span>
                <span className="ml-2 text-xs text-faint">
                  {t("ch.scoreDetail", { cards: sc?.cardPts ?? 0, keys: sc?.keyPts ?? 0 })}
                </span>
              </div>
            </div>
            <Grid player={p} t={t} points={sc?.cells} />
          </GlassCard>
        );
      })}

      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button full onClick={toLobby}>
            {t("common.backToLobby")}
          </Button>
          <Button full variant="ghost" onClick={retry}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <div className="text-center text-sm text-mist">{t("common.waitingHost")}</div>
      )}
    </div>
  );
}
