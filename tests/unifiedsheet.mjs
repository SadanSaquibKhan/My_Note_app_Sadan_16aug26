/* b187 — rough working and short notes become one sheet with two names.

   They were already the same underneath: a real page in a drawer. But a short
   note opened by navigating away from the page you were summarising, which took
   the very thing you were writing about off the screen, while rough working
   opened over it in a sheet. Two mechanisms for one idea.

   One sheet now. The kind decides three things and nothing else: the edge it
   arrives from, the colour of its paper, and which pages it lists.

   That last one is the interesting half. Rough working lists the sheets of the
   page you are on, because that is what rough working is for. A short note
   lists EVERY short note in the notebook, ordered by what each covers — so one
   written on P2 about pages 2 to 4 and another written on P5 about 5 to 8 are
   one run, and scrolling back from the second reaches the first. */

import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

console.log("one sheet, and the kind decides the rest:");
eq("the sheet knows which kind it is holding", /prac\.kind = kind \|\| prac\.kind \|\| "working";/.test(html));
eq("the dock follows from the kind, it is not set separately",
   /data-dock", \(prac\.kind === "summary"\) \? "top" : "bottom"/.test(html));
eq("a top-docked sheet leaves by the edge it arrived from",
   /\.pracsheet\[data-dock="top"\]\.off\{transform:translateY\(-110%\)\}/.test(html));
eq("and a bottom-docked one still leaves downward",
   /\.pracsheet\.off\{transform:translateY\(110%\)/.test(html));
eq("each kind writes on its own paper",
   /\.pracsheet\[data-kind="summary"\][^\n]*--field:var\(--ground-short\)/.test(html));

console.log("which pages a sheet lists is the whole difference:");
eq("there is one resolver for it", /function sheetPageList\(kind, note\)\{/.test(html));
eq("working lists the sheets of the page you are on",
   /function sheetPageList[\s\S]{0,300}C\.practicePages\(note\.id\)/.test(html));
eq("a short note lists the whole notebook's run",
   /function sheetPageList[\s\S]{0,200}C\.summaryRun\(note\.notebookId\)/.test(html));

console.log("the run is ordered by what each note covers:");
eq("there is a run", /function summaryRun\(notebookId\)\{/.test(html));
const run = (html.match(/function summaryRun\(notebookId\)\{[\s\S]*?\n  \}/) || [""])[0];
eq("ordered by the first page each one covers", /firstCovered/.test(run));
/* Reading the order out of a title only holds while every page is auto-named.
   Rename one page and the sheets sort by a number that means nothing. */
eq("using the notebook's real page order, not anything in a title",
   /notesBySection\(ordinaryPages\(here, secs\), secs\)/.test(run) && !/splitSecPage/.test(run));
eq("a note covering nothing still here goes last, not first",
   /if \(fa == null\) return 1;/.test(run) && /if \(fb == null\) return -1;/.test(run));

/* Reference: the ordering the run has to produce. */
const rank = { p2: 1, p5: 4 };
const notes = [
  { id: "late",  covers: [{ noteId: "p5" }] },
  { id: "early", covers: [{ noteId: "p2" }] },
  { id: "orphan", covers: [{ noteId: "gone" }], createdAt: 1 }
];
const first = x => {
  let best = null;
  (x.covers || []).forEach(c => {
    if (rank[c.noteId] == null) return;
    if (best == null || rank[c.noteId] < best) best = rank[c.noteId];
  });
  return best;
};
notes.sort((a, b) => {
  const fa = first(a), fb = first(b);
  if (fa == null && fb == null) return (a.createdAt||0) - (b.createdAt||0);
  if (fa == null) return 1;
  if (fb == null) return -1;
  return fa - fb;
});
eq("earlier pages first, orphan last", notes.map(n => n.id).join(",") === "early,late,orphan");

console.log("opening one does not take you off the page you are summarising:");
eq("Sum up opens the sheet rather than navigating",
   /function openSummaryAt\(noteId\)\{[\s\S]{0,400}openPractice\(at, "summary"\)/.test(html));
eq("and opens the run at the note that covers this page",
   /run\.forEach\(function\(r, i\)\{ if \(noteId && r\.id === noteId\) at = i; \}\)/.test(html));

console.log("every way in says which kind it wants:");
/* prac.kind is remembered between opens so turning pages inside a sheet stays
   in that sheet — which meant a button that did not say inherited whatever was
   last open, and Practice after reading a short note opened another short note. */
eq("the Practice button asks for working", /openPractice\(0, "working"\)/.test(html));
eq("the badge asks for working", /openPractice\(0, "working"\);/.test(html));
eq("opening by id works the kind out from the record itself",
   /openPractice\(i, rec\.worksFor \? "working" : "summary"\)/.test(html));

console.log("adding a page adds the right kind of page:");
eq("there is one way to add one", /function addSheetPage\(\)\{/.test(html));
const add = (html.match(/function addSheetPage\(\)\{[\s\S]*?\n  \}/) || [""])[0];
eq("a short note gets another short note", /C\.createSummaryFor\(parent\.worksFor \|\| parent\.id, null\)/.test(add));
eq("a working sheet gets another working page", /C\.addPracticePage\(parent\.id\)/.test(add));
eq("and it lands on the page it just made",
   /list\.forEach\(function\(r, i\)\{ if \(made && r\.id === made\.id\) at = i; \}\)/.test(add));

console.log("the markers differ by colour, because they behave the same:");
eq("a marker carries its kind", /el\.setAttribute\("data-kind", kind \|\| "working"\);/.test(html));
eq("and is coloured by it",
   /span\.pracpin\[data-kind="working"\]\{color:/.test(html) &&
   /span\.pracpin\[data-kind="summary"\]\{color:/.test(html));

console.log("a short note is not named like a working sheet:");
/* S2P3w1 says exactly what a working sheet is for. For a note written about
   pages 2 to 4 it was a lie — it read S1P5w2. */
eq("it is named as a short note", /\("Short note " \+ \(prac\.idx \+ 1\)\)/.test(html));
eq("and points back at the first page it covers",
   /if \(!src && rec && Array\.isArray\(rec\.covers\) && rec\.covers\.length\)/.test(html));
eq("the way back is the header itself", /el\.classList\.add\("goback"\);/.test(html));

process.exitCode = bad ? 1 : 0;
