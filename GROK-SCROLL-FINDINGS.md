# GROK-SCROLL-FINDINGS — hard diagnosis (b151)

**Tool:** Grok Build (second pass — deeper than the first report)  
**Mode:** diagnosis + executable proof — **no `index.html` / `sw.js` edits, no push**  
**Build:** `var BUILD` = **b151**  
**Companion proof:** `tests/scrollfreeze-sim.mjs` (run: `node tests/scrollfreeze-sim.mjs index.html` — **0 failed** on current code)  
**Constraint:** do **not** reinstate `scrollToJoin` / `noLandUntil`

---

## One-sentence root cause

The chip **label is allowed to run ahead of the mounted page by design**, but after a few percent of track travel `driveChipScroll` goes dead and `chipSeek` then spends most frames in **`swapping()` / `handover.until` / `chipLoading()` no-ops**, so the page freezes; on release the label drops `want` and **snaps back** to the mounted page.

---

## Why “scrolls a bit, then freezes” matches the math

Reveal window for `driveChipScroll` (`15632`, `15652`):

`reveal = max(pageStick(lo,hi), (hi-lo)*0.20)` with `pageStick = max(0.012, (hi-lo)*0.06)`.

| Notebook length (equal pages) | Page share | Reveal (track) | Travel from **mid-page** until `driveChipScroll` returns **false** |
|---|---|---|---|
| 6 | 16.7% | 3.33% | **11.7%** of track |
| 12 | 8.3% | 1.67% | **5.8%** |
| 20 | 5.0% | 1.20% | **3.7%** |
| 40 | 2.5% | 1.20% | **2.5%** |

On a real multi-page section (user’s S2P10→S2P6), the continuous peek path dies almost immediately after leaving the current page. That is not a slow-drag-only bug; **normal-speed drags exit the drive window in well under half a second**.

Proven in `tests/scrollfreeze-sim.mjs` geometry section.

---

## Control-flow state machine (what actually runs)

```
pointermove / chipChase
  └─ update prog, want=placeForDrag(...), paintNavChips(want), placeChip(fingerY)
  └─ chipSeek()
        ├─ if swapping()                    → RETURN   // freeze (busy|pending)
        ├─ if driveChipScroll(prog)         → scroll or peek; maybe pageHandover(); RETURN
        │     driveChipScroll false when prog outside [lo-reveal, hi+reveal]
        ├─ if |wantIndex - visIndex| === 1  → max peek; pageHandover(); RETURN
        │     pageHandover no-ops if Date.now() < handover.until   // 400ms chip path
        ├─ if chipLoading()                 → RETURN   // freeze (far openPage in flight)
        ├─ if pendingId === want.id         → RETURN   // cannot retarget frac/newer want
        └─ else openPage(want); pendingId=want.id      // start freeze window
```

### Simulated backward drag (12 pages, load 180ms, until 400ms, 16ms frames)

From `scrollfreeze-sim.mjs` / inline Node sim:

| Metric | Result |
|---|---|
| Freeze frames | **81** / 90 |
| `until` blocks after first swap | **26** |
| Max pages label ahead of mount | **3** |
| Sample | t=80 handover-start on P10; t=96–256 freeze-swapping while want→P8; t=272–320 **neighbour-until-block** on P9; then far openPage…

This is the user’s S2P10→S2P6 movie in numbers.

---

## Answers to the required questions (harder pass)

### Q1 — Does `driveChipScroll` return false past the reveal? Is handover blocked by ~400ms?

**Yes / Yes.**

| Item | Lines | Fact |
|---|---|---|
| Reveal formula | `15632` | `max(stick, 20% of page share)` |
| False return | `15652` | Outside reveal → caller must seek |
| Peek + sync handover claim | `15641`, `15649` | Calls `pageHandover()` when `chipPeekReady` |
| Neighbour retry when false | `15762–15771` | Max peek + `pageHandover()` then return |
| until set | `16220–16221` | **`pan.on ? 160 : 400`** — **chip drag is NOT `pan.on` → 400ms** |
| until gate | `16190` | Hard return |

