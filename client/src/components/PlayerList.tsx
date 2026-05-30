import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "./primitives";
import type { Player } from "@shared";

export function PlayerList({
  players,
  youId,
  hostId,
  canKick,
  onKick,
}: {
  players: Player[];
  youId: string | null;
  hostId: string;
  canKick: boolean;
  onKick: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {players.map((p) => (
          <motion.li
            key={p.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="glass group flex items-center gap-3 rounded-2xl px-3 py-2.5"
          >
            <Avatar emoji={p.avatar} color={p.color} dim={!p.connected} ring={p.id === hostId} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-cloud">{p.name}</span>
                {p.id === youId && (
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.62rem] uppercase tracking-wider text-mist">
                    you
                  </span>
                )}
                {p.id === hostId && <span title="Host" className="text-sm">👑</span>}
              </div>
              <div className="text-xs text-faint">
                {p.connected ? "Ready" : "Reconnecting…"}
              </div>
            </div>
            {canKick && p.id !== hostId && (
              <button
                onClick={() => onKick(p.id)}
                className="rounded-lg px-2 py-1 text-xs text-faint opacity-0 transition hover:bg-rose-500/20 hover:text-rose-200 group-hover:opacity-100 focus:opacity-100"
                title="Remove player"
              >
                ✕
              </button>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
