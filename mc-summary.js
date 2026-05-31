/* ==========================================================================
   mc-summary.js  —  Phase 3 live Workout Summary
   --------------------------------------------------------------------------
   Turns the previously STATIC "Workout Summary" card (hard-coded totals like
   "32 sets / ~390 reps") into a LIVE readout driven by what the lifter actually
   checks off during the workout:
     • Sets   → completed / planned
     • Reps   → completed (best-effort from the prescribed rep scheme)
     • %      → exercises complete
   Plus a live progress bar, completed-row strikethrough, and a compact
   "📊 Summary" jump button injected into the Finish-Workout bar.

   Pure DOM; recomputes on every check-off via a class MutationObserver.
   Runs only on pages that actually render a .sum-section. Self-contained IIFE.
   ========================================================================== */
(function () {
  if (window.__mcSummary) return;
  window.__mcSummary = true;

  var CARD_SEL = '.ex-card, .ss-ex, .ex-item, .lift-card';
  var NAME_SEL = '.ex-name, .ss-name, .lift-name';

  // ---- parse a "sets" string into {sets, reps} ---------------------------
  // Handles: "12, 10, 8, 6" (4 sets / 36 reps), "5 × 5" (5 sets / 25 reps),
  // "10, 10, 10 / 10, 10, 10" (superset groups), "AMRAP in 2 min" (1 set / 0),
  // "100 reps as quick as possible" (1 set / 100 reps).
  function parseSetsReps(txt) {
    txt = (txt || '').replace(/⏱️[^]*$/, '').trim();   // drop any trailing timer pill text
    if (!txt) return { sets: 0, reps: 0 };
    var mx = txt.match(/(\d+)\s*[×x]\s*(\d+)/);
    if (mx) { var s = +mx[1]; return { sets: s, reps: s * (+mx[2]) }; }
    var tokens = txt.split(/[,/]/).map(function (t) { return t.trim(); }).filter(Boolean);
    var setTokens = tokens.filter(function (t) { return /\d/.test(t) || /amrap|max|failure/i.test(t); });
    var reps = 0;
    setTokens.forEach(function (t) {
      if (/amrap|max|failure/i.test(t)) return;        // unknown rep count
      var n = t.match(/\d+/); if (n) reps += +n[0];
    });
    var sets = setTokens.length || 1;
    return { sets: sets, reps: reps };
  }

  function cardSetsReps(card) {
    var el = card.querySelector('.ex-sets');
    return parseSetsReps(el ? el.textContent : '');
  }
  function cardName(card) {
    var el = card.querySelector(NAME_SEL);
    return (el ? el.textContent : '').trim();
  }

  // ---- compute planned + completed totals --------------------------------
  function totals() {
    var cards = document.querySelectorAll(CARD_SEL);
    var t = { planSets: 0, planReps: 0, doneSets: 0, doneReps: 0, exTotal: 0, exDone: 0, doneNames: {} };
    Array.prototype.forEach.call(cards, function (c) {
      var sr = cardSetsReps(c);
      t.planSets += sr.sets; t.planReps += sr.reps; t.exTotal++;
      if (c.classList.contains('checked')) {
        t.doneSets += sr.sets; t.doneReps += sr.reps; t.exDone++;
        var nm = cardName(c); if (nm) t.doneNames[nm] = true;
      }
    });
    return t;
  }

  // ---- render ------------------------------------------------------------
  var sumSection, sumCard, bar, fill, label, tvs, tls;

  function ensureChrome() {
    sumSection = document.querySelector('.sum-section');
    if (!sumSection) return false;
    sumCard = sumSection.querySelector('.sum-card') || sumSection;
    if (!bar) {
      var wrap = document.createElement('div');
      wrap.className = 'mcs-progress';
      wrap.innerHTML = '<div class="mcs-progress-top"><span class="mcs-progress-label">Live progress</span>' +
                       '<span class="mcs-progress-pct" id="mcsPct">0%</span></div>' +
                       '<div class="mcs-progress-track"><div class="mcs-progress-fill" id="mcsFill"></div></div>';
      sumCard.insertBefore(wrap, sumCard.firstChild);
      fill = wrap.querySelector('#mcsFill');
      label = wrap.querySelector('#mcsPct');
    }
    tvs = sumSection.querySelectorAll('.sum-tv');
    tls = sumSection.querySelectorAll('.sum-tl');
    return true;
  }

  function recompute() {
    if (!ensureChrome()) return;
    injectSummaryButton();   // the .fw-bar may be rendered late by the page's own JS
    var t = totals();
    var pct = t.exTotal ? Math.round((t.exDone / t.exTotal) * 100) : 0;

    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
    sumSection.classList.toggle('mcs-complete', pct === 100 && t.exTotal > 0);

    if (tvs && tvs.length >= 3) {
      tvs[0].textContent = t.doneSets + ' / ' + t.planSets;
      tvs[1].textContent = String(t.doneReps);
      tvs[2].textContent = pct + '%';
    }
    if (tls && tls.length >= 3) {
      tls[0].textContent = 'Sets Done';
      tls[1].textContent = 'Reps Done';
      tls[2].textContent = 'Complete';
    }

    // strike-through completed exercises in the summary list (match by name)
    Array.prototype.forEach.call(sumSection.querySelectorAll('.sum-row'), function (row) {
      var nm = row.querySelector('.sum-nm');
      var done = nm && t.doneNames[nm.textContent.trim()];
      row.classList.toggle('mcs-row-done', !!done);
    });
  }

  // ---- "Summary" jump button in the Finish-Workout bar -------------------
  function injectSummaryButton() {
    var fwbar = document.querySelector('.fw-bar');
    if (!fwbar || fwbar.querySelector('.mcs-sumbtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mcs-sumbtn';
    btn.innerHTML = '📊<span>Summary</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (sumSection) sumSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    fwbar.insertBefore(btn, fwbar.firstChild);
  }

  // ---- init --------------------------------------------------------------
  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(recompute, 150); }

  function init() {
    if (!document.querySelector('.sum-section')) return;   // nothing to make live
    ensureChrome();
    injectSummaryButton();
    recompute();
    var mo = new MutationObserver(schedule);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    setTimeout(recompute, 400);   // catch late render()/setTimeout pages
    setTimeout(recompute, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
