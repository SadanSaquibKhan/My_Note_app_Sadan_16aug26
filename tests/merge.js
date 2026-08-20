var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");

/* sortPages with conflict awareness, pulled from the file */
var names = ["splitSeries", "sortPages"];
var src = names.map(function(fn){
  var re = new RegExp("\\n  function " + fn + "\\([\\s\\S]*?\\n  \\}");
  var m = html.match(re);
  if (!m){ console.log("MISSING " + fn); process.exit(1); }
  return m[0];
}).join("\n");
var api = new Function(src + "\n return {" + names.join(",") + "};")();

function eq(l, got, want){
  var ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  ok   " : "  FAIL ") + l + "\n         got  " + JSON.stringify(got) +
              (ok ? "" : "\n         want " + JSON.stringify(want)));
  if (!ok) process.exitCode = 1;
}

/* the merge rule, transcribed from importBundle */
function conflicting(a, b){
  if (!a || !b) return false;
  if ((a.lastEdited || 0) === (b.lastEdited || 0)) return false;
  return (a.html || "") !== (b.html || "") || (a.title || "") !== (b.title || "");
}
function merge(mine, theirs, mode){
  var have = {}; mine.forEach(function(n){ have[n.id] = n; });
  var twinIndex = {};
  mine.forEach(function(n){
    if (n && n.conflictOf) twinIndex[n.conflictOf + "@" + (n.lastEdited || 0)] = true;
  });
  function twinAlreadyHere(x){ return !!twinIndex[x.id + "@" + (x.lastEdited || 0)]; }
  var out = mine.map(function(n){ return n; });
  var conflicts = 0;
  theirs.forEach(function(x){
    var m = have[x.id];
    if (!m){ out.push(x); return; }
    if (mode === "both" && !x.deletedAt && !m.deletedAt && conflicting(m, x) && !twinAlreadyHere(x)){
      var twin = {}; Object.keys(x).forEach(function(k){ twin[k] = x[k]; });
      twin.id = x.id + "_twin";
      twin.conflictOf = x.id;
      twin.title = (x.title || "untitled") + " (from " + (x.editedOn || "other") + ")";
      out.push(twin); conflicts++;
      return;
    }
    var take = (mode === "theirs") ? true
             : (mode === "mine" || mode === "both") ? false
             : (x.lastEdited || 0) > (m.lastEdited || 0);
    if (take) out = out.map(function(n){ return n.id === x.id ? x : n; });
  });
  return { notes: out, conflicts: conflicts };
}

var mine = [
  { id:"a", title:"p36", html:"<p>same</p>",      lastEdited:100, createdAt:1, editedOn:"laptop" },
  { id:"b", title:"p37", html:"<p>LAPTOP work</p>", lastEdited:200, createdAt:2, editedOn:"laptop" },
  { id:"c", title:"p38", html:"<p>only here</p>", lastEdited:300, createdAt:3, editedOn:"laptop" }
];
var theirs = [
  { id:"a", title:"p36", html:"<p>same</p>",      lastEdited:100, createdAt:1, editedOn:"tablet" },
  { id:"b", title:"p37", html:"<p>TABLET work</p>", lastEdited:150, createdAt:2, editedOn:"tablet" },
  { id:"d", title:"p39", html:"<p>tablet only</p>", lastEdited:400, createdAt:4, editedOn:"tablet" }
];

console.log("keep both:");
var r = merge(mine, theirs, "both");
eq("one conflict found", r.conflicts, 1);
var titles = api.sortPages(r.notes).map(function(n){ return n.title; });
eq("both copies of p37 survive, twin next to its original", titles,
   ["p36","p37","p37 (from tablet)","p38","p39"]);
var laptop = r.notes.filter(function(n){ return n.id === "b"; })[0];
eq("my copy untouched", laptop.html, "<p>LAPTOP work</p>");
var twin = r.notes.filter(function(n){ return n.conflictOf === "b"; })[0];
eq("their copy preserved verbatim", twin.html, "<p>TABLET work</p>");
eq("unique page from the other device came too",
   r.notes.some(function(n){ return n.id === "d"; }), true);
eq("identical page not duplicated",
   r.notes.filter(function(n){ return n.title.indexOf("p36") === 0; }).length, 1);

console.log("the other modes still discard one side, as they say they do:");
eq("newest keeps the laptop copy (200 > 150)",
   merge(mine, theirs, "newest").notes.filter(function(n){ return n.id==="b"; })[0].html,
   "<p>LAPTOP work</p>");
eq("theirs takes the tablet copy",
   merge(mine, theirs, "theirs").notes.filter(function(n){ return n.id==="b"; })[0].html,
   "<p>TABLET work</p>");
eq("mine keeps the laptop copy",
   merge(mine, theirs, "mine").notes.filter(function(n){ return n.id==="b"; })[0].html,
   "<p>LAPTOP work</p>");
eq("no mode ever loses a page", [
   merge(mine,theirs,"both").notes.length,
   merge(mine,theirs,"newest").notes.length,
   merge(mine,theirs,"theirs").notes.length
], [5,4,4]);

console.log("re-importing the same file twice must not pile up twins:");
var once = merge(mine, theirs, "both");
var twice = merge(once.notes, theirs, "both");
eq("second import adds no new twin", twice.conflicts, 0);
eq("still exactly one twin after two imports",
   twice.notes.filter(function(n){ return n.conflictOf === "b"; }).length, 1);
eq("nothing lost on the repeat import", twice.notes.length, once.notes.length);
