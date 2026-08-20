var SYMBOLS = {
  "->":"→", "<-":"←", "=>":"⇒", "<=":"≤", ">=":"≥",
  "!=":"≠", "~=":"≈", "+-":"±", "-+":"∓", "--":"—",
  "(c)":"©", "(r)":"®", "(tm)":"™", "...":"…",
  "*":"placeholder",
  ":alpha:":"α", ":pi:":"π"
};
delete SYMBOLS["*"];
function symbolFor(tail){
  var keys = Object.keys(SYMBOLS);
  for (var i = 0; i < keys.length; i++){
    var k = keys[i];
    if (tail.length >= k.length && tail.slice(-k.length) === k) return { cut: k.length, ins: SYMBOLS[k] };
  }
  return null;
}
console.log("A. symbolFor('->')   =", JSON.stringify(symbolFor("->")));
console.log("A. symbolFor('a ->') =", JSON.stringify(symbolFor("a ->")));

/* runSymbol's gate, verbatim from index.html */
function gate(txt){ return txt.slice(-1) === " "; }
console.log("B. gate('-> ')   plain U+0020 =", gate("-> "));
console.log("B. gate('->\\u00A0') nbsp U+00A0 =", gate("-> "));

/* markdown rules, verbatim, replayed keystroke by keystroke */
function runMD(txt, rules, guard){
  for (var i = 0; i < rules.length; i++){
    var mark = rules[i][0], tag = rules[i][1];
    if (txt.slice(-mark.length) !== mark) continue;
    var body = txt.slice(0, -mark.length);
    if (mark === "*" && body.slice(-1) === "*") continue;
    var openAt = body.lastIndexOf(mark);
    if (openAt < 0) continue;
    if (guard && mark === "*" && openAt > 0 && body.charAt(openAt - 1) === "*") continue;
    var inner = body.slice(openAt + mark.length);
    if (!inner || inner.indexOf(mark) >= 0 || /^\s|\s$/.test(inner)) continue;
    return {tag: tag, inner: inner, cut: inner.length + mark.length*2};
  }
  return null;
}
var RULES = [["**","b"],["`","code"],["*","i"]];
function replay(word, guard, label){
  var acc = "";
  for (var i = 0; i < word.length; i++){
    acc += word[i];
    var r = runMD(acc, RULES, guard);
    if (r){
      console.log("   " + label + " " + JSON.stringify(word) + " -> after " + JSON.stringify(acc) +
                  " FIRES <" + r.tag + "> on " + JSON.stringify(r.inner) + " cut=" + r.cut);
      return;
    }
  }
  console.log("   " + label + " " + JSON.stringify(word) + " -> never fires");
}
console.log("C. CURRENT (no guard):");
[ "**bold**", "*ital*", "a *b* c", "`code`", "**a b**" ].forEach(function(w){ replay(w, false, ""); });
console.log("D. WITH open-star guard:");
[ "**bold**", "*ital*", "a *b* c", "`code`", "**a b**" ].forEach(function(w){ replay(w, true, ""); });
