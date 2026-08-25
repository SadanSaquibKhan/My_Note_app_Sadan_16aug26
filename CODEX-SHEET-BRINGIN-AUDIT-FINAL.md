# Codex final audit: sheet states, dock tabs, and “Bring the page in here”

**Scope:** diagnosis and tests only. This report was checked against the live
**b176** source. Claude Code was editing the file concurrently, so the
**function name is the durable locator**; the line numbers are the b176 lines
visible during this audit.

## 1. Sheet states and dock tabs — dangerous findings first

| Severity | Line / function | What it does today | Smallest correct change | What breaks if missed |
|---|---|---|---|---|
| **P0** | `index.html:15668-15688`, `setStripState` | Every Strip state change executes `ink.active = "note"`. The comment says the Strip does not take the pen, but this assignment **does** take it away from an open working sheet. Resize also calls this path. | A read-only Strip must never assign `ink.active`. Leave the currently active surface unchanged. Opening/closing the editable bottom host, not the Strip, owns the pen transition. | Open a working sheet, then show/resize/expand the Strip: the next stroke or insertion can target the main page instead of the working page. This is already possible before dock tabs. |
| **P0** | `index.html:8503-8514`, `makeSurface.S.queueSave/S.flush`; `9686-9691`, practice `save`; `9772-9781`, `flushPractice`; `9862-9875`, `gotoPracPage` | Practice ink has a separate 600 ms `pracSurface.saveTimer`. `flushPractice` clears only `prac.saveTimer`, then a tab/page switch replaces `prac.rec` and the surface arrays. A late `S.flush()` reads the new `prac.rec.id` and whichever arrays are mounted then. | Put practice words and ink through one owner-bound flush. Before changing the mounted record: capture old page id + cloned HTML/ink, clear **both** timers, set surface dirty false, and await that packet’s save. Never let a delayed callback discover its owner from mutable `prac.rec`. | Draw on A and immediately switch A→B→A: the delayed save can write A’s ink to B, blank B, or save B’s loaded ink under the wrong owner. Silent data corruption. |
| **P0** | `index.html:9709-9748`, `openPractice`; `9851-9859`, `loadPracInk` | The editor becomes active at line 9739 before old ink finishes loading. `loadPracInk` later replaces all three live arrays. Its id/sequence guards reject a different page, but they do not protect strokes newly drawn on the correct page while its load is pending. | Keep the surface non-writable until guarded ink load finishes, or merge post-open strokes into the fetched set. The smaller and safer first build is an `inkReady` gate: load → verify epoch/id → install ink → enable practice drawing. | Open a sheet and write immediately on a slow tablet: the fresh stroke appears, then disappears permanently when IndexedDB resolves. |
| **P1** | `index.html:9684`, global `prac`; `15642-15644`, `stripState/stripNoteId` | One mutable object owns one list, index, record, state, timer and place; the Strip also remembers only one summary id. There is no named tab registry. | Store at most three descriptors such as `{id, kind, dock, pageId, sourceId, state, customHeight, folded, scrollTop, scrollLeft, used}` plus active tab id per physical host. Reuse the one physical working DOM/surface. | Switching tabs overwrites the previous tab’s identity and place; restart cannot reopen the same three tabs. |
| **P1** | `index.html:9709-9748`, `openPractice`; `9862-9875`, `gotoPracPage` | Neither path captures/restores `scrollTop` or `scrollLeft`. Both inject HTML, start image and ink loads without awaiting them, and never perform a post-layout restore. | Enforce the exact switch transaction described below. Restore only after HTML, images, ink and one layout settle, with an epoch/id guard after every await. | A tab reopens at the prior tab’s offset or at 0; restoring early is clamped against an empty short DOM and cannot recover after pictures increase height. |
| **P1** | `index.html:9752-9764`, `closePractice` | A 280 ms timer always hides the physical sheet and removes `.off`; it has no close generation/token. | Increment a host epoch on close and on every reopen/switch. The delayed hide runs only when its token is still current and the host is still closed. | Close A and quickly open B: A’s stale timer hides B after B has appeared. |
| **P1** | `index.html:6379-6383`, `flush` | `flushInk()` and `flushPractice()` are started but not returned or awaited. Callers awaiting `flush()` may navigate while those writes are still running. | Return one ordered promise. For the practice surface, call the owner-bound flush only once rather than racing generic `flushInk` against `flushPractice`. | Fast navigation/close/reload can outrun a working-sheet save; two read-modify-writes can complete out of order. |
| **P1** | `index.html:7127-7132`, `paintDoc` | Every main-page mount calls `closePractice()`. This closes the only physical host and currently throws away the visual session whenever the source page changes. | A main-page change may hide the host if that is the chosen UX, but it must not delete the dock-tab registry/place. If the selected tab is designed to stay visible, do not close it at all. | Named tabs cannot survive normal page navigation—the main purpose of the feature. |
| **P1** | `index.html:15208-15214`, `openPracticeById`; `9709-9720`, `openPractice(page)` | A stable id is converted back to an ordinal by searching only `practicePages(state.note.id)`. If it is absent, `i` remains 0 and the wrong sheet opens silently. | Load/open by the working page’s stable note id. Resolve its own `worksFor`/notebook, then derive sibling list and index for display only. Missing id must report missing, never fall back to page 0. | A persisted tab from another source page/notebook opens and edits the first working page of the current page. |
| **P1** | `index.html:13750-13806`, `hydrateImages` | One global call revokes all live image URLs, then hydrates both `#body` and `#pracText`; it has no tab/epoch ownership check. | Allow `hydrateImages(host, ownerId, epoch)` and keep URL pools per host/mount. Ignore stale completion. | A late A hydration can rewrite B’s mounted figures or revoke URLs the active tab still displays. |
| **P1** | `index.html:9784-9790`, `paintPracHead`; `9889-9895`, Add; `19124-19153`, Copy | Naming, adding and copying infer the parent from current `state.note`, not from the selected dock tab/working record. | Use the selected tab’s `sourceId` / `rec.worksFor`; load that parent explicitly. | Keep a tab open while moving the main note: `+ Page`, name and Copy can attach to the wrong source page. |
| **P1** | `index.html:11845`, global `lasso`; `13809`, global `pickedImage`; `13993`, global `crop`; `9862-9875`, switch path | Practice page replacement does not clear ephemeral lasso/image/crop state before replacing the host DOM. | Before replacing tab content, cancel pointer capture and clear/deselect lasso, image, crop and pending tap state belonging to the outgoing host. Persist content, not selection UI. | Handles/popups can target detached elements or act on the new tab using stale geometry. |
| **P2** | `index.html:1295`, `1469`, CSS; `9695-9701`, `setSnap`; `18359`, grip | A single `body[data-prac]` chooses one bottom-sheet state. Dragging invents a fifth global value, `free`; only the Tab button clears inline height. | Put `data-state` and `data-dock` on each physical sheet host. Keep a dragged pixel height in the active tab record (as a Half-size override), and clear/replace it whenever a named state is selected. | Top and bottom docks cannot coexist without selector combinations; Half/Full can appear to do nothing because old inline height wins. |
| **P2** | `index.html:18349-18364`, grip resize | Uses full `window.innerHeight`, stores nothing per tab, and handles only pointerup—not pointercancel/lost capture. | Clamp to the dock’s available viewport, persist the active tab’s custom height, and end on pointerup, pointercancel and lostpointercapture. | A cancelled drag leaves resize armed; a tab inherits another tab’s height; top+bottom docks can cover the whole page. |
| **P2** | `index.html:15642-15644`, Strip states; `15668-15677`, hide | The top Strip has only hidden/strip/half. Hide is immediate; there is no read-only Full state or upward close animation. | If the four-size product requirement still applies to summaries, add a read-only Full size and an upward off transition. Do **not** add a third writable surface. | The four-state UI/spec remains incomplete, but note data is not at risk. |

