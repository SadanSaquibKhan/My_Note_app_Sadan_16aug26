# HANDOFF — the shared notebook for every AI working on Margin

This is the one file to read (and update) when you switch between AI tools.
Three tools take turns on this same project: **Claude Code**, **Grok Build**,
and **ChatGPT Codex**. They all edit the same repo. This file is how the next
one picks up cleanly where the last one left off.

> If you are an AI reading this: read this whole file, then read `AGENTS.md`
> for the deep technical rules. After you ship a build, **add one line to the
> Build log at the bottom** and update anything here that went stale. That is
> the deal — do it every time.

---

## PART 1 — Plain summary (for the human, read this first)

**What this project is.** A note-taking app called **Margin**, made to feel like
Samsung Notes, for your Galaxy Tab S10+ with the S Pen. The *entire* app is one
big file, `index.html`, plus a tiny helper `sw.js`. There is no server. Your
actual notes live only inside the browser on each device; the code lives on
GitHub and auto-publishes to the tablet.

**Who does what.**
- **Claude Code** and **Grok Build** and **Codex** — run inside the project
  folder on your Windows PC, can *edit the files and run the tests*. These are
  the ones that actually build.
- **Grok in Chrome** (the website) — can only *talk and plan*, it cannot touch
  the files. There's a separate note for it, `HANDOFF-GROK-CHROME.md`.

**How to switch from one AI to another.** Just tell the new one, in your first
message:
> "Read HANDOFF.md and AGENTS.md in this folder first, then continue."

That's it. Everything it needs to catch up is in those two files.

