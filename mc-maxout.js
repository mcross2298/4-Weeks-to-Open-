/* ==========================================================================
   mc-maxout.js — guided 1RM test day (Horizon 2)
   --------------------------------------------------------------------------
   Flow: pick a lift you've logged → the engine reads your best set from
   mc_workout_log_v1, estimates a 1RM (Epley), and builds the warm-up ladder:

     bar × 10  →  40% × 5  →  60% × 3  →  75% × 2  →  85% × 1  →  92% × 1

   then opening attempt at ~97.5% of the estimate. Made → +5 lb and go
   again; missed → one retry at the same weight or finish. Every made
   single above the warm-ups counts; the best one is saved as a VERIFIED
   max in mc_max_v1 (synced), displayed on the Stats hub.
   Rest cues between heavy sets come from mc-timer.js (3 min suggested).
   ========================================================================== */
(function () {
  var MAX_KEY = 'mc_max_v1';
  var WL_KEY = 'mc_workout_log_v1';
  var BAR = 45;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }
  function round5(x) { return Math.max(BAR, Math.round(x / 5) * 5); }

  // Equipment coefficient: Cable/Machine estimates get ×0.85 to offset machine-assisted leverage.
  function equipCat(name) {
    if (typeof window !== 'undefined' && window.EXERCISES) {
      var nl = (name || '').toLowerCase();
      for (var i = 0; i < window.EXERCISES.length; i++) {
        if (window.EXERCISES[i].name.toLowerCase() === nl) return window.EXERCISES[i].equipment || '';
      }
    }
    var s = ' ' + (name || '').toLowerCase() + ' ';
    if (/\bcable\b|pulldown|push-?down|rope |lat pull|face pull/.test(s)) return 'Cable';
    if (/\bmachine\b|leg press|leg extension|leg curl|pec deck|abductor|adductor/.test(s)) return 'Machine';
    return 'Barbell';
  }

  // Cable/Machine e1RM estimates get discounted ×0.85 to offset machine-assisted
  // leverage; Smith and everything else (including Barbell) is unchanged.
  function applyEquipCoeff(e1, equip) {
    return (equip === 'Cable' || equip === 'Machine') ? Math.round(e1 * 0.85) : e1;
  }

  function logs() {
    try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function maxes() {
    try { return JSON.parse(localStorage.getItem(MAX_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function bestVerified(name) {
    var b = null;
    maxes().forEach(function (m) {
      if (m.exercise === name && (!b || m.weight > b.weight)) b = m;
    });
    return b;
  }
  function saveMax(name, weight) {
    var iso = new Date().toISOString();
    var a = maxes();
    a.unshift({ id: name + '|' + iso, exercise: name, weight: weight, date: iso });
    try { localStorage.setItem(MAX_KEY, JSON.stringify(a.slice(0, 300))); } catch (e) {}
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {}
  }

  // best weighted set per exercise name across the workout log → e1RM
  function liftIndex() {
    var by = {};
    logs().forEach(function (e) {
      (e.sets || []).forEach(function (s) {
        var w = parseFloat(s.weight) || 0, r = parseInt(s.reps, 10) || 1;
        if (!w) return;
        var k = String(s.name || '').trim();
        if (!k) return;
        var e1 = Math.round(w * (1 + Math.min(r, 12) / 30));
        if (!by[k] || e1 > by[k].e1) by[k] = { name: k, e1: e1, sessions: 0 };
      });
    });
    logs().forEach(function (e) {
      var seen = {};
      (e.sets || []).forEach(function (s) {
        var k = String(s.name || '').trim();
        if (by[k] && !seen[k]) { by[k].sessions++; seen[k] = 1; }
      });
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.sessions - a.sessions || b.e1 - a.e1; });
  }

  // Node-side hook so CI can regression-test the real max-out math (see
  // tools/test-mc-maxout.js) instead of a duplicated inline copy.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { equipCat: equipCat, applyEquipCoeff: applyEquipCoeff, round5: round5 };
  }

  // ---- picker ---------------------------------------------------------------
  // Everything below is DOM-driven UI wiring — skipped outside a browser (e.g.
  // when this file is required from Node for the exports above).
  if (typeof document === 'undefined') return;

  var lifts = liftIndex();
  function renderPick() {
    var q = ($('mxSearch').value || '').toLowerCase().trim();
    var rows = lifts.filter(function (l) {
      return !q || l.name.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 30);
    $('mxList').innerHTML = rows.length ? rows.map(function (l, i) {
      return '<div class="mx-row" data-i="' + lifts.indexOf(l) + '">' +
        '<span class="mx-nm">' + esc(l.name) + '</span>' +
        '<span class="mx-e1">est. ' + l.e1 + ' lb</span>' +
        '<span class="mx-arrow">→</span></div>';
    }).join('') :
      '<div style="padding:24px 4px;color:#64748b;font-weight:700;font-size:13px;">' +
      (lifts.length ? 'No matches.' :
        'No weighted history yet — log a few sessions first so the ladder has something to build from.') +
      '</div>';
  }
  $('mxSearch').addEventListener('input', renderPick);
  $('mxList').addEventListener('click', function (e) {
    var row = e.target.closest('.mx-row');
    if (row) start(lifts[parseInt(row.dataset.i, 10)]);
  });

  // ---- test flow --------------------------------------------------------------
  var lift = null, plan = [], idx = 0, attemptW = 0, retried = false, bestMade = 0;

  function start(l) {
    lift = l;
    var equip = equipCat(l.name);
    var t = applyEquipCoeff(l.e1, equip);
    plan = [
      { lbl: 'Warm-up 1', w: BAR, r: '× 10', note: 'Empty bar. Groove the pattern.' },
      { lbl: 'Warm-up 2', w: round5(t * 0.4), r: '× 5', note: 'Fast and crisp.' },
      { lbl: 'Warm-up 3', w: round5(t * 0.6), r: '× 3', note: 'Tighten the setup.' },
      { lbl: 'Warm-up 4', w: round5(t * 0.75), r: '× 2', note: 'Rest ~2 min after this one.' },
      { lbl: 'Heavy single', w: round5(t * 0.85), r: '× 1', note: 'Treat it like the max — full setup. Rest 3 min.' },
      { lbl: 'Last warm-up', w: round5(t * 0.92), r: '× 1', note: 'Should move with a little grind, no doubt. Rest 3 min.' }
    ];
    idx = 0;
    attemptW = round5(t * 0.975);
    bestMade = 0;
    retried = false;
    $('mxPick').style.display = 'none';
    $('mxRun').style.display = 'block';
    $('mxEx').textContent = l.name;
    renderStep();
  }

  function renderLadder() {
    $('mxLadder').innerHTML = plan.map(function (s, i) {
      return '<div class="mx-lrow' + (i < idx ? ' done' : i === idx ? ' cur' : '') + '">' +
        '<span>' + s.lbl + '</span><span>' + s.w + ' lb ' + s.r + '</span></div>';
    }).join('') +
      '<div class="mx-lrow' + (idx >= plan.length ? ' cur' : '') + '">' +
      '<span>Attempts</span><span>' + attemptW + ' lb +</span></div>';
  }

  function renderStep() {
    renderLadder();
    if (idx < plan.length) {
      var s = plan[idx];
      $('mxStepLbl').textContent = s.lbl + ' · ' + (idx + 1) + ' / ' + plan.length;
      $('mxW').textContent = s.w + ' lb';
      $('mxR').textContent = s.r;
      $('mxNote').textContent = s.note;
      $('mxBtns').innerHTML = '<button class="mx-btn mx-single" id="mxNext">Done — next ▸</button>';
      $('mxNext').addEventListener('click', function () {
        if (idx >= 3 && typeof TMR !== 'undefined' && TMR.setTime) {
          try { buildTimerFloat(); TMR.setTime(idx >= 4 ? 180 : 120, 'REST'); } catch (e) {}
        }
        idx++;
        renderStep();
      });
    } else {
      $('mxStepLbl').textContent = 'ATTEMPT' + (bestMade ? ' · best ' + bestMade + ' lb' : '');
      $('mxW').textContent = attemptW + ' lb';
      $('mxR').textContent = '× 1';
      $('mxNote').textContent = retried
        ? 'Same weight, better setup. Rest a full 3–4 minutes first.'
        : 'Full rest (3–5 min), full setup, no hesitation.';
      $('mxBtns').innerHTML =
        '<button class="mx-btn mx-made" id="mxMade">✓ Made it</button>' +
        '<button class="mx-btn mx-miss" id="mxMiss">✗ Missed</button>';
      $('mxMade').addEventListener('click', function () {
        bestMade = attemptW;
        retried = false;
        attemptW = attemptW + 5;
        try { buildTimerFloat(); TMR.setTime(240, 'REST'); } catch (e) {}
        renderStep();
      });
      $('mxMiss').addEventListener('click', function () {
        if (!retried && confirm('Missed at ' + attemptW + ' lb.\n\nOK = one retry after a long rest.\nCancel = call it here.')) {
          retried = true;
          renderStep();
          return;
        }
        finish();
      });
    }
  }

  function finish() {
    $('mxRun').style.display = 'none';
    $('mxDone').style.display = 'block';
    if (bestMade > 0) {
      var prev = bestVerified(lift.name);
      saveMax(lift.name, bestMade);
      $('mxDoneTitle').textContent = lift.name + ' — verified max';
      $('mxDoneMax').textContent = bestMade + ' lb';
      $('mxDoneSub').textContent = prev
        ? (bestMade > prev.weight ? '🏆 Up from ' + prev.weight + ' lb' : 'Previous verified: ' + prev.weight + ' lb')
        : '🏆 First verified max on the books.';
    } else {
      $('mxDoneTitle').textContent = 'Not today — and that’s fine.';
      $('mxDoneMax').textContent = '—';
      $('mxDoneSub').textContent = 'The warm-up work still counts. Come back fresher.';
    }
  }

  $('mxEnd').addEventListener('click', finish);
  renderPick();
})();
