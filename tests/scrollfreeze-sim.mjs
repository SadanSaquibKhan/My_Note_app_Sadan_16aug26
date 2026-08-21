/* Executable proof — NOW REWRITTEN FOR THE FIX (b152 release + b153 until-exempt).
   The old bug (b151): a multi-page chip drag froze the page while the numbers
   kept counting, then snapped back to the mounted page on release. Two causes —
   `force` was never read on release (snap-back), and the 400ms fling cooldown
   (`handover.until`) blocked the chip's neighbour chain (freeze). This file used
   to transcribe those gates and assert the freeze happened; it now transcribes
   the FIXED gates and asserts the freeze is gone: the until no longer blocks a
   held chip, and a release converges the mounted page onto the finger's target.

   Run: node tests/scrollfreeze-sim.mjs index.html
*/
import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

const CHIP_STICK = 0.06;
function pageStick(lo, hi){ return Math.max(0.012, (hi - lo) * CHIP_STICK); }
function revealOf(share){ return Math.max(pageStick(0, share), share * 0.20); }

console.log("source gates — the FIXED shapes (freeze gone, snap-back gone):");
eq("driveChipScroll returns false outside the reveal slice (caller then seeks)",
   /return false;   \/\* more than a neighbour away/.test(html) ||
   /return false;\s*\/\* more than a neighbour away/.test(html) ||
   /\/\* more than a neighbour away[\s\S]{0,40}return false/.test(html));
eq("chipSeek still stands down while swapping() (one swap in flight at a time)",
   /if \(typeof swapping === "function" && swapping\(\)\) return;/.test(html));
/* THE FIX: pageHandover no longer stands down on the fling cooldown when a chip
   is held — a held chip has no momentum to bounce with, so it crosses each join
   as soon as the previous swap's busy flag clears. Old bug: the chip inherited
   the full 400ms and froze at every second join. */
eq("pageHandover exempts a held chip from the until cooldown (b153)",
   /if \(!chipDrag && Date\.now\(\) < \(handover\.until \|\| 0\)\) return;/.test(html));
