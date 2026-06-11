// Curated theme bank for Devine 9. Each theme has a prompt, a large pool of
// correct answers (≥ 9 so a fresh subset is drawn each turn for replayability),
// and several "bombs" - tempting but wrong answers the guessing team must avoid.
// One bomb is drawn per turn so a theme rarely repeats the same trap.
//
// BOMB DESIGN: a good bomb is a *near miss* - something the guessing team is
// genuinely tempted to shout because it sits right on the boundary of the
// category (a fruit-like vegetable, a non-Olympic sport, a DC hero in a Marvel
// list). Bombs that are obviously off-theme are never said, so they carry no
// risk. Keep every bomb plausible.

import type { Language } from "../../../shared/src/games.js";

export interface Theme {
  /** The category, read aloud by the checker team (e.g. "Name 9 fruits"). */
  prompt: string;
  /** Pool of correct answers (must hold at least 9). */
  answers: string[];
  /** Pool of tempting near-miss wrong answers; one is drawn per turn. */
  bombs: string[];
}

/** A built turn: 9 answers + 1 bomb, drawn from a theme. */
export interface Devine9Round {
  prompt: string;
  answers: string[];
  bomb: string;
}

const FR: Theme[] = [
  {
    prompt: "Citez 9 mammifères marins",
    answers: ["Baleine", "Dauphin", "Orque", "Phoque", "Otarie", "Morse", "Cachalot", "Narval", "Béluga", "Lamantin", "Dugong", "Marsouin", "Rorqual", "Lion de mer"],
    bombs: ["Requin", "Raie", "Tortue marine", "Manchot", "Pingouin", "Pieuvre", "Thon", "Espadon"],
  },
  {
    prompt: "Citez 9 pays d'Europe",
    answers: ["France", "Espagne", "Italie", "Allemagne", "Portugal", "Belgique", "Suisse", "Autriche", "Grèce", "Suède", "Norvège", "Pologne", "Pays-Bas", "Irlande", "Danemark", "Finlande", "Hongrie", "Roumanie", "Croatie", "Tchéquie"],
    bombs: ["Turquie", "Russie", "Maroc", "Géorgie", "Chypre", "Kazakhstan", "Arménie"],
  },
  {
    prompt: "Citez 9 fruits",
    answers: ["Pomme", "Poire", "Banane", "Fraise", "Cerise", "Raisin", "Orange", "Citron", "Pêche", "Abricot", "Kiwi", "Ananas", "Mangue", "Melon", "Framboise", "Prune", "Figue", "Pastèque", "Myrtille", "Nectarine"],
    bombs: ["Tomate", "Avocat", "Rhubarbe", "Olive", "Potiron", "Concombre"],
  },
  {
    prompt: "Citez 9 légumes",
    answers: ["Carotte", "Poireau", "Courgette", "Aubergine", "Épinard", "Brocoli", "Chou", "Navet", "Radis", "Haricot vert", "Petit pois", "Poivron", "Oignon", "Ail", "Salade", "Céleri", "Betterave", "Artichaut", "Asperge", "Fenouil"],
    bombs: ["Tomate", "Champignon", "Avocat", "Olive", "Rhubarbe"],
  },
  {
    prompt: "Citez 9 sports olympiques",
    answers: ["Natation", "Athlétisme", "Judo", "Escrime", "Aviron", "Cyclisme", "Gymnastique", "Handball", "Basket", "Volley", "Tennis", "Boxe", "Lutte", "Tir à l'arc", "Haltérophilie", "Badminton", "Canoë", "Surf", "Escalade", "Taekwondo"],
    bombs: ["Pétanque", "Échecs", "Squash", "Fléchettes", "Billard", "Football américain", "Polo"],
  },
  {
    prompt: "Citez 9 instruments de musique",
    answers: ["Piano", "Guitare", "Violon", "Flûte", "Trompette", "Batterie", "Saxophone", "Harpe", "Violoncelle", "Clarinette", "Accordéon", "Trombone", "Contrebasse", "Orgue", "Hautbois", "Banjo", "Tuba", "Xylophone"],
    bombs: ["Micro", "Métronome", "Diapason", "Archet", "Partition", "Pupitre", "Médiator"],
  },
  {
    prompt: "Citez 9 animaux de la ferme",
    answers: ["Vache", "Cochon", "Poule", "Mouton", "Chèvre", "Cheval", "Âne", "Canard", "Oie", "Lapin", "Dinde", "Coq", "Taureau", "Poussin", "Pintade", "Brebis", "Veau"],
    bombs: ["Renard", "Sanglier", "Chien", "Chat", "Pigeon", "Cerf", "Souris"],
  },
  {
    prompt: "Citez 9 capitales européennes",
    answers: ["Paris", "Madrid", "Rome", "Berlin", "Lisbonne", "Bruxelles", "Vienne", "Athènes", "Stockholm", "Oslo", "Varsovie", "Amsterdam", "Dublin", "Copenhague", "Helsinki", "Budapest", "Berne", "Prague", "Bucarest", "Sofia"],
    bombs: ["Barcelone", "Milan", "Munich", "Genève", "Hambourg", "Porto", "Francfort", "Naples"],
  },
  {
    prompt: "Citez 9 reptiles",
    answers: ["Serpent", "Lézard", "Crocodile", "Alligator", "Tortue", "Caméléon", "Iguane", "Gecko", "Varan", "Cobra", "Python", "Vipère", "Boa", "Anaconda", "Couleuvre"],
    bombs: ["Grenouille", "Crapaud", "Salamandre", "Triton", "Axolotl", "Requin"],
  },
  {
    prompt: "Citez 9 boissons chaudes",
    answers: ["Café", "Thé", "Chocolat chaud", "Tisane", "Infusion", "Cappuccino", "Expresso", "Latte", "Grog", "Vin chaud", "Lait chaud", "Matcha", "Americano", "Moka"],
    bombs: ["Thé glacé", "Café frappé", "Limonade", "Smoothie", "Milkshake", "Soda"],
  },
  {
    prompt: "Citez 9 pays d'Asie",
    answers: ["Chine", "Japon", "Inde", "Corée", "Thaïlande", "Vietnam", "Indonésie", "Philippines", "Pakistan", "Iran", "Irak", "Mongolie", "Népal", "Cambodge", "Laos", "Malaisie", "Bangladesh", "Birmanie"],
    bombs: ["Russie", "Turquie", "Égypte", "Australie", "Nouvelle-Zélande"],
  },
  {
    prompt: "Citez 9 fleurs",
    answers: ["Rose", "Tulipe", "Marguerite", "Tournesol", "Lys", "Orchidée", "Pivoine", "Jonquille", "Violette", "Muguet", "Iris", "Œillet", "Coquelicot", "Dahlia", "Jasmin", "Lavande", "Pâquerette"],
    bombs: ["Fougère", "Cactus", "Ortie", "Lierre", "Trèfle", "Mousse"],
  },
  {
    prompt: "Citez 9 outils de bricolage",
    answers: ["Marteau", "Tournevis", "Scie", "Perceuse", "Clé", "Pince", "Niveau", "Mètre", "Ponceuse", "Rabot", "Burin", "Tenaille", "Équerre", "Visseuse", "Cutter", "Lime"],
    bombs: ["Clou", "Vis", "Cheville", "Peinture", "Planche", "Établi"],
  },
  {
    prompt: "Citez 9 desserts français",
    answers: ["Éclair", "Tarte tatin", "Crème brûlée", "Mille-feuille", "Macaron", "Profiterole", "Paris-Brest", "Clafoutis", "Far breton", "Madeleine", "Financier", "Opéra", "Religieuse", "Baba au rhum"],
    bombs: ["Tiramisu", "Cheesecake", "Baklava", "Strudel", "Cannoli", "Donut"],
  },
  {
    prompt: "Citez 9 moyens de transport",
    answers: ["Voiture", "Train", "Avion", "Bateau", "Vélo", "Moto", "Bus", "Tramway", "Métro", "Scooter", "Camion", "Hélicoptère", "Trottinette", "Téléphérique", "Ferry"],
    bombs: ["Ascenseur", "Escalator", "Tapis roulant", "Échelle", "Toboggan"],
  },
  {
    prompt: "Citez 9 parties du corps",
    answers: ["Tête", "Bras", "Jambe", "Main", "Pied", "Doigt", "Genou", "Coude", "Épaule", "Dos", "Ventre", "Cou", "Oreille", "Nez", "Bouche", "Œil", "Cheveux", "Cheville", "Poignet", "Menton"],
    bombs: ["Chaussure", "Gant", "Chapeau", "Bague", "Montre", "Lunettes"],
  },
  {
    prompt: "Citez 9 félins",
    answers: ["Chat", "Lion", "Tigre", "Léopard", "Guépard", "Panthère", "Jaguar", "Lynx", "Puma", "Ocelot", "Serval", "Caracal"],
    bombs: ["Hyène", "Loup", "Chien", "Ours", "Renard", "Civette"],
  },
  {
    prompt: "Citez 9 métaux",
    answers: ["Fer", "Or", "Argent", "Cuivre", "Aluminium", "Zinc", "Plomb", "Étain", "Nickel", "Titane", "Platine", "Bronze", "Acier", "Laiton", "Chrome"],
    bombs: ["Verre", "Plastique", "Diamant", "Béton", "Carbone", "Silicium"],
  },
  {
    prompt: "Citez 9 animaux d'Afrique",
    answers: ["Lion", "Éléphant", "Girafe", "Zèbre", "Rhinocéros", "Hippopotame", "Guépard", "Gnou", "Hyène", "Babouin", "Léopard", "Buffle", "Gazelle", "Suricate", "Phacochère"],
    bombs: ["Kangourou", "Tigre", "Panda", "Ours polaire", "Jaguar", "Lama"],
  },
  {
    prompt: "Citez 9 pays d'Amérique du Sud",
    answers: ["Brésil", "Argentine", "Chili", "Pérou", "Colombie", "Venezuela", "Équateur", "Bolivie", "Paraguay", "Uruguay", "Guyana", "Suriname"],
    bombs: ["Mexique", "Panama", "Cuba", "Costa Rica", "Guatemala"],
  },
  {
    prompt: "Citez 9 capitales hors d'Europe",
    answers: ["Tokyo", "Pékin", "Washington", "Ottawa", "Le Caire", "Brasília", "Canberra", "New Delhi", "Moscou", "Buenos Aires", "Bangkok", "Séoul", "Mexico", "Rabat", "Pretoria"],
    bombs: ["New York", "Sydney", "Rio", "Istanbul", "Toronto", "Shanghai"],
  },
  {
    prompt: "Citez 9 fromages français",
    answers: ["Camembert", "Brie", "Roquefort", "Comté", "Reblochon", "Munster", "Cantal", "Beaufort", "Mimolette", "Saint-Nectaire", "Maroilles", "Tomme", "Raclette", "Bleu d'Auvergne", "Emmental"],
    bombs: ["Mozzarella", "Parmesan", "Gouda", "Cheddar", "Feta", "Gorgonzola"],
  },
  {
    prompt: "Citez 9 marques de voitures",
    answers: ["Renault", "Peugeot", "Citroën", "Volkswagen", "BMW", "Mercedes", "Audi", "Toyota", "Ford", "Ferrari", "Fiat", "Tesla", "Nissan", "Porsche", "Opel", "Volvo"],
    bombs: ["Michelin", "Total", "Norauto", "Shell", "Bosch", "Castrol"],
  },
  {
    prompt: "Citez 9 super-héros Marvel",
    answers: ["Iron Man", "Spider-Man", "Captain America", "Thor", "Hulk", "Black Widow", "Doctor Strange", "Black Panther", "Ant-Man", "Captain Marvel", "Wolverine", "Daredevil", "Hawkeye", "Star-Lord", "Deadpool"],
    bombs: ["Batman", "Superman", "Wonder Woman", "Aquaman", "Flash", "Joker"],
  },
  {
    prompt: "Citez 9 personnages Disney",
    answers: ["Mickey", "Minnie", "Donald", "Dingo", "Pluto", "Simba", "Aladdin", "Ariel", "Cendrillon", "Blanche-Neige", "Elsa", "Buzz", "Woody", "Stitch", "Mulan", "Raiponce", "Dumbo"],
    bombs: ["Mario", "Sonic", "Shrek", "Bugs Bunny", "Pikachu", "Hello Kitty"],
  },
  {
    prompt: "Citez 9 séries Netflix",
    answers: ["Stranger Things", "La Casa de Papel", "The Crown", "Lupin", "Squid Game", "Bridgerton", "Dark", "Narcos", "Sex Education", "Ozark", "You", "Wednesday", "Élite", "The Witcher", "Black Mirror"],
    bombs: ["Game of Thrones", "The Mandalorian", "Friends", "The Office", "Breaking Bad"],
  },
  {
    prompt: "Citez 9 réseaux sociaux ou applis",
    answers: ["Instagram", "Facebook", "TikTok", "Twitter", "Snapchat", "YouTube", "LinkedIn", "WhatsApp", "Pinterest", "Reddit", "Discord", "Twitch", "Telegram", "BeReal"],
    bombs: ["Google", "Spotify", "Netflix", "Amazon", "Gmail", "Waze"],
  },
  {
    prompt: "Citez 9 jeux de société",
    answers: ["Monopoly", "Cluedo", "Scrabble", "Risk", "Trivial Pursuit", "Uno", "Échecs", "Dames", "Puissance 4", "Catan", "Carcassonne", "Dixit", "Loup-garou", "Time's Up"],
    bombs: ["Tetris", "Sudoku", "Mots croisés", "Solitaire", "Démineur"],
  },
  {
    prompt: "Citez 9 langues parlées dans le monde",
    answers: ["Anglais", "Espagnol", "Mandarin", "Français", "Arabe", "Hindi", "Portugais", "Russe", "Japonais", "Allemand", "Italien", "Coréen", "Turc", "Néerlandais", "Polonais"],
    bombs: ["Latin", "Python", "Java", "Morse", "Braille"],
  },
  {
    prompt: "Citez 9 éléments chimiques",
    answers: ["Hydrogène", "Oxygène", "Carbone", "Azote", "Fer", "Or", "Argent", "Cuivre", "Hélium", "Sodium", "Potassium", "Calcium", "Zinc", "Chlore", "Soufre", "Néon", "Magnésium"],
    bombs: ["Eau", "Bronze", "Acier", "Air", "Sel"],
  },
  {
    prompt: "Citez 9 sports de combat",
    answers: ["Boxe", "Judo", "Karaté", "Taekwondo", "Lutte", "MMA", "Kickboxing", "Jiu-jitsu", "Aïkido", "Krav-maga", "Sumo", "Capoeira", "Muay-thaï", "Savate"],
    bombs: ["Tir à l'arc", "Fléchettes", "Pétanque", "Yoga", "Gymnastique"],
  },
  {
    prompt: "Citez 9 boissons alcoolisées",
    answers: ["Bière", "Vin", "Champagne", "Whisky", "Vodka", "Rhum", "Gin", "Tequila", "Cognac", "Cidre", "Pastis", "Martini", "Porto", "Saké", "Liqueur"],
    bombs: ["Bière sans alcool", "Jus de raisin", "Kéfir", "Kombucha", "Limonade"],
  },
  {
    prompt: "Citez 9 instruments à cordes",
    answers: ["Violon", "Alto", "Violoncelle", "Contrebasse", "Guitare", "Harpe", "Banjo", "Mandoline", "Ukulélé", "Luth", "Sitar", "Balalaïka"],
    bombs: ["Piano", "Flûte", "Trompette", "Saxophone", "Clarinette"],
  },
  {
    prompt: "Citez 9 couleurs",
    answers: ["Rouge", "Bleu", "Vert", "Jaune", "Orange", "Violet", "Rose", "Marron", "Noir", "Blanc", "Gris", "Turquoise", "Beige", "Indigo", "Pourpre", "Cyan"],
    bombs: ["Arc-en-ciel", "Transparent", "Doré", "Pastel", "Fluo"],
  },
  {
    prompt: "Citez 9 métiers",
    answers: ["Médecin", "Boulanger", "Professeur", "Pompier", "Avocat", "Plombier", "Cuisinier", "Infirmier", "Architecte", "Pilote", "Coiffeur", "Jardinier", "Mécanicien", "Électricien", "Facteur", "Vétérinaire"],
    bombs: ["Patron", "Retraité", "Stagiaire", "Bénévole", "Chômeur"],
  },
  {
    prompt: "Citez 9 pays d'Afrique",
    answers: ["Maroc", "Algérie", "Tunisie", "Égypte", "Sénégal", "Mali", "Nigéria", "Kenya", "Éthiopie", "Afrique du Sud", "Ghana", "Cameroun", "Côte d'Ivoire", "Tanzanie", "Libye"],
    bombs: ["Arabie saoudite", "Inde", "Espagne", "Brésil", "Jamaïque"],
  },
  {
    prompt: "Citez 9 oiseaux",
    answers: ["Moineau", "Pigeon", "Aigle", "Hibou", "Chouette", "Perroquet", "Canari", "Corbeau", "Mésange", "Hirondelle", "Faucon", "Pélican", "Flamant rose", "Cygne", "Pie", "Rouge-gorge"],
    bombs: ["Chauve-souris", "Papillon", "Libellule", "Abeille", "Écureuil"],
  },
  {
    prompt: "Citez 9 vêtements",
    answers: ["Pantalon", "Chemise", "Robe", "Jupe", "Pull", "Veste", "Manteau", "Short", "Tee-shirt", "Chaussette", "Gilet", "Costume", "Jean", "Sweat", "Pyjama"],
    bombs: ["Chaussure", "Casquette", "Ceinture", "Sac", "Parapluie"],
  },
  {
    prompt: "Citez 9 émotions ou sentiments",
    answers: ["Joie", "Tristesse", "Colère", "Peur", "Surprise", "Dégoût", "Amour", "Jalousie", "Honte", "Fierté", "Ennui", "Stress", "Espoir", "Nostalgie", "Gratitude"],
    bombs: ["Fatigue", "Faim", "Froid", "Douleur", "Soif"],
  },
  {
    prompt: "Citez 9 films d'animation",
    answers: ["Le Roi Lion", "Toy Story", "Shrek", "La Reine des Neiges", "Vaiana", "Là-haut", "Ratatouille", "Les Indestructibles", "Coco", "Cars", "Némo", "Madagascar", "Kung Fu Panda", "Zootopie", "Encanto"],
    bombs: ["Harry Potter", "Avatar", "Star Wars", "Jurassic Park", "Titanic"],
  },
  {
    prompt: "Citez 9 mers ou océans",
    answers: ["Méditerranée", "Atlantique", "Pacifique", "Océan Indien", "Arctique", "Mer Noire", "Mer Rouge", "Mer Baltique", "Mer du Nord", "Mer Caspienne", "Mer Égée", "Mer Adriatique", "Mer des Caraïbes"],
    bombs: ["Lac Léman", "Le Nil", "Mississippi", "Lac Baïkal", "Amazone"],
  },
  {
    prompt: "Citez 9 viennoiseries ou pains",
    answers: ["Croissant", "Pain au chocolat", "Baguette", "Brioche", "Chausson aux pommes", "Pain aux raisins", "Chouquette", "Croissant aux amandes", "Pain de campagne", "Ficelle", "Fougasse", "Pain complet"],
    bombs: ["Cookie", "Donut", "Cupcake", "Gaufre", "Bagel"],
  },
  {
    prompt: "Citez 9 sports collectifs",
    answers: ["Football", "Basket", "Rugby", "Handball", "Volley", "Water-polo", "Hockey", "Baseball", "Cricket", "Football américain", "Hockey sur glace", "Ultimate"],
    bombs: ["Tennis", "Golf", "Boxe", "Natation", "Athlétisme"],
  },
  {
    prompt: "Citez 9 types de pâtes",
    answers: ["Spaghetti", "Penne", "Macaroni", "Tagliatelle", "Lasagne", "Ravioli", "Fusilli", "Farfalle", "Linguine", "Gnocchi", "Rigatoni", "Tortellini", "Cannelloni", "Vermicelle"],
    bombs: ["Riz", "Couscous", "Quinoa", "Polenta", "Semoule"],
  },
  {
    prompt: "Citez 9 pierres précieuses",
    answers: ["Diamant", "Rubis", "Émeraude", "Saphir", "Améthyste", "Topaze", "Opale", "Turquoise", "Grenat", "Jade", "Aigue-marine", "Onyx", "Péridot"],
    bombs: ["Or", "Argent", "Perle", "Cristal", "Marbre"],
  },
];

