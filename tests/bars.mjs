/* b39: the toolbars — hide whole bars, hide single buttons, land minimised. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("Show the tools lands you on the small note bar:");
eq("the pen and typing bars fold when tools come back",
   has(/barMin\.showFmtBar = true; barMin\.showInkBar = true;\s*\n    applyBars\(\);/));
eq("there is a transient fold separate from the Settings one", has(/var barMin = \{ showFmtBar: false, showInkBar: false/));
eq("a bar is folded if EITHER source says so",
   has(/function barFolded\(b\)\{ return cfg\[b\.key\] === false \|\| barMin\[b\.key\] === true; \}/));
eq("the restore chip clears both", has(/barMin\[b\.key\] = false;\s*\/\* clear the "for now" fold \*\//) &&
   has(/cfg\[b\.key\] = true;\s*\/\* and the permanent one \*\//));
eq("applyBars reads the combined state", has(/document\.body\.classList\.toggle\(b\.cls, barFolded\(b\)\)/));
eq("the rail lists every folded bar", has(/var hidden = BARS\.filter\(barFolded\);/));

console.log("");
console.log("every bar can be hidden from Settings, pen included:");
eq("the pen-tools checkbox exists", has(/id="setInkBar"/));
eq("it is wired and clears its own fold", has(/cfg\.showInkBar = this\.checked;\s*\n      barMin\.showInkBar = false;/));
eq("turning a bar off in Settings refreshes the bars", has(/cfg\.showDocBar = this\.checked; barMin\.showDocBar = false; saveCfg\(\); applyBars\(\);/));
eq("the checkboxes re-sync when a chip turns a bar back on", has(/function syncBarChecks\(\)\{/));

console.log("");
console.log("individual note-bar buttons can be hidden:");
eq("there is a hideable-button list", has(/var HIDEABLE_BTNS = \[/));
{
  const m = html.match(/var HIDEABLE_BTNS = \[([\s\S]*?)\];/);
  const ids = m ? [...m[1].matchAll(/\["(\w+)"/g)].map(x => x[1]) : [];
  console.log("   " + ids.length + " buttons: " + ids.join(" "));
  for (const need of ["drawBtn","immerseBtn","outlineBtn"])
    eq("  the ones you named are in it: " + need, ids.includes(need));
  eq("  every listed id is a real button", ids.every(id => new RegExp('id="' + id + '"').test(html)));
}
eq("hiding is applied", has(/function applyBtnHide\(\)\{/) && has(/el\.hidden = !!\(cfg\.hideBtns && cfg\.hideBtns\[b\[0\]\]\);/));
eq("the settings list is built from the same array", has(/function buildBtnHide\(\)\{/) && has(/cb\.checked = !\(cfg\.hideBtns && cfg\.hideBtns\[b\[0\]\]\);/));
eq("a ticked box shows, an unticked hides", has(/if \(this\.checked\) delete cfg\.hideBtns\[b\[0\]\];\s*\n        else cfg\.hideBtns\[b\[0\]\] = 1;/));
eq("the choice persists", has(/hideBtns: \{\},/));
eq("it is re-applied whenever config loads", has(/if \(typeof applyBtnHide === "function"\) applyBtnHide\(\);/));
eq("there is somewhere in Settings to do it", has(/id="btnHideList"/) && has(/Buttons on the note bar/));

console.log("");
console.log("the bars are more compact:");
eq("pure button rows scroll sideways instead of stacking", has(/\.fmtbar, \.inktools\{\s*\n    flex-wrap:nowrap; overflow-x:auto/));
eq("with a fade to show there is more", has(/mask-image:linear-gradient\(90deg,#000 calc\(100% - 22px\),transparent\)/));
eq("and the buttons themselves are smaller", has(/\.docbar \.ghost, \.fmtbar \.ghost, \.fmtbar button, \.inktools \.ghost\{\s*\n    padding:7px 9px; min-height:34px/));
eq("the scrollbar is hidden on the row", has(/\.fmtbar::-webkit-scrollbar, \.inktools::-webkit-scrollbar\{display:none\}/));

console.log("");
console.log("the scroll-back fix is still in place and now settles over frames:");
eq("the anchor is tracked until the page stops moving", has(/calm = \(Math\.abs\(moved\) <= 1 && !short\) \? calm \+ 1 : 0;/));
eq("it stops once two calm frames pass", has(/if \(calm < 2 && tries < 16\)\{ requestAnimationFrame\(settle\); return; \}/));
eq("the swap no longer waits on the database", has(/try \{ flush\(\); \} catch \(e\) \{\}\s*\n    go\(\{ nbId: nbId, noteId: id \}\);/));
eq("the anchor residual is tightly bounded now the preview matches", has(/if \(Math\.abs\(d\) > 1 && Math\.abs\(d\) < 400\)\{/));

process.exitCode = bad ? 1 : 0;
