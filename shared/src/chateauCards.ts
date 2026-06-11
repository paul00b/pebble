// ── Château Combo card database ─────────────────────────────────────────────
// Transcribed from the enriched spec PDF (39 Château + 38 Village - one Village
// card is missing from the source photos and is intentionally NOT invented).
// Shared by the server engine (rules) and the client (display): the view only
// carries card ids, both sides look the data up here.
//
// Interpretation notes for readings the spec flags as uncertain:
//  - "Bannière" is unified as a discount marker: every [REM -1] effect adds a
//    banner to your tableau; your purchase discount = your banner count, and
//    every "per banner" effect/score counts those banners.
//  - "Carte X" effects (Bourreau, L'oscopieur, Maître de guilde) read the most
//    expensive card currently visible in the markets.
//  - "Chez 1 voisin" counts the best opponent; "OU gagnez N clés" choices take
//    whichever side is worth more (gold count vs N).
//  - Line/column/2×2 score icons apply to the row/column/square containing the
//    card itself.
//  - Charpentier's unreadable immediate effect is implemented as +2 keys.

export type ChateauShield =
  | "crown"   // [COURONNE] blue
  | "castle"  // [CHATEAU] purple
  | "feather" // [PLUME] green
  | "cross"   // [CROIX] orange
  | "swords"  // [EPEES] red
  | "black"   // [ECU NOIR]
  | "wheat";  // [BLE] yellow (Village)

export type ChateauDeck = "castle" | "village";

/** Immediate effect, resolved right after the card is placed. */
export type ChateauFx =
  | { t: "gold"; n: number }
  | { t: "keys"; n: number }
  | { t: "goldPerShield"; s: ChateauShield; n: number }
  | { t: "keysPerShield"; s: ChateauShield; n: number }
  | { t: "goldPerBanner" }
  | { t: "keysPerBanner" }
  | { t: "goldPerEmpty" }
  | { t: "goldPerOccupied" }
  | { t: "goldPerCost"; c: number; n: number }
  | { t: "banner"; n: number }
  | { t: "purseAll"; n: number }
  | { t: "fillPurses"; n: number }
  | { t: "purseAllOrKeys"; n: number; k: number }
  | { t: "oppGold"; n: number }
  | { t: "oppKeys"; n: number }
  | { t: "allKeys"; n: number }
  | { t: "neighborGoldOrKeys"; s: ChateauShield; k: number }
  | { t: "neighborKeys"; s: ChateauShield }
  | { t: "neighborKeysBanners" }
  | { t: "marketCost"; res: "gold" | "keys" }
  | { t: "keysPerPurse" };

/** End-of-game scoring formula. */
export type ChateauScore =
  | { t: "perShield"; s: ChateauShield; n: number }
  | { t: "absent"; s: ChateauShield; n: number }
  | { t: "perKey"; n: number }
  | { t: "perSet"; set: ChateauShield[]; n: number }
  | { t: "adj"; s: ChateauShield; dir: "h" | "v" | "o"; n: number }
  | { t: "rowShield"; s: ChateauShield; n: number }
  | { t: "colShield"; s: ChateauShield; n: number }
  | { t: "perBanner"; n: number }
  | { t: "perBannerSet"; size: number; n: number }
  | { t: "purse"; per: number; max: number }
  | { t: "perCost"; c: number; min?: boolean; n: number }
  | { t: "rowFull"; n: number }
  | { t: "colFull"; n: number }
  | { t: "square"; n: number }
  | { t: "faceDown"; n: number };

export interface ChateauCard {
  id: string;
  deck: ChateauDeck;
  name: string;
  cost: number;
  /** Shield instances - duplicates are real (e.g. double feather). */
  shields: ChateauShield[];
  fx: ChateauFx[];
  score: ChateauScore;
  /** Storage cap for cards with a purse (gold beyond it is not stored). */
  purseMax?: number;
}

const C = (card: Omit<ChateauCard, "deck">): ChateauCard => ({ ...card, deck: "castle" });
const V = (card: Omit<ChateauCard, "deck">): ChateauCard => ({ ...card, deck: "village" });