**Where things stand right now (keep this line honest — update it each build).**
- Current build: **b192**. Recent: b167 fixes finger-scroll (not chip) freeze/jump at a page join on Windows (Bug E) — during a remount the page no longer freezes under the finger (its travel is banked and applied after the swap re-anchors), and letting go mid-swap no longer starts a glide that fights the re-anchor (it hands off to the damped glideCarry). Both device-confirmable. This closes the A-H batch: A toolbar shift, B pen-down delay, C false notice, D chip staircase, E finger scroll, F immerse arrows, G cross-page ink shift, plus the build-not-updating SW fix.
  panels) visible in Immerse (Bug F) — paintEdge hid them in immerse, the one place they are
  needed; now shown whenever a note is open (browser-verified). b163 fixed writing shifting up
  on pen-touch (Bug A — the mode chip AUTO→PEN moved the toolbar wrap and dropped a row; fixed
  by pinning #modeChip/#saveWord widths, header constant height) and the false "Panels folded"
  notice (Bug C). Still holding the two fragile ones (B pen-down latency, D/E/H Windows scroll)
  to cross-check against Codex before touching the pen/scroll machinery.
  reveal at a page join (Bug G, both platforms) — the preview-band ink canvas painted from
  the CENTERED sheet's left while the live `#inkLayer` paints from `#paper`'s left, so peek
  ink sat one centering-margin too far right and the sheet-wide peek canvas clipped the
  rightmost strokes; `paintPeekInk`'s `fit()` now shifts the peek ink origin left by that
  margin. Browser-verified (tests/peekink-browser.mjs): a stroke at page-x=400 renders at
  the same screen-x (860) in peek and live, 0px diff. b161 completes the update fix — install now fetches the
  shell with `{cache:"reload"}` (an install right after a deploy could bake the OLD
  index.html into the NEW cache), and a new worker taking control auto-reloads once (real
  update only, one-shot guarded) so the fresh build shows without hunting for the notice.
  A parallel 6-agent read-only workflow root-caused the whole b159 bug list (A–H) with
  file:line precision; results in the task output. Shipping the high-confidence isolated
  fixes next (G peek-ink parity, A/C toolbar, F immerse arrows); holding the fragile ones
  (B pen-down, D/E/H scroll) to cross-check with Codex. b160 fixes the tablet **not updating its build** — the
  service worker was cache-first for the whole shell, so an installed PWA served its
  first-cached `index.html` forever (sync worked because it is a different host). The
  shell (page + `sync-client.js`) is now **network-first** (fresh build when online, cache
  as the offline fallback), and the app forces `reg.update()` on load + on return to front.
  ONE-TIME on the stuck tablet: fully close the PWA (or clear its site data / reinstall)
  once so the old cache-first worker is replaced; after that, updates are automatic.
  b159 added a full-screen toggle to the shortcuts
  bar (`#jumpFull`). Tapping it turns "keep full screen" mode (`cfg.fullLock`) on/off;
  while on, ANY touch that is not a full-screen toggle re-fills the screen if the
  browser dropped it (an app-switch/Home drops full screen and only a real gesture may
  ask it back — so the app cannot truly *auto*-restore without a touch, this is the
  closest possible). Verified in-browser that the toggle flips state; the actual
  full-screen fill needs the tablet. b158 stops Settings scroll-mistouch — dragging to
  scroll the settings list no longer flips a checkbox/dropdown it started on
  (`touch-action:pan-y` on the whole `.dlg-body` + a capture-phase guard in
  `wireSettings` that swallows a click when the finger moved > a tap's slop), and the
  controls got bigger padded tap targets. NOTE: this is the scroll-mistouch half of the
  Settings ask; a fuller visual REDESIGN was deliberately not attempted in one
  unverifiable build — offer it as a dedicated pass with the user's direction.
  b157 fixed a CROP of an attached picture not
  reaching other devices (the uncropped one did). Root: cropping to fewer chunks left
  the old higher-index `imgdata` rows orphaned on the server; the 120s pull look-back
  re-fetched them next to the new chunk and `joinImageData` refused to glue (three
  chunks on hand, n now 1), so the crop's bytes never landed — only its dimensions did
  (LWW light record), which is why it looked uncropped. `joinImageData` now takes the
  first n chunks (per `assetId:0`, always the latest push) and ignores stale extras.
  Reproduced + verified with a 2-device sim (tests/cropsync.mjs). b156 fixed the top
  header overflowing on a narrow
  (tablet-portrait) window — the action buttons (Settings, Data, …) ran off the right
  edge and pushed a page-wide grey strip; `.topright` now shrinks and wraps
  right-aligned (Settings/Data drop to a visible second row) and `.top` clips residual
  overflow. Browser-verified: 0 page overflow at 900px, one row at 1400px.
  b155 fixed the two floating bars (favourites +
  shortcuts) snapping to the TOP-LEFT corner when you minimise then re-open them —
  the hold-to-open hid the dot, and the pointerup then read the hidden dot's 0,0 rect
  and saved that as the position; `endDot` now ignores an open (and any 0,0 rect).
  b154 evens out chip-scroll SPEED — the join reveal
  is widened (`evenReveal`) so the neighbour slides in at the page body's own speed
  instead of racing several times faster (the user's "speed increases when the next
  page appears"). Exactly matches the body rate for pages taller than the screen,
  ~2.8× instead of ~7× for short floor pages (capped at half the band so the number
  never leads more than half the next page). Speed-only change to b153's reveal WIDTH
  — the mapping, peek and re-anchor are untouched, so it cannot bounce/hang like the
  reverted uniform-mapping attempt did. b153 removed the multi-page chip FREEZE
  (held chip exempt from the 400ms cooldown); b152 fixed release snap-back; b151
  fixed silent handwriting loss on sync; b150 added "Erase all handwriting".
- **Freeze/snap-back: FIXED (b152 + b153), user confirms "much better".** The
  remaining scroll feedback (2026-08-21) is chip-drag SPEED is not uniform: within a
  page the scroll is slow, then it speeds up when the neighbour comes into view.
- **b154 (shipped) is the SAFE partial fix (widen the reveal).** The FULL uniform
  mapping below is deeper future work — it does NOT fully even out pages that fit on
  the screen (no body scroll to match), so if the user still reports non-uniformity
  on short pages, that is the mapping rework, not the reveal.
- **Full uniform-mapping was ATTEMPTED and REVERTED — do not just re-try it.**
  Root of the non-uniformity is real and understood: the body maps the chip band to
  `(pageSpan*zoom − viewport)` (`pageScrollFor`) while the join crams the leftover
  screen + the 0.20-band reveal into a fifth of the track, so the join scrolls ~5×
  faster than the body (worst on short/floor pages). The clean fix is a single
  uniform map `scroll = pad + frac*full` everywhere (it is the exact inverse of
  `listProgress`). I built it (pageScrollFor + driveChipScroll + chipPeekGeometry +
  finishHandover carry + chipLand all uniform) and BROWSER-TESTED it against a live
  headless Chrome + the chipseam fixture. Result: seam stayed 0px, BUT a **forward
  section-chip drag bounced backward first** (s2p2→s2p1→s2p2→s2p3) and could hang —
  the uniform (faster) over-scroll plus firing the handover on bare `frac<0` /
  `frac>1−over` (no deadzone) fires spurious swaps when the chip rests near a band
  edge, where b153's `prog < band.lo − reveal` margin did not. Lesson: the chip
  position↔scroll map, the handover FIRING (needs a deadzone), and the measured
  `finishHandover` re-anchor are ONE coupled system; changing the map alone regresses
  section page-turns. A correct uniform-speed build must also add a firing deadzone
  and reconcile the re-anchor, and must be re-verified in-browser on **sec forward +
  back** and **book forward + back** (pageChanges must equal 1 on a single crossing).
  Browser harness for this lives at `tests/chiprate-browser.mjs` (needs a headless
  Chrome on :9222 + a server on the working dir; drives a real chip drag and logs the
  per-step mounted/label/scroll sequence). NOTE: the chipseam `--assert` reports
  pageChanges=2 on a whole-notebook book chip for BOTH b153 and b154 — that is a
  harness artifact (fixed drag distance overshoots on the last page), not a build
  regression; judge by sec-chip single crossings.
- **Waiting on you (confirm b159 in Settings, then test):** (1) b156 — top bar on a
  narrow/portrait window: no grey strip, Settings/Data reachable. (2) b157 — crop a
  picture on one device, Sync both sides: the crop shows on the other device (not the
  whole picture). (3) b158 — scroll the Settings list by dragging over the controls:
  nothing toggles by accident. (4) b159 — tap the new full-screen icon (4 corners) in
  the shortcuts bar: it fills the screen; leave to another app and come back, touch the
  screen, it re-fills; tap the icon again to turn it off. (5) b154 — chip scroll speed
  is more even at the page join.
- Still rough: very large pictures or Uncrop-originals may still skip;
  class recordings do not copy. Grey page-divider during a chip drag is
  brief; lasso on typed text still has some reports.
- **Sync (Phase 0 + Phase 1 shipped, pictures in b148).** Server:
  `https://margin-sync.khanssk89.workers.dev`. Password is NOT in the app —
  each device stores it locally. Ink erases now leave a `removed` map so a
  stroke wiped on one device does not come back from the other. Audio stays
  manual.

**The golden rule for every AI (so nothing breaks silently).** After any change:
run the tests in the `tests/` folder, bump the build number with the script
(never by hand), commit only `index.html` + `sw.js`, push. Full steps are in
`AGENTS.md`. Then it should tell you, in plain words, what to test on the tablet.

**One thing about you they should all know.** You are not a programmer, you can't
check code by reading it, and you test on the real tablet and report back (often
with photos). So each AI should *verify as much as it can by itself* before
saying something is fixed — because every round-trip to you is slow.

---

## PART 2 — The handoff rule (for every AI)

1. **On arrival:** read this file top to bottom, then read `AGENTS.md`
   (Claude Code's copy is `CLAUDE.md` — same content bar the first paragraph).
   `AGENTS.md` holds the load-bearing invariants and the exact build ritual;
   do not re-derive them.
2. **While working:** follow `AGENTS.md`'s build ritual exactly. The tests live
   in `tests/` in the repo now (not the old `mtest` scratch folder). Run
   `node tests/check.js index.html`, `node tests/ids.js index.html`,
   `node tests/nest.js index.html`, the relevant `tests/*.mjs`, and
   `tests/shapes3.mjs`, then `python tests/bump.py <this-folder> <N>`.
3. **On departure (every shipped build):**
   - One build is 1–3 related changes only. Then bump, commit, push, and
     start the next cluster. Tell the user **Latest shipped: bN** first.
   - Add one line to the **Build log** at the bottom of this file:
     `bN <hash> — one-sentence what-changed — (which AI)`.
   - Update the "Where things stand" line in Part 1 if the current focus moved.
   - If you changed a load-bearing invariant (pen, chips, scroll, lasso, data
     model), update `AGENTS.md` **and** `CLAUDE.md` to match — they must stay in
     sync — and, for Claude Code, its auto-memory too.
   - You may `git add` `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`, and `tests/` in a
     docs/tests commit. For an **app** commit, stage only `index.html` + `sw.js`.

---

## PART 3 — Detailed context for the incoming AI

### The app in one screen
- One `index.html` (~16k lines, inline HTML/CSS/JS) + a cache-first `sw.js`.
  No build step, no framework, no server code.
- Deployed on **GitHub Pages**, repo `SadanSaquibKhan/My_Note_app_Sadan_16aug26`,
  branch `main`. Pushing to `main` ships live to the tablet.
- Data is **IndexedDB** in each browser (stores: `meta`, `notebooks`, `notes`,
  `sections`, `assets`, `practices`, `groups`). A **page** is one `notes`
  record; handwriting/images/audio are `assets` keyed by `noteId`. Hierarchy:
  **notebook → sections → pages**. Notes never touch the repo.
- Local folder on the PC:
  `…\files_v12ofhtml_16aug26_7pm\margin-pwa_2026-08-16_v7\margin-pwa_2026-08-16_v7`
- Current build: **b151** — always confirm with `var BUILD` in `index.html`
  and `git log`; do not trust a number once time has passed.

### How to verify without the tablet (the core discipline)
No one on the AI side has the physical tablet, so tests carry the weight. Two
layers, both in `tests/`:
1. **Static checks:** `check.js` (syntax of every inline script), `ids.js`
   (every `$("id")` resolves, no dup ids), `nest.js` (tags nest correctly).
2. **`*.mjs` suites**, one per area (chips, eraser, fingerjoin, crop, lasso,
   pageheight, shapes3…). Many *pin the exact source text* of a design, so when
   you deliberately replace a design they go red — that is **not** a regression.
   Tell a real regression from a stale assertion by running each suite against
   the **previous** build too and comparing counts. **`pass3sim.mjs` is
   inverted** (a FAILING check there means the bug is gone). When you change a
   design, rewrite the stale assertions to state the new intent — don't delete
   them.
3. For anything that only misbehaves at runtime, **drive a real browser**
   (`python -m http.server` + inject IndexedDB fixtures + read
   `getBoundingClientRect`/computed styles). This session caught real chip/scroll
   bugs that string-matching alone missed.

### Load-bearing invariants — do NOT undo without reading `AGENTS.md` first
`AGENTS.md` has these in full with the reasoning. The short list:
- **S Pen side button:** Chrome renames the pointer to `pointerType:"eraser"`
  while the button is held, so every "is this the pen?" test must use
  `isPenType(e)`, never the bare string `"pen"`. All three eraser gestures
  (button, hold-still, double-tap) go through ONE gate (`eraserPress`), ONE
  clock (`PRESS_ONE_MS`), ONE memory (`eraserReturn`). Don't give any of them a
  private clock again.
- **Chips (b142):** a chip is a **scrollbar-style seek**. During a drag it
  scrolls through the already-rendered peek band like a finger
  (`driveChipScroll`) and lets the ordinary `pageHandover` swap at the join —
  that is what shows the grey divider and avoids the freeze. `pageHandover`
  stands down during a chip drag ONLY while a far page is mounting
  (`chipLoading()`). A frame loop (`chipChase`) keeps re-aiming at the newest
  finger target; `visualNoteId()` (the mounted page) decides what is scrolled,
  never `state.noteId`. A resting hand must not cross a join (`CHIP_STICK`).
- **Scroll/handover:** only the newest page load may finish (`renderSeq`).
  A finger still down when a page swaps must be re-based (`rebasePan`). A page
  opened from the list scrolls to its own top (it doesn't inherit the old
  scroll). Preview bands must match the live page's height and CSS exactly.
- **Repo hygiene:** never blind `git add -A` — `.gitignore` keeps the user's
  personal `*.docx/*.pdf` out of a public repo, and a blind add leaked two once.

### Current focus and open items (2026-08-20, at b148)
- **Phase 0 backup (shipped b143, restore confirmed):** daily Data button is
  **Save notes (no recordings)**. User restored in incognito: notes came back,
  audio did not (expected).
- **Sync Phase 1 (b144) + harden (b145) + section cursor fix (b146) +
  laptop home/tabs (b147):**
  Settings URL+password in IndexedDB. Header **Sync** chip. Incremental push.
  **b146:** pull cursor is the newest *received* `updated_at`, never server
  `now`. That `now` skip is why Sec4 stayed on the server but the tablet
  showed S4P1 unfiled. One-time `syncCursorRev=1` resets the cursor so the
  missed section is pulled. Apply order is notebooks/groups/sections then
  notes. Creating a section schedules a copy.
  **b147:** Chrome reload must not prune `openNotebooks` before notebooks
  load. `lastHash` restores the page. Home/`+` show the folder board and
  do not close tabs. `+` does not create a notebook. Top bar: Sync, Full,
  Tabs. Recently opened and Weak/working lists fold; recent resizes by drag.
  **b148:** inserted pictures copy as small `imgdata` chunks (no Worker
  change). A missing slot is a label, not a wipe of nested pictures. Local
  blobs are kept when a light pull has none. Audio still does not copy.
- **Sync not done:** very large pictures / crop-originals may still skip;
  R2 later if the library grows. Opening a note never waits on the network.
  Full plan: `SYNC-PLAN.md`.
- **Sync bug-hunt (2026-08-20) — confirmed findings still OPEN after b151:**
  1. **Cursor wedge at scale (HIGH):** the pull is `updated_at > ? ORDER BY
     updated_at ASC LIMIT 5000` with no tiebreak, and the client cursor is a
     single `updated_at`. If ever >5000 rows share one timestamp (realistic:
     `bumpImagesForSync` stamps every image with one `now`, so hundreds of pasted
     screenshots become thousands of chunks at one ms), the pull returns the same
     first 5000 forever and the cursor pins — that device receives nothing new
     again and tail pictures stay "missing". Fix: keyset pagination — Worker
     `ORDER BY updated_at, id` + cursor `(updated_at,id)` + a client loop while a
     page returns exactly LIMIT; and/or stagger bulk-stamp timestamps. Needs a
     Worker redeploy. Not urgent while the library is small. Modelled in
     `tests/syncpix.js`.
  2. **Lasso move/scale/recolor of an existing stroke does not propagate (MED):**
     mergeInk keeps a stroke by id but "keeps either" geometry, so a moved stroke
     can lose to the old copy and devices diverge. Fix: stamp a modified time on
     the stroke when a lasso op changes it, and have mergeInk keep the newer.
  3. **Pulled ink for the currently-open page isn't always re-loaded (MED):** a
     merge that changes the open page's ink can be overwritten by the next local
     save. Fix: after a pull touches the open note, reload its surface strokes.
  (b151 fixed the HIGH "undo-of-erase reverted by sync" finding.)
- **Chips (mostly done):** freeze at page joins is gone, drag lands where you let
  go, section boundaries cross cleanly, the grey divider now shows during the
  crossing but **briefly** — the open question the user raised is whether to
  widen that window so the page number lingers long enough to read.
- **Lasso on typed text:** open reports of not being able to drag/resize the
  selection and of not being able to tap away to deselect. Partly addressed
  across b129–b138; verify on the current build before more work (the user's
  build number in a report can be off by one — see the memory note).
- **Finger scroll:** "better, not perfect." Lower priority than the chips.

### Starting a session in Codex (what the user does)
1. `npm install -g @openai/codex`, then run `codex` inside the project folder,
   sign in with the ChatGPT account (Plus plan includes CLI usage).
2. First message: *"Read HANDOFF.md and AGENTS.md in this folder, confirm the
   build ritual, then continue with <task>."*
3. Codex can edit files and run the `tests/`. It reads `AGENTS.md` on its own;
   point it at `HANDOFF.md` too (this file) the first time.

---

## Build log (append one line per shipped build — newest at top)

- **b192** `PENDING` - **chunks: the store and the arithmetic, with nothing on screen changed yet.** A chunk is a chapter between the section and the page - Section, then Chunk, then Page - so a long section can be browsed by the sitting it was written in rather than as one run of forty pages. It is a **browsing layer and nothing else**: it must never rename a page, because a page's name is the user's and a grouping that renames things is a grouping you cannot undo by regrouping. **This build deliberately shows nothing.** It is a schema bump (5 to 6), and a schema bump wants to land on its own, where the only thing that can have gone wrong is the schema. The upgrade is purely additive - it creates the store and rewrites not one existing record, which is exactly where an upgrade turns into data loss. Every page that exists names no chunk, and that is the ordinary case rather than a missing value: pages naming none form **one implicit group**, so a notebook that has never heard of chunks goes on behaving precisely as it did. What is wired: the store with both indexes; `chunkId` and `navOrder` on pages, nullable; create / rename / delete, where **deleting a grouping never takes pages with it** - a chunk id naming nothing living is treated as no chunk at all, so the pages simply reappear in the implicit group; grouping (`notesByChunk`) with the older pages first, empty chunks hidden, and a page with no `navOrder` keeping exactly the place it already had; the address string `S2C4P5`, where **P counts within the section** so it agrees with the name written at the top of the page - an address that disagreed with the title would be worse than none. Backups carry chunks (format 9) and older backups still open; an import repairs a chunk whose section did not arrive and a page naming a chunk that did not, both toward the implicit group. Sync publishes them **before** the pages that name them, or a page lands filed under nothing and jumps a moment later. Deleting, restoring and erasing a notebook all take its chunks. **Verified in-browser**: the live database upgraded 5 to 6 with the chunks store and both indexes present and all 1 notebook / 7 pages / 3 sections / 8 assets intact, and the app opened its note and its working sheet afterwards with the attachment still there. Next: the panel column and chips, then the offer when a new page starts a new sitting. - *Claude Code (Opus 5)*

- **b191** `PENDING` - **three more places where a sheet was not quite a page yet**, all from the same root: a working page became a real page and the code around it kept assuming there was only one. **Attachments.** The file already belonged to the right page - the chip did not. It was written into the note whichever page you were actually typing on, so attaching something in a working sheet left the sheet owning a file that only the note had a way of opening: delete the sheet and the file went with it while the chip stayed behind pointing at nothing. The chip goes into the host you were typing in now, saves through that host's own save, and **both** hosts' chips are hydrated - an un-hydrated chip is a dead label, because the click that opens the file is attached during hydration. **Re-linking.** Moving a sheet to another page never took its marker off the old one, so that page kept a chip naming a working page that belongs somewhere else, which walks you off to another page without saying why. Removed now, aimed at the exact sheet; a page that happens to be open is changed on screen rather than behind its back, or the next save would write it straight back; and a page since deleted does not hold the move up. **Export.** A sheet re-linked into another notebook HAS been converted, but its converted self is not among the old notebook's pages - so the export asked that notebook whether the conversion had happened, answered no, and shipped the legacy row beside it. Import that file and you get the sheet twice. The question is asked of every page everywhere now, while a row still has to belong to the notebook to be carried at all. **Verified in-browser**: a text file attached with the caret in the sheet landed in the sheet and not the note, survived a page turn away and back, and came back hydrated with its name and type. Also confirmed while looking: the older open item about **selecting a picture raising the keyboard** is already fixed - `selectImage` turns typing off and blurs both hosts. - *Claude Code (Opus 5)*

- **b190** `PENDING` - **search finds the short notes, and a sheet result opens the sheet it matched.** Two faults from the Codex audit, both real. When working pages became real pages they began answering every ordinary search, which buries the clean notes - so drawer pages were excluded. That went **one drawer too far and took the short notes with them**: a short note is the boiled-down version of a stretch of pages, the single most findable thing in a notebook, and it could not be found at all. The question is now *which* drawer rather than merely whether (`pageDrawer`), asked in one place and shared, with the page's own marks read before its filing so a sheet that arrived from another device ahead of its drawer still knows what it is. Second: a working hit stored the **parent** as the result, so tapping it opened the clean note and showed you everything except the words you had searched for. The hit is the page that matched now, with its parent kept beside it so the row can say "in rough working on S1P1"; and because a sheet is not in the reading order it cannot be gone *to* as a page - `openSheetPage` opens it as the sheet it lives in, at itself, for either kind. A short note opens over the first page it covers. Also named short notes properly in results: every one is stored titled "Summary", so the row is named by the stretch it was written about instead. Third fix, P2-11: the all-working list ranked pages from zero **inside each notebook** with nothing in the comparator saying which notebook a row belonged to, so page 1 of one subject sorted level with page 1 of another and the list alternated between books; the notebook is now the first thing compared, with its id to settle a tie. A parent in the bin counts as gone rather than sorting in among the live ones and claiming that page's title. **Verified in-browser**: "SHORT" finds both short notes and tapping one opens the short-note sheet at that page over the page it covers; "PAGE TWO" finds nothing until the working box is ticked, then finds S1P1w2 and opens the working sheet at 2/4. - *Claude Code (Opus 5)*

- **b189** `PENDING` - **the pages of a sheet became a run you can scroll through.** Reaching the foot of a working page stopped dead until you found the arrow at the top of the sheet, which is not how the pages of a notebook behave. There is a band below the page now, **inside the sheet's own scroller**, carrying the next page's words; scroll it more than 60% of the way up the sheet and the page turns. Sixty per cent is the same line the finger crosses between ordinary pages, on purpose, so the two feel like one thing. Three details decided it. **The band is below the page, never above**: a band above would move every ink coordinate in the sheet down by its own height, and strokes would land off where they were drawn - that is what `prevPad` exists for on the notes and it is not worth importing here. **Turning is counted on the crossing, never on the state**: a sheet page shorter than the sheet has its band in view the moment it mounts, and a rule that asked "is the band showing" each scroll event would turn that page the instant you touched it, and then the next, all the way to the end of the run. **At the end of the run the band offers, it never creates** - a stray blank working page every time you overscroll is far worse than reaching for a button once. A scrolled turn lands on the **head** of the next page rather than a remembered place, because that is where you were heading; a page picked from the rail still gets its place back. Fixed one thing found while testing: the run is fetched once when the sheet opens, so a page saved afterwards left the band previewing the version from then - write a line on the next page, come back one, and the band said it was empty. **Verified in a real browser, both kinds**: working w1 to w2 at coverage 0.83 landing at scrollTop 0, w2's band then showing w3's actual words, the end of the run offering "+ Add a page here" and creating nothing when scrolled past, the button making w4, and the same again in a short note (docked from the top) turning Short note 1 to 2. **And a five-build-old mystery is closed**: the reason sheet heights could never be verified in-browser is that this preview pane never advances CSS transitions, so a transitioned property reads a frozen intermediate value - `.pracsheet` transitions `height`, so it read 2px. With transitions off the three states measure 132 / 194 / 327, three distinct heights, arithmetic confirmed. That was never an app bug. - *Claude Code (Opus 5)*

- **b188** `PENDING` - **undo works in the sheets, which was the last real gap in "everything should work like normal notes".** There was **one undo history for the whole app**, and it serialised the note whatever you had been typing in. So the working sheet had no undo at all - and b183 was right to hold it back, because sharing that one history would have been worse than none: every keystroke in a sheet would have pushed the *note's* unchanged markup onto the *note's* stack, snapshots of nothing taken because you typed somewhere else, with your real edits pushed off the end of an eighty-deep stack. A history belongs to a **page** now (`textHists` / `histFor`), and which one you are undoing follows from where the caret and the active surface actually are (`activeEditHost`). `setBodyHTML` takes the host to write into, so undoing in a sheet re-hydrates the sheet's pictures and maths, not the note's. Parking a page's undo names that page outright - by the time a page is being left, "the current history" can already be the sheet's. **Three things had to change beyond the history itself.** The undo *chooser* only ever asked the note's history, so a sheet's undo could never be selected however recently you had typed. It also would have tried to **navigate to the sheet as though it were a page**, which is not a thing that can happen - a sheet is not in the reading order. And the general chooser weighs document-level operations like "made a notebook", which outrank a couple of typed lines by sequence - so undo inside a sheet undid something invisible while the line you had just written stayed put. Inside a sheet, undo is now the sheet's own: its words or its ink, whichever came last, and nothing else. **Verified in-browser**: typed two lines in the sheet, undo took it back to one, redo restored it, and the note was untouched throughout. Worth recording that my first two attempts failed for a reason that was not the code - the undo button is hold-to-repeat and ignores a synthetic `.click()`; it needed real pointer events. Two stale pins restated (`imgundo` for the wider `setBodyHTML`, `toolparity` because undo is shared now and the comment explaining why it was not had to go). Zero regressions. - *Claude Code (Opus 5)*

- **b187** `PENDING` - **rough working and short notes become one sheet with two names**, which is what the user asked for and what reverses the read-only-Strip call of b173. They were already the same underneath - a real page in a drawer - but a short note *navigated away* from the page you were summarising, taking the very thing you were writing about off the screen, while rough working opened over it in a sheet. Two mechanisms for one idea. Now the kind decides three things and nothing else: **the edge it arrives from** (working bottom, short note top, each leaving the way it came), **the colour of its paper**, and **which pages it lists**. That last is the interesting half. Rough working lists the sheets of the page you are on. A short note lists **every short note in the notebook**, ordered by what each covers - so one written on P2 about pages 2-4 and another on P5 about 5-8 are **one run**, and scrolling back from the second reaches the first. `summaryRun()` orders by the first covered page using the notebook's real page order rather than anything in a title, and a note whose covered pages are all gone keeps its writing and goes last, where it can be found and re-linked. **Verified in-browser end to end**: on S1P5, Sum up opened a sheet docked top labelled SHORT NOTE while the main page stayed S1P5 underneath; `pracPrev` reached "recap of 2 to 4" written on a different page entirely, and forward returned; `pracAdd` grew the run 2/2 to 3/3; the Practice button opened docked **bottom** as ROUGH WORKING; switching back and forth stayed clean. Also fixed while proving it: `prac.kind` is remembered so page-turning stays in its sheet, which meant **every button that did not name a kind inherited the last one** - pressing Practice after reading a short note opened another short note. Every caller names its kind now. A short note is no longer named `S1P5w2`, which was a working sheet's name and a lie for a note about pages 2-4; it is "Short note N" and points back at the first page it covers. Markers carry `data-kind` and are coloured warm or cool to match the sheet they open. New `tests/unifiedsheet.mjs`. Zero regressions. **Still open**: continuous *scrolling* between sheet pages (prev/next and add work; overscroll-to-add not built), sheet undo history, the image-sync backfill, `bringin.mjs`, and Chunks. - *Claude Code (Opus 5)*

- **b186** `PENDING` - **Codex's six b177/b178 findings, all confirmed and all closed.** (1) **P0, the dock-tab path could open the wrong sheet and lose a stroke.** `openPracticeById` searched only the sheets of the page you happened to be on; when the id was not among them `i` stayed at **zero**, so a tab naming a sheet on another page silently opened that page's *first* sheet and you would write into it believing it was the one you asked for. It also skipped `captureSheetPlace()` and `flushPractice()`, so a stroke drawn a moment earlier could be written under the new owner. It resolves by the sheet's own id now, saves and keeps the place first, navigates to the owning page when the sheet belongs elsewhere, and reports a missing sheet instead of falling back. (2) **`usablePageViewport()` never returned `paperRect`**, yet two callers read it - so the sheet's four heights and the drag clamp had *always* measured `window.innerHeight` instead of the page. (3) **A non-overlapping overlay counted as covering the whole page**: the inset took the strip's bottom against the paper's top without intersecting both starts, so an overlay pushed clear of the page still reported covering it. Both edges now, and the pair is clamped so two overlays can never cover more than the page exists. (4) **Persisted tabs were neither validated nor opened by id** - a restart put back whatever was written last time, including tabs for deleted pages. They are checked against the database before the rail offers them. (5) **The 280ms close timer had no epoch**, so closing one sheet and opening another inside the animation let the first one's timer hide the second. (6) **`flush()` did not await the ink and sheet writes on the branch where the note is also dirty** - the one case that matters - so a fast close could outrun the drawing it had just been asked to save. **Also fixed a false-green of my own making**: `sheetstates.mjs` handed `sheetHeightFor` a fake viewport carrying `paperRect`, a field production never returned - green in the suite while production measured the whole window. The arithmetic is a pure `sheetHeight(state, paperHeight, oppositeInset, custom)` that takes its numbers and cannot reach out to be lied to; 15 assertions now cover insets, drag overrides and tiny screens. **The sheet's rendered height still cannot be verified in the preview pane** - inline `height`, inline `!important`, the attribute rule and flex overrides are all ignored there, every one computing exactly 52vh. That is the **fourth** independent anomaly in that pane after animation frames never firing, `position:fixed` resolving against an ancestor, and identical heights across states. It needs the tablet. Zero regressions; `chunks.mjs` and `layoutmath.mjs` (Codex) both green. - *Claude Code (Opus 5)*

- **b185** `PENDING` - **lighter papers, and every zoom control finally agreeing what 100% is.** (1) **The tints were too dark because they were mixed against the wrong colour.** A sheet is built on `--field`, which is plain **white**, not on `--ground` behind the page - so tinting toward the desk landed both papers far below the one they sit beside and they read as greyed-out rather than as different paper. Both are a whisper of white now: `#fffaf0` warm for working, `#f3f8ff` cool for a short note, white left alone for the note. (2) **The page was losing a seventh of itself to margins.** Side padding was `clamp(16px,4vw,44px)` - a slice of the **window**. With the side panels open the page is far narrower than the window, so the margins sat at their maximum and ate **88px of a 640px page**. A share of the page instead: 58px, and it scales properly. (3) **Several controls still reset to raw 1**, which after b184 is no longer 100% - the ladder rungs, the 100% preset, Ctrl+0 and the boot default. That is what "sometimes it zooms back on its own" was. Everything works in ratios of the fit now and converts once at the point of applying; a remembered zoom is stored as a ratio too, so a page zoomed on the tablet is the same size on the laptop. (4) **And a feedback loop that made zoom do nothing at all above 100%**: `fitWidthZoom()` measured the rendered sheet, but the sheet is capped at `--page-w` *and* constrained by the scroller, so whenever the scroller is narrower its rendered width is the scroller's width at **every** zoom. Dividing that by the zoom gave a natural width that shrank as you zoomed in, so the fit came out equal to the current zoom - the label read 100% at every level while the number underneath climbed and nothing on screen moved. Same clamped-rect trap as b182, fixed the same way: read `--page-w`. **Verified in-browser**: at 100% the sheet is 640px in a 640px writing area; the ladder now reads 125/150/200/75/50 with the sheet actually resizing; 50% survives a page change. **Also confirmed and worth telling the user plainly**: at 100% the page *does* fill the writing area - the remaining 460px of the tablet is the side panels, which the page cannot extend under. Zero regressions. **Next: the unified sheet**, confirmed by the user - short notes and working as one mechanism with two names, multi-page and continuous scrolling. - *Claude Code (Opus 5)*

- **b184** `PENDING` - **zoom stops undoing itself, and 100% finally means something you can see.** Two more the user reported from the tablet. (1) **Zoom reset at every join.** Opening a page ran `applyZoom(z || cfg.defaultZoom || 1)`, so a page you had never zoomed fell back to 100% - scroll from a page you had zoomed out on into its neighbour and it snapped straight back in, unasked, every single time. A page with no stored zoom now **inherits the zoom you are already using**; a page you zoomed deliberately still keeps its own. (2) **"100%" was a number nobody could use.** A page is a fixed sheet in its own units - 794 of them - and those are not screen pixels on any device, so the percentage was the ratio between the page's internal width and a count of CSS pixels: on this tablet 100% was a page that did **not** fill the writing area, and no setting meant "the page, across the screen, as paper". `baseScale()` is the scale at which the page exactly fits, and the number is now a ratio to that - 100% is the page across the writing area whatever the screen, 200% is twice it, and the floor and ceiling are fractions of the fit too. Everything underneath still works in the real scale, so ink, joins and chips are untouched. Tapping the number returns to the fit. **Verified in-browser**: at 100% the sheet measured 640px in a 640px writing area; zooming to 50% and moving to the next page held at 50% where it used to snap back to 100%. `tests/zoomdrift.mjs` extended. Zero regressions. - *Claude Code (Opus 5)*

- **b183** `PENDING` - **the working sheet stops being a poorer editor than the note.** The user reported that the tools do not behave the same in the three writing areas. Counted: **twenty handlers on the note, three on the sheet.** The editor grew up on the note, so each behaviour was wired straight to that one element and simply did nothing in the sheet - a to-do box that would not tick, `**bold**` that never expanded, Tab that jumped out of the page instead of indenting, pictures that could not be selected or put down, links that would not follow, maths that could not be reopened, attachments that could not be removed or renamed. It looked like a different, poorer editor because it was one. `editHosts()` / `onEditHost()` bind through one place, and **twelve behaviours** were converted, so a behaviour added once reaches both and the next cannot quietly become note-only. **Short notes needed nothing**: they are real pages using the note's own editor, so they already had every one of these - the gap was only ever the sheet, which is why closing it closes ten holes at once. **Two deliberately held back, with the reason in the code**: the text undo history, because `snapText` serialises `$("body")` whichever host the keystroke came from and sharing it would push the note's unchanged markup into the note's own undo stack - snapshots of nothing, taken because you typed somewhere else; and audio caret stamping, which walks up to `$("body")` and finds nothing from inside the sheet. The sheet needs an undo history of its own first. **Two must never be shared**: tapping and removing a working marker, since a marker inside a sheet would be a sheet hanging off a sheet. **Verified in-browser**: a to-do in the sheet went `todo` to `todo done` on tap, which did nothing before. New `tests/toolparity.mjs` pins the counts so they cannot drift apart again. Zero regressions. **Next**: zoom resetting to 100% when scrolling to another page, and making 100% mean the page fits the tablet width - both reported by the user mid-build. - *Claude Code (Opus 5)*

- **b182** `PENDING` - **the two zoom faults the user reported on the tablet.** (1) **Handwriting and typing drifted apart when zoomed out** - reproduced in a browser first: zooming 100% to 50% moved the sheet's left edge from 13px to 212px, because `margin:0 auto` re-centres it as it shrinks, and the text went with it. Page coordinates, though, are measured from the **scroller's** left edge and simply scaled, so ink drawn beside a word ended up about **200px away from it**. The same fault means ink already shifts with window width; zoom only made it obvious. `sheetDrift()` is the difference between where the sheet actually sits and where a straight scale would have put it - **zero at 100% by construction**, so every existing page draws exactly as before and nothing stored changes - and both the canvas transform and `toPage` go through it, so the nib lands where the ink will be drawn. The sheet's own width is read from `--page-w` rather than measured, because past 100% the sheet is wider than the scroller and its rect is no guide to where an unzoomed one would have sat. **Proven**: worst mismatch across 135% down to 50% is **0px**, against ~200px before. (2) **Page turning stopping mid-notebook** - not reproduced directly, so this is a defensible fix rather than a confirmed one, and the user should be told so. `finishHandover` returned early when a newer page had won the race, **leaving `handover.busy` set**; every page turn was then refused until the 2500ms guard fired. Crossing joins quickly - exactly what zooming out causes, since each page is fewer pixels tall - would make that fire repeatedly and feel like scrolling had stopped in the middle of a notebook. `abandonHandover()` now releases a doomed swap the moment it is known to be lost, and a lock with no pending swap behind it is treated as stale rather than waiting for the guard. New `tests/zoomdrift.mjs`. Zero regressions. **Still to come**: the tool-parity audit across main/working/short notes, and the unified sheet with multi-page and continuous scrolling. - *Claude Code (Opus 5)*

- **b181** `PENDING` - **the page now sits on a desk, and zooming out is worth doing again.** This corrects b180. The user asked for "the page width fixed even when I zoom out", which b180 read as *stop zooming out*. Their clarification made the real complaint clear: zooming out was fine, but nothing said where the paper ended, so the space around it read as more page. **The cause was not zoom at all.** `.paper` was painting the same ruled lines the template already paints on `.sheet` - across the full width of the scroller - so the ruling simply ran on past the edge of the paper and zooming out produced more of the same surface. `.paper` is now a plain `--desk`, darker than any paper in both themes, and the sheet keeps the template's ruling untouched. The per-kind tint is applied by overriding **`--field`**, the colour each template already builds its ruling on, rather than by setting `background` - which would have tinted the paper and wiped every line with it. `cfg.fixedPageWidth` survives as an opt-in for anyone who does want the sheet pinned to the width, but it is **off by default** and `zoomFloor` behaves as it always did. **Verified in-browser at 50% zoom**: desk `rgb(10,12,11)` with no ruling, page `rgb(20,24,23)` ruled, sheet 397px inside a 820px scroller so the desk is plainly visible, and a short note still both tinted `rgb(19,26,32)` and ruled. Zero regressions. - *Claude Code (Opus 5)*

- **b180** `PENDING` - **the page is a fixed sheet, and the three papers no longer look alike.** Two things the user asked for directly. (1) **The page stopped shrinking when you zoom out.** `.sheet` is `max-width:794px` with CSS `zoom`, so the sheet already reaches across the writing area at 100% and every step of zoom-out only pulled it into a narrower column in the middle of an empty desk - nothing was gained by any of it. `zoomFloor()` now measures `fitWidthZoom()` and stops there, clamped to at most 1 so actual size is always reachable however wide the screen is. Deliberately **not** reflow: the sheet must keep its page coordinates, because ink is stored in them and words are not, so reflowing would slide the handwriting against the typing. It costs the ability to shrink text to fit more lines on screen, so it is `cfg.fixedPageWidth`, on by default, rather than something quietly removed. (2) **Three papers you can tell apart before reading a label.** `.paper` and `.paper.prac` had been the *same* `--ground` - there was no visual difference at all, only the words. Now `--ground-work` (warm) and `--ground-short` (cool) join it, defined in both light and dark, applied through `body[data-pagekind]` set in `finishRender`, and the working sheet's own paper matches the working page. Kept close to `--ground` on purpose: enough to tell apart, not enough to read as a different app. **Verified in-browser**: six zoom-out taps left the sheet at 794px with the button disabled, zoom-in still worked to 115%/820px, and zooming back out returned to exactly 794px; the three page kinds resolved to three distinct backgrounds with the sheet matching its page. One window in `covers.mjs` widened from 200 to 600 characters - the ordering it checks is unchanged, but a few added lines pushed `landAnchor` out of a window cut close to how the code happened to look that day. Zero regressions. **Next (b181): merging short notes and working into one sheet** - the user is right that they should be one mechanism with two names, which reverses the read-only-Strip call made in b173. b178 already built the machinery for it. - *Claude Code (Opus 5)*

- **b179** `PENDING` - **the pristine bytes an Uncrop needs now reach the other device, and a repair can no longer overwrite newer writing.** Two things, the first urgent. (1) **P0, and mine from b174**: `repairMigratedWorking` and `repairMigratedInk` called `touch()`. Repair is this device rebuilding what an earlier build dropped on the way in - it is not an edit you made, and stamping it as one loses real writing. A device switched off for a week would boot, copy one missing field into its stale copy, and walk away with the newest clock on the whole record; last-writer-wins would then hand that stale copy to every other device and take the newer writing with it. Neither repair stamps a clock now. Nothing needs to travel, because each device repairs from its own legacy rows. (2) **Two-slot picture sync.** Only `asset.blob` was ever sent, so a crop reached the other device and **Uncrop there had nothing to restore** - silently, discovered only by someone trying it. A picture now travels as two independent generations. Display bytes keep their exact old row ids, so nothing already uploaded is stranded and older builds still understand them. Pristine bytes live in a reserved `:orig:` namespace and deliberately carry **no `assetId` in the body**: an older build resolves the owner as `assetId || id.split(":")[0]`, which for these rows gives an empty string, so it **ignores** them rather than mistaking pristine bytes for display bytes and overwriting the picture. Index zero is the generation header: only parts carrying its revision may join, so recropping smaller cannot glue a new short image onto the old long tail, and a missing part leaves the slot unfinished rather than wrong. One fixed head tombstone speaks for a whole slot, because a client cannot know how many stale tail rows a server still holds; **absence is never a tombstone**, so an older build sending only display bytes cannot clear a newer build's original. Pull groups by `(picture, slot)` and keeps a durable accumulator per pair, importing the single old one into the display slot once. `setSyncedImageSlot` writes one slot without `putSynced`, whose `keepLocalBytes` restores a local original whenever an incoming light row lacks one - right for a light row, exactly wrong for a tombstone that means it is genuinely gone - and without touching the clock, since receiving someone else's bytes is not an edit. **Verified in the running app**: two streams; blob ids unchanged; an older build resolves an orig row's owner to `""` and ignores it; both slots assemble; recropping smaller yields the new image and refuses the stale tail; a tombstone clears; old slot-less rows still decode as display bytes. `tests/origsync.mjs` (Codex) fully green, model checks and live wiring both. Zero regressions. **Still open**: the one-time backfill for pictures cropped by an older build - their existing original is not considered changed, so it will not leave that device until it is next edited. Deferred rather than rushed, because a clock bump is exactly the LWW hazard fixed in (1) and it wants a resend list instead. - *Claude Code (Opus 5)*

- **b178** `PENDING` - **four sheet states, and the sheets you have open remember where you were.** State moved off `body` and onto the sheet itself as `data-dock` + `data-state`, so a top dock and a bottom dock can both be open without the selectors multiplying - which is what `body[data-prac]` made impossible. Up to **three named dock tabs** in a rail along the bottom, each holding its page, its scroll position, its state and its folded-ness, persisted through `dockTabs` so a restart puts the same three back. The switch is one transaction in the order that actually matters: capture the outgoing place **before** anything asynchronous starts, flush, mount, then restore the place **only after** the ink load resolves and the browser has laid it out - restoring earlier is worse than not restoring, because an empty host is short and clamps a saved place to nearly nothing that no later hydration puts back. **Three real bugs found while building it.** (1) **`afterLayout()`**: the sheet's slide-in waited on two animation frames, and some webviews never deliver one - the sheet then stayed off-screen for ever. It has a timeout fallback now, and the immediate proof was that the sheet **opened in the preview browser for the first time all session**, which had silently blocked every attempt to verify sheet behaviour up to this point. (2) **The old Tab CSS had been inside `@media print`** - so that state had never applied on screen at all, for as long as it had existed, and a sheet set to Tab simply stayed the height it already was. (3) The grip clamped to the whole window rather than the dock's room, and only ended on `pointerup`, so a gesture the browser took away left the drag armed. **Verified in-browser**: the sheet slides in; a sheet scrolled to 420, turned to a second sheet that opened at 0, and came back to **exactly 420**; both tabs persisted with their own places; the header folds itself at Strip. **Not verified in-browser**: the four pixel heights. The pane reports the same height in all four states even against an inline `!important`, with no ancestor breaking containment - the third layout anomaly this pane has shown, alongside the missing animation frames and `position:fixed` resolving against an ancestor. The calculation was therefore moved into one pure function and **unit-tested directly** (hidden null, strip 132, half 520, full 954 on a 1000px viewport, ordered, drag-override applying to half only, small screens still usable). Worth a real look on the tablet. Two spans in `sheetstates.mjs` retargeted because they searched a JavaScript window for rules that live in CSS thousands of lines earlier, one restated as the ordering it was reaching for, and a stale pin in `workpages.mjs` updated after `gotoPracPage` began capturing its id first. Zero regressions. - *Claude Code (Opus 5)*

- **b177** `PENDING` - **three ways the working sheet could lose what you had just drawn.** All three from Codex's final sheet/bring-in audit, all confirmed in the code first. (1) **The Strip stole the pen.** `setStripState` assigned `ink.active = "note"` on every state change - and my own comment directly above it claimed the opposite. It read as harmless because the Strip is usually raised while the main page is being written on, so the assignment looks like a no-op. It is not one when a working sheet is open: showing, resizing or expanding the Strip handed the pen back to the main page, and the next stroke landed on the lecture instead of the working page you were reading. A read-only band owns no surface, so the right number of times for it to assign `ink.active` is **zero**. (2) **A delayed ink save did not know which page it belonged to.** The practice surface saves 600ms after a stroke and read `prac.rec` *at fire time*, so drawing on sheet A and immediately switching to B wrote A's ink onto B. The save is bound to an owner captured when the sheet was mounted, cleared on close so a stray late save has nowhere to write; and `flushPractice` clears **both** clocks - the words' and the surface's - where it used to clear only the first, leaving a stroke save in flight across the very switch it was meant to prevent. (3) **The sheet took the pen before its ink had loaded.** Since ink became a record of its own, opening a sheet enabled drawing while the fetch was still in the air; on a slow tablet a stroke drawn straight away appeared and then vanished for good when the fetch resolved and replaced the array underneath it. The surface is held shut until the ink is installed, and a failed fetch releases it rather than leaving the sheet permanently unwritable. Also: `flush()` started `flushInk` and `flushPractice` and then forgot them, so a caller awaiting it could navigate away mid-write - it returns one ordered promise now. **Verified in-browser**: the working sheet and the Strip dock together, the sheet stays open while the Strip is raised and resized, which is exactly the case that used to move the pen. Three assertions in `strip.mjs` restated - two because the correct behaviour is now *no* assignment rather than the right one, and one re-anchored on `stripTop` after a comment pushed it out of a sliding window. `tests/sheetgeom.mjs` (Codex) green. Zero regressions. **Ten builds b168-b176 pushed to GitHub this session** once the cause of the outage was found: the laptop's DNS resolves github.com to a dead edge address while api.github.com and everything else works, so the push went out with a working IP pinned. - *Claude Code (Opus 5)*

- **b176** `PENDING` - **the last of the Codex audit's medium findings: things that read wrong once working pages became real pages.** (1) **Rough working answered every ordinary search.** `allNotes()` includes drawer pages now, so searching buried the clean notes you were looking for under the scribbles you had already discarded. Search excludes drawer pages by default and finds working pages only when asked - and when asked it reads the **current** working pages rather than the legacy store, which is read once at boot to be converted and holds nothing afterwards. (2) **A notebook export carried both halves of every sheet**, its legacy row beside the page it had become, so importing that file gave you each sheet twice; only a genuinely unconverted row still travels, and after boot there are none. (3) **The all-working list sorted by parsing `SxPy` out of the title.** That holds only while every page is auto-named: rename one page, or reorder the notebook, and the sheets sort by a number that no longer means anything. It builds a real page-order index the same way the page list does, with sheets whose page is gone last. (4) **`SecN` suggestions skipped numbers** - a notebook with a Working and a Summary drawer offered `Sec4` when you had two sections, which reads like something has been deleted. Only visible sections are counted. **Verified in-browser** on a notebook whose pages were deliberately renamed away from `SxPy`: a plain search returned only the clean note; the same search with working included also found the sheet, marked `[practice]`; the next section name came back `Sec2` not `Sec4`; and the working list ordered by real page position rather than title. Zero regressions. **Note on the ritual**: b175's bump failed with a Google Drive permission error and the commit went ahead regardless, shipping b175's code still calling itself b174 - fixed in `96697fc`. From now on the bump is verified against both files before anything is staged. - *Claude Code (Opus 5)*

- **b175** `PENDING` - **what a copy quietly lost, and what re-linking forgot to move.** Four more from the Codex audit, all confirmed then proven in a browser. (1) **Copying a page rebuilt it from a list of fields**, so Covers, the bookmark and anything added later were dropped - a copied short note came back having forgotten what it was a summary of. It spreads the source now and overrides only what identifies the copy; Covers are deep-copied so the two pages do not share one array. (2) **A copied page still named the ORIGINAL working sheets in its markers**, so every marker on the copy opened the original's sheets - two pages quietly sharing one set of working pages, and you would edit one believing you were editing the other. Markers are repointed at the copy's own sheets. (3) **A copied notebook had the same fault twice over**: its markers named the original's sheets and its summaries pointed at the original's pages. Both are remapped through the new page-id map; a reference that does *not* resolve inside the copy is deliberately left alone, because it genuinely points somewhere else. (4) **A picture dropped into a working sheet belonged to the parent page**, because insertion always took `state.note.id` regardless of which surface was active - duplicating the sheet could miss it, two copies could share one asset, and erasing either page for good could take the other's picture. One `activeNoteId()` now answers it, used by pictures and attachments alike. (5) **Re-linking a working page only repointed it.** Changing `worksFor` alone left the sheet filed in the old notebook's Working drawer, so it vanished from the drawer of the notebook it now belonged to and its name still claimed a page it had nothing to do with; it now moves notebook, drawer, order and name together and leaves a marker on the page it has moved to. **Verified in-browser**: a page with two sheets and a summary was copied and its markers pointed at the copies with none naming the originals, the copied summary kept its Covers as a separate array; a whole notebook was duplicated - 9 pages, every marker and every Cover landing inside the copy, none at the original, both drawers still drawers; and a relink moved a sheet across notebooks, into that notebook's Working drawer, renamed `S1P1w3`. Fifteen new assertions in `workpages.mjs`. Zero regressions. Still open from the audit for b176: `orig` bytes lost in image sync, `exportNotebook` legacy rows, search including working notes, `practiceAll` parent ordering, `suggestSectionName` counting drawers, unread `nplace:`. - *Claude Code (Opus 5)*

- **b174** `PENDING` - **two ways a permanently deleted page could come back, and damage no restart could ever repair.** Both from an independent Codex audit, both confirmed in the code before touching anything, both proven fixed by driving a real browser. (1) **The hardened migration never repaired what the first one broke.** b169 fixed the conversion mapping but only ran on rows that had no page yet - `old.filter(p => !byId[p.id])` - so anything the thinner b168 mapping had already converted kept its damage for good: unknown fields dropped, a null deletion date written over a tombstone, no ink record at all where the strokes had been rubbed out, and a minted rather than derived ink id. The scan now has **two jobs**: rows with no page are moved, rows that already have one are **repaired in place**. Repair merges only what is absent and overwrites nothing - the page is the newer copy of the words, the legacy row the more complete copy of everything else - erasure maps are unioned with the page's own entry winning, the taller height is kept, and **an old tombstone is applied only when nothing has happened to the page since**, because a delete that predates real writing would take that writing away. **Proven in-browser**: a deliberately damaged page got back its unknown field (`futureField: "must survive"`), gained the ink record it never had, recovered its erasure map `{s1,s2}` and its 2400px height, kept its words untouched, and a second boot changed nothing. (2) **A working page's legacy row survived being erased for good.** `purge` deleted notes by id but cleared legacy rows through `by_note` - and a working page's row is keyed by the page's *own* id while its `noteId` names its parent. So erasing a working page left its row behind and **the next boot built the page straight back out of it**, and erasing an ordinary page took the rows of every working page hanging off it, including ones deliberately kept alive. Legacy rows now go by primary key; assets still clear by the page they belong to. **Proven in-browser**: erased, reloaded, and it stayed erased. Also hardened while there: one bad id in the purge list used to abort the whole transaction, so nothing at all was erased and the trash quietly stayed full. Fourteen new assertions in `workpages.mjs` covering both, including reference models for the tombstone rule and the erasure merge. Zero regressions. Still open from that audit and queued for b175: image ownership on sheets, `orig` bytes lost in sync, duplicated pins keeping old child ids, Covers dropped by duplication, and cross-notebook Relink. - *Claude Code (Opus 5)*

- **b173** `PENDING` - **the Strip: reading a short note without opening anything.** This answers the original complaint exactly as it was put - *"we should be able to read short notes only, without needing to open and close the worksheet again and again"*. A toggle does not answer it, because a toggle is still opening and closing. A band across the top does: you glance up, you read, and your pen has never left the page underneath. `#sstrip` is a **fixed sibling overlay**, deliberately not content inside `#body` - anything living in the page would become part of the page's own height and every join measurement would then have to reason about it. Its body carries **`class="prevpeek-body shortstrip-body"`**, so all 62 existing peek rules reach it by construction rather than by being copied a third time; copying is what makes it look right the day it is written and then drift the first time a heading or picture rule changes only two of the three. Content is rendered through `previewHtml(html, "live")` - the interactive mode added in b171, where links stay followable because you are reading this on purpose, unlike a peek band where a stray finger must not navigate you away mid-scroll. **It registers no drawing surface**: there are two in this app and a third would be a third thing to keep in step; reading needs none. `stripTop()` anchors to `#paper`'s own top rather than measuring the docbar and applying an offset - that breaks the moment the toolbar folds, is hidden from Settings, or wraps to a second row. The badge now **raises the Strip instead of navigating**, because reading the short note should not cost you the page you are writing on, and an open Strip **follows you from page to page** rather than shutting, since a summary covers several pages and walking between exactly those is when you want it up. Two real fixes fell out: `listProgress` now asks `pageFracNow` instead of recomputing the within-page fraction a second, nearly identical way - landing is `pageScrollFor`, that function's exact inverse, so the two sums drifting meant a chip drag did not round-trip and the page settled slightly away from where the chip had been; and `jumpTop` measured "am I at the top" with raw `prevPad()`, so with the Strip up the first lines sat behind it and a second tap turned the page instead. **Verified in a browser, and this is the case b172 could not reach**: the Strip renders at 132px sitting exactly on the paper's top edge, header reading "For S1P2", body carrying both peek classes - and with it up the page head lands at 537 against 405 with it away, a difference of **exactly the 132px inset**. So the shared viewport helper genuinely moves every measurement by the height of what is covering the page. **One deliberate deviation from the audit, recorded in `tests/strip.mjs` with its reasoning**: it expected Half/Full to become a second writable editor with its own `ink.active`. Four lines above, the same suite forbids registering another writable ink surface - and this app has exactly two, so handing `ink.active` a third name owning no surface would be a lie the drawing code eventually trips over. More importantly it contradicts the keystone: a short note is a real page, so writing in one means **opening it**, with the whole editor, undo and tools - not a cut-down copy floating over the page you came from. The Strip reads; **Open** navigates; the Back chip and Go to main carry you between the two. The assertion was replaced by two that pin what must stay true: no state of the Strip ever takes the pen, and Open navigates rather than floating a second editor. `tests/strip.mjs` and `tests/viewport.mjs` both fully green. Zero regressions; the only reds left are `bringin.mjs` and `sheetstates.mjs`, still unbuilt. - *Claude Code (Opus 5)*

- **b172** `PENDING` - **one shared answer to "how much of the page can you actually see".** Groundwork for the Strip, and deliberately a no-op on its own. Every part of the app that measures the screen - both chips, the hand-over at a page join, where a page fraction sits, what a remembered place means, where a reveal lands - was reading `#paper`'s own rectangle. That is correct only while nothing is docked over the page. A short-note Strip across the top and the working sheet across the bottom make every one of those measurements wrong by the height of whatever is covering it, which shows up as clipping at a join, a chip that lies about where you are, a place that comes back somewhere else, and a page that turns itself when you did not ask. Correcting them one at a time is how the next one gets missed, so `effectivePageViewport()` now answers once - `{top, bottom, height, topInset, bottomInset}` - and **22 call sites plus 6 reveals** go through it: `savePlace`, `restoreScroll`, the paintDoc chip landing, `listProgress`, `chipTrack`, `pageScrollFor`, `pageFracNow`, `chipPeekReady`, `chipPeekGeometry`, `driveChipScroll`, `armChipHandover`, `pageHandover`, `finishHandover`, `pageBottom`/`atPageEnd`, `flowTo`, `visibleStrokes`, `autoScroll`, `revealBounds`, the top/bottom jump buttons, `lassoPromote`, plus `revealInPageViewport()` replacing `scrollIntoView` for the outline, anchor landing, audio follow, find results, the current-heading probe and the caret - `scrollIntoView` centres against the browser's viewport, which knows nothing about a Strip, so "centred" parks the thing you asked for underneath it. `pageTopBase()` is the matching pair: the head of the page, less whatever is docked over it, so fraction 0 still means "head at the top of what you can see". **The seven page-space invariants stay page-space**: `startGlide`, `fingerPanMove`, `rebasePan`, `nearPageFoot`, `growForInk`, `pageHeightFor` and the peek band sizing must NOT acquire a viewport dependency - adding Strip height to a stored page height changes `scrollHeight` and recreates the very join jump this exists to prevent. Also: the anchor flash now fades on a CSS animation rather than a timer, so nothing waits on a clock that can outlive the page. **With nothing docked every inset is zero and the helper returns exactly what `clientHeight` did**, which is the whole safety argument - proven in a browser: `jumpBottom` produced an identical `scrollTop` (6852) and identical foot position with and without the sheet. Two pane limits stopped a non-zero inset being exercised in-browser and are worth knowing for next time: `requestAnimationFrame` never fires in the preview pane (so the sheet's slide-in never completes there), and an ancestor transform makes `position:fixed` resolve against it, so the sheet renders below the page rather than over it. That case gets its real test in b173. Five stale source-text pins rewritten to the new intent, each keeping the sentence describing the old bug: `chips.mjs`, `joinflaw.mjs` 55, `scrollsim.mjs` 8/9/18 (plus a new 18b for the shared base). Three spans in Codex's `viewport.mjs` pointed at functions this file does not have - `paintBacklinks`, `paintCurrentHeading`, `performUndoJump` - so one span was empty and could never pass and two ran to the end of the file; retargeted at `paintTags`, `paintOutlineHere` and the per-tool-colour marker, and reported. Zero regressions; the only reds left are the three unbuilt forward specs. - *Claude Code (Opus 5)*

- **b171** `PENDING` - **short notes exist, and they link both ways.** A short note is an ordinary page in a per-notebook **Summary** drawer; what makes it a short note is `covers`, a list of `{noteId, anchorId, notebookId}`. **Ids, deliberately never the label.** `S2P3` is recomputed the moment pages move, so a link stored against it breaks the first time a page is inserted - and breaks silently, which is the worst way. The chip resolves its label fresh on every paint, so moving, renaming or re-filing a page leaves the link landing exactly where it should. `anchorId` means a Cover points at a **spot**, not the top of a three-screen page; `notebookId` rides along so a summary can point into another notebook with no extra feature - that is the class-notebook/my-notebook case working for free. **Nothing is ever tagged**: `Sum up` stamps the page you were standing on, and `+` adds wherever you last came from. Landing rewritten: `scrollToAnchor` used to wait a flat 260ms then look once, so on a slow mount it never landed and you arrived at the top with nothing to explain why; the id is parked in `pendingAnchor` and whichever render actually wins consumes it via `landAnchor()`. `nearestAnchor` now counts sideways as well as down (weighted 0.25, since a page is far taller than wide) - vertical-only made an anchor at the far edge of the same line look nearer than the one under your finger. `copySpotLink` **makes** an anchor when none is within reach instead of silently falling back to the top of the page. `previewHtml(html, mode)`: "peek" keeps links inert (a stray finger on the band below must not navigate you away mid-scroll), "live" keeps them and keeps `sp_` anchors so a link inside a preview can find its place; the two link-stripping paths were merged into one, because two places deciding the same thing is how they come to disagree. The way back is `backTrail`, held **in memory only** - the old design wrote a permanent "back to X" link into the page you landed on, editing a note you never asked to edit and leaving dead links behind once pages moved. `conflicting()` now compares Covers, so two copies whose words match but whose sources differ are treated as a real conflict rather than silently last-writer-wins. New UI: `#coverBand` (COVERS, chips, `+`, `Go to main`), `#sumBtn`, `#srcBadge` (reads "1 summary . 3 working", or doubles as the Back chip). Verified end to end in a real browser: Sum up made a summary in the Summary drawer holding `[{noteId:nt_T, anchorId:sp_..., notebookId:nb_T}]` with **no label stored**; Go to main returned to the source; the badge read "1 summary . 3 working"; tapping it went back to the summary and offered a Back chip. `tests/covers.mjs` (Codex) fully green. Two harness fixes, both reported: `covers.mjs` measured its no-timeout assertion over a 500-line span that swept in the audio follow and two canvas redraws - tightened to the landing path, with a new assertion pinning the park-and-land design; `peek.mjs` extracted `previewHtml(html)` by exact signature - updated, plus four assertions for the new peek/live split. Zero regressions. - *Claude Code (Opus 5)*

- **b170** `PENDING` - **the drawers stay out of the way, through one predicate rather than ten filters.** `isDrawerPage(n, drawerIds)` / `ordinaryPages(notes, sections)` / `ordinarySections(sections)` now answer "is this a page you write on, or one of the drawers" in a single place, and `pageOrder`, `paintNotes`, `paintSections`, `counts`, `notesSnapshot`, `planSecPageNames` and `ensureDefaultSection` all ask it. The Codex spec was right that fixing each painter on its own terms is how the next consumer added gets missed. `worksFor` is checked before the section id so a working page is still one even before its drawer has arrived from another device. Specifics: `pageOrder` (which every page turn, both chips and the whole hand-over walk) no longer yields drawer pages, so a working sheet cannot land in the middle of the lecture you were scrolling; `paintNotes` filters **before** sorting and matching; `counts`/`notesSnapshot` exclude drawers from notebook length while **keeping** stars and bookmarks on working pages in their own lists, because you put them there deliberately; `planSecPageNames` numbers sections by their place among the **ordinary** ones (counting a drawer in would have shifted every section number, renaming every page after it, the first time a notebook grew a Working drawer) and a skipped page no longer eats a page number, so P3 is not followed by P5 for no visible reason; `ensureDefaultSection` will not sweep an unfiled working page into sec0; `deleteSection` refuses a drawer, since moving its pages to sec0 would tip every working page into the ordinary list at once. New: **Source missing - Relink** in the sheet header. A working page whose source page was deleted is not broken and is not hidden - it often holds the only copy of a derivation, worth more than the page it came from - so it says what happened and offers to hang itself off whatever page is open. Verified in a real browser against a notebook holding 1 ordinary page and 3 working pages: the page list shows only the ordinary page, the section list shows `Sec1 (1)` and `Working (3)` with the drawer marked, the drawer is named `Working` and not `Sec 2`, and the notebook badge reads **1**, not 4. `tests/drawers.mjs` (Codex) fully green; `secpage.mjs` and `workpages.mjs` updated for the new intent rather than deleted. Zero regressions - the only reds are the forward specs for b171-b179. - *Claude Code (Opus 5)*

- **b169** `PENDING` — **hardening b168 against an adversarial Codex audit. Six real data-loss paths, every one confirmed in the code before fixing and every one re-verified by driving a real browser.** (1) The migration filtered `live` and wrote `deletedAt: null`, so a **tombstoned working page was resurrected** — and would be again on every device the old row reached; tombstones now migrate as tombstones, ink included. (2) It built the new record field by field, so **any field it did not know about was dropped**; it spreads the old record first and overlays the page's own fields. (3) It only wrote an ink asset `if (p.strokes.length)`, so a page whose strokes had all been **rubbed out lost its erasure map** and would un-erase the lot on next read; the test is now "is there any ink data at all". (4) The ink asset took `newId("ink")`; the id is derived (`ink_<pracId>`) so a second pass cannot leave two. (5) **The `workingMigrated` flag was a trap** — it stopped the scan, and the scan is the only thing that catches an old row arriving late from sync or a restored backup. Flag removed; the scan is cheap because a row that already has a page is skipped on sight. **Proven in-browser: a row seeded after migration had already run was picked up on the next boot with nothing duplicated.** (6) `practicesFor()` returns notes now, so `deleteNote`/`deleteNotebook`/`restoreNote`/`restoreNotebook` were **writing page records into the old `practices` store**; none of the four touches it any more, and one pass over the notes suffices because a working page is one of them. Also: boot and old-backup import share **one** converter (`practiceToNote`/`practiceToInk`); import converts legacy `practices` rows and format-1 `scratch` into pages instead of a dead store; `exportBundle` no longer ships legacy rows beside the pages they became (a backup carried both halves of every sheet); `practices` dropped from `SYNC_STORES`; `serializeBody` split into `serializeHost(el)` so the sheet saves **scrubbed** markup instead of raw innerHTML with dead object-URL `<img>`s and rendered KaTeX; `cloneAsset` keeps the **blob and crop original** the old field-by-field copy silently dropped (duplicating a page lost its pictures); `duplicateNote` clones working children with `worksFor` remapped plus their assets; `duplicateNotebook` preserves section `kind` (a copied Working drawer came back ordinary and emptied into the page list); the sheet **Copy** button read `src.strokes`, which no longer exists, so it copied nothing — it reads the live surface now; `practiceAll` orders by parent page then sheet number, orphans last. `tests/working.mjs` (Codex) fully green; `workpages.mjs` updated. Zero regressions; the only new reds are the five forward-spec suites for b170-b179. — *Claude Code (Opus 5)*

- **b169** `PENDING` — **hardening b168 against the Codex audit. Six real data-loss paths, all confirmed in the code before fixing and all re-verified in a real browser.** (1) The migration filtered `live`, so a **tombstoned working page was resurrected** on every device the old row reached; it now migrates `deletedAt`/`deletedVia` as they are. (2) It built the new record field by field, so **any field it did not know about was dropped**; it now spreads the old record first and overlays the page's own fields. (3) It only wrote an ink asset `if (p.strokes.length)`, so a page whose strokes had all been **rubbed out lost its erasure map** and would un-erase the lot; the test is now "is there any ink data at all" (strokes, removed, restored or h). (4) The ink asset used `newId("ink")`; the id is now derived (`ink_<pracId>`) so a second pass cannot leave two. (5) **The `workingMigrated` flag was a trap** — it stopped the scan, and the scan is the only thing that catches an old row arriving late from sync or a restored backup. The flag is gone; the scan is cheap because a row that already has a page is skipped on sight. **Proven in-browser: a row seeded after migration was picked up on the next boot with nothing duplicated.** (6) `practicesFor()` returns notes now, so `deleteNote`/`deleteNotebook`/`restoreNote`/`restoreNotebook` were **writing note objects into the old `practices` store**; all four no longer touch it, and one pass over the notes is enough because a working page is one of them. Also: boot and old-backup import now share **one** converter (`practiceToNote`/`practiceToInk`) — import converts legacy `practices` rows and format-1 `scratch` into pages instead of routing them to a dead store; `exportBundle` no longer ships the legacy rows beside the pages they became (a backup carried both halves of every sheet); `practices` dropped from `SYNC_STORES`; `serializeBody` split into `serializeHost(el)` so the working sheet saves **scrubbed** markup like a note instead of raw innerHTML with dead object-URL `<img>`s and rendered KaTeX; `cloneAsset` keeps the **blob and the crop original**, which the old field-by-field copy silently dropped — duplicating a page lost its pictures; `duplicateNote` clones working children with `worksFor` remapped and their own assets; `duplicateNotebook` preserves section `kind` (a copied Working drawer came back as an ordinary section) and remaps internal `worksFor`; the sheet **Copy** button read `src.strokes`, which no longer exists, so it copied nothing — it now reads the live surface and clones pictures; `practiceAll` orders by parent page then sheet number, orphans last. `tests/working.mjs` (Codex) fully green; `workpages.mjs` updated. Zero regressions — the only new reds are the five forward-spec suites for b170-b179. — *Claude Code (Opus 5)*

- **b168** `PENDING` — **working pages are ordinary pages now.** They used to be records in a `practices` store of their own, which kept them second class for ever: no scrolling from one into the next, invisible to search, no bookmark, no tag, no recording. They are now notes in a per-notebook **Working** drawer (a section carrying `kind:"working"`, made on demand, ordered `9e14` so it settles at the foot of the list) and point back at the page they were started from through the new `worksFor` field. **Ids are preserved exactly** — `span.pracpin[data-pracid]` still resolves, so every working marker already sitting in the notes keeps opening its sheet untouched. Ink moved out of the record into a `kind:"page"` asset, where an ordinary page keeps its ink, so `openPractice`/`gotoPracPage` now fetch it (blank-then-fill, guarded by `pracSeq` + a record-id check, or the sheet you closed paints over the one you opened). `savePractice` sequences the words and the ink deliberately — run side by side they both read-modify-write the same note and the second undoes the first. `DB_VERSION` 4→5 for the `notes.by_works` index (an ordinary page has no `worksFor`, so the index holds working pages and nothing else). `migrateWorkingToNotes()` runs once at boot, before anything paints, guarded by the `workingMigrated` meta flag and by an id-already-present check; it **leaves the old records in place** rather than erasing them — they are what an old backup still expects and they are the way back. `counts()` and `planSecPageNames` now skip the drawer, so a notebook does not read as twice its length and a working page is never renumbered out of its `S1P3w1` name. Verified in a real browser: two seeded old-format records became pages with the same ids, ink intact (2 and 1 strokes), named `S1P3w1`/`S1P3w2`, filed in the drawer, found via the index, and a second boot changed nothing. `tests/workpages.mjs` new; `secpage.mjs` + `sections.mjs` updated for the new intent. Zero regressions against b167. — *Claude Code (Opus 5)*

- **b167** `PENDING` — finger-scroll freeze/jump at a page join on Windows (Bug E). Two causes, both flagged by the Claude workflow and Codex. (1) While a page remounted, `fingerPanMove` held the page DEAD STILL (to dodge the 900px absolute-pan throw) — on a slow/cold Windows mount that still window is a visible freeze under the finger, then a jump. It now BANKS the finger travel (`handover.fingerPanY/X += clientY-prevY`), keeps tracking velocity, and `finishHandover` adds the bank in ONE write after it has re-anchored (per-frame writes during the swap would fight the re-anchor into a shiver, which is why the old code froze instead). `tests/fingerbank.mjs` proves the banked total moves the page identically to the normal branch. (2) Lifting the finger mid-swap called `startGlide()` immediately, and that glide fought `finishHandover` for scrollTop = the shiver/jump on release at a join; it now hands the throw to `handover.glideCarry`, which `finishHandover` already starts as a damped (x0.7) glide once the page is settled. Non-busy finger scroll is untouched. scrollstones/joinflaw/fingerjoin/scrollsim/scrollfreeze-sim + fingerbank green. Device-confirmable on the Windows tablet. — *Claude Code (Opus 4.8)*
- **b166** `b3882bf` — chip freeze/jump staircase on Windows (Bug D; P0 for both Claude-workflow and Codex). The `force || gap>=2` far-seek in `chipSeek` called `openPage()` gated only against the SAME target; a moving finger changes the target each frame, so it overwrote `pendingId` and started a new render every time, and `renderSeq` cancels the previous before it mounts — the page froze while the label counted 6->8->11, then jumped when the finger paused (worst on Windows: one mouse-move per frame + throttled frames on an occluded/second-screen window make the finger skip >=2 pages between seeks, staying in this branch). Now single-flight: `if (chipLoading()){ if(pending===target) return; if(!force) return; }` BEFORE the openPage, so one load lands at a time and the chase heads for the latest target once it mounts; release supersedes a stale in-flight load ONCE (also stops the release restarting a nearly-done render = the snap-back). Mapping/handover/re-anchor untouched. tests/chipsingleflight.mjs (decision transcription + source) + all scroll suites green. Real Windows-throttle benefit is device-confirmable. — *Claude Code (Opus 4.8)*
- **b165** `efbdc11` — Windows pen-down delay (Bug B). No hover pre-roll on Windows means the contact `pointerdown` was the first pen event, and it ran the panel fold (`setFocus`+`applyPanes`+`buildFavBar`) synchronously before the first paint — trapping the ink and the AUTO→PEN switch behind it. Once folded (the common case; a pen leaving does not unfold), that is no-op churn: now the whole fold block is skipped when `panelsHidden()` (guarded so pinned panes still work). A GENUINE fold stays synchronous (Codex: never fold mid-stroke — it changes #paper width and would jump the stroke coordinates). Plus a `fullReqPending` single-flight guard on `enterFull()` so the b159 keep-full listener + `maybeAutoFull` do not both fire requestFullscreen on one nib-down. Cross-checked Claude-workflow + Codex (both high/med-high). tests/penfold.mjs pins it. Verify latency on the tablet (headless cannot time pen hover). — *Claude Code (Opus 4.8)*
- **b164** `76da69a` — the three left-edge arrows (`#edgeStack`: edgeList/edgeSec/edgeRail,
  the handle that expands a folded rail) stay visible in Immerse (Bug F, both platforms).
  `paintEdge()` hid them with `stack.hidden = !(state.note && immerse !== "1")`, so entering
  Immerse — the one place every bar is gone and these arrows are the only way back — removed
  them. Now `stack.hidden = !state.note`, matching Focus mode; Immerse still hides bars/panes
  via untouched CSS. Browser-verified: note open + immerse on → edgeStack.hidden===false, all
  three arrows present. tests/edgearrows.mjs pins it. — *Claude Code (Opus 4.8)*
- **b163** `b77b939` — writing no longer jumps up when the pen touches (Bug A, Windows) and the "Panels folded" notice stops crying wolf (Bug C, both). A: `#modeChip` (`.chip`, no fixed width) changed "AUTO"(4ch)->"PEN"(3ch) on pen-approach, narrowing `.topright` ~7px, moving the flex-wrap break so on a narrow window "Data" dropped from row 2 to row 1, `.top` lost a row and the writing shifted up (Android buttons are narrower so row 2 just went 3->2 items, row count unchanged -> no shift). Fix (CSS only): `#modeChip{min-width:52px;text-align:center;box-sizing:border-box}` + `#saveWord{min-width:66px}` so both keep constant width whatever the pen/save state -> constant header height/row-count. Browser-verified at 900px: `.top` height = 101px for AUTO/PEN/WRITE/TYPE and ready/unsaved/saved. C: penDetected re-fires on every hover-return, so `hint("Panels folded")` popped even when already folded; now captured `wasFolded = panelsHidden()` before the fold and gated `if (allFree && !wasFolded)`. tests/topbar.mjs pins both. — *Claude Code (Opus 4.8)*
- **b162** `073cb74` — cross-page ink SHIFT + phantom line reveal at a join (Bug G, both platforms) is gone. The preview-band ink canvas (`.peekink` inside `.peekpage`, a centered max-width:794 sheet) painted page-x=0 at the SHEET left, while the live `#inkLayer` (full pane) paints page-x=0 at `#paper` left — so peek ink was one centering-margin too far right (the sideways jump at the join) and the sheet-wide canvas clipped the rightmost strokes (the "5th line reappears when it goes live"). `paintPeekInk` `fit()` now translates the peek ink origin left by that margin: offX = (peekpage.left - paper.left) * (clientWidth/rectWidth) (the ratio converts to the canvas pre-zoom units, so it holds at any zoom). Height parity was already correct. Browser-verified end-to-end (tests/peekink-browser.mjs): a page-x=400 stroke renders at screen-x 860 in BOTH peek and live (0px; would be 1033 unfixed). NOTE for other tools: a stale SW in the headless Chrome serves old builds — unregister SW + clear caches at test start. — *Claude Code (Opus 4.8)*
- **b161** `2192b5b` — completes the tablet-update fix (with b160). install now fetches the
  shell via `new Request(u, {cache:"reload"})` so a worker installing right after a deploy
  cannot bake the OLD index.html into the NEW cache (GitHub Pages holds HTML ~10 min);
  index.html adds a one-shot `controllerchange` auto-reload (guarded by `hadController` +
  `window.__swReloaded`, so only a real update reloads, never first install, never a loop),
  so a freshly-activated worker's build shows without the user finding the notice.
  tests/swshell.mjs pins both. — *Claude Code (Opus 4.8)*
- **b160** `677d3e9` — the tablet now actually updates to new builds. `sw.js` served the
  whole shell CACHE-FIRST, so an installed Android PWA kept serving the `index.html` it
  first cached (sync still worked because it hits a different origin, which is why "sync
  works but the build won't update"). A browser TAB updated because it re-checks the SW on
  every reload; an installed PWA checks rarely. Fix: the shell (navigate / `index.html` /
  `sync-client.js` / manifest) is **network-first** (fresh when online → GitHub Pages 304s
  make it cheap; cache is the offline fallback), static assets stay cache-first, and
  `index.html` now forces `reg.update()` on load and on visibility→visible. One-time: the
  currently-stuck tablet must fully close/clear-site-data/reinstall the PWA once to drop the
  old cache-first worker. tests/swshell.mjs pins it. This is the BASELINE for the b159 bug
  batch (A–H) — the tablet must reach new builds before the rest can be tested.
  A parallel read-only workflow (Claude Code) + Codex are diagnosing A–H. — *Claude Code (Opus 4.8)*
- **b159** `fe9cae5` — a full-screen toggle now lives in the shortcuts bar (`#jumpFull`,
  4-corner icon). It owns "keep full screen" mode (`cfg.fullLock`, which already made
  writing fill the screen). Tapping: on → enterFull + fullLock=true; off → exitFull +
  fullLock=false, reflected in the top Full button too. While the mode is on, a
  capture-phase document `pointerdown` (skipping `#jumpFull`/`#fullScrBtn`) calls
  `enterFull()` whenever the browser has dropped full screen — because an app-switch or
  Home drops it and the Fullscreen API only re-grants from a real gesture, so a page
  genuinely cannot auto-restore on its own; the next touch is the earliest it can. This
  is the honest ceiling of "always full screen even after returning". Browser-verified
  the toggle flips aria-pressed/cfg state (tests/fullscreen.mjs source-pins it); the
  actual full-screen FILL is device-only (headless Chrome can't real-fullscreen). NOTE
  for testing: the app must be an installed PWA or a normal Chrome tab for
  requestFullscreen to hide the chrome. — *Claude Code (Opus 4.8)*
- **b158** `3e4e055` — Settings no longer mistouches while you scroll. Dragging to scroll
  the list used to flip a checkbox/dropdown the finger started on. Fix: `touch-action:pan-y`
  on the whole `.dlg-body` (a vertical drag scrolls, never toggles) + a capture-phase guard
  in `wireSettings` that swallows the click if the finger moved > 10px between press and
  release (a still tap still toggles). Controls also got bigger padded tap targets
  (`.settings .check` padding + `:active` feedback). Browser-verified
  (tests/setscroll-browser.mjs): drag-on-checkbox does not toggle, tap does. Only the
  scroll-mistouch half of the Settings ask is done; a full visual redesign is deferred to
  a dedicated pass (too big/subjective to ship blind). — *Claude Code (Opus 4.8)*
- **b157** `3a6eb01` — cropping an attached picture now reaches other devices (before, the
  uncropped one synced but the crop did not). A picture travels as `imgdata` chunks
  keyed `assetId:i`; cropping to FEWER chunks overwrote `assetId:0` but left the old
  higher-index chunks orphaned on the server, and the 120s pull look-back re-fetched
  them next to the new chunk. `joinImageData`'s old "chunk count must equal n" test then
  refused to glue (three on hand, n=1), so the crop's bytes never landed — only its
  width/height did (LWW light record), which is exactly "it still looks uncropped".
  `joinImageData` now reads n from `assetId:0` (always the latest push) and glues just
  the first n chunks, ignoring stale extras. Reproduced and verified end-to-end with a
  real 2-device sim over sync-client.js (tests/cropsync.mjs); syncpics/sync still green.
  NOTE (future cleanup, not shipped): the orphan chunks still linger on the server and
  get re-pulled within the look-back — harmless now, but a push-side tombstone of
  indices ≥ new-n would save the bandwidth. — *Claude Code (Opus 4.8)*
- **b156** `10e8eab` — the top header no longer overflows on a narrow window. The action
  buttons (`.topright`: Settings, Data, Sync, Full, Tabs, Jump, Quick, Dark, …) were a
  single non-shrinking row (flex:none), so on tablet-portrait width they ran off the
  right and the overflow pushed a page-wide grey strip. Now `.topright` is
  `flex:0 1 auto; min-width:0; flex-wrap:wrap; justify-content:flex-end` (shrinks, wraps
  right-aligned so the last buttons drop to a visible second row) and `.top` has
  `overflow:hidden` (residual never becomes a sideways page scroll). Browser-verified in
  headless Chrome (tests/topbar.mjs source-pins it): at 900px page overflow=0 and
  Settings+Data are on-screen (row 2); at 1400px it stays one row. — *Claude Code (Opus 4.8)*
- **b155** `0a6d987` — the two floating bars (favourites `#favDot`, shortcuts `#jumpDot`)
  no longer jump to the top-left corner when you minimise then re-open them. Root: the
  dot opens on a ~400ms hold (`onTap` → `favMin=false` → `buildFavBar` HIDES the dot,
  shows the bar); the `pointerup` that followed ran `endDot`, which read the now-hidden
  dot's `getBoundingClientRect()` (0,0 for a hidden element) and saved it as the bar's
  position — and `setPos` even moved the just-shown bar straight to 0,0. Fix: `endDot`
  records a position only for a real drag — skips a hold-to-open (`wasOpen`) and any
  0,0/hidden rect. One fix covers both bars (shared `bindDotDrag`). Browser-verified
  (tests/bardot-browser.mjs: minimise → hold-open → bar returns to 240,360, not 0,0)
  + tests/bardot.mjs. — *Claude Code (Opus 4.8)*
- **b154** `6ec559d` — chip-scroll SPEED is more even. User feedback on b153: dragging a
  chip, the scroll is slow inside a page then speeds up when the neighbour appears.
  Cause: the body maps the band to `(pageSpan*zoom − viewport)` while the join crammed
  the leftover screen + a fifth-of-the-band reveal into a tiny slice, so the join ran
  ~5–7× faster than the body (worst on short pages). Fix widens the reveal to
  `evenReveal = 0.70*view*bw/(full−view)` (capped at 0.5·bw, floored at the old 0.20),
  so the neighbour slides in at the body's own speed. Speed-only tweak to b153's reveal
  WIDTH — mapping/peek/re-anchor untouched, so no bounce/hang. VERIFIED in headless
  Chrome (tests/chiprate-browser.mjs + chipseam-browser): seam 0px, sec fwd/back +
  book fwd cross cleanly (pageChanges=1), steady body+join rate ~uniform. The FULL
  uniform-mapping rework (needed for pages that fit on the screen) is deferred, see
  Part 1. — *Claude Code (Opus 4.8)*
- **b153** `eedcef0` — the multi-page chip FREEZE is gone (Grok F3 / Codex "S1 400ms
  stall"). A held chip is not `pan.on`, so it wrongly inherited the full 400ms fling
  anti-bounce cooldown (`handover.until`) and stalled at every second join while its
  number ran on ahead; b152's far-seek then jumped to catch up. Fix is one gate in
  pageHandover: `if (!chipDrag && Date.now() < (handover.until||0)) return;` — a
  chip has no momentum to bounce with, and `handover.busy` (cleared one rAF later in
  finishHandover for a held chip) is the real single-flight lock, so it crosses each
  join promptly. `chipDrag.join` still carries the scroll so the opposite direction
  cannot re-trigger. Slow drag = every page shows; fast drag = still direct-seeks to
  the finger's page and lands there on release (no snap-back). Rewrote the three
  proof suites (scrollsim #4, scrollfreeze-sim, pagetag) + scrollstones F to the
  fixed intent, keeping the old-bug sentence. STILL OPEN from the 3-tool synthesis:
  S1 join-slope clamp, S2 chipLand-vs-seam, S3/S8 sec-chip neighbour list,
  S5 dual-seek, Codex flush-before-direct-openPage safety. — *Claude Code (Opus 4.8)*
- **b152** `62a85cf` — chip drag no longer freezes on one page or snaps back on
  release. Root causes: chipSeek ignored its `force` arg (release seek was skipped
  → snap-back), and multi-page moves relied on the gated per-page handover cascade
  (froze). Fix: on release OR when the chip points >1 page away, seek straight to
  that page past the cooldown/busy gate; the one-page-neighbour peek path (grey
  join) is untouched. Still refining: a fast multi-page drag jumps ~2 pages at a
  time — near-neighbour scroll continuity is the next target (3-tool synthesis with
  CODEX/GROK-SCROLL-FINDINGS). — *Claude Code*
- **b151** `a1e180a` — un-erasing (Undo of an erase) no longer vanishes after sync:
  each un-erase records a `restored` stamp that beats the erase tombstone, per
  stroke id, in both the app and sync-client.js mergeInk. Found by a sync bug-hunt
  (silent handwriting loss). tests/sync.js covers erase→undo→re-erase. — *Claude Code*
- **b150** `01a1517` — "Erase all handwriting" button in the eraser options
  (reuses the undoable S.clear; one Undo restores). Opens from the floating
  favourites bar's eraser. — *Claude Code*
- **b149** `75847fa` — Full button gains a long-press lock (highlights when locked);
  only while locked, writing/typing auto-enters real Chrome full screen; short tap
  still toggles, "Exit" comes back, second long-press unlocks. cfg-guarded (cfg is
  defined below the button code). — *Claude Code*
- **b148** `a062d2c` — Pictures copy between devices; a tablet picture no longer
  vanishes on reload; missing slot no longer eats the next picture. — *Grok Build*
- **b147** `3233b3e` — Home folder grid, top Sync/Full/Tabs, tab-strip Home/+, keep open
  notebooks and place on Chrome reload, collapsible recent/lists. — *Grok Build*
- **b146** `fafc823` — pull cursor no longer uses server "now", so a new section is not
  skipped while its page arrives unfiled (Sec4). One re-pull on upgrade. — *Grok Build*
- **b145** `44f958d` — sync hardening: visible Sync chip, retry backoff, incremental
  push, don't yank the page while writing. — *Grok Build*
- **b144** `a3cd605` — wire light sync: Settings URL+password (never in the public app),
  pull/push via the live Worker, ink erase tombstones. User pastes the
  password on each device. — *Grok Build*
- **b143** `c90bce0` — audio-less daily backup (notes + handwriting + pictures;
  class recordings left out so a ~15GB library can still be saved). Restore
  keeps recordings already on the device. Confirm restore on the tablet before
  wiring sync. — *Grok Build*
- **b142** `3b265a5` — measured real chip-join geometry and preserved the same
  screen seam through both-direction remounts; native-touch browser regression — *Codex*
- **b141** `d3f5b4f` — chip drag crosses a join like a finger (peek band + normal
  handover): no freeze, grey divider shows during the crossing — *Claude Code*
- **b140** `3a9d275` — chip drag seeks straight to the finger via a frame loop:
  killed the freeze/count/jump staircase, no page skip — *Claude Code*
- b139 `ae23ba4` — hold-to-open dots, folder vs book icons, Chrome-like notebook
  tabs — *Grok Build*
- b138 `9a07514` — lasso corners keep aspect, small boxes drag, undo covers lasso
  edits — *Grok Build*
- b137 `73a68af` — chip and finger show the page join; lasso corners work without
  minus — *Grok Build*
- b136 `c268f43` — working sheets fold over the page again, with a named chip — *Grok Build*
- b135 `21454bf` — rough working is a real page in the notebook flow — *Grok Build*
- b134 `d7f47c2` — chip drag shows the page join instead of jumping over it — *Grok Build*
- b133 `d340300` — keep scroll momentum through a page join, hide empty-page hint — *Grok Build*
- b132 `44ba643` — chips sit on the edge, overlap, and tuck after a second — *Grok Build*
- b131 `5378bde` — lasso typed blocks can be dragged, and a tap away drops them — *Grok Build*
- b125–b130 — S Pen side button rebuilt (pointer renamed "eraser" was the root
  cause), one eraser gate/clock/memory; finger-fling and chip join fixes; page
  opens at its own top; tests moved into `tests/` — *Claude Code + Grok*
- b119–b124 — earlier chip/lasso/eraser/scroll fixes — *mixed*

> Older history and the full reasoning behind each invariant live in `AGENTS.md`
> and in git commit messages (they explain *why*, not just *what*).
