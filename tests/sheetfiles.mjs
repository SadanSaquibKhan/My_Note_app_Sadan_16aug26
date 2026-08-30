/* Three ways a sheet was still not quite a page (b191).

   Attachments, the markers that find a sheet again, and what an exported
   notebook carries. All three come from the same root: a working page became a
   real page, and the code around it kept assuming there was only one. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("an attachment lands in the page it was attached to:");
/* The FILE already belonged to the right page — the chip did not. Attaching
   something in a working sheet left the sheet owning a file only the note had a
   way of opening: delete the sheet and the file went with it, while the chip
   stayed behind pointing at nothing. */
eq("the chip goes into the host you were typing in", /var host = activeTextHost\(\);\s*\n\s*return C\.createFile/.test(html));
eq("and the selection is checked against that host, not the note",
   /if \(r && r\.rangeCount && host\.contains\(r\.anchorNode\)\)\{/.test(html));
eq("with the fallback in the same place", /\} else host\.appendChild\(chip\);/.test(html));
eq("the file is still owned by the page being written on", /var owner = activeNoteId\(\);/.test(html));
/* the save has to be the sheet's own, or the chip is drawn and never stored */
eq("a sheet saves itself", /if \(host\.id === "pracText"\) return flushPractice\(\);/.test(html));

console.log("\nand it can be opened afterwards, in either place:");
/* A chip that is never hydrated is a dead label: the click that opens the file
   is attached during hydration, so an un-hydrated chip does nothing at all. */
eq("both hosts' chips are hydrated", /editHosts\(\)\.forEach\(function\(h\)\{\s*\n\s*chips = chips\.concat/.test(html));
eq("hydration still revokes the urls it made first", /Object\.keys\(fileUrls\)\.forEach/.test(html));

console.log("\nre-linking a sheet takes its marker with it:");
/* A marker left behind names a working page that belongs somewhere else now,
   and tapping it walks you off to another page without saying why. */
eq("there is a way to take one off", /function dropWorkPin\(parentId, pracId\)\{/.test(html));
eq("it is aimed at the exact sheet, not every marker on the page",
   /var sel = 'span\.pracpin\[data-pracid="' \+ pracId \+ '"\]';/.test(html));
/* If the old page is the one on screen, editing only the stored copy would be
   undone by the next save of what is being looked at. */
eq("a page that is open is changed on screen, not behind its back",
   /if \(mountedId === parentId\)\{/.test(html));
eq("and one that is not is changed in the store", /return C\.saveNote\(parentId, \{ html: box\.innerHTML \}\);/.test(html));
eq("a page since deleted does not hold the move up", /\}\)\.catch\(function\(\)\{\}\);\s*\n\s*\}\s*\n\s*function relinkWorkingHere/.test(html));
eq("the old parent is remembered before it is overwritten", /var wasFor = prac\.rec\.worksFor;/.test(html));
eq("the old marker comes off before the new one goes on",
   /return dropWorkPin\(wasFor, id\)\.then\(function\(\)\{ return n; \}\);/.test(html));

console.log("\nan exported notebook carries no twins:");
/* A sheet re-linked into another notebook HAS been converted, but its converted
   self is not among this notebook's pages — so the notebook was asked whether
   the conversion had happened, answered no, and shipped the legacy row beside
   it. Importing that file gives you the sheet twice. */
eq("the question is asked of every page, everywhere", /var everywhere = \{\};\s*\n\s*r\[1\]\.forEach\(function\(n\)\{ everywhere\[n\.id\] = 1; \}\);/.test(html));
eq("and the legacy row is judged against it",
   /return ids\[p\.noteId\] && !everywhere\[p\.id\];/.test(html));
eq("while the row still has to belong to this notebook to be carried at all",
   /ids\[p\.noteId\] &&/.test(html));

/* ---- the export rule, run against a re-linked sheet ---- */
console.log("\nthe rule, on a sheet that moved notebooks:");
const notes = [
  { id:"nt_a", notebookId:"A" },            /* the page the sheet was written on */
  { id:"pr_1", notebookId:"B", worksFor:"nt_b" },  /* its converted self, moved to B */
  { id:"nt_b", notebookId:"B" },
];
const legacy = [{ id:"pr_1", noteId:"nt_a" }];
function carried(nbId){
  const ids = {}, everywhere = {};
  notes.forEach(n => { everywhere[n.id] = 1; if (n.notebookId === nbId) ids[n.id] = 1; });
  return legacy.filter(p => ids[p.noteId] && !everywhere[p.id]).map(p => p.id);
}
eq("exporting the old notebook carries nothing", JSON.stringify(carried("A")) === "[]");
eq("and neither does the new one", JSON.stringify(carried("B")) === "[]");
/* the old rule asked only this notebook, so A shipped a row whose converted
   self was sitting in B — one sheet, imported twice */
function carriedOld(nbId){
  const ids = {};
  notes.forEach(n => { if (n.notebookId === nbId) ids[n.id] = 1; });
  return legacy.filter(p => ids[p.noteId] && !ids[p.id]).map(p => p.id);
}
eq("which is what the notebook-local question could not do", JSON.stringify(carriedOld("A")) === '["pr_1"]');
/* a row that genuinely never converted is still worth carrying */
const never = [{ id:"pr_9", noteId:"nt_a" }];
eq("an unconverted row is still carried",
   never.filter(p => ({nt_a:1})[p.noteId] && !({nt_a:1,pr_1:1,nt_b:1})[p.id]).length === 1);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
