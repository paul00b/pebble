import type { ReactNode } from "react";
import { Button } from "@/components/primitives";
import { Wordmark } from "@/components/Wordmark";
import { ConnectionBadge } from "@/components/ConnectionBadge";

/** Shared chrome for any in-game screen: brand, a title, and a leave button. */
export function GameShell({
  title,
  onLeave,
  children,
}: {
  title: string;
  onLeave: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <Wordmark size={22} />
        <div className="hidden font-display text-sm tracking-wide text-mist sm:block">
          {title}
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <Button variant="ghost" onClick={onLeave} className="px-4 py-2 text-sm">
            Leave
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
