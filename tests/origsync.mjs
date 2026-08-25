/* Forward specification for syncing both byte slots of a cropped image.

   The model checks below are green now. The final live-source checks are
   intentionally red until index.html adopts this protocol. Codex is not
   allowed to edit index.html in this task.

   Run: node tests/origsync.mjs index.html
*/
import fs from "fs";

const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
let bad = 0;
const eq = (label, condition) => {
  console.log((condition ? "  ok   " : "  FAIL ") + label);
  if (!condition) bad++;
};

const ORIG_PREFIX = ":orig:";
const VALID_SLOTS = { blob: true, orig: true };

/* Existing blob rows keep assetId:i exactly. Orig rows use a reserved prefix.
   Margin-generated image IDs start img_, so the namespaces cannot collide.
   The leading colon also makes b177's fallback row.id.split(":")[0] empty;
   old clients safely ignore orig rows instead of gluing them into blob. */
function imageChunkId(assetId, slot, i){
  if (slot === "blob") return assetId + ":" + i;
  if (slot === "orig") return ORIG_PREFIX + encodeURIComponent(assetId) + ":" + i;
  throw new Error("Unknown image byte slot: " + slot);
}

function imageRevision(updatedAt, device){
  return String(Number(updatedAt) || 0) + "@" + String(device || "");
}

function imageSlotChunks(assetId, slot, dataUrl, updatedAt, device, chunk, rev){
  if (!VALID_SLOTS[slot]) throw new Error("Unknown image byte slot: " + slot);
  chunk = chunk || 4;
  rev = rev || imageRevision(updatedAt, device);

  /* A fixed head tombstone invalidates every older orig part, including stale
     higher indexes that the current server cannot enumerate by prefix. */
  if (dataUrl == null){
    return [{
      store: "imgdata",
      id: imageChunkId(assetId, slot, 0),
      updated_at: updatedAt || 0,
      deleted: 1,
      device: device || null,
      body: {
        ownerId: assetId, slot, i: 0, n: 0,
        present: false, rev
      }
    }];
  }

  const text = String(dataUrl);
  const n = Math.max(1, Math.ceil(text.length / chunk) || 1);
  const rows = [];
  for (let i = 0; i < n; i++){
    const body = {
      ownerId: assetId, slot, i, n,
      present: true, rev,
      data: text.slice(i * chunk, (i + 1) * chunk)
    };
    /* Old clients understand only the blob namespace. Do not put assetId on
       orig rows: b177 would otherwise mistake pristine bytes for display bytes. */
    if (slot === "blob") body.assetId = assetId;
    rows.push({
      store: "imgdata",
      id: imageChunkId(assetId, slot, i),
      updated_at: updatedAt || 0,
      deleted: 0,
      device: device || null,
      body
    });
  }
  return rows;
}

function ownerFromOrigId(id){
  id = String(id || "");
  if (!id.startsWith(ORIG_PREFIX)) return "";
  const rest = id.slice(ORIG_PREFIX.length);
  const cut = rest.lastIndexOf(":");
  if (cut < 0) return "";
  try { return decodeURIComponent(rest.slice(0, cut)); }
  catch (_) { return ""; }
}

/* Accepts both the old assetId:i rows and the new named-slot rows. */
function decodeImageRow(row){
  if (!row || row.store !== "imgdata") return null;
  const body = row.body && typeof row.body === "object" ? row.body : {};
  let slot = body.slot;
  if (!VALID_SLOTS[slot]) slot = String(row.id || "").startsWith(ORIG_PREFIX) ? "orig" : "blob";
  let ownerId = body.ownerId || body.assetId || "";
  if (!ownerId && slot === "orig") ownerId = ownerFromOrigId(row.id);
  if (!ownerId && slot === "blob"){
    const id = String(row.id || "");
    const cut = id.lastIndexOf(":");
    ownerId = cut > 0 ? id.slice(0, cut) : "";
  }
  if (!ownerId) return null;
  const rev = body.rev || imageRevision(row.updated_at, row.device);
  return {
    ownerId, slot,
    i: Number(body.i), n: Number(body.n),
    data: body.data || "", rev,
    present: body.present !== false && !row.deleted,
    deleted: !!row.deleted || body.present === false,
    updatedAt: Number(row.updated_at) || 0
  };
}

