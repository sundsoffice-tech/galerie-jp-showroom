// Katalog — zentrale Datenschicht des Showrooms.
// Alle Werke und Räume kommen aus src/data/werke.json.
// Echte Werkfotos liegen in /public/werke/ und werden über das Feld
// "bild" referenziert; ohne Foto erzeugt der Katalog automatisch
// ein Platzhalter-Werk passend zum Thema des Raums.

import daten from "./data/werke.json";
import { KONFIG } from "./konfig.js";
import { IST_TOUCH, IST_SCHWACH } from "./geraet.js";

const preisFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: daten.galerie.waehrung || "EUR",
  maximumFractionDigits: 0,
});

export const galerie = daten.galerie;
export const raeume = daten.raeume;
export const werke = daten.werke;

export function werkById(id) {
  return werke.find((w) => w.id === id);
}

export function werkeImRaum(raumId) {
  return werke.filter((w) => w.raum === raumId);
}

export function raumById(id) {
  return raeume.find((r) => r.id === id);
}

export function formatPreis(betrag) {
  if (betrag == null) return "Preis auf Anfrage"; // im High-End-Segment üblich
  return preisFormat.format(betrag);
}

// ————— Bilder —————

const bildCache = new Map();

// Liefert für jedes Werk ein Canvas (Platzhalter) oder eine URL (echtes Foto).
export function bildQuelle(werk) {
  // relativer Pfad: funktioniert auch unter einem Unterpfad (GitHub Pages)
  if (werk.bild) return { typ: "url", wert: `werke/${werk.bild}` };
  if (!bildCache.has(werk.id)) {
    bildCache.set(werk.id, platzhalterCanvas(werk));
  }
  return { typ: "canvas", wert: bildCache.get(werk.id) };
}

export function bildThumbnail(werk) {
  const q = bildQuelle(werk);
  return q.typ === "url" ? q.wert : q.wert.toDataURL("image/jpeg", 0.7);
}

// ————— Platzhalter-Generator (seeded, pro Raum-Thema ein Stil) —————

function seedAusString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFactory(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function platzhalterCanvas(werk) {
  const rnd = rngFactory(seedAusString(werk.id + werk.titel));
  const ratio = werk.breite_cm / werk.hoehe_cm;
  const H = IST_TOUCH ? KONFIG.mobil.platzhalterHoehe : 1024;
  const W = Math.round(H * ratio);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");

  if (werk.raum === "fotografie") malFotografie(ctx, W, H, rnd);
  else if (werk.raum === "abstraktion") malAbstraktion(ctx, W, H, rnd);
  else malModerne(ctx, W, H, rnd);

  // Körnung ist rein kosmetisch — auf schwachen Geräten überspringen
  if (!IST_SCHWACH) koernung(ctx, W, H, rnd, werk.raum === "fotografie" ? 26 : 10);
  return c;
}

const MODERNE_PALETTEN = [
  ["#c8a05a", "#1e2a3d", "#e8e0d0"],
  ["#a34a2e", "#d8c9a8", "#2b2b28"],
  ["#5b6d5c", "#e3dbc8", "#8f4f38"],
  ["#31465e", "#c2a36b", "#ece5d6"],
];

function malModerne(ctx, W, H, rnd) {
  const pal = MODERNE_PALETTEN[Math.floor(rnd() * MODERNE_PALETTEN.length)];
  ctx.fillStyle = pal[2];
  ctx.fillRect(0, 0, W, H);
  const n = 2 + Math.floor(rnd() * 2);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const h = (H / n) * (0.7 + rnd() * 0.6);
    ctx.fillStyle = pal[i % pal.length];
    ctx.globalAlpha = 0.92;
    weichesRechteck(ctx, W * 0.04, y + H * 0.03, W * 0.92, h * 0.9, rnd);
    y += h;
  }
  ctx.globalAlpha = 1;
}

function weichesRechteck(ctx, x, y, w, h, rnd) {
  // leicht unregelmäßige Kanten wie von Hand gezogen
  ctx.beginPath();
  const j = (v) => v + (rnd() - 0.5) * 14;
  ctx.moveTo(j(x), j(y));
  ctx.lineTo(j(x + w), j(y));
  ctx.lineTo(j(x + w), j(y + h));
  ctx.lineTo(j(x), j(y + h));
  ctx.closePath();
  ctx.fill();
}

function malAbstraktion(ctx, W, H, rnd) {
  ctx.fillStyle = "#e9e2d2";
  ctx.fillRect(0, 0, W, H);
  const farben = ["#22201d", "#22201d", "#22201d", "#b03a24", "#31465e"];
  const strokes = 10 + Math.floor(rnd() * 14);
  for (let i = 0; i < strokes; i++) {
    ctx.strokeStyle = farben[Math.floor(rnd() * farben.length)];
    ctx.lineWidth = 4 + rnd() * rnd() * 60;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.55 + rnd() * 0.45;
    ctx.beginPath();
    const x0 = rnd() * W;
    const y0 = rnd() * H;
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(
      x0 + (rnd() - 0.5) * W,
      y0 + (rnd() - 0.5) * H,
      rnd() * W,
      rnd() * H,
      rnd() * W,
      rnd() * H
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function malFotografie(ctx, W, H, rnd) {
  // Duotone-Landschaft: Himmel-Verlauf + Bergkämme in Tonstufen
  const hell = 200 + Math.floor(rnd() * 30);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgb(${hell},${hell},${hell - 4})`);
  g.addColorStop(1, "rgb(90,90,88)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const ebenen = 4 + Math.floor(rnd() * 3);
  for (let e = 0; e < ebenen; e++) {
    const ton = 150 - e * (110 / ebenen) + rnd() * 12;
    ctx.fillStyle = `rgb(${ton},${ton},${ton})`;
    ctx.beginPath();
    const basis = H * (0.35 + (e / ebenen) * 0.55);
    ctx.moveTo(0, H);
    ctx.lineTo(0, basis + (rnd() - 0.5) * 80);
    const punkte = 6;
    for (let p = 1; p <= punkte; p++) {
      ctx.lineTo(
        (W / punkte) * p,
        basis + (rnd() - 0.5) * (140 - e * 15)
      );
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
}

function koernung(ctx, W, H, rnd, staerke) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * staerke;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}
