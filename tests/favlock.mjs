import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

const src = html.match(/function favBarWanted\(\)\{[\s\S]*?\n  \}/);
if (!src) { console.log("MISSING favBarWanted"); process.exit(1); }

function run(cfg, state, panelsOff){
  const fn = new Function("cfg", "state", "panelsHidden",
    src[0] + "\n return favBarWanted();");
  return fn(cfg, state, function(){ return panelsOff; });
}

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

const note = { note: { id: "n1" }, view: "note" };
const base = { favBar: true, lockList: false, lockSec: false, lockRail: false };

eq("off when favBar setting is off", run({ ...base, favBar: false }, note, true) === false);
eq("off in the notebooks list", run(base, { note: null, view: "list" }, true) === false);
eq("on when writing with lists folded", run(base, note, true) === true);
eq("off when browsing with lists open and unlocked", run(base, note, false) === false);
eq("on when the page list is locked open",
   run({ ...base, lockList: true }, note, false) === true);
eq("on when the section list is locked open",
   run({ ...base, lockSec: true }, note, false) === true);
eq("on when the notebook list is locked open",
   run({ ...base, lockRail: true }, note, false) === true);
eq("still on with lists folded even if a lock is set",
   run({ ...base, lockList: true }, note, true) === true);

if (bad) console.log("\n" + bad + " failed");
else console.log("\nok  fav bar while a list is locked");
process.exitCode = bad ? 1 : 0;
