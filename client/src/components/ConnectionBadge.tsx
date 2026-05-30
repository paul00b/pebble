import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";

const DOT = {
  online: "#6ee7d6",
  connecting: "#fbbf72",
  offline: "#fca5a5",
} as const;

export function ConnectionBadge() {
  const status = useStore((s) => s.status);
  const t = useT();
  // Stay invisible while everything's healthy; only appear if the link drops.
  if (status === "online") return null;
  const label = status === "connecting" ? t("conn.connecting") : t("conn.reconnecting");
  const dot = DOT[status];
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
