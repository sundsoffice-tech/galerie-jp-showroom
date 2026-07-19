// Erzeugt public/og.jpg — das Link-Vorschaubild (1200×630) direkt aus der
// 3D-Szene: Saal III („Fotografie"), UI ausgeblendet, nach der Licht-Zündung.
// Aufruf:  node test/og-bild.mjs [dev-url]     (Dev-Server muss laufen)
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5173/";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const seite = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await seite.goto(URL, { waitUntil: "load", timeout: 60000 });
await seite.waitForTimeout(2500);
await seite.click("#enter");
await seite.waitForTimeout(4500); // Eintritt + Licht-Zündung abwarten

await seite.evaluate(() => {
  // in den dramatischsten Saal springen, nah an die Werkwand, leicht schräg
  window.__galerie.steuerung().teleportiere(2);
  const cam = window.__galerie.szene.camera;
  cam.position.z = -0.4; // näher an die Nordwand — Werke füllen das Bild
  cam.position.x -= 0.4;
  window.__galerie.steuerung().setzeBlick(0.09, 0.015);
  // alles außer der Szene ausblenden (Vignette bleibt — gehört zum Look)
  for (const sel of [".chrome", ".legal-links", "#saal-caption", "#hover-label"]) {
    document.querySelectorAll(sel).forEach((el) => (el.style.display = "none"));
  }
});
await seite.waitForTimeout(1200);
await seite.screenshot({ path: "public/og.jpg", type: "jpeg", quality: 82 });
console.log("public/og.jpg geschrieben (1200×630).");
await browser.close();
