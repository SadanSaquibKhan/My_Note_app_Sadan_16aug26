# CODEX-SCROLL-FINDINGS — b151 state-machine diagnosis

**Mode:** diagnosis only. No app code was edited.  
**Source inspected:** committed b151 `index.html` (app commit `a1e180a`; the later
HEAD commits only add documentation/tests).  
**Scope:** blue section chip, grey notebook chip, release path, page handover,
one-/two-finger scrolling, momentum, variable page sizes, first/last pages and
section boundaries.

## Executive finding

The reported freeze and snap-back has one clear state-machine root:

1. During a drag, the chip UI deliberately follows `chipDrag.want` (the finger),
   while the page follows the mounted `visualNoteId()` asynchronously.
2. Once a page swap or direct page load starts, `chipSeek` repeatedly returns from
   `swapping()` or `chipLoading()`. The label can therefore count P10 → P9 → … →
   P6 while the mounted page remains P10.
3. On release, `endChip` calls `chipSeek(true)`, but the `force` argument is never
   read. The same blocking return happens, then `chipDrag`—including the final
   `want`—is immediately erased.
4. `paintNavChips()` then has no finger target and repaints from the last
   requested/mounted page. That is the observed snap-back.

The smallest correct repair is not to slow the label. It is to make the latest
chip target durable outside `chipDrag`, coalesce in-flight page loads toward that
latest target, and guarantee that release drains that final target after any
current handover/load settles.

## Exact answers to the requested state-machine questions

### 1. What moves the chip and its number on `pointermove`?

- `index.html:15819-15826` converts the finger's `clientY` to raw track progress,
  then writes both `chipDrag.prog` and `chipDrag.want`.
- `index.html:15383-15407` makes both labels read `chipDrag.want.note`, not the
  mounted page.
- `index.html:15830-15831` repaints the labels and directly places the dragged
  chip at the raw finger progress.
- `index.html:15408-15411` deliberately does **not** place either chip from page
  progress while a drag exists.

Therefore, during the drag the number and dragged-chip position follow the
finger even if no page has moved or mounted. The page itself is driven separately
by `chipSeek()`.

### 2. Every active `chipSeek` return, and which repeats

`chipSeek` is at `index.html:15739-15782`.

| Return | Lines | Meaning |
|---|---:|---|
| No drag/progress | `15740` | Nothing to seek yet. |
| `swapping()` | `15745` | A neighbour handover is busy or pending. Every animation frame returns until `finishHandover` clears it. |
| `driveChipScroll(...)` succeeded | `15751` | In-page scroll or preview movement happened. It also returns true after asking `pageHandover`, even if that request was refused. |
| No `want` | `15754-15755` | No target page. |
| Immediate neighbour | `15761-15771` | Maxes the neighbour preview, optionally calls `pageHandover`, then **always returns**, including when `chipPeekReady` is false or `pageHandover` refuses. |
| Target is mounted | `15773` | Lands within the mounted page. |
| `chipLoading()` | `15774` | A direct far-page request is still loading; all newer targets are ignored. |
| Same `pendingId` | `15775` | Refuses to issue the same page request again; also fails to refresh a newer fraction on that page. |

The approximately 400 ms cooldown is one level below `chipSeek`:

- A chip handover sets 400 ms because `pan.on` is false
  (`index.html:16220-16221`).
- `pageHandover` returns during that period (`index.html:16190`).
- Nevertheless, `driveChipScroll` and the immediate-neighbour branch return as
  if the handover had progressed (`index.html:15641-15650`, `15762-15771`).

For a moderate-speed multi-page drag the repeating sequence is normally:

1. `swapping()` while the first neighbour mounts (`15745`);
2. the immediate-neighbour return while the 400 ms cooldown refuses the next
   handover (`15762-15771` plus `16190`);
3. `chipLoading()` after the finger moves far enough to start one direct load
   (`15774`).

The dominant long freeze is usually `chipLoading()`: the code insists that the
old requested page finish before it will request the page now under the finger.
The exact mix depends on IndexedDB/render latency, but all three gates allow the
label to run ahead because labels are updated before `chipSeek` runs.

### 3. What happens on release?

`endChip` is at `index.html:15834-15863`; the document fallback repeats the same
logic at `15879-15890`.

