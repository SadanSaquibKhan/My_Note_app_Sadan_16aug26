# Codex audit: Chunks, dock geometry, and b177/b178 safety

**Scope:** specification, tests, and review only. The audit began against b178;
Claude Code advanced the shared file to **b179** while it was running. b179 is an
image-sync/repair build and does not close the sheet findings below. Line numbers
are the live b179 lines seen on 2026-08-25. `index.html` and `sw.js` were not
edited.

## Executive findings

1. **P0 — the owner-bound working-sheet save is only partly fixed.**
   `openPracticeById()` (`index.html:15591-15597`) can replace the mounted sheet
   through a dock-tab click without `captureSheetPlace()` or
   `flushPractice()`. A queued `pracSurface.flush()` still discovers its owner
   from mutable `pracSurface.owner` at fire time (`8685-8696`, `9873-9883`), so
   the tab path can still save the new page's arrays under the new owner and lose
   the outgoing stroke. The normal previous/next and close paths are safer.
2. **P1 — b178's height test supplies a field production never supplies.**
   `sheetHeightFor()` reads `usablePageViewport().paperRect.height`
   (`9905-9913`), but `usablePageViewport()` returns `paper`, not `paperRect`
   (`17843-17870`). Production therefore always falls back to
   `window.innerHeight`; the grip repeats the same mistake at `18754-18756`.
3. **P1 — a transformed/off-screen top Strip can be counted as covering the
   whole paper.** The current top-inset expression at `17851-17855` does not
   intersect both rectangle starts. If the preview browser puts the fixed Strip
   entirely below `#paper`, it can return the full paper height instead of zero.
4. **P1 — persisted tabs are neither validated nor opened by stable id.**
   `loadDockTabs()` accepts the last three raw descriptors (`10019-10023`), and
   `openPracticeById()` searches only the current main page's children and
   silently falls back to index 0 (`15591-15597`). A deleted working page or a
   tab from a missing/different notebook can therefore open the wrong sheet.
5. **P1 — close/open and restore still have races.** The 280 ms close timer has
   no epoch (`10105-10124`), and image hydration is started but not awaited
   before place restoration (`10085-10094`, `10252-10257`).
6. **P1 — `flush()` does not await its collected sheet/ink writes when the main
   note is dirty.** It returns only `C.saveNote(...)` on that branch
   (`6551-6584`); `waiting` is awaited only on the early-return branch.

## 1. Build-ready Chunks specification

### Fixed product decisions

- A Chunk is a **navigation/browsing layer**, not part of the page title.
  Chunk work must never rename an existing page or call the S/P renumber plan.
- Hierarchy for ordinary pages is **Section → Chunk → Page**. Working and
  Summary drawers stay outside it.
- Existing ordinary pages without a `chunkId` form one **implicit chunk**. If
  there are no explicit chunks, it is labelled **All pages** and contains the
  whole section. If explicit chunks later exist, the same group is labelled
  **Earlier pages** and remains C1 while it has pages.
- The visible address is derived as `S2C4P5` and kept separately from `title`.
  Links, covers, working pins, undo locations, and open tabs continue to use the
  stable page id, never that address.
- A new chunk is **offered**, not forced, only while creating a new ordinary
  page when the preceding ordinary page in that same section was created **more
  than four hours** earlier. Exactly four hours does not offer. There is no
  manual “new chunk” command.
- Side panel default is **Sections | Chunks | Pages**. The notebook rail remains
  available but collapsed/hidden by default.
- Blue chip = current Chunk. Grey chip = current Section. The whole-notebook
  chip is removed. Finger scrolling still follows the complete ordinary reading
  order across chunk and section boundaries.

### Data shape and invariants

Use a real `chunks` store rather than overloading `sections` or device-local
`meta`:

```js
{
  id: "ch_…",
  notebookId: "nb_…",
  sectionId: "sc_…",
  name: "Chunk 2",
  order: 2000,
  createdAt: 123,
  lastEdited: 123,
  editedOn: "device-id",
  deletedAt: null
}
```

Ordinary notes gain nullable `chunkId` and a title-independent `navOrder`.
`chunkId:null` means the implicit group. A chunk must belong to the note's
section and notebook; a missing/mismatched chunk id is recovered into the
implicit group instead of hiding the page.

Do **not** persist `S2C4P5` as content authority. Maintain a derived
`state.addressByNote` map with:

```js
{ text:"S2C4P5", sectionId, chunkId, pageId }
```

Recompute it after a structural change or relevant sync pull. This avoids
rewriting every note merely because a section/chunk/page moved. If a cache is
later persisted, it remains disposable and must never drive links or order.

Canonical order is:

1. ordinary sections by `section.order`, excluding Working/Summary drawers;
2. implicit chunk first while it has pages, then non-empty explicit chunks by
   `chunk.order`;
3. pages by `note.navOrder`, with the current `sortPages()` result used only as
   the deterministic migration fallback for records that do not have it yet.

Migration must not call `touch()` merely to add `navOrder`/`chunkId`; b179
correctly established that a repair stamp can make stale content win LWW sync.

### Exact creation transaction

For `addPageInSection(sectionId)` and the insertion path:

1. Capture the last ordinary page in the chosen section and the current time.
2. Create the page immediately. It initially inherits the preceding page's
   valid `chunkId` (or null/implicit) and receives a `navOrder` after it.
