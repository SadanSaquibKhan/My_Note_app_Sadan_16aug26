import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("the old single page chip is replaced by two nav chips:");
eq("the in-page percent bar is not shown", has(/\.scrolldot\{display:none !important\}/));
eq("section and notebook chips exist", has(/id="secChip"/) && has(/id="bookChip"/));
/* The chip is a seek now: where the chip sits is where you are, page and all.
   Both earlier designs — jump to scrollHeight, and later scroll into the peek
   band and let the swap finish the job — put the chip and the scroll-driven
   swap in charge of the page at the same moment, and they argued across the
   join. That argument was the up-down-up-down bounce.
   The cure was NOT a blanket `if (chipDrag) return` in pageHandover (that would
   kill the very swap the chip needs to show the grey join). Instead the swap
   stands down only while a far chip page is mounting (chipLoading), the chip
   seeks straight to the page under the finger, and — b153 — a held chip is
   exempt from the fling cooldown so it crosses each join without freezing. */
eq("the chip seeks to the page under it; the swap stands down only while a far page loads",
   has(/function chipSeek\(force\)/) &&
   has(/if \(chipDrag && typeof chipLoading === "function" && chipLoading\(\)\) return;/) &&
   has(/if \(!chipDrag && Date\.now\(\) < \(handover\.until \|\| 0\)\) return;/) &&
   !/if \(chipDrag\) return;\s*\n    var coasting/.test(html) &&
   !/p\.scrollTop = p\.scrollHeight; return;/.test(html) &&
   !/scrollToJoin/.test(html));

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall page-tag drag checks passed");
