import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

eq("Simple / All toggle is in Settings",
   /id="setSimple"/.test(html) && /id="setAll"/.test(html));
eq("toolbar Simple button exists", /id="simpleBarBtn"/.test(html));
eq("What is in Simple picker exists",
   /id="simpleGroupPick"/.test(html) && /id="simpleBarPick"/.test(html));
eq("defaults start on Simple",
   /simpleSet: true/.test(html) && /simpleBars: true/.test(html));
eq("applySimpleSet and applySimpleBars exist",
   /function applySimpleSet\(\)\{/.test(html) && /function applySimpleBars\(\)\{/.test(html));
eq("Settings groups are named",
   /data-group="write"/.test(html) && /data-group="pen"/.test(html) &&
   /data-group="simplepick"/.test(html));
eq("rare settings are marked advanced",
   /data-adv="1"/.test(html) && /id="setSpell"/.test(html));
eq("Simple picker is only in All",
   /data-group="simplepick"/.test(html) && !/SIMPLE_GROUPS = \[[^\]]*simplepick/.test(html));
eq("toolbar toggle is wired",
   /simpleBarBtn"\)\.addEventListener\("click"/.test(html));
eq("Settings view toggle is wired",
   /setSimple"\)\.addEventListener\("click"/.test(html) &&
   /setAll"\)\.addEventListener\("click"/.test(html));
eq("applyBars also applies the short toolbars",
   /applySimpleBars\(\)/.test(html));
eq("feature guide mentions Simple / All",
   /Simple \/ All toolbars/.test(html));

const groups = html.match(/var SIMPLE_GROUPS = (\[[^\]]+\])/);
eq("SIMPLE_GROUPS parsed", !!groups);
if (groups){
  const list = Function("return " + groups[1])();
  eq("Simple has the frequent groups",
     list.includes("write") && list.includes("pen") && list.includes("page"));
  eq("Simple does not open on backups or the picker",
     !list.includes("backup") && !list.includes("simplepick") && !list.includes("scroll"));
}

const bars = html.match(/var SIMPLE_BAR_DEFAULTS = SIMPLE_BAR_BTNS\.map/);
eq("Simple toolbar list is derived from the picker list", !!bars);
eq("Pen / Lasso / Bold stay in Simple",
   /"tool_pen"/.test(html) && /"tool_lasso"/.test(html) && /"fmtBold"/.test(html));
eq("Print / Attach stay out of Simple defaults",
   /SIMPLE_BAR_ALL = SIMPLE_BAR_DEFAULTS\.concat\(\[[\s\S]*printBtn/.test(html));

if (bad) console.log("\n" + bad + " failed");
else console.log("\nok  simple vs all");
process.exitCode = bad ? 1 : 0;
