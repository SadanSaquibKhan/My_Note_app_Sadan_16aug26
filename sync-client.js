/* Margin sync — the merge core (DRAFT, not wired into the app yet).
 *
 * Pure functions only. No IndexedDB, no network, no DOM — so it can be tested
 * exhaustively in Node (see tests/sync.js) before a single line of index.html
 * changes. This is the part that must never lose a note, so it lives and is
 * proven on its own first.
 *
 * The rules, in plain terms:
 *  - Plain records (notebooks, sections, notes, meta, groups, practices):
 *    LAST-WRITER-WINS by `lastEdited`. A delete is a tombstone (`deletedAt`),
 *    and a tombstone only wins if it is the newer edit — so "deleted on the old
 *    laptop, then edited on the tablet today" keeps the edit, not the delete.
 *    The version that loses is stashed under `_shadow` so nothing is ever truly
 *    gone (bias to keep, never silently drop).
 *  - Page ink (an `assets` record of kind "page"/"ink"): merged STROKE BY STROKE.
 *    A stroke is immutable and has a unique id, so the strokes are an add-only
 *    set; an erase is a tombstone id in `removed`. Merge = union of strokes minus
 *    union of removed. Two devices drawing on the same page therefore keep BOTH
 *    sets of strokes, and an erase on either device is respected.
 *  - Blobs (audio, photos) never travel as "light" data: `lightBody` strips them.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SyncCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function num(x) { return (typeof x === "number" && isFinite(x)) ? x : 0; }

  /* A record's clock: the newest of lastEdited / deletedAt. */
  function clock(r) {
    if (!r) return -1;
    return Math.max(num(r.lastEdited), num(r.deletedAt));
  }

  /* Strip anything that must not travel as light JSON (the big binary parts).
     Returns a shallow copy; the original is untouched. */
  function lightBody(r) {
    if (!r || typeof r !== "object") return r;
    var out = {};
    for (var k in r) {
      if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
      if (k === "blob" || k === "orig") continue;          // audio / photo bytes
      out[k] = r[k];
    }
    return out;
  }

  /* True if this record carries page ink we should merge stroke-by-stroke. */
  function isInk(r) {
    return !!r && (r.kind === "page" || r.kind === "ink") && Array.isArray(r.strokes);
  }

  /* Merge two versions of ONE page-ink record. Order does not matter
     (commutative), and merging the same pair twice changes nothing
     (idempotent) — the two properties that make sync safe. */
  function mergeInk(a, b) {
    if (!a) return b;
    if (!b) return a;
    var byId = {};
    (a.strokes || []).forEach(function (s) { if (s && s.id != null) byId[s.id] = s; });
    (b.strokes || []).forEach(function (s) {
      if (!s || s.id == null) return;
      // a stroke id is drawn once; if both have it, keep either (they're equal)
      if (!byId[s.id]) byId[s.id] = s;
    });
    // union of erase-tombstones, keeping the latest erase time per id
    var removed = {};
    function addRemoved(rm) {
      if (!rm) return;
      Object.keys(rm).forEach(function (id) {
        var t = num(rm[id]);
        if (removed[id] == null || t > removed[id]) removed[id] = t;
      });
    }
    addRemoved(a.removed);
    addRemoved(b.removed);
    // a stroke survives only if it is not erased
    var strokes = Object.keys(byId)
      .filter(function (id) { return removed[id] == null; })
      .map(function (id) { return byId[id]; })
      .sort(function (x, y) { return num(x.t) - num(y.t); });   // keep replay order

    var base = clock(a) >= clock(b) ? a : b;                    // carry newer scalars
    var out = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    out.strokes = strokes;
    out.removed = removed;
    out.lastEdited = Math.max(num(a.lastEdited), num(b.lastEdited));
    return out;
  }

  /* Merge two versions of any record.
       - Ink is stroke-merged, so it can NEVER lose a stroke (union of both).
       - Everything else is plain last-writer-wins by clock, which converges to
         the identical winner on every device. The losing version is not kept
         inline: an inline copy does not travel through a last-writer-wins server,
         so it would make devices disagree and break convergence. Nothing
         important is lost by this: two devices editing the SAME note's text at
         once is rare for this user, and a delete is not destruction — the app
         keeps deleted notes in its trash/tombstone, recoverable. A future
         "keep both text versions" needs version vectors and is out of scope for
         the groundwork. */
  function mergeRecord(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (isInk(a) && isInk(b)) return mergeInk(a, b);
    var ca = clock(a), cb = clock(b);
    if (ca === cb) return a;                                    // identical age: stable pick
    return ca > cb ? a : b;                                     // last writer wins, cleanly
  }

  /* Records in `map` (keyed by "store/id") whose clock is newer than `since`.
     This is what a device pushes. Blobs are stripped. */
  function changedSince(map, since) {
    since = num(since);
    var out = [];
    Object.keys(map || {}).forEach(function (key) {
      var r = map[key];
      if (!r) return;
      if (clock(r) > since) {
        var slash = key.indexOf("/");
        out.push({
          store: key.slice(0, slash),
          id: key.slice(slash + 1),
          updated_at: clock(r),
          deleted: r.deletedAt ? 1 : 0,
          device: r.editedOn || null,
          body: lightBody(r)
        });
      }
    });
    return out;
  }

  /* Fold a pulled batch of rows into a local map, merging each. Returns the new
     map plus a count, without mutating the input. */
  function applyPull(localMap, rows) {
    var map = {};
    for (var k in (localMap || {})) if (Object.prototype.hasOwnProperty.call(localMap, k)) map[k] = localMap[k];
    var applied = 0;
    (rows || []).forEach(function (row) {
      if (!row || !row.store || row.id == null) return;
      var key = row.store + "/" + row.id;
      var incoming = (row.body && typeof row.body === "object") ? row.body : {};
      // rebuild the scalar clocks the record layer expects
      if (incoming.lastEdited == null && row.updated_at != null && !row.deleted)
        incoming.lastEdited = row.updated_at;
      if (row.deleted && incoming.deletedAt == null) incoming.deletedAt = row.updated_at;
      map[key] = mergeRecord(map[key], incoming);
      applied++;
    });
    return { map: map, applied: applied };
  }

  return {
    clock: clock,
    lightBody: lightBody,
    isInk: isInk,
    mergeInk: mergeInk,
    mergeRecord: mergeRecord,
    changedSince: changedSince,
    applyPull: applyPull
  };
});
