import { defineConfig } from "vite";

// base "./" = relative Asset-Pfade — läuft auf GitHub Pages (Unterpfad),
// Netlify und jedem statischen Host ohne Anpassung.
export default defineConfig({
  base: "./",
});
