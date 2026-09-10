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

  // ---- cluster reps: one implementation, in mc-log-read.js (audit P2-08) ---
  // Resolved LAZILY, never captured at parse time: <script> order across ~140
  // pages does not guarantee mc-log-read.js has run when this file parses.
  // These are thin delegators, not a second copy of the arithmetic — the same
  // shape this file already uses for logs()/setsOf(), and the reason
  // check-single-impl.js is not the right tool for them.
  function _mcLog() {
    if (typeof window !== 'undefined' && window.MC_LOG) return window.MC_LOG;
    try { return require('./mc-log-read.js'); } catch (e) { return null; }
  }
  function repsTotal(v) { var L = _mcLog(); return L ? L.repsTotal(v) : 0; }
  function repsTop(v)   { var L = _mcLog(); return L ? L.repsTop(v) : 0; }
  var MAX_KEY = 'mc_max_v1';
  var BAR = 45;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }
  // FIX-03 (audit L-04): round5, applyEquipCoeff and the Epley estimate each
  // propagated NaN from a NaN/undefined/Infinite input, straight into the
  // warm-up ladder, which has no guard of its own — so the athlete was shown
  // "NaN lb" rungs rather than an error. Every one is total now.
  // `floor` is the lightest load this lift can actually be done with. It
  // defaults to an empty barbell because that is what the ladder was written
  // for — and that default was applied to EVERY lift (audit EN-12). A cable
  // pushdown with a 40 lb estimated max produced a ladder of 45/45/45/45/45,
  // every rung at or above the working max, opening with "Empty bar". Cables,
  // machines, dumbbells and bodyweight movements floor at one plate step
  // instead.
  function round5(x, floor) {
    if (floor == null || !isFinite(floor)) floor = BAR;
    x = Number(x);
    if (!isFinite(x) || x <= 0) return floor;
    return Math.max(floor, Math.round(x / 5) * 5);
  }

  // Equipment comes from mc-classify.js — the ONE resolver (audit P2-13). The
  // copy that used to live here disagreed with mc-suggest.js's: it had no
  // Dumbbell branch, so the same lift was "Barbell" to this estimator and
  // "Dumbbell" to the progression engine, and neither knew Smith, Plate-Loaded
  // or Bodyweight existed at all. Resolved lazily — script order across the
  // fleet does not guarantee mc-classify.js has run when this file parses.
  function _cls() {
    if (typeof window !== 'undefined' && window.MC_CLASSIFY) return window.MC_CLASSIFY;
    try { return require('./mc-classify.js'); } catch (e) { return null; }
  }
  function equipOf(name) { var C = _cls(); return C ? C.equipCat(name) : 'Barbell'; }
  // The lightest load this lift can be loaded to: an empty bar for barbell and
  // Smith work, one plate step for everything else.
  function floorFor(name) { var C = _cls(); return (C && C.usesBarbell(name)) ? BAR : 5; }

  // Cable/Machine e1RM estimates get discounted ×0.85 to offset machine-assisted
  // leverage; Smith and everything else (including Barbell) is unchanged.
  function applyEquipCoeff(e1, equip) {
    e1 = Number(e1);
    if (!isFinite(e1) || e1 <= 0) return 0;
    // Plate-Loaded added here (audit EN-11): it is 26 catalog entries and
    // holds the heavy anchor, cluster and drop positions of an entire
    // flagship phase, so leaving it undiscounted overstated exactly the lifts
    // the coefficient exists for.
    var C = _cls();
    return (C ? C.isLeverageAssisted(equip)
              : (equip === 'Cable' || equip === 'Machine' || equip === 'Plate-Loaded'))
      ? Math.round(e1 * 0.85) : e1;
  }

  // FIX-04 (audit L-03): one shared, TOTAL reader. The local copy this
  // replaced caught malformed text and nothing else, so valid JSON of the
  // wrong shape threw straight through it. See mc-log-read.js.
  function logs() {
    // typeof-guarded: mc-maxout.js and this file's siblings are require()'d
    // from tools/ in Node, where a bare `window` is a ReferenceError.
    return (typeof window !== 'undefined' && window.MC_LOG && window.MC_LOG.readWorkoutLog)
      ? window.MC_LOG.readWorkoutLog()
      : [];
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

  // FIX-04: an entry's own set list needs the same treatment as the log —
  // `(e.sets || [])` throws on an object, and on a null member one level in.
  function setsOf(entry) {
    if (typeof window !== 'undefined' && window.MC_LOG && window.MC_LOG.readSets) {
      return window.MC_LOG.readSets(entry);
    }
    var s = entry && entry.sets;
    if (!Array.isArray(s)) return [];
    return s.filter(function (x) { return x && typeof x === 'object'; });
  }

  // best weighted set per exercise name across the workout log → e1RM
  function liftIndex() {
    var by = {};
    logs().forEach(function (e) {
      setsOf(e).forEach(function (s) {
        // P2-08: the TOP mini-set, not the sum. A cluster is rested mid-set,
        // so an Epley estimate off its total reps would overstate the max.
        var w = parseFloat(s.weight), r = repsTop(s.reps);
        // A negative weight used to yield a negative estimated max, and
        // negative reps an estimate BELOW the working weight (audit L-05).
        if (!isFinite(w) || w <= 0) return;
        if (!isFinite(r) || r < 1) r = 1;
        var k = String(s.name || '').trim();
        if (!k) return;
        var e1 = Math.round(w * (1 + Math.min(r, 12) / 30));
        if (!isFinite(e1)) return;
        if (!by[k] || e1 > by[k].e1) by[k] = { name: k, e1: e1, sessions: 0 };
      });
    });
    logs().forEach(function (e) {
      var seen = {};
      setsOf(e).forEach(function (s) {
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
    module.exports = { equipCat: equipOf, applyEquipCoeff: applyEquipCoeff, round5: round5,
                       floorFor: floorFor };
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
    var equip = equipOf(l.name);
    var t = applyEquipCoeff(l.e1, equip);
    // EN-12: the ladder is barbell-shaped. On a cable stack or a dumbbell it
    // has no empty bar to open with and no 45 lb floor to respect — every rung
    // used to clamp to 45, so a 40 lb estimated max produced six identical
    // rungs at or above the athlete's own working weight.
    var bar = floorFor(l.name);
    var opener = bar === BAR
      ? { lbl: 'Warm-up 1', w: BAR, r: '× 10', note: 'Empty bar. Groove the pattern.' }
      : { lbl: 'Warm-up 1', w: round5(t * 0.25, bar), r: '× 10', note: 'Light. Groove the pattern.' };
    plan = [
      opener,
      { lbl: 'Warm-up 2', w: round5(t * 0.4, bar), r: '× 5', note: 'Fast and crisp.' },
      { lbl: 'Warm-up 3', w: round5(t * 0.6, bar), r: '× 3', note: 'Tighten the setup.' },
      { lbl: 'Warm-up 4', w: round5(t * 0.75, bar), r: '× 2', note: 'Rest ~2 min after this one.' },
      { lbl: 'Heavy single', w: round5(t * 0.85, bar), r: '× 1', note: 'Treat it like the max — full setup. Rest 3 min.' },
      { lbl: 'Last warm-up', w: round5(t * 0.92, bar), r: '× 1', note: 'Should move with a little grind, no doubt. Rest 3 min.' }
    ];
    idx = 0;
    attemptW = round5(t * 0.975, bar);
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
