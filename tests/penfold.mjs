/* Bug B (Windows pen-down delay). On Windows the S Pen gives no hover pre-roll,
   so the very first thing the app hears is the contact pointerdown — which used
   to run the heavy panel fold (setFocus + applyPanes + the favourites rebuild)
   synchronously, before the browser could paint, so the ink and the AUTO->PEN
   switch only appeared after that work finished. Once the panels are folded
   (the usual case once you have started writing — a pen leaving does not unfold
   them), that fold is pure no-op churn on every nib-down; it is now skipped
   entirely. A genuine fold (panels still visible) still runs SYNCHRONOUSLY, so a
   stroke's coordinates are captured against one stable page width (never fold
   halfway through a stroke). The double full-screen request on one nib-down (the
   b159 keep-full listener + maybeAutoFull) is also guarded now.
   Run: node tests/penfold.mjs index.html */
import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

eq("the fold work is skipped when the panels are already folded (no-op fast path)",
   /var wasFolded = \(typeof panelsHidden === "function"\) \? panelsHidden\(\) : false;\s*\n\s*if \(!wasFolded\)\{/.test(html) &&
   /if \(!wasFolded\)\{[\s\S]{0,500}setFocus\(allFree\);\s*\n\s*applyPanes\(\);/.test(html));
eq("a genuine fold still runs synchronously (coordinates stay on one page width)",
   !/requestAnimationFrame\(function\(\)\{\s*\n\s*setFocus\(allFree\)/.test(html));
eq("full-screen requests are single-flight (no double request on one nib-down)",
   /var fullReqPending = false;/.test(html) &&
   /if \(document\.fullscreenElement \|\| document\.webkitFullscreenElement \|\| fullReqPending\) return;/.test(html));

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall pen-fold checks passed");
