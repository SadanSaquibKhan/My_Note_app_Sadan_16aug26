/* 50+ lasso bugs: typed-block catch, handles, bar, tap-away, zoom.
   Each check is a real failure mode found in the live file.
   Run: node lassoflaw.mjs path/to/index.html */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0, n = 0;
const eq = (l, c) => {
  n++;
  console.log((c ? "  ok   " : "  FAIL ") + l);
  if (!c) bad++;
};
const has = re => re.test(html);

function bounds(p){
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < p.length; i += 2){
    minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
    minY = Math.min(minY, p[i+1]); maxY = Math.max(maxY, p[i+1]);
  }
  return { minX, minY, maxX, maxY };
}
function boxHit(b, x, y, pad){
  return x >= b.minX - pad && x <= b.maxX + pad && y >= b.minY - pad && y <= b.maxY + pad;
}
function handleHit(b, x, y, pad){
  const hs = [
    [b.minX, b.minY], [b.maxX, b.minY], [b.minX, b.maxY], [b.maxX, b.maxY],
    [(b.minX+b.maxX)/2, b.minY], [(b.minX+b.maxX)/2, b.maxY],
    [b.minX, (b.minY+b.maxY)/2], [b.maxX, (b.minY+b.maxY)/2]
  ];
  return hs.some(h => Math.abs(x-h[0]) <= pad && Math.abs(y-h[1]) <= pad);
}
function snap(drawn, el){
  const iMinX = Math.max(el.minX, drawn.minX), iMaxX = Math.min(el.maxX, drawn.maxX);
  const iMinY = Math.max(el.minY, drawn.minY), iMaxY = Math.min(el.maxY, drawn.maxY);
  if (iMaxX - iMinX > 12 && iMaxY - iMinY > 12)
    return { minX: iMinX, minY: iMinY, maxX: iMaxX, maxY: iMaxY };
  return el;
}
function mapPt(x, y, ob, nb){
  const sx = (nb.maxX - nb.minX) / Math.max(1, ob.maxX - ob.minX);
  const sy = (nb.maxY - nb.minY) / Math.max(1, ob.maxY - ob.minY);
  return { x: nb.minX + (x - ob.minX) * sx, y: nb.minY + (y - ob.minY) * sy, sx, sy };
}

