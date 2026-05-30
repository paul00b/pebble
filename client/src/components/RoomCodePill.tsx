import { useState } from "react";
import { motion } from "framer-motion";

/** Tap to copy the room code (or a full invite link). */
export function RoomCodePill({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const link = `${window.location.origin}/r/${code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* clipboard may be blocked; the code is still visible to type */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <motion.button
      onClick={copy}
      whileTap={{ scale: 0.97 }}
      className="glass-strong glass-edge group flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
    >
      <div>
        <div className="text-[0.7rem] uppercase tracking-[0.2em] text-faint">
          Room code
        </div>
        <div className="font-display text-2xl font-semibold tracking-[0.25em] text-cloud">
          {code}
        </div>
      </div>
      <span className="ml-1 rounded-xl bg-white/8 px-3 py-2 text-xs text-mist transition-colors group-hover:bg-white/15">
        {copied ? "Copied link ✓" : "Copy invite"}
      </span>
    </motion.button>
  );
}
