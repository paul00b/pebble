// ── Château Combo card database ─────────────────────────────────────────────
// Corrected & complete transcription (39 Château + 39 Village = 78 cards), six
// families of blason. Shared by the server engine (rules) and the client
// (display): the view only carries card ids, both sides look the data up here.
//
// The six families (blasons):
//  - noble    [COURONNE] blue   👑
//  - religious[PRIÈRE]   purple 🙏
//  - scholar  [PLUME]    green  🪶
//  - military [ÉPÉE]     red    ⚔️
//  - artisan  [MAILLET]  orange 🔨
//  - peasant  [BLÉ]      yellow 🌾
//
// `switchMessenger: true` cards move the Messenger to the other market row at
// the end of their resolution (the "messenger" flag from the spec).
//
// Interpretation notes for choices the engine auto-resolves:
//  - "chez 1 voisin au choix" counts the best opponent for that quantity.
//  - "OU N clés" / "OU ..." choices take whichever side is worth more.
//  - "l'une des 3 cartes au choix … puis défausser" (marketTake) takes the most
//    expensive card of the named row, gains its cost, and discards it.
//  - Position / row / column scores are normalised over the final bounding box
//    of the tableau (which is exactly 3×3 once nine cards are placed).

export type ChateauShield =
  | "noble"     // couronne bleue
  | "religious" // prière violette
  | "scholar"   // plume verte
  | "military"  // épée rouge
  | "artisan"   // maillet orange
  | "peasant";  // épi de blé jaune

export const CHATEAU_SHIELDS: ChateauShield[] = [
  "noble",
  "religious",
  "scholar",
  "military",
  "artisan",
  "peasant",
];

export type ChateauDeck = "castle" | "village";

/** Immediate effect, resolved right after the card is placed. */
export type ChateauFx =
  | { t: "gold"; n: number }
  | { t: "keys"; n: number }
  | { t: "goldPerShield"; s: ChateauShield; n: number }
  | { t: "keysPerShield"; s: ChateauShield; n: number }
  | { t: "goldPerDistinct"; n: number }            // per distinct family present
  | { t: "keysPerDistinct"; n: number }
  | { t: "keysPerAbsent"; n: number }              // per missing family (6 − present)
  | { t: "goldPerEmpty"; n: number }
  | { t: "goldPerOccupied"; n: number }
  | { t: "goldPerCost"; c: number; n: number }     // per card whose printed cost == c
  | { t: "goldPerDeckCard"; deck: ChateauDeck; n: number } // per village/castle card you own
  | { t: "keysPerDeckCard"; deck: ChateauDeck; n: number }
  | { t: "perCardShield"; res: "gold" | "keys"; count: number; n: number } // per card with `count` blasons
  | { t: "keysPerPurseCard"; n: number }           // per card bearing a purse
  | { t: "discount"; scope: "both" | "castle" | "village" } // permanent −1 marker
  | { t: "purseAll"; n: number }
  | { t: "fillPurses"; n: number }
  | { t: "purseAllOrKeys"; n: number; k: number }
  | { t: "oppGold"; n: number }
  | { t: "oppKeys"; n: number }
  | { t: "allKeys"; n: number }
  | { t: "neighborGoldOrKeys"; s: ChateauShield; k: number }
  | { t: "neighborKeysPerShield"; s: ChateauShield }
  | { t: "neighborKeysPerDeckCard"; deck: ChateauDeck }
  | { t: "neighborGoldOrKeysShield"; gs: ChateauShield; ks: ChateauShield } // gold@neighbor OR keys@self
  | { t: "marketTake"; deck: ChateauDeck; res: "gold" | "keys" };

/** Position keywords used by position-based scores (normalised bounding box). */
export type ChateauPos =
  | "rowTop"
  | "rowBottom"
  | "rowCenter"
  | "colLeft"
  | "colRight"
  | "colCenter"
  | "corners"
  | "plusCenters"; // the four edge-midpoints (above/below/left/right of centre)