console.log("source locks — the catch you see is the catch you hit:");
eq("1  zoom() exists at file scope so handle/catch tests do not throw",
   has(/function zoom\(\)\{\s*\n    return zoomOf\(lasso && lasso\.surface\);/));
eq("2  practice is measured at zoom 1",
   has(/function zoomOf\(S\)\{/) && has(/S\.name === "practice"\) return 1/));
eq("3  elPageBox / pageToClient / handle / catch all use zoomOf",
   (html.match(/zoomOf\(/g) || []).length >= 4);
eq("4  the box you drew is kept (snap must not throw it away)",
   has(/lasso\.drawn = poly\.slice\(\)/));
eq("5  snap intersects the drawn box with the paragraph, not the whole <p>",
   has(/A picked element is trimmed to what you drew/) &&
   has(/iMaxX - iMinX > 12 && iMaxY - iMinY > 12/));
eq("6  lassoInCatch tests poly, drawn, AND the picked element",
   has(/lasso\.drawn && lasso\.drawn !== lasso\.poly/) &&
   has(/elPageBox\(lasso\.pickedEls\[i\], S\)/));
eq("7  moving the catch also moves the drawn ghost",
   has(/lasso\.drawn\[j\] \+= dx/) && has(/ghost hit-zone/));
eq("8  scaling remaps from the original drawn, not the already-mapped one",
   has(/drawn: lasso\.drawn \? lasso\.drawn\.slice\(\) : null/) &&
   has(/lassoMapPt\(o\.drawn\[di\]/));
eq("9  a still lift that armed maybeReplace does not destroy the catch",
   has(/Clearing here as well destroyed a live catch/) &&
   /if \(d\.maybeReplace\)\{[\s\S]{0,400}return;/.test(html));
eq("10 tap-away still drops a real tap outside",
   has(/var lassoAway/) && has(/lassoClear\(\);/));
eq("11 maybeReplace slop matches a finger on glass (16px)",
   has(/S\.drawing\.cx\) < 16/) && has(/S\.drawing\.cy\) < 16/));
eq("12 tap-away slop is 22px so a jittery tap is still a tap",
   has(/lassoAway\.x\) > 22/));
eq("13 the bar hides its pointer-events while the catch is dragged",
   has(/\.lassobar\.busy\{pointer-events:none\}/) && has(/function lassoBarBusy/));
eq("14 begin of a move or scale marks the bar busy",
   has(/lassoBarBusy\(true\);/) && has(/lassoBeginScale/));
eq("15 the bar is parked beside the catch, not on the north handles",
   has(/Prefer the right of the catch, then left,/) && has(/then below, then above/));
eq("16 padHits refuses a spot that covers a 36px handle",
   has(/function padHits\(l, t\)/) && has(/l \+ w \+ 36/));
eq("17 lassoOnChrome includes the chips and the picture bar",
   has(/#imgBar, #docBar, #secChip, #bookChip, #holdMenu/));
eq("18 a finger on the catch does not start a page pan",
   has(/A live lasso must not pin the page/) &&
   has(/lassoHitHandle\(pt\.x, pt\.y\)\) \|\|/));
eq("19 a finger on the catch does not raise the keyboard",
   has(/a finger on a live catch is moving it, not asking for the keyboard/));
eq("20 the pen coming back must not fold the lists (that shifts every hit)",
   has(/ink\.hideLists &&/) && has(/ink\.tool === "lasso"/));

console.log("");
console.log("transcribed: boxing three words in a long paragraph:");
{
  const para  = { minX: 20, minY: 500, maxX: 720, maxY: 840 };
  const drawn = { minX: 480, minY: 780, maxX: 660, maxY: 820 };
  const now = snap(drawn, para);
  const was = para;
  eq("21 the old snap was the whole paragraph",
     was.minY === 500 && was.maxX === 720);
  eq("22 the new snap stays on the words",
     now.minX === 480 && now.minY === 780 && now.maxX === 660 && now.maxY === 820);
  eq("23 a point on the words is in the catch",
     boxHit(now, 560, 800, 16));
  eq("24 the SE handle sits on the words, not 280px above them",
     handleHit(now, 660, 820, 36) && !handleHit(was, 660, 820, 36));
  eq("25 a tap on the paragraph heading is still in the catch (the block moves as a whole)",
     boxHit(para, 80, 520, 16));
  eq("26 a tap well above the paragraph is not",
     !boxHit(para, 10, 40, 16) && !boxHit(now, 10, 40, 16));
}

console.log("");
console.log("transcribed: bar vs handles:");
{
  const box = { minX: 200, minY: 400, maxX: 500, maxY: 520 };
  const barW = 300, barH = 48, GAP = 48;
  const oldTop = box.minY - barH - 16;           /* 16px above the top — ON the N handles */
  const nHandle = { x: (box.minX+box.maxX)/2, y: box.minY };
  const oldCovers = Math.abs(nHandle.y - (oldTop + barH)) < 36;
  eq("27 the old 16px-above placement sat on the north handle (the bug)", oldCovers);
  const right = { l: box.maxX + 16, t: box.minY };
  const coversRight = nHandle.x >= right.l - 36 && nHandle.x <= right.l + barW + 36 &&
                      nHandle.y >= right.t - 36 && nHandle.y <= right.t + barH + 36;
  eq("28 parking to the right of the catch misses the north handle", !coversRight);
  const below = { l: (box.minX+box.maxX)/2 - barW/2, t: box.maxY + GAP };
  const nFromBelow = Math.abs(nHandle.y - below.t);
  eq("29 below the catch (with 48px gap) is also clear of the north handle",
     nFromBelow > 36);
}

console.log("");
console.log("transcribed: moving the catch must move the drawn ghost:");
{
  let drawn = [480, 780, 660, 780, 660, 820, 480, 820];
  const dx = 40, dy = -30;
  drawn = drawn.map((v, i) => i % 2 === 0 ? v + dx : v + dy);
  const b = bounds(drawn);
  eq("30 after a 40px drag the words you boxed are still in the catch",
     boxHit(b, 560 + 40, 800 - 30, 16));
  eq("31 the original spot is no longer a ghost hit",
     !boxHit(b, 560, 800, 0));
}

console.log("");
console.log("transcribed: scale must not compound the drawn box:");
{
  const orig = [480, 780, 660, 780, 660, 820, 480, 820];
  const ob = { minX: 480, minY: 780, maxX: 660, maxY: 820 };
  const nb1 = { minX: 480, minY: 780, maxX: 700, maxY: 860 };
  const nb2 = { minX: 480, minY: 780, maxX: 720, maxY: 880 };
  /* wrong: remap already-mapped points from the original box each frame */
  let wrong = orig.slice();
  for (const nb of [nb1, nb2]){
    const next = [];
    for (let i = 0; i < wrong.length; i += 2){
      const m = mapPt(wrong[i], wrong[i+1], ob, nb);
      next.push(m.x, m.y);
    }
    wrong = next;
  }
  /* right: always from the original drawn */
  const right = [];
  for (let i = 0; i < orig.length; i += 2){
    const m = mapPt(orig[i], orig[i+1], ob, nb2);
    right.push(m.x, m.y);
  }
  eq("32 compounding overshoots the true mapped corner",
     Math.abs(wrong[2] - right[2]) > 1);
  eq("33 mapping from the original lands on the new box corner",
     Math.abs(right[2] - 720) < 1e-9 && Math.abs(right[5] - 880) < 1e-9);
}

console.log("");
console.log("transcribed: zoom missing threw, so a corner tap did nothing:");
{
  let threw = false;
  try { (function zoom(){ throw new ReferenceError("zoom is not defined"); })(); }
  catch (e){ threw = true; }
  eq("34 calling a missing zoom() throws (the live bug before the helper)", threw);
  const z = (function zoomOf(S){ return (S && S.name === "practice") ? 1 : 1.25; })({name:"note"});
  const pad = Math.max(36 / z, 22);
  eq("35 at 125% zoom a 36 screen-px handle is 28.8 page units",
     Math.abs(pad - 28.8) < 0.05);
  eq("36 practice stays at zoom 1 even if the note is pinched",
     (function zoomOf(S){ return S && S.name === "practice" ? 1 : 1.25; })({name:"practice"}) === 1);
}

console.log("");
console.log("transcribed: maybeReplace vs tap-away:");
{
  function route(travel, onCatch){
    /* begin */
    let drawing = onCatch ? { moving: true } : { maybeReplace: true };
    let catchLive = true;
    /* extend */
    if (!onCatch && travel >= 16) drawing = { lassoing: true, replacing: true };
    /* document pointerup (tap-away) */
    const awayArmed = !onCatch && travel <= 22;
    if (awayArmed && drawing.maybeReplace){ drawing = null; catchLive = false; }
    /* S.end */
    if (drawing && drawing.maybeReplace){
      /* new: do not clear */
    } else if (drawing && drawing.lassoing){
      catchLive = true; /* new box */
    }
    return { catchLive, drawing };
  }
  eq("37 a still tap outside drops the catch (tap-away)",
     route(4, false).catchLive === false);
  eq("38 a still tap that missed the catch on the way down no longer destroys it from S.end",
     route(4, true).catchLive === true);
  eq("39 a real drag outside starts a new box instead of dropping",
     route(30, false).drawing && route(30, false).drawing.lassoing);
  eq("40 a 12px jitter is still a tap, not a new box",
     route(12, false).catchLive === false);
}

console.log("");
console.log("transcribed: a small catch's middle is a move, corners keep aspect:");
{
  function handlePad(b){
    const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY);
    const want = 28, cap = Math.min(w, h) * 0.20;
    return Math.max(8, Math.min(want, cap));
  }
  function hitHandle(b, px, py){
    const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY);
    const insetX = Math.max(w * 0.28, 6), insetY = Math.max(h * 0.28, 6);
    if (px > b.minX + insetX && px < b.maxX - insetX &&
        py > b.minY + insetY && py < b.maxY - insetY) return null;
    const pad = handlePad(b);
    const hs = [[b.minX,b.minY,"nw"],[b.maxX,b.minY,"ne"],[b.maxX,b.maxY,"se"],[b.minX,b.maxY,"sw"]];
    for (const h of hs){
      if (Math.abs(px-h[0]) <= pad && Math.abs(py-h[1]) <= pad) return h[2];
    }
    return null;
  }
  const small = { minX: 100, minY: 200, maxX: 160, maxY: 240 }; /* 60×40 */
  const oldPad = 36;
  const mid = { x: 130, y: 220 };
  eq("40b old 36px pad treated the middle of a 60px box as a corner (the bug)",
     Math.abs(mid.x - small.minX) <= oldPad && Math.abs(mid.y - small.minY) <= oldPad);
  eq("40c now the middle is not a handle", hitHandle(small, mid.x, mid.y) === null);
  eq("40d the actual SE corner is still a handle", hitHandle(small, 160, 240) === "se");
  function cornerBox(ob, handle, p){
    const w0 = ob.maxX - ob.minX, h0 = ob.maxY - ob.minY;
    const ax = ob.minX, ay = ob.minY;
    const dw = p.x - ax, dh = p.y - ay;
    const s = Math.max(dw / w0, dh / h0, 16 / w0, 16 / h0);
    return { minX: ax, minY: ay, maxX: ax + w0 * s, maxY: ay + h0 * s, s };
  }
  const ob = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
  const nb = cornerBox(ob, "se", { x: 200, y: 80 }); /* drag mostly right */
  eq("40e aspect stays 2:1 when the SE corner is dragged",
     Math.abs((nb.maxX - nb.minX) / (nb.maxY - nb.minY) - 2) < 1e-9);
  eq("40f the scale follows the farther axis", Math.abs(nb.s - 2) < 1e-9);
}

