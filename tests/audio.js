var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");
var names = ["pageAtMoment", "offsetInAudio", "audioAt"];
var src = names.map(function(fn){
  var re = new RegExp("\\n  function " + fn + "\\([\\s\\S]*?\\n  \\}");
  var m = html.match(re);
  if (!m){ console.log("MISSING " + fn); process.exit(1); }
  return m[0];
}).join("\n");
var A = new Function(src + "\n return {" + names.join(",") + "};")();

function eq(l, got, want){
  var ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  ok   " : "  FAIL ") + l + "  got=" + JSON.stringify(got) +
              (ok ? "" : " want=" + JSON.stringify(want)));
  if (!ok) process.exitCode = 1;
}

/* a lecture recorded from 10:00:00, moving p1 -> p2 -> p3 */
var T = 1000000;
var audio = {
  noteId: "p1", startedAt: T, dur: 600,
  pages: [ {at:T, noteId:"p1"}, {at:T+120000, noteId:"p2"}, {at:T+300000, noteId:"p3"} ]
};
console.log("scrubbing the audio finds the page that was open then:");
eq("at the very start",        A.pageAtMoment(audio, T),          "p1");
eq("1 minute in",              A.pageAtMoment(audio, T + 60000),  "p1");
eq("just after turning to p2", A.pageAtMoment(audio, T + 120001), "p2");
eq("3 minutes in",             A.pageAtMoment(audio, T + 180000), "p2");
eq("6 minutes in",             A.pageAtMoment(audio, T + 360000), "p3");
eq("before it began falls back to the owner", A.pageAtMoment(audio, T - 5000), "p1");

console.log("a recording made before page tracking existed:");
var old = { noteId: "pX", startedAt: T, dur: 60 };
eq("falls back to its own page", A.pageAtMoment(old, T + 30000), "pX");
eq("empty track behaves the same",
   A.pageAtMoment({ noteId:"pY", startedAt:T, pages:[] }, T + 10), "pY");

console.log("writing -> audio offset still works:");
eq("written 2 minutes in", A.offsetInAudio(audio, T + 120000), 120);
eq("written before it started", A.offsetInAudio(audio, T - 5000), null);
eq("written long after it ended", A.offsetInAudio(audio, T + 900000), null);
