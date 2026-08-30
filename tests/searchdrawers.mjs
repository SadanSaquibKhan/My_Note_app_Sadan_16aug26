/* Search knows WHICH drawer, and a result opens what it matched (b190).

   When working pages became real pages they started answering every ordinary
   search, which buries the clean notes — so drawer pages were excluded. That
   went one drawer too far and took the short notes with them: a short note is
   the boiled-down version of a stretch of pages, and it is the single most
   findable thing in a notebook. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("the question is which drawer, not whether:");
eq("there is one answer to it", /function pageDrawer\(n, kinds\)\{/.test(html));
eq("and the page's own marks are asked before its filing",
   /if \(n\.worksFor\) return "working";\s*\n\s*if \(isSummaryPage\(n\)\) return "summary";/.test(html));
eq("it is shared, not re-derived by each caller", /drawerKinds:drawerKinds, pageDrawer:pageDrawer,/.test(html));
eq("the old whether-question is still there for the lists that only need it",
   /function isDrawerPage\(n, drawerIds\)\{/.test(html));

/* the real functions, lifted out and run */
const grab = re => { const m = html.match(re); if (!m) throw new Error("not found: " + re); return m[0]; };
const fns = new Function(
  grab(/function isDrawer\(sec\)\{[^\n]*\n/) .replace("DRAWER_KINDS", "({working:1,summary:1})") + "\n" +
  grab(/function isSummaryPage\(n\)\{[^\n]*\n/) + "\n" +
  grab(/function drawerKinds\(sections\)\{[\s\S]*?\n  \}\n/) + "\n" +
  grab(/function pageDrawer\(n, kinds\)\{[\s\S]*?\n  \}\n/) + "\n" +
  "return { drawerKinds: drawerKinds, pageDrawer: pageDrawer };")();

const secs = [{ id:"sw", kind:"working" }, { id:"ss", kind:"summary" }, { id:"s1", kind:null }];
const kinds = fns.drawerKinds(secs);
console.log("\nrun against real records:");
eq("a working page is working", fns.pageDrawer({ worksFor:"nt_1" }, kinds) === "working");
eq("a short note is a short note", fns.pageDrawer({ covers:[] }, kinds) === "summary");
eq("an ordinary page is neither", fns.pageDrawer({ sectionId:"s1" }, kinds) === null);
/* a sheet can arrive from another device before its drawer does */
eq("a working page filed nowhere is still working", fns.pageDrawer({ worksFor:"nt_1", sectionId:null }, kinds) === "working");
eq("a page filed in the working drawer is working", fns.pageDrawer({ sectionId:"sw" }, kinds) === "working");
eq("a page filed in the short-note drawer is a short note", fns.pageDrawer({ sectionId:"ss" }, kinds) === "summary");
eq("an unfiled ordinary page is neither", fns.pageDrawer({ sectionId:null }, kinds) === null);

console.log("\nsearch lets the short notes through and keeps the working out:");
eq("only working is turned away", /var drawer = pageDrawer\(n, kinds\);\s*\n\s*if \(drawer === "working"\) return;/.test(html));
eq("and a short note is marked as one", /where: drawer === "summary" \? "summary" : "note"/.test(html));
eq("the working results are still opt-in", /if \(opts\.includePractice\)\{/.test(html));

console.log("\na working result is the page that matched:");
/* Storing the parent here meant tapping a working hit opened the clean note
   and showed you everything except the words you had searched for. */
eq("the hit is the working page", /hits\.push\(\{ note: w, parent: parent \|\| null, where:"practice",/.test(html));
eq("the page it hangs off is kept beside it, for the row to name",
   /h\.parent \? " on " \+ C\.displayTitle\(h\.parent\) : ""/.test(html));
/* Every short note is stored titled "Summary", so the row has to be named by
   the stretch of pages it was written about or every one of them reads alike. */
eq("a short note is named by the page it is about",
   /\("Short note" \+ \(h\.parent \? " on " \+ C\.displayTitle\(h\.parent\) : ""\)\)/.test(html));
eq("and the search hands it that page", /if \(drawer === "summary" && n\.covers && n\.covers\[0\]\)/.test(html));

console.log("\nand tapping it opens the sheet, which is not a page you can go to:");
eq("there is one opener for either kind", /function openSheetPage\(id\)\{/.test(html));
eq("a working page opens as its sheet", /if \(rec\.worksFor\) return openPracticeById\(id\);/.test(html));
/* A short note hangs off no single page, so it opens over the first it covers */
eq("a short note opens over the first page it covers",
   /var first = \(rec\.covers && rec\.covers\[0\]\) \|\| null;/.test(html));
eq("the row uses it instead of navigating",
   /if \(h\.where === "practice" \|\| h\.where === "summary"\)\{ openSheetPage\(h\.note\.id\); return; \}/.test(html));
eq("a deleted sheet says so rather than opening nothing",
   /if \(!rec \|\| rec\.deletedAt\)\{ say\("That page is no longer there\."\); return; \}/.test(html));

console.log("\nthe all-working list keeps each notebook together:");
eq("the notebook is the first thing compared", /if \(ka\.bo !== kb\.bo\) return ka\.bo - kb\.bo;/.test(html));
eq("with the id to settle a tie, so two books never interleave",
   /if \(ka\.book !== kb\.book\) return ka\.book < kb\.book \? -1 : 1;/.test(html));
eq("a page in the bin counts as gone", /if \(n && !live\(n\)\) n = null;/.test(html));
eq("and its notebook is still named, from the sheet itself",
   /var bookId = \(n && n\.notebookId\) \|\| p\.notebookId;/.test(html));

/* ---- the comparator, run against sheets from two notebooks ---- */
console.log("\nthe order, worked out on real rows:");
const nb = { A:{ order:0 }, B:{ order:1 } };
const rank = { a1:0, a2:1, b1:0 };
function key(x){
  const n = x.note;
  if (!n) return { gone:1, bo:9e15, book:"", miss:9e15, at:9e15 };
  const book = nb[n.notebookId];
  const at = rank[n.id];
  return { gone:0, bo: (book && book.order != null) ? book.order : 9e14,
           book: n.notebookId || "", miss: (at == null) ? 1 : 0,
           at: (at == null) ? (n.createdAt || 0) : at };
}
function cmp(a,b){
  const ka = key(a), kb = key(b);
  if (ka.gone !== kb.gone) return ka.gone - kb.gone;
  if (ka.bo !== kb.bo) return ka.bo - kb.bo;
  if (ka.book !== kb.book) return ka.book < kb.book ? -1 : 1;
  if (ka.miss !== kb.miss) return ka.miss - kb.miss;
  if (ka.at !== kb.at) return ka.at - kb.at;
  return (a.practice.workOrder||0) - (b.practice.workOrder||0);
}
const row = (id, noteId, book, order) => ({
  practice:{ id, workOrder: order }, note: noteId ? { id: noteId, notebookId: book } : null });
const rows = [
  row("B1w1", "b1", "B", 0),
  row("A2w1", "a2", "A", 0),
  row("orphan", null, null, 0),
  row("A1w2", "a1", "A", 1),
  row("A1w1", "a1", "A", 0),
];
const got = rows.slice().sort(cmp).map(r => r.practice.id);
eq("one notebook's sheets stay together, in page then sheet order",
   JSON.stringify(got) === JSON.stringify(["A1w1","A1w2","A2w1","B1w1","orphan"]));
eq("a sheet whose page is gone goes to the end", got[got.length - 1] === "orphan");
/* before this, rank restarted at zero in every notebook and nothing said which
   notebook a row belonged to, so page 1 of one subject sorted level with page 1
   of another and the list alternated between them */
const naive = rows.slice().sort((a,b) => {
  const ra = a.note ? rank[a.note.id] : 9e15, rb = b.note ? rank[b.note.id] : 9e15;
  return (ra - rb) || ((a.practice.workOrder||0) - (b.practice.workOrder||0));
}).map(r => r.practice.id);
eq("which is what the old comparator could not do",
   JSON.stringify(naive) !== JSON.stringify(got));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
