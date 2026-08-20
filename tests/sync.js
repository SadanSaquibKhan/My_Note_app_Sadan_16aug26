/* Two simulated devices syncing through a fake server, to prove the merge core
 * (../sync-client.js) never loses a note or a stroke. No app, no network, no
 * IndexedDB — just the pure merge logic under every nasty ordering.
 *
 * Run: node tests/sync.js
 */
var SyncCore = require("../sync-client.js");
var bad = 0;
function eq(label, cond) { console.log((cond ? "  ok   " : "  FAIL ") + label); if (!cond) bad++; }
/* order-independent stringify: two devices hold the same records but may have
   inserted them in a different order, and that must count as converged. */
function canon(x) {
  if (Array.isArray(x)) return x.map(canon);
  if (x && typeof x === "object") {
    var out = {};
    Object.keys(x).sort().forEach(function (k) { out[k] = canon(x[k]); });
    return out;
  }
  return x;
}
function deepEq(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }

/* ---- the fake server: one records table, last-writer-wins, seq cursor ---- */
function makeServer() {
  var rows = {};          // key "store/id" -> {store,id,updated_at,deleted,device,body,seq}
  var seq = 0;
  return {
    push: function (changes) {
      (changes || []).forEach(function (c) {
        var key = c.store + "/" + c.id;
        var cur = rows[key];
        if (!cur || c.updated_at > cur.updated_at) {   // LWW by clock
          seq++;
          rows[key] = { store: c.store, id: c.id, updated_at: c.updated_at,
                        deleted: c.deleted || 0, device: c.device || null,
                        body: c.body, seq: seq };
        }
      });
    },
    pull: function (sinceSeq) {
      return Object.keys(rows).map(function (k) { return rows[k]; })
        .filter(function (r) { return r.seq > sinceSeq; })
        .sort(function (a, b) { return a.seq - b.seq; });
    },
    now: function () { return seq; }
  };
}

/* ---- a device: a local map keyed "store/id", plus a pull cursor ---- */
function makeDevice(id) {
  return { id: id, local: {}, pullSeq: 0,
    put: function (store, rec) { this.local[store + "/" + rec.id] = rec; },
    get: function (store, rid) { return this.local[store + "/" + rid]; }
  };
}

/* One sync round: pull-and-merge, then push everything (full push is O(n) but
   obviously correct; incremental push is an optimisation for the app layer). */
function sync(dev, server) {
  var rows = server.pull(dev.pullSeq);
  var res = SyncCore.applyPull(dev.local, rows);
  dev.local = res.map;
  dev.pullSeq = server.now();
  server.push(SyncCore.changedSince(dev.local, -1));   // push all local records
  // pull once more so this device also holds the server's merged result
  var rows2 = server.pull(dev.pullSeq);
  dev.local = SyncCore.applyPull(dev.local, rows2).map;
  dev.pullSeq = server.now();
}
function syncBoth(a, b, server, rounds) {
  rounds = rounds || 2;
  for (var i = 0; i < rounds; i++) { sync(a, server); sync(b, server); }
}
function inkIds(rec) {
  return (rec && rec.strokes || []).map(function (s) { return s.id; }).sort();
}

console.log("1. a note made on one device reaches the other:");
{
  var s = makeServer(), A = makeDevice("A"), B = makeDevice("B");
  A.put("notes", { id: "n1", title: "hello", html: "<p>hi</p>", lastEdited: 10, editedOn: "A" });
  syncBoth(A, B, s);
  eq("B receives the note", !!B.get("notes", "n1") && B.get("notes", "n1").title === "hello");
  eq("both devices are identical", deepEq(A.local, B.local));
}

console.log("");
console.log("2. same note edited offline on BOTH sides — newer wins, both converge:");
{
  var s = makeServer(), A = makeDevice("A"), B = makeDevice("B");
  A.put("notes", { id: "n1", title: "orig", html: "x", lastEdited: 10, editedOn: "A" });
  syncBoth(A, B, s);                                   // both have the original
  A.put("notes", { id: "n1", title: "A-edit", html: "xa", lastEdited: 20, editedOn: "A" });
  B.put("notes", { id: "n1", title: "B-edit", html: "xb", lastEdited: 30, editedOn: "B" });
  syncBoth(A, B, s);
  // last-writer-wins for plain text (rare for this user; ink below never loses)
  eq("the newer edit (B, t=30) wins on both", A.get("notes","n1").title === "B-edit" && B.get("notes","n1").title === "B-edit");
  eq("both devices converge to the identical winner", deepEq(A.local, B.local));
}

