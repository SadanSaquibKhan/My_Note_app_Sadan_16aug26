/* b182 — two things that only went wrong once you zoomed.

   The first was visible and alarming: handwriting and typing drifted apart, by
   about two hundred pixels at half zoom. The sheet is centred in the scroller
   with margin:0 auto, so shrinking it moves it inward — at 100% its left edge
   sat 13px in, at 50% it sat 212px in. Page coordinates were measured from the
   SCROLLER's left edge and simply scaled, so ink drawn beside a word ended up
   two hundred pixels away from it. Nothing was lost, but it looked as though
   the writing had moved.

   The second was quieter. A page swap that lost its race to a newer page
   returned early and left the hand-over lock on. Every attempt to turn a page
   was then refused until a guard timer fired two and a half seconds later.
   Cross joins quickly — which is exactly what zooming out makes you do, since
   each page is fewer pixels tall — and page turning feels as though it has
   stopped altogether, in the middle of a notebook. */

import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

console.log("the ink follows the page as it zooms:");
const fn = html.match(/function sheetDrift\(scroller\)\{[\s\S]*?\n  \}/);
eq("there is one compensation", !!fn);
const d = fn ? fn[0] : "";
eq("it is zero at 100% by construction", /here - atOne \* z/.test(d));
/* Measuring the rendered sheet looks equivalent and is not: past 100% the
   sheet is wider than the scroller and the rect is no guide to where an
   unzoomed one would have sat. */
eq("the sheet's own width comes from the stylesheet, not from a clipped rect",
   /getPropertyValue\("--page-w"\)/.test(d) && !/sr\.width \/ \(z/.test(d));
eq("a page with no sheet mounted is harmless", /if \(!sheet\) return 0;/.test(d));

eq("the canvas draws through it",
   /setTransform\(dpr \* z, 0, 0, dpr \* z,\s*\(sheetDrift\(S\.scroller\) - S\.scroller\.scrollLeft\)/.test(html));
/* Both directions or neither: if the nib landed by one rule and the ink were
   drawn by another, every stroke would appear offset from where it was made. */
eq("and the nib lands through the same one",
   /function\(e\)\{[\s\S]{0,400}e\.clientX - r\.left \+ S\.scroller\.scrollLeft - sheetDrift\(S\.scroller\)/.test(html));

/* Reference: what the compensation has to produce. Scroller 820 wide, sheet
   794 — so 13px each side at 100%. */
const drift = (z, actualLeft, wide = 820, pageW = 794) =>
  actualLeft - Math.max(0, (wide - Math.min(pageW, wide)) / 2) * z;
eq("no correction at all at 100%", drift(1, 13) === 0);
eq("half zoom pulls the ink across to meet the page", Math.round(drift(0.5, 212)) === 206);
eq("and past 100% it pushes the other way", drift(1.15, 0) < 0);
/* A scroller narrower than the sheet centres nothing, so there is nothing to
   correct however far you zoom. */
eq("a narrow screen needs no correction", drift(0.5, 0, 600, 794) === 0);

console.log("a lost page swap does not freeze the join:");
eq("there is one way to let a doomed swap go", /function abandonHandover\(\)\{/.test(html));
const ab = (html.match(/function abandonHandover\(\)\{[\s\S]*?\n  \}/) || [""])[0];
eq("it clears the lock", /handover\.busy = false;/.test(ab));
eq("it clears the pending swap", /handover\.pending = null;/.test(ab));
eq("it stops the guard firing again later", /clearTimeout\(handover\.guard\)/.test(ab));
eq("and it puts the frozen band back", /band\.style\.height = "";/.test(ab));

const fh = (html.match(/function finishHandover\(\)\{[\s\S]*?var here =/) || [""])[0];
eq("a swap overtaken by a newer page is let go at once, not left to time out",
   /pend\.id !== here && pend\.id !== state\.note\.id/.test(html) &&
   /abandonHandover\(\);\s*\n\s*return;/.test(html));
eq("a lock with nothing behind it is treated as stale",
   /if \(!pend\)\{[\s\S]{0,160}if \(handover\.busy\) abandonHandover\(\);/.test(fh));

process.exitCode = bad ? 1 : 0;