1. It calls `chipSeek(true)` (`15845` or `15883`).
2. `force` is unused anywhere in `chipSeek` (`15739-15782`), so release can still
   return at `swapping`, neighbour-not-ready/cooldown, `chipLoading`, or
   `pendingId`.
3. It immediately sets `chipDrag = null` (`15846` or `15884`). The final
   `chipDrag.want` is now unrecoverable.
4. `paintNavChips()` runs (`15862` or `15890`). With no drag, the label falls
   back to `currentPageId()/state.noteId` (`15389-15391`), while chip position is
   recomputed by `listProgress`, which primarily reads the mounted visual page
   (`15282-15302`).

So release does **not** reliably seek to the finger's final target. It merely
makes one ordinary, blockable seek attempt and then falls back to the last page
the app managed to request/show. This exactly explains P6 snapping back to P10.

### 4. Can `handover.busy`, `pending`, or `queued` stay stuck?

- `handover.busy/pending` have a 2.5 s guard (`index.html:16277-16289`), so an
  ordinary failed handover should not freeze forever.
- Direct chip loading is not represented by `handover` at all. Its only flag is
  `chipDrag.pendingId` (`15532-15534`), with no timeout/failure reset. A failed
  direct load can therefore freeze the held drag indefinitely.
- Releasing deletes `chipDrag`, so it also deletes the only record of that
  direct load. Other scroll code can then run while `state.noteId` and the
  mounted page still disagree.
- `handover.queued` is consumed only on the non-held settle path
  (`16448-16455`). The held path returns at `16408`, and the 2.5 s guard does not
  clear `queued`. A stale queued target can survive and fire after a later,
  unrelated handover.
- If `#paper` is absent, `finishHandover` clears `busy` but returns without
  removing the `swapping` class or draining `queued` (`16328-16330`). This is
  unlikely in a normal open note but is an incomplete cleanup path.

## Ranked findings and minimal fixes

### S0 — Final target is discarded on release

**Lines:** `15739-15782`, `15834-15863`, `15879-15890`  
**Confidence:** certain.

**Mechanism:** `force` is unused; release can hit any normal early return, then
deletes `chipDrag.want` and repaints from mounted/requested state.

**Two-direction repro:** On S2P10, drag either chip toward S2P6 and release while
the page is frozen; repeat from S2P6 toward S2P10. The label reaches the finger,
then returns to the last page actually shown.

**Smallest correct fix:** Snapshot the final `{page id, fraction}` before clearing
`chipDrag`. Make `force` bypass ordinary drag gates: if a handover is active,
queue that snapshot durably; otherwise supersede any direct load with the final
target. Clear the durable target only after that page is mounted and its fraction
has been applied. Do not repaint position from `listProgress` while a final
release target is still pending.

### S0 — In-flight direct loads cannot be retargeted to the latest finger target

**Lines:** `15473`, `15532-15534`, `15774-15781`, `15787-15790`  
**Confidence:** certain.

**Mechanism:** `CHIP_SEEK_MS` and `lastSeek` are effectively dead; one direct
load blocks every newer target until it mounts. `chipChase` keeps scheduling but
does no work at `chipLoading()`.

**Two-direction repro:** Drag across at least four pages at normal speed. Delay
page reads by 200–500 ms. In either direction, the first requested page loads
while the finger has already crossed several more page bands.

**Smallest correct fix:** Use the existing 130 ms value as a real coalescing
interval. If `want.id` differs from the in-flight requested id, request the
latest target and let `renderSeq` discard the stale render (`6504-6534`). Do not
mount each intermediate page. Keep one durable requested-id state outside
`chipDrag`, so release cannot erase it.

### S0 — Direct chip navigation can lose unsaved text or save old ink to the new page

**Lines:** `5569-5580`, `6512-6534`, `8433-8441`, `15776-15781`  
**Confidence:** high from control flow; device impact should be verified with a
delayed-save test.

**Mechanism:** The direct far-page path calls `openPage` without first calling
`flush`. `render()` changes `state.noteId` synchronously (`6520`) before the old
DOM is replaced. A queued ink save reads that new id (`8436`) while still holding
the old page's strokes. Separately, `finishRender` clears `state.dirty` (`6580-6589`),
so typing done just before a far chip scrub can be discarded before its 700 ms
save runs.

