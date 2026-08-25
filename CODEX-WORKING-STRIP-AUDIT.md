# Codex audit handoff: Working pages and Strip viewport

Date: 2026-08-25

This is a diagnosis and test handoff for Claude Code. Codex did not edit
`index.html` or `sw.js`, did not bump the build, and ran no Git commands.
Line numbers are a snapshot of the active working tree and may move; search by
function name when they do.

## Required implementation order

1. Fix the two P0 migration/purge defects before feature work.
2. Fix the P1 image ownership, image sync, duplicate-pin, Cover and Relink defects.
3. Implement one shared effective-page-viewport helper before adding the Strip.
4. Update and run `tests/viewport.mjs`, then run all existing suites and browser tests.
5. Address medium/low sibling-path defects.

## Ranked data-integrity findings

### P0 — critical

1. **b168 data is not actually repaired by b169.**
   - Location: `migrateWorkingToNotes`, approximately `index.html:4786-4820`.
   - Mechanism: `old.filter(p => p && p.id && !byId[p.id])` excludes every legacy
     row that already has the same-ID note created by b168. Missing unknown fields,
     erased/restored maps, height, tombstones and wrongly minted ink assets therefore
     remain damaged permanently.
   - Repro: seed a legacy practice plus an already-converted same-ID b168 note that
     lacks those fields, then boot b169. The repair never examines it.
   - Minimal fix: add an explicit revisioned repair pass that also examines same-ID
     rows. Merge only absent information; preserve newer note HTML/title; merge
     erasure maps and maximum height; reuse an existing page asset; apply an old
     tombstone only when no later restore/edit proves the note is newer.

2. **Hard-purged Working pages can return; parent purge can destroy rollback data.**
   - Location: `purge`, approximately `index.html:5325-5339`; inherited by
     `emptyTrash` and `purgeExpired`.
   - Mechanism: the note is deleted by its ID, but legacy practices are deleted via
     `practices.by_note == id`. A Working row's primary key is the Working page ID
     while its `noteId` is the parent page ID. Purging the child leaves its legacy
     row, so boot can recreate it. Purging the parent deletes legacy rows belonging
     to surviving Working children.
   - Repro A: permanently delete a migrated Working page, restart, and observe the
     surviving legacy row recreate it.
   - Repro B: purge an ordinary parent page whose Working child is deliberately kept;
     the child's legacy rollback source disappears.
   - Minimal fix: for every explicitly purged note ID, delete the legacy row by
     primary key `pr.delete(id)`. Do not cascade legacy rows merely through the
     parent's `by_note` index. Notebook purge already gathers every child ID.

### P1 — high

3. **Images inserted into Working/Summary sheets belong to the main page.**
   - Location: `insertImageFile`, approximately `index.html:13428-13434`.
   - Mechanism: it always uses `state.note.id`, although `activeTextHost()` may be
     `#pracText`. The figure is in sheet HTML while its asset belongs to the parent.
   - Consequences: duplication can miss the image; copies can share the old asset;
     parent purge can remove it; child purge can leak it.
   - Minimal fix: one `activeNoteId()` helper returning `prac.rec.id` for an active
     sheet and `state.note.id` otherwise. Use it for image and future attachment
     ownership. The existing failing assertion in `tests/bringin.mjs:68-70` is right.

4. **Synced cropped images lose their pristine Uncrop bytes.**
   - Locations: `stripBlobs` around `5821`, `imageDataChunks` around `5835`,
     `finishImage` around `20063`, and `attachImageBytes` around `20143`.
   - Mechanism: both `blob` and `orig` are stripped, but chunking/restoration handles
     only `blob`.
   - Minimal fix: sync two explicitly named byte slots, `blob` and `orig`, with
     collision-free chunk IDs; assemble/store independently and tombstone stale
     `orig` chunks when no original remains. Add a two-device crop-sync-Uncrop test.

5. **Duplicated Working-sheet pins retain old child IDs.**
   - Locations: `duplicateNote` around `5085-5147`; `duplicateNotebook` around
     `5178-5230`.
   - Mechanism: children receive new IDs, but copied parent HTML still contains old
     `span.pracpin[data-pracid]` values.
   - Minimal fix: build old-child-ID to new-child-ID mappings and rewrite exact
     `data-pracid` attributes in the copied parent HTML. Test with at least two sheets.

