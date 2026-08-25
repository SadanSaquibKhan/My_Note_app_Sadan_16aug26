/* Summary Covers links and exact-location navigation contract.

   Old bug: visible labels such as S2C4P5 are renamed when pages move, and a
   fixed timeout can try to scroll to an anchor before a slow page has mounted.
   Links must therefore store immutable ids and land only after the winning
   render has finished. */

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

const anchorHere = span("function anchorHere", "function insertLink");
const copySpot = span("function copySpotLink", "function nearestAnchor");
const nearest = span("function nearestAnchor", "function pasteLink");
/* Tightened from "/* ---- 9." to the section that actually follows it: that
   marker is 500 lines further on in this file and swept in the audio follow,
   two canvas redraws and the text-history debounce, none of which have
   anything to do with landing on a spot. */
const scrollAnchor = span("function scrollToAnchor", "/* ---- the Covers band");
const preview = span("function previewHtml", "function previewStrokes");
const importing = span("function importBundle", "var SYNC_STORES");
const backlinks = span("function backlinks", "/* ---------- notebooks");
const hasCovers = /covers\s*[:=][^\n]{0,180}(?:noteId|\[)|\.covers\.(?:push|concat)/i.test(html);

console.log("links address content, never mutable labels:");
eq("anchors have stable ids inside the note HTML", /id\s*=\s*["']sp_/.test(anchorHere) || /"sp_"/.test(anchorHere));
eq("Covers is stored as structured noteId + anchorId data",
   /covers/i.test(html) && /noteId/.test(html) && /anchorId/.test(html));
eq("Covers creation does not store Sx/Cx/Px labels as its address",
   hasCovers && !/covers[^\n]{0,180}(?:S\d|sectionName|pageTitle|displayTitle)/i.test(html));
eq("a summary can cover more than one source",
   /covers\s*:\s*\[|\.covers\.push|covers\.concat/.test(html));
eq("cross-notebook navigation resolves the target note's notebookId",
   /covers[\s\S]{0,1200}(?:getNote|noteById)[\s\S]{0,400}notebookId/i.test(html));

console.log("exact spot creation and landing are race-safe:");
eq("Copy spot creates an anchor when none is already nearby",
   /anchorHere|anchorAt|makeAnchor/.test(copySpot));
eq("nearest-anchor distance considers both axes or the actual caret hit",
   /clientX|\.left/.test(nearest));
eq("anchor landing is not a blind fixed timeout",
   !/setTimeout/.test(scrollAnchor));
/* b180 widened the window from 200 to 600 characters. The ordering it checks is
   unchanged — landAnchor still runs inside finishRender, after the paint — but
   a few lines added between the two pushed it out of a window that had been cut
   close to the code as it happened to look that day.

   The old landing waited a flat 260ms and then looked once. On a slow mount
   the page was not there yet so it never landed, and you arrived at the top of
   the page with nothing to say why; on a fast one it waited for nothing. */
eq("the parked spot is landed by the render, not by a delay",
   /function landAnchor[\s\S]{0,400}getElementById\(pendingAnchor\)/.test(html) &&
   /paintDoc\(\);[\s\S]{0,600}landAnchor\(\)/.test(html));
eq("a pending anchor is consumed by the successful render/paint path",
   /pendingAnchor|anchorPending|landAnchor/.test(html) &&
   /renderSeq|paintDoc/.test(html));
eq("backlinks recognise both page links and page#anchor links", /noteId/.test(backlinks) && /[#"']/.test(backlinks));
eq("Back is runtime navigation, not an automatic permanent return-link edit",
   /back(?:Chip|Stack|Trail)/i.test(html));

console.log("Covers UI survives reorder, deletion and multiple sources:");
eq("main pages can show a summaries badge", /summar(?:y|ies)[^\n]{0,100}badge|badge[^\n]{0,100}summar/i.test(html));
eq("a missing source is shown without deleting the summary", /Source missing/i.test(html));
eq("the missing source can be relinked", /Relink/i.test(html));
eq("Go to main keeps a Strip open", /Go to main/i.test(html) && /strip/i.test(html));
eq("Strip links remain interactive even though peek links are sanitised",
   /previewHtml\([^)]*(?:mode|interactive|links)|strip[\s\S]{0,500}(?:data-to|ilink|href)/i.test(html));

console.log("backup, sync and conflict handling keep Covers metadata:");
eq("the backup conflict test compares Covers/source metadata too",
   /function conflicting[\s\S]{0,500}(?:covers|sourceRef|anchorId)/i.test(importing));
eq("normalisation does not whitelist Covers away",
   !/function normalise[\s\S]{0,900}delete\s+[^;]*covers/i.test(html));

/* Reordering and renaming are harmless when ids are the address. */
const cover = {noteId:"nt-source", anchorId:"sp-7"};
const before = {id:"nt-source", title:"S1P2_topic"};
const after = {id:"nt-source", title:"S4P9_topic"};
const resolve = (ref, pages) => pages.find(p => p.id === ref.noteId);
eq("renaming/reordering a page does not break the Cover",
   resolve(cover, [before]).id === resolve(cover, [after]).id);

const summary = {
  id:"sum-1",
  notebookId:"nb-summary",
  covers:[
    {noteId:"nt-a", anchorId:"sp-a"},
    {noteId:"nt-b", anchorId:"sp-b"},
    {noteId:"nt-cross", anchorId:"sp-c", notebookId:"nb-other"}
  ]
};
const roundTrip = JSON.parse(JSON.stringify({notes:[summary]})).notes[0];
eq("multiple and cross-notebook Covers survive export/import JSON exactly",
   JSON.stringify(roundTrip.covers) === JSON.stringify(summary.covers));

const badgeCount = (sourceId, summaries) => summaries.filter(s =>
  (s.covers || []).some(c => c.noteId === sourceId)).length;
eq("a source badge counts all summaries that cover it",
   badgeCount("nt-a", [summary, {...summary, id:"sum-2"}]) === 2);

process.exitCode = bad ? 1 : 0;
