/* A sheet page turns its stored markup into a page you can use (b197).

   The two ways into a sheet — opening it, and turning to another of its pages —
   had drifted apart: one hydrated the pictures, the other hydrated the pictures
   and nothing else, and NEITHER ever rendered the maths. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("one way to bring a sheet page to life:");
eq("it is written out once", /function hydrateSheet\(\)\{/.test(html));
eq("and both ways into a sheet use it",
   (html.match(/hydrateSheet\(\);/g) || []).length >= 2);
eq("opening a sheet uses it", /ink\.active = "practice";\s*\n\s*hydrateSheet\(\);/.test(html));
eq("and so does turning to another of its pages",
   /pracSurface\.undo = \[\]; pracSurface\.redo = \[\];\s*\n\s*hydrateSheet\(\);\s*\n\s*pracSurface\.redraw\(\);/.test(html));

console.log("\nwhat it brings to life:");
eq("pictures", /if \(typeof hydrateImages === "function"\) hydrateImages\(\);/.test(html));
/* The click that opens an attachment is attached during hydration, so a chip
   that is never hydrated is a dead label. Turning a page inside a sheet did
   not hydrate them at all. */
eq("attachments", /if \(typeof hydrateFiles === "function"\) hydrateFiles\(\);/.test(html));
/* A formula written in a working sheet stayed as the raw text you typed — on
   the page, and in every reopening of it. */
eq("and the maths, which a sheet had never rendered once",
   /if \(typeof renderMath === "function"\) renderMath\(el\);/.test(html));
eq("aimed at the sheet, not at the note underneath", /var el = \$\("pracText"\);/.test(html));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
