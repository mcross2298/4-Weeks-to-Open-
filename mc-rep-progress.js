/* ==========================================================================
   mc-rep-progress.js  —  live rep-glow tracker (Phase 3)
   --------------------------------------------------------------------------
   Advances the premier card's glowing rep marker (.a-rep.live) to the set the
   lifter is actually ON, reading the per-set logger that mc-setlog.js renders.
   It is a pure VIEW layer: it never writes state, never touches the logger or
   checkoff — it only moves the .live / .rep-done classes among the .a-rep spans
   in response to .set-check toggles.

   Mapping per card (a "logging unit" = one .ex-card or .ss-ex):
   • working reps = the card's .a-rep spans, minus .special (AMRAP/drop chips).
   • completed   = count of checked .set-check boxes in that unit.
   • When the rep spans line up 1:1 with the working sets, the glow advances:
     finished sets → .rep-done, the next set → .live. When the reps are
     collapsed ("3× 8") or span multiple superset legs, the spans share one
     state: they glow until every set is logged, then settle to .rep-done.

   Harmless on any page with no .a-rep (it simply no-ops), so it is safe to
   include alongside mc-setlog.js anywhere. Self-contained IIFE.
   ========================================================================== */
(function () {
  if (window.__mcRepProgress) return;          // guard against double-include
  window.__mcRepProgress = true;

  var UNIT_SEL = '.ex-card, .ss-ex';

  function closestUnit(el) {
    return el.closest ? el.closest(UNIT_SEL) : null;
  }

  // Set the live/done classes for a single logging unit from its checkbox state.
  function update(unit) {
    var repsAll = unit.querySelectorAll('.a-rep');
    if (!repsAll.length) return;               // not a premier rep card — skip

    // Working-set markers: drop the special (AMRAP/drop) chips from the sequence.
    var seq = [];
    Array.prototype.forEach.call(repsAll, function (r) {
      if (!r.classList.contains('special')) seq.push(r);
    });
    if (!seq.length) seq = Array.prototype.slice.call(repsAll);

    // Always start from a clean slate so re-evaluation is idempotent.
    seq.forEach(function (r) { r.classList.remove('live', 'rep-done'); });

    var allChecks = unit.querySelectorAll('.set-check');
    if (!allChecks.length) {                    // logger not built yet → static default
      seq[0].classList.add('live');
      return;
    }

    // Working checks exclude the appended drop/cluster rows (.mcl-row-amrap),
    // so the 1:1 advance maps to prescribed working sets; completion still
    // requires every logged row (working + extras) to be checked.
    var workChecks = Array.prototype.filter.call(allChecks, function (ck) {
      var row = ck.closest ? ck.closest('.mcl-row') : null;
      return !row || !row.classList.contains('mcl-row-amrap');
    });
    var doneWork = workChecks.filter(function (ck) { return ck.classList.contains('done'); }).length;
    var doneAll = Array.prototype.filter.call(allChecks, function (ck) {
      return ck.classList.contains('done');
    }).length;
    var allDone = doneAll >= allChecks.length;

    if (seq.length >= workChecks.length && workChecks.length > 0) {
      // 1:1 — advance the glow set by set.
      seq.forEach(function (r, i) {
        if (allDone || i < doneWork) r.classList.add('rep-done');
        else if (i === doneWork) r.classList.add('live');
      });
    } else {
      // Collapsed "N× reps" chip, or reps spanning multiple superset legs:
      // the spans share one state — lit while sets remain, done when finished.
      seq.forEach(function (r) { r.classList.add(allDone ? 'rep-done' : 'live'); });
    }
  }

  function run() {
    document.querySelectorAll(UNIT_SEL).forEach(update);
  }

  // ---- wiring: event-driven, mirrors mc-setlog's render lifecycle ----------
  function init() {
    run();
    // Catch the logger's async render passes (mc-setlog retries on a schedule).
    [250, 700, 1500, 2600].forEach(function (d) { setTimeout(run, d); });

    var mo = new MutationObserver(function (muts) {
      var rebuild = false;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes') {
          var t = m.target;
          // A checkbox toggled .done → re-evaluate just its card (cheap, instant).
          if (t.classList && t.classList.contains('set-check')) {
            var unit = closestUnit(t);
            if (unit) update(unit);
          }
        } else if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          rebuild = true;                        // new logger/cards appeared
        }
      }
      if (rebuild) { clearTimeout(mo._t); mo._t = setTimeout(run, 120); }
    });
    mo.observe(document.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