6. **Duplication loses or misdirects Cover metadata.**
   - Location: the same duplication functions.
   - Mechanism: `duplicateNote` uses a field whitelist and drops Covers, bookmarks
     and future metadata. `duplicateNotebook` preserves Covers but leaves their
     internal page IDs pointing to the original notebook.
   - Minimal fix: clone the complete source record, deep-copy structured metadata,
     override identity fields, and remap internal Cover references through the new
     notebook's page-ID map. Preserve genuinely external references.

7. **Cross-notebook Relink updates only half the relationship.**
   - Location: `relinkWorkingHere`, approximately `index.html:9600-9609`.
   - Mechanism: it changes only `worksFor`; it does not move the child to the target
     notebook's Working drawer, fix order/title, remove the old pin or create/update
     the target pin consistently.
   - Minimal fix: one coordinated routine updating old/new parents, `notebookId`,
     drawer `sectionId`, order/title and both pins. If the old source is missing,
     still repair ownership and create the new relationship.

### P2 — medium

8. Old-backup Working rows are converted without a Working drawer even when their
   parent is known. Import currently calls the converter with a null drawer. Ensure
   the target notebook's Working drawer first and assign its section ID.

9. `exportNotebook` around `index.html:5573-5590` still exports legacy practice rows
   beside the notes they became. Full-library export is fixed. Export an empty
   `practices` collection for represented rows, retaining only genuinely unmigrated
   rows if rollback compatibility requires them.

10. Search around `index.html:4354-4388` includes current Working notes in ordinary
    results, then searches legacy practices again when “Include Working” is enabled.
    Default search should exclude Working notes; enabled search should use current
    Working notes and legacy rows only when no migrated note exists.

11. `practiceAll` around `index.html:4397` infers parent order from `SxPy` titles.
    Custom names and reordered pages therefore sort incorrectly. Use the notebook's
    actual section/page order to build a parent-ID index, then `workOrder`, with
    orphans last.

### P3 — lower

12. `suggestSectionName` around `index.html:4006-4014` counts Working/Summary drawer
    sections, allowing automatic `SecN` names to skip numbers. Count ordinary
    sections only.

13. `nplace:<pageId>` is written by `savePlace` but no corresponding read was found.
    Read page-specific place first for an explicit page open, then fall back to the
    notebook-level place.

## Paths checked and currently sound

- `notesSnapshot` excludes drawer pages from counts while legitimately retaining
  stars/bookmarks.
- `practicesGrouped` reads current migrated Working notes and sorts sheet order.
- `cloneAsset` preserves blobs, crop originals and unknown asset fields.
- Full-library `exportBundle` no longer exports migrated pages twice; the remaining
  sibling defect is `exportNotebook`.

## Strip viewport contract

The Strip must use one shared helper, suggested name
`effectivePageViewport(paper = $("paper"))`.

It should return at least:

```js
{
  paperRect,
  top,
  bottom,
  height,
  topInset,
  bottomInset,
  clientHeight,
  pageBase
}
```

Definition:

- Begin with `paper.getBoundingClientRect()`.
- Include the top Summary/Strip only when visible and physically intersecting the
  top of `#paper`.
- Include the bottom Working sheet only when visible and physically intersecting
  the bottom of `#paper`.
- Do not subtract the docbar today: flex layout already places it outside `#paper`.
  Include it only if it later becomes a true overlay intersecting the paper.
- Do not count floating favourites, chips or small popup bars as viewport occlusion.
- Compute `top`, `bottom`, usable `height`, `topInset`, `bottomInset`, effective
  `clientHeight`, and `pageBase = prevPad() - topInset` once.

Canonical conversions:

```js
pageYAtVisibleTop =
  (paper.scrollTop - prevPad() + viewport.topInset) / zoom;

scrollTopForPageY =
  prevPad() - viewport.topInset + pageY * zoom;

pageScrollableSpan =
  Math.max(0, pageHeight * zoom - viewport.height);

scrollForFraction = viewport.pageBase + fraction * pageScrollableSpan;
fraction = (paper.scrollTop - viewport.pageBase) / pageScrollableSpan;
```