/* ── Château deck (39) ──────────────────────────────────────────────────── */
const CASTLE: ChateauCard[] = [
  C({ id: "oscopieur", name: "L'Oscopieur", cost: 4, shields: ["castle", "feather"],
      fx: [{ t: "marketCost", res: "gold" }], score: { t: "purse", per: 2, max: 8 }, purseMax: 8 }),
  C({ id: "saintete", name: "Sa Sainteté", cost: 7, shields: ["castle"],
      fx: [{ t: "oppKeys", n: 3 }], score: { t: "absent", s: "black", n: 6 } }),
  C({ id: "templier", name: "Templier", cost: 5, shields: ["castle", "swords"],
      fx: [{ t: "neighborGoldOrKeys", s: "castle", k: 2 }], score: { t: "perKey", n: 1 } }),
  C({ id: "devot", name: "Dévot", cost: 4, shields: ["castle"],
      fx: [{ t: "goldPerEmpty" }], score: { t: "absent", s: "cross", n: 10 } }),
  C({ id: "reine", name: "Sa Majesté la Reine", cost: 7, shields: ["crown"],
      fx: [{ t: "keysPerShield", s: "crown", n: 1 }],
      score: { t: "perSet", set: ["crown", "crown", "feather"], n: 10 } }),
  C({ id: "pelerin", name: "Pèlerin", cost: 6, shields: ["black", "castle"],
      fx: [{ t: "banner", n: 1 }], score: { t: "perShield", s: "black", n: 4 } }),
  C({ id: "bouffon", name: "Bouffon", cost: 3, shields: ["black", "crown"],
      fx: [{ t: "goldPerShield", s: "crown", n: 2 }], score: { t: "adj", s: "crown", dir: "o", n: 2 } }),
  C({ id: "nonne", name: "Nonne", cost: 3, shields: ["black", "castle"],
      fx: [{ t: "goldPerBanner" }], score: { t: "adj", s: "castle", dir: "o", n: 3 } }),
  C({ id: "altesse", name: "Son Altesse", cost: 6, shields: ["crown", "castle"],
      fx: [{ t: "oppGold", n: 1 }], score: { t: "perShield", s: "crown", n: 4 } }),
  C({ id: "cardinale", name: "Cardinale", cost: 4, shields: ["castle"],
      fx: [{ t: "keysPerBanner" }], score: { t: "rowShield", s: "castle", n: 3 } }),
  C({ id: "intendant", name: "Intendant", cost: 0, shields: ["crown"],
      fx: [{ t: "fillPurses", n: 2 }], score: { t: "purse", per: 2, max: 3 }, purseMax: 3 }),
  C({ id: "doyenne", name: "Doyenne", cost: 3, shields: ["crown"],
      fx: [{ t: "purseAll", n: 2 }], score: { t: "purse", per: 2, max: 5 }, purseMax: 5 }),
  C({ id: "princesse", name: "Princesse", cost: 3, shields: ["black", "crown"],
      fx: [{ t: "banner", n: 1 }], score: { t: "adj", s: "crown", dir: "h", n: 3 } }),
  C({ id: "astronome", name: "Astronome", cost: 5, shields: ["feather", "feather"],
      fx: [{ t: "banner", n: 1 }], score: { t: "colFull", n: 8 } }),
  C({ id: "chanceliere", name: "Chancelière", cost: 6, shields: ["crown", "feather"],
      fx: [{ t: "keysPerShield", s: "feather", n: 1 }], score: { t: "perBanner", n: 2 } }),
  C({ id: "crieur", name: "Crieur public", cost: 4, shields: ["black", "cross"],
      fx: [{ t: "goldPerCost", c: 4, n: 1 }], score: { t: "perCost", c: 4, n: 3 } }),
  C({ id: "banquiere", name: "Banquière", cost: 7, shields: ["black", "cross"],
      fx: [{ t: "purseAllOrKeys", n: 2, k: 3 }], score: { t: "purse", per: 1, max: 99 }, purseMax: 99 }),
  C({ id: "professeur", name: "Professeur", cost: 4, shields: ["black", "feather"],
      fx: [{ t: "goldPerShield", s: "black", n: 1 }], score: { t: "adj", s: "feather", dir: "h", n: 3 } }),
  C({ id: "apothicaire", name: "Apothicaire", cost: 3, shields: ["black", "feather"],
      fx: [{ t: "banner", n: 1 }], score: { t: "adj", s: "feather", dir: "v", n: 3 } }),
  C({ id: "orfevre", name: "Orfèvre", cost: 4, shields: ["black", "cross"],
      fx: [{ t: "keysPerShield", s: "black", n: 1 }], score: { t: "colFull", n: 6 } }),
  C({ id: "architecte", name: "Architecte", cost: 4, shields: ["black", "feather"],
      fx: [{ t: "banner", n: 1 }], score: { t: "perShield", s: "black", n: 2 } }),
  C({ id: "juge", name: "Juge", cost: 4, shields: ["black", "feather"],
      fx: [{ t: "keys", n: 2 }], score: { t: "perBannerSet", size: 3, n: 3 } }),
  C({ id: "officier", name: "Officier", cost: 5, shields: ["crown", "swords"],
      fx: [{ t: "goldPerShield", s: "crown", n: 1 }, { t: "goldPerShield", s: "swords", n: 1 }],
      score: { t: "perSet", set: ["crown", "swords"], n: 4 } }),
  C({ id: "bretteur", name: "Bretteur", cost: 6, shields: ["swords"],
      fx: [{ t: "keysPerShield", s: "swords", n: 1 }], score: { t: "colShield", s: "black", n: 4 } }),
  C({ id: "generale", name: "Générale", cost: 7, shields: ["swords"],
      fx: [{ t: "keysPerShield", s: "black", n: 1 }],
      score: { t: "perSet", set: ["black", "black", "black"], n: 6 } }),
  C({ id: "medecin_chateau", name: "Médecin de cour", cost: 7, shields: ["feather"],
      fx: [{ t: "oppGold", n: 2 }], score: { t: "perCost", c: 5, min: true, n: 5 } }),
  C({ id: "capitaine", name: "Capitaine", cost: 5, shields: ["swords", "swords"],
      fx: [{ t: "banner", n: 1 }], score: { t: "colFull", n: 8 } }),
  C({ id: "garde", name: "Garde royal", cost: 4, shields: ["crown", "swords"],
      fx: [{ t: "allKeys", n: 1 }], score: { t: "adj", s: "crown", dir: "v", n: 3 } }),
  C({ id: "chevaleresse", name: "Chevaleresse", cost: 5, shields: ["swords"],
      fx: [{ t: "goldPerBanner" }], score: { t: "adj", s: "crown", dir: "v", n: 3 } }),
  C({ id: "mere_superieure", name: "Mère supérieure", cost: 5, shields: ["castle", "castle"],
      fx: [{ t: "keys", n: 4 }], score: { t: "rowFull", n: 5 } }),
  C({ id: "maitre_guilde", name: "Maître de guilde", cost: 5, shields: ["black", "cross", "cross"],
      fx: [{ t: "marketCost", res: "keys" }], score: { t: "colFull", n: 5 } }),
  C({ id: "duchesse", name: "Duchesse", cost: 5, shields: ["crown", "crown"],
      fx: [{ t: "keys", n: 2 }], score: { t: "rowFull", n: 8 } }),
  C({ id: "chatelaine", name: "Châtelaine", cost: 2, shields: ["crown", "cross"],
      fx: [{ t: "banner", n: 1 }], score: { t: "colShield", s: "black", n: 2 } }),
  C({ id: "alchimiste", name: "Alchimiste", cost: 6, shields: ["feather"],
      fx: [{ t: "banner", n: 1 }], score: { t: "perBanner", n: 4 } }),
  C({ id: "humble", name: "Humble", cost: 5, shields: ["black", "castle"],
      fx: [{ t: "goldPerBanner" }], score: { t: "perBanner", n: 2 } }),
  C({ id: "baron", name: "Baron", cost: 3, shields: ["crown"],
      fx: [{ t: "banner", n: 1 }], score: { t: "absent", s: "feather", n: 10 } }),
  C({ id: "prince", name: "Prince", cost: 6, shields: ["crown"],
      fx: [{ t: "goldPerShield", s: "crown", n: 1 }], score: { t: "adj", s: "crown", dir: "v", n: 4 } }),
  C({ id: "scribe", name: "Scribe", cost: 4, shields: ["black", "castle"],
      fx: [{ t: "goldPerShield", s: "castle", n: 1 }], score: { t: "adj", s: "feather", dir: "o", n: 3 } }),
  C({ id: "sonneur", name: "Sonneur de cloches", cost: 5, shields: ["black", "cross"],
      fx: [{ t: "goldPerShield", s: "castle", n: 1 }, { t: "goldPerShield", s: "cross", n: 1 }],
      score: { t: "perSet", set: ["castle", "cross"], n: 4 } }),
];

