/* End-to-end simulation of a picture CROP travelling between devices, to find
   why "crop doesn't sync (the uncropped picture does)". Uses the REAL merge core
   (sync-client.js) plus a faithful transcription of the app's image push
   (attachImageBytes / imageDataChunks) and pull (applyPulledRows / finishImage).
   A blob is modelled as a short string; a small chunk size makes several rows.

   Run: node tests/cropsync.mjs
*/
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const SyncCore = require("../sync-client.js");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

const CHUNK = 4;
function imageDataChunks(assetId, dataUrl, updatedAt, device){
  const s = dataUrl || "";
  const n = Math.max(1, Math.ceil(s.length / CHUNK) || 1), out = [];
  for (let i = 0; i < n; i++) out.push({ store:"imgdata", id:assetId+":"+i, updated_at:updatedAt||0,
    deleted:0, device:device||null, body:{ assetId, i, n, data: s.slice(i*CHUNK,(i+1)*CHUNK) } });
  return out;
}
function joinImageData(parts){   // mirrors index.html's fixed joinImageData
  if (!parts || !parts.length) return "";
  const list = parts.slice().sort((a,b)=>(a.i||0)-(b.i||0));
  const n = list[0].n || list.length;
  if (list.length < n) return "";
  let s = ""; for (let i=0;i<n;i++){ if (!list[i] || (list[i].i||0)!==i) return ""; s += list[i].data||""; }
  return s;
}

/* A "server" table keyed by store/id, upsert-by-id like the Worker's D1. */
function makeServer(){ return { rows: new Map() }; }
function serverUpsert(srv, row){ srv.rows.set(row.store + "/" + row.id, { ...row }); }
function serverPull(srv, since){
  const out = [];
  for (const r of srv.rows.values()) if ((Number(r.updated_at)||0) > since) out.push({ ...r });
  return out.sort((a,b)=>(Number(a.updated_at)||0)-(Number(b.updated_at)||0));
}

/* A device: a light record map (notes/assets, blobs stripped), a real asset
   store with blobs, the per-asset syncImg accumulator, and the two cursors. */
function makeDevice(id){ return { id, light:{}, assets:{}, syncImg:{}, pushSince:0, since:0 }; }

function stripBlobs(r){ const o={}; for (const k in r){ if (k==="blob"||k==="orig") continue; o[k]=r[k]; } return o; }
function dumpLightMap(dev){
  const map = {};
  for (const id in dev.assets){ const a = dev.assets[id]; map["assets/"+id] = stripBlobs(a); }
  return map;
}
/* push: exactly the app's flow — changedSince(dumpLightMap, pushSince), attach
   image bytes for changed image assets, upsert to server, advance pushSince. */
