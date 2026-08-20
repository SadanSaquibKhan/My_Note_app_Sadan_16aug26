# Navigation-chip seam audit (b141)

This is the required broad hypothesis pass for the slow-drag page-join defect.
Statuses are based on exact b141 source inspection plus the native Chrome/IndexedDB
trace; “test” means it remains in the browser matrix even when it is not the
primary cause.

1. **Confirmed root:** the fixed `0.62 * viewport` peek is too short once the real divider is included.
2. **Confirmed root:** the 26 px page divider is absent from the simplified join arithmetic.
3. **Confirmed root:** forward joins also include the sheet's 24 px bottom padding.
4. **Confirmed root:** section-boundary labels add still more real join height.
5. **Confirmed root:** the backward b141 tablet trace ended 35 px short of the 60% handover line.
6. **Confirmed root:** when the reveal ends short, `driveChipScroll` returns false.
7. **Confirmed root:** that false return sends a one-page drag through the far-page `chipLand` path.
8. **Confirmed root:** direct backward landing interprets the pointer as about fraction 0.8 of the prior page.
9. **Confirmed root:** fraction 0.8 leaves the prior page's last lines below the viewport.
10. **Confirmed:** both section and notebook chips share this same code path.
11. **Confirmed:** the b141 flip occurred with no `swapping` class, proving it bypassed `finishHandover`.
12. **Confirmed secondary root:** if handover does fire, backward landing uses `pageBottom - 0.55H`.
13. **Confirmed secondary root:** the trigger preserves an actual edge beyond 60%, so 55% is not invariant.
14. **Confirmed:** the watched-block repair ignores residuals of 400 px or more.
15. **Confirmed:** ink-only pages can have no DOM child anchor and receive no watched-block repair.
16. **Test:** typed content can end above deep handwriting, leaving no visible typed anchor.
17. **Confirmed:** a held chip gets one pin attempt rather than the 16-frame settling loop.
18. **Confirmed structural:** the next `chipChase` frame reinterprets unchanged progress on the new page.
19. **Confirmed structural:** ordinary page fraction cannot represent the still-visible overlap after a swap.
20. **Confirmed structural:** `revealChipJoin` contains an old hold guard but is not in the active path.
21. **Confirmed dead code:** `armChipHandover` is defined but not called by the b141 drag path.
22. **Confirmed dead code:** `chipPeekReady` is defined but not called by the b141 drag path.
23. **Test:** scroll-rAF coalescing can let the next seek run before `pageHandover`.
24. **Test:** pointermove and `chipChase` can both write scroll in the same visual interval.
25. **Refuted during a pending swap:** `swapping()` correctly blocks `chipSeek`.
26. **Test:** release on the exact crossing frame can clear the chip loading gate early.
27. **Confirmed:** the `force` argument to `chipSeek` is currently unused.
28. **Confirmed:** `CHIP_SEEK_MS` is declared but not read in the active seek path.
29. **Test:** a failed direct load can leave `pendingId` gating a held drag.
30. **Test:** stale `chipLand` and a later handover could both try to land a rapid drag.
31. **Confirmed race:** `finishHandover` clears pending before its animation-frame correction.
32. **Test:** another render between that clear and correction could invalidate the target.
33. **Test:** scroll clamping can silently make the requested anchor unreachable.
34. **Confirmed:** the settle loop only diagnoses bottom clamping, not top clamping.
35. **Test:** first-page thin-band topology differs from ordinary previous-page bands.
36. **Refuted at notebook end:** a last page has no next preview, so no forward seam exists there.
37. **Test:** release mid-crossing must retain the exact overlap rather than run a delayed land.
38. **Test:** reversing before the threshold must not load either page.
39. **Test:** reversing just after a remount must return through one continuous overlap.
40. **Test:** a second drag while a mount is pending must not start a competing load.
41. **Confirmed:** `visualNoteId` correctly reads the mounted page rather than early state.
42. **Refuted:** `renderSeq` already blocks an older note fetch from mounting over a newer one.
43. **Refuted ordinary collision:** remembered-place restore is suppressed during swap/chip landing.
44. **Test:** `padWatch.skip` timing can swallow the first genuine resize after a page change.
45. **Confirmed:** `prevPad` correctly reads the zoomed screen rect.
46. **Test at zoom:** writing that screen value back as CSS height may apply zoom twice.
47. **Confirmed geometry:** `pageScrollFor` uses stored sheet height, not measured divider extent.
48. **Test:** typed content taller than stored sheet height makes `pageSpan` underestimate reality.
49. **Test:** image, file, audio, and maths layout can make actual content taller than `pageSpan`.
50. **Test:** unequal neighbours change the scroll-per-progress derivative at the swap.
51. **Test:** minimum and maximum zoom change physical reveal travel but not virtual band share.
52. **Refuted:** rounding `0.62H` contributes at most half a pixel, not skipped lines.
53. **Confirmed:** strict 40%/60% comparisons make an exact-boundary miss deterministic.
54. **Test:** image decode after a one-frame held-chip settle can move watched content.
55. **Test:** audio/attachment preview stubs may differ in height from live blocks.
56. **Test:** KaTeX timing or font availability can shift child positions after mount.
57. **Test:** legacy live-DOM hydration can make preview/live child indices diverge.
58. **Test:** mixed page templates can wrap preview and live content differently.
59. **Test:** Cornell/PDF-specific live styles may not be mirrored exactly by previews.
60. **Refuted old model:** page height no longer grows automatically from ink depth.
61. **Test:** asynchronous per-note zoom needs an id/sequence guard during rapid page changes.
62. **Test:** track geometry changing under a stationary finger can alter progress.
63. **Refuted handedness cause:** left-handed mode changes horizontal placement, not vertical mapping.
64. **Confirmed test gap:** no pre-b142 suite compared a stable preview pixel with the same live pixel.
65. **Confirmed stale test:** old tests still expect `CHIP_STICK = 0.22` while b141 uses 0.06.
66. **Confirmed false-positive test:** generic `if (chipDrag) return` matches tuck code, not handover.
67. **Confirmed flawed simulation:** old peek arithmetic omits padding, divider, and section labels.
68. **Test:** a hand resting on the join must cause zero page-load churn.
69. **Test:** tucked-chip wake-only behavior must survive the seam repair.
70. **Test:** finger forward/backward joins must not regress when the shared anchor is repaired.

## Measured b141 baseline

A native Chrome touch drag with three sections, unequal saved sheet heights, and
real IndexedDB ink reproduced S3P3 → S3P2 through both chips. The notebook-chip
run reached progress 0.8675 at the reveal edge while the incoming page bottom was
823 px and the 60% line was about 858 px. It direct-mounted without the
`swapping` class. The stress fixture's stable content coordinate moved 880 px;
the earlier non-reloaded run moved 1,874 px. The exact magnitude depends on page
height, but the direct fraction-0.8 landing mechanism is the same mechanism that
leaves a few bottom lines hidden on ordinary pages.
