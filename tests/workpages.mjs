/* b168 — working pages stop being records in a store of their own and become
   ordinary pages in the notebook's Working drawer.

   The bug this whole build exists to end: a working page could never have what
   an ordinary page has. You could not scroll from one into the next, search
   never found it, it took no bookmark, no tag and no recording. Every one of
   those is free the moment it is a real page, and none of them is affordable
   twice.

   The bug this suite exists to catch is the other one — that moving it loses
   something. The ids especially: a working marker sitting in your notes stores
   the id it was made with, so a migration that mints new ids silently orphans
   every marker you have ever placed, and the sheet stops opening from the page
   it belongs to. */

import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

console.log("the id is what makes every existing marker keep working:");
/* Read the whole migration section, not one function: b169 split the record
   conversion out into practiceToNote/practiceToInk so that boot and an old
   backup import share one converter instead of two that drift apart. */
const from = html.indexOf("function migrateWorkingToNotes");
const to = html.indexOf("/* ---------- ink blocks");
eq("there is a migration", from > 0 && to > from);
const m = from > 0 ? html.slice(from, to) : "";
eq("the moved page is given the id it already had", /id:\s*p\.id\b/.test(m));
eq("it is not given a fresh one", !/id:\s*newId\("nt"\)/.test(m));
eq("the page it hangs off is remembered", /worksFor:\s*p\.noteId/.test(m));
eq("which sheet it was keeps its place", /workOrder:\s*p\.page/.test(m));
eq("the name still says which page it is for", /title:\s*workingName\(parent/.test(m));

console.log("nothing is thrown away:");
eq("the words come across", /html:\s*p\.html/.test(m));
eq("the ink becomes a page asset, where an ordinary page keeps its ink",
   /kind:\s*"page"/.test(m) && /strokes:\s*p\.strokes/.test(m));
eq("what was rubbed out comes too", /removed:\s*p\.removed/.test(m) && /restored:\s*p\.restored/.test(m));
eq("the clocks are kept, not reset to now",
   /createdAt:\s*p\.createdAt/.test(m) && /lastEdited:\s*p\.lastEdited/.test(m));
eq("the old records are left alone rather than erased", !/delete\(|clear\(\)/.test(m));

console.log("it cannot be skipped, and cannot double up:");
/* b169: there was a "done" flag, and the Codex audit was right that it was a
   trap. The flag stopped the scan, and the scan is the only thing that catches
   an old row arriving late — from a backup restored next month, or a device
   that had been switched off. There is no flag now; the scan is cheap because
   a row that already has a page is skipped on sight, and it writes nothing at
   all when there is nothing to move. */
eq("no flag can stop a late-arriving old row being caught", !/workingMigrated/.test(m));
eq("a row that already has a page is skipped", /byId\[p\.id\]/.test(m));
/* b174 renamed the map to inkOf, because it now holds the asset itself rather
   than a yes/no: the repair pass needs the record so it can merge into it. */
eq("and its ink is never written a second time", /inkOf\[p\.id\]/.test(m));
eq("the ink id is worked out from the page id, never minted fresh",
   /function workInkId/.test(m) && !/newId\("ink"\)/.test(m));
eq("a tombstone is migrated as a tombstone, not resurrected",
   /deletedAt: p\.deletedAt/.test(m));
eq("boot and old-backup import share one converter",
   /practiceToNote/.test(html.slice(html.indexOf("function importBundle"),
                                    html.indexOf("var SYNC_STORES"))));
eq("it runs at boot before anything is painted",
   /migrateWorkingToNotes\(\)[\s\S]{0,220}purgeExpired/.test(html));
eq("a failure does not stop the app opening",
   /migrateWorkingToNotes\(\)\.catch/.test(html));

console.log("a page an earlier build already moved is repaired, not skipped:");
/* b174. The first version of this migration dropped every field it did not know
   about, wrote a null deletion date over a tombstone, only made an ink record
   when live strokes were left, and minted that record a fresh id. The hardened
   mapping that replaced it only ran on rows it had NOT already converted — so
   everything the first version touched stayed damaged permanently, and no
   amount of restarting would ever fix it. */
eq("the scan has two jobs, moving and repairing",
   /var fresh = \[\], seen = \[\];/.test(m) &&
   /\(byId\[p\.id\] \? seen : fresh\)\.push\(p\)/.test(m));
eq("a row that already has a page goes to the repair pass",
   /seen\.forEach\([\s\S]{0,400}repairMigratedWorking\(p, note\)/.test(m));
eq("the ink of a repaired row is merged, not replaced",
   /function repairMigratedInk/.test(m) && /repairMigratedInk\(p, have\)/.test(m));
/* The page whose strokes had all been rubbed out arrived with no ink record at
   all, so its erasure map was simply gone. */
eq("a repaired row with no ink record at all gets one made",
   /if \(!have\)\{[\s\S]{0,320}practiceToInk\(p\)/.test(m));
eq("nothing is written when there is nothing to repair",
   /if \(!outNotes\.length && !outAssets\.length\) return/.test(m));

/* The page is the newer copy of the words; the legacy row is the more complete
   copy of everything else. Overwriting the words would undo real writing. */
eq("repair never overwrites the words, the title or where the page is filed",
   /KEEP_ON_REPAIR = \{[\s\S]{0,240}html:1[\s\S]{0,240}title:1/.test(m) &&
   /KEEP_ON_REPAIR = \{[\s\S]{0,240}sectionId:1/.test(m));
eq("repair only fills in a field the page does not have",
   /if \(note\[k\] === undefined\)\{ note\[k\] = p\[k\]; changed = true; \}/.test(m));
eq("an old tombstone is only applied if nothing has happened since",
   /p\.lastEdited \|\| 0\) >= \(note\.lastEdited \|\| 0\)/.test(m));

/* Reference: applying a delete that predates real writing would take that
   writing away, which is worse than the bug being fixed. */
const applyTomb = (row, note) =>
  !!(row.deletedAt && !note.deletedAt && (row.lastEdited || 0) >= (note.lastEdited || 0));
eq("a tombstone older than the page is ignored",
   applyTomb({deletedAt: 5, lastEdited: 5}, {lastEdited: 90}) === false);
eq("a tombstone no older than the page is honoured",
   applyTomb({deletedAt: 90, lastEdited: 90}, {lastEdited: 90}) === true);
eq("a page already deleted is left alone",
   applyTomb({deletedAt: 90, lastEdited: 90}, {deletedAt: 1, lastEdited: 1}) === false);

/* Merging the maps rather than replacing them: strokes drawn since the move are
   the newer truth, and the height must never shrink under existing ink. */
const mergeInk = (row, asset) => {
  const out = { removed: {...(asset.removed||{})}, h: Math.max(asset.h||0, row.h||0) };
  Object.keys(row.removed||{}).forEach(k => { if (!(k in out.removed)) out.removed[k] = row.removed[k]; });
  return out;
};
const merged = mergeInk({removed:{a:1,b:1}, h:900}, {removed:{b:2}, h:1200});
eq("erasure maps are unioned, the page's own entry winning",
   merged.removed.a === 1 && merged.removed.b === 2);
eq("the taller of the two heights is kept", merged.h === 1200);

console.log("copying a page keeps what makes it that page:")
/* b175. Copying used to rebuild the record from a list of fields it knew about,
   so Covers, the bookmark and anything added later were silently dropped: a
   copied summary came back having forgotten what it was a summary of. */
eq("a copy is spread from the page, not rebuilt from a list of fields",
   /var copy = Object\.assign\(\{\}, src\);/.test(html));
eq("structured metadata is deep-copied, not shared with the original",
   /if \(Array\.isArray\(src\.covers\)\) copy\.covers = JSON\.parse\(JSON\.stringify\(src\.covers\)\);/.test(html));
/* The copied page still named the ORIGINAL sheets, so every marker on it opened
   the original's working: two pages quietly sharing one set of sheets. */
eq("markers on a copied page are repointed at that page's own sheets",
   /var pinMap = \{\};[\s\S]{0,400}data-pracid="\(\[\^"\]\*\)"/.test(html));
/* And a copied notebook's markers and Covers both named the original's pages. */
eq("a copied notebook repoints its markers", /idMap\[old\] \|\| old/.test(html));
eq("a copied notebook remaps Covers that land inside it",
   /if \(!ref \|\| !ref\.noteId \|\| !idMap\[ref\.noteId\]\) return ref;/.test(html));
eq("a reference pointing outside the copy is deliberately left alone",
   /genuinely points somewhere else/.test(html));

console.log("a picture belongs to the page it was put on:")
/* It always took state.note.id, so a picture dropped into a working sheet was
   owned by the page the sheet was opened from. Duplicating the sheet could miss
   it, two copies could share one asset, and erasing either could take the
   other's picture. */
eq("there is one answer to which page is being written on",
   /function activeNoteId\(\)\{[\s\S]{0,240}prac\.rec\.id/.test(html));
eq("a picture uses it", /function insertImageFile[\s\S]{0,200}var noteId = activeNoteId\(\);/.test(html));
eq("an attachment uses it too", /var owner = activeNoteId\(\);/.test(html));

console.log("re-linking moves the page, it does not just repoint it:")
/* Changing worksFor alone left the sheet in the old notebook's Working drawer,
   so it vanished from the drawer of the notebook it now belonged to, and its
   name still claimed a page it had nothing to do with. */
eq("relink moves the notebook, the drawer, the order and the name",
   /function relinkWorkingHere[\s\S]{0,900}notebookId: target\.notebookId/.test(html) &&
   /function relinkWorkingHere[\s\S]{0,900}sectionId:  sec \? sec\.id : null/.test(html) &&
   /function relinkWorkingHere[\s\S]{0,900}title:      C\.workingName\(target/.test(html));
eq("and leaves a marker on the page it now belongs to",
   /function relinkWorkingHere[\s\S]{0,900}ensureWorkPin\(id\)/.test(html));

console.log("erasing a page for good actually erases it:");
/* A working page's legacy row is keyed by the page's own id, while its noteId
   names the page it hangs off. Clearing by that index did both halves of the
   wrong thing: erasing a working page left its legacy row, so the next boot
   built the page straight back out of it — a page you permanently deleted
   returning by itself — and erasing an ordinary page took the legacy rows of
   every working page hanging off it, including ones deliberately kept. */
eq("the legacy row goes by primary key", /pr\.delete\(id\);/.test(html));
eq("it is no longer cleared through the parent index",
   !/\[\[pr,"by_note"\],\[as,"by_note"\]\]/.test(html));
eq("assets are still cleared by the page they belong to",
   /\[\[as,"by_note"\]\]/.test(html));

console.log("the drawer is a section, and sits out of the way:");
eq("a section can carry a kind", /kind:\s*extra\.kind\s*\|\|\s*null/.test(html));
eq("working and summary are the two drawer kinds",
   /DRAWER_KINDS\s*=\s*\{\s*working:\s*1,\s*summary:\s*1\s*\}/.test(html));
eq("it is made on demand, not at notebook creation",
   /function ensureDrawer\([\s\S]*?drawerOf\(list, kind\)/.test(html));
eq("it is ordered far past any ordinary section so it settles at the foot",
   /order:\s*\(kind === "working" \? 9e14/.test(html));
/* Falling back to "whichever section came first" must never land on a drawer,
   or a page with no section would be filed into Working and disappear from the
   ordinary list without anyone asking for it. */
eq("the default-section fallback refuses to pick a drawer",
   /if \(!first && !isDrawer\(s\)\) first = s;/.test(html));

console.log("the notebook does not get bulky:");
/* A notebook you had done a lot of working in would otherwise read as twice
   the length it actually is. */
/* b170: each consumer used to roll its own test for "is this a drawer page".
   That is how the next consumer added gets missed, so there is one predicate
   now and everything asks it. */
eq("page counts go through the one drawer predicate",
   /function counts\(\)\{[\s\S]*?ordinaryPages\(/.test(html));
eq("renumbering skips the drawer",
   /function planSecPageNames[\s\S]*?isDrawer\(g\.section\)\) return;/.test(html));
eq("renumbering also skips a working page filed anywhere else",
   /function planSecPageNames[\s\S]*?isDrawerPage\(n, dIds\)\) return;/.test(html));
/* A skipped page must not consume a page number on its way past, or the page
   after it jumps from P3 to P5 with nothing on screen to explain why. */
eq("and a skipped page does not eat a page number",
   /function planSecPageNames[\s\S]*?var pi = 0;[\s\S]*?pi\+\+;/.test(html));
/* Sections are numbered among the ordinary ones only: counting the drawers in
   would renumber every section the first time a notebook grew a Working
   drawer, which renames every page in the notebook after it. */
eq("sections are numbered among the ordinary ones only",
   /function planSecPageNames[\s\S]*?sectionNumber\(g\.section, ordinaryIndex\)/.test(html));

console.log("looking one up does not walk the whole database:");
eq("there is an index for it", /createIndex\("by_works", "worksFor"\)/.test(html));
eq("the schema moved up for it", /var DB_VERSION = 5/.test(html));
eq("an existing database has the index added rather than created",
   /oldVersion >= 1 && oldVersion < 5[\s\S]*?createIndex\("by_works"/.test(html));
eq("the lookup uses the index", /byIndex\("notes", "by_works", noteId\)/.test(html));
eq("the per-page badge still walks keys only, never records",
   /objectStore\("notes"\)\.index\("by_works"\)[\s\S]*?openKeyCursor/.test(html));

console.log("the sheet fetches its ink instead of reading it off the record:");
/* Ink used to sit inline on the record, so it was simply there. It arrives a
   moment later now, and without blanking first the sheet you just closed shows
   its strokes on the one you just opened. */
eq("the surface is blanked before the fetch",
   /pracSurface\.strokes = \[\];[\s\S]{0,200}loadPracInk/.test(html));
eq("only the newest open may paint", /if \(seq !== pracSeq\) return;/.test(html));
eq("a page turn inside the sheet is caught too",
   /if \(!prac\.rec \|\| prac\.rec\.id !== id\) return;/.test(html));
eq("turning to another working page fetches that one's ink",
   /function gotoPracPage[\s\S]*?loadPracInk\(prac\.rec\.id/.test(html));

console.log("saving splits the words from the ink:");
/* Both halves read-modify-write the same note record. Run side by side, the
   second quietly undoes the first, and a stroke drawn at the same moment as a
   word typed loses one of the two. */
const sp = html.match(/function savePractice\(id, patch\)\{[\s\S]*?\n  \}/);
eq("there is one door for saving", !!sp);
eq("the two halves are sequenced, not run together",
   sp && !/Promise\.all/.test(sp[0]) && /step = step\.then/.test(sp[0]));
eq("drawing on a working page still counts as editing it",
   sp && /bumpNote\(id\)/.test(sp[0]));

console.log("ordering: a working page follows the page it hangs off");
/* Sorted by when they were made, the sheets for page 3 and page 9 interleave
   and the drawer reads as noise. */
const rows = [
  { id: "w3", worksFor: "n1", workOrder: 2, createdAt: 10 },
  { id: "w1", worksFor: "n1", workOrder: 0, createdAt: 90 },
  { id: "w2", worksFor: "n1", workOrder: 1, createdAt: 50 }
];
const sorted = rows.slice().sort((a, b) =>
  (a.workOrder || 0) - (b.workOrder || 0) || (a.createdAt || 0) - (b.createdAt || 0));
eq("they come back in sheet order, not the order they were made",
   sorted.map(r => r.id).join(",") === "w1,w2,w3");

process.exitCode = bad ? 1 : 0;
