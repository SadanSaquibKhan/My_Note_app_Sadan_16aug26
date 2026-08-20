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
   join. That argument was the up-down-up-down bounce. */
eq("the chip seeks to the page under it, and the swap stands down meanwhile",
   has(/function chipSeek\(force\)/) &&
   has(/if \(chipDrag\) return;\s*\n    var coasting/) &&
   !/p\.scrollTop = p\.scrollHeight; return;/.test(html) &&
   !/scrollToJoin/.test(html));

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall page-tag drag checks passed");
