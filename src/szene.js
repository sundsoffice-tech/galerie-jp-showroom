// Szene — baut die Galerie prozedural aus den Katalogdaten.
// Räume entstehen aus raeume[], Werke werden automatisch gehängt:
// Wände haben Slots, der Hänge-Algorithmus verteilt die Werke
// gleichmäßig. Neue Werke in werke.json => neue Hängung, ohne Code.

import * as THREE from "three";
import { raeume, werkeImRaum, bildQuelle, formatPreis } from "./katalog.js";
import { KONFIG } from "./konfig.js";

export const RAUM_B = KONFIG.raum.breite;
export const RAUM_T = KONFIG.raum.tiefe;
export const RAUM_H = KONFIG.raum.hoehe;
const WAND_D = KONFIG.raum.wandstaerke;
const TUER_B = KONFIG.raum.tuerBreite;
const TUER_H = KONFIG.raum.tuerHoehe;
const AUGE = KONFIG.besucher.augenhoehe; // Aufhänge- und Augenhöhe

export function raumZentrumX(index) {
  return index * (RAUM_B + WAND_D);
}

export function erstelleSzene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = KONFIG.licht.belichtung;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(KONFIG.farben.hintergrund);
  scene.fog = new THREE.Fog(KONFIG.farben.hintergrund, 26, 70);

  const camera = new THREE.PerspectiveCamera(
    60,
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

  // ————— Licht —————
  scene.add(new THREE.HemisphereLight(0xfff3e0, 0x1c1813, KONFIG.licht.grundlicht));
  for (let i = 0; i < anzahl; i++) {
    const p = new THREE.PointLight(0xffe7c4, KONFIG.licht.saalPunktlicht, RAUM_B * 1.4, 2);
    p.position.set(raumZentrumX(i), RAUM_H - 0.5, 0);
    scene.add(p);
  }

  // ————— Boden (Eiche, prozedural) —————
  const bodenTex = new THREE.CanvasTexture(holzCanvas());
  bodenTex.colorSpace = THREE.SRGBColorSpace;
  bodenTex.wrapS = bodenTex.wrapT = THREE.RepeatWrapping;
  bodenTex.repeat.set(gesamtB / 4, RAUM_T / 4);
  bodenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const boden = new THREE.Mesh(
    new THREE.PlaneGeometry(gesamtB + 2 * WAND_D, RAUM_T + 2 * WAND_D),
    new THREE.MeshStandardMaterial({ map: bodenTex, roughness: 0.55, metalness: 0.05 })
  );
  boden.rotation.x = -Math.PI / 2;
  boden.position.set((minX + maxX) / 2, 0, 0);
  boden.name = "boden";
  scene.add(boden);

  // ————— Decke —————
  const decke = new THREE.Mesh(
    new THREE.PlaneGeometry(gesamtB + 2 * WAND_D, RAUM_T + 2 * WAND_D),
    new THREE.MeshStandardMaterial({ color: KONFIG.farben.decke, roughness: 0.95 })
  );
  decke.rotation.x = Math.PI / 2;
  decke.position.set((minX + maxX) / 2, RAUM_H, 0);
  scene.add(decke);

  // Lichtbänder an der Decke
  for (let i = 0; i < anzahl; i++) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(RAUM_B * 0.55, 0.04, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xfff0d8 })
    );
    band.position.set(raumZentrumX(i), RAUM_H - 0.03, 0);
    scene.add(band);
  }

  // ————— Wände —————
  const wandMat = new THREE.MeshStandardMaterial({ color: KONFIG.farben.wand, roughness: 0.92 });
  const sockelMat = new THREE.MeshStandardMaterial({ color: KONFIG.farben.sockel, roughness: 0.6 });

  function wandBox(w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wandMat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }

  // Längswände Nord/Süd über die gesamte Galerie
  wandBox(gesamtB + 2 * WAND_D, RAUM_H, WAND_D, (minX + maxX) / 2, RAUM_H / 2, -RAUM_T / 2 - WAND_D / 2);
  wandBox(gesamtB + 2 * WAND_D, RAUM_H, WAND_D, (minX + maxX) / 2, RAUM_H / 2, RAUM_T / 2 + WAND_D / 2);
  // Stirnwände West/Ost
  wandBox(WAND_D, RAUM_H, RAUM_T, minX + WAND_D / 2, RAUM_H / 2, 0);
  wandBox(WAND_D, RAUM_H, RAUM_T, maxX - WAND_D / 2, RAUM_H / 2, 0);

  // Sockelleisten Nord/Süd
  for (const z of [-RAUM_T / 2 + 0.02, RAUM_T / 2 - 0.02]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(gesamtB, 0.12, 0.03), sockelMat);
    s.position.set((minX + maxX) / 2, 0.06, z);
    scene.add(s);
  }

  // Innenwände mit Türöffnung + Türrahmen
  for (let i = 0; i < anzahl - 1; i++) {
    const wx = raumZentrumX(i) + RAUM_B / 2 + WAND_D / 2;
    const seite = (RAUM_T - TUER_B) / 2;
    wandBox(WAND_D, RAUM_H, seite, wx, RAUM_H / 2, -RAUM_T / 2 + seite / 2);
    wandBox(WAND_D, RAUM_H, seite, wx, RAUM_H / 2, RAUM_T / 2 - seite / 2);
    wandBox(WAND_D, RAUM_H - TUER_H, TUER_B, wx, TUER_H + (RAUM_H - TUER_H) / 2, 0);
    // schmaler dunkler Türrahmen
    const rahmenMat = new THREE.MeshStandardMaterial({ color: KONFIG.farben.tuerrahmen, roughness: 0.5 });
    for (const zs of [-TUER_B / 2, TUER_B / 2]) {
      const pfosten = new THREE.Mesh(new THREE.BoxGeometry(WAND_D + 0.06, TUER_H, 0.08), rahmenMat);
      pfosten.position.set(wx, TUER_H / 2, zs);
      scene.add(pfosten);
    }
    const sturz = new THREE.Mesh(new THREE.BoxGeometry(WAND_D + 0.06, 0.08, TUER_B + 0.08), rahmenMat);
    sturz.position.set(wx, TUER_H + 0.04, 0);
    scene.add(sturz);
  }

  // ————— Werke hängen —————
  const kunstwerke = new Map(); // id -> { gruppe, flaeche, normal, plakette }
  const klickbare = [];

  raeume.forEach((raum, ri) => {
    const cx = raumZentrumX(ri);
    const zN = -RAUM_T / 2 - WAND_D / 2 + WAND_D / 2; // Innenfläche Nord
    // Wanddefinitionen: Position + Blickrichtung + nutzbare Länge + max. Plätze
    const sLaengs = KONFIG.haengung.plaetzeLaengswand;
    const sStirn = KONFIG.haengung.plaetzeStirnwand;
    const waende = [
      { slots: sLaengs, laenge: RAUM_B - 2.5, ry: 0, basis: new THREE.Vector3(cx, 0, -RAUM_T / 2), achse: "x" },
      { slots: sLaengs, laenge: RAUM_B - 2.5, ry: Math.PI, basis: new THREE.Vector3(cx, 0, RAUM_T / 2), achse: "x" },
    ];
    if (ri === 0) {
      waende.push({ slots: sStirn, laenge: RAUM_T - 2.5, ry: Math.PI / 2, basis: new THREE.Vector3(cx - RAUM_B / 2, 0, 0), achse: "z" });
    }
    if (ri === raeume.length - 1) {
      waende.push({ slots: sStirn, laenge: RAUM_T - 2.5, ry: -Math.PI / 2, basis: new THREE.Vector3(cx + RAUM_B / 2, 0, 0), achse: "z" });
    }

    const liste = werkeImRaum(raum.id);
    const kapazitaet = waende.reduce((s, w) => s + w.slots, 0);
    if (liste.length > kapazitaet) {
      console.warn(
        `Raum "${raum.name}": ${liste.length} Werke, aber nur ${kapazitaet} Plätze — überzählige Werke werden nicht gehängt.`
      );
    }

    // Round-Robin auf die Wände verteilen
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
        const t = (k + 1) / (anzahlWand + 1) - 0.5; // -0.5..0.5
        const offset = t * wand.laenge;
        const pos = wand.basis.clone();
        if (wand.achse === "x") pos.x += offset;
        else pos.z += offset;
        const gruppe = haengeWerk(werk, raum, pos, wand.ry);
        scene.add(gruppe);
      });
    });
  });

  function haengeWerk(werk, raum, wandPunkt, ry) {
    const b = werk.breite_cm / 100;
    const h = werk.hoehe_cm / 100;
    const istFoto = raum.id === "fotografie";
    const rahmenB = istFoto ? 0.035 : 0.06;
    const rahmenT = istFoto ? 0.04 : 0.07;

    const gruppe = new THREE.Group();
    gruppe.position.copy(wandPunkt);
    gruppe.position.y = AUGE + h * 0.08; // Bildmitte knapp über Augenhöhe
    gruppe.rotation.y = ry;

    // Lichthof an der Wand hinter dem Werk
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(b * 2.4, h * 2.1),
      new THREE.MeshBasicMaterial({
        map: haloTextur(),
        transparent: true,
        opacity: KONFIG.licht.lichthofDeckkraft,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.position.z = 0.005;
    gruppe.add(halo);

    // Rahmen
    const rahmenMat = new THREE.MeshStandardMaterial({
      color: istFoto ? KONFIG.farben.rahmenFoto : KONFIG.farben.rahmenGemaelde,
      roughness: 0.45,
      metalness: 0.15,
    });
    const rahmen = new THREE.Mesh(
      new THREE.BoxGeometry(b + rahmenB * 2, h + rahmenB * 2, rahmenT),
      rahmenMat
    );
    rahmen.position.z = rahmenT / 2 + 0.01;
    gruppe.add(rahmen);

    // Bildfläche — unbeleuchtetes Material: wirkt wie perfekt ausgeleuchtet
    const q = bildQuelle(werk);
    let textur;
    if (q.typ === "canvas") {
      textur = new THREE.CanvasTexture(q.wert);
    } else {
      textur = new THREE.TextureLoader().load(q.wert);
    }
    textur.colorSpace = THREE.SRGBColorSpace;
    textur.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const flaeche = new THREE.Mesh(
      new THREE.PlaneGeometry(b, h),
      new THREE.MeshBasicMaterial({ map: textur })
    );
    flaeche.position.z = rahmenT + 0.012;
    flaeche.userData = { werkId: werk.id, breite: b, hoehe: h };
    gruppe.add(flaeche);
    klickbare.push(flaeche);

    // Plakette rechts neben dem Werk
    const plakette = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.2),
      new THREE.MeshBasicMaterial({ map: plakettenTextur(werk, raum) })
    );
    plakette.position.set(b / 2 + rahmenB + 0.3, -h * 0.18, 0.012);
    plakette.userData = { werkId: werk.id, istPlakette: true };
    gruppe.add(plakette);
    klickbare.push(plakette);

    const normal = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(0, ry, 0));
    kunstwerke.set(werk.id, { gruppe, flaeche, normal, plakette, werk, raum });
    return gruppe;
  }

  function aktualisiereVerkauft(werkId) {
    const eintrag = kunstwerke.get(werkId);
    if (!eintrag) return;
    eintrag.werk.verkauft = true;
    eintrag.plakette.material.map = plakettenTextur(eintrag.werk, eintrag.raum);
    eintrag.plakette.material.needsUpdate = true;
  }

  // ————— Kollision: erlaubte Aufenthaltsflächen —————
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

  return {
    renderer,
    scene,
    camera,
    boden,
    klickbare,
    kunstwerke,
    erlaubt,
    aktualisiereVerkauft,
  };
}

