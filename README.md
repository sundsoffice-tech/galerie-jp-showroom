# Galerie JP — Virtueller 3D-Showroom

Begehbarer Online-Showroom für einen Kunsthändler: First-Person-Rundgang
durch Themensäle (Three.js/WebGL) in der Inszenierung „Privatführung nach
Schließung" — dunkle Säle, jedes Werk in seiner warmen Lichtinsel. Jedes
Werk ist ein **Unikat** und direkt über die integrierte Reservierung
(optional: Stripe-Sofortkauf) erwerbbar.

**Live:** https://sundsoffice-tech.github.io/galerie-jp-showroom/

## Starten & Deployen

```bash
npm install
npm run dev        # Entwicklung: http://localhost:5173 (oder nächster freier Port)
npm run build      # Produktions-Build nach dist/
```

- **GitHub Pages:** Repo `sundsoffice-tech/galerie-jp-showroom`. Der Workflow
  `.github/workflows/deploy.yml` deployt bei jedem Push automatisch —
  **sobald das GitHub-Billing-Problem des Accounts behoben ist** (aktuell:
  „account locked due to a billing issue" → github.com → Settings → Billing).
  Bis dahin manuell: `npm run build`, dann `dist/` auf den Branch `gh-pages`
  pushen (`.nojekyll` nicht vergessen) und ggf. per
  `gh api repos/<repo>/pages/builds -X POST` einen Build anstoßen.
- **Netlify (Alternative):** `netlify.toml` liegt bereit (inkl. CSP-Header
  für Web3Forms). Repo importieren, fertig.
- Mobil-Vorschau für Demos: `/mobil-test.html` (Telefon-Rahmen) bzw.
  `/?touch=1` erzwingt das Touch-Layout am Desktop.

## Das System: Werke pflegen ohne Technik-Kenntnisse

Alles Inhaltliche liegt in **einer Datei**: `src/data/werke.json`.
Dazu gibt es die **Verwaltungs-Seite `verwaltung.html`** (Doppelklick genügt,
läuft ohne Server): `werke.json` hineinziehen → Werke/Säle in Formularen
anlegen, bearbeiten, duplizieren, löschen (mit Validierung und
Kapazitäts-Warnung) → neue `werke.json` herunterladen → auf GitHub
`src/data/werke.json` ersetzen („Add file → Upload files") → Auto-Deploy.
Die Datei liegt bewusst außerhalb des Builds und wird **nie mit deployt**.

### Werk-Felder

```json
{
  "id": "w-013",            // eindeutig; Verwaltung vergibt automatisch
  "raum": "moderne",        // Saal-ID
  "titel": "…", "kuenstler": "…", "jahr": 2026, "technik": "…",
  "breite_cm": 120, "hoehe_cm": 90,   // bestimmt die reale Größe an der Wand
  "preis": 7500,            // null = „Preis auf Anfrage" (nur Anfrage-Weg)
  "bild": "w-013.jpg",      // Datei in public/werke/; null = stilechter Platzhalter
  "verkauft": false,        // true = roter Punkt, nicht mehr kaufbar
  "beschreibung": "Saaltext …",
  "stripeLink": "https://buy.stripe.com/…"   // optional, s. Stripe Stufe B
}
```

Die Galerie **hängt die Wände automatisch** (Position, Rahmen, Lichtinsel,
Strahler, Plakette). Pro Saal: 6 Plätze an den Längswänden, +2 an der
Stirnwand im ersten/letzten Saal; Überzählige werden mit Konsolen-Hinweis
nicht gehängt.

### Optik & Verhalten anpassen

Alle Stellschrauben stehen kommentiert in **`src/konfig.js`**: Raummaße,
Licht-Inszenierung, Saal-Persönlichkeiten (Wandfarben, Lichtfarbe je Saal),
Bewegungsgefühl (Tempo, Trägheit, Head-Bob, FOV-Dramaturgie), Klang,
Mobile-Parameter. Galeriename/E-Mail/Währung stehen in `werke.json`.

## Kauf-Flow

1. **Reservierung (aktiv):** Sammlung → „Erwerben" → Formular. Mit
   gepflegtem `galerie.web3formsKey` (kostenlos von web3forms.com, Key darf
   committed werden) geht eine **echte E-Mail** an die Galerie — Reply-To ist
   der Kunde. Leerer Key = Demo-Modus. **Im Browser testen, nie per curl.**
2. **Stripe Stufe B (vorbereitet):** Im Stripe-Dashboard je Werk einen
   Payment Link anlegen mit **„Limit the number of payments" = 1**
   (harter Unikat-Schutz) und als success-URL `…/?erworben=w-005` setzen.
   Link in der Verwaltung beim Werk eintragen → im Panel erscheint
   „Sofort erwerben". Nach Kauf markiert die Galerie das Werk in der
   Verwaltung als verkauft.
3. **Stufe C (bei Bedarf):** Serverless-Checkout + Webhook, siehe
   Netlify-Functions-Pfad — erst sinnvoll ab vielen Online-Verkäufen.

## Testen

Ein automatischer Durchlauf prüft den kompletten Kaufweg (Eintreten → Katalog →
Werk → Sammlung → Kasse → Reservierung → Saalwechsel) auf Desktop **und** im
Mobil-Viewport, inklusive Konsolenfehler:

```bash
npm run dev          # in einem Terminal
npm test             # in einem zweiten (Port ggf. in package.json anpassen)
npm run test:live    # dasselbe gegen die veröffentlichte Seite
```

Der Test braucht einmalig `npx playwright install chromium`. Er hat u. a.
aufgedeckt, dass die Blätter-Pfeile den „Sammlung"-Knopf überdeckten und der
Warenkorb nach einer Reservierung offen blieb — lohnt sich also vor jedem Deploy.

## Technik

- Vite + Three.js, Vanilla JS, keine weiteren Laufzeit-Abhängigkeiten
- Alles prozedural: Parkett/Putz/Licht/Schatten/Plaketten als
  Canvas-Texturen, Ambient-Sound/Schritte/Hall als WebAudio-Synthese
- Module: `katalog` (Daten) · `szene` (Architektur+Hängung) · `beleuchtung`
  · `moebel` · `texturen` · `steuerung` · `intro` · `klang` · `ui`
  · `geraet`/`joystick`/`bottomsheet` (Mobile) · `konfig`
- Qualitätsstufen: Tier A (Desktop: Bloom, Museumsglas, Physical-Parkett),
  Tier B (Touch) + Frametime-Wächter, der nur abstuft, nie flackert
- Steuerung: Ziehen = Umsehen · WASD/Klick auf Boden = Gehen · Klick auf
  Werk = Bogen-Kamerafahrt + Panel (2. Klick = Nahzoom) · ESC = schließen ·
  Touch: Joystick + Tippen, Bottom-Sheets, Blick-Label
- Deep-Links: `#w-005` fährt nach dem Eintreten direkt vor das Werk