/* ── Village deck (38 - one card missing from the source photos) ───────── */
const VILLAGE: ChateauCard[] = [
  V({ id: "cueilleuse", name: "Cueilleuse", cost: 3, shields: ["black", "cross"],
      fx: [{ t: "banner", n: 1 }], score: { t: "adj", s: "cross", dir: "v", n: 3 } }),
  V({ id: "revolutionnaire", name: "Révolutionnaire", cost: 4, shields: ["black", "wheat"],
      fx: [{ t: "keysPerBanner" }], score: { t: "absent", s: "crown", n: 9 } }),
  V({ id: "horlogere", name: "Horlogère", cost: 3, shields: ["black", "cross"],
      fx: [{ t: "goldPerShield", s: "cross", n: 1 }], score: { t: "adj", s: "cross", dir: "h", n: 3 } }),
  V({ id: "pecheur", name: "Pêcheur", cost: 2, shields: ["wheat"],
      fx: [{ t: "banner", n: 1 }], score: { t: "square", n: 4 } }),
  V({ id: "philosophe", name: "Philosophe", cost: 2, shields: ["feather"],
      fx: [{ t: "banner", n: 1 }], score: { t: "absent", s: "swords", n: 10 } }),
  V({ id: "epiciere", name: "Épicière", cost: 0, shields: ["cross"],
      fx: [{ t: "goldPerShield", s: "cross", n: 2 }], score: { t: "colFull", n: 5 } }),
  V({ id: "sculptrice", name: "Sculptrice", cost: 3, shields: ["black", "castle", "cross"],
      fx: [{ t: "keysPerShield", s: "castle", n: 1 }], score: { t: "purse", per: 2, max: 7 }, purseMax: 7 }),
  V({ id: "usurpateur", name: "Usurpateur", cost: 5, shields: ["black", "wheat"],
      fx: [{ t: "keysPerShield", s: "black", n: 1 }], score: { t: "perBanner", n: 2 } }),
  V({ id: "aubergiste", name: "Aubergiste", cost: 0, shields: ["cross"],
      fx: [{ t: "purseAll", n: 2 }, { t: "oppGold", n: 2 }], score: { t: "purse", per: 2, max: 6 }, purseMax: 6 }),
  V({ id: "ecuyer", name: "Écuyer", cost: 0, shields: ["swords"],
      fx: [{ t: "banner", n: 2 }], score: { t: "adj", s: "cross", dir: "h", n: 2 } }),
  V({ id: "artificier", name: "Artificier", cost: 2, shields: ["black", "swords"],
      fx: [{ t: "neighborGoldOrKeys", s: "cross", k: 2 }], score: { t: "adj", s: "swords", dir: "v", n: 3 } }),
  V({ id: "apiculteur", name: "Apiculteur", cost: 2, shields: ["wheat"],
      fx: [{ t: "purseAll", n: 2 }], score: { t: "purse", per: 2, max: 9 }, purseMax: 9 }),
  V({ id: "geolier", name: "Geôlier", cost: 4, shields: ["feather", "swords"],
      fx: [{ t: "neighborKeys", s: "swords" }], score: { t: "colFull", n: 6 } }),
  V({ id: "medecin_village", name: "Médecin de village", cost: 5, shields: ["feather"],
      fx: [{ t: "goldPerShield", s: "feather", n: 1 }, { t: "goldPerShield", s: "cross", n: 1 }],
      score: { t: "perSet", set: ["feather", "cross"], n: 4 } }),
  V({ id: "fermiere", name: "Fermière", cost: 0, shields: ["wheat"],
      fx: [{ t: "banner", n: 1 }], score: { t: "purse", per: 2, max: 5 }, purseMax: 5 }),
  V({ id: "miraculee", name: "Miraculée", cost: 2, shields: ["black", "castle", "castle"],
      fx: [{ t: "keysPerPurse" }], score: { t: "purse", per: 2, max: 4 }, purseMax: 4 }),
  V({ id: "cure", name: "Curé", cost: 0, shields: ["black", "castle"],
      fx: [{ t: "goldPerBanner" }], score: { t: "purse", per: 2, max: 5 }, purseMax: 5 }),
  V({ id: "inventeur", name: "Inventeur", cost: 2, shields: ["feather", "feather"],
      fx: [{ t: "goldPerShield", s: "feather", n: 1 }], score: { t: "perBanner", n: 1 } }),
  V({ id: "paysanne", name: "Paysanne", cost: 0, shields: ["wheat"],
      fx: [{ t: "goldPerCost", c: 0, n: 3 }], score: { t: "perCost", c: 0, n: 2 } }),
  V({ id: "agricultrice", name: "Agricultrice", cost: 5, shields: ["black", "wheat"],
      fx: [{ t: "keysPerShield", s: "wheat", n: 1 }], score: { t: "rowFull", n: 7 } }),
  V({ id: "bucheron", name: "Bûcheron", cost: 0, shields: ["wheat"],
      fx: [{ t: "goldPerOccupied" }], score: { t: "colFull", n: 5 } }),
  V({ id: "sorciere", name: "Sorcière", cost: 4, shields: ["black", "wheat"],
      fx: [{ t: "neighborKeys", s: "castle" }], score: { t: "absent", s: "castle", n: 9 } }),
  V({ id: "moine", name: "Moine", cost: 4, shields: ["black", "castle", "wheat"],
      fx: [{ t: "keysPerShield", s: "castle", n: 1 }], score: { t: "adj", s: "wheat", dir: "o", n: 2 } }),
  V({ id: "batard", name: "Bâtard", cost: 4, shields: ["crown", "wheat"],
      fx: [{ t: "keysPerShield", s: "crown", n: 1 }], score: { t: "adj", s: "wheat", dir: "v", n: 3 } }),
  V({ id: "milicien", name: "Milicien", cost: 2, shields: ["black", "swords"],
      fx: [{ t: "neighborGoldOrKeys", s: "wheat", k: 2 }], score: { t: "adj", s: "swords", dir: "h", n: 3 } }),
  V({ id: "brigand", name: "Brigand", cost: 7, shields: ["wheat"],
      fx: [{ t: "neighborKeysBanners" }], score: { t: "perBannerSet", size: 3, n: 7 } }),
  V({ id: "mendiante", name: "Mendiante", cost: 0, shields: ["wheat"],
      fx: [{ t: "goldPerOccupied" }], score: { t: "adj", s: "castle", dir: "v", n: 2 } }),
  V({ id: "barbare", name: "Barbare", cost: 2, shields: ["black", "swords", "wheat"],
      fx: [{ t: "neighborGoldOrKeys", s: "feather", k: 2 }], score: { t: "absent", s: "feather", n: 10 } }),
  V({ id: "mercenaire", name: "Mercenaire", cost: 6, shields: ["swords", "wheat"],
      fx: [{ t: "goldPerShield", s: "black", n: 1 }],
      score: { t: "perSet", set: ["castle", "swords", "wheat"], n: 7 } }),
  V({ id: "boulangere", name: "Boulangère", cost: 0, shields: ["wheat"],
      fx: [{ t: "goldPerShield", s: "wheat", n: 1 }, { t: "keysPerBanner" }], score: { t: "square", n: 3 } }),
  V({ id: "bergere", name: "Bergère", cost: 5, shields: ["black", "wheat"],
      fx: [{ t: "goldPerEmpty" }], score: { t: "adj", s: "wheat", dir: "h", n: 3 } }),
  V({ id: "serrurier", name: "Serrurier", cost: 4, shields: ["black", "cross", "wheat"],
      fx: [{ t: "keysPerShield", s: "cross", n: 1 }], score: { t: "perKey", n: 1 } }),
  V({ id: "charpentier", name: "Charpentier", cost: 0, shields: ["black", "cross"],
      fx: [{ t: "keys", n: 2 }], score: { t: "faceDown", n: 8 } }),
  V({ id: "armuriere", name: "Armurière", cost: 3, shields: ["cross"],
      fx: [{ t: "banner", n: 1 }], score: { t: "adj", s: "swords", dir: "v", n: 3 } }),
  V({ id: "vigneron", name: "Vigneron", cost: 2, shields: ["feather", "wheat"],
      fx: [{ t: "goldPerBanner" }], score: { t: "colShield", s: "black", n: 2 } }),
  V({ id: "forgeronne", name: "Forgeronne", cost: 5, shields: ["swords", "cross"],
      fx: [{ t: "neighborGoldOrKeys", s: "crown", k: 2 }], score: { t: "colShield", s: "black", n: 2 } }),
  V({ id: "maitre_armes", name: "Maître d'armes", cost: 2, shields: ["swords", "swords"],
      fx: [{ t: "goldPerShield", s: "swords", n: 1 }], score: { t: "purse", per: 2, max: 4 }, purseMax: 4 }),
  V({ id: "bourreau", name: "Bourreau", cost: 0, shields: ["black", "swords"],
      fx: [{ t: "marketCost", res: "gold" }], score: { t: "perBanner", n: 1 } }),
];

export const CHATEAU_CARDS: ChateauCard[] = [...CASTLE, ...VILLAGE];

const BY_ID = new Map(CHATEAU_CARDS.map((c) => [c.id, c]));

export const chateauCardById = (id: string): ChateauCard => {
  const card = BY_ID.get(id);
  if (!card) throw new Error(`Unknown Château Combo card: ${id}`);
  return card;
};

/** Resources granted when a card is taken face-down instead of bought. */
export const CHATEAU_FACEDOWN = { gold: 6, keys: 2 } as const;
/** Starting resources. */
export const CHATEAU_START = { gold: 15, keys: 2 } as const;