**Critical detail for Claude:** chip path always gets the **400ms** cooldown, not 160ms. `tests/joinflaw.mjs` §42–43 already proved 400ms blocks a 280ms two-join swipe; 160ms would not. Chip never sets `pan.on`, so it always loses.

### Q2 — Does `chipChase` keep re-aiming or stall?

**Schedules forever; seek work stalls; labels do not.**

| Piece | Lines |
|---|---|
| Chase loop | `15787–15791` |
| Label uses `want` | `15383–15390`, required by `tests/chips.mjs` (“numbers follow your finger, not the page”) |
| Seek freeze gates | `15745` swapping, `15774` chipLoading |

**Do not “fix” by making the label lag the page.** That would fail `tests/chips.mjs` and recreate the old “app looks dead” complaint. **The page must catch the label**, not the other way around.

### Q3 — Finger joins: jump / momentum?

| Path | Lines | Status |
|---|---|---|
| Mid-swap absorb | `18352–18357` | OK — rebases pan while busy |
| `rebasePan` | `16358–16368` | OK — does not zero velocity / noGlide |
| Glide carry 0.7 | `16439–16444` | OK intent |
| Second join @ 160ms until | `16220–16221` | Residual stall risk on fast flings |
| Ink-only `aIdx<0` | `16248–16254` | Residual jump risk |
| First/last page | thin / missing peek | End stops (expected) |

Finger path is in much better shape than chip multi-page. **Prioritize chip.**

---

## Findings ranked (with fix contracts)

### F1 — CRITICAL — Page cannot keep up; release snaps to mount

**Lines:** label `15383–15390`; move `15827–15832`; end `15842–15862`; `visualNoteId` `15419–15421`

**Mechanism:** `want` advances every move. Scroll only when seek succeeds. Release clears `want` → paint from mount → snap-back (S2P6 → S2P10).

**Repro:** Both chips, both directions, ≥6 pages in list. Drag across ≥3 page shares. Numbers move; page stops; release snaps.

**Fix contract (smallest correct):**

1. **Release (mandatory):** Before `chipDrag=null`, if `want.note.id !== visualNoteId()`, land on `want` (single `openPage(want.note,true)` + frac) and only then paint. Make `chipSeek(true)` honor `force` to ignore `until` and retarget loading.
2. **Mid-drag (mandatory):** While `chipLoading()` and `want.id !== pendingId`, **retarget** `pendingId`/`chipLand` to latest want (supersede), instead of `return` at `15774–15775`.
3. **Do not** remove label-follows-finger.

**Uncertainty:** low

### F2 — CRITICAL — Reveal window too small on long notebooks → early `false`

**Lines:** `15632–15652`

**Mechanism:** Absolute floor `0.012` stick dominates; 20-page book leaves drive mode after ~3.7% track from mid-page.

**Fix contract:**

- While `chipDrag` and the target is the **immediate neighbour** (`|Δindex|===1`), keep calling peek/handover even when `prog` is slightly past `hi+reveal` (extend drive window to the neighbour’s stick edge), **or**
- Map chip `prog` continuously through virtual height into scroll+peek without requiring remount for ±1.

Must not reintroduce two bosses fighting at the join (no `scrollToJoin`).

**Uncertainty:** low on cause; medium on exact window formula

### F3 — CRITICAL — `handover.until=400ms` on chip path blocks the next neighbour

**Lines:** `16220–16221`, `16190`, `15762–15771`, `15641`

**Mechanism:** After first swap, `busy` clears but `until` still blocks. Neighbour branch maxes peek and calls `pageHandover` → no-op → **stuck at peek edge** while labels enter P−2, P−3…

**Fix contract:**

```text
if (Date.now() < (handover.until || 0) && !chipDrag) return;
```

Keep `until` for pure finger flings if bounce returns; chipDrag uses `busy/pending` + `chipLoading` as single-flight locks only.

**Uncertainty:** medium (bounce risk — verify with chips.mjs bounce guards)

### F4 — HIGH — Far `openPage` staircase + non-retargeting `pendingId`

**Lines:** `15773–15781`, `15532–15534`; comments `15724–15738` already admit this

**Mechanism:** `|Δ|>1` remounts one page; while pending, newer wants are ignored (`15774`). Chase cannot skip to where the finger is now.

