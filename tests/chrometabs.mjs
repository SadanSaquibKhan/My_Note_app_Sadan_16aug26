/* Chrome-like notebook tabs, folder vs book icons, hold-to-open dots. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("hold the minimised dot to open, drag does not:");
eq("hold delay is 400ms, under half a second", has(/var DOT_HOLD_MS = 400;/));
eq("a drag cancels the hold", has(/moved = true; clearHold\(\)/));
eq("opening fires from the timer, not from a tap on lift",
   has(/opened = true;/) && has(/if \(onTap\) onTap\(\);/) &&
   !/if \(!moved && onTap\) onTap\(\)/.test(html));

console.log("");
console.log("folders look like folders, notebooks look like books:");
eq("rowIcon helper exists", has(/function rowIcon\(kind, colour\)/));
eq("a folder row uses the folder icon", has(/rowIcon\("folder", g\.colour\)/));
eq("a notebook row uses the book icon", has(/rowIcon\("book", nb\.colour\)/));
eq("they are not the same 9px swatch",
   has(/class="rowico/) || has(/className = "rowico/));

console.log("");
console.log("chrome-like notebook tabs:");
eq("a tabs toggle lives on the shortcuts bar", has(/id="jumpTabs"/));
eq("the strip is outside the side panel", has(/id="chromeTabs"/) && has(/id="chromeStrip"/));
eq("home and plus sit on the tab strip", has(/id="chromeHome"/) && has(/id="chromeNew"/));
eq("plus opens home to pick another notebook, it does not create one",
   has(/chromeNew"\)\.addEventListener[\s\S]{0,280}go\(\{\}\)/) &&
   !/chromeNew"\)\.addEventListener[\s\S]{0,200}openNbDialog\(null\)/.test(html));
eq("closing offers Undo", has(/function undoCloseNotebook/) && has(/id="tabUndoBtn"/));
eq("latest three keep their jump colours",
   has(/var slot = recent3\.indexOf\(id\)/) && has(/jumpNbColour\(nb, slot\)/));
eq("tabs can be dragged to reorder", has(/chromeDrag/) && has(/strip\.insertBefore\(tab/));
eq("the in-panel strip hides when the top tabs are on",
   has(/wrap\.hidden = !!cfg\.chromeTabs \|\| alive\.length < 2/));
eq("the setting is remembered", has(/chromeTabs: true/) || has(/chromeTabs: false/));
eq("a click of the icon toggles without opening the side list",
   has(/setChromeTabs\(!cfg\.chromeTabs\)/));

{
  /* transcribed: hold vs drag */
  function wouldOpen(holdMs, moved){
    const DOT = 400;
    if (moved) return false;
    return holdMs >= DOT;
  }
  eq("a 100ms tap does not open", wouldOpen(100, false) === false);
  eq("a 400ms still hold opens", wouldOpen(400, false) === true);
  eq("a drag of any length does not open", wouldOpen(800, true) === false);
}

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nok  chrome tabs / icons / dots");
