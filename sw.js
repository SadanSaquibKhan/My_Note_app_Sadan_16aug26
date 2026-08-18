/* Margin service worker.
   Cache-first for the shell: once installed the app never needs the network.
   Bump CACHE when you upload a new index.html or the old one will be served. */
const CACHE = "margin-2026-08-16-v46";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
               "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
/* The PDF reader is 1.4MB and only matters the first time you import a PDF,
   so it is fetched on demand rather than held up as part of the shell — but
   it IS cached once fetched, so importing works with no network afterwards.
   Kept out of SHELL deliberately: a failed fetch of these would otherwise
   fail addAll() and leave the whole app uninstalled. */
const EXTRA = ["./pdf.min.js", "./pdf.worker.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).then(() => {
        /* best effort, never fatal */
        return Promise.all(EXTRA.map(u => c.add(u).catch(() => {})));
      }))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
