// ————————————————————————————————————————————————
// KONFIG — alle Stellschrauben des Showrooms an einem Ort.
// Hier darf gefahrlos angepasst werden; der 3D-Code liest nur diese Werte.
// Inhalte (Säle, Werke, Preise, Galeriename) stehen in src/data/werke.json.
//
// Leitidee der Inszenierung: „Privatführung nach Schließung" —
// die Säle liegen im Abend-Dämmer, nur die Werke stehen im Licht.
// ————————————————————————————————————————————————

export const KONFIG = {
  raum: {
    breite: 14, // Meter pro Saal (x-Richtung)
    tiefe: 10, // Meter (z-Richtung)
    hoehe: 4.2, // Deckenhöhe in Metern
    wandstaerke: 0.3,
    tuerBreite: 2.6,
    tuerHoehe: 3.1,
  },

  besucher: {
    augenhoehe: 1.62, // zugleich Aufhängehöhe der Bildmitte
    gehtempo: 2.4, // Museumsschritt in m/s
    beschleunigung: 22, // Anfahren (höher = direkter)
    daempfung: 7.5, // Ausrollen (höher = schnelleres Stoppen)
    drehempfindlichkeit: 0.0042, // Maus/Touch-Umsehen
    drehglaettung: 18, // Glättung des Blicks (höher = direkter)
    drehnachlauf: 5, // Ausschwingen nach dem Loslassen
    bobAmplitude: 0.016, // Geh-Wippen in Metern (0 = aus)
    bobFrequenz: 1.85, // Schritte pro Sekunde
    bobRolle: 0.0035, // minimales seitliches Pendeln
    fovBasis: 58, // Blickwinkel im Stehen
    fovGehen: 61, // sanfte Weitung beim Gehen
    fovFokus: 47, // Porträtbrennweite vor dem Werk
    fovIntro: 63, // Weitwinkel der Intro-Drift
  },

  licht: {
    belichtung: 1.15, // Gesamthelligkeit nach dem Eintritt
    belichtungIntro: 0.82, // Abendlicht hinter dem Start-Overlay
    belichtungFokus: 0.92, // leichte Abdunkelung im Werk-Fokus
    grundlicht: 0.34, // kühler Fill — die Dunkelheit ist der Rahmen
    saalSpot: 340, // ein warmer Deckenspot pro Saal
    kegelDeckkraft: 0.07, // Fake-Volumetrik der Strahlerkegel
    poolWand: 0.5, // Lichtinsel an der Wand hinter jedem Werk
    poolBoden: 0.11, // warme Lichtellipse auf dem Parkett
    schattenRahmen: 0.3, // weicher Schlagschatten unter jedem Rahmen
  },

  klang: {
    master: 0.5, // Gesamtlautstärke (0 = stumm)
    raumton: 0.01, // Grundrauschen des Saals
    schritt: 0.16, // Schrittlautstärke
    hallAnteil: 0.35, // Nachhall des Saals
  },

  haengung: {
    // Plätze pro Wand — mehr Werke als Plätze werden (mit Konsolen-
    // Hinweis) nicht gehängt. Reihenfolge: Nordwand, Südwand, Stirnwand.
    plaetzeLaengswand: 3,
    plaetzeStirnwand: 2,
  },

  // Raum-Persönlichkeit je Saal-ID; "standard" greift für unbekannte Säle.
  // Saal III (Fotografie) ist der inszenierte dunkle Höhepunkt.
  saalStile: {
    standard: { wand: 0xeae3d6, spotFarbe: 0xffdcae, lichtFaktor: 1.0, poolFaktor: 1.0, lettering: "#2b2721", bank: 0x4a3524 },
    moderne: { wand: 0xeae3d6, spotFarbe: 0xffdcae, lichtFaktor: 1.0, poolFaktor: 1.0, lettering: "#2b2721", bank: 0x4a3524 },
    abstraktion: { wand: 0xe6e5df, spotFarbe: 0xffe6c6, lichtFaktor: 1.0, poolFaktor: 1.15, lettering: "#2b2721", bank: 0x33281e },
    fotografie: { wand: 0x3a3733, spotFarbe: 0xfff3e4, lichtFaktor: 0.55, poolFaktor: 1.5, lettering: "#ede7dc", bank: 0x191714 },
  },
};

// ————— Laufzeit-Erkennung (nicht anfassen) —————
// Tier A = Desktop (Bloom, Museumsglas, Physical-Parkett)
// Tier B = Touch/kleine Geräte (schlanker Renderpfad, gleiche Fake-Lichter)
export const IST_TOUCH =
  typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export const IST_KLEIN =
  typeof window !== "undefined" && Math.min(screen.width, screen.height) < 820;

export const TIER = IST_TOUCH || IST_KLEIN ? "B" : "A";

export const REDUZIERTE_BEWEGUNG =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
