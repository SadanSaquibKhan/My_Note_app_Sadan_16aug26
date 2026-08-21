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
- Current build: **b161**. Recent: b161 completes the update fix — install now fetches the
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

- **b161** `PENDING` — completes the tablet-update fix (with b160). install now fetches the
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
