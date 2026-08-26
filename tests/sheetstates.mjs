/* Unified sheet states, dock identity and multi-tab persistence contract.

   Old bug: one global `prac` object held one record and one scroll position.
   Switching sheets overwrote that state, and `body[data-prac]` could describe
   only one dock. Up to three named tabs require per-tab page/scroll/state data,
   while rough working and summaries must keep their opposite dock identities. */

import fs from "fs";

const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (label, condition) => {
  console.log((condition ? "  ok   " : "  FAIL ") + label);
  if (!condition) bad++;
};
const span = (from, to) => {
  const a = html.indexOf(from);
  if (a < 0) return "";
  const b = to ? html.indexOf(to, a + from.length) : -1;
  return html.slice(a, b < 0 ? html.length : b);
};

const setSnap = span("function setSnap", "var pracSeq");
const openSheet = span("function openPractice", "function closePractice");
const closeSheet = span("function closePractice", "function flushPractice");
const flushSheet = span("function flushPractice", "function paintPracHead");
const head = span("function paintPracHead", "function loadPracInk");
const goPage = span("function gotoPracPage", "\n  $(\"pracBtn\")");
const dockMarker = html.search(/(?:dockTabs|sheetTabs|prac\.tabs|summarySheet|shortSheet)/i);
const dockCode = dockMarker < 0 ? "" : html.slice(Math.max(0, dockMarker - 1200), dockMarker + 14000);

console.log("all four states exist for both sheet kinds:");
eq("Hidden, Strip, Half and Full are explicit states",
   ["hidden","strip","half","full"].every(s => new RegExp(`["']${s}["']`, "i").test(html)));
