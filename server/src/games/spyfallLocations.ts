// Curated location bank for Spyfall. Every player (spy included) sees the full
// list of location names - it's the spy's guess menu and the crew's bluffing
// space. Each location carries enough roles to cover a full 10-player room
// (roles repeat if a location ever runs short).

import type { Language } from "../../../shared/src/games.js";

export interface SpyfallLocation {
  name: string;
  roles: string[];
}

const FR: SpyfallLocation[] = [
  {
    name: "Station spatiale",
    roles: ["Commandant", "Ingénieur de bord", "Scientifique", "Touriste spatial", "Médecin", "Pilote de navette", "Spécialiste radio", "Astronaute stagiaire", "Roboticien"],
  },
  {
    name: "Sous-marin",
    roles: ["Capitaine", "Officier sonar", "Mécanicien", "Cuisinier de bord", "Torpilleur", "Médecin de bord", "Navigateur", "Matelot", "Officier radio"],
  },
  {
    name: "Plage tropicale",
    roles: ["Maître-nageur", "Vendeur de glaces", "Touriste brûlé par le soleil", "Prof de surf", "Photographe", "Joueur de beach-volley", "Masseur", "Enfant qui fait des châteaux", "DJ du bar de plage"],
  },
  {
    name: "Casino",
    roles: ["Croupier", "Agent de sécurité", "Joueur compulsif", "Chanteuse de cabaret", "Barman", "Millionnaire", "Tricheur professionnel", "Serveuse", "Directeur du casino"],
  },
  {
    name: "Hôpital",
    roles: ["Chirurgien", "Infirmière", "Patient", "Interne épuisé", "Anesthésiste", "Brancardier", "Visiteur inquiet", "Pharmacien", "Réceptionniste"],
  },
  {
    name: "École primaire",
    roles: ["Maîtresse", "Élève turbulent", "Directeur", "Cantinier", "Surveillant de récré", "Parent d'élève", "Infirmière scolaire", "Concierge", "Prof de sport"],
  },
  {
    name: "Train de nuit",
    roles: ["Contrôleur", "Conducteur", "Voyageur insomniaque", "Voleur de bagages", "Serveur du wagon-bar", "Touriste perdu", "Homme d'affaires", "Routard", "Mécanicien"],
  },
  {
    name: "Restaurant gastronomique",
    roles: ["Chef étoilé", "Sommelier", "Serveur", "Critique gastronomique", "Plongeur", "Client en rendez-vous galant", "Maître d'hôtel", "Pâtissier", "Commis de cuisine"],
  },
  {
    name: "Bateau de croisière",
    roles: ["Capitaine", "Animateur", "Passager malade", "Femme de chambre", "Chef cuisinier", "Retraité en voyage", "Musicien du bord", "Officier de pont", "Maître-nageur de la piscine"],
  },
  {
    name: "Cirque",
    roles: ["Clown", "Dompteur", "Trapéziste", "Monsieur Loyal", "Jongleur", "Magicien", "Vendeur de pop-corn", "Acrobate", "Lanceur de couteaux"],
  },
  {
    name: "Banque",
    roles: ["Guichetier", "Directeur d'agence", "Agent de sécurité", "Client pressé", "Conseiller financier", "Braqueur déguisé", "Convoyeur de fonds", "Stagiaire", "Auditeur"],
  },
  {
    name: "Base polaire",
    roles: ["Climatologue", "Chef d'expédition", "Cuisinier", "Mécanicien de motoneige", "Biologiste", "Médecin", "Opérateur radio", "Glaciologue", "Photographe animalier"],
  },
  {
    name: "Château médiéval",
    roles: ["Roi", "Reine", "Chevalier", "Bouffon", "Cuisinier", "Garde", "Sorcier de la cour", "Servante", "Ménestrel"],
  },
  {
    name: "Cinéma",
    roles: ["Projectionniste", "Caissier", "Vendeur de pop-corn", "Spectateur bavard", "Critique de film", "Ouvreuse", "Couple au dernier rang", "Agent d'entretien", "Gérant"],
  },
  {
    name: "Station de ski",
    roles: ["Moniteur de ski", "Perchman", "Skieur débutant", "Pisteur-secouriste", "Vendeur de forfaits", "Barman d'altitude", "Snowboardeur", "Dameur", "Touriste frileux"],
  },
  {
    name: "Supermarché",
    roles: ["Caissier", "Chef de rayon", "Client du dimanche", "Vigile", "Boucher", "Démonstratrice", "Livreur", "Étudiant en job d'été", "Directeur du magasin"],
  },
  {
    name: "Avion de ligne",
    roles: ["Pilote", "Copilote", "Hôtesse de l'air", "Passager anxieux", "Bébé qui pleure (et son parent)", "Steward", "Passager de première classe", "Air marshal", "Touriste"],
  },
  {
    name: "Salle de sport",
    roles: ["Coach personnel", "Bodybuilder", "Débutant motivé", "Prof de yoga", "Réceptionniste", "Influenceur fitness", "Agent d'entretien", "Kiné", "Habitué du sauna"],
  },
  {
    name: "Plateau de télévision",
    roles: ["Présentateur", "Cadreur", "Maquilleuse", "Invité célèbre", "Régisseur", "Ingénieur du son", "Spectateur du public", "Producteur", "Stagiaire"],
  },
  {
    name: "Marché de Noël",
    roles: ["Vendeur de vin chaud", "Père Noël", "Artisan", "Touriste", "Chanteur de chorale", "Agent de sécurité", "Enfant émerveillé", "Vendeur de crêpes", "Photographe"],
  },
];

