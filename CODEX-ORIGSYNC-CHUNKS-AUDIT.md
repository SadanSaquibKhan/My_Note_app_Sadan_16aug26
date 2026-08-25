# Codex audit: image original-byte sync, b174–b176 closure review, and Chunks recon

Date: 2026-08-25

Snapshot: this audit started on b177 and was re-checked after Claude's parallel b178 landed. b178 changes Working-sheet state/place handling and does not close or alter the findings below. The exact b178 function anchors are listed in section 4.1; re-grep by function name after any later build.

Scope: diagnosis, forward tests, and implementation guidance only. Codex did not edit `index.html` or `sw.js`, did not bump the build, and ran no Git commands.

## Executive verdict

- Syncing only `asset.blob` is insufficient: a crop reaches another device, but the pristine `asset.orig` needed by Uncrop does not (`index.html:6063-6118`, `index.html:20775-20880`).
- Sync `orig` by default. Only cropped pictures have a second byte slot, pictures are already limited to about 1600 px, and Uncrop is a promised user-visible operation. This is not comparable to multi-gigabyte audio, which is correctly omitted from daily backup.
- Of the ten requested old findings, four are closed, six are only partial, and one new high-severity attachment-owner bug was found.
- Chunks can be added safely as a browsing layer, but only after order/address are separated from page titles and topology changes are made chip-drag-safe.

## 1. Two-slot image-byte sync design

### 1.1 Current root cause

`stripBlobs` removes both `blob` and `orig` from the light asset row (`index.html:6063-6071`), while `imageDataChunks` produces rows only for one unnamed byte stream (`index.html:6077-6097`). On pull, `finishImage` has one accumulator key and always writes the result to `a.blob` (`index.html:20783-20803`); on push, `attachImageBytes` reads only `a.blob` (`index.html:20863-20880`). Therefore the other device can display a crop but cannot Uncrop it.

### 1.2 Recommended wire format

| Slot/state | `store` | Row ID | Required body | Compatibility |
|---|---|---|---|---|
| Display bytes (`blob`) | `imgdata` | existing `${assetId}:${i}` | `assetId`, `ownerId`, `slot:"blob"`, `i`, `n`, `present:true`, `rev`, `data` | Old clients continue to understand these rows. |
| Pristine bytes (`orig`) | `imgdata` | `:orig:${encodeURIComponent(assetId)}:${i}` | `ownerId`, `slot:"orig"`, `i`, `n`, `present:true`, `rev`, `data`; deliberately no `assetId` | b177/b178 compute `incoming.assetId || row.id.split(":")[0]`; the leading colon produces an empty ID, so pre-orig clients safely ignore the row instead of corrupting `blob`. |
| Cleared pristine slot | `imgdata` | fixed head `:orig:${encodeURIComponent(assetId)}:0` | `ownerId`, `slot:"orig"`, `i:0`, `n:0`, `present:false`, `rev`; row `deleted:1` | One authoritative head tombstone invalidates all old higher-index orig rows. |

Margin creates image IDs with `newId("img")`, yielding `img_…` (`index.html:2969-2981`). That grammar cannot collide with the reserved leading-colon orig namespace. Imported legacy IDs should be normalised or rejected if they begin with `:orig:`; no string namespace can be mathematically collision-free if arbitrary imported IDs are allowed to impersonate reserved protocol IDs.

Keep every old `${assetId}:${i}` blob ID unchanged. Renaming those rows would require a server migration and would strand bytes already uploaded.

### 1.3 Generation rule

Every part of one slot upload must carry the same `rev`, recommended as `${updatedAt}@${deviceId}` (or a stronger per-edit token stored on the asset). Index zero is the authoritative generation header. Assemble only indexes `0..n-1` whose `rev`, `n`, slot, and owner all match the head. Ignore stale indexes beyond `n`; refuse to assemble a missing or mixed generation.

This prevents a short new crop from joining old tail chunks. It also converts concurrent/equal-time ambiguity into a safe incomplete image rather than silently assembling corrupt bytes. The sync server is not in this repo, so Claude must verify its equal-`updated_at` upsert rule; if equal clocks do not have a deterministic winner, use a strictly unique revision and make retries re-publish one complete generation.

