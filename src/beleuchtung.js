// Beleuchtung — „Lichtinseln im Dämmer".
// Maximal eine Handvoll echter Lichter; alles andere sind additive
// Fake-Meshes, deren Deckkraft hier registriert und beim Eintritt
// werkweise „gezündet" wird (Halogen-Moment).

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { KONFIG } from "./konfig.js";

export function erstelleBeleuchtung(scene, renderer, raeume, raumZentrumX) {
  // PBR-Environment: Messing, Parkett und Glas bekommen echte Reflexe
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;

  // Kühl-neutraler Fill — der warme Spot bekommt dadurch Kontrast
  scene.add(new THREE.HemisphereLight(0xf3ead9, 0x0e0c09, KONFIG.licht.grundlicht));

  // Ein warmer Deckenspot pro Saal Richtung Boden-Mitte
  raeume.forEach((raum, i) => {
    const stil = KONFIG.saalStile[raum.id] || KONFIG.saalStile.standard;
    const spot = new THREE.SpotLight(
      stil.spotFarbe,
      KONFIG.licht.saalSpot * stil.lichtFaktor,
      KONFIG.raum.breite * 1.6,
      0.95,
      0.85,
      2
    );
    spot.position.set(raumZentrumX(i), KONFIG.raum.hoehe - 0.15, 0);
    spot.target.position.set(raumZentrumX(i), 0, 0);
    scene.add(spot);
    scene.add(spot.target);
  });

  // ————— Zünd-Register für alle Fake-Licht-Materialien —————
  // Vor dem Eintritt glimmen die Lichter auf 30 %; zuendeLichter()
  // fährt sie werkweise versetzt auf den Zielwert (mit Zünd-Flackern).
  const register = [];
  let zuendStart = null;

  function registriere(material, ziel, reihenfolge = 0) {
    material.opacity = ziel * 0.3;
    register.push({ material, ziel, verzoegerung: reihenfolge * 0.12 });
  }

  function zuendeLichter() {
    zuendStart = 0; // wird im update hochgezählt
  }

  function update(dt) {
    if (zuendStart === null) return;
    zuendStart += dt;
    let fertig = true;
    for (const e of register) {
      const t = (zuendStart - e.verzoegerung) / 0.8;
      if (t < 0) {
        fertig = false;
        continue;
      }
      const k = Math.min(t, 1);
      const s = k * k * (3 - 2 * k); // smoothstep
      let o = e.ziel * (0.3 + 0.7 * s);
      if (k < 0.375) o *= 1 + (Math.random() - 0.5) * 0.08; // Halogen zündet
      e.material.opacity = o;
      if (k < 1) fertig = false;
    }
    if (fertig) {
      for (const e of register) e.material.opacity = e.ziel;
      zuendStart = null;
    }
  }

  return { registriere, zuendeLichter, update };
}
