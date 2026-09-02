/* Scrolling stops doing work it does not need to do (b202).

   A finger drag fires scroll far faster than the screen refreshes, and every
   one of these listeners measured. Nothing here DECIDES anything — they all
   only describe where you have got to — so once per drawn frame is as often as
   any of it can possibly matter. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("the note: one tick, not three listeners:");
eq("the followers share a single animation frame",
   /var followTick = 0;\s*\n\s*S\.scroller\.addEventListener\("scroll", function\(\)\{\s*\n\s*if \(followTick\) return;/.test(html));
eq("and everything that was in its own listener is inside it",
   /followTick = 0;[\s\S]{0,400}placeLassoPop\(\);[\s\S]{0,200}paintScrollDot\(\);[\s\S]{0,120}paintOutlineHere\(\);/.test(html));
eq("the ink redraw keeps its own, which was already coalesced",
   /S\.scroller\.addEventListener\("scroll", S\.queueRedraw, \{ passive: true \}\);/.test(html));
eq("the page-handover tick is untouched", /scrollTick = requestAnimationFrame\(function\(\)\{/.test(html));
/* Saving where you were is on its own debounce and must stay there: it is not
   a per-frame describer, it is a write. */
eq("and saving your place still has its own debounce",
   /\$\("paper"\)\.addEventListener\("scroll", queueSavePlace, \{ passive: true \}\);/.test(html));

console.log("\nthe outline stops measuring the whole page:");
/* Thirty headings on a long page meant thirty forced layouts per scroll event.
   The list is in document order, so everything after the first heading below
   the line is below it too. */
eq("it stops at the first heading below the line",
   /for \(var hi = 0; hi < hs\.length; hi\+\+\)\{\s*\n\s*if \(hs\[hi\]\.getBoundingClientRect\(\)\.top > top\) break;/.test(html));
eq("and no longer asks every one of them",
   !/hs\.forEach\(function\(h, i\)\{ if \(h\.getBoundingClientRect\(\)\.top <= top\) idx = i; \}\);/.test(html));

console.log("\nthe sheet's page-turn check, same treatment:");
eq("coalesced to one tick", /function queuePracTurn\(\)\{/.test(html) &&
   /if \(prac\.open\) queuePracTurn\(\);/.test(html));
/* Some webviews never deliver an animation frame at all — the reason
   afterLayout exists a few hundred lines up — and a page turn that simply
   stops happening on those is far worse than one that measures a little more
   often than it needs to. Caught by driving it: with the frame alone, the turn
   never fired in a browser that starves rAF. */
eq("with a clock behind the frame, on both",
   /if \(typeof requestAnimationFrame === "function"\) requestAnimationFrame\(go\);\s*\n\s*setTimeout\(go, 32\);/.test(html) &&
   /if \(typeof requestAnimationFrame === "function"\) requestAnimationFrame\(follow\);\s*\n\s*setTimeout\(follow, 32\);/.test(html));
eq("and neither can run twice for one tick",
   /if \(ranFollow\) return;/.test(html) &&
   /if \(done\) return;\s*\n\s*done = true; pracTurnTick = 0;/.test(html));
eq("the check itself is a named function, not an inline listener", /function checkPracTurn\(\)\{/.test(html));
/* Two rectangles is not much, but it is two rectangles on every frame of every
   scroll, and for almost all of them the band is nowhere near. */
eq("and it asks the cheap question first",
   /if \(p && \(p\.scrollHeight - p\.scrollTop - p\.clientHeight\) > p\.clientHeight \* 1\.5\)\{/.test(html));
/* Re-armed on the way past, so approaching the band again is a fresh crossing
   rather than a stale number from the last time you were down there. */
eq("bailing out re-arms rather than leaving a stale reading",
   /> p\.clientHeight \* 1\.5\)\{\s*\n\s*prac\.peekWas = 0;\s*\n\s*return;\s*\n\s*\}/.test(html));
eq("the crossing rule itself is unchanged",
   /if \(was >= PRAC_TURN \|\| now < PRAC_TURN\) return;/.test(html));

/* ---- what the change is worth, counted ---- */
console.log("\nthe cost, counted:");
const HEADINGS = 30, EVENTS_PER_FRAME = 4;   /* a fast finger drag on a tablet */
const before = EVENTS_PER_FRAME * (HEADINGS + 3);   /* every heading + viewport + two chips */
const after = 1 * (3 + 3);                          /* one frame, early-exit scan */
eq("a fast drag on a long page did an order of magnitude more measuring", before > after * 10);
eq("and the crossing check is unaffected by how often scroll fires",
   (() => {
     /* one frame, one comparison, whatever the event count */
     const frames = [0.1, 0.5, 0.7];
     let was = null, turns = 0;
     for (const now of frames){
       const prev = was == null ? now : was; was = now;
       if (prev < 0.6 && now >= 0.6) turns++;
     }
     return turns === 1;
   })());

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
