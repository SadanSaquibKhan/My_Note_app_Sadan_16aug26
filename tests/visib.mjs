/* b38: what is on screen when, the page-swap anchor, and the crop's manners.
   All three are things that only show up on a device, so they are pinned to
   the source here. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("the markup nests (the grey half-screen in b36 was a stray tag):");
eq("the crop panel's leftover closing tag is gone",
   !/<button class="ghost" id="imgDone">Done<\/button>\s*<\/div>\s*<\/div>/.test(html));

console.log("");
console.log("the favourites bar belongs to a page you are writing on:");
eq("there is one rule that decides it", has(/function favBarWanted\(\)\{/));
eq("not in the notebooks list", has(/if \(!state\.note \|\| state\.view !== "note"\) return false;/));
eq("shown when the lists are folded", has(/panelsHidden\(\) : true\) return true;/));
eq("also shown when a list is locked open while writing",
   has(/return !!\(cfg\.lockList \|\| cfg\.lockSec \|\| cfg\.lockRail\);/));
eq("the bar follows that rule", has(/var off = !favBarWanted\(\);/));
eq("and is rebuilt whenever the panels fold or unfold",
   has(/document\.body\.classList\.toggle\("panelsoff", off\);\s*\n    \/\* the favourites bar follows/));
eq("the minimised dot follows it too", has(/dot\.hidden = off \|\| cfg\.favMin !== true;/));

console.log("");
console.log("the note footer is the opposite: only with the panel open:");
eq("it is driven by the same measurement", has(/body\.panelsoff:not\(\.keepfoot\) \.docfoot\{display:none !important\}/));
eq("which asks the page rather than guessing from flags",
   has(/list\.offsetParent !== null && list\.offsetWidth > 0/));
eq("the default is not to keep it", has(/keepFoot: false/));

console.log("");
console.log("scrolling back holds still what you are looking at:");
eq("the block under the eye is noted before the band is emptied",
   html.indexOf('var srcBody = (dir < 0)') < html.indexOf('$("prevPeekBody").innerHTML = "";', html.indexOf('var srcBody')));
eq("it is the first block still on screen", has(/if \(kr\.bottom > pr\.top\)\{ aIdx = ki; aOff = kr\.top - pr\.top; break; \}/));
eq("the direction is recorded when the target is chosen",
   has(/anchorTop = nb\.top; dir = 1;/) && has(/anchorTop = pb\.top; dir = -1;/));
eq("it travels with the swap", has(/handover\.pending = \{ id: id, keepAt: keepAt, aIdx: aIdx, aOff: aOff, dir: dir \}/));
eq("and the same block is put back where it was",
   has(/var kid = \$\("body"\)\.children\[pend\.aIdx\];/));
eq("bounded, so a mismatch degrades rather than throws the page",
   has(/if \(Math\.abs\(d\) > 1 && Math\.abs\(d\) < 400\)\{/));
eq("skipped entirely when the block cannot be found", has(/if \(pend\.aIdx >= 0\)\{/) && has(/if \(kid\)\{/));
eq("it runs inside the settle loop, after the clamp resolves",
   html.indexOf("var kid = $(\"body\").children[pend.aIdx];") > html.indexOf("(function settle(){"));
eq("the incoming page is not emptied while it is still on screen",
   has(/Do not wipe the incoming page/) &&
   !/if \(\$\("nextPeekBody"\)\) \$\("nextPeekBody"\)\.innerHTML = "";/.test(html));
eq("a finger still dragging is not fought for sixteen frames",
   has(/Fighting the finger for sixteen frames is the shiver/) &&
   has(/if \(stillHeld\)\{/));

console.log("");
console.log("a previewed page lays out like the page:");
{
  const m = html.match(/a previewed page lays out exactly like the page([\s\S]*?)\n\n/);
  const n = m ? (m[1].match(/\.prevpeek-body /g) || []).length : 0;
  console.log("   " + n + " rules re-emitted for the bands");
  eq("the page's rules are given to both bands", n >= 45);
}
for (const [what, re] of [
  ["headings at the page's size, not 17px", /\.prevpeek-body h1, \.nextpeek-body h1\{font-size:24px/],
  ["lists (both ul and ol)", /\.prevpeek-body ul, \.nextpeek-body ul, \.prevpeek-body ol, \.nextpeek-body ol\{margin:0 0 var\(--lead\); padding-left:26px\}/],
  ["code blocks", /\.prevpeek-body pre, \.nextpeek-body pre\{/],
  ["quotes", /\.prevpeek-body blockquote, \.nextpeek-body blockquote\{/],
  ["callouts", /\.prevpeek-body \.callout, \.nextpeek-body \.callout\{/],
  ["tick lists", /\.prevpeek-body li\.todo, \.nextpeek-body li\.todo\{/],
  ["rules and captions", /\.prevpeek-body hr, \.nextpeek-body hr\{/],
]) eq("  " + what, re.test(html));

console.log("");
console.log("cropping cannot be knocked over by a hand on the glass:");
eq("only the pointer that started the drag moves it",
   has(/if \(e\.pointerId !== crop\.drag\.id\) return;/));
eq("a second pointer cannot start a second drag", has(/if \(crop\.drag\) return;\s*\/\* one pointer owns the drag \*\//));
eq("a resting palm does not tear the crop down",
   has(/if \(e\.pointerType === "touch" && \(ink\.penNear \|\| e\.isPrimary === false\)\) return;/));
eq("the tap that dismisses it leaves no ink",
   has(/e\.preventDefault\(\); e\.stopPropagation\(\);\s*\n    endCrop\(\);/));
eq("a cancelled pointer ends the drag too",
   has(/\["pointerup", "pointercancel"\]\.forEach/) && has(/crop\.drag && e\.pointerId === crop\.drag\.id/));

console.log("");
console.log("cropping cuts where it showed you it would:");
eq("the overlay covers the picture, not the caption under it",
   has(/crop\.box\.style\.height = pic \? \(pic\.offsetHeight \|\| 0\) \+ "px" : "";/));
eq("changing your mind mid-decode does not write the crop anyway",
   has(/var seq = crop\.seq;/) && has(/if \(seq !== crop\.seq\)\{ URL\.revokeObjectURL\(url\); return; \}/) &&
   has(/if \(seq !== crop\.seq\) return;\s*\n        if \(!b\)/));
eq("closing a crop abandons anything still in flight", has(/crop\.seq\+\+;\s*\/\* anything still in flight/));

console.log("");
console.log("a picture is still usable after it is cropped:");
eq("the corner grips come back once the picture is rebuilt",
   has(/addGrips\(pickedImage\.fig\);\s*\n        paintImgBar\(\);/));
eq("guarded against a stale selection from another page",
   has(/pickedImage\.fig\.isConnected && !crop\.on/));
eq("Uncrop can be pressed straight away", has(/paintImgBar\(\);          \/\* and Uncrop/));
eq("a page change lets go of the picture first",
   has(/if \(typeof deselectImage === "function"\) deselectImage\(\);\s*\n      \$\("body"\)\.innerHTML/));
eq("none of the overlay is ever printed", has(/\.cropwrap, \.imggrip\{display:none !important\}/));

/* the anchor arithmetic, transcribed from settle() */
console.log("");
console.log("the anchor's arithmetic:");
{
  const settle = (pad, keepAt, liveTopOfBlock, aOff) => {
    let want = Math.max(0, pad - keepAt);
    const d = liveTopOfBlock - aOff;
    if (d && Math.abs(d) < 900) want = Math.max(0, want + d);
    return want;
  };
  /* the preview rendered the blocks above your eye 180px shorter than the page
     does, so after the top-edge anchor the block you are watching sits 180px
     lower than it did */
  eq("a 180px accumulated difference is taken back out",
     settle(1600, -900, 380, 200) === 2500 + 180);
  eq("no difference means no correction", settle(1600, -900, 200, 200) === 2500);
  eq("a nonsense difference is ignored", settle(1600, -900, 1500, 200) === 2500);
  eq("it can never scroll to a negative place", settle(10, -0, 0, 800) >= 0);
}

process.exitCode = bad ? 1 : 0;