console.log("");
console.log("3. delete on one side vs a NEWER edit on the other — the edit survives:");
{
  var s = makeServer(), A = makeDevice("A"), B = makeDevice("B");
  A.put("notes", { id: "n1", title: "orig", lastEdited: 10, editedOn: "A" });
  syncBoth(A, B, s);
  A.put("notes", { id: "n1", title: "orig", lastEdited: 10, deletedAt: 20, editedOn: "A" });   // delete @20
  B.put("notes", { id: "n1", title: "kept!", lastEdited: 40, editedOn: "B" });                 // edit @40
  syncBoth(A, B, s);
  eq("the later edit beats the older delete", !A.get("notes","n1").deletedAt && A.get("notes","n1").title === "kept!");
  eq("both converge", deepEq(A.local, B.local));
}
console.log("   (and the reverse: a NEWER delete wins — the note is a tombstone, recoverable in the app's trash)");
{
  var s = makeServer(), A = makeDevice("A"), B = makeDevice("B");
  A.put("notes", { id: "n1", title: "orig", lastEdited: 10, editedOn: "A" });
  syncBoth(A, B, s);
  B.put("notes", { id: "n1", title: "edit", lastEdited: 20, editedOn: "B" });                  // edit @20
  A.put("notes", { id: "n1", title: "orig", lastEdited: 10, deletedAt: 40, editedOn: "A" });   // delete @40
  syncBoth(A, B, s);
  eq("the newer delete wins on both", !!A.get("notes","n1").deletedAt && !!B.get("notes","n1").deletedAt);
  eq("it is a tombstone, not erased (the app's trash can restore it)", A.get("notes","n1").title != null);
  eq("both converge", deepEq(A.local, B.local));
}

console.log("");
console.log("4. the same page drawn on by BOTH devices — every stroke is kept:");
{
  var s = makeServer(), A = makeDevice("A"), B = makeDevice("B");
  A.put("assets", { id: "ink_p", noteId: "p", kind: "page", strokes: [{ id: "s0", t: 1 }], removed: {}, lastEdited: 5 });
  syncBoth(A, B, s);                                   // both have s0
  A.put("assets", { id: "ink_p", noteId: "p", kind: "page", strokes: [{ id: "s0", t: 1 }, { id: "sA", t: 10 }], removed: {}, lastEdited: 10 });
  B.put("assets", { id: "ink_p", noteId: "p", kind: "page", strokes: [{ id: "s0", t: 1 }, { id: "sB", t: 12 }], removed: {}, lastEdited: 12 });
  syncBoth(A, B, s);
  eq("A keeps its own AND B's stroke", deepEq(inkIds(A.get("assets","ink_p")), ["s0","sA","sB"]));
  eq("B keeps its own AND A's stroke", deepEq(inkIds(B.get("assets","ink_p")), ["s0","sA","sB"]));
  eq("both converge", deepEq(A.local, B.local));
}

console.log("");
console.log("5. an erase on one device is respected everywhere (no zombie strokes):");
{
  var s = makeServer(), A = makeDevice("A"), B = makeDevice("B");
  A.put("assets", { id: "ink_p", noteId: "p", kind: "page", strokes: [{ id: "s0", t: 1 }, { id: "s1", t: 2 }], removed: {}, lastEdited: 5 });
  syncBoth(A, B, s);                                   // both have s0,s1
  // A erases s1 (tombstone) and draws sA; B draws sB, still has s1 locally
  A.put("assets", { id: "ink_p", noteId: "p", kind: "page", strokes: [{ id: "s0", t: 1 }, { id: "sA", t: 10 }], removed: { s1: 10 }, lastEdited: 10 });
  B.put("assets", { id: "ink_p", noteId: "p", kind: "page", strokes: [{ id: "s0", t: 1 }, { id: "s1", t: 2 }, { id: "sB", t: 12 }], removed: {}, lastEdited: 12 });
  syncBoth(A, B, s);
  eq("the erased stroke s1 is gone on both, not resurrected", deepEq(inkIds(A.get("assets","ink_p")), ["s0","sA","sB"]) && deepEq(inkIds(B.get("assets","ink_p")), ["s0","sA","sB"]));
  eq("both converge", deepEq(A.local, B.local));
}

