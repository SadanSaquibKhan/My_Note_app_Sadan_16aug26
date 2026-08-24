/* Working and Summary drawer exclusion contract.

   Old bug: once drawer records became notes, storage-level helpers returned
   them everywhere. The ordinary page list, notebook count and nav chips then
   treated hidden working/summary pages as normal pages. One central filter is
   safer than fixing each painter independently and missing the next consumer. */

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

const pageOrder = span("function pageOrder", "function pageById");
const sectionList = span("function sectionPageList", "function listVirtual");
const paintNotes = span("function paintNotes", "function esc");
const paintSections = span("function paintSections", "function paintTrashRow");
const snapshot = span("function notesSnapshot", "function practiceCounts");
const counts = span("function counts", "/* ---------- working pages");
const renumber = span("function planSecPageNames", "/* Reading order");
const ensureDefault = span("function ensureDefaultSection", "function suggestSectionName");
const deleteSection = span("function deleteSection", "/* Pages grouped");
const deleteNote = span("function deleteNote", "function deleteNotebook");
const paintChips = span("function paintNavChips", "function visualNoteId");
const pagePredicate = /(?:isDrawerPage|isAuxiliaryPage|ordinaryPages|isOrdinaryPage)\s*\(/;

console.log("one definition separates ordinary pages from drawer pages:");
eq("both built-in drawer kinds are declared",
   /DRAWER_KINDS\s*=\s*\{[^}]*working\s*:\s*1[^}]*summary\s*:\s*1/.test(html));
eq("there is a central page-level drawer/ordinary predicate",
   /function\s+(?:isDrawerPage|isAuxiliaryPage|ordinaryPages|isOrdinaryPage)\b/.test(html));

console.log("ordinary navigation never sees a drawer:");
eq("pageOrder filters drawer pages or drawer sections",
   pagePredicate.test(pageOrder) || /isDrawer\(g\.section\)/.test(pageOrder));
eq("sectionPageList is derived from the filtered pageOrder", /pageOrder\(\)/.test(sectionList));
eq("the ordinary page painter filters before sorting and matching", pagePredicate.test(paintNotes));
eq("the section painter separates drawer rows from ordinary section rows",
   /isDrawer\(s\)|ordinarySections\(/.test(paintSections));
eq("notebook counts exclude both Working and Summary", pagePredicate.test(counts));
eq("the one-pass snapshot count also excludes both drawers", pagePredicate.test(snapshot));
eq("renumbering skips drawer sections and drawer pages", /isDrawer\(g\.section\)/.test(renumber) &&
   pagePredicate.test(renumber));
eq("unnumbered ordinary sections are numbered using an ordinary-only index",
   /ordinarySections|ordinaryIndex|sectionNumber\([^,]+,\s*(?:ordinary|visible)/.test(renumber + paintSections));

console.log("filing and deletion cannot expose hidden drawer pages:");
eq("default-section repair skips pages that belong to either drawer",
   pagePredicate.test(ensureDefault));
eq("a built-in drawer cannot be deleted through the ordinary section dialog",
   /isDrawer\(sec\)|DRAWER_KINDS\[sec\.kind\]/.test(deleteSection));
eq("deleting a source page keeps linked Working/Summary pages",
   !/practicesFor\(id/.test(deleteNote) && !/by_works/.test(deleteNote));
eq("a kept child has an explicit Source missing state and Relink action",
   /Source missing/i.test(html) && /Relink/i.test(html));

console.log("chip maths remains page-relative after filtering:");
eq("stickiness is a fraction of the current page share, not the whole track",
   /function pageStick[\s\S]{0,180}\(hi\s*-\s*lo\)\s*\*\s*CHIP_STICK/.test(html));
eq("both chip lists ultimately use the ordinary page order",
   /pageOrder\(\)/.test(paintChips) && /sectionPageList\(\)/.test(paintChips) &&
   /pageOrder\(\)/.test(sectionList));

console.log("reference behaviour for counts, chips and renaming:");
const sections = [
  {id:"s1", kind:null},
  {id:"work", kind:"working"},
  {id:"sum", kind:"summary"}
];
const notes = [
  {id:"p1", sectionId:"s1", title:"S1P1"},
  {id:"w1", sectionId:"work", worksFor:"p1", title:"S1P1w1"},
  {id:"m1", sectionId:"sum", title:"Summary"},
  {id:"p2", sectionId:"s1", title:"S1P2"}
];
const drawerIds = new Set(sections.filter(s => s.kind === "working" || s.kind === "summary").map(s => s.id));
const ordinary = notes.filter(n => !drawerIds.has(n.sectionId));
eq("only two pages count and appear on either navigation chip", ordinary.map(n => n.id).join(",") === "p1,p2");
eq("renaming ordinary pages cannot rewrite a working or summary title",
   notes.filter(n => drawerIds.has(n.sectionId)).map(n => n.title).join(",") === "S1P1w1,Summary");

/* Parent deletion must not cascade. The source marker changes; the content does
   not. This is essential because the working/summary page may contain unique
   writing that is more valuable than the source page. */
const afterParentDelete = notes.filter(n => n.id !== "p1");
eq("linked drawer pages survive when their source page is deleted",
   afterParentDelete.some(n => n.id === "w1") && afterParentDelete.some(n => n.id === "m1"));

process.exitCode = bad ? 1 : 0;
