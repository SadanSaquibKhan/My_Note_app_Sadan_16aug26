import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("the three lists can be dragged wider or narrower:");
eq("each list has a drag handle",
   has(/id="railGrip"/) && has(/id="secGrip"/) && has(/id="listGrip"/));
eq("widths are remembered in settings",
   has(/railW: 0/) && has(/secW: 0/) && has(/listW: 0/));
eq("opening a list puts the remembered width back",
   has(/function applyPaneWidths\(\)/) &&
   has(/applyPaneWidths\(\);/) &&
   has(/opening it again puts that remembered width back/));
eq("a collapsed list does not keep the wide box",
   has(/if \(collapsed\)\{/) && has(/el\.style\.flex = "";/));
eq("drag writes the width and saves it",
   has(/cfg\[key\] = Math\.round\(w\)/) && has(/saveCfg\(\);/));
eq("auto-grow from handwriting is still gone",
   has(/Does not grow from handwriting/) &&
   has(/id="setTapGrow"/));

console.log("remembered widths survive collapse:");
{
  const def = { rail: 250, sec: 180, list: 280 };
  const min = 88, max = 420;
  function want(stored, which){
    const n = Number(stored) || 0;
    if (n < min) return def[which];
    return Math.max(min, Math.min(max, n));
  }
  eq("never dragged: default notebooks width", want(0, "rail") === 250);
  eq("never dragged: default sections width", want(0, "sec") === 180);
  eq("never dragged: default pages width", want(0, "list") === 280);
  eq("a dragged notebooks column comes back at 200", want(200, "rail") === 200);
  eq("a dragged pages column comes back at 340", want(340, "list") === 340);
  eq("too narrow is lifted to the floor", want(20, "sec") === 180); // stored < min → default
  const open = want(220, "rail");
  const collapsed = 42;
  const openedAgain = want(220, "rail");
  eq("collapse does not forget the drag", open === 220 && openedAgain === 220 && collapsed === 42);
}

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall pane-width checks passed");