console.log("");
console.log("6. syncing again with nothing new changes nothing (idempotent):");
{
  var s = makeServer(), A = makeDevice("A"), B = makeDevice("B");
  A.put("notes", { id: "n1", title: "x", lastEdited: 10, editedOn: "A" });
  A.put("assets", { id: "ink_p", noteId: "p", kind: "page", strokes: [{ id: "s0", t: 1 }], removed: {}, lastEdited: 5 });
  syncBoth(A, B, s);
  var beforeA = JSON.stringify(A.local), beforeB = JSON.stringify(B.local);
  syncBoth(A, B, s); syncBoth(A, B, s);
  eq("A unchanged after two extra syncs", JSON.stringify(A.local) === beforeA);
  eq("B unchanged after two extra syncs", JSON.stringify(B.local) === beforeB);
}

console.log("");
console.log("7. a long gap then many rounds still converges, both ways:");
{
  var s = makeServer(), A = makeDevice("A"), B = makeDevice("B");
  for (var i = 0; i < 8; i++) A.put("notes", { id: "n" + i, title: "A" + i, lastEdited: 100 + i, editedOn: "A" });
  for (var j = 0; j < 8; j++) B.put("notes", { id: "m" + j, title: "B" + j, lastEdited: 200 + j, editedOn: "B" });
  // one device off for a "week": sync A a few times alone, then B joins
  sync(A, s); sync(A, s);
  syncBoth(A, B, s, 4);
  eq("A has all 16 notes", Object.keys(A.local).length === 16);
  eq("B has all 16 notes", Object.keys(B.local).length === 16);
  eq("both converge", deepEq(A.local, B.local));
}

console.log("");
console.log("8. blobs never travel as light data:");
{
  var light = SyncCore.lightBody({ id: "a1", kind: "audio", dur: 90, blob: { size: 9999999 }, orig: { size: 1 }, lastEdited: 3 });
  eq("the audio blob is stripped", light.blob === undefined && light.orig === undefined);
  eq("the small metadata is kept", light.dur === 90 && light.kind === "audio");
}

console.log("");
console.log("9. merge is commutative — order of the two versions does not matter:");
{
  var a = { id: "n", title: "A", lastEdited: 20 }, b = { id: "n", title: "B", lastEdited: 30 };
  eq("mergeRecord(a,b) == mergeRecord(b,a) winner",
     SyncCore.mergeRecord(a, b).title === SyncCore.mergeRecord(b, a).title);
  var p = { kind: "page", strokes: [{ id: "x", t: 1 }], removed: { y: 5 }, lastEdited: 5 };
  var q = { kind: "page", strokes: [{ id: "y", t: 2 }], removed: {}, lastEdited: 6 };
  eq("mergeInk is order-independent", deepEq(inkIds(SyncCore.mergeInk(p, q)), inkIds(SyncCore.mergeInk(q, p))));
}

console.log("");
console.log("10. the live server stores body as a JSON string — pull must parse it:");
{
  var local = {};
  var rows = [{
    store: "notes", id: "n1", updated_at: 50, deleted: 0, device: "A",
    body: JSON.stringify({ id: "n1", title: "from string", lastEdited: 50 })
  }];
  var res = SyncCore.applyPull(local, rows);
  eq("string body is parsed, not treated as empty", res.map["notes/n1"] && res.map["notes/n1"].title === "from string");
}

console.log("");
console.log("11. working-sheet strokes merge the same way as page ink:");
{
  var a = { id: "pr1", strokes: [{ id: "sA", t: 1 }], lastEdited: 10 };
  var b = { id: "pr1", strokes: [{ id: "sB", t: 2 }], lastEdited: 11 };
  eq("a practice record counts as ink", SyncCore.isInk(a) === true);
  eq("both sides' working strokes survive",
     inkIds(SyncCore.mergeRecord(a, b)).join(",") === "sA,sB");
}

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " FAILED" : "\nall sync-merge checks passed");
