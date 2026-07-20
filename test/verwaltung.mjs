// Verwaltung — prüft die Pflege-Oberfläche ohne GitHub-Zugang:
// Katalog per Datei laden, Werk anlegen, Foto aufbereiten lassen, Zustand
// umschalten, Überblick, und am Ende eine gültige werke.json herunterladen.
// Aufruf: node test/verwaltung.mjs [basis-url]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASIS = process.argv[2] || "http://localhost:5173/";
const SEITE = BASIS.replace(/\/$/, "") + "/verwaltung.html";

const browser = await chromium.launch();
const seite = await browser.newPage({
  viewport: { width: 1400, height: 950 },
  acceptDownloads: true,
});
const fehler = [];
const dialoge = [];
seite.on("pageerror", (e) => fehler.push(e.message));
seite.on("dialog", (d) => {
  dialoge.push(d.message());
  d.accept();
});

const schritte = [];
const pruefe = async (name, fn) => {
  try {
    const r = await fn();
    schritte.push(`  OK    ${name}${r ? " — " + r : ""}`);
  } catch (e) {
    schritte.push(`  FEHLT ${name} — ${e.message.split("\n")[0]}`);
  }
};

await seite.goto(SEITE, { waitUntil: "load", timeout: 60000 });
await seite.waitForTimeout(800);

await pruefe("Katalog per Datei laden", async () => {
  await seite.setInputFiles("#datei", "src/data/werke.json");
  await seite.waitForTimeout(900);
  const n = await seite.evaluate(() => document.querySelectorAll(".werk-karte").length);
  if (n !== 12) throw new Error(`${n} Werke statt 12`);
  return `${n} Werke`;
});

await pruefe("Überblick zeigt Kennzahlen und Bestandswert", async () => {
  const k = await seite.evaluate(() =>
    [...document.querySelectorAll(".kachel")].map((e) => e.textContent)
  );
  if (k.length !== 4) throw new Error(`${k.length} Kacheln`);
  if (!k.some((t) => /€/.test(t))) throw new Error("kein Bestandswert");
  return k.join(" · ").replace(/\s+/g, " ");
});

await pruefe("Offene Punkte werden benannt", async () => {
  const p = await seite.evaluate(() =>
    [...document.querySelectorAll(".offener-punkt")].map((e) => e.textContent)
  );
  if (!p.length) throw new Error("keine offenen Punkte erkannt (12 Werke ohne Foto erwartet)");
  if (!p.some((t) => /ohne Foto/.test(t))) throw new Error("Werke ohne Foto nicht gemeldet");
  return `${p.length} Punkte, u. a. „${p[0].slice(0, 42)}…"`;
});

await pruefe("Verkauft/Verfügbar direkt in der Liste umschalten", async () => {
  const schalter = seite.locator(".badge.schalter").first();
  const vorher = await schalter.textContent();
  await schalter.click();
  await seite.waitForTimeout(400);
  const nachher = await seite.locator(".badge.schalter").first().textContent();
  if (vorher === nachher) throw new Error(`blieb auf „${vorher}"`);
  await seite.locator(".badge.schalter").first().click(); // zurücksetzen
  await seite.waitForTimeout(300);
  return `${vorher.trim()} → ${nachher.trim()} (ein Klick)`;
});

await pruefe("Künstler-Vorschläge gegen Schreibvarianten", async () => {
  const n = await seite.evaluate(
    () => document.querySelectorAll("#kuenstler-liste option").length
  );
  if (n < 4) throw new Error(`nur ${n} Vorschläge`);
  return `${n} Künstler vorgeschlagen`;
});

await pruefe("Neues Werk: Foto wird automatisch aufbereitet", async () => {
  await seite.click("#werk-neu");
  await seite.waitForTimeout(400);
  // Großes Testfoto erzeugen (3000×2000) — muss verkleinert werden
  const gross = await seite.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 3000;
    c.height = 2000;
    const x = c.getContext("2d");
    x.fillStyle = "#8a6d3d";
    x.fillRect(0, 0, 3000, 2000);
    x.fillStyle = "#1d1b18";
    x.fillRect(400, 300, 2200, 1400);
    return c.toDataURL("image/jpeg", 0.95);
  });
  const puffer = Buffer.from(gross.split(",")[1], "base64");
  await seite.setInputFiles("#bild-datei", {
    name: "handyfoto.jpg",
    mimeType: "image/jpeg",
    buffer: puffer,
  });
  await seite.waitForTimeout(1500);
  const z = await seite.evaluate(() => ({
    name: document.getElementById("bild-name").textContent,
    breite: document.getElementById("e-breite").value,
    hoehe: document.getElementById("e-hoehe").value,
  }));
  const px = /(\d+)×(\d+) px/.exec(z.name);
  if (!px) throw new Error(`keine Maßangabe: „${z.name}"`);
  if (+px[1] > 2000) throw new Error(`nicht verkleinert: ${px[1]} px`);
  if (!(+z.breite > 0 && +z.hoehe > 0)) throw new Error("Maße nicht übernommen");
  return `${puffer.length / 1024 | 0} KB Original → ${z.name.split("·").pop().trim()}, Maße ${z.breite}×${z.hoehe} cm vorgeschlagen`;
});

