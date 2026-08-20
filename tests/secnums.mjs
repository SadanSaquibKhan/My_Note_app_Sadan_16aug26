import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

const src = html.match(/function sectionNumber\(sec, index\)\{[\s\S]*?\n  \}/);
const disp = html.match(/function sectionDisplayName\(sec, index\)\{[\s\S]*?\n  \}/);
if (!src || !disp){
  console.log("MISSING sectionNumber or sectionDisplayName");
  process.exit(1);
}
const fn = new Function(src[0] + "\n" + disp[0] + "\n return { sectionNumber, sectionDisplayName };");
const A = fn();

console.log("section numbers match the section the page is in:");
eq("the default sec0 is section 1, not 0", A.sectionNumber({ name:"sec0", isDefault:true }, 0) === 1);
eq("it is shown as Sec1", A.sectionDisplayName({ name:"sec0", isDefault:true }, 0) === "Sec1");
eq("the old second section sec1 is section 2", A.sectionNumber({ name:"sec1" }, 1) === 2);
eq("it is shown as Sec2", A.sectionDisplayName({ name:"sec1" }, 1) === "Sec2");
eq("a new section named Sec3 is section 3", A.sectionNumber({ name:"Sec3" }, 2) === 3);
eq("a custom name is left alone", A.sectionDisplayName({ name:"Lectures" }, 2) === "Lectures");

console.log("a new notebook and a new section come with a first page:");
eq("a new notebook makes Sec1 and S1P1",
   has(/createSection\(nb\.id, "Sec1"/) && has(/createNote\(nb\.id, "S1P1"/));
eq("a new section makes its first page",
   has(/C\.createSection\(state\.nbId, name, secColour\)\.then/) &&
   has(/C\.suggestPageTitle\(state\.nbId, s\.id\)/));
eq("the next page in that section is S#P#",
   has(/return secPageName\(sNum, maxP \+ 1, ""\)/));
eq("the next section is SecN, not sec0",
   has(/return "Sec" \+ \(max \+ 1\);/));

process.exitCode = bad ? 1 : 0;
if (bad) console.log("\n" + bad + " failed");
else console.log("\nall section-name checks passed");
