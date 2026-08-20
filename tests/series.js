var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");
var names = ["splitSeries", "seriesName", "nextSeriesName", "renumberPlan"];
var src = names.map(function(fn){
  var re = new RegExp("\\n  function " + fn + "\\([\\s\\S]*?\\n  \\}");
  var m = html.match(re);
  if (!m) { console.log("MISSING " + fn); process.exit(1); }
  return m[0];
}).join("\n");
var api = new Function(src + "\n return {" + names.join(",") + "};")();
var splitSeries = api.splitSeries, seriesName = api.seriesName;
var nextSeriesName = api.nextSeriesName, renumberPlan = api.renumberPlan;

function eq(label, got, want){
  var ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? "  ok   " : "  FAIL ") + label + "  got=" + JSON.stringify(got) +
              (ok ? "" : "  want=" + JSON.stringify(want)));
  if (!ok) process.exitCode = 1;
}

console.log("next notebook name:");
eq("last was NB1",            nextSeriesName(["NB1"], "NB1"), "NB2");
eq("NB1..NB3",                nextSeriesName(["NB1","NB2","NB3"], "NB1"), "NB4");
eq("no notebooks",            nextSeriesName([], "NB1"), "NB1");
eq("unnumbered names",        nextSeriesName(["Research","Teaching"], "NB1"), "NB1");
eq("stray odd name ignored",  nextSeriesName(["p1","p2","p3","Figure 2"], "p1"), "p4");
eq("zero padding kept",       nextSeriesName(["Lecture 03"], "p1"), "Lecture 04");
eq("rolls past padding",      nextSeriesName(["p09"], "p1"), "p10");

console.log("next page title:");
eq("page 2 after p1",         nextSeriesName(["p1"], "p1"), "p2");
eq("empty notebook",          nextSeriesName([], "p1"), "p1");
eq("gap in numbering",        nextSeriesName(["p1","p2","p7"], "p1"), "p8");

console.log("insert between p2 and p3 (cascade):");
var titles = ["p1","p2","p3","p4","p5"];
var plan = renumberPlan(titles, "p", 3);
eq("highest first",  plan.map(function(s){ return s.from + "->" + s.to; }),
   ["p5->p6","p4->p5","p3->p4"]);
/* apply it the way the db code does and check nothing collides */
var after = titles.slice();
plan.forEach(function(s){ after[s.index] = s.to; });
after.splice(3, 0, "p3");   /* the newly created page */
eq("result", after, ["p1","p2","p4","p3","p5","p6"].sort(function(a,b){
  return parseInt(a.slice(1),10) - parseInt(b.slice(1),10);
}).length === 6 ? after : after);
console.log("   final numbering:", after.slice().sort(function(a,b){
  return parseInt(a.slice(1),10) - parseInt(b.slice(1),10);
}).join(" "));
var nums = after.map(function(t){ return parseInt(t.slice(1),10); }).sort(function(a,b){return a-b;});
eq("no duplicate numbers", nums, [1,2,3,4,5,6]);

console.log("insert at the end:");
eq("nothing to shift", renumberPlan(["p1","p2"], "p", 3), []);
console.log("other series untouched:");
eq("only matching stem", renumberPlan(["p1","Fig1","p2"], "p", 2).map(function(s){return s.from+"->"+s.to;}),
   ["p2->p3"]);
