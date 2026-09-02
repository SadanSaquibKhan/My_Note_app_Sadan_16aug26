/* A page load that never arrives stops holding the chip drag hostage (b206).

   Reported: dragging a chip, the page freezes visibly, the chip's number keeps
   climbing, and when you let go the page HAS changed after all. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("the single-flight gate can now be got out of:");
/* It was a latch with no way out: if the page asked for never mounts — deleted,
   the load threw, or its id simply never turns up as the mounted one — pendingId
   was never cleared, so it stayed true for the rest of the drag. */
eq("a lost load is written off after a bounded wait", /var CHIP_LOAD_LOST_MS = 900;/.test(html));
eq("and the gate checks the clock", /if \(chipDrag\.lastSeek && \(Date\.now\(\) - chipDrag\.lastSeek\) > CHIP_LOAD_LOST_MS\)\{/.test(html));
eq("clearing the stale target so the chase can aim again",
   /chipDrag\.pendingId = null;\s*\n\s*return false;\s*\n\s*\}\s*\n\s*return true;/.test(html));
/* Arriving is the ordinary way out, and it should tidy up after itself rather
   than leaving a satisfied target sitting there. */
eq("a load that DID arrive clears itself too",
   /if \(chipDrag\.pendingId === visualNoteId\(\)\)\{ chipDrag\.pendingId = null; return false; \}/.test(html));
eq("no drag, no load", /if \(!chipDrag \|\| !chipDrag\.pendingId\) return false;/.test(html));

console.log("\nwhat must not change:");
/* The gate exists so a moving finger cannot start a fresh render every frame
   and have renderSeq cancel the last before it can mount. */
eq("the chase still runs every frame while the chip is held",
   /function chipChase\(\)\{[\s\S]{0,140}chipSeek\(false\);/.test(html));
eq("release can still supersede one stale load", /if \(!force\) return;/.test(html));
eq("and lastSeek is still stamped when a load starts", /chipDrag\.lastSeek = Date\.now\(\);/.test(html));

/* ---- the latch, simulated ---- */
console.log("\nthe latch, simulated:");
function loading(pending, mounted, lastSeek, now, LOST = 900){
  if (!pending) return false;
  if (pending === mounted) return false;
  if (lastSeek && (now - lastSeek) > LOST) return false;
  return true;
}
eq("while a load is genuinely in flight, seeks stand down",
   loading('p9', 'p1', 1000, 1200) === true);
eq("once it mounts, they resume", loading('p9', 'p9', 1000, 1200) === false);
/* The whole bug: a load that never lands used to block every remaining frame. */
eq("a load that never lands stops blocking after the wait",
   loading('p9', 'p1', 1000, 1000 + 901) === false);
eq("and before the wait is up it still blocks, so the gate still does its job",
   loading('p9', 'p1', 1000, 1000 + 400) === true);
const oldWay = (pending, mounted) => !!(pending && pending !== mounted);
eq("which is what the old gate could never do", oldWay('p9', 'p1') === true);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
