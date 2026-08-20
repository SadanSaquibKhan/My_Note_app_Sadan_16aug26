# Margin — project context for any AI coding assistant

This file is read by Claude Code automatically. An identical copy lives at
`AGENTS.md` for other coding agents (Grok, Cursor, etc.) that follow that
convention. **Keep the two in sync — edit one, copy to the other.**

Its purpose: if you are a fresh AI session with no memory of this project,
this file plus the code itself should be enough to keep working exactly the
way it has been worked on so far, without the user having to re-explain
anything.

**Also read `HANDOFF.md`** in this folder — it is the shared running log for
the three tools that take turns on this repo (Claude Code, Grok Build, Codex):
a plain-English summary for the user, the current state, and a build-by-build
history. **After you ship a build, add one line to its Build log** and update
its "Where things stand" note. This file (`CLAUDE.md`) holds the deep, durable
invariants; `HANDOFF.md` holds the live state and who-did-what.

## What this is

**Margin** — a single-file, offline-first note-taking PWA built for a
Samsung Galaxy Tab S10+ with S Pen, styled after Samsung Notes. Everything —
markup, CSS, JavaScript — lives in one ~1.2MB `index.html` (currently ~13,300
lines). There is no build step, no bundler, no framework, no server code.
`sw.js` is a small cache-first service worker. That's the whole app.

- **Deployed**: GitHub Pages, repo `SadanSaquibKhan/My_Note_app_Sadan_16aug26`,
  branch `main`, folder `/root`. Pushing to `main` ships to production
  immediately — the tablet fetches whatever is on GitHub Pages.
- **Storage**: IndexedDB in the browser (`DB_VERSION` — see `index.html`,
  search `var DB_VERSION`). Notes never touch the repo; only the app code
  does. Uploading a new `index.html` never affects a user's existing notes.
  Hierarchy inside a notebook is **notebooks → sections → pages**. Pages
  with no `sectionId` stay unfiled and still belong to the notebook.
- **Install**: see `READ-ME-FIRST.txt` for how the user gets it onto the
  tablet (GitHub Pages → "Add to Home screen").

## The user

Not a programmer. Wants explanations **short, plain, and ending with what to
do next** — no jargon, no essay. This is a standing instruction (see the auto
memory system if you have access to it; otherwise just follow this rule).

Critical constraint: **the user cannot verify code by reading it.** All
verification happens by (a) automated tests you write and run, and (b) the
user manually testing on their physical tablet and reporting back — often
with several annotated photos, sometimes with pen-drawn line numbers pointing
at exactly where something goes wrong. Take these reports literally and
precisely; the user is very good at pinpointing symptoms even when their
wording is imprecise. Round-trips with the user are expensive (they have to
close the app, reopen, retest, describe results) — so **verify as much as
possible yourself before calling something fixed.**

