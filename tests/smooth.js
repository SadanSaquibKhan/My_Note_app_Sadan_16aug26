var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");

/* pull smoothPts straight out of the file so we test the shipped code */
var m = html.match(/function smoothPts\(pts, strength\)\{[\s\S]*?\n  \}/);
if (!m) { console.log("could not find smoothPts"); process.exit(1); }
eval(m[0]);

function mk(n, jitter){
  var p = [];
  for (var i = 0; i < n; i++){
    /* a straight diagonal line plus alternating tremor */
    var w = (i % 2 ? jitter : -jitter);
    p.push(i * 4 + w, i * 4 - w, 0.5);
  }
  return p;
}
function wobble(p){
  /* mean deviation from the straight line y=x, i.e. how shaky the stroke is */
  var n = p.length / 3, s = 0;
  for (var i = 0; i < n; i++) s += Math.abs(p[i*3] - p[i*3+1]);
  return s / n;
}
var raw = mk(40, 3);
console.log("raw wobble          =", wobble(raw).toFixed(3));
[0, 10, 40, 70, 100].forEach(function(pct){
  var out = smoothPts(raw, pct/100);
  console.log("smooth " + String(pct).padStart(3) + "%  wobble =", wobble(out).toFixed(3),
              " len ok:", out.length === raw.length,
              " ends fixed:", out[0] === raw[0] && out[out.length-3] === raw[raw.length-3]);
});
/* guards */
console.log("null  ->", JSON.stringify(smoothPts(null, 0.5)));
console.log("short ->", JSON.stringify(smoothPts([0,0,1, 1,1,1], 0.5)));
console.log("strength 0 identical ->",
  JSON.stringify(smoothPts(raw, 0)) === JSON.stringify(raw));
var oob = smoothPts(raw, 5);
console.log("strength>1 clamped, finite ->", oob.every(function(v){ return isFinite(v); }));
