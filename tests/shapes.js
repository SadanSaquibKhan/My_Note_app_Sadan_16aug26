var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");
var names = ["detectShape", "inkBounds", "distToSeg", "simplify", "roundPts", "smoothPts"];
var src = names.map(function(fn){
  var re = new RegExp("\\n  function " + fn + "\\([\\s\\S]*?\\n  \\}");
  var m = html.match(re);
  if (!m){ console.log("MISSING " + fn); process.exit(1); }
  return m[0];
}).join("\n");
var A = new Function(src + "\n return {" + names.join(",") + "};")();

/* a hand-drawn stroke: the ideal path plus a wobble, sampled densely */
function jitter(seedRef){
  seedRef.s = (seedRef.s * 1103515245 + 12345) & 0x7fffffff;
  return (seedRef.s / 0x7fffffff - 0.5);
}
function draw(points, wob){
  var seed = { s: 42 }, out = [];
  points.forEach(function(p){
    out.push(p[0] + jitter(seed) * wob, p[1] + jitter(seed) * wob, 0.5);
  });
  return out;
}
function line(x0,y0,x1,y1,n){
  var p = [];
  for (var i=0;i<=n;i++) p.push([x0+(x1-x0)*i/n, y0+(y1-y0)*i/n]);
  return p;
}
function box(x,y,w,h,n){
  return line(x,y,x+w,y,n).concat(line(x+w,y,x+w,y+h,n), line(x+w,y+h,x,y+h,n), line(x,y+h,x,y,n));
}
function circle(cx,cy,r,n){
  var p=[]; for (var i=0;i<=n;i++){ var t=i/n*Math.PI*2; p.push([cx+r*Math.cos(t), cy+r*Math.sin(t)]); }
  return p;
}
function tri(x,y,s,n){
  return line(x,y+s, x+s/2,y, n).concat(line(x+s/2,y, x+s,y+s, n), line(x+s,y+s, x,y+s, n));
}

function pipeline(raw, smoothPct){
  /* exactly what S.end does: detection runs on the PLAIN simplified stroke */
  var plain = A.roundPts(A.simplify(raw, 0.6), 1);
  var smoothed = A.roundPts(A.simplify(A.smoothPts(raw, smoothPct/100), 0.6), 1);
  return { plain: plain, smoothed: smoothed };
}
function report(label, raw){
  var p = pipeline(raw, 20);
  var onPlain = A.detectShape(p.plain);
  var onSmoothed = A.detectShape(p.smoothed);
  console.log("  " + label.padEnd(26) +
              " plain=" + String(onPlain && onPlain.kind).padEnd(9) +
              " smoothed=" + String(onSmoothed && onSmoothed.kind));
  return { plain: onPlain && onPlain.kind, smoothed: onSmoothed && onSmoothed.kind };
}

console.log("what the detector sees (this is what the fix changed):");
var r1 = report("wobbly straight line",  draw(line(50,50,400,120,40), 5));
var r2 = report("wobbly circle",         draw(circle(200,200,90,60), 6));
var r3 = report("wobbly box",            draw(box(60,60,240,170,14), 6));
var r4 = report("wobbly triangle",       draw(tri(60,60,220,16), 6));
console.log("");
console.log("handwriting must NOT be tidied:");
var scrawl = [];
for (var i=0;i<60;i++) scrawl.push([50+i*3, 100 + Math.sin(i/2)*28 + Math.sin(i/7)*16]);
var r5 = report("cursive scribble", draw(scrawl, 3));

var fails = 0;
function want(label, got, expected){
  var ok = (got === expected);
  console.log((ok?"  ok   ":"  FAIL ") + label + "  got=" + got + " want=" + expected);
  if (!ok) fails++;
}
console.log("");
want("line stays a line",       r1.plain, "line");
want("circle stays a circle",   r2.plain, "circle");
want("box becomes a rect",      r3.plain, "rect");
want("triangle is detected",    r4.plain, "triangle");
want("scribble left alone",     r5.plain, null);

/* a squashed ellipse must not turn into a rectangle */
var oval = draw(circle(200,200,90,60).map(function(p){ return [p[0], 200 + (p[1]-200)*0.62]; }), 5);
var ro = A.detectShape(A.roundPts(A.simplify(oval, 0.6), 1));
want("oval is still a circle",  ro && ro.kind, "circle");
process.exitCode = fails ? 1 : 0;
