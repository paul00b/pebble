import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Aurora } from "@/components/Aurora";
import { NoticeStack } from "@/components/NoticeStack";
import { Landing } from "@/screens/Landing";
import { Lobby } from "@/screens/Lobby";
import { JoinFlow, type FlowMode } from "@/screens/JoinFlow";
import { useStore } from "@/lib/store";

/** Pull a room code out of a /r/CODE path, if present. */
function codeFromPath(): string {
  const m = window.location.pathname.match(/^\/r\/([a-z0-9]+)/i);
  return m ? m[1].toUpperCase() : "";
}

export default function App() {
  const room = useStore((s) => s.room);
  const [flow, setFlow] = useState<{ mode: FlowMode; code?: string } | null>(null);

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
        <Lobby room={room} />
      ) : (
        <Landing
          onCreate={() => setFlow({ mode: "create" })}
          onJoin={() => setFlow({ mode: "join" })}
        />
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