const EN: Theme[] = [
  {
    prompt: "Name 9 marine mammals",
    answers: ["Whale", "Dolphin", "Orca", "Seal", "Sea lion", "Walrus", "Sperm whale", "Narwhal", "Beluga", "Manatee", "Dugong", "Porpoise", "Humpback", "Minke whale"],
    bombs: ["Shark", "Ray", "Sea turtle", "Penguin", "Octopus", "Tuna", "Swordfish", "Jellyfish"],
  },
  {
    prompt: "Name 9 European countries",
    answers: ["France", "Spain", "Italy", "Germany", "Portugal", "Belgium", "Switzerland", "Austria", "Greece", "Sweden", "Norway", "Poland", "Netherlands", "Ireland", "Denmark", "Finland", "Hungary", "Romania", "Croatia", "Czechia"],
    bombs: ["Turkey", "Russia", "Morocco", "Georgia", "Cyprus", "Kazakhstan", "Armenia"],
  },
  {
    prompt: "Name 9 fruits",
    answers: ["Apple", "Pear", "Banana", "Strawberry", "Cherry", "Grape", "Orange", "Lemon", "Peach", "Apricot", "Kiwi", "Pineapple", "Mango", "Melon", "Raspberry", "Plum", "Fig", "Watermelon", "Blueberry", "Nectarine"],
    bombs: ["Tomato", "Avocado", "Rhubarb", "Olive", "Pumpkin", "Cucumber"],
  },
  {
    prompt: "Name 9 vegetables",
    answers: ["Carrot", "Leek", "Zucchini", "Eggplant", "Spinach", "Broccoli", "Cabbage", "Turnip", "Radish", "Green bean", "Pea", "Pepper", "Onion", "Garlic", "Lettuce", "Celery", "Beetroot", "Artichoke", "Asparagus", "Fennel"],
    bombs: ["Tomato", "Mushroom", "Avocado", "Olive", "Rhubarb"],
  },
  {
    prompt: "Name 9 Olympic sports",
    answers: ["Swimming", "Athletics", "Judo", "Fencing", "Rowing", "Cycling", "Gymnastics", "Handball", "Basketball", "Volleyball", "Tennis", "Boxing", "Wrestling", "Archery", "Weightlifting", "Badminton", "Canoeing", "Surfing", "Climbing", "Taekwondo"],
    bombs: ["Darts", "Chess", "Squash", "Bowling", "Pool", "American football", "Polo"],
  },
  {
    prompt: "Name 9 musical instruments",
    answers: ["Piano", "Guitar", "Violin", "Flute", "Trumpet", "Drums", "Saxophone", "Harp", "Cello", "Clarinet", "Accordion", "Trombone", "Double bass", "Organ", "Oboe", "Banjo", "Tuba", "Xylophone"],
    bombs: ["Microphone", "Metronome", "Tuning fork", "Bow", "Sheet music", "Music stand", "Plectrum"],
  },
  {
    prompt: "Name 9 farm animals",
    answers: ["Cow", "Pig", "Hen", "Sheep", "Goat", "Horse", "Donkey", "Duck", "Goose", "Rabbit", "Turkey", "Rooster", "Bull", "Chick", "Guinea fowl", "Calf"],
    bombs: ["Fox", "Boar", "Dog", "Cat", "Pigeon", "Deer", "Mouse"],
  },
  {
    prompt: "Name 9 European capitals",
    answers: ["Paris", "Madrid", "Rome", "Berlin", "Lisbon", "Brussels", "Vienna", "Athens", "Stockholm", "Oslo", "Warsaw", "Amsterdam", "Dublin", "Copenhagen", "Helsinki", "Budapest", "Bern", "Prague", "Bucharest", "Sofia"],
    bombs: ["Barcelona", "Milan", "Munich", "Geneva", "Hamburg", "Porto", "Frankfurt", "Naples"],
  },
  {
    prompt: "Name 9 reptiles",
    answers: ["Snake", "Lizard", "Crocodile", "Alligator", "Turtle", "Chameleon", "Iguana", "Gecko", "Monitor lizard", "Cobra", "Python", "Viper", "Boa", "Anaconda", "Grass snake"],
    bombs: ["Frog", "Toad", "Salamander", "Newt", "Axolotl", "Shark"],
  },
  {
    prompt: "Name 9 hot drinks",
    answers: ["Coffee", "Tea", "Hot chocolate", "Herbal tea", "Cappuccino", "Espresso", "Latte", "Mulled wine", "Hot milk", "Matcha", "Americano", "Mocha", "Chai"],
    bombs: ["Iced tea", "Iced coffee", "Lemonade", "Smoothie", "Milkshake", "Soda"],
  },
  {
    prompt: "Name 9 Asian countries",
    answers: ["China", "Japan", "India", "Korea", "Thailand", "Vietnam", "Indonesia", "Philippines", "Pakistan", "Iran", "Iraq", "Mongolia", "Nepal", "Cambodia", "Laos", "Malaysia", "Bangladesh", "Myanmar"],
    bombs: ["Russia", "Turkey", "Egypt", "Australia", "New Zealand"],
  },
  {
    prompt: "Name 9 flowers",
    answers: ["Rose", "Tulip", "Daisy", "Sunflower", "Lily", "Orchid", "Peony", "Daffodil", "Violet", "Lily of the valley", "Iris", "Carnation", "Poppy", "Dahlia", "Jasmine", "Lavender"],
    bombs: ["Fern", "Cactus", "Nettle", "Ivy", "Clover", "Moss"],
  },
  {
    prompt: "Name 9 tools",
    answers: ["Hammer", "Screwdriver", "Saw", "Drill", "Wrench", "Pliers", "Level", "Tape measure", "Sander", "Plane", "Chisel", "Square", "Cutter", "File", "Mallet"],
    bombs: ["Nail", "Screw", "Wall plug", "Paint", "Plank", "Workbench"],
  },
  {
    prompt: "Name 9 French desserts",
    answers: ["Éclair", "Tarte tatin", "Crème brûlée", "Mille-feuille", "Macaron", "Profiterole", "Paris-Brest", "Clafoutis", "Far breton", "Madeleine", "Financier", "Opéra cake", "Religieuse", "Rum baba"],
    bombs: ["Tiramisu", "Cheesecake", "Baklava", "Strudel", "Cannoli", "Donut"],
  },
  {
    prompt: "Name 9 means of transport",
    answers: ["Car", "Train", "Plane", "Boat", "Bike", "Motorcycle", "Bus", "Tram", "Subway", "Scooter", "Truck", "Helicopter", "Cable car", "Ferry"],
    bombs: ["Elevator", "Escalator", "Treadmill", "Ladder", "Slide"],
  },
  {
    prompt: "Name 9 body parts",
    answers: ["Head", "Arm", "Leg", "Hand", "Foot", "Finger", "Knee", "Elbow", "Shoulder", "Back", "Belly", "Neck", "Ear", "Nose", "Mouth", "Eye", "Hair", "Ankle", "Wrist", "Chin"],
    bombs: ["Shoe", "Glove", "Hat", "Ring", "Watch", "Glasses"],
  },
  {
    prompt: "Name 9 big cats",
    answers: ["Cat", "Lion", "Tiger", "Leopard", "Cheetah", "Panther", "Jaguar", "Lynx", "Puma", "Ocelot", "Serval", "Caracal"],
    bombs: ["Hyena", "Wolf", "Dog", "Bear", "Fox", "Civet"],
  },
  {
    prompt: "Name 9 metals",
    answers: ["Iron", "Gold", "Silver", "Copper", "Aluminium", "Zinc", "Lead", "Tin", "Nickel", "Titanium", "Platinum", "Bronze", "Steel", "Brass", "Chrome"],
    bombs: ["Glass", "Plastic", "Diamond", "Concrete", "Carbon", "Silicon"],
  },
  {
    prompt: "Name 9 African animals",
    answers: ["Lion", "Elephant", "Giraffe", "Zebra", "Rhino", "Hippo", "Cheetah", "Wildebeest", "Hyena", "Baboon", "Leopard", "Buffalo", "Gazelle", "Meerkat", "Warthog"],
    bombs: ["Kangaroo", "Tiger", "Panda", "Polar bear", "Jaguar", "Llama"],
  },
  {
    prompt: "Name 9 South American countries",
    answers: ["Brazil", "Argentina", "Chile", "Peru", "Colombia", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay", "Guyana", "Suriname"],
    bombs: ["Mexico", "Panama", "Cuba", "Costa Rica", "Guatemala"],
  },
  {
    prompt: "Name 9 capitals outside Europe",
    answers: ["Tokyo", "Beijing", "Washington", "Ottawa", "Cairo", "Brasília", "Canberra", "New Delhi", "Moscow", "Buenos Aires", "Bangkok", "Seoul", "Mexico City", "Rabat", "Pretoria"],
    bombs: ["New York", "Sydney", "Rio", "Istanbul", "Toronto", "Shanghai"],
  },
  {
    prompt: "Name 9 French cheeses",
    answers: ["Camembert", "Brie", "Roquefort", "Comté", "Reblochon", "Munster", "Cantal", "Beaufort", "Mimolette", "Saint-Nectaire", "Maroilles", "Tomme", "Raclette", "Bleu d'Auvergne", "Emmental"],
    bombs: ["Mozzarella", "Parmesan", "Gouda", "Cheddar", "Feta", "Gorgonzola"],
  },
  {
    prompt: "Name 9 car brands",
    answers: ["Toyota", "Ford", "BMW", "Mercedes", "Audi", "Volkswagen", "Honda", "Ferrari", "Tesla", "Nissan", "Porsche", "Renault", "Fiat", "Chevrolet", "Volvo"],
    bombs: ["Michelin", "Shell", "Bosch", "Castrol", "Total"],
  },
  {
    prompt: "Name 9 Marvel superheroes",
    answers: ["Iron Man", "Spider-Man", "Captain America", "Thor", "Hulk", "Black Widow", "Doctor Strange", "Black Panther", "Ant-Man", "Captain Marvel", "Wolverine", "Daredevil", "Hawkeye", "Star-Lord", "Deadpool"],
    bombs: ["Batman", "Superman", "Wonder Woman", "Aquaman", "Flash", "Joker"],
  },
  {
    prompt: "Name 9 Disney characters",
    answers: ["Mickey", "Minnie", "Donald", "Goofy", "Pluto", "Simba", "Aladdin", "Ariel", "Cinderella", "Snow White", "Elsa", "Buzz", "Woody", "Stitch", "Mulan", "Rapunzel", "Dumbo"],
    bombs: ["Mario", "Sonic", "Shrek", "Bugs Bunny", "Pikachu", "Hello Kitty"],
  },
  {
    prompt: "Name 9 Netflix series",
    answers: ["Stranger Things", "Money Heist", "The Crown", "Lupin", "Squid Game", "Bridgerton", "Dark", "Narcos", "Sex Education", "Ozark", "You", "Wednesday", "Elite", "The Witcher", "Black Mirror"],
    bombs: ["Game of Thrones", "The Mandalorian", "Friends", "The Office", "Breaking Bad"],
  },
  {
    prompt: "Name 9 social networks or apps",
    answers: ["Instagram", "Facebook", "TikTok", "Twitter", "Snapchat", "YouTube", "LinkedIn", "WhatsApp", "Pinterest", "Reddit", "Discord", "Twitch", "Telegram", "BeReal"],
    bombs: ["Google", "Spotify", "Netflix", "Amazon", "Gmail", "Waze"],
  },
  {
    prompt: "Name 9 board games",
    answers: ["Monopoly", "Cluedo", "Scrabble", "Risk", "Trivial Pursuit", "Uno", "Chess", "Checkers", "Connect Four", "Catan", "Carcassonne", "Dixit", "Codenames", "Jenga"],
    bombs: ["Tetris", "Sudoku", "Crossword", "Solitaire", "Minesweeper"],
  },
  {
    prompt: "Name 9 spoken languages",
    answers: ["English", "Spanish", "Mandarin", "French", "Arabic", "Hindi", "Portuguese", "Russian", "Japanese", "German", "Italian", "Korean", "Turkish", "Dutch", "Polish"],
    bombs: ["Latin", "Python", "Java", "Morse", "Braille"],
  },
  {
    prompt: "Name 9 chemical elements",
    answers: ["Hydrogen", "Oxygen", "Carbon", "Nitrogen", "Iron", "Gold", "Silver", "Copper", "Helium", "Sodium", "Potassium", "Calcium", "Zinc", "Chlorine", "Sulfur", "Neon", "Magnesium"],
    bombs: ["Water", "Bronze", "Steel", "Air", "Salt"],
  },
  {
    prompt: "Name 9 combat sports",
    answers: ["Boxing", "Judo", "Karate", "Taekwondo", "Wrestling", "MMA", "Kickboxing", "Jiu-jitsu", "Aikido", "Krav Maga", "Sumo", "Capoeira", "Muay Thai", "Savate"],
    bombs: ["Archery", "Darts", "Bowling", "Yoga", "Gymnastics"],
  },
  {
    prompt: "Name 9 alcoholic drinks",
    answers: ["Beer", "Wine", "Champagne", "Whisky", "Vodka", "Rum", "Gin", "Tequila", "Cognac", "Cider", "Brandy", "Martini", "Port", "Sake", "Liqueur"],
    bombs: ["Alcohol-free beer", "Grape juice", "Kefir", "Kombucha", "Lemonade"],
  },
  {
    prompt: "Name 9 string instruments",
    answers: ["Violin", "Viola", "Cello", "Double bass", "Guitar", "Harp", "Banjo", "Mandolin", "Ukulele", "Lute", "Sitar", "Balalaika"],
    bombs: ["Piano", "Flute", "Trumpet", "Saxophone", "Clarinet"],
  },
  {
    prompt: "Name 9 colours",
    answers: ["Red", "Blue", "Green", "Yellow", "Orange", "Purple", "Pink", "Brown", "Black", "White", "Grey", "Turquoise", "Beige", "Indigo", "Cyan", "Magenta"],
    bombs: ["Rainbow", "Transparent", "Golden", "Pastel", "Neon"],
  },
  {
    prompt: "Name 9 jobs",
    answers: ["Doctor", "Baker", "Teacher", "Firefighter", "Lawyer", "Plumber", "Cook", "Nurse", "Architect", "Pilot", "Hairdresser", "Gardener", "Mechanic", "Electrician", "Postman", "Vet"],
    bombs: ["Boss", "Retiree", "Intern", "Volunteer", "Unemployed"],
  },
  {
    prompt: "Name 9 African countries",
    answers: ["Morocco", "Algeria", "Tunisia", "Egypt", "Senegal", "Mali", "Nigeria", "Kenya", "Ethiopia", "South Africa", "Ghana", "Cameroon", "Ivory Coast", "Tanzania", "Libya"],
    bombs: ["Saudi Arabia", "India", "Spain", "Brazil", "Jamaica"],
  },
  {
    prompt: "Name 9 birds",
    answers: ["Sparrow", "Pigeon", "Eagle", "Owl", "Parrot", "Canary", "Crow", "Tit", "Swallow", "Falcon", "Pelican", "Flamingo", "Swan", "Magpie", "Robin"],
    bombs: ["Bat", "Butterfly", "Dragonfly", "Bee", "Squirrel"],
  },
  {
    prompt: "Name 9 clothing items",
    answers: ["Trousers", "Shirt", "Dress", "Skirt", "Sweater", "Jacket", "Coat", "Shorts", "T-shirt", "Sock", "Vest", "Suit", "Jeans", "Hoodie", "Pyjamas"],
    bombs: ["Shoe", "Cap", "Belt", "Bag", "Umbrella"],
  },
  {
    prompt: "Name 9 emotions or feelings",
    answers: ["Joy", "Sadness", "Anger", "Fear", "Surprise", "Disgust", "Love", "Jealousy", "Shame", "Pride", "Boredom", "Stress", "Hope", "Nostalgia", "Gratitude"],
    bombs: ["Tiredness", "Hunger", "Cold", "Pain", "Thirst"],
  },
  {
    prompt: "Name 9 animated movies",
    answers: ["The Lion King", "Toy Story", "Shrek", "Frozen", "Moana", "Up", "Ratatouille", "The Incredibles", "Coco", "Cars", "Finding Nemo", "Madagascar", "Kung Fu Panda", "Zootopia", "Encanto"],
    bombs: ["Harry Potter", "Avatar", "Star Wars", "Jurassic Park", "Titanic"],
  },
  {
    prompt: "Name 9 seas or oceans",
    answers: ["Mediterranean", "Atlantic", "Pacific", "Indian Ocean", "Arctic", "Black Sea", "Red Sea", "Baltic Sea", "North Sea", "Caspian Sea", "Aegean Sea", "Adriatic Sea", "Caribbean Sea"],
    bombs: ["Lake Geneva", "The Nile", "Mississippi", "Lake Baikal", "Amazon"],
  },
  {
    prompt: "Name 9 bakery items",
    answers: ["Croissant", "Pain au chocolat", "Baguette", "Brioche", "Apple turnover", "Raisin swirl", "Chouquette", "Almond croissant", "Country loaf", "Fougasse", "Sourdough", "Whole-grain bread"],
    bombs: ["Cookie", "Donut", "Cupcake", "Waffle", "Bagel"],
  },
  {
    prompt: "Name 9 team sports",
    answers: ["Football", "Basketball", "Rugby", "Handball", "Volleyball", "Water polo", "Hockey", "Baseball", "Cricket", "American football", "Ice hockey", "Ultimate"],
    bombs: ["Tennis", "Golf", "Boxing", "Swimming", "Athletics"],
  },
  {
    prompt: "Name 9 pasta types",
    answers: ["Spaghetti", "Penne", "Macaroni", "Tagliatelle", "Lasagne", "Ravioli", "Fusilli", "Farfalle", "Linguine", "Gnocchi", "Rigatoni", "Tortellini", "Cannelloni", "Vermicelli"],
    bombs: ["Rice", "Couscous", "Quinoa", "Polenta", "Semolina"],
  },
  {
    prompt: "Name 9 gemstones",
    answers: ["Diamond", "Ruby", "Emerald", "Sapphire", "Amethyst", "Topaz", "Opal", "Turquoise", "Garnet", "Jade", "Aquamarine", "Onyx", "Peridot"],
    bombs: ["Gold", "Silver", "Pearl", "Crystal", "Marble"],
  },
];

const THEMES: Record<Language, Theme[]> = { fr: FR, en: EN };

const WORDS_PER_ROUND = 9;

function shuffle<T>(a: T[]): T[] {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How many distinct themes exist for a language (for round-count guidance). */
export const themeCount = (language: Language): number => THEMES[language].length;

/**
 * Draw a fresh round: pick a theme (avoiding any whose prompt is in `usedPrompts`
 * when possible), then 9 random answers + 1 random bomb from it.
 */
export function pickRound(language: Language, usedPrompts: Set<string>): Devine9Round {
  const pool = THEMES[language];
  const fresh = pool.filter((t) => !usedPrompts.has(t.prompt));
  const candidates = fresh.length > 0 ? fresh : pool;
  const theme = candidates[Math.floor(Math.random() * candidates.length)];
  const answers = shuffle(theme.answers).slice(0, WORDS_PER_ROUND);
  const bomb = theme.bombs[Math.floor(Math.random() * theme.bombs.length)];
  return { prompt: theme.prompt, answers, bomb };
}