eq("state changes go through one setter", /function\s+(?:setSheetState|setSnap)\b/.test(html));
eq("the setter accepts all four states", /hidden/i.test(setSnap) && /strip/i.test(setSnap) && /half/i.test(setSnap) && /full/i.test(setSnap));
eq("the old Tab-only CSS state is gone", !/body\[data-prac=["']tab["']\]/.test(html));
eq("choosing a named state clears any inline free-drag height",
   /style\.height\s*=\s*["']["']|removeProperty\(["']height["']\)/.test(setSnap));

console.log("rough working and short notes keep a fixed visual identity:");
eq("working/rough sheets are explicitly docked at the bottom",
   /\.pracsheet\s*\{[^}]*bottom\s*:\s*0/i.test(html));
eq("summary/short-note sheets are explicitly docked at the top",
   dockMarker >= 0 && /(?:summary|short)[\s\S]{0,500}(?:top\s*:\s*|dockTop)/i.test(dockCode));
eq("closing a bottom sheet still slides it down out of sight",
   /(?:working|rough|bottom)[\s\S]{0,700}translateY\(110%\)|\.off\s*\{[^}]*translateY\(110%\)/i.test(html));
/* Retargeted at the file rather than at the window around the dock code: the
   rule that moves a top-docked sheet is CSS, and the CSS lives thousands of
   lines above any of this JavaScript, so no window around the dock code could
   ever contain it however the feature was written. The intent is unchanged —
   a sheet must leave by the edge it arrived from. */
eq("closing a top sheet slides it upward, not downward",
   /\.shortstrip\[data-dock="top"\]\.off\{[^}]*translateY\(-110%\)/.test(html));
eq("and a bottom sheet still leaves downward",
   /\.pracsheet\.off\{[^}]*translateY\(110%\)/.test(html));

console.log("each docked tab owns its own place:");
eq("sheet state contains a collection of dock tabs", /(?:dockTabs|sheetTabs|prac\.tabs|docks)\s*[=:]/.test(dockCode));
eq("a tab stores its record/page id", dockMarker >= 0 && /(?:noteId|pageId|recId)/.test(dockCode));
eq("a tab stores scrollTop and scrollLeft", /scrollTop/.test(dockCode) && /scrollLeft/.test(dockCode));
/* b186 put a database read and a possible navigation between the flush and the
   mount, so the two sit further apart in the source than they did. The ordering
   is unchanged and is what matters, so it is stated directly now: the outgoing
   sheet's place is taken and its writing saved before anything replaces the
   record underneath it. */
eq("the place is captured before anything asynchronous starts",
   /captureSheetPlace\(\)[\s\S]{0,120}flushPractice\(\)/.test(html));
eq("every path that replaces the mounted sheet saves it first",
   (html.match(/captureSheetPlace\(\)/g) || []).length >= 3);
eq("and the mount happens after that save resolves, not beside it",
   /flushPractice\(\)\.then\(function\(\)\{[\s\S]{0,400}prac\.rec = /.test(html) ||
   /flushPractice\(\)\.then\([\s\S]{0,600}openPractice\(/.test(html));
/* Restated as the ordering itself, which is what actually matters and what the
   old pattern was reaching for. Restoring before the content is in is worse
   than not restoring at all: an empty host is short, so a saved place is
   clamped to almost nothing, and pictures arriving later never put it back. */
eq("the place is restored only after the ink load resolves",
   /loadPracInk\([^)]*\)\.then\(function\(\)\{[\s\S]{0,240}restoreSheetPlace\(/.test(html));
eq("and only after the browser has laid that content out",
   /function restoreSheetPlace[\s\S]{0,400}afterLayout\(/.test(html) &&
   /function afterLayout[\s\S]{0,300}requestAnimationFrame/.test(html));
eq("a place is captured from the outgoing sheet before anything asynchronous starts",
   /captureSheetPlace\(\);[\s\S]{0,120}flushPractice\(\)/.test(html));
eq("only the newest asynchronous sheet open may finish", /pracSeq|sheetSeq/.test(openSheet + goPage));
eq("no more than three dock tabs are retained", /(?:slice\(-?3\)|length\s*>\s*3|MAX_(?:DOCK|SHEET)_TABS\s*=\s*3)/.test(dockCode));
eq("dock tabs and each tab's place are persisted across restarts",
   /setMeta\([^\n]*(?:dockTabs|sheetTabs|docks)|saveCfg\(\)/.test(dockCode));

console.log("the folded header stays useful:");
eq("folding reuses the existing toolbar-fold visual language",
   /(?:barMin|barfold|foldchev|chevron)/i.test(dockCode) ||
   /class="foldchev"/.test(html));
eq("the folded header still paints a name", /(?:name|pracWhere|sheetWhere)/.test(head));
eq("the folded header still paints page/current-total counter", /(?:pages\.length|\/|counter)/.test(head));
eq("Half auto-folds and Full defaults expanded unless manually overridden",
   /half[\s\S]{0,500}fold/i.test(dockCode) && /full[\s\S]{0,500}(?:expand|fold)/i.test(dockCode));

console.log("the four heights come from one calculation:");
/* This block used to hand sheetHeightFor a fake viewport whose `paperRect`
   production never returned — so it measured a tidy 1000px page in the test
   while production fell through to window.innerHeight and measured the whole
   window. Green, and wrong, which is worse than red.

   The arithmetic lives in a pure resolver now that takes its numbers instead of
   fetching them. A function that cannot reach out cannot be handed a lie. */
const fnMatch = html.match(/function sheetHeight\(state, paperHeight, oppositeInset, custom\)\{[\s\S]*?\n  \}/);
eq("the arithmetic is a pure resolver", !!fnMatch);
eq("and it is handed its numbers, never left to fetch them",
   !!fnMatch && !/usablePageViewport\(/.test(fnMatch[0]) && !/window\.innerHeight/.test(fnMatch[0]));
/* The measuring belongs at the call site, and a sheet must never be sized
   against its own inset — it would shrink a little every time it was asked. */
eq("the call site measures, and passes only the OTHER dock's inset",
   /function sheetHeightFor\(state, custom\)\{[\s\S]{0,400}sheetHeight\(state, ph, v\.topInset \|\| 0, custom\)/.test(html));

if (fnMatch) {
  const H = new Function(fnMatch[0] + "\nreturn sheetHeight;")();
  eq("hidden is not sized at all", H("hidden", 1000, 0) === null);
  eq("strip is a readable band", H("strip", 1000, 0) === 132);
  eq("half is about half the page", H("half", 1000, 0) === 520);
  eq("full leaves the top bar showing", H("full", 1000, 0) === 954);
  eq("the four are ordered 0 < strip < half < full",
     0 < H("strip",1000,0) && H("strip",1000,0) < H("half",1000,0) && H("half",1000,0) < H("full",1000,0));

  /* With a Strip across the top, the bottom sheet has less room, and every
     state must shrink to match rather than reaching under it. */
  eq("a Strip across the top takes room from the sheet below",
     H("half", 1000, 200) === 416 && H("full", 1000, 200) === 754);
  eq("and half of a smaller room is smaller", H("half", 1000, 200) < H("half", 1000, 0));

  /* A dragged height is an override of half, and only of half. */
  eq("a dragged height overrides half", H("half", 1000, 0, 700) === 700);
  eq("but never strip or full",
     H("strip", 1000, 0, 700) === 132 && H("full", 1000, 0, 700) === 954);
  eq("and it still has to fit the room", H("half", 1000, 600, 900) <= 400);

  /* Nothing may return a negative or absurd height, however little room there
     is: a sheet with no height at all cannot be dragged back open. */
  eq("a tiny page still gives a usable sheet",
     H("full", 40, 0) >= 120 && H("half", 40, 0) >= 120 && H("strip", 40, 0) >= 120);
  eq("and an inset larger than the page does not go negative",
     H("half", 300, 900) >= 120 && H("full", 300, 900) >= 120);
}

console.log("reference state machine:");
const HEIGHT = {hidden:0, strip:72, half:0.5, full:1};
eq("the four heights are ordered 0 < Strip < Half < Full",
   HEIGHT.hidden < HEIGHT.strip && HEIGHT.strip < 500 * HEIGHT.half && HEIGHT.half < HEIGHT.full);

const addDock = (tabs, tab) => {
  const without = tabs.filter(t => t.id !== tab.id);
  without.push({...tab});
  return without.slice(-3);
};
let tabs = [];
tabs = addDock(tabs, {id:"w1", kind:"working", pageId:"w1p2", scrollTop:140});
tabs = addDock(tabs, {id:"s1", kind:"summary", pageId:"s1p3", scrollTop:320});
tabs = addDock(tabs, {id:"w2", kind:"working", pageId:"w2p1", scrollTop:90});
tabs = addDock(tabs, {id:"s2", kind:"summary", pageId:"s2p4", scrollTop:700});
eq("opening a fourth tab drops the oldest and keeps the newest three",
   tabs.map(t => t.id).join(",") === "s1,w2,s2");
eq("each retained tab keeps its own page and scroll position",
   tabs.find(t => t.id === "s1").pageId === "s1p3" && tabs.find(t => t.id === "s1").scrollTop === 320);

/* This catches a subtle close/switch loss: flush must capture the old id before
   asynchronous work begins, then update only if that same tab is still active. */
eq("flush captures an id before saving and guards the late result",
   /var id\s*=\s*prac\.rec\.id/.test(flushSheet) && /prac\.rec\.id\s*===\s*id/.test(flushSheet));
eq("page switching blanks old ink before loading the new tab page",
   /strokes\s*=\s*\[\][\s\S]{0,350}loadPracInk/.test(goPage));

process.exitCode = bad ? 1 : 0;
