import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard, cx } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import {
  chateauCardById,
  chateauFamilyCounts,
  CHATEAU_SHIELDS,
  type ChateauCard,
  type ChateauCell,
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
  noble: "👑",
  religious: "🙏",
  scholar: "🪶",
  military: "⚔️",
  artisan: "🔨",
  peasant: "🌾",
};
const SHIELD_HEX: Record<ChateauShield, string> = {
  noble: "#60a5fa",
  religious: "#c084fc",
  scholar: "#4ade80",
  military: "#f87171",
  artisan: "#fb923c",
  peasant: "#facc15",
};
const DECK_HEX: Record<ChateauDeck, string> = { castle: "#c4b5fd", village: "#86efac" };

const sEmoji = (s: ChateauShield) => SHIELD_EMOJI[s];
const deckName = (t: T, d: ChateauDeck) => t(`ch.deck.${d}`);

/* ── Generated card text (always matches the engine) ─────────────────────── */
function fxLine(fx: ChateauFx, t: T): string {
  switch (fx.t) {
    case "gold": return t("ch.fx.gold", { n: fx.n });
    case "keys": return t("ch.fx.keys", { n: fx.n });
    case "goldPerShield": return t("ch.fx.goldPerShield", { n: fx.n, s: sEmoji(fx.s) });
    case "keysPerShield": return t("ch.fx.keysPerShield", { n: fx.n, s: sEmoji(fx.s) });
    case "goldPerDistinct": return t("ch.fx.goldPerDistinct", { n: fx.n });
    case "keysPerDistinct": return t("ch.fx.keysPerDistinct", { n: fx.n });
    case "keysPerAbsent": return t("ch.fx.keysPerAbsent", { n: fx.n });
    case "goldPerEmpty": return t("ch.fx.goldPerEmpty", { n: fx.n });
    case "goldPerOccupied": return t("ch.fx.goldPerOccupied", { n: fx.n });
    case "goldPerCost": return t("ch.fx.goldPerCost", { n: fx.n, c: fx.c });
    case "goldPerDeckCard": return t("ch.fx.goldPerDeckCard", { n: fx.n, deck: deckName(t, fx.deck) });
    case "keysPerDeckCard": return t("ch.fx.keysPerDeckCard", { n: fx.n, deck: deckName(t, fx.deck) });
    case "perCardShield":
      return t(fx.res === "gold" ? "ch.fx.perCardShieldGold" : "ch.fx.perCardShieldKeys", { n: fx.n, c: fx.count });
    case "keysPerPurseCard": return t("ch.fx.keysPerPurseCard", { n: fx.n });
    case "discount":
      return t(fx.scope === "both" ? "ch.fx.discountBoth" : fx.scope === "castle" ? "ch.fx.discountCastle" : "ch.fx.discountVillage");
    case "purseAll": return t("ch.fx.purseAll", { n: fx.n });
    case "fillPurses": return t("ch.fx.fillPurses", { n: fx.n });
    case "purseAllOrKeys": return t("ch.fx.purseAllOrKeys", { n: fx.n, k: fx.k });
    case "oppGold": return t("ch.fx.oppGold", { n: fx.n });
    case "oppKeys": return t("ch.fx.oppKeys", { n: fx.n });
    case "allKeys": return t("ch.fx.allKeys", { n: fx.n });
    case "neighborGoldOrKeys": return t("ch.fx.neighborGoldOrKeys", { s: sEmoji(fx.s), k: fx.k });
    case "neighborKeysPerShield": return t("ch.fx.neighborKeysPerShield", { s: sEmoji(fx.s) });
    case "neighborKeysPerDeckCard": return t("ch.fx.neighborKeysPerDeckCard", { deck: deckName(t, fx.deck) });
    case "neighborGoldOrKeysShield": return t("ch.fx.neighborGoldOrKeysShield", { g: sEmoji(fx.gs), k: sEmoji(fx.ks) });
    case "marketTake":
      return t(fx.res === "gold" ? "ch.fx.marketTakeGold" : "ch.fx.marketTakeKeys", { deck: deckName(t, fx.deck) });
  }
}
const fxText = (card: ChateauCard, t: T) => card.fx.map((f) => fxLine(f, t)).join(" · ");