/** End-of-game scoring formula. */
export type ChateauScore =
  | { t: "perShield"; s: ChateauShield; n: number }
  | { t: "absent"; s: ChateauShield; n: number }
  | { t: "perKey"; n: number }
  | { t: "perSet"; set: ChateauShield[]; n: number }
  | { t: "perTripletAny"; n: number }              // per set of 3 identical blasons (any family)
  | { t: "adj"; s: ChateauShield; dir: "h" | "v" | "o"; n: number }
  | { t: "distinctAdj"; dir: "h" | "v" | "o"; n: number } // per distinct family adjacent
  | { t: "distinctRowShield"; n: number }          // per distinct family in its row
  | { t: "distinctColShield"; n: number }          // per distinct family in its column
  | { t: "perDistinctShield"; n: number }          // per distinct family in the tableau
  | { t: "perAbsentShield"; n: number }            // per missing family (6 − present)
  | { t: "perMultiShieldCard"; n: number }         // per card with 2 blasons
  | { t: "purse"; per: number; max: number }
  | { t: "totalPurse"; n: number }                 // per gold stored across all purses
  | { t: "perCost"; c: number; min?: boolean; n: number }
  | { t: "perDeckCard"; deck: ChateauDeck; n: number }
  | { t: "perDeckPair"; n: number }                // per village+castle pair
  | { t: "perDeckSet"; deck: ChateauDeck; size: number; n: number } // per `size` cards of a deck
  | { t: "perReductionCard"; n: number }           // per card with a discount effect
  | { t: "position"; where: ChateauPos; n: number }
  | { t: "faceDown"; n: number };

export interface ChateauCard {
  id: string;
  deck: ChateauDeck;
  name: string;
  cost: number;
  /** Move the Messenger to the other row once this card is resolved. */
  switchMessenger: boolean;
  /** Shield instances - duplicates are real (e.g. double crown). */
  shields: ChateauShield[];
  fx: ChateauFx[];
  score: ChateauScore;
  /** Storage cap for cards with a purse (gold beyond it is not stored). */
  purseMax?: number;
}

type CardDef = Omit<ChateauCard, "deck">;
const C = (card: CardDef): ChateauCard => ({ ...card, deck: "castle" });
const V = (card: CardDef): ChateauCard => ({ ...card, deck: "village" });

