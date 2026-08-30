/* Chunks you can see and make (b193).

   b192 built the store; this is the part on screen. The rule it is built
   around: a chunk arriving must add headings and move nothing. Regrouping a
   list someone is looking at moves pages under their finger. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("headings, never a reshuffle:");
eq("there is a separate question for what the list paints", /function chunkRuns\(pages, chunks\)\{/.test(html));
eq("and the list asks that one", /var runs = C\.chunkRuns\(shown, state\.chunks \|\| \[\]\);/.test(html));
/* A notebook that has never made a chunk must look exactly as it did — not
   almost, exactly: no heading, no extra element, the same flat list. */
eq("with no chunks the list is painted exactly as before",
   /if \(!anyChunk\)\{[\s\S]{0,200}shown\.forEach\(paintNoteRow\);\s*\n\s*return;/.test(html));
eq("the chunks come from the notebook that is open",
   /state\.chunks = r\[7\] \|\| \[\];/.test(html) && /state\.chunks = res\[10\] \|\| \[\];/.test(html));

console.log("\nwhat a heading is:");
eq("it folds its own pages rather than opening anything",
   /if \(chunkFold\[id\]\) delete chunkFold\[id\]; else chunkFold\[id\] = 1;/.test(html));
/* Folded is about this device and this moment. A chunk folded on the tablet
   must not arrive folded on the laptop. */
eq("folding is never written down", /var chunkFold = \{\};/.test(html) &&
   !/setMeta\("chunkFold"/.test(html));
eq("it says how many pages are under it", /ct\.className = "chunkcount";/.test(html));
/* Before any chunk exists these pages are the whole section, so calling them
   "earlier pages" then would be a lie. */
eq("the ungrouped pages are only called earlier once something is later",
   /nm\.textContent = g\.chunk \? g\.chunk\.name : "Earlier pages";/.test(html));

console.log("\nstarting one:");
eq("there is a button for it", /id="addChunkBtn"/.test(html) &&
   /\$\("addChunkBtn"\)\.addEventListener\("click", startChunkHere\);/.test(html));
/* A chunk is born with its first page. A grouping with nothing in it is only
   a thing to tidy up later. */
eq("it is born with the page you are on",
   /C\.createChunk\(state\.nbId, n\.sectionId \|\| null[\s\S]{0,200}C\.saveNote\(n\.id, \{ chunkId: c\.id \}\)/.test(html));
/* A sheet is not in the reading order, so it has no place in a chunk. */
eq("a working page or short note cannot start one",
   /if \(C\.isDrawerPage\(n, C\.drawerSectionIds\(state\.sections\)\)\)/.test(html));

console.log("\nand keeping it:");
/* Without this a chunk could never be more than the one page it was made from. */
eq("a page written next joins the same sitting", /function chunkForNewPage\(sectionId\)\{/.test(html));
eq("which is what a new page is created with",
   /C\.createNote\(nbId, title, sectionId \|\| null, \{ chunkId: joins \}\)/.test(html));
eq("createNote takes it, and defaults to none", /chunkId: opts\.chunkId \|\| null,/.test(html));
eq("a dead chunk is not inherited", /\(last && last\.chunkId && live\[last\.chunkId\]\) \? last\.chunkId : null/.test(html));

console.log("\nundoing one:");
/* Undoing a grouping must never take pages with it. */
eq("clearing the name removes the chunk and leaves the pages",
   /C\.deleteChunk\(c\.id\)[\s\S]{0,160}Chunk removed\. Its pages are still here\./.test(html));
eq("renaming is the ordinary case", /C\.saveChunk\(c\.id, \{ name: name\.trim\(\) \}\)/.test(html));

/* ---- the runs, worked out on a list ---- */
const grab = re => { const m = html.match(re); if (!m) throw new Error("not found: " + re); return m[0]; };
const { chunkRuns } = new Function(
  grab(/function chunkRuns\(pages, chunks\)\{[\s\S]*?\n  \}\n/) +
  "return { chunkRuns: chunkRuns };")();

console.log("\nthe runs, on a list:");
const pg = (id, chunkId) => ({ id, chunkId: chunkId || null });
const shape = runs => runs.map(g => (g.chunk ? g.chunk.id : "-") + ":" + g.notes.map(n => n.id).join(","));
const cks = [{ id:"c1", name:"One" }, { id:"c2", name:"Two" }];

eq("no chunks at all is one run", JSON.stringify(shape(chunkRuns([pg("p1"), pg("p2")], []))) ===
   JSON.stringify(["-:p1,p2"]));
eq("a break wherever the chunk changes",
   JSON.stringify(shape(chunkRuns([pg("p1","c1"), pg("p2","c1"), pg("p3")], cks))) ===
   JSON.stringify(["c1:p1,p2", "-:p3"]));
/* The order the pages were already in is the order they stay in. */
eq("nothing is reordered",
   JSON.stringify(chunkRuns([pg("p3","c2"), pg("p1","c1"), pg("p2","c2")], cks)
     .flatMap(g => g.notes.map(n => n.id))) === JSON.stringify(["p3","p1","p2"]));
/* A sitting that was interrupted really did happen twice, and saying so is
   more honest than quietly gathering the pages back together. */
eq("a chunk whose pages are apart shows up twice, and says so by doing it",
   JSON.stringify(shape(chunkRuns([pg("p1","c1"), pg("p2","c2"), pg("p3","c1")], cks))) ===
   JSON.stringify(["c1:p1", "c2:p2", "c1:p3"]));
eq("a page naming a chunk that is gone joins the ungrouped run",
   JSON.stringify(shape(chunkRuns([pg("p1","ghost"), pg("p2")], cks))) === JSON.stringify(["-:p1,p2"]));
const dead = [{ id:"c1", name:"One", deletedAt: 5 }];
eq("and so does one naming a deleted chunk",
   JSON.stringify(shape(chunkRuns([pg("p1","c1")], dead))) === JSON.stringify(["-:p1"]));
eq("an empty list is an empty list", JSON.stringify(chunkRuns([], cks)) === "[]");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