3. Call a pure `shouldOfferChunk(reason, previous, created)` policy. It returns
   true only for `reason === "new-page"`, same notebook, same section, both
   ordinary, and `createdAt - previous.createdAt > 4h`.
4. If false, open the page normally. If true, show one small non-blocking offer:
   **Start a new chunk** / **Keep in previous chunk**. Declining changes nothing.
5. Accepting creates one auto-named chunk and atomically assigns the new page to
   it. The chunk is born with its first page; there is no empty manually created
   chunk.

The offer's suggested name can be `Chunk N` with the date/time shown as a
subtitle. Renaming an existing chunk may be allowed from its row, but creation
still occurs only through the time-gap offer.

### Required breakage table

| Function / live line | What it does today | Required Chunks change | What breaks if missed |
|---|---|---|---|
| `DB_VERSION`, `upgrade` (`2964`, `2991-3037`) | Schema 5 has no chunks store. | Bump schema; create `chunks` keyed by id with `by_section` and preferably `by_notebook` indexes. | Chunks are device-memory only or cannot load efficiently. |
| `FORMAT`, `exportBundle`, `validBundle`, `normalise`, `importBundle` (`2965`, `5770`, `5851`, `5856`, `5912`) | Backups know sections and notes only. | Add optional `chunks`; accept old bundles; normalise chunk records; repair orphan chunk→section and note→chunk references to implicit. | Restore loses grouping or hides pages behind missing ids. |
| `SYNC_STORES`, `getSynced`, `putSynced` (`6073`, `6299`, `6306`) | Sync publishes sections then notes, not chunks. | Add `chunks`; it is a plain LWW record. | Tablet/laptop show different groupings. |
| `applyPulledRows.storeOrd` (`21000-21060`) | Parent order is sections→notes. | Order sections→chunks→notes and treat a chunk pull as topology/list refresh. | A page arrives before its chunk and flashes/may remain implicit. |
| `createNote`, note normalisation (`4347-4357`, `5856+`) | Note has sectionId but no chunk/order. | Add nullable `chunkId` and `navOrder`; validate both without touching title. | New pages cannot stay in a chunk or have stable order. |
| `sortPages` (`3843-3866`) | Reading order depends on numeric text in `title`. | Add title-independent `sortNavPages`; use current result only to seed/fallback old `navOrder`. | “Browsing only” is violated or reordering requires renaming titles. |
| `suggestPageTitle`, `insertPageAfter` (`4403-4435`) | Naming and insertion understand section/page titles and renumber later titles. | Chunk logic must not derive address from these or invoke renumbering. Insertion inherits the current chunk and inserts a `navOrder` between neighbours. | Chunk moves rename user topics; inserted page appears in another chunk/end. |
| `addPageInSection` (`8332-8342`) | Creates directly in a section. | Run the >4h offer transaction and inherit/create `chunkId`. | No automatic session boundary or every page starts a chunk. |
| `duplicateNote` (`5290+`) | Same-notebook copy inherits fields via spread; cross-notebook only clears sectionId. | Same section may retain chunk with new `navOrder`; cross-notebook/section must clear invalid `chunkId`. | Copy points at a chunk from another notebook and disappears from the list. |
| `duplicateNotebook` (`5397+`) | Clones/remaps sections and notes. | Clone chunks, remap every cloned `chunkId`, preserve order. | Copied notebook collapses all pages into implicit or references original chunks. |
| `deleteSection`, notebook delete/restore/empty paths (`4300-4327`, `5475-5578`) | Moves/restores sections/pages/assets. | Tombstone/restore child chunks with the section/notebook; moved pages clear or receive a valid destination chunk. | Orphan chunks and invisible pages survive deletes/restores. |
| `notesBySection`, `ordinaryPages`, `pageOrder` (`4270`, `4330`, `18537`) | Groups only section→page; full reading order excludes drawers. | Add one shared section→chunk→page topology helper; keep drawer exclusion before chunk grouping. | Panel, chips and finger scroll disagree on order. |
| `refreshLists`, `render`, `state` (`6445`, `7478`, `7516`) | Loads sections/notes and remembers one section. | Load chunks; keep `chunkId`, `chunkPlace`, `addressByNote`, and a topology revision. | Reload resets chunk selection and stale addresses remain. |
| Side-panel markup + `applyPanes`/widths (`1957-2010`, `6808-6878`) | Visible columns are notebooks/sections/pages. | Add independent chunk pane/toggle/grip/width/lock; notebooks stay collapsed by default; visible default becomes Sections/Chunks/Pages. | Chunk list cannot be resized/locked, or notebook rail still wastes width. |
| `paintSections` (`6886-6940`) | Section click remembers one page then paints pages. | Remember last chunk and page per section; selecting a section selects its last valid chunk or implicit C1. | Returning to a section opens the wrong session. |
| `paintNotes` (`7122+`) | Filters ordinary pages by section only. | Filter by selected section **and** effective chunk; show derived address in a separate element. | Page list mixes all chunks or overwrites titles with addresses. |
| Move dialog (`8373-8424`) | Moves only notebook/section. | Choose destination chunk or implicit; write `sectionId`+`chunkId` together and assign destination `navOrder`. | A page keeps an impossible old chunk id. |
| `sectionPageList` (`17062-17069`) | Blue chip list is current section. | Replace with `chunkPageList`; add a new section-scope list for grey. | Blue/grey chips navigate the wrong scope. |
| `paintNavChips`, `wireNavChip`, `chipKindOf` (`17135-17216`, `17660+`) | `secChip`=blue section; `bookChip`=grey notebook. | Prefer ids `chunkChip` (blue) and `secChip` (grey); remove `bookChip`; label `Ck p/n` and `Sk p/n`. Update tuck and drag ownership. | Wrong colour/scope, stale whole-notebook seek, or overlapping handlers. |
| `pageBand`, `pageStick`, `placeForDrag` (`17290-17351`) | Sticky seek uses the current list and a whole-track floor. | Keep stick relative to current page share and derive its minimum from physical track pixels. Rebuild only after a drag ends. | Short chunks feel frozen; long sections shiver at joins. |
| `markSectionJoin`, peek painters (`18595+`, `18020+`) | Only section boundary gets a special label. | Add a lighter chunk boundary and retain the stronger section boundary. Both use the same topology as `pageOrder`. | User cannot tell a class/session boundary from an ordinary page join. |
| `workingName`, `paintPracHead`, Add/Copy (`4819`, `10148`, `10272`, `19530`) | Derives `SxPywN` from mutable parent title/current `state.note`. | Display `addressOf(sourceId)+"wN"`; resolve source by `prac.rec.worksFor`; do not auto-rename stored old sheets. | `S2C4P5` is not understood and an open tab names/copies under the wrong parent. |
| Places/section shortcuts (`12100+`) | Lists sections and bookmarks. | Nest or group chunks under each ordinary section; addresses are display text only. | Quick navigation bypasses the new hierarchy. |
| `planSecPageNames` / `fixNamesBtn` (`3808`, `1961`, `8200+`) | Explicit old S#P# title-renaming feature. | Do not call it from any chunk operation. If retained for legacy users, label it as title renaming, unrelated to addresses. | A browsing action rewrites user titles and working-sheet names. |

