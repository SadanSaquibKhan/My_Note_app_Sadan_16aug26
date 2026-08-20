/* b44: three-column panels, sec0, barrel hold that does not flash off,
   scroll does not steal pictures, rough working uses the same ruling. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("three columns when the side panel is on:");
eq("notebooks / sections / pages panes exist",
   has(/id="railPane"/) && has(/id="secPane"/) && has(/id="listPane"/));
eq("each column has a collapse button", has(/id="railTog"/) && has(/id="secTog"/));
eq("collapsed column is a 42px strip", has(/body\.railmin \.rail\{flex:0 0 42px/));
eq("default: notebooks collapsed, sections open",
   has(/railMin: true/) && has(/secMin: false/));

console.log("sec0 and auto names:");
eq("ensureDefaultSection writes sec0", has(/createSection\(notebookId, "sec0"/));
eq("unfiled pages are moved into sec0", has(/if \(!n\.sectionId\)\{\s*n\.sectionId = sec\.id/));
eq("sec0 cannot be deleted", has(/The default section cannot be deleted/));
eq("suggestSectionName falls back to sec1", has(/nextSeriesName\(names, "sec1"\)/));

/* extract nextSeriesName and prove sec1 → sec2 */
const split = html.match(/function splitSeries\(name\)\{[\s\S]*?\n  \}/);
const series = html.match(/function seriesName\(stem, num, pad\)\{[\s\S]*?\n  \}/);
const next = html.match(/function nextSeriesName\(names, fallback\)\{[\s\S]*?\n  \}/);
if (split && series && next){
  const rest = html.slice(html.indexOf(next[0]) + next[0].length);
  const restFn = rest.match(/^[\s\S]*?\n    return /);
  /* nextSeriesName continues past one closing brace — pull until the next function */
  const nextFull = html.match(/function nextSeriesName\(names, fallback\)\{[\s\S]*?\n    return [^\n]+;\n  \}/);
  if (nextFull){
    const mk = new Function(split[0] + "\n" + series[0] + "\n" + nextFull[0] +
      "\nreturn { nextSeriesName };");
    const N = mk();
    console.log("auto-name of sections:");
    eq("empty list → sec1", N.nextSeriesName([], "sec1") === "sec1");
    eq("sec0 only → sec1", N.nextSeriesName(["sec0"], "sec1") === "sec1");
    eq("sec0+sec1 → sec2", N.nextSeriesName(["sec0","sec1"], "sec1") === "sec2");
  } else {
    eq("could extract nextSeriesName", false);
  }
}

/* Simulate the latch: a Samsung-style one-shot button=2 then buttons=0
   must leave the eraser ON. A real held bit (3+ downs) then clear turns it OFF. */
{
  const src = html.match(/function eraserButtonDown\(e\)\{[\s\S]*?\n  \}/);
  if (!src) { eq("could extract eraserButtonDown", false); }
  else {
    const F = new Function(src[0] + "; return eraserButtonDown;");
    const down = F();
    const latch = { n: 0, on: false };
    function feed(e){
      const d = down(e);
      if (d){ latch.n += 1; latch.on = true; }
      else if (latch.on && latch.n >= 3){ latch.n = 0; latch.on = false; }
    }
    console.log("S Pen sequences, simulated:");
    latch.n = 0; latch.on = false;
    feed({ pointerType:"pen", buttons:2, button:2 });
    feed({ pointerType:"pen", buttons:0, button:-1 });
    feed({ pointerType:"pen", buttons:0, button:-1 });
    eq("Samsung one-shot press stays ON", latch.on === true);

    latch.n = 0; latch.on = false;
    feed({ pointerType:"pen", buttons:4, button:1 });
    feed({ pointerType:"pen", buttons:4, button:-1 });
    feed({ pointerType:"pen", buttons:4, button:-1 });
    feed({ pointerType:"pen", buttons:1, button:-1 });
    eq("sustained middle-button then clear turns OFF", latch.on === false);

    /* b125 split "is the button down" from "is this end erasing". A lasting
       erase state (the renamed pointer, or bit 32) must NOT answer the
       every-event question, or each nib-down reads as another press — that was
       the "press it then touch the screen and it changes back" bug. Entering
       that state is the press, counted once. penbutton.mjs owns this area now
       and simulates it properly in both directions. */
    latch.n = 0; latch.on = false;
    feed({ pointerType:"eraser", buttons:1, button:0 });
    eq("a nib-down that merely calls itself an eraser is not a press",
       latch.on === false);

    latch.n = 0; latch.on = false;
    feed({ pointerType:"mouse", buttons:2, button:2 });
    eq("button 2 on a non-pen still counts as down", down({ pointerType:"mouse", buttons:2, button:2 }) === true);
  }
}

