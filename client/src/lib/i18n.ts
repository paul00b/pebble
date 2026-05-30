// Lightweight i18n. No library: a flat key→string table per locale, plus a
// `t(key, params)` with {param} interpolation. The active locale lives in the
// store (persisted, browser-detected). This is the player's *UI* language —
// distinct from a room's *game-content* language (dictionary / categories).

export type Locale = "en" | "fr";

export const LOCALES: Locale[] = ["en", "fr"];

type Table = Record<string, string>;

const en: Table = {
  // common
  "common.leave": "Leave",
  "common.backToLobby": "Back to lobby",
  "common.waitingHost": "Waiting for the host…",
  "common.send": "Send",
  "common.oneSec": "One sec…",
  "common.you": "you",
  // connection
  "conn.connecting": "Connecting…",
  "conn.reconnecting": "Reconnecting…",
  // landing
  "landing.badge": "✦ Game night, anywhere — no app, no signup",
  "landing.title1": "Gather your friends.",
  "landing.title2": "Play in seconds.",
  "landing.subtitle":
    "Pebble is a little glass arcade for your group chat. Spin up a room, send the code, and drop straight into a party game together.",
  "landing.create": "Create a room",
  "landing.join": "Join with a code",
  "landing.nowPlaying": "Now playing",
  "landing.moreSoon": "More games landing soon",
  "landing.footer": "Free forever · Plays on any modern browser, phone or desktop",
  // games (display)
  "game.bombparty.name": "Bomb Party",
  "game.bombparty.tagline": "Type a word with the syllable before the bomb blows.",
  "game.bombparty.duration": "5–10 min",
  "game.petitbac.name": "Petit Bac",
  "game.petitbac.tagline": "A letter, some categories, race to fill them in.",
  "game.petitbac.duration": "8–15 min",
  "game.sixquiprend.name": "6 Qui Prend",
  "game.sixquiprend.tagline": "Lay cards in rows — just don't take the sixth.",
  "game.sixquiprend.duration": "10–20 min",
  // join flow
  "join.createTitle": "Set up your room",
  "join.joinTitle": "Join your friends",
  "join.createSub":
    "Choose how you'll show up. You can pick a game once everyone's in.",
  "join.joinSub": "Enter the code, pick how you'll show up, and hop in.",
  "join.previewHint": "This is how others see you",
  "join.yourName": "Your name",
  "join.name": "Name",
  "join.namePh": "e.g. Paul",
  "join.code": "Room code",
  "join.avatar": "Avatar",
  "join.color": "Color",
  "join.errName": "Pick a name first.",
  "join.errCode": "Enter the room code your friend sent.",
  "join.createBtn": "Create room",
  "join.joinBtn": "Join room",
  // lobby
  "lobby.playersInRoom": "players in the room",
  "lobby.chooseGame": "Choose a game",
  "lobby.hostPicks": "The host picks the game",
  "lobby.selected": "Selected",
  "lobby.start": "Start {game}",
  "lobby.needPlayers": "Need {n}+ players to start",
  "lobby.waitingStart": "Waiting for the host to start {game}…",
  "lobby.players": "Players",
  "lobby.chat": "Chat",
  "lobby.chatEmpty": "Say hi while you wait 👋",
  "lobby.chatPh": "Message the room…",
  "lobby.ready": "Ready",
  "lobby.reconnecting": "Reconnecting…",
  "lobby.gameLanguage": "Game language",
  "lobby.gameLanguageHint": "Words & categories",
  // bomb party
  "bomb.typing": "{name} is typing…",
  "bomb.enterToSend": "Hit Enter to send",
  "bomb.notWord": "Not a word with “{prompt}”",
  "bomb.used": "Already used!",
  "bomb.placeholder": "Type a word with “{prompt}”",
  "bomb.winner": "Winner",
  "bomb.youWin": "Last one standing — that's you! 🎉",
  "bomb.gameOver": "Game over",
  // petit bac
  "pb.wordsIn": "Words in “{letter}”",
  "pb.roundInfo": "Round {round}/{total} · {done}/{players} done",
  "pb.stop": "STOP! ({filled}/{total} filled)",
  "pb.locked": "Locked in — waiting…",
  "pb.results": "Letter “{letter}” · results",
  "pb.round": "Round {round}/{total}",
  "pb.waitingContinue": "Waiting for the host to continue…",
  "pb.nextRound": "Next round",
  "pb.finalResults": "See final results",
  "pb.finalScores": "Final scores",
  // 6 qui prend
  "sixqp.chooseCard": "Pick a card to play",
  "sixqp.locked": "Locked in — waiting for the others…",
  "sixqp.chooseRow": "You played the lowest card — choose a row to take",
  "sixqp.waitingChooseRow": "{name} must choose a row to take…",
  "sixqp.round": "Round {round}",
  "sixqp.bulls": "{n} 🐂",
  "sixqp.yourHand": "Your hand",
  "sixqp.played": "Played",
  "sixqp.finalScores": "Final scores",
  "sixqp.lowestWins": "Fewest bulls wins",
  // notices (server-driven, localized by key)
  "notice.playerJoined": "{name} joined.",
  "notice.roomClosed": "Room closed.",
};

