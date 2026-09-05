export interface WordEntry {
  word: string;
  themes: string[];
}

export const AVAILABLE_THEMES = [
  "DANCE",
  "ESPIONAGE",
  "ASTRONOMY",
  "MILITARY",
  "AGRICULTURE",
  "MARITIME",
  "MEDICINE",
  "CRIME",
  "AVIATION",
  "MUSIC",
] as const;

export type ThemeType = (typeof AVAILABLE_THEMES)[number];

export const WORD_BANK: WordEntry[] = [
  // DANCE theme (with cross-cutting tags)
  { word: "Barn", themes: ["DANCE", "AGRICULTURE", "ARCHITECTURE"] },
  { word: "Modern", themes: ["DANCE", "ART", "PHILOSOPHY"] },
  { word: "Waltz", themes: ["DANCE", "MUSIC"] },
  { word: "Salsa", themes: ["DANCE", "CULINARY", "MUSIC"] },
  { word: "Tap", themes: ["DANCE", "MECHANICAL"] },
  { word: "Ballet", themes: ["DANCE", "THEATRE", "ART"] },
  { word: "Tango", themes: ["DANCE", "MUSIC"] },
  { word: "Rhythm", themes: ["DANCE", "MUSIC"] },
  { word: "Tempo", themes: ["DANCE", "MUSIC"] },
  { word: "Studio", themes: ["DANCE", "ART", "BROADCAST"] },
  { word: "Routine", themes: ["DANCE", "MILITARY", "PSYCHOLOGY"] },
  { word: "Chorus", themes: ["DANCE", "MUSIC", "THEATRE"] },
  { word: "Step", themes: ["DANCE", "FITNESS"] },
  { word: "Spin", themes: ["DANCE", "ASTRONOMY", "PHYSICS"] },
  { word: "Twist", themes: ["DANCE", "CULINARY", "CRIME"] },
  { word: "Groove", themes: ["DANCE", "MUSIC", "CARPENTRY"] },
  { word: "Sway", themes: ["DANCE", "BOTANY", "MARITIME"] },
  { word: "Pirouette", themes: ["DANCE", "BALLET"] },
  { word: "Ballroom", themes: ["DANCE", "ARCHITECTURE"] },
  { word: "Footwork", themes: ["DANCE", "MILITARY", "FITNESS"] },
  { word: "Choreography", themes: ["DANCE", "THEATRE"] },
  { word: "Leap", themes: ["DANCE", "FITNESS"] },
  { word: "Pose", themes: ["DANCE", "ART", "PHOTOGRAPHY"] },
  { word: "Partner", themes: ["DANCE", "LAW", "ESPIONAGE"] },

  // ESPIONAGE theme
  { word: "Cipher", themes: ["ESPIONAGE", "CRYPTOGRAPHY", "TECHNOLOGY"] },
  { word: "Shadow", themes: ["ESPIONAGE", "ASTRONOMY", "WEATHER"] },
  { word: "Wiretap", themes: ["ESPIONAGE", "TECHNOLOGY", "CRIME"] },
  { word: "Bug", themes: ["ESPIONAGE", "BIOLOGY", "TECHNOLOGY"] },
  { word: "Microfilm", themes: ["ESPIONAGE", "PHOTOGRAPHY", "ARCHIVE"] },
  { word: "Dossier", themes: ["ESPIONAGE", "LAW", "GOVERNMENT"] },
  { word: "Trenchcoat", themes: ["ESPIONAGE", "FASHION"] },
  { word: "Asset", themes: ["ESPIONAGE", "FINANCE", "BUSINESS"] },
  { word: "Handler", themes: ["ESPIONAGE", "AVIATION", "CANINE"] },
  { word: "Defector", themes: ["ESPIONAGE", "POLITICS", "MILITARY"] },
  { word: "Safehouse", themes: ["ESPIONAGE", "ARCHITECTURE", "CRIME"] },
  { word: "Cyanide", themes: ["ESPIONAGE", "CHEMISTRY", "MEDICINE"] },
  { word: "Passport", themes: ["ESPIONAGE", "TRAVEL", "GOVERNMENT"] },
  { word: "Blackmail", themes: ["ESPIONAGE", "CRIME", "LAW"] },
  { word: "Surveillance", themes: ["ESPIONAGE", "MILITARY", "SECURITY"] },
  { word: "Informant", themes: ["ESPIONAGE", "CRIME", "LAW"] },
  { word: "Intercept", themes: ["ESPIONAGE", "MILITARY", "MATHEMATICS"] },
  { word: "Dead-drop", themes: ["ESPIONAGE", "CRIME"] },
  { word: "Disinformation", themes: ["ESPIONAGE", "MEDIA", "POLITICS"] },
  { word: "Operative", themes: ["ESPIONAGE", "MILITARY"] },
  { word: "Wiretap", themes: ["ESPIONAGE", "SECURITY", "TECHNOLOGY"] },
  { word: "Alias", themes: ["ESPIONAGE", "CRIME", "IDENTITY"] },
  { word: "Alibi", themes: ["ESPIONAGE", "CRIME", "LAW"] },

  // ASTRONOMY theme
  { word: "Eclipse", themes: ["ASTRONOMY", "WEATHER", "OPTICS"] },
  { word: "Orbit", themes: ["ASTRONOMY", "PHYSICS", "AVIATION"] },
  { word: "Comet", themes: ["ASTRONOMY", "WEATHER"] },
  { word: "Nebula", themes: ["ASTRONOMY", "PHYSICS"] },
  { word: "Meteor", themes: ["ASTRONOMY", "GEOLOGY"] },
  { word: "Crater", themes: ["ASTRONOMY", "GEOLOGY", "MILITARY"] },
  { word: "Pulsar", themes: ["ASTRONOMY", "PHYSICS"] },
  { word: "Zenith", themes: ["ASTRONOMY", "NAVIGATION", "MARITIME"] },
  { word: "Solstice", themes: ["ASTRONOMY", "CALENDAR"] },
  { word: "Horizon", themes: ["ASTRONOMY", "MARITIME", "AVIATION"] },
  { word: "Aurora", themes: ["ASTRONOMY", "WEATHER"] },
  { word: "Telescope", themes: ["ASTRONOMY", "OPTICS", "MARITIME"] },
  { word: "Galaxy", themes: ["ASTRONOMY", "PHYSICS"] },
  { word: "Constellation", themes: ["ASTRONOMY", "NAVIGATION"] },
  { word: "Supernova", themes: ["ASTRONOMY", "PHYSICS"] },
  { word: "Asteroid", themes: ["ASTRONOMY", "GEOLOGY"] },
  { word: "Satellite", themes: ["ASTRONOMY", "TECHNOLOGY", "MILITARY"] },
  { word: "Gravity", themes: ["ASTRONOMY", "PHYSICS"] },
  { word: "Cosmos", themes: ["ASTRONOMY", "PHILOSOPHY"] },
  { word: "Vacuum", themes: ["ASTRONOMY", "PHYSICS", "CLEANING"] },

  // MILITARY theme
  { word: "Radar", themes: ["MILITARY", "AVIATION", "TECHNOLOGY"] },
  { word: "Bunker", themes: ["MILITARY", "ARCHITECTURE", "GOLF"] },
  { word: "Trench", themes: ["MILITARY", "GEOLOGY", "AGRICULTURE"] },
  { word: "Submarine", themes: ["MILITARY", "MARITIME", "NAVIGATION"] },
  { word: "Convoy", themes: ["MILITARY", "TRANSPORTATION", "MARITIME"] },
  { word: "Torpedo", themes: ["MILITARY", "MARITIME", "WEAPONS"] },
  { word: "Bayonet", themes: ["MILITARY", "WEAPONS", "HISTORY"] },
  { word: "Barracks", themes: ["MILITARY", "ARCHITECTURE"] },
  { word: "Periscope", themes: ["MILITARY", "MARITIME", "OPTICS"] },
  { word: "Fortress", themes: ["MILITARY", "ARCHITECTURE", "HISTORY"] },
  { word: "Cruiser", themes: ["MILITARY", "MARITIME", "TRANSPORTATION"] },
  { word: "Destroyer", themes: ["MILITARY", "MARITIME"] },
  { word: "Parachute", themes: ["MILITARY", "AVIATION", "SAFETY"] },
  { word: "Artillery", themes: ["MILITARY", "WEAPONS"] },
  { word: "Helmet", themes: ["MILITARY", "SAFETY", "SPORTS"] },
  { word: "Outpost", themes: ["MILITARY", "FRONTIER", "GEOGRAPHY"] },
  { word: "Battalion", themes: ["MILITARY", "ORGANIZATION"] },
  { word: "Sentry", themes: ["MILITARY", "SECURITY", "ESPIONAGE"] },
  { word: "Ambush", themes: ["MILITARY", "CRIME", "TACTICS"] },
  { word: "Camouflage", themes: ["MILITARY", "BIOLOGY", "FASHION"] },

  // AGRICULTURE theme
  { word: "Tractor", themes: ["AGRICULTURE", "VEHICLES", "MACHINERY"] },
  { word: "Harvest", themes: ["AGRICULTURE", "SEASONS", "FOOD"] },
  { word: "Silo", themes: ["AGRICULTURE", "ARCHITECTURE", "MILITARY"] },
  { word: "Pasture", themes: ["AGRICULTURE", "GEOGRAPHY", "ANIMALS"] },
  { word: "Crop", themes: ["AGRICULTURE", "PHOTOGRAPHY", "BOTANY"] },
  { word: "Plow", themes: ["AGRICULTURE", "ASTRONOMY", "MACHINERY"] },
  { word: "Windmill", themes: ["AGRICULTURE", "ENERGY", "ARCHITECTURE"] },
  { word: "Orchard", themes: ["AGRICULTURE", "BOTANY", "FOOD"] },
  { word: "Meadow", themes: ["AGRICULTURE", "NATURE", "GEOGRAPHY"] },
  { word: "Haystack", themes: ["AGRICULTURE", "NATURE"] },
  { word: "Grain", themes: ["AGRICULTURE", "FOOD", "PHOTOGRAPHY"] },
  { word: "Field", themes: ["AGRICULTURE", "SPORTS", "PHYSICS"] },
  { word: "Acre", themes: ["AGRICULTURE", "MATHEMATICS", "REAL_ESTATE"] },
  { word: "Fertilizer", themes: ["AGRICULTURE", "CHEMISTRY"] },
  { word: "Sickle", themes: ["AGRICULTURE", "TOOLS", "HISTORY"] },
  { word: "Furrow", themes: ["AGRICULTURE", "GEOLOGY"] },
  { word: "Livestock", themes: ["AGRICULTURE", "ANIMALS", "COMMERCE"] },
  { word: "Granary", themes: ["AGRICULTURE", "ARCHITECTURE"] },

  // MARITIME theme
  { word: "Anchor", themes: ["MARITIME", "METAPHOR", "BROADCAST"] },
  { word: "Harbor", themes: ["MARITIME", "GEOGRAPHY", "LAW"] },
  { word: "Compass", themes: ["MARITIME", "NAVIGATION", "MATHEMATICS"] },
  { word: "Vessel", themes: ["MARITIME", "MEDICINE", "CONTAINER"] },
  { word: "Rudder", themes: ["MARITIME", "AVIATION", "MECHANICS"] },
  { word: "Lighthouse", themes: ["MARITIME", "ARCHITECTURE", "OPTICS"] },
  { word: "Reef", themes: ["MARITIME", "BIOLOGY", "GEOLOGY"] },
  { word: "Mast", themes: ["MARITIME", "TELECOM", "ARCHITECTURE"] },
  { word: "Wharf", themes: ["MARITIME", "COMMERCE", "ARCHITECTURE"] },
  { word: "Buoy", themes: ["MARITIME", "NAVIGATION", "SAFETY"] },
  { word: "Shipwreck", themes: ["MARITIME", "HISTORY", "DISASTER"] },
  { word: "Sextant", themes: ["MARITIME", "ASTRONOMY", "NAVIGATION"] },
  { word: "Pier", themes: ["MARITIME", "ARCHITECTURE", "LEISURE"] },
  { word: "Keel", themes: ["MARITIME", "ENGINEERING"] },
  { word: "Deck", themes: ["MARITIME", "CARDS", "ARCHITECTURE"] },
  { word: "Captain", themes: ["MARITIME", "AVIATION", "MILITARY", "SPORTS"] },
  { word: "Cargo", themes: ["MARITIME", "TRANSPORTATION", "COMMERCE"] },
  { word: "Lagoon", themes: ["MARITIME", "GEOGRAPHY", "BIOLOGY"] },
  { word: "Knot", themes: ["MARITIME", "MATHEMATICS", "PHYSICS"] },
  { word: "Sailor", themes: ["MARITIME", "OCCUPATION", "MILITARY"] },

  // MEDICINE theme
  { word: "Scalpel", themes: ["MEDICINE", "SURGERY", "TOOLS"] },
  { word: "Antibiotic", themes: ["MEDICINE", "CHEMISTRY", "BIOLOGY"] },
  { word: "Syringe", themes: ["MEDICINE", "TOOLS"] },
  { word: "Stethoscope", themes: ["MEDICINE", "DIAGNOSTICS", "ACOUSTICS"] },
  { word: "Bandage", themes: ["MEDICINE", "FIRST_AID"] },
  { word: "Capsule", themes: ["MEDICINE", "ASTRONOMY", "ARCHITECTURE"] },
  { word: "Serum", themes: ["MEDICINE", "ESPIONAGE", "CHEMISTRY"] },
  { word: "Pulse", themes: ["MEDICINE", "PHYSICS", "MUSIC"] },
  { word: "Reflex", themes: ["MEDICINE", "PSYCHOLOGY", "OPTICS"] },
  { word: "Vaccine", themes: ["MEDICINE", "IMMUNOLOGY"] },
  { word: "Suture", themes: ["MEDICINE", "SURGERY", "TEXTILES"] },
  { word: "Trauma", themes: ["MEDICINE", "PSYCHOLOGY"] },
  { word: "Toxin", themes: ["MEDICINE", "CHEMISTRY", "BIOLOGY"] },
  { word: "Remedy", themes: ["MEDICINE", "LAW"] },
  { word: "Clinic", themes: ["MEDICINE", "ARCHITECTURE", "EDUCATION"] },
  { word: "Specimen", themes: ["MEDICINE", "BIOLOGY", "FORENSICS"] },

  // CRIME theme
  { word: "Heist", themes: ["CRIME", "CINEMA"] },
  { word: "Contraband", themes: ["CRIME", "MARITIME", "COMMERCE"] },
  { word: "Forgery", themes: ["CRIME", "ART", "FINANCE"] },
  { word: "Syndicate", themes: ["CRIME", "BUSINESS", "MEDIA"] },
  { word: "Getaway", themes: ["CRIME", "TRAVEL", "VEHICLES"] },
  { word: "Extortion", themes: ["CRIME", "LAW", "FINANCE"] },
  { word: "Suspect", themes: ["CRIME", "LAW", "ESPIONAGE"] },
  { word: "Handcuffs", themes: ["CRIME", "SECURITY", "LAW"] },
  { word: "Larceny", themes: ["CRIME", "LAW"] },
  { word: "Smuggler", themes: ["CRIME", "MARITIME", "AVIATION"] },
  { word: "Motive", themes: ["CRIME", "PSYCHOLOGY", "ART"] },
  { word: "Accomplice", themes: ["CRIME", "LAW", "ESPIONAGE"] },

  // AVIATION theme
  { word: "Fuselage", themes: ["AVIATION", "ENGINEERING"] },
  { word: "Propeller", themes: ["AVIATION", "MARITIME", "MECHANICAL"] },
  { word: "Runway", themes: ["AVIATION", "FASHION", "INFRASTRUCTURE"] },
  { word: "Cockpit", themes: ["AVIATION", "MARITIME", "MOTORSPORTS"] },
  { word: "Altitude", themes: ["AVIATION", "GEOGRAPHY", "ASTRONOMY"] },
  { word: "Glider", themes: ["AVIATION", "SPORTS"] },
  { word: "Zeppelin", themes: ["AVIATION", "HISTORY", "MILITARY"] },
  { word: "Hangar", themes: ["AVIATION", "ARCHITECTURE", "MILITARY"] },
  { word: "Turbulence", themes: ["AVIATION", "METEOROLOGY", "FLUID_DYNAMICS"] },
  { word: "Blackbox", themes: ["AVIATION", "TECHNOLOGY", "FORENSICS"] },

  // MUSIC theme
  { word: "Sonata", themes: ["MUSIC", "ART"] },
  { word: "Symphony", themes: ["MUSIC", "METAPHOR"] },
  { word: "Overture", themes: ["MUSIC", "THEATRE"] },
  { word: "Crescendo", themes: ["MUSIC", "METAPHOR"] },
  { word: "Metronome", themes: ["MUSIC", "TIMEKEEPING"] },
  { word: "Harmonica", themes: ["MUSIC", "INSTRUMENTS"] },
  { word: "Treble", themes: ["MUSIC", "ACOUSTICS"] },
  { word: "Encore", themes: ["MUSIC", "THEATRE"] },
  { word: "Aria", themes: ["MUSIC", "OPERA"] },
  { word: "Chord", themes: ["MUSIC", "MATHEMATICS", "ANATOMY"] },
];

/**
 * Select a random primary theme from the available list
 */
export function getRandomTheme(): ThemeType {
  const idx = Math.floor(Math.random() * AVAILABLE_THEMES.length);
  return AVAILABLE_THEMES[idx];
}

/**
 * Draw `count` unique words associated with the chosen theme
 */
export function drawWordsForTheme(theme: string, count: number): string[] {
  const seen = new Set<string>();
  const matchingWords: WordEntry[] = [];

  for (const entry of WORD_BANK) {
    if (entry.themes.map((t) => t.toUpperCase()).includes(theme.toUpperCase())) {
      const normalized = entry.word.trim().toUpperCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        matchingWords.push(entry);
      }
    }
  }

  if (matchingWords.length < count) {
    throw new Error(
      `Insufficient words for theme '${theme}'. Required: ${count}, Available: ${matchingWords.length}`
    );
  }

  // Fisher-Yates shuffle
  const shuffled = [...matchingWords];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count).map((e) => e.word);
}
