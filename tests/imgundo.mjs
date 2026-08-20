import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("adding or removing a picture is undoable:");
eq("insert snapshots the page before the picture lands",
   /function insertImageFile\(file\)\{[\s\S]{0,280}snapText\(\)/.test(html));
eq("insert snapshots again after the picture is in",
   /if \(typeof snapText === "function"\) snapText\(\);\s*\n\s*\/\* Putting a picture/.test(html));
eq("remove snapshots before and after",
   (html.match(/imgRemove[\s\S]{0,400}snapText/g) || []).length >= 1 &&
   /pickedImage\.fig\.remove\(\);[\s\S]{0,120}snapText\(\)/.test(html));
eq("remove does not ask for confirmation",
   !/Take this picture out of the note\?/.test(html));
eq("undo of text/html still hydrates pictures",
   has(/function setBodyHTML\(html\)\{/) && has(/hydrateImages\(\)/));

console.log("");
console.log("the picture bar sits on the picture and can be dragged:");
eq("a grip exists on the bar", has(/id="imgGrip"/));
eq("the bar is placed against the picture", has(/function placeImgBar\(\)/));
eq("it is centred on the picture", has(/r\.left \+ r\.width \/ 2/));
eq("it stays on the visible page",
   has(/Math\.max\(8, Math\.min\(x, vw - w - 8\)\)/) &&
   has(/Math\.max\(8, Math\.min\(y, vh - h - 8\)\)/));
eq("it flips below the picture when there is no room above",
   has(/if \(y < 8\) y = r\.bottom \+ 10/));
eq("the grip is wired to drag", has(/function wireImgBarDrag/) || has(/wireImgBarDrag/));
eq("scroll keeps the bar on the picture",
   has(/placeImgBar\(\)/) && has(/pageHandover\(\)/));

if (bad) console.log("\n" + bad + " failed");
else console.log("\nok  picture undo + bar");
process.exitCode = bad ? 1 : 0;
