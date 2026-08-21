/* The two floating bars (favourites #favDot, shortcuts #jumpDot) minimise to a
   draggable dot. Holding the dot ~400ms fires onTap, which hides the dot and
   shows the bar. The pointerup that follows used to read the now-HIDDEN dot's
   rect — which is 0,0 — and save that as the bar's position, snapping the bar to
   the TOP-LEFT corner the instant you let go (setPos even moves the just-shown
   bar straight there). The fix: endDot records a position only for a real drag,
   never for a hold-to-open and never from a hidden (0,0) element. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("source: endDot guards against the top-left snap:");
eq("it skips saving after a hold-to-open (wasOpen guard)",
   has(/var wasOpen = opened;\s*\n\s*drag = null;[\s\S]{0,400}if \(wasOpen\) return;/));
eq("it never saves a 0,0 rect from a hidden dot",
   has(/if \(!r\.width && !r\.height\) return;/));
eq("both floating dots go through bindDotDrag",
   has(/bindDotDrag\(\$\("favDot"\)/) && has(/bindDotDrag\(\$\("jumpDot"\)/));

console.log("\nbehaviour (transcribed from endDot — keep in sync by hand):");
/* mirrors the decision in index.html's endDot */
function endDotDecision(opened, rect){
  var wasOpen = opened;
  if (wasOpen) return null;                          // opening is not a move
  if (!rect.width && !rect.height) return null;      // hidden / detached: never 0,0
  return { x: Math.round(rect.left), y: Math.round(rect.top) };
}
const hidden = { left: 0, top: 0, width: 0, height: 0 };
eq("a hold-to-open records nothing, so the bar keeps its place",
   endDotDecision(true, hidden) === null);
eq("a hidden dot (0,0) records nothing even if the open flag was missed",
   endDotDecision(false, hidden) === null);
eq("a real drag records the dragged position",
   JSON.stringify(endDotDecision(false, { left: 120, top: 300, width: 44, height: 44 }))
   === JSON.stringify({ x: 120, y: 300 }));

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall bar-dot checks passed");
