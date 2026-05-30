import { useStore } from "@/lib/store";
import { LOCALES } from "@/lib/i18n";

/** Compact FR/EN switch for the player's interface language. */
export function LanguageToggle() {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);

  return (
    <div className="glass flex items-center gap-0.5 rounded-full p-0.5 text-xs">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded-full px-2.5 py-1 font-medium uppercase tracking-wide transition ${
            l === locale ? "bg-white/15 text-cloud" : "text-faint hover:text-mist"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
