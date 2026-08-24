import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
const split = html.match(/function splitSecPage\(title\)\{[\s\S]*?\n  \}/)[0];
const name = html.match(/function secPageName\(s, p, suffix\)\{[\s\S]*?\n  \}/)[0];
const plan = html.match(/function planSecPageNames\(notes, sections\)\{[\s\S]*?\n  \}/)[0];
const secN = html.match(/function sectionNumber\(sec, index\)\{[\s\S]*?\n  \}/)[0];
const by = html.match(/function notesBySection\(notes, sections\)\{[\s\S]*?\n  \}/)[0];
const sort = html.match(/function sortPages\(list\)\{[\s\S]*?\n  \}/);
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

const splitSeries = html.match(/function splitSeries\(name\)\{[\s\S]*?\n  \}/)[0];
/* b168: planSecPageNames now asks whether a section is a drawer and whether a
   page is a working page, so the two answering functions have to come along or
   the extracted copy throws where the real one is fine. */
const kinds = html.match(/var DRAWER_KINDS = \{[\s\S]*?\};/)[0];
const isDrawer = html.match(/function isDrawer\(sec\)\{.*\}/)[0];
const isWork = html.match(/function isWorkingPage\(n\)\{.*\}/)[0];
const mk = new Function(
  splitSeries + "\n" + kinds + "\n" + isDrawer + "\n" + isWork + "\n" +
  (sort ? sort[0] : "function sortPages(l){return l.slice();}") + "\n" +
  by + "\n" + split + "\n" + name + "\n" + secN + "\n" + plan + "\n" +
  "return { splitSecPage, secPageName, planSecPageNames };"
);
const S = mk();

console.log("S1P1 names keep the topic on the end:");
const a = S.splitSecPage("s1p2_topic name");
eq("parses s and p", a && a.s === 1 && a.p === 2);
eq("keeps the suffix", a && a.suffix === "_topic name");
eq("rebuilds S2P3_topic name", S.secPageName(2, 3, a.suffix) === "S2P3_topic name");

const notes = [
  { id:"n1", title:"s1p2_topic name", sectionId:"sc_b" },
  { id:"n2", title:"hello", sectionId:"sc_a" }
];
const secs = [{ id:"sc_a", name:"sec0" }, { id:"sc_b", name:"sec1" }];
const p = S.planSecPageNames(notes, secs);
eq("custom titles are left alone", !p.some(x => x.id === "n2"));
eq("wrong number is fixed", p.some(x => x.id === "n1" && x.to === "S2P1_topic name"));
eq("there is a button to do it", /id="fixNamesBtn"/.test(html));
eq("it is undoable", /Renumber to S#P#/.test(html));

/* b168. A working page is named after the page it hangs off — S2P2w1 — and
   lives in a section marked as a drawer. Renumbering used to walk every
   section it was given, so the moment the Working drawer existed it would have
   renamed every working page to S3P1, S3P2 … throwing away the one piece of
   text that says what each sheet is actually for, and leaving every marker on
   the page pointing at a name that no longer means anything. */
console.log("the drawers are not part of the numbering:");
const dNotes = [
  { id:"n1", title:"s1p2", sectionId:"sc_a" },
  { id:"w1", title:"S1P2w1", sectionId:"sc_w", worksFor:"n1", workOrder:0 }
];
const dSecs = [{ id:"sc_a", name:"sec0" }, { id:"sc_w", name:"Working", kind:"working" }];
const dp = S.planSecPageNames(dNotes, dSecs);
eq("a working page is never renumbered", !dp.some(x => x.id === "w1"));
eq("ordinary pages in the same notebook still are", dp.some(x => x.id === "n1"));

process.exitCode = bad ? 1 : 0;
