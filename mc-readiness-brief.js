/* ==========================================================================
   mc-readiness-brief.js — H4: the fusion pre-session readiness brief
   --------------------------------------------------------------------------
   flagship-immersive-roadmap.md H4. Shown when a trainee taps "Start Day N"
   / "Train anyway" on dashboard.html's day module (mc-day-hero.js), fusing
   H1's body map (Recovery mode) with H3's Recovery ring
   (MC_VITALS.recoveryScore()) into one moment before the workout page loads.

   MUSCLE SCOPING (locked via AskUserQuestion before this file was written).
   The roadmap's original spec dimmed the map to only the muscles today's
   prescribed exercises will train, classified via MC_MUSCLES.classify().
   That data does not reach this trigger point for any schedule-bearing
   program: dashboard.html never loads a program's real exercise list (
   mm-data.js, hv-block.html's inline data, cat-strength.html's) — only
   mc-pm-data.js's schedule.days aggregate ex/sets/min counts, and those
   records' `tags` are not reliably muscle names (ss's are; mm's generated
   tags are equipment/phase labels like "Dumbbell Split", "Phase 1"). Rather
   than invent a second, unverified title/tag-to-muscle classifier living
   outside MC_MUSCLES — the exact per-page-clone shape check-single-impl.js
   exists to prevent — this renders the full 9-region Recovery map undimmed.
   Honest about what the app actually knows at this point, ships now.

   SHELL REUSE. Built on base.css's existing .fw-modal-overlay/.fw-modal
   bottom-sheet primitive (mc-finish.js's own recap/confirm modals) rather
   than a new full-screen takeover shell, and its .fw-cancel/.fw-confirm
   button classes for Skip/Begin — one modal shell in the tree, not two.

   Static, not animated (same H2 decision, same reason: no headless browser
   this session to verify motion timing against). Never blocks the logging
   flow it precedes — Begin, Skip, and a backdrop tap all just proceed.

   window.MC_READINESS_BRIEF.show({ dayTitle, icon, accent, onBegin })
   onBegin() fires exactly once, however the brief was dismissed. If the
   data this needs (MC_CHART/MC_READY/MC_MUSCLES) isn't loaded, show() calls
   onBegin() immediately rather than rendering a broken sheet.
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_READINESS_BRIEF) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // The single least-recovered group, only when MC_READY's own classifier
  // already calls it 'overreached' — reuses that real threshold rather than
  // inventing a new cutoff for this one screen.
  function worstOverreached(byMuscle) {
    var worst = null;
    Object.keys(byMuscle).forEach(function (id) {
      var r = byMuscle[id];
      if (r.status !== 'overreached') return;
      if (!worst || r.pct < worst.pct) worst = { id: id, pct: r.pct };
    });
    return worst;
  }

  var BODYMAP_LABELS = {
    calves: 'Calves', shoulders: 'Shoulders', legs: 'Legs', triceps: 'Triceps',
    back: 'Back', chest: 'Chest', core: 'Core', biceps: 'Biceps', forearms: 'Forearms'
  };

  function show(cfg) {
    cfg = cfg || {};
    var onBegin = typeof cfg.onBegin === 'function' ? cfg.onBegin : function () {};

    if (!window.MC_CHART || !window.MC_READY || !window.MC_MUSCLES || !document.body) {
      onBegin();
      return;
    }

    var byMuscle;
    try { byMuscle = window.MC_READY.byMuscle(); } catch (e) { onBegin(); return; }
    var bodyData = {};
    Object.keys(byMuscle).forEach(function (id) { bodyData[id] = byMuscle[id].pct; });

    var score = null;
    try { score = (window.MC_VITALS && window.MC_VITALS.recoveryScore) ? window.MC_VITALS.recoveryScore() : null; } catch (e2) {}

    var worst = worstOverreached(byMuscle);
    var advisoryHtml = worst
      ? '<div class="rb-note">' + escapeHtml(BODYMAP_LABELS[worst.id] || worst.id) +
        ' is still recovering (' + worst.pct + '%) — plan accordingly.</div>'
      : '';

    var ringHtml = (score != null)
      ? '<div class="rb-ring-row">' + window.MC_CHART.ring(score, { size: 72, stroke: 6 }) +
        '<div class="rb-ring-text"><div class="rb-ring-val">' + score + '</div>' +
        '<div class="rb-ring-lbl">Recovery Score</div></div></div>'
      : '';

    var figHtml = '<div class="rb-figures">' +
      '<div class="rb-fig">' + window.MC_CHART.bodyMap(bodyData, { view: 'front', width: 110 }) + '<div class="rb-fig-cap">Front</div></div>' +
      '<div class="rb-fig">' + window.MC_CHART.bodyMap(bodyData, { view: 'back', width: 110 }) + '<div class="rb-fig-cap">Back</div></div>' +
    '</div>';

    var overlay = document.createElement('div');
    overlay.className = 'fw-modal-overlay open rb-overlay';
    overlay.innerHTML =
      '<div class="fw-modal rb-modal">' +
        '<div class="rb-eyebrow">Today’s Readiness</div>' +
        '<div class="rb-title">' + escapeHtml(cfg.dayTitle || 'Workout') + '</div>' +
        ringHtml +
        figHtml +
        advisoryHtml +
        '<div class="fw-modal-btns">' +
          '<button type="button" class="fw-cancel" id="rbSkip">Skip</button>' +
          '<button type="button" class="fw-confirm" id="rbBegin">Begin</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      overlay.parentNode && overlay.parentNode.removeChild(overlay);
      onBegin();
    }

    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) dismiss(); });
    var skipBtn = overlay.querySelector('#rbSkip'), beginBtn = overlay.querySelector('#rbBegin');
    if (skipBtn) skipBtn.addEventListener('click', dismiss);
    if (beginBtn) beginBtn.addEventListener('click', dismiss);
  }

  window.MC_READINESS_BRIEF = { show: show };
})();
