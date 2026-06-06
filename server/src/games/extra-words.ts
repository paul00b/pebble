// Supplemental words merged into the Bomb Party dictionaries.
//
// The base lists (`an-array-of-french-words` / `an-array-of-english-words`) are
// huge but miss a lot of everyday vocabulary: modern loanwords, tech terms,
// common anglicisms, food, and a few obvious words that simply aren't there.
// Add to these lists whenever a legitimate word gets unfairly rejected.
//
// Entries are normalized (lowercased, accents stripped, a–z only) by the
// dictionary builder, so writing them with accents here is fine.

import type { Language } from "../../../shared/src/games.js";

const FR: string[] = [
  // Tech / numérique
  "smartphone", "selfie", "selfies", "wifi", "email", "emails", "mail", "mails",
  "internet", "web", "blog", "blogs", "blogueur", "blogueuse", "podcast", "podcasts",
  "streaming", "streamer", "streameur", "youtubeur", "youtubeuse", "influenceur",
  "influenceuse", "tweet", "tweets", "tweeter", "hashtag", "hashtags", "emoji", "emojis",
  "appli", "applis", "appcam", "pixel", "pixels", "scanner", "scanné", "scannée",
  "telecharger", "telechargement", "wifi", "bluetooth", "usb", "geolocalisation",
  "cyber", "cybercafe", "datacenter", "logiciel", "logiciels", "ordi", "ordis",
  "drone", "drones", "tablette", "tablettes", "casque", "ecran", "ecrans",
  "numerique", "digital", "digitale", "connecte", "connectee", "deconnecte",
  // Vie quotidienne / objets
  "pizza", "pizzas", "burger", "burgers", "hamburger", "kebab", "kebabs", "sushi", "sushis",
  "sandwich", "sandwichs", "wrap", "wraps", "frites", "nuggets", "donut", "donuts",
  "cookie", "cookies", "muffin", "muffins", "brownie", "brownies", "cupcake", "cupcakes",
  "smoothie", "smoothies", "soda", "sodas", "cola", "ketchup", "mayo", "wasabi",
  "barbecue", "apero", "aperos", "brunch", "brunchs", "tapas",
  "jean", "jeans", "tee", "tshirt", "tshirts", "pull", "pulls", "sweat", "sweats",
  "basket", "baskets", "sneakers", "short", "shorts", "legging", "leggings",
  "sac", "sacoche", "valise", "valises", "trousse", "lunettes",
  // Loisirs / sport / culture
  "foot", "basket", "tennis", "rugby", "handball", "volley", "ping", "pong",
  "skate", "skateboard", "surf", "surfeur", "kayak", "kayaks", "trottinette",
  "fitness", "yoga", "pilates", "jogging", "footing", "marathon", "marathons",
  "manga", "mangas", "anime", "animes", "cosplay", "gamer", "gameuse", "geek", "geeks",
  "puzzle", "puzzles", "quizz", "quiz", "karaoke", "concert", "concerts",
  "festival", "festivals", "playlist", "playlists", "remix", "remixes",
  // Mots courants parfois absents
  "ok", "okay", "cool", "super", "genial", "geniale", "top", "fun", "kiffer",
  "kiffe", "bricoler", "bricolage", "covoiturage", "teletravail", "deconfinement",
  "confinement", "ecolo", "ecolos", "bio", "vegan", "vegane", "vegans", "veggie",
  "recyclage", "recycler", "trier", "compost", "covid", "virus", "vaccin", "vaccins",
  "masque", "masques", "gel", "gels", "distanciel", "presentiel",
  "scooter", "scooters", "covoiturer", "uber", "taxi", "taxis", "metro", "metros",
  "selfie", "wow", "yes", "bye", "hello", "salut", "coucou", "merci", "bravo",
  "spoiler", "spoilers", "buzz", "buzzer", "fake", "fakes", "crush", "crushes",
  "team", "teams", "match", "matchs", "score", "scores", "but", "buts",
  "challenge", "challenges", "deal", "deals", "business", "startup", "startups",
  "boss", "manager", "coach", "coachs", "freelance", "freelances", "open",
];

const EN: string[] = [
  // Tech / online
  "smartphone", "smartphones", "selfie", "selfies", "wifi", "email", "emails",
  "internet", "blog", "blogs", "blogger", "vlog", "vlogs", "podcast", "podcasts",
  "streaming", "streamer", "youtuber", "influencer", "tweet", "tweets", "retweet",
  "hashtag", "hashtags", "emoji", "emojis", "app", "apps", "download", "upload",
  "bluetooth", "usb", "pixel", "pixels", "selfie", "meme", "memes", "gif", "gifs",
  "wifi", "online", "offline", "username", "password", "login", "logout",
  "smartwatch", "drone", "drones", "tablet", "tablets", "laptop", "laptops",
  "webcam", "webcams", "browser", "browsers", "router", "firewall", "malware",
  "software", "hardware", "database", "website", "websites", "chatbot", "chatbots",
  // Food / everyday
  "pizza", "pizzas", "burger", "burgers", "hamburger", "kebab", "sushi", "sushis",
  "sandwich", "sandwiches", "wrap", "wraps", "nuggets", "donut", "donuts",
  "cookie", "cookies", "muffin", "muffins", "brownie", "brownies", "cupcake", "cupcakes",
  "smoothie", "smoothies", "soda", "sodas", "ketchup", "mayo", "wasabi", "guacamole",
  "barbecue", "brunch", "brunches", "tapas", "snack", "snacks", "takeaway",
  "jeans", "tshirt", "tshirts", "hoodie", "hoodies", "sneakers", "sneaker",
  "leggings", "backpack", "backpacks",
  // Leisure / culture
  "skateboard", "skateboards", "surfing", "surfer", "kayak", "kayaks", "scooter",
  "fitness", "yoga", "pilates", "jogging", "marathon", "marathons", "gym",
  "manga", "mangas", "anime", "animes", "cosplay", "gamer", "gamers", "geek", "geeks",
  "puzzle", "puzzles", "quiz", "quizzes", "karaoke", "playlist", "playlists",
  "remix", "remixes", "festival", "festivals", "concert", "concerts",
  // Common slang / words sometimes missing
  "okay", "cool", "awesome", "selfie", "wow", "yep", "nope", "hello", "hi", "bye",
  "thanks", "spoiler", "spoilers", "buzz", "fake", "fakes", "crush", "crushes",
  "team", "teams", "match", "matches", "score", "scores", "goal", "goals",
  "challenge", "challenges", "deal", "deals", "startup", "startups", "boss",
  "manager", "coach", "coaches", "freelance", "freelancer", "freelancers",
  "selfie", "vibe", "vibes", "trendy", "viral", "clickbait", "unfollow",
  "follower", "followers", "subscriber", "subscribers", "livestream", "livestreams",
];

const EXTRA: Record<Language, string[]> = { fr: FR, en: EN };

/** Supplemental raw words for a language (deduped by the dictionary's Set). */
export function extraWords(language: Language): string[] {
  return EXTRA[language] ?? [];
}
