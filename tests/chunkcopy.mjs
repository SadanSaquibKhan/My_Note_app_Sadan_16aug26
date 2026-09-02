/* A copy keeps its own groupings (b201).

   Chunks arrived in b192 and the copying paths predate them, so they carried
   chunk ids across a boundary a chunk cannot cross. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("copying a notebook:");
eq("its chunks are loaded", /sectionsIn\(id\),\s*\n\s*chunksIn\(id\)\]\)/.test(html));
/* Without this the copy's pages went on naming the ORIGINAL notebook's chunks:
   every page showed as ungrouped, and deleting the original tombstoned
   groupings the copy was still pointing at. */
eq("copied, with new ids", /var ckMap = \{\};/.test(html) && /id: newId\("ck"\), notebookId: nb\.id,/.test(html));
eq("re-homed onto the copied sections, not the originals",
   /sectionId: \(c\.sectionId && secMap\[c\.sectionId\]\) \? secMap\[c\.sectionId\] : null,/.test(html));
eq("and every page re-pointed at the copy's own chunk",
   /copy\.chunkId = \(n\.chunkId && ckMap\[n\.chunkId\]\) \? ckMap\[n\.chunkId\] : null;/.test(html));
eq("written with everything else in one transaction",
   /putMany\(\["notebooks","notes","sections","chunks","assets"\]/.test(html));

console.log("\ncopying one page into another notebook:");
/* A chunk belongs to one section of one notebook, so a copy that has left both
   cannot still name it. Spreading the source record carried it over. */
eq("the copy is asked once whether it moved", /var moved = intoNotebookId && intoNotebookId !== src\.notebookId;/.test(html));
eq("a moved copy loses the section", /copy\.sectionId = moved \? null : \(src\.sectionId \|\| null\);/.test(html));
eq("and loses the chunk with it", /copy\.chunkId = moved \? null : \(src\.chunkId \|\| null\);/.test(html));

/* An id that does not map becomes none — the implicit group — never a
   dangling name that hides the page. */
console.log("\nthe rule, run:");
const map = { c1: "C1" };
const rehome = id => (id && map[id]) ? map[id] : null;
eq("a chunk that came along is re-pointed", rehome("c1") === "C1");
eq("one that did not becomes the implicit group", rehome("c9") === null);
eq("and no chunk at all stays no chunk", rehome(null) === null);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