### 1.4 Smallest complete push changes

1. Replace or extend `imageDataChunks` with a slot-aware producer, suggested name `imageSlotChunks(assetId, slot, data, updatedAt, device, chunk, rev)`.
2. Keep `blob` rows backward-compatible. New `orig` rows must omit body `assetId` so b177 ignores them.
3. In `attachImageBytes` (`index.html:20863-20880`), load both `a.blob` and `a.orig`. Emit present rows for both slots when present.
4. Whenever a live image has no `orig`, emit the fixed orig-head tombstone. This is required after Uncrop (`index.html:14441-14448`) and is harmless for an image never cropped.
5. Add a one-time local `syncOrigBytesRev` migration that calls the existing image resend/bump path. Otherwise images cropped by an older build will not be considered changed and their existing `orig` will never leave that device.
6. Deleted image assets still use the asset tombstone; no blob/orig upload is required after asset deletion.

### 1.5 Smallest complete pull changes

1. Add a decoder, suggested name `decodeImageRow`, that maps old no-slot `${assetId}:${i}` rows to slot `blob` and understands the new orig namespace.
2. Group rows by the pair `(ownerId, slot)`, never by asset ID alone (`index.html:20820-20827`).
3. Keep independent durable accumulators: `syncImg:${encodeURIComponent(aid)}:blob` and `syncImg:${encodeURIComponent(aid)}:orig`. Import the old `syncImg:${aid}` accumulator into `blob` once, then clear the old key.
4. Make `finishImage(aid, slot, more)` assemble one slot with the head-generation rule. Call it for both slots after an asset shell arrives and after grouped byte rows arrive.
5. Add a byte-specific write helper, suggested name `setSyncedImageSlot`. It must write exactly `asset[slot] = blobOrNull` without touching the record clock.
6. Do not clear `orig` through `putSynced`. `putSynced` calls `keepLocalBytes` (`index.html:6168-6191`), and `keepLocalBytes` intentionally restores a local `orig` when an incoming light row lacks it (`index.html:5738-5755`). That protection is correct for light rows but wrong for an explicit orig tombstone.
7. Deduplicate `assetHits`; repeated slot completions should not cause repeated hydration work.

### 1.6 Tombstone semantics

The client cannot know how many stale orig tail rows exist on the server. Do not require one tombstone per physical tail. The fixed index-zero tombstone is the logical tombstone for the entire slot: a receiver seeing it clears `asset.orig`, discards its pending orig accumulator, and ignores all older/stale higher indexes. Later recropping overwrites that same head with a newer present generation.

Absence is not a tombstone. An old client that sends only blob rows must not clear a newer client's orig. Only the explicit orig-head tombstone clears it.

### 1.7 End-to-end state transitions

| User action on A | Rows A sends | Required state on B |
|---|---|---|
| Insert image | blob generation + orig tombstone | `blob=inserted`, `orig=null` |
| Crop | cropped blob generation + pristine orig generation | `blob=crop`, `orig=pristine` |
| Uncrop | restored blob generation + newer orig tombstone | `blob=pristine`, `orig=null` even if B had stale orig |
| Crop again | new cropped blob + new pristine orig | New present orig supersedes the old tombstone |

## 2. Requested old-finding closure audit

The following table is intentionally one row per requested finding.

