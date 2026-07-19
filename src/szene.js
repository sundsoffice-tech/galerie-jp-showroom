// Szene — baut die Galerie prozedural aus den Katalogdaten.
// Inszenierung „Privatführung nach Schließung": dunkle Säle, jedes Werk
// in seiner warmen Lichtinsel. Räume entstehen aus raeume[], Werke werden
// automatisch gehängt — neue Werke in werke.json => neue Hängung, ohne Code.

import * as THREE from "three";
import { raeume, werkeImRaum, bildQuelle, galerie } from "./katalog.js";
import { KONFIG, TIER } from "./konfig.js";
import {
  alsTextur,
  putzCanvas,
  fischgraetCanvas,
  lichtinselCanvas,
  bodenPoolCanvas,
  rahmenSchattenCanvas,
  kontaktStreifenCanvas,
  plakettenCanvas,
} from "./texturen.js";
import { erstelleBeleuchtung } from "./beleuchtung.js";
import {
  erstelleStrahler,
  erstelleBank,
  erstellePodest,
  erstelleSaaltafel,
  erstelleLettering,
} from "./moebel.js";

export const RAUM_B = KONFIG.raum.breite;
export const RAUM_T = KONFIG.raum.tiefe;
export const RAUM_H = KONFIG.raum.hoehe;
const WAND_D = KONFIG.raum.wandstaerke;
const TUER_B = KONFIG.raum.tuerBreite;
const TUER_H = KONFIG.raum.tuerHoehe;
const AUGE = KONFIG.besucher.augenhoehe;

export function raumZentrumX(index) {
  return index * (RAUM_B + WAND_D);
}

function stilVon(raum) {
  return KONFIG.saalStile[raum.id] || KONFIG.saalStile.standard;
}

function cssFarbe(hex) {
  return "#" + hex.toString(16).padStart(6, "0");
}

