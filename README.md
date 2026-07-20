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

**Der Ein-Klick-Weg (empfohlen):** `verwaltung.html` doppelklicken →
einmalig den GitHub-Zugangsschlüssel einfügen (Anleitung mit Link steht
direkt in der Seite; Fine-grained Token, nur dieses Repo, Contents R/W) →
die Galerie lädt von selbst. Dann: Werk anlegen, **Foto einfach in den
Editor ziehen** (Vorschau erscheint, Dateiname/Ablage übernimmt das System),
Titel/Preis tippen, **„Veröffentlichen"** — Katalog und Fotos wandern direkt
ins Repo, und der Live-Showroom zeigt sie **nach 1–5 Minuten**, ganz ohne
Build: Die veröffentlichte Seite lädt ihren Katalog zur Laufzeit aus dem
Repo (`main.js`, mit dem eingebauten Stand als Rückfall; lokal/Dev zählt
immer die lokale Datei). Neue Säle: Name tippen, Enter.

Der Weg ist einmal komplett durchgemessen worden (Werk auf Entwurf →
veröffentlichen → live kontrolliert → zurückgedreht): **die Wartezeit kommt
vom CDN vor `raw.githubusercontent.com` und lag bei rund drei Minuten.** Wer
sofort nachsehen will, ob eine Veröffentlichung angekommen ist, fragt nicht
die RAW-Adresse (die liefert noch den alten Stand, auch mit angehängtem
`?cb=…`), sondern die API:

```bash
curl -H "Accept: application/vnd.github.raw" \
  "https://api.github.com/repos/sundsoffice-tech/galerie-jp-showroom/contents/src/data/werke.json?ref=master"
```

Läuft nebenher eine lokale Arbeitskopie, danach `git fetch && git merge
--ff-only origin/master` — die Verwaltung committet direkt über die API,
sonst laufen lokale und veröffentlichte Fassung auseinander.

**Ohne Schlüssel** funktioniert weiter der Datei-Weg (werke.json laden →
bearbeiten → herunterladen → auf GitHub ersetzen; Fotos manuell nach
`public/werke/`). Die Verwaltungs-Seite liegt außerhalb des Builds und wird
**nie mit deployt**; der Schlüssel bleibt im Browser des Händlers.

### Was die Verwaltung kann

- **Überblick** beim Öffnen: Bestand, verfügbar/verkauft, Bestandswert — und
  „Das fehlt noch" (Werke ohne Foto/Preis/Saaltext, überbelegte Säle,
  fehlender Web3Forms-Schlüssel). Jeder Punkt springt zur betroffenen Stelle.
- **Verkauft/Verfügbar mit einem Klick** in der Werkliste — der häufigste
  Vorgang braucht keinen Editor.
- **Fotos**: Hineinziehen genügt, Handyfotos werden automatisch auf
  Galerie-Maß gebracht. In der **Foto-Werkstatt** lässt sich zuschneiden,
  um 90° drehen und schief Fotografiertes gerade rücken. Weicht das
  Seitenverhältnis von den eingetragenen Maßen ab, warnt die Verwaltung.
- **Vorschau**: der echte Showroom mit den noch unveröffentlichten Daten
  inklusive neuer Fotos — Kontrolle vor der Freigabe.
- **Entwürfe** (`sichtbar: false`): Werke vorbereiten, ohne sie zu zeigen.
- **Mehrfachauswahl** für Ausstellungswechsel: mehrere Werke auf einmal in
  einen anderen Saal, auf verkauft/verfügbar, auf Entwurf oder löschen.
- **Künstler**: Kurzbiografie je Künstler, erscheint aufklappbar im
  Werkpanel. Die Liste ergibt sich aus den Werken.
- **Reihenfolge = Hängung**: ↑/↓ ordnen die Werke an den Wänden.
- **Konfliktschutz**: Hat zwischenzeitlich jemand anders veröffentlicht,
  warnt die Verwaltung, statt fremde Änderungen zu überschreiben.
