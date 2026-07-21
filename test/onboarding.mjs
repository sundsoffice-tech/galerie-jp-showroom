// Mini-Onboarding: die drei Handgriffe müssen sich durch echtes Tun
// abhaken lassen — nicht durch Warten. Geprüft wird außerdem, dass die
// Karte beim zweiten Besuch schweigt und dass „Überspringen" sie sofort
// und dauerhaft beendet.
// Aufruf: node test/onboarding.mjs [basis-url]
import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:5173/";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const kontext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const seite = await kontext.newPage();

const fehler = [];
seite.on("console", (m) => m.type() === "error" && fehler.push(m.text()));
seite.on("pageerror", (e) => fehler.push("PAGEERROR: " + (e.stack || e.message)));

const schritte = [];
const pruefe = async (name, fn) => {
  try {
    const r = await fn();
    schritte.push(`  OK    ${name}${r ? " — " + r : ""}`);
  } catch (e) {
    schritte.push(`  FEHLT ${name} — ${e.message.split("\n")[0]}`);
  }
};

const karte = () =>
  seite.evaluate(() => {
    const k = document.getElementById("onboarding");
    if (!k) return null;
    return {
      sichtbar: k.classList.contains("sichtbar"),
      gelungen: k.classList.contains("gelungen"),
      titel: k.querySelector(".ob-titel").textContent,
      wie: k.querySelector(".ob-wie").textContent,
      erledigt: k.querySelectorAll(".ob-punkt.erledigt").length,
    };
  });

const eintreten = async () => {
  await seite.click("#enter", { timeout: 5000 });
  await seite.waitForTimeout(4200); // Intro-Orchestrierung abwarten
};

await seite.goto(URL, { waitUntil: "load", timeout: 60000 });
await seite.waitForTimeout(3000);

await pruefe("Eintrittsseite verzichtet auf die Bedienungsliste", async () => {
  const t = await seite.evaluate(() => document.querySelector(".intro-hints").textContent.trim());
  if (/W A S D/.test(t)) throw new Error("die alte Tastenliste steht noch da");
  if (!/Handgriffe/.test(t)) throw new Error(`stattdessen: „${t}"`);
  return `„${t}"`;
});

await eintreten();

await pruefe("Erster Handgriff wird angeboten", async () => {
  const k = await karte();
  if (!k) throw new Error("keine Onboarding-Karte im Dokument");
  if (!k.sichtbar) throw new Error("Karte ist nicht eingeblendet");
  if (!/Sehen Sie sich um/.test(k.titel)) throw new Error(`zeigt „${k.titel}"`);
  if (!/ziehen/i.test(k.wie)) throw new Error(`Hinweis lautet „${k.wie}"`);
  return `„${k.titel}" · ${k.wie}`;
});

const istGelungen = () =>
  seite.evaluate(() => !!document.getElementById("onboarding")?.classList.contains("gelungen"));

await pruefe("Umsehen hakt den ersten Handgriff ab", async () => {
  // Solange schwenken, bis der Schritt anerkannt ist. Ein einzelner fester
  // Zug reicht nicht verlässlich: unter Last fasst der Browser Zeigerwege
  // zusammen, dann kommt weniger Drehung an, als die Geste hergibt.
  for (let runde = 0; runde < 10 && !(await istGelungen()); runde++) {
    const von = runde % 2 ? 340 : 940;
    const nach = runde % 2 ? 940 : 340;
    await seite.mouse.move(von, 420);
    await seite.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await seite.mouse.move(von + ((nach - von) * i) / 12, 420);
      await seite.waitForTimeout(30);
    }
    await seite.mouse.up();
    await seite.waitForTimeout(500);
  }
  const k = await karte();
  if (!k.gelungen) throw new Error(`nicht abgehakt, Karte zeigt „${k.titel}"`);
  return `„${k.titel}"`;
});

// Die Karte zählt Simulationszeit, nicht Wanduhr. Unter der Software-GPU
// des Testlaufs rendert die Szene nur wenige Bilder je Sekunde, also
// vergeht drinnen ein Vielfaches langsamer als draußen — daher die
// großzügigen Fristen und der lange Tastendruck.
const wartetAufTitel = (muster, ms = 25000) =>
  seite.waitForFunction(
    (m) => new RegExp(m).test(document.querySelector(".ob-titel")?.textContent || ""),
    muster,
    { timeout: ms }
  );

