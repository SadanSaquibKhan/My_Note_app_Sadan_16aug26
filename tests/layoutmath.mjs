/* Pure geometry contract for Margin's docked Strip, working sheet and page.

   This intentionally uses no DOM. Synthetic browser panes have lied about
   requestAnimationFrame, fixed positioning and computed heights; these tests
   pin only the arithmetic that production geometry must call with real device
   measurements. */

import assert from "node:assert/strict";

let bad = 0;
function check(label, fn){
  try {
    fn();
    console.log("  ok   " + label);
  } catch (err){
    bad++;
    console.log("  FAIL " + label);
    console.log("       " + err.message);
  }
}

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function sheetHeight(state, {paperHeight, oppositeInset=0, customHeight=null,
                             stripPx=132, chromePx=46} = {}){
  if (!["hidden","strip","half","full"].includes(state))
    throw new Error("unknown sheet state: " + state);
  if (state === "hidden") return null;
  const paper = Math.max(0, Number(paperHeight) || 0);
  const room = Math.max(0, paper - clamp(Number(oppositeInset) || 0, 0, paper));
  const strip = Math.min(room, Math.max(0, Number(stripPx) || 0));
  const full = Math.max(strip, room - Math.min(room, Math.max(0, Number(chromePx) || 0)));
  if (state === "strip") return Math.round(strip);
  if (state === "full") return Math.round(full);
  const wanted = customHeight == null ? room * 0.52 : Number(customHeight);
  return Math.round(clamp(Number.isFinite(wanted) ? wanted : room * 0.52, strip, full));
}

function rect(top, bottom){
  top = Number(top) || 0;
  bottom = Number(bottom) || 0;
  return {top, bottom, height:Math.max(0, bottom - top)};
}

/* A top dock counts only when it actually covers the paper's top edge; a
   bottom dock counts only when it covers the bottom edge. An overlay rendered
   entirely below the paper by a transformed ancestor contributes zero. */
function edgeInset(paper, overlay, edge){
  if (!paper || !overlay || overlay.hidden) return 0;
  const eps = 0.5;
  if (edge === "top"){
    if (overlay.top > paper.top + eps || overlay.bottom <= paper.top) return 0;
    return clamp(Math.min(paper.bottom, overlay.bottom) - paper.top, 0, paper.height);
  }
  if (edge === "bottom"){
    if (overlay.bottom < paper.bottom - eps || overlay.top >= paper.bottom) return 0;
    return clamp(paper.bottom - Math.max(paper.top, overlay.top), 0, paper.height);
  }
  throw new Error("unknown dock edge: " + edge);
}

function clampDockInsets(height, topRequested, bottomRequested){
  const full = Math.max(0, Number(height) || 0);
  const top = clamp(Number(topRequested) || 0, 0, full);
  const bottom = clamp(Number(bottomRequested) || 0, 0, full - top);
  return {topInset:top, bottomInset:bottom, height:full - top - bottom};
}

function usableViewport(paper, topDock, bottomDock){
  const c = clampDockInsets(paper.height,
    edgeInset(paper, topDock, "top"), edgeInset(paper, bottomDock, "bottom"));
  return {
    top:paper.top + c.topInset,
    bottom:paper.bottom - c.bottomInset,
    height:c.height,
    topInset:c.topInset,
    bottomInset:c.bottomInset
  };
}

function pageTopBase(prevPad, viewport){ return prevPad - viewport.topInset; }
function pageScroll(frac, pageHeight, zoom, prevPad, viewport){
  const span = Math.max(0, pageHeight * zoom - viewport.height);
  return pageTopBase(prevPad, viewport) + clamp(frac, 0, 1) * span;
}
function pageFrac(scrollTop, pageHeight, zoom, prevPad, viewport){
  const span = Math.max(0, pageHeight * zoom - viewport.height);
  if (span === 0) return 0;
  return clamp((scrollTop - pageTopBase(prevPad, viewport)) / span, 0, 1);
}
function savePageY(scrollTop, prevPad, zoom, viewport){
  return (scrollTop - prevPad + viewport.topInset) / zoom;
}
function restorePageY(pageY, prevPad, zoom, viewport){
  return prevPad - viewport.topInset + pageY * zoom;
}

