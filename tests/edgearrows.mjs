/* The three left-edge arrows (#edgeList / #edgeSec / #edgeRail inside #edgeStack)
   are the way BACK when the panels are folded away — including Immerse, where
   every bar and pane is hidden. paintEdge() used to also hide the edge stack in
   Immerse (`&& immerse !== "1"`), removing the only handle out exactly when it was
   needed. It now shows whenever a note is open, like Focus mode already did.
   Browser-verified: with a note open in Immerse, edgeStack.hidden === false and all
   three arrows are present. Immerse still hides the bars/panes via CSS.
   Run: node tests/edgearrows.mjs index.html */
import fs from "fs";
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

eq("the edge stack shows whenever a note is open (no longer hidden in immerse)",
   /if \(stack\) stack\.hidden = !state\.note;/.test(html) &&
   !/stack\.hidden = !\(state\.note && document\.body\.dataset\.immerse/.test(html));
eq("the three edge arrows still exist",
   /id="edgeList"/.test(html) && /id="edgeSec"/.test(html) && /id="edgeRail"/.test(html));
eq("immerse still hides the bars and panes (unchanged CSS)",
   /body\[data-immerse="1"\]/.test(html));

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall edge-arrow checks passed");
