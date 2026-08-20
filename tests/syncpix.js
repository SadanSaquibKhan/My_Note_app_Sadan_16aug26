/* The picture path of sync, modelled end to end: a JPEG is split into 'imgdata'
 * chunk rows on push, the server truncates a pull at 5000 rows, and the client
 * reassembles across pulls using a meta buffer plus a 120s cursor lookback.
 * This proves a picture ALWAYS reassembles under normal sync cadence, and marks
 * the one pathological case (cursor jumps a full lookback past the chunks before
 * the tail arrives) so a future change cannot reintroduce it silently.
 *
 * The chunk/join/cursor logic is transcribed from index.html (imageDataChunks,
 * joinImageData, applyPulledRows cursor advance, syncOnce's 120s lookback) and
 * from the Worker's `updated_at > ? ORDER BY updated_at ASC LIMIT 5000`.
 *
 * Run: node tests/syncpix.js
 */
var bad = 0;
function eq(l, c){ console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; }

var IMGDATA_CHUNK = 40000;
var LIMIT = 5000;
var LOOKBACK = 120000;

/* --- transcribed from index.html --- */
function imageDataChunks(assetId, dataUrl, updatedAt){
  var s = dataUrl || "", n = Math.max(1, Math.ceil(s.length / IMGDATA_CHUNK) || 1), out = [], i;
  for (i = 0; i < n; i++) out.push({
    store: "imgdata", id: assetId + ":" + i, updated_at: updatedAt || 0,
    body: { assetId: assetId, i: i, n: n, data: s.slice(i * IMGDATA_CHUNK, (i + 1) * IMGDATA_CHUNK) }
  });
  return out;
}
function joinImageData(parts){
  if (!parts || !parts.length) return "";
  var list = parts.slice().sort(function(a, b){ return (a.i || 0) - (b.i || 0); });
  if (list[0].n && list.length !== list[0].n) return "";
  var s = "", i;
  for (i = 0; i < list.length; i++){ if ((list[i].i || 0) !== i) return ""; s += list[i].data || ""; }
  return s;
}

/* --- a fake Worker + D1: LWW upsert, pull filters updated_at>since, LIMIT 5000, ASC --- */
function makeServer(){
  var rows = {};
  return {
    push: function(recs){ (recs || []).forEach(function(r){
      var k = r.store + "/" + r.id, cur = rows[k];
      if (!cur || (r.updated_at || 0) > (cur.updated_at || 0)) rows[k] = r;
    }); },
    pull: function(since){
      return Object.keys(rows).map(function(k){ return rows[k]; })
        .filter(function(r){ return (r.updated_at || 0) > since; })
        .sort(function(a, b){ return (a.updated_at || 0) - (b.updated_at || 0); })
        .slice(0, LIMIT);
    }
  };
}

/* --- a device that pulls with the 120s lookback and buffers chunks in "meta" --- */
function makeDevice(){
  return { since: 0, buf: {}, assembled: {},
    syncOnce: function(server){
      var since = Math.max(0, this.since - LOOKBACK);
      var rows = server.pull(since), maxAt = this.since, self = this;
      rows.forEach(function(row){
        if (row.store === "imgdata"){
          var aid = row.body.assetId;
          if (!self.buf[aid]) self.buf[aid] = [];
          // upsert the chunk by index (idempotent)
          var b = self.buf[aid], hit = false;
          for (var j = 0; j < b.length; j++) if (b[j].i === row.body.i){ b[j] = row.body; hit = true; break; }
          if (!hit) b.push(row.body);
          var data = joinImageData(self.buf[aid]);
          if (data){ self.assembled[aid] = data; self.buf[aid] = []; }
        }
        if ((row.updated_at || 0) > maxAt) maxAt = row.updated_at;
      });
      this.since = maxAt;               /* never jumps to server "now" */
      return rows.length;
    }
  };
}

