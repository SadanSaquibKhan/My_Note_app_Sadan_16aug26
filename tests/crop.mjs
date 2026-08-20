/* Cropping on the page: dragging a handle must trim the sides that handle
   belongs to and nothing else, must never invert the rectangle, and must land
   on the right pixels when it is finally cut. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

/* --- the drag, transcribed from the pointermove handler --- */
const MIN = 0.08;
function drag(r, h, fx, fy){
  fx = Math.max(0, Math.min(1, fx));
  fy = Math.max(0, Math.min(1, fy));
  if (h.indexOf("w") > -1) r.l = Math.min(fx, 1 - r.r - MIN);
  if (h.indexOf("e") > -1) r.r = Math.min(1 - fx, 1 - r.l - MIN);
  if (h.indexOf("n") > -1) r.t = Math.min(fy, 1 - r.b - MIN);
  if (h.indexOf("s") > -1) r.b = Math.min(1 - fy, 1 - r.t - MIN);
  r.l = Math.max(0, r.l); r.r = Math.max(0, r.r);
  r.t = Math.max(0, r.t); r.b = Math.max(0, r.b);
  return r;
}
const fresh = () => ({ l: 0, t: 0, r: 0, b: 0 });
const show = r => `l=${r.l.toFixed(2)} t=${r.t.toFixed(2)} r=${r.r.toFixed(2)} b=${r.b.toFixed(2)}`;

console.log("the bottom-right corner, dragged towards the middle:");
{
  /* finger at 70% across, 60% down — so 30% off the right, 40% off the bottom */
  const r = drag(fresh(), "se", 0.70, 0.60);
  console.log("   " + show(r));
  eq("takes width off the right", Math.abs(r.r - 0.30) < 1e-9);
  eq("takes height off the bottom", Math.abs(r.b - 0.40) < 1e-9);
  eq("leaves the left alone", r.l === 0);
  eq("leaves the top alone", r.t === 0);
}

console.log("");
console.log("the top-left corner, dragged towards the middle:");
{
  const r = drag(fresh(), "nw", 0.20, 0.35);
  console.log("   " + show(r));
  eq("takes width off the left", Math.abs(r.l - 0.20) < 1e-9);
  eq("takes height off the top", Math.abs(r.t - 0.35) < 1e-9);
  eq("right and bottom untouched", r.r === 0 && r.b === 0);
}

console.log("");
console.log("an edge handle moves one side only:");
for (const [h, key, fx, fy, want] of [
  ["e", "r", 0.75, 0.5, 0.25],
  ["w", "l", 0.15, 0.5, 0.15],
  ["n", "t", 0.5, 0.10, 0.10],
  ["s", "b", 0.5, 0.80, 0.20]
]){
  const r = drag(fresh(), h, fx, fy);
  const others = ["l","t","r","b"].filter(k => k !== key);
  eq(`"${h}" trims ${key} by ${want} and nothing else`,
     Math.abs(r[key] - want) < 1e-9 && others.every(k => r[k] === 0));
}

console.log("");
console.log("it can never be crushed to nothing or turned inside out:");
{
  const r = fresh();
  drag(r, "e", 0.02, 0.5);                 /* drag the right edge past the left */
  console.log("   after dragging the right edge to 2%: " + show(r));
  eq("a sliver of width survives", 1 - r.l - r.r >= MIN - 1e-9);
  drag(r, "s", 0.5, 0.01);
  eq("a sliver of height survives", 1 - r.t - r.b >= MIN - 1e-9);
}
{
  /* trim the left in, then try to drag the right past it */
  const r = drag(fresh(), "w", 0.60, 0.5);
  drag(r, "e", 0.55, 0.5);
  console.log("   left at 0.60, right dragged to 0.55: " + show(r));
  eq("width stays positive", 1 - r.l - r.r >= MIN - 1e-9);
}
{
  const r = fresh();
  drag(r, "nw", -0.4, -0.4);               /* finger dragged off the picture */
  eq("dragging off the edge clamps to no trim", r.l === 0 && r.t === 0);
  drag(r, "se", 1.6, 1.6);
  eq("and the other way too", r.r === 0 && r.b === 0);
}

