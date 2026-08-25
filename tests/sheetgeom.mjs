/* Pure geometry and lifecycle model for docked Margin sheets.

   This intentionally does not read index.html and does not need a DOM. It pins
   the contract that the implementation must satisfy:
   - Hidden / Strip / Half / Full are four named states measured in pixels.
   - Summary tabs dock at the top; working tabs dock at the bottom.
   - At most three named tabs survive, each with its own page, place and size.
   - A switch captures and flushes the outgoing owner before replacing it.
   - Scroll is restored only after HTML, images, ink and one layout settle.
   - A stale asynchronous open or close cannot overwrite a newer one. */

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

const STATES = Object.freeze(["hidden", "strip", "half", "full"]);

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

/* A dragged custom height remains data on the tab, not a fifth global state.
   It refines Half; choosing Strip or Full still has one unambiguous meaning. */
function stateHeight(state, available, opts = {}){
  if (!STATES.includes(state)) throw new Error("unknown sheet state: " + state);
  available = Math.max(0, Number(available) || 0);
  const strip = Math.min(available, Math.max(0, Number(opts.stripPx ?? 72) || 0));
  if (state === "hidden") return 0;
  if (state === "strip") return strip;
  if (state === "full") return available;
  const wanted = opts.customHeight == null
    ? Math.round(available * 0.5)
    : Number(opts.customHeight);
  return clamp(wanted, strip, available);
}

function dockFor(kind){
  if (kind === "summary" || kind === "short") return "top";
  if (kind === "working" || kind === "rough") return "bottom";
  throw new Error("unknown sheet kind: " + kind);
}

function usableViewport(viewportHeight, topHeight, bottomHeight){
  const full = Math.max(0, Number(viewportHeight) || 0);
  const top = clamp(Number(topHeight) || 0, 0, full);
  const bottom = clamp(Number(bottomHeight) || 0, 0, Math.max(0, full - top));
  return { topInset: top, bottomInset: bottom, height: full - top - bottom };
}

function defaultFold(state, manual){
  if (manual === true || manual === false) return manual;
  return state === "half";
}

function normaliseTab(tab){
  return {
    id: String(tab.id),
    kind: tab.kind,
    dock: dockFor(tab.kind),
    pageId: String(tab.pageId),
    state: STATES.includes(tab.state) ? tab.state : "half",
    customHeight: tab.customHeight == null ? null : Number(tab.customHeight),
    folded: tab.folded == null ? null : !!tab.folded,
    scrollTop: Math.max(0, Number(tab.scrollTop) || 0),
    scrollLeft: Math.max(0, Number(tab.scrollLeft) || 0),
    used: Number(tab.used) || 0
  };
}

function retainTab(tabs, incoming, now){
  const tab = normaliseTab({...incoming, used: now});
  const next = tabs.filter(t => t.id !== tab.id).map(normaliseTab);
  next.push(tab);
  next.sort((a, b) => a.used - b.used);
  return next.slice(-3);
}

function saveRegistry(tabs){ return JSON.stringify(tabs.map(normaliseTab)); }
function loadRegistry(raw){
  const parsed = JSON.parse(raw || "[]");
  return parsed.map(normaliseTab).slice(-3);
}

function cloneInk(surface){
  return {
    strokes: JSON.parse(JSON.stringify(surface.strokes || [])),
    removed: JSON.parse(JSON.stringify(surface.removed || {})),
    restored: JSON.parse(JSON.stringify(surface.restored || {}))
  };
}

/* The id and bytes are captured together. A delayed save must never read the
   mutable active tab after an await or timer. */
function captureOutgoing(host){
  if (!host.active) return null;
  host.active.scrollTop = Math.max(0, Number(host.scroller.top) || 0);
  host.active.scrollLeft = Math.max(0, Number(host.scroller.left) || 0);
  return {
    tabId: host.active.id,
    pageId: host.active.pageId,
    html: host.html,
    ink: cloneInk(host.surface)
  };
}

function stillCurrent(host, epoch, tab){
  return host.epoch === epoch && host.active && host.active.id === tab.id;
}

/* Exact switch ordering. The load functions may run asynchronously, but the
   place is applied only after every layout-affecting input and a settle tick. */
