/* Always-full-screen mode. The user wants the app to stay full screen (browser
   tabs/bars hidden) and to come BACK to full screen after leaving to another app
   and returning, with the only way out being a toggle in the shortcuts bar.
   A page cannot full-screen itself unprompted — the browser only allows it from
   a real touch and drops it on an app-switch — so: one shortcuts-bar toggle owns
   the mode (cfg.fullLock), and while it is on, any touch that is not a full-screen
   toggle restores full screen if the browser dropped it. Browser-verified that the
   toggle flips the state; the actual full-screen fill is device-only. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

eq("the shortcuts bar has a full-screen toggle button",
   has(/id="jumpFull"/) && has(/<div class="favbar jumpbar" id="jumpBar"/));
eq("tapping it turns the keep-full mode on/off and enters or exits full screen",
   has(/var goingOn = !\(fullActive\(\) \|\| fullLocked\(\)\);/) &&
   has(/cfg\.fullLock = goingOn;/) &&
   has(/if \(goingOn\) enterFull\(\); else exitFull\(\);/));
eq("any touch (not a full-screen toggle) restores full screen while the mode is on",
   has(/if \(!fullLocked\(\) \|\| fullActive\(\)\) return;/) &&
   has(/closest\("#jumpFull, #fullScrBtn"\)/) &&
   has(/enterFull\(\);\s*\n  \}, true\);/));
eq("the toggle's pressed state is painted on full-screen change",
   has(/function paintJumpFull\(\)/) &&
   has(/document\.addEventListener\("fullscreenchange", paintJumpFull\)/) &&
   has(/document\.addEventListener\("webkitfullscreenchange", paintJumpFull\)/));
eq("the pressed style already exists (the bar is a .favbar)",
   has(/\.favbar button\[aria-pressed="true"\]\{/));

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall full-screen checks passed");
