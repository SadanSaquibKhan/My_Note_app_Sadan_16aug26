/* Tab S10+ S Pen: press the side button to toggle the eraser.
   Hover or nib-down does not matter. A later touch is not a second press. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("source: a press toggles, a later touch does not:");
eq("the press-toggle is named", has(/function barrelPressToggle\(\)/));
/* b125: with the nib on the glass a rise is deliberate and goes straight
   through; hovering, a bit that is gone by the next sample was noise, so it is
   confirmed 40ms later instead of acted on at once. */
eq("a side-button bit flips at once with the nib down, and is confirmed when hovering",
   has(/function barrelBitRose\(e\)/) &&
   has(/if \(penNibOnGlass\(e\)\)\{ barrelPressToggle\(\); return; \}/) &&
   has(/if \(barrel\.lastButtons & \(2 \| 4\)\) barrelPressToggle\(\);/));
eq("a pointerdown that is the barrel also flips",
   has(/if \(\(typ === "pointerdown" \|\| typ === "mousedown"\) && eraserButtonDown\(e\)\)/));
eq("landing on the paper no longer flips",
   !/if \(barrelIsArmed\(\) && Date\.now\(\) - barrel\.at > 40\) barrelContactToggle/.test(html) &&
   has(/Landing on the paper must not flip the eraser/));
