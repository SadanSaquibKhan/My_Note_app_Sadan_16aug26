/* Read-only Summary Strip and continuous-scroll geometry contract.

   Old bug: every page-join calculation used the full paper rectangle. A fixed
   strip covering the top changes the visible viewport; if even one threshold
   keeps using the old rectangle, the page clips or jumps at the join. The same
   helper must feed finger handover, chip seek, landing and scroll fractions. */

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

const preview = span("function previewHtml", "function previewStrokes");
const handover = span("function pageHandover", "function finishHandover");
const finish = span("function finishHandover", "function paintPrevPeek");
const chipTrack = span("function chipTrack", "function placeForDrag");
const chipReady = span("function chipPeekReady", "function driveChipPeek");
const chipGeom = span("function chipPeekGeometry", "function driveChipScroll");
const pageScroll = span("function pageScrollFor", "function landOnPage");
const pageFrac = span("function pageFracNow", "function chipPeekReady");
const listProgress = span("function listProgress", "function progressToPlace");
const savePlace = span("function savePlace", "function queueSavePlace");
const restoreScroll = span("function restoreScroll", "$(\"paper\").addEventListener");
const paintDoc = span("function paintDoc", "function render");
const stripMarker = html.search(/function\s+(?:paint|open|set|render)(?:Summary|Short)?Strip\b|id=["'](?:summaryStrip|shortStrip)["']/i);
const stripCode = stripMarker < 0 ? "" : html.slice(Math.max(0, stripMarker - 2000), stripMarker + 12000);
const viewportMatch = html.match(/function\s+(pageViewport|effectivePageRect|usablePageViewport|visiblePageRect|noteViewport)\s*\(/);
const viewportName = viewportMatch ? viewportMatch[1] : "";
const callsViewport = (code) => !!viewportName && new RegExp("\\b" + viewportName + "\\s*\\(").test(code);
const viewportCode = viewportName ? span("function " + viewportName, "\n  function ") : "";

console.log("Strip is a read-only rendering of a real summary page:");
eq("there is an explicit Strip state and renderer", stripMarker >= 0 && /["']strip["']|\bStrip\b/i.test(stripCode));
eq("Strip content is built through previewHtml", /previewHtml\s*\(/.test(stripCode));
eq("Strip never registers another writable ink surface",
   !/makeSurface\([^\n]*(?:strip|summaryPreview|shortStrip)/i.test(html));
eq("preview removes duplicate element ids", /querySelectorAll\("\[id\]"\)/.test(preview));
eq("Strip has an interactive-link mode instead of inheriting peek's disabled links",
   /previewHtml\([^)]*(?:mode|opts|interactive|links)/.test(html) &&
   /interactive|keepLinks|allowLinks/.test(preview) && /previewHtml\s*\([^)]*,/.test(stripCode));

console.log("one adjusted viewport feeds every join calculation:");
eq("a shared effective-page viewport helper exists", !!viewportName);
eq("the helper subtracts the visible Strip height from top/height or clientHeight",
   /(?:summaryStrip|shortStrip|stripHeight)[\s\S]{0,500}(?:height|bottom)[\s\S]{0,300}(?:\-=|\+\=|Math\.max)/i.test(viewportCode));
eq("finger pageHandover uses the adjusted viewport", callsViewport(handover));
eq("finishHandover re-anchors against the adjusted viewport", callsViewport(finish));
eq("chipTrack uses the adjusted viewport", callsViewport(chipTrack));
eq("chipPeekReady uses the adjusted viewport", callsViewport(chipReady));
eq("chipPeekGeometry uses the adjusted viewport", callsViewport(chipGeom));
eq("pageScrollFor uses the adjusted visible height", callsViewport(pageScroll));
eq("pageFracNow uses the adjusted visible height", callsViewport(pageFrac));
eq("listProgress uses the same adjusted page origin/fraction", callsViewport(listProgress));
eq("chip progress and chip landing use one inverse page-fraction calculation",
   /pageFracNow\s*\(/.test(listProgress));
eq("remembered scroll saves relative to the adjusted visible top", callsViewport(savePlace));
eq("remembered scroll restores relative to the adjusted visible top", callsViewport(restoreScroll));

console.log("the pen and layout switch only at the intended states:");
/* b177 corrected this, and the correction matters more than it looks. The
   Strip asserting ink.active = "note" reads as harmless — it is usually raised
   while the main page is being written on, so the assignment looks like a
   no-op. It is not one when a working sheet is open: showing, resizing or
   expanding the Strip then handed the pen back to the main page, and the next
   stroke landed on the lecture instead of the working page you were reading.
   A read-only band owns no surface, so the right number of times for it to
   assign ink.active is zero. */
eq("the Strip never assigns ink.active at all",
   !/ink\.active\s*=/.test(stripCode));
/* DELIBERATE DEVIATION, b173. The audit expected a taller Strip to become a
   second writable editor with its own ink.active. It is not built that way,
   for two reasons.

   The first is that the same suite, four lines up, forbids registering another
   writable ink surface — and this app has exactly two, "note" and "practice".
   Handing ink.active to a third name that owns no surface would be a lie the
   drawing code eventually trips over.

   The second is the keystone decision this whole batch rests on: a short note
   is a real page. Writing in one therefore means opening it, with the whole
   editor, undo, tools and all — not a cut-down copy floating over the page you
   came from. So the Strip reads, and Open navigates; the Back chip and Go to
   main carry you between the two.

   What must stay true is that the Strip never quietly takes the pen. */
eq("no state of the Strip ever takes the pen from the page underneath",
   !/ink\.active\s*=/.test(stripCode));
eq("opening a short note navigates to it rather than floating a second editor",
   /sstripOpen[\s\S]{0,400}go\(\{ nbId: sum\.notebookId, noteId: sum\.id \}\)/.test(html));
eq("changing the main page does not close an open summary Strip",
   !/if\s*\(prac\.open\)\s*closePractice\(\)/.test(paintDoc) ||
   /kind\s*!==?\s*["']summary["']|snap\s*!==?\s*["']strip["']/.test(paintDoc));
eq("Strip is a fixed sibling overlay, not content inside #body/#paper",
   stripMarker >= 0 && /(?:shortStrip|summaryStrip|sheetStrip)[\s\S]{0,500}position\s*:\s*fixed/i.test(html));

console.log("live, peek and Strip layout cannot drift apart:");
/* Old bug: copying the peek CSS a third time made the Strip look right today,
   then a later heading/image rule changed only the live page and reintroduced
   a jump. A shared class or a three-way selector is required. */
eq("Strip shares the existing preview layout selectors/classes",
   stripMarker >= 0 && (/\.prevpeek-body[^\{]*\.nextpeek-body[^\{]*(?:strip|summary)/i.test(html) ||
   /(?:shortStrip|summaryStrip)[^>]*class=["'][^"']*(?:prevpeek-body|peekbody|pagepreview)/i.test(html)));
/* Anchored on the function rather than a sliding window around the renderer:
   b177 added several lines of comment there and pushed stripTop out of the
   window, which made this look like a regression when nothing about the
   placement had changed. The intent is unchanged — where the Strip sits must
   have exactly one source of truth. */
eq("Strip placement has one source of truth, and it is not a hand-made offset",
   /function stripTop\(\)\{[\s\S]{0,200}\$\("paper"\)[\s\S]{0,200}getBoundingClientRect\(\)\.top/.test(html) &&
   /docbar[\s\S]{0,400}(?:offset|fold)/i.test(html));

console.log("reference geometry:");
const effectiveViewport = (paper, stripHeight) => ({
  top: paper.top + stripHeight,
  bottom: paper.bottom,
  height: Math.max(0, paper.height - stripHeight),
  clientHeight: Math.max(0, paper.clientHeight - stripHeight)
});
const paper = {top:80, bottom:1080, height:1000, clientHeight:1000};
const strip = effectiveViewport(paper, 144);
eq("a 144px Strip moves the visible top down exactly 144px", strip.top === 224);
eq("the usable height is reduced exactly once", strip.height === 856 && strip.clientHeight === 856);
eq("the physical bottom stays fixed", strip.bottom === 1080);

const activeFor = (state) => (state === "half" || state === "full") ? "summary" : "note";
eq("Hidden→note, Strip→note, Half→summary, Full→summary",
   ["hidden","strip","half","full"].map(activeFor).join(",") === "note,note,summary,summary");

process.exitCode = bad ? 1 : 0;
