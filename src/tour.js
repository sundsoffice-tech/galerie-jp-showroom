// Privatführung — die Galerie führt selbst: Kamerafahrt von Werk zu Werk
// in Hänge-Reihenfolge (Saal für Saal), mit Saaltext zum Mitlesen.
// Beim ersten Eingriff des Besuchers (Ziehen, Taste, Schließen) übergibt
// die Führung sofort und ohne Bruch an ihn.

const WERK_DAUER = 7.5; // Sekunden Verweildauer pro Werk

export function erstelleTour({ steuerung, kunstwerke, ui }) {
  let aktiv = false;
  let index = -1;
  let naechsterWechsel = 0;

  function reihenfolge() {
    return [...kunstwerke.keys()]; // Map hält die Hänge-Reihenfolge
  }

  function starte() {
    const ids = reihenfolge();
    if (!ids.length) return;
    aktiv = true;
    index = -1;
    naechsterWechsel = 0; // sofort zum ersten Werk
    ui.melde?.("Führung gestartet — jede Berührung übernimmt die Kontrolle.");
  }

  function stoppe(still = false) {
    if (!aktiv) return;
    aktiv = false;
    if (!still) ui.melde?.("Führung beendet — Sie haben die Galerie für sich.");
  }

  // im Render-Loop; nutzt Echtzeit, damit Tab-Wechsel nichts verschluckt
  function update() {
    if (!aktiv) return;
    const jetzt = performance.now() / 1000;
    if (jetzt < naechsterWechsel) return;
    const ids = reihenfolge();
    index++;
    if (index >= ids.length) {
      stoppe(true);
      ui.schliesseWerkPanel();
      ui.zeigeSaalTitel({ saal: "", name: "Ende der Führung", beschreibung: "Sehen Sie sich frei um — jedes Werk ist direkt erwerbbar." });
      return;
    }
    naechsterWechsel = jetzt + WERK_DAUER;
    steuerung.fokussiere(ids[index]);
  }

  return { starte, stoppe, update, istAktiv: () => aktiv };
}
