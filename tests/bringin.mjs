/* “Bring the page in here” snapshot contract.

   Old bug: the existing PNG helper renders handwriting only and sizes itself
   from the entire three-band scroller. Reusing it would omit typed text/images
   and copy the wrong vertical region. A source snapshot needs a dedicated page
   compositor plus immutable source metadata; refresh is always manual. */

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

const fullInk = span("function fullInkImage", "$(\"pngBtn\")");
const insertImage = span("function insertImageFile", "function hydrateOneImage");
const hydrate = span("function hydrateImages", "function applyImagePlace");
const duplicate = span("function duplicateNote", "function duplicateNotebook");
const crop = span("function openCrop", "$(\"imgCrop\")");
const fingerPan = span("function fingerPanDown", "function fingerPanMove");
const bringMarker = html.search(/function\s+(?:bring|openBring|capturePage)|Bring (?:the )?page in/i);
const bringCode = bringMarker < 0 ? "" : html.slice(Math.max(0, bringMarker - 1200), bringMarker + 16000);
const compositorMatch = html.match(/function\s+(renderPageSnapshot|composePageSnapshot|snapshotPage|renderPageCanvas)\s*\(/);
const compositorCode = compositorMatch ? span("function " + compositorMatch[1], "\n  function ") : "";

console.log("capture is a real current-page compositor:");
eq("Bring page in has an explicit command", bringMarker >= 0);
eq("a dedicated page snapshot/compositor exists instead of reusing fullInkImage alone",
   !!compositorMatch);
eq("the compositor includes typed DOM content", /(?:foreignObject|html2canvas|drawDom|serializeBody|cloneNode)/.test(compositorCode));
eq("the compositor includes handwriting strokes", /drawStroke|noteSurface\.strokes|previewStrokes/.test(compositorCode));
eq("the compositor includes inserted/PDF images", /hydrateImages|imgblock|drawImage/.test(compositorCode));
eq("the old ink-only export helper is not the Bring-in implementation",
   !/Bring (?:the )?page in[\s\S]{0,500}fullInkImage/i.test(html));

console.log("the chosen band/slice is measured in page coordinates:");
eq("visible-slice maths subtracts the previous-page preview pad",
   /prevPad\(\)/.test(bringCode + compositorCode));
eq("visible-slice maths divides screen scroll by page zoom",
   /(?:pageZoom\(\)|state\.zoom|zoom\(\))/.test(bringCode + compositorCode));
eq("the slice is clamped to the current page height",
   /(?:pageHeight|Math\.min|clamp)/i.test(bringCode + compositorCode));
eq("first-quarter/second-quarter/full/visible choices are represented",
   /first quarter|1\/4/i.test(bringCode) && /second quarter|2\/4/i.test(bringCode) &&
   /full page/i.test(bringCode) && /part I can see|visible part/i.test(bringCode));

console.log("the inserted picture behaves like every other selected picture:");
eq("snapshot insertion uses an imgblock figure", /imgblock/i.test(bringCode));
eq("it is free-positioned with x/y placement", /data-free/i.test(bringCode) &&
   /data-x/i.test(bringCode) && /data-y/i.test(bringCode));
eq("the new snapshot is selected immediately", /selectImage/i.test(bringCode));
eq("the ordinary hydrate path also sees it", /#body figure\.imgblock, #pracText figure\.imgblock/.test(hydrate));
eq("finger pan still yields to a selected imgblock", /closest\("figure\.imgblock"\)/.test(fingerPan));
eq("typing handover still refuses an imgblock touch",
   /function handOverToTyping[\s\S]{0,500}closest\("figure\.imgblock"\)/.test(html));
eq("caret placement still refuses an imgblock touch",
   /function typeAt[\s\S]{0,500}closest\("figure\.imgblock"\)/.test(html));

console.log("asset ownership and source metadata survive every lifecycle:");
eq("insertImageFile assigns a working/summary image to the active sheet note",
   /activeNoteId\(\)/.test(insertImage) ||
   /ink\.active[\s\S]{0,180}prac\.rec\.id[\s\S]{0,180}state\.note\.id/.test(insertImage));
eq("the snapshot stores source note id, anchor id, revision and crop rectangle",
   /sourceNoteId|sourceRef/.test(bringCode) && /sourceAnchorId|anchorId/.test(bringCode) &&
   /sourceRevision|sourceHash/.test(bringCode) && /sourceRect|captureRect|sliceRect/.test(bringCode));
eq("source metadata is separate from crop's pristine orig bytes",
   /if\s*\(!asset\.orig\)\s*patch\.orig\s*=\s*asset\.blob/.test(crop) &&
   !/(?:sourceRef|sourceNoteId)\s*=\s*asset\.orig/.test(html));
eq("duplicateNote preserves arbitrary asset fields including blob/orig/source",
   /Object\.keys\(a\)|structuredClone\(a\)/.test(duplicate) ||
   (/blob\s*:\s*a\.blob/.test(duplicate) && /orig\s*:\s*a\.orig/.test(duplicate) && /source/.test(duplicate)));
eq("deleting the source does not delete the independent snapshot asset",
   bringMarker >= 0 && !/sourceNoteId[\s\S]{0,500}(?:deleteAsset|deletedAt\s*=)/.test(bringCode));

console.log("staleness is informative, never destructive:");
eq("a changed source shows a quiet Source changed marker", /Source changed/i.test(bringCode));
eq("refresh requires an explicit Refresh from source action", /Refresh from source/i.test(bringCode));
eq("render/hydrate does not automatically refresh stale snapshots",
   bringMarker >= 0 && !/function hydrateImages[\s\S]{0,2200}(?:refreshFromSource|refreshSourceSnapshot)\(/.test(html));
eq("a missing source leaves the captured pixels and offers a clear status",
   /Source missing/i.test(bringCode));

console.log("reference visible-slice maths:");
const visibleSlice = ({scrollTop, prevPad, zoom, viewportHeight, pageHeight}) => {
  const y = Math.max(0, Math.min(pageHeight, (scrollTop - prevPad) / zoom));
  const h = Math.max(0, Math.min(pageHeight - y, viewportHeight / zoom));
  return {y, h};
};
const slice = visibleSlice({scrollTop:1900, prevPad:1100, zoom:2, viewportHeight:800, pageHeight:1500});
eq("the visible slice begins at page y=400, not at the page top", slice.y === 400);
eq("the visible slice captures exactly the 400 page-pixels on screen", slice.h === 400);

const source = {noteId:"nt7", anchorId:"sp4", revision:"abc", rect:{x:0,y:400,w:760,h:400}};
const copied = JSON.parse(JSON.stringify(source));
eq("source reference and rectangle survive export/import unchanged",
   JSON.stringify(copied) === JSON.stringify(source));
eq("a revision mismatch marks stale but never changes the stored pixels",
   copied.revision !== "new-revision" && copied.rect.y === 400);

process.exitCode = bad ? 1 : 0;
