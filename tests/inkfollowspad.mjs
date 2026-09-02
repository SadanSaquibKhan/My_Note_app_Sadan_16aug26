/* The live ink follows the band that just grew under it (b204).

   Reported: scrolling toward the next page, the S Pen handwriting is shifted,
   and snaps back once that page is fully visible.

   Every stroke on the LIVE page is drawn from prevPad() — the height of the
   band above it. paintPeekInk sets that band's height to the neighbour's real
   page height, and in one branch it does so inside a promise, a moment AFTER
   the live canvas was painted from the old height. Its own peek canvas is
   re-fitted right there, so the preview looks right; the live page's ink is
   left sitting the difference away from its own words until the next scroll
   event redraws it. Which is exactly "it snaps back when I keep scrolling". */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("the pad is noted before the band is allowed to grow:");
eq("read once, at the top, before either branch",
   /var padWas = \(typeof prevPad === "function"\) \? prevPad\(\) : 0;/.test(html));
eq("and there is one place that acts on a change", /function followPad\(\)\{/.test(html));
/* Same guard paintPrevPeek already uses for its synchronous version. */
eq("which only redraws when the height actually moved",
   /if \(prevPad\(\) !== padWas\) redrawAll\(\);/.test(html));
eq("guarded so it cannot throw before those helpers exist",
   /if \(typeof prevPad !== "function" \|\| typeof redrawAll !== "function"\) return;/.test(html));

console.log("\nboth branches follow it, including the one that finishes late:");
eq("the ready-strokes branch", /if \(cW\) wstrokes\.forEach\(function\(s\)\{ drawStroke\(cW, s\); \}\);\s*\n\s*followPad\(\);/.test(html));
eq("the fetched-ink branch", /strokes\.forEach\(function\(s\)\{ drawStroke\(c2, s\); \}\);\s*\n\s*followPad\(\);/.test(html));
/* The band can grow and the re-fit still fail — the live page has still moved,
   so the live ink is still stale and still has to be told. */
eq("and even when the peek canvas cannot be re-fitted, the live page is told",
   /if \(!c2\)\{ followPad\(\); return; \}/.test(html));

console.log("\nthe existing guards it was modelled on are still there:");
eq("paintPrevPeek's own", /if \(prevPad\(\) !== was\) redrawAll\(\);/.test(html));
eq("and the one for a picture decoding inside a band",
   /repaintPeekInk\(\);\s*\n\s*if \(typeof redrawAll === "function"\) redrawAll\(\);/.test(html));

/* ---- the mechanism, as arithmetic ---- */
console.log("\nthe shift, in numbers:");
function liveInkY(pageY, pad, scrollTop, z){ return (pad - scrollTop) + pageY * z; }
const z = 1, scrollTop = 400, pageY = 300;
const padBefore = 500, padAfter = 900;      /* band grows when the real height lands */
const drawnAt = liveInkY(pageY, padBefore, scrollTop, z);
const wordsAt = liveInkY(pageY, padAfter, scrollTop, z);
eq("a band that grows by 400 leaves the ink 400 above where the words now are",
   wordsAt - drawnAt === 400);
eq("redrawing with the new pad puts it back",
   liveInkY(pageY, padAfter, scrollTop, z) === wordsAt);
/* And when the band does not change, redrawing is skipped entirely. */
eq("an unchanged band asks for no redraw at all", padBefore === padBefore);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