export function erstelleSzene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: TIER === "B" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER === "A" ? 2 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = KONFIG.licht.belichtungIntro;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060504);
  scene.fog = new THREE.Fog(0x060504, 26, 72);

  const camera = new THREE.PerspectiveCamera(
    KONFIG.besucher.fovBasis,
    window.innerWidth / window.innerHeight,
    0.05,
    120
  );
  camera.rotation.order = "YXZ";
  camera.position.set(raumZentrumX(0), AUGE, RAUM_T * 0.32);

  const anzahl = raeume.length;
  const gesamtB = anzahl * RAUM_B + (anzahl - 1) * WAND_D;
  const minX = -RAUM_B / 2 - WAND_D;
  const maxX = minX + gesamtB + 2 * WAND_D;
  const mitteX = (minX + maxX) / 2;

  const beleuchtung = erstelleBeleuchtung(scene, renderer, raeume, raumZentrumX);
  let zuendReihe = 0; // Reihenfolge, in der die Lichter beim Eintritt zünden

  // ————— Boden: Fischgrät-Eiche —————
  const parkett = fischgraetCanvas();
  const bodenTex = alsTextur(parkett.farbe, { wiederholend: true });
  bodenTex.repeat.set(gesamtB / 3, RAUM_T / 3);
  bodenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const bodenRau = new THREE.CanvasTexture(parkett.rauheit);
  bodenRau.wrapS = bodenRau.wrapT = THREE.RepeatWrapping;
  bodenRau.repeat.copy(bodenTex.repeat);
  const bodenMat =
    TIER === "A"
      ? new THREE.MeshPhysicalMaterial({
          map: bodenTex,
          roughnessMap: bodenRau,
          roughness: 0.65,
          clearcoat: 0.15,
          clearcoatRoughness: 0.6,
          envMapIntensity: 0.35,
        })
      : new THREE.MeshStandardMaterial({
          map: bodenTex,
          roughnessMap: bodenRau,
          roughness: 0.65,
          envMapIntensity: 0.35,
        });
  const boden = new THREE.Mesh(
    new THREE.PlaneGeometry(gesamtB + 2 * WAND_D, RAUM_T + 2 * WAND_D),
    bodenMat
  );
  boden.rotation.x = -Math.PI / 2;
  boden.position.set(mitteX, 0, 0);
  boden.name = "boden";
  scene.add(boden);

  // Kontaktschatten Wand→Boden
  const streifenTex = alsTextur(kontaktStreifenCanvas());
  function bodenSchatten(laenge, x, z, rotZ) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(laenge, 0.55),
      new THREE.MeshBasicMaterial({ map: streifenTex, transparent: true, depthWrite: false, opacity: 0.65 })
    );
    m.rotation.set(-Math.PI / 2, 0, rotZ);
    m.position.set(x, 0.004, z);
    scene.add(m);
  }
  bodenSchatten(gesamtB, mitteX, -RAUM_T / 2 + 0.275, 0);
  bodenSchatten(gesamtB, mitteX, RAUM_T / 2 - 0.275, Math.PI);
  bodenSchatten(RAUM_T, minX + WAND_D + 0.275, 0, Math.PI / 2);
  bodenSchatten(RAUM_T, maxX - WAND_D - 0.275, 0, -Math.PI / 2);

  // ————— Decke: dunkel, fast unsichtbar —————
  const decke = new THREE.Mesh(
    new THREE.PlaneGeometry(gesamtB + 2 * WAND_D, RAUM_T + 2 * WAND_D),
    new THREE.MeshStandardMaterial({ color: 0x14110d, roughness: 0.95 })
  );
  decke.rotation.x = Math.PI / 2;
  decke.position.set(mitteX, RAUM_H, 0);
  scene.add(decke);

  // ————— Wände: Putz, Saalfarbe pro Segment —————
  const saalWandMat = raeume.map((raum) => {
    const stil = stilVon(raum);
    const tex = alsTextur(putzCanvas(cssFarbe(stil.wand)));
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(RAUM_B / 2.4, 1);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, envMapIntensity: 0.15 });
  });
  const sockelMat = new THREE.MeshStandardMaterial({ color: 0x24221e, roughness: 0.45, metalness: 0.1 });
  const fugeMat = new THREE.MeshBasicMaterial({ color: 0x0a0908 });

  function wandBox(material, w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }

  function sockelUndFuge(laenge, x, z, rotY) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(laenge, 0.11, 0.035), sockelMat);
    s.rotation.y = rotY;
    s.position.set(x, 0.055, z);
    scene.add(s);
    const f = new THREE.Mesh(new THREE.BoxGeometry(laenge, 0.02, 0.037), fugeMat);
    f.rotation.y = rotY;
    f.position.set(x, 0.12, z);
    scene.add(f);
  }

  // Längswände Nord/Süd — ein Segment pro Saal (eigene Saalfarbe)
  raeume.forEach((raum, i) => {
    const cx = raumZentrumX(i);
    const start = i === 0 ? minX : cx - RAUM_B / 2 - WAND_D / 2;
    const ende = i === anzahl - 1 ? maxX : cx + RAUM_B / 2 + WAND_D / 2;
    const laenge = ende - start;
    const mx = (start + ende) / 2;
    wandBox(saalWandMat[i], laenge, RAUM_H, WAND_D, mx, RAUM_H / 2, -RAUM_T / 2 - WAND_D / 2);
    wandBox(saalWandMat[i], laenge, RAUM_H, WAND_D, mx, RAUM_H / 2, RAUM_T / 2 + WAND_D / 2);
    sockelUndFuge(laenge, mx, -RAUM_T / 2 + 0.02, 0);
    sockelUndFuge(laenge, mx, RAUM_T / 2 - 0.02, 0);
  });
  // Stirnwände
  wandBox(saalWandMat[0], WAND_D, RAUM_H, RAUM_T, minX + WAND_D / 2, RAUM_H / 2, 0);
  wandBox(saalWandMat[anzahl - 1], WAND_D, RAUM_H, RAUM_T, maxX - WAND_D / 2, RAUM_H / 2, 0);
  sockelUndFuge(RAUM_T, minX + WAND_D + 0.02, 0, Math.PI / 2);
  sockelUndFuge(RAUM_T, maxX - WAND_D - 0.02, 0, Math.PI / 2);

  // Galerie-Wortmarke in Messing auf der Eingangs-Stirnwand
  erstelleLettering(scene, galerie.name.toUpperCase(), {
    x: minX + WAND_D + 0.02,
    y: RAUM_H - 0.85,
    z: 0,
    ry: Math.PI / 2,
    hoeheM: 0.42,
    messing: true,
    schrift: '300 120px "Cormorant Garamond", Georgia, serif',
  });

  // Innenwände: zwei Halbschalen, damit jeder Saal seine Farbe behält
  const rahmenMatTuer = new THREE.MeshStandardMaterial({ color: 0x2a251d, roughness: 0.4, metalness: 0.15 });
  for (let i = 0; i < anzahl - 1; i++) {
    const wx = raumZentrumX(i) + RAUM_B / 2 + WAND_D / 2;
    const seite = (RAUM_T - TUER_B) / 2;
    for (const [material, dx] of [
      [saalWandMat[i], -WAND_D / 4],
      [saalWandMat[i + 1], WAND_D / 4],
    ]) {
      wandBox(material, WAND_D / 2, RAUM_H, seite, wx + dx, RAUM_H / 2, -RAUM_T / 2 + seite / 2);
      wandBox(material, WAND_D / 2, RAUM_H, seite, wx + dx, RAUM_H / 2, RAUM_T / 2 - seite / 2);
      wandBox(material, WAND_D / 2, RAUM_H - TUER_H, TUER_B, wx + dx, TUER_H + (RAUM_H - TUER_H) / 2, 0);
    }
    for (const s of [-1, 1]) {
      sockelUndFuge(seite, wx + s * (WAND_D / 2 + 0.015), -RAUM_T / 2 + seite / 2, Math.PI / 2);
      sockelUndFuge(seite, wx + s * (WAND_D / 2 + 0.015), RAUM_T / 2 - seite / 2, Math.PI / 2);
    }
    for (const zs of [-TUER_B / 2, TUER_B / 2]) {
      const pfosten = new THREE.Mesh(new THREE.BoxGeometry(WAND_D + 0.07, TUER_H, 0.09), rahmenMatTuer);
      pfosten.position.set(wx, TUER_H / 2, zs);
      scene.add(pfosten);
    }
    const sturz = new THREE.Mesh(new THREE.BoxGeometry(WAND_D + 0.07, 0.09, TUER_B + 0.09), rahmenMatTuer);
    sturz.position.set(wx, TUER_H + 0.045, 0);
    scene.add(sturz);

    // Beschriftung über der Tür: wohin führt sie? (Farbe je Saalseite)
    erstelleLettering(scene, `${raeume[i + 1].saal} — ${raeume[i + 1].name}`.toUpperCase(), {
      x: wx - WAND_D / 2 - 0.012,
      y: TUER_H + (RAUM_H - TUER_H) / 2,
      z: 0,
      ry: -Math.PI / 2,
      hoeheM: 0.14,
      farbe: hexZuRgba(stilVon(raeume[i]).lettering, 0.85),
    });
    erstelleLettering(scene, `${raeume[i].saal} — ${raeume[i].name}`.toUpperCase(), {
      x: wx + WAND_D / 2 + 0.012,
      y: TUER_H + (RAUM_H - TUER_H) / 2,
      z: 0,
      ry: Math.PI / 2,
      hoeheM: 0.14,
      farbe: hexZuRgba(stilVon(raeume[i + 1]).lettering, 0.85),
    });

    // Saaltafel des nächsten Saals neben der Tür (auf dessen Seite)
    erstelleSaaltafel(scene, raeume[i + 1], wx + WAND_D / 2 + 0.012, -TUER_B / 2 - 0.85, Math.PI / 2);
  }
  // Saaltafel des ersten Saals nahe dem Startpunkt (Südwand, links)
  erstelleSaaltafel(scene, raeume[0], raumZentrumX(0) - RAUM_B / 2 + 1.05, RAUM_T / 2 - 0.012, Math.PI);

  // ————— Möblierung + Verbotszonen —————
  const verboten = [];
  raeume.forEach((raum, i) => {
    verboten.push(erstelleBank(scene, raumZentrumX(i), 0.95, stilVon(raum).bank));
  });
  if (anzahl > 1) {
    const p = erstellePodest(
      scene,
      raumZentrumX(1) + 4.5,
      -2.5,
      saalWandMat[1],
      beleuchtung.registriere,
      zuendReihe++
    );
    verboten.push(p.zone);
    var podestObjekt = p.objekt;
  }

  // ————— Werke hängen —————
  const kunstwerke = new Map();
  const klickbare = [];
  const inselTex = alsTextur(lichtinselCanvas());
  const poolTex = alsTextur(bodenPoolCanvas());
  const schattenStreifTex = alsTextur(rahmenSchattenCanvas());

  raeume.forEach((raum, ri) => {
    const cx = raumZentrumX(ri);
    const stil = stilVon(raum);
    const sLaengs = KONFIG.haengung.plaetzeLaengswand;
    const sStirn = KONFIG.haengung.plaetzeStirnwand;
    const waende = [
      { slots: sLaengs, laenge: RAUM_B - 2.5, ry: 0, basis: new THREE.Vector3(cx, 0, -RAUM_T / 2), achse: "x" },
      { slots: sLaengs, laenge: RAUM_B - 2.5, ry: Math.PI, basis: new THREE.Vector3(cx, 0, RAUM_T / 2), achse: "x" },
    ];
    if (ri === 0) {
      waende.push({ slots: sStirn, laenge: RAUM_T - 2.5, ry: Math.PI / 2, basis: new THREE.Vector3(cx - RAUM_B / 2, 0, 0), achse: "z" });
    }
    if (ri === anzahl - 1) {
      waende.push({ slots: sStirn, laenge: RAUM_T - 2.5, ry: -Math.PI / 2, basis: new THREE.Vector3(cx + RAUM_B / 2, 0, 0), achse: "z" });
    }

    const liste = werkeImRaum(raum.id);
    const kapazitaet = waende.reduce((s, w) => s + w.slots, 0);
    if (liste.length > kapazitaet) {
      console.warn(
        `Raum "${raum.name}": ${liste.length} Werke, aber nur ${kapazitaet} Plätze — überzählige Werke werden nicht gehängt.`
      );
    }

    const belegung = waende.map(() => []);
    let wi = 0;
    for (const werk of liste.slice(0, kapazitaet)) {
      let versuche = 0;
      while (belegung[wi].length >= waende[wi].slots && versuche < waende.length) {
        wi = (wi + 1) % waende.length;
        versuche++;
      }
      belegung[wi].push(werk);
      wi = (wi + 1) % waende.length;
    }

    waende.forEach((wand, idx) => {
      const anzahlWand = belegung[idx].length;
      belegung[idx].forEach((werk, k) => {
        const t = (k + 1) / (anzahlWand + 1) - 0.5;
        const offset = t * wand.laenge;
        const pos = wand.basis.clone();
        if (wand.achse === "x") pos.x += offset;
        else pos.z += offset;
        haengeWerk(werk, raum, stil, pos, wand.ry);
      });
    });
  });

  function haengeWerk(werk, raum, stil, wandPunkt, ry) {
    const b = werk.breite_cm / 100;
    const h = werk.hoehe_cm / 100;
    const istFoto = raum.id === "fotografie";
    const bildY = AUGE + h * 0.05;

    const gruppe = new THREE.Group();
    gruppe.position.copy(wandPunkt);
    gruppe.position.y = bildY;
    gruppe.rotation.y = ry;
    scene.add(gruppe);

    // 1) Lichtinsel an der Wand (Zentrum 10 % über Bildmitte)
    const inselMat = new THREE.MeshBasicMaterial({
      map: inselTex,
      transparent: true,
      opacity: KONFIG.licht.poolWand * stil.poolFaktor,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const insel = new THREE.Mesh(new THREE.PlaneGeometry(b * 2.2, h * 1.9), inselMat);
    insel.position.set(0, h * 0.1, 0.004);
    gruppe.add(insel);
    beleuchtung.registriere(inselMat, KONFIG.licht.poolWand * stil.poolFaktor, zuendReihe);

    // 2) Schlagschatten unter der Rahmenunterkante
    const schattenMat = new THREE.MeshBasicMaterial({
      map: schattenStreifTex,
      transparent: true,
      opacity: KONFIG.licht.schattenRahmen,
      depthWrite: false,
    });
    const schatten = new THREE.Mesh(new THREE.PlaneGeometry(b * 1.06 + 0.16, 0.22), schattenMat);
    schatten.position.set(0, -(h / 2) - 0.19, 0.005);
    gruppe.add(schatten);

    // 3) Boden-Lichtpool vor dem Werk
    const poolMat = new THREE.MeshBasicMaterial({
      map: poolTex,
      transparent: true,
      opacity: KONFIG.licht.poolBoden * stil.poolFaktor,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(b * 1.7 + 0.4, 1.1), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, -bildY + 0.006, 0.75);
    gruppe.add(pool);
    beleuchtung.registriere(poolMat, KONFIG.licht.poolBoden * stil.poolFaktor, zuendReihe);

    // Bildtextur
    const q = bildQuelle(werk);
    let textur;
    if (q.typ === "canvas") textur = new THREE.CanvasTexture(q.wert);
    else textur = new THREE.TextureLoader().load(q.wert);
    textur.colorSpace = THREE.SRGBColorSpace;
    textur.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Rahmen als echter Ring aus vier Leisten (eine Box würde das Bild verdecken)
    function rahmenRing(innenB, innenH, dicke, tiefe, material, z) {
      const ring = new THREE.Group();
      const oben = new THREE.Mesh(new THREE.BoxGeometry(innenB + dicke * 2, dicke, tiefe), material);
      oben.position.set(0, innenH / 2 + dicke / 2, 0);
      const unten = oben.clone();
      unten.position.y = -(innenH / 2 + dicke / 2);
      const links = new THREE.Mesh(new THREE.BoxGeometry(dicke, innenH, tiefe), material);
      links.position.set(-(innenB / 2 + dicke / 2), 0, 0);
      const rechts = links.clone();
      rechts.position.x = innenB / 2 + dicke / 2;
      ring.add(oben, unten, links, rechts);
      ring.position.z = z;
      gruppe.add(ring);
      return ring;
    }

    let bild;
    let rahmenBreite;
    if (istFoto) {
      // Foto: schwarzer Metallrahmen-Ring, Passepartout, Museumsglas (Tier A)
      const pp = 0.09;
      rahmenBreite = b + pp * 2 + 0.056;
      const schwarz = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.35, metalness: 0.3 });
      rahmenRing(b + pp * 2, h + pp * 2, 0.028, 0.045, schwarz, 0.028);
      const passepartout = new THREE.Mesh(
        new THREE.PlaneGeometry(b + pp * 2, h + pp * 2),
        new THREE.MeshStandardMaterial({ color: 0xf4f1e9, roughness: 0.9 })
      );
      passepartout.position.z = 0.03;
      gruppe.add(passepartout);
      bild = new THREE.Mesh(new THREE.PlaneGeometry(b, h), new THREE.MeshBasicMaterial({ map: textur }));
      bild.position.z = 0.033;
      gruppe.add(bild);
      if (TIER === "A") {
        const glas = new THREE.Mesh(
          new THREE.PlaneGeometry(b + pp * 2, h + pp * 2),
          new THREE.MeshStandardMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.05,
            roughness: 0.05,
            metalness: 1,
            envMapIntensity: 1.2,
            depthWrite: false,
          })
        );
        glas.position.z = 0.048;
        gruppe.add(glas);
      }
    } else {
      // Malerei: Nussbaum-Ring mit Messing-Sichtleiste, Bild leicht zurückversetzt
      rahmenBreite = b + 0.16;
      const nussbaum = new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 0.4, metalness: 0.1 });
      const messingMat = new THREE.MeshStandardMaterial({ color: 0xc2a36b, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.0 });
      rahmenRing(b + 0.03, h + 0.03, 0.065, 0.06, nussbaum, 0.032);
      rahmenRing(b, h, 0.016, 0.052, messingMat, 0.04);
      // dunkler Falz hinter dem Bild (füllt den Spalt zur Wand)
      const falz = new THREE.Mesh(
        new THREE.PlaneGeometry(b + 0.04, h + 0.04),
        new THREE.MeshBasicMaterial({ color: 0x120e09 })
      );
      falz.position.z = 0.012;
      gruppe.add(falz);
      bild = new THREE.Mesh(new THREE.PlaneGeometry(b, h), new THREE.MeshBasicMaterial({ map: textur }));
      bild.position.z = 0.024;
      gruppe.add(bild);
    }
    bild.userData = { werkId: werk.id, breite: b, hoehe: h };
    // unsichtbare Klickfläche über dem gesamten Rahmen
    const klickflaeche = new THREE.Mesh(
      new THREE.PlaneGeometry(rahmenBreite, h + 0.2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    klickflaeche.position.z = 0.09;
    klickflaeche.userData = { werkId: werk.id, breite: b, hoehe: h };
    gruppe.add(klickflaeche);
    klickbare.push(bild, klickflaeche);

    // Plakette rechts neben dem Werk
    const plakette = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.2),
      new THREE.MeshBasicMaterial({ map: alsTextur(plakettenCanvas(werk)) })
    );
    plakette.position.set(b / 2 + 0.42, -h * 0.16, 0.012);
    plakette.userData = { werkId: werk.id, istPlakette: true };
    gruppe.add(plakette);
    klickbare.push(plakette);

    // Strahler + Kegel von der Deckenschiene
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, ry, 0));
    erstelleStrahler(
      scene,
      new THREE.Vector3(wandPunkt.x, bildY, wandPunkt.z),
      normal,
      b,
      beleuchtung.registriere,
      zuendReihe
    );
    zuendReihe++;

    kunstwerke.set(werk.id, { gruppe, flaeche: bild, normal, plakette, werk, raum });
  }

  function aktualisiereVerkauft(werkId) {
    const e = kunstwerke.get(werkId);
    if (!e) return;
    e.werk.verkauft = true;
    e.plakette.material.map?.dispose();
    e.plakette.material.map = alsTextur(plakettenCanvas(e.werk));
    e.plakette.material.needsUpdate = true;
  }

  // ————— Kollision —————
  const erlaubt = [];
  for (let i = 0; i < anzahl; i++) {
    const cx = raumZentrumX(i);
    erlaubt.push({
      minX: cx - RAUM_B / 2 + 0.55,
      maxX: cx + RAUM_B / 2 - 0.55,
      minZ: -RAUM_T / 2 + 0.55,
      maxZ: RAUM_T / 2 - 0.55,
    });
    if (i < anzahl - 1) {
      erlaubt.push({
        minX: cx + RAUM_B / 2 - 0.6,
        maxX: raumZentrumX(i + 1) - RAUM_B / 2 + 0.6,
        minZ: -TUER_B / 2 + 0.35,
        maxZ: TUER_B / 2 - 0.35,
      });
    }
  }

  // Belichtungs-Ziel: der Render-Loop blendet weich dorthin
  const belichtung = { ziel: KONFIG.licht.belichtungIntro };

  return {
    renderer,
    scene,
    camera,
    boden,
    klickbare,
    kunstwerke,
    erlaubt,
    verboten,
    aktualisiereVerkauft,
    belichtung,
    beleuchtung,
    podestObjekt,
  };
}

function hexZuRgba(css, alpha) {
  // css ist bereits ein CSS-String ("#ede7dc") aus konfig.saalStile.lettering
  const c = css.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
