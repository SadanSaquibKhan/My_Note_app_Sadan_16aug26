/* The S Pen eraser. Three gestures reach it (side button, hold the nib still,
   double tap) and they used to be three machines with three memories and two
   clocks. This transcribes the routing twice — as it was at b124 and as it is
   now — so each scenario shows the bug it was hiding rather than only asserting
   that today's code passes. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

function makePen(mode){
  const NEW = mode === "new";
  const ink = { tool: "pen", lastPenAt: -99999 };
  const tapErase = { was: "pen" }, springErase = { on: false, was: null };
  const btnSpring = { on: false, was: null };
  const barrel = { lastButtons: 0, lastType: false };
  const PRESS_ONE_MS = 550, TAP_MS = 250;
  let now = 0, toggles = 0, eraserReturn = null, pressAt = -99999, tapAt = -99999;
  let penDown = 0, pendingFlash = null;

  /* ---- the core ---- */
  function onErase(why){
    if (ink.tool === "eraser") return false;
    eraserReturn = ink.tool; btnSpring.on = true; btnSpring.was = ink.tool;
    ink.tool = "eraser"; return true;
  }
  function offErase(){
    btnSpring.on = false;
    if (ink.tool !== "eraser") return false;
    ink.tool = (NEW ? eraserReturn : btnSpring.was) || "pen";
    eraserReturn = null; return true;
  }
  const toggle = why => { toggles++; ink.tool === "eraser" ? offErase() : onErase(why); };
  /* NEW: one gate. OLD: barrel had 550, tap had its own 250. */
  function pressBarrel(){
    if (now - pressAt < PRESS_ONE_MS) return false;
    pressAt = now; if (NEW) tapAt = now;
    toggle("button"); return true;
  }
  function pressTap(){
    if (NEW){ return pressBarrel(); }
    if (now - tapAt < TAP_MS) return false;
    tapAt = now; toggles++;
    ink.tool = ink.tool === "eraser" ? (tapErase.was || "pen") : "eraser";
    return true;
  }
  /* ---- what counts as the side button ---- */
  function btnDown(e){
    const b = e.buttons || 0;
    if (!NEW && e.pointerType === "eraser") return true;   /* old: type alone counted */
    if (!NEW && (b & 32)) return true;
    if (b & 2 || b & 4) return true;
    if (e.type === "pointerdown" || e.type === "mousedown")
      return NEW ? (e.button === 2 || e.button === 1)
                 : (e.button === 5 || e.button === 2 || e.button === 1);
    return false;
  }
  const rose = e => !!(((e.buttons || 0) & ~barrel.lastButtons) & (2 | 4));
  const nibOn = e => !!((e.buttons || 0) & 1);

  function apply(e){
    const isPen = e.pointerType === "pen" || e.pointerType === "eraser";
    if (!(isPen || now - ink.lastPenAt < 2500)) return;
    const typ = e.type || "";
    const prevB = barrel.lastButtons;
    let r = false, tRose = false;
    if (isPen && typ !== "pointerup" && typ !== "pointercancel"){
      r = rose(e);
      if (NEW) tRose = e.pointerType === "eraser" && !barrel.lastType;
      barrel.lastButtons = e.buttons || 0;
      barrel.lastType = e.pointerType === "eraser";
    }
    if (typ === "pointerup" || typ === "pointercancel") return;
    if (NEW && tRose){ pressBarrel(); return; }
    if (r){
      if (!NEW || nibOn(e)){ pressBarrel(); return; }
      pendingFlash = now;             /* hovering: confirm 40ms later */
      return;
    }
    if ((typ === "pointerdown" || typ === "mousedown") && btnDown(e)){
      if (!NEW || !(prevB & (2 | 4))) pressBarrel();
    }
  }
  return {
    at(t){
      now = t;
      if (pendingFlash != null && now - pendingFlash >= 40){
        pendingFlash = null;
        if (barrel.lastButtons & (2 | 4)) pressBarrel();
      }
      return this;
    },
    ev(e){ if (e.pointerType === "pen") ink.lastPenAt = now;
           if (e.type === "pointerdown" && (e.buttons & 1)) penDown = now;
           if (e.type === "pointerup") penDown = 0;
           apply(e); return this; },
    ctx(){   /* a contextmenu on #paper */
      if (NEW){ if (penDown) return; }        /* nib on the glass is never the button */
      pressBarrel(); return this;
    },
    dtap(){ pressTap(); return this; },
    key(k){ if (k === "Unidentified" && NEW) return this; pressBarrel(); return this; },
    pick(t){ ink.tool = t; return this; },
    tool: () => ink.tool, toggles: () => toggles
  };
}
const hoverIdle   = { type: "pointermove", pointerType: "pen", buttons: 0 };
const hoverPress  = { type: "pointermove", pointerType: "pen", buttons: 2 };
const hoverAsEr   = { type: "pointermove", pointerType: "eraser", buttons: 0 };
const nibDownEr   = { type: "pointerdown", pointerType: "eraser", buttons: 1, button: 0 };
const nibUpEr     = { type: "pointerup",   pointerType: "eraser", buttons: 0 };

