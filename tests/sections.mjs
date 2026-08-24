/* Notebooks → sections → pages, and the shortcuts bar that jumps them. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

const sortSrc = html.match(/function sortPages\(list\)\{[\s\S]*?\n  \}/);
const grpSrc = html.match(/function notesBySection\(notes, sections\)\{[\s\S]*?\n  \}/);
if (!sortSrc || !grpSrc){
  console.log("MISSING sortPages / notesBySection");
  process.exit(1);
}

const mk = new Function(
  "function splitSeries(title){\n" +
  "  var t = String(title||'').trim();\n" +
  "  var m = t.match(/^(.*?)(\\d+)$/);\n" +
  "  if (!m) return null;\n" +
  "  return { stem: m[1], num: Number(m[2]), pad: m[2].length };\n" +
  "}\n" +
  sortSrc[0] + "\n" + grpSrc[0] + "\n" +
  "return { sortPages, notesBySection };"
);
const S = mk();

const notes = [
  { id:"n1", title:"p1", sectionId:null },
  { id:"n2", title:"p2", sectionId:"sc_a" },
  { id:"n3", title:"p3", sectionId:"sc_a" },
  { id:"n4", title:"p4", sectionId:"sc_b" },
  { id:"n5", title:"p5", sectionId:"gone" }
];
const secs = [
  { id:"sc_a", name:"Lectures", order:1 },
  { id:"sc_b", name:"Problems", order:2 }
];
const g = S.notesBySection(notes, secs);

console.log("pages land in the right section:");
eq("unfiled group first", !g[0].section && g[0].notes.map(n => n.id).join(",") === "n1,n5");
eq("lectures next", g[1].section.id === "sc_a" && g[1].notes.map(n => n.id).join(",") === "n2,n3");
eq("problems last", g[2].section.id === "sc_b" && g[2].notes[0].id === "n4");
eq("a missing section does not hide the page", g[0].notes.some(n => n.id === "n5"));
eq("empty input is safe", S.notesBySection([], []).length === 0);

console.log("schema and wiring:");
/* b168 moved to 5 to add notes.by_works, the index that answers "what working
   pages hang off this page" without walking every note in the database. */
eq("storage version is 5", /var DB_VERSION = 5/.test(html));
eq("working pages are indexed by the page they hang off",
   /createIndex\("by_works", "worksFor"\)/.test(html));
eq("sections store is created", /createObjectStore\("sections"/.test(html));
eq("sections are indexed by notebook", /createIndex\("by_notebook", "notebookId"\)/.test(html));
eq("createNote accepts a section", /function createNote\(notebookId, title, sectionId\)/.test(html));
eq("deleting a section keeps the pages", /Deleting a section never deletes its pages/.test(html));
eq("sections have their own column", /id="secPane"/.test(html) && /id="sectionList"/.test(html));
eq("notebooks start collapsed", /railMin: true/.test(html));
eq("every notebook has a default first section", /function ensureDefaultSection\(/.test(html) && /"Sec1"/.test(html));
eq("new sections are named Sec2, Sec3", /function suggestSectionName\(/.test(html) && /"Sec" \+ \(max \+ 1\)/.test(html));
eq("scroll stays inside the section", /function pageOrder\(\)/.test(html));
eq("neighbours are measured before you scroll", /function warmNeighbourInk\(\)/.test(html));
eq("export carries sections", /sections: r\[6\] \|\| \[\]/.test(html));

console.log("shortcuts bar:");
eq("the bar is in the markup", /id="jumpBar"/.test(html));
eq("Home / Open / Places buttons exist",
   /id="jumpHome"/.test(html) && /id="jumpOpen"/.test(html) && /id="jumpPlaces"/.test(html));
eq("it shrinks to a dot", /id="jumpDot"/.test(html));
eq("the dot can be dragged", /function bindDotDrag\(/.test(html));
eq("Home keeps the notebook open", /This notebook stays open/.test(html));
eq("Settings can hide it", /id="setJumpBar"/.test(html));
eq("section dialog exists", /id="secDlg"/.test(html));
eq("S Pen hold is still the eraser", /function eraserOn\(why\)\{/.test(html));
eq("letting the button go restores the pen",
   /var eraserReturn = null;/.test(html) && /ink\.tool = eraserReturn \|\| "pen";/.test(html));

process.exitCode = bad ? 1 : 0;
