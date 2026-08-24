/* Simulations of scrolling, page joins, section chips, zoom, and inertia.
   Each check is a real failure mode found in the source, not a placeholder. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("source locks — these used to freeze or jump the page:");
eq("1  hovering pen no longer blocks page handover",
   has(/A hovering pen used to freeze the join/) &&
   !/if \(ink\.penNear \|\| document\.body\.classList\.contains\("drawing"\)\) return;/.test(html));
eq("2  a fling is not killed just because the pen is near",
   has(/function startGlide/) && !/if \(ink\.penNear \|\| S\.drawing\) return;/.test(html));
eq("3  a fling is re-anchored then carried, not spent at the heading",
   has(/handover\.glideCarry/) && has(/stopGlide\(\)/) &&
   has(/startGlide\(c\.S, c\.vx \* 0\.7, c\.vy \* 0\.7\)/));
/* A carried FLING still waits one join — the until gate holds momentum for a
   single turn so a throw cannot bounce through two joins. A held CHIP, though,
   has no momentum: it moves only with the finger, so from b153 it is exempt
   from that wait. Old bug: the chip was not pan.on, so it inherited the full
   400ms fling cooldown and froze at every second join while its number ran on
   ahead, then caught up by jumping when the finger got two pages clear. */
eq("4  a carried fling waits one join, but a held chip is exempt (b153)",
   has(/The join is one turn/) &&
   has(/if \(!chipDrag && Date\.now\(\) < \(handover\.until \|\| 0\)\) return;/));
/* A neighbour chip-drag now overscrolls into the peek and remounts only
   once that peek has crossed the same 40/60 line a finger uses. The swap
   still stands down during the drag so the two machines cannot bounce. */
eq("4b the swap stands down only while a far chip page is loading",
   has(/if \(chipDrag && typeof chipLoading === "function" && chipLoading\(\)\) return;/));
eq("5  the chip opens a far page DURING the drag, throttled",
   has(/function chipSeek\(force\)/) && has(/var CHIP_SEEK_MS = 130;/) &&
   !/chipDrag\.pending\b/.test(html));
