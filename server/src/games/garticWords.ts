// Drawable words for Gartic, split by difficulty. "easy" = simple concrete nouns,
// "medium" = trickier objects/scenes, "hard" = idioms & expressions. Each turn the
// drawer is offered two options (always with at least one easy) to pick from.

import type { GarticChoice, GarticDifficulty, Language } from "../../../shared/src/games.js";

const EN_EASY = [
  "apple", "banana", "house", "tree", "car", "dog", "cat", "fish", "sun", "moon",
  "star", "cloud", "rain", "snowman", "mountain", "river", "bridge", "boat", "plane", "train",
  "rocket", "robot", "ghost", "dragon", "dinosaur", "elephant", "giraffe", "lion", "tiger", "monkey",
  "penguin", "octopus", "butterfly", "bee", "spider", "snake", "frog", "turtle", "crab", "whale",
  "guitar", "piano", "drum", "trumpet", "book", "pencil", "scissors", "clock", "key", "lamp",
  "umbrella", "glasses", "hat", "shoe", "sock", "shirt", "crown", "ring", "camera", "phone",
  "computer", "television", "chair", "table", "bed", "door", "window", "ladder", "hammer", "saw",
  "knife", "fork", "spoon", "cup", "bottle", "pizza", "burger", "cake", "ice cream", "egg",
  "carrot", "mushroom", "flower", "cactus", "leaf", "anchor", "castle", "lighthouse", "windmill", "tent",
  "balloon", "kite", "snail", "ladybug", "rainbow", "volcano", "island", "pyramid", "skeleton", "heart",
];

const EN_MEDIUM = [
  "compass", "hourglass", "treasure chest", "knight", "wizard", "mermaid", "unicorn", "scarecrow",
  "chandelier", "fountain", "submarine", "helicopter", "telescope", "microscope", "skateboard",
  "wheelchair", "trampoline", "fireworks", "waterfall", "tornado", "igloo", "hot air balloon",
  "roller coaster", "vending machine", "lawn mower", "fire hydrant", "traffic light", "shopping cart",
  "vacuum cleaner", "lighthouse keeper", "grandfather clock", "message in a bottle", "haunted house",
  "shooting star", "pirate ship", "magic carpet", "crystal ball", "spinning top", "weather vane",
  "drawbridge", "totem pole", "sand castle", "jukebox", "typewriter", "gramophone", "guillotine",
  "merry-go-round", "ferris wheel", "diving board",
];

const EN_HARD = [
  "raining cats and dogs", "piece of cake", "break a leg", "spill the beans", "cold feet",
  "couch potato", "bull in a china shop", "the early bird catches the worm", "barking up the wrong tree",
  "kill two birds with one stone", "let the cat out of the bag", "when pigs fly", "elephant in the room",
  "hit the nail on the head", "a storm in a teacup", "head in the clouds", "fish out of water",
  "the tip of the iceberg", "a wolf in sheep's clothing", "burning the midnight oil",
  "once in a blue moon", "the ball is in your court", "bite the bullet", "back to the drawing board",
  "a needle in a haystack", "walking on eggshells", "the world at your feet", "saved by the bell",
  "a leopard can't change its spots", "to cost an arm and a leg",
];

const FR_EASY = [
  "pomme", "banane", "maison", "arbre", "voiture", "chien", "chat", "poisson", "soleil", "lune",
  "étoile", "nuage", "pluie", "bonhomme de neige", "montagne", "rivière", "pont", "bateau", "avion", "train",
  "fusée", "robot", "fantôme", "dragon", "dinosaure", "éléphant", "girafe", "lion", "tigre", "singe",
  "pingouin", "pieuvre", "papillon", "abeille", "araignée", "serpent", "grenouille", "tortue", "crabe", "baleine",
  "guitare", "piano", "tambour", "trompette", "livre", "crayon", "ciseaux", "horloge", "clé", "lampe",
  "parapluie", "lunettes", "chapeau", "chaussure", "chaussette", "chemise", "couronne", "bague", "appareil photo", "téléphone",
  "ordinateur", "télévision", "chaise", "table", "lit", "porte", "fenêtre", "échelle", "marteau", "scie",
  "couteau", "fourchette", "cuillère", "tasse", "bouteille", "pizza", "burger", "gâteau", "glace", "œuf",
  "carotte", "champignon", "fleur", "cactus", "feuille", "ancre", "château", "phare", "moulin", "tente",
  "ballon", "cerf-volant", "escargot", "coccinelle", "arc-en-ciel", "volcan", "île", "pyramide", "squelette", "cœur",
];

