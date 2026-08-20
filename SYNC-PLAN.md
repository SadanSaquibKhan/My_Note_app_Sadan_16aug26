# SYNC-PLAN — syncing Margin between the Windows laptop and the Samsung tablet

This is the agreed plan for the sync feature, captured from a design discussion
with the user. Read `HANDOFF.md` and `AGENTS.md` first for how the app and the
repo work. **Do not start writing sync code until Phase 0 (a working backup) is
done and the user has created the Cloudflare account** — see "What only the user
can do".

---

## Plain summary (for the user, read this first)

- **The big idea that makes this cheap and safe: split audio from everything
  else.** Your notes, handwriting, sections and settings are *small* — probably
  well under a gigabyte for all 30 notebooks. Your ~10GB is almost entirely
  class-lecture audio. So we sync the small stuff automatically over the
  internet, and treat audio specially.
- **Audio stays mostly manual, by your choice.** You only record on the tablet,
  in class, ~5 hours a week. The *record* of a recording (which page, how long —
  a few hundred bytes) syncs automatically, so on the laptop the recording shows
  up in the right place, in the right spot on the page, showing its real length —
  it just says "not on this device" instead of playing until you copy the sound
  file across by hand. Nothing breaks if you never copy it.
- **Cost: about $0/month**, up to ~$5 if you outgrow the free tier. Cloudflare is
  the pick because *downloading* your data costs nothing there — which matters a
  lot the day a fresh device pulls everything.
- **Time: a few weeks of build-and-test rounds.** "I type on the laptop and it
  shows on the tablet" comes early (~3–5 sessions). The rest is making it
  trustworthy enough to hold the only copy of your handwriting.
- **Two things must happen before any sync code is written:** (1) fix the backup
  so you have a safety net, and (2) you create a free Cloudflare account and hand
  the AI a couple of settings. Details below.

---

## Expected data profile (from the user, 2026-08-20)
Notes are ~empty today; expected to grow to **10–14GB**, **mostly audio**. The
user also **pastes a lot of screenshots** into notes (mostly on the laptop).
Confirmed in code: a pasted image is stored as its **own `image` asset (a blob)**
via `createImage`; the note HTML only keeps a `figure.imgblock` with `data-img`
= the asset id (`serializeBody` strips the picture out). So **note text and ink
stay tiny no matter how many screenshots are pasted** — only the image blobs are
bulky. This is what makes the split below clean.

## The design decision: three classes of data

| Class | What | Size | How it syncs |
|---|---|---|---|
| **Light** | notebooks, sections, notes (title + HTML, image refs only), page ink (strokes), settings | small (sub-GB even with heavy use) | **Automatic, online, both ways** — Cloudflare D1 |
| **Medium** | pasted **screenshots / photos** (`image` assets) | "a lot", maybe a few GB over time; created mostly on the laptop | **Automatic** via object storage (Cloudflare **R2**) — storage ~$0.015/GB/mo, **downloads free**. Optionally "fetch on Wi-Fi only" on the tablet (a Phase-4 nicety) | 
| **Heavy** | audio recordings (the `blob`) | ~10GB, tablet-only, recorded in class | **Manual** — copied by hand; only its small *record* syncs as light data |

An audio asset already stores the sound (`blob`) separately from its metadata
(`id, noteId, startedAt, dur, pages[]`). Only the `blob` is heavy. Sync the
metadata as light data; leave the `blob` for a manual copy (later feature —
"export/import audio only"). The playback-follows-the-page feature keeps working
because `pages[]` is light.

## Why this is safer than full sync
- The irreplaceable lecture audio never goes near the sync code path.
- The user works on Windows most of the time and only records on the tablet, so
  the two devices **rarely edit the same page at once** — which is exactly the
  situation that makes sync hard. That pattern removes most conflict risk.

## What the data model already gives us (a real head start)
Every record already carries: `lastEdited` (ms), `deletedAt` (tombstone — delete
is a tombstone, not an erase — see AGENTS.md), and `editedOn` (a device stamp).
There is already an import/merge path (`exportBundle` / `previewImport` /
`importBundle` in `index.html`) that reasons about these. Sync is essentially
turning that offline merge into an online, incremental one.