function push(dev, srv, now){
  const recs = SyncCore.changedSince(dumpLightMap(dev), dev.pushSince || 0);
  const extra = [];
  recs.forEach(row => {
    if (row.store !== "assets") return;
    const a = dev.assets[row.id];
    if (!a || a.kind !== "image" || !a.blob || a.deletedAt) return;
    imageDataChunks(a.id, a.blob, row.updated_at || a.lastEdited, row.device).forEach(c => extra.push(c));
  });
  recs.concat(extra).forEach(r => serverUpsert(srv, r));
  dev.pushSince = now;
}
/* pull: fetch since (since-120000 lookback), applyPulledRows, advance cursor. */
function pull(dev, srv){
  const pullSince = Math.max(0, (dev.since||0) - 120000);
  const rows = serverPull(srv, pullSince);
  applyPulledRows(dev, rows);
  let maxAt = dev.since || 0;
  rows.forEach(r => { const t = Number(r.updated_at)||0; if (t>maxAt) maxAt = t; });
  dev.since = maxAt;
}
function finishImage(dev, aid, more){
  const arr = (dev.syncImg[aid] || []).slice();
  (more||[]).forEach(p => { if (p && p.i != null) arr[p.i] = { i:p.i, n:p.n, data:p.data||"" }; });
  const filled = []; arr.forEach(p => { if (p) filled.push(p); });
  const data = joinImageData(filled);
  if (!data){ dev.syncImg[aid] = arr; return; }
  const a = dev.assets[aid];
  if (!a){ dev.syncImg[aid] = arr; return; }
  a.blob = data;                 // dataToBlob
  dev.syncImg[aid] = [];
}
function applyPulledRows(dev, rows){
  const storeOrd = { notebooks:0, groups:1, sections:2, notes:3, practices:4, assets:5, meta:6, imgdata:7 };
  const list = rows.slice().sort((a,b)=>{
    const da = storeOrd[a.store]!=null?storeOrd[a.store]:9, db = storeOrd[b.store]!=null?storeOrd[b.store]:9;
    if (da!==db) return da-db; return (Number(a.updated_at)||0)-(Number(b.updated_at)||0);
  });
  const imgParts = {};
  list.forEach(row => {
    const incoming = { ...(row.body||{}) };
    if (row.store === "imgdata"){
      const aid = incoming.assetId;
      (imgParts[aid] = imgParts[aid] || []).push({ i:incoming.i, n:incoming.n, data:incoming.data||"" });
      return;
    }
    if (!incoming.id) incoming.id = row.id;
    if (incoming.lastEdited == null && row.updated_at != null && !row.deleted) incoming.lastEdited = row.updated_at;
    if (row.deleted && incoming.deletedAt == null) incoming.deletedAt = row.updated_at;
    if (row.store === "assets"){
      const merged = SyncCore.mergeRecord(dev.assets[row.id] || null, incoming);
      dev.assets[row.id] = merged;
      finishImage(dev, row.id, []);
    }
  });
  Object.keys(imgParts).forEach(aid => finishImage(dev, aid, imgParts[aid]));
}

// ---- scenario ----
const srv = makeServer();
const A = makeDevice("A"), B = makeDevice("B");
let t = 1000;

// 1. A adds a picture (10 chars -> 3 chunks)
A.assets["img1"] = { id:"img1", kind:"image", blob:"ORIGINAL01", w:100, h:80, lastEdited:++t, editedOn:"A" };
push(A, srv, ++t);
pull(B, srv);
eq("after add, device B has the original picture", B.assets.img1 && B.assets.img1.blob === "ORIGINAL01");

// 2. A crops it (4 chars -> 1 chunk), keeps orig, bumps lastEdited
A.assets["img1"] = { id:"img1", kind:"image", blob:"CROP", w:40, h:30, orig:"ORIGINAL01", lastEdited:++t, editedOn:"A" };
push(A, srv, ++t);

// established device B pulls the crop
pull(B, srv);
eq("ESTABLISHED device B receives the CROP (blob replaced)", B.assets.img1 && B.assets.img1.blob === "CROP");
eq("ESTABLISHED device B shows the cropped dimensions", B.assets.img1 && B.assets.img1.w === 40 && B.assets.img1.h === 30);

// a FRESH device C that never saw the original pulls everything at once
const C = makeDevice("C");
pull(C, srv);
eq("FRESH device C receives the crop, not a broken/joined-with-stale-chunk picture",
   C.assets.img1 && C.assets.img1.blob === "CROP");

// orphan chunks from the larger original DO still sit on the server (the fix is
// on the join side, which now ignores them). Documented, not a correctness fail.
const leftover = [...srv.rows.keys()].filter(k => k.startsWith("imgdata/img1:")).sort();
console.log("   (orphan chunks still on server, now harmless):", leftover.join(", "));

// re-pulling within the 120s look-back must keep the crop, not revert it
pull(B, srv);
eq("re-pulling the stale orphans next to the crop keeps the crop (no revert)",
   B.assets.img1 && B.assets.img1.blob === "CROP");

process.exitCode = bad ? 1 : 0;
console.log(bad ? "\n" + bad + " failed" : "\nall crop-sync checks passed");
