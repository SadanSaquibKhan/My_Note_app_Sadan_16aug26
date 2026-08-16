# v11 — Device test results & Chrome-on-tablet issues
**Date:** 16 Aug 2026 · **Addendum to:** the Samsung Notes reference doc + the feature decision sheet.

**Why this file exists.** These results came from testing v11 on the actual device. A future builder chat will not see that conversation, so the findings are recorded here. Hand this file over alongside the other two.

---

## 1. Test environment (important — see §4)

- Device: Galaxy Tab S10+, **Chrome on Android**, S Pen.
- The app was opened as the **standalone `margin-notes_2026-08-15_v11.html` file** (not installed as a PWA, not served over https).
- Chrome's **"Desktop site"** was ON — and appears to switch itself on automatically when the file is opened.

---

## 2. Ten-item device test — results

| # | Test | Result |
|---|---|---|
| 1 | S Pen stroke thickens with harder pressure | **FAIL** (no thickening observed) |
| 2 | Palm resting on screen leaves no mark | **PASS** — palm rejection works |
| 3 | Typing `->` then space becomes `→` | **FAIL** |
| 4 | Typing `**bold**` becomes bold | **FAIL** |
| 5 | Typing `"quote"` gives curly quotes | **NOT TESTED** |
| 6 | `Ctrl+;` inserts today's date | **NOT TESTED** |
| 7 | `Ctrl+Z` removes the typing, not the drawing | **PASS** |
| 8 | Two-finger tap = undo, three-finger tap = redo | **FAIL** |
| 9 | Record 10 s audio, play back, change speed | **BLOCKED** — see bug D |
| 10 | Page grows when writing near the bottom | **PASS** |

**Summary:** 3 pass, 4 fail, 2 untested, 1 blocked.

---

## 3. Additional bugs reported from the device

- **A — App does not fill the screen.** The layout is width-capped; it stays capped even when the side panel is collapsed.
- **B — "Desktop site" turns itself on** in Chrome when the file is opened, which forces a wide desktop viewport.
- **C — S Pen pre-scroll.** Starting to write with the pen makes the page **scroll for a few hundred milliseconds first**, then writing begins. (Diagnosed cause: `touch-action` is only set to `none` after the pen hovers; once Chrome has already begun a scroll, changing it mid-gesture cannot cancel it.)
- **D — Microphone refused.** Recording fails with a permission-refused error, **even though Chrome has microphone permission at the Android system level.**
- **E — (from code inspection) Markdown/text expansion relies on `keyup` events**, which are unreliable on Android soft keyboards and IMEs — the likely cause of failures #3, #4 and probably #5.
- **F — (from code inspection) `pointercancel` interrupts multi-finger gestures** — the likely cause of failure #8.

---

## 3b. CONFIRMED RESULTS after moving to https (16 Aug 2026, evening)

The app is now published via **GitHub Pages** at
`https://sadansaquibkhan.github.io/My_Note_app_Sadan_16aug26/`
(repo `SadanSaquibKhan/My_Note_app_Sadan_16aug26`, branch `main`, folder `/ (root)`, Enforce HTTPS on, installed to the tablet home screen).

**The §4 diagnosis below was correct. Confirmed outcomes:**

- **D — Microphone: FIXED by hosting.** Recording now works over https; the app shows *"Recording. What you write and type from now on is pinned to the audio."* and a `RECORDINGS ▶ 1 · 96S` entry. **No code change was needed.** Note: this confirms the write/type-to-audio pinning feature **already partly exists** — it needs debugging, not building from scratch.
- **B — Desktop-site / width capping: resolved** by turning Chrome's "Desktop site" off. (While the app was a local file, toggling desktop site produced a wrong-URL error page on reload — an artefact of `file://`, not an app bug.)
- **A — Full screen: NOT fixed, and the cause was misdiagnosed.** See §4b for the corrected diagnosis.
- Version stamp confirms **v11 · 2026-08-15** is what is deployed and running.
- **Note on versioning:** the PWA folder named `..._v6` and `sw.js` cache `margin-2026-08-15-v6` refer to the **service-worker cache counter**, NOT the app version. The app inside is v11. Do not "upgrade" the HTML based on the folder name.

---

## 4b. CORRECTED diagnosis of the full-screen bug (A)

**Symptom as observed on-device:** on load the app fills the screen; but scrolling to the end and continuing to scroll drags in a **grey area** beyond the content, and **one of the top toolbars visibly runs off the right edge into that grey region**.

