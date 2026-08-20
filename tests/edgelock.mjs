/* Writing with the pen folds all three lists, including sections.
   Long-press an arrow to pin that list open. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("writing folds notebooks, sections and pages:");
eq("focus-hide includes the sections pane, same as the other two",
   has(/body\[data-focus="1"\] #secPane/));
eq("immerse hides sections too",
   has(/body\[data-immerse="1"\] #secPane/));
eq("the pen still sets all three min flags",
   has(/if \(!cfg\.lockRail\) cfg\.railMin = true;/) &&
   has(/if \(!cfg\.lockSec\)  cfg\.secMin  = true;/) &&
   has(/if \(!cfg\.lockList\) cfg\.listMin = true;/));

console.log("");
console.log("a long-press pins a list so writing does not fold it:");
eq("three lock flags exist",
   has(/lockRail: false/) && has(/lockSec: false/) && has(/lockList: false/));
eq("long-press is wired on each arrow",
   has(/function wireEdge\(id, which\)/) &&
   has(/wireEdge\("edgeList", "list"\)/) &&
   has(/wireEdge\("edgeSec", "sec"\)/) &&
   has(/wireEdge\("edgeRail", "rail"\)/));
eq("a tap after a hold does not also toggle the pane",
   has(/if \(edgeHold\.fired\)\{ edgeHold\.fired = false; return; \}/));
eq("pinning a list also opens it",
   has(/if \(which === "sec"\) cfg\.secMin = false;/));
eq("the pen leaves a pinned list alone",
   has(/if \(!cfg\.lockSec\)  cfg\.secMin  = true;/));
eq("the arrow shows it is pinned",
   has(/classList\.toggle\("pinned", !!cfg\.lockSec\)/) &&
   has(/\.edgestack \.edgetab\.pinned/));

/* simulate the collapse + lock */
{
  let railMin = true, secMin = false, listMin = false;
  let lockRail = false, lockSec = false, lockList = false;
  function penFolds(){
    if (!lockRail) railMin = true;
    if (!lockSec)  secMin  = true;
    if (!lockList) listMin = true;
    return { railMin, secMin, listMin };
  }
  function pin(which){
    if (which === "sec"){ lockSec = !lockSec; if (lockSec) secMin = false; }
    if (which === "list"){ lockList = !lockList; if (lockList) listMin = false; }
    if (which === "rail"){ lockRail = !lockRail; if (lockRail) railMin = false; }
  }
  const a = penFolds();
  eq("first write folds all three", a.railMin && a.secMin && a.listMin);
  pin("sec");
  const b = penFolds();
  eq("after pinning sections, write still folds the other two",
     b.railMin && b.listMin && b.secMin === false);
  pin("sec");
  const c = penFolds();
  eq("unpinning sections lets the next write fold them again", c.secMin === true);
}

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall edge-lock checks passed");
