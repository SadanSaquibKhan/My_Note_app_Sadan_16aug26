/* Pictures on sync: bytes travel in small chunks, a missing slot must not
   eat a picture you just placed, and a light pull must not wipe local bytes.

   Run: node tests/syncpics.mjs index.html
*/
import fs from "fs";
const html = fs.readFileSync(process.argv[2], "utf8");

let bad = 0;
const eq = (l, c) => { console.log((c ? "  ok   " : "  FAIL ") + l); if (!c) bad++; };
const has = re => re.test(html);

function grab(name){
  const m = html.match(new RegExp("\\n  function " + name + "\\([\\s\\S]*?\\n  \\}"));
  if (!m) { console.log("MISSING " + name); process.exit(1); }
  return m[0];
}

console.log("bytes travel, audio still does not:");
eq("pictures are split into imgdata rows", has(/store: "imgdata"/) && has(/function imageDataChunks/));
eq("chunks are glued back on pull", has(/function joinImageData/));
eq("only image assets get bytes attached, not audio",
   has(/a\.kind !== "image"/) || has(/a\.kind === "image"/));
eq("a once-only bump re-sends pictures that went as empty slots",
   has(/syncBytesRev/) && has(/bumpImagesForSync/));
eq("imgdata is not an IndexedDB store (existing worker table is enough)",
   has(/row\.store === "imgdata"/) && !/createObjectStore\("imgdata"/.test(html));

{
  const src = ["imageDataChunks", "joinImageData", "keepLocalBytes"].map(grab).join("\n");
  const A = new Function(src + "\n return { imageDataChunks, joinImageData, keepLocalBytes };")();
  const parts = A.imageDataChunks("img_1", "ABCDEFGHIJ", 9, "dev", 4);
  eq("a short picture becomes several small rows", parts.length === 3);
  eq("each row names the picture", parts.every(p => p.store === "imgdata" && p.body.assetId === "img_1"));
  eq("gluing the rows gives the original bytes",
     A.joinImageData(parts.map(p => p.body)) === "ABCDEFGHIJ");
  eq("a missing middle chunk refuses to glue",
     A.joinImageData([parts[0].body, parts[2].body]) === "");

  const kept = A.keepLocalBytes(
    { blob: "LOCAL-PIC", orig: "LOCAL-ORIG" },
    { blob: {}, orig: {}, lastEdited: 99 }
  );
  eq("an empty {} from JSON.stringify of a Blob does not wipe local bytes",
     kept.blob === "LOCAL-PIC" && kept.orig === "LOCAL-ORIG");
}

console.log("a missing slot must not eat the next picture:");
eq("hydrate does not replace the figure with plain missing text",
   !/fig\.textContent = "This picture is missing\."/.test(html));
eq("missing is a label inside the figure", /miss\.className = "miss"/.test(html));
eq("nested figures are lifted out before the figure is rewritten",
   has(/function unnestImageFigures/) && has(/unnestImageFigures\(fig\)/));
eq("inserting next to a missing picture does not nest inside it",
   has(/el\.closest\("figure\.imgblock"\)/) &&
   has(/wrap\.parentNode\.insertBefore\(fig, wrap\.nextSibling\)/));

console.log("pull applies picture bytes without a worker change:");
eq("imgdata rows are collected, not written to a missing store",
   has(/if \(row\.store === "imgdata"\)/));
eq("a later hydrate runs when only the picture bytes arrived",
   has(/info\.assets && info\.assets\.length/) && has(/hydrateImages\(\)/));
eq("push sends pictures in small batches", has(/function pushRecordBatches/));

if (bad) console.log("\n" + bad + " failed");
process.exitCode = bad ? 1 : 0;