eq("lift still does not flip", has(/if \(typ === "pointerup" \|\| typ === "pointercancel"\) return;/));
eq("auxclick / mousedown / keydown all press, none only arm",
   has(/window\.addEventListener\("auxclick"/) &&
   (html.match(/barrelPressToggle\(\)/g) || []).length >= 6);
eq("touchstart is no longer a toggle",
   !/window\.addEventListener\("touchstart"/.test(html) ||
   !/if \(!barrelIsArmed\(\)\) return;/.test(html));
eq("settings text says press, not hold-then-touch",
   has(/Press the side button to turn the eraser on/) &&
   !/Hold the side button with the nib close/.test(html));
eq("help row says press", has(/press: eraser on; press again: last pen/));
eq("the press helper goes through the one shared gate",
   has(/function barrelPressToggle\(\)\{/) &&
   has(/if \(!eraserPress\("the pen's side button"\)\) return false;/));

/* transcribed feed matching applyPenButton */
function machine(){
  const s = {
    lastToggle: 0, on: false, tool: "pen", was: "pen",
    lastButtons: 0, now: 10000, penDown: 0, lastContactEnd: 0,
    holdTimer: false, holdFired: false
  };
  const toggle = () => {
    if (s.now - s.lastToggle < 350) return false;
    s.lastToggle = s.now;
    if (s.on){ s.on = false; s.tool = s.was; }
    else { s.on = true; s.was = s.tool; s.tool = "eraser"; }
    return true;
  };
  function eraserButtonDown(e){
    if ((e.buttons || 0) & 2) return true;
    if ((e.buttons || 0) & 4) return true;
    const typ = e.type || "";
    if (typ === "pointerdown" || typ === "mousedown")
      return e.button === 5 || e.button === 2 || e.button === 1;
    return false;
  }
  function bitRose(e){
    const nowB = e.buttons || 0;
    const added = nowB & ~s.lastButtons;
    return !!(added & (2 | 4));
  }
  function feed(e){
    const typ = e.type || "";
    if (typ === "contextmenu"){
      const long = s.penDown && (s.now - s.penDown) > 250;
      if (long){
        if (!s.holdTimer && !s.holdFired){ toggle(); return; }
        return;
      }
      if (!s.penDown && s.lastContactEnd && (s.now - s.lastContactEnd) < 180) return;
      toggle();
      return;
    }
    const rose = bitRose(e);
    s.lastButtons = e.buttons || 0;
    if (typ === "pointerup" || typ === "pointercancel"){
      if (s.penDown) s.lastContactEnd = s.now;
      s.penDown = 0;
      return;
    }
    if (rose){ toggle(); return; }
    if ((typ === "pointerdown" || typ === "mousedown") && eraserButtonDown(e)){
      toggle();
      return;
    }
    if (typ === "pointerdown" && e.button === 0){
      s.penDown = s.now;
    }
  }
  return {
    s,
    feed,
    tick(ms){ s.now += ms; }
  };
}

console.log("");
console.log("10 simulations of the Tab S10+ S Pen:");

/* 1. hover + button bit: eraser ON immediately, no touch needed */
{
  const m = machine();
  m.feed({ type:"pointermove", buttons:0, pressure:0 });
  m.tick(20);
  m.feed({ type:"pointermove", buttons:2, pressure:0 });
  eq("1a hover+button: eraser ON (no touch)", m.s.tool === "eraser");
  m.tick(80);
  m.feed({ type:"pointerdown", button:0, buttons:3, pressure:0.4 });
  eq("1b later touch: still eraser (not a second flip)", m.s.tool === "eraser");
  m.feed({ type:"pointerup", buttons:0 });
  eq("1c lift: eraser stays", m.s.tool === "eraser");
}

/* 2. same press again turns it off, hover or touch */
{
  const m = machine();
  m.feed({ type:"pointermove", buttons:2, pressure:0 });
  eq("2a first press: on", m.s.tool === "eraser");
  m.feed({ type:"pointerup", buttons:0 });
  m.tick(400);
  m.feed({ type:"pointermove", buttons:2, pressure:0 });
  eq("2b second press: pen back", m.s.tool === "pen");
}

/* 3. W3C: first pointerdown is the button in hover — that IS the press */
{
  const m = machine();
  m.feed({ type:"pointermove", buttons:0, pressure:0 });
  m.tick(10);
  m.feed({ type:"pointerdown", button:2, buttons:2, pressure:0 });
  eq("3a hover button pointerdown: eraser ON", m.s.tool === "eraser");
  m.tick(100);
  m.feed({ type:"pointermove", buttons:2, pressure:0.3 });
  eq("3b tip land after: still eraser", m.s.tool === "eraser");
}

/* 4. nib already on glass, then press the button */
{
  const m = machine();
  m.feed({ type:"pointerdown", button:0, buttons:1, pressure:0.4 });
  m.s.penDown = m.s.now;
  m.tick(80);
  m.feed({ type:"pointermove", buttons:3, pressure:0.4 });
  eq("4 press while writing: eraser ON", m.s.tool === "eraser");
}

/* 5. contextmenu on hover is a press */
{
  const m = machine();
  m.feed({ type:"contextmenu" });
  eq("5 hover contextmenu: eraser ON", m.s.tool === "eraser");
}

/* 6. bits then contextmenu 50ms later is ONE press */
{
  const m = machine();
  m.feed({ type:"pointermove", buttons:2, pressure:0 });
  eq("6a bits: on", m.s.tool === "eraser");
  m.tick(50);
  m.feed({ type:"contextmenu" });
  eq("6b same press contextmenu: still on (not off)", m.s.tool === "eraser");
}

/* 7. held button while moving: only the rising edge flips */
{
  const m = machine();
  m.feed({ type:"pointermove", buttons:2, pressure:0 });
  eq("7a first move with bit: on", m.s.tool === "eraser");
  m.tick(20);
  m.feed({ type:"pointermove", buttons:2, pressure:0 });
  m.tick(20);
  m.feed({ type:"pointermove", buttons:2, pressure:0 });
  eq("7b more moves holding the button: still on", m.s.tool === "eraser");
}

/* 8. lift after writing does not turn it on */
{
  const m = machine();
  m.feed({ type:"pointerdown", button:0, buttons:1, pressure:0.4 });
  m.s.penDown = m.s.now;
  m.tick(30);
  m.feed({ type:"pointerup", buttons:0 });
  m.tick(20);
  m.feed({ type:"contextmenu" });
  eq("8 lift-contextmenu after a write: still the pen", m.s.tool === "pen");
}

/* 9. hover with no button never flips; release never flips */
{
  const m = machine();
  m.feed({ type:"pointermove", buttons:0, pressure:0 });
  m.tick(40);
  m.feed({ type:"pointerup", buttons:0 });
  eq("9 hover and lift with no button: still the pen", m.s.tool === "pen");
}

/* 10. three full press-on / press-off cycles must not stick */
{
  const m = machine();
  let ok = true;
  for (let i = 0; i < 3; i++){
    m.tick(400);
    m.feed({ type:"pointermove", buttons:0 });
    m.feed({ type:"pointermove", buttons:2, pressure:0 });
    if (m.s.tool !== "eraser") ok = false;
    m.feed({ type:"pointerup", buttons:0 });
    m.tick(400);
    m.feed({ type:"pointermove", buttons:0 });
    m.feed({ type:"pointermove", buttons:2, pressure:0 });
    if (m.s.tool !== "pen") ok = false;
    m.feed({ type:"pointerup", buttons:0 });
  }
  eq("10 three on/off cycles stay honest", ok);
}

/* extra: press again while the nib is still on the glass */
{
  const m = machine();
  m.feed({ type:"pointermove", buttons:2 });
  eq("11a hover press: on", m.s.tool === "eraser");
  m.tick(400);
  m.s.penDown = m.s.now;
  m.s.lastButtons = 1;
  m.feed({ type:"pointermove", buttons:3, pressure:0.4 });
  eq("11b press again with nib down: pen back", m.s.tool === "pen");
}

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall S Pen press-toggle checks passed");