**Two-direction repro:** Write a fresh ink stroke or type a character, immediately
scrub several pages in either direction, then reopen both source and target
pages. Check for missing source edits and duplicated/foreign ink on the target.

**Smallest correct fix:** Before every direct chip `openPage`, call `flush()`
synchronously (do not wait for the promise; capturing ids/body must happen before
`render` changes state). More robustly, make the ink surface save against its
mounted/owned note id rather than late-reading global `state.noteId`.

### S1 — Direct page loading disappears from the state machine on release

**Lines:** `15180-15182`, `15532-15534`, `15846`, `16186`, `16561-16563`,
`16609-16615`  
**Confidence:** high.

**Mechanism:** `swapping()` knows only `handover`; `chipLoading()` exists only
while `chipDrag` exists. After release, an unfinished direct render has no
loading flag even though `state.noteId` already names the requested page and
`visualNoteId()` still names the old page. `pageHandover` can resume and
`neighbourPage()` chooses neighbours from requested `state.noteId`, while it is
measuring the old page's DOM.

**Two-direction repro:** Start a far scrub, release immediately, then continue a
finger scroll while the target page is still loading. Repeat upward and downward.
The app can choose a neighbour of the requested page using geometry from the old
page, causing a skip or reverse jump.

**Smallest correct fix:** Add one page-mount state independent of chip lifetime,
or define mounting as `state.noteId !== visualNoteId()`. Make `swapping`,
`pageHandover`, scroll-place saving and release drainage respect it until the
requested page is actually mounted.

### S1 — The 400 ms chip cooldown and unconditional neighbour return create a visible stall

**Lines:** `15632-15652`, `15761-15771`, `16190`, `16220-16221`  
**Confidence:** high; bounce risk after changing the cooldown must be regression-tested.

**Mechanism:** A chip gets the 400 ms cooldown because it is not `pan.on`.
During that time the neighbour branch repeatedly puts the preview at its limit,
calls a handover that returns, then returns itself. The page visibly stops at the
join while labels continue.

**Two-direction repro:** Slowly cross one join, keep the chip held, and continue
into the next page within 400 ms; repeat in reverse. The preview reaches its
limit and waits.

**Smallest correct fix:** Do not apply the fling anti-bounce cooldown to an
actively controlled chip. `busy/pending`, the 40/60 hysteresis, and the durable
mount state should remain the single-flight guards. Preserve the existing
measured preview and join-carry design.

### S1 — Drag mapping and repaint mapping are not mathematical inverses

**Lines:** `15282-15302`, `15304-15315`, `15431-15442`  
**Confidence:** certain.

**Mechanism:** `progressToPlace` defines page fraction over full virtual page
height `h`. `pageScrollFor` applies that fraction to the scrollable span
`h*zoom - viewport`. After release, `listProgress` divides the resulting scroll
offset by zoom and inserts it directly into the full `h`. That loses
`fraction * viewport/zoom`, so even a successful same-page drag repaints the chip
upward/backward.

**Two-direction repro:** On one page taller than the viewport, drag the chip to
about 80% of that page's band and release without crossing a page. Repeat upward.
The page lands at one location but the chip repaints at a different track point.

**Smallest correct fix:** In `listProgress`, first compute the page fraction from
the same scrollable span used by `pageScrollFor`, then convert that fraction back
to virtual page height: `(acc + frac*h) / total`. Add an explicit round-trip test
`progress → pageScrollFor → listProgress` at 0%, 25%, 50%, 100% and several zooms.

### S1 — Flexible live page heights are not the heights used by chip seeking

**Lines:** `15273-15279`, `15431-15436`, `6276-6280`, `16090-16119`,
`17137-17155`  
**Confidence:** high.

**Mechanism:** `pageSpan/pageHeightOf` is only `page floor + manual extra`.
`#body` uses that as a **minimum** height, so enough typed content, hydrated
media, maths or other flow content can make the live/preview DOM taller. The
chip's virtual bands and landing span remain shorter than the rendered page.
This is especially harmful because the user intentionally keeps unequal,
flexible page lengths.

**Two-direction repro:** Put many paragraphs/media on one page and leave its
neighbour nearly empty. Drag both chips across that pair in both directions.
The label boundary and release fraction occur before/after the visible page
boundary.