function scoreText(sc: ChateauScore, t: T): string {
  switch (sc.t) {
    case "perShield": return t("ch.sc.perShield", { n: sc.n, s: sEmoji(sc.s) });
    case "absent": return t("ch.sc.absent", { n: sc.n, s: sEmoji(sc.s) });
    case "perKey": return t("ch.sc.perKey", { n: sc.n });
    case "perSet": return t("ch.sc.perSet", { n: sc.n, s: sc.set.map(sEmoji).join("") });
    case "perTripletAny": return t("ch.sc.perTripletAny", { n: sc.n });
    case "adj":
      return t(sc.dir === "h" ? "ch.sc.adjH" : sc.dir === "v" ? "ch.sc.adjV" : "ch.sc.adjO", { n: sc.n, s: sEmoji(sc.s) });
    case "distinctAdj":
      return t(sc.dir === "h" ? "ch.sc.distinctAdjH" : sc.dir === "v" ? "ch.sc.distinctAdjV" : "ch.sc.distinctAdjO", { n: sc.n });
    case "distinctRowShield": return t("ch.sc.distinctRow", { n: sc.n });
    case "distinctColShield": return t("ch.sc.distinctCol", { n: sc.n });
    case "perDistinctShield": return t("ch.sc.perDistinct", { n: sc.n });
    case "perAbsentShield": return t("ch.sc.perAbsent", { n: sc.n });
    case "perMultiShieldCard": return t("ch.sc.perMultiShieldCard", { n: sc.n });
    case "purse":
      return sc.max >= 99 ? t("ch.sc.purseNoMax", { n: sc.per }) : t("ch.sc.purse", { n: sc.per, m: sc.max });
    case "totalPurse": return t("ch.sc.totalPurse", { n: sc.n });
    case "perCost": return t(sc.min ? "ch.sc.perCostMin" : "ch.sc.perCost", { n: sc.n, c: sc.c });
    case "perDeckCard": return t("ch.sc.perDeckCard", { n: sc.n, deck: deckName(t, sc.deck) });
    case "perDeckPair": return t("ch.sc.perDeckPair", { n: sc.n });
    case "perDeckSet": return t("ch.sc.perDeckSet", { n: sc.n, k: sc.size, deck: deckName(t, sc.deck) });
    case "perReductionCard": return t("ch.sc.perReductionCard", { n: sc.n });
    case "position": return t(`ch.sc.pos.${sc.where}`, { n: sc.n });
    case "faceDown": return t("ch.sc.faceDown", { n: sc.n });
  }
}

function Shields({ shields, size = 18 }: { shields: ChateauShield[]; size?: number }) {
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

/* ── Tableau geometry (floating coordinate plane) ─────────────────────────── */
const cellAt = (cells: ChateauCell[], x: number, y: number): ChateauCell | undefined =>
  cells.find((c) => c.x === x && c.y === y);

function box(cells: ChateauCell[]) {
  if (cells.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let minX = cells[0].x, maxX = cells[0].x, minY = cells[0].y, maxY = cells[0].y;
  for (const c of cells) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
  }
  return { minX, maxX, minY, maxY };
}

/** Valid placement coordinates for `you` (mirrors the engine's rules). */
function frontierCells(cells: ChateauCell[]): { x: number; y: number }[] {
  if (cells.length === 0) return [{ x: 0, y: 0 }];
  const b = box(cells);
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  for (const c of cells) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = c.x + dx, y = c.y + dy;
      const key = `${x},${y}`;
      if (seen.has(key) || cellAt(cells, x, y)) continue;
      const w = Math.max(b.maxX, x) - Math.min(b.minX, x);
      const h = Math.max(b.maxY, y) - Math.min(b.minY, y);
      if (w <= 2 && h <= 2) { seen.add(key); out.push({ x, y }); }
    }
  }
  return out;
}

