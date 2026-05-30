import { useStore } from "./store";
import { translate } from "./i18n";

/** Returns a translator bound to the player's current UI locale. */
export function useT() {
  const locale = useStore((s) => s.locale);
  return (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
}
