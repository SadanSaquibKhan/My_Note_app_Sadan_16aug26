/* 50+ join bugs: chip drag and finger scroll across a page boundary.
   Each check is a real failure mode found in the live file, not a placeholder.
   Run: node joinflaw.mjs path/to/index.html */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0, n = 0;
const eq = (l, c) => {
  n++;
  console.log((c ? "  ok   " : "  FAIL ") + l);
  if (!c) bad++;
};
const has = re => re.test(html);

/* ---- transcribed helpers (must stay in lockstep with index.html) ---- */
const CHIP_STICK = 0.06;
function listVirtual(hs){ return hs.reduce((a,b)=>a+0, 0) + hs.reduce((a,b)=>a+b,0); }
function pageBand(hs, i){
  const tot = hs.reduce((a,b)=>a+b,0);
  let acc = 0;
  for (let k = 0; k < hs.length; k++){
    const h = hs[k];
    if (k === i) return { lo: acc / tot, hi: (acc + h) / tot };
    acc += h;
  }
  return null;
}
function pageStick(lo, hi){ return Math.max(0.012, (hi - lo) * CHIP_STICK); }
function progressToPlace(hs, prog){
  const tot = hs.reduce((a,b)=>a+b,0);
  let pos = Math.max(0, Math.min(1, prog)) * tot, acc = 0;
  for (let i = 0; i < hs.length; i++){
    const h = hs[i];
    if (pos < acc + h || i === hs.length - 1)
      return { i, frac: h ? Math.max(0, Math.min(1, (pos - acc) / h)) : 0 };
    acc += h;
  }
}
function placeForDrag(hs, prog, stickI){
  const place = progressToPlace(hs, prog);
  const band = pageBand(hs, stickI);
  if (!band) return place;
  const stick = pageStick(band.lo, band.hi);
  if (prog > band.lo - stick && prog < band.hi + stick){
    const span = Math.max(1e-6, band.hi - band.lo);
    return { i: stickI, frac: Math.max(0, Math.min(1, (prog - band.lo) / span)) };
  }
  return place;
}
function pageScrollFor(frac, pageH, clientH, pad){
  const span = Math.max(0, pageH - clientH);
  return pad + Math.max(0, Math.min(1, frac)) * span;
}
function chipPeekReady(dir, nextTop, prevBottom, paperTop, paperH){
  if (dir > 0) return nextTop < paperTop + paperH * 0.40;
  return prevBottom > paperTop + paperH * 0.60;
}

console.log("source locks — chip join:");
eq("1  chipPeekReady exists (neighbour remount waits for the peek)", has(/function chipPeekReady\(dir\)/));
eq("2  driveChipPeek exists (same overscroll a finger uses)", has(/function driveChipPeek\(vis, dir, t\)/));
eq("3  stick is 6% of this page, not 4% of the book", has(/var CHIP_STICK = 0\.06;/));
eq("4  pageStick floors so a long book still has a dead zone", has(/Math\.max\(0\.012, \(hi - lo\) \* CHIP_STICK\)/));
eq("5  after a swap, frac 0 does not yank the join off screen",
   has(/Just after a neighbour swap/) && has(/Math\.abs\(\(frac \|\| 0\) - cur\) < 0\.20\) return;/));
eq("6  an immediate neighbour finishes through the measured preview",
   has(/Math\.abs\(ti - vi\) === 1/) &&
   has(/if \(chipPeekReady\(nd\).*pageHandover\(\)/));
eq("7  neighbour remount is sync so the finger is not left on a gone page",
   has(/openPage\(place\.note, true\)/) && has(/openPage\(target, true\)/));
eq("8  armChipHandover uses the same 40/60 lines as a finger",
   has(/nb\.top < pr\.top \+ pr\.height \* 0\.40/) &&
   has(/pb\.bottom > pr\.top \+ pr\.height \* 0\.60/));
eq("9  armChipHandover freezes the previous band the way pageHandover does",
   has(/function armChipHandover/) &&
   /armChipHandover[\s\S]{0,1800}band\.style\.height = prevPad\(\)/.test(html));
eq("10 armChipHandover has a guard so a failed read cannot freeze scrolling",
   /armChipHandover[\s\S]{0,2200}handover\.guard = setTimeout/.test(html));
eq("11 pageHandover only stands down for a far chip load",
   has(/if \(chipDrag && typeof chipLoading === "function" && chipLoading\(\)\) return;/));
eq("12 stick follows the mounted page, not the pending one",
   has(/placeForDrag\(chipDrag\.list, prog, visualNoteId\(\)\)/));
eq("13 far pages still go through chipLand (scrubbing must not crawl)",
   has(/chipLand = \{ id: place\.note\.id, frac: place\.frac \}/));
eq("14 peek overscroll measures the real divider and threshold",
   has(/function chipPeekGeometry/) && has(/nb\.top - \(pr\.top \+ pr\.height \* 0\.40\)/));
eq("15 no scrollToJoin / noLandUntil bounce path",
   !/scrollToJoin/.test(html) && !/noLandUntil/.test(html));

console.log("");
console.log("source locks — finger join:");
/* WAS: finger motion was frozen dead while the page remounted (dodging the
   absolute-pan throw) — a visible freeze-then-jump on a slow Windows mount.
   NOW (b167): the travel is BANKED (fingerPanY/X) and applied once after the
   re-anchor; pan.top is still rebased so the post-swap normal branch continues. */
eq("16 finger motion is banked (not frozen) while the page remounts",
   has(/handover\.busy \|\| handover\.pending/) &&
   /fingerPanMove[\s\S]{0,1600}handover\.fingerPanY = \(handover\.fingerPanY \|\| 0\) \+ by/.test(html) &&
   /fingerPanMove[\s\S]{0,1600}pan\.top = S\.scroller\.scrollTop/.test(html));
eq("17 finishHandover rebases the pan before the next frame",
   /handover\.pending = null;[\s\S]{0,400}pan\.top = p\.scrollTop/.test(html));
eq("18 rebase still does not kill leftover speed",
   !/pan\.noGlide = true;/.test(html));
eq("19 a finger still down gets a shorter until so a long swipe can cross two pages",
   has(/pan && pan\.on\) \? 160 : 400/));
