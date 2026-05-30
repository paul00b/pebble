import { useStore } from "@/lib/store";

const MAP = {
  online: { dot: "#6ee7d6", label: "Live" },
  connecting: { dot: "#fbbf72", label: "Connecting…" },
  offline: { dot: "#fca5a5", label: "Reconnecting…" },
} as const;

export function ConnectionBadge() {
  const status = useStore((s) => s.status);
  // Stay invisible while everything's healthy; only appear if the link drops.
  if (status === "online") return null;
  const { dot, label } = MAP[status];
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-mist">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: dot,
          boxShadow: `0 0 10px ${dot}`,
          animation: "breathe 1.2s ease-in-out infinite",
        }}
      />
      {label}
    </div>
  );
}
