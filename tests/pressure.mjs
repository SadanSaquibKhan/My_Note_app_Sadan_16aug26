/* Even thickness: pressure off must keep the nib size you picked,
   at every pressure sample, and must not let speed sneak a taper back in. */
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

const setSrc = html.match(/function setPressure\(name\)\{[\s\S]*?\n  \}/);
const widthSrc = html.match(/function penWidth\(base, pressure\)\{[\s\S]*?\n  \}/);
const speedSrc = html.match(/function speedWeight\(dist, ms\)\{[\s\S]*?\n  \}/);
if (!setSrc || !widthSrc || !speedSrc){
  console.log("MISSING setPressure / penWidth / speedWeight");
  process.exit(1);
}

const mk = new Function(
  "var pressureA = 0.25, pressureB = 1.60;\n" +
  setSrc[0] + "\n" + widthSrc[0] + "\n" + speedSrc[0] + "\n" +
  "return { setPressure, penWidth, speedWeight, range(){ return { a: pressureA, b: pressureB }; } };"
);
const P = mk();

console.log("off: the drawn width is exactly the nib you picked:");
P.setPressure("off");
eq("range is 1 + 0p", P.range().a === 1 && P.range().b === 0);
eq("light press = 2.4", P.penWidth(2.4, 0.05) === 2.4);
eq("medium press = 2.4", P.penWidth(2.4, 0.5) === 2.4);
eq("hard press = 2.4", P.penWidth(2.4, 1) === 2.4);
eq("missing press still 2.4", P.penWidth(2.4, 0) === 2.4);

console.log("the width ladder is thinner at the start, with growing gaps:");
{
  const m = html.match(/var INK_WIDTHS = \[([^\]]+)\]/);
  const ws = m ? m[1].split(",").map(Number) : [];
  eq("six steps", ws.length === 6);
  eq("thinnest is a third of the old 1.6", ws[0] > 0.5 && ws[0] < 0.6);
  eq("thickest is unchanged", ws[5] === 6.5);
  const d = [];
  for (let i = 1; i < ws.length; i++) d.push(ws[i] - ws[i-1]);
  eq("gaps grow toward the thick end", d[0] < d[1] && d[2] < d[4]);
}

console.log("normal: pressing harder still makes a thicker line:");
P.setPressure("normal");
const thin = P.penWidth(2.4, 0.1);
const thick = P.penWidth(2.4, 1);
eq("harder is thicker", thick > thin);
eq("medium is between", P.penWidth(2.4, 0.5) > thin && P.penWidth(2.4, 0.5) < thick);

console.log("the wiring that keeps Even actually even:");
eq("Even button is in the ink bar", /id="evenWidthBtn"/.test(html));
eq("Settings has the even-thickness box", /id="setEvenWidth"/.test(html));
eq("setEvenWidth writes cfg.pressure", /function setEvenWidth\(on, quiet\)\{/.test(html));
eq("turning Even on remembers the last feel", /cfg\.pressureLast = cfg\.pressure/.test(html));
eq("new samples store 0.5 while Even is on",
   /function strokePressure\(e\)\{[\s\S]*?cfg\.pressure === "off"\) return 0\.5/.test(html));
eq("start uses strokePressure, not raw e.pressure",
   /st\.pts\.push\(p\.x, p\.y, strokePressure\(e\)\)/.test(html));
eq("move uses strokePressure",
   /st\.pts\.push\(x, y, strokePressure\(ev\)\)/.test(html));
eq("speed taper is skipped when Even is on",
   /function applySpeedWeight\(st\)\{[\s\S]*?if \(cfg\.pressure === "off"\) return;/.test(html));
eq("popover offers the same switch next to thickness",
   /Keep the same thickness \(ignore pressure\)/.test(html));
eq("Settings names the choice in plain words",
   /Keep the same thickness no matter how hard I press/.test(html));

process.exitCode = bad ? 1 : 0;
