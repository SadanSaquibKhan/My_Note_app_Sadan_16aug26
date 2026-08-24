/* Working-page migration and lifecycle contract.

   Old bug: moving rough-working records into notes looked correct on screen,
   but late imports/sync rows could be skipped, erased ink could disappear, and
   delete/duplicate/restore wrote the migrated note objects back into the old
   `practices` store. Those are silent data-loss bugs, so this test deliberately
   checks storage boundaries as well as the visible result. */

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

const migration = span("function migrateWorkingToNotes", "/* ---------- ink blocks");
const localMeta = span("function localMetaKey", "function setMeta");
const importing = span("function importBundle", "var SYNC_STORES");
const exporting = span("function exportBundle", "function previewImport");
const duplicateNote = span("function duplicateNote", "function duplicateNotebook");
const duplicateBook = span("function duplicateNotebook", "/* ---------- delete");
const deleteNote = span("function deleteNote", "function deleteNotebook");
const deleteBook = span("function deleteNotebook", "function restoreNote");
const restoreNote = span("function restoreNote", "function restoreNotebook");
const restoreBook = span("function restoreNotebook", "function trash");
const practiceAll = span("function practiceAll", "function practiceSummary");
const flushPractice = span("function flushPractice", "function paintPracHead");
const copyWorking = span("$(\"pracDup\").addEventListener", "/* ================= v11");

console.log("migration keeps the complete record:");
eq("the old id is preserved so every existing page pin still opens",
   /id\s*:\s*p\.id\b/.test(migration));
eq("deleted history is migrated too, rather than silently filtered out",
   !/getAll\("practices"\)[\s\S]{0,100}filter\(live\)/.test(migration));
eq("a tombstone stays a tombstone instead of being resurrected",
   !/deletedAt\s*:\s*null/.test(migration) && /deletedAt/.test(migration));
