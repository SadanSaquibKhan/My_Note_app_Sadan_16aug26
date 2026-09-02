/* The shorthand and the links work in the sheets too (b198).

   The editor grew up on the note, so a behaviour added there worked only there.
   These four were still note-only, and each one is invisible until you type the
   exact keystroke that should have fired it. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("bound to both places you can type:");
/* Same keystrokes, plain straight quotes: the sheets looked like a poorer
   editor because for these they were one. */
eq("smart quotes and the rest of the shorthand", /onEditHost\("beforeinput", function\(e\)\{/.test(html));
eq("a typed web address becoming a link", /onEditHost\("keyup", function\(e\)\{\s*\n\s*if \(e\.key === " " \|\| e\.key === "Enter"\) autolinkTail\(\);/.test(html));
eq("and the menu on a link inside the page",
   /onEditHost\("contextmenu", function\(e\)\{\s*\n\s*var a = e\.target\.closest \? e\.target\.closest\("a\.ilink"\) : null;/.test(html));
eq("none of the three is still note-only",
   !/\$\("body"\)\.addEventListener\("beforeinput"/.test(html) &&
   !/\$\("body"\)\.addEventListener\("keyup"/.test(html) &&
   !/\$\("body"\)\.addEventListener\("contextmenu", function\(e\)\{\s*\n\s*var a = /.test(html));

console.log("\nand a sheet saves when you leave it:");
/* The note saves when it loses focus; a sheet only had its 700ms timer, so the
   last few letters of a line could still be in the air when you touched
   something else. */
eq("blur flushes the sheet", /\$\("pracText"\)\.addEventListener\("blur", function\(\)\{ flushPractice\(\); \}\);/.test(html));
eq("the note still does the same", /\$\("body"\)\.addEventListener\("blur", flush\);/.test(html));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
