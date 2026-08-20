import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

eq("penDetected records where the nib is",
   /function penDetected\(e\)\{/.test(html) && /ink\.lastPenX = e\.clientX/.test(html));
eq("all three pen routes pass the event",
   (html.match(/penDetected\(e\)/g) || []).length >= 3);
eq("finger pan no longer blocks on penNear alone",
   /else if \(ink\.lock \|\| ink\.mode === "write"\)/.test(html) &&
   /penBlockingPalm\(e\)/.test(html));
eq("finger pan uses the palm test instead",
   /penBlockingPalm\(e\)/.test(html));
eq("coming back from type still restores auto",
   /if \(ink\.mode === "type"\)\{\s*setMode\("auto"\)/.test(html));

const src = html.match(/function penBlockingPalm\(e\)\{[\s\S]*?\n  \}/);
eq("penBlockingPalm extracted", !!src);

function run(ink, cfg, e, now){
  const fn = new Function("ink", "cfg", "Date",
    src[0] + "\n return penBlockingPalm;");
  const FakeDate = { now: function(){ return now; } };
  return fn(ink, cfg, FakeDate)(e);
}

const near = { clientX: 200, clientY: 300 };
const far  = { clientX: 700, clientY: 800 };

eq("no block when the pen is not near",
   run({ penNear:false, lastPenAt:1000, lastPenX:200, lastPenY:300 },
       { penAway:1600 }, near, 1100) === false);
eq("a finger next to the nib is a palm",
   run({ penNear:true, lastPenAt:1000, lastPenX:200, lastPenY:300 },
       { penAway:1600 }, near, 1100) === true);
eq("a finger far from the nib can still scroll",
   run({ penNear:true, lastPenAt:1000, lastPenX:200, lastPenY:300 },
       { penAway:1600 }, far, 1100) === false);
eq("a stale penNear flag does not freeze scroll",
   run({ penNear:true, lastPenAt:1000, lastPenX:200, lastPenY:300 },
       { penAway:1600 }, near, 1000 + 1600 + 500) === false);
eq("unknown pen position stays palm-safe",
   run({ penNear:true, lastPenAt:1000 },
       { penAway:1600 }, far, 1100) === true);

if (bad) console.log("\n" + bad + " failed");
else console.log("\nok  finger scroll after the pen returns");
process.exitCode = bad ? 1 : 0;
