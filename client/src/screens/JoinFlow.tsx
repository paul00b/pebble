import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Button, GlassCard } from "@/components/primitives";
import { AVATARS, COLORS } from "@/lib/session";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/useT";

export type FlowMode = "create" | "join";

export function JoinFlow({
  mode,
  initialCode = "",
  onClose,
}: {
  mode: FlowMode;
  initialCode?: string;
  onClose: () => void;
}) {
  const t = useT();
  const identity = useStore((s) => s.identity);
  const setIdentity = useStore((s) => s.setIdentity);
  const createRoom = useStore((s) => s.createRoom);
  const joinRoom = useStore((s) => s.joinRoom);

  const [name, setName] = useState(identity.name);
  const [avatar, setAvatar] = useState(identity.avatar);
  const [color, setColor] = useState(identity.color);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError(t("join.errName"));
    if (mode === "join" && code.trim().length < 3)
      return setError(t("join.errCode"));

    setBusy(true);
    setError(null);
    setIdentity({ name: trimmed, avatar, color });

    const res =
      mode === "create"
        ? await createRoom()
        : await joinRoom(code.trim().toUpperCase());

    setBusy(false);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    // Reflect the room in the URL so it can be shared / refreshed.
    window.history.replaceState({}, "", `/r/${res.room.code}`);
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 grid place-items-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <GlassCard
        strong
        className="relative w-full max-w-md p-6 sm:p-7"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg px-2 py-1 text-faint hover:text-cloud"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="font-display text-2xl font-semibold text-cloud">
          {mode === "create" ? t("join.createTitle") : t("join.joinTitle")}
        </h2>
        <p className="mt-1 text-sm text-mist">
          {mode === "create" ? t("join.createSub") : t("join.joinSub")}
        </p>

        {/* Live preview */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <Avatar emoji={avatar} color={color} size={48} ring />
          <div className="text-sm">
            <div className="font-medium text-cloud">{name.trim() || t("join.yourName")}</div>
            <div className="text-faint">{t("join.previewHint")}</div>
          </div>
        </div>

        {/* Name */}
        <label className="mt-5 block text-xs uppercase tracking-wider text-faint">
          {t("join.name")}
        </label>
        <input
          autoFocus
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={t("join.namePh")}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-cloud outline-none placeholder:text-faint focus:border-accent/50 focus:ring-2 focus:ring-accent/30"
        />

        {/* Code (join only) */}
        {mode === "join" && (
          <>
            <label className="mt-4 block text-xs uppercase tracking-wider text-faint">
              {t("join.code")}
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="ABCD"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-display text-xl tracking-[0.3em] text-cloud outline-none placeholder:tracking-normal placeholder:text-faint focus:border-accent/50 focus:ring-2 focus:ring-accent/30"
            />
          </>
        )}

        {/* Avatar grid */}
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-faint">{t("join.avatar")}</div>
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className={`grid aspect-square place-items-center rounded-xl text-lg transition ${
                  a === avatar ? "bg-white/20 ring-2 ring-accent/70" : "bg-white/5 hover:bg-white/10"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-faint">{t("join.color")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full transition"
                style={{
                  background: c,
                  boxShadow: c === color ? `0 0 0 2px #0a0f14, 0 0 0 4px ${c}` : undefined,
                  transform: c === color ? "scale(1.1)" : undefined,
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 rounded-xl border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <Button full className="mt-6" onClick={submit} disabled={busy}>
          {busy
            ? t("common.oneSec")
            : mode === "create"
              ? t("join.createBtn")
              : t("join.joinBtn")}
        </Button>
      </GlassCard>
    </motion.div>
  );
}
