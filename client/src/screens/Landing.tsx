import { motion } from "framer-motion";
import { Button, GlassCard } from "@/components/primitives";
import { Wordmark } from "@/components/Wordmark";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { useT } from "@/lib/useT";
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
  onSandbox,
}: {
  onCreate: () => void;
  onJoin: () => void;
  onSandbox: () => void;
}) {
  const t = useT();
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
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <SoundToggle />
          <LanguageToggle />
        </div>
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
          {t("landing.badge")}
        </motion.span>

        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-cloud sm:text-7xl"
        >
          {t("landing.title1")}
          <br />
          <span className="hero-gradient-text">
            {t("landing.title2")}
          </span>
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-5 max-w-xl text-balance text-lg text-mist"
        >
          {t("landing.subtitle")}
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button onClick={onCreate} className="px-7 py-3.5 text-base">
            {t("landing.create")}
          </Button>
          <Button variant="ghost" onClick={onJoin} className="px-7 py-3.5 text-base">
            {t("landing.join")}
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
            {t("landing.nowPlaying")}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {GAMES.map((g, i) => (
              <GlassCard
                key={g.id}
                className="sandbox-solid flex w-44 flex-col gap-1 p-4 text-left"
                whileHover={{ y: -4, rotate: i % 2 ? 0.6 : -0.6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <span className="text-3xl">{g.emoji}</span>
                <span className="mt-1 font-display text-lg font-semibold text-cloud">
                  {t(`game.${g.id}.name`)}
                </span>
                <span className="text-xs leading-snug text-mist">
                  {t(`game.${g.id}.tagline`)}
                </span>
                <span className="mt-2 text-[0.68rem] text-faint">
                  {g.minPlayers}–{g.maxPlayers} · {t(`game.${g.id}.duration`)}
                </span>
              </GlassCard>
            ))}
            {/* Solo physics playground - opens locally, no room needed. */}
            <GlassCard
              role="button"
              tabIndex={0}
              onClick={onSandbox}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSandbox())}
              className="sandbox-solid flex w-44 cursor-pointer flex-col gap-1 p-4 text-left outline-none ring-1 ring-accent/40 focus-visible:ring-2 focus-visible:ring-accent"
              whileHover={{ y: -4, rotate: 0.6 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <span className="text-3xl">🧩</span>
              <span className="mt-1 font-display text-lg font-semibold text-cloud">
                {t("landing.sandbox")}
              </span>
              <span className="text-xs leading-snug text-mist">{t("landing.sandboxTag")}</span>
              <span className="mt-2 text-[0.68rem] text-accent">{t("landing.sandboxPlay")}</span>
            </GlassCard>

            <GlassCard className="sandbox-solid flex w-44 flex-col items-center justify-center gap-1 p-4 text-center">
              <span className="text-2xl">✨</span>
              <span className="text-sm text-mist">{t("landing.moreSoon")}</span>
            </GlassCard>
          </div>
        </motion.div>
      </main>

      <footer className="py-6 text-center text-xs text-faint">
        {t("landing.footer")}
      </footer>
    </div>
  );
}
