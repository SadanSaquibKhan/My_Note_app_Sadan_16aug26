/* Does the markup actually nest?
   A stray </div> does not stop the page loading — the browser silently
   re-parents everything after it, and what you see is a chunk of the app in
   the wrong place. Nothing else in this test kit could catch that: the script
   still parses, every id still resolves. So it is checked directly. */
var fs = require("fs");
var html = fs.readFileSync(process.argv[2], "utf8");

/* only the body markup: the inline <script> and <style> hold text that looks
   like tags but is not */
function strip(src, tag){
  var re = new RegExp("<" + tag + "[\\s\\S]*?</" + tag + ">", "gi");
  return src.replace(re, function(m){ return m.replace(/[<>]/g, " "); });
}
var m = strip(strip(strip(html, "script"), "style"), "textarea");

var VOID = { area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1,
             meta:1, param:1, source:1, track:1, wbr:1 };

var stack = [], problems = [];
var re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, t;
while ((t = re.exec(m))){
  var closing = t[1] === "/", name = t[2].toLowerCase(), attrs = t[3] || "";
  if (VOID[name] || /\/\s*$/.test(attrs)) continue;
  var at = m.slice(0, t.index).split("\n").length;
  if (!closing){
    stack.push({ name: name, line: at });
  } else {
    if (!stack.length){
      problems.push("line " + at + ": </" + name + "> with nothing open");
      continue;
    }
    var top = stack[stack.length - 1];
    if (top.name === name){ stack.pop(); continue; }
    /* find it further down: everything above it was left unclosed */
    var found = -1;
    for (var i = stack.length - 1; i >= 0; i--) if (stack[i].name === name){ found = i; break; }
    if (found < 0){
      problems.push("line " + at + ": </" + name + "> but <" + top.name +
                    "> (opened line " + top.line + ") is what is open");
    } else {
      for (var j = stack.length - 1; j > found; j--){
        problems.push("line " + stack[j].line + ": <" + stack[j].name +
                      "> never closed (hit </" + name + "> at line " + at + ")");
      }
      stack.length = found;
    }
  }
}
stack.forEach(function(o){
  problems.push("line " + o.line + ": <" + o.name + "> never closed");
});

if (problems.length){
  console.log("MARKUP DOES NOT NEST:");
  problems.slice(0, 20).forEach(function(p){ console.log("   " + p); });
  if (problems.length > 20) console.log("   ... and " + (problems.length - 20) + " more");
} else {
  console.log("ok  every tag closes, and closes in the right order");
}
process.exitCode = problems.length ? 1 : 0;
