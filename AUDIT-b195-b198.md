# Audit — the same class of problem, found by sweeping the code

Written during the b195–b198 run. Every row below is something I found by
reading the code or driving the app, not a guess about what might be wrong.

**Honest count: 44 problems, not 50.** I would rather hand you 44 real ones than
50 with six invented to reach a number. Ten are already fixed and shipped.

Severity: **H** = you would hit it in ordinary use · **M** = you would hit it
eventually · **L** = wrong, but you may never notice.

---

## A. Fixed and shipped in this run

| # | What you would notice | Where | Why it happened | Sev | Fixed in |
|---|---|---|---|---|---|
| 1 | Zoomed out, you scroll to the next page, it zooms back in | page turn | Zoom is stored per page. Arriving by scrolling loaded the next page's stored zoom. The earlier fix only covered pages with *no* stored zoom — which is almost none of them | H | **b195** |
| 2 | Tap 100%, come back to that page later, it is *bigger* than 100% | zoom label | It stored the fit-scale where a ratio-of-fit was expected, so loading multiplied by the fit twice. On your tablet that is ~169% | H | **b195** |
| 3 | The two nav chips sit solid on top of your writing | nav chips | They had no resting state | M | **b196** |
| 4 | Insert a page in the middle of a chunk and the chunk splits into three headings | insert page | The inserted page was created with no chunk. My own regression from b193 | H | **b196** |
| 5 | Maths written in a working sheet or short note never renders | sheets | `renderMath` was never once called on the sheet — only the note | H | **b197** |
| 6 | An attachment in a sheet becomes an unclickable label after you turn a page | sheets | Turning a page inside a sheet never re-hydrated the chips, and the click handler is attached during hydration | M | **b197** |
| 7 | Straight quotes in a sheet, curly ones in a note | sheets | Smart quotes and shorthand bound to the note only | M | **b198** |
| 8 | A typed web address does not become a link in a sheet | sheets | Autolink bound to the note only | M | **b198** |
| 9 | Long-pressing a link inside a sheet does nothing | sheets | Link menu bound to the note only | L | **b198** |
| 10 | The last letters typed in a sheet can be lost if you tap away fast | sheets | The sheet had only a 700 ms timer; the note also saves on blur | M | **b198** |

## B. Found, not yet fixed — ranked

| # | What you would notice | Where | Why it happens | Sev | Fixed in |
|---|---|---|---|---|---|
| 11 | Duplicate a notebook and every chunk grouping is gone from the copy | `duplicateNotebook` | It copies and re-points notes and sections but never chunks | H | not yet |
| 12 | Copy a page into another notebook and it points at a chunk that lives in the first one | `duplicateNote` | `sectionId` is cleared on a cross-notebook copy; `chunkId` is not | M | not yet |
| 13 | A recording does not line up with what you wrote in a sheet | audio | Caret stamping is bound to the note only | M | not yet |
| 14 | Find & Replace never searches the sheet you have open | find bar | It walks the note's markup only | H | not yet |
| 15 | The outline pane ignores headings in a sheet | outline | Note-only | M | not yet |
| 16 | The word count never counts what is in a sheet | footer | Note-only | L | not yet |
| 17 | Export as PNG or PDF cannot export a sheet page | export | Note-only | M | not yet |
| 18 | You cannot bookmark a sheet page | bookmarks | Note-only | M | not yet |
| 19 | You cannot tag a sheet page | tags | Note-only | M | not yet |
| 20 | There is no "insert a page here" inside a sheet — only "+ Page" at the end | sheets | Only the append path was built | M | not yet |
| 21 | The `S2C4P5` address is computed but shown nowhere | chunks | The arithmetic shipped in b192; nothing displays it | M | not yet |
| 22 | Chunks are not a column in the side panel | chunks | Only the in-list headings were built | M | not yet |
| 23 | The section list's page count ignores chunk grouping | sections column | Counts pages, not sittings | L | not yet |
| 24 | Pictures cropped on an older build never sync to the other device | sync | Needs a resend list; deferred in b179 | M | not yet |
| 25 | `nplace:` (where you were on each page) is written but never read back | scroll memory | Half-built | L | not yet |
| 26 | A preview band shows a neighbouring page without its chunk heading | peek bands | Previews predate chunks | L | not yet |
| 27 | Attachments, recordings and maths show as a small grey label in a preview band | peek bands | Only pictures and ink are hydrated for real | M | not yet |
| 28 | 78 scroll-seam scenarios have never actually run | `chipseam-matrix.mjs` | Needs a browser driver this machine cannot reach | M | not yet |
| 29 | The sheet's four heights have only ever been checked with animations disabled | sheets | This preview browser freezes CSS transitions | L | not yet |
| 30 | A short note's stored title is the word "Summary" for every one of them | short notes | Only the search row was taught to name them properly (b190) | M | not yet |
| 31 | The chunk you are in is not shown anywhere on the page itself | chunks | No badge on the page | M | not yet |
| 32 | A chunk cannot be reordered, split or merged | chunks | Only create / rename / remove exist | M | not yet |
| 33 | A page cannot be dragged from one chunk to another | chunks | No move UI | M | not yet |
| 34 | Moving a page to another section leaves it pointing at a chunk in the old one | move page | The section changes; the chunk does not | M | not yet |
| 35 | Nothing offers to start a chunk when you make a page in a *new* section | chunk offer | The first page of a section is deliberately never offered one | L | by design |
| 36 | The chunk offer never appears for a page made by Insert | insert page | Only the append path asks | M | not yet |
| 37 | A working sheet cannot be turned into an ordinary page | sheets | No promote action | M | not yet |
| 38 | A short note cannot be turned into an ordinary page either | short notes | Same | M | not yet |
| 39 | Undo inside a sheet cannot reach a picture move or crop | sheet undo | b188 covered text and ink; picture geometry is its own history | M | not yet |
| 40 | Two sheets open on two devices can overwrite each other with no warning | sync | Sheets are last-writer-wins; only ordinary pages get the keep-both twin | M | not yet |
| 41 | The daily backup carries no recordings, and nothing says so at restore time | backup | Deliberate (size), but the restore screen is silent about it | M | not yet |
| 42 | A page restored from the bin does not bring its chunk back if the chunk was removed | restore | Restore repairs notebook and section, not chunk | L | not yet |
| 43 | The Chunk button is enabled on a page in a drawer and only refuses after you press it | chunks | It says no rather than being greyed out | L | not yet |
| 44 | Search cannot be limited to one chunk | search | No filter | L | not yet |

---

## What I would do next, in this order

1. **#14 Find & Replace in the open sheet** — you will hit this the first time
   you try to correct a term across your rough working.
2. **#11 and #12, the chunk copies** — silent data faults that get worse the
   longer they sit, because they only surface once you have many chunks.
3. **#21 and #31, showing the address and the chunk you are in** — the
   arithmetic already works; nothing displays it, so the feature is half
   invisible.
4. **#20 insert a page inside a sheet** — the same gap you reported for the
   main notes, one level down.
5. **#24 the picture backfill**, because it is the only one on this list that
   loses something rather than merely failing to show it.
