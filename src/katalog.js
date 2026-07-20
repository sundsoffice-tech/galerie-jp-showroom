// Katalog — zentrale Datenschicht des Showrooms.
// Alle Werke und Räume kommen aus src/data/werke.json.
// Echte Werkfotos liegen in /public/werke/ und werden über das Feld
// "bild" referenziert; ohne Foto erzeugt der Katalog automatisch
// ein Platzhalter-Werk passend zum Thema des Raums.

import daten from "./data/werke.json";
import { KONFIG } from "./konfig.js";
import { IST_TOUCH, IST_SCHWACH } from "./geraet.js";

// Entwürfe (sichtbar: false) existieren für die Galerie schlicht nicht —
// so kann der Händler Werke vorbereiten, ohne dass Besucher sie sehen.
function nurSichtbare(liste) {
  return (liste || []).filter((w) => w.sichtbar !== false);
}

export const galerie = daten.galerie;
export const raeume = daten.raeume;
export const werke = nurSichtbare(daten.werke);
export const kuenstler = daten.kuenstler ? [...daten.kuenstler] : [];

// Kurzbiografie zu einem Künstlernamen (aus der Verwaltung gepflegt)
export function kuenstlerBio(name) {
  return kuenstler.find((k) => k.name === name)?.biografie?.trim() || "";
}

// Die Verwaltung veröffentlicht direkt ins Repo; der Live-Showroom lädt den
// Katalog dann zur Laufzeit von dort (main.js). Die Arrays werden IN-PLACE
// ersetzt, damit alle Module dieselben Referenzen behalten.
let externeBildBasis = null; // z. B. RAW-URL des Repos für Werkfotos
let direkteBilder = null; // Vorschau: Dateiname -> Data-URL (noch nicht veröffentlicht)

export function initKatalog(neueDaten, bildBasis = null, bilder = null) {
  Object.assign(galerie, neueDaten.galerie);
  raeume.length = 0;
  raeume.push(...neueDaten.raeume);
  werke.length = 0;
  werke.push(...nurSichtbare(neueDaten.werke));
  kuenstler.length = 0;
  kuenstler.push(...(neueDaten.kuenstler || []));
  externeBildBasis = bildBasis;
  direkteBilder = bilder;
  bildCache.clear();
}

// Preisformat lazy: die Währung kann durch initKatalog() wechseln
let _preisFormat = null;
let _waehrung = null;
function preisFormat() {
  if (!_preisFormat || _waehrung !== galerie.waehrung) {
    _waehrung = galerie.waehrung;
    _preisFormat = new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: galerie.waehrung || "EUR",
      maximumFractionDigits: 0,
    });
  }
  return _preisFormat;
}

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
  return preisFormat().format(betrag);
}

// ————— Bilder —————

const bildCache = new Map();

// Liefert für jedes Werk ein Canvas (Platzhalter) oder eine URL (echtes Foto).
export function bildQuelle(werk) {
  if (werk.bild) {
    // Vorschau aus der Verwaltung: noch nicht veröffentlichte Fotos direkt;
    // sonst aus dem Repo (Live) oder relativ (Unterpfad-tauglich)
    if (direkteBilder?.[werk.bild]) return { typ: "url", wert: direkteBilder[werk.bild] };
    const wert = externeBildBasis ? externeBildBasis + werk.bild : `werke/${werk.bild}`;
    return { typ: "url", wert };
  }
  if (!bildCache.has(werk.id)) {
    bildCache.set(werk.id, platzhalterCanvas(werk));
  }
  return { typ: "canvas", wert: bildCache.get(werk.id) };
}

export function bildThumbnail(werk) {
  const q = bildQuelle(werk);
  return q.typ === "url" ? q.wert : q.wert.toDataURL("image/jpeg", 0.7);
}

// Rückfall, wenn ein gepflegtes Werkfoto nicht lädt (Tippfehler, fehlende
// Datei): der stilechte Platzhalter statt eines kaputten/schwarzen Bilds.
export function platzhalterCanvasFuer(werk) {
  if (!bildCache.has(werk.id)) bildCache.set(werk.id, platzhalterCanvas(werk));
  return bildCache.get(werk.id);
}

