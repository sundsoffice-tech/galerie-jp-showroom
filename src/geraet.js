// Geräte-Erkennung — einmal beim Start, plus Live-Queries für Layoutwechsel.

// ?touch=1 erzwingt das Touch-Layout (für Tests/Demos am Desktop);
// Gesten wie der Joystick akzeptieren dann auch Maus-Pointer
export const TOUCH_ERZWUNGEN =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("touch") === "1";
const touchErzwungen = TOUCH_ERZWUNGEN;

export const IST_TOUCH =
  typeof window !== "undefined" &&
  (touchErzwungen || matchMedia("(pointer: coarse)").matches);

// Schwaches Gerät: wenig Kerne/RAM => Effekte weiter reduzieren.
export const IST_SCHWACH =
  IST_TOUCH &&
  ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4);

export const mqSchmal = matchMedia("(max-width: 480px)");
export const mqQuerHandy = matchMedia("(max-height: 480px) and (orientation: landscape)");

// Bottom-Sheets nur im schmalen Portrait-Layout; Handy-Landscape
// nutzt wieder Seiten-Panels.
export function istSheetLayout() {
  return IST_TOUCH && mqSchmal.matches && !mqQuerHandy.matches;
}

export const REDUZIERTE_BEWEGUNG =
  typeof window !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.classList.toggle("touch", IST_TOUCH);