/* ── Château deck (39) ──────────────────────────────────────────────────── */
const CASTLE: ChateauCard[] = [
  C({ id: "baron", name: "Baron", cost: 3, switchMessenger: false, shields: ["noble"],
      fx: [{ t: "discount", scope: "both" }], score: { t: "absent", s: "peasant", n: 10 } }),
  C({ id: "souffleur", name: "Souffleur de verre", cost: 5, switchMessenger: true, shields: ["artisan"],
      fx: [{ t: "goldPerShield", s: "religious", n: 1 }, { t: "goldPerShield", s: "artisan", n: 1 }],
      score: { t: "perSet", set: ["religious", "artisan"], n: 4 } }),
  C({ id: "prince", name: "Prince", cost: 6, switchMessenger: false, shields: ["noble"],
      fx: [{ t: "goldPerShield", s: "noble", n: 1 }], score: { t: "adj", s: "noble", dir: "h", n: 4 } }),
  C({ id: "scribe", name: "Scribe", cost: 4, switchMessenger: true, shields: ["religious"],
      fx: [{ t: "goldPerShield", s: "religious", n: 1 }], score: { t: "adj", s: "scholar", dir: "o", n: 3 } }),
  C({ id: "aumonier", name: "Aumônier", cost: 5, switchMessenger: true, shields: ["religious"],
      fx: [{ t: "perCardShield", res: "gold", count: 1, n: 1 }], score: { t: "perDeckCard", deck: "village", n: 2 } }),
  C({ id: "alchimiste", name: "Alchimiste", cost: 6, switchMessenger: false, shields: ["scholar"],
      fx: [{ t: "discount", scope: "both" }], score: { t: "perReductionCard", n: 4 } }),
  C({ id: "chatelaine", name: "Châtelaine", cost: 2, switchMessenger: false, shields: ["noble", "artisan"],
      fx: [{ t: "discount", scope: "castle" }], score: { t: "distinctRowShield", n: 2 } }),
  C({ id: "duchesse", name: "Duchesse", cost: 5, switchMessenger: false, shields: ["noble", "noble"],
      fx: [{ t: "keys", n: 2 }], score: { t: "position", where: "rowTop", n: 8 } }),
  C({ id: "maitre_guilde", name: "Maître de guilde", cost: 5, switchMessenger: true, shields: ["artisan", "artisan"],
      fx: [{ t: "marketTake", deck: "village", res: "keys" }], score: { t: "position", where: "rowBottom", n: 5 } }),
  C({ id: "mere_superieure", name: "Mère supérieure", cost: 5, switchMessenger: false, shields: ["religious", "religious"],
      fx: [{ t: "keys", n: 4 }], score: { t: "position", where: "rowTop", n: 5 } }),
  C({ id: "chevaleresse", name: "Chevaleresse", cost: 5, switchMessenger: false, shields: ["military"],
      fx: [{ t: "goldPerDeckCard", deck: "castle", n: 1 }], score: { t: "adj", s: "noble", dir: "o", n: 3 } }),
  C({ id: "garde", name: "Garde royal", cost: 4, switchMessenger: true, shields: ["noble", "military"],
      fx: [{ t: "allKeys", n: 1 }], score: { t: "adj", s: "noble", dir: "v", n: 3 } }),
  C({ id: "capitaine", name: "Capitaine", cost: 5, switchMessenger: true, shields: ["military", "military"],
      fx: [{ t: "discount", scope: "village" }], score: { t: "position", where: "colRight", n: 8 } }),
  C({ id: "mecene", name: "Mécène", cost: 7, switchMessenger: false, shields: ["scholar"],
      fx: [{ t: "oppGold", n: 2 }], score: { t: "perCost", c: 5, min: true, n: 5 } }),
  C({ id: "generale", name: "Générale", cost: 7, switchMessenger: false, shields: ["military"],
      fx: [{ t: "keysPerDistinct", n: 1 }], score: { t: "perTripletAny", n: 6 } }),
  C({ id: "veilleur", name: "Veilleur", cost: 6, switchMessenger: false, shields: ["military"],
      fx: [{ t: "keysPerShield", s: "military", n: 1 }], score: { t: "distinctAdj", dir: "v", n: 4 } }),
  C({ id: "officier", name: "Officier", cost: 5, switchMessenger: false, shields: ["military"],
      fx: [{ t: "goldPerShield", s: "noble", n: 1 }, { t: "goldPerShield", s: "military", n: 1 }],
      score: { t: "perSet", set: ["noble", "military"], n: 4 } }),
  C({ id: "juge", name: "Juge", cost: 4, switchMessenger: false, shields: ["scholar"],
      fx: [{ t: "keys", n: 2 }], score: { t: "perDeckPair", n: 3 } }),
  C({ id: "architecte", name: "Architecte", cost: 4, switchMessenger: true, shields: ["scholar"],
      fx: [{ t: "discount", scope: "village" }], score: { t: "perDistinctShield", n: 2 } }),
  C({ id: "orfevre", name: "Orfèvre", cost: 4, switchMessenger: true, shields: ["scholar", "artisan"],
      fx: [{ t: "perCardShield", res: "keys", count: 2, n: 1 }], score: { t: "position", where: "colLeft", n: 6 } }),
  C({ id: "apothicaire", name: "Apothicaire", cost: 3, switchMessenger: true, shields: ["scholar"],
      fx: [{ t: "discount", scope: "castle" }], score: { t: "adj", s: "scholar", dir: "v", n: 3 } }),
  C({ id: "intendant", name: "Intendant", cost: 0, switchMessenger: false, shields: ["noble"],
      fx: [{ t: "fillPurses", n: 2 }], score: { t: "purse", per: 2, max: 3 }, purseMax: 3 }),
  C({ id: "professeur", name: "Professeur", cost: 4, switchMessenger: true, shields: ["scholar"],
      fx: [{ t: "goldPerDistinct", n: 1 }], score: { t: "adj", s: "scholar", dir: "h", n: 3 } }),
  C({ id: "banquiere", name: "Banquière", cost: 7, switchMessenger: true, shields: ["artisan"],
      fx: [{ t: "purseAllOrKeys", n: 2, k: 3 }], score: { t: "totalPurse", n: 1 } }),
  C({ id: "preteur", name: "Prêteur sur gages", cost: 4, switchMessenger: true, shields: ["artisan"],
      fx: [{ t: "goldPerCost", c: 4, n: 1 }], score: { t: "perCost", c: 4, n: 3 } }),
  C({ id: "chanceliere", name: "Chancelière", cost: 6, switchMessenger: false, shields: ["noble", "scholar"],
      fx: [{ t: "keysPerShield", s: "scholar", n: 1 }], score: { t: "perDeckCard", deck: "castle", n: 2 } }),
  C({ id: "doyenne", name: "Doyenne", cost: 3, switchMessenger: false, shields: ["noble", "noble"],
      fx: [{ t: "purseAll", n: 2 }], score: { t: "purse", per: 2, max: 5 }, purseMax: 5 }),
  C({ id: "princesse", name: "Princesse", cost: 3, switchMessenger: true, shields: ["noble"],
      fx: [{ t: "discount", scope: "castle" }], score: { t: "adj", s: "noble", dir: "h", n: 3 } }),
  C({ id: "astronome", name: "Astronome", cost: 5, switchMessenger: false, shields: ["scholar", "scholar"],
      fx: [{ t: "discount", scope: "castle" }], score: { t: "position", where: "colLeft", n: 8 } }),
  C({ id: "cardinale", name: "Cardinale", cost: 4, switchMessenger: false, shields: ["religious"],
      fx: [{ t: "keysPerDeckCard", deck: "castle", n: 1 }], score: { t: "adj", s: "religious", dir: "h", n: 3 } }),
  C({ id: "pelerin", name: "Pèlerin", cost: 6, switchMessenger: true, shields: ["religious"],
      fx: [{ t: "discount", scope: "village" }], score: { t: "distinctAdj", dir: "h", n: 4 } }),
  C({ id: "bouffon", name: "Bouffon", cost: 3, switchMessenger: true, shields: ["noble"],
      fx: [{ t: "goldPerShield", s: "noble", n: 2 }], score: { t: "adj", s: "noble", dir: "o", n: 2 } }),
  C({ id: "altesse", name: "Son Altesse", cost: 6, switchMessenger: true, shields: ["noble", "religious"],
      fx: [{ t: "oppGold", n: 1 }], score: { t: "adj", s: "noble", dir: "v", n: 4 } }),
  C({ id: "nonne", name: "Nonne", cost: 3, switchMessenger: true, shields: ["religious"],
      fx: [{ t: "goldPerDeckCard", deck: "castle", n: 1 }], score: { t: "adj", s: "religious", dir: "v", n: 3 } }),
  C({ id: "reine", name: "Sa Majesté la Reine", cost: 7, switchMessenger: false, shields: ["noble"],
      fx: [{ t: "keysPerShield", s: "noble", n: 1 }],
      score: { t: "perSet", set: ["noble", "scholar", "artisan"], n: 10 } }),
  C({ id: "devot", name: "Dévot", cost: 4, switchMessenger: false, shields: ["religious"],
      fx: [{ t: "goldPerEmpty", n: 1 }], score: { t: "absent", s: "artisan", n: 10 } }),
  C({ id: "fossoyeur", name: "Fossoyeur", cost: 4, switchMessenger: false, shields: ["religious", "scholar"],
      fx: [{ t: "marketTake", deck: "village", res: "gold" }], score: { t: "purse", per: 2, max: 8 }, purseMax: 8 }),
  C({ id: "templier", name: "Templier", cost: 5, switchMessenger: true, shields: ["religious", "military"],
      fx: [{ t: "neighborGoldOrKeysShield", gs: "religious", ks: "military" }], score: { t: "perKey", n: 1 } }),
  C({ id: "saintete", name: "Sa Sainteté", cost: 7, switchMessenger: false, shields: ["religious"],
      fx: [{ t: "keys", n: 3 }, { t: "oppKeys", n: 1 }], score: { t: "perAbsentShield", n: 6 } }),
];

