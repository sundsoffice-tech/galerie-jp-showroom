// ————————————————————————————————————————————————
// KONFIG — alle Stellschrauben des Showrooms an einem Ort.
// Hier darf gefahrlos angepasst werden; der 3D-Code liest nur diese Werte.
// Inhalte (Säle, Werke, Preise, Galeriename) stehen in src/data/werke.json.
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
    gehtempo: 3.2, // Meter pro Sekunde
    drehempfindlichkeit: 0.0042, // Maus/Touch-Umsehen
  },

  farben: {
    wand: 0xe9e2d5,
    decke: 0x161310,
    sockel: 0x21201c,
    tuerrahmen: 0x2a251d,
    rahmenGemaelde: 0x3a2c1c, // Holzrahmen Malerei
    rahmenFoto: 0x171614, // schmaler schwarzer Fotorahmen
    hintergrund: 0x0c0b09,
  },

  licht: {
    belichtung: 1.15, // Gesamthelligkeit (Tone-Mapping-Exposure)
    grundlicht: 0.55, // weiches Umgebungslicht
    saalPunktlicht: 26, // warme Deckenleuchte pro Saal
    lichthofDeckkraft: 0.4, // Halo hinter den Werken
  },

  haengung: {
    // Plätze pro Wand — mehr Werke als Plätze werden (mit Konsolen-
    // Hinweis) nicht gehängt. Reihenfolge: Nordwand, Südwand, Stirnwand.
    plaetzeLaengswand: 3,
    plaetzeStirnwand: 2,
  },
};
