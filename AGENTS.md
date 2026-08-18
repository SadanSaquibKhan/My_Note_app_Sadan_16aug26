# Margin — project context for any AI coding assistant

This file follows the open `AGENTS.md` convention read by many coding
agents (Grok, Cursor, etc.). An identical copy lives at `CLAUDE.md`, which
Claude Code reads automatically. **Keep the two in sync — edit one, copy to
the other.**

Its purpose: if you are a fresh AI session with no memory of this project,
this file plus the code itself should be enough to keep working exactly the
way it has been worked on so far, without the user having to re-explain
anything.

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

- Test scripts live in `C:\Users\khans\AppData\Local\Temp\mtest\` (a scratch
  folder, **not** part of the repo — it doesn't survive between machines, so
  a fresh session may need to recreate individual test files, but the
  *pattern* below should always be followed).
- **`check.js index.html`** — syntax-checks every inline `<script>` block.
  Run this after every edit, no exceptions.
- **`ids.js index.html`** — confirms every `$("someId")` call in the JS
  resolves to a real element in the markup, and flags duplicate ids. Has a
  running list of "newly added elements" to extend when you add ids.
- **`nest.js index.html`** — confirms every HTML tag opens and closes in the
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
2. Run `check.js`, `ids.js`, `nest.js`, and every relevant `*.mjs` suite
   (including `shapes3.mjs` as a general regression check — shape
   recognition is easy to break silently).
3. Bump the build number: there's a `bump.py <folder> <N>` script that sets
   `BUILD = "v12 · 2026-08-16 · bN"` inside `index.html` and
   `CACHE = "margin-2026-08-16-vN"` inside `sw.js`, and verifies the two
   match. **Never hand-edit these — they drifted out of sync repeatedly
   before this script existed**, which meant the tablet kept serving a stale
   cached copy after a "fix" that never actually reached it.
4. `git add -A index.html sw.js` — **only these two files**, never a blind
   `git add -A` of everything. See "Do not touch" below for why.
5. Commit with a message that explains *why*, ending
   `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (or whichever
   model actually made the change).
6. `git push origin main` — this is a live deploy to GitHub Pages.
7. Tell the user, in short plain language: what changed, why it should fix
   what they reported, and what to test next on the tablet (confirm the new
   build number in Settings first, since the service worker can lag).

As of the last commit in this file's history, the build was **b41**
(commit `43a3291`). Check `index.html`'s `BUILD` constant and `git log` for
the real current state — don't trust this number once time has passed.

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
- Never commit anything from the `mtest` scratch folder; it's outside the
  repo entirely.

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
- The S Pen's side button has **no reliable `PointerEvent.buttons` bit on
  this tablet** — One UI intercepts it before Chrome sees a clean
  press/release pair; the only trace that reaches the page is a
  `contextmenu` event with no matching "released" event. Current design
  (search `the side button, held, not toggled`): the button now **holds**
  (press-and-hold erases, release restores the previous tool), using the pen
  leaving proximity (`pointerleave`/`pointerout`) as the release signal
  since there is no better one — and honoring a real button-release event
  immediately if a particular pen/build ever does report one. A second press
  always cancels, so it can never get stuck. There's also a separate,
  independent "hold the nib still on the glass" eraser gesture and a
  double-tap latch gesture — three different eraser triggers coexist by
  design, each solving a different physical motion the user described.

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

## Open items as of the last session

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
  visited this session; unconfirmed for the very first crossing into a
  brand-new page. Ask the user to confirm on their next test pass.

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
