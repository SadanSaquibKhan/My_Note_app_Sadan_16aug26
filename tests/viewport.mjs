/* Shared visible-page viewport contract.

   Old bug: page joins, chip fractions and remembered places each measured a
   slightly different rectangle. A fixed Strip at the top (and later a working
   sheet at the bottom) makes those differences visible as clipping, shivering
   or a jump at the join. Geometry consumers must share one helper; page-space
   invariants such as sheet height and finger deltas must stay independent of
   any overlay. */

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

const helperPattern = /function\s+(effectivePageViewport|visiblePageViewport|usablePageViewport|pageViewport|noteViewport|effectiveViewport|visiblePageRect)\s*\(/g;
const helperHits = Array.from(html.matchAll(helperPattern));
const helperName = helperHits.length ? helperHits[0][1] : "";
const callsHelper = (code) => !!helperName && new RegExp("\\b" + helperName + "\\s*\\(").test(code);
const readsViewport = (code) => /(?:window\.)?innerHeight|\.clientHeight|getBoundingClientRect\s*\(/.test(code);
const throughViewport = (code, delegates) => callsHelper(code) || (delegates || []).some(re => re.test(code));

const paintLanding = span("if (chipLand != null", "if (typeof paintNavChips");
const savePlace = span("function savePlace", "function queueSavePlace");
const restoreScroll = span("function restoreScroll", '$("paper").addEventListener("scroll"');
const listProgress = span("function listProgress", "function progressToPlace");
const chipTrack = span("function chipTrack", "var chipDock");
const pageScrollFor = span("function pageScrollFor", "function landOnPage");
const landOnPage = span("function landOnPage", "function applyChipPlace");
const pageFracNow = span("function pageFracNow", "function listIndexOf");
const chipPeekReady = span("function chipPeekReady", "function chipLoading");
const chipPeekGeometry = span("function chipPeekGeometry", "function driveChipPeek");
const driveChipPeek = span("function driveChipPeek", "function driveChipScroll");
const driveChipScroll = span("function driveChipScroll", "function revealChipJoin");
const armChipHandover = span("function armChipHandover", "/* A chip is a SEEK");
const pageHandover = span("function pageHandover", "function finishHandover");
const finishHandover = span("function finishHandover", "var padWatch");
const rebasePan = span("function rebasePan", "/* Both directions preserve");
const fingerPanMove = span("function fingerPanMove", "function fingerPanUp");
const startGlide = span("function startGlide", "var gest");
const pageBottom = span("function pageBottom", "function edgeOf");
const flowTo = span("function flowTo", "function pushFlow");
const visibleStrokes = span("function visibleStrokes", "/* ---- 22.");
const autoScroll = span("function autoScroll", "/* ---- 25.");
const pageHeightFor = span("function pageHeightFor", "function extraFromOldDepth");
const nearPageFoot = span("function nearPageFoot", "function addPageHalf");
const growForInk = span("function growForInk", "/* ---- 5.");
const peekSizing = span("function paintPrevPeek", "function warmNeighbourInk");
const revealBounds = span("function revealBounds", "function revealCaret");
/* performUndoJump does not exist here either; revealCaret is followed by the
   undo-jump wiring, so the span ran to the end of the file. */
const revealCaret = span("function revealCaret", "/* ---------- 2. per-tool");
const jumpButtons = span('$("jumpTop").addEventListener', "/* ---------- 12.");
/* paintBacklinks does not exist here, so this ran from paintOutline to the end
   of the file and swept in the picture bar, the lasso and half the editor. */
const outline = span("function paintOutline", "function paintTags");
const anchor = span("function scrollToAnchor", "/* ---- attachments");
const audioFollow = span("function followAudio", "function playAudio");
const findStep = span("function stepFind", '$("findWhat").addEventListener');
/* This file has no paintCurrentHeading; the function that tracks which heading
   you are on is paintOutlineHere, under "22. the outline should track where you
   are". The old marker matched nothing, so the span was empty and the check
   could never pass however the code was written. */
const currentHeading = span("function paintOutlineHere", "/* ---- 23.");
const lassoPromote = span('$("lassoPromote").addEventListener', "/* ---- printing and PNG");

console.log("one helper defines the unobscured part of #paper:");
eq("the shared effective viewport helper exists", helperHits.length > 0);
eq("the helper is defined exactly once", helperHits.length === 1);
const helperCode = helperName ? span("function " + helperName, "\n  function ") : "";
eq("the helper starts from the real paper rectangle", /getBoundingClientRect\s*\(/.test(helperCode));
eq("the helper exposes an adjusted top and bottom", /\btop\b/.test(helperCode) && /\bbottom\b/.test(helperCode));
eq("the helper exposes usable height and top/bottom insets",
   /height|clientHeight/.test(helperCode) && /topInset|insetTop/.test(helperCode) && /bottomInset|insetBottom/.test(helperCode));
eq("top and bottom dock overlays are handled in the same helper",
   /(?:strip|summary|topDock)/i.test(helperCode) && /(?:practice|working|bottomDock)/i.test(helperCode));

console.log("every screen-geometry consumer goes through that helper:");
const required = [
  ["paintDoc chip landing", paintLanding, [/pageScrollFor\s*\(/]],
  ["savePlace", savePlace],
  ["restoreScroll", restoreScroll],
  ["listProgress", listProgress, [/pageFracNow\s*\(/]],
  ["chipTrack", chipTrack],
  ["pageScrollFor", pageScrollFor],
  ["landOnPage", landOnPage, [/pageScrollFor\s*\(/]],
  ["pageFracNow", pageFracNow],
  ["chipPeekReady", chipPeekReady],
  ["chipPeekGeometry", chipPeekGeometry],
  ["driveChipPeek", driveChipPeek, [/chipPeekGeometry\s*\(/]],
  ["driveChipScroll", driveChipScroll],
  ["armChipHandover", armChipHandover],
  ["pageHandover", pageHandover],
  ["finishHandover", finishHandover],
  ["pageBottom / atPageEnd", pageBottom],
  ["flowTo backward landing", flowTo],
  ["visibleStrokes culling", visibleStrokes],
  ["autoScroll edge", autoScroll],
  ["undo revealBounds", revealBounds],
  ["top/bottom jump buttons", jumpButtons],
  ["lasso Keep-this placement", lassoPromote]
];
required.forEach(([name, code, delegates]) => {
  eq(name + " uses the shared visible viewport", throughViewport(code, delegates));
});

console.log("element reveals use the same visible rectangle, not native full-screen scrollIntoView:");
const revealHelper = /scroll(?:Element|Node|Into)(?:Page|Visible|Viewport)|revealInPageViewport/i;
[
  ["outline heading", outline],
  ["anchor landing", anchor],
  ["audio-follow block", audioFollow],
  ["find result", findStep],
  ["current-heading probe", currentHeading],
  ["caret reveal", revealCaret]
].forEach(([name, code]) => {
  eq(name + " is Strip-aware", callsHelper(code) || revealHelper.test(code));
});

console.log("page-space invariants do not acquire a viewport dependency:");
/* Old bug prevented here: adding Strip height to stored page height changes
   scrollHeight and recreates the very join jump the overlay helper is meant to
   avoid. These functions are deliberately delta/page-space only. */
eq("startGlide remains a raw delta integrator", !readsViewport(startGlide));
eq("fingerPanMove remains a raw finger-delta integrator", !readsViewport(fingerPanMove));
eq("rebasePan stores the current raw scroll without reinterpreting it", !readsViewport(rebasePan));
eq("nearPageFoot depends only on page coordinates", !readsViewport(nearPageFoot));
eq("growForInk applies stored page height only", !readsViewport(growForInk));
eq("pageHeightFor stays independent of screen and overlays", !readsViewport(pageHeightFor));
eq("peek bodies use pageHeightOf/pageHeightFor, not viewport height",
   /pageHeight(?:Of|For)\s*\(/.test(peekSizing) && !/paper\.clientHeight|window\.innerHeight/.test(peekSizing));

console.log("reference geometry and save/restore behaviour:");
const viewport = ({paperTop, paperBottom, clientHeight, topInset=0, bottomInset=0}) => ({
  top: paperTop + topInset,
  bottom: paperBottom - bottomInset,
  height: Math.max(0, clientHeight - topInset - bottomInset),
  topInset,
  bottomInset
});
const pageBase = (prevPad, v) => prevPad - v.topInset;
const pageScroll = (frac, pageHeight, zoom, prevPad, v) =>
  pageBase(prevPad, v) + Math.max(0, Math.min(1, frac)) *
  Math.max(0, pageHeight * zoom - v.height);
const pageFrac = (scrollTop, pageHeight, zoom, prevPad, v) => {
  const span = Math.max(1, pageHeight * zoom - v.height);
  return Math.max(0, Math.min(1, (scrollTop - pageBase(prevPad, v)) / span));
};
const savePageY = (scrollTop, prevPad, zoom, v) =>
  (scrollTop - prevPad + v.topInset) / zoom;
const restorePageY = (pageY, prevPad, zoom, v) =>
  prevPad - v.topInset + pageY * zoom;

const open = viewport({paperTop:80, paperBottom:1080, clientHeight:1000, topInset:140, bottomInset:260});
eq("one helper subtracts top and bottom occlusion exactly once",
   open.top === 220 && open.bottom === 820 && open.height === 600);

const clean = viewport({paperTop:80, paperBottom:1080, clientHeight:1000});
const prev = 1100, z = 1.5, h = 1500;
[0, 0.13, 0.5, 0.91, 1].forEach(f => {
  eq("page fraction round-trips at " + f,
     Math.abs(pageFrac(pageScroll(f, h, z, prev, open), h, z, prev, open) - f) < 1e-9);
});

const pageY = 420;
const savedOpenScroll = restorePageY(pageY, prev, z, open);
const recorded = savePageY(savedOpenScroll, prev, z, open);
const restoredClosed = restorePageY(recorded, prev, z, clean);
eq("a place saved with overlays restores to the same page-space content when closed",
   recorded === pageY && savePageY(restoredClosed, prev, z, clean) === pageY);
eq("closing a 140px top Strip compensates scrollTop by exactly 140px",
   restoredClosed - savedOpenScroll === 140);

const atHead = pageScroll(0, h, z, prev, open);
const headScreenY = 80 + prev - atHead;
eq("fraction 0 aligns the page head below the top Strip", headScreenY === open.top);
const atFoot = pageScroll(1, h, z, prev, open);
const footScreenY = 80 + prev + h * z - atFoot;
eq("fraction 1 aligns the page foot above the bottom sheet", footScreenY === open.bottom);

process.exitCode = bad ? 1 : 0;
