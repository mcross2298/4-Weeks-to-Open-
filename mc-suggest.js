/* ==========================================================================
   mc-suggest.js — progression hints + carry-forward planned loads
   --------------------------------------------------------------------------
   Renders a "Suggested: 185 lb" hint next to the "Last: 180 lb" cue on each
   exercise's Log Sets toggle, persists that suggestion as next session's
   planned target (mc_plan_targets_v1), and feeds it into mc-setlog.js's
   tap-to-fill convention so the prescribed load is one tap away — never
   auto-typed over anything the lifter entered themselves.

   Rules (read from mc_setlog_v1 via the same PID namespacing as mc-setlog.js):
     • last session logged every prescribed working set and each one hit its
       own target (top of any range), and no set was rated RPE ≥ 9.5 / F
         → suggest W + 5 lb  (+10 for squat/press/deadlift/leg-press patterns,
           halved on cable / machine / plate-loaded, capped 5 per hand on DBs)
     • fewer working sets logged than prescribed → repeat W
     • two or more sets rated RPE ≥ 9.5 or to-failure → hold W
     • reps fell short of prescription → repeat W
     • no logged history / bodyweight-style entries → no hint

   On a 'progress' suggestion the planned load replaces the last-logged-weight
   prefill on the sets that were at last session's top weight; lighter pyramid
   sets keep their own last weights.

   Double progression (Phase S4): inside a rep RANGE ("3×8-12") the reps move
   first and the load second. Short of the top → same load, and each set's
   rep ghost asks for one more than it did last time (never past the top);
   every set at the top → the load steps up and the rep ghost resets to the
   bottom of the range. Board decision (2026-10-25): the "one more rep" goal
   is said in the HINT only ("Suggested: 100 lb × 11"); the reps box ghosts
   what was actually done last time. A ghost ticked unchanged is logged as-is,
   so a goal in the box would log reps nobody did. Fixed targets ("5×5", a "12,10,8" pyramid) have no
   range to climb and keep the prescribed reps, as before.
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
      var r = Array.isArray(s.r) ? s.r : undefined;
      if (prev && prev.w === s.w && prev.status === s.status &&
          JSON.stringify(prev.r) === JSON.stringify(r)) return;
      all[k] = { w: s.w, status: s.status, why: s.why, ts: Date.now() };
      if (r) all[k].r = r;
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
  // Flagship readiness R4 / D-22: "bench" also matches a bench used as a PROP
  // for another movement — "Reverse Incline Bench Concentration Curls" stepped
  // 10 lb like a bench press. A name whose movement is an isolation word is
  // not a big lift, whatever it is performed on. "Bench press only" would be
  // too strict the other way: real benches are named without "press"
  // ("Close-Grip Barbell Bench"). Owner decision, round 2 of the audit.
  var PROP_MOVEMENT = /\b(fly|flye|flyes|flies|curls?|pushdowns?|push-downs?|extensions?|kickbacks?|raises?|supermans?|crunch(es)?|rows?)\b/i;
  function isBigLift(name) {
    var n = name || '';
    return BIG.test(n) && !PROP_MOVEMENT.test(n);
  }

  // Equipment-aware progression step. Smith intentionally behaves like Barbell
  // — full 10/5 lb jumps, no discount — it's a distinct catalog equipment
  // value but not leverage-assisted the way Cable/Machine are.
  function computeIncrement(name, equip) {
    var inc = isBigLift(name) ? 10 : 5;
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
    //
    // R4 / D-22: CLAUDE.md Task 3.3's rule is "Cable/Machine ×0.5 step" — HALF
    // the jump the same lift would take with free weight. This was a flat
    // 2.5 lb, so the big leverage-assisted lifts (Leg Press, Hack Squat, a
    // plate-loaded press — 18 catalog lifts) stepped a quarter of their
    // barbell jump instead of half of it.
    var C = _cls();
    if (C && C.isLeverageAssisted(equip)) inc = inc * 0.5;
    return inc;
  }

  // Equipment comes from mc-classify.js — the ONE resolver (audit P2-13). This
  // file and mc-maxout.js each carried their own copy and they disagreed:
  // mc-maxout.js had no Dumbbell branch, so the same lift was "Dumbbell" here
  // and "Barbell" there, and neither knew Smith, Plate-Loaded or Bodyweight
  // existed — three of the catalog's seven values, 119 of its 580 exercises.
  // Resolved lazily, never captured at parse time, since script order across
  // ~140 pages does not guarantee mc-classify.js has run when this parses.
  function _cls() {
    if (typeof window !== 'undefined' && window.MC_CLASSIFY) return window.MC_CLASSIFY;
    try { return require('./mc-classify.js'); } catch (e) { return null; }
  }
  // The prescription parser, resolved the same lazy way: mc-setlog.js in a
  // page, its Node export hook in the unit tests, so both read the REAL parser.
  function _setlog() {
    if (typeof window !== 'undefined' && window.MCSetlogUtil && window.MCSetlogUtil.repFor) return window.MCSetlogUtil;
    try { return require('./mc-setlog.js'); } catch (e) { return null; }
  }
  function equipOf(name) { var C = _cls(); return C ? C.equipCat(name) : 'Barbell'; }

  // The prescription's per-set rep TARGETS, top of any range — the shape the
  // owner chose in round 2 of the flagship audit (R4 / D-21): "4×10-12" is
  // judged against 12 on every set, not 10, and a pyramid "12,10,8,8" against
  // 12, 10, 8 and 8 in turn, not its last number on every set. Drop and AMRAP
  // rows are stripped first, so they are never judged as working sets.
  //
  // An empty list means THERE IS NO TARGET, and every caller treats that as
  // "nothing to judge" rather than "target zero". Two families used to come
  // back with a confident number the program never prescribed (audit P2-09,
  // P2-12): open-ended work ("4×AMRAP", "3×failure" — mc-setlog.js's
  // loneRep() returns '' for those), and a prescription with no set count at
  // all ("100-200 reps", "AMRAP in 2 min", "21s"), which is a finisher and not
  // a progression input, so it is refused outright.
  //
  // Ranges are rewritten to their top before the shared parser reads them,
  // so this cannot disagree with mc-setlog.js about how many sets there are.
  // A tempo ("@ 4-0-1") has three numbers and is left alone.
  var RANGE_RE = /(^|[^\d\-\u2013])(\d+)\s*[-\u2013]\s*(\d+)(?![\d]|\s*[-\u2013]\s*\d)/g;
  function repTargets(setsStr) {
    if (!setsStr) return [];
    var u = _setlog();
    if (!u || !u.repFor) {
      var m = String(setsStr).match(/^\s*(\d+)\s*[x\u00d7]\s*(\d+)(?:\s*[-\u2013]\s*(\d+))?/i);
      if (!m) return [];
      var t = parseInt(m[3] || m[2], 10), out = [];
      for (var k = 0; k < parseInt(m[1], 10); k++) out.push(t);
      return out;
    }
    var work = u.stripDrop ? u.stripDrop(setsStr) : setsStr;
    if (u.statesSetCount && !u.statesSetCount(work)) return [];
    var n = u.setCount ? u.setCount(work) : 3;
    var top = String(work).replace(RANGE_RE, function (all, pre, a, b) {
      return pre + Math.max(parseInt(a, 10), parseInt(b, 10));
    });
    var targets = [];
    for (var i = 0; i < n; i++) {
      var r = parseInt(u.repFor(top, i), 10);
      targets.push(isNaN(r) ? 0 : r);
    }
    return targets;
  }
  // The BOTTOM of each working set's range — the same per-set walk as
  // repTargets() but without rewriting ranges to their top, so repFor()
  // reads a range's first number ("8-12" -> 8). Equal to the target on a
  // fixed prescription, which is how repGoals() knows there is no range.
  function repFloors(setsStr) {
    var tops = repTargets(setsStr);
    if (!tops.length) return [];
    var u = _setlog();
    if (!u || !u.repFor) {
      var m = String(setsStr).match(/^\s*\d+\s*[x\u00d7]\s*(\d+)/i);
      var b = m ? parseInt(m[1], 10) : 0;
      return tops.map(function () { return b; });
    }
    var work = u.stripDrop ? u.stripDrop(setsStr) : setsStr;
    return tops.map(function (t, i) {
      var r = parseInt(u.repFor(work, i), 10);
      return isNaN(r) ? t : Math.min(r, t);
    });
  }

  // Phase S4: per working set, the rep goal for the NEXT session, or null
  // where there is nothing to climb (a fixed target, an open-ended row, no
  // logged reps). `status` is classifySession()'s answer for that session.
  //   progress → the load steps, so reps reset to the bottom of the range
  //   repeat   → same load, one more rep than last time, capped at the top
  //   hold     → last session was near max: ask for what was done, no more
  function repGoals(sess, setsStr, status) {
    var tops = repTargets(setsStr), floors = repFloors(setsStr);
    if (!tops.length || !sess || !sess.sets) return [];
    var ordered = Object.keys(sess.sets)
      .sort(function (a, b) { return parseFloat(a) - parseFloat(b); })
      .map(function (k) { return sess.sets[k]; });
    return tops.map(function (top, i) {
      var lo = floors[i];
      if (!(top > 0) || !(lo > 0) || lo >= top) return null;   // not a range
      if (status === 'progress') return lo;
      var last = ordered[i] ? repsOf(ordered[i].r) : NaN;
      if (isNaN(last)) return status === 'repeat' ? lo : null;
      var want = status === 'repeat' ? last + 1 : last;
      return Math.max(lo, Math.min(top, want));
    });
  }

  // What the reps box may PRE-FILL, per working set: never more than was done.
  // After a load step the bottom of the range (fewer reps than last time, at
  // a heavier load, is an honest starting point); otherwise last session's
  // own reps for that set. Null where there is no goal or no logged reps.
  function repGhosts(sess, goals, status) {
    var ordered = Object.keys((sess && sess.sets) || {})
      .sort(function (a, b) { return parseFloat(a) - parseFloat(b); })
      .map(function (k) { return sess.sets[k]; });
    return goals.map(function (g, i) {
      if (g == null) return null;
      if (status === 'progress') return g;
      var last = ordered[i] ? repsOf(ordered[i].r) : NaN;
      return isNaN(last) ? null : last;
    });
  }

  // The last working set's target (kept for callers that want one number).
  function topRep(setsStr) {
    var t = repTargets(setsStr);
    return t.length ? t[t.length - 1] : 0;
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
  //
  // FIX-06 (roadmap Phase 5.1): this file reads mc_setlog_v1 through its own
  // private store(), not mc-setlog.js's st(), so it does its OWN upgrade of
  // the legacy year-less day label before comparing. Skipping that would be
  // the quiet failure: a legacy "Sep 11" never equals today's dated key, so
  // an in-progress session logged before the upgrade would be graded as a
  // COMPLETED one and the athlete would be told to add weight mid-workout.
  // Both the upgrade and the day key itself come from mc-log-read.js, so
  // there is one implementation, not a second copy that can drift from it.
  function completedSessions(exId) {
    var L = (typeof window !== 'undefined' && window.MC_LOG) ? window.MC_LOG : null;
    var hist = store()[historyKey(exId)] || [];
    if (L && L.normalizeSessions) hist = L.normalizeSessions(hist);
    var today = (L && L.dayKey) ? L.dayKey()
      : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var done = hist.filter(function (s) { return s && s.d !== today; });
    // Phase T1.8: a session logged in the program's scheduled deload week is
    // lighter ON PURPOSE (a third of the working sets gone), so judging it
    // read as a stall: the week after a deload held the load, and the deload
    // counted toward a plateau. The session before it is the real last one.
    // If every session on record is a deload, they are all there is.
    var real = done.filter(function (s) { return !isDeloadSession(s); });
    return real.length ? real : done;
  }
  function isDeloadSession(s) {
    if (!s || !s.sets || typeof s.sets !== 'object') return false;
    return Object.keys(s.sets).some(function (k) { return s.sets[k] && s.sets[k].dl; });
  }
  // The open page is on the program's scheduled deload week (mc-setlog.js
  // owns that answer: it is what trims the rows).
  function inDeloadWeek() {
    var U = (typeof window !== 'undefined') ? window.MCSetlogUtil : null;
    try { return !!(U && U.deloadNow && U.deloadNow()); } catch (e) { return false; }
  }

  // Classify one logged session against the day's prescribed rep target:
  //   'hold'     — any set at RPE ≥ 9.5 / failure
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

    // EN-7 (roadmap Phase 4 step 4) replaced a seven-value per-SET dial with
    // three buttons asked once per EXERCISE (Easy/Solid/To failure), and
    // mc-setlog.js's effort control writes 'rpe' onto exactly one row — the
    // exercise's last set — because one answer now describes the whole
    // exercise, not one set of it. This threshold predates that redesign,
    // when a per-set dial could plausibly mark several rows near failure and
    // a single grindy top single wasn't meant to hold the whole exercise.
    // With at most one row able to carry 'rpe' today, requiring two silently
    // made "To failure" unreachable: verified live, a 4x4 session with the
    // terminal set answered 'F' classified 'progress' (add weight) instead of
    // 'hold'. Any qualifying set now holds — a legacy session logged under
    // the old per-set dial still holds correctly, since 2+ implies 1+.
    var hardSets = sets.filter(function (s) {
      return s.rpe === 'F' || parseFloat(s.rpe) >= 9.5;
    }).length;
    if (hardSets >= 1) return { status: 'hold', w: W };

    // R4 / D-21: per set, against each set's own target, top of range. The
    // working sets are the first N logged rows in set order (drop and AMRAP
    // rows sit after them), so a drop's lower reps never count as a miss.
    var targets = repTargets(setsStr).filter(function (t) { return t > 0; });
    if (targets.length) {
      var ordered = Object.keys(sess.sets)
        .sort(function (a, b) { return parseFloat(a) - parseFloat(b); })
        .map(function (k) { return sess.sets[k]; });
      var working = ordered.slice(0, targets.length);
      var anyLogged = working.some(function (s) { return !isNaN(repsOf(s.r)); });
      if (anyLogged) {
        // A session with fewer working sets logged than prescribed HOLDS the
        // weight: two good sets of a 5×5 are not a 5×5 (owner decision).
        if (working.length < targets.length) return { status: 'repeat', w: W };
        var allHit = working.every(function (s, i) {
          var r = repsOf(s.r);
          return !s.w || isNaN(r) || r >= targets[i];   // unlogged reps don't block
        });
        return { status: allHit ? 'progress' : 'repeat', w: W };
      }
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
    var out = baseSuggestion(cls, name);
    // A deload holds the load and cuts the volume. It is not the week to add
    // weight or chase reps, whatever the last session earned; that earned
    // step waits for the week after, which reads past this deload (above).
    if (inDeloadWeek()) {
      return { w: cls.w, base: cls.w, status: 'match', why: 'deload week — keep your last load, fewer sets' };
    }
    var goals = repGoals(sessions[0], setsStr, cls.status);
    if (goals.some(function (g) { return g != null; })) {
      out.r = goals;
      out.rGhost = repGhosts(sessions[0], goals, cls.status);
      if (cls.status === 'repeat') out.why = 'same load — one more rep per set, up to the top of the range';
      if (cls.status === 'progress') out.why = 'top of the range on every set — load up, reps back to the bottom';
    }
    return out;
  }
  function baseSuggestion(cls, name) {
    if (cls.status === 'hold') return { w: cls.w, base: cls.w, status: 'hold', why: 'hold — last session was near max' };
    if (cls.status === 'repeat') return { w: cls.w, base: cls.w, status: 'repeat', why: 'repeat — chase the rep target' };
    if (cls.status === 'progress') {
      var eq = equipOf(name || '');
      var inc = computeIncrement(name, eq);
      return { w: cls.w + inc, base: cls.w, status: 'progress', why: 'all reps hit last time — move up' };
    }
    return { w: cls.w, base: cls.w, status: 'match', why: 'match your last session' };
  }

  // One number for the hint when every set asks for the same reps.
  function uniformGoal(r) {
    if (!r || !r.length) return null;
    var g = r.filter(function (x) { return x != null; });
    if (g.length !== r.length) return null;
    for (var i = 1; i < g.length; i++) if (g[i] !== g[0]) return null;
    return g[0];
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
      var ug = uniformGoal(s.r);
      hint.textContent = 'Suggested: ' + s.w + ' lb' + perHand + (ug != null ? ' \u00d7 ' + ug : '');
      tgl.insertBefore(hint, hist);

      // A deload takes over the actual carried-forward target — 4 straight
      // non-progressing sessions means "less weight," not "same weight"
      // (which is all a plain 'hold'/'repeat' suggestion would carry forward).
      var plateau = detectPlateau(exId, setsStr);
      var target = s;
      if (plateau && plateau.level === 'deload') {
        // A deload is a lighter load, not a rep chase: no rep goals ride it.
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
      //
      // R4 / D-08: since S2 the suggested fill is a GHOST — last session's
      // weight written into the field's real value, marked data-ghost — so
      // "is the field empty?" was false on every row and this loop never
      // reached one: the hint said 190 and one tap logged 185. A ghost is a
      // suggestion the athlete has not confirmed (mc-setlog.js never persists
      // one), so the planned load replaces it and it stays ghosted. A pending
      // or typed value carries no data-ghost and is still left alone. Drop
      // rows are skipped: a drop is lighter by definition, and handing it the
      // progressed top load would be the wrong number one tap away.
      var wInputs = card.querySelectorAll('.mcl-row:not(.mcl-row-amrap) .mcl-w');
      Array.prototype.forEach.call(wInputs, function (inp) {
        var ghost = !!inp.dataset.ghost;
        if (inp.value.trim() && !ghost) return;
        var cur = parseFloat(inp.dataset.fill);
        if (!inp.dataset.fill || ((target.status === 'progress' || target.status === 'deload') && cur === target.base)) {
          inp.placeholder = target.w + ' lb' + perHand;
          inp.dataset.fill = String(target.w);
          if (ghost) inp.value = String(target.w);
        }
      });

      // Phase S4: the rep half of double progression, on the same terms as
      // the load above. The box carries rGhost (never more than was done);
      // the goal itself is only in the hint — see the header.
      // Same terms as
      // the load above — only a ghosted or empty field is touched, so a typed
      // or pending number always wins, and nothing here is ever persisted
      // until the athlete ticks the set. Rows are working rows in order (drop
      // rows excluded); a cluster's mini-set bubbles are never ghosted.
      if (Array.isArray(target.rGhost)) {
        var rows = card.querySelectorAll('.mcl-row:not(.mcl-row-amrap)');
        Array.prototype.forEach.call(rows, function (row, i) {
          var g = target.rGhost[i];
          var rin = row.querySelector('.mcl-r:not(.mcl-rmini)');
          if (g == null || !rin) return;
          var rg = !!rin.dataset.ghost;
          if (rin.value.trim() && !rg) return;
          rin.dataset.fill = String(g);
          rin.value = String(g);
          if (!rg) { rin.classList.add('mcl-ghost'); rin.dataset.ghost = '1'; }
        });
      }
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
      computeIncrement: computeIncrement, topRep: topRep, repTargets: repTargets, isBigLift: isBigLift, equipCat: equipOf,
      repsOf: repsOf,
      classifySession: classifySession, detectPlateau: detectPlateau, suggestFor: suggestFor,
      completedSessions: completedSessions, isDeloadSession: isDeloadSession,
      writeTarget: writeTarget, deloadWeight: deloadWeight,
      repFloors: repFloors, repGoals: repGoals, repGhosts: repGhosts,
      usableWeight: usableWeight
    };
  }
})();
