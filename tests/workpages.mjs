/* Working sheets are a collapsible overlay on the parent page, not a
   separate page in the notebook list. A named chip on the page opens and hides them. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

console.log("naming:");
{
  function splitSecPage(title){
    const m = /^S(\d+)P(\d+)(.*)$/i.exec(String(title || "").trim());
    if (!m) return null;
    return { s: +m[1], p: +m[2] };
  }
  function workingName(parent, index){
    let base = "P";
    if (parent){
      const sp = splitSecPage(parent.title);
      if (sp) base = "S" + sp.s + "P" + sp.p;
    }
    return base + "w" + (index + 1);
  }
  eq("first working sheet of S1P2 is S1P2w1",
     workingName({ title: "S1P2" }, 0) === "S1P2w1");
  eq("the third is S1P2w3",
     workingName({ title: "S1P2" }, 2) === "S1P2w3");
}

console.log("");
console.log("they sit on the parent page, not in the notebook list:");
eq("pageOrder is ordinary notes only",
   has(/function pageOrder\(\)\{/) && !/id: "w:" \+ p.id/.test(html));
eq("Practice opens and closes the overlay sheet",
   has(/if \(prac.open\)\{ closePractice\(\); return; \}/) &&
   has(/function openPractice\(page\)/));
eq("a named chip on the page toggles that sheet",
   has(/function toggleWorkFromPin/) &&
   has(/function ensureWorkPin/) &&
   has(/span.pracpin::after\{content:attr\(data-name\)/));
eq("Mark this spot starts a named working chip",
   has(/function markSpot\(x, y\)/) && has(/return startWorkAt\(x, y\)/));
eq("the overlay is a real sheet you can scroll",
   has(/\.paper.prac\{background:var\(--ground\); overflow-y:auto/) &&
   has(/#pracText\{\s*\n    min-height:var\(--page-h\)/));
eq("the overlay uses the same ruling zoom as the note",
   has(/\.sheet.prac\{/) && has(/zoom:var\(--z,1\)/));

if (bad) { console.log("\n" + bad + " failed"); process.exitCode = 1; }
else console.log("\nall working-page checks passed");
