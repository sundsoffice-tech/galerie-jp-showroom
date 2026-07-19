// Klang — die hörbare Stille eines Museums, komplett synthetisiert:
// Raumton (braunes Rauschen), Saal-Hall (prozedurale Impulsantwort),
// Schritte auf Parkett, Fokus-Wusch und Sammel-Glocke. Keine Audiodateien.

import { KONFIG } from "./konfig.js";

const LS_STUMM = "galerie-jp-stumm";

let ctx = null;
let master = null;
let dry = null;
let wet = null;
let raumtonFilter = null;
let raumtonGain = null;
let gestartet = false;
let stumm = localStorage.getItem(LS_STUMM) === "1";

function jetzt() {
  return ctx.currentTime;
}

export function istStumm() {
  return stumm;
}

export function schalteStumm() {
  stumm = !stumm;
  localStorage.setItem(LS_STUMM, stumm ? "1" : "0");
  if (master) {
    master.gain.setTargetAtTime(stumm ? 0 : KONFIG.klang.master, jetzt(), 0.1);
  }
  return stumm;
}

// Wird im Eintritts-Klick aufgerufen (User-Gesture-Pflicht des Browsers)
export function starte() {
  if (gestartet) {
    ctx?.resume();
    return;
  }
  gestartet = true;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  master = ctx.createGain();
  master.gain.value = stumm ? 0 : KONFIG.klang.master;
  master.connect(ctx.destination);

  dry = ctx.createGain();
  dry.gain.value = 1;
  dry.connect(master);

  // Saal-Hall: 2,2 s Rauschfahne mit hartem Abfall — großer, harter Raum
  const hall = ctx.createConvolver();
  const dauer = 2.2;
  const rate = ctx.sampleRate;
  const impuls = ctx.createBuffer(2, dauer * rate, rate);
  for (let k = 0; k < 2; k++) {
    const d = impuls.getChannelData(k);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.8);
    }
  }
  hall.buffer = impuls;
  wet = ctx.createGain();
  wet.gain.value = KONFIG.klang.hallAnteil;
  hall.connect(wet);
  wet.connect(master);
  dry.connect(hall);

  // Raumton: braunes Rauschen → Lowpass 180 Hz, LFO auf der Frequenz
  const sek = 4;
  const puffer = ctx.createBuffer(1, sek * rate, rate);
  const pd = puffer.getChannelData(0);
  let b = 0;
  for (let i = 0; i < pd.length; i++) {
    b = (b + (Math.random() * 2 - 1) * 0.02) / 1.02;
    pd[i] = b * 3.5;
  }
  const quelle = ctx.createBufferSource();
  quelle.buffer = puffer;
  quelle.loop = true;
  raumtonFilter = ctx.createBiquadFilter();
  raumtonFilter.type = "lowpass";
  raumtonFilter.frequency.value = 180;
  raumtonGain = ctx.createGain();
  raumtonGain.gain.value = 0;
  quelle.connect(raumtonFilter);
  raumtonFilter.connect(raumtonGain);
  raumtonGain.connect(dry);
  quelle.start();
  // Fade-in 2,5 s
  raumtonGain.gain.setTargetAtTime(KONFIG.klang.raumton, jetzt(), 0.9);
  // LFO: langsames Wandern der Filterfrequenz
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.05;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 40;
  lfo.connect(lfoGain);
  lfoGain.connect(raumtonFilter.frequency);
  lfo.start();
}

// Saal III klingt dunkler und stiller
export function setzeRaum(raumId) {
  if (!gestartet) return;
  const dunkel = raumId === "fotografie";
  raumtonFilter.frequency.setTargetAtTime(dunkel ? 140 : 180, jetzt(), 0.8);
  raumtonGain.gain.setTargetAtTime(
    dunkel ? KONFIG.klang.raumton * 0.7 : KONFIG.klang.raumton,
    jetzt(),
    0.8
  );
}

// Schritt auf Parkett: Thump + Sohlen-Rascheln, links/rechts gepannt
export function schritt(links, tempo) {
  if (!gestartet || stumm) return;
  const t = jetzt();
  const streu = 1 + (Math.random() - 0.5) * 0.16;
  const lautstaerke = KONFIG.klang.schritt * (0.6 + 0.4 * tempo) * streu;

  const pan = ctx.createStereoPanner();
  pan.pan.value = links ? -0.25 : 0.25;
  pan.connect(dry);

  // (a) Thump
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(78 * streu, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  const og = ctx.createGain();
  og.gain.setValueAtTime(lautstaerke * 1.4, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(og);
  og.connect(pan);
  osc.start(t);
  osc.stop(t + 0.14);

  // (b) Sohle
  const n = ctx.createBufferSource();
  const puffer = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
  const d = puffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  n.buffer = puffer;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900 + Math.random() * 600;
  bp.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.value = lautstaerke * 0.5;
  n.connect(bp);
  bp.connect(ng);
  ng.connect(pan);
  n.start(t);
}

// Unterschwelliger „Luftzug" der Fokus-Kamerafahrt
export function fokusWusch() {
  if (!gestartet || stumm) return;
  const t = jetzt();
  const n = ctx.createBufferSource();
  const puffer = ctx.createBuffer(1, ctx.sampleRate * 0.45, ctx.sampleRate);
  const d = puffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = puffer;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(400, t);
  lp.frequency.linearRampToValueAtTime(900, t + 0.18);
  lp.frequency.linearRampToValueAtTime(300, t + 0.4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.04, t + 0.15);
  g.gain.linearRampToValueAtTime(0, t + 0.42);
  n.connect(lp);
  lp.connect(g);
  g.connect(dry);
  n.start(t);
}

// Kleine Messingglocke beim Sammeln (E6 + H6, voll durch den Hall)
export function sammelKlang() {
  if (!gestartet || stumm) return;
  const t = jetzt();
  for (const [freq, verz] of [
    [1318.5, 0],
    [1975.5, 0.06],
  ]) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + verz);
    g.gain.linearRampToValueAtTime(0.05, t + verz + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0005, t + verz + 0.6);
    osc.connect(g);
    g.connect(wet); // nur Hall — klingt wie aus dem Raum
    g.connect(dry);
    osc.start(t + verz);
    osc.stop(t + verz + 0.65);
  }
}