**Fix contract:**

- If `|Δindex|>1`, **open the latest want only** (skip intermediate mounts), OR replace pending target each frame.
- Update `chipLand.frac` when the same id is still pending but frac changed.

**Uncertainty:** low

### F5 — MEDIUM — `force` unused; release cannot punch through gates

**Lines:** `15739`, `15845`, `15883`

**Fix:** `if (force) { /* ignore until; allow retarget */ }` used only from `endChip` / document pointerup.

**Uncertainty:** low

### F6 — MEDIUM — Finger second-join / ink-only residuals

**Lines:** until `16220`; pin `16377–16422`

**Fix:** after chip work, optionally clear `until` when starting glide carry; strengthen peek/live height parity for ink-only pages.

**Uncertainty:** medium

### F7 — LOW — Stale tests that can mislead Claude

| Test | Lie |
|---|---|
| `tests/joinflaw.mjs` §51 | Claims `CHIP_SEEK_MS` still throttles far seeks — **variable unused in `chipSeek` body** |
| `tests/chips.mjs` “page follows chip” | Regex-passes while multi-page freeze still happens — checks structure, not dynamics |

**Fix:** When implementing, update `joinflaw` §51; add assertions from `scrollfreeze-sim.mjs` **inverted** after the fix (freezeFrames near 0, maxAhead ≤ 1).

---

## Intentionally preserved behaviors (do not regress)

From `tests/chips.mjs` (all passing on b151):

1. Labels follow **finger want**, not mount — keep.
2. Neighbour reveal uses measured peek geometry — keep.
3. No `scrollToJoin` / `noLandUntil` / whole-drag `if (chipDrag) return` in `pageHandover` — keep.
4. `finishHandover` writes `chipDrag.join` carry for held chip — keep and extend.
5. Document-level pointerup ends orphaned drags — keep.

---

## Finger path checklist (secondary)

| Case | Expectation after chip fix |
|---|---|
| Forward/backward held finger through join | No 900px throw (`rebasePan`) |
| Fling through one join | Glide continues at 0.7× |
| Fling through two short pages | May still need F6 |
| Section boundary | Same handover; peeks must include divider height (already in `chipPeekGeometry`) |
| First/last page | No peek → stop at end (OK) |

---

## Recommended Claude Code build plan (small builds)

**Build A (chip freeze only):** F1 release land + F3 ignore `until` when `chipDrag` + F4/F5 retarget/`force`.  
**Build B:** F2 reveal/neighbour continuous scroll polish.  
**Build C:** Finger F6 if still reported.

Each build: `check.js`, `ids.js`, `nest.js`, `chips.mjs`, `joinflaw.mjs`, `fingerjoin.mjs`, `handover.mjs`, rewrite `scrollfreeze-sim.mjs` for the new intent, `shapes3.mjs`, bump, push. Start user message with **Latest shipped: bN**.

---

## File:line hot index

| Topic | Lines |
|---|---|
| `swapping` | `15180–15182` |
| `paintNavChips` / want | `15369–15411` |
| `visualNoteId` | `15419–15421` |
| `CHIP_STICK` / band / stick | `15486–15498` |
| `chipPeekReady` | `15513–15528` |
| `chipLoading` | `15532–15534` |
| `driveChipPeek` | `15550–15585` |
| `driveChipScroll` | `15595–15653` |
| `chipSeek` / `chipChase` | `15739–15791` |
| wire / endChip | `15792–15891` |
| `pageHandover` | `16172–16301` |
| `finishHandover` / join | `16305–16458` |
| scroll rAF | `16503–16511` |
| `openPage` | `16551–16559` |
| glide | `8299–8335` |
| finger pan | `18304–18368` |

---

## Evidence artifacts

1. This file — narrative + contracts  
2. `tests/scrollfreeze-sim.mjs` — **passing proof that the bug gates exist and the sim freezes**  
3. `tests/joinflaw.mjs` §42–43 — 400ms vs 160ms  
4. In-source confession `15724–15738` — staircase already known to authors  

*End of hard Grok diagnosis. Ready for Claude Code implementation.*