/* ── Village deck (39) ──────────────────────────────────────────────────── */
const VILLAGE: ChateauCard[] = [
  V({ id: "serrurier", name: "Serrurier", cost: 4, switchMessenger: true, shields: ["artisan", "peasant"],
      fx: [{ t: "keysPerShield", s: "artisan", n: 1 }], score: { t: "perKey", n: 1 } }),
  V({ id: "bourreau", name: "Bourreau", cost: 0, switchMessenger: true, shields: ["military"],
      fx: [{ t: "marketTake", deck: "castle", res: "gold" }], score: { t: "perDeckCard", deck: "castle", n: 1 } }),
  V({ id: "vigneron", name: "Vigneron", cost: 2, switchMessenger: false, shields: ["peasant", "scholar"],
      fx: [{ t: "goldPerDeckCard", deck: "village", n: 1 }], score: { t: "distinctColShield", n: 2 } }),
  V({ id: "forgeronne", name: "Forgeronne", cost: 5, switchMessenger: false, shields: ["military", "artisan"],
      fx: [{ t: "neighborGoldOrKeys", s: "noble", k: 2 }], score: { t: "perMultiShieldCard", n: 2 } }),
  V({ id: "maitre_armes", name: "Maître d'armes", cost: 2, switchMessenger: false, shields: ["military", "military"],
      fx: [{ t: "goldPerShield", s: "military", n: 1 }], score: { t: "purse", per: 2, max: 4 }, purseMax: 4 }),
  V({ id: "armuriere", name: "Armurière", cost: 3, switchMessenger: false, shields: ["artisan"],
      fx: [{ t: "discount", scope: "both" }], score: { t: "adj", s: "military", dir: "o", n: 3 } }),
  V({ id: "charpentier", name: "Charpentier", cost: 0, switchMessenger: true, shields: ["artisan"],
      fx: [{ t: "keysPerAbsent", n: 1 }], score: { t: "faceDown", n: 8 } }),
  V({ id: "bergere", name: "Bergère", cost: 5, switchMessenger: true, shields: ["peasant"],
      fx: [{ t: "goldPerEmpty", n: 1 }], score: { t: "adj", s: "peasant", dir: "h", n: 3 } }),
  V({ id: "brigand", name: "Brigand", cost: 7, switchMessenger: false, shields: ["peasant"],
      fx: [{ t: "neighborKeysPerDeckCard", deck: "castle" }], score: { t: "perDeckSet", deck: "village", size: 3, n: 7 } }),
  V({ id: "boulangere", name: "Boulangère", cost: 0, switchMessenger: false, shields: ["peasant"],
      fx: [{ t: "goldPerShield", s: "peasant", n: 1 }, { t: "keysPerDeckCard", deck: "village", n: 1 }],
      score: { t: "position", where: "plusCenters", n: 3 } }),
  V({ id: "mercenaire", name: "Mercenaire", cost: 6, switchMessenger: false, shields: ["peasant", "military"],
      fx: [{ t: "goldPerDistinct", n: 1 }], score: { t: "perSet", set: ["religious", "military", "peasant"], n: 7 } }),
  V({ id: "mendiante", name: "Mendiante", cost: 0, switchMessenger: false, shields: ["peasant"],
      fx: [{ t: "goldPerOccupied", n: 1 }], score: { t: "adj", s: "religious", dir: "o", n: 2 } }),
  V({ id: "barbare", name: "Barbare", cost: 2, switchMessenger: true, shields: ["military"],
      fx: [{ t: "neighborGoldOrKeys", s: "scholar", k: 2 }], score: { t: "absent", s: "scholar", n: 10 } }),
  V({ id: "milicien", name: "Milicien", cost: 2, switchMessenger: true, shields: ["military"],
      fx: [{ t: "neighborGoldOrKeys", s: "peasant", k: 2 }], score: { t: "adj", s: "military", dir: "h", n: 3 } }),
  V({ id: "batard", name: "Bâtard", cost: 4, switchMessenger: false, shields: ["noble", "peasant"],
      fx: [{ t: "keysPerShield", s: "noble", n: 1 }], score: { t: "adj", s: "peasant", dir: "v", n: 3 } }),
  V({ id: "moine", name: "Moine", cost: 4, switchMessenger: true, shields: ["peasant", "religious"],
      fx: [{ t: "keysPerShield", s: "religious", n: 1 }], score: { t: "adj", s: "peasant", dir: "o", n: 2 } }),
  V({ id: "sorciere", name: "Sorcière", cost: 4, switchMessenger: true, shields: ["peasant"],
      fx: [{ t: "goldPerShield", s: "peasant", n: 1 }, { t: "neighborKeysPerShield", s: "religious" }],
      score: { t: "absent", s: "religious", n: 9 } }),
  V({ id: "bucheron", name: "Bûcheron", cost: 0, switchMessenger: false, shields: ["peasant"],
      fx: [{ t: "goldPerOccupied", n: 1 }], score: { t: "position", where: "colRight", n: 5 } }),
  V({ id: "agricultrice", name: "Agricultrice", cost: 5, switchMessenger: true, shields: ["peasant", "peasant"],
      fx: [{ t: "keysPerShield", s: "peasant", n: 1 }], score: { t: "position", where: "rowBottom", n: 7 } }),
  V({ id: "voyageuse", name: "Voyageuse", cost: 0, switchMessenger: false, shields: ["peasant"],
      fx: [{ t: "goldPerCost", c: 0, n: 3 }], score: { t: "perCost", c: 0, n: 2 } }),
  V({ id: "inventeur", name: "Inventeur", cost: 2, switchMessenger: false, shields: ["scholar", "scholar"],
      fx: [{ t: "goldPerShield", s: "scholar", n: 1 }], score: { t: "perDeckCard", deck: "village", n: 1 } }),
  V({ id: "miraculee", name: "Miraculée", cost: 2, switchMessenger: true, shields: ["religious", "religious"],
      fx: [{ t: "keysPerPurseCard", n: 1 }], score: { t: "purse", per: 2, max: 4 }, purseMax: 4 }),
  V({ id: "cure", name: "Curé", cost: 0, switchMessenger: true, shields: ["religious"],
      fx: [{ t: "goldPerDeckCard", deck: "village", n: 1 }], score: { t: "purse", per: 2, max: 5 }, purseMax: 5 }),
  V({ id: "fermiere", name: "Fermière", cost: 0, switchMessenger: true, shields: ["peasant"],
      fx: [{ t: "discount", scope: "village" }], score: { t: "purse", per: 2, max: 5 }, purseMax: 5 }),
  V({ id: "medecin", name: "Médecin", cost: 5, switchMessenger: true, shields: ["scholar"],
      fx: [{ t: "goldPerShield", s: "scholar", n: 1 }, { t: "goldPerShield", s: "peasant", n: 1 }],
      score: { t: "perSet", set: ["scholar", "peasant"], n: 4 } }),
  V({ id: "artificier", name: "Artificier", cost: 2, switchMessenger: false, shields: ["military"],
      fx: [{ t: "neighborGoldOrKeys", s: "artisan", k: 2 }], score: { t: "adj", s: "military", dir: "v", n: 3 } }),
  V({ id: "apiculteur", name: "Apiculteur", cost: 2, switchMessenger: false, shields: ["peasant"],
      fx: [{ t: "purseAll", n: 2 }], score: { t: "purse", per: 2, max: 9 }, purseMax: 9 }),
  V({ id: "espion", name: "Espion", cost: 4, switchMessenger: false, shields: ["scholar", "military"],
      fx: [{ t: "goldPerShield", s: "scholar", n: 1 }, { t: "neighborKeysPerShield", s: "military" }],
      score: { t: "position", where: "colCenter", n: 6 } }),
  V({ id: "epiciere", name: "Épicière", cost: 0, switchMessenger: false, shields: ["artisan"],
      fx: [{ t: "goldPerShield", s: "artisan", n: 2 }], score: { t: "position", where: "rowCenter", n: 5 } }),
  V({ id: "ecuyer", name: "Écuyer", cost: 0, switchMessenger: false, shields: ["military"],
      fx: [{ t: "discount", scope: "both" }], score: { t: "adj", s: "artisan", dir: "o", n: 2 } }),
  V({ id: "aubergiste", name: "Aubergiste", cost: 0, switchMessenger: false, shields: ["artisan"],
      fx: [{ t: "purseAll", n: 2 }, { t: "oppGold", n: 2 }], score: { t: "purse", per: 2, max: 6 }, purseMax: 6 }),
  V({ id: "sculptrice", name: "Sculptrice", cost: 3, switchMessenger: true, shields: ["religious", "artisan"],
      fx: [{ t: "keysPerShield", s: "religious", n: 1 }], score: { t: "purse", per: 2, max: 7 }, purseMax: 7 }),
  V({ id: "usurpateur", name: "Usurpateur", cost: 5, switchMessenger: true, shields: ["peasant"],
      fx: [{ t: "perCardShield", res: "keys", count: 1, n: 1 }], score: { t: "perDeckCard", deck: "castle", n: 2 } }),
  V({ id: "philosophe", name: "Philosophe", cost: 2, switchMessenger: false, shields: ["scholar"],
      fx: [{ t: "discount", scope: "castle" }], score: { t: "absent", s: "military", n: 10 } }),
  V({ id: "potier", name: "Potier", cost: 2, switchMessenger: true, shields: ["artisan", "artisan"],
      fx: [{ t: "purseAll", n: 2 }], score: { t: "purse", per: 2, max: 4 }, purseMax: 4 }),
  V({ id: "pecheur", name: "Pêcheur", cost: 2, switchMessenger: false, shields: ["peasant", "peasant"],
      fx: [{ t: "discount", scope: "castle" }], score: { t: "position", where: "corners", n: 4 } }),
  V({ id: "horlogere", name: "Horlogère", cost: 3, switchMessenger: true, shields: ["artisan"],
      fx: [{ t: "goldPerShield", s: "artisan", n: 1 }], score: { t: "adj", s: "artisan", dir: "h", n: 3 } }),
  V({ id: "tailleuse", name: "Tailleuse de pierre", cost: 3, switchMessenger: true, shields: ["artisan"],
      fx: [{ t: "discount", scope: "village" }], score: { t: "adj", s: "artisan", dir: "v", n: 3 } }),
  V({ id: "revolutionnaire", name: "Révolutionnaire", cost: 4, switchMessenger: true, shields: ["peasant"],
      fx: [{ t: "keysPerDeckCard", deck: "village", n: 1 }], score: { t: "absent", s: "noble", n: 9 } }),
];

