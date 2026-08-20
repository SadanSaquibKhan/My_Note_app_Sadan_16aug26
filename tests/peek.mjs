import fs from "fs";
import { parseHTML } from "file:///C:/Users/khans/AppData/Local/Temp/mtest/node_modules/linkedom/esm/index.js";

const file = process.argv[2];
const html = fs.readFileSync(file, "utf8");
const m = html.match(/\n {2}function previewHtml\(html\)\{[\s\S]*?\n {2}\}/);
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
eq("empty page falls back",      /peekempty/.test(previewHtml("")));
eq("null is safe",               /peekempty/.test(previewHtml(null)));
eq("a page holding only a picture still renders",
   /imgblock/.test(previewHtml('<figure class="imgblock" id="z" data-img="i"></figure>')));
process.exitCode = bad ? 1 : 0;
