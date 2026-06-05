import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, GlassCard } from "@/components/primitives";
import { Wordmark } from "@/components/Wordmark";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { SoundToggle } from "@/components/SoundToggle";
import { useT } from "@/lib/useT";

/** Shared chrome for any in-game screen: brand, a title, and host/leave controls. */
export function GameShell({
  title,
  onLeave,
  isHost = false,
  onEndGame,
  children,
}: {
  title: string;
  onLeave: () => void;
  /** When true, shows the host-only "End game" control. */
  isHost?: boolean;
  /** Called (after confirmation) to end the game and return everyone to the lobby. */
  onEndGame?: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <Wordmark size={22} />
        <div className="hidden font-display text-sm tracking-wide text-mist sm:block">
          {title}
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <SoundToggle />
          {isHost && onEndGame && (
            <Button
              variant="danger"
              onClick={() => setConfirming(true)}
              className="px-4 py-2 text-sm"
            >
              {t("game.endGame")}
            </Button>
          )}
          <Button variant="ghost" onClick={onLeave} className="px-4 py-2 text-sm">
            {t("common.leave")}
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>

      {/* Host confirmation before ending the game for everyone. */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-ink-900/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirming(false)}
          >
            <GlassCard
              strong
              className="w-full max-w-sm p-6 text-center"
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 240, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl">🏁</div>
              <h2 className="mt-2 font-display text-xl font-semibold text-cloud">
                {t("game.endTitle")}
              </h2>
              <p className="mt-1 text-sm text-mist">{t("game.endBody")}</p>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="ghost"
                  full
                  onClick={() => setConfirming(false)}
                  className="py-2.5 text-sm"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="danger"
                  full
                  onClick={() => {
                    setConfirming(false);
                    onEndGame?.();
                  }}
                  className="py-2.5 text-sm"
                >
                  {t("game.endGame")}
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