export const CHATEAU_CARDS: ChateauCard[] = [...CASTLE, ...VILLAGE];

const BY_ID = new Map(CHATEAU_CARDS.map((c) => [c.id, c]));

export const chateauCardById = (id: string): ChateauCard => {
  const card = BY_ID.get(id);
  if (!card) throw new Error(`Unknown Château Combo card: ${id}`);
  return card;
};

/** Blason-instance totals per deck, derived from the card data (for the glossary). */
export function chateauFamilyCounts(): Record<ChateauShield, { castle: number; village: number }> {
  const out = Object.fromEntries(
    CHATEAU_SHIELDS.map((s) => [s, { castle: 0, village: 0 }])
  ) as Record<ChateauShield, { castle: number; village: number }>;
  for (const card of CHATEAU_CARDS) {
    for (const s of card.shields) out[s][card.deck] += 1;
  }
  return out;
}

/** True if placing this card moves the Messenger to the other market row. */
export const chateauSwitchesMessenger = (id: string): boolean =>
  chateauCardById(id).switchMessenger;

/** Resources granted when a card is taken face-down instead of bought. */
export const CHATEAU_FACEDOWN = { gold: 6, keys: 2 } as const;
/** Starting resources. */
export const CHATEAU_START = { gold: 15, keys: 2 } as const;