### Direct answer 1 — replace `body[data-prac]` without a CSS matrix

Use state on the **two physical hosts**, not on `body` and not on each tab id:

```text
#sstrip[data-dock="top"][data-state="hidden|strip|half|full"]
#pracSheet[data-dock="bottom"][data-state="hidden|strip|half|full"]
```

The three tab descriptors live only in JavaScript/IndexedDB metadata. CSS sees
one active top host and one active bottom host, so adding a fourth kind or a
third tab does not multiply selectors. A custom dragged height is data on that
tab, not a new global state.

### Direct answer 2 — exact scroll-restore ordering

Enforce this inside the single tab-switch/open transaction used by
`openPractice`, `gotoPracPage`, persisted-tab restore and tab clicks:

1. Increment the switch epoch and capture outgoing `scrollTop/scrollLeft`.
2. Capture outgoing owner id + cloned HTML/ink; cancel both save timers; await
   that captured save.
3. Abort if a newer epoch won.
4. Clear outgoing lasso/image/crop UI; install the selected record and blank
   the physical surface.
5. Inject HTML and apply its page height/template.
6. Await layout-changing hydration and guarded ink load. Do not enable drawing
   until ink is installed.
7. Wait one real-browser layout settle (`requestAnimationFrame`, or the
   ResizeObserver completion used by production code).
