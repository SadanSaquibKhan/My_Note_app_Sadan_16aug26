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
- Current build: **b145**. Notes can copy between the tablet and the computer
  once you paste the password in Settings (Backups and menus). A **Sync**
  button appears at the top when it is on. If the network drops, it waits
  longer each try instead of hammering. Class recordings still do not copy.
  Chip scrolling and the S Pen eraser were not touched.
- **Waiting on you:** on BOTH the tablet and the computer, Settings → Backups
  and menus → paste the password (address can stay filled) → Save and test.
  Then write a sentence on one device and check the other after about a minute.
- Still rough: pictures do not copy yet (only their empty slot). Grey
  page-divider during a chip drag is brief; lasso on typed text still has
  some reports.
- **Sync (Phase 0 + Phase 1 shipped).** Server:
  `https://margin-sync.khanssk89.workers.dev`. Password is NOT in the app —
  each device stores it locally. Ink erases now leave a `removed` map so a
  stroke wiped on one device does not come back from the other. First
  hardening slice is b145. Next: photos via R2 (Phase 3, needs you to make a
  bucket). Audio stays manual.

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
- Current build: **b145** — always confirm with `var BUILD` in `index.html`
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

### Current focus and open items (2026-08-20, at b145)
- **Phase 0 backup (shipped b143, restore confirmed):** daily Data button is
  **Save notes (no recordings)**. User restored in incognito: notes came back,
  audio did not (expected).
- **Sync Phase 1 (b144) + harden slice (b145):** Settings URL+password in
  IndexedDB, never committed. Header **Sync** chip when on. Incremental push
  (`syncPushSince`) so a 45s tick does not re-send the whole library. Failed
  tries back off 8s → 3 min cap. Pull does not refresh the open page while
  you are writing, drawing, or dragging a chip. Password-only save fills the
  known public server URL. Live test: `node tests/synclive.mjs`.
- **Sync not done:** photos still light-only until R2 (needs the user to
  create an R2 bucket). Opening a note never waits on the network. Full
  plan: `SYNC-PLAN.md`. Still waiting on the user to paste the password on
  both devices.
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
