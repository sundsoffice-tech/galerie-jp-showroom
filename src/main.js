// Einstieg — verdrahtet Katalog, Szene, Beleuchtung, Steuerung, Klang und UI.
//
// Zwei Betriebsarten, automatisch gewählt:
//   3D-Rundgang  — wenn WebGL2 verfügbar ist und die Szene fehlerfrei aufbaut
//   Katalog-Modus — sonst (In-App-Browser, gesperrte GPU, alte Geräte):
//                   dieselbe Galerie als 2D-Katalog mit Details, Sammlung
//                   und Reservierung. Es gibt keinen „geht nicht"-Zustand.

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

// Galeriename und Saalzahl aus den Katalogdaten — pflegt der Händler die
// Säle, stimmt auch der Eintritts-Text weiter
document.title = `${galerie.name} — Virtueller Showroom`;
document.querySelector(".wordmark").textContent = galerie.name;
document.querySelector(".intro-title").textContent = galerie.name;
const ZAHLWORT = ["", "Ein", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht"];
const saalText =
  raeume.length === 1
    ? "Ein Saal"
    : `${ZAHLWORT[raeume.length] || raeume.length} Säle`;
document.querySelector(".intro-sub").textContent = `${saalText}. Ausgewählte Werke. Direkt erwerbbar.`;

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

// ————— Betriebsart wählen —————
// Three.js (ab r163) braucht WebGL2. Nach zwei gescheiterten 3D-Starts in
// dieser Sitzung (z. B. GPU-Kontextverlust-Schleife) bleibt der Katalog-Modus.
const FEHL_KEY = "galerie-3d-fehlversuche";
const fehlversuche = +(sessionStorage.getItem(FEHL_KEY) || 0);

const webgl2Ok = (() => {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
})();

const canvas = document.getElementById("scene");
let szene = null;
if (webgl2Ok && fehlversuche < 2) {
  try {
    szene = erstelleSzene(canvas);
  } catch (fehler) {
    console.warn("3D-Aufbau fehlgeschlagen — Katalog-Modus:", fehler);
    sessionStorage.setItem(FEHL_KEY, String(fehlversuche + 1));
    szene = null;
  }
}
const IM_3D = !!szene;

let steuerung;
let intro = null;
let composer = null;
let qualitaet = IM_3D ? TIER : "2d";
let dprCap = DPR_CAP;

const ui = erstelleUI({
  aktualisiereVerkauft: IM_3D ? szene.aktualisiereVerkauft : () => {},
  steuerungRef: () => steuerung,
});

const enterBtn = document.getElementById("enter");
enterBtn.focus({ preventScroll: true }); // Enter-Taste startet sofort

// Bildschirmtastatur (iOS): echte sichtbare Höhe als CSS-Variable pflegen
if (window.visualViewport) {
  const vv = () =>
    document.documentElement.style.setProperty("--vvh", `${window.visualViewport.height}px`);
  window.visualViewport.addEventListener("resize", vv);
  vv();
}

if (IM_3D) {
  // ——————————————— 3D-Rundgang ———————————————

  // Bloom ist Kür: scheitert der Shader-Aufbau auf einer exotischen GPU,
  // läuft der Rundgang schlicht ohne Nachbearbeitung weiter.
  if (TIER === "A") {
    try {
      composer = new EffectComposer(szene.renderer);
      composer.renderTarget1.samples = 2;
      composer.renderTarget2.samples = 2;
      composer.addPass(new RenderPass(szene.scene, szene.camera));
      composer.addPass(
        new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.55, 0.9)
      );
      composer.addPass(new OutputPass());
    } catch (fehler) {
      console.warn("Bloom nicht verfügbar — Rundgang läuft ohne:", fehler);
      composer = null;
    }
  }

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
      hover: (id, x, y) => {
        ui.zeigeHover(id, x, y);
        szene.setzeHover(id); // Lichtinsel des angeblickten Werks hellt auf
      },
      saalwechsel: (index, teleport) => ui.blendeZuSaal(raeume[index], teleport),
      schritt: (links, tempo) => klang.schritt(links, tempo),
      fokusKlang: () => klang.fokusWusch(),
    },
  });

  intro = erstelleIntro({
    camera: szene.camera,
    belichtung: szene.belichtung,
    beleuchtung: szene.beleuchtung,
    steuerung,
    ui,
  });

  enterBtn.addEventListener("click", () => {
    intro.eintreten();
    // Deep-Link (#w-005): nach dem Eintritt direkt vor das Werk fahren
    const zielId = location.hash.slice(1);
    if (zielId && werke.some((w) => w.id === zielId)) {
      setTimeout(() => steuerung.fokussiere(zielId), 2800);
    }
  });

  // Verwirft das Gerät den GPU-Kontext (häufig bei Mobil-Tab-Wechseln),
  // einmal sauber neu laden; nach dem zweiten Mal greift der Katalog-Modus.
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    sessionStorage.setItem(FEHL_KEY, String(fehlversuche + 1));
    location.reload();
  });

  // Touch: fester Joystick links unten, erscheint mit dem Eintritt
  const joystick = IST_TOUCH ? erstelleJoystick(steuerung.joy) : null;
  let joystickGezeigt = false;

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
    // Hover-Glow erst nach der Licht-Zündung, sonst kämpfen beide um die Opacity
    if (!introAktiv) szene.updateHover(dt);
    szene.updateStaub(dt, clock.elapsedTime);

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

    // Frametime-Wächter: nur abstufen, nie zurück (kein Qualitäts-Flackern).
    // Reagiert nach ~30 Frames — Ruckeln soll Sekunden dauern, nicht Minuten.
    frameMittel = frameMittel * 0.97 + dt * 1000 * 0.03;
    if (frameMittel > 21 && qualitaet === "A") {
      qualitaet = "B";
      composer?.dispose(); // Render-Targets freigeben, sonst GPU-Speicherleck
      composer = null;
      frameMittel = 16; // der neuen Stufe Zeit geben, bevor weiter abgestuft wird
      console.info("Qualität auf Stufe B reduziert (Frametime).");
    } else if (frameMittel > 24 && qualitaet === "B") {
      qualitaet = "C";
      dprCap = Math.min(dprCap, 1.25); // gilt auch nach dem nächsten Resize
      szene.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
      frameMittel = 16;
      console.info("Qualität auf Stufe C reduziert (Frametime).");
    }

    if (composer) composer.render();
    else szene.renderer.render(szene.scene, szene.camera);
    requestAnimationFrame(loop);
  }
  loop();

  // 3D läuft stabil: Fehlversuchszähler dieser Sitzung zurücksetzen
  setTimeout(() => sessionStorage.removeItem(FEHL_KEY), 6000);

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
} else {
  // ——————————————— Katalog-Modus (ohne 3D) ———————————————
  // Gleiche Marke, gleiche Kaufwege — nur ohne Rundgang. Kein Hinweis auf
  // Technik oder Einstellungen: es funktioniert einfach.
  document.documentElement.classList.add("modus-2d");

  steuerung = {
    fokussiere: () => false, // ui fällt damit automatisch auf oeffneWerk zurück
    fokusVerlassen() {},
    setzeSheetOffset() {},
    wendeSheetOffsetAn() {},
    zuRaum() {},
    joy: { x: 0, y: 0 },
  };

  const hints = document.querySelector(".intro-hints");
  if (hints) {
    hints.innerHTML =
      "<span><b>Katalog-Ansicht</b> — tippen Sie ein Werk an für Details, Preis und Reservierung</span>";
  }

  enterBtn.addEventListener("click", () => {
    ui.introAusblenden();
    ui.zeigeChrome("top");
    // Deep-Link direkt als Detailansicht, sonst der volle Katalog
    const zielId = location.hash.slice(1);
    if (zielId && werke.some((w) => w.id === zielId)) {
      ui.oeffneWerk(zielId);
    } else {
      document.getElementById("catalog-open").click();
    }
  });
}

// Debug-Zugriff für Entwicklung (window.__galerie)
window.__galerie = {
  szene,
  steuerung: () => steuerung,
  qualitaet: () => qualitaet,
  modus: IM_3D ? "3d" : "2d",
};
