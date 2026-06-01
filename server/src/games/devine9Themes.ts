// Curated theme bank for Devine 9. Each theme has a prompt, a large pool of
// correct answers (≥ 9 so a fresh subset is drawn each turn for replayability),
// and several "bombs" — tempting but wrong answers the guessing team must avoid.
// One bomb is drawn per turn so a theme rarely repeats the same trap.

import type { Language } from "../../../shared/src/games.js";

export interface Theme {
  /** The category, read aloud by the checker team (e.g. "Name 9 fruits"). */
  prompt: string;
  /** Pool of correct answers (must hold at least 9). */
  answers: string[];
  /** Pool of tempting wrong answers; one is drawn per turn. */
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
    answers: ["Baleine", "Dauphin", "Orque", "Phoque", "Otarie", "Morse", "Cachalot", "Narval", "Béluga", "Lamantin", "Dugong", "Marsouin"],
    bombs: ["Requin", "Raie", "Thon", "Pieuvre", "Tortue", "Manchot"],
  },
  {
    prompt: "Citez 9 pays d'Europe",
    answers: ["France", "Espagne", "Italie", "Allemagne", "Portugal", "Belgique", "Suisse", "Autriche", "Grèce", "Suède", "Norvège", "Pologne", "Pays-Bas", "Irlande", "Danemark", "Finlande", "Hongrie"],
    bombs: ["Maroc", "Égypte", "Canada", "Brésil", "Tunisie"],
  },
  {
    prompt: "Citez 9 fruits",
    answers: ["Pomme", "Poire", "Banane", "Fraise", "Cerise", "Raisin", "Orange", "Citron", "Pêche", "Abricot", "Kiwi", "Ananas", "Mangue", "Melon", "Framboise", "Prune", "Figue"],
    bombs: ["Tomate", "Carotte", "Courgette", "Poivron", "Concombre"],
  },
  {
    prompt: "Citez 9 légumes",
    answers: ["Carotte", "Poireau", "Courgette", "Aubergine", "Épinard", "Brocoli", "Chou", "Navet", "Radis", "Haricot", "Petit pois", "Poivron", "Oignon", "Ail", "Salade", "Concombre"],
    bombs: ["Pomme", "Banane", "Fraise", "Melon", "Cerise"],
  },
  {
    prompt: "Citez 9 sports olympiques",
    answers: ["Natation", "Athlétisme", "Judo", "Escrime", "Aviron", "Cyclisme", "Gymnastique", "Handball", "Basket", "Volley", "Tennis", "Boxe", "Lutte", "Tir à l'arc", "Haltérophilie", "Badminton"],
    bombs: ["Échecs", "Fléchettes", "Pétanque", "Billard", "Cricket"],
  },
  {
    prompt: "Citez 9 instruments de musique",
    answers: ["Piano", "Guitare", "Violon", "Flûte", "Trompette", "Batterie", "Saxophone", "Harpe", "Violoncelle", "Clarinette", "Accordéon", "Trombone", "Contrebasse", "Orgue"],
    bombs: ["Micro", "Partition", "Pupitre", "Métronome"],
  },
  {
    prompt: "Citez 9 animaux de la ferme",
    answers: ["Vache", "Cochon", "Poule", "Mouton", "Chèvre", "Cheval", "Âne", "Canard", "Oie", "Lapin", "Dinde", "Coq", "Taureau", "Poussin"],
    bombs: ["Renard", "Loup", "Sanglier", "Tigre", "Lion"],
  },
  {
    prompt: "Citez 9 capitales européennes",
    answers: ["Paris", "Madrid", "Rome", "Berlin", "Lisbonne", "Bruxelles", "Vienne", "Athènes", "Stockholm", "Oslo", "Varsovie", "Amsterdam", "Dublin", "Copenhague", "Helsinki", "Budapest", "Berne", "Prague"],
    bombs: ["New York", "Genève", "Barcelone", "Milan", "Zurich"],
  },
  {
    prompt: "Citez 9 reptiles",
    answers: ["Serpent", "Lézard", "Crocodile", "Alligator", "Tortue", "Caméléon", "Iguane", "Gecko", "Varan", "Cobra", "Python", "Vipère", "Boa"],
    bombs: ["Grenouille", "Crapaud", "Salamandre", "Triton", "Requin"],
  },
  {
    prompt: "Citez 9 boissons chaudes",
    answers: ["Café", "Thé", "Chocolat chaud", "Tisane", "Infusion", "Cappuccino", "Expresso", "Latte", "Grog", "Vin chaud", "Lait chaud"],
    bombs: ["Limonade", "Soda", "Jus d'orange", "Bière", "Eau glacée"],
  },
  {
    prompt: "Citez 9 pays d'Asie",
    answers: ["Chine", "Japon", "Inde", "Corée", "Thaïlande", "Vietnam", "Indonésie", "Philippines", "Pakistan", "Iran", "Irak", "Mongolie", "Népal", "Cambodge", "Laos", "Malaisie"],
    bombs: ["Égypte", "Russie", "Australie", "Nigéria", "Mexique"],
  },
  {
    prompt: "Citez 9 fleurs",
    answers: ["Rose", "Tulipe", "Marguerite", "Tournesol", "Lys", "Orchidée", "Pivoine", "Jonquille", "Violette", "Muguet", "Iris", "Œillet", "Coquelicot", "Dahlia", "Jasmin"],
    bombs: ["Chêne", "Fougère", "Cactus", "Ortie", "Sapin"],
  },
  {
    prompt: "Citez 9 outils de bricolage",
    answers: ["Marteau", "Tournevis", "Scie", "Perceuse", "Clé", "Pince", "Niveau", "Mètre", "Ponceuse", "Rabot", "Burin", "Tenaille", "Équerre"],
    bombs: ["Clou", "Vis", "Planche", "Peinture", "Cheville"],
  },
  {
    prompt: "Citez 9 desserts français",
    answers: ["Éclair", "Tarte tatin", "Crème brûlée", "Mille-feuille", "Macaron", "Profiterole", "Paris-Brest", "Clafoutis", "Far breton", "Madeleine", "Financier", "Opéra", "Fondant"],
    bombs: ["Tiramisu", "Cheesecake", "Baklava", "Donut", "Brownie"],
  },
  {
    prompt: "Citez 9 moyens de transport",
    answers: ["Voiture", "Train", "Avion", "Bateau", "Vélo", "Moto", "Bus", "Tramway", "Métro", "Scooter", "Camion", "Hélicoptère", "Trottinette", "Fusée"],
    bombs: ["Ascenseur", "Escalator", "Tapis roulant", "Échelle"],
  },
  {
    prompt: "Citez 9 parties du corps",
    answers: ["Tête", "Bras", "Jambe", "Main", "Pied", "Doigt", "Genou", "Coude", "Épaule", "Dos", "Ventre", "Cou", "Oreille", "Nez", "Bouche", "Œil", "Cheveux"],
    bombs: ["Chaussure", "Gant", "Chapeau", "Lunettes", "Bague"],
  },
  {
    prompt: "Citez 9 félins",
    answers: ["Chat", "Lion", "Tigre", "Léopard", "Guépard", "Panthère", "Jaguar", "Lynx", "Puma", "Ocelot", "Serval", "Caracal"],
    bombs: ["Hyène", "Loup", "Chien", "Ours", "Renard"],
  },
  {
    prompt: "Citez 9 métaux",
    answers: ["Fer", "Or", "Argent", "Cuivre", "Aluminium", "Zinc", "Plomb", "Étain", "Nickel", "Titane", "Platine", "Mercure", "Bronze", "Acier"],
    bombs: ["Bois", "Verre", "Plastique", "Diamant", "Béton"],
  },
  {
    prompt: "Citez 9 fruits verts",
    answers: ["Kiwi", "Pomme verte", "Raisin vert", "Poire", "Citron vert", "Avocat", "Figue", "Reine-claude", "Groseille à maquereau", "Carambole", "Melon vert"],
    bombs: ["Fraise", "Banane", "Cerise", "Orange", "Framboise"],
  },
  {
    prompt: "Citez 9 légumes verts",
    answers: ["Épinard", "Brocoli", "Courgette", "Haricot vert", "Petit pois", "Poireau", "Concombre", "Salade", "Chou", "Asperge", "Avocat", "Poivron vert", "Artichaut", "Céleri"],
    bombs: ["Carotte", "Tomate", "Aubergine", "Betterave", "Radis"],
  },
  {
    prompt: "Citez 9 animaux d'Afrique",
    answers: ["Lion", "Éléphant", "Girafe", "Zèbre", "Rhinocéros", "Hippopotame", "Guépard", "Gnou", "Hyène", "Babouin", "Léopard", "Buffle", "Gazelle", "Crocodile"],
    bombs: ["Kangourou", "Tigre", "Panda", "Ours polaire", "Pingouin"],
  },
  {
    prompt: "Citez 9 pays d'Amérique du Sud",
    answers: ["Brésil", "Argentine", "Chili", "Pérou", "Colombie", "Venezuela", "Équateur", "Bolivie", "Paraguay", "Uruguay", "Guyana", "Suriname"],
    bombs: ["Mexique", "Panama", "Cuba", "Costa Rica"],
  },
  {
    prompt: "Citez 9 capitales hors d'Europe",
    answers: ["Tokyo", "Pékin", "Washington", "Ottawa", "Le Caire", "Brasília", "Canberra", "New Delhi", "Moscou", "Buenos Aires", "Bangkok", "Séoul", "Mexico", "Rabat"],
    bombs: ["New York", "Sydney", "Rio", "Istanbul", "Genève"],
  },
  {
    prompt: "Citez 9 fromages français",
    answers: ["Camembert", "Brie", "Roquefort", "Comté", "Reblochon", "Munster", "Cantal", "Beaufort", "Mimolette", "Saint-Nectaire", "Maroilles", "Tomme", "Raclette", "Bleu d'Auvergne"],
    bombs: ["Mozzarella", "Parmesan", "Gouda", "Cheddar", "Feta"],
  },
  {
    prompt: "Citez 9 marques de voitures",
    answers: ["Renault", "Peugeot", "Citroën", "Volkswagen", "BMW", "Mercedes", "Audi", "Toyota", "Ford", "Ferrari", "Fiat", "Tesla", "Nissan", "Porsche"],
    bombs: ["Nike", "Apple", "Samsung", "Rolex", "Boeing"],
  },
  {
    prompt: "Citez 9 super-héros Marvel",
    answers: ["Iron Man", "Spider-Man", "Captain America", "Thor", "Hulk", "Black Widow", "Doctor Strange", "Black Panther", "Ant-Man", "Captain Marvel", "Wolverine", "Daredevil", "Hawkeye", "Star-Lord"],
    bombs: ["Batman", "Superman", "Wonder Woman", "Aquaman", "Flash"],
  },
  {
    prompt: "Citez 9 personnages Disney",
    answers: ["Mickey", "Minnie", "Donald", "Dingo", "Pluto", "Simba", "Aladdin", "Ariel", "Cendrillon", "Blanche-Neige", "Elsa", "Buzz", "Woody", "Stitch", "Mulan", "Raiponce"],
    bombs: ["Mario", "Sonic", "Shrek", "Bugs Bunny", "Pikachu"],
  },
  {
    prompt: "Citez 9 séries Netflix",
    answers: ["Stranger Things", "La Casa de Papel", "The Crown", "Lupin", "Squid Game", "Bridgerton", "Dark", "Narcos", "Sex Education", "Ozark", "You", "Wednesday", "Élite", "The Witcher"],
    bombs: ["Game of Thrones", "The Mandalorian", "WandaVision", "Friends"],
  },
  {
    prompt: "Citez 9 réseaux sociaux ou applis",
    answers: ["Instagram", "Facebook", "TikTok", "Twitter", "Snapchat", "YouTube", "LinkedIn", "WhatsApp", "Pinterest", "Reddit", "Discord", "Twitch", "Telegram"],
    bombs: ["Google", "Netflix", "Spotify", "Amazon", "Excel"],
  },
  {
    prompt: "Citez 9 jeux de société",
    answers: ["Monopoly", "Cluedo", "Scrabble", "Risk", "Trivial Pursuit", "Uno", "Échecs", "Dames", "Puissance 4", "Catan", "Carcassonne", "Dixit", "Loup-garou", "Time's Up"],
    bombs: ["Tetris", "Fortnite", "Sudoku", "Mario Kart", "Pac-Man"],
  },
  {
    prompt: "Citez 9 langues parlées dans le monde",
    answers: ["Anglais", "Espagnol", "Mandarin", "Français", "Arabe", "Hindi", "Portugais", "Russe", "Japonais", "Allemand", "Italien", "Coréen", "Turc", "Néerlandais"],
    bombs: ["Java", "Python", "HTML", "Morse"],
  },
  {
    prompt: "Citez 9 éléments chimiques",
    answers: ["Hydrogène", "Oxygène", "Carbone", "Azote", "Fer", "Or", "Argent", "Cuivre", "Hélium", "Sodium", "Potassium", "Calcium", "Zinc", "Chlore", "Soufre", "Néon"],
    bombs: ["Eau", "Bronze", "Acier", "Air", "Diamant"],
  },
  {
    prompt: "Citez 9 sports de combat",
    answers: ["Boxe", "Judo", "Karaté", "Taekwondo", "Lutte", "MMA", "Kickboxing", "Jiu-jitsu", "Aïkido", "Krav-maga", "Sumo", "Capoeira", "Muay-thaï"],
    bombs: ["Tennis", "Natation", "Pétanque", "Golf", "Tir à l'arc"],
  },
  {
    prompt: "Citez 9 boissons alcoolisées",
    answers: ["Bière", "Vin", "Champagne", "Whisky", "Vodka", "Rhum", "Gin", "Tequila", "Cognac", "Cidre", "Pastis", "Martini", "Porto", "Saké"],
    bombs: ["Jus d'orange", "Limonade", "Coca", "Café", "Eau pétillante"],
  },
  {
    prompt: "Citez 9 instruments à cordes",
    answers: ["Violon", "Alto", "Violoncelle", "Contrebasse", "Guitare", "Harpe", "Banjo", "Mandoline", "Ukulélé", "Luth", "Sitar", "Balalaïka"],
    bombs: ["Flûte", "Trompette", "Saxophone", "Tambour", "Clarinette"],
  },
  {
    prompt: "Citez 9 équipes de basket françaises",
    answers: ["ASVEL", "Monaco", "Paris Basketball", "Strasbourg", "Le Mans", "Cholet", "Nanterre", "Limoges", "Dijon", "Bourg-en-Bresse", "Gravelines-Dunkerque", "Roanne", "Chalon-sur-Saône"],
    bombs: ["Real Madrid", "FC Barcelone", "PSG", "OM"],
  },
  {
    prompt: "Citez 9 champions du monde 2018 (équipe de France)",
    answers: ["Lloris", "Varane", "Umtiti", "Pavard", "Lucas Hernández", "Kanté", "Pogba", "Griezmann", "Mbappé", "Giroud", "Matuidi", "Kimpembe", "Sidibé", "Tolisso", "Dembélé"],
    bombs: ["Benzema", "Zidane", "Ribéry", "Henry", "Cantona"],
  },
];