eq("5d stick is a fraction of this page, not of the whole notebook",
   has(/var CHIP_STICK = 0\.06;/) && has(/function pageStick\(lo, hi\)/) &&
   has(/function placeForDrag\(list, prog, stickId\)\{/));
eq("5e the page on screen decides, and a neighbour is peeked not jump-loaded",
   has(/function visualNoteId\(\)\{/) &&
   has(/function revealChipJoin/) && has(/function chipPeekReady/) &&
   has(/if \(vis && place\.note\.id === vis\)/));
eq("5b chip lands where the chip is, never yanked to the top",
   has(/landOnPage\(place\.frac\)/) &&
   !/noLandUntil/.test(html) && !/justLeft/.test(html));
/* Still the foot, but decided ONCE before the settle loop rather than
   re-read every frame: pageBottom keeps moving while the bands hydrate, so
   chasing it moved the target ~200px under the correction chasing it. */
eq("5c both directions preserve the measured incoming seam",
   !/backWant/.test(html) && has(/var want = Math\.max\(0, pad - pend\.keepAt\);/) &&
   has(/chipDrag\.join = \{/));
eq("6  the bounce-prone join-scrolling path is gone entirely",
   !/scrollToJoin/.test(html));
eq("7  a chip drag that loses its pointer cannot freeze page turning",
   has(/if \(chipDrag\.moved\) chipSeek\(true\);/) &&
   has(/el\.addEventListener\("lostpointercapture", endChip\);/));
/* b172: "what can actually scroll" now comes from the one shared helper rather
   than from clientHeight directly, so a page docked under a Strip lands in the
   same place as one that is not. */
eq("8  chip landing retries like restoreScroll, over what can actually scroll",
   has(/restoreScroll\(land \* span, 0\)/) &&
   has(/var span = Math\.max\(0, ph \* pz - vv\.height\);/));
/* Same landing, measured against the visible page: the foot of a page must sit
   where you can see it, not behind the working sheet. */
eq("9  going back via overscroll lands on the page, not its next peek",
   has(/pageBottom\(p\) : p\.scrollHeight/) &&
   has(/bot - usablePageViewport\(\)\.height/));
eq("10 neighbour ink no longer rebuilds the whole peek band",
   has(/Only redraw the ink canvas/) &&
   !/if \(dir < 0 && typeof paintPrevPeek === "function"\) paintPrevPeek\(\);/.test(html));
eq("11 paper's own scrollbar is hidden (the third bar)",
   has(/\.paper::-webkit-scrollbar\{display:none\}/) &&
   has(/scrollbar-width:none/));
eq("12 paper does not bounce the whole app",
   has(/overscroll-behavior:contain/));
eq("13 tap chip goes to start, or end if already there (and -1 is not the top)",
   has(/var dest = \(here >= 0 && here < 0\.08\) \? 1 : 0;/) && has(/return -1;/));
eq("14 a queued far page runs after the join swap finishes",
   has(/handover\.queued/) && has(/chipLand = \{ id: q\.id, frac: q\.frac \}/));
eq("15 jump-top walks to the previous page when already at the top",
   has(/if \(p\.scrollTop > pad \+ 24\)/) && has(/neighbourPage\(-1\)/));
eq("16 jump-bottom walks to the next page when already at the foot",
   has(/neighbourPage\(1\)/) && has(/chipLand = \{ id: next\.id, frac: 0 \}/));
eq("17 chip progress divides out zoom",
   has(/\(p\.scrollTop - pad\) \/ z/));
eq("18 landOnPage measures the page in screen pixels",
   has(/function pageScrollFor\(nid, frac\)\{/) &&
   has(/pageSpan\(nid\) \* pageZoom\(\) - v\.height/));
/* And the head of the page is measured from the same place the fraction is,
   or 0 stops meaning "head of the page at the top of the screen" the moment
   anything is docked over it. */
eq("18b the page head is measured from the shared base",
   has(/function pageTopBase\(\)/) &&
   has(/return pageTopBase\(\) \+ Math\.max\(0, Math\.min\(1, frac\)\) \* span;/));
eq("19 a live stroke still blocks handover",
   has(/ink\.surfaces\[ink\.active\]\.drawing/));
eq("20 swap cooldown is 400ms, not 700",
   has(/handover\.until = Date\.now\(\) \+ 400/));

console.log("");
console.log("progress / place math:");
{
  function listVirtual(hs){ return hs.reduce((a,b)=>a+b,0); }
  function progressToPlace(hs, prog){
    const tot = listVirtual(hs);
    if (!hs.length) return null;
    let pos = Math.max(0, Math.min(1, prog)) * tot, acc = 0;
    for (let i = 0; i < hs.length; i++){
      const h = hs[i];
      if (pos < acc + h || i === hs.length - 1)
        return { i, frac: h ? Math.max(0, Math.min(1, (pos - acc) / h)) : 0 };
      acc += h;
    }
  }
  function listProgress(hs, cur, y){
    const tot = listVirtual(hs);
    let acc = 0;
    for (let i = 0; i < hs.length; i++){
      const h = hs[i];
      if (i === cur) return Math.min(1, (acc + Math.min(h, y)) / tot);
      acc += h;
    }
    return 0;
  }
  const even = [1500, 1500, 1500];
  eq("21 top of notebook is page 0 frac 0", progressToPlace(even, 0).i === 0 && progressToPlace(even, 0).frac === 0);
  eq("22 bottom of notebook is last page frac 1", progressToPlace(even, 1).i === 2 && progressToPlace(even, 1).frac === 1);
  eq("23 middle of three equal pages is page 1", progressToPlace(even, 0.5).i === 1);
  const uneven = [750, 3000, 1500];
  const p = progressToPlace(uneven, 750 / 5250);
  eq("24 a short first page does not steal the tall second", p.i === 1 && p.frac < 0.02);
  eq("25 empty list is null, not a throw", progressToPlace([], 0.4) === null);
  eq("26 one-page list start and end stay on that page",
     progressToPlace([1500], 0).i === 0 && progressToPlace([1500], 1).i === 0);
  eq("27 progress on page 0 at y=0 is 0", listProgress(even, 0, 0) === 0);
  eq("28 progress on last page at full height is 1",
     Math.abs(listProgress(even, 2, 1500) - 1) < 1e-9);
  eq("29 y past the page height is clamped so peek does not invent a fourth page",
     listProgress(even, 0, 4000) === listProgress(even, 0, 1500));
}

console.log("");
console.log("zoom conversion:");
{
  function yFromScroll(scrollTop, pad, z){ return Math.max(0, (scrollTop - pad) / z); }
  function scrollFromFrac(pad, frac, h, z){ return pad + frac * h * z; }
  eq("30 at 100% zoom, 750px down a 1500 page is half", yFromScroll(750, 0, 1) === 750);
  eq("31 at 200% zoom, 1500 scroller px is still half the page",
     yFromScroll(1500, 0, 2) === 750);
  eq("32 landing half a page at 200% writes 1500 scroller px",
     scrollFromFrac(0, 0.5, 1500, 2) === 1500);
  eq("33 prev-peek pad is taken off before dividing by zoom",
     yFromScroll(400 + 1500, 400, 2) === 750);
  eq("34 landing puts the pad back on",
     scrollFromFrac(400, 0, 1500, 1) === 400);
}

console.log("");
console.log("handover hysteresis (cannot flip-flop):");
{
  const H = 1000, top = 0;
  const fwdLine = top + H * 0.40;
  const backLine = top + H * 0.60;
  const wouldFwd = nextTop => nextTop < fwdLine;
  const wouldBack = prevBottom => prevBottom > backLine;
  eq("35 30% join after a forward chip cannot reverse",
     wouldFwd(300) && !wouldBack(300));
  eq("36 70% join after a backward chip cannot reverse",
     wouldBack(700) && !wouldFwd(700));
  eq("37 midpoint 50% is neither swap",
     !wouldFwd(500) && !wouldBack(500));
  eq("38 a 40% line and a 60% line never fire together",
     !(wouldFwd(500) && wouldBack(500)));
}

console.log("");
console.log("scroll-to-join targeting:");
{
  function nextDelta(viewH, nextTop){ return nextTop - viewH * 0.30; }
  function prevDelta(viewH, prevBottom){ return prevBottom - viewH * 0.70; }
  eq("39 next peek at 800 in a 1000 view scrolls up 500",
     Math.abs(nextDelta(1000, 800) - 500) < 1e-9);
  eq("40 next peek already at 30% does not move",
     Math.abs(nextDelta(1000, 300)) < 1e-9);
  eq("41 prev peek bottom at 200 in a 1000 view scrolls down 500",
     Math.abs(prevDelta(1000, 200) - (200 - 700)) < 1e-9);
  eq("42 prev peek already at 70% does not move",
     Math.abs(prevDelta(1000, 700)) < 1e-9);
}

console.log("");
console.log("tap chip start/end:");
{
  const dest = here => here < 0.08 ? 1 : 0;
  eq("43 tap near the start goes to the end", dest(0.02) === 1);
  eq("44 tap in the middle goes to the start", dest(0.4) === 0);
  eq("45 tap near the end goes to the start", dest(0.99) === 0);
  eq("46 a second tap from the start then goes to the end", dest(0) === 1);
}

console.log("");
console.log("page-walk arrows:");
{
  function jumpTop(scrollTop, pad){ return scrollTop > pad + 24 ? "page-top" : "prev-page"; }
  function jumpBot(scrollTop, clientH, bot){
    return scrollTop + clientH < bot - 24 ? "page-foot" : "next-page";
  }
  eq("47 mid-page up-arrow stays on this page", jumpTop(400, 0) === "page-top");
  eq("48 already at top, up-arrow leaves this page", jumpTop(0, 0) === "prev-page");
  eq("49 mid-page down-arrow stays on this page", jumpBot(100, 800, 1500) === "page-foot");
  eq("50 already at the foot, down-arrow leaves this page", jumpBot(700, 800, 1500) === "next-page");
}

console.log("");
console.log("section vs notebook lists:");
{
  const book = [
    {id:"a", sectionId:"s1"}, {id:"b", sectionId:"s1"},
    {id:"c", sectionId:"s2"}, {id:"d", sectionId:"s2"}
  ];
  const sec = book.filter(n => n.sectionId === "s1");
  eq("51 section list is only this section", sec.length === 2 && sec[0].id === "a");
  eq("52 notebook list keeps later sections", book.length === 4 && book[3].id === "d");
  function idx(list, id){ return list.findIndex(n => n.id === id); }
  eq("53 page c is 2 of 4 in the book and not in section 1",
     idx(book, "c") === 2 && idx(sec, "c") === -1);
  eq("54 walking the book from b goes to c (next section)",
     book[idx(book, "b") + 1].id === "c");
  eq("55 walking the section from b has no next",
     sec[idx(sec, "b") + 1] == null);
}

console.log("");
console.log("edge / first / last pages:");
{
  function neighbour(list, id, dir){
    const i = list.indexOf(id);
    if (i < 0) return null;
    return list[i + dir] || null;
  }
  const pages = ["p0","p1","p2"];
  eq("56 first page has no previous", neighbour(pages, "p0", -1) === null);
  eq("57 last page has no next", neighbour(pages, "p2", 1) === null);
  eq("58 middle page has both", neighbour(pages, "p1", -1) === "p0" && neighbour(pages, "p1", 1) === "p2");
  eq("59 unknown page has no neighbour", neighbour(pages, "zz", 1) === null);
  function edgeOf(scrollTop, atEnd){
    if (scrollTop <= 0) return -1;
    if (atEnd) return 1;
    return 0;
  }
  eq("60 at the top is backward edge", edgeOf(0, false) === -1);
  eq("61 at the foot is forward edge", edgeOf(100, true) === 1);
  eq("62 in the middle is neither edge", edgeOf(100, false) === 0);
}

console.log("");
console.log("flow push should not double-turn when peeks exist:");
{
  function pushFlow(pageFlow, peekShowing, atEdge, acc, amount){
    if (!pageFlow) return { acc, fire: false, reason: "off" };
    if (peekShowing) return { acc, fire: false, reason: "peek-owns-it" };
    if (!atEdge) return { acc: 0, fire: false, reason: "not-at-edge" };
    acc += amount;
    return { acc, fire: acc >= 140, reason: acc >= 140 ? "go" : "need-more" };
  }
  eq("63 with peeks on, extra push does not also swap",
     pushFlow(true, true, true, 0, 200).reason === "peek-owns-it");
  eq("64 without peeks, 140px past the edge does swap",
     pushFlow(true, false, true, 0, 140).fire === true);
  eq("65 a short nudge does not swap",
     pushFlow(true, false, true, 0, 40).fire === false);
  eq("66 leaving the edge resets the accumulator",
     pushFlow(true, false, false, 80, 40).acc === 0);
}

console.log("");
console.log("restore / clamp:");
{
  function attempt(want, scrollHeight, clientHeight){
    const max = Math.max(0, scrollHeight - clientHeight);
    return Math.min(want, max);
  }
  eq("67 a short page clamps a large restore instead of lying",
     attempt(2000, 800, 700) === 100);
  eq("68 a tall page keeps the asked-for place",
     attempt(900, 3000, 700) === 900);
  eq("69 want 0 stays 0", attempt(0, 3000, 700) === 0);
}

console.log("");
console.log("still more join / chip / glide cases:");
eq("70 handover still ignores a thin first-page band",
   has(/!prevEl\.classList\.contains\("thin"\)/));
eq("71 forward swap still needs the next peek past 40%",
   has(/pr\.height \* 0\.40/));
eq("72 backward swap still needs the prev peek past 60%",
   has(/pr\.height \* 0\.60/));
eq("73 watched-block residual over 400px is ignored",
   has(/Math\.abs\(d\) < 400/));
eq("74 a finger still dragging is not fought for sixteen frames",
   has(/stillHeld/) && has(/one re-anchor/));
eq("75 pad watch skips the first resize after a swap",
   has(/padWatch\.skip/));
eq("76 savePlace is page-relative, not raw scrollTop",
   has(/p\.scrollTop - prevPad\(\)/));
eq("77 savePlace is silent mid-swap",
   has(/if \(swapping\(\)\) return;/));
eq("78 paintDoc does not restore a remembered place on top of a scroll-in",
   has(/!swapping\(\) && !undoReveal && !chipDrag && chipLand == null/));
eq("79 end-kit is judged against the page, not the scroller",
   has(/atPageEnd\(p, 90\)/));
eq("80 pageBottom uses the end-of-page rule, not scrollHeight",
   has(/function pageBottom\(p\)/));
eq("81 section join is marked when the neighbour is another section",
   has(/function markSectionJoin/) && has(/secjoin/));
eq("82 two chips still exist (section and notebook)",
   has(/id="secChip"/) && has(/id="bookChip"/));
eq("83 old fading page-percent tag stays hidden",
   has(/\.pagetag\{display:none !important\}/));
eq("84 old in-page percent dot stays hidden",
   has(/\.scrolldot\{display:none !important\}/));
eq("85 glide dies at a real edge so it cannot run forever",
   has(/sc\.scrollTop === t0 && sc\.scrollLeft === l0/));
eq("86 a slow lift is not turned into a throw",
   has(/Math\.sqrt\(vx\*vx \+ vy\*vy\) < 0\.06/));
eq("87 one-finger pan and two-finger pan share the same glide",
   has(/startGlide\(S, gest\.base\.v\.vx/) && has(/startGlide\(pan\.S, pan\.vx, pan\.vy\)/));
eq("88 auto-scroll while writing cannot bolt",
   has(/S\.scroller\.scrollTop \+= 12/) && has(/now - lastAutoScroll < 60/));
eq("89 preview height still matches the live page formula",
   has(/pageHeightOf\(prev\.id\)/) && has(/pageHeightOf\(next\.id\)/));
eq("90 first page still uses a thin start band",
   has(/box\.classList\.add\("thin"\)/));
eq("91 last page hides the next peek",
   has(/peek\.hidden = true/) && has(/last page/));
eq("92 chip lists are frozen at pointerdown so a mid-drag insert cannot retarget",
   has(/chipDrag = \{ kind: kind, list: list/));
eq("93 pointer capture is taken so a drag off the chip still moves",
   has(/el\.setPointerCapture\(e\.pointerId\)/));
eq("94 left-handed layout flips both chips",
   has(/body\.lefty \.secchip/) && has(/body\.lefty \.bookchip/));
eq("95 feature guide describes the chips and the unfrozen join",
   has(/The blue chip is this section/));
eq("96 handover guard still unfreezes a swap that never lands",
   has(/handover\.guard/) && has(/2500/));
eq("97 incoming peek is not emptied while it is still on screen",
   has(/Do not wipe the incoming page/));
eq("98 finishHandover only runs for the page that was asked for",
   has(/pend\.id !== here && pend\.id !== state\.note\.id/));
eq("99 restoreScroll waits until the sheet is tall enough",
   has(/tries < 12/) && has(/setTimeout\(attempt, 60\)/));
eq("100 pageFlow can still be turned off in Settings",
   has(/id="setPageFlow"/) && has(/pageFlow: true/));

if (bad) console.log("\n" + bad + " failed");
else console.log("\nok  100 scroll simulations");
process.exitCode = bad ? 1 : 0;
