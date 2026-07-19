// Einstieg — verdrahtet Katalog, Szene, Steuerung und UI.

import * as THREE from "three";
import { werke, galerie } from "./katalog.js";
import { erstelleSzene } from "./szene.js";
import { erstelleSteuerung } from "./steuerung.js";
import { erstelleUI, ladeVerkaufte } from "./ui.js";

// Galeriename aus den Katalogdaten in Titel, Wortmarke und Intro übernehmen
document.title = `${galerie.name} — Virtueller Showroom`;
document.querySelector(".wordmark").textContent = galerie.name;
document.querySelector(".intro-title").textContent = galerie.name;

// Bereits (im Demo-Modus) verkaufte Werke aus dem Speicher übernehmen
const verkaufteIds = ladeVerkaufte();
werke.forEach((w) => {
  if (verkaufteIds.includes(w.id)) w.verkauft = true;
});

const canvas = document.getElementById("scene");
const szene = erstelleSzene(canvas);

let steuerung; // wird unten erstellt; UI braucht eine späte Referenz

const ui = erstelleUI({
  aktualisiereVerkauft: szene.aktualisiereVerkauft,
  steuerungRef: () => steuerung,
});

steuerung = erstelleSteuerung({
  camera: szene.camera,
  dom: canvas,
  boden: szene.boden,
  klickbare: szene.klickbare,
  kunstwerke: szene.kunstwerke,
  erlaubt: szene.erlaubt,
  callbacks: {
    werkGewaehlt: (id) => ui.oeffneWerk(id),
    schliessePanel: () => ui.schliesseWerkPanel(),
    hover: (id, x, y) => ui.zeigeHover(id, x, y),
  },
});

// ————— Eintreten —————
document.getElementById("enter").addEventListener("click", () => {
  const intro = document.getElementById("intro");
  intro.classList.add("leaving");
  setTimeout(() => intro.remove(), 1000);
  document.getElementById("chrome-top").classList.remove("hidden");
  document.getElementById("room-nav").classList.remove("hidden");
  canvas.classList.add("walk");
  steuerung.starte();
});

// ————— Render-Loop —————
const clock = new THREE.Clock();
let letzterRaum = -1;

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  steuerung.update(dt);

  const raum = steuerung.aktuellerRaum();
  if (raum !== letzterRaum) {
    letzterRaum = raum;
    ui.markiereRaum(raum);
  }

  szene.renderer.render(szene.scene, szene.camera);
  requestAnimationFrame(loop);
}
loop();

// Debug-Zugriff für Entwicklung (window.__galerie)
window.__galerie = { szene, steuerung: () => steuerung };

// ————— Resize —————
window.addEventListener("resize", () => {
  szene.camera.aspect = window.innerWidth / window.innerHeight;
  szene.camera.updateProjectionMatrix();
  szene.renderer.setSize(window.innerWidth, window.innerHeight);
});