console.log("press on, press off:");
{
  const p = makePen("new");
  p.at(0).ev(hoverIdle).at(100).ev(hoverPress).at(160);
  eq("one press turns the eraser on", p.tool() === "eraser");
  p.at(2000).ev(hoverIdle).at(2100).ev(hoverPress).at(2160);
  eq("the next press brings the pen back", p.tool() === "pen");
}

console.log("");
console.log("the pen that calls itself an eraser while the button is held:");
for (const mode of ["old", "new"]){
  const p = makePen(mode);
  p.at(0).ev(hoverIdle);
  p.at(100).ev(hoverAsEr);          /* button pressed: type flips to eraser */
  p.at(400).ev(nibDownEr);          /* now touch the page to rub something out */
  p.at(900).ev(nibUpEr);
  p.at(1000).ev(hoverAsEr);         /* still held */
  p.at(1400).ev(nibDownEr);         /* second rub */
  if (mode === "new")
    eq("new: one press, erasing throughout", p.toggles() === 1 && p.tool() === "eraser");
  else
    eq("old: every touch counted as a press (the bug)", p.toggles() > 1);
}

console.log("");
console.log("a contextmenu while the nib is on the glass is not the button:");
for (const mode of ["old", "new"]){
  const p = makePen(mode);
  p.at(100).ev({ type: "pointerdown", pointerType: "pen", buttons: 1, button: 0 });
  p.at(500).ctx();                  /* slow, still start of a letter */
  if (mode === "new") eq("new: still writing", p.tool() === "pen" && p.toggles() === 0);
  else eq("old: the eraser came on while writing (the bug)", p.tool() === "eraser");
}

console.log("");
console.log("one press through two different doors is one press:");
for (const mode of ["old", "new"]){
  const p = makePen(mode);
  p.at(0).ev(hoverIdle);
  p.at(100).ev(hoverPress).at(160);      /* the bit → eraser */
  p.at(360).dtap();                      /* the same press reaching the tap door */
  if (mode === "new") eq("new: counted once, still erasing", p.toggles() === 1 && p.tool() === "eraser");
  else eq("old: two clocks let it cancel itself (the bug)", p.toggles() === 2 && p.tool() === "pen");
}

console.log("");
console.log("the button and the double tap share one memory:");
for (const mode of ["old", "new"]){
  const p = makePen(mode);
  p.pick("marker");
  p.at(0).ev(hoverIdle).at(100).ev(hoverPress).at(160);   /* button on, was marker */
  p.at(3000).dtap();                                      /* double tap turns it off */
  if (mode === "new") eq("new: the marker comes back", p.tool() === "marker");
  else eq("old: a different tool came back (the bug)", p.tool() !== "marker");
}

console.log("");
console.log("a one-sample bit flash while hovering is noise, not a press:");
{
  const p = makePen("new");
  p.at(0).ev(hoverIdle);
  p.at(100).ev(hoverPress);        /* a flash… */
  p.at(110).ev(hoverIdle);         /* …gone by the next sample */
  p.at(200);
  eq("nothing happened", p.toggles() === 0 && p.tool() === "pen");
}
{
  const p = makePen("new");
  p.at(0).ev(hoverIdle);
  p.at(100).ev(hoverPress);        /* a real press… */
  p.at(110).ev(hoverPress);        /* …still held on the next sample */
  p.at(200);
  eq("a held button still gets through", p.toggles() === 1 && p.tool() === "eraser");
}
{
  const p = makePen("new");
  p.at(0).ev(hoverIdle);
  p.at(100).ev(hoverPress);        /* pressed, then the pen goes away entirely */
  p.at(200);
  eq("a press with nothing after it still counts", p.toggles() === 1);
}

console.log("");
console.log("stray Android keys do not erase:");
{
  const p = makePen("new");
  p.at(0).ev(hoverIdle).at(100).key("Unidentified").at(200);
  eq("Unidentified is ignored", p.toggles() === 0);
  p.at(1000).key("ContextMenu").at(1100);
  eq("a real ContextMenu key still works", p.toggles() === 1);
}

console.log("");
console.log("after picking a pen by hand, ONE press erases:");
{
  const p = makePen("new");
  p.at(0).ev(hoverIdle).at(100).ev(hoverPress).at(160);
  p.pick("pencil");
  p.at(3000).ev(hoverIdle).at(3100).ev(hoverPress).at(3160);
  eq("one press erases", p.tool() === "eraser");
}

