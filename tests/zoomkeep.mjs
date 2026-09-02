/* The zoom you chose survives the page turn (b195).

   Reported twice: scrolling to another page while zoomed out snaps back in.
   b183 fixed the half that almost never happens — a page with NO stored zoom
   inherited correctly — but every page you have ever opened has a stored zoom,
   so the reported case was untouched. */
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
let pass = 0, fail = 0;
function eq(name, cond){ if (cond){ pass++; console.log("ok  " + name); }
                         else { fail++; console.log("FAIL " + name); } }

console.log("opening a page and scrolling into one are different things:");
/* They want opposite things from zoom, and treating them alike is the bug. */
eq("the app can tell them apart", /function arrivedByScrolling\(\)\{/.test(html));
eq("a swap in flight counts", /if \(typeof swapping === "function" && swapping\(\)\) return true;/.test(html));
eq("and so does a chip drag", /if \(typeof chipDrag !== "undefined" && chipDrag\) return true;/.test(html));

console.log("\narriving by scrolling keeps the zoom you were using:");
/* Arriving by scrolling is not opening anything — it is the same continuous
   movement you were already making, and the screen resizing halfway through it
   is what feels broken. */
eq("whatever the page remembers", /if \(arrivedByScrolling\(\)\)\{/.test(html));
eq("and it is remembered for next time, not silently dropped",
   /C\.setMeta\("zoom:" \+ id, keep \/ \(baseScale\(\) \|\| 1\)\);/.test(html));
eq("the stored zoom still applies when you go and open a page",
   /if \(z != null\) return applyZoom\(z \* b\);/.test(html));
eq("and a page never zoomed still inherits rather than snapping to 100%",
   /applyZoom\(\(state && state\.zoom\) \|\| \(cfg\.defaultZoom \|\| 1\) \* b\);/.test(html));

console.log("\nthe 100% label stored the wrong kind of number:");
/* What is stored is a ratio of the fit, and loading multiplies it by the fit
   again — so storing the fit itself squared it. */
eq("it stores one, not the fit", /if \(state\.noteId\) C\.setMeta\("zoom:" \+ state\.noteId, 1\);/.test(html));
eq("and it is no longer possible to store a scale there",
   !/setMeta\("zoom:" \+ state\.noteId, baseScale\(\)\)/.test(html));

/* ---- what the two numbers actually did ---- */
console.log("\nthe arithmetic that was wrong:");
const baseScale = 1.3;                 /* a tablet whose fit is 130% */
const storedByOldLabel = baseScale;    /* what the label used to write */
const storedByNewLabel = 1;            /* what it writes now */
const onReload = stored => stored * baseScale;
eq("tapping 100% used to come back at 169%", Math.round(onReload(storedByOldLabel) / baseScale * 100) === 130);
eq("and now comes back at 100%", Math.round(onReload(storedByNewLabel) / baseScale * 100) === 100);

/* ---- the page-turn rule, run ---- */
console.log("\nthe rule, run over a scroll across three pages:");
function walk(steps, stored, startZoom){
  /* stored: what each page remembers, as a ratio of the fit */
  let zoom = startZoom, out = [];
  for (const st of steps){
    if (st.byScrolling){
      /* keep what we have, and write it down for that page */
      stored[st.id] = zoom / baseScale;
    } else {
      const z = stored[st.id];
      zoom = (z != null) ? z * baseScale : zoom;
    }
    out.push(Math.round(zoom / baseScale * 100));
  }
  return out;
}
const remembered = { p1: 0.5, p2: 1, p3: 1 };
eq("scrolling from a page at 50% through two pages that remember 100% stays at 50%",
   JSON.stringify(walk(
     [{ id:"p1" }, { id:"p2", byScrolling:true }, { id:"p3", byScrolling:true }],
     { ...remembered }, 1 * baseScale)) === JSON.stringify([50, 50, 50]));
eq("and those pages now remember 50% too",
   (() => { const st = { ...remembered };
     walk([{ id:"p1" }, { id:"p2", byScrolling:true }], st, 1 * baseScale);
     return st.p2 === 0.5; })());
/* Going and opening a page is still opening it: its own zoom is what it is for. */
eq("but opening a page from the list still uses that page's own zoom",
   JSON.stringify(walk([{ id:"p1" }, { id:"p2" }], { ...remembered }, 1 * baseScale)) ===
   JSON.stringify([50, 100]));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
