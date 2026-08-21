/* The header's action buttons (Settings, Data, Sync, Full, Tabs, ...) used to
   sit in a single non-shrinking row (.topright flex:none), so on a tablet-portrait
   width they ran off the right edge — Settings and Data fell off the page and the
   overflow pushed a page-wide grey strip. They now shrink and WRAP, right-aligned,
   so the last buttons drop to a second visible row; .top clips any residual so the
   page can never gain a sideways scroll.
   Browser-verified (900px wide, home view): page horizontal overflow = 0,
   Settings + Data both on-screen (second row); at 1400px it stays one row. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

eq("the action row shrinks and wraps, right-aligned",
   has(/\.topright\{[^}]*flex:0 1 auto[^}]*min-width:0[^}]*flex-wrap:wrap[^}]*justify-content:flex-end/));
eq("the header clips residual overflow so there is no page-wide grey strip",
   has(/\.top\{[\s\S]*?overflow:hidden;[^]*?a too-wide action row wraps/));
eq("Settings and Data still live in the header action row",
   has(/id="setBtn"/) && has(/id="dataBtn"/) && has(/<div class="topright">/));

/* Bug A: the mode chip (AUTO/PEN/WRITE/TYPE) and save word (ready/unsaved/saved)
   change TEXT while you write; if they change WIDTH the .topright wrap point
   moves, a button jumps rows, the header height changes and the writing shifts
   up when the pen touches. Fixed widths keep the header a constant height.
   Browser-verified at 900px: .top height is 101px for every mode/save text. */
eq("the mode chip and save word have fixed widths (header height cannot change on pen-down)",
   has(/#modeChip\{box-sizing:border-box; min-width:52px; text-align:center\}/) &&
   has(/#saveWord\{display:inline-block; min-width:66px\}/));
/* Bug C: the "Panels folded" notice fired on every pen-arrival even when the
   panels were already folded. Now guarded by the pre-fold state. */
eq("the 'Panels folded' notice only shows when the panels were actually open",
   has(/var wasFolded = \(typeof panelsHidden === "function"\) \? panelsHidden\(\) : false;/) &&
   has(/if \(allFree && !wasFolded\) hint\("Panels folded\./));

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall top-bar checks passed");