**Actual cause: horizontal toolbar overflow, not viewport sizing.** The top button rows do not wrap or scroll. One row alone carries PRACTICE / WRITE / DRAW / LOCK / FOCUS / ↑ / ↓ / OUTLINE / RECORD / IMMERSE / − / 100% / + / PIN. That row is wider than the tablet viewport, so it **stretches the page's scroll width** past the screen. The grey is simply unpainted area outside the real content box. The same overflow makes the page scrollable past its vertical end.

**This is one bug, not two** ("app doesn't fill screen" + "can scroll into grey" are the same root cause).

**Fix direction:** constrain the toolbar rows to the viewport — wrap, horizontally scroll, or collapse them — and prevent the page from being pannable beyond content. **Preferred fix** (also satisfies a v10 request): replace the always-visible full tool set with a **collapsible, user-configurable quick-tool bar**, since the toolbars currently consume roughly **40% of the screen height** before any writing space begins.

---

## 4. Likely single root cause for A, B, D (test this first)

The app is being run as a **local `file://` page**, not as an installed PWA served over **https**. That one fact plausibly explains three of the problems at once:

- **Microphone (D):** browsers only grant `getUserMedia` in a **secure context**. A `file://` page is not one, so the mic is refused **regardless of the Android app-level permission** — which matches exactly what was seen.
- **Service worker / offline:** service workers do not register on `file://`. The project's own `READ-ME-FIRST.txt` already states the app *"must be served over https for the offline worker to run"* and that opening the HTML straight off storage will work as a page but **will not install and will not cache**.
- **Full screen (A) and desktop view (B):** because it is not installed, there is no standalone display mode from the manifest, so it renders as an ordinary web page inside Chrome, subject to the desktop-site viewport.

**The fix is deployment, not code:** publish the folder to GitHub Pages (the procedure is in `READ-ME-FIRST.txt`), open the https URL in Chrome on the tablet, then use Chrome's **"Add to Home screen" / "Install app"**. Re-run the tests **from the installed app**.

> **Caveat:** this is a diagnosis made without the device in hand. It is cheap to test and would resolve several symptoms at once, so it is worth doing before writing any code for A, B or D.

---

## 5. CONFIRMED CODE-BUG WORKLIST (all verified on-device after hosting fix)

Hosting will **not** fix these. Work them **one at a time**, committing after each.

1. **Toolbar overflow → grey gutters / scroll past end.** Top button rows exceed viewport width and stretch the page. Constrain to viewport (wrap / horizontal scroll / collapse) and stop the page panning beyond content. See §4b.
2. **S Pen pre-scroll.** The page scrolls for a few hundred ms before writing starts. Cause: `touch-action` is only set to `none` after the pen hovers — once Chrome has begun a scroll, changing it mid-gesture cannot cancel it. Set `touch-action: none` on the writing surface **up front**.
3. **Pressure sensitivity.** Stroke width does not vary with pen pressure. Verify the device actually reports a varying `pressure` value on pointer events, then check the dynamic-range mapping. Also confirmed: the speed re-weighting runs **after** stroke simplification, which discards the varied points — reorder it.
4. **Text expansion (`->` → `→`, `**bold**` → bold, and likely curly quotes).** Relies on `keyup`, which Android soft keyboards/IMEs do not fire reliably. Move to `beforeinput` / `input` with Range-based replacement.
5. **Two-finger tap (undo) / three-finger tap (redo) do nothing.** `pointercancel` interrupts the multi-finger gesture. Handle it so additional fingers don't cancel the gesture.
6. **Toolbars consume ~40% of screen height.** Add collapse/auto-hide and a **user-configurable quick-tool bar** (v10 request). Fixing this properly also fixes #1.

**Also outstanding from the v10 list (not retested):** bottom bar shows notebook-level actions (Duplicate/Move/Delete) on the writing screen where they don't belong; side panel fails to auto-collapse when writing resumes on the *same* page.

**Still unverified:** curly quotes, `Ctrl+;` date insert, audio playback + speed control (recording itself now works).

---

## 6. Still to verify (once the mic and hosting are sorted)

- #5 curly quotes, #6 `Ctrl+;` date insert, #9 audio record → playback → speed control.

---

## 7. Handoff note

- Test again **only from the installed https PWA**, not the local file — otherwise results for A, B, D are meaningless.
- Record pass/fail per item each round; do not fix while testing.
- Keep the working v10/v11 files untouched; build in a copy.
