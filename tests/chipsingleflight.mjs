/* D: chip-drag freeze/jump staircase. The far-seek (gap>=2 / release) branch of
   chipSeek used to call openPage() gated only against the SAME target, so a
   moving finger overwrote pendingId and started a fresh render every frame;
   renderSeq cancels the previous one before it can mount, so the page never
   caught up while the number ran on — freeze -> jump -> freeze, worst on Windows
   (one mouse move per frame, throttled frames on an occluded/second-screen
   window). The far-seek is now SINGLE-FLIGHT: one page load in the air; the chase
   loop retries and, once the load mounts, heads for the LATEST target. On release
   a stale in-flight load may be superseded ONCE so we still land where you let go.
   Run: node tests/chipsingleflight.mjs index.html */
import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

/* transcription of the single-flight decision (keep in sync with index.html) */
function startLoad(chipLoading, pendingIsTarget, force){
  if (chipLoading){
    if (pendingIsTarget) return false;   // the page we want is already coming — wait
    if (!force) return false;            // mid-drag: do not stack a second load
    // release only: supersede a stale in-flight load once
  }
  return true;
}
console.log("single-flight decision:");
eq("no load in flight -> start it", startLoad(false, false, false) === true);
eq("SAME target already loading -> wait (mid-drag)", startLoad(true, true, false) === false);
eq("SAME target already loading -> wait on release too (no restart of a nearly-done render)",
   startLoad(true, true, true) === false);
eq("DIFFERENT target loading, mid-drag -> wait (single-flight)", startLoad(true, false, false) === false);
eq("DIFFERENT target loading, release -> supersede once", startLoad(true, false, true) === true);

console.log("\nsource: the gate precedes the far openPage:");
eq("chipLoading() is checked BEFORE starting the far openPage",
   /if \(chipLoading\(\)\)\{\s*\n\s*if \(chipDrag\.pendingId === wp\.note\.id\) return;[\s\S]{0,160}if \(!force\) return;[\s\S]{0,500}openPage\(wp\.note, true\)/.test(html));
eq("the second far-path still has its own chipLoading gate (unchanged)",
   /if \(chipLoading\(\)\) return;\s*\n\s*if \(chipDrag\.pendingId === place\.note\.id\) return;/.test(html));

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall chip single-flight checks passed");
