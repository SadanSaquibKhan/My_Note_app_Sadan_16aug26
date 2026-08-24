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
eq("Hidden and Strip keep ink.active on the main note",
   /(?:hidden|strip)[\s\S]{0,500}ink\.active\s*=\s*["']note["']/i.test(stripCode));
eq("Half and Full hand ink.active to the summary sheet",
   /(?:half|full)[\s\S]{0,500}ink\.active\s*=\s*["'](?:practice|summary|sheet)["']/i.test(stripCode));
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
eq("Strip height has one source of truth below/folding the docbar",
   /(?:strip|summary)[\s\S]{0,500}(?:docbar|topbar|toolbar)[\s\S]{0,300}(?:offset|inset|fold)/i.test(stripCode));

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