| Finding | Status at b177 | Exact mechanism and smallest remaining fix |
|---|---|---|
| **P0-1 migration repair** | **PARTIAL — still P0** | Same-ID rows are now examined and missing fields/maps are repaired (`migrateWorkingToNotes`, `index.html:4899-4957`; `repairMigratedWorking`, `index.html:4977-4993`; `repairMigratedInk`, `index.html:4997-5013`). However both repairs call `touch`, so an offline device can stamp stale HTML/ink with a newer clock and beat a genuinely newer device under whole-record LWW (`sync-client.js:116-122`). Preserve the old clock locally, mark a local pending repair, and after the next pull apply only still-missing repair fields to the current winner before stamping once for push. Verify equal-clock tombstones and a deliberately blank newer ink asset. |
| **P0-2 purge resurrection/cascade** | **CLOSED** | `purge` now deletes each legacy Working row by primary key `pr.delete(id)` and cascades only assets by `by_note` (`index.html:5557-5580`); notebook purge already supplies all child IDs. |
| **P1-3 image ownership in Working** | **CLOSED for images; sibling attachment defect OPEN** | `activeNoteId` selects `prac.rec.id` and `insertImageFile` uses it (`index.html:13894`, `index.html:13924-13933`). But `attachFile` owns the asset with `activeNoteId` and still inserts/hydrates `.filechip` only in `#body`; use `activeTextHost`, host-scoped selection/hydration, and the active sheet save path. |
| **P1-5 duplicate Working pins** | **CLOSED** | `duplicateNote` builds `pinMap` and rewrites exact `data-pracid` values (`index.html:5340-5349`); `duplicateNotebook` does the same through `idMap` (`index.html:5414-5450`). |
| **P1-6 duplicate Cover metadata** | **CLOSED** | A page copy starts from the full source and deep-copies Covers (`index.html:5294-5311`); notebook duplication remaps internal Cover note IDs and preserves external references (`index.html:5436-5459`). |
| **P1-7 cross-notebook Relink** | **PARTIAL — P1** | Relink now repairs `worksFor`, notebook, drawer section, order/title and creates the target pin (`relinkWorkingHere`, `index.html:10054-10077`), but it never removes the old parent's `data-pracid` pin. Load both parent records, remove the exact old pin, add/update the target pin, and save child plus both parents as one coordinated operation; missing/deleted old parent must not block the move. |
| **P2-9 partial export twins** | **PARTIAL** | `exportNotebook` suppresses a legacy row only when the represented child ID is in the notebook-local `ids` map (`index.html:5810-5834`). After cross-notebook Relink, exporting the old parent notebook can carry the stale legacy row because the current child lives elsewhere. Build `allNoteIds` from all notes and use `ids[p.noteId] && !allNoteIds[p.id]`. |
| **P2-10 search duplicates** | **PARTIAL** | Default search now excludes drawer pages and Include Working reads migrated notes, not legacy rows (`index.html:4436-4480`), but `isDrawerPage` also hides Summary/short-note pages, contrary to the plan that short notes are searchable. A Working hit stores the parent as `hit.note`, so clicking it opens the parent instead of the matching sheet (`index.html:4474-4476`, `index.html:6871-6902`). Exclude Working specifically, include Summary normally, retain both `working` and `parent` IDs, and open the matching sheet. |
| **P2-11 Working browser order** | **PARTIAL** | `practiceAll` now uses actual section/page order within each notebook (`index.html:4494-4544`), but ranks restart at zero per notebook and the comparator has no notebook key, so pages from different notebooks interleave; a deleted-but-still-present parent is not treated as orphan. Compare notebook order/ID first, then parent rank and `workOrder`, and classify `!live(parent)` as orphan. |
| **P2-12 section name suggestion** | **CLOSED** | `suggestSectionName` now calls `ordinarySections` before choosing the next number (`index.html:4089-4102`). Separate low-risk caveat: `sectionNumber` extracts any digits from a custom title such as “VLSI 2026,” which can produce `Sec2027`; do not reuse that parser for Chunk addresses. |

### 2.1 Adversarial repros for remaining high-risk items

- **Repair/LWW race:** Device A edits the migrated page and syncs. Device B remains offline with older HTML, boots the repair build later, copies one missing legacy field, calls `touch`, then syncs. B's stale full record now has the newest clock and overwrites A. Repeat with exact-equal legacy/note clocks and with a newer intentionally blank ink asset.
- **Relink pin:** Create a Working page on notebook A/page 1, Relink it to notebook B/page 2, then return to or restore A/page 1. The stale pin still names the moved child.
- **Partial export:** Relink the Working child from A to B, export A alone, import into a clean profile, and observe whether A's legacy practice row recreates the stale child.
- **Cross-notebook Working order:** Put parent page 1 and one used sheet in two notebooks with reversed notebook order. The browser comparator ties both parent ranks at zero and uses only `workOrder`, so the result is not grouped deterministically.
- **Working attachment:** Open Working, attach a non-image file, then duplicate/delete parent and child separately. The asset owner and serialized `.filechip` live on different pages.