// Verdrahtet ein <img> mit Quelle + Platzhalter-Rückfall in einem Schritt.
export function setzeWerkBild(img, werk) {
  img.onerror = () => {
    img.onerror = null;
    img.src = platzhalterCanvasFuer(werk).toDataURL("image/jpeg", 0.7);
  };
  img.src = bildThumbnail(werk);
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

  // Leinwandgewebe für Malerei: aus Distanz unsichtbar, im Nahzoom
  // wirkt die Fläche wie bespannte Leinwand statt wie ein Bildschirm
  if (werk.raum !== "fotografie") {
    ctx.fillStyle = "rgba(255,255,255,0.028)";
    for (let x = 0; x < W; x += 3) ctx.fillRect(x, 0, 1, H);
    ctx.fillStyle = "rgba(0,0,0,0.028)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }
  return c;
}

// ————— Maler „Moderne": geschichtete Farbfelder —————
// Jedes Feld entsteht aus vielen halbtransparenten, leicht versetzten Lagen;
// die Kanten atmen, ein innerer Glow moduliert die Fläche — Malerei, kein Layout.

const MODERNE_PALETTEN = [
  { grund: "#ded4bd", felder: ["#1f2b3e", "#b5854a"], glut: "#e8d9b8" },
  { grund: "#d9cdb8", felder: ["#933f28", "#3c3a35"], glut: "#e2b98e" },
  { grund: "#d6d2c4", felder: ["#55654f", "#8a4a30"], glut: "#dccfa8" },
  { grund: "#cfc4ae", felder: ["#2e4258", "#b99a55"], glut: "#e5d5ac" },
  { grund: "#4a4238", felder: ["#1c1a17", "#8f6a3a"], glut: "#c9a468" },
];

function farbfeld(ctx, x, y, w, h, farbe, rnd) {
  // 8 Lagen mit wanderndem Versatz: die Summe ergibt weiche, „gemalte" Kanten
  ctx.fillStyle = farbe;
  for (let l = 0; l < 8; l++) {
    ctx.globalAlpha = 0.16;
    const dx = (rnd() - 0.5) * w * 0.035;
    const dy = (rnd() - 0.5) * h * 0.05;
    const dw = 1 - rnd() * 0.03;
    ctx.beginPath();
    const rx = x + dx + (w * (1 - dw)) / 2;
    const ry = y + dy;
    const rh = h * (0.97 + rnd() * 0.05);
    if (ctx.roundRect) ctx.roundRect(rx, ry, w * dw, rh, 8 + rnd() * 26);
    else ctx.rect(rx, ry, w * dw, rh); // ältere Browser (Katalog-Modus)
    ctx.fill();
  }
  // Kanten-Bleeding: kleine Tupfer entlang Ober- und Unterkante
  for (let t = 0; t < 60; t++) {
    ctx.globalAlpha = 0.05 + rnd() * 0.07;
    const tx = x + rnd() * w;
    const oben = rnd() < 0.5;
    const ty = oben ? y + (rnd() - 0.6) * 26 : y + h + (rnd() - 0.4) * 26;
    ctx.beginPath();
    ctx.ellipse(tx, ty, 5 + rnd() * 22, 3 + rnd() * 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function malModerne(ctx, W, H, rnd) {
  const pal = MODERNE_PALETTEN[Math.floor(rnd() * MODERNE_PALETTEN.length)];
  ctx.fillStyle = pal.grund;
  ctx.fillRect(0, 0, W, H);
  // getönte Untermalung: Ecken dunkler als die Mitte
  const unter = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75);
  unter.addColorStop(0, "rgba(255,250,235,0.10)");
  unter.addColorStop(1, "rgba(30,22,12,0.16)");
  ctx.fillStyle = unter;
  ctx.fillRect(0, 0, W, H);

  const rand = W * 0.07;
  const oberH = H * (0.3 + rnd() * 0.24); // Verhältnis der beiden Felder
  const fuge = H * 0.035;
  farbfeld(ctx, rand, H * 0.06, W - rand * 2, oberH, pal.felder[0], rnd);
  farbfeld(ctx, rand, H * 0.06 + oberH + fuge, W - rand * 2, H * 0.88 - oberH - fuge, pal.felder[1], rnd);

  // Glutlinie: in der Fuge blitzt die helle Untermalung durch
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pal.glut;
  ctx.fillRect(rand * 1.3, H * 0.06 + oberH + fuge * 0.3, W - rand * 2.6, fuge * 0.42);
  ctx.globalAlpha = 1;

  // Scumbling: hauchdünne helle Schleier über allem
  for (let s = 0; s < 240; s++) {
    ctx.globalAlpha = 0.016;
    ctx.fillStyle = rnd() < 0.5 ? "#fff6e2" : "#241a10";
    ctx.fillRect(rnd() * W, rnd() * H, 12 + rnd() * 60, 2 + rnd() * 5);
  }
  ctx.globalAlpha = 1;
}

// ————— Maler „Abstraktion": kalligrafische Geste —————
// Eine Komposition um ein Zentrum, Striche mit Druckverlauf und trockenem
// Auslauf, disziplinierte Farbe: Tusche plus EIN Akzent.

function geste(ctx, W, H, rnd, farbe, dicke, cx, cy, radius) {
  const winkel = rnd() * Math.PI * 2;
  const p0 = { x: cx + Math.cos(winkel) * radius * rnd(), y: cy + Math.sin(winkel) * radius * rnd() };
  const p3 = { x: cx + (rnd() - 0.5) * radius * 2.2, y: cy + (rnd() - 0.5) * radius * 2.2 };
  const p1 = { x: p0.x + (rnd() - 0.5) * radius * 1.6, y: p0.y + (rnd() - 0.5) * radius * 1.6 };
  const p2 = { x: p3.x + (rnd() - 0.5) * radius * 1.6, y: p3.y + (rnd() - 0.5) * radius * 1.6 };
  const bez = (t, a, b, c, d) =>
    (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;

  const schritte = 44;
  ctx.strokeStyle = farbe;
  ctx.lineCap = "round";
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < schritte; i++) {
    const t0 = i / schritte;
    const t1 = (i + 1) / schritte;
    const x0 = bez(t0, p0.x, p1.x, p2.x, p3.x);
    const y0 = bez(t0, p0.y, p1.y, p2.y, p3.y);
    const x1 = bez(t1, p0.x, p1.x, p2.x, p3.x);
    const y1 = bez(t1, p0.y, p1.y, p2.y, p3.y);
    // Druckkurve: setzt kräftig an, läuft dünn und trocken aus
    const druck = Math.sin(Math.min(t0 * 2.4, 1) * Math.PI * 0.5) * (1 - t0 * 0.55);
    ctx.lineWidth = Math.max(1.2, dicke * druck * (0.85 + rnd() * 0.3));
    ctx.globalAlpha = t0 < 0.75 ? 0.88 : 0.88 * (1 - (t0 - 0.75) * 2.6);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    vx = x1 - x0;
    vy = y1 - y0;
    // Borsten: haarfeine Parallelspur
    if (i % 3 === 0 && dicke > 10) {
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x0 - vy * 0.14, y0 + vx * 0.14);
      ctx.lineTo(x1 - vy * 0.14, y1 + vx * 0.14);
      ctx.stroke();
    }
  }
  // Spritzer in Bewegungsrichtung am Strichende
  const len = Math.hypot(vx, vy) || 1;
  for (let s = 0; s < 5; s++) {
    ctx.globalAlpha = 0.35 + rnd() * 0.3;
    const d = 8 + rnd() * 46;
    ctx.beginPath();
    ctx.arc(p3.x + (vx / len) * d + (rnd() - 0.5) * 14, p3.y + (vy / len) * d + (rnd() - 0.5) * 14, 0.8 + rnd() * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = farbe;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function malAbstraktion(ctx, W, H, rnd) {
  // Papier: warm, zu den Rändern leicht abgedunkelt
  ctx.fillStyle = "#eae3d1";
  ctx.fillRect(0, 0, W, H);
  const randton = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, Math.max(W, H) * 0.8);
  randton.addColorStop(0, "rgba(255,252,240,0.06)");
  randton.addColorStop(1, "rgba(70,55,35,0.09)");
  ctx.fillStyle = randton;
  ctx.fillRect(0, 0, W, H);

  // Kompositionszentrum nahe dem goldenen Schnitt
  const cx = W * (0.38 + rnd() * 0.24);
  const cy = H * (0.36 + rnd() * 0.26);
  const radius = Math.min(W, H) * 0.3;

  // Lavierung: blasse, weich auslaufende Tuscheflecken hinter der Geste
  for (let f = 0; f < 3; f++) {
    const fx = cx + (rnd() - 0.5) * radius;
    const fy = cy + (rnd() - 0.5) * radius;
    const fr = radius * (0.5 + rnd() * 0.7);
    const fleck = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    fleck.addColorStop(0, "rgba(58,54,48,0.055)");
    fleck.addColorStop(0.7, "rgba(58,54,48,0.025)");
    fleck.addColorStop(1, "rgba(58,54,48,0)");
    ctx.fillStyle = fleck;
    ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
  }

  const akzent = rnd() < 0.5 ? "#a83a22" : "#2e4a66";
  const anzahl = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < anzahl; i++) {
    geste(ctx, W, H, rnd, "#211f1b", 14 + rnd() * rnd() * 44, cx, cy, radius);
  }
  for (let i = 0; i < 2; i++) {
    geste(ctx, W, H, rnd, akzent, 8 + rnd() * 18, cx, cy, radius * 0.9);
  }
}

// ————— Maler „Fotografie": monochrome Landschaft —————
// Kammlinien per Mittelpunkt-Verschiebung (natürliche Silhouetten),
// atmosphärische Tiefe, Dunstbänke, verdeckte Lichtquelle, Vignette.

function kammlinie(rnd, punkte, rauheit) {
  const ys = new Array(punkte).fill(0);
  ys[0] = rnd();
  ys[punkte - 1] = rnd();
  let schritt = Math.floor((punkte - 1) / 2);
  let amp = rauheit;
  while (schritt >= 1) {
    for (let i = schritt; i < punkte - 1; i += schritt * 2) {
      ys[i] = (ys[i - schritt] + ys[i + schritt]) / 2 + (rnd() - 0.5) * amp;
    }
    schritt = Math.floor(schritt / 2);
    amp *= 0.55;
  }
  return ys;
}

function malFotografie(ctx, W, H, rnd) {
  // Duoton: neutrales Grau mit einem Hauch Selen-Wärme
  const ton = (v) => `rgb(${Math.round(v)},${Math.round(v * 0.985)},${Math.round(v * 0.955)})`;

  // Himmel mit weichem Verlauf
  const himmel = ctx.createLinearGradient(0, 0, 0, H * 0.75);
  const hell = 216 + rnd() * 22;
  himmel.addColorStop(0, ton(hell));
  himmel.addColorStop(1, ton(hell * 0.62));
  ctx.fillStyle = himmel;
  ctx.fillRect(0, 0, W, H);

  // verdeckte Lichtquelle hinter dem Dunst
  const lx = W * (0.3 + rnd() * 0.4);
  const ly = H * (0.16 + rnd() * 0.18);
  const licht = ctx.createRadialGradient(lx, ly, 4, lx, ly, W * 0.42);
  licht.addColorStop(0, "rgba(255,253,246,0.75)");
  licht.addColorStop(0.35, "rgba(255,250,238,0.18)");
  licht.addColorStop(1, "rgba(255,250,238,0)");
  ctx.fillStyle = licht;
  ctx.fillRect(0, 0, W, H);

  // Bergketten: fern hell und blass, nah dunkel und schroff
  const ebenen = 6;
  for (let e = 0; e < ebenen; e++) {
    const tiefe = e / (ebenen - 1); // 0 = fern, 1 = nah
    const basis = H * (0.34 + tiefe * 0.52);
    const amp = H * (0.05 + tiefe * 0.12);
    const ys = kammlinie(rnd, 65, 1);
    const grau = 176 - tiefe * 128 + rnd() * 8;

    const grad = ctx.createLinearGradient(0, basis - amp, 0, H);
    grad.addColorStop(0, ton(grau));
    grad.addColorStop(1, ton(grau * 0.82));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < ys.length; i++) {
      ctx.lineTo((W / (ys.length - 1)) * i, basis + (ys[i] - 0.5) * amp * 2);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Dunstband vor jeder Kette: löst die Übergänge auf
    if (e < ebenen - 1) {
      const dunst = ctx.createLinearGradient(0, basis - amp * 0.4, 0, basis + amp);
      dunst.addColorStop(0, "rgba(236,233,226,0)");
      dunst.addColorStop(0.55, `rgba(236,233,226,${0.34 - tiefe * 0.22})`);
      dunst.addColorStop(1, "rgba(236,233,226,0)");
      ctx.fillStyle = dunst;
      ctx.fillRect(0, basis - amp, W, amp * 2.4);
    }
  }

  // Vignette gibt dem Abzug Gewicht
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, "rgba(10,9,8,0)");
  vig.addColorStop(1, "rgba(10,9,8,0.2)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
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
