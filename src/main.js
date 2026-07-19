// Einstieg — verdrahtet Katalog, Szene, Beleuchtung, Steuerung, Klang und UI.

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { werke, galerie, raeume } from "./katalog.js";
import { KONFIG, TIER } from "./konfig.js";
import { IST_TOUCH } from "./geraet.js";
import { erstelleSzene, DPR_CAP } from "./szene.js";
import { erstelleJoystick } from "./joystick.js";
import { erstelleSteuerung } from "./steuerung.js";
import { erstelleUI, ladeVerkaufte } from "./ui.js";
import { erstelleIntro } from "./intro.js";
import * as klang from "./klang.js";

// Galeriename aus den Katalogdaten in Titel, Wortmarke und Intro
document.title = `${galerie.name} — Virtueller Showroom`;
document.querySelector(".wordmark").textContent = galerie.name;
document.querySelector(".intro-title").textContent = galerie.name;

// Bereits (im Demo-Modus) verkaufte Werke aus dem Speicher übernehmen
const verkaufteIds = ladeVerkaufte();
werke.forEach((w) => {
  if (verkaufteIds.includes(w.id)) w.verkauft = true;
});

// Rückkehr von einem Stripe Payment Link (?erworben=w-005):
// das Werk sofort lokal als verkauft markieren
const erworben = new URLSearchParams(location.search).get("erworben");
if (erworben && werke.some((w) => w.id === erworben)) {
  const w = werke.find((x) => x.id === erworben);
  w.verkauft = true;
  if (!verkaufteIds.includes(erworben)) {
    verkaufteIds.push(erworben);
    localStorage.setItem("galerie-jp-verkauft", JSON.stringify(verkaufteIds));
  }
}

// Marken-Serife auch für Canvas-Beschriftung im 3D-Raum laden
try {
  await Promise.race([
    document.fonts.load('300 120px "Cormorant Garamond"'),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
} catch {
  /* Systemschrift-Fallback */
}

const canvas = document.getElementById("scene");
const szene = erstelleSzene(canvas);

// ————— Postprocessing (nur Tier A) —————
let composer = null;
let qualitaet = TIER;
let dprCap = DPR_CAP; // sinkt bei Qualitätsabstufung und bleibt dann gesenkt
if (TIER === "A") {
  composer = new EffectComposer(szene.renderer);
  composer.renderTarget1.samples = 4;
  composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(szene.scene, szene.camera));
  composer.addPass(
    new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.2,
      0.55,
      0.9
    )
  );
  composer.addPass(new OutputPass());
}

let steuerung;

const ui = erstelleUI({
  aktualisiereVerkauft: szene.aktualisiereVerkauft,
  steuerungRef: () => steuerung,
});

steuerung = erstelleSteuerung({
  camera: szene.camera,
  dom: canvas,
  scene: szene.scene,
  boden: szene.boden,
  klickbare: szene.klickbare,
  hindernisse: szene.hindernisse,
  kunstwerke: szene.kunstwerke,
  erlaubt: szene.erlaubt,
  verboten: szene.verboten,
  callbacks: {
    werkGewaehlt: (id) => ui.oeffneWerk(id),
    schliessePanel: () => ui.schliesseWerkPanel(),
    hover: (id, x, y) => ui.zeigeHover(id, x, y),
    saalwechsel: (index, teleport) => ui.blendeZuSaal(raeume[index], teleport),
    schritt: (links, tempo) => klang.schritt(links, tempo),
    fokusKlang: () => klang.fokusWusch(),
  },
});

const intro = erstelleIntro({
  camera: szene.camera,
  belichtung: szene.belichtung,
  beleuchtung: szene.beleuchtung,
  steuerung,
  ui,
});

const enterBtn = document.getElementById("enter");
enterBtn.focus({ preventScroll: true }); // Enter-Taste startet den Rundgang sofort
enterBtn.addEventListener("click", () => {
  intro.eintreten();
  // Deep-Link (#w-005): nach dem Eintritt direkt vor das Werk fahren
  const zielId = location.hash.slice(1);
  if (zielId && werke.some((w) => w.id === zielId)) {
    setTimeout(() => steuerung.fokussiere(zielId), 2800);
  }
});