console.log("S Pen button: ten doors, no flash-off:");
eq("1 bits 2/4 are the button; 32 is erase mode, handled as a state",
   has(/if \(b & 2\)/) && has(/if \(b & 4\)/) &&
   has(/function penInEraseMode\(e\)\{/) && has(/& 32\)/));
eq("2 pointerType eraser", has(/e\.pointerType === "eraser"/));
eq("3 coalesced events scanned", has(/e\.getCoalescedEvents/));
eq("4 pointerrawupdate listened", has(/"pointerrawupdate"/));
eq("5 auxclick", has(/window\.addEventListener\("auxclick"/));
eq("6 mouseup releases if it really reports the button", has(/document\.addEventListener\("mouseup"/));
eq("7 keydown ContextMenu / Unidentified", has(/k === "ContextMenu"/));
eq("8 contextmenu still arms the hold", has(/if \(cfg\.penButtonErase !== false\) btnEraseToggle\(\);/));
eq("9 mousedown button 2 still arms", has(/e\.preventDefault\(\);\s*\n    btnEraseToggle\(\);/));
eq("10 a single bit-then-zero does NOT release", has(/bitLatch\.n >= 3/));
eq("lifting the nib does NOT turn the latch off",
   has(/if \(btnSpring\.holdMode\) btnEraseOff\(\);/));

console.log("scroll does not pick up a picture:");
eq("unselected picture allows vertical pan",
   has(/#body figure\.imgblock, #pracText figure\.imgblock\{touch-action:pan-y\}/));
eq("selected picture takes the pointer",
   has(/#body figure\.imgblock\.on, #pracText figure\.imgblock\.on\{touch-action:none/));
eq("a finger on an unselected picture waits",
   has(/if \(e\.pointerType === "touch" && !fig\.classList\.contains\("on"\)\)/));
eq("a vertical move cancels the pick",
   has(/if \(Math\.abs\(pdy\) >= Math\.abs\(pdx\)\)\{ imgPend = null; return; \}/));
eq("only a tap with no move selects",
   has(/if \(Math\.abs\(e\.clientX - pend\.x\) \+ Math\.abs\(e\.clientY - pend\.y\) < 10\)/));

console.log("rough working is a real page:");
eq("it uses the same ruling as the note",
   has(/\["paper", "pracPaper"\]\.forEach/) && has(/\.paper\.prac\{background:var\(--ground\)\}/));
eq("pictures can be pasted onto it",
   has(/\$\("pracText"\)\.addEventListener\("paste"/));
eq("insertImageFile writes into whichever host is active",
   has(/function activeTextHost\(\)/));
eq("hydrateImages looks in both hosts",
   has(/#body figure\.imgblock, #pracText figure\.imgblock/));

console.log("first scroll into a neighbour is pre-sized:");
eq("ink depth is remembered to disk", has(/C\.setMeta\("pageInkDepth", pageInkDepth\)/));
eq("it is loaded on boot", has(/C\.getMeta\("pageInkDepth"/));
eq("a page opens already at that height",
   has(/pageInkDepth\[state\.note\.id\] != null/));
eq("neighbours are still warmed", has(/function warmNeighbourInk\(\)/));

process.exitCode = bad ? 1 : 0;
