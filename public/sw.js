// Service Worker der Galerie — macht die installierte App offline begehbar.
// Strategien, bewusst deploy-sicher gewählt:
//   · HTML (Navigation):  Netz zuerst, Cache als Rückfall  -> Deploys kleben nie
//   · assets/* (gehasht): Cache zuerst                     -> unveränderlich, spart Netz
//   · Werkfotos & Icons:  Netz zuerst, Cache als Rückfall  -> ersetzte Fotos (gleicher
//                          Dateiname) erscheinen sofort, offline bleibt das letzte Bild
//   · Fremd-Hosts (Fonts, RAW-Katalog, Web3Forms): unangetastet durchreichen
const CACHE = "galerie-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

// Erstbesuch: die Seite meldet ihre bereits geladenen Ressourcen nach —
// sie liefen VOR der Aktivierung am Worker vorbei und wären sonst nie im Cache
self.addEventListener("message", (e) => {
  const urls = e.data?.vorwaermen;
  if (!Array.isArray(urls)) return;
  caches.open(CACHE).then(async (cache) => {
    for (const url of urls) {
      try {
        const antwort = await fetch(url);
        if (antwort.ok) await cache.put(url, antwort);
      } catch {
        /* einzelne Ausfälle sind egal */
      }
    }
  });
});

self.addEventListener("fetch", (e) => {
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;
  const url = new URL(anfrage.url);
  if (url.origin !== location.origin) return; // fremde Hosts nie anfassen
  if (url.pathname.endsWith("/sw.js")) return;

  const istAsset = url.pathname.includes("/assets/");
  const istNavigation = anfrage.mode === "navigate";

  if (istAsset) {
    // gehashte Dateien: Cache zuerst (Vary-tolerant — Modul-Requests tragen
    // CORS-Header, die beim Vorwärmen fehlten, und würden sonst nie treffen)
    e.respondWith(
      (async () => {
        const getroffen = await caches.match(anfrage, { ignoreVary: true });
        if (getroffen) return getroffen;
        const antwort = await fetch(anfrage);
        if (antwort.ok) (await caches.open(CACHE)).put(anfrage, antwort.clone());
        return antwort;
      })()
    );
    return;
  }

  // alles andere Eigene (HTML, Fotos, Icons, Manifest): Netz zuerst
  e.respondWith(
    (async () => {
      try {
        const antwort = await fetch(anfrage);
        if (antwort.ok) (await caches.open(CACHE)).put(anfrage, antwort.clone());
        return antwort;
      } catch {
        const getroffen = await caches.match(anfrage, {
          ignoreSearch: istNavigation,
          ignoreVary: true,
        });
        if (getroffen) return getroffen;
        if (istNavigation) {
          const start = await caches.match("./", { ignoreSearch: true, ignoreVary: true });
          if (start) return start;
        }
        throw new Error("offline und nicht im Cache");
      }
    })()
  );
});
