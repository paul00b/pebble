import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { Celebration } from "@/components/Celebration";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";
import { remaining, useClock } from "@/lib/useClock";
import type {
  ComplotsActKind,
  ComplotsRole,
  ComplotsView,
  Player,
  RoomState,
} from "@shared";

type T = (k: string, p?: Record<string, string | number>) => string;

const ROLE_EMOJI: Record<ComplotsRole, string> = {
  duke: "👑",
  assassin: "🗡️",
  captain: "⚓",
  contessa: "🛡️",
};
const ROLE_HEX: Record<ComplotsRole, string> = {
  duke: "#c4b5fd",
  assassin: "#fb7185",
  captain: "#7dd3fc",
  contessa: "#fcd34d",
};

export function Complots({ room }: { room: RoomState }) {
  const t = useT();
  const game = room.game as ComplotsView;
  const youId = useStore((s) => s.youId);
  const players = Object.fromEntries(room.players.map((p) => [p.id, p])) as Record<string, Player>;

  if (game.phase === "over") return <Results game={game} players={players} t={t} />;
  return <Table game={game} players={players} youId={youId} t={t} />;
}

const name = (players: Record<string, Player>, id?: string | null) =>
  (id && players[id]?.name) || "?";

/* ── Countdown ring for reaction windows / resolve pause ─────────────────── */
function Countdown({ game }: { game: ComplotsView }) {
  const clock = useClock();
  if (!game.deadline) return null;
  const { seconds, fraction } = remaining(clock, game.deadline - game.duration, game.deadline);
  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{
            width: `${fraction * 100}%`,
            background: fraction < 0.25 ? "#fb7185" : "var(--color-accent)",
          }}
        />
      </div>
      <div className="text-center text-xs tabular-nums text-faint">
        {Math.ceil(Math.max(0, seconds))}s
      </div>
    </div>
  );
}

/* ── A face-up role card chip ─────────────────────────────────────────────── */
function RoleChip({ role, t, big }: { role: ComplotsRole; t: T; big?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl font-semibold ${
        big ? "px-4 py-2 text-lg" : "px-2 py-0.5 text-xs"
      }`}
      style={{
        background: `${ROLE_HEX[role]}22`,
        border: `1px solid ${ROLE_HEX[role]}88`,
        color: ROLE_HEX[role],
      }}
    >
      {ROLE_EMOJI[role]} {t(`cp.role.${role}`)}
    </span>
  );
}

/* ── The table ────────────────────────────────────────────────────────────── */
function Table({
  game,
  players,
  youId,
  t,
}: {
  game: ComplotsView;
  players: Record<string, Player>;
  youId: string | null;
  t: T;
}) {
  const gameAction = useStore((s) => s.gameAction);
  const [targeting, setTargeting] = useState<ComplotsActKind | null>(null);
  const yourTurn = game.currentId === youId && game.phase === "action";
  const you = game.players.find((p) => p.id === youId);

  const pick = (act: ComplotsActKind) => {
    if (act === "steal" || act === "assassin" || act === "coup") {
      setTargeting((cur) => (cur === act ? null : act));
    } else {
      setTargeting(null);
      gameAction({ type: "act", act });
    }
  };
  const target = (id: string) => {
    if (!targeting || id === youId) return;
    const victim = game.players.find((p) => p.id === id);
    if (!victim?.alive) return;
    gameAction({ type: "act", act: targeting, target: id });
    setTargeting(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 pb-6">
      {/* players around the table */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {game.players.map((p) => {
          const pl = players[p.id];
          const isTurn = p.id === game.currentId && game.phase !== "over";
          const targetable = !!targeting && p.alive && p.id !== youId;
          return (
            <motion.button
              key={p.id}
              disabled={!targetable}
              onClick={() => target(p.id)}
              whileTap={targetable ? { scale: 0.95 } : undefined}
              animate={targetable ? { scale: [1, 1.04, 1] } : {}}
              transition={targetable ? { repeat: Infinity, duration: 1.2 } : undefined}
              className="flex flex-col items-center gap-1 rounded-2xl p-2.5 text-center"
              style={{
                background: targetable
                  ? "rgba(251,113,133,0.12)"
                  : isTurn
                    ? "rgba(110,231,214,0.1)"
                    : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  targetable
                    ? "#fb7185"
                    : isTurn
                      ? "rgba(110,231,214,0.5)"
                      : "rgba(255,255,255,0.08)"
                }`,
                opacity: p.alive ? 1 : 0.55,
              }}
            >
              <Avatar emoji={pl?.avatar ?? "👤"} color={pl?.color ?? "#888"} size={36} dim={!p.alive} />
              <div className="max-w-full truncate text-xs font-medium text-cloud">
                {pl?.name ?? "?"} {p.id === youId && <span className="text-faint">({t("common.you")})</span>}
              </div>
              {p.alive ? (
                <>
                  <div className="text-xs tabular-nums text-amber-300">🪙 {p.coins}</div>
                  <Influence influence={p.influence} revealed={p.revealed} t={t} />
                </>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-xs text-faint">☠️</div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {p.revealed.map((r, i) => (
                      <RoleChip key={i} role={r} t={t} />
                    ))}
                  </div>
                </div>
              )}
              {targetable && <div className="text-[0.65rem] text-rose-300">{t("cp.target")}</div>}
            </motion.button>
          );
        })}
      </div>

      {/* your hidden cards */}
      {you?.alive && game.youCards.length > 0 && <YourCards roles={game.youCards} t={t} />}
      {you && !you.alive && (
        <p className="text-center text-sm text-faint">☠️ {t("cp.youAreOut")}</p>
      )}

      {/* phase area */}
      <div className="flex flex-1 flex-col justify-end gap-3">
        {game.phase === "action" &&
          (yourTurn ? (
            <Actions game={game} t={t} targeting={targeting} onPick={pick} />
          ) : (
            <GlassCard className="p-4 text-center text-sm text-mist">
              {t("cp.waitingTurn", { name: name(players, game.currentId) })}
            </GlassCard>
          ))}

        {(game.phase === "react" || game.phase === "blockReact") && (
          <Reaction game={game} players={players} t={t} />
        )}

        {game.phase === "lose" && <Lose game={game} players={players} t={t} />}

        {game.phase === "resolve" && <Resolve game={game} players={players} t={t} />}
      </div>
    </div>
  );
}