### Four required direct answers

#### 1. `workingName()` and existing sheets

`workingName()` currently parses `parent.title` (`4819-4829`), so it cannot
correctly understand a separate `S2C4P5` address. Change its display input to
the source page id and derive `addressOf(sourceId) + "w" + ordinal`.

Do **not** bulk-rename existing working pages. Their markers use stable ids, so
old `S2P2w1` records remain safe. In the sheet header, display the live derived
source address plus w-number; keep the stored legacy title unless the user
explicitly renames that sheet.

#### 2. `CHIP_STICK` with a short Chunk

The “22%” comment is stale. Live b179 uses `CHIP_STICK = 0.06` and
`max(0.012, pageShare * 0.06)` (`17279-17302`). Keep the coefficient as a
constant, but make the final dead zone a **function of current page share and
track pixels**, not list length and not a fixed fraction of the whole track.
For example: 6% of this page's band, floored near 8 physical pixels and capped
near 12% of the page band. A one-page Chunk then remains responsive, while a
long Section does not get an oversized whole-track floor.

#### 3. Moving a page between Chunks during a chip drag

Freeze `chipDrag.list` plus a `topologyRevision` at pointerdown. Before a local
move, cancel/end the active drag **without seeking**, atomically write the page's
new `sectionId`, `chunkId`, and `navOrder`, increment the topology revision,
then rebuild both chips around the moved page. If sync brings a non-destructive
reorder during a drag, queue the topology refresh until pointerup; if the
mounted page is deleted or becomes invalid, cancel immediately. Never mutate
the list underneath `placeForDrag()`.

#### 4. Working/Summary drawers and Chunks

They have **no Chunk**. Drawer exclusion must happen before chunk grouping.
Working sheets display the current address of their source ordinary page plus
`wN`. A Summary can cover several pages, chunks, sections, or notebooks, so it
shows its Cover links rather than pretending to own one `chunkId`. Neither kind
consumes an S/C/P ordinal or appears on either navigation chip.

## 2. Geometry that the preview browser cannot verify

### What the preview already proved unreliable

- `requestAnimationFrame` did not fire, so animation-frame-only completion
  looked like a permanently closed sheet. `afterLayout()` now has a guarded
  timeout fallback (`9891-9898`), and its `done` flag correctly prevents the
  timeout and two-frame path from invoking the callback twice.
- A `position:fixed` sheet resolved against an ancestor transform and rendered
  below the pane instead of over the viewport. That is not representative of
  normal tablet Chrome fixed positioning.
- The pane reported the same computed height in Hidden/Strip/Half/Full even
  against an inline override. Source matching therefore cannot establish real
  geometry.

### Additional source-only / false-green areas

1. **Production height input mismatch:** `sheetHeightFor()` and the grip look
   for `room.paperRect`, which production does not return. The existing test
   injects that fictional field, so it is green while production uses the
   whole window.
2. **Rectangle edge intersection:** `usablePageViewport()` assumes a visible
   Strip touches the paper top and a visible sheet touches its bottom. With the
   preview's transformed fixed element, that assumption produces a false inset.
3. **CSS transition and transform direction:** source can prove a rule exists,
   not that the compositor creates the expected visual slide or stacking.
4. **Real `scrollTop` clamping:** a synthetic pure function can round-trip a
   negative theoretical top. Only a browser/device shows what happens at the
   first page when the top Strip covers the page and the scroller cannot go
   negative.
5. **CSS zoom + DPR + canvas:** source math cannot prove that DOM, ink canvas,
   peek canvas, and hit targets align at 80%, 100%, and 200% on the tablet.
