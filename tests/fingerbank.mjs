/* E (Windows finger-scroll freeze/jump at a join). While a page remounted,
   fingerPanMove held the page dead still — a visible freeze then jump on a slow
   mount. It now BANKS the finger's travel (handover.fingerPanY += clientY-prevY)
   and finishHandover applies it once after the re-anchor (scrollTop -= fingerPanY).
   The one thing that MUST hold: the banked total moves the page the SAME way, by
   the SAME amount, as the normal branch (scrollTop = pan.top - (clientY - pan.y))
   would have for the same travel — otherwise a crossing scrolls backward or jumps.
   This transcribes both and asserts they agree over a run of moves.
   Run: node tests/fingerbank.mjs index.html */
import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

/* --- normal (non-busy) branch: absolute, anchored at pan-down --- */
function normal(scroll0, y0, moves){
  var panTop = scroll0, panY = y0, top = scroll0;
  for (const y of moves){ top = panTop - (y - panY); }   // pan.top/pan.y fixed at down
  return top;
}
/* --- busy branch banks, finishHandover applies once on top of the anchor --- */
function banked(anchorScroll, y0, moves){
  var prevY = y0, fingerPanY = 0;
  for (const y of moves){ fingerPanY += (y - prevY); prevY = y; }  // trackVel updates prev each move
  return anchorScroll - fingerPanY;                                 // one write after re-anchor
}

/* Same finger path from the same starting scroll must land on the same scroll,
   whichever branch handled it (the anchor for the banked case is the scroll the
   normal branch would also have started from). */
const path = [500, 480, 455, 455, 470, 500, 540];   // up, pause, back down, past start
eq("banked total == normal total for the same finger path",
   banked(1000, 500, path) === normal(1000, 500, path));

/* Direction: dragging the finger UP (y decreases) scrolls content up = scrollTop
   grows. Both branches must increase scrollTop. */
eq("finger up -> scrollTop increases (normal)", normal(1000, 500, [460]) === 1040);
eq("finger up -> scrollTop increases (banked)", banked(1000, 500, [460]) === 1040);
eq("finger down -> scrollTop decreases (banked)", banked(1000, 500, [520]) === 980);

/* source: the two halves are actually wired the way the model assumes */
eq("busy branch banks clientY-prevY into handover.fingerPanY",
   /var by = e\.clientY - \(pan\.py == null \? e\.clientY : pan\.py\);[\s\S]{0,120}handover\.fingerPanY = \(handover\.fingerPanY \|\| 0\) \+ by/.test(html));
eq("finishHandover subtracts the bank from scrollTop, once, then zeroes it",
   /p\.scrollTop\s*=\s*Math\.max\(0, p\.scrollTop\s*-\s*\(handover\.fingerPanY \|\| 0\)\);[\s\S]{0,160}handover\.fingerPanY = 0; handover\.fingerPanX = 0;/.test(html));
eq("the bank is reset to 0 when a handover starts",
   /handover\.fingerPanY = 0; handover\.fingerPanX = 0;\s*\/\* finger travel banked while swapping/.test(html));

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall finger-bank checks passed");
