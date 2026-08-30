/* Offering a new chunk when you come back to a section (b194).

   Offered, never taken. A grouping that appears without being asked for is one
   you then have to go and undo, and undoing it is more work than the tap that
   declines it. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("the policy is its own thing:");
eq("it can be read on its own", /function shouldOfferChunk\(prevEdited, now\)\{/.test(html));
eq("four hours", /var CHUNK_GAP_MS = 4 \* 60 \* 60 \* 1000;/.test(html));
/* The first page of a section is not a break from anything. */
eq("a section with nothing in it yet is not offered a break", /if \(!prevEdited\) return false;/.test(html));
/* Coming back the next morning to a section whose last page is already in a
   chunk is exactly when you want to break out of it. */
eq("being in a chunk already does not silence the offer",
   !/shouldOfferChunk\([^)]*alreadyChunked/.test(html) &&
   /if \(shouldOfferChunk\(gapFrom, Date\.now\(\)\)\)/.test(html));

console.log("\nwhen it is asked:");
/* Read before the page is made, or the page being made is the most recent
   thing in the section and the gap is always nothing. */
eq("the gap is measured before the new page exists",
   /var gapFrom = lastEditedInSection\(sectionId\);\s*\n\s*flush\(\)/.test(html));
eq("from the section's own most recent page", /function lastEditedInSection\(sectionId\)\{/.test(html));
/* The list is sorted, so whatever fell at the end of it was the OLDEST page in
   the section — a new page joined the sitting from weeks ago instead of the one
   from ten minutes ago. */
eq("and the page a new one joins is the one last written in, not the last listed",
   /function lastPageIn\(sectionId\)\{/.test(html) &&
   /if \(!best \|\| \(n\.lastEdited \|\| 0\) > \(best\.lastEdited \|\| 0\)\) best = n;/.test(html) &&
   /var last = lastPageIn\(sectionId\);/.test(html));
eq("and only ordinary pages count", /C\.ordinaryPages\(state\.notes \|\| \[\], state\.sections \|\| \[\]\)\.forEach/.test(html));

console.log("\nwhat the two answers do:");
eq("declining changes nothing at all",
   /\$\("chunkAskNo"\)\.addEventListener\("click", hideChunkOffer\);/.test(html));
eq("accepting makes one chunk and puts the page in it",
   /C\.createChunk\(state\.nbId, want\.sectionId, "Chunk " \+ \(here \+ 1\), Date\.now\(\)\)/.test(html) &&
   /C\.saveNote\(want\.noteId, \{ chunkId: c\.id \}\)/.test(html));
/* Two sections both calling their second sitting Chunk 2 would read as one. */
eq("it is numbered within its own section",
   /return c && !c\.deletedAt && \(c\.sectionId \|\| null\) === \(want\.sectionId \|\| null\);/.test(html));
eq("and the open page's own copy is corrected, not left stale",
   /if \(state\.note && state\.note\.id === want\.noteId\) state\.note\.chunkId = c\.id;/.test(html));

console.log("\nan offer belongs to the page it was made for:");
eq("moving to another page withdraws it",
   /if \(chunkOffer && chunkOffer\.noteId !== state\.note\.id\) hideChunkOffer\(\);/.test(html));
eq("and answering it clears it first, so a slow save cannot be answered twice",
   /var want = chunkOffer;\s*\n\s*hideChunkOffer\(\);/.test(html));

console.log("\nthe bar itself:");
eq("it is the same shape as the backup one", /<div class="notice" id="chunkAsk" hidden>/.test(html));
eq("both answers are named, so neither is a guess",
   /id="chunkAskYes">Start a new chunk</.test(html) &&
   /id="chunkAskNo">Keep it with the last one</.test(html));

/* ---- the policy, run ---- */
const grab = re => { const m = html.match(re); if (!m) throw new Error("not found: " + re); return m[0]; };
const { shouldOfferChunk } = new Function(
  grab(/var CHUNK_GAP_MS = [^\n]*\n/) +
  grab(/function shouldOfferChunk\(prevEdited, now\)\{[\s\S]*?\n  \}\n/) +
  "return { shouldOfferChunk: shouldOfferChunk };")();

console.log("\nthe policy, run:");
const H = 60 * 60 * 1000, now = 1_000_000_000_000;
eq("carrying on the same afternoon is the same sitting", shouldOfferChunk(now - 2 * H, now) === false);
eq("just under four hours is still the same one", shouldOfferChunk(now - 3.9 * H, now) === false);
eq("the next morning is a new one", shouldOfferChunk(now - 14 * H, now) === true);
eq("so is next week", shouldOfferChunk(now - 200 * H, now) === true);
eq("an empty section is never asked", shouldOfferChunk(0, now) === false);
/* A clock that has gone backwards must not produce an offer out of nowhere. */
eq("a page from the future does not trigger it", shouldOfferChunk(now + 5 * H, now) === false);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
