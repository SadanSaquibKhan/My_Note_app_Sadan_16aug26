import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/* This used to import linkedom straight out of C:\Users\...\Temp\mtest, the
   old scratch folder. Windows empties Temp on restart, so the suite went red
   the first time the laptop was rebooted mid-batch and read exactly like a
   code regression, which cost real time to rule out. It looks in the repo
   first now, and if the module is genuinely not installed anywhere it says so
   and skips rather than failing: a missing optional tool is not a broken app,
   and a permanently red suite is one everybody learns to ignore.

   Install it somewhere OFF the synced drive. This repo lives in a Google Drive
   folder, and Drive races npm as it unpacks: the install "succeeds" but
   linkedom/package.json lands zero bytes, and node then refuses the module
   with a baffling "Invalid package config". Installing beside the repo looks
   like the obvious thing to do and does not work.

       mkdir  %LOCALAPPDATA%\margin-testdeps
       cd     %LOCALAPPDATA%\margin-testdeps
       npm install linkedom
*/
const LOCAL = process.env.LOCALAPPDATA || process.env.HOME || ".";
const CANDIDATES = [
  path.join(LOCAL, "margin-testdeps/node_modules/linkedom/esm/index.js"),
  path.resolve("node_modules/linkedom/esm/index.js"),
  path.resolve("tests/node_modules/linkedom/esm/index.js"),
  "C:/Users/khans/AppData/Local/Temp/mtest/node_modules/linkedom/esm/index.js"
];
let parseHTML = null;
for (const c of CANDIDATES){
  if (!fs.existsSync(c)) continue;
  try { ({ parseHTML } = await import(pathToFileURL(c).href)); break; } catch { /* try the next */ }
}
if (!parseHTML){
  console.log("SKIP peek.mjs \u2014 linkedom is not installed.");
  console.log("     This suite needs a DOM to run previewHtml against.");
  console.log("     Install it OFF the synced drive \u2014 Drive corrupts npm's unpack:");
  console.log("       mkdir %LOCALAPPDATA%\\margin-testdeps");
  console.log("       cd    %LOCALAPPDATA%\\margin-testdeps && npm install linkedom");
  console.log("     (Skipped, not failed: nothing about the app is known to be wrong.)");
  process.exit(0);
}

const file = process.argv[2];
const html = fs.readFileSync(file, "utf8");
/* b171 gave previewHtml a second argument. "peek" is the band either side of
   the page you are on, which must lay out identically but is not meant to be
   tapped; "live" is a preview you are actually reading, where the links are
   the whole point of it being there. The default is still peek, so every
   existing caller behaves exactly as it did. */
const m = html.match(/\n {2}function previewHtml\(html(?:, mode)?\)\{[\s\S]*?\n {2}\}/);
if (!m) { console.log("MISSING previewHtml"); process.exit(1); }

const { document } = parseHTML("<html><body></body></html>");
globalThis.document = document;
const previewHtml = new Function(m[0] + "\n return previewHtml;")();

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

const note =
  '<h2 id="h1">Heading</h2>' +
  '<p id="p1">Some <a class="ilink" data-to="nt:abc#sp_9" href="#/nb/x/note/abc">a link</a> here.</p>' +
  '<figure class="imgblock" id="f1" data-img="img_1"><img src="blob:x"></figure>' +
  '<span class="anchor" id="sp_9">flag</span>' +
  '<div class="inkblock" id="ink1"></div>' +
  '<span class="filechip" data-file="f_2">notes.pdf</span>' +
  '<p contenteditable="true">editable</p>';

const out = previewHtml(note);
console.log(out.slice(0, 240) + (out.length > 240 ? "\u2026" : ""));
console.log("");
eq("no id survives",             !out.includes("id="));
eq("nothing stays editable",     !out.includes('contenteditable="true"'));
eq("no href survives",           !out.includes("href="));
eq("no data-to survives",        !out.includes("data-to"));
/* Pictures are KEPT so the preview is the same height and shape as the page
   it previews — that mismatch was what made the join lurch. They keep their
   data-img (which is how the picture is later loaded) but lose their id. */
eq("picture is kept",            /<figure[^>]*class="imgblock"/.test(out));
eq("picture keeps its data-img", out.includes('data-img="img_1"'));
eq("picture keeps its width",    /width:\s*70%/.test(out));
eq("picture has no id",          !/<figure[^>]*\sid=/.test(out));
eq("no <img> until it is loaded", !out.includes("<img"));
eq("attachment became a marker", /peekstub[^>]*>attachment</.test(out));
eq("the words survive",          out.includes("Heading") && out.includes("Some"));
/* A link in a peek band used to be tappable, which meant a stray finger on the
   page below the one you were reading could navigate you away mid-scroll. */
const LINKED = '<p><a class="ilink" data-to="nt:x" href="#/nb/a/note/x">go</a></p>';
eq("a peek band's links are not tappable", !/href=/.test(previewHtml(LINKED)));
eq("a live preview keeps its links",       /href=/.test(previewHtml(LINKED, "live")));
eq("a live preview keeps spot anchors so a link can find its place",
   / id="sp_1"/.test(previewHtml('<span class="anchor" id="sp_1"></span>', "live")));
eq("a peek band still strips every id",
   !/ id=/.test(previewHtml('<span class="anchor" id="sp_1"></span>')));

eq("empty page falls back",      /peekempty/.test(previewHtml("")));
eq("null is safe",               /peekempty/.test(previewHtml(null)));
eq("a page holding only a picture still renders",
   /imgblock/.test(previewHtml('<figure class="imgblock" id="z" data-img="i"></figure>')));
process.exitCode = bad ? 1 : 0;
