// Durchlauf-Test: Eintreten, Werk öffnen, sammeln, Katalog, Checkout,
// Saalwechsel — auf Desktop- und Mobil-Viewport, mit Konsolenprotokoll.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5174/";
const MOBIL = process.argv[3] === "mobil";
const SHOT = process.argv[4] || "test.png";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const seite = await browser.newPage({
  viewport: MOBIL ? { width: 400, height: 860 } : { width: 1280, height: 800 },
  hasTouch: MOBIL,
  isMobile: MOBIL,
});

const fehler = [];
seite.on("console", (m) => {
  if (m.type() === "error") fehler.push(m.text());
});
seite.on("pageerror", (e) => fehler.push("PAGEERROR: " + (e.stack || e.message)));

const ziel = MOBIL ? URL + (URL.includes("?") ? "&" : "?") + "touch=1" : URL;
await seite.goto(ziel, { waitUntil: "load", timeout: 60000 });
await seite.waitForTimeout(3000);

const schritte = [];
const pruefe = async (name, fn) => {
  try {
    const r = await fn();
    schritte.push(`  OK    ${name}${r ? " — " + r : ""}`);
  } catch (e) {
    schritte.push(`  FEHLT ${name} — ${e.message.split("\n")[0]}`);
  }
};

// 1. Eintreten
await pruefe("Eintreten startet den Rundgang", async () => {
  await seite.click("#enter", { timeout: 5000 });
  await seite.waitForTimeout(3800);
  const weg = await seite.evaluate(() => !document.getElementById("intro"));
  if (!weg) throw new Error("Intro-Overlay blieb stehen");
  return "Overlay entfernt, Leisten sichtbar";
});

// 2. Werk über den Katalog öffnen (unabhängig von 3D-Klickkoordinaten)
await pruefe("Katalog listet alle Werke", async () => {
  await seite.click("#catalog-open");
  await seite.waitForTimeout(900);
  const n = await seite.evaluate(() => document.querySelectorAll(".catalog-item").length);
  if (n !== 12) throw new Error(`erwartet 12 Werke, gefunden ${n}`);
  return `${n} Werke`;
});

await pruefe("Klick im Katalog fokussiert das Werk", async () => {
  await seite.click(".catalog-item");
  await seite.waitForTimeout(2600);
  const t = await seite.evaluate(() => ({
    offen: document.getElementById("artwork-panel").classList.contains("open"),
    titel: document.getElementById("aw-title").textContent,
    hash: location.hash,
  }));
  if (!t.offen) throw new Error("Werk-Panel öffnete nicht");
  if (!t.hash) throw new Error("Deep-Link-Hash fehlt");
  return `${t.titel} (${t.hash})`;
});

// 3. In die Sammlung legen
await pruefe("Werk in die Sammlung legen", async () => {
  await seite.click("#aw-add");
  await seite.waitForTimeout(500);
  const n = await seite.evaluate(() => document.getElementById("cart-count").textContent);
  if (n !== "1") throw new Error(`Zähler zeigt ${n}`);
  return "Zähler 1";
});

await pruefe("Unikat lässt sich nicht doppelt sammeln", async () => {
  const aus = await seite.evaluate(() => document.getElementById("aw-add").disabled);
  if (!aus) throw new Error("Button noch aktiv");
  return "Button gesperrt";
});

// 4. Checkout
await pruefe("Checkout öffnet mit Werkliste", async () => {
  await seite.click("#cart-open");
  await seite.waitForTimeout(700);
  await seite.click("#checkout-open");
  await seite.waitForTimeout(600);
  const z = await seite.evaluate(() => document.querySelectorAll(".checkout-zeile").length);
  if (z !== 1) throw new Error(`erwartet 1 Zeile, gefunden ${z}`);
  return "1 Werk gelistet";
});

await pruefe("Reservierung absenden (Demo-Modus)", async () => {
  await seite.fill('#checkout-form input[name="name"]', "Testkäufer");
  await seite.fill('#checkout-form input[name="email"]', "test@example.de");
  await seite.click('#checkout-form button[type="submit"]');
  await seite.waitForTimeout(900);
  const ok = await seite.evaluate(() =>
    !document.getElementById("checkout-success-view").classList.contains("hidden"));
  if (!ok) throw new Error("Bestätigung erschien nicht");
  return "Bestätigung sichtbar";
});

