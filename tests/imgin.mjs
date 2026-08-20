import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("writing sits on top of a picture:");
eq("the ink layer is above pictures",
   has(/\.inklayer\{[^}]*z-index:6/) && has(/pointer-events:none/));
eq("the pen is not captured by the picture",
   has(/if \(e\.pointerType === "pen"\) return;/) &&
   has(/the paper handler writes on the picture/));

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall write-on-image checks passed");