/* ── Influence indicator: face-down pips + lost cards ─────────────────────── */
function Influence({
  influence,
  revealed,
  t,
}: {
  influence: number;
  revealed: ComplotsRole[];
  t: T;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: influence }).map((_, i) => (
        <span key={`d${i}`} className="h-2.5 w-2.5 rounded-full bg-white/45" />
      ))}
      {revealed.map((r, i) => (
        <span
          key={`r${i}`}
          title={t(`cp.role.${r}`)}
          className="text-sm leading-none opacity-90"
          style={{ color: ROLE_HEX[r] }}
        >
          {ROLE_EMOJI[r]}
        </span>
      ))}
    </div>
  );
}

/* ── Your hidden cards (tap to peek) ──────────────────────────────────────── */
function YourCards({ roles, t }: { roles: ComplotsRole[]; t: T }) {
  const [shown, setShown] = useState(false);
  return (
    <motion.button
      onClick={() => setShown((v) => !v)}
      whileTap={{ scale: 0.98 }}
      className="mx-auto flex min-h-14 w-full max-w-xs flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 transition hover:bg-white/8"
    >
      {shown ? (
        roles.map((role, i) => <RoleChip key={i} role={role} t={t} big />)
      ) : (
        <span className="text-sm text-mist">🂠🂠 {t("sf.tapToPeek")}</span>
      )}
    </motion.button>
  );
}

/* ── Lose phase: pick which influence to give up ──────────────────────────── */
function Lose({
  game,
  players,
  t,
}: {
  game: ComplotsView;
  players: Record<string, Player>;
  t: T;
}) {
  const gameAction = useStore((s) => s.gameAction);

  if (game.youMustLose) {
    return (
      <GlassCard strong className="space-y-3 p-4 text-center">
        <div className="font-display text-lg font-semibold text-rose-200">
          {t("cp.pickCardToLose")}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {game.youCards.map((role, i) => (
            <button
              key={i}
              onClick={() => gameAction({ type: "lose", index: i })}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-rose-300/70 hover:bg-rose-400/15"
            >
              <RoleChip role={role} t={t} big />
            </button>
          ))}
        </div>
        <Countdown game={game} />
      </GlassCard>
    );
  }

  return (
    <GlassCard strong className="space-y-3 p-4 text-center">
      <div className="text-sm text-mist">
        {t("cp.waitingLose", { name: name(players, game.losingId) })}
      </div>
      <Countdown game={game} />
    </GlassCard>
  );
}