6. **Late layout:** image decode, fonts, KaTeX, ResizeObserver, address-bar
   resizing, and Android keyboard/visualViewport changes happen on real time;
   a fixed timeout is not evidence that layout is settled.
7. **Pointer capture:** the pane cannot establish Samsung finger/S-Pen
   pointercancel/lostcapture behaviour while resizing or scrolling.

### Smallest geometry correction

- Make one pure resolver accept explicit numbers:
  `sheetHeight(state, paperHeight, oppositeDockInset, customHeight)`. Do not let
  it call `usablePageViewport()` and do not use `window.innerHeight` except as a
  final measurement fallback at the call site.
- Return `paperRect:r` from `usablePageViewport()` if callers still need it, but
  prefer passing `r.height` explicitly. Avoid feeding a sheet's own current
  inset back into calculation of its requested height.
- Compute top/bottom dock inset only when the overlay intersects and covers the
  corresponding paper edge; clamp the pair so `top + bottom <= paper height`.
- Keep `pageTopBase`, `pageScrollFor`, and `pageFracNow` as one inverse pair.
  `tests/layoutmath.mjs` pins this arithmetic.

### What must be checked on the real tablet

1. Hidden → Strip → Half → Full heights are visually distinct; Full leaves the
   intended 46px header and does not exceed the room below an open top Strip.
2. Top Strip and bottom working sheet can coexist with a visible middle page;
   opening/closing either does not move the same written line on screen.
3. Drag the working grip beyond both limits, then trigger pointercancel by
   leaving the app/edge; the resize must stop and return with the saved height.
4. At first page, middle page, and last page: test 80%, 100%, and 200% zoom with
   both docks, finger scroll, blue/grey chip, and undo reveal.
5. Open image-heavy and maths-heavy working sheets, switch tabs immediately,
   and confirm the remembered place restores only after everything finishes.
6. Test the Android keyboard appearing/disappearing while either dock is open;
   confirm the unobscured page rectangle is recalculated from the actual visual
   viewport.

## 3. b177/b178 review against every earlier finding

### Sheet-state / dock-tab findings

| # | Status | Current evidence |
|---|---|---|
| S1 Strip steals pen | **Closed** | `setStripState()` has no `ink.active` assignment (`16051-16082`); `strip.mjs` confirms zero assignments. |
| S2 delayed practice save uses mutable owner | **Partial / P0 remains** | Owner exists (`9880`, `10222`) and normal flush clears both timers (`10132-10145`), but rail `openPracticeById()` replaces through `openPractice()` with no outgoing flush (`15591-15597`); `S.flush()` still reads owner at timer fire (`8685-8696`). |
| S3 writable before ink load | **Closed for pen** | `loadPracInk` sets `loading` before fetch (`10215-10234`) and `mayDraw` refuses practice ink while loading (`9136-9141`). |
| S4 no tab registry | **Partial** | Up to three persisted working descriptors exist (`9969-10023`), but Summary Strip still has one `stripNoteId` and is not represented in that registry (`16025-16027`). |
| S5 no capture/restore ordering | **Partial** | Previous/next captures then flushes (`10237-10254`), but open/rail path does not capture; hydration is not awaited before restore (`10085-10094`, `10252-10257`). |
| S6 stale close timer | **Open** | `closePractice()` schedules unconditional hide after 280ms with no close epoch/token (`10105-10124`). |
| S7 `flush()` forgets ink/sheet promises | **Partial / still wrong on dirty main note** | Promises are collected (`6556-6562`) and awaited only on the early return (`6563-6564`); dirty branch returns `C.saveNote` without `waiting` (`6566-6584`). |
| S8 `paintDoc` destroys tab session | **Closed for registry; intentional hide** | Page mount still closes the physical sheet (`7309-7314`), but `closePractice` persists tabs/place rather than deleting registry (`10105-10110`). |
| S9 stable id converted to ordinal/fallback 0 | **Open** | `openPracticeById` searches current source list, initializes `i=0`, and never verifies a hit (`15591-15597`). |
| S10 global image hydration ownership | **Open** | `hydrateImages()` revokes one global pool and hydrates both hosts with no owner/epoch (`14133-14189`). |
| S11 naming/Add/Copy use current main page | **Open** | Header uses `state.note` (`10148-10151`), Add uses `state.note.id` (`10272-10278`), and Copy creates under `state.note.id` (`19530-19539`). |
| S12 stale lasso/image/crop UI on switch | **Open** | `gotoPracPage` replaces `pracText`/arrays (`10237-10258`) without `lassoClear`, `deselectImage`, crop cancel, or pointer cleanup. |
| S13 one global `body[data-prac]` / free state | **Mostly closed** | Physical sheet owns `data-dock`/`data-state` (`9916-9935`), custom height is per tab; body dataset remains as compatibility (`9936`) but no live `body[data-prac]` CSS was found. |
| S14 grip uses window, no persistence/cancel | **Partial** | Per-tab height and pointercancel/lostcapture are present (`18744-18772`), but `paperRect` is absent so clamp falls back to `window.innerHeight` (`18754-18756`). |
| S15 Strip lacks four states/full close behaviour | **Open / deliberate product deviation partly documented** | Strip has only hidden/strip/half (`16025-16048`); top close animation exists, but no read-only Full state. |

### “Bring the page in here” findings

