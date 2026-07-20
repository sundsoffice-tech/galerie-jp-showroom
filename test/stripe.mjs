// Stripe-Weg (Payment Links, „Stufe B") — geprüft wird alles, was auf
// unserer Seite liegt. Der Zahlvorgang selbst findet bei Stripe statt und
// ist hier bewusst nicht simuliert; getestet wird der Absprung dorthin und
// die Rückkehr über ?erworben=<werk-id>.
// Aufruf: node test/stripe.mjs [url]
import { chromium } from "playwright";

const URL_BASIS = process.argv[2] || "http://localhost:5173/";
const LINK = "https://buy.stripe.com/test_beispiel"; // wird nie aufgerufen

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const seite = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const fehler = [];
seite.on("pageerror", (e) => fehler.push(e.message));

const schritte = [];
const pruefe = async (name, fn) => {
  try {
    const r = await fn();
    schritte.push(`  OK    ${name}${r ? " — " + r : ""}`);
  } catch (e) {
    schritte.push(`  FEHLT ${name} — ${e.message.split("\n")[0]}`);
  }
};

await seite.goto(URL_BASIS, { waitUntil: "load", timeout: 60000 });
await seite.waitForTimeout(2500);
await seite.click("#enter");
await seite.waitForTimeout(4200);

// Der Sofortkauf-Knopf erscheint nur, wenn ein Zahlungslink gepflegt ist.
// Die Demo-Daten enthalten bewusst keinen echten Link -> zur Laufzeit setzen.
await pruefe("Ohne Zahlungslink kein Sofortkauf-Knopf", async () => {
  await seite.click("#catalog-open");
  await seite.waitForTimeout(700);
  await seite.locator(".catalog-item").nth(1).click();
  await seite.waitForTimeout(2600);
  const sichtbar = await seite.evaluate(
    () => !document.getElementById("aw-stripe").classList.contains("hidden")
  );
  if (sichtbar) throw new Error("Knopf trotz fehlendem Link sichtbar");
  return "korrekt verborgen";
});

const werkId = await seite.evaluate(() => location.hash.slice(1));

await pruefe("Mit Zahlungslink erscheint der Sofortkauf-Knopf mit Preis", async () => {
  await seite.evaluate(
    ([id, link]) => {
      const w = window.__galerie.szene
        ? [...window.__galerie.szene.kunstwerke.values()].find((e) => e.werk.id === id)?.werk
        : null;
      if (w) w.stripeLink = link;
    },
    [werkId, LINK]
  );
  // Panel neu öffnen, damit der Knopf-Zustand neu berechnet wird
  await seite.keyboard.press("Escape");
  await seite.waitForTimeout(500);
  await seite.click("#catalog-open");
  await seite.waitForTimeout(700);
  await seite.locator(".catalog-item").nth(1).click();
  await seite.waitForTimeout(2600);
  const z = await seite.evaluate(() => {
    const b = document.getElementById("aw-stripe");
    return { sichtbar: !b.classList.contains("hidden"), text: b.textContent };
  });
  if (!z.sichtbar) throw new Error("Knopf fehlt");
  if (!/\d/.test(z.text)) throw new Error(`kein Preis im Knopf: „${z.text}"`);
  return z.text;
});

await pruefe("Sofortkauf führt im selben Tab zu Stripe", async () => {
  // Echte Navigation abfangen (location.assign lässt sich nicht überschreiben)
  let ziel = null;
  let neueTabs = 0;
  seite.context().on("page", () => neueTabs++);
  await seite.route("**buy.stripe.com**", (route) => {
    ziel = route.request().url();
    route.abort();
  });
  await seite.click("#aw-stripe");
  await seite.waitForTimeout(1500);
  await seite.unroute("**buy.stripe.com**");
  if (ziel !== LINK) throw new Error(`Ziel war ${ziel}`);
  if (neueTabs > 0) throw new Error("es öffnete sich ein neuer Tab (auf Mobil blockierbar)");
  return "gleicher Tab, kein blockierbares Fenster";
});

// ————— Rückkehr nach erfolgreicher Zahlung —————
await pruefe("Rückkehr markiert verkauft, dankt und räumt die URL auf", async () => {
  const ziel = `${URL_BASIS}${URL_BASIS.includes("?") ? "&" : "?"}erworben=${werkId}`;
  await seite.goto(ziel, { waitUntil: "load", timeout: 60000 });
  await seite.waitForTimeout(3800);
  const z = await seite.evaluate((id) => ({
    danke: !document.getElementById("erwerb-danke").classList.contains("hidden"),
    text: document.getElementById("danke-text").textContent,
    urlSauber: !location.search.includes("erworben"),
    gespeichert: (JSON.parse(localStorage.getItem("galerie-jp-verkauft")) || []).includes(id),
    imWarenkorb: (JSON.parse(localStorage.getItem("galerie-jp-sammlung")) || []).includes(id),
  }), werkId);
  if (!z.danke) throw new Error("keine Kaufbestätigung");
  if (!z.urlSauber) throw new Error("?erworben blieb in der URL stehen");
  if (!z.gespeichert) throw new Error("Werk nicht als verkauft gespeichert");
  if (z.imWarenkorb) throw new Error("Werk blieb in der Sammlung");
  return z.text.slice(0, 48) + "…";
});

await pruefe("Gekauftes Werk bleibt dauerhaft gesperrt", async () => {
  // Frischer Besuch ohne Parameter: der Verkauf muss den Neuladen überleben
  await seite.goto(URL_BASIS, { waitUntil: "load", timeout: 60000 });
  await seite.waitForTimeout(2500);
  await seite.click("#enter");
  await seite.waitForTimeout(4200);
  await seite.click("#catalog-open");
  await seite.waitForTimeout(1000);
  const z = await seite.evaluate(() =>
    [...document.querySelectorAll(".catalog-item")]
      .filter((k) => k.querySelector(".ci-preis")?.textContent === "Verkauft").length
  );
  if (z < 2) throw new Error(`nur ${z} verkaufte Werke im Katalog (erwartet: Demo + gekauftes)`);
  return `${z} Werke als Verkauft gelistet`;
});

console.log(`=== STRIPE-WEG (Payment Links) — ${URL_BASIS} ===`);
schritte.forEach((s) => console.log(s));
console.log(`=== SEITENFEHLER: ${fehler.length} ===`);
fehler.slice(0, 5).forEach((f) => console.log("  " + f));

await browser.close();
process.exit(schritte.some((s) => s.startsWith("  FEHLT")) || fehler.length ? 1 : 0);
