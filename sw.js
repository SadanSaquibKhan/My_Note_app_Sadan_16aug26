/* Margin service worker.
   NETWORK-FIRST for the shell (the page + its code): a new build reaches the
   tablet as soon as it is online, and the cache is the offline fallback. It was
   cache-first before, which pinned an installed PWA to whatever build it first
   cached — the build number never moved on the tablet even though sync worked.
   Static assets (icons, the on-demand PDF reader) stay cache-first below.
   bump.py bumps CACHE to match index.html's BUILD on every build. */
const CACHE = "margin-2026-08-16-v163";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
               "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];
/* The PDF reader is 1.4MB and only matters the first time you import a PDF,
   so it is fetched on demand rather than held up as part of the shell — but
   it IS cached once fetched, so importing works with no network afterwards.
   Kept out of SHELL deliberately: a failed fetch of these would otherwise
   fail addAll() and leave the whole app uninstalled. */
const EXTRA = ["./pdf.min.js", "./pdf.worker.min.js", "./sync-client.js"];

self.addEventListener("install", e => {
  /* Fetch the shell BYPASSING the browser HTTP cache. cache.addAll()/add() obey
     the HTTP cache, and GitHub Pages holds HTML for ~10 min, so a worker that
     installs soon after a deploy could otherwise bake the OLD index.html into the
     NEW cache — the cache name would bump but the bytes would be stale (which is
     part of why the tablet got stuck). { cache: "reload" } forces the network. */
  const fresh = u => new Request(u, { cache: "reload" });
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(fresh(u)))).then(() => {
        /* best effort, never fatal */
        return Promise.all(EXTRA.map(u => c.add(fresh(u)).catch(() => {})));
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
  const url = new URL(e.request.url);
  /* Sync talks to another host. Caching those replies (or falling back to
     index.html when they fail) would poison a pull with the app's own HTML. */
  if (url.origin !== self.location.origin) return;
  /* The app SHELL — the page itself and its code — is NETWORK-FIRST, so a new
     build reaches the tablet the moment it is online, then falls back to the
     cache offline. It used to be cache-first for everything, which pinned an
     installed PWA to whatever build it first cached: the service worker kept
     serving the old index.html forever, so the build number never moved on the
     tablet even though sync (a different host) worked fine. GitHub Pages answers
     an unchanged file with a tiny 304, so this stays cheap. Big rarely-changing
     assets (icons, the on-demand 1.4MB PDF reader) stay cache-first below so
     they are never re-downloaded. */
  const p = url.pathname;
  const shell = e.request.mode === "navigate" ||
                p === "/" || p.endsWith("/") ||
                p.endsWith("/index.html") ||
                p.endsWith("/sync-client.js") ||
                p.endsWith("/manifest.webmanifest");
  if (shell){
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request, { ignoreSearch: true })
                          .then(hit => hit || caches.match("./index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
