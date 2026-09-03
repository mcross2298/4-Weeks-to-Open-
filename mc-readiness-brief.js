/* ==========================================================================
   mc-readiness-brief.js — H4: the fusion pre-session readiness brief
   --------------------------------------------------------------------------
   flagship-immersive-roadmap.md H4. Shown when a trainee taps "Start Day N"
   / "Train anyway" on dashboard.html's day module (mc-day-hero.js), fusing
   H1's body map (Recovery mode) with H3's Recovery ring
   (MC_VITALS.recoveryScore()) into one moment before the workout page loads.

   MUSCLE SCOPING — H4 shipped full-body undimmed (locked via
   AskUserQuestion), because the day's real exercise list never reached
   this trigger point: dashboard.html loaded no program's actual exercise
   data, only mc-pm-data.js's schedule.days aggregate ex/sets/min counts.

   H4b (flagship-immersive-roadmap.md) closes that gap for real rather than
   inventing a second classifier: tools/gen-schedules.js now also computes
   each mm/hv day's `muscles` — MC_MUSCLES.classify() run against that
   day's REAL exercise names, read from mm-data.js/hv-block.html the same
   way the tool already reads ex/sets — and mc-pm-data.js's ss block (never
   machine-generated — see that tool's own header) carries the identical,
   hand-verified classify() output for the same reason. `cfg.scope` is that
   array, passed through from dashboard.html's own `d.muscles`. When it is
   non-empty, only those groups get a real pct in the body map's data
   object; MC_CHART.bodyMap() already renders any OMITTED group as its
   existing neutral/dimmed "no data" fill (see that function's own doc
   comment) — so scoping needed zero changes to mc-chart.js, just building
   a narrower object here. No scope (custom/published programs, or a day
   with no fixed exercise list, e.g. ss's Conditioning day) falls back to
   the full undimmed map exactly as H4 shipped it — still honest about what
   the app actually knows, just knows more now for three real programs.

   SHELL REUSE. Built on base.css's existing .fw-modal-overlay/.fw-modal
   bottom-sheet primitive (mc-finish.js's own recap/confirm modals) rather
   than a new full-screen takeover shell, and its .fw-cancel/.fw-confirm
   button classes for Skip/Begin — one modal shell in the tree, not two.

   Static, not animated (same H2 decision, same reason: no headless browser
   this session to verify motion timing against). Never blocks the logging
   flow it precedes — Begin, Skip, and a backdrop tap all just proceed.

   window.MC_READINESS_BRIEF.show({ dayTitle, icon, accent, scope, onBegin })
   `scope`: optional array of MC_MUSCLES group ids today's day trains; omit
   or pass [] for the full undimmed map. onBegin() fires exactly once,
   however the brief was dismissed. If the data this needs (MC_CHART/
   MC_READY/MC_MUSCLES) isn't loaded, show() calls onBegin() immediately
   rather than rendering a broken sheet.
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
  // inventing a new cutoff for this one screen. `scope`, when given a
  // non-empty array, narrows the search to today's own trained groups —
  // matching the roadmap's original intent ("under-recovered for what's
  // prescribed"), not just any muscle anywhere in the body.
  function worstOverreached(byMuscle, scope) {
    var ids = (scope && scope.length) ? scope : Object.keys(byMuscle);
    var worst = null;
    ids.forEach(function (id) {
      var r = byMuscle[id];
      if (!r || r.status !== 'overreached') return;
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

    // scope: today's real trained groups (mm/hv/ss only — see this file's
    // own header). Non-empty means "dim everything else" — MC_CHART.bodyMap()
    // already renders an OMITTED group as neutral, so scoping is just which
    // ids get a pct here, not a new chart option.
    var scope = (cfg.scope && cfg.scope.length) ? cfg.scope : null;
    var bodyData = {};
    Object.keys(byMuscle).forEach(function (id) {
      if (scope && scope.indexOf(id) < 0) return;
      bodyData[id] = byMuscle[id].pct;
    });

    var score = null;
    try { score = (window.MC_VITALS && window.MC_VITALS.recoveryScore) ? window.MC_VITALS.recoveryScore() : null; } catch (e2) {}

    var worst = worstOverreached(byMuscle, scope);
    var advisoryHtml = worst
      ? '<div class="rb-note">' + escapeHtml(BODYMAP_LABELS[worst.id] || worst.id) +
        ' is still recovering (' + worst.pct + '%) — plan accordingly.</div>'
      : '';

    var focusHtml = scope
      ? '<div class="rb-focus">Today: ' + scope.map(function (id) {
          return escapeHtml(BODYMAP_LABELS[id] || id);
        }).join(' · ') + '</div>'
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
        focusHtml +
        ringHtml +
        figHtml +
        advisoryHtml +
        '<div class="fw-modal-btns rb-btns">' +
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
