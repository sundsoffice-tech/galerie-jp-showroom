// UI — Saaltext-Panel, Sammlung (Warenkorb), Kasse, Saal-Navigation,
// Saal-Blende mit Caption, Touch-Joystick und Stummschalter.
// Jedes Werk ist ein Unikat: nur einmal sammelbar, nach Verkauf gesperrt.

import { raeume, raumById, werkById, formatPreis, bildThumbnail, galerie } from "./katalog.js";
import * as klang from "./klang.js";
import { machBottomSheet } from "./bottomsheet.js";
import { IST_TOUCH } from "./geraet.js";

const LS_SAMMLUNG = "galerie-jp-sammlung";
const LS_VERKAUFT = "galerie-jp-verkauft";

export function ladeVerkaufte() {
  try {
    return JSON.parse(localStorage.getItem(LS_VERKAUFT)) || [];
  } catch {
    return [];
  }
}

export function erstelleUI({ aktualisiereVerkauft, steuerungRef }) {
  const $ = (id) => document.getElementById(id);

  let sammlung = [];
  try {
    sammlung = (JSON.parse(localStorage.getItem(LS_SAMMLUNG)) || []).filter(
      (id) => werkById(id) && !werkById(id).verkauft
    );
  } catch {
    sammlung = [];
  }

  let offenesWerk = null;

  // ————— Hover-Label —————
  const hoverLabel = document.createElement("div");
  hoverLabel.id = "hover-label";
  document.body.appendChild(hoverLabel);

  function zeigeHover(werkId, x, y) {
    if (!werkId) {
      hoverLabel.classList.remove("visible");
      return;
    }
    const werk = werkById(werkId);
    hoverLabel.innerHTML =
      `${werk.titel}<span class="hl-price">${werk.verkauft ? "VERKAUFT" : formatPreis(werk.preis)}</span>` +
      (IST_TOUCH ? '<span class="hl-tipp">Antippen für Details</span>' : "");
    if (!IST_TOUCH) {
      // nur der Desktop-Zeiger wandert; das Blick-Label sitzt fix (CSS)
      hoverLabel.style.left = `${x}px`;
      hoverLabel.style.top = `${y}px`;
    }
    hoverLabel.classList.add("visible");
  }

  // ————— Intro / Chrome —————
  function introAusblenden() {
    const intro = $("intro");
    intro.classList.add("leaving");
    setTimeout(() => intro.remove(), 1200);
    document.getElementById("scene").classList.add("walk");
  }

  function zeigeChrome(teil) {
    if (teil === "top") $("chrome-top").classList.add("sichtbar");
    if (teil === "nav") $("room-nav").classList.add("sichtbar");
  }

  // ————— Saal-Blende mit Caption —————
  const fade = $("fade");
  const caption = $("saal-caption");
  let captionTimer = null;

  function blendeZuSaal(raum, teleport) {
    fade.classList.add("dunkel");
    setTimeout(() => {
      teleport();
      caption.querySelector(".sc-saal").textContent = raum.saal;
      caption.querySelector(".sc-name").textContent = raum.name;
      caption.classList.add("sichtbar");
      fade.classList.remove("dunkel");
      clearTimeout(captionTimer);
      captionTimer = setTimeout(() => caption.classList.remove("sichtbar"), 2100);
    }, 380);
  }

  // ————— Sheet-Backdrop (nur Warenkorb; das Werk-Sheet lässt die Szene frei) —————
  const backdrop = document.createElement("div");
  backdrop.id = "sheet-backdrop";
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", () => schliesseCart());

  // ————— Stummschalter —————
  const muteBtn = $("mute");
  function muteAnzeige() {
    muteBtn.textContent = klang.istStumm() ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-label", klang.istStumm() ? "Ton einschalten" : "Ton ausschalten");
  }
  muteBtn.addEventListener("click", () => {
    klang.schalteStumm();
    muteAnzeige();
  });
  muteAnzeige();

  // ————— Saal-Navigation —————
  const nav = $("room-nav");
  raeume.forEach((raum, i) => {
    const b = document.createElement("button");
    b.textContent = raum.name;
    b.addEventListener("click", () => steuerungRef().zuRaum(i));
    nav.appendChild(b);
  });

  function markiereRaum(index) {
    [...nav.children].forEach((b, i) => {
      b.classList.toggle("active", i === index);
      if (i === index && IST_TOUCH) {
        b.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    });
  }

  // ————— Werk-Panel —————
  const panel = $("artwork-panel");
  const werkSheet = machBottomSheet(panel, {
    peek: 0.46,
    onClose: () => schliesseWerkPanel(),
  });

  function oeffneWerk(werkId) {
    const werk = werkById(werkId);
    if (!werk) return;
    offenesWerk = werkId;
    const raum = raumById(werk.raum);
    $("aw-room").textContent = `${raum.saal} — ${raum.name}`;
    $("aw-title").textContent = werk.titel;
    $("aw-artist").textContent = `${werk.kuenstler}`;
    $("aw-technique").textContent = werk.technik;
    $("aw-dimensions").textContent = `${werk.breite_cm} × ${werk.hoehe_cm} cm`;
    $("aw-year").textContent = werk.jahr;
    $("aw-desc").textContent = werk.beschreibung;
    $("aw-price").textContent = formatPreis(werk.preis);
    aktualisiereKaufButton();
    if (!werkSheet.oeffne("peek")) panel.classList.add("open"); // Desktop/Landscape
    panel.setAttribute("aria-hidden", "false");
    steuerungRef().setzeSheetOffset(true);
  }

  function aktualisiereKaufButton() {
    if (!offenesWerk) return;
    const werk = werkById(offenesWerk);
    const btn = $("aw-add");
    const kaufzeile = panel.querySelector(".aw-buy");
    if (werk.verkauft) {
      kaufzeile.classList.add("hidden");
      $("aw-sold").classList.remove("hidden");
    } else {
      kaufzeile.classList.remove("hidden");
      $("aw-sold").classList.add("hidden");
      const drin = sammlung.includes(werk.id);
      btn.disabled = drin;
      btn.textContent = drin ? "In Ihrer Sammlung" : "In die Sammlung";
    }
    // Stripe Payment Link (Stufe B): Sofortkauf, wenn ein Link gepflegt ist.
    // Der Link ist im Stripe-Dashboard auf 1 Zahlung limitiert (Unikat-Schutz).
    const stripeBtn = $("aw-stripe");
    if (werk.stripeLink && !werk.verkauft) {
      stripeBtn.classList.remove("hidden");
      stripeBtn.onclick = () => window.open(werk.stripeLink, "_blank", "noopener");
    } else {
      stripeBtn.classList.add("hidden");
    }
  }

  $("aw-add").addEventListener("click", () => {
    if (!offenesWerk) return;
    const werk = werkById(offenesWerk);
    if (werk.verkauft || sammlung.includes(werk.id)) return;
    sammlung.push(werk.id);
    speichereSammlung();
    aktualisiereKaufButton();
    renderSammlung(true);
    klang.sammelKlang();
  });

  function schliesseWerkPanel() {
    offenesWerk = null;
    werkSheet.schliesse();
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    steuerungRef().fokusVerlassen();
    steuerungRef().setzeSheetOffset(false);
  }

  // ————— Sammlung (Warenkorb) —————
  const cartPanel = $("cart-panel");
  const cartSheet = machBottomSheet(cartPanel, {
    peek: 0.6,
    onClose: () => schliesseCart(),
  });

  function schliesseCart() {
    cartSheet.schliesse();
    cartPanel.classList.remove("open");
    cartPanel.setAttribute("aria-hidden", "true");
    backdrop.classList.remove("visible");
  }

  function speichereSammlung() {
    localStorage.setItem(LS_SAMMLUNG, JSON.stringify(sammlung));
  }

  function summe() {
    return sammlung.reduce((s, id) => s + werkById(id).preis, 0);
  }

  function renderSammlung(bump = false) {
    const zaehler = $("cart-count");
    zaehler.textContent = sammlung.length;
    if (bump) {
      zaehler.classList.remove("bump");
      void zaehler.offsetWidth;
      zaehler.classList.add("bump");
    }
    const wrap = $("cart-items");
    wrap.innerHTML = "";
    if (!sammlung.length) {
      const leer = document.createElement("p");
      leer.className = "cart-empty";
      leer.textContent = "Noch keine Werke ausgewählt. Klicken Sie im Rundgang ein Werk an.";
      wrap.appendChild(leer);
    }
    sammlung.forEach((id) => {
      const werk = werkById(id);
      const el = document.createElement("div");
      el.className = "cart-item";
      const img = document.createElement("img");
      img.src = bildThumbnail(werk);
      img.alt = werk.titel;
      img.addEventListener("click", () => {
        schliesseCart();
        steuerungRef().fokussiere(id);
      });
      const mitte = document.createElement("div");
      mitte.innerHTML = `<div class="cart-item-title">${werk.titel}</div><div class="cart-item-artist">${werk.kuenstler}, Unikat</div>`;
      const rechts = document.createElement("div");
      rechts.innerHTML = `<div class="cart-item-price">${formatPreis(werk.preis)}</div>`;
      const entf = document.createElement("button");
      entf.className = "cart-item-remove";
      entf.textContent = "Entfernen";
      entf.addEventListener("click", () => {
        sammlung = sammlung.filter((x) => x !== id);
        speichereSammlung();
        renderSammlung();
        aktualisiereKaufButton();
      });
      rechts.appendChild(entf);
      el.append(img, mitte, rechts);
      wrap.appendChild(el);
    });
    $("cart-total").textContent = formatPreis(summe());
    $("checkout-open").disabled = !sammlung.length;
  }

  // ————— Kasse —————
  const checkout = $("checkout");

  $("checkout-open").addEventListener("click", () => {
    $("checkout-total").textContent = formatPreis(summe());
    // Reservierte Werke im Modal auflisten
    const liste = $("checkout-items");
    liste.innerHTML = "";
    sammlung.forEach((id) => {
      const werk = werkById(id);
      const zeile = document.createElement("div");
      zeile.className = "checkout-zeile";
      zeile.innerHTML = `<span>${werk.titel}, ${werk.kuenstler}</span><span>${formatPreis(werk.preis)}</span>`;
      liste.appendChild(zeile);
    });
    $("checkout-form-view").classList.remove("hidden");
    $("checkout-success-view").classList.add("hidden");
    checkout.classList.remove("hidden");
  });

  // Reservierung per E-Mail an die Galerie — serverlos über Web3Forms.
  // Leerer web3formsKey in werke.json = Demo-Modus (keine Mail, gleiche UI).
  const RESERVIERUNG_ENDPOINT = "https://api.web3forms.com/submit";

  function reservierungsText() {
    return sammlung
      .map((id) => {
        const w = werkById(id);
        return `• ${w.titel} — ${w.kuenstler} (${w.id}) · ${formatPreis(w.preis)}`;
      })
      .join("\n");
  }

  function zeigeCheckoutFehler(text) {
    const el = $("checkout-error");
    el.textContent = text;
    el.classList.remove("hidden");
  }

  $("checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget; // vor dem await greifen
    const btn = form.querySelector('button[type="submit"]');
    $("checkout-error").classList.add("hidden");

    const felder = Object.fromEntries(new FormData(form));
    if (felder.botcheck) return; // Honeypot: Bots stumm verwerfen

    const key = (galerie.web3formsKey || "").trim();
    if (key) {
      btn.disabled = true;
      const alterText = btn.textContent;
      btn.textContent = "Wird übermittelt …";
      try {
        const res = await fetch(RESERVIERUNG_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            access_key: key,
            subject: `Reservierung: ${sammlung.length} Werk(e), ${formatPreis(summe())} — ${felder.name}`,
            from_name: `${galerie.name} — Virtueller Showroom`,
            name: felder.name,
            email: felder.email,
            telefon: felder.phone || "nicht angegeben",
            nachricht: felder.nachricht || "—",
            werke: reservierungsText(),
            gesamtsumme: formatPreis(summe()),
            replyto: felder.email, // die Galerie antwortet direkt dem Kunden
            botcheck: "",
          }),
        });
        // Web3Forms liefert auch bei Problemen HTTP 200 mit { success:false }
        const daten = await res.json().catch(() => ({}));
        if (!(res.ok && daten.success)) throw new Error(daten.message || `HTTP ${res.status}`);
      } catch (fehler) {
        console.error("Reservierung fehlgeschlagen:", fehler);
        zeigeCheckoutFehler(
          "Die Reservierung konnte nicht übermittelt werden. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut — oder kontaktieren Sie die Galerie direkt."
        );
        btn.disabled = false;
        btn.textContent = alterText;
        return; // Sammlung + Eingaben bleiben erhalten
      }
      btn.disabled = false;
      btn.textContent = alterText;
    } else {
      console.info("Demo-Modus: galerie.web3formsKey ist leer — keine E-Mail versendet.");
    }

    // Erfolg (oder Demo): Werke lokal als reserviert markieren, Bestätigung zeigen
    const verkaufte = ladeVerkaufte();
    sammlung.forEach((id) => {
      werkById(id).verkauft = true;
      aktualisiereVerkauft(id);
      if (!verkaufte.includes(id)) verkaufte.push(id);
    });
    localStorage.setItem(LS_VERKAUFT, JSON.stringify(verkaufte));
    sammlung = [];
    speichereSammlung();
    renderSammlung();
    aktualisiereKaufButton();
    form.reset();
    $("checkout-form-view").classList.add("hidden");
    $("checkout-success-view").classList.remove("hidden");
  });

  // ————— Öffnen / Schließen —————
  $("cart-open").addEventListener("click", () => {
    renderSammlung();
    if (!cartSheet.oeffne("voll")) cartPanel.classList.add("open");
    else backdrop.classList.add("visible");
    cartPanel.setAttribute("aria-hidden", "false");
  });

  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => {
      const ziel = b.dataset.close;
      if (ziel === "artwork") schliesseWerkPanel();
      if (ziel === "cart") schliesseCart();
      if (ziel === "checkout") checkout.classList.add("hidden");
    })
  );

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (!checkout.classList.contains("hidden")) checkout.classList.add("hidden");
    else if (cartPanel.classList.contains("open")) schliesseCart();
    else if (panel.classList.contains("open")) schliesseWerkPanel();
  });

  renderSammlung();

  return {
    oeffneWerk,
    schliesseWerkPanel,
    zeigeHover,
    markiereRaum,
    blendeZuSaal,
    introAusblenden,
    zeigeChrome,
  };
}
