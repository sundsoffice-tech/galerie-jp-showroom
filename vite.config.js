import { defineConfig } from "vite";

// Schriften nur als woff2 ausliefern. Die @fontsource-Pakete nennen je Schnitt
// zwei Quellen: woff2 und dahinter woff als Rückfall für Browser vor 2016.
// Jeder Browser, der die Galerie überhaupt starten kann (WebGL2, ES-Module),
// nimmt woff2 — die woff-Dateien wurden nie geladen, aber mit ausgeliefert.
// Diese Regel streicht nur den woff-Rückfall aus `src`; Familie, Schnitt,
// Zeichenbereich und font-display bleiben wörtlich die des Pakets.
const nurWoff2 = {
  postcssPlugin: "nur-woff2",
  Declaration: {
    src(deklaration) {
      if (deklaration.parent?.name !== "font-face") return;
      const quellen = deklaration.value.split(/,(?![^(]*\))/).map((q) => q.trim());
      const woff2 = quellen.filter((q) => /format\(\s*['"]?woff2['"]?\s*\)/i.test(q));
      // Ohne woff2-Quelle bleibt die Angabe unangetastet — lieber eine
      // Datei zu viel als eine Schrift ohne Quelle.
      if (woff2.length && woff2.length < quellen.length) deklaration.value = woff2.join(", ");
    },
  },
};

// Vite legt die woff-Dateien schon in den Ausgabeordner, bevor die Regel oben
// ihren Verweis streicht. Was danach keine Stil- oder Skriptdatei mehr nennt,
// wird nicht mit ausgeliefert. Gestrichen wird nur, was nachweislich
// verwaist ist — ein woff, das noch jemand lädt, bleibt liegen.
const ohneVerwaisteWoff = {
  name: "ohne-verwaiste-woff",
  apply: "build",
  enforce: "post",
  generateBundle(_optionen, buendel) {
    const text = Object.values(buendel)
      .filter((d) => /\.(css|js|html)$/.test(d.fileName))
      .map((d) => String(d.type === "chunk" ? d.code : d.source))
      .join("\n");
    for (const name of Object.keys(buendel)) {
      if (name.endsWith(".woff") && !text.includes(name.split("/").pop())) delete buendel[name];
    }
  },
};

// base "./" = relative Asset-Pfade — läuft auf GitHub Pages (Unterpfad),
// Netlify und jedem statischen Host ohne Anpassung.
export default defineConfig({
  base: "./",
  css: {
    postcss: { plugins: [nurWoff2] },
  },
  plugins: [ohneVerwaisteWoff],
});