8. Recheck epoch + active tab/page id.
9. Set `scrollLeft`, then `scrollTop`, then redraw the canvas.

Restoring between steps 4 and 6 is wrong: an empty 600 px host clamps a saved
700 px place to 0/50, and image hydration does not later put it back.

### Direct answer 3 — one or two state machines?

Keep **two controllers/renderers**:

- the top Strip is read-only, follows the main page and owns no save/ink;
- the bottom working host is editable and owns async save/load and the one
  practice surface.

Share only pure pieces: the four state names, pixel-height calculation, tab
descriptor/persistence helpers, close/switch epoch pattern, and viewport inset
reporting. One monolithic controller creates a kind × edge × writable × state
matrix and makes it easy for the Strip to steal the pen—the current P0 proves
that risk is real.

## 2. “Bring the page in here” — dangerous findings first

| Severity | Line / function | What it does today | Smallest correct change | What breaks if missed |
|---|---|---|---|---|
| **P0** | `index.html:14537-14549`, `fullInkImage` | The only full-height canvas uses `paper.scrollWidth/scrollHeight` (the three-band scroller, not one page) and draws only `noteSurface.strokes`. Typed DOM and inserted/PDF images are absent. | Add a dedicated `renderPageSnapshot(noteId, sourceRect)` at zoom 1. Render the source page DOM + its hydrated image assets first, then draw page ink on top, then crop the requested page-space rectangle. Do not call `fullInkImage`. | The snapshot is blank except handwriting and is vertically offset/oversized by neighbour bands. |
| **P0** | `index.html:9079-9086`, `wireSurface`; `15074-15128`, `armHold/openHoldMenu` | Hold is armed only for the main note (`S.name === "note"`). The menu assumes `state.note` and all coordinates/actions target the main page. | Arm a sheet-specific hold and pass a context object `{surface, host, ownerId, screenPoint, pagePoint}` into the menu/action. The Bring command belongs only in the working-sheet context. | Holding on the sheet either types/does nothing, or a future command inserts into/captures the wrong page. |
| **P1** | `index.html:6360-6371`, `serializeHost`; page/preview architecture | Any capture-band overlay placed inside `#body` is saved as note content; anything that changes `#paper` flow changes ink/page coordinates. | Put the dimmer, band choices and drag rectangle in a fixed sibling overlay outside `#body` and outside page flow. It may visually align to the page rect but must never be serialised. | Opening the chooser edits the note, inflates page height, or shifts saved ink coordinates. |
| **P1** | `index.html:17449-17476`, `usablePageViewport`; `17482-17485`, `pageTopBase`; `17501-17510`, `prevPad`; `16684`, `pageZoom`; `18765-18772`, page height | The required numbers exist, but Bring is not implemented. The old reference maths in `tests/bringin.mjs` ignores the b172 top inset. | Use the formula below; never use raw `paper.clientHeight` or `(scrollTop-prevPad)/zoom` while the Strip is open. | A “visible part” captured with a top Strip starts too high by exactly the Strip height; zoom and page joins crop the wrong region. |
| **P1** | `index.html:13660-13676`, `activeTextHost/activeNoteId` | b175 correctly fixed ordinary pictures/files so working-sheet assets belong to the active sheet. | Reuse these helpers for the snapshot owner and insertion host; after dock tabs, make them resolve the selected tab, not a mutable `ink.active` side effect. | Snapshot deletion/duplication/sync follows the parent main page instead of the sheet. |
| **P1** | `index.html:13673-13721`, `insertImageFile` | Ordinary image insertion is caret-flow based. A snapshot must land at the held page point and be selected immediately. | Build the normal `figure.imgblock`, but mark `data-free="1"`, set `data-x/data-y` from `pracSurface.toPage`, append to `pracText`, hydrate, call `applyImagePlace`, then `selectImage`. | The captured band appears at the caret/end, cannot be moved immediately, or the keyboard opens. |
| **P1** | `index.html:13750-13806`, `hydrateImages` | Live hydration owns one global URL pool and both live hosts. It is unsuitable for an offscreen compositor. | Give the compositor its own temporary image/data-URL pool and await every decode; revoke only that pool after rasterisation. | Live pictures disappear while capturing, or the raster happens before images decode. |
| **P1** | `index.html:4338-4347`, note revision; `5205-5212`, asset revision; `9337-9344`, note-ink save | Words touch the note; ink touches the page asset and then bumps the note. Sync can still deliver an asset independently, so note time alone is not fully honest. | Store/recompute the small revision vector described below, including source image asset revisions because pixels include them. | “Source changed” can miss an ink/image-only remote change or mark the wrong page. |
| **P1** | `index.html:5329-5345`, `cloneAsset`; `6029-6036`, `stripBlobs` | Good news: `cloneAsset` spreads every field and sync’s light row strips only `blob/orig`, so arbitrary `sourceRef` metadata survives copy/export/light sync. `tests/bringin.mjs` does not recognise this. | Keep source metadata as ordinary asset fields. Ensure the snapshot bytes use the normal image chunk path. No new relational store is needed. | Rebuilding assets field-by-field would drop future source fields; the current production helper already avoids it. |
| **P1** | Feature absent | There is no stale/missing-source runtime marker or manual refresh action. | On hydrate/selection, compare revision metadata only. Show `Source changed` or `Source missing` as a runtime overlay. Refresh only on explicit user action, replacing bytes/revision while keeping placement/crop policy clear. | Silent auto-refresh moves/replaces a snapshot the user annotated; source deletion could erase useful captured pixels. |
| **P2** | `index.html:491-504`, page/peek width and height; `1568-1571`, `--page-w/--page-h` | Live CSS already defines the exact page width/layout; `fullInkImage` ignores that and uses scroller dimensions. | Create the offscreen clone at the live page’s unzoomed width and `pageHeightOf(noteId)`, with the same page classes/template. Browser-test SVG `foreignObject`; if Samsung Chrome rejects it, vendor a DOM rasterizer rather than hand-drawing rich text. | Text wraps differently in snapshot than source, so bands and source rectangles do not match. |
| **P2** | Feature absent | No single undo unit exists for adding/removing/refreshing a snapshot. | Insert/delete as one document undo item. Manual refresh should be one replace-asset undo item; source pixels remain independent of source deletion. | User cannot undo a mistaken capture cleanly. |