/* Index zero is the authoritative generation header. A new short image may
   coexist with stale old tail rows; only parts with the head's rev may join. */
function joinImageSlot(parts){
  const byIndex = new Map();
  (parts || []).forEach(part => {
    if (!part || !Number.isInteger(part.i) || part.i < 0) return;
    const old = byIndex.get(part.i);
    if (!old || part.updatedAt >= old.updatedAt) byIndex.set(part.i, part);
  });
  const head = byIndex.get(0);
  if (!head) return { status: "waiting" };
  if (head.deleted || !head.present || head.n === 0) return { status: "clear", rev: head.rev };
  if (!Number.isInteger(head.n) || head.n < 1) return { status: "waiting" };
  let data = "";
  for (let i = 0; i < head.n; i++){
    const part = byIndex.get(i);
    if (!part || part.deleted || !part.present || part.rev !== head.rev || part.n !== head.n)
      return { status: "waiting", rev: head.rev };
    data += part.data;
  }
  return { status: "ready", data, rev: head.rev };
}

function makeDevice(){ return { assets: {}, pending: {} }; }

function pendingKey(ownerId, slot){ return encodeURIComponent(ownerId) + ":" + slot; }

/* This deliberately assigns null instead of using keepLocalBytes. The latter
   protects bytes from a light asset row and would resurrect stale orig bytes. */
function setSyncedImageSlot(device, ownerId, slot, value){
  const asset = device.assets[ownerId];
  if (!asset) return false;
  asset[slot] = value == null ? null : value;
  return true;
}

function applyImageRows(device, rows){
  const groups = {};
  (rows || []).forEach(row => {
    const part = decodeImageRow(row);
    if (!part) return;
    const key = pendingKey(part.ownerId, part.slot);
    (groups[key] = groups[key] || { ownerId: part.ownerId, slot: part.slot, parts: [] }).parts.push(part);
  });
  Object.keys(groups).forEach(key => {
    const group = groups[key];
    const old = device.pending[key] || [];
    const merged = old.slice();
    group.parts.forEach(part => { merged[part.i] = part; });
    const result = joinImageSlot(merged.filter(Boolean));
    if (result.status === "ready"){
      setSyncedImageSlot(device, group.ownerId, group.slot, result.data);
      device.pending[key] = [];
    } else if (result.status === "clear"){
      setSyncedImageSlot(device, group.ownerId, group.slot, null);
      device.pending[key] = [];
    } else {
      device.pending[key] = merged;
    }
  });
}

function makeServer(){ return new Map(); }
function upsert(server, rows){
  rows.forEach(row => server.set(row.store + "/" + row.id, row));
}
function allRows(server){ return Array.from(server.values()); }

console.log("protocol model — two slots and compatibility:");
{
  const blob = imageSlotChunks("img_abc", "blob", "DISPLAY", 10, "A", 3);
  const orig = imageSlotChunks("img_abc", "orig", "PRISTINE", 10, "A", 3);
  eq("existing blob row IDs stay assetId:i", blob[0].id === "img_abc:0");
  eq("orig rows use a different namespace", orig[0].id === ":orig:img_abc:0");
  eq("the two slots have no row-ID collision",
     !blob.some(a => orig.some(b => a.id === b.id)));
  eq("orig rows do not expose body.assetId to old clients",
     orig.every(row => !Object.prototype.hasOwnProperty.call(row.body, "assetId")));
  const oldAid = orig[0].body.assetId || String(orig[0].id).split(":")[0];
  eq("b177 safely ignores a new orig row", oldAid === "");
  eq("old assetId:i rows decode as blob",
     decodeImageRow({store:"imgdata", id:"img_old:2", updated_at:7,
       body:{assetId:"img_old", i:2, n:3, data:"X"}}).slot === "blob");
  const tricky = imageSlotChunks("img_a:b/%", "orig", "X", 11, "A", 4)[0];
  eq("encoded orig IDs round-trip punctuation without ambiguity",
     decodeImageRow(tricky).ownerId === "img_a:b/%");
}