const fr: Table = {
  "common.leave": "Quitter",
  "common.backToLobby": "Retour au salon",
  "common.waitingHost": "En attente de l'hôte…",
  "common.send": "Envoyer",
  "common.oneSec": "Un instant…",
  "common.you": "toi",
  "conn.connecting": "Connexion…",
  "conn.reconnecting": "Reconnexion…",
  "landing.badge": "✦ Soirée jeux, partout — sans appli, sans compte",
  "landing.title1": "Réunis tes amis.",
  "landing.title2": "Joue en quelques secondes.",
  "landing.subtitle":
    "Pebble, c'est une petite salle de jeux tout en verre pour ta bande. Crée un salon, envoie le code, et lancez une partie ensemble dans la foulée.",
  "landing.create": "Créer un salon",
  "landing.join": "Rejoindre avec un code",
  "landing.nowPlaying": "À l'affiche",
  "landing.moreSoon": "D'autres jeux arrivent bientôt",
  "landing.footer":
    "Gratuit pour toujours · Marche sur tout navigateur récent, mobile ou ordi",
  "game.bombparty.name": "Bomb Party",
  "game.bombparty.tagline": "Tape un mot avec la syllabe avant que la bombe explose.",
  "game.bombparty.duration": "5–10 min",
  "game.petitbac.name": "Petit Bac",
  "game.petitbac.tagline": "Une lettre, des catégories, à toi de remplir vite.",
  "game.petitbac.duration": "8–15 min",
  "game.sixquiprend.name": "6 Qui Prend",
  "game.sixquiprend.tagline": "Pose tes cartes en rangées — mais ne prends pas la sixième.",
  "game.sixquiprend.duration": "10–20 min",
  "join.createTitle": "Prépare ton salon",
  "join.joinTitle": "Rejoins tes amis",
  "join.createSub":
    "Choisis ton apparence. Tu pourras choisir un jeu une fois tout le monde arrivé.",
  "join.joinSub": "Entre le code, choisis ton apparence, et c'est parti.",
  "join.previewHint": "Voilà comment les autres te voient",
  "join.yourName": "Ton nom",
  "join.name": "Nom",
  "join.namePh": "ex. Paul",
  "join.code": "Code du salon",
  "join.avatar": "Avatar",
  "join.color": "Couleur",
  "join.errName": "Choisis d'abord un nom.",
  "join.errCode": "Entre le code que ton ami t'a envoyé.",
  "join.createBtn": "Créer le salon",
  "join.joinBtn": "Rejoindre",
  "lobby.playersInRoom": "joueurs dans le salon",
  "lobby.chooseGame": "Choisis un jeu",
  "lobby.hostPicks": "L'hôte choisit le jeu",
  "lobby.selected": "Choisi",
  "lobby.start": "Lancer {game}",
  "lobby.needPlayers": "Il faut {n}+ joueurs pour lancer",
  "lobby.waitingStart": "En attente du lancement de {game} par l'hôte…",
  "lobby.players": "Joueurs",
  "lobby.chat": "Tchat",
  "lobby.chatEmpty": "Dis bonjour en attendant 👋",
  "lobby.chatPh": "Écris au salon…",
  "lobby.ready": "Prêt",
  "lobby.reconnecting": "Reconnexion…",
  "lobby.gameLanguage": "Langue du jeu",
  "lobby.gameLanguageHint": "Mots & catégories",
  "bomb.typing": "{name} écrit…",
  "bomb.enterToSend": "Appuie sur Entrée pour envoyer",
  "bomb.notWord": "Pas un mot avec « {prompt} »",
  "bomb.used": "Déjà utilisé !",
  "bomb.placeholder": "Tape un mot avec « {prompt} »",
  "bomb.winner": "Gagnant",
  "bomb.youWin": "Dernier survivant — c'est toi ! 🎉",
  "bomb.gameOver": "Partie terminée",
  "pb.wordsIn": "Des mots en « {letter} »",
  "pb.roundInfo": "Manche {round}/{total} · {done}/{players} prêts",
  "pb.stop": "STOP ! ({filled}/{total} remplis)",
  "pb.locked": "Validé — en attente…",
  "pb.results": "Lettre « {letter} » · résultats",
  "pb.round": "Manche {round}/{total}",
  "pb.waitingContinue": "En attente de l'hôte pour continuer…",
  "pb.nextRound": "Manche suivante",
  "pb.finalResults": "Voir les résultats finaux",
  "pb.finalScores": "Scores finaux",
  "sixqp.chooseCard": "Choisis une carte à jouer",
  "sixqp.locked": "Validé — en attente des autres…",
  "sixqp.chooseRow": "Tu as la plus petite carte — choisis une rangée à ramasser",
  "sixqp.waitingChooseRow": "{name} doit choisir une rangée à ramasser…",
  "sixqp.round": "Manche {round}",
  "sixqp.bulls": "{n} 🐂",
  "sixqp.yourHand": "Ta main",
  "sixqp.played": "Joué",
  "sixqp.finalScores": "Scores finaux",
  "sixqp.lowestWins": "Le moins de têtes gagne",
  "notice.playerJoined": "{name} a rejoint.",
  "notice.roomClosed": "Salon fermé.",
};

const TABLES: Record<Locale, Table> = { en, fr };

export function detectLocale(): Locale {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr"))
    return "fr";
  return "en";
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  let s = TABLES[locale][key] ?? TABLES.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}