const FR_MEDIUM = [
  "boussole", "sablier", "coffre au trésor", "chevalier", "sorcier", "sirène", "licorne", "épouvantail",
  "lustre", "fontaine", "sous-marin", "hélicoptère", "télescope", "microscope", "skateboard",
  "fauteuil roulant", "trampoline", "feu d'artifice", "cascade", "tornade", "igloo", "montgolfière",
  "montagnes russes", "distributeur", "tondeuse", "bouche d'incendie", "feu de circulation", "caddie",
  "aspirateur", "horloge comtoise", "message dans une bouteille", "maison hantée", "étoile filante",
  "bateau pirate", "tapis volant", "boule de cristal", "toupie", "girouette", "pont-levis", "manège",
  "grande roue", "machine à écrire", "tourne-disque", "boîte à musique", "plongeoir", "moulin à vent",
  "chevalet", "lampadaire", "balançoire", "toboggan",
];

const FR_HARD = [
  "poser un lapin", "avoir le cafard", "chercher midi à quatorze heures", "couper les cheveux en quatre",
  "donner sa langue au chat", "il pleut des cordes", "avoir un chat dans la gorge", "tomber dans les pommes",
  "mettre la charrue avant les bœufs", "casser les pieds", "la cerise sur le gâteau", "avoir une faim de loup",
  "quand les poules auront des dents", "se serrer la ceinture", "marcher sur des œufs", "avoir le bras long",
  "mettre son grain de sel", "tirer les vers du nez", "monter sur ses grands chevaux", "avoir la tête dans les nuages",
  "passer du coq à l'âne", "être au bout du rouleau", "ne pas y aller par quatre chemins", "avoir d'autres chats à fouetter",
  "jeter l'éponge", "appeler un chat un chat", "tourner autour du pot", "prendre ses jambes à son cou",
  "avoir la chair de poule", "découvrir le pot aux roses",
];

interface Bank {
  easy: string[];
  medium: string[];
  hard: string[];
}

const BANKS: Record<Language, Bank> = {
  en: { easy: EN_EASY, medium: EN_MEDIUM, hard: EN_HARD },
  fr: { easy: FR_EASY, medium: FR_MEDIUM, hard: FR_HARD },
};

const pick = (pool: string[]): string => pool[Math.floor(Math.random() * pool.length)];

/** A single decorative word (used by the lobby board background). */
export function randomWord(language: Language): string {
  const bank = BANKS[language];
  return pick([...bank.easy, ...bank.medium]);
}

/** Two distinct options for the drawer to pick between — always with at least one
 *  easy word, the other drawn from the medium/hard pools to add spice & expressions. */
export function wordChoices(language: Language): GarticChoice[] {
  const bank = BANKS[language];
  const easy: GarticChoice = { word: pick(bank.easy), difficulty: "easy" };

  // The challenger leans toward expressions: ~55% hard, else medium.
  const hardish: GarticDifficulty = Math.random() < 0.55 ? "hard" : "medium";
  let challenger: GarticChoice = { word: pick(bank[hardish]), difficulty: hardish };
  // Guard against the (rare) collision between the two picks.
  let guard = 0;
  while (challenger.word === easy.word && guard++ < 5) {
    challenger = { word: pick(bank[hardish]), difficulty: hardish };
  }

  // Randomize order so the easy option isn't always first.
  return Math.random() < 0.5 ? [easy, challenger] : [challenger, easy];
}
