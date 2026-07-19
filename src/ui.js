// UI — Saaltext-Panel, Sammlung (Warenkorb), Kasse, Saal-Navigation,
// Saal-Blende mit Caption, Touch-Joystick und Stummschalter.
// Jedes Werk ist ein Unikat: nur einmal sammelbar, nach Verkauf gesperrt.

import { raeume, raumById, werkById, werkeImRaum, formatPreis, setzeWerkBild, galerie } from "./katalog.js";
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
  let fokusVorher = null; // Tastatur-Fokus vor dem Öffnen eines Panels

  // ————— System-Zurück (v. a. Android): schließt die oberste Ebene,
  // statt die Galerie zu verlassen. Modell: EIN Verlaufseintrag, solange
  // irgendein Overlay offen ist — Wechsel zwischen Panels berühren den
  // Verlauf nicht (keine Race mit dem asynchronen history.back()).
  let verlaufAktiv = false;
  let popUnterdruecken = 0;

  function irgendwasOffen() {
    return (
      !legal.classList.contains("hidden") ||
      !checkout.classList.contains("hidden") ||
      catalogPanel.classList.contains("open") ||
      cartPanel.classList.contains("open") ||
      panel.classList.contains("open")
    );
  }

  // nach jedem Öffnen aufrufen
  function verlaufAnlegen() {
    if (verlaufAktiv) return;
    history.pushState({ galerieOverlay: true }, "");
    verlaufAktiv = true;
  }

  // nach jedem Schließen aufrufen (egal aus welcher Quelle)
  function verlaufAbbauen() {
    if (!verlaufAktiv || irgendwasOffen()) return;
    verlaufAktiv = false;
    popUnterdruecken++;
    history.back();
  }

  window.addEventListener("popstate", () => {
    if (popUnterdruecken > 0) {
      popUnterdruecken--;
      return;
    }
    if (!verlaufAktiv) return;
    verlaufAktiv = false;
    schliesseObersteEbene();
    // liegt darunter noch ein Overlay, bleibt die Galerie „einen Back entfernt"
    if (irgendwasOffen()) verlaufAnlegen();
  });

  function schliesseObersteEbene() {
    if (!legal.classList.contains("hidden")) schliesseLegal(false);
    else if (!checkout.classList.contains("hidden")) schliesseCheckout(false);
    else if (catalogPanel.classList.contains("open")) schliesseKatalog(false);
    else if (cartPanel.classList.contains("open")) schliesseCart(false);
    else if (panel.classList.contains("open")) schliesseWerkPanel(false);
  }

  function merkeFokus() {
    const el = document.activeElement;
    // Fokus in einem gerade schließenden Panel wäre nach dem Schließen unsichtbar
    fokusVorher = el && !el.closest(".panel") && el !== document.body ? el : null;
  }

  function stelleFokusWiederHer() {
    // nur zurückgeben, wenn das Element noch existiert und sichtbar ist
    if (fokusVorher && fokusVorher.isConnected && fokusVorher.offsetParent !== null) {
      fokusVorher.focus({ preventScroll: true });
    }
    fokusVorher = null;
  }

  // Screenreader-Statusmeldungen (aria-live)
  function melde(text) {
    $("sr-status").textContent = text;
  }

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

  function zeigeSaalTitel(raum) {
    caption.querySelector(".sc-saal").textContent = raum.saal;
    caption.querySelector(".sc-name").textContent = raum.name;
    caption.querySelector(".sc-desc").textContent = raum.beschreibung || "";
    caption.classList.add("sichtbar");
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => caption.classList.remove("sichtbar"), 2400);
  }

  function blendeZuSaal(raum, teleport) {
    fade.classList.add("dunkel");
    setTimeout(() => {
      teleport();
      zeigeSaalTitel(raum);
      fade.classList.remove("dunkel");
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

  // ————— Saal-Navigation (mit Verfügbar-Zähler) —————
  const nav = $("room-nav");
  raeume.forEach((raum, i) => {
    const b = document.createElement("button");
    b.textContent = raum.name;
    b.title = raum.beschreibung || "";
    const zaehler = document.createElement("span");
    zaehler.className = "nav-count";
    b.appendChild(zaehler);
    b.addEventListener("click", () => steuerungRef().zuRaum(i));
    nav.appendChild(b);
  });

  function aktualisiereNavZaehler() {
    raeume.forEach((raum, i) => {
      const n = werkeImRaum(raum.id).filter((w) => !w.verkauft).length;
      nav.children[i].querySelector(".nav-count").textContent = n;
    });
  }
  aktualisiereNavZaehler();

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
    // hoch genug, dass Titel, Daten, Preis und Kauf-Button ohne Ziehen sichtbar sind
    peek: 0.58,
    onClose: () => schliesseWerkPanel(),
  });

  function oeffneWerk(werkId) {
    const werk = werkById(werkId);
    if (!werk) return;
    const warZu = !panel.classList.contains("open");
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
    setzeWerkBild($("aw-bild"), werk);
    $("aw-bild").alt = `${werk.titel}, ${werk.kuenstler}`;
    // Anfrage-CTA per Mail (nur wenn eine Galerie-Adresse gepflegt ist)
    const inquiry = $("aw-inquiry");
    if (galerie.email) {
      inquiry.classList.remove("hidden");
      inquiry.href = `mailto:${galerie.email}?subject=${encodeURIComponent(
        `Anfrage: ${werk.titel} — ${werk.kuenstler}`
      )}`;
    } else {
      inquiry.classList.add("hidden");
    }
    // Deep-Link in die URL schreiben
    history.replaceState(null, "", `#${werkId}`);
    aktualisiereKaufButton();
    if (!werkSheet.oeffne("peek")) panel.classList.add("open"); // Desktop/Landscape
    panel.setAttribute("aria-hidden", "false");
    steuerungRef().setzeSheetOffset(true);
    if (warZu) {
      merkeFokus();
      panel.querySelector(".panel-close").focus({ preventScroll: true });
      verlaufAnlegen();
    }
  }

  // Blättern: vor/zurück durch die Werke des aktuellen Saals
  function blaettere(richtung) {
    if (!offenesWerk) return;
    const werk = werkById(offenesWerk);
    const liste = werkeImRaum(werk.raum);
    const i = liste.findIndex((w) => w.id === offenesWerk);
    const ziel = liste[(i + richtung + liste.length) % liste.length];
    if (ziel && ziel.id !== offenesWerk) {
      // ohne Kamerafahrt (Katalog-Modus/ungehängt): Panel blättert trotzdem
      if (!steuerungRef().fokussiere(ziel.id)) oeffneWerk(ziel.id);
    }
  }
  $("aw-prev").addEventListener("click", () => blaettere(-1));
  $("aw-next").addEventListener("click", () => blaettere(1));

  // Deep-Link teilen
  $("aw-share").addEventListener("click", async () => {
    if (!offenesWerk) return;
    const url = `${location.origin}${location.pathname}#${offenesWerk}`;
    try {
      await navigator.clipboard.writeText(url);
      $("aw-share").textContent = "Kopiert ✓";
      setTimeout(() => ($("aw-share").textContent = "Link kopieren"), 1800);
    } catch {
      prompt("Link zum Werk:", url);
    }
  });

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
      btn.disabled = false;
      btn.textContent = drin ? "Aus der Sammlung entfernen" : "In die Sammlung";
      btn.classList.toggle("entfernen", drin);
      // „Preis auf Anfrage": kein Warenkorb, nur der Anfrage-Weg
      btn.classList.toggle("hidden", werk.preis == null);
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
    if (werk.verkauft) return;
    if (sammlung.includes(werk.id)) {
      // zweiter Weg des Buttons: wieder herausnehmen
      sammlung = sammlung.filter((x) => x !== werk.id);
      speichereSammlung();
      aktualisiereKaufButton();
      renderSammlung();
      melde(`„${werk.titel}" aus der Sammlung entfernt.`);
      return;
    }
    sammlung.push(werk.id);
    speichereSammlung();
    aktualisiereKaufButton();
    renderSammlung(true);
    klang.sammelKlang();
    melde(`„${werk.titel}" in die Sammlung gelegt.`);
  });

  function schliesseWerkPanel(mitVerlauf = true) {
    const warOffen = panel.classList.contains("open");
    offenesWerk = null;
    werkSheet.schliesse();
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    steuerungRef().fokusVerlassen();
    steuerungRef().setzeSheetOffset(false);
    history.replaceState(history.state, "", location.pathname + location.search);
    stelleFokusWiederHer();
    if (warOffen && mitVerlauf) verlaufAbbauen();
  }

  // ————— Sammlung (Warenkorb) —————
  const cartPanel = $("cart-panel");
  const cartSheet = machBottomSheet(cartPanel, {
    peek: 0.6,
    onClose: () => schliesseCart(),
  });

  function schliesseCart(mitVerlauf = true) {
    const warOffen = cartPanel.classList.contains("open");
    cartSheet.schliesse();
    cartPanel.classList.remove("open");
    cartPanel.setAttribute("aria-hidden", "true");
    backdrop.classList.remove("visible");
    if (warOffen && mitVerlauf) verlaufAbbauen();
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
      leer.textContent = "Noch keine Werke ausgewählt.";
      wrap.appendChild(leer);
      // Kein toter Endpunkt: direkt weiter in den Katalog
      const cta = document.createElement("button");
      cta.className = "btn-stripe";
      cta.textContent = "Alle Werke ansehen";
      cta.addEventListener("click", () => {
        $("catalog-open").click(); // erst öffnen, dann schließen (Verlauf ruhig)
        schliesseCart();
      });
      wrap.appendChild(cta);
    }
    sammlung.forEach((id) => {
      const werk = werkById(id);
      const el = document.createElement("div");
      el.className = "cart-item";
      const img = document.createElement("img");
      setzeWerkBild(img, werk);
      img.alt = werk.titel;
      img.addEventListener("click", () => {
        if (!steuerungRef().fokussiere(id)) oeffneWerk(id);
        schliesseCart();
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

  // ————— Katalog: alle Werke als 2D-Übersicht —————
  const catalogPanel = $("catalog-panel");
  const catalogSheet = machBottomSheet(catalogPanel, {
    peek: 0.88,
    onClose: () => schliesseKatalog(), // sonst bliebe aria-hidden falsch stehen
  });

  function renderKatalog() {
    const grid = $("catalog-grid");
    grid.innerHTML = "";
    raeume.forEach((raum) => {
      // Saal-Zwischenüberschrift wie im Museums-Katalog
      const kopf = document.createElement("p");
      kopf.className = "catalog-saal eyebrow";
      kopf.textContent = `${raum.saal} — ${raum.name}`;
      grid.appendChild(kopf);
      werkeImRaum(raum.id).forEach((werk) => {
        const el = document.createElement("button");
        el.className = "catalog-item";
        el.innerHTML = `
          <img alt="" />
          <div class="ci-text">
            <div class="ci-titel">${werk.titel}</div>
            <div class="ci-sub">${werk.kuenstler} · ${raum.name}</div>
            <div class="ci-preis ${werk.verkauft ? "verkauft" : ""}">${werk.verkauft ? "Verkauft" : formatPreis(werk.preis)}</div>
          </div>`;
        setzeWerkBild(el.querySelector("img"), werk);
        el.addEventListener("click", () => {
          // erst das Werk öffnen, dann den Katalog schließen — so bleibt
          // durchgehend ein Overlay offen und der Zurück-Verlauf ruhig
          if (!steuerungRef().fokussiere(werk.id)) oeffneWerk(werk.id);
          schliesseKatalog();
        });
        grid.appendChild(el);
      });
    });
  }

  function schliesseKatalog(mitVerlauf = true) {
    const warOffen = catalogPanel.classList.contains("open");
    catalogSheet.schliesse();
    catalogPanel.classList.remove("open");
    catalogPanel.setAttribute("aria-hidden", "true");
    stelleFokusWiederHer();
    if (warOffen && mitVerlauf) verlaufAbbauen();
  }

  $("catalog-open").addEventListener("click", () => {
    renderKatalog();
    if (!catalogSheet.oeffne("voll")) catalogPanel.classList.add("open");
    catalogPanel.setAttribute("aria-hidden", "false");
    verlaufAnlegen();
    // „ein Panel rechts": das Werk-Panel erst NACH dem Öffnen schließen,
    // damit durchgehend etwas offen ist und der Verlauf ruhig bleibt
    if (panel.classList.contains("open")) schliesseWerkPanel();
    merkeFokus();
    catalogPanel.querySelector(".panel-close").focus({ preventScroll: true });
  });

  // ————— Rechtliches —————
  const legal = $("legal");
  const LEGAL_TEXTE = {
    impressum: {
      titel: "Impressum",
      text: "Angaben gemäß § 5 DDG.\n\n[Name der Galerie]\n[Inhaber:in]\n[Straße Hausnummer]\n[PLZ Ort]\n\nTelefon: [Nummer]\nE-Mail: [Adresse]\nUSt-IdNr.: [Nummer]\n\nDiese Angaben werden vor dem Go-Live durch die Galerie ergänzt.",
    },
    datenschutz: {
      titel: "Datenschutz",
      text: "Beim Absenden einer Reservierung werden Ihre Angaben (Name, E-Mail, optional Telefon und Nachricht) zur Bearbeitung Ihrer Anfrage per Web3Forms (form-to-email-Dienst) an die Galerie übermittelt (Art. 6 Abs. 1 lit. b DSGVO). Es werden keine Tracking-Cookies gesetzt; Ihre Sammlung wird nur lokal in Ihrem Browser gespeichert.\n\n[Vollständige Datenschutzerklärung wird vor dem Go-Live durch die Galerie ergänzt.]",
    },
    kontakt: {
      titel: "Kontakt",
      text: "Wir freuen uns auf Ihre Nachricht.\n\n[E-Mail und Telefonnummer der Galerie — werden vor dem Go-Live ergänzt.]\n\nBesichtigungen einzelner Werke sind nach Vereinbarung jederzeit möglich.",
    },
  };
  document.querySelectorAll("[data-legal]").forEach((b) =>
    b.addEventListener("click", () => {
      const eintrag = LEGAL_TEXTE[b.dataset.legal];
      $("legal-eyebrow").textContent = "Rechtliches";
      $("legal-titel").textContent = eintrag.titel;
      $("legal-text").textContent = eintrag.text;
      legal.classList.remove("hidden");
      verlaufAnlegen();
      merkeFokus();
      legal.querySelector(".panel-close").focus({ preventScroll: true });
    })
  );
  legal.addEventListener("click", (e) => {
    if (e.target === legal) schliesseLegal();
  });

  // ————— Kasse —————
  const checkout = $("checkout");
  // Backdrop-Klick schließt das Modal
  checkout.addEventListener("click", (e) => {
    if (e.target === checkout) schliesseCheckout();
  });

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
    verlaufAnlegen();
    merkeFokus();
    checkout.querySelector('input[name="name"]').focus({ preventScroll: true });
  });

  function schliesseCheckout(mitVerlauf = true) {
    const warOffen = !checkout.classList.contains("hidden");
    checkout.classList.add("hidden");
    if (warOffen && mitVerlauf) verlaufAbbauen();
  }

  function schliesseLegal(mitVerlauf = true) {
    const warOffen = !legal.classList.contains("hidden");
    legal.classList.add("hidden");
    if (warOffen && mitVerlauf) verlaufAbbauen();
  }

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
    aktualisiereNavZaehler();
    form.reset();
    // Der Warenkorb dahinter ist jetzt leer — offen bliebe er mit seiner
    // Abdunklung über der Galerie liegen und blockierte die Navigation.
    schliesseCart();
    $("checkout-form-view").classList.add("hidden");
    $("checkout-success-view").classList.remove("hidden");
    melde("Reservierung eingegangen. Die Galerie meldet sich persönlich.");
  });

  // ————— Öffnen / Schließen —————
  $("cart-open").addEventListener("click", () => {
    renderSammlung();
    if (!cartSheet.oeffne("voll")) cartPanel.classList.add("open");
    else backdrop.classList.add("visible");
    cartPanel.setAttribute("aria-hidden", "false");
    verlaufAnlegen();
    if (panel.classList.contains("open")) schliesseWerkPanel(); // ein Panel rechts
    if (catalogPanel.classList.contains("open")) schliesseKatalog();
  });

  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => {
      const ziel = b.dataset.close;
      if (ziel === "artwork") schliesseWerkPanel();
      if (ziel === "cart") schliesseCart();
      if (ziel === "catalog") schliesseKatalog();
      if (ziel === "checkout") schliesseCheckout();
      if (ziel === "legal") schliesseLegal();
    })
  );

  // Klick/Tipp in die Szene schließt offene Übersichts-Panels
  document.getElementById("scene").addEventListener("pointerdown", () => {
    if (cartPanel.classList.contains("open")) schliesseCart();
    if (catalogPanel.classList.contains("open")) schliesseKatalog();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (!legal.classList.contains("hidden")) schliesseLegal();
    else if (!checkout.classList.contains("hidden")) schliesseCheckout();
    else if (catalogPanel.classList.contains("open")) schliesseKatalog();
    else if (cartPanel.classList.contains("open")) schliesseCart();
    else if (panel.classList.contains("open")) schliesseWerkPanel();
  });

  renderSammlung();

  // Ein Stripe-Kauf schließt in einem zweiten Tab ab (?erworben=…). Dieser Tab
  // erfährt davon nur über den localStorage — sonst bliebe das bezahlte Unikat
  // hier als kaufbar in der Sammlung liegen.
  window.addEventListener("storage", (e) => {
    if (e.key !== LS_VERKAUFT) return;
    let verkaufte = [];
    try {
      verkaufte = JSON.parse(e.newValue) || [];
    } catch {
      return;
    }
    let geaendert = false;
    verkaufte.forEach((id) => {
      const werk = werkById(id);
      if (werk && !werk.verkauft) {
        werk.verkauft = true;
        aktualisiereVerkauft(id);
        geaendert = true;
      }
      if (sammlung.includes(id)) {
        sammlung = sammlung.filter((x) => x !== id);
        geaendert = true;
      }
    });
    if (!geaendert) return;
    speichereSammlung();
    renderSammlung();
    aktualisiereKaufButton();
    aktualisiereNavZaehler();
    melde("Ein Werk wurde soeben verkauft und aus Ihrer Sammlung entfernt.");
  });

  return {
    oeffneWerk,
    schliesseWerkPanel,
    melde,
    zeigeHover,
    markiereRaum,
    blendeZuSaal,
    zeigeSaalTitel,
    introAusblenden,
    zeigeChrome,
  };
}
