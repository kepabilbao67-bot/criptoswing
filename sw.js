/* Service Worker · CryptoSwing
   Cachea la app (cascarón) para que funcione como PWA instalable.
   Los datos de mercado SIEMPRE van a la red (no se cachean). */
const CACHE = "cryptoswing-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Nunca cachear llamadas a APIs de mercado (Binance): siempre datos frescos
  if (url.hostname.includes("binance")) return;
  // Estrategia cache-first para el cascarón de la app
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
