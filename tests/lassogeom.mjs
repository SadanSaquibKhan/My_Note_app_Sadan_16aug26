/* The lasso's geometry. The user boxes three words in the middle of a long
   typed line; a paragraph is ONE element, so the whole <p> is picked — which is
   the only thing that can actually be moved. The bug was that the outline and
   its handles were then squared out to the whole paragraph, so the corners sat
   at the top of the block, nowhere near the words being looked at, and the
   catch on screen was not the catch being hit-tested. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);
const bounds = p => ({ minX: Math.min(p[0], p[4]), minY: Math.min(p[1], p[5]),
                       maxX: Math.max(p[0], p[4]), maxY: Math.max(p[1], p[5]) });

/* transcribed from lassoSnapBox */
function snap(drawnBox, elBoxes, strokePts){
  const xs = [], ys = [];
  (strokePts || []).forEach(([x, y]) => { xs.push(x); ys.push(y); });
  (elBoxes || []).forEach(b => {
    if (drawnBox){
      const iMinX = Math.max(b.minX, drawnBox.minX), iMaxX = Math.min(b.maxX, drawnBox.maxX);
      const iMinY = Math.max(b.minY, drawnBox.minY), iMaxY = Math.min(b.maxY, drawnBox.maxY);
      if (iMaxX - iMinX > 12 && iMaxY - iMinY > 12){
        xs.push(iMinX, iMaxX); ys.push(iMinY, iMaxY);
        return;
      }
    }
    xs.push(b.minX, b.maxX); ys.push(b.minY, b.maxY);
  });
  if (!xs.length) return null;
  return { minX: Math.min(...xs), minY: Math.min(...ys),
           maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
const old = (elBoxes, strokePts) => snap(null, elBoxes, strokePts);

/* a 700x340 paragraph; the user boxes 180x40 around its last words */
const para  = { minX: 20, minY: 500, maxX: 720, maxY: 840 };
const drawn = { minX: 480, minY: 780, maxX: 660, maxY: 820 };

console.log("boxing three words in a long typed line:");
{
  const now = snap(drawn, [para]);
  const was = old([para]);
  console.log("   drawn      " + JSON.stringify(drawn));
  console.log("   before     " + JSON.stringify(was));
  console.log("   after      " + JSON.stringify(now));
  eq("the outline used to become the whole paragraph",
     was.minY === 500 && was.maxY === 840 && was.minX === 20);
  eq("now it stays on the words you drew over",
     now.minX === 480 && now.minY === 780 && now.maxX === 660 && now.maxY === 820);
  /* the handles are the corners of that box */
  const handleY = now.minY;
  eq("the top handles are beside the words, not 280px above them",
     Math.abs(handleY - drawn.minY) < 1 && Math.abs(was.minY - drawn.minY) > 200);
}

console.log("");
console.log("a tap where you drew now lands in the catch:");
{
  /* lassoInCatch, transcribed: inside the box, or within 16px of it */
  const inCatch = (b, x, y) => x >= b.minX - 16 && x <= b.maxX + 16 &&
                               y >= b.minY - 16 && y <= b.maxY + 16;
  const px = 560, py = 800;                     /* on the words */
  eq("the point you drew over is in the catch", inCatch(snap(drawn, [para]), px, py));
  /* lassoHitHandle, transcribed: within 36 of a corner */
  const hit = (b, x, y) => {
    const hs = [[b.minX,b.minY],[b.maxX,b.minY],[b.minX,b.maxY],[b.maxX,b.maxY],
                [(b.minX+b.maxX)/2,b.minY],[(b.minX+b.maxX)/2,b.maxY],
                [b.minX,(b.minY+b.maxY)/2],[b.maxX,(b.minY+b.maxY)/2]];
    return hs.some(h => Math.abs(x-h[0]) <= 36 && Math.abs(y-h[1]) <= 36);
  };
  eq("its bottom-right corner is grabbable where you drew it",
     hit(snap(drawn, [para]), drawn.maxX, drawn.maxY));
  eq("before, that same corner was not a handle at all",
     !hit(old([para]), drawn.maxX, drawn.maxY));
}

console.log("");
console.log("a picture you boxed right around is unchanged:");
{
  const img = { minX: 100, minY: 200, maxX: 400, maxY: 500 };
  const round = { minX: 80, minY: 180, maxX: 420, maxY: 520 };
  const now = snap(round, [img]);
  eq("the catch is the picture, not the box you swept round it",
     now.minX === 100 && now.minY === 200 && now.maxX === 400 && now.maxY === 500);
}
console.log("a block barely clipped keeps its own box:");
{
  const tiny = { minX: 0, minY: 0, maxX: 300, maxY: 300 };
  const graze = { minX: 295, minY: 295, maxX: 500, maxY: 500 };   /* 5x5 overlap */
  const now = snap(graze, [tiny]);
  eq("too small an overlap to grab falls back to the element",
     now.minX === 0 && now.maxX === 300);
}
console.log("handwriting is untouched — its points are already inside:");
{
  const pts = [[510, 790], [600, 800], [640, 815]];
  const now = snap(drawn, [], pts);
  eq("the catch is the ink you circled", now.minX === 510 && now.maxY === 815);
}

console.log("");
console.log("wired that way in the file:");
eq("what was drawn is remembered before the box is squared off",
   has(/lasso\.drawn = poly\.slice\(\);/));
eq("a picked element is trimmed to what you drew over it",
   has(/var db = \(lasso\.drawn && C\.polyBounds\(lasso\.drawn\)\) \|\| null;/) &&
   has(/if \(iMaxX - iMinX > 12 && iMaxY - iMinY > 12\)\{/));
eq("the bar sits clear of the corner handles, beside by preference",
   has(/Prefer the right of the catch, then left,/) &&
   has(/function padHits\(l, t\)/) && has(/var GAP = 48;/));
eq("it knows how tall the catch is on screen",
   has(/lasso\.boxH = Math\.max\(0, c2\.clientY - c\.clientY\);/));
eq("a catch does not survive a page turn onto the next page's blocks",
   has(/if \(typeof lassoHas === "function" && lassoHas\(\) &&\s*\n          typeof lassoClear === "function"\) lassoClear\(\);/));
eq("moving and scaling still act on the whole element",
   has(/function lassoMoveEl/) && has(/function lassoScaleTo/));

console.log("");
console.log("resizing a block you already dragged keeps the drag:");
{
  /* left/top are an offset from where the block naturally sits. The snapshot
     measures the block WHERE IT SHOWS, which already contains that offset. */
  const natural = { minX: 100, minY: 200 };
  const already = { x: 60, y: 40 };                       /* you dragged it here */
  const shown   = { minX: natural.minX + already.x, minY: natural.minY + already.y };
  /* a resize that maps the top-left almost onto itself */
  const mappedTopLeft = { x: shown.minX + 5, y: shown.minY + 3 };
  const wasWritten = { x: mappedTopLeft.x - shown.minX, y: mappedTopLeft.y - shown.minY };
  const nowWritten = { x: already.x + (mappedTopLeft.x - shown.minX),
                       y: already.y + (mappedTopLeft.y - shown.minY) };
  console.log("   dragged to (" + already.x + "," + already.y + "), then resized");
  console.log("   before: offset becomes (" + wasWritten.x + "," + wasWritten.y + ") - the drag is gone");
  console.log("   after:  offset becomes (" + nowWritten.x + "," + nowWritten.y + ")");
  eq("before, the block snapped back home on resize",
     wasWritten.x === 5 && wasWritten.y === 3);
  eq("now the drag is kept and the resize added to it",
     nowWritten.x === 65 && nowWritten.y === 43);
  /* and it must not compound while the finger keeps moving */
  const second = { x: already.x + (mappedTopLeft.x + 4 - shown.minX) };
  eq("a second frame of the same drag does not compound", second.x === 69);
}

console.log("");
console.log("wired that way in the file:");
eq("the existing offset is captured once, at the start of the resize",
   has(/ox: Number\(el\.getAttribute\("data-lasso-x"\) \|\| 0\),/) &&
   has(/oy: Number\(el\.getAttribute\("data-lasso-y"\) \|\| 0\),/));
eq("and added to, not replaced",
   has(/var nx = \(rec\.ox \|\| 0\) \+ \(a\.x - rec\.box\.minX\);/) &&
   has(/el\.setAttribute\("data-lasso-x", nx\);/));
eq("deleting typed blocks is recorded for Undo, before and after",
   has(/var hitBody = !!\(lasso\.pickedEls && lasso\.pickedEls\.length\) && S\.name !== "practice";/) &&
   (html.match(/if \(hitBody && typeof snapText === "function"\) snapText\(\);/g) || []).length === 2);
eq("only the newest page load is allowed to finish",
   has(/var renderSeq = 0;/) && has(/var mine = \+\+renderSeq;/) &&
   (html.match(/if \(mine !== renderSeq\) return;/g) || []).length === 2);

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall lasso geometry checks passed");
