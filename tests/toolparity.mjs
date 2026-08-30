/* b183 — the working sheet stops being a poorer editor than the note.

   The editor grew up on the note, so each behaviour was wired straight to that
   one element. Counted before this build: twenty handlers on the note, three on
   the sheet. Everything in between simply did nothing there — a to-do box that
   would not tick, `**bold**` that never expanded, Tab that jumped out of the
   page instead of indenting, pictures that could not be selected, links that
   would not follow, maths that could not be reopened, attachments that could
   not be renamed. It looked like a different, poorer editor because it was one.

   Binding through onEditHost means a behaviour added once reaches both, and the
   next one added cannot quietly become note-only. This suite exists to stop the
   count drifting apart again. */

import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

console.log("there is one way to reach both places you can type:");
eq("editHosts names the note and the sheet",
   /function editHosts\(\)\{[\s\S]{0,300}\$\("body"\)[\s\S]{0,200}\$\("pracText"\)/.test(html));
eq("and onEditHost binds to every one of them",
   /function onEditHost\(type, fn, capture\)\{[\s\S]{0,200}editHosts\(\)\.forEach/.test(html));
/* A missing host must not throw at load: the sheet's markup exists from the
   start here, but a future build could mount it later. */
eq("a host that is not there yet is skipped, not fatal",
   /var b = \$\("body"\); if \(b\) out\.push\(b\);/.test(html) &&
   /var t = \$\("pracText"\); if \(t\) out\.push\(t\);/.test(html));

console.log("the behaviours that were note-only now reach the sheet:");
const both = [
  ["ticking a to-do box",            /onEditHost\("click"[\s\S]{0,200}li\.todo/],
  ["markdown shortcuts on space",    /onEditHost\("keyup"[\s\S]{0,200}e\.key !== " "/],
  ["following an internal link",     /onEditHost\("click"[\s\S]{0,200}a\.ilink/],
  ["editing a maths block",          /onEditHost\("dblclick"[\s\S]{0,300}math/],
  ["selecting a picture",            /onEditHost\("pointerdown"[\s\S]{0,300}figOf\(e\.target\)/],
  ["[[ to link",                     /onEditHost\("keyup"[\s\S]{0,200}e\.key !== "\["/],
  ["Tab indenting a list",           /onEditHost\("keydown"/],
  ["renaming an attachment",         /onEditHost\("contextmenu"[\s\S]{0,300}filechip/]
];
both.forEach(([label, re]) => eq(label + " reaches both", re.test(html)));
eq("a dozen behaviours in total", (html.match(/onEditHost\(/g) || []).length >= 12);

console.log("undo reaches the sheet too, now that it can:");
/* b183 deliberately held this back, and was right to: snapText serialised the
   note whatever host the keystroke came from, so sharing it would have pushed
   the note's own unchanged markup onto the note's stack — snapshots of nothing,
   taken because you typed somewhere else, with real edits pushed off the end.

   b188 removed the reason. There is one history per page now, and which one you
   are undoing follows from where the caret actually is. */
eq("there is one undo history per page, not one for the app",
   /var textHists = \{\};/.test(html) && /function histFor\(id\)\{/.test(html));
eq("which page you are undoing follows the active surface",
   /function activeEditHost\(\)\{[\s\S]{0,300}ink\.active === "practice"[\s\S]{0,200}prac\.rec\.id/.test(html));
eq("typing in either place records", /onEditHost\("input", function\(\)\{[\s\S]{0,160}hist\.timer/.test(html));
eq("and each page's pause timer is its own",
   /var hist = textHistNow\(\);\s*\n\s*clearTimeout\(hist\.timer\);/.test(html));
/* Parking must name the page it parks. By the time a page is being left, "the
   current history" can already be the sheet's. */
eq("parking a page's undo names that page",
   /var hist = histFor\(id\);/.test(html));

console.log("one is deliberately still the note's alone:");
/* A recording is pinned to the note's own lines; the walk up to $("body") finds
   nothing at all from inside the sheet. */
eq("audio caret stamping is not shared yet, and says why",
   /\$\("body"\)\.addEventListener\("input", stampCaretBlock\)/.test(html) &&
   /recording is pinned to the note's own lines/.test(html));

console.log("and two must never be shared:");
/* A working marker lives on the page the sheet was started from. A marker
   inside a sheet would be a sheet hanging off a sheet. */
eq("tapping a working marker stays on the note",
   /\$\("body"\)\.addEventListener\("pointerdown", function\(e\)\{[\s\S]{0,200}pracpin/.test(html));
eq("removing a working marker stays on the note",
   /\$\("body"\)\.addEventListener\("contextmenu", function\(e\)\{[\s\S]{0,200}pracpin/.test(html));

console.log("reference: what parity means");
/* Short notes needed nothing here. They are real pages and use the note's own
   editor, so they already had every one of these. The gap was only ever the
   sheet, which is why closing it closes ten holes at once. */
const areas = { main: 20, shortNotes: 20, workingSheet: 3 };
const after = { main: 20, shortNotes: 20, workingSheet: 3 + 12 };
eq("before, the sheet had a fraction of the note's behaviours",
   areas.workingSheet / areas.main < 0.2);
eq("after, it has the large majority of them",
   after.workingSheet / after.main >= 0.7);
eq("short notes never needed fixing", areas.shortNotes === areas.main);

process.exitCode = bad ? 1 : 0;
