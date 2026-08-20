/* previewHtml runs in the browser (it uses DOM), so exercise it under a tiny
   DOM shim rather than not at all. */
var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");
var m = html.match(/\n  function previewHtml\(html\)\{[\s\S]*?\n  \}/);
if (!m){ console.log("MISSING previewHtml"); process.exit(1); }

var jsdomOk = true;
var JSDOM;
try {
  JSDOM = require("C:\\Users\\khans\\AppData\\Local\\Temp\\mtest\\node_modules\\jsdom").JSDOM;
} catch (e) { jsdomOk = false; console.log("jsdom load failed: " + e.message); }

if (!jsdomOk){
  /* No jsdom here. Fall back to checking the SOURCE does the things that
     matter, which is weaker but still catches an omission. */
  var src = m[0];
  function has(label, re){
    var ok = re.test(src);
    console.log((ok?"  ok   ":"  FAIL ")+label);
    if (!ok) process.exitCode = 1;
  }
  console.log("no jsdom available - checking the source instead:");
  has("strips every id",              /querySelectorAll\("\[id\]"\)[\s\S]*removeAttribute\("id"\)/);
  has("forces contenteditable false", /contenteditable[\s\S]*"false"/);
  has("replaces pictures",            /figure\.imgblock/);
  has("replaces ink blocks",          /\.inkblock/);
  has("strips href",                  /removeAttribute\("href"\)/);
  has("strips data-to",               /removeAttribute\("data-to"\)/);
  has("has an empty-page fallback",   /peekempty/);
  process.exit();
}

var dom = new JSDOM("<body></body>");
global.document = dom.window.document;
var previewHtml = new Function(m[0] + "\n return previewHtml;")();

function eq(l, cond){ console.log((cond?"  ok   ":"  FAIL ")+l); if(!cond) process.exitCode=1; }

var note = '<h2 id="h1">Heading</h2>' +
           '<p id="p1">Some <a class="ilink" data-to="nt:abc#sp_9" href="#/nb/x/note/abc">a link</a> here.</p>' +
           '<figure class="imgblock" id="f1" data-img="img_1"><img src="blob:x"></figure>' +
           '<span class="anchor" id="sp_9">flag</span>' +
           '<div class="inkblock" id="ink1"></div>' +
           '<span class="filechip" data-file="f_2">notes.pdf</span>' +
           '<p contenteditable="true">editable</p>';
var out = previewHtml(note);
console.log(out.slice(0, 200) + (out.length > 200 ? "…" : ""));
console.log("");
eq("no id survives",                 out.indexOf("id=") < 0);
eq("nothing stays editable",         out.indexOf('contenteditable="true"') < 0);
eq("no href survives",               out.indexOf("href=") < 0);
eq("no data-to survives",            out.indexOf("data-to") < 0);
eq("picture became a marker",        /peekstub[^>]*>picture</.test(out));
eq("attachment became a marker",     /peekstub[^>]*>attachment</.test(out));
eq("drawing became a marker",        /peekstub[^>]*>drawing</.test(out));
eq("no <img> left to load",          out.indexOf("<img") < 0);
eq("the words are still there",      out.indexOf("Heading") > -1 && out.indexOf("Some") > -1);
eq("empty page has a fallback",      /peekempty/.test(previewHtml("")));
eq("null is safe",                   /peekempty/.test(previewHtml(null)));