### Direct answer 4 — existing render and the required compositor

The current path is `fullInkImage()` at **`index.html:14537-14549`**, called by
PNG and print. Print looks complete only because the browser separately prints
the live typed DOM/images and the ink-only `.printink`; there is no existing
canvas that already contains all three.

The smallest honest implementation is a new compositor:

1. Load the source note, its page-ink asset and every referenced image asset.
2. Clone/sanitise the page into an offscreen, fixed-width, zoom-1 page using
   the live template and CSS.
3. Replace image references with temporary data/blob URLs and await decode.
4. Rasterise that DOM (SVG `foreignObject` is the cheapest dependency-free
   attempt on Chrome; verify it on the tablet/browser).
5. Draw visible ink with existing `drawStroke` over the DOM raster.
6. Crop using the selected **page-space** rectangle and save that Blob as a
   normal image asset owned by the selected working tab.

### Direct answer 5 — exact visible-slice numbers/functions

- Previous-page band: **`prevPad()`**, `index.html:17501-17510`.
- Zoom: **`pageZoom()`**, `index.html:16684` (same value as `state.zoom`).
- Current page height: **`pageHeightOf(noteId)`**, `index.html:18765-18767`;
  `pageHeightFor` is the shared live/peek wrapper.
- Overlay-adjusted visible height/top: **`usablePageViewport()`**,
  `index.html:17449-17476`.
- Correct page origin: **`pageTopBase()`**, `index.html:17482-17485`, which is
  `prevPad() - topInset`.