### 2.2 Search-caller audit

`C.search` is called by the global search path (`index.html:10476`). The quick switcher and link picker call `C.allNotes` directly (`index.html:10333-10352`, `index.html:13264-13284`), backlinks call `allNotes` directly (`index.html:4605`), and local find/replace scans the mounted body. Therefore the current search change did not accidentally remove Working from those independent callers; the real regressions are hidden Summary results and a Working hit that cannot navigate to its matching sheet.

## 3. Chunks recon: Section → Chunk → Page

Design boundary: Chunks are a browsing layer. Do not rename old titles, do not mass-renumber pages, and do not use the computed address as identity. IDs remain the durable targets for links, Covers, bookmarks, undo locations, sync, and Working pins.

### 3.1 Breakage and migration table

| Area | Current coupling / breakage point | Smallest safe Chunks change | Required regression test |
|---|---|---|---|
| IndexedDB schema | Notes have `sectionId` only; schema/version and stores are around `index.html:2958-3026`. | Add a `chunks` store with stable ID, notebookId, sectionId, title, startedAt/date, order, clocks and tombstone; add optional `note.chunkId`. Index chunks by section and notebook. | Upgrade a large legacy DB; note count, IDs, HTML, assets, sections, and titles are byte-for-byte unchanged. |
| Legacy pages | A section currently has no chunk concept. | Treat `chunkId:null` as one virtual “Earlier pages” chunk. If a section has no explicit chunks, that virtual chunk is the sole chunk; after the first explicit chunk it remains visible for old pages. | Add first explicit chunk to a legacy section and prove no page disappears. |
| Page order | `sortPages`, `suggestPageTitle`, `insertPageAfter`, and renumber tools derive order from titles (`index.html:3808-3855`, `index.html:4403-4435`). | Add stable page order independent of title. For untouched legacy rows, fall back to the current `sortPages` result; assign an order only when a page is inserted/moved, avoiding a mass migration write. | Rename a page arbitrarily, insert/move around it, and prove order and title are both preserved. |
| Address | `SxPy` is embedded in `title` and repair tools rewrite it. | Compute `S2C4P5` from ordinary-section order, chunk order, and page order. Expose it as a derived `address` field/view; a cached value, if stored, is disposable and recomputed. Never use it as a foreign key. | Move page across chunks/sections: address changes, title and every ID link do not. |
| New-session offer | No chunk session state exists. | When a new ordinary page is created, compare with the most recently created ordinary page in that section. If the gap is about four hours, show a quiet offer. Use `createdAt`/chunk `startedAt`, not `lastEdited`, because editing an old page is not a new class/session. | Edit yesterday's page, then add a page: no false session offer; add after a real 4h gap: offer appears once. |
| Accepting an offer | `createNote` accepts only notebook/title/section (`index.html:4347-4358`). | Acceptance creates one chunk and assigns the just-created page; remember that active chunk for subsequent new pages in that section. Declining leaves the page in the current/implicit chunk. | Accept, decline, reload, and create further pages in two sections. |
| Section/Chunk deletion | `deleteSection` knows notes but no chunks (`index.html:4295+`). | Removing a chunk must preserve its pages by setting `chunkId:null` or moving them to a chosen chunk. Section/notebook trash, restore, expiry, and purge must include chunk records without deleting page data. | Delete/restore/purge chunk, section, notebook; no orphaned invisible page. |
| Page move | Move UI patches only `sectionId` (`index.html:8241-8268`). | Same-section move can choose/keep a chunk; cross-section move clears `chunkId` unless a target chunk is explicitly chosen. Do not rewrite title. | Move between chunks, sections, and notebooks; undo/redo as one operation. |
| Duplication | `duplicateNote`/`duplicateNotebook` clone section topology only (`index.html:5278+`, `index.html:5391+`). | Same-notebook page copy may keep chunk; cross-notebook copy clears it. Notebook copy clones chunks first, maps old→new chunk IDs, then maps each ordinary page. Drawer pages have no chunk. | Duplicate page/notebook containing legacy, explicit chunks, Working, and Summary pages. |
| Sync | `SYNC_STORES` and pull `storeOrd` omit chunks (`index.html:6067`, `index.html:20835`). | Sync chunks before notes. A note whose chunk row has not arrived yet must remain pending/implicit, not have `chunkId` erased. Defer visible topology refresh while a chip drag is active, then refresh once on release. | Deliver note before chunk, chunk before note, deletion, equal clocks, and topology updates during drag. |
| Export/import | FORMAT 8 bundle paths contain sections but no chunks (`index.html:5764-6054`). | Bump format; include chunks in full/partial export, preview, validation, normalisation, merge and orphan repair. Old files with no chunks import into virtual legacy chunks. | Round-trip mixed legacy/explicit chunks and partial notebook export. |
| Search/bookmarks/links | Search knows notes/sections; links and Covers use note IDs. | Search chunk title/date and show address separately. Keep note IDs/anchors in links, Covers, bookmarks, undo and Working pins; never store `S2C4P5` as target identity. | Rename/reorder section/chunk/page and prove every saved link still opens the same page. |
| Side panel | Current panes are Notebooks, Sections, Pages (`index.html:1899-1968`), with state/toggles at `index.html:6306-6313` and `index.html:6676+`. | Default open-notebook layout becomes Sections \| Chunks \| Pages. Keep notebooks available through Home/tabs/Open and optional `railTog`, preferably as an overlay/replacement so four columns never squeeze the page. Add chunk selection, width memory, collapse/lock, and last-page-per-chunk. | Collapse/resize/lock every pane, rotate tablet, reload, switch sections and chunks. |
| Blue/grey chips | Blue is section and grey is whole notebook; lists are selected at pointerdown (`index.html:16930-17084`, `index.html:17528-17540`). | Blue list becomes current chunk; grey becomes current section; remove whole-notebook chip UI only. Keep notebook-wide `pageOrder` for finger continuous scrolling across chunk/section boundaries. | Both directions, first/last chunk, first/last section, unequal flexible page heights, cold/warm previews. |
| Boundary visuals | Continuous scroll currently marks page joins only. | Add thin, non-layout-changing chunk/section labels to the existing join band. They must not alter preview/live page height or scroll anchors. | Cross each boundary by finger, wheel, S Pen pan, blue chip, and grey chip without a jump. |
| Working/Summary drawers | `isDrawerPage` and drawer sections deliberately stay outside ordinary numbering. | Drawer pages get no `chunkId`. Working displays its parent's derived address; Summary Covers continue to point by page ID. | Add/move chunks and prove drawers never enter chunk/page counts. |
| Undo/view history | Location metadata currently includes section/page, not chunk. | Structural chunk create/move/delete is one undoable operation; saved places include chunk ID as context but page ID remains authoritative. | Undo/redo a cross-chunk move and land at the changed page/location. |

