/* Regression for b61–b90 ships. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

eq("deselect then innerHTML", has(/deselectImage\(\);\s*\n      \$\("body"\)\.innerHTML/));
eq("lasso count names pictures", has(/pictures/));
eq("Esc drops lasso", has(/lassoHas\(\)\)\{\s*\n      lassoClear/) || has(/if \(typeof lassoHas === "function" && lassoHas\(\)\)/));
eq("tiny lasso dropped", has(/Box was too small/));
eq("Find Enter", has(/stepFind\(e\.shiftKey \? -1 : 1\)/));
eq("lock settings", has(/id="setLockList"/) && has(/id="setLockSec"/));
eq("convert to text copies words", has(/Typed words copied out/));
eq("peek maths rendered", has(/renderMath\(\$\("prevPeekBody"\)\)/));
eq("paste disabled when empty", has(/lassoPaste\"\)\.disabled/));
eq("collapse write applies at once", has(/ink\.hideLists = cfg\.collapseOnWrite/));
eq("big delete asks", has(/Delete " \+ n \+ " things/));
eq("empty title restored", has(/\$\("noteTitle"\)\.value = state\.note\.title/));
eq("find walks text nodes", has(/createTreeWalker\(\$\("body"\), NodeFilter\.SHOW_TEXT/));
eq("star hint", has(/Starred\. It appears in Starred/));
eq("Esc ends crop", has(/crop\.on && typeof endCrop/));
eq("print hides edgestack", has(/\.edgestack, \.edgetab, \.hovernib/));
eq("elClip persisted", has(/C\.setMeta\("elClip"/));
eq("page tag names section", has(/sec = s\.name \+ " · "/));
eq("Delete key lasso", has(/e\.key === "Delete" \|\| e\.key === "Backspace"/));
eq("lasso Ctrl+C", has(/\$\("lassoCopy"\)\.click\(\)/));
eq("hold Box for contain", has(/lassoShapeHold/));
eq("lasso follows scroll", has(/placeLassoPop\(\)/));
eq("hint is null-safe", has(/if \(!h\) return;/));

process.exitCode = bad ? 1 : 0;
if (bad) console.log(bad + " failed");
else console.log("batch 61–90 ok");
