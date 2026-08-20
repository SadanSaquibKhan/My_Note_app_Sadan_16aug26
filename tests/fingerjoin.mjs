/* The finger crossing a page join. Three separate things could throw the page
   at the moment it turned, and all three only show up on a device, so the
   arithmetic is transcribed here and run both ways. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

/* ---- the pan, transcribed from fingerPanDown / fingerPanMove ---- */
function makePan(rebaseOnSwap){
  let scrollTop = 0;
  const pan = { on: false, y: 0, top: 0, py: 0 };
  return {
    scroll: () => scrollTop,
    down(clientY, at){ pan.on = true; pan.y = clientY; pan.py = clientY; pan.top = at; scrollTop = at; },
    move(clientY){ pan.py = clientY; scrollTop = pan.top - (clientY - pan.y); },
    /* the swap rewrites the scroll under a finger that never lifted */
    swap(to){
      scrollTop = to;
      if (rebaseOnSwap){ pan.top = scrollTop; pan.y = pan.py; }
    }
  };
}

console.log("a finger that never lifted keeps scrolling smoothly across a swap:");
for (const rebase of [false, true]){
  const p = makePan(rebase);
  p.down(900, 2400);          /* finger lands, page is 2400 down */
  p.move(880);                /* drags up 20px -> 2420 */
  const before = p.scroll();
  p.swap(1500);               /* the page turns; the swap re-anchors to 1500 */
  p.move(860);                /* the SAME finger moves another 20px */
  const after = p.scroll();
  const jump = Math.abs(after - (1500 + 20));
  if (rebase) eq("rebased: the next move carries on from 1500 (+20)", jump < 1);
  else eq("stale: the next move throws the page " + jump + "px (the bug)", jump > 500);
  void before;
}

console.log("");
console.log("momentum crosses the join, damped, from the re-anchored place:");
{
  /* leftover throw used to be spent at the new page's heading. Now the
     velocity is kept, the page is re-anchored, then the coast continues
     at 0.7 so one flick does not fly through three pages. */
  const old = 0.42;                 /* leftover px/ms */
  const after = old * 0.7;
  eq("the carry is slower than the leftover throw", after < old && after > 0.2);
  eq("it is not zero (that was the 'momentum stops at the join')", after !== 0);
}

console.log("");
console.log("the backward target is decided once, not chased:");
{
  /* pageBottom moves for several frames after a swap as bands hydrate */
  const bottoms = [3000, 3120, 3180, 3200, 3200];
  const clientH = 1000;
  const once = Math.max(0, bottoms[0] - clientH * 0.55);
  const chased = bottoms.map(b => Math.max(0, b - clientH * 0.55));
  const spread = Math.max(...chased) - Math.min(...chased);
  console.log("   asked-for position over five frames, chased: " + chased.join(" "));
  eq("chasing it moves the target " + spread + "px while settling (the shiver)", spread > 100);
  eq("deciding once keeps it still", once === chased[0]);
}

console.log("");
console.log("wired that way in the file:");
eq("the backward target is computed before the settle loop",
   has(/var backWant = null;/) &&
   has(/var want = \(backWant != null\) \? backWant : Math\.max\(0, pad - pend\.keepAt\);/));
eq("pageBottom is no longer re-read every settle frame",
   !/\(function settle\(\)\{[\s\S]{0,400}?pageBottom\(p\)/.test(html));
eq("a finger still down is told where the page went",
   has(/function rebasePan\(\)\{/) && has(/pan\.top = p\.scrollTop;/) &&
   has(/if \(pan\.py != null\) pan\.y = pan\.py;/));
eq("it is rebased on both settle paths",
   (html.match(/rebasePan\(\);/g) || []).length >= 2);
eq("rebase no longer zeros the finger's speed or sets noGlide",
   !/pan\.noGlide = true;/.test(html) &&
   !/pan\.vx = 0; pan\.vy = 0;/.test(html.match(/function rebasePan\(\)\{[\s\S]*?\n      \}/)[0]));
eq("a running fling is carried across the join after the re-anchor",
   has(/handover\.glideCarry/) && has(/startGlide\(c\.S, c\.vx \* 0\.7, c\.vy \* 0\.7\)/));
eq("the placeholder is hidden while a page is flashing past",
   has(/body\.swapping #body:empty::before/) && has(/content:none !important/));

console.log("");
console.log("opening a page puts you at its top:");
/* Nothing in the opening path ever wrote the scroll, so a page opened from the
   list inherited whatever offset the page before it had. Measured on the build
   before this: opening page 1 from deep inside page 2 landed at 3502px instead
   of the top, and from a short page that offset is inside the NEXT page's band,
   past the hand-over line — so the app turned the page for you. */
eq("a page opened from the list is scrolled to its top, not merely recorded there",
   has(/restoreScroll\(0, 0\);/) &&
   has(/C\.setMeta\("nplace:" \+ openingId, \{ top: 0, left: 0, at: Date\.now\(\) \}\);/));
eq("the record is written directly, since restoreScroll stands savePlace down",
   has(/noteId: openingId, top: 0, left: 0, zoom: state\.zoom, at: Date\.now\(\)/));

console.log("");
console.log("the chip counts the section the page is actually in:");
eq("the list follows the open page, not the panel",
   has(/var sid = \(state\.note && state\.note\.sectionId\) \|\|/));
eq("an empty filter falls back rather than leaving the page out of its own list",
   has(/return out\.length \? out : all;/));
eq("not-in-this-list is -1, which is not the same as being at the top",
   has(/return -1;/) && has(/var dest = \(here >= 0 && here < 0\.08\) \? 1 : 0;/));

console.log("");
console.log("the band-resize skip cannot outlive its page change:");
eq("it is stamped when raised", has(/padWatch\.skip = true; padWatch\.skipAt = Date\.now\(\);/));
eq("and ignored once it is stale", has(/if \(Date\.now\(\) - \(padWatch\.skipAt \|\| 0\) < 1200\) return;/));

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall finger-join checks passed");