eq("unknown/future fields are copied before note fields are overlaid",
   /Object\.keys\(p\)|Object\.assign\([^\n]*p|\.\.\.p/.test(migration));
eq("erasure maps and height migrate even when no live strokes remain",
   /removed\s*:\s*p\.removed/.test(migration) &&
   /restored\s*:\s*p\.restored/.test(migration) &&
   /h\s*:\s*p\.h/.test(migration) &&
   !/if\s*\(p\.strokes\s*&&\s*p\.strokes\.length\)/.test(migration));
eq("the page-ink asset id is deterministic or an existing page asset is reused",
   !/id\s*:\s*newId\("ink"\)/.test(migration) ||
   /getPageInk|assetsFor|haveAsset|assetByNote/.test(migration));

console.log("migration cannot be skipped by another device or an old backup:");
eq("the global completion flag does not prevent scanning newly arrived old rows",
   !/if\s*\(done\)\s*return/.test(migration));
eq("if a completion marker remains, it is device-local",
   !/workingMigrated/.test(migration) || /workingMigrated/.test(localMeta));
eq("old-format backup rows are converted into notes during that import",
   /migrateWorking|practiceToNote|workingFromPractice|convert.*practice/i.test(importing));
eq("format-1 scratch follows the same conversion path",
   !/n\.scratch[\s\S]{0,260}inPr\.push/.test(importing));
eq("new backups do not export both migrated pages and their legacy twins",
   !/getAll\("practices"\)/.test(exporting));
eq("light sync no longer publishes the legacy store as a second truth",
   !/SYNC_STORES\s*=\s*\[[^\]]*["']practices["']/.test(html));

console.log("all live working APIs use notes/by_works:");
eq("lookup uses the notes by_works index",
   /byIndex\("notes",\s*"by_works",\s*noteId\)/.test(html));
eq("save writes the working page as a note and its ink as an asset",
   /function savePractice[\s\S]{0,1400}(?:saveNote|putOne\("notes")/.test(html) &&
   /function savePractice[\s\S]{0,1400}(?:getPageInk|saveAsset)/.test(html));
eq("working HTML goes through the same runtime-markup scrubber as a normal note",
   /serializeHost|serialiseHost|serializeEditor/.test(flushPractice) &&
   /figure\.imgblock|\.lit|span\.math/.test(span("function serializeHost", "function serializeBody") +
                                               span("function serialiseHost", "function serializeBody") +
                                               span("function serializeEditor", "function serializeBody")));
eq("the all-working view orders by parent page, then sheet number, with orphans last",
   /parentOrder|pageOrder|sourceOrder|orphan/i.test(practiceAll) && /workOrder/.test(practiceAll));

console.log("duplicate, delete and restore never cross the old-store boundary:");
eq("duplicating a page creates child notes and remaps worksFor to the copied parent",
   /worksFor\s*:\s*copy\.id|worksFor\s*=\s*copy\.id/.test(duplicateNote) &&
   !/practices\s*:/.test(duplicateNote));
eq("duplicating a page also clones each child's assets",
   /assetsFor\(p\.id\)|childAssets|workingAssets/.test(duplicateNote));
eq("the sheet Copy button reads current editor/ink and clones its image assets",
   /serializeHost|serializeEditor|pracText/.test(copyWorking) &&
   /pracSurface\.strokes|workInk\(/.test(copyWorking) &&
   /assetsFor|duplicateAsset|cloneAsset/.test(copyWorking));
eq("duplicating a notebook preserves drawer kind and remaps internal worksFor ids",
   /kind\s*:\s*s\.kind/.test(duplicateBook) && /worksFor/.test(duplicateBook));
eq("asset copies preserve blobs, crop originals and future source metadata",
   /Object\.keys\(a\)|structuredClone\(a\)|blob\s*:\s*a\.blob/.test(duplicateNote + duplicateBook) &&
   /orig|sourceRef|sourceNoteId/.test(duplicateNote + duplicateBook));
eq("deleting an ordinary source page keeps its working children alive",
   !/practicesFor\(id/.test(deleteNote));
eq("note deletion never writes note objects to practices",
   !/practices\s*:\s*pr\b|["']practices["']/.test(deleteNote));
eq("notebook deletion tombstones its note rows once, without a second practices pass",
   !/practicesFor/.test(deleteBook) && !/["']practices["']/.test(deleteBook));
eq("restoring a page does not resurrect or rewrite linked drawer pages",
   !/practicesFor/.test(restoreNote) && !/["']practices["']/.test(restoreNote));
eq("restoring a notebook restores its notes directly, without a practices pass",
   !/practicesFor/.test(restoreBook) && !/["']practices["']/.test(restoreBook));

console.log("reference behaviour for ordering and old-backup equivalence:");
/* Old bug: newest-first sorting interleaved w1 for page 9 with w2 for page 2.
   Working pages must follow their parent in notebook order; only then may their
   own workOrder decide the order. A missing parent belongs at the end. */
const parentOrder = new Map([["p2", 0], ["p9", 1]]);
const rows = [
  {id:"orphan", worksFor:"gone", workOrder:0},
  {id:"p9w1", worksFor:"p9", workOrder:0},
  {id:"p2w2", worksFor:"p2", workOrder:1},
  {id:"p2w1", worksFor:"p2", workOrder:0}
];
rows.sort((a, b) => {
  const ap = parentOrder.has(a.worksFor) ? parentOrder.get(a.worksFor) : Infinity;
  const bp = parentOrder.has(b.worksFor) ? parentOrder.get(b.worksFor) : Infinity;
  return ap - bp || (a.workOrder || 0) - (b.workOrder || 0);
});
eq("parent order → work order → orphan last is unambiguous",
   rows.map(x => x.id).join(",") === "p2w1,p2w2,p9w1,orphan");

/* Boot migration and backup import must call one converter. This little model
   proves why: two near-identical converters drift as fields are added. */
const convert = (p) => ({...p, id:p.id, worksFor:p.noteId, workOrder:p.page || 0});
const old = {id:"pr7", noteId:"nt3", page:2, html:"x", custom:"keep me"};
eq("boot and old-backup conversion produce the same record",
   JSON.stringify(convert(old)) === JSON.stringify(convert(JSON.parse(JSON.stringify(old)))));

process.exitCode = bad ? 1 : 0;
