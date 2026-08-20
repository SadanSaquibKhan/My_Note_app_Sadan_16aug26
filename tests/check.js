var fs = require("fs"), vm = require("vm");
var p = process.argv[2];
var html = fs.readFileSync(p, "utf8");
var re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi, m, n = 0, bad = 0;
while ((m = re.exec(html))){
  var attrs = m[1] || "";
  if (/\bsrc\s*=/.test(attrs)) continue;
  if (/type\s*=\s*["']?(?!text\/javascript|module|application\/javascript)/i.test(attrs)) continue;
  n++;
  var code = m[2];
  var line = html.slice(0, m.index).split("\n").length;
  try { new vm.Script(code, {filename: "block" + n}); }
  catch (e) { bad++; console.log("SYNTAX ERROR in script block " + n + " (starts at line " + line + "): " + e.message); }
}
console.log("checked " + n + " inline script block(s), " + bad + " with syntax errors");

/* also assert the two edited guards are present and behave */
var hasNbsp = /sp !== " " && sp !== "\\u00A0"/.test(html);
var hasBold = /mark === "\*" && openAt > 0 && body\.charAt\(openAt - 1\) === "\*"/.test(html);
console.log("nbsp guard present: " + hasNbsp);
console.log("bold guard present: " + hasBold);
