/** The Pebble wordmark: a glassy stacked-stones glyph + a sheen-swept name. */
export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <PebbleGlyph size={size * 1.15} />
      <span
        className="font-display font-semibold tracking-tight"
        style={{
          fontSize: size,
          lineHeight: 1,
          background:
            "linear-gradient(100deg, #eef4f3 20%, #ffffff 40%, #9af3e4 50%, #eef4f3 60%)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          animation: "sheen 6s linear infinite",
        }}
      >
        Pebble
      </span>
    </div>
  );
}

export function PebbleGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <radialGradient id="pg-top" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#bdf6ec" />
          <stop offset="100%" stopColor="#4fd6c0" />
        </radialGradient>
        <radialGradient id="pg-bot" cx="40%" cy="35%" r="85%">
          <stop offset="0%" stopColor="#9fb2b6" />
          <stop offset="100%" stopColor="#3a4a52" />
        </radialGradient>
      </defs>
      {/* lower stone */}
      <ellipse cx="20" cy="27" rx="15" ry="9.5" fill="url(#pg-bot)" opacity="0.9" />
      {/* upper stone */}
      <ellipse cx="20" cy="16" rx="11.5" ry="8" fill="url(#pg-top)" />
      {/* highlight */}
      <ellipse cx="16" cy="13" rx="3.6" ry="2.2" fill="#ffffff" opacity="0.55" />
    </svg>
  );
}
