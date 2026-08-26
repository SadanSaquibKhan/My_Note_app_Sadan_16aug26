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

console.log("what the number on the button means:");
/* A page is a fixed sheet in its own units, and those are not screen pixels on
   any device. Showing the raw scale told you the ratio between the page's
   internal width and a count of CSS pixels nobody can see — on this tablet
   "100%" was a page that did not fill the writing area, and no setting meant
   "the page, across the screen, as paper". */
eq("100% is measured against the page fitting the width",
   /function baseScale\(\)\{[\s\S]{0,200}fitWidthZoom\(\)/.test(html) &&
   /function zoomPct\(z\)\{[\s\S]{0,160}\/ b\) \* 100/.test(html));
eq("the label shows that ratio, not the raw scale",
   /zoomLabel"\)\.textContent = zoomPct\(z\)/.test(html));
eq("the floor and the ceiling are fractions of the fit too",
   /var user = baseScale\(\) \* Math\.max\(0\.1/.test(html) &&
   /baseScale\(\) \* \(\(Number\(cfg\.zoomMax\)/.test(html));
eq("tapping the number returns to the page across the screen",
   /applyZoom\(baseScale\(\)\);/.test(html));

/* Reference: the same sheet, three screens. The number must read 100 on all of
   them, because on all of them the page is exactly across the writing area. */
const pct = (scale, fit) => Math.round((scale / fit) * 100);
eq("100% on a narrow screen", pct(0.62, 0.62) === 100);
eq("100% on a wide one",      pct(1.51, 1.51) === 100);
eq("and half of it is half",  pct(0.31, 0.62) === 50);

console.log("zoom stops undoing itself at every join:");
/* Falling back to 100% meant scrolling from a page you had zoomed out on into
   its neighbour snapped straight back in, at every join, unasked. */
/* b185 made a remembered zoom a ratio of the fit rather than a raw scale, so
   these two now read `z * b`. Same behaviour, one multiplication later: a raw
   scale means something different on every screen, so a page zoomed on the
   tablet came back a different size on the laptop. */
eq("a page you have never zoomed inherits the zoom you are using",
   /applyZoom\(\(state && state\.zoom\) \|\| \(cfg\.defaultZoom \|\| 1\) \* b\)/.test(html));
eq("a page you did zoom deliberately still keeps its own",
   /if \(z != null\) return applyZoom\(z \* b\);/.test(html));
eq("and what is remembered is a ratio, so it means the same on any screen",
   /setMeta\("zoom:" \+ state\.noteId, state\.zoom \/ \(baseScale\(\) \|\| 1\)\)/.test(html));

console.log("every control agrees what 100% is:");
/* The ladder, the presets, Ctrl+0 and the boot default all still worked in the
   old raw scale, so several of them reset to something that was no longer
   100% — which is what "sometimes it zooms back on its own" was. */
eq("the ladder is rungs of the fit", /var ZOOMS = \[0\.5, 0\.75, 1, 1\.25/.test(html));
eq("stepping works in ratios and converts once at the end",
   /var cur = \(state\.zoom \|\| b\) \/ b, next = null;/.test(html) &&
   /applyZoom\(next \* b\);/.test(html));
eq("the 100% preset goes to the fit", /applyZoom\(baseScale\(\)\); C\.setMeta\("zoom", 1\)/.test(html));
eq("Ctrl+0 goes to the fit", /k === "0"\)\{ e\.preventDefault\(\); applyZoom\(baseScale\(\)\)/.test(html));
eq("and boot treats its stored preference as a ratio",
   /applyZoom\(\(prefs\[0\] \|\| 1\) \* \(baseScale\(\) \|\| 1\)\)/.test(html));

console.log("the page's margins are the page's, not the screen's:");
/* 4vw is a slice of the window. With the side panels open the page is far
   narrower than the window, so the margins stayed at their maximum and ate
   88px of a 640px page — a seventh of it, gone to white space. */
eq("side padding is a share of the page", /clamp\(14px,4\.5%,44px\)/.test(html));
eq("and the old screen-derived one is gone", !/clamp\(16px,4vw,44px\)/.test(html));

process.exitCode = bad ? 1 : 0;