// ————— Hilfstexturen —————

function haloTextur() {
  if (haloTextur._cache) return haloTextur._cache;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 118, 10, 128, 128, 128);
  g.addColorStop(0, "rgba(255,236,200,0.9)");
  g.addColorStop(1, "rgba(255,236,200,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  haloTextur._cache = t;
  return t;
}

function plakettenTextur(werk, raum) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 300;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f2eee6";
  ctx.fillRect(0, 0, 512, 300);
  ctx.fillStyle = "#1d1b18";
  ctx.font = "500 34px Georgia, serif";
  ctx.fillText(kuerze(ctx, werk.titel, 460), 28, 78);
  ctx.font = "italic 27px Georgia, serif";
  ctx.fillStyle = "#4c473f";
  ctx.fillText(kuerze(ctx, `${werk.kuenstler}, ${werk.jahr}`, 460), 28, 126);
  ctx.font = "23px Georgia, serif";
  ctx.fillText(kuerze(ctx, werk.technik, 460), 28, 168);
  ctx.font = "500 27px Georgia, serif";
  ctx.fillStyle = "#8a6d3d";
  ctx.fillText(werk.verkauft ? "" : formatPreis(werk.preis), 28, 234);
  if (werk.verkauft) {
    ctx.fillStyle = "#9e3b32";
    ctx.beginPath();
    ctx.arc(40, 226, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4c473f";
    ctx.font = "23px Georgia, serif";
    ctx.fillText("Verkauft", 64, 234);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function kuerze(ctx, text, maxB) {
  if (ctx.measureText(text).width <= maxB) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(t + "…").width > maxB) t = t.slice(0, -1);
  return t + "…";
}

function holzCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#8a6a48";
  ctx.fillRect(0, 0, 512, 512);
  const planken = 6;
  for (let p = 0; p < planken; p++) {
    const y = (512 / planken) * p;
    const ton = 120 + Math.sin(p * 12.3) * 14;
    ctx.fillStyle = `rgb(${ton + 18},${ton - 10},${ton - 42})`;
    ctx.fillRect(0, y, 512, 512 / planken - 2);
    // Maserung
    ctx.strokeStyle = "rgba(60,40,22,0.25)";
    for (let l = 0; l < 9; l++) {
      ctx.beginPath();
      const ly = y + Math.abs(Math.sin(p * 7 + l * 3.1)) * (512 / planken - 4) + 2;
      ctx.moveTo(0, ly);
      for (let x = 0; x <= 512; x += 64) {
        ctx.lineTo(x, ly + Math.sin(x * 0.02 + l + p) * 2.5);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(30,20,10,0.5)";
    ctx.fillRect(0, y + 512 / planken - 2, 512, 2);
  }
  return c;
}
