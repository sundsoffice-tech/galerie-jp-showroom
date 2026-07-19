// Erzeugt die App-Icons (public/icon-512.png, icon-192.png,
// apple-touch-icon.png) aus dem Marken-Monogramm — ohne Bild-Assets.
import { chromium } from "playwright";

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; }
  .icon {
    width: 512px; height: 512px;
    display: grid; place-items: center;
    background: radial-gradient(circle at 50% 38%, #1a150f 0%, #0c0b09 78%);
    font-family: Georgia, serif;
  }
  .rahmen {
    width: 400px; height: 400px;
    border: 7px solid #c2a36b;
    display: grid; place-items: center;
  }
  .g {
    font-size: 250px; line-height: 1;
    color: #d8bc85; transform: translateY(-12px);
  }
</style>
<div class="icon"><div class="rahmen"><div class="g">G</div></div></div>`;

const browser = await chromium.launch();
for (const [pfad, groesse] of [
  ["public/icon-512.png", 512],
  ["public/icon-192.png", 192],
  ["public/apple-touch-icon.png", 180],
]) {
  const seite = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: groesse / 512,
  });
  await seite.setContent(html);
  await seite.locator(".icon").screenshot({ path: pfad });
  await seite.close();
  console.log(`${pfad} (${groesse}px)`);
}
await browser.close();
