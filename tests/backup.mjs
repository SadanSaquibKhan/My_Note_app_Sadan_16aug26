/* Audio-less backup — the 15GB crash was exportBundle base64-encoding every
   class recording into one JSON file. A notes backup must skip those bytes,
   keep handwriting and pictures, and a restore must not wipe audio this
   device already has.

   Run: node tests/backup.mjs index.html
*/
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };

function grab(name){
  const m = html.match(new RegExp("\\n  function " + name + "\\([\\s\\S]*?\\n  \\}"));
  if (!m) { console.log("MISSING " + name); process.exit(1); }
  return m[0];
}

const src = ["packAssetForExport", "bundleJsonParts", "keepLocalBytes"]
  .map(grab).join("\n");
const A = new Function(src + "\n return { packAssetForExport, bundleJsonParts, keepLocalBytes };")();

console.log("packAssetForExport:");
{
  const audio = {
    id: "aud1", kind: "audio", noteId: "nt1",
    startedAt: 1000, dur: 3600,
    pages: [{ at: 1000, noteId: "nt1" }],
    blob: { fake: "huge" }, orig: null, lastEdited: 9
  };
  const packed = A.packAssetForExport(audio, "data:audio/webm;base64,AAAA", null, true);
  eq("skipped audio has no data URL", packed.data == null && packed.origData == null);
  eq("skipped audio is flagged omitted", packed.blobOmitted === true);
  eq("skipped audio still has duration and page track",
     packed.dur === 3600 && packed.pages.length === 1 && packed.noteId === "nt1");
  eq("skipped audio never carries the blob", packed.blob == null && packed.orig == null);
  eq("id survives", packed.id === "aud1");

  const img = {
    id: "img1", kind: "image", noteId: "nt1", w: 800, h: 600,
    blob: { fake: 1 }, orig: { fake: 2 }, pct: 70
  };
  const imgPacked = A.packAssetForExport(img, "data:image/png;base64,ii", "data:image/png;base64,orig", false);
  eq("picture keeps encoded bytes", imgPacked.data === "data:image/png;base64,ii");
  eq("crop original keeps encoded bytes", imgPacked.origData === "data:image/png;base64,orig");
  eq("picture is not marked omitted", imgPacked.blobOmitted == null);
  eq("picture blob field is not in the file", imgPacked.blob == null && imgPacked.orig == null);

  const ink = {
    id: "ink1", kind: "page", noteId: "nt1",
    strokes: [{ id: "s1", t: 1, pts: [[0,0],[1,1]] }], h: 400
  };
  const inkPacked = A.packAssetForExport(ink, null, null, true);
  eq("handwriting strokes survive an audio-less pack",
     inkPacked.strokes && inkPacked.strokes[0].id === "s1");
  eq("ink is not marked omitted", inkPacked.blobOmitted == null);
}

console.log("bundleJsonParts (streamed, not one giant stringify):");
{
  const b = {
    app: "margin", format: 8, schema: 4,
    exportedAt: 50, exportedBy: "tablet",
    audioOmitted: true,
    notebooks: [{ id: "nb1", name: "Chem" }],
    notes: [{ id: "nt1", title: "p1", html: "<p>hi</p>" }],
    practices: [],
    groups: [],
    sections: [{ id: "sc1", notebookId: "nb1", name: "sec0" }],
    meta: { dark: false },
    assets: [
      { id: "aud1", kind: "audio", dur: 10, blobOmitted: true },
      { id: "ink1", kind: "page", strokes: [{ id: "s1" }] }
    ]
  };
  const json = A.bundleJsonParts(b).join("");
  let parsed = null;
  try { parsed = JSON.parse(json); } catch (e) { parsed = null; }
  eq("parts join to valid JSON", !!parsed);
  eq("audioOmitted flag is in the file", parsed && parsed.audioOmitted === true);
  eq("notes and handwriting are in the file",
     parsed && parsed.notes[0].id === "nt1" && parsed.assets[1].strokes[0].id === "s1");
  eq("audio record is in the file without bytes",
     parsed && parsed.assets[0].id === "aud1" && parsed.assets[0].blobOmitted === true &&
     parsed.assets[0].data == null);
  eq("format stays 8", parsed && parsed.format === 8);
}

console.log("keepLocalBytes (restore must not wipe local audio):");
{
  const mine = { id: "aud1", kind: "audio", blob: "LOCAL-SOUND", orig: null };
  const incoming = { id: "aud1", kind: "audio", dur: 12, blob: null, lastEdited: 99 };
  const kept = A.keepLocalBytes(mine, incoming);
  eq("local sound is kept when the file left it out", kept.blob === "LOCAL-SOUND");
  eq("incoming metadata still applied", kept.dur === 12);

  const mineImg = { id: "img1", blob: "LOCAL-PIC", orig: "LOCAL-ORIG" };
  const incomingImg = { id: "img1", blob: "FILE-PIC", orig: null };
  const takeFile = A.keepLocalBytes(mineImg, incomingImg);
  eq("incoming picture bytes win when the file actually has them", takeFile.blob === "FILE-PIC");
  eq("local crop original is kept if the file has none", takeFile.orig === "LOCAL-ORIG");

  const both = A.keepLocalBytes(
    { blob: "A", orig: "B" },
    { blob: "C", orig: "D" }
  );
  eq("both sides having bytes keeps the file's copy", both.blob === "C" && both.orig === "D");
}

console.log("wiring in the app:");
eq("Save notes is the primary Data button",
   /id="exportBtn">Save notes \(no recordings\)</.test(html));
eq("full-with-recordings button exists",
   /id="exportFullBtn">Save everything including recordings</.test(html));
eq("daily backup nudge still clicks the notes backup",
   /backupNow"\)\.addEventListener\("click"[\s\S]{0,180}exportBtn"\)\.click\(\)/.test(html));
eq("notes backup calls skipAudio true",
   /exportBtn"\)\.addEventListener\("click"[\s\S]{0,220}exportBundle\(\{ skipAudio: true \}\)/.test(html));
eq("full backup encodes recordings",
   /exportFullBtn"\)\.addEventListener\("click"[\s\S]{0,220}exportBundle\(\{ skipAudio: false \}\)/.test(html));
eq("notes backup is downloaded as a Blob, not JSON.stringify of the whole thing",
   /exportBtn"\)\.addEventListener[\s\S]{0,400}bundleToFileBlob\(b\)/.test(html));
eq("import keeps local bytes on assets",
   /if \(i === 3\) x = keepLocalBytes\(mine, x\);/.test(html));
eq("missing audio does not crash play",
   /function playAudio\(asset, at\)\{[\s\S]{0,220}!asset \|\| !asset\.blob/.test(html));

const enc = grab("encodeAsset");
eq("encodeAsset exists", /function encodeAsset\(a, skipAudio\)/.test(enc));
eq("audio skip happens before any base64",
   enc.indexOf('a.kind === "audio"') < enc.indexOf("blobToData") &&
   enc.indexOf("packAssetForExport(a, null, null, true)") < enc.indexOf("blobToData"));
eq("FORMAT is still 8 (same backup schema, audio just omitted)",
   /var FORMAT\s*=\s*8;/.test(html));

if (bad) console.log("\n" + bad + " failed");
process.exitCode = bad ? 1 : 0;