**Smallest correct fix:** Cache/persist each page's measured unzoomed rendered
height and make `pageSpan` use `max(stored sheet height, measured content height)`.
Update the cache after layout-affecting hydration/edits. Preview and live page
must keep using the same value.

### S1 — Old asynchronous scroll/zoom work can modify a newer page

**Lines:** zoom `15162-15165`; restore `15222-15245`; call sites `6285`,
`6319-6345`  
**Confidence:** certain from missing id/sequence guards.

**Mechanism:** `loadNoteZoom(id)` applies its result without confirming that `id`
is still mounted. `restoreScroll` retries for up to 12 × 60 ms without a page id
or render token. A rapid chip change can therefore receive an old page's zoom or
old page's remembered scroll after the new page is visible, creating a jump or
moving the chip track under the finger.

**Two-direction repro:** Give adjacent pages different saved zooms and a deep
saved position. Open one and immediately scrub through several pages in either
direction while hydration is slow.

**Smallest correct fix:** Capture page id plus render/restore generation. Before
every apply/retry, require it still equals `visualNoteId()` and the current
generation; cancel the previous restore timer when navigation starts.

### S1 — `savePlace` can store old visual scroll under the newly requested page

**Lines:** `15187-15213`, `15779-15781`, `6512-6520`  
**Confidence:** high.

**Mechanism:** A direct chip render changes `state.noteId` immediately but is not
`swapping()`. A queued 400 ms place save can read the old mounted scroller and
write it to `place:<notebook>` and `nplace:<new state.noteId>`.

**Two-direction repro:** On a deep position in a tall page, scrub far enough to
direct-load another page and release during the load. Reopen the destination;
its remembered location may be copied from the source page.

**Smallest correct fix:** `savePlace` must require
`visualNoteId() === state.noteId` and no active page mount/chip drag. Store using
the visual id, not a requested id.

### S1 — Finger release can start momentum while handover is still settling

**Lines:** glide `8299-8334`; handover `16218-16330`; finger release
`18364-18368`  
**Confidence:** high.

**Mechanism:** If the finger lifts after `pageHandover` starts but before
`finishHandover` completes, `fingerPanUp` starts a new glide immediately. That
glide writes `scrollTop` while handover also anchors/settles it, producing a
one-time jump or shiver. The existing `glideCarry` only captures a glide that was
already running when handover started; it does not capture this later release.

**Two-direction repro:** Flick across a boundary and lift exactly while the
neighbour is becoming live; repeat forward and backward with long momentum.

**Smallest correct fix:** When finger-up occurs during busy/pending handover,
store its velocity in `handover.glideCarry` instead of starting a glide. Let the
existing post-anchor path start it once.

### S1 — Two-finger scrolling fights the 16-frame settle loop

**Lines:** two-finger writes `8337-8393`; held detection `16346-16349`;
settle loop `16373-16433`  
**Confidence:** medium-high; verify with native two-touch input.

**Mechanism:** `stillHeld` recognizes one-finger `pan` and chip drag, but not an
active two-finger gesture. Two-finger moves continue writing `scrollTop` while
`finishHandover` treats the page as unheld and may correct it for up to 16
frames. The two writers can visibly shiver.

**Two-direction repro:** Keep two fingers down while panning across a page or
section boundary; continue moving during the mount, in both directions.

**Smallest correct fix:** Include an active two-finger gesture in `stillHeld` and
use the one-correction held path. Rebase its incremental centre after the anchor,
or pause its writes while busy and resume from the current centre.

### S2 — Handover cleanup can preserve a stale queued jump

**Lines:** guard `16281-16289`; held return `16389-16408`; queued drain
`16448-16455`  
**Confidence:** medium.

**Mechanism:** The held path and timeout guard do not drain/clear
`handover.queued`. A target queued during one swap can execute after a later
unrelated swap.

**Two-direction repro:** Queue/release a target during a deliberately delayed
handover, let the guard fire, then cross another boundary in the opposite
direction. Watch for a jump to the old target.

**Smallest correct fix:** Give queued targets a generation/owner and drain or
clear them on every terminal path: held completion, unheld completion, timeout,
cancel and missing-paper return.

### S2 — Non-drag labels and neighbour lookup prefer requested state over mounted state

**Lines:** label `15389-15391`; `applyChipPlace` `15455-15457`;
`currentPageId` `16561-16563`; neighbour `16609-16615`  
**Confidence:** high.