const EN: Theme[] = [
  {
    prompt: "Name 9 marine mammals",
    answers: ["Whale", "Dolphin", "Orca", "Seal", "Sea lion", "Walrus", "Sperm whale", "Narwhal", "Beluga", "Manatee", "Dugong", "Porpoise"],
    bombs: ["Shark", "Ray", "Tuna", "Octopus", "Turtle", "Penguin"],
  },
  {
    prompt: "Name 9 European countries",
    answers: ["France", "Spain", "Italy", "Germany", "Portugal", "Belgium", "Switzerland", "Austria", "Greece", "Sweden", "Norway", "Poland", "Netherlands", "Ireland", "Denmark", "Finland", "Hungary"],
    bombs: ["Morocco", "Egypt", "Canada", "Brazil", "Tunisia"],
  },
  {
    prompt: "Name 9 fruits",
    answers: ["Apple", "Pear", "Banana", "Strawberry", "Cherry", "Grape", "Orange", "Lemon", "Peach", "Apricot", "Kiwi", "Pineapple", "Mango", "Melon", "Raspberry", "Plum", "Fig"],
    bombs: ["Tomato", "Carrot", "Zucchini", "Pepper", "Cucumber"],
  },
  {
    prompt: "Name 9 vegetables",
    answers: ["Carrot", "Leek", "Zucchini", "Eggplant", "Spinach", "Broccoli", "Cabbage", "Turnip", "Radish", "Bean", "Pea", "Pepper", "Onion", "Garlic", "Lettuce", "Cucumber"],
    bombs: ["Apple", "Banana", "Strawberry", "Melon", "Cherry"],
  },
  {
    prompt: "Name 9 Olympic sports",
    answers: ["Swimming", "Athletics", "Judo", "Fencing", "Rowing", "Cycling", "Gymnastics", "Handball", "Basketball", "Volleyball", "Tennis", "Boxing", "Wrestling", "Archery", "Weightlifting", "Badminton"],
    bombs: ["Chess", "Darts", "Bowling", "Cricket", "Pool"],
  },
  {
    prompt: "Name 9 musical instruments",
    answers: ["Piano", "Guitar", "Violin", "Flute", "Trumpet", "Drums", "Saxophone", "Harp", "Cello", "Clarinet", "Accordion", "Trombone", "Double bass", "Organ"],
    bombs: ["Microphone", "Sheet music", "Music stand", "Metronome"],
  },
  {
    prompt: "Name 9 farm animals",
    answers: ["Cow", "Pig", "Hen", "Sheep", "Goat", "Horse", "Donkey", "Duck", "Goose", "Rabbit", "Turkey", "Rooster", "Bull", "Chick"],
    bombs: ["Fox", "Wolf", "Boar", "Tiger", "Lion"],
  },
  {
    prompt: "Name 9 European capitals",
    answers: ["Paris", "Madrid", "Rome", "Berlin", "Lisbon", "Brussels", "Vienna", "Athens", "Stockholm", "Oslo", "Warsaw", "Amsterdam", "Dublin", "Copenhagen", "Helsinki", "Budapest", "Bern", "Prague"],
    bombs: ["New York", "Geneva", "Barcelona", "Milan", "Zurich"],
  },
  {
    prompt: "Name 9 reptiles",
    answers: ["Snake", "Lizard", "Crocodile", "Alligator", "Turtle", "Chameleon", "Iguana", "Gecko", "Monitor lizard", "Cobra", "Python", "Viper", "Boa"],
    bombs: ["Frog", "Toad", "Salamander", "Newt", "Shark"],
  },
  {
    prompt: "Name 9 hot drinks",
    answers: ["Coffee", "Tea", "Hot chocolate", "Herbal tea", "Cappuccino", "Espresso", "Latte", "Mulled wine", "Hot milk", "Americano"],
    bombs: ["Lemonade", "Soda", "Orange juice", "Beer", "Iced water"],
  },
  {
    prompt: "Name 9 Asian countries",
    answers: ["China", "Japan", "India", "Korea", "Thailand", "Vietnam", "Indonesia", "Philippines", "Pakistan", "Iran", "Iraq", "Mongolia", "Nepal", "Cambodia", "Laos", "Malaysia"],
    bombs: ["Egypt", "Russia", "Australia", "Nigeria", "Mexico"],
  },
  {
    prompt: "Name 9 flowers",
    answers: ["Rose", "Tulip", "Daisy", "Sunflower", "Lily", "Orchid", "Peony", "Daffodil", "Violet", "Lily of the valley", "Iris", "Carnation", "Poppy", "Dahlia", "Jasmine"],
    bombs: ["Oak", "Fern", "Cactus", "Nettle", "Pine"],
  },
  {
    prompt: "Name 9 tools",
    answers: ["Hammer", "Screwdriver", "Saw", "Drill", "Wrench", "Pliers", "Level", "Tape measure", "Sander", "Plane", "Chisel", "Square"],
    bombs: ["Nail", "Screw", "Plank", "Paint", "Wall plug"],
  },
  {
    prompt: "Name 9 desserts",
    answers: ["Eclair", "Tarte tatin", "Crème brûlée", "Mille-feuille", "Macaron", "Profiterole", "Cheesecake", "Tiramisu", "Madeleine", "Brownie", "Pancake", "Donut", "Pudding"],
    bombs: ["Pizza", "Burger", "Salad", "Omelette", "Soup"],
  },
  {
    prompt: "Name 9 means of transport",
    answers: ["Car", "Train", "Plane", "Boat", "Bike", "Motorcycle", "Bus", "Tram", "Subway", "Scooter", "Truck", "Helicopter"],
    bombs: ["Elevator", "Escalator", "Treadmill", "Ladder"],
  },
  {
    prompt: "Name 9 body parts",
    answers: ["Head", "Arm", "Leg", "Hand", "Foot", "Finger", "Knee", "Elbow", "Shoulder", "Back", "Belly", "Neck", "Ear", "Nose", "Mouth", "Eye", "Hair"],
    bombs: ["Shoe", "Glove", "Hat", "Glasses", "Ring"],
  },
  {
    prompt: "Name 9 big cats",
    answers: ["Cat", "Lion", "Tiger", "Leopard", "Cheetah", "Panther", "Jaguar", "Lynx", "Puma", "Ocelot", "Serval", "Caracal"],
    bombs: ["Hyena", "Wolf", "Dog", "Bear", "Fox"],
  },
  {
    prompt: "Name 9 metals",
    answers: ["Iron", "Gold", "Silver", "Copper", "Aluminium", "Zinc", "Lead", "Tin", "Nickel", "Titanium", "Platinum", "Mercury", "Bronze", "Steel"],
    bombs: ["Wood", "Glass", "Plastic", "Diamond", "Concrete"],
  },
  {
    prompt: "Name 9 green fruits",
    answers: ["Kiwi", "Green apple", "Green grape", "Pear", "Lime", "Avocado", "Fig", "Greengage", "Gooseberry", "Starfruit", "Honeydew melon"],
    bombs: ["Strawberry", "Banana", "Cherry", "Orange", "Raspberry"],
  },
  {
    prompt: "Name 9 green vegetables",
    answers: ["Spinach", "Broccoli", "Zucchini", "Green bean", "Pea", "Leek", "Cucumber", "Lettuce", "Cabbage", "Asparagus", "Avocado", "Green pepper", "Artichoke", "Celery"],
    bombs: ["Carrot", "Tomato", "Eggplant", "Beetroot", "Radish"],
  },
  {
    prompt: "Name 9 African animals",
    answers: ["Lion", "Elephant", "Giraffe", "Zebra", "Rhino", "Hippo", "Cheetah", "Wildebeest", "Hyena", "Baboon", "Leopard", "Buffalo", "Gazelle", "Crocodile"],
    bombs: ["Kangaroo", "Tiger", "Panda", "Polar bear", "Penguin"],
  },
  {
    prompt: "Name 9 South American countries",
    answers: ["Brazil", "Argentina", "Chile", "Peru", "Colombia", "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay", "Guyana", "Suriname"],
    bombs: ["Mexico", "Panama", "Cuba", "Costa Rica"],
  },
  {
    prompt: "Name 9 capitals outside Europe",
    answers: ["Tokyo", "Beijing", "Washington", "Ottawa", "Cairo", "Brasília", "Canberra", "New Delhi", "Moscow", "Buenos Aires", "Bangkok", "Seoul", "Mexico City", "Rabat"],
    bombs: ["New York", "Sydney", "Rio", "Istanbul", "Geneva"],
  },
  {
    prompt: "Name 9 cheeses",
    answers: ["Cheddar", "Mozzarella", "Parmesan", "Gouda", "Brie", "Camembert", "Feta", "Emmental", "Blue cheese", "Ricotta", "Mascarpone", "Edam", "Gruyère"],
    bombs: ["Yogurt", "Butter", "Cream", "Milk", "Margarine"],
  },
  {
    prompt: "Name 9 car brands",
    answers: ["Toyota", "Ford", "BMW", "Mercedes", "Audi", "Volkswagen", "Honda", "Ferrari", "Tesla", "Nissan", "Porsche", "Renault", "Fiat", "Chevrolet"],
    bombs: ["Nike", "Apple", "Samsung", "Rolex", "Boeing"],
  },
  {
    prompt: "Name 9 Marvel superheroes",
    answers: ["Iron Man", "Spider-Man", "Captain America", "Thor", "Hulk", "Black Widow", "Doctor Strange", "Black Panther", "Ant-Man", "Captain Marvel", "Wolverine", "Daredevil", "Hawkeye", "Star-Lord"],
    bombs: ["Batman", "Superman", "Wonder Woman", "Aquaman", "Flash"],
  },
  {
    prompt: "Name 9 Disney characters",
    answers: ["Mickey", "Minnie", "Donald", "Goofy", "Pluto", "Simba", "Aladdin", "Ariel", "Cinderella", "Snow White", "Elsa", "Buzz", "Woody", "Stitch", "Mulan", "Rapunzel"],
    bombs: ["Mario", "Sonic", "Shrek", "Bugs Bunny", "Pikachu"],
  },
  {
    prompt: "Name 9 Netflix series",
    answers: ["Stranger Things", "Money Heist", "The Crown", "Lupin", "Squid Game", "Bridgerton", "Dark", "Narcos", "Sex Education", "Ozark", "You", "Wednesday", "Elite", "The Witcher"],
    bombs: ["Game of Thrones", "The Mandalorian", "WandaVision", "Friends"],
  },
  {
    prompt: "Name 9 social networks or apps",
    answers: ["Instagram", "Facebook", "TikTok", "Twitter", "Snapchat", "YouTube", "LinkedIn", "WhatsApp", "Pinterest", "Reddit", "Discord", "Twitch", "Telegram"],
    bombs: ["Google", "Netflix", "Spotify", "Amazon", "Excel"],
  },
  {
    prompt: "Name 9 board games",
    answers: ["Monopoly", "Cluedo", "Scrabble", "Risk", "Trivial Pursuit", "Uno", "Chess", "Checkers", "Connect Four", "Catan", "Carcassonne", "Dixit", "Codenames", "Jenga"],
    bombs: ["Tetris", "Fortnite", "Sudoku", "Mario Kart", "Pac-Man"],
  },
  {
    prompt: "Name 9 spoken languages",
    answers: ["English", "Spanish", "Mandarin", "French", "Arabic", "Hindi", "Portuguese", "Russian", "Japanese", "German", "Italian", "Korean", "Turkish", "Dutch"],
    bombs: ["Java", "Python", "HTML", "Morse"],
  },
  {
    prompt: "Name 9 chemical elements",
    answers: ["Hydrogen", "Oxygen", "Carbon", "Nitrogen", "Iron", "Gold", "Silver", "Copper", "Helium", "Sodium", "Potassium", "Calcium", "Zinc", "Chlorine", "Sulfur", "Neon"],
    bombs: ["Water", "Bronze", "Steel", "Air", "Diamond"],
  },
  {
    prompt: "Name 9 combat sports",
    answers: ["Boxing", "Judo", "Karate", "Taekwondo", "Wrestling", "MMA", "Kickboxing", "Jiu-jitsu", "Aikido", "Krav Maga", "Sumo", "Capoeira", "Muay Thai"],
    bombs: ["Tennis", "Swimming", "Golf", "Archery", "Bowling"],
  },
  {
    prompt: "Name 9 alcoholic drinks",
    answers: ["Beer", "Wine", "Champagne", "Whisky", "Vodka", "Rum", "Gin", "Tequila", "Cognac", "Cider", "Brandy", "Martini", "Port", "Sake"],
    bombs: ["Orange juice", "Lemonade", "Coke", "Coffee", "Sparkling water"],
  },
  {
    prompt: "Name 9 string instruments",
    answers: ["Violin", "Viola", "Cello", "Double bass", "Guitar", "Harp", "Banjo", "Mandolin", "Ukulele", "Lute", "Sitar", "Balalaika"],
    bombs: ["Flute", "Trumpet", "Saxophone", "Drum", "Clarinet"],
  },
  {
    prompt: "Name 9 NBA teams",
    answers: ["Lakers", "Celtics", "Bulls", "Warriors", "Heat", "Knicks", "Spurs", "Rockets", "Nets", "Bucks", "Suns", "Mavericks", "Clippers", "Raptors", "76ers"],
    bombs: ["Real Madrid", "Barcelona", "Yankees", "Cowboys", "Manchester United"],
  },
  {
    prompt: "Name 9 Premier League clubs",
    answers: ["Arsenal", "Chelsea", "Liverpool", "Manchester United", "Manchester City", "Tottenham", "Everton", "Newcastle", "Aston Villa", "West Ham", "Leeds", "Leicester", "Wolves", "Brighton"],
    bombs: ["Real Madrid", "Barcelona", "PSG", "Bayern Munich", "Juventus"],
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
