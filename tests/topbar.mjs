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

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall top-bar checks passed");
