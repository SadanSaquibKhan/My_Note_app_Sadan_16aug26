import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("two chips, no in-page percent bar:");
eq("the in-page percent dot is gone", has(/\.scrolldot\{display:none !important\}/));
eq("a blue chip is this section", has(/id="secChip"/) && has(/\.secchip/));
eq("a grey chip is the whole notebook", has(/id="bookChip"/) && has(/\.bookchip/));
eq("they overlap about half when they share a row, so they can sit on the edge",
   has(/right:40px/) && has(/right:8px/) && !/right:96px/.test(html));
eq("the old fading page tag is hidden", has(/\.pagetag\{display:none !important\}/));
eq("progress is mapped through page heights, not a sudden page index",
   has(/function listProgress\(list\)/) && has(/function progressToPlace\(list, prog\)/));
eq("a tap on a chip jumps to the start or the end",
   has(/var dest = \(here >= 0 && here < 0\.08\) \? 1 : 0;/));
eq("the in-page paper scrollbar is hidden",
   has(/\.paper::-webkit-scrollbar\{display:none\}/));

/* b123 — the drag itself. It used to remember a far page and open it only on
   lift, so the screen and the chip's own numbers both sat still while the
   chip travelled, then lurched at the end. */
console.log("");
console.log("the page follows the chip while you drag it:");
eq("there is a seek that runs during the drag", has(/function chipSeek\(force\)\{/));
eq("the drag calls it on every move", has(/placeChip\(el, prog\);\s*\n      chipSeek\(false\);/));
eq("inside the page you are on it is a plain scroll, every move",
   has(/if \(vis && place\.note\.id === vis\)\{ landOnPage\(place\.frac, vis\); return; \}/));
/* b140: the per-page peek-stepping (driveChipPeek + armChipHandover, gated by
   chipPeekReady and a 130ms throttle) needed one full page mount per page
   crossed, and a mount is slower than a drag — so while a mount was in flight
   chipSeek returned early, the view FROZE on a stale page, the label ran ahead,
   and it lurched a page or two to catch up when the mount landed. Reproduced in
   a browser: dragging S2P4 up to S2P2 froze for 7 frames at one scroll position
   while the label counted to 3/4, then skipped S2P3 entirely and jumped to
   S2P2. The chip now seeks straight to the target, one load at a time, and a
   frame loop re-aims at the LATEST target so it never waits on a page it has
   already dragged past. After the fix the same drag froze 0 frames and visited
   every page S2P4>S2P3>S2P2. */
eq("the freezing peek-step design is gone from the drag path",
   !/revealChipJoin\(list, chipDrag\.prog/.test(html) &&
   !/if \(!chipPeekReady\(dir\)\) return;/.test(html) &&
   !/armChipHandover\(place\.note\.id\)/.test(html));
eq("a frame loop keeps re-aiming at the newest target",
   has(/function chipChase\(\)\{/) && has(/chipDrag\.raf = requestAnimationFrame\(chipChase\);/) &&
   has(/if \(typeof chipChase === "function"\) chipChase\(\);/));
eq("the seek goes straight to the page the finger points at",
   has(/chipLand = \{ id: place\.note\.id, frac: place\.frac \};\s*\n    if \(typeof openPage === "function"\) openPage\(place\.note, true\);/));
eq("only one page load is in flight at a time",
   has(/function chipLoading\(\)\{/) &&
   has(/chipDrag\.pendingId && chipDrag\.pendingId !== visualNoteId\(\)/) &&
   has(/if \(chipLoading\(\)\) return;\s*\n    if \(typeof swapping/));
eq("the same target is not asked for twice",
   has(/if \(chipDrag\.pendingId === place\.note\.id\) return;/));
eq("the nothing-until-you-let-go path is gone", !/chipDrag\.pending/.test(html));
eq("releasing forces the final target through the throttle",
   has(/chipSeek\(true\);\s*\n        chipDrag = null; pageTagDrag = null;/));

console.log("");
console.log("the chip's numbers follow your finger, not the page:");
eq("the label reads the drag target when there is one",
   has(/var wantNote = \(chipDrag && chipDrag\.want && chipDrag\.want\.note\)/) &&
   has(/var atId = wantNote \? wantNote\.id/));
eq("the section name follows it too", has(/var secObj = atNote \? sectionOfNote\(atNote\) : null;/));
eq("dragging the notebook chip into another section counts within that section",
   has(/sec = book\.filter\(function\(n\)\{ return n\.sectionId === wantNote\.sectionId; \}\);/));

console.log("");
console.log("the chip and the scroll-driven swap cannot argue:");
eq("the swap stands down for the length of a chip drag",
   has(/if \(chipDrag\) return;/));
eq("the old exemption that let it run during a drag is gone",
   !/if \(!chipDrag && !coasting/.test(html));
eq("the neighbour-by-scrolling path that caused the bounce is gone",
   !/scrollToJoin/.test(html) && !/noLandUntil/.test(html) &&
   !/lastJoin/.test(html) && !/justLeft/.test(html));

console.log("");
console.log("a drag always ends, or page turning would stay dead:");
eq("pointerup and pointercancel end it", has(/el\.addEventListener\("pointerup", endChip\);/) &&
   has(/el\.addEventListener\("pointercancel", endChip\);/));
eq("so does losing the pointer capture", has(/el\.addEventListener\("lostpointercapture", endChip\);/));
eq("and a release the chip never hears about is caught on the way back up",
   has(/\["pointerup", "pointercancel"\]\.forEach\(function\(evt\)\{\s*\n    document\.addEventListener\(evt, function\(e\)\{\s*\n      if \(!chipDrag\) return;/));
eq("that catch still lands you where you let go", has(/if \(chipDrag\.moved\) chipSeek\(true\);/));

console.log("");
console.log("one finger owns the drag:");
eq("a move from another pointer is ignored",
   has(/if \(chipDrag\.id != null && e\.pointerId !== chipDrag\.id\) return;/));
eq("so is an end from another pointer",
   has(/if \(e && e\.pointerId != null && chipDrag\.id != null &&\s*\n          e\.pointerId !== chipDrag\.id\) return;/));

console.log("");
console.log("landing honours the zoom:");
/* A fraction of a page is read the way a scrollbar reads it: 0 is the head of
   the page at the top of the screen, 1 is its FOOT at the bottom. Reading 1 as
   "one whole page further down" put the page entirely above the screen and left
   you inside the next page's band, past the hand-over line, so releasing the
   chip turned the page again on its own. */
eq("a fraction of a page is measured against what can actually scroll",
   has(/function pageScrollFor\(nid, frac\)\{/) &&
   has(/var span = Math\.max\(0, pageSpan\(nid\) \* pageZoom\(\) - p\.clientHeight\);/) &&
   has(/restoreScroll\(land \* span, 0\);/));

console.log("");
console.log("the seek arithmetic:");
{
  function listVirtual(hs){ return hs.reduce((a,b)=>a+b,0); }
  function progressToPlace(hs, prog){
    const tot = listVirtual(hs);
    let pos = Math.max(0, Math.min(1, prog)) * tot, acc = 0;
    for (let i = 0; i < hs.length; i++){
      const h = hs[i];
      if (pos < acc + h || i === hs.length - 1)
        return { i, frac: h ? Math.max(0, Math.min(1, (pos - acc) / h)) : 0 };
      acc += h;
    }
  }
  const hs = [1500, 1500, 1500];
  const top = progressToPlace(hs, 0);
  const bot = progressToPlace(hs, 1);
  const mid = progressToPlace(hs, 0.5);
  eq("chip at the top is the first page", top.i === 0 && top.frac === 0);
  eq("chip at the bottom is the last page", bot.i === 2 && bot.frac === 1);
  eq("chip in the middle is the middle page", mid.i === 1);

  /* uneven pages: a tall page must take proportionally more of the track,
     and dragging one way must never walk back — that walk-back is the bounce */
  const un = [1000, 2000, 1000];
  const at = p => { const r = progressToPlace(un, p); return r.i + "@" + r.frac.toFixed(2); };
  eq("a tall page occupies proportionally more of the track", at(0.5) === "1@0.50");
  /* 0.26 of 4000 is 1040, which is 40px into the 2000px page = 0.02 */
  eq("just inside the tall page", at(0.26) === "1@0.02");
  console.log("   0.00 " + at(0) + "   0.25 " + at(0.25) + "   0.50 " + at(0.5) +
              "   0.75 " + at(0.75) + "   1.00 " + at(1));
  let prev = -1, monotonic = true;
  for (let p = 0; p <= 1.0001; p += 0.01){
    const r = progressToPlace(un, Math.min(1, p));
    const abs = r.i + r.frac;
    if (abs < prev - 1e-9) monotonic = false;
    prev = abs;
  }
  eq("dragging one way only ever moves one way", monotonic);
}

console.log("");
console.log("short labels, tuck to the edge, tap to bring one back:");
eq("the grey chip no longer says All",
   has(/bookEl\.textContent = \(bi \+ 1\) \+ "\/"/) &&
   !/bookEl\.textContent = "All  "/.test(html));
eq("the blue chip is S2  3/6, not Sec2",
   has(/secEl\.textContent = "S" \+ secN/) &&
   !/C\.sectionDisplayName/.test(html.match(/function paintNavChips[\s\S]*?function visualNoteId/)[0]));
eq("they tuck after about a second of no chip touch",
   has(/var CHIP_TUCK_MS = 1100;/) && has(/function tuckBothChips/) &&
   has(/CHIP_TUCK_FRAC = 0\.52/));
eq("touching a tucked chip wakes only that one",
   has(/function wakeChip\(kind\)/) && has(/wasTuck: wasTuck/));
eq("a tap on a tucked chip does not jump to the start or end",
   has(/if \(!wasTuck\)\{/) && has(/a tap on a tucked chip only brings that chip back/));
eq("a chip drag into a join overscrolls into the preview, not a still hold",
   has(/function revealChipJoin/) && has(/function driveChipPeek/) &&
   has(/pageScrollFor\(vis, 1\) \+ t \* peekPx/) &&
   has(/pageScrollFor\(vis, 0\) - t \* peekPx/));
{
  const CHIP_STICK = 0.22;
  const lo = 0, hi = 0.5, pageShare = hi - lo;
  const stick = Math.max(0.012, pageShare * CHIP_STICK);
  const peekPx = 620;
  const extra = ((hi + stick * 0.5) - hi) / stick * peekPx;
  eq("stick is 22% of this page, not 4% of the book",
     Math.abs(stick - 0.11) < 1e-9);
  eq("halfway through the stick band shows about half the next page",
     Math.abs(extra - 310) < 1);
}
eq("left-handed layout tucks the other way",
   has(/body\.lefty \.secchip\{right:auto; left:40px\}/) &&
   has(/lefty \? -1 : 1/));

{
  const w = 64, frac = 0.52, off = 32; /* 40px - 8px */
  eq("same-row overlap is about half a chip",
     Math.abs(off / w - 0.5) < 0.02);
  eq("a tucked chip still shows about half of itself",
     Math.abs(1 - frac - 0.48) < 0.03);
}

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall chip checks passed");
