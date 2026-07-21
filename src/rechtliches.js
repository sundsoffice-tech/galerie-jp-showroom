// ————————————————————————————————————————————————
// Rechtstexte — aus den Angaben der Galerie zusammengesetzt.
//
// Der Händler soll keine Rechtsprosa schreiben müssen: Er trägt in der
// Verwaltung Anschrift, Kontakt und Steuernummer ein, alles Weitere setzt
// sich daraus zusammen. Die Datenschutzerklärung beschreibt dabei genau
// das, was diese Seite wirklich tut — und passt sich an, ob Reservierungen
// per Web3Forms laufen und ob Stripe-Zahlungslinks hinterlegt sind.
//
// Das ist eine sorgfältige Vorlage, kein Rechtsrat: Vor dem Go-Live gehört
// sie einmal von einer Anwältin oder dem Händlerverband gegengelesen.
// ————————————————————————————————————————————————

const FEHLT = "…";

function zeile(wert) {
  return (wert || "").trim();
}

/** Sind genug Angaben da, dass ein gültiges Impressum entsteht? */
export function rechtlichesVollstaendig(galerie) {
  const r = galerie?.rechtliches || {};
  return Boolean(
    zeile(galerie?.name) &&
      zeile(r.inhaber) &&
      zeile(r.strasse) &&
      zeile(r.plz) &&
      zeile(r.ort) &&
      zeile(galerie?.email)
  );
}

/** Welche Pflichtangaben fehlen noch? Für den Überblick in der Verwaltung. */
export function fehlendeAngaben(galerie) {
  const r = galerie?.rechtliches || {};
  const fehlt = [];
  if (!zeile(galerie?.name)) fehlt.push("Name der Galerie");
  if (!zeile(r.inhaber)) fehlt.push("Inhaber:in / Vertretungsberechtigte:r");
  if (!zeile(r.strasse)) fehlt.push("Straße und Hausnummer");
  if (!zeile(r.plz) || !zeile(r.ort)) fehlt.push("PLZ und Ort");
  if (!zeile(galerie?.email)) fehlt.push("Kontakt-E-Mail");
  return fehlt;
}

function anschrift(galerie) {
  const r = galerie.rechtliches || {};
  return [
    zeile(galerie.name) || FEHLT,
    zeile(r.inhaber) || FEHLT,
    zeile(r.strasse) || FEHLT,
    [zeile(r.plz), zeile(r.ort)].filter(Boolean).join(" ") || FEHLT,
    zeile(r.land) || "Deutschland",
  ].join("\n");
}

export function impressumText(galerie) {
  const r = galerie.rechtliches || {};
  const teile = ["Angaben gemäß § 5 DDG\n\n" + anschrift(galerie)];

  const kontakt = ["\nKontakt"];
  if (zeile(r.telefon)) kontakt.push("Telefon: " + zeile(r.telefon));
  kontakt.push("E-Mail: " + (zeile(galerie.email) || FEHLT));
  teile.push(kontakt.join("\n"));

  const amt = [];
  if (zeile(r.ustId)) amt.push("Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG:\n" + zeile(r.ustId));
  if (zeile(r.register)) amt.push("Registereintrag:\n" + zeile(r.register));
  if (zeile(r.aufsicht)) amt.push("Zuständige Aufsichtsbehörde:\n" + zeile(r.aufsicht));
  if (amt.length) teile.push("\n" + amt.join("\n\n"));

  teile.push(
    "\nVerantwortlich für den Inhalt nach § 18 Abs. 2 MStV\n" +
      (zeile(r.inhaber) || FEHLT) +
      ", Anschrift wie oben."
  );

  teile.push(
    "\nStreitbeilegung\nDie Europäische Kommission stellt eine Plattform zur " +
      "Online-Streitbeilegung bereit: https://ec.europa.eu/consumers/odr\n" +
      "Wir sind nicht verpflichtet und nicht bereit, an einem " +
      "Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle " +
      "teilzunehmen."
  );

  if (zeile(r.zusatz)) teile.push("\n" + zeile(r.zusatz));
  return teile.join("\n");
}

