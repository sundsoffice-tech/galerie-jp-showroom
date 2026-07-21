// ————————————————————————————————————————————————
// Mini-Onboarding — drei Handgriffe, spielerisch beigebracht.
//
// Leitgedanke: nicht erklären, sondern bemerken. Die Karte nennt einen
// Handgriff und verschwindet, sobald der Besucher ihn ausgeführt hat. Wer
// ihn schon vorher konnte, bekommt sofort den Haken statt einer Belehrung —
// der Rundgang soll niemanden bevormunden, der sich auskennt.
//
// Gemessen wird ausschließlich an der Kamera: gedrehter Winkel, gelaufene
// Strecke, Fokus auf einem Werk. Dadurch braucht dieses Modul keinen
// Eingriff in Steuerung oder UI — es schaut nur zu.
// ————————————————————————————————————————————————

const SPEICHER = "galerie-onboarding-gesehen";

// Schwellen bewusst niedrig: ein beiläufiger Schwenk soll schon zählen.
const DREHUNG_NOETIG = 0.8; // Bogenmaß, ~46°
const STRECKE_NOETIG = 2.2; // Meter

// ————— Piktogramme —————
// Jeder Schritt macht seine Geste vor, statt sie nur zu beschreiben: gezeigt
// wird genau die Bewegung, die der Besucher gleich selbst ausführt. Alles
// als Inline-SVG mit CSS-Kennbildern — keine Datei, kein fremder Server.

const BILD_UMSEHEN = `
  <svg viewBox="0 0 104 52" aria-hidden="true">
    <path class="ob-winkel ob-winkel-l" d="M14 20 L8 26 L14 32" />
    <line class="ob-spur" x1="18" y1="26" x2="86" y2="26" />
    <path class="ob-winkel ob-winkel-r" d="M90 20 L96 26 L90 32" />
    <g class="ob-schwenker">
      <circle class="ob-zeiger" cx="52" cy="26" r="6" />
      <circle class="ob-zeiger-hof" cx="52" cy="26" r="11" />
    </g>
  </svg>`;

const BILD_GEHEN_TASTE = `
  <svg viewBox="0 0 104 52" aria-hidden="true">
    <path class="ob-pfeil-hoch" d="M52 16 L52 4 M46 10 L52 4 L58 10" />
    <rect class="ob-taste" x="38" y="22" width="28" height="24" rx="3" />
    <text class="ob-tastentext" x="52" y="38" text-anchor="middle">W</text>
  </svg>`;

const BILD_GEHEN_JOYSTICK = `
  <svg viewBox="0 0 104 52" aria-hidden="true">
    <path class="ob-pfeil-hoch" d="M52 14 L52 3 M46 9 L52 3 L58 9" />
    <circle class="ob-ring" cx="52" cy="33" r="15" />
    <circle class="ob-knauf" cx="52" cy="33" r="6" />
  </svg>`;

const BILD_WERK = `
  <svg viewBox="0 0 104 52" aria-hidden="true">
    <rect class="ob-rahmen" x="37" y="3" width="30" height="40" rx="0.5" />
    <rect class="ob-leinwand" x="41" y="7" width="22" height="32" rx="0.5" />
    <line class="ob-plakette" x1="72" y1="30" x2="80" y2="30" />
    <path class="ob-cursor" d="M0 0 L0 11 L3 8.2 L5 12.4 L7.4 11.2 L5.3 7.1 L9 6.6 Z" />
  </svg>`;

const BILD_HAKEN = `
  <svg viewBox="0 0 104 52" aria-hidden="true">
    <path class="ob-haken" d="M36 27 L47 38 L69 15" />
  </svg>`;

const SCHRITTE = [
  {
    titel: "Sehen Sie sich um",
    desktop: "Mit gedrückter Maustaste nach links und rechts ziehen",
    touch: "Mit dem Finger nach links und rechts ziehen",
    lob: "Der Saal gehört Ihnen.",
    bild: () => BILD_UMSEHEN,
  },
  {
    titel: "Gehen Sie hinüber",
    desktop: "W A S D — oder auf den Boden klicken",
    touch: "Joystick links unten — oder auf den Boden tippen",
    lob: "Genau so.",
    bild: (touch) => (touch ? BILD_GEHEN_JOYSTICK : BILD_GEHEN_TASTE),
  },
  {
    titel: "Treten Sie an ein Werk",
    desktop: "Auf ein Bild klicken",
    touch: "Auf ein Bild tippen",
    lob: "Alles Weitere steht auf der Tafel.",
    bild: () => BILD_WERK,
  },
];

const ABSCHIED = "Das war alles. Der Rest ist Schauen.";

export function sollOnboardingLaufen() {
  const wunsch = new URLSearchParams(location.search).get("onboarding");
  if (wunsch === "1") return true;
  if (wunsch === "0") return false;
  try {
    return !localStorage.getItem(SPEICHER);
  } catch {
    return false; // kein Speicher (Privat-Modus) — dann lieber nicht nerven
  }
}