console.log("four sheet heights from explicit dock room:");
check("b178 baseline is hidden null, strip 132, half 520, full 954", () => {
  assert.deepEqual(["hidden","strip","half","full"].map(state =>
    sheetHeight(state, {paperHeight:1000})), [null,132,520,954]);
});
check("the opposite top Strip reduces a bottom sheet's room exactly once", () => {
  assert.equal(sheetHeight("half", {paperHeight:1000,oppositeInset:120}), 458);
  assert.equal(sheetHeight("full", {paperHeight:1000,oppositeInset:120}), 834);
});
check("a dragged Half height is clamped and cannot leak into Strip or Full", () => {
  assert.equal(sheetHeight("half", {paperHeight:900,customHeight:10}), 132);
  assert.equal(sheetHeight("half", {paperHeight:900,customHeight:2000}), 854);
  assert.equal(sheetHeight("strip", {paperHeight:900,customHeight:500}), 132);
  assert.equal(sheetHeight("full", {paperHeight:900,customHeight:500}), 854);
});
check("tiny screens never produce a negative or over-room height", () => {
  for (const state of ["strip","half","full"]){
    const h = sheetHeight(state, {paperHeight:40});
    assert.ok(h >= 0 && h <= 40);
  }
});

console.log("Strip intersection and dock clamping:");
const paper = rect(80, 1080);
check("a 132px Strip touching the paper top contributes exactly 132px", () => {
  assert.equal(edgeInset(paper, rect(80,212), "top"), 132);
});
check("a fixed element rendered below the paper contributes no false inset", () => {
  assert.equal(edgeInset(paper, rect(1080,1212), "top"), 0);
});
check("an off-screen or hidden dock contributes no inset", () => {
  assert.equal(edgeInset(paper, rect(-100,-10), "top"), 0);
  assert.equal(edgeInset(paper, {...rect(80,212),hidden:true}, "top"), 0);
});
check("top and bottom docks are subtracted once and never make height negative", () => {
  assert.deepEqual(usableViewport(paper, rect(80,212), rect(780,1080)),
    {top:212,bottom:780,height:568,topInset:132,bottomInset:300});
  assert.deepEqual(clampDockInsets(500,400,400),
    {topInset:400,bottomInset:100,height:0});
});
check("a floating bottom overlay that does not touch the bottom is not a dock", () => {
  assert.equal(edgeInset(paper, rect(500,900), "bottom"), 0);
});

console.log("page fraction and remembered-place round trips:");
const open = usableViewport(paper, rect(80,220), rect(820,1080));
const clean = usableViewport(paper, null, null);
const prevPad = 1100, zoom = 1.5, height = 1500;
for (const f of [0,0.1,0.25,0.5,0.9,1]){
  check("page fraction round-trips at " + f, () => {
    assert.ok(Math.abs(pageFrac(pageScroll(f,height,zoom,prevPad,open),
      height,zoom,prevPad,open) - f) < 1e-10);
  });
}
check("page head and foot align to the unobscured top and bottom", () => {
  const headScreen = paper.top + prevPad - pageScroll(0,height,zoom,prevPad,open);
  const footScreen = paper.top + prevPad + height*zoom - pageScroll(1,height,zoom,prevPad,open);
  assert.equal(headScreen, open.top);
  assert.equal(footScreen, open.bottom);
});
check("a place saved with docks restores to the same page-space point without them", () => {
  const pageY = 420;
  const withDocks = restorePageY(pageY, prevPad, zoom, open);
  const recorded = savePageY(withDocks, prevPad, zoom, open);
  const withoutDocks = restorePageY(recorded, prevPad, zoom, clean);
  assert.equal(recorded, pageY);
  assert.equal(savePageY(withoutDocks, prevPad, zoom, clean), pageY);
});
check("a page shorter than the usable viewport has one non-scrollable fraction", () => {
  const y = pageScroll(0.8, 300, 1, prevPad, open);
  assert.equal(y, pageTopBase(prevPad, open));
  assert.equal(pageFrac(y, 300, 1, prevPad, open), 0);
});

process.exitCode = bad ? 1 : 0;

