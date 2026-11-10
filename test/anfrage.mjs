// Anfrage per Mail („Unverbindlich anfragen") — der Verweis darf nur
// existieren, wenn er ein Ziel hat: ohne gepflegte Galerie-Adresse steht er
// gar nicht im Dokument (kein toter Verweis), mit Adresse zeigt er als
// mailto: auf die Galerie und nennt das Werk im Betreff.
// Die Adresse kommt über den Vorschau-Weg der Verwaltung (?vorschau=1) —
// derselbe Weg, auf dem der Händler seine Angaben vor dem Veröffentlichen sieht.
// Aufruf: node test/anfrage.mjs [url]
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const URL_BASIS = process.argv[2] || "http://localhost:5173/";
const ADRESSE = "probe@example.org"; // wird nie angeschrieben

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const fehler = [];
const schritte = [];
const pruefe = async (name, fn) => {
  try {
    const r = await fn();
    schritte.push(`  OK    ${name}${r ? " — " + r : ""}`);
  } catch (e) {
    schritte.push(`  FEHLT ${name} — ${e.message.split("\n")[0]}`);
  }
};

async function oeffneWerk(seite) {
  await seite.waitForTimeout(2500);
  await seite.click("#enter");
  await seite.waitForTimeout(4200);
  await seite.click("#catalog-open");
  await seite.waitForTimeout(700);
  await seite.locator(".catalog-item").nth(1).click();
  await seite.waitForTimeout(2600);
}

// ————— 1. Ohne Adresse: kein Verweis, auch nicht versteckt —————
{
  const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  seite.on("pageerror", (e) => fehler.push(e.message));
  await seite.goto(URL_BASIS, { waitUntil: "load", timeout: 60000 });

  await pruefe("Ausgeliefertes HTML enthält keinen Verweis ohne Ziel", async () => {
    const html = await (await seite.request.get(URL_BASIS)).text();
    const tot = html.match(/<a\b(?![^>]*\bhref="(?!#?")[^"]+")[^>]*>/g) || [];
    if (tot.length) throw new Error(`${tot.length} Verweis(e) ohne Ziel: ${tot[0]}`);
    return "kein <a> ohne href oder mit href=\"#\"";
  });

  await oeffneWerk(seite);
  // Der eingebaute Katalog entscheidet, was hier richtig ist: Pflegt die Galerie ihre
  // Adresse in src/data/werke.json, muss der Verweis da sein und ein mailto:-Ziel haben.
  const katalog = JSON.parse(await readFile(new URL("../src/data/werke.json", import.meta.url), "utf8"));
  const gepflegt = String(katalog?.galerie?.email || "").trim();
  await pruefe(gepflegt
    ? "Mit gepflegter Galerie-Adresse hat der Anfrage-Verweis ein mailto:-Ziel"
    : "Ohne Galerie-Adresse steht kein Anfrage-Verweis im Dokument", async () => {
    const ziel = await seite.evaluate(() => document.getElementById("aw-inquiry")?.getAttribute("href") ?? null);
    if (gepflegt) {
      if (!ziel || !ziel.startsWith("mailto:")) throw new Error(`Adresse gepflegt, Verweis fehlt oder ohne mailto: (${ziel})`);
      return "vorhanden mit mailto:";
    }
    if (ziel !== null) throw new Error("Verweis vorhanden, obwohl keine Adresse gepflegt ist");
    return "korrekt abwesend";
  });
  await seite.close();
}

// ————— 2. Mit Adresse: Verweis mit Ziel, vor „Link kopieren" —————
{
  const daten = JSON.parse(
    await readFile(new URL("../src/data/werke.json", import.meta.url), "utf8")
  );
  daten.galerie.email = ADRESSE;

  const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  seite.on("pageerror", (e) => fehler.push(e.message));
  // Die Galerie meldet sich im Vorschau-Modus bereit und wartet auf den Katalog
  await seite.addInitScript((katalog) => {
    window.addEventListener("message", (e) => {
      if (e.data?.typ === "galerie-vorschau-bereit") {
        window.postMessage({ typ: "galerie-vorschau", daten: katalog }, "*");
      }
    });
  }, daten);
  const ziel = URL_BASIS + (URL_BASIS.includes("?") ? "&" : "?") + "vorschau=1";
  await seite.goto(ziel, { waitUntil: "load", timeout: 60000 });
  await oeffneWerk(seite);

  await pruefe("Mit Galerie-Adresse erscheint der Anfrage-Verweis mit Ziel", async () => {
    const v = await seite.evaluate(() => {
      const a = document.getElementById("aw-inquiry");
      if (!a) return null;
      const kasten = a.getBoundingClientRect();
      return {
        tag: a.tagName,
        href: a.getAttribute("href"),
        text: a.textContent,
        klasse: a.className,
        vorTeilen: a.nextElementSibling?.id === "aw-share",
        sichtbar: kasten.width > 0 && kasten.height > 0,
        titel: document.getElementById("aw-title").textContent,
      };
    });
    if (!v) throw new Error("Verweis fehlt trotz gepflegter Adresse");
    if (v.tag !== "A") throw new Error(`falsches Element: ${v.tag}`);
    if (!v.href.startsWith(`mailto:${ADRESSE}?subject=`)) throw new Error(`falsches Ziel: ${v.href}`);
    const betreff = decodeURIComponent(v.href.split("subject=")[1]);
    if (!betreff.includes(v.titel)) throw new Error(`Betreff ohne Werktitel: ${betreff}`);
    if (v.text !== "Unverbindlich anfragen") throw new Error(`falscher Text: ${v.text}`);
    if (v.klasse !== "aw-textlink") throw new Error(`falsche Klasse: ${v.klasse}`);
    if (!v.vorTeilen) throw new Error("steht nicht vor „Link kopieren“");
    if (!v.sichtbar) throw new Error("nicht sichtbar");
    return `${v.href.slice(0, 60)}…`;
  });

  await pruefe("Beim Blättern bleibt es ein Verweis, der Betreff folgt dem Werk", async () => {
    const vorher = await seite.evaluate(() => document.getElementById("aw-inquiry").href);
    await seite.click("#aw-next");
    await seite.waitForTimeout(2600);
    const v = await seite.evaluate(() => ({
      anzahl: document.querySelectorAll("#aw-inquiry").length,
      href: document.getElementById("aw-inquiry")?.href || "",
      titel: document.getElementById("aw-title").textContent,
    }));
    if (v.anzahl !== 1) throw new Error(`${v.anzahl} Anfrage-Verweise statt einem`);
    if (v.href === vorher) throw new Error("Betreff nennt noch das vorige Werk");
    if (!decodeURIComponent(v.href).includes(v.titel)) throw new Error("Betreff ohne neuen Werktitel");
    return v.titel;
  });
  await seite.close();
}

await browser.close();

console.log(`=== ANFRAGE-PRÜFUNG — ${URL_BASIS} ===`);
schritte.forEach((s) => console.log(s));
if (fehler.length) {
  console.log("SEITENFEHLER:");
  fehler.forEach((f) => console.log("  " + f));
}
const ok = schritte.every((s) => s.includes(" OK ")) && fehler.length === 0;
console.log(ok ? "ERGEBNIS: bestanden" : "ERGEBNIS: nicht bestanden");
process.exit(ok ? 0 : 1);
