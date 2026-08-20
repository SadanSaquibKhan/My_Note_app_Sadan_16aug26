var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");
var names = ["splitSeries", "seriesName", "renumberPlan", "sortPages"];
var src = names.map(function(fn){
  var re = new RegExp("\\n  function " + fn + "\\([\\s\\S]*?\\n  \\}");
  var m = html.match(re);
  if (!m) { console.log("MISSING " + fn); process.exit(1); }
  return m[0];
}).join("\n");
var api = new Function(src + "\n return {" + names.join(",") + "};")();

function eq(label, got, want){
  var ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  ok   " : "  FAIL ") + label + "\n         got  " + JSON.stringify(got) +
              (ok ? "" : "\n         want " + JSON.stringify(want)));
  if (!ok) process.exitCode = 1;
}
function titles(l){ return l.map(function(n){ return n.title; }); }

/* p1..p4 made in order, then a page inserted after p2.
   The insert renames p3->p4 and p4->p5, then creates a new "p3" LAST,
   so its createdAt is the newest of all. */
var afterInsert = [
  { title:"p1", createdAt:100 },
  { title:"p2", createdAt:200 },
  { title:"p4", createdAt:300 },   /* was p3 */
  { title:"p5", createdAt:400 },   /* was p4 */
  { title:"p3", createdAt:900 }    /* the newly inserted one */
];
console.log("scroll order after inserting between p2 and p3:");
eq("follows the numbers", titles(api.sortPages(afterInsert)),
   ["p1","p2","p3","p4","p5"]);

console.log("old behaviour, for contrast:");
var byCreated = afterInsert.slice().sort(function(a,b){ return a.createdAt-b.createdAt; });
console.log("         createdAt order was " + JSON.stringify(titles(byCreated)) +
            "  <- p3 stranded at the end");

console.log("other cases:");
eq("double digits sort numerically",
   titles(api.sortPages([{title:"p10",createdAt:1},{title:"p9",createdAt:2},{title:"p2",createdAt:3}])),
   ["p2","p9","p10"]);
eq("unnumbered pages keep creation order, after the numbered",
   titles(api.sortPages([
     { title:"Notes",  createdAt:500 },
     { title:"p2",     createdAt:200 },
     { title:"Aside",  createdAt:100 },
     { title:"p1",     createdAt:300 }
   ])),
   ["p1","p2","Aside","Notes"]);
eq("zero padded",
   titles(api.sortPages([{title:"p03",createdAt:1},{title:"p01",createdAt:2}])),
   ["p01","p03"]);
eq("empty list", api.sortPages([]), []);
eq("input not mutated", (function(){
  var a = [{title:"p2",createdAt:1},{title:"p1",createdAt:2}];
  api.sortPages(a);
  return titles(a);
})(), ["p2","p1"]);