| # | Status | Current evidence |
|---|---|---|
| B1 `fullInkImage` is ink-only/wrong scroller | **Open** | It still sizes from `paper.scrollWidth/scrollHeight` and draws only `noteSurface.strokes` (`14920-14932`). |
| B2 hold is main-page-only | **Open** | `wireSurface` arms generic hold only for `S.name === "note"` (`9271-9273`); menu assumes `state.note` (`15474-15495`). |
| B3 capture overlay must stay outside body/flow | **Open feature, invariant still required** | No Bring overlay/command exists. |
| B4 visible-slice viewport correction | **Infrastructure closed; feature open** | Shared `usablePageViewport/pageTopBase` exists (`17843-17879`), but no Bring slice uses it. |
| B5 active host/owner | **Closed for ordinary insertion; feature open** | `activeTextHost`/`activeNoteId` route ordinary images to practice (`14043-14060`); no snapshot caller exists. |
| B6 free insertion at held point | **Open** | `insertImageFile` is caret-flow (`14056-14087`); no snapshot `data-free/x/y` path. |
| B7 compositor URL ownership | **Open** | Only one global live `imgUrls` pool exists (`14108`, `14133-14165`); no temporary compositor pool. |
| B8 source revision vector | **Open** | No snapshot/source revision record exists. |
| B9 arbitrary `sourceRef` survives clone/sync | **Closed infrastructure** | `cloneAsset` spreads all fields (`5375-5391`) and blob stripping removes only bytes; current `bringin.mjs` falsely rejects this. |
| B10 changed/missing marker + manual refresh | **Open** | No Bring runtime or marker/action exists. |
| B11 page-width compositor | **Open** | No DOM+images+ink compositor exists; `fullInkImage` remains unsuitable. |
| B12 one undo unit | **Open** | No snapshot insertion/removal/refresh operation exists. |

## 4. Existing test review (no existing suite edited)

I ran `strip.mjs`, `sheetstates.mjs`, `sheetgeom.mjs`, `bringin.mjs`, and
`viewport.mjs` against live b179. The first, second, third, and fifth are green;
`bringin.mjs` has **19 expected/diagnostic failures** because the feature is not
built. Several green checks are false reassurance:

- `tests/strip.mjs:135-137` still states Half/Full activate `summary`, contrary
  to its own deliberate read-only deviation at lines 80-96. It is an isolated
  reference model and does not inspect production.
- `tests/sheetstates.mjs:33-36` finds four state words across the whole file,
  not four states per controller.
- `tests/sheetstates.mjs:62-63` finds *a* flush-before-rec pattern (the arrow
  path) and misses the unsafe dock-rail path through `openPracticeById`.
- `tests/sheetstates.mjs:68-72` says restoration follows content, but asserts
  only ink + `afterLayout`; production does not await `hydrateImages()`.
- `tests/sheetstates.mjs:75` accepts mere presence of `pracSeq`; it does not
  prove every switch increments/checks the sequence.
- `tests/sheetstates.mjs:96-115` injects `{paperRect:{height:1000}}`, although
  production `usablePageViewport()` never returns `paperRect`. This pins an
  unreachable branch and misses the window-height fallback.
- `tests/sheetgeom.mjs` is a useful pure desired-state model, not production
  wiring verification. Its stale-close and owner tests can be green while the
  app lacks those transitions.
- `tests/bringin.mjs:24` ends at nonexistent `hydrateOneImage`, so its
  `insertImage` span silently runs to EOF.
- `tests/bringin.mjs:77-79` rejects the production-safe
  `cloneAsset(Object.assign({}, a, ...))`; arbitrary spread is stronger than an
  enumerated source-field list.
- `tests/bringin.mjs:92-99` omits `topInset/pageTopBase`, so its reference slice
  is wrong when the Strip is visible.
- `tests/viewport.mjs` correctly pins the inverse arithmetic, but source regex
  cannot prove real fixed-element placement, CSS zoom, scroll clamping, or
  layout timing.

## 5. New tests

- `tests/chunks.mjs`: **13/13 pass**. It pins the >4h boundary, no-manual-offer
  rule, implicit compatibility, drawer exclusion, separate addresses, and
  deterministic/stable-id reordering.
- `tests/layoutmath.mjs`: **18/18 pass**. It pins b178's four baseline heights,
  opposite-dock room, custom-height clamping, Strip edge intersection, dock
  clamping, page-fraction inverses, remembered places, and short pages.

Full contents follow.

### `tests/chunks.mjs`

