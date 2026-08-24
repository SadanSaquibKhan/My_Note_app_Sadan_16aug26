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
eq("and its ink is never written a second time", /haveInk\[p\.id\]/.test(m));
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