console.log("");
console.log("the pen is still the pen when it calls itself an eraser:");
/* The button was never really the problem in the end. Chrome renames the
   pointer to "eraser" for as long as the side button is held, and every gate
   that asked "is this the pen" by testing the string "pen" stopped recognising
   it at exactly the moment the button was down. mayDraw refused the stroke, so
   the toolbar lit up and rubbing removed nothing; and the nib landing fell into
   the branch meant for a finger, which hands over to typing. Proved in a
   browser: on the build before this, three strokes drawn and then rubbed with
   the button held still left every stroke on the page. */
eq("there is one answer to what counts as the pen",
   has(/function isPenType\(e\)\{/) &&
   has(/return !!e && \(e\.pointerType === "pen" \|\| e\.pointerType === "eraser"\);/));
eq("drawing accepts it, so it can actually erase",
   has(/var t = isPenType\(e\) \? "pen" : \(e\.pointerType \|\| "mouse"\);/));
eq("the nib landing is not mistaken for a finger",
   has(/if \(isPenType\(e\)\)\{ penDetected\(e\); applyPenButton\(e\); armPenHold\(S, e\); \}/));
eq("hover, move and over all recognise it too",
   has(/sc\.addEventListener\("pointermove", function\(e\)\{\s*if \(isPenType\(e\)\)\{/) &&
   has(/if \(!isPenType\(e\)\) moveHold\(e\);/) &&
   has(/sc\.addEventListener\("pointerover", function\(e\)\{\s*if \(isPenType\(e\)\)\{/));
eq("turning the eraser off ends the hold, so a later lift cannot cancel a latch",
   has(/springErase\.on = false; springErase\.was = null;\s*btnSpring\.on = false; btnSpring\.was = null;/));

console.log("");
console.log("wired that way in the file:");
eq("one clock for every door", has(/var eraserPressAt = 0;/) &&
   has(/if \(t - eraserPressAt < PRESS_ONE_MS\) return false;/) &&
   !/barrel\.lastToggle/.test(html) && !/lastPenToggle/.test(html));
eq("one memory of the tool to come back to", has(/var eraserReturn = null;/) &&
   has(/ink\.tool = eraserReturn \|\| "pen";/) && !/function penToComeBackTo/.test(html));
eq("the toggle asks the tool, not a flag",
   has(/function eraserToggle\(why\)\{\s*\n    if \(ink\.tool === "eraser"\) eraserOff\(\); else eraserOn\(why \|\| "the pen"\);/));
/* "is the side button down" and "is this end erasing" are different questions.
   The first is asked on every event, so a lasting state must not answer it or
   every nib-down reads as another press. The second is a state, and only the
   moment it turns on counts. */
eq("the side button is bits only, never a lasting erase state",
   /function eraserButtonDown\(e\)\{[\s\S]*?\n  \}/.exec(html) &&
   !/function eraserButtonDown\(e\)\{[\s\S]*?pointerType === "eraser"[\s\S]*?\n  \}/.test(
     /function eraserButtonDown\(e\)\{[\s\S]*?\n  \}/.exec(html)[0]));
eq("erase mode covers both the renamed pointer and the eraser bit",
   has(/function penInEraseMode\(e\)\{/) &&
   has(/if \(e\.pointerType === "eraser"\) return true;\s*\n    return !!\(\(e\.buttons \|\| 0\) & 32\);/));
eq("entering erase mode is the press, counted once",
   has(/typeRose = penInEraseMode\(e\) && !barrel\.lastType;/) &&
   has(/barrel\.lastType = penInEraseMode\(e\);/));
eq("a hovering bit flash is confirmed before it counts",
   has(/if \(penNibOnGlass\(e\)\)\{ barrelPressToggle\(\); return; \}/) &&
   has(/if \(barrel\.lastButtons & \(2 \| 4\)\) barrelPressToggle\(\);/));
eq("contextmenu with the nib down is the hold gesture, not the button",
   has(/if \(penDown \|\| looksLikeLongPress\(\)\)\{/));
eq("Unidentified no longer erases", !/k === "Unidentified"/.test(html));
eq("the double tap goes through the one door", has(/eraserToggle\("a double tap"\);/));
eq("hold-still goes through it too", has(/eraserOn\("holding the nib down"\);/) &&
   has(/function springEraseOff\(\)\{[\s\S]{0,200}?eraserOff\(\);/));
eq("crossing onto a toolbar no longer cancels a hold mid-rub",
   has(/if \(penNibOnGlass\(e\) \|\| penDown\) return;  \/\* still writing \*\//));
eq("the setting still switches the button off", has(/if \(cfg\.penButtonErase === false\) return false;/));

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall pen-button checks passed");