**Mechanism:** `currentPageId()` is only `state.noteId`, yet several paths use it
before `visualNoteId`. During an asynchronous direct load, labels can name the
requested page while position/geometry still belongs to the old mounted page;
`applyChipPlace` can also treat an unmounted requested page as current and scroll
the old page with the new fraction.

**Two-direction repro:** Release during a delayed direct load, then observe labels
and use a start/end chip tap or finger movement before mounting completes.

**Smallest correct fix:** For geometry and visible UI, always prefer
`visualNoteId()`. Use requested state only for routing/loading bookkeeping.

### S2 — Fixed `pageStick` floor spans multiple pages in very large notebooks

**Lines:** `15485-15498`, `15536-15546`  
**Confidence:** certain mathematically; relevant only at larger page counts.

**Mechanism:** `pageStick` has a minimum of 1.2% of the whole track. In a
200-page equal-height notebook one page is 0.5% of the track, so the dead zone is
2.4 pages on each side. `placeForDrag` can pin the target to the mounted page
while the finger crosses several pages.

**Two-direction repro:** Use 100–200 pages, drag slowly across a join in either
direction, and compare finger progress with target page.

**Smallest correct fix:** Express minimum jitter tolerance in track pixels, then
cap it to a fraction of the current page's share. A dead zone must never be wider
than the page it protects.

### S2 — Timer-based fallback page flow can write to the old page

**Lines:** `16649-16669`  
**Confidence:** medium-low because ordinary pages normally have preview bands.

**Mechanism:** `flowTo` assumes the new page has mounted after 260 ms and writes
its backward landing then. A slower IndexedDB read makes that timer scroll the
old page; a faster/later render can then inherit or overwrite the position.

**Two-direction repro:** Exercise a page type where preview flow is absent,
artificially delay `C.getNote` beyond 260 ms, then overscroll backward/forward.

**Smallest correct fix:** Replace the fixed timer with a page-id-scoped landing
consumed from `paintDoc` after the requested page mounts.

## Why existing tests passed

- `tests/chips.mjs` and much of `tests/joinflaw.mjs` assert that functions and
  source patterns exist; they do not simulate release while `swapping` or
  `chipLoading` is true.
- `tests/chipseam-browser.mjs` is optimized for one neighbour seam and stops
  around the first target mount. It does not reproduce a normal multi-page drag
  whose finger reaches P6 while P10/P9 is still loading.
- `CHIP_SEEK_MS` is declared, and tests describe throttling, but b151 does not
  actually read it in `chipSeek`.
- There is no round-trip assertion proving `listProgress` is the inverse of
  `pageScrollFor`.

## Verification contract for Claude Code

Before calling the fix complete, add tests that fail on b151 and cover:

1. Release on every gate: `swapping`, cooldown, neighbour-not-ready,
   `chipLoading`, same `pendingId`.
2. Slow and fast drags across at least four pages, both chips, both directions;
   final mounted page and fraction must equal the release target.
3. Coalescing: with delayed reads, intermediate renders may be discarded, and
   the latest target must win without a load-per-page staircase.
4. A chip progress round-trip through scroll and repaint at multiple zooms.
5. Unequal pages whose actual rendered content exceeds stored sheet height.
6. Type/draw then immediately scrub: no source loss and no target contamination.
7. One-finger release during handover and two-finger held movement across the
   join.
8. First/last page, same-section joins, section boundaries, 100+ pages and a
   failed/delayed page read.

Keep these already-correct invariants:

- labels follow the finger during an active drag;
- `visualNoteId()` controls visible-page geometry;
- measured preview geometry and 40%/60% hysteresis;
- `renderSeq` rejects stale render completions;
- no return of `scrollToJoin` / `noLandUntil` or a blanket
  `if (chipDrag) return` in `pageHandover`.

## Recommended implementation order

1. Durable final target + force semantics + latest-target coalescing.
2. Flush/owned-id safety around direct chip page changes.
3. Make direct mounting part of the global swap state; fix visual/requested id
   consumers.
4. Fix mapping round-trip and measured variable heights.
5. Add id/sequence guards to restore/zoom/place saves.
6. Repair finger-up/two-finger handover races and terminal cleanup.

This order fixes the user's visible b151 freeze/snap first while preventing the
same state-machine repair from introducing silent note corruption.
