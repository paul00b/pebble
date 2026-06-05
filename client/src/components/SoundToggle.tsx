import { playSound, toggleMuted, useMuted } from "@/lib/sound";

/** Compact mute switch — sits alongside the language toggle / connection badge. */
export function SoundToggle() {
  const muted = useMuted();
  return (
    <button
      onClick={() => {
        const wasMuted = muted;
        toggleMuted();
        // Give a little audible confirmation when turning sound back on.
        if (wasMuted) playSound("right");
      }}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Unmute sounds" : "Mute sounds"}
      className="glass grid h-8 w-8 place-items-center rounded-full text-sm text-faint transition hover:text-cloud"
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
