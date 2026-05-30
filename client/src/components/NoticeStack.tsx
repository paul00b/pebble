import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";

const TONE = {
  info: "border-white/15",
  warn: "border-amber-300/40",
  error: "border-rose-300/40",
} as const;

export function NoticeStack() {
  const notices = useStore((s) => s.notices);
  const dismiss = useStore((s) => s.dismissNotice);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {notices.map((n) => (
          <motion.button
            key={n.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={() => dismiss(n.id)}
            className={`glass-strong pointer-events-auto rounded-2xl border px-4 py-2.5 text-sm text-cloud ${TONE[n.kind]}`}
          >
            {n.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
