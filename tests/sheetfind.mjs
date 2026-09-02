/* Find, Replace and the code block follow the page you are looking at (b199).

   They were bound to the open NOTE, always. So with a working sheet up over the
   page — which is the state you are in while you are actually writing rough
   working — Find searched the notes underneath, reported no matches for words
   on the screen in front of you, and Replace All quietly rewrote the page you
   could not see. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("replace acts on the host you are in:");
eq("it asks which host once, at the top", /function runFind\(all\)\{[\s\S]{0,140}var host = activeTextHost\(\);/.test(html));
eq("and walks that host", /var walker = document\.createTreeWalker\(host, NodeFilter\.SHOW_TEXT, null\);[\s\S]{0,120}var n = 0;/.test(html));
/* A tool that writes into a host and then saves the note has done half a job:
   the change is on screen and nowhere else, and next time that sheet is
   mounted it is gone. */
eq("and saves that host, not always the note", /\$\("findStat"\)\.textContent = all \? \("Replaced " \+ n \+ "\."\) : "Replaced 1\.";\s*\n\s*saveHost\(host\);/.test(html));
eq("there is one saver for either host", /function saveHost\(host\)\{/.test(html) &&
   /if \(host && host\.id === "pracText"\) return flushPractice\(\);/.test(html));

console.log("\nso do the marks it draws:");
eq("the search marks are drawn in that host", /findState\.hits = Array\.prototype\.slice\.call\(host\.querySelectorAll\("mark\.findhit"\)\);/.test(html));
/* #body is saved as innerHTML, so a forgotten <mark> is written into the note
   and stays there. */
eq("but clearing them sweeps BOTH hosts, so none is left behind to be saved",
   /editHosts\(\)\.forEach\(function\(h\)\{\s*\n\s*Array\.prototype\.forEach\.call\(h\.querySelectorAll\("mark\.findhit"\)/.test(html));
eq("including normalising both", /h\.normalize\(\);/.test(html));

console.log("\nand a code block lands where the caret is:");
eq("it uses the active host", /\$\("codeBtn"\)\.addEventListener\("click", function\(\)\{\s*\n\s*var host = activeTextHost\(\);/.test(html));
eq("checks the selection against that host", /if \(sel && sel\.rangeCount && host\.contains\(sel\.anchorNode\)\)\{/.test(html));
eq("falls back into that host", /\} else host\.appendChild\(pre\);/.test(html));
eq("and saves it", /\} else host\.appendChild\(pre\);\s*\n\s*saveHost\(host\);/.test(html));

console.log("\nnothing here still reaches for the note by name:");
eq("runFind no longer names #body", !/createTreeWalker\(\$\("body"\), NodeFilter\.SHOW_TEXT/.test(html));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
