/* The eraser gestures, the reserved picture box, and the swap re-anchor.
   All three are things that only misbehave on a device, so they are checked
   here against the source rather than by eye. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("holding the nib erases only while it is held:");
eq("the hold no longer toggles outright", !/penHold\.fired = true;\s*togglePenEraser/.test(html));
eq("it goes through holdEraseFired", has(/penHold\.fired = true;\s*holdEraseFired\(\);/));
eq("spring is the default, latch is the opt-out",
   has(/if \(cfg\.holdEraseMode === "latch"\)\{ togglePenEraser\("holding the nib down"\); return; \}/) &&
   has(/holdEraseMode: "spring"/));
/* b125: a bare pointerleave also fires when the pointer crosses from the
   canvas onto the page or a toolbar, and acting on that cancelled the hold
   half-way through a rub. Lifting the nib still ends it; leaving only counts
   when the pen has really gone. */
eq("lifting the nib ends it, and leaving only when the pen really went",
   has(/\["pointerup", "pointercancel"\]\.forEach/) &&
   has(/document\.addEventListener\("pointerleave"/) &&
   has(/if \(penNibOnGlass\(e\) \|\| penDown\) return;  \/\* still writing \*\//) &&
   has(/springEraseOff\(\);/));
eq("a finger cannot end it", has(/if \(e\.pointerType === "touch"\) return;\s*springEraseOff/));
eq("it restores the tool you were using, from the one shared memory",
   has(/var eraserReturn = null;/) && has(/ink\.tool = eraserReturn \|\| "pen";/) &&
   has(/function springEraseOff\(\)\{[\s\S]{0,220}?eraserOff\(\);/));
eq("it does nothing if the eraser is already on (no fighting the latch)",
   has(/if \(springErase\.on \|\| ink\.tool === "eraser"\) return;/));
eq("a stroke that has already travelled is writing, not a hold",
   has(/if \(d > 8 \|\| st\.pts\.length >= 9\)\{ clearPenHold\(\); return; \}/));
eq("a loop that comes back to the start still counts as writing",
   has(/penHold\.travel \+= Math\.sqrt/) && has(/if \(penHold\.travel > 10/));
eq("the mark made while holding still is taken back out",
   has(/S\.strokes = S\.strokes\.filter\(function\(x\)\{ return x\.id !== st\.id; \}\);\s*S\.drawing = \{ erasing: true, removed: \[\] \};/));
eq("the contextmenu route uses the same rule too",
   has(/if \(cfg\.holdErase !== false\) holdEraseFired\(\);/));
{
  function feed(moves){
    let travel = 0, x = 0, y = 0, lx = 0, ly = 0, armed = true;
    for (const m of moves){
      const dx = m[0] - lx, dy = m[1] - ly;
      travel += Math.sqrt(dx * dx + dy * dy);
      lx = m[0]; ly = m[1];
      if (travel > 10 || Math.abs(m[0] - x) > 10 || Math.abs(m[1] - y) > 10) armed = false;
    }
    return { travel, armed };
  }
  const hold = feed([[0,0],[1,0],[1,1],[0,1],[0,0]]);
  eq("jitter of a still nib stays a hold", hold.armed === true && hold.travel < 10);
  const oh = feed([[0,0],[8,0],[12,4],[8,8],[0,4],[0,0]]);
  eq("a small letter that returns home is writing", oh.armed === false && oh.travel > 10);
}

console.log("");
console.log("double-tap still latches, so the two gestures do not overlap:");
eq("the double-tap path is untouched", has(/cfg\.tapErase && S\.name === "note" && st\.pts\.length === 3/));
eq("its label says it stays on", has(/turn the eraser on and off \(stays on\)/));

console.log("");
console.log("the eraser's size, beside the eraser:");
eq("one set of bounds for everything", has(/var ER_MIN = 8, ER_MAX = 60;/));
eq("the Settings slider agrees with them",
   has(/id="setEraser" min="8" max="60"/));
eq("the old 'go to Settings' note is gone", !/Size is in Settings/.test(html));
eq("minus and plus step the size", has(/bumpEr\(-4\)/) && has(/bumpEr\(4\)/));
eq("the buttons stop at the ends", has(/minus\.disabled = v <= ER_MIN;/) && has(/plus\.disabled = v >= ER_MAX;/));
eq("changing it here updates the Settings slider too",
   has(/if \(\$\("setEraser"\)\) \$\("setEraser"\)\.value = v;/));
eq("a missing or silly stored value falls back to 22",
   has(/if \(!isFinite\(v\)\) v = 22;/));

console.log("");
console.log("the favourites bar:");
eq("buttons can go down to 10px", has(/id="setFavSize" min="10" max="72"/));
eq("icons are drawn, not typed", has(/function ico\(d\)\{/) && has(/class="favico"/));
{
  const m = html.match(/var FAV_ICONS = \{([\s\S]*?)\n  \};/);
  const keys = m ? [...m[1].matchAll(/^\s{4}([a-z]+):\s*ico\(/gm)].map(x => x[1]) : [];
  console.log("   " + keys.length + " icons: " + keys.join(" "));
  eq("every non-pen tool on the bar has one", keys.length >= 21);
  /* every FAV_ITEMS key that is not a coloured pen should have an icon */
  const items = html.match(/var FAV_ITEMS = \{([\s\S]*?)\n  \};/);
  const itemKeys = items ? [...items[1].matchAll(/^\s{4}([a-z]+):\s*\{/gm)].map(x => x[1]) : [];
  const missing = itemKeys.filter(k => !keys.includes(k));
  eq("no tool left with a text glyph: " + (missing.length ? missing.join(", ") : "none"),
     missing.length === 0);
}
eq("they take the button's colour", has(/stroke="currentColor"/));
eq("they scale with the button, not the system font", has(/\.favico\{width:58%; height:58%/));
eq("full screen is on the bar", has(/immerse: \{ label:/) && /"focus","immerse","lock"/.test(html));
eq("the same button turns it off again",
   has(/setImmerse\(document\.body\.getAttribute\("data-immerse"\) !== "1"\)/));
eq("it lights up while it is on",
   has(/else if \(k === "immerse"\) on = document\.body\.getAttribute\("data-immerse"\) === "1";/));
eq("hovering the pen over it explains it", has(/immerse: "Full screen: hides every bar/));
eq("the hover help reads data-help off the button",
   has(/b\.setAttribute\("data-help", favHelp\(key, it\)\);/) &&
   has(/el\.getAttribute\("data-help"\)/));

console.log("");
console.log("scrolling between pages:");
eq("a picture claims its height before its bytes arrive",
   has(/function reserveBox\(fig, w, h, im\)\{/) &&
   has(/im\.style\.aspectRatio = \(isFinite\(ar\) && ar > 0\) \? String\(ar\) : "";/));
eq("the shape is remembered on the figure, so a reload knows it too",
   has(/fig\.setAttribute\("data-ar", \(w \/ h\)\.toFixed\(4\)\)/));
eq("the live page uses it", has(/var im = reserveBox\(fig\);\s*\n      return C\.reviveAsset/));
eq("a neighbour's preview uses it too", has(/var im = reserveBox\(fig\);\s*\n      C\.getAsset/));
eq("the swap re-applies its anchor while the page is still short",
   has(/\(function settle\(\)\{/) &&
   has(/p\.scrollTop >= p\.scrollHeight - p\.clientHeight - 2/));
eq("it only re-applies when clamped, so it cannot fight your finger",
   has(/var short = p\.scrollTop < want - 2 &&/));
eq("it gives up rather than looping for ever", has(/if \(calm < 2 && tries < 16\)\{ requestAnimationFrame\(settle\); return; \}/));
eq("busy is cleared on every path out", has(/\}\)\(\);\s*\}\);\s*\}/) && has(/handover\.busy = false;\s*\}\)\(\);/));
eq("the per-scroll measuring happens once a frame",
   has(/var scrollTick = 0;/) && has(/scrollTick = requestAnimationFrame\(function\(\)\{/));

/* the settle loop's arithmetic, transcribed */
console.log("");
console.log("what the swap asks for, in numbers:");
{
  const settle = (pad, keepAt, scrollHeight, clientHeight) => {
    const want = Math.max(0, pad - keepAt);
    const max = Math.max(0, scrollHeight - clientHeight);
    return { want, got: Math.min(want, max), clamped: want > max };
  };
  /* A 1600px page on a 1200px screen, arriving near its foot. Both bands are
     full pages — that is what makes the scrolling continuous — so the whole
     scroller is three pages tall once everything has loaded. */
  const back = settle(1600, -900, 1600 * 3, 1200);
  console.log(`   back: want ${back.want}, reachable ${back.got}, clamped ${back.clamped}`);
  eq("with the page at full height the backward anchor is reachable", !back.clamped);
  const backShort = settle(1600, -900, 1600 + 400 + 400, 1200);
  console.log(`   back with the page still short: want ${backShort.want}, got ${backShort.got}`);
  eq("with pictures not yet loaded it is clamped — which is the jump", backShort.clamped);
  eq("and the difference is large enough to see", backShort.want - backShort.got > 300);
  /* going FORWARD: arriving near the top */
  const fwd = settle(1600, 1400, 1600 + 400 + 400, 1200);
  console.log(`   forward: want ${fwd.want}, got ${fwd.got}, clamped ${fwd.clamped}`);
  eq("the forward anchor is small and never clamps — which is why it looked fine", !fwd.clamped);
}

process.exitCode = bad ? 1 : 0;