/* ── Your turn: pick an action ────────────────────────────────────────────── */
function Actions({
  game,
  t,
  targeting,
  onPick,
}: {
  game: ComplotsView;
  t: T;
  targeting: ComplotsActKind | null;
  onPick: (act: ComplotsActKind) => void;
}) {
  const you = game.players.find((p) => p.id === game.currentId);
  const coins = you?.coins ?? 0;
  const acts: { act: ComplotsActKind; label: string; sub: string; disabled?: boolean }[] = [
    { act: "income", label: t("cp.act.income"), sub: "+1 🪙" },
    { act: "foreign", label: t("cp.act.foreign"), sub: "+2 🪙" },
    { act: "tax", label: t("cp.act.tax"), sub: `+3 🪙 · 👑` },
    { act: "steal", label: t("cp.act.steal"), sub: `+2 🪙 · ⚓` },
    { act: "assassin", label: t("cp.act.assassin"), sub: `−3 🪙 · 🗡️`, disabled: coins < 3 },
    { act: "coup", label: t("cp.act.coup"), sub: `−7 🪙 · 💥`, disabled: coins < 7 },
  ];
  return (
    <GlassCard strong className="p-4">
      <div className="mb-2 text-center text-sm font-semibold text-accent">
        {game.mustCoup ? t("cp.mustCoup") : t("cp.yourTurn")}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {acts.map(({ act, label, sub, disabled }) => {
          const locked = disabled || (game.mustCoup && act !== "coup");
          const active = targeting === act;
          return (
            <button
              key={act}
              disabled={locked}
              onClick={() => onPick(act)}
              className={`rounded-xl px-3 py-2.5 text-left transition disabled:opacity-30 ${
                active
                  ? "bg-rose-400/20 ring-1 ring-rose-300"
                  : "bg-white/5 enabled:hover:bg-white/10"
              }`}
            >
              <div className="text-sm font-medium text-cloud">{label}</div>
              <div className="text-xs text-faint">{sub}</div>
            </button>
          );
        })}
      </div>
      {targeting && (
        <p className="mt-2 text-center text-xs text-rose-300">{t("cp.pickTarget")}</p>
      )}
    </GlassCard>
  );
}

/* ── Reaction window: pass / liar! / block ────────────────────────────────── */
function Reaction({
  game,
  players,
  t,
}: {
  game: ComplotsView;
  players: Record<string, Player>;
  t: T;
}) {
  const gameAction = useStore((s) => s.gameAction);
  const p = game.pending;
  if (!p) return null;
  const actor = name(players, p.actorId);
  const tgt = name(players, p.targetId);
  const onBlock = game.phase === "blockReact";

  const headline = onBlock
    ? t("cp.blockClaim", {
        name: name(players, p.blockerId),
        role: t(`cp.role.${p.blockRole ?? "duke"}`),
      })
    : t(`cp.pending.${p.act}`, { name: actor, target: tgt });

  const idle = !game.youCanPass && !game.youCanChallenge && !game.youCanBlock;

  return (
    <GlassCard strong className="space-y-3 p-4">
      <div className="text-center">
        <div className="font-display text-lg font-semibold text-cloud">{headline}</div>
        {!onBlock && p.claim && (
          <div className="mt-1.5">
            <RoleChip role={p.claim} t={t} />
          </div>
        )}
        {onBlock && p.blockRole && (
          <div className="mt-1.5">
            <RoleChip role={p.blockRole} t={t} />
          </div>
        )}
      </div>
      <Countdown game={game} />

      {idle ? (
        <p className="text-center text-xs text-faint">
          {game.passed.length > 0
            ? t("cp.waitingOthers", { n: game.passed.length })
            : t("cp.waitingReact")}
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          {game.youCanPass && (
            <Button full variant="ghost" onClick={() => gameAction({ type: "pass" })}>
              👌 {t("cp.pass")}
            </Button>
          )}
          {game.youCanBlock && (
            <Button full variant="ghost" onClick={() => gameAction({ type: "block" })}>
              ✋ {t("cp.block", { role: t(`cp.role.${blockRoleFor(p.act)}`) })}
            </Button>
          )}
          {game.youCanChallenge && (
            <Button full variant="danger" onClick={() => gameAction({ type: "challenge" })}>
              🤥 {t("cp.liar")}
            </Button>
          )}
        </div>
      )}
    </GlassCard>
  );
}

