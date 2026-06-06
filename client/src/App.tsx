import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Aurora } from "@/components/Aurora";
import { NoticeStack } from "@/components/NoticeStack";
import { Landing } from "@/screens/Landing";
import { Lobby } from "@/screens/Lobby";
import { JoinFlow, type FlowMode } from "@/screens/JoinFlow";
import { useStore } from "@/lib/store";

// The physics sandbox pulls in matter.js — load it only when actually opened.
const Sandbox = lazy(() =>
  import("@/screens/Sandbox").then((m) => ({ default: m.Sandbox }))
);

/** Pull a room code out of a /r/CODE path, if present. */
function codeFromPath(): string {
  const m = window.location.pathname.match(/^\/r\/([a-z0-9]+)/i);
  return m ? m[1].toUpperCase() : "";
}

export default function App() {
  const room = useStore((s) => s.room);
  const [flow, setFlow] = useState<{ mode: FlowMode; code?: string } | null>(null);
  const [sandbox, setSandbox] = useState(false);

  // If someone opens a shared /r/CODE link, greet them with the join sheet.
  useEffect(() => {
    const code = codeFromPath();
    if (code && !room) setFlow({ mode: "join", code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once we're in a room, close any open flow.
  useEffect(() => {
    if (room) setFlow(null);
  }, [room]);

  return (
    <>
      <Aurora />
      <NoticeStack />

      {room ? (
        <Lobby room={room} onSandbox={() => setSandbox(true)} sandboxOpen={sandbox} />
      ) : (
        <Landing
          onCreate={() => setFlow({ mode: "create" })}
          onJoin={() => setFlow({ mode: "join" })}
          onSandbox={() => setSandbox(true)}
        />
      )}

      {/* Solo physics playground — overlays the home screen or the lobby. */}
      {sandbox && (
        <Suspense
          fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-ink-800 text-faint">…</div>}
        >
          <Sandbox onBack={() => setSandbox(false)} />
        </Suspense>
      )}

      <AnimatePresence>
        {flow && (
          <JoinFlow
            mode={flow.mode}
            initialCode={flow.code}
            onClose={() => setFlow(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