```js
/* Pure navigation model for Margin's proposed Chunks browsing layer.

   Chunks are navigation only: page ids and titles remain untouched. Existing
   pages with no chunkId form one implicit chunk, and a new chunk is offered
   only while creating a page more than four hours after the preceding ordinary
   page in the same section. No DOM and no index.html source matching. */

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

const FOUR_HOURS = 4 * 60 * 60 * 1000;

function isOrdinaryPage(page){
  return !!page && !page.deletedAt && !page.worksFor && !page.drawerKind;
}

function shouldOfferChunk({reason, lastPage, newPage}){
  if (reason !== "new-page") return false;
  if (!isOrdinaryPage(lastPage) || !isOrdinaryPage(newPage)) return false;
  if (lastPage.notebookId !== newPage.notebookId) return false;
  if ((lastPage.sectionId || null) !== (newPage.sectionId || null)) return false;
  const gap = Number(newPage.createdAt) - Number(lastPage.createdAt);
  return Number.isFinite(gap) && gap > FOUR_HOURS;
}

function byOrder(a, b){
  const ao = Number.isFinite(Number(a.navOrder)) ? Number(a.navOrder)
           : Number.isFinite(Number(a.order)) ? Number(a.order)
           : Number(a.createdAt) || 0;
  const bo = Number.isFinite(Number(b.navOrder)) ? Number(b.navOrder)
           : Number.isFinite(Number(b.order)) ? Number(b.order)
           : Number(b.createdAt) || 0;
  if (ao !== bo) return ao - bo;
  return String(a.id).localeCompare(String(b.id));
}

function chunkGroupsForSection(sectionId, chunks, pages){
  const sectionPages = (pages || [])
    .filter(isOrdinaryPage)
    .filter(p => (p.sectionId || null) === (sectionId || null));
  const explicit = (chunks || [])
    .filter(c => c && !c.deletedAt && c.sectionId === sectionId)
    .slice().sort(byOrder);
  const valid = new Map(explicit.map(c => [c.id, c]));
  const assigned = new Map(explicit.map(c => [c.id, []]));
  const implicit = [];

  sectionPages.forEach(page => {
    const chunk = page.chunkId && valid.get(page.chunkId);
    if (!chunk) implicit.push(page);
    else assigned.get(chunk.id).push(page);
  });

  const groups = [];
  if (implicit.length || explicit.length === 0){
    groups.push({id:null, implicit:true,
      name:explicit.length ? "Earlier pages" : "All pages",
      pages:implicit.slice().sort(byOrder)});
  }
  explicit.forEach(chunk => {
    const mine = assigned.get(chunk.id).slice().sort(byOrder);
    /* An empty record is not a navigable chunk. It can exist briefly while sync
       delivers the parent before its page, but it must not consume a C number. */
    if (mine.length) groups.push({id:chunk.id, implicit:false,
      name:chunk.name || "Chunk", pages:mine});
  });
  return groups;
}

function addressMap(sections, chunks, pages){
  const ordinary = (sections || [])
    .filter(s => s && !s.deletedAt && !s.kind)
    .slice().sort(byOrder);
  const out = {};
  ordinary.forEach((section, si) => {
    const groups = chunkGroupsForSection(section.id, chunks, pages);
    groups.forEach((group, ci) => {
      group.pages.forEach((page, pi) => {
        out[page.id] = {
          text:`S${si + 1}C${ci + 1}P${pi + 1}`,
          sectionId:section.id,
          chunkId:group.id,
          pageId:page.id
        };
      });
    });
  });
  return out;
}

console.log("new-page chunk offer:");
const base = {id:"p1", notebookId:"nb", sectionId:"s1", createdAt:1_000};
check("no preceding page means no offer", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:null, newPage:base}), false);
});
check("exactly four hours does not offer", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:base,
    newPage:{...base,id:"p2",createdAt:base.createdAt + FOUR_HOURS}}), false);
});
check("four hours plus one millisecond does offer", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:base,
    newPage:{...base,id:"p2",createdAt:base.createdAt + FOUR_HOURS + 1}}), true);
});
check("a manual action never creates or offers a chunk", () => {
  assert.equal(shouldOfferChunk({reason:"manual", lastPage:base,
    newPage:{...base,id:"p2",createdAt:base.createdAt + FOUR_HOURS + 1}}), false);
});
check("a gap across sections does not offer in the new section", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:base,
    newPage:{...base,id:"p2",sectionId:"s2",createdAt:base.createdAt + FOUR_HOURS + 1}}), false);
});
check("drawer/working pages never participate", () => {
  assert.equal(shouldOfferChunk({reason:"new-page", lastPage:{...base,worksFor:"source"},
    newPage:{...base,id:"p2",createdAt:base.createdAt + FOUR_HOURS + 1}}), false);
});

console.log("implicit chunk compatibility:");
const legacyPages = [
  {id:"p2",notebookId:"nb",sectionId:"s1",title:"Second",navOrder:2},
  {id:"p1",notebookId:"nb",sectionId:"s1",title:"First",navOrder:1}
];
check("no chunk records gives one implicit chunk containing every page", () => {
  const groups = chunkGroupsForSection("s1", [], legacyPages);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].implicit, true);
  assert.deepEqual(groups[0].pages.map(p => p.id), ["p1","p2"]);
});
check("a missing chunk reference recovers into the implicit chunk", () => {
  const groups = chunkGroupsForSection("s1", [], [{...legacyPages[0],chunkId:"missing"}]);
  assert.deepEqual(groups[0].pages.map(p => p.id), ["p2"]);
});
check("legacy pages stay in C1 before explicit chunks", () => {
  const chunks = [{id:"c1",sectionId:"s1",order:1,name:"Class 1"}];
  const pages = legacyPages.concat([{id:"p3",notebookId:"nb",sectionId:"s1",
    chunkId:"c1",title:"Third",navOrder:3}]);
  const groups = chunkGroupsForSection("s1", chunks, pages);
  assert.deepEqual(groups.map(g => g.id), [null,"c1"]);
});
check("working and summary drawer pages receive no implicit chunk", () => {
  const pages = legacyPages.concat([
    {id:"w1",sectionId:"s1",worksFor:"p1",navOrder:3},
    {id:"sum",sectionId:"s1",drawerKind:"summary",navOrder:4}
  ]);
  assert.deepEqual(chunkGroupsForSection("s1", [], pages)[0].pages.map(p => p.id), ["p1","p2"]);
});

console.log("derived S-C-P addresses:");
const sections = [
  {id:"s2",order:20,name:"Research"},
  {id:"s1",order:10,name:"Teaching"},
  {id:"drawer",order:999,kind:"working",name:"Working"}
];
const chunks = [
  {id:"cB",sectionId:"s1",order:30,name:"Class B"},
  {id:"cA",sectionId:"s1",order:20,name:"Class A"}
];
const pages = [
  {id:"legacy",sectionId:"s1",title:"Do not rename me",navOrder:1},
  {id:"a2",sectionId:"s1",chunkId:"cA",title:"Circuit",navOrder:2},
  {id:"a1",sectionId:"s1",chunkId:"cA",title:"FPGA",navOrder:1},
  {id:"b1",sectionId:"s1",chunkId:"cB",title:"Meeting",navOrder:1},
  {id:"s2p",sectionId:"s2",title:"Paper",navOrder:1},
  {id:"work",sectionId:"drawer",worksFor:"a1",title:"old working name",navOrder:1}
];
check("address is derived separately and never rewrites the title", () => {
  const before = pages.map(p => p.title);
  const map = addressMap(sections, chunks, pages);
  assert.equal(map.legacy.text, "S1C1P1");
  assert.equal(map.a1.text, "S1C2P1");
  assert.equal(map.a2.text, "S1C2P2");
  assert.equal(map.b1.text, "S1C3P1");
  assert.equal(map.s2p.text, "S2C1P1");
  assert.equal(map.work, undefined);
  assert.deepEqual(pages.map(p => p.title), before);
});
check("input array order does not change addresses", () => {
  assert.deepEqual(addressMap(sections, chunks, pages),
    addressMap(sections.slice().reverse(), chunks.slice().reverse(), pages.slice().reverse()));
});
check("reordering recomputes the address while ids, links and titles stay stable", () => {
  const before = addressMap(sections, chunks, pages);
  const reorderedChunks = chunks.map(c => c.id === "cB" ? {...c,order:15} : c);
  const reorderedPages = pages.map(p => p.id === "a2" ? {...p,navOrder:0} : p);
  const reorderedSections = sections.map(s => s.id === "s2" ? {...s,order:5} : s);
  const after = addressMap(reorderedSections, reorderedChunks, reorderedPages);
  assert.equal(before.a1.text, "S1C2P1");
  assert.equal(after.a1.text, "S2C3P2");
  assert.equal(after.a1.pageId, "a1");
  assert.equal(pages.find(p => p.id === "a1").title, "FPGA");
});

process.exitCode = bad ? 1 : 0;
```

