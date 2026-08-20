/* Pass-3 diagnosis sim. Does not touch the app.
   Proves the chip / lasso / eraser / join races that are still in b123.
   Run: node pass3sim.mjs [path-to-index.html] */
import fs from "fs";

const htmlPath = process.argv[2] ||
  "G:/Other computers/My_computer_lab/1_Research_Work_PC_GDrive/1_8_build_stopwatch_pomodoro_study _sound_etc/1_3_Notes_app/files_v12ofhtml_16aug26_7pm/margin-pwa_2026-08-16_v7/margin-pwa_2026-08-16_v7/index.html";
const html = fs.readFileSync(htmlPath, "utf8");

let bad = 0, n = 0;
function eq(label, cond, extra){
  n++;
  if (cond) console.log("  ok   " + label);
  else { bad++; console.log("  FAIL " + label + (extra ? "  :: " + extra : "")); }
}
function src(re, name){
  const m = html.match(re);
  if (!m){ eq("extract " + name, false); return ""; }
  return m[0];
}

const build = (html.match(/var BUILD\s*=\s*"([^"]+)"/) || [])[1] || "?";
console.log("BUILD " + build);
eq("live build is b123+", /b12[3-9]|b1[3-9]\d/.test(build), build);

/* ---------- extract live helpers ---------- */
const p2pSrc = src(/function progressToPlace\(list, prog\)\{[\s\S]*?\n  \}/, "progressToPlace");
const restSrc = src(/function restoreScroll\(top, left\)\{[\s\S]*?\n  \}/, "restoreScroll");
const landSrc = src(/function landOnPage\(frac\)\{[\s\S]*?\n  \}/, "landOnPage");
const seekSrc = src(/function chipSeek\(force\)\{[\s\S]*?\n  \}/, "chipSeek");
const hitSrc  = src(/function boxHitsLasso\(b, poly, full\)\{[\s\S]*?\n  \}/, "boxHitsLasso");
const eraSrc  = src(/function eraserButtonDown\(e\)\{[\s\S]*?\n  \}/, "eraserButtonDown");
const togSrc  = src(/function barrelPressToggle\(\)\{[\s\S]*?\n  \}/, "barrelPressToggle");
const swapSrc = src(/function swapping\(\)\{[\s\S]*?\n  \}/, "swapping");
const goSrc   = src(/function go\(route, replace\)\{[\s\S]*?\n  \}/, "go");
const rendHd  = src(/function render\(\)\{[\s\S]{0,400}/, "render-head");

eq("chipSeek still does go() on a 130ms timer",
   /CHIP_SEEK_MS = 130/.test(html) && /go\(\{ nbId: state\.nbId, noteId: place\.note\.id \}\)/.test(seekSrc));
eq("swapping() is ONLY handover.busy/pending — chip go() is invisible to it",
   /handover\.busy \|\| !!handover\.pending/.test(swapSrc) && !/chipSeek|chipBusy|chipLand/.test(swapSrc));
eq("go() same-hash remounts via render()",
   /if \(location\.hash === h\) return render\(\);/.test(goSrc));
eq("render() writes state.noteId BEFORE the IndexedDB promise",
   /state\.noteId = r\.noteId;/.test(rendHd) &&
   rendHd.indexOf("state.noteId = r.noteId") < rendHd.indexOf("Promise.all"));
/* b124: 0 is a real place - the top of the page - not "nothing to restore".
   Refusing it left a page arrived at by the chip or the up/down buttons
   sitting at whatever scroll the page before it had. */
eq("restoreScroll honours a request for the top of the page",
   !/\(!top && !left\)/.test(restSrc));
eq("hashchange flush+render is not sequenced",
   /hashchange", function\(\)\{ flush\(\); render\(\); \}/.test(html));
eq("no render generation / in-flight token",
   !/renderGen|renderSeq|renderToken|paintGen/.test(html));

/* ---------- 1. progressToPlace join arithmetic ---------- */
console.log("\n[1] chip join arithmetic (two 1500px pages = S1P1 + S1P2)");
function listVirtual(list){ return list.reduce((a,n)=>a+n.h,0); }
function progressToPlace(list, prog){
  const tot = listVirtual(list);
  if (!list.length) return null;
  let pos = Math.max(0, Math.min(1, prog)) * tot, acc = 0;
  for (let i = 0; i < list.length; i++){
    const h = list[i].h;
    if (pos < acc + h || i === list.length - 1)
      return { id: list[i].id, frac: h ? Math.max(0, Math.min(1, (pos - acc) / h)) : 0 };
    acc += h;
  }
}
const sec = [{id:"P1", h:1500},{id:"P2", h:1500}];
const at = p => { const r = progressToPlace(sec, p); return r.id + "@" + r.frac.toFixed(4); };
eq("prog 0.499 → foot of P1", at(0.499) === "P1@0.9980", at(0.499));
eq("prog 0.500 → TOP of P2 (not foot of P1)", at(0.5) === "P2@0.0000", at(0.5));
eq("prog 0.501 → near top of P2", at(0.501) === "P2@0.0020", at(0.501));

/* 1px of a ~700px chip track on a Tab S10+ */
const trackH = 700;
const px = dy => (dy / trackH);
eq("1px above the join is P1 foot", progressToPlace(sec, 0.5 - px(1)).id === "P1");
eq("1px below the join is P2 heading", progressToPlace(sec, 0.5 + px(1)).id === "P2" &&
   progressToPlace(sec, 0.5 + px(1)).frac < 0.01);

/* ---------- 2. chipSeek state machine while render() is in flight ---------- */
console.log("\n[2] chipSeek vs render() — the oscillator, event by event");
function simChipDrag(moves){
  const log = [];
  let stateNoteId = "P2";
  let stateNote = "P2";          // paintDoc has not caught up
  let hash = "#/nb/X/note/P2";
  let chipLand = null;
  let lastSeek = 0;
  let t = 0;
  const inflight = [];
  let goCount = 0, landCount = 0, remounts = 0;
  let scrollOf = { P1: null, P2: 1400 }; // leftover foot of P2
  function restoreScroll(top){
    if (!top){ log.push(t + " restoreScroll(0) NO-OP, leftover=" + scrollOf[stateNote]); return "noop"; }
    scrollOf[stateNote] = top;
    log.push(t + " restoreScroll(" + top.toFixed(0) + ") on visual " + stateNote);
    return "ok";
  }
  function landOnPage(frac){
    landCount++;
    /* landOnPage uses state.note (old) not state.noteId (new) */
    const h = 1500;
    const top = frac * h;
    scrollOf[stateNote] = top;
    log.push(t + " landOnPage(" + frac.toFixed(3) + ") writes visual " + stateNote +
             " (state.noteId=" + stateNoteId + ")");
  }
  function go(id){
    goCount++;
    const h = "#/nb/X/note/" + id;
    if (hash === h){
      remounts++;
      log.push(t + " go(" + id + ") SAME HASH → render() remount #" + remounts);
      inflight.push({ id, land: chipLand, started: t });
      return;
    }
    hash = h;
    /* render() sets noteId immediately */
    stateNoteId = id;
    log.push(t + " go(" + id + ") hashchange, noteId now " + id +
             " visual still " + stateNote + " chipLand=" + chipLand);
    inflight.push({ id, land: chipLand, started: t });
  }
  function finishOldest(){
    if (!inflight.length) return;
    const job = inflight.shift();
    stateNote = job.id;
    const land = job.land;
    log.push(t + " paintDoc(" + job.id + ") land=" + land);
    if (land != null) restoreScroll(land * 1500);
  }
  function seek(force, place){
    if (place.id === stateNoteId){ landOnPage(place.frac); return; }
    if (!force){
      if (t - lastSeek < 130) return;
    }
    lastSeek = t;
    chipLand = place.frac;
    go(place.id);
  }
  for (const m of moves){
    t = m.t;
    if (m.paint) finishOldest();
    if (m.prog != null){
      const place = progressToPlace(sec, m.prog);
      seek(!!m.force, place);
    }
  }
  return { log, goCount, landCount, remounts, scrollOf, stateNoteId, stateNote };
}

/* Finger starts on S1P2 (prog 0.72) and drags toward S1P1, jittering at the join. */
const drag = [];
let tt = 0;
for (let prog = 0.72; prog >= 0.35; prog -= 0.02){
  drag.push({ t: tt, prog });
  tt += 16;                         /* 60Hz samples */
  if (tt === 80 || tt === 240 || tt === 400) drag.push({ t: tt, paint: true });
}
/* 8px of jitter around the join for 200ms */
for (let i = 0; i < 12; i++){
  drag.push({ t: tt, prog: 0.5 + (i % 2 === 0 ? 0.004 : -0.004) });
  tt += 16;
  if (i === 5 || i === 11) drag.push({ t: tt, paint: true });
}
const r = simChipDrag(drag);
console.log("   go() calls: " + r.goCount + "   landOnPage: " + r.landCount +
            "   same-hash remounts: " + r.remounts);
console.log("   last visual " + r.stateNote + "  noteId " + r.stateNoteId +
            "  P1 scroll=" + r.scrollOf.P1 + "  P2 scroll=" + r.scrollOf.P2);
r.log.filter(l => /go\(|paintDoc|NO-OP|landOnPage/.test(l)).slice(0, 24)
     .forEach(l => console.log("   · " + l));
eq("a slow drag across one join fires go() more than once", r.goCount >= 2, "go=" + r.goCount);
eq("jitter at 0.5 produces both P1 and P2 seeks",
   r.log.some(l => /go\(P1\)/.test(l)) && r.log.some(l => /go\(P2\)/.test(l)));
eq("landOnPage during in-flight writes the OLD visual page",
   r.log.some(l => /landOnPage.*visual P2 \(state\.noteId=P1\)/.test(l)));
eq("chipLand=0 at the join now really scrolls to the top",
   !r.log.some(l => /restoreScroll\(0\) NO-OP/.test(l)));

/* ---------- 3. lasso AABB vs drawn box ---------- */
console.log("\n[3] lasso pick + snap + bar cover");
function pointInPoly(x, y, poly){
  let inside = false;
  for (let i = 0, j = poly.length/2 - 1; i < poly.length/2; j = i++){
    const xi = poly[i*2], yi = poly[i*2+1], xj = poly[j*2], yj = poly[j*2+1];
    const inter = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (inter) inside = !inside;
  }
  return inside;
}
function boxHitsLasso(b, poly, full){
  const corners = [[b.minX,b.minY],[b.maxX,b.minY],[b.maxX,b.maxY],[b.minX,b.maxY]];
  let hit = 0;
  for (const c of corners) if (pointInPoly(c[0], c[1], poly)) hit++;
  if (full) return hit === 4;
  if (hit) return true;
  const xs = [], ys = [];
  for (let i = 0; i < poly.length; i += 2){ xs.push(poly[i]); ys.push(poly[i+1]); }
  const lb = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  return !(lb.maxX < b.minX || lb.minX > b.maxX || lb.maxY < b.minY || lb.minY > b.maxY);
}
const para = { minX: 40, minY: 80, maxX: 740, maxY: 420 };   /* a long typed <p> */
const drawn = [520, 360, 700, 360, 700, 400, 520, 400];      /* last few words */
eq("partial mode: last-line box still picks the whole <p> (AABB)",
   boxHitsLasso(para, drawn, false));
eq("full mode: last-line box does NOT pick the <p> (no corner inside)",
   !boxHitsLasso(para, drawn, true));
eq("default cfg.lassoContain is partial",
   /lassoContain:\s*"partial"/.test(html));

/* after snap, handles sit on the <p>, bar parks at top-centre */
const snap = para;
const handleN = { x: (snap.minX+snap.maxX)/2, y: snap.minY };
const drawnMid = { x: 610, y: 380 };
const bar = { x: handleN.x, y: handleN.y, w: 320, h: 48 }; /* placeLassoPop: y - h - 16 */
const barRect = { minX: bar.x - bar.w/2, maxX: bar.x + bar.w/2,
                  minY: handleN.y - bar.h - 16, maxY: handleN.y - 16 };
eq("N handle is under the floating bar",
   handleN.x >= barRect.minX && handleN.x <= barRect.maxX &&
   handleN.y >= barRect.minY - 8 && handleN.y <= barRect.maxY + 36);
eq("the words they boxed are far from every snap handle",
   Math.hypot(drawnMid.x - snap.minX, drawnMid.y - snap.minY) > 200 &&
   Math.hypot(drawnMid.x - snap.maxX, drawnMid.y - snap.maxY) > 80);
eq("placeLassoPop still parks at top-centre of the poly",
   /y - h - 16/.test(html) && /pageToClient\(lasso\.surface, \(b\.minX \+ b\.maxX\) \/ 2, b\.minY\)/.test(html));
eq("lassoSnapBox still replaces the drawn poly",
   /lasso\.poly = \[x0, y0, x1, y0, x1, y1, x0, y1\]/.test(html));
eq("S.end of maybeReplace still clears the catch",
   /if \(d\.maybeReplace\)\{\s*\n        lassoClear\(\);/.test(html));

/* − button shrinks toward NW (se handle, f<1) so handles walk toward the words */
function boxFromSe(ob, f){
  return { minX: ob.minX, minY: ob.minY,
           maxX: ob.minX + (ob.maxX-ob.minX)*f,
           maxY: ob.minY + (ob.maxY-ob.minY)*f };
}
const afterMinus = boxFromSe(snap, 1/1.15);
eq("one tap of − walks the SE corner closer to the boxed words",
   Math.hypot(drawnMid.x - afterMinus.maxX, drawnMid.y - afterMinus.maxY) <
   Math.hypot(drawnMid.x - snap.maxX, drawnMid.y - snap.maxY));

/* ---------- 4. eraser doors ---------- */
console.log("\n[4] eraser door races");
eq("pointerType===eraser is treated as the side button",
   /if \(e\.pointerType === "eraser"\) return true;/.test(eraSrc));
/* b124: widened to 550ms. One physical press arrives as a crowd of events
   and on a page this size a slow frame can push the tail of that crowd past
   350ms, where a straggler reads as a second press and undoes the first. */
eq("barrel mute coalesces one press", /Date\.now\(\) - barrel\.lastToggle < PRESS_ONE_MS/.test(togSrc));
eq("togglePenEraser mute is a different 250ms clock",
   /if \(t - lastPenToggle < 250\) return;/.test(html));
eq("contextmenu + looksLikeLongPress still calls barrelPressToggle",
   /if \(looksLikeLongPress\(\)\)\{[\s\S]{0,220}barrelPressToggle\(\)/.test(html));
eq("springEraseOff listens to pointerleave",
   /\["pointerup", "pointercancel", "pointerleave"\]\.forEach\(function\(evt\)\{[\s\S]{0,180}springEraseOff\(\)/.test(html));
eq("keydown Unidentified is a button press",
   /k === "Unidentified"/.test(html));
eq("applyPenButton is on document pointermove AND pointerrawupdate AND the scroller",
   /pointerrawupdate/.test(html) &&
   (html.match(/applyPenButton\(e\)/g) || []).length >= 3);
eq("three separate was-fields still exist",
   /btnSpring\.was/.test(html) && /tapErase\.was/.test(html) && /springErase\.was/.test(html));
eq("double-tap flips ink.tool itself, not togglePenEraser",
   /ink\.tool = \(ink\.tool === "eraser"\) \? \(tapErase\.was \|\| "pen"\) : "eraser";/.test(html));

/* simulate one physical barrel press arriving as three events */
function simBarrelPress(events){
  let tool = "pen", lastBarrel = -1e9, lastTap = -1e9;
  const flips = [];
  function barrelPressToggle(t, why){
    if (t - lastBarrel < 350){ flips.push(t+":mute350 "+why); return; }
    lastBarrel = t;
    tool = tool === "eraser" ? "pen" : "eraser";
    flips.push(t+":barrel→"+tool+" via "+why);
  }
  function togglePenEraser(t, why){
    if (t - lastTap < 250){ flips.push(t+":mute250 "+why); return; }
    lastTap = t;
    tool = tool === "eraser" ? "pen" : "eraser";
    flips.push(t+":tap→"+tool+" via "+why);
  }
  for (const ev of events){
    if (ev.fn === "barrel") barrelPressToggle(ev.t, ev.why);
    else togglePenEraser(ev.t, ev.why);
  }
  return { tool, flips };
}
const onePress = simBarrelPress([
  { t: 0, fn:"barrel", why:"auxclick" },
  { t: 18, fn:"tap",    why:"contextmenu-hold" },  /* 250 clock empty, 350 would have muted */
  { t: 22, fn:"barrel", why:"mousedown-2" }
]);
console.log("   one physical press: " + onePress.flips.join(" | ") + "  final=" + onePress.tool);
eq("one physical press can flip ON then OFF (looks like the button does nothing)",
   onePress.tool === "pen" && onePress.flips.filter(f => /→/.test(f)).length >= 2);

const eraserTip = { pointerType:"eraser", buttons:1, type:"pointerdown", button:0 };
function eraserButtonDown(e){
  if (!e) return false;
  if (e.pointerType === "eraser") return true;
  const b = e.buttons || 0;
  if (b & 32) return true;
  if (b & 2) return true;
  if (b & 4) return true;
  const typ = e.type || "";
  if (typ === "pointerdown" || typ === "mousedown")
    return e.button === 5 || e.button === 2 || e.button === 1;
  return false;
}
eq("a writing-tip event reported as type=eraser counts as a button press",
   eraserButtonDown(eraserTip) === true);

/* ---------- 5. finger join ---------- */
console.log("\n[5] finger join");
eq("pageHandover still stopGlide() and does not startGlide after",
   /if \(typeof stopGlide === "function"\) stopGlide\(\);/.test(html) &&
   !/startGlide\(noteSurface/.test(html) &&
   !/startGlide\(handover/.test(html));
eq("finishHandover still recomputes pageBottom every rAF when dir<0",
   /if \(pend\.dir < 0\)\{[\s\S]{0,180}pageBottom/.test(html));
eq("fingerPanMove still uses the pointerdown pan.top",
   /S\.scroller\.scrollTop = pan\.top - \(e\.clientY - pan\.y\)/.test(html));
eq("finishHandover does not rebase pan.top",
   !/pan\.top\s*=/.test(html.match(/function finishHandover[\s\S]*?function watchPad/)[0]));
eq("stillHeld settle sets padWatch.skip = false on the first frame",
   /if \(stillHeld\)\{[\s\S]{0,160}padWatch\.skip = false/.test(html));
eq("pageHandover skips while chipDrag, but chip go() never sets handover.busy",
   /if \(chipDrag\) return;/.test(html) &&
   !/handover\.busy = true/.test(seekSrc));

/* ---------- 6. chips.mjs is a false green ---------- */
console.log("\n[6] the existing chip tests document the bug");
const chipsTest = fs.existsSync("C:/Users/khans/AppData/Local/Temp/mtest/chips.mjs")
  ? fs.readFileSync("C:/Users/khans/AppData/Local/Temp/mtest/chips.mjs","utf8") : "";
eq("chips.mjs currently requires the 130ms go()-on-drag path",
   /CHIP_SEEK_MS = 130/.test(chipsTest) && /the page follows the chip while you drag/.test(chipsTest));

console.log("\n" + n + " checks, " + bad + " failed (failed = live code still has the bug, which is the point)");
process.exitCode = 0;   /* this file is a diagnosis, not a gate */