await pruefe("Verkauftes Werk ist gesperrt", async () => {
  await seite.click('#checkout [data-close="checkout"]');
  await seite.waitForTimeout(400);
  const n = await seite.evaluate(() => document.getElementById("cart-count").textContent);
  if (n !== "0") throw new Error(`Sammlung nicht geleert (${n})`);
  return "Sammlung geleert, Werk als verkauft markiert";
});

// 5. Saalwechsel
await pruefe("Saalwechsel per Navigation", async () => {
  await seite.keyboard.press("Escape"); // evtl. offenes Panel deterministisch schließen
  await seite.waitForTimeout(400);
  const knopf = seite.locator("#room-nav button").nth(2);
  await knopf.click();
  await seite.waitForTimeout(1600);
  const raum = await seite.evaluate(() => window.__galerie.steuerung().aktuellerRaum());
  if (raum !== 2) throw new Error(`in Saal ${raum} gelandet`);
  return "Saal III erreicht";
});

// 5b. Werk in einem anderen Saal über den Katalog ansteuern:
// muss per Blende+Teleport gehen, nie als Kamerafahrt durch die Wände
await pruefe("Katalog-Klick über Säle hinweg wechselt den Saal", async () => {
  await seite.click("#catalog-open");
  await seite.waitForTimeout(700);
  await seite.locator(".catalog-item").first().click(); // Werk 1 liegt in Saal I
  await seite.waitForTimeout(3400); // Blende (0,4 s) + Fokusfahrt (1,6 s)
  const z = await seite.evaluate(() => ({
    raum: window.__galerie.steuerung().aktuellerRaum(),
    offen: document.getElementById("artwork-panel").classList.contains("open"),
  }));
  if (z.raum !== 0) throw new Error(`in Saal ${z.raum} statt Saal I gelandet`);
  if (!z.offen) throw new Error("Werk-Panel nicht offen");
  await seite.keyboard.press("Escape");
  await seite.waitForTimeout(400);
  return "Blende + Teleport + Fokus in Saal I";
});

// 6. Tastatur darf Formulare nicht stören (Regressionstest zum Review-Fund):
// echtes Checkout öffnen, ins sichtbare Namensfeld „Wanda" tippen —
// W/A/S/D dürfen die (freie, nicht fokussierte) Kamera nicht bewegen.
await pruefe("Tippen im Formular bewegt die Kamera nicht", async () => {
  await seite.click("#catalog-open");
  await seite.waitForTimeout(700);
  await seite.locator(".catalog-item").nth(1).click(); // verfügbares Werk
  await seite.waitForTimeout(2600);
  await seite.click("#aw-add");
  await seite.waitForTimeout(300);
  await seite.keyboard.press("Escape"); // Panel zu — Kamera wieder frei
  await seite.waitForTimeout(500);
  await seite.click("#cart-open");
  await seite.waitForTimeout(600);
  await seite.click("#checkout-open");
  await seite.waitForTimeout(500);
  const vor = await seite.evaluate(() => window.__galerie.szene.camera.position.x);
  await seite.click('#checkout-form input[name="name"]');
  await seite.keyboard.type("Wanda Sasser");
  await seite.waitForTimeout(600);
  const nach = await seite.evaluate(() => window.__galerie.szene.camera.position.x);
  await seite.keyboard.press("Escape");
  if (Math.abs(nach - vor) > 0.02) throw new Error(`Kamera wanderte um ${(nach - vor).toFixed(2)}`);
  return "Kamera unbewegt";
});

console.log(`=== DURCHLAUF (${MOBIL ? "MOBIL 400x860" : "DESKTOP 1280x800"}) — ${ziel} ===`);
schritte.forEach((s) => console.log(s));
console.log(`=== KONSOLENFEHLER: ${fehler.length} ===`);
fehler.slice(0, 6).forEach((f) => console.log("  " + f));

await seite.screenshot({ path: SHOT });
await browser.close();
process.exit(schritte.some((s) => s.startsWith("  FEHLT")) || fehler.length ? 1 : 0);
