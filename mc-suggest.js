/* ==========================================================================
   mc-suggest.js — "Suggested: 185 lb" progression hints (Phase 2.3)
   --------------------------------------------------------------------------
   Suggest, don't fill: renders a small hint next to the "Last: 180 lb" cue on
   each exercise's Log Sets toggle. NEVER touches the weight/reps inputs — the
   lifter always types their own numbers.

   Rules (read from mc_setlog_v1 via the same PID namespacing as mc-setlog.js):
     • last session hit the prescribed top reps at weight W on every logged
       working set, and no set was rated RPE ≥ 9.5 / F
         → suggest W + 5 lb  (+10 for squat/press/deadlift/leg-press patterns)
     • two or more sets rated RPE ≥ 9.5 or to-failure → hold W
     • reps fell short of prescription → repeat W
     • no logged history / bodyweight-style entries → no hint
   ========================================================================== */
(function () {
  if (window.__mcSuggest) return;
  window.__mcSuggest = true;

  var SK = 'mc_setlog_v1';

  function store() {
    try { return JSON.parse(localStorage.getItem(SK) || '{}') || {}; }
    catch (e) { return {}; }
  }

  // big compound movements progress in 10 lb jumps; everything else 5 lb
  var BIG = /squat|deadlift|leg press|bench|overhead press|ohp|barbell press|military/i;

  // Resolve equipment type for an exercise: catalog lookup first, then keyword fallback.
  function equipCat(name) {
    if (window.EXERCISES) {
      var nl = (name || '').toLowerCase();
      for (var i = 0; i < EXERCISES.length; i++) {
        if (EXERCISES[i].name.toLowerCase() === nl) return EXERCISES[i].equipment || '';
      }
    }
    var s = ' ' + (name || '').toLowerCase() + ' ';
    if (/\bcable\b|pulldown|push-?down|rope |lat pull|face pull/.test(s)) return 'Cable';
    if (/\bmachine\b|leg press|leg extension|leg curl|pec deck|abductor|adductor/.test(s)) return 'Machine';
    if (/dumbbell|\bdb\b/.test(s)) return 'Dumbbell';
    return 'Barbell';
  }

  function topRep(setsStr) {
    // prescribed top reps for the scheme ("4x12" → 12, "12,10,8,8" → 8 (last))
    if (!setsStr) return 0;
    var u = window.MCSetlogUtil;
    if (u && u.repFor) {
      var n = u.setCount ? u.setCount(setsStr) : 3;
      var last = parseInt(u.repFor(setsStr, n - 1), 10);
      return isNaN(last) ? 0 : last;
    }
    var m = setsStr.match(/[x×]\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  function suggestFor(exId, name, setsStr) {
    var u = window.MCSetlogUtil;
    var key = u && u.histKey ? u.histKey(exId)
      : (location.pathname.split('/').pop().replace('.html', '') + '|' + exId);
    var hist = store()[key] || [];

    // most recent COMPLETED session — skip today's in-progress one
    var today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var sess = null;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i] && hist[i].d !== today) { sess = hist[i]; break; }
    }
    if (!sess) sess = hist[0];
    if (!sess || !sess.sets) return null;

    var sets = Object.keys(sess.sets).map(function (k) { return sess.sets[k]; });
    var weights = sets.map(function (s) { return parseFloat(s.w) || 0; }).filter(Boolean);
    if (!weights.length) return null;                 // bodyweight / unweighted
    var W = Math.max.apply(null, weights);

    var hardSets = sets.filter(function (s) {
      return s.rpe === 'F' || parseFloat(s.rpe) >= 9.5;
    }).length;
    if (hardSets >= 2) return { w: W, why: 'hold — last session was near max' };

    var target = topRep(setsStr);
    if (target > 0) {
      var allHit = sets.every(function (s) {
        var r = parseInt(s.r, 10);
        return !s.w || isNaN(r) || r >= target;   // unlogged reps don't block
      });
      var anyLogged = sets.some(function (s) { return !isNaN(parseInt(s.r, 10)); });
      if (anyLogged && !allHit) return { w: W, why: 'repeat — chase the rep target' };
      if (anyLogged && allHit) {
        var inc = BIG.test(name || '') ? 10 : 5;
        var eq = equipCat(name || '');
        if (eq === 'Cable' || eq === 'Machine') inc = 2.5;
        return { w: W + inc, why: 'all reps hit last time — move up' };
      }
    }
    return { w: W, why: 'match your last session' };
  }

  function render() {
    document.querySelectorAll('.mcl-toggle').forEach(function (tgl) {
      if (tgl.querySelector('.mcl-suggest')) return;
      var hist = tgl.querySelector('.mcl-hist');
      if (!hist || !hist.textContent) return;         // no history → no hint

      // recover the exId from the hist class (mcl-hist-<cssId>)
      var cls = Array.prototype.find.call(hist.classList, function (c) {
        return c.indexOf('mcl-hist-') === 0;
      });
      if (!cls) return;
      var card = tgl.closest('.ex-card, .ss-ex, .ex-item') || tgl.parentNode;
      var nmEl = card.querySelector('.ex-name, .ss-name, .lift-name');
      var seEl = card.querySelector('.ex-sets, [data-field="sets"], .lift-meta');
      var exId = (card.dataset && card.dataset.id) || cls.slice('mcl-hist-'.length);

      var nmStr = nmEl ? nmEl.textContent : '';
      var s = suggestFor(exId, nmStr, seEl ? seEl.textContent.trim() : '');
      if (!s || !s.w) return;

      var hint = document.createElement('span');
      hint.className = 'mcl-suggest';
      hint.title = s.why;
      var perHand = equipCat(nmStr) === 'Dumbbell' ? ' per hand' : '';
      hint.textContent = 'Suggested: ' + s.w + ' lb' + perHand;
      tgl.insertBefore(hint, hist);
    });
  }

  function injectCSS() {
    if (document.getElementById('mcSuggestCss')) return;
    var st = document.createElement('style');
    st.id = 'mcSuggestCss';
    st.textContent =
      '.mcl-suggest{font-size:11px;font-weight:800;color:#34d399;margin-left:auto;' +
        'white-space:nowrap;text-transform:none;letter-spacing:0;}' +
      // hist normally pushes itself right with margin-left:auto; when the hint
      // is present the hint takes that role and hist sits beside it
      '.mcl-suggest + .mcl-hist{margin-left:0;}';
    document.head.appendChild(st);
  }

  function init() {
    injectCSS();
    render();
    [400, 1000, 2000, 3000].forEach(function (d) { setTimeout(render, d); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