- Läuft auf dem **Handy** — vor dem Werk stehen, fotografieren, anlegen.

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
Ost-Stirnwand im letzten Saal. Die Eingangswand (West) bleibt frei — sie ist
das Entrée mit der Wortmarke, vor dem der Besucher startet. Überzählige
Werke werden mit Konsolen-Hinweis nicht gehängt.

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
2. **Sofortkauf über Stripe (fertig, nur noch Links anlegen):** Pro Werk
   einen Stripe-**Payment Link** erstellen, dabei zwingend zwei Dinge setzen:
   - **„Limit the number of payments" = 1** — der Link deaktiviert sich nach
     der ersten Zahlung selbst. Das ist der harte Doppelverkauf-Schutz für
     Unikate, garantiert von Stripe, ohne eine Zeile Servercode.
   - Als Weiterleitung nach der Zahlung die Adresse
     `https://…/galerie-jp-showroom/?erworben=<werk-id>`. **Die Verwaltung
     zeigt diese Adresse beim jeweiligen Werk fertig zum Kopieren an.**

   Link in der Verwaltung eintragen, veröffentlichen — fertig. Im Werkpanel
   und in der Sammlung erscheint dann „Sofort erwerben"; der Käufer geht im
   selben Tab zu Stripe und landet nach der Zahlung wieder in der Galerie:
   Dankesbildschirm mit Werkabbildung, Werk sofort als verkauft markiert
   (auch an der Wand), aus der Sammlung entfernt, URL aufgeräumt.
   Der Verkauf überlebt das Neuladen (lokal gespeichert); dauerhaft trägt
   die Galerie ihn ein, indem sie das Werk in der Verwaltung auf „verkauft"
   setzt und veröffentlicht.

   Für hohe Beträge im Stripe-Dashboard neben Karte auch **SEPA-Überweisung**
   als Zahlungsmethode aktivieren. Geprüft wird der ganze Weg von
   `test/stripe.mjs` (der Zahlvorgang selbst liegt bei Stripe).
3. **Stufe C (bei echtem Bedarf):** Serverless-Checkout mit dynamischer
   Session für mehrere Werke auf einmal + Webhook, der `verkauft` automatisch
   setzt. Braucht ein Hosting mit Functions (z. B. Netlify, `netlify.toml`
   liegt bereit) und ein bis zwei Tage Arbeit — erst sinnvoll, wenn Stufe B
   nachweislich zu viel Handarbeit erzeugt.

## Testen

Ein automatischer Durchlauf prüft den kompletten Kaufweg (Eintreten → Katalog →
Werk → Sammlung → Kasse → Reservierung → Saalwechsel) auf Desktop **und** im
Mobil-Viewport, inklusive Konsolenfehler:

```bash
npm run dev          # in einem Terminal
npm test             # in einem zweiten (Port ggf. in package.json anpassen)
npm run preview &    # Produktions-Build servieren …
npm run test:offline # … und den Offline-Start (Service Worker) prüfen
npm run test:live    # alles gegen die veröffentlichte Seite (inkl. offline)
```

Der Test braucht einmalig `npx playwright install chromium`. Er hat u. a.
aufgedeckt, dass die Blätter-Pfeile den „Sammlung"-Knopf überdeckten und der
Warenkorb nach einer Reservierung offen blieb — lohnt sich also vor jedem Deploy.

Enthalten ist auch ein **Datenschutz-Wächter** (`test/datenschutz.mjs`): Er
schlägt fehl, sobald die Seite irgendeine Verbindung zu einem fremden Server
aufbaut (Google Fonts, CDN, Tracker). Die Schriften werden deshalb selbst
ausgeliefert (`@fontsource`, eingebunden in `src/styles.css`) — bitte beim
Weiterbauen keine externen Einbindungen hinzufügen.

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
