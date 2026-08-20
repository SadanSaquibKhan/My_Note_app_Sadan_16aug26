/* Two questions the handover must answer correctly:
   1. can a swap immediately reverse itself? (that is the shaking)
   2. does the relative pad compensation keep the view still? */

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

const H = 1000;                       /* viewport height */
const top = 0;
const fwdLine  = top + H * 0.40;
const backLine = top + H * 0.60;

/* After swapping FORWARD, the page you left becomes the previous page.
   Its foot sits exactly where the incoming page's head was. */
function wouldSwapForward(nextTop){ return nextTop < fwdLine; }
function wouldSwapBack(prevBottom){ return prevBottom > backLine; }

console.log("can a forward swap reverse itself?");
for (const nextTop of [0, 100, 200, 300, 399]){
  /* the moment it swaps, the old page's bottom is where the new page's top was */
  const prevBottom = nextTop;
  const fwd = wouldSwapForward(nextTop);
  const back = wouldSwapBack(prevBottom);
  eq("next top at " + String(nextTop).padStart(3) + ": forward=" + fwd +
     " then backward=" + back, fwd && !back);
}
console.log("");
console.log("can a backward swap reverse itself?");
for (const prevBottom of [601, 700, 800, 999]){
  const nextTop = prevBottom;
  const back = wouldSwapBack(prevBottom);
  const fwd = wouldSwapForward(nextTop);
  eq("prev bottom at " + String(prevBottom).padStart(3) + ": backward=" + back +
     " then forward=" + fwd, back && !fwd);
}
console.log("");
eq("the two rules can never both be true",
   !(wouldSwapForward(500) && wouldSwapBack(500)));

console.log("");
console.log("relative compensation keeps the view still:");
{
  /* looking at a point 900px into the scroller; the band above grows by 240
     when a picture loads. To keep that point under the eye, the scroll must
     move by the same amount. */
  let scrollTop = 900, pad = 300, last = pad;
  const pointOnScreen = () => 1200 + pad - scrollTop;   /* content at 1200 in page coords */
  const before = pointOnScreen();
  pad = 540;                                            /* picture arrived */
  const d = pad - last; last = pad;
  scrollTop += d;                                       /* the compensation */
  eq("point stays where it was", pointOnScreen() === before);
}
{
  /* and when the band shrinks */
  let scrollTop = 1400, pad = 540, last = pad;
  const pointOnScreen = () => 1200 + pad - scrollTop;
  const before = pointOnScreen();
  pad = 300;
  const d = pad - last; last = pad;
  scrollTop += d;
  eq("also when it shrinks", pointOnScreen() === before);
}
{
  /* the user scrolls during the change: compensation is relative, so their
     scroll survives it */
  let scrollTop = 900, pad = 300, last = pad;
  scrollTop += 120;                    /* the finger moved */
  pad = 420;
  const d = pad - last;
  scrollTop += d;
  eq("a scroll in progress is not undone", scrollTop === 900 + 120 + 120);
}
process.exitCode = bad ? 1 : 0;
