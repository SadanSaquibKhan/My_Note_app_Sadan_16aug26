# Paste this whole file into Grok in Google Chrome (grok.com)

You are helping with **Margin**, a single-file Samsung-Notes-like PWA for a Galaxy Tab S10+ with S Pen.

**Important limit of this chat:** Grok in Chrome cannot edit the files on the computer and cannot run tests. Use this chat for planning, checklists, and copy-paste text. For real code changes use **Codex CLI**, **Claude Code**, or **Grok Build** in the project folder.

## What the app is

- Everything is one `index.html` plus a small `sw.js`. No server, no bundler.
- Notes live only in the tablet browser (IndexedDB). The GitHub repo is the app code only.
- Live site: GitHub Pages, repo `SadanSaquibKhan/My_Note_app_Sadan_16aug26`, branch `main`.
- Local folder:
  `G:\Other computers\My_computer_lab\1_Research_Work_PC_GDrive\1_8_build_stopwatch_pomodoro_study _sound_etc\1_3_Notes_app\files_v12ofhtml_16aug26_7pm\margin-pwa_2026-08-16_v7\margin-pwa_2026-08-16_v7`
- Current build: **b140** (check `var BUILD` in `index.html`; do not trust older numbers).
- User is not a programmer. Answers must be short, plain, and end with what to do next.

## Rules every tool must follow

Read `AGENTS.md` (Claude Code also has `CLAUDE.md` — keep them the same except the first paragraph).

After an **app** change:

1. Edit `index.html` / `sw.js` only for behaviour.
2. Run `node tests/check.js index.html`, `node tests/ids.js index.html`, `node tests/nest.js index.html`, plus the matching `tests/*.mjs` (always `tests/shapes3.mjs`).
3. Bump with `python tests/bump.py <folder> <N>` — never type BUILD/CACHE by hand.
4. `git add index.html sw.js` only for a tablet deploy. Never `git add -A`.
5. Push `main` to ship to the tablet.
6. Tell the user the new build number and what to test.

Tests now live in **`tests/`** inside the repo (moved out of Windows Temp so Codex can see them).

## What recently shipped (do not redo)

- **b137–b138 lasso:** box around handwriting/typed words; four corners keep aspect; middle of a small box is a **move**; Undo/Redo covers move/scale/colour. Notes: `LASSO-FEATURE-NOTES.md`.
- **b139:** hold the minimised favourite/shortcut **dot still ~0.4s** to open the bar; dragging the dot does not open it. Folder = folder icon, notebook = book icon. Shortcuts bar has a **tabs** icon for Chrome-like notebook tabs (switch, close+Undo, +, drag reorder, latest 3 colours, works in Immerse).
- **b140:** chip drag seek (another session). Read current `index.html` before touching chips.

## Three tools, one app

| Tool | What it is good for |
|------|---------------------|
| Claude Code | Terminal in this folder; reads `CLAUDE.md` |
| Grok Build (this computer) | Terminal in this folder; reads `AGENTS.md` |
| Codex CLI (ChatGPT Plus) | Terminal in this folder; reads `AGENTS.md` |
| Grok in Chrome | Planning only — cannot save files |

They must not all edit `index.html` at the same second.

## Set up Codex (ChatGPT Plus) — do these on the Windows PC

1. Install Node.js if it is missing: https://nodejs.org (LTS).
2. Open **PowerShell**.
3. Run: `npm install -g @openai/codex`
4. Go to the Margin folder:
   `cd "G:\Other computers\My_computer_lab\1_Research_Work_PC_GDrive\1_8_build_stopwatch_pomodoro_study _sound_etc\1_3_Notes_app\files_v12ofhtml_16aug26_7pm\margin-pwa_2026-08-16_v7\margin-pwa_2026-08-16_v7"`
5. Run: `codex`
6. Sign in with the ChatGPT Plus account when the browser opens.
7. First message to Codex (copy this):

```
Read AGENTS.md first. Tests are in tests/ in this repo.
Confirm the build ritual (check.js, ids.js, nest.js, bump.py, git add only index.html and sw.js for app deploys).
Do not write app code until you have confirmed that.
Do not start any cloud sync until I give you a written SYNC-PLAN.md.
```

## What Codex should NOT start yet

Device-to-device **cloud sync** (Cloudflare, split audio, etc.) was mentioned by Claude but **there is no written spec in this repo yet**. Do not invent one. If the user wants sync, they must paste Claude’s plan first, and any work must **backup IndexedDB first** so notes cannot be lost.

## If you (Grok in Chrome) are asked to change the app

Do not pretend you saved the file. Write the exact change as copy-paste instructions, or tell the user: “Open Codex or Grok Build in the Margin folder and paste this task.”
