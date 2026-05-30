// Drawable words for Gartic — concrete, picturable nouns in FR and EN.

import type { Language } from "../../../shared/src/games.js";

const EN = [
  "apple", "banana", "house", "tree", "car", "dog", "cat", "fish", "sun", "moon",
  "star", "cloud", "rain", "snowman", "mountain", "river", "bridge", "boat", "plane", "train",
  "rocket", "robot", "ghost", "dragon", "dinosaur", "elephant", "giraffe", "lion", "tiger", "monkey",
  "penguin", "octopus", "butterfly", "bee", "spider", "snake", "frog", "turtle", "crab", "whale",
  "guitar", "piano", "drum", "trumpet", "book", "pencil", "scissors", "clock", "key", "lamp",
  "umbrella", "glasses", "hat", "shoe", "sock", "shirt", "crown", "ring", "camera", "phone",
  "computer", "television", "chair", "table", "bed", "door", "window", "ladder", "hammer", "saw",
  "knife", "fork", "spoon", "cup", "bottle", "pizza", "burger", "cake", "ice cream", "egg",
  "carrot", "mushroom", "flower", "cactus", "leaf", "anchor", "castle", "lighthouse", "windmill", "tent",
  "balloon", "kite", "snail", "ladybug", "rainbow", "volcano", "island", "pyramid", "skeleton", "crown",
];

const FR = [
  "pomme", "banane", "maison", "arbre", "voiture", "chien", "chat", "poisson", "soleil", "lune",
  "étoile", "nuage", "pluie", "bonhomme de neige", "montagne", "rivière", "pont", "bateau", "avion", "train",
  "fusée", "robot", "fantôme", "dragon", "dinosaure", "éléphant", "girafe", "lion", "tigre", "singe",
  "pingouin", "pieuvre", "papillon", "abeille", "araignée", "serpent", "grenouille", "tortue", "crabe", "baleine",
  "guitare", "piano", "tambour", "trompette", "livre", "crayon", "ciseaux", "horloge", "clé", "lampe",
  "parapluie", "lunettes", "chapeau", "chaussure", "chaussette", "chemise", "couronne", "bague", "appareil photo", "téléphone",
  "ordinateur", "télévision", "chaise", "table", "lit", "porte", "fenêtre", "échelle", "marteau", "scie",
  "couteau", "fourchette", "cuillère", "tasse", "bouteille", "pizza", "burger", "gâteau", "glace", "œuf",
  "carotte", "champignon", "fleur", "cactus", "feuille", "ancre", "château", "phare", "moulin", "tente",
  "ballon", "cerf-volant", "escargot", "coccinelle", "arc-en-ciel", "volcan", "île", "pyramide", "squelette", "soleil",
];

const BANKS: Record<Language, string[]> = { en: EN, fr: FR };

export function randomWord(language: Language): string {
  const pool = BANKS[language];
  return pool[Math.floor(Math.random() * pool.length)];
}