### `tests/layoutmath.mjs`

```js
/* Pure geometry contract for Margin's docked Strip, working sheet and page.

   This intentionally uses no DOM. Synthetic browser panes have lied about
   requestAnimationFrame, fixed positioning and computed heights; these tests
   pin only the arithmetic that production geometry must call with real device
   measurements. */

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

function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }

function sheetHeight(state, {paperHeight, oppositeInset=0, customHeight=null,
                             stripPx=132, chromePx=46} = {}){
  if (!["hidden","strip","half","full"].includes(state))
    throw new Error("unknown sheet state: " + state);
  if (state === "hidden") return null;
  const paper = Math.max(0, Number(paperHeight) || 0);
  const room = Math.max(0, paper - clamp(Number(oppositeInset) || 0, 0, paper));
  const strip = Math.min(room, Math.max(0, Number(stripPx) || 0));
  const full = Math.max(strip, room - Math.min(room, Math.max(0, Number(chromePx) || 0)));
  if (state === "strip") return Math.round(strip);
  if (state === "full") return Math.round(full);
  const wanted = customHeight == null ? room * 0.52 : Number(customHeight);
  return Math.round(clamp(Number.isFinite(wanted) ? wanted : room * 0.52, strip, full));
}

function rect(top, bottom){
  top = Number(top) || 0;
  bottom = Number(bottom) || 0;
  return {top, bottom, height:Math.max(0, bottom - top)};
}

/* A top dock counts only when it actually covers the paper's top edge; a
   bottom dock counts only when it covers the bottom edge. An overlay rendered
   entirely below the paper by a transformed ancestor contributes zero. */
function edgeInset(paper, overlay, edge){
  if (!paper || !overlay || overlay.hidden) return 0;
  const eps = 0.5;
  if (edge === "top"){
    if (overlay.top > paper.top + eps || overlay.bottom <= paper.top) return 0;
    return clamp(Math.min(paper.bottom, overlay.bottom) - paper.top, 0, paper.height);
  }
  if (edge === "bottom"){
    if (overlay.bottom < paper.bottom - eps || overlay.top >= paper.bottom) return 0;
    return clamp(paper.bottom - Math.max(paper.top, overlay.top), 0, paper.height);
  }
  throw new Error("unknown dock edge: " + edge);
}

function clampDockInsets(height, topRequested, bottomRequested){
  const full = Math.max(0, Number(height) || 0);
  const top = clamp(Number(topRequested) || 0, 0, full);
  const bottom = clamp(Number(bottomRequested) || 0, 0, full - top);
  return {topInset:top, bottomInset:bottom, height:full - top - bottom};
}

function usableViewport(paper, topDock, bottomDock){
  const c = clampDockInsets(paper.height,
    edgeInset(paper, topDock, "top"), edgeInset(paper, bottomDock, "bottom"));
  return {
    top:paper.top + c.topInset,
    bottom:paper.bottom - c.bottomInset,
    height:c.height,
    topInset:c.topInset,
    bottomInset:c.bottomInset
  };
}

function pageTopBase(prevPad, viewport){ return prevPad - viewport.topInset; }
function pageScroll(frac, pageHeight, zoom, prevPad, viewport){
  const span = Math.max(0, pageHeight * zoom - viewport.height);
  return pageTopBase(prevPad, viewport) + clamp(frac, 0, 1) * span;
}
function pageFrac(scrollTop, pageHeight, zoom, prevPad, viewport){
  const span = Math.max(0, pageHeight * zoom - viewport.height);
  if (span === 0) return 0;
  return clamp((scrollTop - pageTopBase(prevPad, viewport)) / span, 0, 1);
}
function savePageY(scrollTop, prevPad, zoom, viewport){
  return (scrollTop - prevPad + viewport.topInset) / zoom;
}
function restorePageY(pageY, prevPad, zoom, viewport){
  return prevPad - viewport.topInset + pageY * zoom;
}

console.log("four sheet heights from explicit dock room:");
check("b178 baseline is hidden null, strip 132, half 520, full 954", () => {
  assert.deepEqual(["hidden","strip","half","full"].map(state =>
    sheetHeight(state, {paperHeight:1000})), [null,132,520,954]);
});
check("the opposite top Strip reduces a bottom sheet's room exactly once", () => {
  assert.equal(sheetHeight("half", {paperHeight:1000,oppositeInset:120}), 458);
  assert.equal(sheetHeight("full", {paperHeight:1000,oppositeInset:120}), 834);
});
check("a dragged Half height is clamped and cannot leak into Strip or Full", () => {
  assert.equal(sheetHeight("half", {paperHeight:900,customHeight:10}), 132);
  assert.equal(sheetHeight("half", {paperHeight:900,customHeight:2000}), 854);
  assert.equal(sheetHeight("strip", {paperHeight:900,customHeight:500}), 132);
  assert.equal(sheetHeight("full", {paperHeight:900,customHeight:500}), 854);
});
check("tiny screens never produce a negative or over-room height", () => {
  for (const state of ["strip","half","full"]){
    const h = sheetHeight(state, {paperHeight:40});
    assert.ok(h >= 0 && h <= 40);
  }
});

console.log("Strip intersection and dock clamping:");
const paper = rect(80, 1080);
check("a 132px Strip touching the paper top contributes exactly 132px", () => {
  assert.equal(edgeInset(paper, rect(80,212), "top"), 132);
});
check("a fixed element rendered below the paper contributes no false inset", () => {
  assert.equal(edgeInset(paper, rect(1080,1212), "top"), 0);
});
check("an off-screen or hidden dock contributes no inset", () => {
  assert.equal(edgeInset(paper, rect(-100,-10), "top"), 0);
  assert.equal(edgeInset(paper, {...rect(80,212),hidden:true}, "top"), 0);
});
check("top and bottom docks are subtracted once and never make height negative", () => {
  assert.deepEqual(usableViewport(paper, rect(80,212), rect(780,1080)),
    {top:212,bottom:780,height:568,topInset:132,bottomInset:300});
  assert.deepEqual(clampDockInsets(500,400,400),
    {topInset:400,bottomInset:100,height:0});
});
check("a floating bottom overlay that does not touch the bottom is not a dock", () => {
  assert.equal(edgeInset(paper, rect(500,900), "bottom"), 0);
});

console.log("page fraction and remembered-place round trips:");
const open = usableViewport(paper, rect(80,220), rect(820,1080));
const clean = usableViewport(paper, null, null);
const prevPad = 1100, zoom = 1.5, height = 1500;
for (const f of [0,0.1,0.25,0.5,0.9,1]){
  check("page fraction round-trips at " + f, () => {
    assert.ok(Math.abs(pageFrac(pageScroll(f,height,zoom,prevPad,open),
      height,zoom,prevPad,open) - f) < 1e-10);
  });
}
check("page head and foot align to the unobscured top and bottom", () => {
  const headScreen = paper.top + prevPad - pageScroll(0,height,zoom,prevPad,open);
  const footScreen = paper.top + prevPad + height*zoom - pageScroll(1,height,zoom,prevPad,open);
  assert.equal(headScreen, open.top);
  assert.equal(footScreen, open.bottom);
});
check("a place saved with docks restores to the same page-space point without them", () => {
  const pageY = 420;
  const withDocks = restorePageY(pageY, prevPad, zoom, open);
  const recorded = savePageY(withDocks, prevPad, zoom, open);
  const withoutDocks = restorePageY(recorded, prevPad, zoom, clean);
  assert.equal(recorded, pageY);
  assert.equal(savePageY(withoutDocks, prevPad, zoom, clean), pageY);
});
check("a page shorter than the usable viewport has one non-scrollable fraction", () => {
  const y = pageScroll(0.8, 300, 1, prevPad, open);
  assert.equal(y, pageTopBase(prevPad, open));
  assert.equal(pageFrac(y, 300, 1, prevPad, open), 0);
});

process.exitCode = bad ? 1 : 0;
```

index.html untouched: yes. sw.js untouched: yes. No git commands run: yes.
