var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");
var names = ["trackVel", "glideDamp", "glideSpeed"];
var src = names.map(function(fn){
  var re = new RegExp("\\n  function " + fn + "\\([\\s\\S]*?\\n  \\}");
  var m = html.match(re);
  if (!m){ console.log("MISSING " + fn); process.exit(1); }
  return m[0];
}).join("\n");
var cfg = { glideSpeed: 100, glideStop: 50 };
var api = new Function("cfg", "nowMs", src + "\n return {" + names.join(",") + "};");

var clock = 0;
function nowMs(){ return clock; }
var A = api(cfg, nowMs);

function eq(l, cond){ console.log((cond ? "  ok   " : "  FAIL ") + l); if (!cond) process.exitCode = 1; }

/* a steady upward flick: 16px every 16ms => 1 px/ms */
var o = {};
clock = 0; A.trackVel(o, 100, 400);
for (var i = 1; i <= 10; i++){ clock = i * 16; A.trackVel(o, 100, 400 - i * 16); }
console.log("steady flick, 1px/ms upward:");
console.log("   vy =", o.vy.toFixed(3), " vx =", o.vx.toFixed(3));
eq("vy is negative (finger moved up)", o.vy < 0);
eq("vy magnitude near 1 px/ms", Math.abs(Math.abs(o.vy) - 1) < 0.25);
eq("vx stays ~0", Math.abs(o.vx) < 0.02);

/* a long pause then a lift must not register as a fling */
var p = {};
clock = 0; A.trackVel(p, 0, 0);
clock = 500; A.trackVel(p, 0, 5);      /* dt 500ms > 120ms guard */
console.log("slow drag then lift: vy =", (p.vy || 0).toFixed(3));
eq("no velocity from a stale sample", Math.abs(p.vy || 0) < 0.001);

/* damping: how far does it coast, and does the setting actually matter? */
function coast(v0, stop){
  cfg.glideStop = stop;
  var v = v0, dist = 0, ms = 0;
  for (var f = 0; f < 2000; f++){
    var dt = 16.67;
    v *= Math.pow(A.glideDamp(), dt / 16.67);
    dist += Math.abs(v) * dt; ms += dt;
    if (Math.abs(v) < 0.02) break;
  }
  return { px: Math.round(dist), ms: Math.round(ms) };
}
console.log("coast from 1px/ms:");
[0, 25, 50, 75, 100].forEach(function(s){
  var r = coast(1, s);
  console.log("   glideStop " + String(s).padStart(3) + " -> " + String(r.px).padStart(5) + "px over " + r.ms + "ms");
});
var slow = coast(1, 0), fast = coast(1, 100);
eq("higher setting coasts further", fast.px > slow.px * 3);
eq("lowest setting still stops quickly", slow.ms < 700);
eq("highest setting is not endless", fast.ms < 12000);

/* frame-rate independence: 120Hz must coast the same distance as 60Hz */
function coastAt(hz, stop){
  cfg.glideStop = stop;
  var v = 1, dist = 0, dt = 1000 / hz;
  for (var f = 0; f < 20000; f++){
    v *= Math.pow(A.glideDamp(), dt / 16.67);
    dist += Math.abs(v) * dt;
    if (Math.abs(v) < 0.02) break;
  }
  return dist;
}
var d60 = coastAt(60, 50), d120 = coastAt(120, 50);
console.log("distance 60Hz =", Math.round(d60), " 120Hz =", Math.round(d120));
eq("frame-rate independent (within 5%)", Math.abs(d60 - d120) / d60 < 0.05);

cfg.glideSpeed = 0;
eq("speed 0 disables the glide", A.glideSpeed() === 0);
