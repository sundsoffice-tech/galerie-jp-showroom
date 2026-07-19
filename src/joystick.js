// Joystick — fester Rauchglas-Ring links unten (nur Touch).
// Eigenes DOM-Element über dem Canvas: ein Finger steuert den Stick,
// ein zweiter kann gleichzeitig auf dem Canvas die Kamera drehen.
// Schreibt einen normierten Vektor in `ziel` {x, y}; die Steuerung liest ihn pro Frame.

import { KONFIG } from "./konfig.js";

export function erstelleJoystick(ziel) {
  const R = KONFIG.mobil.joystickRadiusPx;
  const DEAD = KONFIG.mobil.joystickDeadzone;

  const wrap = document.createElement("div");
  wrap.id = "joystick";
  wrap.innerHTML = '<div class="joy-nub"></div>';
  document.body.appendChild(wrap);
  const nub = wrap.firstElementChild;

  let id = null;
  let cx = 0;
  let cy = 0;

  function setze(e) {
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx *= R / len;
      dy *= R / len;
    }
    nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const nx = dx / R;
    const ny = dy / R;
    const mag = Math.hypot(nx, ny);
    if (mag < DEAD) {
      ziel.x = 0;
      ziel.y = 0;
      return;
    }
    const skal = (mag - DEAD) / (1 - DEAD) / mag; // Deadzone radial, danach linear bis 1
    ziel.x = nx * skal;
    ziel.y = ny * skal;
  }

  function reset() {
    id = null;
    ziel.x = 0;
    ziel.y = 0;
    nub.style.transform = "translate(-50%, -50%)";
    wrap.classList.remove("greift");
  }

  wrap.addEventListener("pointerdown", (e) => {
    if (id !== null) return;
    id = e.pointerId;
    const r = wrap.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    wrap.setPointerCapture(id);
    wrap.classList.add("greift");
    setze(e);
    e.preventDefault();
  });
  wrap.addEventListener("pointermove", (e) => {
    if (e.pointerId === id) setze(e);
  });
  wrap.addEventListener("pointerup", (e) => {
    if (e.pointerId === id) reset();
  });
  wrap.addEventListener("pointercancel", (e) => {
    if (e.pointerId === id) reset();
  });

  return {
    zeige(an) {
      wrap.classList.toggle("aktiv", an);
      if (!an) reset();
    },
  };
}