console.log("protocol model — complete generations only:");
{
  const rows = imageSlotChunks("img_join", "orig", "ABCDEFGHIJ", 20, "A", 4);
  const decoded = rows.map(decodeImageRow);
  eq("out-of-order parts assemble", joinImageSlot([decoded[2], decoded[0], decoded[1]]).data === "ABCDEFGHIJ");
  eq("a missing middle part waits", joinImageSlot([decoded[0], decoded[2]]).status === "waiting");
  const newerHead = decodeImageRow(imageSlotChunks("img_join", "orig", "NEW-CONTENT", 21, "A", 4)[0]);
  eq("a new head never joins stale tail parts",
     joinImageSlot([newerHead, decoded[1], decoded[2]]).status === "waiting");
}

console.log("protocol model — crop, sync, Uncrop, then crop again:");
{
  const server = makeServer();
  const B = makeDevice();
  B.assets.img1 = { id:"img1", kind:"image", blob:null, orig:null };

  upsert(server, imageSlotChunks("img1", "blob", "ORIGINAL-IMAGE", 100, "A", 4));
  upsert(server, imageSlotChunks("img1", "orig", null, 100, "A", 4));
  applyImageRows(B, allRows(server));
  eq("initial sync restores display bytes", B.assets.img1.blob === "ORIGINAL-IMAGE");
  eq("initial no-orig tombstone leaves orig clear", B.assets.img1.orig === null);

  upsert(server, imageSlotChunks("img1", "blob", "CROP", 200, "A", 4));
  upsert(server, imageSlotChunks("img1", "orig", "ORIGINAL-IMAGE", 200, "A", 4));
  applyImageRows(B, allRows(server));
  eq("crop sync restores the cropped display slot", B.assets.img1.blob === "CROP");
  eq("crop sync also restores pristine Uncrop bytes", B.assets.img1.orig === "ORIGINAL-IMAGE");

  /* Uncrop pushes restored display bytes plus a fixed orig-head tombstone.
     Old orig tail rows remain physically on the server and are harmless. */
  upsert(server, imageSlotChunks("img1", "blob", "ORIGINAL-IMAGE", 300, "A", 4));
  upsert(server, imageSlotChunks("img1", "orig", null, 300, "A", 4));
  applyImageRows(B, allRows(server));
  eq("Uncrop sync restores display bytes", B.assets.img1.blob === "ORIGINAL-IMAGE");
  eq("orig tombstone forcibly clears stale local pristine bytes", B.assets.img1.orig === null);

  upsert(server, imageSlotChunks("img1", "blob", "CROP-2", 400, "A", 4));
  upsert(server, imageSlotChunks("img1", "orig", "ORIGINAL-IMAGE", 400, "A", 4));
  applyImageRows(B, allRows(server));
  eq("a later crop supersedes the tombstone", B.assets.img1.orig === "ORIGINAL-IMAGE");
  eq("a later crop has its own display bytes", B.assets.img1.blob === "CROP-2");
}

console.log("live index.html wiring — expected red before implementation:");
const liveChecks = [
  ["slot-aware chunk producer exists", /function imageSlotChunks\s*\(/],
  ["incoming rows are decoded into an explicit slot", /function decodeImageRow\s*\(/],
  ["slot assembly checks one authoritative generation", /function joinImageSlot\s*\(/],
  ["finishImage accepts an explicit byte slot", /function finishImage\s*\(\s*aid\s*,\s*slot\s*,/],
  ["byte-slot storage can force an orig clear", /function setSyncedImageSlot\s*\(/],
  ["push reads and transmits the orig bytes", /function attachImageBytes[\s\S]*?a\.orig[\s\S]*?imageSlotChunks/],
  ["the new protocol helpers are exported for pure tests", /imageSlotChunks\s*:\s*imageSlotChunks[\s\S]*?decodeImageRow\s*:\s*decodeImageRow[\s\S]*?joinImageSlot\s*:\s*joinImageSlot/]
];
liveChecks.forEach(([label, re]) => eq(label, re.test(html)));

console.log(bad ? "\n" + bad + " failed (expected until Claude implements orig sync)" : "\nall orig-sync checks passed");
process.exitCode = bad ? 1 : 0;