console.log("");
console.log("what actually gets cut, in pixels:");
{
  const W = 800, H = 600;
  const r = drag(fresh(), "se", 0.75, 0.50);      /* keep 3/4 wide, 1/2 tall */
  const cx = Math.round(r.l * W), cy = Math.round(r.t * H);
  const cw = Math.max(1, Math.round((1 - r.l - r.r) * W));
  const ch = Math.max(1, Math.round((1 - r.t - r.b) * H));
  console.log(`   source rect ${cw}x${ch} at (${cx},${cy}) of ${W}x${H}`);
  eq("starts at the top-left of the original", cx === 0 && cy === 0);
  eq("keeps three quarters of the width", cw === 600);
  eq("keeps half the height", ch === 300);
}
{
  const W = 1000, H = 1000;
  const r = drag(fresh(), "nw", 0.20, 0.10);
  drag(r, "se", 0.90, 0.70);
  const cx = Math.round(r.l * W), cy = Math.round(r.t * H);
  const cw = Math.round((1 - r.l - r.r) * W), ch = Math.round((1 - r.t - r.b) * H);
  console.log(`   source rect ${cw}x${ch} at (${cx},${cy}) of ${W}x${H}`);
  eq("offset follows the left/top trim", cx === 200 && cy === 100);
  eq("size follows both trims", cw === 700 && ch === 600);
}

console.log("");
console.log("the handles sit on the corners of what you are keeping:");
{
  const HANDLES = [["nw",0,0],["n",.5,0],["ne",1,0],["e",1,.5],
                   ["se",1,1],["s",.5,1],["sw",0,1],["w",0,.5]];
  const r = drag(fresh(), "se", 0.60, 0.80);
  const l = r.l*100, t = r.t*100, rr = r.r*100, b = r.b*100;
  const at = name => {
    const h = HANDLES.find(h => h[0] === name);
    return [l + (100-l-rr)*h[1], t + (100-t-b)*h[2]];
  };
  const [sx, sy] = at("se");
  eq("the corner you dragged follows your finger",
     Math.abs(sx - 60) < 1e-9 && Math.abs(sy - 80) < 1e-9);
  const [nx, ny] = at("nw");
  eq("the opposite corner stays put", nx === 0 && ny === 0);
  const [ex, ey] = at("e");
  eq("the right edge handle sits halfway down the kept part",
     Math.abs(ex - 60) < 1e-9 && Math.abs(ey - 40) < 1e-9);
}

console.log("");
console.log("the dimming polygon is well formed:");
{
  const r = { l: .1, t: .2, r: .3, b: .4 };
  const l = r.l*100, t = r.t*100, rr = r.r*100, b = r.b*100;
  const poly =
    "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%," +
    l + "% " + t + "%," + l + "% " + (100-b) + "%," +
    (100-rr) + "% " + (100-b) + "%," + (100-rr) + "% " + t + "%," +
    l + "% " + t + "%)";
  const pts = poly.slice(8, -1).split(",").map(s => s.trim());
  eq("ten points: outer square, then the hole, closed", pts.length === 10);
  eq("outer ring covers the whole picture",
     pts.slice(0,5).join("|") === "0% 0%|100% 0%|100% 100%|0% 100%|0% 0%");
  eq("hole starts and ends at the same point", pts[5] === pts[9]);
  eq("hole is the kept rectangle",
     pts[5] === "10% 20%" && pts[7] === "70% 60%");
  eq("every coordinate is a real number",
     pts.every(p => p.split(" ").every(n => isFinite(parseFloat(n)))));
}

console.log("");
console.log("wired into the page:");
eq("no separate crop view is left in the markup", !/cropdlg|id="cropBox"/.test(html));
eq("the overlay lives inside the picture", /fig\.appendChild\(box\)/.test(html));
eq("the resize grips step aside while cropping",
   /stripGrips\(fig\);\s*\/\* the resize grips/.test(html));
eq("the overlay is never written into the note",
   /el\.classList\.remove\("on", "missing", "cropping"\)/.test(html));
eq("leaving the picture ends the crop",
   /function deselectImage\(\)\{\s*if \(typeof endCrop === "function"\) endCrop\(\);/.test(html));
eq("the original bytes are kept once, for Uncrop",
   /if \(!asset\.orig\) patch\.orig = asset\.blob;/.test(html));
eq("the overlay swallows touches so the page cannot scroll",
   /crop\.box\.contains\(t\)/.test(html) && /\.cropwrap\{[^}]*touch-action:none/.test(html));

process.exitCode = bad ? 1 : 0;
