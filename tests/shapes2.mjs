/* Corner-counting shape classifier, developed against shapes drawn the way a
   hand actually draws them: wobbly, with rounded corners, and often not quite
   closed. Proven here before it goes anywhere near the app. */

function resample(pts, n){
  const P = [];
  for (let i = 0; i < pts.length; i += 3) P.push([pts[i], pts[i+1]]);
  const seg = [];
  let total = 0;
  for (let i = 1; i < P.length; i++){
    const d = Math.hypot(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1]);
    seg.push(d); total += d;
  }
  if (total <= 0) return P;
  const step = total / n, out = [P[0]];
  let acc = 0, i = 1, cur = 0;
  while (out.length < n && i < P.length){
    const d = seg[i-1];
    if (cur + d >= acc + step){
      const t = (acc + step - cur) / d;
      out.push([P[i-1][0] + (P[i][0]-P[i-1][0])*t, P[i-1][1] + (P[i][1]-P[i-1][1])*t]);
      acc += step;
    } else { cur += d; i++; }
  }
  return out;
}
function turning(P, k){
  const n = P.length, ang = new Array(n).fill(0);
  for (let i = 0; i < n; i++){
    const a = P[(i - k + n) % n], b = P[i], c = P[(i + k) % n];
    const v1 = Math.atan2(b[1]-a[1], b[0]-a[0]);
    const v2 = Math.atan2(c[1]-b[1], c[0]-b[0]);
    let d = v2 - v1;
    while (d > Math.PI) d -= 2*Math.PI;
    while (d < -Math.PI) d += 2*Math.PI;
    ang[i] = Math.abs(d);
  }
  return ang;
}
function corners(P, thresh){
  const n = P.length, k = Math.max(2, Math.round(n / 16));
  const ang = turning(P, k);
  const picked = [];
  for (let i = 0; i < n; i++){
    if (ang[i] < thresh) continue;
    let best = true;
    for (let j = -k; j <= k; j++){
      if (ang[(i + j + n) % n] > ang[i]) { best = false; break; }
    }
    if (!best) continue;
    if (picked.length && Math.min(
        Math.abs(i - picked[picked.length-1]),
        n - Math.abs(i - picked[picked.length-1])) < k) continue;
    picked.push(i);
  }
  /* first and last can be the same corner wrapped around */
  if (picked.length > 1){
    const f = picked[0], l = picked[picked.length-1];
    if (Math.min(Math.abs(l-f), n - Math.abs(l-f)) < k) picked.pop();
  }
  return picked.map(i => P[i]);
}
function classify(pts){
  const P = resample(pts, 64);
  if (P.length < 8) return null;
  let area2 = 0;
  for (let i = 0; i < P.length; i++){
    const j = (i+1) % P.length;
    area2 += P[i][0]*P[j][1] - P[j][0]*P[i][1];
  }
  const xs = P.map(p=>p[0]), ys = P.map(p=>p[1]);
  const w = Math.max(...xs)-Math.min(...xs), h = Math.max(...ys)-Math.min(...ys);
  const fill = Math.abs(area2/2) / Math.max(1, w*h);
  const cs = corners(P, 0.72);
  return { corners: cs.length, fill: +fill.toFixed(3), pts: cs, w, h };
}

/* --- drawing helpers: wobble, rounded corners, an unclosed gap --- */
let seed = 7;
const rnd = () => { seed = (seed*1103515245+12345) & 0x7fffffff; return seed/0x7fffffff - 0.5; };
function noisy(path, wob, gap){
  const out = [];
  const stop = gap ? Math.floor(path.length * 0.94) : path.length;
  for (let i = 0; i < stop; i++) out.push(path[i][0]+rnd()*wob, path[i][1]+rnd()*wob, 0.5);
  return out;
}
function seglist(a, b, n){
  const p = [];
  for (let i = 0; i <= n; i++) p.push([a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n]);
  return p;
}
function poly(corners, per){
  let p = [];
  for (let i = 0; i < corners.length; i++){
    p = p.concat(seglist(corners[i], corners[(i+1)%corners.length], per));
  }
  return p;
}
const circle = (cx,cy,r,n)=>{const p=[];for(let i=0;i<=n;i++){const t=i/n*2*Math.PI;p.push([cx+r*Math.cos(t),cy+r*Math.sin(t)]);}return p;};

const shapes = {
  "square":      poly([[0,0],[200,0],[200,200],[0,200]], 14),
  "rectangle":   poly([[0,0],[300,0],[300,160],[0,160]], 14),
  "rhombus":     poly([[150,0],[300,110],[150,220],[0,110]], 14),
  "triangle":    poly([[150,0],[300,220],[0,220]], 18),
  "circle":      circle(150,150,110,64),
  "line":        seglist([0,0],[320,90],40),
};

/* corners tell you how many sides; the area ratio tells you which of the
   shapes with that many corners it is */
function kindOf(r){
  const f = r.fill, c = r.corners;
  if (c === 3 && f > 0.34 && f < 0.64) return "triangle";
  if (c === 4 && f >= 0.78) return "rect";
  if (c === 4 && f > 0.34 && f < 0.64) return "rhombus";
  if (c <= 2 && f > 0.62 && f < 0.92) return "circle";
  if (c === 5 || c === 6) return null;      /* not a shape we tidy */
  return null;
}

let bad = 0;
const expect = { square:"rect", rectangle:"rect", rhombus:"rhombus",
                 triangle:"triangle", circle:"circle", line:null };
console.log("shape        wobble  gap   corners  fill    read as");
for (const [name, path] of Object.entries(shapes)){
  for (const [wob, gap] of [[4,false],[8,false],[8,true],[12,true]]){
    seed = 7;
    const r = classify(noisy(path, wob, gap));
    const got = name === "line" ? null : kindOf(r);
    const ok = got === expect[name];
    console.log(
      name.padEnd(12) + String(wob).padEnd(8) + String(gap).padEnd(6) +
      String(r.corners).padEnd(9) + String(r.fill).padEnd(8) + String(got) +
      (ok ? "" : "   <-- WRONG, expected " + expect[name]));
    if (!ok) bad++;
  }
}
/* handwriting must be left alone */
seed = 7;
const scrawl = [];
for (let i = 0; i < 70; i++) scrawl.push([i*4, 100 + Math.sin(i/2)*30 + Math.sin(i/6)*18]);
const sc = classify(noisy(scrawl, 3, false));
console.log("\nscribble      corners " + sc.corners + "  fill " + sc.fill +
            "  read as " + kindOf(sc));
if (kindOf(sc) !== null){ console.log("  <-- WRONG, handwriting must not be tidied"); bad++; }

console.log(bad ? "\n" + bad + " misread" : "\nevery shape read correctly");
process.exitCode = bad ? 1 : 0;
