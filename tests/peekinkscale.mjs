/* The preview band's ink stops inferring the zoom from a browser quirk (b203).

   Reported: scrolling toward the next page, the handwriting on it is shifted,
   and snaps into place once that page is fully visible. Words were measured and
   found to line up exactly; so the mismatch is between the preview's ink canvas
   and everything around it. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("nothing about the zoom is inferred any more:");
/* The band is CSS-zoomed by --z, so its canvas must be sized in the band's own
   unzoomed units. Those used to come from clientWidth, and the sideways
   correction divided by clientWidth/rect.width to convert on-screen pixels into
   them — which works only while the browser reports clientWidth unzoomed and
   getBoundingClientRect zoomed. That is the browser's business, not ours, and
   Chrome has changed exactly this about CSS zoom before. */
eq("the zoom is the one we set ourselves",
   /var z = \(typeof state === "object" && state && state\.zoom\) \|\| 1;/.test(html));
eq("guarded, so a nonsense zoom cannot divide by zero", /if \(!\(z > 0\)\) z = 1;/.test(html));
eq("the size comes from the rendered rectangle, divided by that zoom",
   /var w = hr0\.width \/ z, h = hr0\.height \/ z;/.test(html));
/* b207 went further and took the sideways correction off measurement
   altogether: page x=0 is a fixed inset from the scroller, not this canvas's
   own distance from it divided by the zoom. Dividing a measurement by z was
   right only where the sheet happened to be sitting at that inset — which is
   exactly 100%, and nowhere else. See joinorigin.mjs. */
eq("and the sideways correction no longer measures anything at all",
   /var offX = paper \? sheetInsetAtOne\(paper\) : 0;/.test(html));
eq("clientWidth is no longer part of the peek canvas's arithmetic",
   !/var w = host\.clientWidth, h = host\.clientHeight;/.test(html));
eq("and neither is the ratio it was used for",
   !/\* \(w \/ hr\.width\) : 0;/.test(html));

console.log("\nwhat it must still do:");
eq("the backing store is still in device pixels",
   /cv\.width = Math\.round\(w \* dpr\); cv\.height = Math\.round\(h \* dpr\);/.test(html));
eq("the canvas is still cleared before it is redrawn", /ctx\.clearRect\(0, 0, cv\.width, cv\.height\);/.test(html));
eq("and the transform is still dpr, because the band is zoomed by CSS around it",
   /ctx\.setTransform\(dpr, 0, 0, dpr, -offX \* dpr, 0\);/.test(html));

/* ---- the arithmetic, both ways, on the numbers actually measured ---- */
console.log("\nthe two derivations, on real measurements:");
const z = 0.75, dpr = 1;
const rect = { width: 21, height: 1143 };
const clientUnzoomed = { w: 28, h: 1524 };      /* what this browser reports */
const fromRect = { w: rect.width / z, h: rect.height / z };
eq("where clientWidth is unzoomed, the two agree exactly",
   Math.round(fromRect.w) === clientUnzoomed.w && Math.round(fromRect.h) === clientUnzoomed.h);
/* A browser that zooms clientWidth too would have sized the canvas at the
   zoomed figure and then had it zoomed again — every stroke at the wrong scale,
   shifted against the words, and correct the moment the page went live. */
const clientZoomed = { w: rect.width, h: rect.height };
eq("where it is zoomed, the old way sized the canvas wrongly",
   clientZoomed.w !== Math.round(fromRect.w));
eq("and the new way is right either way", Math.round(fromRect.w) === 28);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