At physical first/last scroll limits, use normal clamping. Do not insert fake scroll
spacers to manufacture negative scroll positions.

### Placement decision

The Strip must be a fixed sibling outside both `#body` and `#paper`'s scrolling
content. Inside `#body` it can be serialized into the note and duplicate IDs. Inside
`#paper` it changes scroll height, `prevPad`, handwriting origin and page-join math.
If permanent layout room is desired, reserve it around `#paper`, never with a child
inside page scroll content.

### Saved scroll behaviour

Store semantic, unzoomed page Y at the effective visible top:

```js
pageY = (scrollTop - prevPad() + topInset) / zoom;
```

Restore under the current dock state:

```js
scrollTop = prevPad() - currentTopInset + pageY * zoom;
```

Thus the same content remains first visible when Strip state changes. Opening or
closing the Strip live should capture page Y before layout, then restore it after
layout/ResizeObserver settles. Legacy saved `top` values should be interpreted as
having `topInset = 0`.

## Complete viewport call-site map

| Approx. line | Function/path | Current read | Required change | Failure if missed |
|---:|---|---|---|---|
| 6974 | `paintDoc` chip landing | `clientHeight` | Delegate to helper-aware `pageScrollFor` | Release can land below visible content. |
| 16208 | `savePlace` | `scrollTop-prevPad()` | Save semantic visible-top page Y | Open/closed Strip restores shifted. |
| 16243 | `restoreScroll` | saved top + `prevPad()` | Restore semantic page Y with current inset | Content moves when dock state differs. |
| 16303 | `listProgress` | raw scroll/page height | Delegate to helper-aware `pageFracNow` | Chip and page disagree. |
| 16338 | `chipTrack` | raw paper rect and 28px pad | effective top/height | Chip travels under docks. |
| 16390 | `paintNavChips`/`placeChip` | track delegate | retain one helper-aware path | Label and position can diverge. |
| 16452 | `pageScrollFor` | raw `clientHeight`, `prevPad` | effective height/pageBase | Head/foot lands incorrectly. |
| 16459 | `landOnPage` | `pageScrollFor` | keep delegation | Direct raw math recreates joins. |
| 16520 | `pageFracNow` | raw `clientHeight`, `prevPad` | exact inverse of `pageScrollFor` | Release fraction differs from drag. |
| 16534 | `chipPeekReady` | raw rect 40/60% | effective top + height thresholds | Remount occurs early/late. |
| 16571 | `chipPeekGeometry` | raw top/height | effective top/height | Chip join and page join disagree. |
| 16600 | `driveChipPeek` | geometry delegate | keep delegation | Separate math causes bounce. |
| 16616 | `driveChipScroll` | raw `clientHeight` | effective height | Seek speed/reveal distance is wrong. |
| 16712 | `armChipHandover` | raw thresholds/anchor offsets | effective coordinates | Chip swap visibly jumps. |
| 17292 | `pageHandover` | raw rect 40/60% | effective thresholds | Finger swap triggers in hidden space. |
| 17434 | `finishHandover` | raw rect/clientHeight | pageBase and effective top/bottom/height | New page settles at wrong Y. |
| 17780 | `pageBottom`/`atPageEnd` | `scrollTop+clientHeight` | effective visible bottom offset | End is considered visible behind sheet. |
| 17795 | `flowTo` backward landing | bottom minus raw clientHeight | `pageScrollFor(target, 1)` | Upward transition clips page foot. |
| 17867 | `visibleStrokes` | raw top/height | effective inset/height for note surface | Dock-covered ink is culled incorrectly. |
| 17914 | `autoScroll` | raw scroller bottom | effective bottom | Nib behind sheet scrolls late. |
| 18518 | `stepFind` | native `scrollIntoView` | shared reveal helper | Search result hides under Strip. |
| 18607 | `paintOutlineHere` | paper top + 40 | effective top + 40 | Wrong current heading. |
| 18854 | `revealBounds` | raw clientHeight | effective page Y/height | Undo target hides under dock. |
| 18879 | `revealCaret` | native centre scroll | shared reveal helper | Caret centres in obscured area. |
| 19286 | `jumpTop` | `prevPad()` | `pageScrollFor(current,0)` | Page head hides under Strip. |
| 19303 | `jumpBottom` | raw clientHeight | `pageScrollFor(current,1)` | Page foot hides behind sheet. |
| 14273 | `lassoPromote` | `scrollTop/zoom+60` | visible-top page Y + 60 | Kept selection is misplaced. |
| 11746 | `placeLassoPop` | window bounds | effective page bounds | Popup hides behind docks. |
| 13648 | `placeImgBar` | window bounds | effective page bounds | Image controls are obscured. |
| 14844 | `openHoldMenu` | window bounds | effective page bounds | Menu appears behind a dock. |
| 9385 | `showZoomPop` | window bounds | effective bounds when page-owned | Zoom controls can be hidden. |
| 12745 | outline heading reveal | native `scrollIntoView` | shared reveal helper | Heading hides beneath Strip. |
| 15159 | `landAnchor` | native centred reveal | shared reveal helper | Anchor lands in hidden area. |
| 15546 | `followAudio` | native centred reveal | shared reveal helper | Followed text is obscured. |

