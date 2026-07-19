// Texturen — sämtliche Oberflächen der Galerie werden zur Laufzeit
// auf Canvas gemalt: Putz, Fischgrät-Parkett, Leder, Lichtinseln,
// Strahlerkegel, Schatten, Plaketten, Beschriftung. Keine Bild-Assets.

import * as THREE from "three";
import { formatPreis, galerie } from "./katalog.js";

export function alsTextur(canvas, { srgb = true, wiederholend = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wiederholend) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function korn(ctx, W, H, staerke) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * staerke;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ————— Wand-Putz (Basisfarbe pro Saal) —————
// Vertikaler Verlauf ist eingebacken: oben dunkler (Decke), unten leicht
// abgedunkelt — daher wrapT NICHT wiederholen (repeat.y = 1).
export function putzCanvas(basis = "#eae3d6") {
  const B = 512;
  const c = document.createElement("canvas");
  c.width = c.height = B;
  const ctx = c.getContext("2d");
  ctx.fillStyle = basis;
  ctx.fillRect(0, 0, B, B);
  // Wolkigkeit
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * B;
    const y = Math.random() * B;
    const r = 80 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Math.random() > 0.5 ? "rgba(255,252,244,0.02)" : "rgba(60,50,38,0.02)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Feinkorn
  for (let i = 0; i < 4000; i++) {
    const a = 0.02 + Math.random() * 0.02;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,250,${a})` : `rgba(40,34,26,${a})`;
    ctx.fillRect(Math.random() * B, Math.random() * B, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // Vertikaler Lichtverlauf: oben -8 %, unten -4 %
  const g1 = ctx.createLinearGradient(0, 0, 0, B);
  g1.addColorStop(0, "rgba(10,8,5,0.08)");
  g1.addColorStop(0.35, "rgba(10,8,5,0)");
  g1.addColorStop(0.8, "rgba(10,8,5,0)");
  g1.addColorStop(1, "rgba(10,8,5,0.04)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, B, B);
  return c;
}

// ————— Fischgrät-Parkett (Farbe + Rauheit) —————
// 90°-Fischgrät auf 32-px-Raster, Plankenmaß 128×32, kachelbar.
export function fischgraetCanvas() {
  const B = 1024;
  const E = 32; // Rastereinheit
  const farbe = document.createElement("canvas");
  farbe.width = farbe.height = B;
  const fc = farbe.getContext("2d");
  const rauheit = document.createElement("canvas");
  rauheit.width = rauheit.height = B;
  const rc = rauheit.getContext("2d");

  fc.fillStyle = "#241708"; // Fugen
  fc.fillRect(0, 0, B, B);
  rc.fillStyle = "#787878";
  rc.fillRect(0, 0, B, B);

  const toene = ["#9a7850", "#8d6c47", "#83653f", "#7d5f3e", "#94734c"];
  const einheiten = B / E; // 32

  function planke(x, y, w, h) {
    const ton = toene[Math.floor(Math.random() * toene.length)];
    fc.fillStyle = ton;
    fc.fillRect(x + 1, y + 1, w - 2, h - 2);
    // Kantenlicht oben/links
    fc.fillStyle = "rgba(255,238,205,0.10)";
    fc.fillRect(x + 1, y + 1, w - 2, 1.5);
    // Maserung längs der Planke
    fc.strokeStyle = "rgba(46,30,14,0.16)";
    fc.lineWidth = 1;
    const laengs = w > h;
    const linien = 5 + Math.floor(Math.random() * 4);
    for (let l = 0; l < linien; l++) {
      fc.beginPath();
      if (laengs) {
        const ly = y + 2 + Math.random() * (h - 4);
        fc.moveTo(x + 2, ly);
        for (let px = x + 2; px < x + w - 2; px += 16) {
          fc.lineTo(px, ly + Math.sin(px * 0.08 + l * 3) * 1.4);
        }
      } else {
        const lx = x + 2 + Math.random() * (w - 4);
        fc.moveTo(lx, y + 2);
        for (let py = y + 2; py < y + h - 2; py += 16) {
          fc.lineTo(lx + Math.sin(py * 0.08 + l * 3) * 1.4, py);
        }
      }
      fc.stroke();
    }
    const grau = 128 + (Math.random() - 0.5) * 60;
    rc.fillStyle = `rgb(${grau},${grau},${grau})`;
    rc.fillRect(x + 1, y + 1, w - 2, h - 2);
  }

  // Fischgrät-Gitter: horizontal startet bei (i-j)%8==0, vertikal bei ==7
  for (let gy = -4; gy < einheiten + 4; gy++) {
    for (let gx = -4; gx < einheiten + 4; gx++) {
      const m = (((gx - gy) % 8) + 8) % 8;
      if (m === 0) planke(gx * E, gy * E, E * 4, E);
      else if (m === 7) planke(gx * E, gy * E, E, E * 4);
    }
  }
  korn(fc, B, B, 7);
  return { farbe, rauheit };
}

// ————— Leder (Sitzbank) —————
export function lederCanvas(basisHex) {
  const B = 256;
  const c = document.createElement("canvas");
  c.width = c.height = B;
  const ctx = c.getContext("2d");
  ctx.fillStyle = basisHex;
  ctx.fillRect(0, 0, B, B);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * B, Math.random() * B, 2 + Math.random() * 5, 1 + Math.random() * 3, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  korn(ctx, B, B, 8);
  return c;
}

// ————— Licht-Fakes —————

// Elliptische warme Lichtinsel (Wand hinter dem Werk)
export function lichtinselCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(128, 128);
  ctx.scale(1, 0.8);
  const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 126);
  g.addColorStop(0, "rgba(255,232,196,0.9)");
  g.addColorStop(0.5, "rgba(255,228,188,0.35)");
  g.addColorStop(1, "rgba(255,228,188,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-128, -160, 256, 320);
  ctx.restore();
  return c;
}

// Warme Ellipse für den Boden-Lichtpool
export function bodenPoolCanvas() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(128, 64);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 122);
  g.addColorStop(0, "rgba(255,226,184,0.85)");
  g.addColorStop(1, "rgba(255,226,184,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();
  return c;
}

// Vertikaler Warm-Verlauf für den Strahlerkegel (oben hell, unten aus)
export function kegelCanvas() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "rgba(255,226,184,0.55)");
  g.addColorStop(1, "rgba(255,226,184,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  return c;
}

// Schlagschatten-Streifen unter der Rahmenunterkante
export function rahmenSchattenCanvas() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, "rgba(0,0,0,0.30)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 32);
  // seitlich weich auslaufen
  const gl = ctx.createLinearGradient(0, 0, 14, 0);
  gl.addColorStop(0, "rgba(0,0,0,0)");
  gl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-in";
  const gm = ctx.createLinearGradient(0, 0, 128, 0);
  gm.addColorStop(0, "rgba(0,0,0,0)");
  gm.addColorStop(0.12, "rgba(0,0,0,1)");
  gm.addColorStop(0.88, "rgba(0,0,0,1)");
  gm.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gm;
  ctx.fillRect(0, 0, 128, 32);
  return c;
}

// AO-Streifen Wand→Boden
export function kontaktStreifenCanvas() {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(16,10,4,0.5)");
  g.addColorStop(1, "rgba(16,10,4,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  return c;
}

// Radialer Kontaktschatten (Bank, Podest, Pfosten)
export function schattenEllipseCanvas() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.translate(128, 64);
  ctx.scale(1, 0.5);
  const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 120);
  g.addColorStop(0, "rgba(8,5,2,0.5)");
  g.addColorStop(1, "rgba(8,5,2,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();
  return c;
}

// ————— Beschriftung —————

// Text mit Buchstabenabstand auf transparentem Canvas; gibt {canvas, breite} zurück.
export function schriftCanvas(text, { schrift, farbe, buchstabenAbstand = 0, messing = false }) {
  const mess = document.createElement("canvas").getContext("2d");
  mess.font = schrift;
  const breite = Math.ceil(
    [...text].reduce((s, ch) => s + mess.measureText(ch).width + buchstabenAbstand, 48)
  );
  const hoehe = Math.ceil(parseInt(schrift.match(/(\d+)px/)[1], 10) * 1.6);
  const c = document.createElement("canvas");
  c.width = breite;
  c.height = hoehe;
  const ctx = c.getContext("2d");
  ctx.font = schrift;
  ctx.textBaseline = "middle";
  if (messing) {
    const g = ctx.createLinearGradient(0, 0, breite, 0);
    g.addColorStop(0, "#a9885a");
    g.addColorStop(0.5, "#d8bc85");
    g.addColorStop(1, "#a9885a");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = farbe;
  }
  let x = 24;
  for (const ch of text) {
    ctx.fillText(ch, x, hoehe / 2);
    x += ctx.measureText(ch).width + buchstabenAbstand;
  }
  return { canvas: c, breite, hoehe };
}

// Museums-Einführungstafel eines Saals — ausbalanciertes Layout mit
// Buchstabenabstand im Eyebrow, Messinglinie und Galerie-Signatur unten.
export function saaltafelCanvas(raum) {
  const W = 800;
  const H = 1060;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f2eee6";
  ctx.fillRect(0, 0, W, H);
  const rand = 84;

  // Eyebrow „SAAL I" mit Sperrung
  ctx.fillStyle = "#8a6d3d";
  ctx.font = "500 30px Archivo, system-ui, sans-serif";
  let x = rand;
  for (const z of raum.saal.toUpperCase()) {
    ctx.fillText(z, x, 138);
    x += ctx.measureText(z).width + 9;
  }

  ctx.fillStyle = "#1d1b18";
  ctx.font = '400 104px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(kuerze(ctx, raum.name, W - rand * 2), rand - 4, 268);

  ctx.fillStyle = "#b59f68";
  ctx.fillRect(rand, 330, 120, 4);

  ctx.fillStyle = "#4c473f";
  ctx.font = "300 40px Archivo, system-ui, sans-serif";
  zeilenumbruch(ctx, raum.beschreibung, rand, 432, W - rand * 2, 62);

  // Signatur der Galerie am Fuß — bindet die Tafel an die Marke
  ctx.strokeStyle = "rgba(138,109,61,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rand, H - 132);
  ctx.lineTo(W - rand, H - 132);
  ctx.stroke();
  ctx.fillStyle = "#8a7a5e";
  ctx.font = '400 34px "Cormorant Garamond", Georgia, serif';
  x = rand;
  for (const z of (galerie.name || "").toUpperCase()) {
    ctx.fillText(z, x, H - 76);
    x += ctx.measureText(z).width + 8;
  }
  return c;
}

function zeilenumbruch(ctx, text, x, y, maxB, zeilenH) {
  const woerter = text.split(" ");
  let zeile = "";
  for (const w of woerter) {
    const test = zeile ? zeile + " " + w : w;
    if (ctx.measureText(test).width > maxB && zeile) {
      ctx.fillText(zeile, x, y);
      zeile = w;
      y += zeilenH;
    } else {
      zeile = test;
    }
  }
  if (zeile) ctx.fillText(zeile, x, y);
}

// ————— Plakette — doppelte Auflösung, ruhiges Raster, Serifen-Titel —————
export function plakettenCanvas(werk) {
  const c = document.createElement("canvas");
  c.width = 816;
  c.height = 480;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f2eee6";
  ctx.fillRect(0, 0, 816, 480);
  const rand = 52;
  ctx.fillStyle = "#b59f68";
  ctx.fillRect(rand, 62, 96, 5);
  ctx.fillStyle = "#1d1b18";
  ctx.font = '500 56px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(kuerze(ctx, werk.titel, 816 - rand * 2), rand, 168);
  ctx.font = "italic 40px Georgia, serif";
  ctx.fillStyle = "#4c473f";
  ctx.fillText(kuerze(ctx, `${werk.kuenstler}, ${werk.jahr}`, 816 - rand * 2), rand, 240);
  ctx.font = "34px Georgia, serif";
  ctx.fillStyle = "#6a645a";
  ctx.fillText(kuerze(ctx, werk.technik, 816 - rand * 2), rand, 302);
  if (!werk.verkauft) {
    ctx.font = "500 42px Georgia, serif";
    ctx.fillStyle = "#8a6d3d";
    ctx.fillText(formatPreis(werk.preis), rand, 400);
  } else {
    ctx.fillStyle = "#9e3b32";
    ctx.beginPath();
    ctx.arc(rand + 16, 386, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4c473f";
    ctx.font = "36px Georgia, serif";
    ctx.fillText("Verkauft", rand + 52, 400);
  }
  return c;
}

function kuerze(ctx, text, maxB) {
  if (ctx.measureText(text).width <= maxB) return text;
  let t = text;
  while (t.length > 3 && ctx.measureText(t + "…").width > maxB) t = t.slice(0, -1);
  return t + "…";
}