For vertical visible capture:

```js
var v = usablePageViewport();
var z = pageZoom();
var H = pageHeightOf(sourceNoteId);
var y = Math.max(0, Math.min(H, (v.paper.scrollTop - pageTopBase()) / z));
var h = Math.max(0, Math.min(H - y, v.height / z));
```

Equivalent expanded `y` is
`(scrollTop - prevPad() + v.topInset) / z`. The `+ topInset` is the correction
missing from the current `tests/bringin.mjs` reference block.

### Direct answer 6 — cheapest honest source-changed marker

Store this lightweight metadata next to the immutable snapshot pixels:

```js
sourceRef: {
  noteId: sourceNote.id,
  anchorId: sourceAnchorId || null,
  rect: {x, y, w, h},
  revision: {
    note: [sourceNote.lastEdited || 0, sourceNote.editedOn || ""],
    ink: pageInk ? [pageInk.id, pageInk.lastEdited || 0, pageInk.editedOn || ""] : null,
    images: sourceImages
      .map(a => [a.id, a.lastEdited || 0, a.editedOn || ""])
      .sort((a,b) => a[0].localeCompare(b[0]))
  }
}
```

Recompute only this small vector when the snapshot is shown/selected. A
difference means `Source changed`; a missing note means `Source missing` but
the pixels remain. `Refresh from source` is manual. This is cheaper than
rehashing/rasterising the page and more honest than note time alone because
ink and included images are separate assets.

## 3. Existing test corrections to make before implementation

I did **not** edit these files.

- `tests/strip.mjs:70-71` and `88-90` currently require the Strip code to write
  `ink.active = "note"`. That green assertion pins the P0 pen-steal bug above.
  Correct contract: changing a read-only Strip state **does not assign
  `ink.active` at all**.
- `tests/strip.mjs:122-124` is a stale tautological reference saying Half/Full
  activate `summary`; it contradicts the deliberate b173 deviation. Remove or
  replace it with “all Strip sizes preserve the existing active surface.”
- `tests/sheetstates.mjs:32-36` finds the four words anywhere in the whole app,
  so one controller can supply states missing from the other. Scope state
  checks to each host/controller.
- `tests/sheetstates.mjs:45` misses the real top dock because `#sstrip` gets
  `style.top = stripTop()` at runtime rather than a literal CSS `top:` rule.
- `tests/sheetstates.mjs:57-58` has ordering backwards/ambiguous: it accepts
  restore text **before** `loadPracInk`/`hydrateImages`. Assert
  load/hydrate → layout settle → guarded restore.
- `tests/sheetstates.mjs:73-75` compares `strip:72` pixels with Half/Full
  fractions. Use one pixel resolver, as `sheetgeom.mjs` does.
- `tests/bringin.mjs:24` ends the `insertImageFile` span at nonexistent
  `function hydrateOneImage`, so it silently scans to end-of-file. End at
  `function hydrateImages`.
- `tests/bringin.mjs:77-79` falsely rejects the production-safe
  `cloneAsset(Object.assign({}, a, ...))` at `index.html:5329-5345`. Accept that
  arbitrary-field spread; it is stronger than a source-specific field list.
- `tests/bringin.mjs:92-99` is stale after b172. Add `topInset`, use
  `pageTopBase`, and use the adjusted usable viewport height.

## 4. Half/Full deviation verdict

**Keep the deviation.** A short note is a real page; writing should open that
page with the normal editor. The top Strip may become Half or Full **for
reading**, but it must never become a third writable surface. This avoids a
second undo/save/ink owner and preserves the core “glance without leaving the
main note” behaviour.

One correction is mandatory: “does not take the pen” means the Strip preserves
whichever surface is already active. It must not force `ink.active = "note"`,
because a bottom working sheet can be open simultaneously.

## 5. Verification

`tests/sheetgeom.mjs` is written and passes all **13** pure-JS checks. It tests:

- four states in pixels;
- top/bottom dock identity and viewport subtraction;
- three-tab LRU retention and restart persistence;
- owner-bound outgoing save packets;
- HTML → images → ink → layout → scroll restore ordering;
- stale open and stale close rejection.

Full contents follow.

