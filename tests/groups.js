var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");
var m = html.match(/\n  function wouldCycle\([\s\S]*?\n  \}/);
if (!m) { console.log("MISSING wouldCycle"); process.exit(1); }
var wouldCycle = new Function(m[0] + "\n return wouldCycle;")();

function eq(label, got, want){
  var ok = got === want;
  console.log((ok ? "  ok   " : "  FAIL ") + label + "  got=" + got + (ok ? "" : " want=" + want));
  if (!ok) process.exitCode = 1;
}
/*  research
      └ vlsi
          └ jobprep
    teaching                        */
var G = [
  { id:"research", parentId:null },
  { id:"vlsi",     parentId:"research" },
  { id:"jobprep",  parentId:"vlsi" },
  { id:"teaching", parentId:null }
];
eq("into own child          ", wouldCycle(G, "research", "vlsi"),    true);
eq("into own grandchild     ", wouldCycle(G, "research", "jobprep"), true);
eq("into itself             ", wouldCycle(G, "vlsi", "vlsi"),        true);
eq("into a sibling  (ok)    ", wouldCycle(G, "vlsi", "teaching"),    false);
eq("to top level    (ok)    ", wouldCycle(G, "vlsi", null),          false);
eq("child into parent's kin ", wouldCycle(G, "jobprep", "teaching"), false);
eq("unrelated       (ok)    ", wouldCycle(G, "teaching", "jobprep"), false);

/* already-corrupt data must not hang the walk */
var BAD = [{ id:"a", parentId:"b" }, { id:"b", parentId:"a" }];
eq("existing loop refused   ", wouldCycle(BAD, "x", "a"),            true);

/* deleting a folder re-parents its contents up one level */
function deletePlan(groups, books, id){
  var me = groups.filter(function(g){ return g.id === id; })[0];
  if (!me) return null;
  var up = me.parentId || null;
  return {
    groups: groups.filter(function(g){ return g.parentId === id; })
                  .map(function(g){ return g.id + "->" + up; }),
    books: books.filter(function(b){ return b.groupId === id; })
                .map(function(b){ return b.id + "->" + up; })
  };
}
var books = [{ id:"nb1", groupId:"vlsi" }, { id:"nb2", groupId:"teaching" }];
var plan = deletePlan(G, books, "vlsi");
console.log("delete 'vlsi':");
eq("  child folder moves up ", JSON.stringify(plan.groups), '["jobprep->research"]');
eq("  its notebook moves up ", JSON.stringify(plan.books),  '["nb1->research"]');
