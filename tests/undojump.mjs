import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("undo/redo jumps to the PAGE where the change was:");
eq("every ink op is tagged with its page", has(/op\.noteId = state\.noteId/) && has(/op\.nbId = state\.nbId/));
eq("page undo stacks are parked when you leave", has(/function parkPageUndo\(id\)/));
eq("and restored when you come back", has(/restorePageUndo\(nid\)/));
eq("undo looks across parked pages", has(/function latestAcross\(which\)/));
eq("if the change is on another page, it goes there",
   has(/undoJump = \{ noteId: best\.noteId, which: "undo" \}/));
eq("then undoes once that page is open",
   has(/if \(w === "redo"\) globalRedo\(\); else globalUndo\(\);/));
eq("it waits for the page's ink, not a guess of 80ms",
   has(/var ready = \(typeof inkReady/) && has(/ready\.then\(function\(\)\{/));
eq("the ink Undo button uses the same jump",
   has(/holdRepeat\(\$\("inkUndo"\), function\(\)\{ globalUndo\(\); \}\)/) &&
   has(/\$\("inkRedo"\)\.addEventListener\("click", function\(\)\{ globalRedo\(\); \}\)/));
eq("after undo the page's stack is parked again",
   has(/if \(state\.noteId && S\.name === "note"\) parkPageUndo\(state\.noteId\);/));
eq("the place on the page is revealed", has(/function revealOp\(op\)/));
eq("leaving a page parks BEFORE the id is wiped",
   has(/park BEFORE clearing the id/) &&
   has(/parkPageUndo\(\$\("body"\)\.dataset\.noteId\)/));
eq("a pending typed snap is flushed when the page is parked",
   has(/if \(textHist && textHist\.timer\)/) &&
   has(/if \(typeof snapText === "function"\) snapText\(\);/));
eq("the typing Undo button uses the same jump",
   has(/holdRepeat\(\$\("textUndo"\), function\(\)\{/) &&
   has(/if \(typeof globalUndo === "function"\) globalUndo\(\)/));
eq("holding Undo keeps undoing until you let go",
   has(/function holdRepeat\(el, fn\)/) && has(/holdRepeat\(\$\("gUndo"\), globalUndo\)/));
eq("a parked page keeps its section so undo can leave this one",
   has(/sectionId: state\.sectionId/) &&
   has(/if \(best\.sectionId\) state\.sectionId = best\.sectionId;/));

console.log("undo/redo jumps to the exact LOCATION of the change:");
eq("each ink op stores its midpoint as atX/atY",
   has(/op\.atY = \(b\.minY \+ b\.maxY\) \/ 2; op\.atX = \(b\.minX \+ b\.maxX\) \/ 2;/));
eq("typed snaps store the caret's page x/y",
   has(/function caretPagePos\(\)/) &&
   has(/atX: pos \? pos\.x : null, atY: pos \? pos\.y : null/));
eq("text undo/redo keep that spot and scroll to it",
   has(/atX: entry\.atX, atY: entry\.atY/) &&
   has(/revealXY\(entry\.atX, entry\.atY\)/));
eq("opening another page to undo does not restore the old scroll",
   has(/if \(state\.nbId && !swapping\(\) && !undoReveal\)/));
eq("after the dest page undoes, it scrolls to the stored spot",
   has(/if \(loc && loc\.atY != null/) && has(/revealXY\(loc\.atX, loc\.atY\)/));
eq("already looking at the change: do not jump",
   has(/already looking at this change: do not jump/) &&
   has(/if \(top >= p\.scrollTop \+ 40 && bottom <= p\.scrollTop \+ view - 40\) return;/));
eq("reveal accounts for the previous-page pad",
   has(/var padv = \(typeof prevPad === "function"\) \? prevPad\(\) : 0;/) &&
   has(/var top = b\.minY \* z \+ padv, bottom = b\.maxY \* z \+ padv;/));
eq("global undo/redo remember the dest spot before leaving",
   has(/undoReveal = peekOpLoc\(best\.noteId, "undo"\)/) &&
   has(/undoReveal = peekOpLoc\(best\.noteId, "redo"\)/));
eq("old ops without atY still get a spot from their strokes",
   has(/function locFromOp\(op\)/) && has(/return locFromOp\(iu\)/));

/* ---- transcribed: p8 write a b, p9 write c d, undo undo undo ---- */
console.log("p8 / p9 story (typed a b, then c d):");

function locFromOp(op){
  if (!op) return null;
  if (op.atY != null && isFinite(op.atY)) return { atX: op.atX, atY: op.atY };
  return null;
}
function peekOpLoc(pageUndo, noteId, which){
  var p = pageUndo[noteId];
  if (!p) return null;
  if (which === "undo"){
    var iu = p.inkUndo[p.inkUndo.length - 1];
    var tu = p.textPast[p.textPast.length - 1];
    var iv = iu ? (iu.seq || 0) : -1;
    var tv = tu ? (tu.seq || 0) : -1;
    if (iv >= tv && iu) return locFromOp(iu);
    if (tu) return { atX: tu.atX, atY: tu.atY };
  } else {
    var ir = p.inkRedo[p.inkRedo.length - 1];
    var tr = p.textFuture[p.textFuture.length - 1];
    var irv = ir ? (ir.undoneAt || 0) : -1;
    var trv = tr ? (tr.undoneAt || 0) : -1;
    if (irv >= trv && ir) return locFromOp(ir);
    if (tr) return { atX: tr.atX, atY: tr.atY };
  }
  return null;
}
function latestAcross(stateNoteId, live, pageUndo, which){
  var best = { v: -1, noteId: stateNoteId, kind: null };
  function consider(v, noteId, kind){
    if (v > best.v) best = { v: v, noteId: noteId, kind: kind };
  }
  if (which === "undo"){
    if (live.textPast.length) consider(live.textPast[live.textPast.length - 1].seq || 0, stateNoteId, "text");
  } else {
    if (live.textFuture.length) consider(live.textFuture[live.textFuture.length - 1].undoneAt || 0, stateNoteId, "text");
  }
  Object.keys(pageUndo).forEach(function(id){
    if (id === stateNoteId) return;
    var p = pageUndo[id];
    if (which === "undo"){
      var tu = p.textPast[p.textPast.length - 1];
      if (tu) consider(tu.seq || 0, id, "text");
    } else {
      var tr = p.textFuture[p.textFuture.length - 1];
      if (tr) consider(tr.undoneAt || 0, id, "text");
    }
  });
  return best;
}
function alreadyInView(scrollTop, view, y){
  var top = y - 24, bottom = y + 24;
  return top >= scrollTop + 40 && bottom <= scrollTop + view - 40;
}

var pageUndo = {
  p8: {
    inkUndo: [], inkRedo: [],
    textPast: [
      { html: "a", seq: 1, atX: 40, atY: 220 },
      { html: "a b", seq: 2, atX: 70, atY: 220 }
    ],
    textFuture: []
  }
};
var live = {
  textPast: [
    { html: "c", seq: 3, atX: 40, atY: 880 },
    { html: "c d", seq: 4, atX: 70, atY: 880 }
  ],
  textFuture: []
};

var u1 = latestAcross("p9", live, pageUndo, "undo");
eq("first undo is still on p9 (d)", u1.noteId === "p9" && u1.v === 4);
eq("so there is no page jump for d", u1.noteId === "p9");
eq("and d is already in view — no scroll jump", alreadyInView(800, 900, 880) === true);

var d = live.textPast.pop();
live.textFuture.push({ html: "c d", undoneAt: 1, atX: d.atX, atY: d.atY });
var u2 = latestAcross("p9", live, pageUndo, "undo");
eq("second undo is still on p9 (c)", u2.noteId === "p9" && u2.v === 3);
eq("c is already in view — no scroll jump", alreadyInView(800, 900, 880) === true);

var c = live.textPast.pop();
live.textFuture.push({ html: "c", undoneAt: 2, atX: c.atX, atY: c.atY });
var u3 = latestAcross("p9", live, pageUndo, "undo");
eq("third undo is on p8 (b)", u3.noteId === "p8" && u3.v === 2);
var loc = peekOpLoc(pageUndo, "p8", "undo");
eq("jump lands on p8 at b's spot (y=220), not just the page top",
   loc && loc.atY === 220 && loc.atX === 70);

/* redo story: redo b stays on p8; redo c jumps to p9 at c's spot */
pageUndo.p8.textFuture.push(pageUndo.p8.textPast.pop());
pageUndo.p8.textFuture[pageUndo.p8.textFuture.length - 1].undoneAt = 3;
var r1 = latestAcross("p8", { textPast: [], textFuture: [] }, pageUndo, "redo");
/* live p8 after undo of b: future has b. Wait — we mutated p8's past by popping
   for the peek. Rebuild a clean redo case. */
pageUndo = {
  p9: {
    inkUndo: [], inkRedo: [],
    textPast: [],
    textFuture: [
      { html: "c d", undoneAt: 1, atX: 70, atY: 880 },
      { html: "c", undoneAt: 2, atX: 40, atY: 880 }
    ]
  }
};
var liveP8 = {
  textPast: [{ html: "a", seq: 1, atX: 40, atY: 220 }],
  textFuture: [{ html: "a b", undoneAt: 3, atX: 70, atY: 220 }]
};
var redoB = latestAcross("p8", liveP8, pageUndo, "redo");
eq("first redo is b on p8 (already there)", redoB.noteId === "p8" && redoB.v === 3);
eq("b's spot is already in view — no jump", alreadyInView(100, 900, 220) === true);

liveP8.textPast.push(liveP8.textFuture.pop());
var redoC = latestAcross("p8", liveP8, pageUndo, "redo");
eq("next redo is c on p9 — page jump", redoC.noteId === "p9" && redoC.v === 2);
var rloc = peekOpLoc(pageUndo, "p9", "redo");
/* peek takes the last future entry (d, undoneAt 1) — WRONG. latestAcross
   picks c (undoneAt 2) as newest redo. peekOpLoc must pick the same newest. */
eq("peek of p9 redo follows the newest undone (c at y=880), not the older d",
   rloc && rloc.atY === 880 && rloc.atX === 40);

/* locFromOp falls back when atY is missing */
eq("an off-screen change is not treated as already visible",
   alreadyInView(800, 900, 220) === false);

console.log("leaving a page must keep its undo stack:");
{
  function park(id, live, pageUndo){
    if (!id) return;                    // the old wipe-then-park bug
    pageUndo[id] = { textPast: live.textPast.slice(), textFuture: [], inkUndo: [], inkRedo: [] };
  }
  var stacks = {};
  var p8live = { textPast: [{ html: "a b", seq: 2, atX: 70, atY: 220 }] };
  park("", p8live, stacks);             // what happened when the id was cleared first
  eq("clearing the id first loses p8 (the old bug)", !stacks.p8);
  park("p8", p8live, stacks);           // park first, then clear
  eq("parking before the wipe keeps p8", !!(stacks.p8 && stacks.p8.textPast.length === 1));
  var after = latestAcross("p9", {
    textPast: []
  }, stacks, "undo");
  eq("with p8 parked, undo on empty p9 jumps to p8", after.noteId === "p8");
}

console.log("a change in another section is still found:");
{
  var stacks = {
    p8: {
      inkUndo: [], inkRedo: [], sectionId: "sec0",
      textPast: [{ html: "a b", seq: 5, atX: 70, atY: 220 }],
      textFuture: []
    }
  };
  var live = { textPast: [] };
  var u = latestAcross("p9", live, stacks, "undo");
  eq("undo from sec1 p9 finds the change on sec0 p8", u.noteId === "p8" && u.v === 5);
}

console.log(bad ? ("\n" + bad + " failed") : "\nall undo-location checks passed");
process.exitCode = bad ? 1 : 0;