await pruefe("Werk speichern und herunterladen ergibt gültige Datei", async () => {
  await seite.fill("#e-titel", "Testwerk");
  await seite.fill("#e-kuenstler", "Mara Weidenfeld");
  await seite.fill("#e-technik", "Öl auf Leinwand");
  await seite.fill("#e-preis", "4200");
  await seite.click("#editor-ok");
  await seite.waitForTimeout(600);
  const n = await seite.evaluate(() => document.querySelectorAll(".werk-karte").length);
  if (n !== 13) throw new Error(`${n} Werke nach dem Anlegen`);
  // Der Datei-Weg liegt im aufklappbaren Bereich „Ohne Schlüssel"
  await seite.evaluate(() => {
    document.getElementById("download").closest("details").open = true;
  });
  await seite.waitForTimeout(300);
  const download = seite.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await seite.click("#download");
  const datei = await download;
  if (!datei) {
    throw new Error(
      "kein Download ausgelöst" + (dialoge.length ? ` — Dialog: „${dialoge.at(-1)}"` : "")
    );
  }
  const pfad = await datei.path();
  const inhalt = JSON.parse(readFileSync(pfad, "utf8"));
  if (inhalt.werke.length !== 13) throw new Error("Datei enthält nicht alle Werke");
  const neu = inhalt.werke.find((w) => w.titel === "Testwerk");
  if (!neu?.bild) throw new Error("Foto nicht am Werk hinterlegt");
  return `13 Werke, neues Werk mit Foto „${neu.bild}"`;
});

await pruefe("Foto-Werkstatt schneidet zu und dreht", async () => {
  await seite.locator('.werk-karte button:text-is("Bearbeiten")').first().click();
  await seite.waitForTimeout(500);
  // Foto anlegen, damit es etwas zu schneiden gibt
  const bild = await seite.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1600; c.height = 1200;
    const x = c.getContext("2d");
    x.fillStyle = "#333"; x.fillRect(0, 0, 1600, 1200);
    x.fillStyle = "#c2a36b"; x.fillRect(300, 200, 1000, 800);
    return c.toDataURL("image/jpeg", 0.9);
  });
  await seite.setInputFiles("#bild-datei", {
    name: "schief.jpg", mimeType: "image/jpeg",
    buffer: Buffer.from(bild.split(",")[1], "base64"),
  });
  await seite.waitForTimeout(1200);
  await seite.click("#bild-bearbeiten");
  await seite.waitForTimeout(800);
  const offen = await seite.evaluate(() => document.getElementById("foto-editor").open);
  if (!offen) throw new Error("Werkstatt öffnete nicht");
  // Drehen und Rahmen verkleinern
  await seite.click("#drehen-rechts");
  await seite.waitForTimeout(400);
  const griff = seite.locator('.griff[data-ecke="se"]');
  const box = await griff.boundingBox();
  await seite.mouse.move(box.x + 11, box.y + 11);
  await seite.mouse.down();
  await seite.mouse.move(box.x - 120, box.y - 90, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(300);
  const vorher = await seite.evaluate(() => document.getElementById("bild-name").textContent);
  await seite.click("#zuschnitt-ok");
  await seite.waitForTimeout(900);
  const nachher = await seite.evaluate(() => ({
    name: document.getElementById("bild-name").textContent,
    zu: !document.getElementById("foto-editor").open,
  }));
  if (!nachher.zu) throw new Error("Werkstatt blieb offen");
  if (nachher.name === vorher) throw new Error("Foto unverändert");
  return `${vorher.split("·")[1]?.trim()} → ${nachher.name.split("·")[1]?.trim()} (gedreht + zugeschnitten)`;
});

await pruefe("Vorschau zeigt den Showroom mit den eigenen Daten", async () => {
  await seite.click("#editor-abbrechen");
  await seite.waitForTimeout(400);
  await seite.click("#vorschau-oeffnen");
  await seite.waitForTimeout(7000); // Showroom im Rahmen aufbauen lassen
  const rahmen = seite.frameLocator("#vorschau-rahmen");
  const marke = await rahmen.locator("#vorschau-marke").textContent({ timeout: 10000 });
  const quelle = await seite.evaluate(
    () => document.getElementById("vorschau-rahmen").contentWindow.__galerie?.datenquelle
  );
  if (quelle !== "vorschau") throw new Error(`Datenquelle im Rahmen: ${quelle}`);
  await seite.click("#vorschau-schliessen");
  return `„${marke.trim()}", Daten aus der Verwaltung`;
});

console.log(`=== VERWALTUNG — ${SEITE} ===`);
schritte.forEach((s) => console.log(s));
console.log(`=== SEITENFEHLER: ${fehler.length} ===`);
fehler.slice(0, 5).forEach((f) => console.log("  " + f));

await browser.close();
process.exit(schritte.some((s) => s.startsWith("  FEHLT")) || fehler.length ? 1 : 0);
