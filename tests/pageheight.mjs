/* b40: the real cause of the scroll jump — a page is as tall as its
   handwriting, but the peek band only knew about its words. And the side
   button, held, not toggled. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("the peek band is as tall as the page it previews:");
eq("live page and peek use the same stored sheet height",
   has(/function pageHeightOf\(id\)/) &&
   has(/b\.style\.minHeight = Math\.round\(pageHeightOf\(state\.noteId\)\) \+ "px";/) &&
   has(/body\.style\.minHeight = Math\.round\(pageHeightOf\(noteId\)\) \+ "px";/) &&
   has(/\$\("prevPeekBody"\)\.style\.minHeight = Math\.round\(pageHeightOf\(prev\.id\)\) \+ "px";/) &&
   has(/\$\("nextPeekBody"\)\.style\.minHeight = Math\.round\(pageHeightOf\(next\.id\)\) \+ "px";/));
eq("an empty new page is a full sheet, not a 400px stub",
   has(/function pageFloorPx\(\)\{/) && has(/getPropertyValue\("--page-h"\)/));
eq("the default sheet is taller than A4 with A4 width",
   has(/--page-w:794px; --page-h:1500px/));
eq("writing does not grow the page from ink",
   has(/Does not grow from handwriting/) &&
   !/b\.style\.minHeight = Math\.round\(pageHeightFor\(depth\)\)/.test(html));
eq("peek ink paint does not restretch the band from strokes",
   !/body\.style\.minHeight = Math\.round\(pageHeightFor\(depth\)\)/.test(html));
eq("the band sizes to its content, no fixed one-page floor fighting it",
   has(/host\.style\.minHeight = "0px";/));
eq("the canvas is re-measured against the grown band before the ink is drawn",
   has(/var c2 = fit\(\);\s*\/\* re-measure against the grown band \*\//));
eq("the first page's thin band clears any tall height left behind",
   has(/\$\("prevPeekBody"\)\.style\.minHeight = "";/) &&
   has(/\$\("prevPeekPage"\)\.style\.minHeight = "";/));
eq("the thin first page is never grown", has(/!host\.parentNode\.classList\.contains\("thin"\)/));

console.log("");
console.log("the maths: live page and peek band land on the same height:");
{
  const FLOOR = 1500;
  const extra = {};
  const h = id => FLOOR + (extra[id] || 0);
  eq("an empty page is a full sheet", h("p1") === 1500);
  extra.p1 = 750;
  eq("one double-tap adds half a sheet", h("p1") === 2250);
  extra.p1 += 750;
  eq("a second double-tap adds another half", h("p1") === 3000);
  eq("a neighbour with no extra stays a sheet", h("p2") === 1500);
  eq("live and peek of p1 agree after the taps", h("p1") === h("p1"));
  eq("live and peek of p2 agree (no jump at the join)", h("p2") === 1500);
}

console.log("");
console.log("double-tap near the bottom adds half a sheet:");
eq("the setting exists and defaults on",
   has(/tapGrow: true/) && has(/id="setTapGrow"/));
eq("a double-tap of the nib near the foot grows the page",
   has(/function addPageHalf\(\)/) &&
   has(/var add = Math\.round\(pageFloorPx\(\) \/ 2\);/) &&
   has(/nearPageFoot\(st\.pts\[1\]\)/));
eq("a finger double-tap near the foot does the same",
   has(/nearPageFoot\(py\)/) && has(/addPageHalf\(\)/));
eq("already-long pages from the old auto-grow are kept",
   has(/function extraFromOldDepth\(depth\)/) &&
   has(/first run after auto-grow was removed/));

console.log("");
console.log("the side button is press on, press off:");
eq("there is a button spring that remembers the last tool", has(/var btnSpring = \{ on: false, was: null \};/));
eq("press enters the eraser and remembers the tool",
   has(/function eraserOn\(why\)\{/) && has(/eraserReturn = ink\.tool;/));
/* b125: all three gestures share ONE note of the tool to come back to. Three
   separate ones meant the button could turn the eraser on remembering your
   marker, a double tap could turn it off restoring a stale "pen", and the
   next press put back something you had not held for minutes. */
eq("it restores the exact pen you were using",
   has(/var eraserReturn = null;/) && has(/ink\.tool = eraserReturn \|\| "pen";/));
eq("lifting the pen away does not turn the latch off",
   has(/\["pointerleave", "pointerout"\]\.forEach/) && has(/barrelDisarmSoon\(\)/));
eq("a mere nib-up does not turn it off",
   !/pointerup[\s\S]{0,40}eraserOff/.test(html));
/* The toggle asks the TOOL, not a flag saying the button turned it on. The
   tool changes underneath such a flag (you pick a pen off the bar, or one of
   the other eraser gestures runs) and once they disagreed the next press
   acted on the flag and did nothing visible. */
eq("a second press still cancels, so it cannot get stuck",
   has(/function eraserToggle\(why\)\{/) &&
   has(/if \(ink\.tool === "eraser"\) eraserOff\(\); else eraserOn\(why/));
eq("the right-click route is a press, not an arm-then-touch",
   has(/barrelPressToggle\(\);/) &&
   !/barrelArm\(\);\s+\/\* hover \+ button, waiting for touch \*\//.test(html));
eq("the secondary-mousedown route is also a press",
   has(/document\.addEventListener\("mousedown"/) &&
   has(/if \(e\.button !== 2\) return;/) &&
   has(/barrelPressToggle\(\);/));
eq("mid-stroke, the half-made mark is dropped and erasing starts there",
   has(/S\.drawing = \{ erasing: true, removed: \[\] \};/) &&
   has(/if \(st\.pts\.length >= 3 && S\.eraseAt\) S\.eraseAt\(st\.pts\[0\], st\.pts\[1\]\);/));

console.log("");
console.log("the earlier gestures still stand:");
eq("nib-hold spring still there", has(/function springEraseOn\(\)\{/));
eq("double-tap latch still there", has(/cfg\.tapErase && S\.name === "note"/));
eq("the button setting still gates it", has(/if \(cfg\.penButtonErase === false\) return;/));

process.exitCode = bad ? 1 : 0;
