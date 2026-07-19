// Katalog-Modus-Test: simuliert einen Browser OHNE 3D (WebGL deaktiviert,
// wie in manchen In-App-Browsern) und prüft, dass Ansehen, Blättern,
// Sammeln und Reservieren trotzdem vollständig funktionieren —
// ohne jeden Technik-Hinweis an den Besucher.
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5173/";

const browser = await chromium.launch({
  args: ["--disable-webgl", "--disable-webgl2"],
});
const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const fehler = [];
seite.on("pageerror", (e) => fehler.push("PAGEERROR: " + (e.stack || e.message)));

await seite.goto(URL, { waitUntil: "load", timeout: 60000 });
await seite.waitForTimeout(2800);

const schritte = [];
const pruefe = async (name, fn) => {
  try {
    const r = await fn();
    schritte.push(`  OK    ${name}${r ? " — " + r : ""}`);
  } catch (e) {
    schritte.push(`  FEHLT ${name} — ${e.message.split("\n")[0]}`);
  }
};

await pruefe("Katalog-Modus wird erkannt", async () => {
  const m = await seite.evaluate(() => window.__galerie?.modus);
  if (m !== "2d") throw new Error(`Modus ist ${m}`);
  return "modus=2d, kein Absturz";
});

await pruefe("Kein Technik-Hinweis für den Besucher", async () => {
  const text = await seite.evaluate(() => document.body.innerText);
  for (const wort of ["WebGL", "3D-Darstellung", "aktivieren", "Einstellungen"]) {
    if (text.includes(wort)) throw new Error(`Seite zeigt „${wort}"`);
  }
  return "keine Fehlermeldung sichtbar";
});

await pruefe("Eintreten öffnet den Katalog", async () => {
  await seite.click("#enter", { timeout: 5000 });
  await seite.waitForTimeout(900);
  const z = await seite.evaluate(() => ({
    katalogOffen: document.getElementById("catalog-panel").classList.contains("open"),
    werke: document.querySelectorAll(".catalog-item").length,
    navWeg: getComputedStyle(document.getElementById("room-nav")).display === "none",
  }));
  if (!z.katalogOffen) throw new Error("Katalog nicht offen");
  if (z.werke !== 12) throw new Error(`${z.werke} Werke statt 12`);
  if (!z.navWeg) throw new Error("Saal-Leiste sichtbar, obwohl es keine Säle gibt");
  return `${z.werke} Werke, Saal-Leiste ausgeblendet`;
});

await pruefe("Werk öffnet als Detailansicht", async () => {
  await seite.click(".catalog-item");
  await seite.waitForTimeout(700);
  const z = await seite.evaluate(() => ({
    offen: document.getElementById("artwork-panel").classList.contains("open"),
    titel: document.getElementById("aw-title").textContent,
    bild: !!document.getElementById("aw-bild").src,
  }));
  if (!z.offen || !z.bild) throw new Error("Panel/Abbildung fehlt");
  return z.titel;
});

await pruefe("Blättern wechselt das Werk", async () => {
  const vorher = await seite.evaluate(() => document.getElementById("aw-title").textContent);
  await seite.click("#aw-next");
  await seite.waitForTimeout(500);
  const nachher = await seite.evaluate(() => document.getElementById("aw-title").textContent);
  if (vorher === nachher) throw new Error("Titel blieb gleich");
  return `${vorher} → ${nachher}`;
});

await pruefe("Sammeln und Reservieren funktionieren", async () => {
  await seite.click("#aw-add");
  await seite.waitForTimeout(400);
  await seite.click("#cart-open");
  await seite.waitForTimeout(600);
  await seite.click("#checkout-open");
  await seite.waitForTimeout(500);
  await seite.fill('#checkout-form input[name="name"]', "Testkäufer");
  await seite.fill('#checkout-form input[name="email"]', "test@example.de");
  await seite.click('#checkout-form button[type="submit"]');
  await seite.waitForTimeout(800);
  const ok = await seite.evaluate(
    () => !document.getElementById("checkout-success-view").classList.contains("hidden")
  );
  if (!ok) throw new Error("Bestätigung erschien nicht");
  return "Reservierung bestätigt";
});

console.log(`=== KATALOG-MODUS (WebGL deaktiviert) — ${URL} ===`);
schritte.forEach((s) => console.log(s));
console.log(`=== SEITENFEHLER: ${fehler.length} ===`);
fehler.slice(0, 5).forEach((f) => console.log("  " + f));

await browser.close();
process.exit(schritte.some((s) => s.startsWith("  FEHLT")) || fehler.length ? 1 : 0);
