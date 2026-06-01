// Curated Codenames word banks. Common, evocative nouns that lend themselves to
// one-word clues. 25 are sampled per game, so ~100 each gives plenty of variety.

import type { Language } from "../../../shared/src/games.js";

const EN = [
  "AGENT", "AIR", "ALIEN", "ANGEL", "APPLE", "ARM", "BAND", "BANK", "BAR", "BEACH",
  "BEAR", "BED", "BELL", "BERLIN", "BLOCK", "BOARD", "BOLT", "BOND", "BOOM", "BOOT",
  "BOTTLE", "BOX", "BRIDGE", "BRUSH", "BUCK", "BUG", "BUTTON", "CALF", "CARD", "CAT",
  "CHAIR", "CHEST", "CHICK", "CIRCLE", "CLOAK", "CLUB", "CODE", "COLD", "COMET", "COTTON",
  "CROWN", "CYCLE", "DANCE", "DAY", "DECK", "DIAMOND", "DOCTOR", "DOG", "DRAGON", "DRESS",
  "DRILL", "DROP", "DUCK", "EAGLE", "EGYPT", "ENGINE", "EYE", "FALL", "FENCE", "FIELD",
  "FIGHTER", "FILE", "FIRE", "FISH", "FLUTE", "FOREST", "FORK", "GAME", "GAS", "GIANT",
  "GLASS", "GLOVE", "GOLD", "GRACE", "GREEN", "GROUND", "HAM", "HAND", "HAWK", "HEAD",
  "HEART", "HORN", "HORSE", "ICE", "IRON", "IVORY", "JACK", "JAM", "JET", "KING",
  "KNIGHT", "LAB", "LAP", "LASER", "LEAD", "LEMON", "LIGHT", "LINK", "LION", "LOCK",
  "LONDON", "LUCK", "MAIL", "MAPLE", "MARBLE", "MASS", "MATCH", "MINE", "MINT", "MISS",
  "MOON", "MOUSE", "NAIL", "NEEDLE", "NIGHT", "NINJA", "NOTE", "NURSE", "OCEAN", "OIL",
];

const FR = [
  "AGENT", "AIGLE", "AILE", "ALARME", "AMOUR", "ANGE", "ANNEAU", "ARBRE", "ARC", "ARGENT",
  "ARME", "AVION", "BALLE", "BANC", "BANQUE", "BARRE", "BEC", "BLOC", "BOIS", "BOMBE",
  "BOTTE", "BOUCHE", "BOUTON", "BRAS", "BROSSE", "BUREAU", "CADRE", "CANARD", "CARTE", "CASTOR",
  "CERCLE", "CHAINE", "CHAISE", "CHAMP", "CHARME", "CHAT", "CHEVAL", "CIEL", "CIRQUE", "CLE",
  "CLUB", "COEUR", "COIN", "COL", "CORDE", "CORNE", "COULEUR", "COURSE", "CRABE", "CRANE",
  "DAME", "DENT", "DOCTEUR", "DRAGON", "EAU", "ECOLE", "ECRAN", "EGLISE", "ENCRE", "ENFER",
  "EPEE", "ETOILE", "FEE", "FER", "FEU", "FEUILLE", "FIL", "FLECHE", "FLEUR", "FLUTE",
  "FORCE", "FORET", "FORME", "FOUR", "FRUIT", "GANT", "GAZ", "GEANT", "GLACE", "GOMME",
  "GRAIN", "GRUE", "GUERRE", "HOTEL", "HUILE", "ILE", "JARDIN", "JEU", "LAC", "LAIT",
  "LAME", "LAMPE", "LANCE", "LETTRE", "LIGNE", "LION", "LIT", "LIVRE", "LOUP", "LUNE",
  "MAIN", "MARS", "MASQUE", "MENU", "MER", "MINE", "MONTRE", "MOT", "MOUCHE", "MUR",
  "NOTE", "NUIT", "OEIL", "OISEAU", "OMBRE", "ONDE", "OR", "OURS", "PAGE", "PIANO",
];

const BANKS: Record<Language, string[]> = { en: EN, fr: FR };

/** Pick 25 distinct words for a board. A host-supplied list with at least 25
 *  words takes over; otherwise the built-in bank for the language is used. */
export function pickCodenamesWords(language: Language, custom?: string[]): string[] {
  const source = custom && custom.length >= 25 ? custom : BANKS[language];
  const pool = [...source];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 25);
}