async function switchTab(host, rawTab, io){
  const tab = normaliseTab(rawTab);
  const epoch = ++host.epoch;
  const outgoing = captureOutgoing(host);
  host.events.push("capture");
  if (outgoing){
    host.events.push("flush:" + outgoing.pageId);
    await io.flush(outgoing);
  }
  if (host.epoch !== epoch) return false;

  host.active = tab;
  host.html = "";
  host.surface = {strokes:[], removed:{}, restored:{}};
  host.scroller = {top:0, left:0, contentHeight:0, viewportHeight:600};

  host.events.push("html:" + tab.pageId);
  const content = await io.loadHtml(tab);
  if (!stillCurrent(host, epoch, tab)) return false;
  host.html = content.html;
  host.scroller.contentHeight = content.contentHeight;

  host.events.push("images:" + tab.pageId);
  await io.hydrateImages(tab, host);
  if (!stillCurrent(host, epoch, tab)) return false;

  host.events.push("ink:" + tab.pageId);
  host.surface = cloneInk(await io.loadInk(tab));
  if (!stillCurrent(host, epoch, tab)) return false;

  host.events.push("layout:" + tab.pageId);
  await io.settleLayout(tab, host);
  if (!stillCurrent(host, epoch, tab)) return false;

  const maxTop = Math.max(0, host.scroller.contentHeight - host.scroller.viewportHeight);
  host.scroller.left = tab.scrollLeft;
  host.scroller.top = clamp(tab.scrollTop, 0, maxTop);
  host.events.push("restore:" + tab.pageId);
  return true;
}

function beginClose(host){ return ++host.epoch; }
function finishClose(host, closeEpoch){
  if (host.epoch !== closeEpoch) return false;
  host.hidden = true;
  host.active = null;
  return true;
}
function reopen(host, tab){
  host.epoch++;
  host.hidden = false;
  host.active = normaliseTab(tab);
}

function deferred(){
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
}

console.log("four named sheet states and dock geometry:");
check("Hidden < Strip < Half < Full in one unit (pixels)", () => {
  const hs = STATES.map(s => stateHeight(s, 1000));
  assert.deepEqual(hs, [0, 72, 500, 1000]);
});
check("a dragged Half height is clamped between Strip and Full", () => {
  assert.equal(stateHeight("half", 900, {customHeight:10}), 72);
  assert.equal(stateHeight("half", 900, {customHeight:2000}), 900);
  assert.equal(stateHeight("half", 900, {customHeight:340}), 340);
});
check("summary is top and working is bottom without a CSS kind/state matrix", () => {
  assert.equal(dockFor("summary"), "top");
  assert.equal(dockFor("working"), "bottom");
});
check("top and bottom docks are subtracted exactly once", () => {
  assert.deepEqual(usableViewport(1000, 120, 300), {topInset:120, bottomInset:300, height:580});
  assert.deepEqual(usableViewport(500, 400, 400), {topInset:400, bottomInset:100, height:0});
});
check("Half folds by default; Full expands; a manual choice wins", () => {
  assert.equal(defaultFold("half"), true);
  assert.equal(defaultFold("full"), false);
  assert.equal(defaultFold("half", false), false);
  assert.equal(defaultFold("full", true), true);
});

console.log("three named tabs keep independent state:");
check("a fourth tab evicts only the least recently used tab", () => {
  let tabs = [];
  tabs = retainTab(tabs, {id:"w1",kind:"working",pageId:"w1p2",state:"half",scrollTop:140}, 1);
  tabs = retainTab(tabs, {id:"s1",kind:"summary",pageId:"s1p3",state:"strip",scrollTop:320}, 2);
  tabs = retainTab(tabs, {id:"w2",kind:"working",pageId:"w2p1",state:"full",scrollTop:90}, 3);
  tabs = retainTab(tabs, {id:"s2",kind:"summary",pageId:"s2p4",state:"half",scrollTop:700}, 4);
  assert.deepEqual(tabs.map(t => t.id), ["s1","w2","s2"]);
  assert.equal(tabs.find(t => t.id === "s1").scrollTop, 320);
});
check("restart persistence keeps each tab's page/place/state/size/fold", () => {
  const before = [normaliseTab({id:"w1",kind:"working",pageId:"wp3",state:"half",
    customHeight:333,folded:false,scrollTop:711,scrollLeft:29,used:8})];
  assert.deepEqual(loadRegistry(saveRegistry(before)), before);
});