Functions that must remain viewport-independent:

- `startGlide`: raw movement delta integrator.
- `fingerPanMove`: raw finger delta.
- `rebasePan`: raw `scrollTop` rebasing after a swap.
- `nearPageFoot`: stored page coordinates.
- `growForInk`: stored page height.
- `pageHeightFor`: content/page geometry.
- Peek-band sizing: use `pageHeightOf/pageHeightFor`; only join thresholds use the
  viewport helper.
- `clientToPageY`: pointer client coordinates are already physical screen values.

## Test handoff

`tests/viewport.mjs` exists and passes `node --check`. Its pure reference geometry
tests pass; source-contract checks are expected to remain red until the shared helper
is implemented.

Before relying on it, make these two selector corrections (the final Codex sandbox
write failed after the file itself had already been created):

```diff
-const anchor = span("function scrollToAnchor", "/* ---- attachments");
+const anchor = span("function landAnchor", "/* ---- attachments");

-const currentHeading = span("function paintCurrentHeading", "function paintOutline");
+const currentHeading = span("function paintOutlineHere", "/* ---- 23.");
```

Then implement the helper, update the contract only when the source design is
deliberately different, and run all suites plus real-browser tests with:

- Strip shut/open while crossing both page directions.
- Working sheet shut/partly open/maximised.
- Strip and Working sheet open together.
- Finger drag, momentum glide, blue chip and grey chip.
- First/middle/last page, unequal page heights, cold and warm neighbouring pages.
- Save under one dock state and restore under the opposite state.

## Existing suites that are incomplete or wrong

- `tests/working.mjs:57-58` misses already-converted same-ID b168 rows.
- `tests/working.mjs:65-66` checks full export but misses `exportNotebook`.
- `tests/working.mjs:85-95` misses parent `data-pracid` remapping.
- No current test covers direct/empty/expired purge resurrection or parent-purge
  rollback loss.
- No current test covers two-device sync of image `orig` bytes.
- `tests/drawers.mjs:53-54` misses `suggestSectionName`.
- `tests/drawers.mjs` lacks cross-notebook Relink coverage.
- `tests/covers.mjs:85` requires redundant `notebookId`; decide the Cover reference
  schema explicitly rather than accidentally pinning it.
- `tests/strip.mjs:37` omits `effectivePageViewport` from its helper-name list.
- `tests/strip.mjs:54-55` covers only top occlusion, not bottom Working sheet.
- `tests/strip.mjs:91-95` models only a top inset.
- `tests/sheetstates.mjs:73-75` mixes pixels with fractional state values.
- `tests/bringin.mjs:92-99` computes visible slice without effective insets.
- `tests/bringin.mjs:68-70` is correct and currently exposes the real image-owner bug.

## Safety confirmation

`index.html` untouched by Codex: yes. `sw.js` untouched by Codex: yes. No Git
commands run by Codex: yes.
