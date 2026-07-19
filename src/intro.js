// Intro — die Galerie lebt schon hinter dem Eintritts-Overlay:
// langsame Kamera-Drift durch Saal I, dann der orchestrierte Eintritt
// („jemand schaltet für den Besucher das Licht an").

import * as THREE from "three";
import { KONFIG, REDUZIERTE_BEWEGUNG } from "./konfig.js";
import { RAUM_B, raumZentrumX } from "./szene.js";
import * as klang from "./klang.js";

const B = KONFIG.besucher;

export function erstelleIntro({ camera, belichtung, beleuchtung, steuerung, ui }) {
  let modus = "drift"; // drift → eintritt → fertig
  let zeit = 0;
  let eintrittStart = 0; // Echtzeit — übersteht pausierte Frames (Tab im Hintergrund)
  let driftPose = null;
  const cx0 = raumZentrumX(0);
  // Startpose „Entrée": vor der Wortmarken-Wand, Blick nach Osten
  // durch die gesamte Tür-Flucht der Galerie
  const startPos = new THREE.Vector3(cx0 - RAUM_B / 2 + 2.3, B.augenhoehe, 0);
  const START_YAW = -Math.PI / 2;

  const plan = [
    { t: 0.15, fn: () => {} }, // Kamerafahrt startet (siehe update)
    { t: 0.6, fn: () => (belichtung.ziel = KONFIG.licht.belichtung) },
    { t: 0.9, fn: () => beleuchtung.zuendeLichter() },
    { t: 1.4, fn: () => ui.zeigeChrome("top") },
    { t: 1.8, fn: () => ui.zeigeChrome("nav") },
    { t: 2.6, fn: () => steuerung.starte() },
  ];
  let planIndex = 0;

  function eintreten() {
    if (modus !== "drift") return;
    // Ton darf den Eintritt niemals blockieren (blockierter AudioContext,
    // fehlendes StereoPanner o. ä.) — der Rundgang läuft dann eben stumm.
    try {
      klang.starte();
    } catch (fehler) {
      console.warn("Ton konnte nicht gestartet werden:", fehler);
    }
    modus = "eintritt";
    eintrittStart = performance.now();
    planIndex = 0;
    driftPose = {
      pos: camera.position.clone(),
      yaw: camera.rotation.y,
      pitch: camera.rotation.x,
      fov: camera.fov,
    };
    ui.introAusblenden();
    if (REDUZIERTE_BEWEGUNG) {
      // ohne Fahrt: alles sofort, Zündung ohne Versatz
      camera.position.copy(startPos);
      camera.rotation.set(0, START_YAW, 0);
      camera.fov = B.fovBasis;
      camera.updateProjectionMatrix();
      belichtung.ziel = KONFIG.licht.belichtung;
      beleuchtung.zuendeLichter();
      ui.zeigeChrome("top");
      ui.zeigeChrome("nav");
      steuerung.starte();
      steuerung.setzeBlick(START_YAW, 0);
      modus = "fertig";
    }
  }

  // true = Intro kontrolliert die Kamera noch
  function update(dt) {
    if (modus === "fertig") return false;
    zeit += dt;

    if (modus === "drift") {
      // Lissajous-Drift entlang der Galerie-Achse, Blick die Flucht hinunter —
      // Perioden > 60 s: Bewegung, die man spürt, aber nicht „sieht"
      camera.position.set(
        startPos.x + 1.1 + Math.sin(zeit * 0.05) * 1.3,
        B.augenhoehe,
        Math.cos(zeit * 0.037) * 0.9
      );
      camera.rotation.set(-0.02, START_YAW + Math.sin(zeit * 0.043) * 0.32, 0);
      if (Math.abs(camera.fov - B.fovIntro) > 0.01) {
        camera.fov = B.fovIntro;
        camera.updateProjectionMatrix();
      }
      return true;
    }

    // ————— Eintritt (Echtzeit statt Frame-Zeit) —————
    const eintrittZeit = (performance.now() - eintrittStart) / 1000;
    while (planIndex < plan.length && eintrittZeit >= plan[planIndex].t) {
      plan[planIndex].fn();
      planIndex++;
    }

    // Kamerafahrt 0,15 s → 2,55 s (2,4 s, easeInOutCubic)
    const f = THREE.MathUtils.clamp((eintrittZeit - 0.15) / 2.4, 0, 1);
    const s = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
    camera.position.lerpVectors(driftPose.pos, startPos, s);
    const yaw = THREE.MathUtils.lerp(driftPose.yaw, START_YAW, s);
    const pitch = THREE.MathUtils.lerp(driftPose.pitch, 0, s);
    camera.rotation.set(pitch, yaw, 0);
    camera.fov = THREE.MathUtils.lerp(driftPose.fov, B.fovBasis, s);
    camera.updateProjectionMatrix();

    if (eintrittZeit >= 2.6) {
      steuerung.setzeBlick(START_YAW, 0);
      modus = "fertig";
      return false;
    }
    return true;
  }

  return { eintreten, update, laeuft: () => modus !== "fertig" };
}