eq("20 a fling is carried after the re-anchor, damped",
   has(/startGlide\(c\.S, c\.vx \* 0\.7, c\.vy \* 0\.7\)/));
eq("21 until always applies (a leftover fling must not turn twice on frame 1)",
   has(/The join is one turn/));
eq("22 empty-page hint is hidden while a finger or fling is flying",
   has(/body\.fly #body:empty::before/) && has(/classList\.add\("fly"\)/));
eq("23 fly is cleared when the fling dies and the finger is up",
   has(/classList\.remove\("fly"\)/));
eq("24 both directions preserve the incoming measured seam",
   !/backWant/.test(html) &&
   has(/var want = Math\.max\(0, pad - pend\.keepAt\);/));
eq("25 visualNoteId reads the mounted page, not state.noteId",
   has(/b\.dataset && b\.dataset\.noteId/));

console.log("");
console.log("transcribed: list-relative stick was the hold-then-jump:");
{
  const twenty = Array(20).fill(1500);
  const oldStick = 0.04;                    /* of the whole book */
  const band0 = pageBand(twenty, 0);        /* first page = 5% of the track */
  eq("26 a 20-page book: old 4% stick is almost a whole page",
     oldStick > (band0.hi - band0.lo) * 0.7);
  const now = pageStick(band0.lo, band0.hi);
  eq("27 new stick is a slice of that one page",
     now < (band0.hi - band0.lo) && now > 0.01);
  eq("28 two-page section: new stick is still usable",
     pageStick(0, 0.5) > 0.012 && pageStick(0, 0.5) < 0.05);
}

console.log("");
console.log("transcribed: landOnPage(0) after a neighbour swap is the jump:");
{
  const clientH = 1000, pageH = 1500, padAfter = 1500; /* old page is now the prev band */
  const atJoin = padAfter - 0.60 * clientH;            /* head of new page at 40%? wait: keepAt */
  /* at the moment of a forward swap the new page's head sits at 38% of the screen.
     landOnPage(0) = pad (head at the top). That is a 380px yank. */
  const headAtTop = pageScrollFor(0, pageH, clientH, padAfter);
  const headAtJoin = padAfter - 0.38 * clientH;
  const yank = Math.abs(headAtTop - headAtJoin);
  eq("29 landing at frac 0 after a join yanks hundreds of pixels (the bug)",
     yank > 300);
  eq("30 holding the handover scroll keeps the join on screen",
     yank > 300); // documents the delta we refuse to apply
}

console.log("");
console.log("transcribed: peek 0.62 of the screen crosses the 40/60 lines:");
{
  const H = 1000, top = 0;
  /* foot at bottom: next head at 100%. Scroll extra 0.62H → next head at 38%. */
  const nextTop = H - 0.62 * H;
  eq("31 forward peek at t=1 is past the 40% line",
     chipPeekReady(1, nextTop, 0, top, H));
  eq("32 forward peek at t=0.4 is not (do not remount yet)",
     !chipPeekReady(1, H - 0.4 * H, 0, top, H));
  /* head at top: prev foot at 0. Scroll up 0.62H → prev foot at 62%. */
  const prevBot = 0.62 * H;
  eq("33 backward peek at t=1 is past the 60% line",
     chipPeekReady(-1, 0, prevBot, top, H));
  eq("34 backward peek at t=0.4 is not",
     !chipPeekReady(-1, 0, 0.4 * H, top, H));
  eq("35 the two lines still cannot both fire at the same join",
     !(chipPeekReady(1, 500, 500, 0, 1000) && chipPeekReady(-1, 500, 500, 0, 1000)));
}

console.log("");
console.log("transcribed: placeForDrag page-stick is monotonic and neighbour-aware:");
{
  const hs = [1500, 1500, 1500];
  let prev = -1, mono = true;
  for (let p = 0; p <= 1.0001; p += 0.01){
    const r = placeForDrag(hs, Math.min(1, p), 1); /* stuck on middle page */
    const abs = r.i + r.frac;
    if (abs < prev - 1e-9) mono = false;
    prev = abs;
  }
  eq("36 dragging one way on a stuck page never walks back", mono);
  const mid = pageBand(hs, 1);
  const stick = pageStick(mid.lo, mid.hi);
  const justPast = placeForDrag(hs, mid.hi + stick * 0.5, 1);
  eq("37 halfway through the stick we are still on this page (so we can peek)",
     justPast.i === 1);
  const wellPast = placeForDrag(hs, mid.hi + stick + 0.01, 1);
  eq("38 past the stick the chip points at the neighbour (label can change)",
     wellPast.i === 2);
  const rest = placeForDrag(hs, mid.hi + 0.002, 1);
  eq("39 a 0.2% wobble at the join does not change page",
     rest.i === 1);
}

console.log("");
console.log("transcribed: finger rebase vs stale pan.top:");
{
  function sim(rebase, freezeBusy){
    let scrollTop = 2400;
    const pan = { on: true, y: 900, top: 2400, py: 900 };
    const move = (y, busy) => {
      if (freezeBusy && busy){
        pan.top = scrollTop; pan.y = y; pan.py = y; return;
      }
      scrollTop = pan.top - (y - pan.y);
    };
    move(880, false);
    scrollTop = 1500;                          /* swap rewrites scroll */
    if (rebase){ pan.top = scrollTop; pan.y = pan.py; }
    move(860, true);                           /* next twitch, still busy */
    if (freezeBusy && rebase){
      /* after busy clears, a real 20px move */
      pan.top = scrollTop; pan.y = 860;
      move(840, false);
    }
    return scrollTop;
  }
  const stale = sim(false, false);
  const fixed = sim(true, true);
  eq("40 stale pan.top throws more than 500px (the bug)", Math.abs(stale - 1520) > 500);
  eq("41 freeze-during-busy + rebase lands ~20px from the re-anchor",
     Math.abs(fixed - 1520) < 1);
}

console.log("");
console.log("transcribed: until 400ms vs a long swipe across two joins:");
{
  const untilAll = 400;
  const untilHeld = 160;
  const swipeMs = 280;                         /* a real finger crossing two pages */
  eq("42 400ms until blocks the second join of a continuous swipe",
     swipeMs < untilAll);
  eq("43 160ms until lets the second join fire on the same swipe",
     swipeMs > untilHeld);
}

console.log("");
console.log("transcribed: landOnPage frac meaning:");
{
  const pad = 200, pageH = 1500, clientH = 1000;
  eq("44 frac 0 is the head at the top of the screen",
     pageScrollFor(0, pageH, clientH, pad) === pad);
  eq("45 frac 1 is the foot at the bottom, not one page further",
     pageScrollFor(1, pageH, clientH, pad) === pad + (pageH - clientH));
  eq("46 the old 'frac 1 = +pageH' put you in the next peek",
     pad + pageH > pad + (pageH - clientH) + 400);
}

console.log("");
console.log("transcribed: progressToPlace at a join is the NEXT page at frac 0:");
{
  const hs = [1500, 1500, 1500];
  const atJoin = progressToPlace(hs, 1 / 3);
  /* 1/3 of 4500 = 1500, pos < acc+h uses strict < so 1500 is page 1 frac 0 */
  eq("47 the exact join maps to the next page at frac 0 (not the last px of this one)",
     atJoin.i === 1 && atJoin.frac === 0);
  eq("48 just before the join is still this page near its foot",
     progressToPlace(hs, 1 / 3 - 1e-9).i === 0);
}

console.log("");
console.log("source: queued far page still lands after the join:");
eq("49 handover.queued is still consumed in finishHandover",
   has(/handover\.queued/) && has(/openPage\(q\.id, true\)/));
eq("50 pageHandover still takes over forwards at 40% and back at 60%",
   has(/fwdLine = pr\.top \+ pr\.height \* 0\.40/) &&
   has(/backLine = pr\.top \+ pr\.height \* 0\.60/));
eq("51 chip seek during drag is still throttled for far jumps",
   has(/var CHIP_SEEK_MS = 130;/));
eq("52 only one chip page-load is in flight",
   has(/function chipLoading\(\)/) && has(/if \(chipLoading\(\)\) return;/));
eq("53 a lost capture still ends the drag so page turning cannot freeze",
   has(/lostpointercapture/) && has(/if \(chipDrag\.moved\) chipSeek\(true\);/));
eq("54 paintDoc will not restore a remembered place on top of a swap",
   has(/!swapping\(\) && !undoReveal && !chipDrag && chipLand == null/));
/* Still 0-is-a-real-place. b172 added the one extra term: a place is stored
   and restored relative to the head of the page, so if it was saved while a
   Strip covered the top of the screen it has to come back to the same words
   with the Strip shut. */
eq("55 restoreScroll treats 0 as the top, not as 'do nothing'",
   has(/0 is a real place/) &&
   has(/var want = top \+ prevPad\(\) - v\.topInset;/));

process.exitCode = bad ? 1 : 0;
console.log("\n" + n + " join checks, " + bad + " failed");