---

## Cost (Cloudflare recommended)
- **Workers + D1** (the sync API + a small database for the light records):
  free tier is generous (Workers ~100k req/day, D1 5GB). ~**$0**.
- **R2** (object storage, if/when audio or many photos sync): storage ~$0.015/GB,
  and **downloads are free** — unlike Firebase (~$0.12/GB downloaded, so pulling
  10GB ≈ $1.20 each time) or Supabase Pro ($25/mo).
- **Realistic total: $0–6/month.**

---

## Phases (do them in order; ship and test each)

**Phase 0 — Fix backup FIRST (safety net, no server).**
The current `exportBundle` base64-encodes every audio blob into one JSON file; at
~15GB that needs ~20GB of memory and crashes, so the user effectively has no
working backup at this size. Build an **audio-less export** (and/or a streamed
export) so a real backup exists before any sync code touches the data. This is
also the exact "export the light data" primitive sync will reuse.

**Phase 1 — Light sync: text + structure (~3–5 sessions).**
Notebooks, sections, notes (title + HTML). Last-writer-wins by `lastEdited`,
tombstones for deletes. A tiny Cloudflare Worker + D1 endpoint (push changes
since a cursor, pull changes since a cursor). Sync every ~30–60s and on save.
Goal: type on one device, see it on the other within a minute.

**Phase 2 — Handwriting / ink (the delicate one, ~2–4 sessions).**
Ink is stored as one big `strokes` list per page. Do **not** sync it as a single
blob — two devices editing one page would clobber each other. Merge
**stroke-by-stroke** using each stroke's own `id` (they already have ids).
This deserves its own phase and heavy two-tab browser testing.

**Phase 3 — Inserted photos (~1–2 sessions).**
Small blobs (a few MB). Straightforward: store in R2, reference by asset id.

**Phase 4 — Hardening (the real work, ~3–6 sessions).**
Offline edits on both sides, retries, a visible sync status, week-long gaps,
partial failures. This is where sync projects live or die. Test relentlessly in
two browser tabs = two devices: force conflicts, cut the network, delete on one
side, edit-both-sides, resume after a long gap. **Sync bugs lose data, and this
data is irreplaceable — bias toward "refuse and flag" over "guess and merge".**

**Phase 5 (future, not now) — Audio.**
Manual: an "export/import audio only" pair, or opportunistic R2 upload with
"don't do this on mobile data" and resumable transfers. Explicitly out of scope
until the light sync is solid.

---

## Hard rules for whoever builds this
1. **Backup before sync.** No sync code merges into `main` until Phase 0 gives a
   restore-tested backup. The user cannot re-create lost handwriting.
2. **Never blind-merge ink or HTML.** Merge at the smallest safe unit (stroke id,
   block), and when in doubt keep both and flag, never silently drop.
3. **Keep it offline-first.** The app must work fully with no network; sync is an
   add-on that reconciles later, never a dependency for opening a note.
4. **Test as two devices** (two browser tabs + injected IndexedDB) before asking
   the user to test on real hardware — round-trips to the tablet are expensive.
5. Follow the normal build ritual and update `HANDOFF.md`'s build log.

## What only the user can do (blockers before Phase 1)
- **Create a free Cloudflare account** and a Worker + D1 database (and R2 later),
  then paste the AI the account id / a Worker route / an API token. The AI must
  **not** create accounts or handle these as plaintext beyond what the user
  pastes for this purpose.
- **Open Settings → Data on both devices and report the numbers**, so the size of
  the light half is confirmed rather than estimated. The whole plan assumes the
  non-audio data is small; verify it.

---

## Open decisions to settle with the user before coding
- Exact sync cadence (every 30s? 60s? on-save + on-focus?).
- Whether photos go in Phase 1 or wait for Phase 3.
- Conflict UX: silent last-writer-wins for text vs. a visible "both versions
  kept" for anything risky.
- Login: how a device proves it is the user's (a shared secret the user pastes,
  vs. a full account) — kept as simple as safety allows.