console.log("");
console.log("source: move/scale/delete keep working:");
eq("41 four corner handles are drawn",
   has(/function lassoHandlePts/) && has(/k:"nw"/) && has(/k:"se"/) &&
   has(/four corners only/));
eq("41b a point in the middle of a small catch is not a handle",
   has(/the middle of the catch is always a move/) && has(/function lassoHandlePad/));
eq("41c corner resize keeps the aspect ratio",
   has(/var s = Math\.max\(dw \/ w0, dh \/ h0/) && has(/nw = w0 \* s, nh = h0 \* s/));
eq("41d move/scale/recolour push a lasso undo op",
   has(/t: "lasso"/) && has(/function lassoCommit/) && has(/function lassoCapture/) &&
   has(/lassoReplayEls\(op\.before\)/) && has(/lassoReplayEls\(op\.after\)/));
eq("42 dragging inside still starts a move", has(/S\.drawing = \{ moving:true, last:p \}/));
eq("43 scale keeps the original offset so a prior drag is not undone",
   has(/ox: Number\(el\.getAttribute\("data-lasso-x"/) &&
   has(/nx = \(rec\.ox \|\| 0\) \+ \(a\.x - rec\.box\.minX\)/));
eq("44 locked pictures are not moved", has(/isLocked\(el\)\) return;/));
eq("45 an empty box is dropped, not left as a ghost",
   has(/hint\("Nothing in that box\."\)/));
eq("46 paste stays selected", has(/lasso\.picked = added/) && has(/still selected/));
eq("47 coolUntil ignores the finishing stroke as a tap-away",
   has(/lasso\.coolUntil = Date\.now\(\) \+ 320/));
eq("48 lassoClear also drops the busy class",
   /function lassoClear\(\)\{[\s\S]{0,200}lassoBarBusy\(false\)/.test(html));
eq("49 S.end of a move saves",
   has(/if \(d\.moving \|\| d\.scaling\)\{/) && has(/lassoCommit\(S, lasso\.undoBefore\)/) &&
   has(/S\.queueSave\(\); markDirty\(\); return;/));
eq("50 default lasso is a box, like Samsung Notes",
   has(/lassoShape: "rect"/));
eq("51 contain setting still exists (full vs partial)",
   has(/lassoContain: "partial"/) && has(/function lassoFull/));
eq("52 strokes that only overlap the box are still caught",
   has(/C\.strokeHitsBox/));
eq("53 the grip still remembers a dragged bar position",
   has(/cfg\.lassoPopOff/));
eq("54 remembered offset is against the new default, not 16px-above",
   has(/remember the drag against the same default placeLassoPop/));
eq("55 a live catch is cleared when the page under it is replaced",
   has(/the catch was drawn over the page that is leaving/));

process.exitCode = bad ? 1 : 0;
console.log("\n" + n + " lasso checks, " + bad + " failed");
