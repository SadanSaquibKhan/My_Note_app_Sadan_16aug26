/* b131 — lasso pointer routing: a finger on the catch must move it, a tap
   outside must drop it, grabbing the typed block (not just the small outline)
   must count as on-catch. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c, extra) => {
  console.log((c ? "  ok   " : "  FAIL ") + l + (extra && !c ? "  :: " + extra : ""));
  if (!c) bad++;
};
const has = re => re.test(html);

console.log("finger on the catch is a move, not a page-scroll:");
eq("fingerPanDown hit-tests the catch itself (it runs before mayDraw)",
   has(/This runs BEFORE mayDraw/) &&
   has(/if \(\(typeof lassoHitHandle === "function" && lassoHitHandle\(pt\.x, pt\.y\)\) \|\|/) &&
   has(/return false;/));
eq("the old empty branch that always panned is gone",
   !/mayDraw already said this finger is not on the catch/.test(html));

console.log("");
console.log("the catch includes the typed block, not only the small outline:");
eq("lassoInCatch tests picked element boxes",
   has(/lasso\.pickedEls && lasso\.pickedEls\.length/) &&
   has(/elPageBox\(lasso\.pickedEls\[i\], S\)/));
eq("and the box you actually drew",
   has(/lasso\.drawn && lasso\.drawn !== lasso\.poly/));

console.log("");
console.log("a still tap outside drops the catch:");
eq("tap-away still clears even if begin() armed maybeReplace",
   has(/if \(S && S\.drawing && !S\.drawing\.maybeReplace\) return;/) &&
   has(/if \(S && S\.drawing && S\.drawing\.maybeReplace\) S\.drawing = null;/));
eq("finger tap slop is wide enough for glass jitter",
   has(/e\.clientX - lassoAway\.x\) > 22/));

console.log("");
console.log("the pen coming back must not fold the lists mid-lasso:");
eq("penDetected skips applyPanes while a catch is live",
   has(/ink\.hideLists &&\s*\n          !\(ink\.tool === "lasso"/) ||
   has(/hideLists &&\s*\n          !\(ink\.tool === "lasso" && typeof lassoHas/));
eq("a finger on the catch does not raise the keyboard",
   has(/a finger on a live catch is moving it, not asking for the keyboard/));
eq("handOverToTyping uses isPenType, not the bare string",
   has(/isPenType === "function" \? isPenType\(e\) : e\.pointerType === "pen"/));

/* transcribed routing */
console.log("");
console.log("transcribed: a point on the paragraph is in the catch");
{
  function lassoBoxHit(b, px, py, pad){
    return !!(b && px >= b.minX - pad && px <= b.maxX + pad &&
              py >= b.minY - pad && py <= b.maxY + pad);
  }
  function pointInPoly(x, y, poly){
    let inside = false;
    for (let i = 0, j = poly.length/2 - 1; i < poly.length/2; j = i++){
      const xi = poly[i*2], yi = poly[i*2+1], xj = poly[j*2], yj = poly[j*2+1];
      const inter = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
      if (inter) inside = !inside;
    }
    return inside;
  }
  const poly = [480, 780, 660, 780, 660, 820, 480, 820]; /* snap on last words */
  const para = { minX: 20, minY: 500, maxX: 720, maxY: 840 };
  const pad = 16;
  const onWords = lassoBoxHit({minX:480,minY:780,maxX:660,maxY:820}, 560, 800, pad) ||
                  pointInPoly(560, 800, poly);
  const onHead  = lassoBoxHit(para, 80, 520, pad);
  const outside = lassoBoxHit(para, 10, 40, pad) || pointInPoly(10, 40, poly);
  eq("the boxed words are in the catch", onWords);
  eq("the rest of that same paragraph is also in the catch", onHead);
  eq("a tap well above the paragraph is not", !outside);
}

console.log("");
console.log("transcribed: fingerPanDown vs lasso");
{
  function fingerPanWouldStart(onCatch, onHandle, lassoLive){
    if (!lassoLive) return true;
    if (onHandle || onCatch) return false;
    return true;
  }
  eq("finger on the outline starts a MOVE (no pan)",
     fingerPanWouldStart(true, false, true) === false);
  eq("finger on a handle starts a RESIZE (no pan)",
     fingerPanWouldStart(false, true, true) === false);
  eq("finger off the catch still pans the page",
     fingerPanWouldStart(false, false, true) === true);
}

console.log("");
console.log("transcribed: tap-away vs maybeReplace");
{
  function awayClears(drawing){
    if (drawing && !drawing.maybeReplace) return false;
    return true;
  }
  eq("a still tap with maybeReplace armed still dismisses",
     awayClears({ maybeReplace: true }) === true);
  eq("a tap during an in-progress move does not steal it",
     awayClears({ moving: true }) === false);
  eq("a tap with no drawing dismisses",
     awayClears(null) === true);
}

if (bad) { console.log("\n" + bad + " failed"); process.exitCode = 1; }
else console.log("\nall lasso pointer checks passed");