The user has, in the past, granted blanket permission to proceed through a
bounded batch of feature work without asking each time ("you have full
permission till all 80% are done, don't ask again"). That was scoped to that
one batch, not a permanent override of normal judgment about risky actions.

## How to verify a change without a device

This is the most important working pattern in this project. Since no one on
the AI side has the physical tablet, an extensive Node.js test discipline
compensates:

- Test scripts live in **`tests/`** in this repo (next to `index.html`).
  Run them from the repo root, e.g. `node tests/check.js index.html`.
  An old scratch copy may still exist at
  `C:\Users\khans\AppData\Local\Temp\mtest\` on this PC — do not commit that
  folder; `tests/` is the shared suite every tool must use.
- **`node tests/check.js index.html`** — syntax-checks every inline `<script>` block.
  Run this after every edit, no exceptions.
- **`node tests/ids.js index.html`** — confirms every `$("someId")` call in the JS
  resolves to a real element in the markup, and flags duplicate ids. Has a
  running list of "newly added elements" to extend when you add ids.
- **`node tests/nest.js index.html`** — confirms every HTML tag opens and closes in the
  right order (catches a dangling `</div>` before it ships as a visual bug —
  this exact thing caused a "grey half-screen" bug once).
- A growing family of **`*.mjs` unit-test files**, one per feature area
  (`coords.mjs`, `peek.mjs`, `handover.mjs`, `taptype.mjs`, `handwriting.mjs`,
  `settings.mjs`, `shapes3.mjs`, `crop.mjs`, `bars.mjs`, `visib.mjs`,
  `pageheight.mjs`, `eraser.mjs`, and more). Two techniques, mixed as needed:
  1. Extract a pure function's source out of `index.html` with a regex and
     eval it via `new Function(...)`, then assert against hand-computed
     expected values.
  2. Transcribe an algorithm line-for-line into the test file (when the real
     function isn't cleanly extractable — e.g. it closes over DOM globals)
     and assert the transcription matches intent. Cheaper but weaker: keep
     these in sync with the real code by hand.
  Also common: regex/string assertions against the raw HTML source, checking
  that a specific line of logic is present, in the right function, wired to
  the right event.
- For anything DOM-dependent (does an element actually get the right
  height/class/visibility at runtime), don't trust a source-text assertion
  alone — **drive a real browser**. This project has used a local
  `python -m http.server` plus a browser automation tool to: load the page,
  inject test fixtures directly into IndexedDB (see the schema below), read
  computed styles / `getBoundingClientRect()`, and confirm the number came
  out right. This caught real bugs that string-matching missed (e.g.
  confirming the scroll-preview band actually grows to match the live page's
  height, in pixels, with real ink data).
- Before calling a build done: run all of the above, then ship.

## Build / release ritual

Every shipped change follows this exact sequence:

1. Make the edit(s) in `index.html` (and `sw.js` if needed).
2. Run `node tests/check.js index.html`, `node tests/ids.js index.html`,
   `node tests/nest.js index.html`, and every relevant `tests/*.mjs` suite
   (including `tests/shapes3.mjs` as a general regression check — shape
   recognition is easy to break silently).
3. Bump the build number: `python tests/bump.py <this-folder> <N>` sets
   `BUILD = "v12 · 2026-08-16 · bN"` inside `index.html` and
   `CACHE = "margin-2026-08-16-vN"` inside `sw.js`, and verifies the two
   match. **Never hand-edit these — they drifted out of sync repeatedly
   before this script existed**, which meant the tablet kept serving a stale
   cached copy after a "fix" that never actually reached it.
4. For an **app** change: `git add index.html sw.js` only. For a **docs/tests**
   change you may also add `AGENTS.md`, `CLAUDE.md`, and `tests/`. Never a
   blind `git add -A` of everything. See "Do not touch" below for why.
5. Commit with a message that explains *why*, ending
   `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (or whichever
   model actually made the change).
6. `git push origin main` — this is a live deploy to GitHub Pages.
7. Tell the user, in short plain language: what changed, why it should fix
   what they reported, and what to test next on the tablet (confirm the new
   build number in Settings first, since the service worker can lag).

As of the last commit in this file's history, the build was **b130**
(commit `19bffec`). Check `index.html`'s `BUILD` constant and `git log` for
the real current state — don't trust this number once time has passed.

**The test folder is shared ground.** Several `*.mjs` suites carry assertions
that pin the *exact source text* of a design. When you deliberately replace a
design, those go red — that is not a regression, but you must not just delete
them either: rewrite each one to state the new intent, and keep the sentence
describing what the old bug was. The reliable way to tell a real regression
from a stale assertion is to run every suite against the **previous** build as
well and compare the counts; only a suite that got worse is a regression.
`pass3sim.mjs` is **inverted** — it was written by the Grok agent so that a
FAILING check means the bug it describes is gone. Its count going *up* is good.

## Do not touch / repo hygiene

- `.gitignore` excludes `*.docx`, `*.doc`, `*.pdf`, and a specific personal
  test-results file — these are the user's private documents that must never
  reach the public GitHub Pages repo. Early in the project a blind
  `git add -A` **did** accidentally commit two personal documents; they were
  untracked and ignore rules added, but they are still in git history. A
  history rewrite was offered and never actioned — ask the user before doing
  one, it's destructive to shared history.
- `pdf.min.js` / `pdf.worker.min.js` are vendored pdf.js, loaded lazily and
  cached via the service worker's `EXTRA` list (best-effort — a failure to
  cache them must not break install).
- Never commit the Windows Temp `mtest` scratch folder. The real suite is
  `tests/` in this repo. Do not commit `node_modules`, `*.bak`, or personal
  documents.

## Architecture, by the numbers

- `DB_VERSION` (IndexedDB schema version) — stores: `meta`, `notebooks`,
  `notes`, `assets`, `practices`, `groups`. Indexes: `by_notebook`, `by_tag`,
  `by_edited` (notes), `by_note` (assets, practices), `by_order`
  (notebooks), `by_parent` (groups).
- `CFG_REV` — one-time settings migrations, run once per rev bump via
  `migrateCfg()`. The full `cfg` defaults object (search `var cfg = {` in
  `index.html`) is the single most useful place to see every user-facing
  toggle that currently exists — it's self-documenting with inline comments.
- The file is organized into clearly numbered/titled comment sections
  (search for `/* ----`) — there are roughly 150 of them, covering
  everything from `the page is a page` and `the favourites bar` near the top
  to `boot` at the very end. **Grep for `/* ----` before assuming a feature
  doesn't exist** — it very likely does, under a section header that
  describes it in plain English rather than a technical name.

### Ink / drawing

- Pointer Events throughout, `touch-action: none` on drawing surfaces,
  capture-phase document listeners so a barrel-button press or long-press
  reaches the app even when the pointer started over a toolbar.
- Canvas rendering via `ctx.setTransform(dpr*zoom, 0, 0, dpr*zoom,
  -scrollLeft*dpr, (pad-scrollTop)*dpr)` — every stroke coordinate is in
  page space, converted to screen space at paint time.
- Stroke smoothing: a cardinal/Catmull-Rom spline through every recorded
  point (not between them — early versions cut corners literally, which the
  user rejected), tension controlled by `cfg.curvePct`. A separate
  stabiliser (`cfg.stabilise`) lags the drawn line toward the nib
  exponentially, converging by construction (see `handwriting.mjs` for the
  math proof).
- Shape auto-correction (`cfg.shapes`): resample the closed path to N
  points, detect corners by turning angle, classify by corner count +
  shoelace-area/bounding-box ratio into square/rect/rhombus/triangle/circle/
  line. Verified against wobbly, gapped synthetic input in `shapes3.mjs` —
  this went through several complete rewrites before it matched Samsung
  Notes' behavior; don't simplify it without re-running that suite.
- Even thickness (`cfg.pressure === "off"`): the chosen nib size stays put.
  Reached from the **Even** button next to the thickness dots, from the
  checkbox on the pen popover, and from Settings. New strokes store a flat
  `0.5` so they stay even later if pressure is turned back on; speed-for-
  pressure is also skipped. Turning Even off restores `cfg.pressureLast`
  (the last light/normal/firm feel).
- **The S Pen side button — read this before touching it again.** It took
  many builds and several wrong theories. The decisive fact, found in b126:
  **Chrome on this tablet renames the pointer to `pointerType: "eraser"` for
  as long as the button is held.** The button's own logic was fine long
  before the feature worked, because every gate that asked "is this the pen"
  by testing `pointerType === "pen"` stopped recognising the pen at exactly
  the moment the button was down. `mayDraw()` refused the stroke, so the
  eraser lit up in the toolbar and rubbing removed *nothing*; and the nib
  landing fell into the branch meant for a finger, which hands over to
  typing. Proved by driving the previous build in a browser: three strokes
  drawn, rubbed with the button held, all three still on the page.
  `isPenType(e)` now answers that question everywhere (drawing, the nib
  landing, hover, move, over). **Never narrow one of those back to the bare
  string `"pen"`.**
  The rest of the design: entering "erase mode" (the renamed pointer, or
  `buttons & 32`) is the *press*, counted once on the transition — it must
  never be tested per-event, or every nib-down reads as another press, which
  is the old "press it then touch the screen and it flips back". `buttons`
  bits 2/4 are the button proper; a bit that lasts one sample while hovering
  is noise and is confirmed ~40ms later. A `contextmenu` while the nib is on
  the glass is *never* the button — `penHold` already knows whether the pen
  actually stayed still, and if it moved that contextmenu is Android being
  noisy about a slow letter. `keydown "Unidentified"` is not the button
  either (Android's IME emits it constantly).
  All three eraser gestures — side button, hold-the-nib-still, double-tap —
  go through **one** gate (`eraserPress`), **one** clock (`PRESS_ONE_MS`),
  and **one** memory of the tool to come back to (`eraserReturn`). They used
  to be three machines with three memories and two clocks, and they undid
  each other; a single physical press could get through two doors and cancel
  itself, which looks exactly like a button that does nothing.
  `penNibOnGlass()` must not count `width`/`height` as contact — a hovering
  pen reports a 1x1 patch too, and treating that as contact made a hover look
  like a long press of the nib.

### Continuous page scroll (the hardest, most-iterated feature)

The user wants scrolling between pages to feel exactly like Samsung Notes:
both neighboring pages partially visible while you scroll across the
boundary, no jump, no clipping, in both directions. This took many rounds to
get right; the root causes, in order of discovery:

1. A page's real height is `max(inkDepth + 400, pageFloor)` — a page is as
   tall as its **handwriting** reaches (`growForInk()`), not as tall as its
   typed words. The **preview band** that shows the neighboring page while
   you scroll toward it only measured the neighboring page's *words*, so a
   handwriting-heavy page's preview was far shorter than the real page —
   clipped at the bottom while scrolling toward it, then springing to full
   height the instant it became the live page. This was the core cause of
   the "sudden jump," worst going backward (up) because the whole page sits
   above the eye at that point. Fixed by giving the preview band the exact
   same height formula as the live page (`pageHeightFor()`, shared by both).
2. An empty/new page must not collapse below the sheet floor
   (`--page-h`, 1500px — taller than A4, A4's width) — it briefly did,
   producing a tiny stub page instead of a full sheet like Samsung Notes.
3. A remaining once-per-transition micro-glitch is reduced by caching each
   page's measured ink depth (`pageInkDepth`) as it's seen, so a page you've
   already visited this session is pre-sized instantly when it re-enters a
   preview band, instead of sizing correctly only after its strokes finish
   loading a frame later. The first time you ever see an unvisited page,
   this cache is empty, so a small settle may still show there — flagged to
   the user as a possible next thing to chase if it persists.
4. The scroll-position handoff when a page swap actually happens
   (`handover.pending` → `finishHandover()`) re-anchors to the specific
   on-screen block the user was actually looking at (not just "the top of
   the new page"), settles over several animation frames rather than one,
   and no longer waits on the IndexedDB save + list refresh before turning
   the page (the save now happens in the background instead of blocking the
   swap).
5. Both preview bands (`prevPeekBody` / `nextPeekBody`) render the real
   neighboring page's real HTML through `previewHtml()`, with ~55 CSS rules
   deliberately duplicated so the preview shares the exact same layout rules
   as the live page (headings, lists, code blocks, callouts, todo items,
   rules) — a preview that lays out even slightly differently than the real
   page reintroduces the jump at the join.

If the user reports a scroll jump again: don't assume it's back to square
one. Ask (or infer from their description) which direction, and whether it's
the very first time crossing into that particular neighboring page this
session (cache-cold) or a page they've already been to (cache-warm) — the
fix should be complete for the warm case.

**The two nav chips (`#secChip` blue = this section, `#bookChip` grey = the
whole notebook).** A chip is a *seek*, like a scrollbar: where the chip sits
is where you are, page and all. Two earlier designs both put the chip and the
scroll-driven swap in charge of the page at the same moment and they argued
across the join — that argument is the up-down-up-down bounce. `pageHandover`
now stands down entirely while `chipDrag` is set. Because of that, a drag that
never gets its `pointerup` would leave page-turning dead for the session, so
`lostpointercapture` ends it and a document-level listener catches a release
the chip never hears (it must listen on the way **up**, so the chip's own
handler goes first). Further rules learned the hard way:
- The join is a single point in the track: one pixel either side is "foot of
  this page" or "head of the next", and a resting hand crosses it many times a
  second. `CHIP_STICK` (~4% of the track) keeps the page you are on until the
  chip has genuinely travelled past. Without it every crossing asked for a
  whole page load.
- Only **one** page load may be in flight (`chipLoading()`), and which page is
  scrolled is decided by what is **mounted** (`$("body").dataset.noteId`),
  never by `state.noteId` — those disagree for a few hundred ms after a page
  is asked for, and landing on the strength of the new id scrolls the old page
  with the new page's measurements.
- A page fraction is read the way a scrollbar reads it: 0 = head of the page at
  the top of the screen, 1 = its **foot at the bottom** (`pageScrollFor`).
  Reading 1 as "one whole page further down" leaves the page entirely above the
  screen and the reader inside the next page's band, past the hand-over line —
  so the page turns itself the moment you let go.
- `listProgress` returns **-1** for "this page is not in this list", which is
  not the same as 0 ("you are at the top"). `sectionPageList` follows the open
  page's own section, not whichever section the panel happens to show.
- `CHIP_STICK` is **22% of the current page's share of the track**, not 4% of
  the whole notebook. Four per cent of a 20-page book was almost a whole page,
  so the chip sat still and then jumped.
- A chip drag onto a **neighbour** must overscroll the current page into that
  neighbour's peek (`driveChipPeek`) and remount only once `chipPeekReady`
  says the peek has crossed the same 40%/60% lines finger-scrolling uses.
  Remounting earlier, then `landOnPage(0)`, is the sudden jump at the join:
  frac 0 means "head at the top of the screen", but at the join the head is
  still halfway down. After a neighbour swap, skip `landOnPage` until the
  chip has travelled further into the new page.
- Neighbour remounts go through `openPage(n, true)` so `render()` runs on
  this turn. Waiting on hashchange left the finger on a page that had already
  gone.
- Lasso hit-tests (`elPageBox`, `lassoInCatch`, `lassoHitHandle`,
  `pageToClient`) must call a file-scope `zoom()` / `zoomOf()`. The only
  `zoom()` used to live inside `makeSurface`, so a corner tap threw and
  nothing moved — minus then "unlocked" resize by shrinking the box. The
  popup bar must sit **beside** the catch (right, then left, then below),
  never on the north handles. `lasso.drawn` travels with move/scale or the
  old words stay a ghost hit-zone.
- The two chips **overlap by about half** when they share a row (blue at
  `right:40px`, grey at `right:8px`) so they can sit on the screen edge
  instead of out in the writing. Labels are short: `"S2  3/6"` and `"3/12"`.
  After `CHIP_TUCK_MS` (1100ms) of not touching either, both tuck toward the
  edge by `CHIP_TUCK_FRAC` of their own width (~half still showing). Touching
  a tucked chip wakes **only that one**; a tap on a tucked chip must not also
  jump to the start/end of the list (that jump is for a tap on one already
  out). `placeChip` composes tuck X with `translateY(-50%)` via
  `applyChipXform`. Left-handed layout mirrors to the left edge.

**The finger crossing a join.** `fingerPanMove` scrolls to `pan.top` minus how
far the finger has travelled; the swap rewrites `scrollTop`, so that sum then
describes a page that is gone and the next twitch throws the page ~900px. Any
code that moves the scroll under a finger that is still down **must rebase the
pan** (`rebasePan()`). Do not zero `pan.vx`/`vy` or set `pan.noGlide` there —
that is the "momentum dies at the join". A running fling is stopped only so
its frame can be restarted after the re-anchor (`handover.glideCarry` at 0.7).
The old dump-to-the-heading was stale `pan.top`, not the leftover speed.
The backward target is computed **once** before the settle loop: `pageBottom`
keeps moving for several frames as bands hydrate, so re-reading it each frame
moved the target ~200px under the correction chasing it.

**Opening a page never scrolled it anywhere** until b128. Nothing in the
opening path writes the scroll, so a page opened from the list inherited the
previous page's offset (measured: 3502px instead of the top), which from a
short page lands inside the *following* page's band and turns the page for you.

**Only the newest render may finish** (`renderSeq`). `state.noteId` moves
synchronously, `state.note` asynchronously; without the guard an older render
lands after a newer one and the app is split across two pages.

### Images

- Free placement: `data-free="1"` + `data-x`/`data-y` percentages, drawn via
  absolute positioning against `#body` (`position:relative`). A dragged
  image counts toward the page's required height via `growForInk()` exactly
  like handwriting does, or it would hang off the end of the page with
  nothing to scroll to.
- Cropping is **in-place on the page**, not a separate view — this was
  explicitly requested after an earlier full-screen-dialog version was
  rejected twice. Eight handles (`.crophandle`, `data-crop="nw|n|ne|e|se|s|
  sw|w"`) sit directly on the selected `figure.imgblock`; corner handles
  trim two sides at once, edge handles trim one; a dimmed shade
  (`clip-path: polygon(...)`) shows what will remain; nothing is cut until
  "Crop" is tapped; the original bytes are kept exactly once
  (`asset.orig`) so "Uncrop" is always exact, never cumulative.
- Resize/drag/crop overlays all defend against fighting the page scroll —
  look for `closest("figure.imgblock")` bails in the pan/gesture handlers if
  you see a new "drag scrolls the page instead" bug; it's the same class of
  bug every time.

### Toolbars

Three bars in the note editor — `docbar` (note actions: star, practice,
modes, undo, zoom...), `fmtbar` (typing/formatting), `inktools` (pen) — plus
a floating, draggable, resizable favourites bar (`favBar`) for quick access
to a user-chosen subset of tools. All bars:
- Can be individually hidden from Settings (`cfg.showDocBar` /
  `showFmtBar` / `showInkBar` / `showTagRow`), with a small "chip" rail
  (`barRail`) to bring a hidden one back.
- `fmtbar` and `inktools` scroll horizontally in a single row (with a fade
  hinting there's more) rather than wrapping into several rows — wrapping
  was eating a third of the screen.
- Individual buttons on the note bar (Draw, Lock, Focus, Outline, Record,
  Pin, etc.) can be hidden one-by-one via a checkbox grid in Settings
  (`HIDEABLE_BTNS`).
- "Show the tools" (exiting Immerse mode) intentionally lands with typing
  and pen folded (`barMin`, a transient fold separate from the permanent
  Settings one) — the user wants to land on the small bar and open the big
  ones only when wanted.
- The favourites bar and the note's bottom footer/details bar are each
  visible under **opposite** conditions on purpose: favourites only when a
  note page is open AND the side panel is collapsed; the footer only when
  the side panel is actually on screen (measured via `offsetParent`/
  `offsetWidth`, never inferred from mode flags — flag-based guesses caused
  repeated bugs where the bar showed or hid in the wrong place).
- Side panels when open are three columns: **notebooks | sections | pages**.
  Notebooks start collapsed (`cfg.railMin`) to a thin strip with `railTog`;
  sections have `secTog`. Every notebook has a default **sec0**; unfiled
  pages are moved into it. New sections auto-name `sec1`, `sec2`, …
- S Pen side-button eraser: a single `buttons` flash then `0` must NOT
  release (that was the “button does nothing” bug). Release only after
  the bit has been seen several times, or the pen leaves the glass, or a
  real mouseup/keyup. Ten listener routes coexist (bits, coalesced,
  pointerrawupdate, auxclick, contextmenu, mousedown, mouseup, keydown).
- Finger-scroll over an unselected picture must scroll: `touch-action:pan-y`
  plus a pending-tap (`imgPend`) that cancels on vertical move.
- Rough working uses the same page ruling and can take pasted pictures.
- **Working sheets must rise from the bottom of the screen and slide
  back down out of sight when closed** — that motion is wanted, not a
  leftover. `#pracSheet` is a fixed bottom overlay (`openPractice` /
  `closePractice`), not a page in `pageOrder`. Do not put working areas
  back into the main notebook scroll. Pen, lasso, pictures and scroll
  inside the sheet stay the same as a normal page. Named chips on the
  parent page (`span.pracpin`, e.g. S1P2w3) open and hide that overlay.
- A second floating **shortcuts bar** (`jumpBar`) sits on the opposite side
  of the screen: Home (notebook list, current notebook stays open), Open
  (notebooks already open), Places (this notebook's sections + every
  bookmark). It minimises to a dot that can be dragged, same as the
  favourites dot. Default is on (`cfg.jumpBar`).

### Everything else

Shape/handwriting appearance, markdown shorthand (`->` → arrow, `**bold**`,
smart quotes — bold-before-italic precedence matters, and `nbsp` vs regular
space matters for arrow expansion on an Android soft keyboard), tags,
backlinks, outline, find & replace, PDF-to-pages import (via vendored
pdf.js), audio recording pinned to what was written, practice/rough-working
spaces, notebook groups & auto-naming series, duplicate/tombstone delete,
markdown/PNG/PDF export, crash-recovery draft timer, left-handed layout,
light/dark theme following the system, and more — **grep the numbered
section comments in `index.html` before assuming something needs to be
built from scratch.**

## Known gotchas (don't reintroduce these)

- `nbsp` (U+00A0) vs a regular space: Android's soft keyboard inserts nbsp
  as trailing whitespace, not U+0020. Markdown-expansion rules must accept
  both.
- Bold (`**x**`) vs italic (`*x*`): the italic rule must not fire first and
  consume the asterisks before the bold rule gets a chance — guard the
  *opening* side, not just the closing side.
- `git add -A` can accidentally stage the user's personal documents; always
  add named files.
- Hand-editing `BUILD` or `CACHE` instead of using `bump.py` lets them drift
  out of sync, and the tablet then serves a stale cached copy indefinitely.
- A permanent "latch" flag that's only cleared on note-change (rather than
  measured fresh) tends to cause "worked once, stuck the second time" bugs —
  this exact pattern bit the panel-focus-override and the pen-button-eraser
  logic more than once. Prefer measuring current state over remembering a
  flag, where practical.
- IndexedDB version upgrades blocked by multiple open tabs looked like data
  loss to the user the first time it happened — there's now a
  `db.onversionchange` handler and a persistent "Your notes are safe" cover
  while blocked; don't remove it.
- An over-wide toolbar row used to make the *entire page* shrink (the
  browser scaling everything down to fit an overflowing child) rather than
  just that row overflowing — needs `flex-wrap` plus `overflow:hidden` on
  the shell to stay contained.
- A preview pane (peek band, or any other place that renders another page's
  saved HTML for display) must mirror the live page's CSS rules and height
  formula block-for-block, or the join between "preview" and "live" glitches
  visibly the moment they swap.
- Daily backup is **audio-less** (`exportBundle({ skipAudio: true })`).
  Encoding every recording into one JSON file crashed at ~15GB. Import of a
  notes-only file must not overwrite a local audio/image blob with emptiness
  (`keepLocalBytes`). Never `JSON.stringify` the whole bundle for download —
  use `bundleToFileBlob`. The with-recordings button is only for a small
  library.

## Open items as of the last session

- **Selecting a picture must not raise the keyboard or jump the caret.**
  User report (do not ignore next time this file is touched): tapping a
  picture turns typing on and dumps the caret at the first line of a blank
  page — on a normal page and in a working area. `selectImage` must not go
  through `handOverToTyping` / `setTypingEnabled(true)` / `typeAt`. Not
  started; user said remember, not now (b135+).
- **Working sheet motion:** coming up from the bottom, and going back
  down until it disappears, is the wanted open/close. Do not replace
  that with a hard show/hide or with a page in the notebook list. User
  said remember, not now (b136). If the slide ever feels missing, restore
  the bottom-sheet animation on `#pracSheet`, do not rebuild working as
  in-flow pages.

- Attachments/recordings/maths currently render as a small placeholder
  label (`peekstub`) inside page previews rather than being fully rendered
  — only pictures and handwriting are hydrated for real in a preview band.
  Known limitation, not yet built.
- A background adversarial code-review workflow was launched against the
  in-place crop feature (build b36) and never completed/resumed — its run
  id was `wf_5295f04b-b71` if that's ever resumable, otherwise it should
  just be re-run fresh if the crop code is touched again.
- The original PDF-attached feature request listed 24 items; most are done,
  but this file does not track which specific ones remain — reconcile
  against user conversation / the `cfg` defaults / the numbered section
  comments rather than trusting any older summary of "what's left."
- Git history still contains two personal documents committed early on by
  accident (see "Do not touch" above) — a history rewrite was offered, never
  requested.
- Scroll-jump fix (see above) is believed complete for pages already
  visited this session. Neighbour pages now have their ink depth measured
  as soon as the current page opens (`warmNeighbourInk`), so the first
  crossing should no longer start short. Ask the user to confirm on the
  tablet.
- **Sync (see `SYNC-PLAN.md` + `HANDOFF.md`).** Phase 0 backup is b143.
  Phase 1 wiring is b144: Settings URL+password in IndexedDB, never in the
  repo; `sync-client.js` is loaded by the app (commit it with `index.html` +
  `sw.js` when it changes); erases write `removed`; opening a note never
  waits on the network. Photos/audio bytes still do not sync.

## Working style expected of you (Claude Code, Grok, or otherwise)

- Explanations to the user: short, plain, concrete "what to do next."
- Prefer fixing root causes over patching symptoms — several of the bugs
  above (the scroll jump especially) went through multiple shallow fixes
  before the real cause was found; when a bug resists a fix, look one level
  deeper before trying another patch on top.
- Verify everything you can without the user, using the test discipline
  above, before telling them something is fixed.
- Follow the existing code's voice in comments: plain English explaining
  *why*, not restating *what* the code obviously does. Match it rather than
  reverting to conventional terse dev comments.
- Never `git push` behavior changes without running the full verification
  pass first — a broken push is a broken tablet app until the next fix
  round-trips through the user.
