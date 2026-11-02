// Offline app shell. Model weights are cached by WebLLM itself (Cache API), not here.
const CACHE = "anonimizador-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("anonimizador-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin GET only. Pages: network first (new deploys), cache when offline.
// Hashed assets: cache first. shortcut: old builds' assets stay cached, bump CACHE to purge.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const put = (res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then((r) => r ?? caches.match(self.registration.scope))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then(put)));
});
