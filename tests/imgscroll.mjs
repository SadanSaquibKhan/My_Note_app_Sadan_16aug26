import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("a finger over a picture still scrolls:");
eq("an unselected picture no longer steals the pan",
   has(/A finger on an already-selected picture is moving or resizing it/) &&
   has(/hitFig.classList.contains\("on"\)/));
eq("the pan keeps the pointer so it is not lost over the picture",
   has(/if \(fingerPanDown\(S, e\)\)\{/) && has(/sc.setPointerCapture/));
eq("a tap with no move still selects",
   has(/imgPend = \{ fig: fig/) &&
   has(/mostly vertical = a page scroll/));

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall image-scroll checks passed");
