/* Home board, tab-strip Home/+, persist open notebooks, rail folds.
   Run: node tests/homeui.mjs index.html
*/
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

eq("reload does not prune open notebooks before the list has loaded",
   has(/Until notebooks have loaded, every id looks deleted/) &&
   has(/if \(!state\.notebooks \|\| !state\.notebooks\.length\) return;/));
eq("the last page is remembered across a Chrome reload",
   has(/setMeta\("lastHash"/) && has(/getMeta\("lastHash"/));
eq("Sync is on the top bar", has(/id="syncChip"/) && has(/title="Copy now"/));
eq("Full screen is on the top bar", has(/id="fullScrBtn"/));
eq("Tabs on/off is on the top bar", has(/id="topTabsBtn"/));
eq("Home is on the notebook tab strip", has(/id="chromeHome"/));
eq("Home shows a folder and notebook board",
   has(/id="homeBoard"/) && has(/function paintHomeBoard/));
eq("recently opened can be hidden and brought back",
   has(/id="recentHide"/) && has(/id="recentShow"/) && has(/recentFold/));
eq("weak / working lists can be hidden and brought back",
   has(/id="railFootHide"/) && has(/id="railFootShow"/) && has(/railFootFold/));
eq("recently opened can be resized by dragging",
   has(/id="recentGrip"/) && has(/cursor:row-resize/));

if (bad) console.log("\n" + bad + " failed");
process.exitCode = bad ? 1 : 0;
