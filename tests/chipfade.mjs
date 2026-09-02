/* The chips get out of the way, and an inserted page stays in its chunk (b196). */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("a chip sits over the page you are writing on:");
/* Faint, not invisible: a chip is also the only thing on screen saying where in
   the notebook you are, and something you cannot find is worse than something
   slightly in the way. */
eq("at rest it is faint enough to read through", /\.navchip\.tuck\{opacity:\.42\}/.test(html));
eq("and it fades rather than blinking", /transition:transform \.2s ease, opacity \.18s ease;/.test(html));
/* .tuck already means "you have not touched me for a second", which is exactly
   the right moment — a second idea of resting could disagree with the first. */
eq("resting is the tuck that already existed, not a second idea of it",
   /var CHIP_TUCK_MS = 1100;/.test(html) &&
   /el\.classList\.toggle\("tuck", !!chipDock\[chipKindOf\(el\)\]\);/.test(html));

console.log("\nthe one in your hand is solid:");
eq("a dragged chip says so itself", /el\.classList\.toggle\("dragging", !!\(chipDrag && chipDrag\.kind === chipKindOf\(el\)\)\);/.test(html));
/* Waking is a timer; the finger is already there. */
eq("and that beats being tucked", /\.navchip\.dragging\{opacity:1 !important\}/.test(html));
eq("only the one you are holding, not both", /chipDrag\.kind === chipKindOf\(el\)/.test(html));

console.log("\ninserting a page next to the open one:");
eq("there is a button for it", /id="insertPageBtn"/.test(html) &&
   /insBtn\.addEventListener\("click", insertPageHere\);/.test(html));
eq("it inserts after the page you have open", /return C\.insertPageAfter\(nbId, afterId\);/.test(html));
/* Without this an inserted page dropped out of its chunk and split one heading
   into three: the sitting before it, the new page alone, the same sitting again
   underneath. */
eq("and the new page belongs to whatever it was put between",
   /var join = \{ chunkId: \(after && after\.chunkId\) \|\| null \};/.test(html));
eq("on both paths, numbered and not",
   /return createNote\(nbId, "", sec, join\);/.test(html) &&
   /return createNote\(nbId, seriesName\(p\.stem, p\.num \+ 1, p\.pad\), sec, join\);/.test(html));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
