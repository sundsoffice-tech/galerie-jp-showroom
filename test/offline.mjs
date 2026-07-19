// Offline-Test der installierbaren App: Erstbesuch füllt den Cache
// (Service Worker), danach muss die Galerie OHNE Netz starten.
// Aufruf: node test/offline.mjs [url]
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5173/";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const kontext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const seite = await kontext.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(e.message));

// 1. Erstbesuch: Service Worker installieren, Assets in den Cache
await seite.goto(URL, { waitUntil: "load", timeout: 60000 });
await seite.waitForTimeout(2500);
const sw = await seite.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return "nicht unterstützt";
  const reg = await navigator.serviceWorker.ready;
  return reg.active ? "aktiv" : "nicht aktiv";
});
console.log("Service Worker:", sw);
await seite.waitForTimeout(4000); // Vorwärmen des Caches abwarten

// 2. Netz kappen und neu laden
await kontext.setOffline(true);
await seite.reload({ waitUntil: "load", timeout: 60000 }).catch(() => {});
await seite.waitForTimeout(3500);

const z = await seite.evaluate(() => ({
  galerieDa: !!window.__galerie,
  modus: window.__galerie?.modus,
  datenquelle: window.__galerie?.datenquelle,
  enterDa: !!document.getElementById("enter"),
}));
console.log(JSON.stringify(z, null, 2));
console.log("Seitenfehler:", fehler.length);

const ok = sw === "aktiv" && z.galerieDa && z.enterDa && z.datenquelle === "bundle";
console.log(ok ? "OFFLINE-START: OK — Galerie läuft ohne Netz" : "OFFLINE-START: FEHLGESCHLAGEN");
await browser.close();
process.exit(ok ? 0 : 1);
