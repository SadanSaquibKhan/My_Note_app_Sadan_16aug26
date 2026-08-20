/* Two fake devices talking to the LIVE Cloudflare Worker.
   Proves a note and a stroke survive a round-trip, and that a missing
   password file is skipped rather than failing the rest of the suite.

   Run: node tests/synclive.mjs
   Reads the password from C:\Users\khans\margin-sync-key.txt — never prints it.
*/
import fs from "fs";
import SyncCore from "../sync-client.js";

const URL = "https://margin-sync.khanssk89.workers.dev";
const KEY_PATH = "C:\\Users\\khans\\margin-sync-key.txt";

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

let key = "";
try { key = fs.readFileSync(KEY_PATH, "utf8").trim(); } catch (e) { key = ""; }
if (!key){
  console.log("skip  no local password file — live two-device test not run");
  process.exit(0);
}

function hdr(){
  return { "x-margin-key": key, "content-type": "application/json" };
}
async function pull(since, device){
  const r = await fetch(URL + "/pull?since=" + since + "&device=" + encodeURIComponent(device), { headers: hdr() });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  (j.records || []).forEach(function(row){
    if (typeof row.body === "string"){
      try { row.body = JSON.parse(row.body); } catch (e) { row.body = {}; }
    }
  });
  return j;
}
async function push(records){
  const r = await fetch(URL + "/push", { method: "POST", headers: hdr(), body: JSON.stringify({ records: records }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
  return j;
}

const stamp = Date.now();
const noteId = "live_nt_" + stamp;
const inkId = "live_ink_" + stamp;
const A = "liveA_" + stamp;
const B = "liveB_" + stamp;

try {
  console.log("live two-device round-trip:");
  const note = {
    id: noteId, notebookId: "live_nb", title: "live ping " + stamp,
    html: "<p>from A</p>", lastEdited: stamp, editedOn: A, deletedAt: null
  };
  const ink = {
    id: inkId, noteId: noteId, kind: "page",
    strokes: [{ id: "sA_" + stamp, t: stamp, pts: [1, 2, 0.5] }],
    removed: {}, lastEdited: stamp, editedOn: A
  };
  await push(SyncCore.changedSince({
    ["notes/" + noteId]: note,
    ["assets/" + inkId]: ink
  }, -1).map(function(c){ c.device = A; return c; }));

  const fromB = await pull(stamp - 1, B);
  const notes = (fromB.records || []).filter(function(r){ return r.store === "notes" && r.id === noteId; });
  const inks = (fromB.records || []).filter(function(r){ return r.store === "assets" && r.id === inkId; });
  eq("B sees A's note", notes.length === 1 && notes[0].body && notes[0].body.title === note.title);
  eq("B sees A's stroke", !!(inks[0] && inks[0].body && (inks[0].body.strokes || []).some(function(s){ return s.id === "sA_" + stamp; })));

  const localB = {};
  const merged = SyncCore.applyPull(localB, fromB.records);
  const bInk = merged.map["assets/" + inkId];
  bInk.strokes = (bInk.strokes || []).concat([{ id: "sB_" + stamp, t: stamp + 1, pts: [3, 4, 0.5] }]);
  bInk.lastEdited = stamp + 2;
  bInk.editedOn = B;
  await push(SyncCore.changedSince({ ["assets/" + inkId]: bInk }, -1).map(function(c){ c.device = B; return c; }));

  const fromA = await pull(stamp - 1, A);
  const aMap = SyncCore.applyPull({ ["assets/" + inkId]: ink }, fromA.records).map;
  const ids = (aMap["assets/" + inkId].strokes || []).map(function(s){ return s.id; }).sort();
  eq("A keeps its stroke AND B's stroke",
     ids.indexOf("sA_" + stamp) >= 0 && ids.indexOf("sB_" + stamp) >= 0);

  /* leave a tombstone so this fixture does not sit as a real page forever */
  const goneAt = Date.now();
  await push([{
    store: "notes", id: noteId, updated_at: goneAt, deleted: 1, device: A,
    body: { id: noteId, lastEdited: goneAt, deletedAt: goneAt }
  }, {
    store: "assets", id: inkId, updated_at: goneAt, deleted: 1, device: A,
    body: { id: inkId, lastEdited: goneAt, deletedAt: goneAt, kind: "page", strokes: [], removed: {} }
  }]);
  eq("cleanup tombstone accepted", true);
} catch (e) {
  eq("live round-trip threw: " + ((e && e.message) || e), false);
}

if (bad) console.log("\n" + bad + " failed");
process.exitCode = bad ? 1 : 0;