// Touch: fester Joystick links unten, erscheint mit dem Eintritt
const joystick = IST_TOUCH ? erstelleJoystick(steuerung.joy) : null;
let joystickGezeigt = false;

// Bildschirmtastatur (iOS): echte sichtbare Höhe als CSS-Variable pflegen
if (window.visualViewport) {
  const vv = () =>
    document.documentElement.style.setProperty("--vvh", `${window.visualViewport.height}px`);
  window.visualViewport.addEventListener("resize", vv);
  vv();
}

// ————— Render-Loop —————
const clock = new THREE.Clock();
let letzterRaum = -1;
let frameMittel = 16;

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);

  const introAktiv = intro.update(dt);
  if (!introAktiv) {
    if (joystick && !joystickGezeigt) {
      joystickGezeigt = true;
      joystick.zeige(true);
    }
    steuerung.update(dt);
    // FOV weich nachführen
    const fovZiel = steuerung.fovZiel();
    if (Math.abs(szene.camera.fov - fovZiel) > 0.01) {
      szene.camera.fov += (fovZiel - szene.camera.fov) * (1 - Math.exp(-5 * dt));
      szene.camera.updateProjectionMatrix();
    }
  }

  // Belichtung weich zum Ziel (Fokus dimmt leicht ab)
  const belZiel = steuerung.imFokus()
    ? szene.belichtung.ziel * (KONFIG.licht.belichtungFokus / KONFIG.licht.belichtung)
    : szene.belichtung.ziel;
  const bel = szene.renderer.toneMappingExposure;
  if (Math.abs(bel - belZiel) > 0.001) {
    szene.renderer.toneMappingExposure = bel + (belZiel - bel) * (1 - Math.exp(-2.2 * dt));
  }

  szene.beleuchtung.update(dt);

  // Messingobjekt auf dem Podest dreht sich kaum merklich
  if (szene.podestObjekt) szene.podestObjekt.rotation.y += dt * 0.15;

  const raum = steuerung.aktuellerRaum();
  if (raum !== letzterRaum) {
    const erster = letzterRaum === -1;
    letzterRaum = raum;
    ui.markiereRaum(raum);
    klang.setzeRaum(raeume[raum].id);
    // Saaltitel beim Durchschreiten einblenden (nicht beim Start)
    if (!erster && !introAktiv) ui.zeigeSaalTitel(raeume[raum]);
  }

  // Frametime-Wächter: nur abstufen, nie zurück (kein Qualitäts-Flackern)
  frameMittel = frameMittel * 0.985 + dt * 1000 * 0.015;
  if (frameMittel > 22 && qualitaet === "A") {
    qualitaet = "B";
    composer?.dispose(); // Render-Targets freigeben, sonst GPU-Speicherleck
    composer = null;
    console.info("Qualität auf Stufe B reduziert (Frametime).");
  } else if (frameMittel > 26 && qualitaet === "B") {
    qualitaet = "C";
    dprCap = Math.min(dprCap, 1.25); // gilt auch nach dem nächsten Resize
    szene.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
    console.info("Qualität auf Stufe C reduziert (Frametime).");
  }

  if (composer) composer.render();
  else szene.renderer.render(szene.scene, szene.camera);
  requestAnimationFrame(loop);
}
loop();

// Debug-Zugriff für Entwicklung (window.__galerie)
window.__galerie = { szene, steuerung: () => steuerung, qualitaet: () => qualitaet };

// ————— Resize (inkl. Orientation-Wechsel) —————
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  szene.camera.aspect = w / h;
  szene.camera.updateProjectionMatrix();
  szene.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  szene.renderer.setSize(w, h);
  composer?.setSize(w, h);
  steuerung.wendeSheetOffsetAn();
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
