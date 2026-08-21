/* Exhaustive leftover stones for the b151 chip/finger freeze hunt.
   Source + arithmetic. Does not patch the app.
   Run: node tests/scrollstones.mjs index.html
*/
import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0, n = 0;
const eq = (l, c) => { n++; console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);
function grab(name){
  const m = html.match(new RegExp("\\n  function " + name + "\\([\\s\\S]*?\\n  \\}"));
  if (!m) return "";
  return m[0];
}

console.log("A. neighbour identity vs chip list");
eq("neighbourPage walks pageOrder (whole notebook), not the chip's list",
   /function neighbourPage\(dir\)\{[\s\S]*?var list = pageOrder\(\);/.test(html));
eq("neighbourPage keys off currentPageId/state.noteId, not visualNoteId",
   /function neighbourPage\(dir\)\{[\s\S]*?currentPageId/.test(html) &&
   !/function neighbourPage\(dir\)\{[\s\S]*?visualNoteId/.test(html));
eq("sec chip drag uses sectionPageList",
   /kind === "sec" \? sectionPageList\(\) : pageOrder\(\)/.test(html));
eq("pageHandover target is neighbourPage, so a sec-chip drag can remount a notebook neighbour",
   /target = neighbourPage\(1\)/.test(html) && /target = neighbourPage\(-1\)/.test(html));

console.log("\nB. peekSlope / join carry");
{
  const fh = grab("finishHandover") || html;
  eq("held-chip join fallback treats non-positive slope as 'missing'",
     /if \(!\(js > 0\)\) js = Math\.max\(1, listVirtual/.test(html));
  eq("backward peekSlope is written as (target-base)/(-reveal)",
     /peekSlope = \(bg\.target - bg\.base\) \/ Math\.min\(-1e-6, -reveal\)/.test(html));
  /* arithmetic: a 20-page book, 700px peek travel, reveal 0.012 */
  const slope = 700 / 0.012;
  eq("measured peekSlope on a 20-page book is tens of thousands of px per track-unit",
     slope > 50000 && slope < 60000);
  const dprog = 0.02; /* 2% of track, still inside 0.65*0.05=0.032 close window */
  const jump = dprog * slope;
  eq("2% more chip travel under that slope moves scroll by >1000px",
     jump > 1000);
  const fallback = 20 * 1500;
  eq("NaN/0 slope fallback is whole-notebook pixels (~30000), same order of danger",
     fallback === 30000);
}

console.log("\nC. chipLand can overwrite the handover re-anchor");
eq("paintDoc calls finishHandover then may restoreScroll(chipLand.frac)",
   html.indexOf("finishHandover();") < html.indexOf("restoreScroll(land * span, 0)") &&
   /restoreScroll\(land \* span, 0\)/.test(html));
eq("chipLand land is skipped only when swapping() or chipDrag for the mismatch branch",
   /chipLand != null && !swapping\(\) && !chipDrag/.test(html));
eq("matching chipLand while chipDrag is still held still restoreScrolls",
   /chipLand != null && state\.note &&/.test(html) &&
   /restoreScroll\(land \* span, 0\)/.test(html) &&
   !/chipLand != null && state\.note &&[\s\S]{0,80}chipDrag/.test(html));

console.log("\nD. dual seek / unused throttle / unused force");
{
  const seek = grab("chipSeek");
  eq("chipSeek body never reads CHIP_SEEK_MS",
     seek.includes("function chipSeek") && !seek.includes("CHIP_SEEK_MS"));
  eq("chipSeek body never reads the force parameter",
     !/function chipSeek\(force\)\{[\s\S]*?\bforce\b/.test(seek.replace("function chipSeek(force)", "function chipSeek()")));
  eq("pointermove AND chipChase both call chipSeek(false) the same frame",
     /placeChip\(el, prog\);\s*\n      chipSeek\(false\);/.test(html) &&
     /function chipChase\(\)\{[\s\S]*?chipSeek\(false\)/.test(html));
}

console.log("\nE. listProgress vs peek overscroll (release snap even on one join)");
{
  /* transcribed listProgress: y is in-page scroll, capped at page height */
  function listProgress(hs, hereI, ySheet){
    const tot = hs.reduce((a,b)=>a+b,0);
    let acc = 0;
    for (let i = 0; i < hs.length; i++){
      const h = hs[i];
      if (i === hereI) return Math.min(1, (acc + Math.min(h, ySheet)) / tot);
      acc += h;
    }
    return -1;
  }
  const hs = [1500, 1500, 1500];
  const atFoot = listProgress(hs, 0, 1500);
  const intoPeek = listProgress(hs, 0, 1500 + 800); /* overscrolled into next peek */
  eq("listProgress at the foot of page 0 is the join (1/3)",
     Math.abs(atFoot - 1/3) < 1e-9);
  eq("listProgress still reports that same join after 800px of peek overscroll",
     intoPeek === atFoot);
}

console.log("\nF. finger vs chip until durations");
eq("chip path is not pan.on, so until is 400ms not 160ms",
   /pan && pan\.on\) \? 160 : 400/.test(html));
eq("fingerPanMove freezes deltas while handover busy/pending",
   html.indexOf("function fingerPanMove") >= 0 &&
   html.indexOf("handover.busy || handover.pending") >= 0 &&
   /pan\.top = S\.scroller\.scrollTop/.test(html));
eq("startGlide still mentions cancelling throw via noGlide but finishHandover does not set it",
   /if \(typeof pan === "object" && pan && pan\.noGlide\) return;/.test(html) &&
   !/pan\.noGlide = true/.test(html));

console.log("\nG. first/last page and section joins");
eq("first-page prevPeek is thin, so chipPeekReady(-1) fails",
   /box\.classList\.add\("thin"\)/.test(html) &&
   /prevEl\.classList\.contains\("thin"\)/.test(html));
eq("section-boundary peeks get a label via markSectionJoin",
   /function markSectionJoin/.test(html) && /secjoin/.test(html));
eq("pageHeightOf is sheet floor + extra, not live ink (bands share that)",
   /function pageHeightOf\(id\)\{[\s\S]*?pageFloorPx\(\) \+ \(\(id && pageExtra\[id\]\) \|\| 0\)/.test(html));

console.log("\nH. forbidden designs still absent");
eq("scrollToJoin / noLandUntil / lastJoin / justLeft stay gone",
   !/scrollToJoin/.test(html) && !/noLandUntil/.test(html) &&
   !/lastJoin/.test(html) && !/justLeft/.test(html));

console.log("\n" + n + " stones, " + bad + " failed");
process.exitCode = bad ? 1 : 0;
