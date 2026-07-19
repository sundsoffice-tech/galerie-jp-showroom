// Bottom-Sheet — macht ein .panel im schmalen Touch-Layout zum Sheet
// mit Drag-Handle und Snap-Punkten (Peek / Voll / Zu). Gedraggt wird
// bewusst NUR am Handle; der Panel-Inhalt scrollt normal.

import { istSheetLayout } from "./geraet.js";

export function machBottomSheet(panel, { peek = 0.46, voll = 0.88, onClose } = {}) {
  const handle = panel.querySelector(".sheet-handle");
  let sichtbar = 0; // aktuell sichtbare Höhe in px
  let startY = 0;
  let startSichtbar = 0;
  let dragId = null;
  let letztY = 0;
  let letztT = 0;
  let vel = 0; // px/ms, + = nach unten

  const H = () => window.innerHeight;
  const anwenden = () => {
    panel.style.transform = `translateY(${H() - sichtbar}px)`;
  };

  function oeffne(stufe = "peek") {
    if (!istSheetLayout()) return false; // Desktop/Landscape: Seiten-Panel-CSS greift
    sichtbar = Math.round(H() * (stufe === "voll" ? voll : peek));
    panel.classList.add("open");
    anwenden();
    return true;
  }

  function schliesse() {
    sichtbar = 0;
    panel.style.transform = ""; // zurück an CSS
    panel.classList.remove("open");
  }

  handle.addEventListener("pointerdown", (e) => {
    if (!istSheetLayout()) return;
    dragId = e.pointerId;
    startY = letztY = e.clientY;
    letztT = performance.now();
    startSichtbar = sichtbar;
    vel = 0;
    panel.classList.add("dragging");
    handle.setPointerCapture(dragId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (e.pointerId !== dragId) return;
    const t = performance.now();
    vel = (e.clientY - letztY) / Math.max(1, t - letztT);
    letztY = e.clientY;
    letztT = t;
    sichtbar = Math.max(0, Math.min(H() * voll, startSichtbar - (e.clientY - startY)));
    anwenden();
  });

  function dragEnde(e) {
    if (e.pointerId !== dragId) return;
    dragId = null;
    panel.classList.remove("dragging");
    const hPeek = H() * peek;
    const hVoll = H() * voll;
    let ziel;
    if (vel > 0.55) ziel = sichtbar > hPeek * 1.15 ? "peek" : "zu"; // Schwungwurf runter
    else if (vel < -0.55) ziel = "voll"; // Schwungwurf hoch
    else if (sichtbar < hPeek * 0.55) ziel = "zu"; // Positions-Snap
    else ziel = sichtbar > (hPeek + hVoll) / 2 ? "voll" : "peek";
    if (ziel === "zu") {
      schliesse();
      onClose && onClose();
    } else {
      oeffne(ziel);
    }
  }
  handle.addEventListener("pointerup", dragEnde);
  handle.addEventListener("pointercancel", dragEnde);

  window.addEventListener("resize", () => {
    if (!panel.classList.contains("open")) return;
    if (!istSheetLayout()) {
      panel.style.transform = "";
      return;
    }
    if (sichtbar > 0) {
      sichtbar = Math.round(H() * peek);
      anwenden();
    }
  });

  return { oeffne, schliesse };
}
