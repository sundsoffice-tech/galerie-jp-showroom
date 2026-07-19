// Steuerung — First-Person-Bewegung im Museums-Stil:
// Ziehen zum Umsehen, WASD/Pfeile oder Klick auf den Boden zum Gehen,
// Klick auf ein Werk fährt die Kamera sanft davor (Fokus-Modus).

import * as THREE from "three";
import { RAUM_T, raumZentrumX } from "./szene.js";
import { KONFIG } from "./konfig.js";

const AUGE = KONFIG.besucher.augenhoehe;
const GEHTEMPO = KONFIG.besucher.gehtempo;
const DREH = KONFIG.besucher.drehempfindlichkeit;

export function erstelleSteuerung({ camera, dom, boden, klickbare, kunstwerke, erlaubt, callbacks }) {
  let yaw = Math.PI; // Start: Blick in den Raum (Richtung Nordwand)
  let pitch = 0;
  yaw = 0;
  camera.rotation.set(pitch, yaw, 0);

  const tasten = new Set();
  let aktiv = false; // erst nach dem Eintreten
  let fokus = null; // werkId im Fokus-Modus
  let gehZiel = null;
  let tween = null;

  const raycaster = new THREE.Raycaster();
  const zeiger = new THREE.Vector2();

  // ————— Kollision —————
  function istErlaubt(x, z) {
    return erlaubt.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
  }

  function bewege(dx, dz) {
    const p = camera.position;
    if (istErlaubt(p.x + dx, p.z)) p.x += dx;
    if (istErlaubt(p.x, p.z + dz)) p.z += dz;
  }

  // ————— Zeiger-Eingabe (Maus + Touch via Pointer Events) —————
  let zieht = false;
  let bewegt = 0;
  let startX = 0;
  let startY = 0;
  let letztX = 0;
  let letztY = 0;

  dom.addEventListener("pointerdown", (e) => {
    if (!aktiv) return;
    zieht = true;
    bewegt = 0;
    startX = letztX = e.clientX;
    startY = letztY = e.clientY;
    dom.setPointerCapture(e.pointerId);
  });

  dom.addEventListener("pointermove", (e) => {
    zeiger.x = (e.clientX / window.innerWidth) * 2 - 1;
    zeiger.y = -(e.clientY / window.innerHeight) * 2 + 1;
    if (!aktiv) return;
    if (zieht) {
      const dx = e.clientX - letztX;
      const dy = e.clientY - letztY;
      letztX = e.clientX;
      letztY = e.clientY;
      bewegt += Math.abs(dx) + Math.abs(dy);
      if (fokus) return; // im Fokus nicht umsehen
      yaw -= dx * DREH;
      pitch = THREE.MathUtils.clamp(pitch - dy * DREH, -1.2, 1.2);
      camera.rotation.set(pitch, yaw, 0);
    } else {
      pruefeHover(e.clientX, e.clientY);
    }
  });

  dom.addEventListener("pointerup", (e) => {
    if (!aktiv) return;
    zieht = false;
    const warKlick = bewegt < 8;
    if (!warKlick) return;
    klick(e.clientX, e.clientY);
  });

  dom.addEventListener("pointercancel", () => (zieht = false));

  // ————— Tastatur —————
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    tasten.add(e.code);
    if (e.code === "Escape" && fokus) callbacks.schliessePanel();
  });
  window.addEventListener("keyup", (e) => tasten.delete(e.code));

  // ————— Raycasting —————
  function trefferUnterZeiger(cx, cy) {
    zeiger.x = (cx / window.innerWidth) * 2 - 1;
    zeiger.y = -(cy / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(zeiger, camera);
    const werke = raycaster.intersectObjects(klickbare, false);
    if (werke.length && werke[0].distance < 14) return { typ: "werk", hit: werke[0] };
    const bodenHit = raycaster.intersectObject(boden, false);
    if (bodenHit.length) return { typ: "boden", hit: bodenHit[0] };
    return null;
  }

  let hoverId = null;
  function pruefeHover(cx, cy) {
    const t = trefferUnterZeiger(cx, cy);
    const neu = t && t.typ === "werk" ? t.hit.object.userData.werkId : null;
    if (neu !== hoverId) {
      hoverId = neu;
      dom.classList.toggle("hover-art", !!neu);
    }
    callbacks.hover(neu, cx, cy);
  }

  function klick(cx, cy) {
    const t = trefferUnterZeiger(cx, cy);
    if (!t) return;
    if (t.typ === "werk") {
      fokussiere(t.hit.object.userData.werkId);
    } else if (!fokus) {
      gehZiel = new THREE.Vector3(t.hit.point.x, AUGE, t.hit.point.z);
    }
  }

  // ————— Fokus-Modus (Kamera vor das Werk) —————
  function fokussiere(werkId) {
    const eintrag = kunstwerke.get(werkId);
    if (!eintrag) return;
    fokus = werkId;
    gehZiel = null;

    const zielPunkt = new THREE.Vector3();
    eintrag.flaeche.getWorldPosition(zielPunkt);
    const groesse = Math.max(eintrag.flaeche.userData.breite || 1, eintrag.flaeche.userData.hoehe || 1);
    const abstand = THREE.MathUtils.clamp(groesse * 1.5, 1.7, 3.4);
    const standort = zielPunkt.clone().addScaledVector(eintrag.normal, abstand);
    standort.y = AUGE;

    const richtung = zielPunkt.clone().sub(standort).normalize();
    const zielYaw = kuerzesterYaw(yaw, Math.atan2(-richtung.x, -richtung.z));
    const zielPitch = Math.asin(THREE.MathUtils.clamp(richtung.y, -1, 1));

    tween = {
      t: 0,
      dauer: 1.1,
      vonPos: camera.position.clone(),
      nachPos: standort,
      vonYaw: yaw,
      nachYaw: zielYaw,
      vonPitch: pitch,
      nachPitch: zielPitch,
    };
    callbacks.werkGewaehlt(werkId);
  }

  function kuerzesterYaw(von, nach) {
    let d = (nach - von) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return von + d;
  }

  function fokusVerlassen() {
    fokus = null;
  }

  // ————— Teleport zu einem Raum (Saal-Navigation) —————
  function zuRaum(index) {
    fokus = null;
    gehZiel = null;
    tween = {
      t: 0,
      dauer: 1.3,
      vonPos: camera.position.clone(),
      nachPos: new THREE.Vector3(raumZentrumX(index), AUGE, RAUM_T * 0.28),
      vonYaw: yaw,
      nachYaw: kuerzesterYaw(yaw, 0),
      vonPitch: pitch,
      nachPitch: 0,
    };
  }

  // ————— Update pro Frame —————
  function update(dt) {
    if (!aktiv) return;

    if (tween) {
      tween.t += dt / tween.dauer;
      const k = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3); // easeOutCubic
      camera.position.lerpVectors(tween.vonPos, tween.nachPos, k);
      yaw = THREE.MathUtils.lerp(tween.vonYaw, tween.nachYaw, k);
      pitch = THREE.MathUtils.lerp(tween.vonPitch, tween.nachPitch, k);
      camera.rotation.set(pitch, yaw, 0);
      if (tween.t >= 1) tween = null;
      return;
    }

    if (fokus) return; // stehen bleiben, solange das Panel offen ist

    // WASD / Pfeile
    let vor = 0;
    let seit = 0;
    if (tasten.has("KeyW") || tasten.has("ArrowUp")) vor += 1;
    if (tasten.has("KeyS") || tasten.has("ArrowDown")) vor -= 1;
    if (tasten.has("KeyA") || tasten.has("ArrowLeft")) seit -= 1;
    if (tasten.has("KeyD") || tasten.has("ArrowRight")) seit += 1;

    if (vor || seit) {
      gehZiel = null;
      const len = Math.hypot(vor, seit) || 1;
      const s = (GEHTEMPO * dt) / len;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      bewege((-sin * vor + cos * seit) * s, (-cos * vor - sin * seit) * s);
    } else if (gehZiel) {
      const p = camera.position;
      const dx = gehZiel.x - p.x;
      const dz = gehZiel.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.25) {
        gehZiel = null;
      } else {
        const s = Math.min(GEHTEMPO * dt, dist);
        const vorher = p.clone();
        bewege((dx / dist) * s, (dz / dist) * s);
        if (p.distanceTo(vorher) < s * 0.15) gehZiel = null; // blockiert
      }
    }
  }

  function aktuellerRaum() {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; ; i++) {
      const cx = raumZentrumX(i);
      const d = Math.abs(camera.position.x - cx);
      if (d < bestD) {
        bestD = d;
        best = i;
      } else break;
    }
    return best;
  }

  return {
    update,
    fokussiere,
    fokusVerlassen,
    zuRaum,
    aktuellerRaum,
    starte() {
      aktiv = true;
    },
  };
}
