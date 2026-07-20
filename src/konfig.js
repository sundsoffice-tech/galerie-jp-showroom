// ————————————————————————————————————————————————
// KONFIG — alle Stellschrauben des Showrooms an einem Ort.
// Hier darf gefahrlos angepasst werden; der 3D-Code liest nur diese Werte.
// Inhalte (Säle, Werke, Preise, Galeriename) stehen in src/data/werke.json.
//
// Leitidee der Inszenierung: „Privatführung nach Schließung" —
// die Säle liegen im Abend-Dämmer, nur die Werke stehen im Licht.
// ————————————————————————————————————————————————

// ————— Saal-Stimmungen —————
// Drei Grundstimmungen, aus denen die Verwaltung je Saal eine auswählt
// (Feld `stil` in werke.json). Wer einen ganz eigenen Saal will, legt hier
// einen weiteren Eintrag an und trägt dessen Schlüssel im Saal ein.
export const SAAL_STIMMUNGEN = {
  hell: {
    titel: "Hell",
    hinweis: "Heller Putz, ruhiges Licht — der klassische Ausstellungssaal.",
    wand: 0xeae3d6, spotFarbe: 0xffdcae, lichtFaktor: 1.0, poolFaktor: 1.0,
    lettering: "#2b2721", bank: 0x4a3524,
  },
  warm: {
    titel: "Warm",
    hinweis: "Leicht wärmeres Licht, kräftigere Lichtinseln — für farbige Malerei.",
    wand: 0xe6e5df, spotFarbe: 0xffe6c6, lichtFaktor: 1.0, poolFaktor: 1.15,
    lettering: "#2b2721", bank: 0x33281e,
  },
  dunkel: {
    titel: "Dunkel",
    hinweis: "Anthrazit gehaltener Saal, die Werke stehen allein im Licht — der Höhepunkt.",
    wand: 0x3a3733, spotFarbe: 0xfff3e4, lichtFaktor: 0.55, poolFaktor: 1.5,
    lettering: "#ede7dc", bank: 0x191714,
  },
};

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
    beschleunigung: 15, // Anfahren (höher = direkter)
    daempfung: 6.5, // Ausrollen (höher = schnelleres Stoppen)
    drehempfindlichkeit: 0.0042, // Maus/Touch-Umsehen
    drehglaettung: 13, // Glättung des Blicks (höher = direkter)
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

  mobil: {
    dprCap: 1.5, // Pixel-Ratio-Deckel auf Touch (Desktop: 2)
    dprCapSchwach: 1.25, // bei <=4 Kernen / <=4 GB RAM
    tapToleranzPx: 14, // Finger wackeln mehr als ein Mauszeiger (Desktop: 9)
    joystickRadiusPx: 44, // maximale Knauf-Auslenkung
    joystickDeadzone: 0.18,
    platzhalterHoehe: 640, // Platzhalter-Auflösung auf Touch (Desktop: 1024)
    hFovZielGrad: 44, // Ziel-Horizontal-Sichtfeld im Portrait
  },

  haengung: {
    // Plätze pro Wand — mehr Werke als Plätze werden (mit Konsolen-
    // Hinweis) nicht gehängt. Reihenfolge: Nordwand, Südwand, Stirnwand.
    plaetzeLaengswand: 3,
    plaetzeStirnwand: 2,
  },

  // Ein Saal wählt seine Stimmung über das Feld `stil` (s. SAAL_STIMMUNGEN).
  // Fehlt es, greifen die Vorgaben der Demo-Säle nach Saal-ID, sonst "hell".
  saalStile: {
    standard: SAAL_STIMMUNGEN.hell,
    ...SAAL_STIMMUNGEN,
    moderne: SAAL_STIMMUNGEN.hell,
    abstraktion: SAAL_STIMMUNGEN.warm,
    fotografie: SAAL_STIMMUNGEN.dunkel,
  },
};

// ————— Laufzeit-Erkennung (nicht anfassen, Details in geraet.js) —————
// Tier A = Desktop (Bloom, Museumsglas, Physical-Parkett)
// Tier B = Touch/kleine Geräte (schlanker Renderpfad, gleiche Fake-Lichter)
import { IST_TOUCH as _touch } from "./geraet.js";
export { IST_TOUCH, IST_SCHWACH, REDUZIERTE_BEWEGUNG } from "./geraet.js";

const _klein = typeof window !== "undefined" && Math.min(screen.width, screen.height) < 820;
export const TIER = _touch || _klein ? "B" : "A";