/* a data-url string of a given size */
function jpeg(kb){ var s = "data:image/jpeg;base64,"; while (s.length < kb * 1024) s += "ABCDEFGH"; return s; }

console.log("1. a normal picture (all chunks in one pull) reassembles:");
{
  var srv = makeServer(), dev = makeDevice();
  var data = jpeg(120);                          // ~3 chunks
  imageDataChunks("img1", data, 1000).forEach(function(c){ srv.push([c]); });
  dev.syncOnce(srv);
  eq("assembled exactly what was sent", dev.assembled.img1 === data);
}

console.log("");
console.log("2. joinImageData holds back until every chunk is present:");
{
  var full = jpeg(120), parts = imageDataChunks("x", full, 5).map(function(r){ return r.body; });
  eq("missing one chunk -> empty (not a corrupt half-picture)", joinImageData(parts.slice(0, parts.length - 1)) === "");
  eq("all chunks -> the exact bytes", joinImageData(parts) === full);
  eq("out-of-order chunks still join correctly", joinImageData(parts.slice().reverse()) === full);
}

console.log("");
console.log("3. real data (edits spread over time) paginates past the 5000 LIMIT and");
console.log("   a picture in a later batch still reassembles:");
{
  var srv = makeServer(), dev = makeDevice();
  // 4998 notes whose edit times are spread out (100ms apart, ~500s total) — like a
  // real library edited over weeks. Any 120s window holds far fewer than 5000, so
  // the cursor keeps moving forward each pull.
  for (var i = 0; i < 4998; i++) srv.push([{ store: "notes", id: "n" + i, updated_at: (i + 1) * 100, body: { id: "n" + i } }]);
  var data = jpeg(400);                            // ~10 chunks
  imageDataChunks("big", data, 4998 * 100 + 1000).forEach(function(c){ srv.push([c]); });
  eq("more rows exist than one pull can carry", (4998 + 10) > LIMIT);
  var rounds = 0;
  while (rounds < 10 && dev.assembled.big !== data){ dev.syncOnce(srv); rounds++; }
  eq("the picture fully reassembles across pulls (" + rounds + " rounds)", dev.assembled.big === data);
  eq("byte-for-byte the original", dev.assembled.big === data);
}

console.log("");
console.log("4. DOCUMENTED LIMITATION — more than 5000 rows inside ONE 120s window:");
console.log("   the pull LIMIT keeps returning the same first 5000 and the tail never");
console.log("   arrives. Realistic trigger for THIS user: bumpImagesForSync stamps every");
console.log("   image with the SAME `now`, so hundreds of pasted screenshots become");
console.log("   thousands of chunks at one timestamp.");
{
  var srv = makeServer(), dev = makeDevice();
  // 5001 rows all within one 120s window (here, all at t=1000) + a picture at t=1000
  for (var j = 0; j < 5001; j++) srv.push([{ store: "notes", id: "m" + j, updated_at: 1000, body: { id: "m" + j } }]);
  var d2 = jpeg(120), chunks2 = imageDataChunks("stuck", d2, 1000);
  chunks2.forEach(function(c){ srv.push([c]); });
  var rounds2 = 0;
  while (rounds2 < 6 && dev.assembled.stuck !== d2){ dev.syncOnce(srv); rounds2++; }
  eq("current behaviour: the tail beyond 5000 does NOT arrive (this is the bug to fix)",
     dev.assembled.stuck !== d2);
  console.log("         FIX PATHS (for a later build, coordinate with the sync hunt):");
  console.log("         (a) never bulk-stamp >5000 rows at one ms — stagger now+i in");
  console.log("             bumpImagesForSync and any restore/import; and/or");
  console.log("         (b) a COMPOUND cursor in the Worker + client: order by");
  console.log("             (updated_at, id) and remember the last (updated_at,id), so a");
  console.log("             pull can page WITHIN one timestamp. (b) is the real fix.");
}

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " FAILED" : "\nall picture-sync checks passed");
