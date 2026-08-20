var fs = require("fs");
var lines = fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(Boolean);
var want = process.argv.slice(3);
lines.forEach(function(l){
  var o; try { o = JSON.parse(l); } catch(e){ return; }
  if (o.type !== "result") return;
  var v = o.result || o.value || o.output;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch(e){} }
  if (!v || !v.area) return;
  if (want.length && want.indexOf(v.area) < 0) return;
  console.log("\n================ " + v.area + " ================");
  console.log("-- CURRENT --\n" + v.currentBehaviour);
  console.log("-- ROOT CAUSE --\n" + v.rootCause);
  console.log("-- PROPOSED --\n" + v.proposedChange);
  console.log("-- KEY SYMBOLS --");
  (v.keySymbols || []).forEach(function(k){ console.log("  " + k.line + "  " + k.name + " :: " + k.note); });
  console.log("-- RISKS --\n" + v.risks);
});
