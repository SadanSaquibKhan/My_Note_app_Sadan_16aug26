# -*- coding: utf-8 -*-
import io, sys
p = sys.argv[1]
s = io.open(p, encoding="utf-8").read()
def sub(a, b, why):
    global s
    assert a in s, "NOT FOUND: " + why
    assert s.count(a) == 1, "AMBIGUOUS: " + why
    s = s.replace(a, b, 1)

sub(u'''    handover.busy = true;
    handover.until = Date.now() + 700;    /* no second swap straight after */
    var keepAt = anchorTop - pr.top;      /* where that page's top sits now */
    var nbId = state.nbId, id = target.id;''',
u'''    handover.busy = true;
    handover.until = Date.now() + 700;    /* no second swap straight after */
    var keepAt = anchorTop - pr.top;      /* where that page's top sits now */
    var nbId = state.nbId, id = target.id;

    /* Hold still the thing you are LOOKING at, not the top of the page.
       Both directions used to re-anchor the arrived page's top edge. Going
       forward that edge is a few hundred pixels from your eye, so nothing
       much can go wrong between the two. Going back it is most of a page
       above your eye — often thousands of pixels — and every small difference
       between how the preview renders a block and how the live page renders
       it accumulates over that distance and lands, all at once, on what you
       are watching. That is the jump.
       So the first block still on screen is noted by its position in the
       preview, and after the swap the same block is put back where it was. */
    var srcBody = (dir < 0) ? $("prevPeekBody") : $("nextPeekBody");
    var kids = srcBody ? srcBody.children : null;
    var aIdx = -1, aOff = 0;
    for (var ki = 0; kids && ki < kids.length; ki++){
      var kr = kids[ki].getBoundingClientRect();
      if (kr.bottom > pr.top){ aIdx = ki; aOff = kr.top - pr.top; break; }
    }''', "capture the anchor block")

sub(u'''      if (nb.top < fwdLine && nb.height > 40){ target = neighbourPage(1); anchorTop = nb.top; }''',
u'''      if (nb.top < fwdLine && nb.height > 40){ target = neighbourPage(1); anchorTop = nb.top; dir = 1; }''',
    "forward dir")
sub(u'''      if (pb.bottom > backLine && pb.height > 40){ target = neighbourPage(-1); anchorTop = pb.top; }''',
u'''      if (pb.bottom > backLine && pb.height > 40){ target = neighbourPage(-1); anchorTop = pb.top; dir = -1; }''',
    "backward dir")
sub(u'''    var target = null, anchorTop = 0;''',
u'''    var target = null, anchorTop = 0, dir = 0;''', "dir var")

sub(u'''    handover.pending = { id: id, keepAt: keepAt };''',
u'''    handover.pending = { id: id, keepAt: keepAt, aIdx: aIdx, aOff: aOff };''',
    "pending anchor")

sub(u'''      (function settle(){
        var pad = prevPad();
        var want = Math.max(0, pad - pend.keepAt);
        p.scrollTop = want;
        padWatch.last = pad;''',
u'''      (function settle(){
        var pad = prevPad();
        var want = Math.max(0, pad - pend.keepAt);
        p.scrollTop = want;
        /* Now put the block you were actually looking at back where it was.
           The page's top edge got us close; this closes the remaining gap,
           which is everything the preview and the live page disagreed about
           between the top of the page and your eye. Measured against the live
           element, so it is right by construction rather than by hoping the
           two render identically.
           Bounded, and skipped if the block cannot be found: a preview whose
           blocks do not line up one-for-one with the page then leaves the
           old behaviour rather than throwing the page somewhere absurd. */
        if (pend.aIdx >= 0){
          var kid = $("body").children[pend.aIdx];
          if (kid){
            var d = (kid.getBoundingClientRect().top - p.getBoundingClientRect().top) - pend.aOff;
            if (d && Math.abs(d) < 900){ want = Math.max(0, want + d); p.scrollTop = want; }
          }
        }
        padWatch.last = pad;''', "apply the anchor")

io.open(p, "w", encoding="utf-8", newline="").write(s)
print("anchor on the block under the eye")
