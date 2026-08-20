import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

eq("three notebook buttons exist in markup",
   /id="jumpNb0"/.test(html) && /id="jumpNb1"/.test(html) && /id="jumpNb2"/.test(html));
eq("they sit between Home and Open",
   html.indexOf('id="jumpHome"') < html.indexOf('id="jumpNb0"') &&
   html.indexOf('id="jumpNb2"') < html.indexOf('id="jumpOpen"'));
eq("Open list is still there", /id="jumpOpen"/.test(html));
eq("paintJumpNbs exists", /function paintJumpNbs\(\)\{/.test(html));
eq("recentOpenThree exists", /function recentOpenThree\(\)\{/.test(html));
eq("opening a notebook records recency", /touchRecentNb\(nbId\)/.test(html));
eq("closing a notebook drops it from recency",
   /recentNbs = recentNbs\.filter\(function\(id\)\{ return id !== nbId; \}\)/.test(html));
eq("jump bar stays if any notebook is still open",
   /return !!state\.nbId \|\| \(openNbs && openNbs\.length > 0\)/.test(html));
eq("tap of a colour icon goes to that notebook", /function jumpToRecentNb\(i\)\{/.test(html));
eq("letter + colour are painted",
   /nbLetter\(nb\)/.test(html) && /jumpNbColour\(nb, i\)/.test(html));

const src = html.match(/function recentOpenThree\(\)\{[\s\S]*?\n  \}/);
eq("recentOpenThree source extracted", !!src);

function run(openNbs, recentNbs, books){
  const fn = new Function("openNbs", "recentNbs", "nbById",
    src[0] + "\n return recentOpenThree();");
  const map = {};
  (books || []).forEach(b => { map[b.id] = b; });
  return fn(openNbs, recentNbs, function(id){ return map[id] || null; });
}

const books = [{id:"a"},{id:"b"},{id:"c"},{id:"d"}];
eq("empty when nothing is open",
   JSON.stringify(run([], ["a","b"], books)) === "[]");
eq("falls back to open order when no recency yet",
   JSON.stringify(run(["a","b","c"], [], books)) === JSON.stringify(["a","b","c"]));
eq("recency wins, capped at 3",
   JSON.stringify(run(["a","b","c","d"], ["d","c","b","a"], books)) === JSON.stringify(["d","c","b"]));
eq("drops ids that are no longer open",
   JSON.stringify(run(["a","c"], ["d","c","a"], books)) === JSON.stringify(["c","a"]));
eq("drops deleted notebooks",
   JSON.stringify(run(["a","gone","b"], ["gone","b","a"], [{id:"a"},{id:"b"}])) === JSON.stringify(["b","a"]));
eq("current-first recency: last touched is first",
   JSON.stringify(run(["a","b","c"], ["c","a","b"], books)) === JSON.stringify(["c","a","b"]));

const letter = html.match(/function nbLetter\(nb\)\{[\s\S]*?\n  \}/);
if (letter){
  const L = new Function(letter[0] + "\n return nbLetter;");
  const fn = L();
  eq("letter uses first character", fn({name:"Physics"}) === "P");
  eq("letter uppercases", fn({name:"chem"}) === "C");
  eq("letter handles empty", fn({name:"  "}) === "?");
} else {
  eq("nbLetter extracted", false);
}

if (bad) console.log("\n" + bad + " failed");
else console.log("\nok  jump-bar notebook icons");
process.exitCode = bad ? 1 : 0;
