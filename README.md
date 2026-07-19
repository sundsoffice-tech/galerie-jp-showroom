# Galerie JP — Virtueller 3D-Showroom

Begehbarer Online-Showroom für einen Kunsthändler: First-Person-Rundgang
durch Themensäle (Three.js/WebGL), jedes Werk ist ein **Unikat** und direkt
über den integrierten Warenkorb erwerbbar.

## Starten

```bash
npm install
npm run dev        # Entwicklung: http://localhost:5173
npm run build      # Produktions-Build nach dist/
```

## Das System: Werke pflegen ohne 3D-Kenntnisse

Alles Inhaltliche liegt in **einer Datei**: `src/data/werke.json`.

### Neues Werk hinzufügen

1. Werkfoto (JPG/PNG, gerade fotografiert, ohne Rahmen) in den Ordner
   `public/werke/` legen, z. B. `public/werke/w-013.jpg`.
2. In `werke.json` unter `"werke"` einen Eintrag ergänzen:

```json
{
  "id": "w-013",
  "raum": "moderne",
  "titel": "Neues Werk",
  "kuenstler": "Vorname Nachname",
  "jahr": 2026,
  "technik": "Öl auf Leinwand",
  "breite_cm": 120,
  "hoehe_cm": 90,
  "preis": 7500,
  "bild": "w-013.jpg",
  "verkauft": false,
  "beschreibung": "Kurzer Saaltext zum Werk."
}
```

Mehr ist nicht nötig: Die Galerie **hängt die Wände automatisch** um
(Position, Rahmen, Lichthof, Plakette mit Preis). Die Werkgröße in cm
bestimmt die reale Größe an der Wand.

- `"bild": null` → das System erzeugt automatisch einen stilechten
  Platzhalter passend zum Saal-Thema (bis das echte Foto da ist).
- `"verkauft": true` → rotes Pünktchen auf der Plakette, Werk ist nicht
  mehr kaufbar (wie in einer echten Galerie bleibt es sichtbar hängen).
- Werk entfernen = Eintrag löschen. Verschieben = `"raum"` ändern.

### Optik & Verhalten anpassen

Alle Stellschrauben (Raumgröße, Wand-/Rahmenfarben, Licht, Gehtempo,
Plätze pro Wand …) stehen kommentiert in **`src/konfig.js`** — dort ändern,
nicht im 3D-Code. Der Galeriename kommt aus `werke.json` (`galerie.name`)
und erscheint automatisch in Titel, Wortmarke und Intro.

### Säle

Die Themensäle stehen ebenfalls in `werke.json` unter `"raeume"`.
Pro Saal passen derzeit bis zu 8 Werke (3 Nordwand, 3 Südwand, 2 Stirnwand
im ersten/letzten Saal); überzählige Werke werden mit Hinweis in der
Konsole nicht gehängt.

## Kauf-Flow (Stand jetzt)

Warenkorb („Sammlung") → Kasse → **Demo-Reservierung**: Käuferdaten werden
abgefragt, die Werke als verkauft markiert (im Browser gespeichert).

Für den Echtbetrieb ist die Stelle für **Stripe Checkout** vorbereitet:
in `src/ui.js` im Submit-Handler des Checkout-Formulars (Kommentar
`>>> Hier wird später Stripe Checkout eingebunden <<<`). Nötig dafür:
Stripe-Account des Händlers + ein kleines Backend/Serverless-Function für
die Checkout-Session und das serverseitige Verkauft-Markieren.

## Technik

- Vite + Three.js, kein Framework, keine weiteren Abhängigkeiten
- Prozedural gebaute Galerie (Räume, Boden, Licht) aus den Katalogdaten
- Steuerung: Ziehen = Umsehen, WASD/Pfeile oder Klick auf den Boden =
  Gehen, Klick auf Werk = Kamerafahrt + Saaltext-Panel, ESC = schließen
- Läuft auf Desktop und Mobil (Touch)
