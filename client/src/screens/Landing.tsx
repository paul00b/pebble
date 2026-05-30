import { motion } from "framer-motion";
import { Button, GlassCard } from "@/components/primitives";
import { Wordmark } from "@/components/Wordmark";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { GAMES } from "@shared";

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, type: "spring", stiffness: 120, damping: 18 },
  }),
};

export function Landing({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-5">
      {/* top bar */}
      <motion.header
        className="flex items-center justify-between py-5"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Wordmark />
        <ConnectionBadge />
      </motion.header>

      {/* hero */}
      <main className="flex flex-1 flex-col items-center justify-center py-10 text-center">
        <motion.span
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass mb-6 rounded-full px-4 py-1.5 text-xs tracking-wide text-mist"
        >
          ✦ Game night, anywhere — no app, no signup
        </motion.span>

        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-cloud sm:text-7xl"
        >
          Gather your friends.
          <br />
          <span
            style={{
              background: "linear-gradient(100deg, #9af3e4, #b58bff 60%, #f4a8c7)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Play in seconds.
          </span>
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-5 max-w-xl text-balance text-lg text-mist"
        >
          Pebble is a little glass arcade for your group chat. Spin up a room,
          send the code, and drop straight into a party game together.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button onClick={onCreate} className="px-7 py-3.5 text-base">
            Create a room
          </Button>
          <Button variant="ghost" onClick={onJoin} className="px-7 py-3.5 text-base">
            Join with a code
          </Button>
        </motion.div>

        {/* game preview rail */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-14 w-full"
        >
          <div className="mb-3 text-xs uppercase tracking-[0.25em] text-faint">
            Now playing
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {GAMES.map((g, i) => (
              <GlassCard
                key={g.id}
                className="flex w-44 flex-col gap-1 p-4 text-left"
                whileHover={{ y: -4, rotate: i % 2 ? 0.6 : -0.6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <span className="text-3xl">{g.emoji}</span>
                <span className="mt-1 font-display text-lg font-semibold text-cloud">
                  {g.name}
                </span>
                <span className="text-xs leading-snug text-mist">{g.tagline}</span>
                <span className="mt-2 text-[0.68rem] text-faint">
                  {g.minPlayers}–{g.maxPlayers} players · {g.duration}
                </span>
              </GlassCard>
            ))}
            <GlassCard className="flex w-44 flex-col items-center justify-center gap-1 p-4 text-center">
              <span className="text-2xl">✨</span>
              <span className="text-sm text-mist">More games landing soon</span>
            </GlassCard>
          </div>
        </motion.div>
      </main>

      <footer className="py-6 text-center text-xs text-faint">
        Free forever · Plays on any modern browser, phone or desktop
      </footer>
    </div>
  );
}
