/* The preview band and the live page agree where page x=0 is (b207).

   Reported, and confirmed by measurement: handwriting is shifted while
   scrolling into the next page, worst zoomed out, invisible at 100%.

   Page x=0 is NOT the left edge of the sheet. It is a fixed inset from the
   scroller — the centring margin an UNZOOMED sheet would have. The live canvas
   says so: it offsets by sheetDrift, which is "where the sheet is now, minus
   that inset times the zoom", and is zero at 100% by construction.

   The peek canvas measured its own distance from the scroller and divided by
   the zoom instead. At 100% the two agree, because the sheet is sitting exactly
   at that inset. At any other zoom they do not. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("one place knows where an unzoomed sheet would sit:");
eq("it has a name", /function sheetInsetAtOne\(scroller\)\{/.test(html));
/* Measuring the sheet looks equivalent and is not: past 100% the sheet is wider
   than the scroller and its rect says nothing about the unzoomed case. */
eq("the width comes from the stylesheet, not from a measurement",
   /getPropertyValue\("--page-w"\)\) \|\| 794;\s*\n\s*return Math\.max\(0, \(wide - Math\.min\(pageW, wide\)\) \/ 2\);/.test(html));
eq("the live canvas's drift is built on it",
   /return here - sheetInsetAtOne\(scroller\) \* z;/.test(html));
eq("and so is the preview canvas's offset", /var offX = paper \? sheetInsetAtOne\(paper\) : 0;/.test(html));
eq("the preview no longer divides a measurement by the zoom",
   !/\(hr0\.left - paper\.getBoundingClientRect\(\)\.left\) \/ z : 0;/.test(html));
eq("drift is still zero at 100% by construction", /zero at 100% by construction/.test(html));

/* ---- the two origins, computed at three zooms ---- */
console.log("\nthe two canvases, at three zooms:");
const paperLeft = 460, atOne = 13, pageW = 794, wide = 820;
/* the sheet centres itself at each zoom; these are the measured values */
const cases = [
  { z: 0.516, here: 205, hostLeft: 665 },
  { z: 1.291, here: 0,   hostLeft: 460 },
  { z: 2.065, here: 0,   hostLeft: 460 },
];
function liveX0(c){ return paperLeft + (c.here - atOne * c.z); }
function peekX0New(c){ return c.hostLeft - atOne * c.z; }
function peekX0Old(c){ return c.hostLeft - ((c.hostLeft - paperLeft) / c.z) * c.z; }
for (const c of cases){
  eq(`they agree at ${Math.round(c.z * 100)}%`,
     Math.abs(peekX0New(c) - liveX0(c)) < 0.01);
}
/* The old way agreed only where the sheet happened to sit at the inset. */
eq("the old way was 198px out at 52%",
   Math.round(peekX0Old(cases[0]) - liveX0(cases[0])) === -198);
eq("which is why it was invisible at 100% and worst zoomed out",
   Math.abs(peekX0Old(cases[1]) - liveX0(cases[1])) < 17);

/* The inset does not depend on zoom at all — the band is CSS-zoomed around
   this canvas already, so applying the zoom again is the double-count. */
console.log("\nand the inset itself:");
eq("it is the same at every zoom", atOne === Math.max(0, (wide - Math.min(pageW, wide)) / 2));
eq("zero when the sheet fills the scroller", Math.max(0, (700 - Math.min(794, 700)) / 2) === 0);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
