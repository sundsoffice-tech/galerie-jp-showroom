// Möbel & Einbauten — Deckenschienen mit Strahlern, Lichtkegel,
// Sitzbänke, Podest, Saaltafeln und Wand-Beschriftung.

import * as THREE from "three";
import { KONFIG } from "./konfig.js";
import {
  alsTextur,
  lederCanvas,
  kegelCanvas,
  schattenEllipseCanvas,
  schriftCanvas,
  saaltafelCanvas,
} from "./texturen.js";

const RAUM_H = KONFIG.raum.hoehe;

let _kegelTex = null;
let _ellipseTex = null;
function kegelTex() {
  if (!_kegelTex) _kegelTex = alsTextur(kegelCanvas());
  return _kegelTex;
}
function ellipseTex() {
  if (!_ellipseTex) _ellipseTex = alsTextur(schattenEllipseCanvas());
  return _ellipseTex;
}

const schwarzMetall = new THREE.MeshStandardMaterial({
  color: 0x1b1916,
  roughness: 0.4,
  metalness: 0.6,
});

// ————— Strahler an Deckenschiene + Fake-Lichtkegel —————
// zielPunkt: Bildmitte in Weltkoordinaten; normal: von der Wand weg.
export function erstelleStrahler(scene, zielPunkt, normal, breite, registriere, reihenfolge) {
  const abstand = 0.85; // Fixture-Abstand von der Wand
  const fx = zielPunkt.x + normal.x * abstand;
  const fz = zielPunkt.z + normal.z * abstand;
  const fy = RAUM_H - 0.12;

  const gruppe = new THREE.Group();

  // kurzes Schienenstück längs der Wand
  const schiene = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.06), schwarzMetall);
  schiene.position.set(fx, RAUM_H - 0.015, fz);
  schiene.rotation.y = Math.atan2(normal.x, normal.z) + Math.PI / 2;
  gruppe.add(schiene);

  // Strahlergehäuse, zum Werk geneigt
  const gehaeuse = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 16), schwarzMetall);
  gehaeuse.position.set(fx, fy, fz);
  const zuWerk = new THREE.Vector3(zielPunkt.x - fx, zielPunkt.y - fy, zielPunkt.z - fz);
  const laenge = zuWerk.length();
  const richtung = zuWerk.clone().normalize();
  gehaeuse.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), richtung);
  gruppe.add(gehaeuse);

  // glühende Linse (bloomt im Tier A dezent)
  const linse = new THREE.Mesh(
    new THREE.CircleGeometry(0.032, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe9c9 })
  );
  linse.position.set(fx + richtung.x * 0.065, fy + richtung.y * 0.065, fz + richtung.z * 0.065);
  linse.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), richtung);
  gruppe.add(linse);

  // Fake-Volumetrik: offener Kegel vom Strahler zur Bildmitte
  const kegelGeo = new THREE.CylinderGeometry(0.03, Math.max(breite * 0.75, 0.5), laenge, 20, 1, true);
  const kegelMat = new THREE.MeshBasicMaterial({
    map: kegelTex(),
    color: 0xffe2b8,
    transparent: true,
    opacity: KONFIG.licht.kegelDeckkraft,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const kegel = new THREE.Mesh(kegelGeo, kegelMat);
  kegel.position.set(fx + zuWerk.x / 2, fy + zuWerk.y / 2, fz + zuWerk.z / 2);
  kegel.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), richtung);
  gruppe.add(kegel);
  registriere(kegelMat, KONFIG.licht.kegelDeckkraft, reihenfolge);

  scene.add(gruppe);
  return gruppe;
}

// ————— Sitzbank —————
export function erstelleBank(scene, x, z, farbeHex) {
  const bank = new THREE.Group();
  const lederTex = alsTextur(lederCanvas("#" + farbeHex.toString(16).padStart(6, "0")));
  const sitz = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.09, 0.5),
    new THREE.MeshStandardMaterial({ map: lederTex, roughness: 0.78, envMapIntensity: 0.25 })
  );
  sitz.position.y = 0.46;
  bank.add(sitz);
  const kufenMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.7, envMapIntensity: 0.25 });
  for (const sx of [-0.72, 0.72]) {
    const kufe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.5), kufenMat);
    kufe.position.set(sx, 0.21, 0);
    bank.add(kufe);
  }
  const schatten = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 0.95),
    new THREE.MeshBasicMaterial({ map: ellipseTex(), transparent: true, depthWrite: false, opacity: 0.55 })
  );
  schatten.rotation.x = -Math.PI / 2;
  schatten.position.y = 0.005;
  bank.add(schatten);
  bank.position.set(x, 0, z);
  scene.add(bank);
  return { minX: x - 1.0, maxX: x + 1.0, minZ: z - 0.42, maxZ: z + 0.42 };
}

// ————— Podest mit Messingobjekt (Saal II) —————
export function erstellePodest(scene, x, z, wandMaterial, registriere, reihenfolge) {
  const podest = new THREE.Group();
  const sockel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 0.45), wandMaterial);
  sockel.position.y = 0.55;
  podest.add(sockel);
  const objekt = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.14, 0.045, 128, 20),
    new THREE.MeshStandardMaterial({ color: 0xc2a36b, metalness: 0.95, roughness: 0.25, envMapIntensity: 1.3 })
  );
  objekt.position.y = 1.32;
  podest.add(objekt);
  const schatten = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.9),
    new THREE.MeshBasicMaterial({ map: ellipseTex(), transparent: true, depthWrite: false, opacity: 0.5 })
  );
  schatten.rotation.x = -Math.PI / 2;
  schatten.position.y = 0.005;
  podest.add(schatten);
  podest.position.set(x, 0, z);
  scene.add(podest);

  erstelleStrahler(
    scene,
    new THREE.Vector3(x, 1.32, z),
    new THREE.Vector3(0.35, 0, 0.35).normalize(),
    0.5,
    registriere,
    reihenfolge
  );
  return { objekt, zone: { minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 } };
}

// ————— Saaltafel (Einführungstext neben der Tür) —————
export function erstelleSaaltafel(scene, raum, x, z, ry) {
  const tex = alsTextur(saaltafelCanvas(raum));
  const tafel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.96),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  tafel.position.set(x, 1.55, z);
  tafel.rotation.y = ry;
  scene.add(tafel);
  return tafel;
}

// ————— Wand-Lettering —————
export function erstelleLettering(scene, text, { x, y, z, ry, hoeheM, farbe, messing = false, schrift }) {
  const { canvas, breite, hoehe } = schriftCanvas(text, {
    schrift: schrift || '500 64px Archivo, system-ui, sans-serif',
    farbe: farbe || "rgba(43,39,33,0.85)",
    buchstabenAbstand: 18,
    messing,
  });
  const tex = alsTextur(canvas);
  tex.anisotropy = 8;
  const skala = hoeheM / hoehe;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(breite * skala, hoehe * skala),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
  return m;
}