/* ── A player's tableau ───────────────────────────────────────────────────── */
function Tableau({
  player,
  tile,
  frontier,
  onPlace,
  onInspect,
  points,
}: {
  player: ChateauPlayerPublic;
  tile: number;
  frontier?: { x: number; y: number }[];
  onPlace?: (x: number, y: number) => void;
  onInspect?: (cardId: string) => void;
  points?: number[];
}) {
  const coords = [
    ...player.cells.map((c) => ({ x: c.x, y: c.y })),
    ...(frontier ?? []),
  ];
  if (coords.length === 0) coords.push({ x: 0, y: 0 });
  let minX = coords[0].x, maxX = coords[0].x, minY = coords[0].y, maxY = coords[0].y;
  for (const c of coords) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
  }
  const cols = maxX - minX + 1, rows = maxY - minY + 1;
  const inFrontier = (x: number, y: number) => (frontier ?? []).some((f) => f.x === x && f.y === y);

  const slots: ReactNode[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const slot = cellAt(player.cells, x, y);
      const key = `${x},${y}`;
      if (slot) {
        const idx = player.cells.indexOf(slot);
        const card = slot.cardId ? chateauCardById(slot.cardId) : null;
        slots.push(
          <button
            key={key}
            disabled={!card || !onInspect}
            onClick={() => card && onInspect?.(card.id)}
            className="relative flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg p-0.5 text-center"
            style={{
              width: tile, height: tile,
              background: slot.faceDown ? "rgba(255,255,255,0.05)" : `${DECK_HEX[card!.deck]}1a`,
              border: `1px solid ${slot.faceDown ? "rgba(255,255,255,0.12)" : `${DECK_HEX[card!.deck]}55`}`,
            }}
          >
            {slot.faceDown ? (
              <span style={{ fontSize: tile * 0.42 }}>🂠</span>
            ) : (
              <>
                <span
                  className="w-full truncate font-semibold leading-none text-cloud"
                  style={{ fontSize: Math.max(7, tile * 0.16) }}
                >
                  {card!.name}
                </span>
                <Shields shields={card!.shields} size={Math.max(11, tile * 0.3)} />
                <span className="flex items-center gap-0.5" style={{ fontSize: Math.max(8, tile * 0.2) }}>
                  {card!.purseMax != null && <span className="tabular-nums text-amber-300">👛{slot.purse}</span>}
                  {card!.switchMessenger && <span title="messenger">📜</span>}
                </span>
              </>
            )}
            {points != null && points[idx] != null && (
              <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1 text-[0.6rem] font-bold tabular-nums text-ink-900">
                {points[idx]}
              </span>
            )}
          </button>
        );
      } else if (inFrontier(x, y)) {
        slots.push(
          <motion.button
            key={key}
            onClick={() => onPlace?.(x, y)}
            whileTap={{ scale: 0.92 }}
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ repeat: Infinity, duration: 1.3 }}
            className="grid place-items-center rounded-lg font-bold text-accent"
            style={{
              width: tile, height: tile,
              background: "rgba(110,231,214,0.14)",
              border: "1px dashed rgba(110,231,214,0.7)",
              fontSize: tile * 0.4,
            }}
          >
            +
          </motion.button>
        );
      } else {
        slots.push(
          <div
            key={key}
            className="rounded-lg"
            style={{ width: tile, height: tile, background: "rgba(255,255,255,0.02)" }}
          />
        );
      }
    }
  }

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${cols}, ${tile}px)`, gridTemplateRows: `repeat(${rows}, ${tile}px)` }}
    >
      {slots}
    </div>
  );
}

/* ── Resource chips for a board header ────────────────────────────────────── */
function Chips({ p }: { p: ChateauPlayerPublic }) {
  return (
    <span className="flex flex-wrap items-center gap-1 text-[0.7rem]">
      <span className="tabular-nums text-amber-300">🪙{p.gold}</span>
      <span className="tabular-nums text-sky-300">🗝️{p.keys}</span>
      {(p.discountCastle > 0 || p.discountVillage > 0) && (
        <span className="tabular-nums text-violet-300">
          🏷️{p.discountCastle === p.discountVillage ? p.discountCastle : `${p.discountCastle}/${p.discountVillage}`}
        </span>
      )}
      <span className="tabular-nums text-faint">{p.placed}/9</span>
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
  const [glossary, setGlossary] = useState(false);
  const [detail, setDetail] = useState<{ cardId: string; pts?: number } | null>(null);

  const you = game.players.find((p) => p.id === youId) ?? null;
  const yourTurn = game.currentId === youId;
  const selCardId = sel != null ? game.market[game.messenger][sel] : null;
  const frontier = you && yourTurn && selCardId ? frontierCells(you.cells) : undefined;

  const place = (x: number, y: number) => {
    if (sel == null || !yourTurn) return;
    gameAction({ type: "buy", index: sel, x, y, faceDown });
    setSel(null);
    setFaceDown(false);
  };

  const others = game.players.filter((p) => p.id !== youId);

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* turn banner + glossary */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex-1 rounded-xl px-3 py-1.5 text-sm"
          style={{ background: yourTurn ? "rgba(110,231,214,0.12)" : "rgba(255,255,255,0.04)" }}
        >
          {yourTurn ? (
            <span className="font-medium text-accent">{t("ch.pickCell")}</span>
          ) : (
            <span className="text-mist">{t("ch.waitingTurn", { name: players[game.currentId]?.name ?? "…" })}</span>
          )}
        </div>
        <button
          onClick={() => setGlossary(true)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-mist transition hover:bg-white/10"
        >
          📖 {t("ch.glossary")}
        </button>
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
                <span className="font-semibold" style={{ color: DECK_HEX[deck] }}>{t(`ch.deck.${deck}`)}</span>
                <span className="text-faint">{t("ch.deckLeft", { n: game.deckCounts[deck] })}</span>
              </div>
              <div className="flex items-stretch gap-2">
                <div className="grid flex-1 grid-cols-3 gap-1.5">
                  {game.market[deck].map((id, i) => {
                    if (!id)
                      return (
                        <div
                          key={i}
                          className="grid min-h-28 place-items-center rounded-lg border border-dashed border-white/10 text-faint"
                        >
                          ·
                        </div>
                      );
                    const card = chateauCardById(id);
                    const buyable = yourTurn && active;
                    const isSel = active && sel === i;
                    return (
                      <motion.button
                        key={`${id}-${i}`}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          if (buyable) { setSel(isSel ? null : i); setFaceDown(false); }
                          else setDetail({ cardId: id });
                        }}
                        className={cx(
                          "flex min-h-28 flex-col items-start gap-1 rounded-lg p-1.5 text-left transition",
                          isSel ? "ring-2 ring-accent" : "",
                          buyable ? "bg-white/8 hover:bg-white/12" : "bg-white/4"
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <span className="truncate text-[0.7rem] font-semibold text-cloud">{card.name}</span>
                          <span className="flex shrink-0 items-center gap-0.5">
                            {card.switchMessenger && <span title={t("ch.movesMessenger")}>📜</span>}
                            <span className="rounded bg-amber-300/20 px-1 text-[0.65rem] font-bold tabular-nums text-amber-300">
                              {card.cost}
                            </span>
                          </span>
                        </div>
                        <Shields shields={card.shields} size={15} />
                        <div className="w-full text-[0.58rem] leading-tight text-emerald-200/90">⚡ {fxText(card, t)}</div>
                        <div className="w-full text-[0.58rem] leading-tight text-amber-200/80">🎯 {scoreText(card.score, t)}</div>
                      </motion.button>
                    );
                  })}
                </div>
                {active && (
                  <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-1 text-center">
                    <span className="text-xl">♟️</span>
                    <span className="text-[0.5rem] leading-tight text-accent">{t("ch.messenger")}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </GlassCard>

      {/* selected card → buy/place panel */}
      {yourTurn && selCardId && you && (
        (() => {
          const card = chateauCardById(selCardId);
          const discount = game.messenger === "castle" ? you.discountCastle : you.discountVillage;
          const cost = Math.max(0, card.cost - discount);
          const affordable = you.gold >= cost;
          return (
            <GlassCard strong className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-semibold text-cloud">{card.name}</span>
                  <Shields shields={card.shields} size={16} />
                  {card.switchMessenger && <span title={t("ch.movesMessenger")}>📜</span>}
                </div>
                <span className="text-sm tabular-nums text-amber-300">
                  🪙 {cost}
                  {cost !== card.cost && <span className="ml-1 text-xs text-violet-300">({t("ch.discounted", { n: card.cost })})</span>}
                </span>
              </div>
              <div className="text-xs text-emerald-200/90">⚡ {fxText(card, t)}</div>
              <div className="text-xs text-amber-200/80">🎯 {scoreText(card.score, t)}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFaceDown(false)}
                  disabled={!affordable}
                  className={cx(
                    "flex-1 rounded-xl px-3 py-2 text-xs font-medium transition disabled:opacity-40",
                    !faceDown ? "bg-accent text-ink-900" : "bg-white/5 text-mist hover:bg-white/10"
                  )}
                >
                  {affordable ? t("ch.buyCard", { n: cost }) : t("ch.cantAfford")}
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
                {affordable || faceDown ? t("ch.pickCell") : t("ch.orFaceDown")}
              </p>
            </GlassCard>
          );
        })()
      )}

      {/* key actions */}
      {yourTurn && you && (
        <div className="flex gap-2">
          <Button variant="ghost" full className="px-2 py-2 text-xs" disabled={you.keys < 1} onClick={() => gameAction({ type: "messenger" })}>
            📜 {t("ch.moveMessenger")} (1🗝️)
          </Button>
          <Button variant="ghost" full className="px-2 py-2 text-xs" disabled={you.keys < 1} onClick={() => gameAction({ type: "refresh" })}>
            🔄 {t("ch.refreshRow")} (1🗝️)
          </Button>
        </div>
      )}

      {/* your tableau (interactive placement) */}
      {you && (
        <div className="rounded-2xl border border-accent/30 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-cloud">{t("ch.yourTableau")}</span>
            <Chips p={you} />
          </div>
          <div className="flex justify-center">
            <Tableau
              player={you}
              tile={62}
              frontier={frontier}
              onPlace={place}
              onInspect={(cardId) => setDetail({ cardId })}
            />
          </div>
        </div>
      )}

      {/* every other tableau, live */}
      {others.length > 0 && (
        <div>
          <div className="mb-2 text-center text-xs text-faint">{t("ch.allBoards")}</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {others.map((p) => {
              const pl = players[p.id];
              const turn = p.id === game.currentId;
              return (
                <div
                  key={p.id}
                  className="rounded-2xl p-2"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${turn ? "rgba(110,231,214,0.5)" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Avatar emoji={pl?.avatar ?? "👤"} color={pl?.color ?? "#888"} size={20} />
                    <span className={cx("max-w-20 truncate text-xs", turn ? "text-accent" : "text-mist")}>{pl?.name ?? "?"}</span>
                  </div>
                  <Chips p={p} />
                  <div className="mt-1.5 flex justify-center">
                    <Tableau player={p} tile={40} onInspect={(cardId) => setDetail({ cardId })} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {glossary && <Glossary t={t} onClose={() => setGlossary(false)} />}
        {detail && <CardDetail cardId={detail.cardId} pts={detail.pts} t={t} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Card detail popover ──────────────────────────────────────────────────── */
function CardDetail({ cardId, pts, t, onClose }: { cardId: string; pts?: number; t: T; onClose: () => void }) {
  const card = chateauCardById(cardId);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.85, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-xs space-y-3 rounded-3xl p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-lg font-semibold text-cloud">{card.name}</div>
            <div className="text-xs" style={{ color: DECK_HEX[card.deck] }}>{t(`ch.deck.${card.deck}`)}</div>
          </div>
          <span className="rounded-lg bg-amber-300/20 px-2 py-0.5 text-sm font-bold tabular-nums text-amber-300">🪙 {card.cost}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shields shields={card.shields} size={22} />
          {card.shields.map((s, i) => (
            <span key={i} className="text-[0.65rem] text-mist">{t(`ch.fam.${s}`)}</span>
          ))}
        </div>
        <div className="rounded-xl bg-white/5 p-2">
          <div className="text-[0.65rem] uppercase tracking-wide text-faint">{t("ch.immediate")}</div>
          <div className="text-sm text-emerald-200/90">⚡ {fxText(card, t)}</div>
        </div>
        <div className="rounded-xl bg-white/5 p-2">
          <div className="text-[0.65rem] uppercase tracking-wide text-faint">{t("ch.endgame")}</div>
          <div className="text-sm text-amber-200/90">🎯 {scoreText(card.score, t)}</div>
        </div>
        {card.switchMessenger && <div className="text-xs text-accent">📜 {t("ch.movesMessenger")}</div>}
        {pts != null && (
          <div className="rounded-xl bg-accent/15 p-2 text-center text-sm font-semibold text-accent">
            ★ {t("ch.victoryPts", { n: pts })}
          </div>
        )}
        <Button full variant="ghost" onClick={onClose}>{t("ch.cardClose")}</Button>
      </motion.div>
    </motion.div>
  );
}

/* ── Glossary ─────────────────────────────────────────────────────────────── */
function Glossary({ t, onClose }: { t: T; onClose: () => void }) {
  const counts = chateauFamilyCounts();
  const legend: [string, string][] = [
    ["🪙", t("ch.leg.gold")],
    ["🗝️", t("ch.leg.keys")],
    ["👛", t("ch.leg.purse")],
    ["🏷️", t("ch.leg.discount")],
    ["♟️", t("ch.leg.messenger")],
    ["📜", t("ch.leg.switch")],
  ];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong max-h-[85vh] w-full max-w-sm space-y-4 overflow-y-auto rounded-3xl p-4"
      >
        <div className="font-display text-lg font-semibold text-cloud">📖 {t("ch.glossary")}</div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-faint">{t("ch.families")}</div>
          <div className="space-y-1.5">
            {CHATEAU_SHIELDS.map((s) => (
              <div key={s} className="flex items-center gap-2">
                <Shields shields={[s]} size={22} />
                <span className="flex-1 text-sm text-cloud">{t(`ch.fam.${s}`)}</span>
                <span className="text-xs tabular-nums text-faint">
                  {t("ch.countCastleVillage", { c: counts[s].castle, v: counts[s].village })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-faint">{t("ch.legend")}</div>
          <div className="space-y-1.5">
            {legend.map(([icon, desc]) => (
              <div key={icon} className="flex items-start gap-2 text-sm">
                <span className="w-6 shrink-0 text-center">{icon}</span>
                <span className="flex-1 text-mist">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-mist">
          <p>{t("ch.rule.goal")}</p>
          <p>{t("ch.rule.market")}</p>
          <p>{t("ch.rule.place")}</p>
          <p>{t("ch.rule.combo")}</p>
          <p>{t("ch.rule.score")}</p>
        </div>

        <Button full variant="ghost" onClick={onClose}>{t("ch.cardClose")}</Button>
      </motion.div>
    </motion.div>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */
function Results({ game, players, t }: { game: ChateauView; players: Record<string, Player>; t: T }) {
  const room = useStore((s) => s.room);
  const youId = useStore((s) => s.youId);
  const toLobby = useStore((s) => s.toLobby);
  const retry = useStore((s) => s.retry);
  const [detail, setDetail] = useState<{ cardId: string; pts?: number } | null>(null);
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
                <span className="font-display text-xl font-bold tabular-nums text-accent">{sc?.total ?? 0}</span>
                <span className="ml-2 text-xs text-faint">{t("ch.scoreDetail", { cards: sc?.cardPts ?? 0, keys: sc?.keyPts ?? 0 })}</span>
              </div>
            </div>
            <div className="flex justify-center">
              <Tableau
                player={p}
                tile={56}
                points={sc?.cells}
                onInspect={(cardId) => {
                  const idx = p.cells.findIndex((c) => c.cardId === cardId);
                  setDetail({ cardId, pts: idx >= 0 ? sc?.cells[idx] : undefined });
                }}
              />
            </div>
          </GlassCard>
        );
      })}

      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button full onClick={toLobby}>{t("common.backToLobby")}</Button>
          <Button full variant="ghost" onClick={retry}>{t("common.retry")}</Button>
        </div>
      ) : (
        <div className="text-center text-sm text-mist">{t("common.waitingHost")}</div>
      )}

      <AnimatePresence>
        {detail && <CardDetail cardId={detail.cardId} pts={detail.pts} t={t} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </div>
  );
}
