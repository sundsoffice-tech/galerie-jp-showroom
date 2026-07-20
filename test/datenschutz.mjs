// Datenschutz-Wächter: Die Seite darf beim Besuch KEINE Verbindung zu
// fremden Servern aufbauen (Google Fonts, CDNs, Tracker) — sonst wandert
// die IP-Adresse des Besuchers ungefragt zu Dritten (DSGVO, abmahnrelevant).
// Erlaubt ist einzig der Katalog-Abruf aus dem eigenen Projektarchiv.
// Aufruf: node test/datenschutz.mjs [url]
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5173/";
const ERLAUBT = [
  "raw.githubusercontent.com", // Live-Katalog + Werkfotos (eigenes Repo)
];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });

function hostVon(u) {
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

const eigen = hostVon(URL);
const fremd = new Map(); // host -> beispiel-url

seite.on("request", (r) => {
  const host = hostVon(r.url());
  if (!host || host === eigen) return;
  if (ERLAUBT.includes(host)) return;
  if (!fremd.has(host)) fremd.set(host, r.url());
});

// Den vollen Besuch nachstellen — auch Panels, die Bilder nachladen könnten
await seite.goto(URL, { waitUntil: "load", timeout: 60000 });
await seite.waitForTimeout(2500);
await seite.click("#enter").catch(() => {});
await seite.waitForTimeout(4200);
await seite.click("#catalog-open").catch(() => {});
await seite.waitForTimeout(1200);
await seite.locator(".catalog-item").first().click().catch(() => {});
await seite.waitForTimeout(2600);
await seite.click("#cart-open").catch(() => {});
await seite.waitForTimeout(1000);

// Zusätzlich: Steht im Quelltext noch irgendwo ein Google-Font-Verweis?
const imQuelltext = await seite.evaluate(() =>
  [...document.querySelectorAll("link, script")]
    .map((e) => e.href || e.src || "")
    .filter((u) => /fonts\.(googleapis|gstatic)|googletagmanager|google-analytics/.test(u))
);

console.log(`=== DATENSCHUTZ-PRÜFUNG — ${URL} ===`);
if (fremd.size === 0 && imQuelltext.length === 0) {
  console.log("  OK    Keine Verbindung zu fremden Servern");
  console.log(`  OK    Erlaubt und unbeanstandet: ${ERLAUBT.join(", ")}`);
} else {
  for (const [host, beispiel] of fremd) console.log(`  FREMD ${host} — ${beispiel}`);
  for (const u of imQuelltext) console.log(`  FREMD im Quelltext: ${u}`);
}

await browser.close();
process.exit(fremd.size === 0 && imQuelltext.length === 0 ? 0 : 1);