### 3.2 Direct answer: `workingName()` and migration

`workingName` currently parses the parent's title (`index.html:4819-4829`). Replace that dependency with `addressFor(parent)` and generate the display default `${address}w${index+1}`, for example `S2C4P5w1`.

Do not rename existing Working records during migration. Preserve their stored/custom title exactly. In lists and on the sheet, display the current computed parent address plus `wN`; future automatically created sheets may store the new default. Existing pins and relationships use note IDs, so leaving old titles untouched does not break navigation.

### 3.3 Direct answer: `CHIP_STICK` when the blue list becomes a chunk

The merged plan's 22% warning is stale. Live b177 uses `CHIP_STICK = 0.06` and `pageStick = max(0.012, pageShare * 0.06)` (`index.html:17147-17170`), pinned by `tests/joinflaw.mjs:61-62`, `tests/chips.mjs:182-184`, and `tests/scrollsim.mjs:36`.

Keep 6% of the current page's share for the first implementation. It already scales with page height and list scope, so a five-page chunk does not require a new percentage. The only later improvement worth testing is replacing the normalised `0.012` floor with an approximately 6–10 physical-pixel floor derived from track height; do not restore a whole-list percentage. Also correct the stale 22% comment when app code is next edited.

### 3.4 Direct answer: moving a page while a chip is being dragged

