/* The service worker used to serve the whole shell CACHE-FIRST, so once an
   installed PWA had cached index.html it served that build forever and the
   build number never moved on the tablet — even though sync (a different host)
   worked. The shell (the page + its code) must be NETWORK-FIRST (fresh build
   when online, cache only as the offline fallback), and the app must force a
   service-worker update check (an installed PWA checks rarely on its own).
   Run: node tests/swshell.mjs index.html */
import fs from "fs";
const sw = fs.readFileSync("sw.js", "utf8");
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

console.log("sw.js — the shell is network-first:");
eq("the shell request is fetched from the network first",
   /const shell = e\.request\.mode === "navigate"/.test(sw) &&
   /if \(shell\)\{[\s\S]{0,140}fetch\(e\.request\)\.then/.test(sw));
eq("index.html and sync-client.js count as shell",
   /p\.endsWith\("\/index\.html"\)/.test(sw) && /p\.endsWith\("\/sync-client\.js"\)/.test(sw));
eq("offline still falls back to the cached shell",
   /if \(shell\)\{[\s\S]{0,420}caches\.match\("\.\/index\.html"\)/.test(sw));
eq("big assets (icons, PDF reader) stay cache-first, not re-downloaded",
   /caches\.match\(e\.request, \{ ignoreSearch: true \}\)\.then\(hit => hit \|\| fetch/.test(sw));
eq("a new worker still skips waiting, claims, and deletes old caches",
   /self\.skipWaiting\(\)/.test(sw) && /self\.clients\.claim\(\)/.test(sw) && /caches\.delete\(k\)/.test(sw));

console.log("\nindex.html — the app forces update checks:");
eq("it calls reg.update() on load",
   /try \{ reg\.update\(\); \} catch/.test(html));
eq("it re-checks whenever the app returns to the front",
   /visibilitychange[\s\S]{0,140}reg\.update\(\)/.test(html));
eq("it still shows the 'newer version ready' notice",
   /A newer version of Margin is ready/.test(html));

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall service-worker shell checks passed");
