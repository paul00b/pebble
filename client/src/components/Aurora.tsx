/**
 * The living backdrop: slow-drifting blurred color fields over an ink base,
 * plus a faint film grain. GPU-only (transform/opacity) so it stays fluid.
 */
export function Aurora() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden bg-ink-800 grain"
    >
      {/* base vignette so the center stays calm and text-safe */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, rgba(20,30,40,0.0), rgba(7,10,15,0.9))",
        }}
      />

      <div
        className="aurora-blob"
        style={{
          width: "55vmax",
          height: "55vmax",
          top: "-18vmax",
          left: "-10vmax",
          background:
            "radial-gradient(circle at 30% 30%, var(--color-jade), transparent 60%)",
          opacity: 0.5,
          animation: "drift-a 24s ease-in-out infinite",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: "50vmax",
          height: "50vmax",
          top: "10vmax",
          right: "-14vmax",
          background:
            "radial-gradient(circle at 60% 40%, var(--color-orchid), transparent 62%)",
          opacity: 0.42,
          animation: "drift-b 30s ease-in-out infinite",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: "42vmax",
          height: "42vmax",
          bottom: "-16vmax",
          left: "28%",
          background:
            "radial-gradient(circle at 50% 50%, var(--color-blush), transparent 60%)",
          opacity: 0.32,
          animation: "drift-c 27s ease-in-out infinite",
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: "38vmax",
          height: "38vmax",
          bottom: "-6vmax",
          right: "10%",
          background:
            "radial-gradient(circle at 50% 50%, var(--color-violet), transparent 62%)",
          opacity: 0.3,
          animation: "drift-a 33s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}