`wireNavChip` snapshots `chipDrag.list` on pointerdown (`index.html:17528-17540`). A page/chunk move or sync topology update during the drag leaves that list stale: target fraction, label, stick band, and release target can refer to different topology. Sync already writes rows while `userBusy` is true but simply skips `refreshLists` (`index.html:20973-20987`), with no guaranteed deferred refresh afterward.

Smallest safe rule: increment a topology revision for page/chunk/section structural changes; defer pulled topology application or at least visible adoption while dragging; on release/cancel, settle the mounted page by stable note ID, discard the snapshot, rebuild both lists once, and repaint. Local move/delete should first cancel/settle an active drag. Never mutate `chipDrag.list` in place. If the final target ID no longer belongs to the rebuilt scope, stay on the mounted page rather than jumping to an index.

## 4. New forward test

`tests/origsync.mjs` was added. Its protocol-model checks pass. Its seven live-wiring checks intentionally fail on b178 because this task forbids app-code changes; Claude should make those seven checks green while preserving the model checks.

Observed command: `node tests/origsync.mjs index.html`.

- Protocol-model checks: 18 passed, 0 failed.
- Live b178 wiring checks: 0 passed, 7 failed (expected before implementation).
- Overall exit code: 1 (expected forward-test red).

The older `tests/cropsync.mjs`, `tests/syncpics.mjs`, `tests/working.mjs`, and `tests/drawers.mjs` all exit 0 on b178. This is useful evidence: the existing green suites do not cover pristine `orig` transfer, forced clearing after Uncrop, cross-notebook repair ordering, or the other adversarial cases above.

### 4.1 Exact final b178 line anchors

- Build: `index.html:2969`.
- Image sync/storage: `keepLocalBytes` 5744; `stripBlobs` 6069; `imageDataChunks` 6083; `joinImageData` 6105; `putSynced` 6177; `finishImage` 20809; pull `storeOrd` 20835; `attachImageBytes` 20889; sync `userBusy` 20973.
- Old-finding review: `suggestSectionName` 4089; `search` 4442; `practiceAll` 4494; `migrateWorkingToNotes` 4905; `repairMigratedWorking` 4983 (`touch(note)` 4998); `repairMigratedInk` 5003 (`touch(asset)` 5018); `duplicateNote` 5284; `duplicateNotebook` 5391; `purge` 5557 (`pr.delete(id)` 5575); `exportNotebook` 5816; `relinkWorkingHere` 10054; `activeNoteId` 13920; `insertImageFile` 13924; `attachFile` 16011.
- Chunks/chips: panel markup 1899/1957/1968; current chips 2922-2923; `sectionNumber` 3782; `planSecPageNames` 3808; `sortPages` 3843; `createNote` 4347; `suggestPageTitle` 4403; `insertPageAfter` 4421; `workingName` 4819; state 6306; `applyPanes` 6676; `paintSections` 6754; `sectionPageList` 16930; `CHIP_STICK` 17158; `wireNavChip` 17528; `SYNC_STORES` 6067.

## 5. Implementation order for Claude

1. Fix the P0 repair/LWW race before allowing the repair pass to stamp/push records.
2. Implement two-slot image byte sync and make `tests/origsync.mjs` green; verify server equal-clock/upsert behavior.
3. Fix stale Relink source pins and Working attachment host/owner mismatch.
4. Fix partial-export, Summary search/navigation, and cross-notebook Working ordering.
5. Build Chunks only after stable order/address helpers and topology-revision rules exist.

## Full contents of `tests/origsync.mjs`

The exact added test file follows.

```js
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
```

index.html untouched: yes. sw.js untouched: yes. No git commands run: yes.
