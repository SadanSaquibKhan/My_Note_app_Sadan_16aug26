/* Chunks: a chapter between the section and the page (b192).

   Section, then chunk, then page. A chunk is a BROWSING layer and nothing
   else — it must never rename a page, because a page's name is the user's and
   a grouping that renames things is a grouping you cannot undo by regrouping.

   This build is the store and the arithmetic only; nothing on screen changes.
   That is deliberate: a schema bump wants to land on its own, where the only
   thing that can have gone wrong is the schema. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("the store:");
eq("the schema moved on", /var DB_VERSION = 6;/.test(html));
eq("and the file format with it", /var FORMAT     = 9;/.test(html));
eq("the store is created, with both ways of asking for it",
   /db\.createObjectStore\("chunks", \{keyPath:"id"\}\)/.test(html) &&
   /ck\.createIndex\("by_section", "sectionId"\);/.test(html) &&
   /ck\.createIndex\("by_notebook", "notebookId"\);/.test(html));
/* Purely additive. Nothing existing is read or rewritten in the upgrade
   transaction — that is where an upgrade turns into data loss. */
eq("the upgrade rewrites nothing", !/oldVersion >= 1 && oldVersion < 6/.test(html));
eq("a page naming no chunk is the ordinary case, not a missing value",
   /if \(r\.chunkId === undefined\) r\.chunkId = null;/.test(html) &&
   /if \(r\.navOrder === undefined\) r\.navOrder = null;/.test(html));