const EN: SpyfallLocation[] = [
  {
    name: "Space station",
    roles: ["Commander", "Flight engineer", "Scientist", "Space tourist", "Doctor", "Shuttle pilot", "Radio specialist", "Trainee astronaut", "Robotics expert"],
  },
  {
    name: "Submarine",
    roles: ["Captain", "Sonar officer", "Mechanic", "Ship's cook", "Torpedo operator", "Medic", "Navigator", "Sailor", "Radio officer"],
  },
  {
    name: "Tropical beach",
    roles: ["Lifeguard", "Ice cream seller", "Sunburnt tourist", "Surf instructor", "Photographer", "Beach volleyball player", "Masseur", "Kid building sandcastles", "Beach bar DJ"],
  },
  {
    name: "Casino",
    roles: ["Dealer", "Security guard", "Compulsive gambler", "Cabaret singer", "Bartender", "Millionaire", "Professional cheat", "Waitress", "Casino manager"],
  },
  {
    name: "Hospital",
    roles: ["Surgeon", "Nurse", "Patient", "Exhausted intern", "Anesthesiologist", "Orderly", "Worried visitor", "Pharmacist", "Receptionist"],
  },
  {
    name: "Elementary school",
    roles: ["Teacher", "Unruly pupil", "Principal", "Lunch lady", "Playground monitor", "Parent", "School nurse", "Janitor", "PE teacher"],
  },
  {
    name: "Night train",
    roles: ["Ticket inspector", "Driver", "Sleepless traveler", "Luggage thief", "Bar-car waiter", "Lost tourist", "Businessman", "Backpacker", "Mechanic"],
  },
  {
    name: "Fancy restaurant",
    roles: ["Star chef", "Sommelier", "Waiter", "Food critic", "Dishwasher", "Customer on a date", "Head waiter", "Pastry chef", "Kitchen apprentice"],
  },
  {
    name: "Cruise ship",
    roles: ["Captain", "Entertainer", "Seasick passenger", "Housekeeper", "Head cook", "Retired traveler", "Ship musician", "Deck officer", "Pool lifeguard"],
  },
  {
    name: "Circus",
    roles: ["Clown", "Lion tamer", "Trapeze artist", "Ringmaster", "Juggler", "Magician", "Popcorn seller", "Acrobat", "Knife thrower"],
  },
  {
    name: "Bank",
    roles: ["Teller", "Branch manager", "Security guard", "Customer in a hurry", "Financial advisor", "Robber in disguise", "Armored truck driver", "Intern", "Auditor"],
  },
  {
    name: "Polar station",
    roles: ["Climatologist", "Expedition leader", "Cook", "Snowmobile mechanic", "Biologist", "Doctor", "Radio operator", "Glaciologist", "Wildlife photographer"],
  },
  {
    name: "Medieval castle",
    roles: ["King", "Queen", "Knight", "Jester", "Cook", "Guard", "Court wizard", "Maid", "Minstrel"],
  },
  {
    name: "Movie theater",
    roles: ["Projectionist", "Cashier", "Popcorn seller", "Chatty moviegoer", "Film critic", "Usher", "Couple in the back row", "Cleaner", "Manager"],
  },
  {
    name: "Ski resort",
    roles: ["Ski instructor", "Lift operator", "Beginner skier", "Ski patroller", "Ticket seller", "Mountain bartender", "Snowboarder", "Groomer driver", "Freezing tourist"],
  },
  {
    name: "Supermarket",
    roles: ["Cashier", "Aisle manager", "Sunday shopper", "Security guard", "Butcher", "Free-sample demonstrator", "Delivery driver", "Student on a summer job", "Store manager"],
  },
  {
    name: "Passenger plane",
    roles: ["Pilot", "Co-pilot", "Flight attendant", "Nervous passenger", "Crying baby (and parent)", "Steward", "First-class passenger", "Air marshal", "Tourist"],
  },
  {
    name: "Gym",
    roles: ["Personal trainer", "Bodybuilder", "Motivated beginner", "Yoga teacher", "Receptionist", "Fitness influencer", "Cleaner", "Physiotherapist", "Sauna regular"],
  },
  {
    name: "TV studio",
    roles: ["Host", "Camera operator", "Makeup artist", "Celebrity guest", "Stage manager", "Sound engineer", "Audience member", "Producer", "Intern"],
  },
  {
    name: "Christmas market",
    roles: ["Mulled-wine seller", "Santa Claus", "Craftsman", "Tourist", "Choir singer", "Security guard", "Amazed kid", "Crêpe seller", "Photographer"],
  },
];

const BANKS: Record<Language, SpyfallLocation[]> = { fr: FR, en: EN };

/** All location names for a language (the public list everyone sees). */
export function locationNames(language: Language): string[] {
  return BANKS[language].map((l) => l.name);
}

/** Pick a random location for a round. */
export function pickLocation(language: Language): SpyfallLocation {
  const bank = BANKS[language];
  return bank[Math.floor(Math.random() * bank.length)];
}
