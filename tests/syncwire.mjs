/* Wiring of light sync into the app. The merge brain lives in sync-client.js;
   this file pins that the app actually calls it, that the password is not in
   the public page, that erases leave a tombstone, and that opening a note
   never waits on the network.

   Run: node tests/syncwire.mjs index.html
*/
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

function grab(name){
  const m = html.match(new RegExp("\\n  function " + name + "\\([\\s\\S]*?\\n  \\}"));
  if (!m) { console.log("MISSING " + name); process.exit(1); }
  return m[0];
}

console.log("the key must never be in the public app:");
eq("no hardcoded SYNC_KEY", !/SYNC_KEY\s*=/.test(html) && !/khanssk89\.txt/.test(html));
eq("header uses the saved password, not a literal",
   /headers: \{ "x-margin-key": sync\.key/.test(html));
eq("Settings has URL + password fields",
   /id="syncUrl"/.test(html) && /id="syncKey"/.test(html) && /type="password" id="syncKey"/.test(html));
eq("sync stays off until both are saved",
   /function syncReady\(\)\{[\s\S]*?sync\.url && sync\.key/.test(html));

console.log("reuse the proven merge, do not reinvent it:");
eq("loads sync-client.js", /<script src="sync-client\.js">/.test(html));
eq("pull folds with SyncCore.mergeRecord",
   /Core\.mergeRecord\(local, incoming\)/.test(html) || /SyncCore\.mergeRecord/.test(html));
eq("push uses SyncCore.changedSince", /SyncCore\.changedSince\(map/.test(html));
eq("dumps local stores through dumpLightMap", /function dumpLightMap\(/.test(html));
eq("service worker caches the helper as extra, not shell",
   /sync-client\.js/.test(sw) && /const EXTRA[\s\S]*sync-client\.js/.test(sw));
eq("service worker does not intercept the sync host",
   /origin !== self\.location\.origin/.test(sw));

console.log("offline-first:");
eq("opening a note is not gated on syncOnce",
   !/function openPage[\s\S]{0,400}syncOnce/.test(html));
eq("a failed sync does not throw into boot",
   /function syncOnce\(\)\{[\s\S]*?\.catch\(function\(e\)\{\s*sync\.lastErr/.test(html));
eq("timer is ~45s", /scheduleSync\(45000\)/.test(html));

console.log("ink tombstones:");
eq("eraseAt records gone ids",
   /function\(x, y\)\{[\s\S]*?S\.markGone\(Object\.keys\(gone\)\)/.test(html));
eq("lasso delete records gone ids",
   /S\.markGone\(Object\.keys\(ids\)\)/.test(html));
eq("page save writes removed",
   /saveAsset\(a\.id, \{ strokes: strokes, removed:/.test(html));
eq("page load reads removed",
   /noteSurface\.removed = \(a && a\.removed\) \|\| \{\}/.test(html));
eq("pages with no removed still work (missing means {})",
   /S\.removed = S\.removed \|\| \{\}/.test(html));

{
  const src = ["localMetaKey", "inkHasLocalExtras", "stripBlobs"].map(grab).join("\n");
  const A = new Function(src + "\n return { localMetaKey, inkHasLocalExtras, stripBlobs };")();
  eq("password meta is device-local", A.localMetaKey("syncKey") === true);
  eq("cursor meta is device-local", A.localMetaKey("syncPullSince") === true);
  eq("device id is device-local", A.localMetaKey("deviceId") === true);
  eq("cfg is allowed to sync", A.localMetaKey("cfg") === false);
  const stripped = A.stripBlobs({ id: "a", kind: "audio", blob: "HUGE", dur: 9, orig: "x" });
  eq("stripBlobs drops audio bytes", stripped.blob == null && stripped.orig == null && stripped.dur === 9);
  const merged = { strokes: [{ id: "s1" }, { id: "s2" }], removed: { e1: 1 } };
  const incoming = { strokes: [{ id: "s1" }], removed: {} };
  eq("local extra strokes must be pushed", A.inkHasLocalExtras(merged, incoming) === true);
  eq("identical ink does not bump", A.inkHasLocalExtras(incoming, incoming) === false);
}

if (bad) console.log("\n" + bad + " failed");
process.exitCode = bad ? 1 : 0;