eq("a chunk record is normalised like everything else", /if \(kind === "chunk"\)\{/.test(html));

console.log("\nbackups carry them, old backups still open:");
eq("a full backup writes them", /field\("chunks", b\.chunks \|\| \[\]\);/.test(html));
eq("a single notebook's export carries its own", /sections: r\[2\] \|\| \[\], chunks: r\[3\] \|\| \[\], groups: \[\]/.test(html));
eq("a file without any is not an error", /var inCk = \(b\.chunks\|\|\[\]\)\.map/.test(html));
/* Losing a grouping is recoverable; losing sight of the pages is not. */
eq("a chunk whose section did not arrive loses the section, not the pages",
   /write\[6\]\.forEach\(function\(x\)\{ if \(x\.sectionId && !scIds\[x\.sectionId\]\) x\.sectionId = null; \}\);/.test(html));
eq("a page naming a chunk that did not arrive falls back to the implicit group",
   /write\[1\]\.forEach\(function\(x\)\{ if \(x\.chunkId && !ckIds\[x\.chunkId\]\) x\.chunkId = null; \}\);/.test(html));
eq("and they are written with everything else, in one go",
   /putMany\(\["notebooks","notes","practices","assets","groups","sections","chunks"\]/.test(html));

console.log("\nsync:");
eq("they are published", /var SYNC_STORES = \["notebooks","notes","sections","chunks","groups","assets"\];/.test(html));
/* A page landing before its chunk is filed under nothing, shows up in the
   implicit group, and moves again a moment later when its chunk turns up. */
eq("and they land before the pages that name them",
   /sections:2, chunks:3, notes:4/.test(html));
eq("a chunk arriving refreshes the lists, as a section does", /row\.store === "chunks"\) secHit = true;/.test(html));

console.log("\ndeleting, restoring, erasing:");
eq("deleting a notebook takes its chunks", /putMany\(\["notebooks","notes","sections","chunks"\],\s*\n\s*\{notebooks:\[r\[0\]\], notes:notes, sections:sections, chunks:chunks\}\)/.test(html));
eq("restoring one brings them back", /var chunks = \(r\[3\] \|\| \[\]\)\.filter\(function\(c\)\{ return c\.notebookId === id && c\.deletedAt; \}\);/.test(html));
eq("erasing for good leaves none behind", /var cc = ck\.index\("by_notebook"\)\.openCursor/.test(html));
/* Deleting a grouping must never take pages with it. */
eq("deleting one chunk leaves its pages alone",
   /function deleteChunk\(id\)\{[\s\S]{0,400}c\.deletedAt = Date\.now\(\)/.test(html) &&
   !/function deleteChunk\(id\)\{[\s\S]{0,400}notes/.test(html));

/* ---- the arithmetic, lifted out and run ---- */
const grab = re => { const m = html.match(re); if (!m) throw new Error("not found: " + re); return m[0]; };
const fns = new Function(
  "var DRAWER_KINDS = {working:1, summary:1};\n" +
  grab(/function isDrawer\(sec\)\{[^\n]*\n/) + "\n" +
  grab(/function ordinarySections\(sections\)\{[\s\S]*?\n  \}\n/) + "\n" +
  grab(/function notesByChunk\(pages, chunks\)\{[\s\S]*?\n  \}\n/) + "\n" +
  grab(/function pageAddress\(note, sections, chunks, pages\)\{[\s\S]*?\n  \}\n/) + "\n" +
  "return { notesByChunk: notesByChunk, pageAddress: pageAddress };")();

console.log("\ngrouping the pages of a section:");
const ck = (id, order, sectionId) => ({ id, order, sectionId: sectionId || "s1", deletedAt: null });
const pg = (id, chunkId, navOrder) => ({ id, chunkId: chunkId || null, navOrder: navOrder ?? null });
const names = g => g.map(x => [x.chunk ? x.chunk.id : "-", x.notes.map(n => n.id).join(",")]);

/* A notebook that never asked for chunks must look exactly as it did. */
eq("with no chunks at all, every page is one group",
   JSON.stringify(names(fns.notesByChunk([pg("p1"), pg("p2")], []))) ===
   JSON.stringify([["-", "p1,p2"]]));
/* Pushing the older pages below the chunks would reorder a notebook that never
   asked for any. */
eq("the pages that were there first come first",
   JSON.stringify(names(fns.notesByChunk(
     [pg("p1"), pg("p2", "c1"), pg("p3")], [ck("c1", 0)]))) ===
   JSON.stringify([["-", "p1,p3"], ["c1", "p2"]]));
eq("chunks follow in their own order, not the order the pages happen to be in",
   JSON.stringify(names(fns.notesByChunk(
     [pg("p1", "c2"), pg("p2", "c1")], [ck("c2", 5), ck("c1", 1)]))) ===
   JSON.stringify([["c1", "p2"], ["c2", "p1"]]));
/* A chunk is born with its first page and is worth nothing without one. */
eq("an empty chunk is not shown",
   JSON.stringify(names(fns.notesByChunk([pg("p1", "c1")], [ck("c1",0), ck("c2",1)]))) ===
   JSON.stringify([["c1", "p1"]]));
/* A chunk id naming nothing living is no chunk at all — which is what lets a
   deleted grouping leave its pages where you can still see them. */
const dead = { id:"cX", order:0, sectionId:"s1", deletedAt: 123 };
eq("a deleted chunk's pages fall back into the implicit group",
   JSON.stringify(names(fns.notesByChunk([pg("p1","cX"), pg("p2")], [dead]))) ===
   JSON.stringify([["-", "p1,p2"]]));
eq("so does a page naming a chunk that is not there",
   JSON.stringify(names(fns.notesByChunk([pg("p1","ghost")], []))) ===
   JSON.stringify([["-", "p1"]]));
eq("inside a chunk, navOrder decides",
   JSON.stringify(names(fns.notesByChunk(
     [pg("p1","c1",20), pg("p2","c1",10)], [ck("c1",0)]))) ===
   JSON.stringify([["c1", "p2,p1"]]));
/* Reading order out of an SxPy name only holds while every page is auto-named,
   so a page with no navOrder keeps exactly the place it already had. */
eq("and a page with no navOrder keeps the place it already had",
   JSON.stringify(names(fns.notesByChunk(
     [pg("p1","c1"), pg("p2","c1"), pg("p3","c1")], [ck("c1",0)]))) ===
   JSON.stringify([["c1", "p1,p2,p3"]]));

console.log("\nwhere a page is, in one string:");
const secs = [{ id:"s1", notebookId:"A", order:0 }, { id:"s2", notebookId:"A", order:1 }];
const pages = [
  { id:"n1", notebookId:"A", sectionId:"s2" },
  { id:"n2", notebookId:"A", sectionId:"s2", chunkId:"c2" },
  { id:"n3", notebookId:"A", sectionId:"s2", chunkId:"c1" },
];
const chunks = [{ id:"c1", sectionId:"s2", order:0 }, { id:"c2", sectionId:"s2", order:1 }];
eq("a page in a chunk reads S2C2P2", fns.pageAddress(pages[1], secs, chunks, pages) === "S2C2P2");
eq("the first chunk is C1", fns.pageAddress(pages[2], secs, chunks, pages) === "S2C1P3");
/* There is no chunk to name, so naming one would be inventing it. */
eq("a page in the implicit group has no C at all", fns.pageAddress(pages[0], secs, chunks, pages) === "S2P1");
/* P counts within the SECTION so it agrees with the name written at the top of
   the page. An address that disagreed with the title would be worse than none. */
eq("P counts within the section, so it agrees with the page's own name",
   fns.pageAddress(pages[2], secs, chunks, pages) === "S2C1P3");
eq("a page in the first section reads S1",
   fns.pageAddress({ id:"n0", notebookId:"A", sectionId:"s1" }, secs, chunks,
                   [{ id:"n0", notebookId:"A", sectionId:"s1" }]) === "S1P1");
/* A working sheet is not in the reading order, so its drawer is not a section
   anyone counts; the sections either side of it must not shift. */
const withDrawer = secs.concat([{ id:"sw", notebookId:"A", order:0.5, kind:"working" }]);
eq("a drawer is not counted as a section", fns.pageAddress(pages[1], withDrawer, chunks, pages) === "S2C2P2");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
