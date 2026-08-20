/* A gesture only counts as a tap if the finger went down and came up in the
   same place, quickly. Two taps like that, close together, open the keyboard.
   Scrolling must never qualify. */

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

function makeDetector(){
  const s = { last: 0, x: 0, y: 0, downX: 0, downY: 0, downAt: 0, moved: false };
  return {
    down(x, y, t){ s.downX = x; s.downY = y; s.downAt = t; s.moved = false; },
    move(x, y){
      if (s.moved) return;
      if (Math.abs(x - s.downX) > 10 || Math.abs(y - s.downY) > 10) s.moved = true;
    },
    up(x, y, t){
      if (s.moved || (t - s.downAt) > 320){ s.last = 0; return false; }
      const near = s.last &&
                   Math.abs(x - s.x) < 32 && Math.abs(y - s.y) < 32 &&
                   (t - s.last) < 420;
      if (near){ s.last = 0; return true; }
      s.last = t; s.x = x; s.y = y;
      return false;
    }
  };
}

console.log("two quick taps in the same place:");
{
  const d = makeDetector();
  d.down(400, 500, 0);   eq("first tap does not open", d.up(400, 500, 90) === false);
  d.down(404, 503, 300); eq("second tap opens",        d.up(404, 503, 380) === true);
}

console.log("");
console.log("scrolling must never open the keyboard:");
{
  const d = makeDetector();
  /* a scroll: down, drag a long way, up — twice, ending near each other */
  d.down(400, 900, 0);
  for (let y = 900; y > 300; y -= 40) d.move(400, y);
  eq("first scroll does not open", d.up(400, 300, 260) === false);
  d.down(400, 900, 320);
  for (let y = 900; y > 300; y -= 40) d.move(400, y);
  eq("second scroll does not open", d.up(400, 300, 560) === false);
}
{
  const d = makeDetector();
  /* two short flicks that both END in nearly the same spot */
  d.down(400, 520, 0);   d.move(400, 480);
  eq("short flick is not a tap", d.up(400, 470, 120) === false);
  d.down(400, 520, 200); d.move(400, 480);
  eq("nor is the next one",      d.up(400, 470, 320) === false);
}
console.log("");
console.log("a slow press is not a tap either:");
{
  const d = makeDetector();
  d.down(400, 500, 0);   d.up(400, 500, 90);
  d.down(400, 500, 300); eq("long dwell ignored", d.up(400, 500, 800) === false);
}
console.log("");
console.log("two taps far apart are not a double tap:");
{
  const d = makeDetector();
  d.down(200, 300, 0);   d.up(200, 300, 60);
  d.down(900, 800, 200); eq("different places", d.up(900, 800, 260) === false);
}
process.exitCode = bad ? 1 : 0;
