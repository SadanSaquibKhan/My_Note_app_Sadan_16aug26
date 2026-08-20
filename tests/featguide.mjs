import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

/* catalog extract */
const cat = html.match(/var FEATURE_GUIDE = (\[[\s\S]*?\n  \]);/);
eq("FEATURE_GUIDE catalog is in the file", !!cat);

const paint = html.match(/function paintFeatGuide\(\)\{[\s\S]*?\n  \}/);
eq("paintFeatGuide exists", !!paint);

const open = html.match(/function openFeatGuide\(\)\{[\s\S]*?\n  \}/);
eq("openFeatGuide exists", !!open);

eq("Settings button is in the markup", /id="featGuideBtn"/.test(html));
eq("feature dialog is in the markup", /id="featDlg"/.test(html));
eq("dialog body is in the markup", /id="featBody"/.test(html));
eq("dialog close buttons exist", /id="featX"/.test(html) && /id="featClose"/.test(html));
eq("What can I do here? button is wired", /featGuideBtn"\)\.addEventListener\("click", openFeatGuide/.test(html));
eq("applyFeatHelp runs at boot", /wireSettings\(\); applyFeatHelp\(\);/.test(html));

eq("hover delay is a short hold (700ms)", /setTimeout\(function\(\)\{ showPenHelp\(found\); \}, 700\)/.test(html));
eq("hover uses the feature-guide index as fallback", /HELP_BY_ID\[el\.id\]/.test(html));
eq("hover ignores a touching nib (buttons !== 0)", /pointerType !== "pen" \|\| e\.buttons/.test(html));

let guide = [];
if (cat) {
  try { guide = Function("return " + cat[1])(); }
  catch (e) { eq("FEATURE_GUIDE parses", false); console.log("    " + e.message); }
}
eq("FEATURE_GUIDE parses", Array.isArray(guide) && guide.length > 0);
eq("at least 6 groups", guide.length >= 6);

const groups = guide.map(g => g.group);
["The page", "Writing with the S Pen", "Selecting with lasso", "Typing",
 "Pictures and files", "Bars and lists", "Moving around", "Settings and data"
].forEach(name => eq("group: " + name, groups.includes(name)));

const items = guide.flatMap(g => g.items || []);
eq("at least 30 feature rows", items.length >= 30);

const ids = [];
items.forEach(it => {
  if (!it.name || !it.brief || !it.more) {
    eq("row has name + brief + more: " + (it && it.name), false);
  }
  if (it.brief && it.brief.length > 140) {
    eq("brief stays short: " + it.name + " (" + it.brief.length + ")", false);
  }
  if (it.more && it.more.length > 420) {
    eq("more stays concise: " + it.name + " (" + it.more.length + ")", false);
  }
  if (it.id) ids.push(it.id);
});
eq("every row has name, brief, more", items.every(it => it.name && it.brief && it.more));
eq("briefs stay under 140 chars", items.every(it => !it.brief || it.brief.length <= 140));
eq("details stay under 420 chars", items.every(it => !it.more || it.more.length <= 420));

ids.forEach(id => {
  const re = new RegExp('id="' + id + '"');
  eq("catalog id exists in markup: " + id, re.test(html));
});

const names = items.map(it => it.name.toLowerCase());
eq("covers lasso", names.some(n => n.includes("lasso")));
eq("covers hover", names.some(n => n.includes("hover")));
eq("covers side button", names.some(n => n.includes("side button")));
eq("covers favourites", names.some(n => n.includes("favourite")));
eq("covers shortcuts bar", names.some(n => n.includes("shortcut")));
eq("covers undo", names.some(n => n.includes("undo")));
eq("covers crop", names.some(n => n.includes("crop")));

eq("tap a row toggles .on", /classList\.contains\("on"\)/.test(paint ? paint[0] : ""));
eq("only one row open at a time", /querySelectorAll\("\.featrow"\)/.test(html));

if (bad) console.log("\n" + bad + " failed");
else console.log("\nok  feature guide + hover");
process.exitCode = bad ? 1 : 0;
