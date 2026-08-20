import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

/* pull the real cfg literal, the key list and the change counter */
const lit = html.match(/\n {2}var cfg = \{[\s\S]*?\n {2}\};/);
if (!lit) { console.log("MISSING cfg literal"); process.exit(1); }
const cnt = html.match(/\n {2}function countCfgChanges\(\)\{[\s\S]*?\n {2}\}/);
if (!cnt) { console.log("MISSING countCfgChanges"); process.exit(1); }

const mk = new Function(
  lit[0] +
  "\n var CFG_KEYS = Object.keys(cfg);" +
  "\n var CFG_DEFAULTS = JSON.parse(JSON.stringify(cfg));" +
  "\n var cfgOpened = null;" +
  cnt[0] +
  "\n return { cfg, CFG_KEYS, CFG_DEFAULTS, countCfgChanges," +
  "   setOpened(v){ cfgOpened = v; } };"
);
const A = mk();

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

console.log("defaults that matter:");
eq("single tap does NOT type",      A.CFG_DEFAULTS.tapToType === false);
eq("double tap does",               A.CFG_DEFAULTS.dblType === true);
eq("hold-to-erase on",              A.CFG_DEFAULTS.holdErase === true);
eq("shape tidy defaults to hold",   A.CFG_DEFAULTS.shapeMode === "hold");
eq("favourites has 7 items",        A.CFG_DEFAULTS.favTools.length === 7);

console.log("counting what changed:");
A.setOpened(JSON.parse(JSON.stringify(A.cfg)));
eq("nothing changed yet", A.countCfgChanges() === 0);
A.cfg.smooth = 45;
eq("one change counted", A.countCfgChanges() === 1);
A.cfg.eraserSize = 40;
A.cfg.hints = false;
eq("three changes counted", A.countCfgChanges() === 3);
A.cfg.favTools = ["pen_red"];
eq("a list change counts too", A.countCfgChanges() === 4);
A.cfg.cfgRev = 99;
eq("the private revision key is ignored", A.countCfgChanges() === 4);

console.log("undo of changes restores every key:");
const opened = JSON.parse(JSON.stringify(A.cfg));
A.setOpened(opened);
A.cfg.smooth = 5; A.cfg.zoomMax = 400;
A.CFG_KEYS.forEach(k => { A.cfg[k] = opened[k]; });
eq("back to zero changes", A.countCfgChanges() === 0);
eq("smooth restored", A.cfg.smooth === opened.smooth);
eq("zoomMax restored", A.cfg.zoomMax === opened.zoomMax);

console.log("reset then undo-reset:");
const before = JSON.parse(JSON.stringify(A.cfg));
A.CFG_KEYS.forEach(k => { if (k !== "cfgRev") A.cfg[k] = A.CFG_DEFAULTS[k]; });
eq("reset kept the revision key", A.cfg.cfgRev === before.cfgRev);
A.CFG_KEYS.forEach(k => { A.cfg[k] = before[k]; });
eq("undo-reset restored everything",
   JSON.stringify(A.cfg) === JSON.stringify(before));
process.exitCode = bad ? 1 : 0;
