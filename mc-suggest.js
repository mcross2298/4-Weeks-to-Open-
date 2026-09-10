/* ==========================================================================
   mc-suggest.js — progression hints + carry-forward planned loads
   --------------------------------------------------------------------------
   Renders a "Suggested: 185 lb" hint next to the "Last: 180 lb" cue on each
   exercise's Log Sets toggle, persists that suggestion as next session's
   planned target (mc_plan_targets_v1), and feeds it into mc-setlog.js's
   tap-to-fill convention so the prescribed load is one tap away — never
   auto-typed over anything the lifter entered themselves.

   Rules (read from mc_setlog_v1 via the same PID namespacing as mc-setlog.js):
     • last session hit the prescribed top reps at weight W on every logged
       working set, and no set was rated RPE ≥ 9.5 / F
         → suggest W + 5 lb  (+10 for squat/press/deadlift/leg-press patterns)
     • two or more sets rated RPE ≥ 9.5 or to-failure → hold W
     • reps fell short of prescription → repeat W
     • no logged history / bodyweight-style entries → no hint

   On a 'progress' suggestion the planned load replaces the last-logged-weight
   prefill on the sets that were at last session's top weight; lighter pyramid
   sets keep their own last weights.
   ========================================================================== */
(function () {
  var isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    if (window.__mcSuggest) return;
    window.__mcSuggest = true;
  }

  var SK = 'mc_setlog_v1';
  var PK = 'mc_plan_targets_v1';   // carry-forward planned loads, keyed like SK

  function store() {
    try { return JSON.parse(localStorage.getItem(SK) || '{}') || {}; }
    catch (e) { return {}; }
  }

  // Persist the current suggestion as next session's planned target so the
  // prescription survives page loads, rides the sync whitelist, and is
  // readable by other engines (recap, quick-pump, future deload insertion).
  function writeTarget(exId, s) {
    try {
      var all = JSON.parse(localStorage.getItem(PK) || '{}') || {};
      var k = historyKey(exId);
      var prev = all[k];
      if (prev && prev.w === s.w && prev.status === s.status) return;
      all[k] = { w: s.w, status: s.status, why: s.why, ts: Date.now() };
      localStorage.setItem(PK, JSON.stringify(all));
    } catch (e) {}
  }

  // A logged weight is free text: the athlete types it mid-set, and it also
  // comes back from sync and from a restored snapshot. Anything not a finite,
  // positive, physically-possible number is not a weight, and must not become
  // one by falling through a `|| 0` (audit P2-11). The ceiling matches
  // mc-strain.js's MAX_SET_WEIGHT_LB.
  var MAX_SET_WEIGHT_LB = 5000;
  function usableWeight(v) {
    var n = parseFloat(v);
    if (!isFinite(n) || n <= 0 || n > MAX_SET_WEIGHT_LB) return 0;
    return n;
  }

  // big compound movements progress in 10 lb jumps; everything else 5 lb
  var BIG = /squat|deadlift|leg press|bench|overhead press|ohp|barbell press|military/i;

  // Equipment-aware progression step: Cable/Machine get a smaller 2.5 lb jump
  // (mirrors mc-maxout.js's e1RM discount for the same equipment types).
  // Smith intentionally behaves like Barbell — full 10/5 lb jumps, no discount
  // — it's a distinct catalog equipment value but not leverage-assisted the
  // way Cable/Machine are.
  function computeIncrement(name, equip) {
    var inc = BIG.test(name || '') ? 10 : 5;
    // A DUMBBELL increment is PER HAND, so the 10 lb compound jump is really a
    // 20 lb jump — and the BIG pattern matches plenty of dumbbell lifts
    // ("DB Bench Press", "DB Overhead Press", "Goblet Squat" via 'squat').
    // Capped at 5 per hand, which is also the smallest step most racks carry
    // (audit P2-10).
    if (equip === 'Dumbbell') inc = Math.min(inc, 5);
    // Cable, Machine and Plate-Loaded move in the smaller plate their stack
    // actually has. Plate-Loaded was missing here (audit EN-11) — 26 catalog
    // entries, and it holds the heavy anchor, cluster and drop positions of a
    // whole flagship phase.
    var C = _cls();
    if (C && C.isLeverageAssisted(equip)) inc = 2.5;
    return inc;
  }

  // Equipment comes from mc-classify.js — the ONE resolver (audit P2-13). This
  // file and mc-maxout.js each carried their own copy and they disagreed:
  // mc-maxout.js had no Dumbbell branch, so the same lift was "Dumbbell" here
  // and "Barbell" there, and neither knew Smith, Plate-Loaded or Bodyweight
  // existed — three of the catalog's seven values, 119 of its 577 exercises.
  // Resolved lazily, never captured at parse time, since script order across
  // ~140 pages does not guarantee mc-classify.js has run when this parses.
  function _cls() {
    if (typeof window !== 'undefined' && window.MC_CLASSIFY) return window.MC_CLASSIFY;
    try { return require('./mc-classify.js'); } catch (e) { return null; }
  }
  function equipOf(name) { var C = _cls(); return C ? C.equipCat(name) : 'Barbell'; }

  // The prescribed top rep target for the scheme ("4x12" -> 12, "12,10,8,8" ->
  // 8, the last one). 0 means THERE IS NO TARGET, and every caller below
  // already treats that as "nothing to judge" rather than "target zero".
  //
  // Two families used to come back with a confident number that the program
  // never prescribed, and both then drove the "did every set hit the target"
  // comparison (audit P2-09, P2-12):
  //
  //   open-ended work   "4×AMRAP", "3×failure" — the SET COUNT was read as the
  //                     rep target. Fixed in mc-setlog.js's loneRep(), so this
  //                     function now gets '' and correctly answers 0.
  //   unstated count    "100-200 reps", "AMRAP in 2 min", "21s" — no set count
  //                     anywhere, so the row list is mc-setlog.js's 3-row
  //                     DEFAULT and the target is whichever number happened to
  //                     be in the text. A finisher written as a rep range is
  //                     not a progression input, so it is refused outright.
  //
  // Note what is deliberately NOT refused: "4×10-12" states its sets and its
  // floor, so 10 is a real target to beat. Only a range with no set count at
  // all — the finisher shape — is rejected.
  function topRep(setsStr) {
    if (!setsStr) return 0;
    var u = window.MCSetlogUtil;
    if (u && u.repFor) {
      var work = u.stripDrop ? u.stripDrop(setsStr) : setsStr;
      if (u.statesSetCount && !u.statesSetCount(work)) return 0;
      var n = u.setCount ? u.setCount(work) : 3;
      var last = parseInt(u.repFor(work, n - 1), 10);
      return isNaN(last) ? 0 : last;
    }
    var m = setsStr.match(/[x×]\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  // Reps actually performed on one logged set. A CLUSTER set stores one value
  // per mini-set joined with '+' ("5+5+6" — mc-setlog.js's clusterRVal), and
  // parseInt stops at the first '+' and reads 5. Against any target above that
  // the set is short every single time, so a cluster exercise is judged a
  // failed session forever and can never progress — audit P2-08, 48 distinct
  // cluster prescriptions in this tree. mc-log-read.js owns the reader; this
  // is a call, not a fourth copy of the arithmetic.
  function repsOf(v) {
    var L = (typeof window !== 'undefined') && window.MC_LOG;
    if (L && L.repsTotal) return L.repsLogged(v) ? L.repsTotal(v) : NaN;
    var parts = String(v == null ? '' : v).split('+')
      .map(function (x) { return parseInt(x, 10); })
      .filter(function (x) { return isFinite(x); });
    if (!parts.length) return NaN;
    return parts.reduce(function (a, b) { return a + b; }, 0);
  }

  function historyKey(exId) {
    var u = window.MCSetlogUtil;
    return u && u.histKey ? u.histKey(exId)
      : (location.pathname.split('/').pop().replace('.html', '') + '|' + exId);
  }

  // All logged sessions for an exercise (newest first), excluding today's
  // still-in-progress one.
  function completedSessions(exId) {
    var hist = store()[historyKey(exId)] || [];
    var today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return hist.filter(function (s) { return s && s.d !== today; });
  }

  // Classify one logged session against the day's prescribed rep target:
  //   'hold'     — 2+ sets at RPE ≥ 9.5 / failure
  //   'repeat'   — reps fell short of the target
  //   'progress' — every logged set hit the target, no near-max sets
  //   'match'    — weight logged but no rep target to compare against
  //   null       — bodyweight/unweighted or no sets logged
  function classifySession(sess, setsStr) {
    if (!sess || !sess.sets) return null;
    var sets = Object.keys(sess.sets).map(function (k) { return sess.sets[k]; });
    // Validate the weight field rather than trusting it (audit P2-11). It is a
    // free-text input the athlete types with one thumb mid-set, and it also
    // arrives from sync and from restored snapshots. `parseFloat(x) || 0`
    // rejects only NaN and zero: a NEGATIVE weight passed straight through and
    // became the session's max when every other set was heavier in the wrong
    // direction, and an Infinity or a fat-fingered 18500 became a suggestion
    // built on it. The 5000 lb ceiling is mc-strain.js's own, for the same
    // reason it has one — past a loaded sled, nothing real is heavier.
    var weights = sets.map(function (s) { return usableWeight(s.w); }).filter(Boolean);
    if (!weights.length) return null;                 // bodyweight / unweighted
    var W = Math.max.apply(null, weights);

    var hardSets = sets.filter(function (s) {
      return s.rpe === 'F' || parseFloat(s.rpe) >= 9.5;
    }).length;
    if (hardSets >= 2) return { status: 'hold', w: W };

    var target = topRep(setsStr);
    if (target > 0) {
      var allHit = sets.every(function (s) {
        var r = repsOf(s.r);
        return !s.w || isNaN(r) || r >= target;   // unlogged reps don't block
      });
      var anyLogged = sets.some(function (s) { return !isNaN(repsOf(s.r)); });
      if (anyLogged && !allHit) return { status: 'repeat', w: W };
      if (anyLogged && allHit) return { status: 'progress', w: W };
    }
    return { status: 'match', w: W };
  }

  function suggestFor(exId, name, setsStr) {
    // completedSessions() exists to exclude TODAY's still-in-progress session,
    // and the fallback that used to sit here — `: (store()[historyKey(exId)]
    // || [])[0]` — reached straight past it and took that very session
    // whenever it was the only one on record (audit EN-5). So on a first-ever
    // session the engine read the sets the athlete had just logged minutes
    // earlier, judged them a completed session, and suggested adding weight
    // mid-workout off its own half-finished data. No history means no
    // suggestion; that is what "no history -> no hint" in this file's own
    // header has always said.
    var sessions = completedSessions(exId);
    if (!sessions.length) return null;
    var cls = classifySession(sessions[0], setsStr);
    if (!cls) return null;

    if (cls.status === 'hold') return { w: cls.w, base: cls.w, status: 'hold', why: 'hold — last session was near max' };
    if (cls.status === 'repeat') return { w: cls.w, base: cls.w, status: 'repeat', why: 'repeat — chase the rep target' };
    if (cls.status === 'progress') {
      var eq = equipOf(name || '');
      var inc = computeIncrement(name, eq);
      return { w: cls.w + inc, base: cls.w, status: 'progress', why: 'all reps hit last time — move up' };
    }
    return { w: cls.w, base: cls.w, status: 'match', why: 'match your last session' };
  }

  // Plateau/deload signal: walk the completed-session history newest-first
  // and count a streak of sessions that never progressed (held or repeated).
  // A 'match'/null session (no rep target to judge, or no data) breaks the
  // streak rather than counting against it — there's nothing to judge there.
  var PLATEAU_STREAK = 3;   // 3 non-progressing sessions in a row → plateau
  var DELOAD_STREAK = 4;    // 4 in a row → apply a deload, not just a hold

  // −10% off the last top weight, rounded to the exercise's usable plate
  // increment (2.5 lb for Cable/Machine, 5 lb otherwise — the smallest step
  // those stacks/plates actually move in, not the BIG-lift progression jump).
  function deloadWeight(base, name) {
    var eq = equipOf(name || '');
    var C = _cls();
    // Plate-Loaded moves in the same small increments (audit EN-11).
    var step = (C && C.isLeverageAssisted(eq)) ? 2.5 : 5;
    return Math.round((base * 0.9) / step) * step;
  }

  function detectPlateau(exId, setsStr) {
    var sessions = completedSessions(exId);
    if (sessions.length < PLATEAU_STREAK) return null;

    var streak = 0;
    for (var i = 0; i < sessions.length; i++) {
      var cls = classifySession(sessions[i], setsStr);
      if (cls && (cls.status === 'hold' || cls.status === 'repeat')) streak++;
      else break;
    }
    if (streak >= DELOAD_STREAK) {
      return { level: 'deload', streak: streak, why: streak + ' sessions without progress — consider a deload (~10% off) next time' };
    }
    if (streak >= PLATEAU_STREAK) {
      return { level: 'plateau', streak: streak, why: streak + ' sessions without progress' };
    }
    return null;
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
      // EN-1/EN-8: ask mc-setlog.js for the id it actually writes under.
      // Reading card.dataset.id here would key the suggestion on the card's
      // POSITION while the logger keys history on the exercise NAME — two
      // different buckets for the same set, so no suggestion would ever
      // find the history it was computed from.
      var u0 = window.MCSetlogUtil;
      var exId = (u0 && u0.exIdOf) ? u0.exIdOf(card) : cls.slice('mcl-hist-'.length);

      var nmStr = nmEl ? nmEl.textContent : '';
      var setsStr = seEl ? seEl.textContent.trim() : '';
      var s = suggestFor(exId, nmStr, setsStr);
      if (!s || !s.w) return;

      var hint = document.createElement('span');
      hint.className = 'mcl-suggest';
      hint.title = s.why;
      var perHand = equipOf(nmStr) === 'Dumbbell' ? ' per hand' : '';
      hint.textContent = 'Suggested: ' + s.w + ' lb' + perHand;
      tgl.insertBefore(hint, hist);

      // A deload takes over the actual carried-forward target — 4 straight
      // non-progressing sessions means "less weight," not "same weight"
      // (which is all a plain 'hold'/'repeat' suggestion would carry forward).
      var plateau = detectPlateau(exId, setsStr);
      var target = s;
      if (plateau && plateau.level === 'deload') {
        target = { w: deloadWeight(s.base, nmStr), base: s.base, status: 'deload', why: plateau.why };
      }
      writeTarget(exId, target);

      if (plateau) {
        var flag = document.createElement('span');
        flag.className = 'mcl-plateau mcl-plateau-' + plateau.level;
        flag.title = plateau.why;
        flag.textContent = plateau.level === 'deload'
          ? '↓ Deload applied — ' + target.w + ' lb' + perHand + ' next time'
          : '⏸ Plateau';
        tgl.insertBefore(flag, hist);
      }

      // Wire into mc-setlog.js's existing tap-to-fill convention (focusing an
      // empty weight input applies its data-fill value) instead of leaving
      // this as text the lifter has to retype into the logger by hand.
      // Carry-forward rule: on a 'progress' suggestion — or an applied
      // 'deload' — the planned load takes over the prefill of sets that were
      // at last session's top weight (the ones it was computed from); lighter
      // pyramid sets keep the last-logged prefill mc-setlog.js already set.
      // Typed values are never overwritten.
      var wInputs = card.querySelectorAll('.mcl-w');
      Array.prototype.forEach.call(wInputs, function (inp) {
        if (inp.value.trim()) return;
        var cur = parseFloat(inp.dataset.fill);
        if (!inp.dataset.fill || ((target.status === 'progress' || target.status === 'deload') && cur === target.base)) {
          inp.placeholder = target.w + ' lb' + perHand;
          inp.dataset.fill = String(target.w);
        }
      });
    });
  }

  function injectCSS() {
    if (document.getElementById('mcSuggestCss')) return;
    var st = document.createElement('style');
    st.id = 'mcSuggestCss';
    st.textContent =
      '.mcl-suggest{font-size:11px;font-weight:800;color:#34d399;margin-left:auto;' +
        'white-space:nowrap;text-transform:none;letter-spacing:0;}' +
      // hist normally pushes itself right with margin-left:auto; whichever of
      // suggest/plateau ends up immediately before it takes over that role
      '.mcl-suggest + .mcl-hist{margin-left:0;}' +
      '.mcl-plateau{font-size:11px;font-weight:800;margin-left:8px;' +
        'white-space:nowrap;text-transform:none;letter-spacing:0;}' +
      '.mcl-plateau-plateau{color:#f59e0b;}' +
      '.mcl-plateau-deload{color:#f87171;}' +
      '.mcl-plateau + .mcl-hist{margin-left:0;}';
    document.head.appendChild(st);
  }

  // A-13: subscribe to the shared render signal (MC_SCAN) instead of a
  // [400,1000,2000,3000] retry ladder guessing when the cards will exist.
  function init() {
    injectCSS();
    if (window.MC_SCAN && MC_SCAN.subscribe) {
      MC_SCAN.subscribe(render); MC_SCAN.start(); MC_SCAN.schedule();
    } else {
      var t;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(render, 120); })
        .observe(document.body, { childList: true, subtree: true });
      setTimeout(render, 600);
    }
    render();
  }
  if (isBrowser) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  // Node-side hook so CI can regression-test the real progression math
  // (see tools/test-mc-suggest.js) instead of a duplicated inline copy.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      computeIncrement: computeIncrement, topRep: topRep, equipCat: equipOf,
      repsOf: repsOf,
      classifySession: classifySession, detectPlateau: detectPlateau, suggestFor: suggestFor,
      writeTarget: writeTarget, deloadWeight: deloadWeight,
      usableWeight: usableWeight
    };
  }
})();
