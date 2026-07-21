// Steuerung — Bewegungsgefühl „schweres Stativ, nicht Ego-Shooter":
// Beschleunigen/Ausrollen statt An/Aus, Blick-Trägheit mit Nachschwingen,
// dezenter Head-Bob mit Schritt-Triggern, Bogen-Kamerafahrt zum Werk.
// Touch: Ziehen = Umsehen (eine Pointer-ID), Tippen = Gehen/Werk,
// Joystick (eigenes DOM-Element) = flanierendes Gehen, Blick-Label als Hover-Ersatz.

import * as THREE from "three";
import { RAUM_T, raumZentrumX } from "./szene.js";
import { KONFIG, REDUZIERTE_BEWEGUNG } from "./konfig.js";
import { IST_TOUCH, istSheetLayout } from "./geraet.js";
import { raeume } from "./katalog.js";

const B = KONFIG.besucher;
const TAP_TOLERANZ = IST_TOUCH ? KONFIG.mobil.tapToleranzPx : 9;

export function erstelleSteuerung({ camera, dom, scene, boden, klickbare, hindernisse = [], kunstwerke, erlaubt, verboten, callbacks }) {
  let aktiv = false;
  let fokus = null;
  let fokusStand = null;
  let fokusSeite = null;
  let fokusZeit = 0;

  // Blick
  let yaw = 0;
  let pitch = 0;
  let zielYaw = 0;
  let zielPitch = 0;
  let yawVel = 0;
  camera.rotation.set(0, 0, 0);

  // Geführter Blick: nur links/rechts, Augenhöhe bleibt Augenhöhe.
  // Spielraum steht in konfig.js (blickGrenzePitch, 0 = gesperrt).
  const pitchGrenze = Math.max(0, B.blickGrenzePitch ?? 1.15);
  const begrenzePitch = (p) => THREE.MathUtils.clamp(p, -pitchGrenze, pitchGrenze);

  // Bewegung
  const vel = new THREE.Vector2(); // x, z
  const joy = { x: 0, y: 0 }; // wird von joystick.js beschrieben
  let gehZiel = null;
  let bobPhase = 0;
  let tempoFaktor = 0;
  let schrittGespannt = false;
  let schrittFuss = false;

  let tween = null;
  const tasten = new Set();
  const raycaster = new THREE.Raycaster();
  const zeiger = new THREE.Vector2();

  // ————— Boden-Zielmarker —————
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.13, 0.17, 40),
    new THREE.MeshBasicMaterial({ color: 0xc2a36b, transparent: true, opacity: 0, depthWrite: false })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.012;
  scene.add(marker);
  let markerAlter = 99;

  // ————— Kollision —————
  function istErlaubt(x, z) {
    if (verboten.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ)) return false;
    return erlaubt.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
  }

  function bewege(dx, dz) {
    const p = camera.position;
    let bx = false;
    let bz = false;
    if (istErlaubt(p.x + dx, p.z)) p.x += dx;
    else bx = true;
    if (istErlaubt(p.x, p.z + dz)) p.z += dz;
    else bz = true;
    return { bx, bz };
  }

  // ————— Zeiger-Eingabe: EIN Umseh-Pointer, Tap = Klick,
  // zwei Finger im Fokus = Pinch-Zoom ans Werk —————
  let lookId = null;
  let bewegt = 0;
  let letztX = 0;
  let letztY = 0;
  let downZeit = 0;
  let dxLetzt = 0;
  const aktivePointer = new Map(); // pointerId -> {x, y}
  let pinch = null; // { startDist, startAbstand }

  function pinchDistanz() {
    const [a, b2] = [...aktivePointer.values()];
    return Math.hypot(a.x - b2.x, a.y - b2.y);
  }

  dom.addEventListener("pointerdown", (e) => {
    if (!aktiv) return;
    aktivePointer.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dom.setPointerCapture(e.pointerId);

    // Zweiter Finger bei fokussiertem Werk: Pinch beginnt
    if (aktivePointer.size === 2 && fokus && fokusStand) {
      const ziel = kunstwerke.get(fokus);
      if (ziel) {
        const punkt = new THREE.Vector3();
        ziel.flaeche.getWorldPosition(punkt);
        pinch = {
          startDist: pinchDistanz(),
          startAbstand: camera.position.distanceTo(punkt),
          punkt,
          normal: ziel.normal.clone(),
        };
        tween = null;
      }
      return;
    }
    if (lookId !== null) return; // dritter Finger: ignorieren
    lookId = e.pointerId;
    bewegt = 0;
    dxLetzt = 0;
    letztX = e.clientX;
    letztY = e.clientY;
    downZeit = performance.now();
    yawVel = 0;
  });

  dom.addEventListener("pointermove", (e) => {
    if (!aktiv) return;
    const p = aktivePointer.get(e.pointerId);
    if (p) {
      p.x = e.clientX;
      p.y = e.clientY;
    }

    // Pinch: Abstand zum Werk folgt der Fingerspreizung
    if (pinch && aktivePointer.size >= 2) {
      bewegt += 10; // nie als Tap werten
      const faktor = pinch.startDist / Math.max(pinchDistanz(), 20);
      const abstand = THREE.MathUtils.clamp(pinch.startAbstand * faktor, 0.55, 3.6);
      fokusStand = pinch.punkt.clone().addScaledVector(pinch.normal, abstand);
      fokusStand.y = camera.position.y;
      return;
    }

    if (e.pointerId !== lookId) {
      if (!IST_TOUCH) pruefeHover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - letztX;
    const dy = e.clientY - letztY;
    letztX = e.clientX;
    letztY = e.clientY;
    bewegt += Math.abs(dx) + Math.abs(dy);
    if (fokus) return;
    zielYaw -= dx * B.drehempfindlichkeit;
    zielPitch = begrenzePitch(zielPitch - dy * B.drehempfindlichkeit);
    dxLetzt = dx;
  });

  function pointerEnde(e) {
    aktivePointer.delete(e.pointerId);
    if (aktivePointer.size < 2) pinch = null;
    if (!aktiv || e.pointerId !== lookId) return;
    lookId = null;
    // Nachschwingen des Blicks
    if (!fokus && Math.abs(dxLetzt) > 2) {
      yawVel = THREE.MathUtils.clamp(-dxLetzt * B.drehempfindlichkeit * 40, -1.5, 1.5);
    }
    const warTap = bewegt < TAP_TOLERANZ && performance.now() - downZeit < 500;
    if (warTap && e.type === "pointerup") klick(e.clientX, e.clientY);
  }
  dom.addEventListener("pointerup", pointerEnde);
  dom.addEventListener("pointercancel", pointerEnde);

  // ————— Tastatur —————
  // Tippen in Formularfeldern darf die Kamera nicht bewegen ("Wanda" = WASD).
  // ESC gehört allein der geschichteten Panel-Logik in ui.js.
  function inEingabefeld(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat || inEingabefeld(e)) return;
    tasten.add(e.code);
  });
  window.addEventListener("keyup", (e) => tasten.delete(e.code));
  // Fenster verlassen: hängende Tasten freigeben, sonst läuft die Kamera weiter
  window.addEventListener("blur", () => tasten.clear());

  // ————— Raycasting —————
  function trefferUnterZeiger(cx, cy) {
    zeiger.x = (cx / window.innerWidth) * 2 - 1;
    zeiger.y = -(cy / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(zeiger, camera);
    // Wand-Distanz zuerst: sonst wären Werke durch Wände hindurch klickbar
    const wand = hindernisse.length ? raycaster.intersectObjects(hindernisse, false) : [];
    const sicht = wand.length ? wand[0].distance : Infinity;
    const werke = raycaster.intersectObjects(klickbare, false);
    if (werke.length && werke[0].distance < 14 && werke[0].distance < sicht) {
      return { typ: "werk", hit: werke[0] };
    }
    const bodenHit = raycaster.intersectObject(boden, false);
    if (bodenHit.length && bodenHit[0].distance < sicht) return { typ: "boden", hit: bodenHit[0] };
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
      gehZiel = new THREE.Vector3(t.hit.point.x, 0, t.hit.point.z);
      marker.position.set(gehZiel.x, 0.012, gehZiel.z);
      markerAlter = 0;
    }
  }

  // ————— Fokus-Kamerafahrt (Bogen + Kontemplations-Drift) —————
  // Rückgabe false = Werk nicht ansteuerbar (ungehängt oder Intro läuft);
  // die UI kann dann wenigstens das Detail-Panel öffnen.
  function fokussiere(werkId) {
    const e = kunstwerke.get(werkId);
    // Solange das Intro die Kamera führt, keine Fokusfahrt annehmen —
    // sie würde von der Intro-Timeline überschrieben.
    if (!e || !aktiv) return false;

    // Werk hängt in einem anderen Saal: die Bogen-Fahrt würde durch die
    // Innenwände clippen — stattdessen Blende, Teleport, dann normale Fahrt.
    const zielSaal = naechsterRaumZuX(e.gruppe.position.x);
    if (zielSaal !== aktuellerRaum() && !tween) {
      callbacks.saalwechsel(zielSaal, () => {
        teleportiere(zielSaal);
        fokussiere(werkId);
      });
      return true;
    }

    // Zweiter Klick auf das fokussierte Werk: Nahzoom auf die Textur
    if (fokus === werkId && !tween && fokusStand) {
      const nahPunkt = new THREE.Vector3();
      e.flaeche.getWorldPosition(nahPunkt);
      const aktuell = camera.position.distanceTo(nahPunkt);
      const nah = nahPunkt.clone().addScaledVector(e.normal, Math.max(aktuell * 0.5, 0.95));
      nah.y = camera.position.y;
      tween = {
        t: 0,
        dauer: REDUZIERTE_BEWEGUNG ? 0.15 : 0.6,
        p0: camera.position.clone(),
        p1: camera.position.clone().lerp(nah, 0.5),
        p2: nah,
        vonYaw: yaw,
        nachYaw: yaw,
        vonPitch: pitch,
        nachPitch: pitch,
      };
      fokusStand = nah.clone();
      return true;
    }

    fokus = werkId;
    gehZiel = null;
    vel.set(0, 0);
    yawVel = 0;

    const zielPunkt = new THREE.Vector3();
    e.flaeche.getWorldPosition(zielPunkt);
    const groesse = Math.max(e.flaeche.userData.breite || 1, e.flaeche.userData.hoehe || 1);
    const portraitFaktor = camera.aspect < 1 ? 1.3 : 1;
    const abstand = THREE.MathUtils.clamp(groesse * 1.35 * portraitFaktor, 1.5, 4.2);
    const stand = zielPunkt.clone().addScaledVector(e.normal, abstand);
    stand.y = B.augenhoehe;

    // Kontrollpunkt: Streckenmitte, seitlich zur Raummitte versetzt
    const mitte = camera.position.clone().add(stand).multiplyScalar(0.5);
    const seite = new THREE.Vector3(-e.normal.z, 0, e.normal.x);
    const raumMitte = new THREE.Vector3(raumZentrumX(aktuellerRaum()), B.augenhoehe, 0);
    if (mitte.clone().add(seite).distanceTo(raumMitte) > mitte.clone().sub(seite).distanceTo(raumMitte)) {
      seite.negate();
    }
    mitte.addScaledVector(seite, 0.35);

    const richtung = zielPunkt.clone().sub(stand).normalize();
    tween = {
      t: 0,
      dauer: REDUZIERTE_BEWEGUNG ? 0.3 : 1.6,
      p0: camera.position.clone(),
      p1: mitte,
      p2: stand,
      vonYaw: yaw,
      nachYaw: kuerzesterYaw(yaw, Math.atan2(-richtung.x, -richtung.z)),
      vonPitch: pitch,
      nachPitch: Math.asin(THREE.MathUtils.clamp(richtung.y, -1, 1)),
    };
    fokusStand = stand.clone();
    fokusSeite = seite.clone();
    fokusZeit = 0;
    callbacks.werkGewaehlt(werkId);
    callbacks.fokusKlang?.();
    return true;
  }

  function kuerzesterYaw(von, nach) {
    let d = (nach - von) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return von + d;
  }

  function fokusVerlassen() {
    fokus = null;
    fokusStand = null;
    tween = null;
  }

  // ————— Sheet-Framing: Werk über dem Bottom-Sheet halten —————
  let sheetOffsetAktiv = false;
  function setzeSheetOffset(an) {
    sheetOffsetAktiv = an;
    wendeSheetOffsetAn();
  }
  function wendeSheetOffsetAn() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (sheetOffsetAktiv && istSheetLayout()) {
      // Werk in die freie Zone über dem Peek-Sheet (58 %) heben
      camera.setViewOffset(w, h, 0, h * 0.24, w, h);
    } else if (sheetOffsetAktiv && w >= 900) {
      // Desktop: das Panel (26rem rechts) verdeckt sonst das halbe Werk —
      // Bildinhalt um die halbe Panelbreite in die freie Fläche rücken
      camera.setViewOffset(w, h, 208, 0, w, h);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }

  // ————— Saalwechsel (Blende übernimmt die UI) —————
  function zuRaum(index) {
    if (index === aktuellerRaum() && !fokus) return;
    callbacks.saalwechsel(index, () => teleportiere(index));
  }

  function teleportiere(index) {
    // Ein offenes Werk-Panel würde sonst mit veraltetem Werk stehen bleiben
    // und der Sheet-ViewOffset ohne Fokus aktiv bleiben.
    if (fokus) callbacks.schliessePanel();
    fokusVerlassen();
    gehZiel = null;
    vel.set(0, 0);
    yawVel = 0;
    camera.position.set(raumZentrumX(index), B.augenhoehe, RAUM_T * 0.3);
    yaw = zielYaw = 0;
    pitch = zielPitch = 0;
    camera.rotation.set(0, 0, 0);
  }

  // ————— Update pro Frame —————
  let gazeTakt = 0;

  function update(dt) {
    if (!aktiv) return;

    // Blick-Trägheit + Nachschwingen
    if (yawVel !== 0) {
      zielYaw += yawVel * dt;
      yawVel *= Math.exp(-B.drehnachlauf * dt);
      if (Math.abs(yawVel) < 0.01) yawVel = 0;
    }
    const g = 1 - Math.exp(-B.drehglaettung * dt);
    yaw += (zielYaw - yaw) * g;
    // Auch nach einer Kamerafahrt (die zielt exakt auf die Bildmitte) läuft
    // der Blick von selbst wieder in den erlaubten Bereich zurück
    zielPitch = begrenzePitch(zielPitch);
    pitch += (zielPitch - pitch) * g;

    if (tween) {
      tween.t += dt / tween.dauer;
      const k = Math.min(tween.t, 1);
      const s = k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2; // easeInOutQuint
      camera.position.lerpVectors(
        tween.p0.clone().lerp(tween.p1, s),
        tween.p1.clone().lerp(tween.p2, s),
        s
      );
      yaw = zielYaw = THREE.MathUtils.lerp(tween.vonYaw, tween.nachYaw, s);
      pitch = zielPitch = THREE.MathUtils.lerp(tween.vonPitch, tween.nachPitch, s);
      camera.rotation.set(pitch, yaw, 0);
      if (tween.t >= 1) tween = null;
      tempoFaktor = 0;
      return;
    }

    if (fokus) {
      // Kontemplations-Drift: die Kamera atmet minimal
      if (fokusStand && !REDUZIERTE_BEWEGUNG) {
        fokusZeit += dt;
        camera.position.copy(fokusStand).addScaledVector(fokusSeite, Math.sin(fokusZeit * 0.28) * 0.012);
      }
      camera.rotation.set(pitch, yaw, 0);
      tempoFaktor = 0;
      return;
    }

    // Wunschrichtung: Tasten > Joystick > Klickziel
    const wunsch = new THREE.Vector2();
    let vor = 0;
    let seit = 0;
    if (tasten.has("KeyW") || tasten.has("ArrowUp")) vor += 1;
    if (tasten.has("KeyS") || tasten.has("ArrowDown")) vor -= 1;
    if (tasten.has("KeyA") || tasten.has("ArrowLeft")) seit -= 1;
    if (tasten.has("KeyD") || tasten.has("ArrowRight")) seit += 1;
    if (!vor && !seit && (joy.x || joy.y)) {
      vor = -joy.y; // Stick oben = vorwärts
      seit = joy.x;
    }

    let zielTempo = B.gehtempo;
    const mag = Math.min(1, Math.hypot(vor, seit));
    if (mag > 0) {
      gehZiel = null;
      const inv = 1 / Math.hypot(vor, seit);
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      // analog: halbe Stick-Auslenkung = halbes Tempo
      wunsch.set((-sin * vor + cos * seit) * inv * mag, (-cos * vor - sin * seit) * inv * mag);
    } else if (gehZiel) {
      const dx = gehZiel.x - camera.position.x;
      const dz = gehZiel.z - camera.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.25) {
        gehZiel = null;
      } else {
        if (dist < 1) zielTempo = THREE.MathUtils.lerp(0.6, B.gehtempo, dist);
        wunsch.set((dx / dist) * (zielTempo / B.gehtempo), (dz / dist) * (zielTempo / B.gehtempo));
      }
    }

    wunsch.multiplyScalar(B.gehtempo);
    const anfahren = 1 - Math.exp(-B.beschleunigung * dt);
    const ausrollen = 1 - Math.exp(-B.daempfung * dt);
    vel.lerp(wunsch, wunsch.lengthSq() > 0 ? anfahren : ausrollen);

    if (vel.lengthSq() > 1e-6) {
      const blockiert = bewege(vel.x * dt, vel.y * dt);
      if (blockiert.bx) vel.x = 0;
      if (blockiert.bz) vel.y = 0;
      if (blockiert.bx && blockiert.bz) gehZiel = null;
    }

    // Head-Bob + Schritte
    tempoFaktor = vel.length() / B.gehtempo;
    let yOff = 0;
    let roll = 0;
    if (!REDUZIERTE_BEWEGUNG && tempoFaktor > 0.02) {
      bobPhase += Math.PI * 2 * B.bobFrequenz * tempoFaktor * dt;
      const s = Math.sin(bobPhase);
      yOff = s * B.bobAmplitude * tempoFaktor;
      roll = Math.sin(bobPhase * 0.5) * B.bobRolle * tempoFaktor;
      if (s > 0.2) schrittGespannt = true;
      if (schrittGespannt && s < -0.85 && tempoFaktor > 0.25) {
        schrittGespannt = false;
        schrittFuss = !schrittFuss;
        callbacks.schritt?.(schrittFuss, tempoFaktor);
      }
    }
    camera.position.y = B.augenhoehe + yOff;
    camera.rotation.set(pitch, yaw, roll);

    // Blick-Label (Touch-Ersatz für Hover), gedrosselt auf ~6 Hz
    if (IST_TOUCH) {
      gazeTakt += dt;
      if (gazeTakt >= 0.16) {
        gazeTakt = 0;
        const t = trefferUnterZeiger(window.innerWidth / 2, window.innerHeight / 2);
        const neu = t && t.typ === "werk" && t.hit.distance < 6.5 ? t.hit.object.userData.werkId : null;
        if (neu !== hoverId) {
          hoverId = neu;
          callbacks.hover(neu, 0, 0);
        }
      }
    }

    // Marker ein-/ausblenden
    markerAlter += dt;
    if (gehZiel) {
      const puls = 1 + Math.sin(markerAlter * 6) * 0.06;
      marker.scale.setScalar(Math.max(1.5 - markerAlter * 2.5, 1) * puls);
      marker.material.opacity = Math.min(markerAlter * 5, 0.85);
    } else {
      marker.material.opacity = Math.max(marker.material.opacity - dt * 3, 0);
    }
  }

  function naechsterRaumZuX(x) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < raeume.length; i++) {
      const d = Math.abs(x - raumZentrumX(i));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function aktuellerRaum() {
    return naechsterRaumZuX(camera.position.x);
  }

  // Portrait: vertikales FOV anheben, damit das horizontale Sichtfeld reicht
  function basisFov() {
    if (camera.aspect >= 1) return B.fovBasis;
    const hZiel = THREE.MathUtils.degToRad(KONFIG.mobil.hFovZielGrad);
    const vNoetig = 2 * Math.atan(Math.tan(hZiel / 2) / camera.aspect);
    return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vNoetig), B.fovBasis, 80);
  }

  function fovZiel() {
    const basis = basisFov();
    if (fokus) return camera.aspect < 1 ? basis - 10 : B.fovFokus;
    return basis + (B.fovGehen - B.fovBasis) * Math.min(tempoFaktor, 1);
  }

  return {
    update,
    fokussiere,
    fokusVerlassen,
    zuRaum,
    teleportiere,
    aktuellerRaum,
    fovZiel,
    joy,
    setzeSheetOffset,
    wendeSheetOffsetAn,
    tempo: () => tempoFaktor,
    imFokus: () => !!fokus,
    starte() {
      aktiv = true;
    },
    setzeBlick(y, p) {
      yaw = zielYaw = y;
      pitch = zielPitch = p;
      camera.rotation.set(pitch, yaw, 0);
    },
  };
}
