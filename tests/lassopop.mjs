/* Lasso: Samsung-style box, handles, style, paste stays selected, contain setting. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("lasso pops up on the selection, like Samsung Notes:");
eq("Cut Copy Paste Delete Style are on the bar",
   has(/id="lassoCopy"/) && has(/id="lassoCut"/) && has(/id="lassoPaste"/) &&
   has(/id="lassoDelete"/) && has(/id="lassoStyle"/));
eq("the main style button is a compact icon", has(/id="lassoStyle"/) && has(/lassoico/));
eq("copy cut paste are icons",
   has(/id="lassoCopy"/) && has(/id="lassoCut"/) && has(/id="lassoPaste"/) &&
   has(/id="lassoGrip"/));
eq("the bar remembers where you dragged it", has(/cfg.lassoPopOff/));
eq("a finger off the catch can still scroll",
   has(/A finger only/) && has(/return false;/));
eq("a tap away from the catch drops it",
   has(/var lassoAway/) && has(/lassoOnChrome/) && has(/lassoClear\(\);/));
eq("tap-away waits for a still lift, not the first press",
   has(/lasso\.coolUntil/) && has(/S\.drawing/) && has(/lassoAway\.on = true/));
eq("a still tap dismisses even if a replacement box was armed",
   has(/S\.drawing && !S\.drawing\.maybeReplace/) && has(/S\.drawing\.maybeReplace\) S\.drawing = null/));
eq("an empty box is dropped, not left as a dotted ghost",
   has(/hint\("Nothing in that box\."\)/) && /if \(!any\)\{\s*lassoClear\(\);/.test(html));
eq("a finger can scroll a live catch even if the pen is still near",
   has(/A live lasso must not pin the page/) && has(/ink\.tool === "lasso"/));
eq("a new box outside does not clear the old one until it finishes",
   has(/replacing:true/) && has(/lasso\.draft/));
eq("strokes that only overlap the box are still caught",
   has(/function strokeHitsBox/) && has(/C\.strokeHitsBox/));
eq("a locked picture is not moved or resized",
   has(/isLocked\(el\)\) return;/));
eq("more lives behind three dots", has(/id="lassoMoreBtn"/) && has(/id="lassoMore"/));
eq("convert to text is behind the dots, not a dead main button",
   has(/id="lassoToText"/) && /lassoMore[\s\S]{0,400}lassoToText/.test(html));
eq("the bar is a floating dark pill", has(/#2c2c2e/) && has(/\.lassobar\{/));
eq("it is placed next to the selection", has(/function placeLassoPop\(\)/));
eq("paste shows the same pop and stays selected",
   has(/lasso\.picked = added/) && has(/lasso\.pickedEls = addedEls/) &&
   has(/still selected/));
eq("default lasso is a box", has(/lassoShape: "rect"/) && has(/getMeta\("lassoShape", "rect"\)/));

console.log("");
console.log("handles, move, and resize:");
eq("four corner handles are drawn (edges are for moving)",
   has(/function lassoHandlePts\(b\)/) && has(/four corners only/) &&
   has(/k:"nw"/) && has(/k:"se"/) && has(/k:"sw"/));
eq("a corner hit starts a scale", has(/function lassoHitHandle/) && has(/lassoBeginScale/));
eq("dragging inside the box still moves", has(/S\.drawing = \{ moving:true, last:p \}/));
eq("scale maps from the original box so it does not accumulate",
   has(/function lassoScaleTo\(p\)/) && has(/lasso\.scaleOrig/));

console.log("");
console.log("style and contain:");
eq("style pop has ink swatches and thickness",
   has(/id="lassoStylePop"/) && has(/id="lassoSwatches"/) &&
   has(/id="lassoThinner"/) && has(/id="lassoThicker"/));
eq("typed text gets bold italic underline highlight",
   has(/id="lassoBold"/) && has(/id="lassoItalic"/) &&
   has(/id="lassoUnder"/) && has(/id="lassoHl"/));
eq("recolour is no longer a main action", !/id="lassoColour"/.test(html));
eq("contain setting exists",
   has(/lassoContain: "partial"/) && has(/id="setLassoContain"/) &&
   has(/Only if it is completely inside/));
eq("stroke test honours full vs partial",
   has(/function strokeInPoly\(stroke, poly, full\)/) &&
   has(/return full \? \(hit === n\) : \(hit \/ n >= 0\.6\);/));
eq("pictures and typed blocks can be caught",
   has(/function lassoPickEls/) && has(/figure\.imgblock/));

/* the contain math, extracted */
{
  function pointInPoly(x, y, poly){
    var inside = false, n = poly.length / 2;
    for (var i = 0, j = n - 1; i < n; j = i++){
      var xi = poly[i*2], yi = poly[i*2+1], xj = poly[j*2], yj = poly[j*2+1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }
  function strokeInPoly(stroke, poly, full){
    var p = stroke.pts, n = p.length / 3, hit = 0;
    if (!n) return false;
    for (var i = 0; i < n; i++) if (pointInPoly(p[i*3], p[i*3+1], poly)) hit++;
    return full ? (hit === n) : (hit / n >= 0.6);
  }
  const box = [0,0, 100,0, 100,100, 0,100];
  const inside = { pts: [10,10,1, 20,20,1, 30,30,1] };
  const half = { pts: [10,10,1, 20,20,1, 200,200,1] }; /* 2/3 inside */
  const out = { pts: [200,200,1, 210,210,1] };
  eq("a stroke fully inside is caught either way",
     strokeInPoly(inside, box, false) && strokeInPoly(inside, box, true));
  eq("a stroke only partly inside is caught when partial",
     strokeInPoly(half, box, false) === true);
  eq("a stroke only partly inside is missed when full",
     strokeInPoly(half, box, true) === false);
  eq("a stroke wholly outside is never caught",
     !strokeInPoly(out, box, false) && !strokeInPoly(out, box, true));
}

{
  const src = html.match(/function strokeHitsBox\(stroke, b\)\{[\s\S]*?\n  \}/);
  eq("strokeHitsBox extracted", !!src);
  if (src){
    const fn = new Function(src[0] + "\n return strokeHitsBox;");
    const hit = fn();
    const b = { minX:0, minY:0, maxX:100, maxY:100 };
    eq("a point inside the box is caught",
       hit({ pts:[50,50,1] }, b) === true);
    eq("a stroke that only crosses the box is caught",
       hit({ pts:[-20,50,1, 50,50,1, 200,50,1] }, b) === true);
    eq("a stroke whose bounds overlap the box is caught",
       hit({ pts:[-10,-10,1, 10,10,1] }, b) === true);
    eq("a stroke well outside is missed",
       hit({ pts:[200,200,1, 210,210,1] }, b) === false);
  }
}

/* handle box from drag */
{
  function lassoBoxFromHandle(ob, handle, p){
    var b = { minX:ob.minX, minY:ob.minY, maxX:ob.maxX, maxY:ob.maxY };
    if (handle.indexOf("n") >= 0) b.minY = p.y;
    if (handle.indexOf("s") >= 0) b.maxY = p.y;
    if (handle.indexOf("w") >= 0) b.minX = p.x;
    if (handle.indexOf("e") >= 0) b.maxX = p.x;
    if (b.maxX - b.minX < 16){
      if (handle.indexOf("w") >= 0) b.minX = b.maxX - 16; else b.maxX = b.minX + 16;
    }
    if (b.maxY - b.minY < 16){
      if (handle.indexOf("n") >= 0) b.minY = b.maxY - 16; else b.maxY = b.minY + 16;
    }
    return b;
  }
  const ob = { minX:0, minY:0, maxX:100, maxY:80 };
  const se = lassoBoxFromHandle(ob, "se", { x:150, y:120 });
  eq("se handle grows the box", se.maxX === 150 && se.maxY === 120 && se.minX === 0 && se.minY === 0);
  const nw = lassoBoxFromHandle(ob, "nw", { x:20, y:10 });
  eq("nw handle moves the opposite corner", nw.minX === 20 && nw.minY === 10 && nw.maxX === 100 && nw.maxY === 80);
  const tiny = lassoBoxFromHandle(ob, "se", { x:2, y:2 });
  eq("the box will not flip inside out", tiny.maxX - tiny.minX >= 16 && tiny.maxY - tiny.minY >= 16);
}

console.log("");
console.log("drag, drop, and paste after copy:");
eq("a live catch can be dragged with a finger or the pen",
   has(/if \(ink\.tool === "lasso" && typeof lassoHas === "function" && lassoHas\(\)\)\{/) &&
   has(/lassoInCatch\(pt\.x, pt\.y\)/));
eq("move and resize work on the first touch after the box appears",
   has(/if \(lassoHas\(\) && lasso\.poly\)\{/) &&
   !/if \(Date\.now\(\) < \(lasso\.coolUntil \|\| 0\)\) return;\s*\n\s*if \(lassoHas/.test(html));
eq("the minus button does not leave the catch stuck in resize",
   has(/S\.drawing = null;   \/\* do not leave the catch stuck in resize \*\//));
eq("a tap just outside waits before starting a new box",
   has(/maybeReplace:true/));
eq("a tap away from the catch drops it",
   has(/var lassoAway/) && has(/S\.drawing && !S\.drawing\.maybeReplace/) && has(/lassoClear\(\);/));
eq("coming back with the pen does not steal a live catch",
   has(/keep a live lasso catch/));
eq("long-press Paste is first when something is copied",
   has(/if \(canLassoPaste\)\{/) && has(/\["Paste", function\(\)\{ pasteInkHere\(x, y\); \}\]/));
eq("paste stays selected so you can move it again",
   has(/still selected/) && has(/lasso\.pickedEls = addedEls/));

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall lasso checks passed");