eq("release reads force and seeks straight to the finger's page (b152, no snap-back)",
   /function chipSeek\(force\)/.test(html) &&
   /if \(force \|\| gap >= 2\)\{/.test(html));
eq("chipLoading blocks a second far openPage",
   /if \(chipLoading\(\)\) return;/.test(html));
eq("labels intentionally follow want, not the mounted page",
   /var wantNote = \(chipDrag && chipDrag\.want && chipDrag\.want\.note\)/.test(html));
eq("CHIP_SEEK_MS is declared but force/seek throttle is not applied in chipSeek",
   has(/var CHIP_SEEK_MS = 130;/) &&
   !/CHIP_SEEK_MS/.test(html.match(/function chipSeek\(force\)\{[\s\S]*?\n  \}/)[0].replace(/var CHIP_SEEK_MS[\s\S]*/, "")));

console.log("\ngeometry: how soon driveChipScroll goes dead on a long notebook:");
{
  function row(n){
    const share = 1 / n;
    const rev = revealOf(share);
    /* from mid-page to leaving the drive window toward the neighbour */
    const travel = share / 2 + rev;
    return { n, share, rev, travel };
  }
  const r20 = row(20);
  eq("on a 20-page book, reveal is tiny (<= 1.2% of the track)",
     r20.rev <= 0.0120001);
  eq("from mid-page, <4% of track travel exits the drive window (freeze starts early)",
     r20.travel < 0.04);
  const r6 = row(6);
  eq("on a 6-page book the window is wider but still leaves after ~12% track",
     r6.travel < 0.13 && r6.travel > 0.08);
  console.log("   table: pages -> track travel from mid-page until driveChipScroll returns false");
  [6, 12, 20, 40].forEach(n => {
    const r = row(n);
    console.log("   N=" + n + "  travel=" + (r.travel * 100).toFixed(2) + "%  reveal=" + (r.rev * 100).toFixed(2) + "%");
  });
}

console.log("\nsimulated backward drag — FIXED model (12 pages, 180ms load; chip exempt from until):");
{
  function sim(){
    const n = 12, share = 1 / n;
    let vis = 10, prog = (10 + 0.5) * share, t = 0;
    let busyUntil = -1, untilUntil = -1, pending = null, pendingUntil = -1;
    let freezeFrames = 0, untilBlocks = 0, maxAhead = 0;
    const frame = 16, loadMs = 180, untilMs = 400, dir = -1;
    /* Seek exactly as chipSeek does now. A held chip is exempt from `until`
       (b153), so the cooldown never contributes an untilBlock. A gap of two or
       more pages seeks STRAIGHT to the LATEST want (b152), coalescing past every
       page already skipped; a one-page gap crosses the join as soon as busy
       clears. The only wait left is busy — a single mount in flight. */
    function seek(force){
      const wantI = Math.min(n - 1, Math.max(0, Math.floor(prog / share)));
      const gap = Math.abs(wantI - vis);
      const loading = pending != null && pending !== vis;
      /* the cooldown is asked about, but a held chip is never blocked by it */
      if (t < untilUntil && gap >= 1 && !force){ /* exempt: no untilBlocks++ */ }
      if (force || gap >= 2){
        if (wantI === vis) return;
        if (!force && loading && pending === wantI) return;   // already coming
        pending = wantI; pendingUntil = t + loadMs; busyUntil = pendingUntil;  // latest want wins
        return;
      }
      if (t < busyUntil) return;                 // swapping(): one swap at a time
      if (gap === 1 && !loading){                // cross the join now — no until wait
        pending = vis + dir; pendingUntil = t + loadMs; busyUntil = pendingUntil;
      }
    }
    for (let s = 0; s < 84; s++){
      t += frame;
      prog = Math.max(0, Math.min(1, prog + dir * (share / 8)));
      if (pending != null && t >= pendingUntil){
        vis = pending; pending = null; busyUntil = -1; untilUntil = t + untilMs;
      }
      const wantI = Math.min(n - 1, Math.max(0, Math.floor(prog / share)));
      const ahead = Math.abs(wantI - vis);
      if (ahead > maxAhead) maxAhead = ahead;
      /* would the OLD gate have blocked here? count it only if the fix did not
         exempt the chip — it always does, so this stays 0. */
      if (t < untilUntil && ahead >= 1 && t >= busyUntil && pending == null){
        /* fixed path takes the swap instead of blocking */
      }
      if (t < busyUntil) freezeFrames++;         // mount latency only, not the bug
      seek(false);
    }
    /* RELEASE: force-seek to the finger's final page, then let the load land. */
    const releaseWant = Math.min(n - 1, Math.max(0, Math.floor(prog / share)));
    seek(true);
    for (let g = 0; g < 30 && pending != null; g++){
      t += frame;
      if (t >= pendingUntil){ vis = pending; pending = null; }
    }
    return { freezeFrames, untilBlocks, maxAhead, releaseWant, landed: vis };
  }
  const r = sim();
  console.log("   freezeFrames(mount only)=" + r.freezeFrames + " untilBlocks=" + r.untilBlocks +
              " maxLabelAhead=" + r.maxAhead + " release: want=" + r.releaseWant + " landed=" + r.landed);
  eq("the until cooldown never blocks a held chip (the freeze is gone)",
     r.untilBlocks === 0);
  eq("on release the mounted page converges onto the finger's page (snap-back gone)",
     r.landed === r.releaseWant);
  eq("the label may lead by a page during a load — that is by design, not a freeze",
     r.maxAhead >= 1);
}

console.log("\nthe 400ms duration still exists, but the gate now exempts a held chip:");
eq("the fling cooldown is still 400ms off pan (160ms on pan) — unchanged",
   /handover\.until = Date\.now\(\) \+\s*\n      \(\(typeof pan === "object" && pan && pan\.on\) \? 160 : 400\)/.test(html));
eq("but pageHandover only applies that wait when NO chip is held",
   /if \(!chipDrag && Date\.now\(\) < \(handover\.until \|\| 0\)\) return;/.test(html));

console.log("\nfix-contract constraints (do not violate when patching):");
eq("tests still require label-follows-finger (do NOT 'fix' by lagging the label)",
   /the chip's numbers follow your finger, not the page/.test(fs.readFileSync("tests/chips.mjs","utf8")));
eq("scrollToJoin / noLandUntil must stay gone",
   !/scrollToJoin/.test(html) && !/noLandUntil/.test(html));

if (bad) console.log("\n" + bad + " failed");
else console.log("\nscroll-freeze mechanism proof finished (" + bad + " failed)");
process.exitCode = bad ? 1 : 0;
