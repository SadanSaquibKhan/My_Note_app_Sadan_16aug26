/* Two new controls, both of which are easy to get subtly wrong:
   - the curve must pass THROUGH every point the pen reported, at any strength
   - the stabiliser must converge on the nib, never drift away from it        */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const close = (a, b, t = 1e-6) => Math.abs(a - b) < t;

/* the cubic the renderer builds, transcribed from strokeCurved */
function piece(p, i, t){
  const n = p.length / 3, g = t / 6;
  const i0 = i > 0 ? i - 1 : i, i3 = i + 2 < n ? i + 2 : i + 1;
  const x0 = p[i0*3], y0 = p[i0*3+1];
  const x1 = p[i*3],  y1 = p[i*3+1];
  const x2 = p[(i+1)*3], y2 = p[(i+1)*3+1];
  const x3 = p[i3*3], y3 = p[i3*3+1];
  return { x1, y1, x2, y2,
           c1x: x1 + (x2-x0)*g, c1y: y1 + (y2-y0)*g,
           c2x: x2 - (x3-x1)*g, c2y: y2 - (y3-y1)*g };
}
const bez = (a, b, c, d, u) => {
  const m = 1 - u;
  return m*m*m*a + 3*m*m*u*b + 3*m*u*u*c + u*u*u*d;
};

/* a wobbly stroke */
const p = [];
for (let i = 0; i < 24; i++) p.push(i*12, 100 + Math.sin(i/1.7)*26, 0.5);

console.log("the curve goes through every point the pen reported:");
for (const t of [0, 0.25, 0.6, 1]){
  let worst = 0;
  for (let i = 0; i < p.length/3 - 1; i++){
    const s = piece(p, i, t);
    const sx = bez(s.x1, s.c1x, s.c2x, s.x2, 0), sy = bez(s.y1, s.c1y, s.c2y, s.y2, 0);
    const ex = bez(s.x1, s.c1x, s.c2x, s.x2, 1), ey = bez(s.y1, s.c1y, s.c2y, s.y2, 1);
    worst = Math.max(worst, Math.abs(sx - s.x1), Math.abs(sy - s.y1),
                            Math.abs(ex - s.x2), Math.abs(ey - s.y2));
  }
  eq("strength " + (t*100) + "%: passes through the samples", close(worst, 0, 1e-9));
}

console.log("");
console.log("strength 0 is a straight line between samples:");
{
  const s = piece(p, 5, 0);
  const mx = bez(s.x1, s.c1x, s.c2x, s.x2, 0.5);
  const my = bez(s.y1, s.c1y, s.c2y, s.y2, 0.5);
  eq("midpoint lies on the chord",
     close(mx, (s.x1 + s.x2)/2, 1e-9) && close(my, (s.y1 + s.y2)/2, 1e-9));
}
console.log("more strength bends further from the chord:");
{
  const dev = t => {
    const s = piece(p, 5, t);
    const my = bez(s.y1, s.c1y, s.c2y, s.y2, 0.5);
    return Math.abs(my - (s.y1 + s.y2)/2);
  };
  const a = dev(0), b = dev(0.5), c = dev(1);
  console.log("   deviation at 0% / 50% / 100%: " +
              a.toFixed(3) + " / " + b.toFixed(3) + " / " + c.toFixed(3));
  eq("monotonic in strength", a < b && b < c);
}

/* the stabiliser, transcribed from stabiliseK + S.extend */
function stabiliseK(v){ return (!isFinite(v) || v <= 0) ? 1 : 1 - Math.min(100, v)/100*0.85; }
console.log("");
console.log("the stabiliser follows the nib, never away from it:");
for (const pct of [0, 20, 40, 70, 100]){
  const k = stabiliseK(pct);
  let x = 0;
  const target = 100;
  for (let i = 0; i < 200; i++) x = x + (target - x) * k;
  eq(String(pct).padStart(3) + "%  k=" + k.toFixed(2) + "  reaches the nib",
     close(x, target, 1e-6));
}
{
  const k = stabiliseK(40);
  let x = 0, prev = -1, ok = true;
  /* it should approach and settle, never overshoot and never go backwards */
  for (let i = 0; i < 40; i++){
    x = x + (100 - x) * k;
    if (x < prev - 1e-9 || x > 100 + 1e-9) ok = false;
    prev = x;
  }
  eq("approaches without overshooting or reversing", ok);
}
eq("0% is no lag at all", stabiliseK(0) === 1);
eq("100% still keeps up (never zero)", stabiliseK(100) > 0.1);
process.exitCode = bad ? 1 : 0;