export function erstelleOnboarding({ camera, steuerung, istTouch }) {
  const karte = document.createElement("div");
  karte.id = "onboarding";
  karte.setAttribute("role", "status");
  karte.setAttribute("aria-live", "polite");
  karte.innerHTML = `
    <div class="ob-punkte">${SCHRITTE.map(() => '<i class="ob-punkt"></i>').join("")}</div>
    <div class="ob-bild"></div>
    <p class="ob-titel"></p>
    <p class="ob-wie"></p>
    <button type="button" class="ob-skip">Überspringen</button>
  `;
  document.body.appendChild(karte);

  const elPunkte = [...karte.querySelectorAll(".ob-punkt")];
  const elBild = karte.querySelector(".ob-bild");
  const elTitel = karte.querySelector(".ob-titel");
  const elWie = karte.querySelector(".ob-wie");
  const elSkip = karte.querySelector(".ob-skip");

  let index = -1;
  let erledigt = false;
  let pause = 0; // Sekunden bis zum nächsten Schritt (Lob stehen lassen)
  let sichtbarSeit = 0; // ein Schritt muss lesbar gewesen sein, bevor er fällt
  let ersterFrame = true;

  // Messwerte laufen durchgehend mit, nicht erst ab dem jeweiligen Schritt:
  // Wer beim Umsehen schon losgelaufen ist, hat Schritt 2 damit erledigt.
  let letzterYaw = 0;
  const letztePos = { x: 0, z: 0 };
  let drehung = 0;
  let strecke = 0;

  const erfuellt = [
    () => drehung >= DREHUNG_NOETIG,
    () => strecke >= STRECKE_NOETIG,
    () => steuerung.imFokus(),
  ];

  function merkeGesehen() {
    try {
      localStorage.setItem(SPEICHER, "1");
    } catch {
      /* ohne Speicher läuft es beim nächsten Mal eben nochmal */
    }
  }

  function beende(sofort) {
    if (erledigt) return;
    erledigt = true;
    merkeGesehen();
    if (sofort) {
      karte.classList.remove("sichtbar");
      setTimeout(() => karte.remove(), 600);
      return;
    }
    elBild.innerHTML = "";
    elTitel.textContent = ABSCHIED;
    elWie.textContent = "";
    elSkip.hidden = true;
    elPunkte.forEach((p) => p.classList.add("erledigt"));
    karte.classList.add("abschied");
    setTimeout(() => karte.classList.remove("sichtbar"), 2400);
    setTimeout(() => karte.remove(), 3100);
  }

  function zeige(i) {
    index = i;
    sichtbarSeit = 0;
    const s = SCHRITTE[i];
    // Neu einsetzen statt umschalten: dadurch laufen die Kennbilder im SVG
    // bei jedem Schritt von vorn los
    elBild.innerHTML = s.bild(istTouch);
    elTitel.textContent = s.titel;
    elWie.textContent = istTouch ? s.touch : s.desktop;
    karte.classList.remove("gelungen");
    elPunkte.forEach((p, n) => p.classList.toggle("aktiv", n === i));
    karte.classList.add("sichtbar");
  }

  function hakeAb() {
    const s = SCHRITTE[index];
    elBild.innerHTML = BILD_HAKEN; // zeichnet sich selbst
    elTitel.textContent = s.lob;
    elWie.textContent = "";
    karte.classList.add("gelungen");
    elPunkte[index].classList.remove("aktiv");
    elPunkte[index].classList.add("erledigt");
    // Wer den Handgriff schon konnte, wartet kürzer auf den nächsten
    pause = 1.1;
  }

  elSkip.addEventListener("click", (e) => {
    e.stopPropagation();
    beende(true);
  });

  function update(dt) {
    if (erledigt) return;

    // Messung
    if (ersterFrame) {
      ersterFrame = false;
      letzterYaw = camera.rotation.y;
      letztePos.x = camera.position.x;
      letztePos.z = camera.position.z;
      zeige(0);
      return;
    }
    let d = camera.rotation.y - letzterYaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    drehung += Math.abs(d);
    letzterYaw = camera.rotation.y;
    const dx = camera.position.x - letztePos.x;
    const dz = camera.position.z - letztePos.z;
    // Der Sprung beim Saalwechsel (Blende + Teleport) ist kein Gehen
    const schritt = Math.hypot(dx, dz);
    if (schritt < 1) strecke += schritt;
    letztePos.x = camera.position.x;
    letztePos.z = camera.position.z;

    if (pause > 0) {
      pause -= dt;
      if (pause <= 0) {
        if (index + 1 < SCHRITTE.length) zeige(index + 1);
        else beende(false);
      }
      return;
    }

    // Wer den Handgriff längst kann, hat ihn oft schon erledigt, bevor der
    // Schritt überhaupt erscheint. Trotzdem kurz stehen lassen — sonst
    // blitzt die Karte nur auf und der Besucher liest gar nichts.
    sichtbarSeit += dt;
    if (sichtbarSeit < 0.8) return;
    if (!karte.classList.contains("gelungen") && erfuellt[index]()) hakeAb();
  }

  return { update, beende: () => beende(true) };
}