```js
/* Pure geometry and lifecycle model for docked Margin sheets.

   This intentionally does not read index.html and does not need a DOM. It pins
   the contract that the implementation must satisfy:
   - Hidden / Strip / Half / Full are four named states measured in pixels.
   - Summary tabs dock at the top; working tabs dock at the bottom.
   - At most three named tabs survive, each with its own page, place and size.
   - A switch captures and flushes the outgoing owner before replacing it.
   - Scroll is restored only after HTML, images, ink and one layout settle.
   - A stale asynchronous open or close cannot overwrite a newer one. */

import assert from "node:assert/strict";

let bad = 0;
function check(label, fn){
  try {
    fn();
    console.log("  ok   " + label);
  } catch (err){
    bad++;
    console.log("  FAIL " + label);
    console.log("       " + err.message);
  }
}

const STATES = Object.freeze(["hidden", "strip", "half", "full"]);

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

/* A dragged custom height remains data on the tab, not a fifth global state.
   It refines Half; choosing Strip or Full still has one unambiguous meaning. */
function stateHeight(state, available, opts = {}){
  if (!STATES.includes(state)) throw new Error("unknown sheet state: " + state);
  available = Math.max(0, Number(available) || 0);
  const strip = Math.min(available, Math.max(0, Number(opts.stripPx ?? 72) || 0));
  if (state === "hidden") return 0;
  if (state === "strip") return strip;
  if (state === "full") return available;
  const wanted = opts.customHeight == null
    ? Math.round(available * 0.5)
    : Number(opts.customHeight);
  return clamp(wanted, strip, available);
}

function dockFor(kind){
  if (kind === "summary" || kind === "short") return "top";
  if (kind === "working" || kind === "rough") return "bottom";
  throw new Error("unknown sheet kind: " + kind);
}

function usableViewport(viewportHeight, topHeight, bottomHeight){
  const full = Math.max(0, Number(viewportHeight) || 0);
  const top = clamp(Number(topHeight) || 0, 0, full);
  const bottom = clamp(Number(bottomHeight) || 0, 0, Math.max(0, full - top));
  return { topInset: top, bottomInset: bottom, height: full - top - bottom };
}

function defaultFold(state, manual){
  if (manual === true || manual === false) return manual;
  return state === "half";
}

function normaliseTab(tab){
  return {
    id: String(tab.id),
    kind: tab.kind,
    dock: dockFor(tab.kind),
    pageId: String(tab.pageId),
    state: STATES.includes(tab.state) ? tab.state : "half",
    customHeight: tab.customHeight == null ? null : Number(tab.customHeight),
    folded: tab.folded == null ? null : !!tab.folded,
    scrollTop: Math.max(0, Number(tab.scrollTop) || 0),
    scrollLeft: Math.max(0, Number(tab.scrollLeft) || 0),
    used: Number(tab.used) || 0
  };
}

function retainTab(tabs, incoming, now){
  const tab = normaliseTab({...incoming, used: now});
  const next = tabs.filter(t => t.id !== tab.id).map(normaliseTab);
  next.push(tab);
  next.sort((a, b) => a.used - b.used);
  return next.slice(-3);
}

function saveRegistry(tabs){ return JSON.stringify(tabs.map(normaliseTab)); }
function loadRegistry(raw){
  const parsed = JSON.parse(raw || "[]");
  return parsed.map(normaliseTab).slice(-3);
}

function cloneInk(surface){
  return {
    strokes: JSON.parse(JSON.stringify(surface.strokes || [])),
    removed: JSON.parse(JSON.stringify(surface.removed || {})),
    restored: JSON.parse(JSON.stringify(surface.restored || {}))
  };
}

/* The id and bytes are captured together. A delayed save must never read the
   mutable active tab after an await or timer. */
function captureOutgoing(host){
  if (!host.active) return null;
  host.active.scrollTop = Math.max(0, Number(host.scroller.top) || 0);
  host.active.scrollLeft = Math.max(0, Number(host.scroller.left) || 0);
  return {
    tabId: host.active.id,
    pageId: host.active.pageId,
    html: host.html,
    ink: cloneInk(host.surface)
  };
}

function stillCurrent(host, epoch, tab){
  return host.epoch === epoch && host.active && host.active.id === tab.id;
}

/* Exact switch ordering. The load functions may run asynchronously, but the
   place is applied only after every layout-affecting input and a settle tick. */
async function switchTab(host, rawTab, io){
  const tab = normaliseTab(rawTab);
  const epoch = ++host.epoch;
  const outgoing = captureOutgoing(host);
  host.events.push("capture");
  if (outgoing){
    host.events.push("flush:" + outgoing.pageId);
    await io.flush(outgoing);
  }
  if (host.epoch !== epoch) return false;

  host.active = tab;
  host.html = "";
  host.surface = {strokes:[], removed:{}, restored:{}};
  host.scroller = {top:0, left:0, contentHeight:0, viewportHeight:600};

  host.events.push("html:" + tab.pageId);
  const content = await io.loadHtml(tab);
  if (!stillCurrent(host, epoch, tab)) return false;
  host.html = content.html;
  host.scroller.contentHeight = content.contentHeight;

  host.events.push("images:" + tab.pageId);
  await io.hydrateImages(tab, host);
  if (!stillCurrent(host, epoch, tab)) return false;

  host.events.push("ink:" + tab.pageId);
  host.surface = cloneInk(await io.loadInk(tab));
  if (!stillCurrent(host, epoch, tab)) return false;

  host.events.push("layout:" + tab.pageId);
  await io.settleLayout(tab, host);
  if (!stillCurrent(host, epoch, tab)) return false;

  const maxTop = Math.max(0, host.scroller.contentHeight - host.scroller.viewportHeight);
  host.scroller.left = tab.scrollLeft;
  host.scroller.top = clamp(tab.scrollTop, 0, maxTop);
  host.events.push("restore:" + tab.pageId);
  return true;
}

function beginClose(host){ return ++host.epoch; }
function finishClose(host, closeEpoch){
  if (host.epoch !== closeEpoch) return false;
  host.hidden = true;
  host.active = null;
  return true;
}
function reopen(host, tab){
  host.epoch++;
  host.hidden = false;
  host.active = normaliseTab(tab);
}

function deferred(){
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
}

console.log("four named sheet states and dock geometry:");
check("Hidden < Strip < Half < Full in one unit (pixels)", () => {
  const hs = STATES.map(s => stateHeight(s, 1000));
  assert.deepEqual(hs, [0, 72, 500, 1000]);
});
check("a dragged Half height is clamped between Strip and Full", () => {
  assert.equal(stateHeight("half", 900, {customHeight:10}), 72);
  assert.equal(stateHeight("half", 900, {customHeight:2000}), 900);
  assert.equal(stateHeight("half", 900, {customHeight:340}), 340);
});
check("summary is top and working is bottom without a CSS kind/state matrix", () => {
  assert.equal(dockFor("summary"), "top");
  assert.equal(dockFor("working"), "bottom");
});
check("top and bottom docks are subtracted exactly once", () => {
  assert.deepEqual(usableViewport(1000, 120, 300), {topInset:120, bottomInset:300, height:580});
  assert.deepEqual(usableViewport(500, 400, 400), {topInset:400, bottomInset:100, height:0});
});
check("Half folds by default; Full expands; a manual choice wins", () => {
  assert.equal(defaultFold("half"), true);
  assert.equal(defaultFold("full"), false);
  assert.equal(defaultFold("half", false), false);
  assert.equal(defaultFold("full", true), true);
});

console.log("three named tabs keep independent state:");
check("a fourth tab evicts only the least recently used tab", () => {
  let tabs = [];
  tabs = retainTab(tabs, {id:"w1",kind:"working",pageId:"w1p2",state:"half",scrollTop:140}, 1);
  tabs = retainTab(tabs, {id:"s1",kind:"summary",pageId:"s1p3",state:"strip",scrollTop:320}, 2);
  tabs = retainTab(tabs, {id:"w2",kind:"working",pageId:"w2p1",state:"full",scrollTop:90}, 3);
  tabs = retainTab(tabs, {id:"s2",kind:"summary",pageId:"s2p4",state:"half",scrollTop:700}, 4);
  assert.deepEqual(tabs.map(t => t.id), ["s1","w2","s2"]);
  assert.equal(tabs.find(t => t.id === "s1").scrollTop, 320);
});
check("restart persistence keeps each tab's page/place/state/size/fold", () => {
  const before = [normaliseTab({id:"w1",kind:"working",pageId:"wp3",state:"half",
    customHeight:333,folded:false,scrollTop:711,scrollLeft:29,used:8})];
  assert.deepEqual(loadRegistry(saveRegistry(before)), before);
});

console.log("switch, save and restore ordering:");
check("the outgoing owner and ink bytes are captured before mutation", () => {
  const host = {active:normaliseTab({id:"A",kind:"working",pageId:"pageA",state:"half"}),
    html:"old",surface:{strokes:[{id:"old"}],removed:{x:1},restored:{}},
    scroller:{top:321,left:9}};
  const packet = captureOutgoing(host);
  host.active.pageId = "pageB";
  host.surface.strokes[0].id = "new";
  assert.equal(packet.pageId, "pageA");
  assert.equal(packet.ink.strokes[0].id, "old");
  assert.equal(packet.html, "old");
});

const host = {
  epoch:0, hidden:false, events:[], html:"old",
  active:normaliseTab({id:"A",kind:"working",pageId:"pageA",state:"half",scrollTop:0}),
  surface:{strokes:[{id:"a"}],removed:{},restored:{}},
  scroller:{top:222,left:11,contentHeight:1200,viewportHeight:600}
};
const packets = [];
const io = {
  flush: async packet => { packets.push(packet); },
  loadHtml: async () => ({html:"new", contentHeight:650}),
  hydrateImages: async (tab, h) => { h.scroller.contentHeight = 1900; },
  loadInk: async () => ({strokes:[{id:"b"}],removed:{},restored:{}}),
  settleLayout: async () => {}
};
await switchTab(host, {id:"B",kind:"summary",pageId:"pageB",state:"strip",
  scrollTop:700,scrollLeft:22}, io);

check("flush precedes HTML; restore follows HTML, images, ink and layout", () => {
  assert.deepEqual(host.events, [
    "capture","flush:pageA","html:pageB","images:pageB",
    "ink:pageB","layout:pageB","restore:pageB"
  ]);
});
check("restoring after hydration reaches the saved place instead of an early clamp", () => {
  assert.equal(host.scroller.top, 700);
  assert.equal(host.scroller.left, 22);
  const earlyMax = Math.max(0, 650 - 600);
  assert.equal(clamp(700, 0, earlyMax), 50);
});
check("the save packet still belongs to the outgoing page", () => {
  assert.equal(packets[0].pageId, "pageA");
  assert.equal(packets[0].ink.strokes[0].id, "a");
});

console.log("stale asynchronous work cannot win:");
const waitImages = deferred();
const raceHost = {
  epoch:0, hidden:false, events:[], html:"",
  active:null, surface:{strokes:[],removed:{},restored:{}},
  scroller:{top:0,left:0,contentHeight:0,viewportHeight:600}
};
const raceIo = {
  flush: async () => {},
  loadHtml: async tab => ({html:tab.id, contentHeight:1600}),
  hydrateImages: async tab => { if (tab.id === "slow") await waitImages.promise; },
  loadInk: async tab => ({strokes:[{id:tab.id}],removed:{},restored:{}}),
  settleLayout: async () => {}
};
const slow = switchTab(raceHost,
  {id:"slow",kind:"working",pageId:"slowPage",state:"half",scrollTop:800}, raceIo);
await Promise.resolve();
await Promise.resolve();
const fast = switchTab(raceHost,
  {id:"fast",kind:"working",pageId:"fastPage",state:"half",scrollTop:400}, raceIo);
await fast;
waitImages.resolve();
await slow;

check("a slow old open cannot replace the newer tab or its scroll", () => {
  assert.equal(raceHost.active.id, "fast");
  assert.equal(raceHost.html, "fast");
  assert.equal(raceHost.surface.strokes[0].id, "fast");
  assert.equal(raceHost.scroller.top, 400);
});
check("a delayed close cannot hide a tab reopened during its animation", () => {
  const h = {epoch:0,hidden:false,active:normaliseTab({id:"A",kind:"working",pageId:"A",state:"half"})};
  const closing = beginClose(h);
  reopen(h, {id:"B",kind:"working",pageId:"B",state:"half"});
  assert.equal(finishClose(h, closing), false);
  assert.equal(h.hidden, false);
  assert.equal(h.active.id, "B");
});

process.exitCode = bad ? 1 : 0;
```

index.html untouched: yes. sw.js untouched: yes. No git commands run: yes.