function blockRoleFor(act: ComplotsActKind): ComplotsRole {
  if (act === "foreign") return "duke";
  if (act === "steal") return "captain";
  return "contessa";
}

/* ── Resolve splash: the dramatic card flip ───────────────────────────────── */
function Resolve({
  game,
  players,
  t,
}: {
  game: ComplotsView;
  players: Record<string, Player>;
  t: T;
}) {
  const e = game.lastEvent;
  if (!e) return null;

  let headline = "";
  if (e.type === "challenge") {
    headline = t("cp.challengeCalled", {
      challenger: name(players, e.challengerId),
      challenged: name(players, e.challengedId),
    });
  } else if (e.type === "coup") {
    headline = t("cp.coupHit", { name: name(players, e.actorId), target: name(players, e.targetId) });
  } else if (e.type === "assassinated") {
    headline = e.eliminatedId
      ? t("cp.assassinHit", { name: name(players, e.actorId), target: name(players, e.eliminatedId) })
      : t("cp.assassinFizzle", { name: name(players, e.actorId) });
  } else if (e.type === "blocked") {
    headline = t("cp.blockStands", {
      name: name(players, e.blockerId),
      role: t(`cp.role.${e.blockRole ?? "duke"}`),
    });
  }

  return (
    <AnimatePresence>
      <GlassCard
        strong
        className="space-y-3 p-5 text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <div className="font-display text-lg font-semibold text-cloud">{headline}</div>

        {e.type === "challenge" && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <div className="mb-1 text-xs text-faint">
              {t("cp.shows", { name: name(players, e.challengedId) })}
            </div>
            {e.shown ? (
              <RoleChip role={e.shown} t={t} big />
            ) : (
              e.claimed && (
                <span className="text-sm text-faint line-through">
                  <RoleChip role={e.claimed} t={t} />
                </span>
              )
            )}
            <div className={`mt-2 text-sm font-semibold ${e.truthful ? "text-emerald-300" : "text-rose-300"}`}>
              {e.truthful ? t("cp.truth") : t("cp.lie")}
            </div>
          </motion.div>
        )}

        {/* Which influence(s) fell as this resolved */}
        {e.losses && e.losses.length > 0 && (
          <div className="space-y-1">
            {e.losses.map((l, i) => (
              <div key={i} className="flex items-center justify-center gap-2 text-sm text-rose-300">
                {l.eliminated ? "☠️" : "💔"} {t("cp.losesInfluence", { name: name(players, l.id) })}
                <RoleChip role={l.card} t={t} />
              </div>
            ))}
          </div>
        )}
        <Countdown game={game} />
      </GlassCard>
    </AnimatePresence>
  );
}

/* ── Results ──────────────────────────────────────────────────────────────── */
function Results({
  game,
  players,
  t,
}: {
  game: ComplotsView;
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
        <div className="text-5xl">👑</div>
        <div className="mt-2 font-display text-2xl font-semibold text-cloud">
          {youWon
            ? t("cp.youWin")
            : t("cp.wins", { name: winner ? `${winner.avatar} ${winner.name}` : "?" })}
        </div>
        <div className="mt-4 space-y-1.5 text-left text-sm">
          {game.players.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
              <span className={p.alive ? "text-cloud" : "text-faint"}>
                {players[p.id]?.avatar} {players[p.id]?.name} {p.alive ? "" : "☠️"}
              </span>
              <span className="flex flex-wrap justify-end gap-1">
                {p.revealed.map((r, i) => (
                  <RoleChip key={i} role={r} t={t} />
                ))}
              </span>
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
