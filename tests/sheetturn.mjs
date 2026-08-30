/* Scrolling off the end of one sheet page onto the next (b189).

   A sheet's pages are a run. Reaching the foot of one used to stop dead until
   you found the arrow at the top of the sheet, which is not how the pages of a
   notebook behave and is not what a run is for. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("the band is real content, in the right place:");
/* Inside the scroller, so the browser's own scrolling reaches it and there is
   no gesture plumbing to get wrong. AFTER the sheet, never before it: a band
   above the page would move every ink coordinate in the sheet down by its own
   height, and strokes would land off where they were drawn. */
eq("the band sits inside the sheet's scroller",
   /<div class="paper prac" id="pracPaper">[\s\S]{0,600}<div class="pracpeek" id="pracPeek" hidden>/.test(html));
eq("and below the page, so the ink origin is untouched",
   html.indexOf('<div class="pracpeek" id="pracPeek"') > html.indexOf('<div id="pracText"'));
eq("the sheet surface still takes no top padding",
   /S\.name === "note" && typeof prevPad === "function"/.test(html));
/* It carries the live page's own layout class. A preview that lays out even
   slightly differently puts a visible step in the join. */
eq("the next page's words use the live page's layout rules",
   /class="prevpeek-body pracpeek-body" id="pracPeekBody"/.test(html));

console.log("\nturning is a crossing, not a state:");
/* A page shorter than the sheet has its band in view the moment it mounts.
   Asking "is the band showing" on every scroll event would turn that page the
   instant you touched it, and then the next, all the way to the end. */
eq("the band's coverage is remembered", /function armPracPeek\(\)\{ prac\.peekWas = peekCover\(\); \}/.test(html));
eq("and only a move from below the line to above it turns the page",
   /if \(was >= PRAC_TURN \|\| now < PRAC_TURN\) return;/.test(html));
eq("coverage is measured from rects, not from scrollTop arithmetic",
   /pr = p\.getBoundingClientRect\(\), br = band\.getBoundingClientRect\(\)/.test(html));
eq("the line is the same one the finger crosses between ordinary pages",
   /var PRAC_TURN = 0\.60;/.test(html) && /0\.60\b/.test(html));
eq("mounting a page re-arms it", /armPracPeek\(\);\s*\n\s*prac\.turning = false;/.test(html));

console.log("\nit lands on the head of the page it turned to:");
eq("a scrolled turn asks for the top", /gotoPracPage\(prac\.idx \+ 1, true\);/.test(html));
eq("and the top is what it gets, not a remembered place",
   /if \(atTop\) landSheetTop\(mounting\); else restoreSheetPlace\(tab, mounting\);/.test(html));
eq("a page picked from the rail still gets its remembered place",
   /function restoreSheetPlace\(tab, guardId\)/.test(html));

console.log("\nthe end of the run offers, it never creates:");
eq("the offer is a button you press", /<button class="ghost pracpeek-add" id="pracPeekAdd" hidden>/.test(html));
eq("and the turn refuses to run past the last page",
   /if \(prac\.idx \+ 1 >= prac\.pages\.length\) return;/.test(html));
eq("the button is the same one-way-to-add the header uses",
   /\$\("pracPeekAdd"\)\.addEventListener\("click", function\(\)\{ addSheetPage\(\); \}\);/.test(html));
eq("it says which run you are at the end of",
   /End of the short notes in this notebook/.test(html) && /End of the working for this page/.test(html));

console.log("\na turn can never leave the sheet stuck:");
/* The turn waits on a save. If that save never comes back the sheet would be
   left unable to turn for the rest of the session, which is the same class of
   bug the page handover's own guard exists for. */
eq("a guard frees it", /prac\.turnGuard = setTimeout\(function\(\)\{ prac\.turning = false; \}, 2500\);/.test(html));
eq("closing the sheet frees it too", /prac\.turning = false;\s*\n\s*clearTimeout\(prac\.turnGuard\);/.test(html));
eq("scrolling is passive, so it cannot fight the browser's own", /\}, \{ passive: true \}\);/.test(html));

console.log("\nthe run it walks is the run the sheet lists:");
/* The list is fetched once, when the sheet opens. A page saved after that left
   the run holding the version from then — write a line on the next page, come
   back one, and the band underneath said it was empty. */
eq("a saved page goes back into the run, not just into prac.rec",
   /if \(prac\.pages\[i\] && prac\.pages\[i\]\.id === id\) prac\.pages\[i\] = r;/.test(html));
eq("and the band is repainted from it", /if \(prac\.open\) paintPracPeek\(\);/.test(html));
eq("one name for a sheet page, used by the header and the band",
   /function sheetPageName\(i\)\{/.test(html) &&
   /var name = sheetPageName\(prac\.idx\);/.test(html) &&
   /sheetPageName\(prac\.idx \+ 1\)/.test(html));

/* ---- the crossing rule itself, run against a scroll ----
   One trace is one page's scroll, because that is what it is: the moment the
   page turns, the numbers that would have followed describe a page that is
   gone. The real code has the same shape — a scroll arriving mid-turn is
   ignored, and the fresh page's coverage is read again where it lands. */
console.log("\nthe rule, driven with a scroll:");
function run(covers, pages){
  let idx = 0, turning = false, was = null, turns = 0;
  const LINE = 0.60;
  for (const now of covers){
    const prev = (was == null) ? now : was;
    was = now;
    if (turning) continue;
    if (prev >= LINE || now < LINE) continue;
    if (idx + 1 >= pages) continue;
    turning = true; turns++; idx++;
  }
  /* the mount lands at the head of the new page, and re-arms from there */
  if (turning){ was = 0.05; turning = false; }
  return { idx, turns, was };
}
eq("scrolling into the band turns once, and only once",
   run([0, .1, .3, .55, .7, .9], 3).turns === 1);
eq("and lands on the page after this one", run([0, .3, .7], 3).idx === 1);
/* a sheet page shorter than the sheet has its band up from the moment it
   mounts; a rule that read the state would walk the whole run by itself */
eq("a short page whose band is already up does not turn on its own",
   run([.8, .8, .8, .8], 3).turns === 0);
eq("and still turns when you scroll away and back into it",
   run([.8, .2, .8], 3).turns === 1);
eq("a hand wobbling on the line turns once, not once per wobble",
   run([.58, .62, .58, .62, .58, .62], 9).turns === 1);
eq("the last page of the run never turns", run([0, .3, .7, .95], 1).turns === 0);
/* the numbers still arriving from the page being left must not be what the new
   page starts from, or the first twitch on it would turn it again */
eq("the page it lands on starts from its own head, not the old page's foot",
   run([0, .7, .95, .99], 3).was < 0.6);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
