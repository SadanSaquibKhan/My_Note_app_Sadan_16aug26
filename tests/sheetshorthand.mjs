/* The shorthand, the links and the saving reach the sheets (b198, b200).

   The editor grew up on the note, so a behaviour added there worked only there.
   Each of these is invisible until you type the exact keystroke that should
   have fired it. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("the typed shorthand runs where you are typing (b200):");
/* b198 rebound a beforeinput handler that had been a no-op stub since v12, so
   it changed nothing at all. The live path is runTypingAids, and the one line
   that called it sat inside the note's own input listener — the three rules
   themselves work on the caret and were always host-agnostic. Caught only by
   driving it in a browser: the note curled a quote, the sheet did not. */
eq("the sheet runs the typing aids too",
   /if \(typeof runTypingAids === "function"\) runTypingAids\(\);/.test(html));
eq("before its save is queued, so the save carries the finished text",
   html.indexOf("if (typeof runTypingAids === \"function\") runTypingAids();") <
   html.indexOf("prac.saveTimer = setTimeout(flushPractice, 700);"));
/* Marking dirty is the note's way of queueing a save. A sheet queues its own on
   the same input event, so marking the note here would say the wrong page had
   changed. */
eq("and it does not mark the note dirty when you typed in a sheet",
   /var mine = !\(host && host\.id === "pracText"\);/.test(html) &&
   /if \(runSymbol\(\)\) \{ if \(mine\) markDirty\(\); return; \}/.test(html));
eq("all three rules go through the same gate",
   /if \(runSmartQuotes\(\)\) \{ if \(mine\) markDirty\(\); return; \}/.test(html) &&
   /if \(runInlineMarkdown\(\)\) \{ if \(mine\) markDirty\(\); return; \}/.test(html));

console.log("\nbound to both places you can type (b198):");
eq("a typed web address becoming a link",
   /onEditHost\("keyup", function\(e\)\{\s*\n\s*if \(e\.key === " " \|\| e\.key === "Enter"\) autolinkTail\(\);/.test(html));
eq("and the menu on a link inside the page",
   /onEditHost\("contextmenu", function\(e\)\{\s*\n\s*var a = e\.target\.closest \? e\.target\.closest\("a\.ilink"\) : null;/.test(html));
eq("neither is still note-only",
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