console.log("switch, save and restore ordering:");
check("the outgoing owner and ink bytes are captured before mutation", () => {
  const host = {active:normaliseTab({id:"A",kind:"working",pageId:"pageA",state:"half"}),
    html:"old",surface:{strokes:[{id:"old"}],removed:{x:1},restored:{}},
    scroller:{top:321,left:9}};
  const packet = captureOutgoing(host);
  host.active.pageId = "pageB";
  host.surface.strokes[0].id = "new";
  assert.equal(packet.pageId, "pageA");
  assert.equal(packet.ink.strokes[0].id, "old");
  assert.equal(packet.html, "old");
});

const host = {
  epoch:0, hidden:false, events:[], html:"old",
  active:normaliseTab({id:"A",kind:"working",pageId:"pageA",state:"half",scrollTop:0}),
  surface:{strokes:[{id:"a"}],removed:{},restored:{}},
  scroller:{top:222,left:11,contentHeight:1200,viewportHeight:600}
};
const packets = [];
const io = {
  flush: async packet => { packets.push(packet); },
  loadHtml: async () => ({html:"new", contentHeight:650}),
  hydrateImages: async (tab, h) => { h.scroller.contentHeight = 1900; },
  loadInk: async () => ({strokes:[{id:"b"}],removed:{},restored:{}}),
  settleLayout: async () => {}
};
await switchTab(host, {id:"B",kind:"summary",pageId:"pageB",state:"strip",
  scrollTop:700,scrollLeft:22}, io);

check("flush precedes HTML; restore follows HTML, images, ink and layout", () => {
  assert.deepEqual(host.events, [
    "capture","flush:pageA","html:pageB","images:pageB",
    "ink:pageB","layout:pageB","restore:pageB"
  ]);
});
check("restoring after hydration reaches the saved place instead of an early clamp", () => {
  assert.equal(host.scroller.top, 700);
  assert.equal(host.scroller.left, 22);
  const earlyMax = Math.max(0, 650 - 600);
  assert.equal(clamp(700, 0, earlyMax), 50);
});
check("the save packet still belongs to the outgoing page", () => {
  assert.equal(packets[0].pageId, "pageA");
  assert.equal(packets[0].ink.strokes[0].id, "a");
});

console.log("stale asynchronous work cannot win:");
const waitImages = deferred();
const raceHost = {
  epoch:0, hidden:false, events:[], html:"",
  active:null, surface:{strokes:[],removed:{},restored:{}},
  scroller:{top:0,left:0,contentHeight:0,viewportHeight:600}
};
const raceIo = {
  flush: async () => {},
  loadHtml: async tab => ({html:tab.id, contentHeight:1600}),
  hydrateImages: async tab => { if (tab.id === "slow") await waitImages.promise; },
  loadInk: async tab => ({strokes:[{id:tab.id}],removed:{},restored:{}}),
  settleLayout: async () => {}
};
const slow = switchTab(raceHost,
  {id:"slow",kind:"working",pageId:"slowPage",state:"half",scrollTop:800}, raceIo);
await Promise.resolve();
await Promise.resolve();
const fast = switchTab(raceHost,
  {id:"fast",kind:"working",pageId:"fastPage",state:"half",scrollTop:400}, raceIo);
await fast;
waitImages.resolve();
await slow;

check("a slow old open cannot replace the newer tab or its scroll", () => {
  assert.equal(raceHost.active.id, "fast");
  assert.equal(raceHost.html, "fast");
  assert.equal(raceHost.surface.strokes[0].id, "fast");
  assert.equal(raceHost.scroller.top, 400);
});
check("a delayed close cannot hide a tab reopened during its animation", () => {
  const h = {epoch:0,hidden:false,active:normaliseTab({id:"A",kind:"working",pageId:"A",state:"half"})};
  const closing = beginClose(h);
  reopen(h, {id:"B",kind:"working",pageId:"B",state:"half"});
  assert.equal(finishClose(h, closing), false);
  assert.equal(h.hidden, false);
  assert.equal(h.active.id, "B");
});

process.exitCode = bad ? 1 : 0;