export function datenschutzText(galerie, werke = []) {
  const r = galerie.rechtliches || {};
  const mitFormular = Boolean(zeile(galerie.web3formsKey));
  const mitStripe = werke.some((w) => zeile(w.stripeLink));
  const t = [];

  t.push(
    "Verantwortlich für die Datenverarbeitung auf dieser Seite\n\n" +
      anschrift(galerie) +
      "\nE-Mail: " +
      (zeile(galerie.email) || FEHLT)
  );

  t.push(
    "\nWas beim bloßen Besuch passiert\n" +
      "Diese Seite setzt keine Cookies, bindet keine Werbe- oder Analysedienste " +
      "ein und lädt keine Schriften von fremden Servern — alle Schriften " +
      "liefern wir selbst aus. Es findet kein Tracking statt."
  );

  t.push(
    "\nHosting\n" +
      "Die Seite wird auf GitHub Pages gehostet (GitHub Inc., 88 Colin P. " +
      "Kelly Jr. Street, San Francisco, CA 94107, USA). Beim Abruf " +
      "verarbeitet GitHub technisch notwendige Verbindungsdaten, darunter " +
      "Ihre IP-Adresse, um die Seite ausliefern zu können. Rechtsgrundlage " +
      "ist unser berechtigtes Interesse am sicheren und stabilen Betrieb " +
      "(Art. 6 Abs. 1 lit. f DSGVO). Die Übermittlung in die USA stützt sich " +
      "auf die Zertifizierung nach dem EU-US Data Privacy Framework. " +
      "Aus demselben Netzwerk (raw.githubusercontent.com) lädt die Seite " +
      "beim Aufruf ihren Werkkatalog und die Werkfotos nach."
  );

  t.push(
    "\nIhre Sammlung\n" +
      "Wenn Sie Werke in Ihre Sammlung legen, merkt sich das ausschließlich " +
      "Ihr eigener Browser (localStorage). Diese Angaben verlassen Ihr Gerät " +
      "nicht und werden von uns nicht ausgelesen. Sie können sie jederzeit " +
      "löschen, indem Sie die Websitedaten in Ihrem Browser entfernen."
  );

  if (mitFormular) {
    t.push(
      "\nReservierungsanfragen\n" +
        "Senden Sie eine Reservierung ab, übermitteln wir Ihre Angaben (Name, " +
        "E-Mail-Adresse, optional Telefonnummer und Nachricht) über den " +
        "Formulardienst Web3Forms (Nexta LLC) per E-Mail an uns. Wir " +
        "verarbeiten sie ausschließlich, um Ihre Anfrage zu bearbeiten " +
        "(Art. 6 Abs. 1 lit. b DSGVO). Wir bewahren die Anfrage so lange auf, " +
        "wie es für die Bearbeitung und etwaige gesetzliche " +
        "Aufbewahrungsfristen erforderlich ist."
    );
  } else {
    t.push(
      "\nReservierungsanfragen\n" +
        "Der Reservierungsweg dieser Seite ist derzeit nicht aktiv; es werden " +
        "keine Formulardaten übermittelt."
    );
  }

  if (mitStripe) {
    t.push(
      "\nZahlungen\n" +
        "Wählen Sie „Sofort erwerben“, werden Sie zu unserem Zahlungsdienst " +
        "Stripe weitergeleitet (Stripe Payments Europe Ltd., 1 Grand Canal " +
        "Street Lower, Dublin, Irland). Erst dort geben Sie Ihre Zahlungs- " +
        "und Rechnungsdaten ein; sie werden von Stripe in eigener " +
        "Verantwortung verarbeitet, um den Kauf abzuwickeln (Art. 6 Abs. 1 " +
        "lit. b DSGVO). Wir selbst erhalten keine vollständigen " +
        "Zahlungsdaten. Es gilt zusätzlich die Datenschutzerklärung von " +
        "Stripe: https://stripe.com/de/privacy"
    );
  }

  t.push(
    "\nIhre Rechte\n" +
      "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, " +
      "Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. " +
      "Wenden Sie sich dafür an die oben genannte Adresse. Außerdem können " +
      "Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren" +
      (zeile(r.aufsichtDatenschutz) ? ", zuständig ist " + zeile(r.aufsichtDatenschutz) : "") +
      "."
  );

  t.push("\nStand dieser Erklärung: " + (zeile(r.stand) || heute()));
  return t.join("\n");
}

export function kontaktText(galerie) {
  const r = galerie.rechtliches || {};
  const zeilen = ["Wir freuen uns auf Ihre Nachricht.\n"];
  if (zeile(galerie.email)) zeilen.push("E-Mail: " + zeile(galerie.email));
  if (zeile(r.telefon)) zeilen.push("Telefon: " + zeile(r.telefon));
  if (zeile(r.strasse)) {
    zeilen.push(
      "\n" + zeile(galerie.name) + "\n" + zeile(r.strasse) + "\n" +
        [zeile(r.plz), zeile(r.ort)].filter(Boolean).join(" ")
    );
  }
  if (zeile(r.oeffnungszeiten)) zeilen.push("\n" + zeile(r.oeffnungszeiten));
  zeilen.push("\nBesichtigungen einzelner Werke sind nach Vereinbarung jederzeit möglich.");
  return zeilen.join("\n");
}

function heute() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