await pruefe("Gehen hakt den zweiten Handgriff ab", async () => {
  await wartetAufTitel("Gehen Sie hinüber");
  // Solange gehen, bis der Schritt anerkannt ist: eine feste Tastendauer
  // reicht bei schwankender Bildrate mal und mal nicht, weil die gelaufene
  // Strecke an der Simulationszeit hängt, nicht an der Wanduhr.
  await seite.keyboard.down("w");
  try {
    await wartetAufTitel("Genau so", 60000);
  } finally {
    await seite.keyboard.up("w");
  }
  const k = await karte();
  if (!k.gelungen) throw new Error(`nicht abgehakt, Karte zeigt „${k.titel}"`);
  return `„${k.titel}"`;
});

await pruefe("Werk öffnen beendet das Onboarding", async () => {
  await wartetAufTitel("Treten Sie an ein Werk");
  // Der Weg über den Katalog ist unabhängig von 3D-Klickkoordinaten
  await seite.click("#catalog-open");
  await seite.waitForTimeout(600);
  await seite.click(".catalog-item");
  await wartetAufTitel("Schauen");
  const k = await karte();
  if (!k) throw new Error("Karte war schon fort, bevor der Abschied kam");
  if (k.erledigt !== 3) throw new Error(`${k.erledigt} von 3 Punkten abgehakt`);
  return `alle drei erledigt · „${k.titel}"`;
});

await pruefe("Karte räumt sich selbst ab", async () => {
  await seite.waitForFunction(() => !document.getElementById("onboarding"), null, { timeout: 8000 });
  return "aus dem Dokument entfernt";
});

await pruefe("Beim zweiten Besuch schweigt das Onboarding", async () => {
  await seite.goto(URL, { waitUntil: "load", timeout: 60000 });
  await seite.waitForTimeout(2500);
  const hinweise = await seite.evaluate(() =>
    document.querySelector(".intro-hints").textContent.trim()
  );
  await eintreten();
  const k = await karte();
  if (k) throw new Error("Karte erschien erneut");
  if (!/W A S D/.test(hinweise)) throw new Error("Eintrittsseite nennt die Bedienung nicht mehr");
  return "keine Karte, dafür wieder die kurze Bedienungszeile";
});

await pruefe("Überspringen beendet sofort und dauerhaft", async () => {
  // Die erste Seite rendert sonst weiter und teilt sich die Software-GPU
  // mit der neuen — der Eintreten-Knopf wäre dort minutenlang träge.
  await seite.close();
  const frisch = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const s2 = await frisch.newPage();
  await s2.goto(URL, { waitUntil: "load", timeout: 60000 });
  await s2.waitForTimeout(3000);
  await s2.click("#enter");
  // Die Karte hängt sofort im Dokument, wird aber erst nach dem Intro
  // eingeblendet — auf die Einblendung warten, nicht auf die Uhr
  await s2.waitForSelector("#onboarding.sichtbar", { timeout: 25000 });
  const beimErstenSchritt = await s2.evaluate(
    () => document.querySelector(".ob-titel").textContent
  );
  await s2.click(".ob-skip", { timeout: 5000 });
  await s2.waitForFunction(() => !document.getElementById("onboarding"), null, { timeout: 5000 });
  // Dass ein gesetztes Merkzeichen die Karte fernhält, zeigt der Schritt
  // „zweiter Besuch" oben — hier zählt, dass Überspringen es überhaupt setzt.
  const gemerkt = await s2.evaluate(() => localStorage.getItem("galerie-onboarding-gesehen"));
  await frisch.close();
  if (!gemerkt) throw new Error("nichts gemerkt — die Karte käme wieder");
  return `mitten in „${beimErstenSchritt}" abgebrochen, Karte weg und gemerkt`;
});

console.log(`=== MINI-ONBOARDING — ${URL} ===`);
schritte.forEach((s) => console.log(s));
console.log(`=== KONSOLENFEHLER: ${fehler.length} ===`);
fehler.slice(0, 5).forEach((f) => console.log("  " + f));

await browser.close();
if (schritte.some((s) => s.includes("FEHLT")) || fehler.length) process.exit(1);
