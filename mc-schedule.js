/* ==========================================================================
   mc-schedule.js — Phase 2: Dynamic Schedule Scaling Engine
   --------------------------------------------------------------------------
   Adapts a custom multi-week program to fewer training days per week WITHOUT
   ever mutating the stored template. All state lives in an instance-level
   override store; the frontend re-renders from it.

   Architectural constraints (spec §2.1):
     • Immutable templates — mc_custom_programs_v1 is never written here.
     • Instance-level state — mc_weekly_overrides_v1 holds the weekly_overrides
       object; cat-custom.html / run-program.html re-render from it.

   Two strategies behind one hook, adjustFrequency(prog, week, targetDays, strategy):
     • 'consolidate' (Option A) — keep `targetDays` days this week; redistribute
       the dropped days' exercises into the survivors, Primary compounds first
       (tier via mc-biomech patterns), capping each day's volume and dropping
       the lowest-priority accessory overflow.
     • 'postpone' (Option B) — train `targetDays` days this week; the rest slide
       into a new catch-up week inserted right after, extending the program by
       one week so no session is lost. Later weeks renumber forward.

   Consolidation is a PURE function of (prog, targetDays), so the listing
   (cat-custom) and the runner (run-program) rebuild byte-identical merged days
   from the same inputs — no merged data is persisted.

   Exposes window.MCSchedule.
   ========================================================================== */
(function () {
  "use strict";
  if (window.MCSchedule) return;

  var KEY = 'mc_weekly_overrides_v1';

  // movement patterns that count as Primary compounds (everything else is an
  // accessory). Mirrors mc-biomech.js so Phase 1 + Phase 2 agree on importance.
  var COMPOUND = {
    'horizontal-push': 1, 'incline-push': 1, 'vertical-push': 1,
    'horizontal-pull': 1, 'vertical-pull': 1, 'squat': 1, 'hip-hinge': 1, 'lunge': 1
  };

  // ---- tiny helpers --------------------------------------------------------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : (d || 0); }
  function setsSum(day) {
    return (day.exercises || []).reduce(function (s, e) { return s + num(e.sets, 0); }, 0);
  }
  function fallbackPattern(name) {
    var s = ' ' + String(name || '').toLowerCase() + ' ';
    if (/press|bench|push-?up|\bdip\b/.test(s)) return 'horizontal-push';
    if (/row|pulldown|pull-?up|chin/.test(s)) return 'horizontal-pull';
    if (/squat|leg press|hack/.test(s)) return 'squat';
    if (/deadlift|rdl|romanian|hip thrust|good morning/.test(s)) return 'hip-hinge';
    if (/lunge|split squat|step-?up/.test(s)) return 'lunge';
    return 'other';
  }
  function tierOf(ex) {
    var pat;
    try { pat = window.MCBiomech ? window.MCBiomech.classify(ex.name).pattern : fallbackPattern(ex.name); }
    catch (e) { pat = fallbackPattern(ex.name); }
    return COMPOUND[pat] ? 'primary' : 'accessory';
  }

  // ---- override store ------------------------------------------------------
  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeAll(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {}
  }
  function getOverrides(progId) {
    var all = readAll();
    var o = all[progId] || {};
    return { weeks: o.weeks || {}, postpone: o.postpone || null };
  }
  function saveOverrides(progId, o) {
    var all = readAll();
    if ((!o.weeks || !Object.keys(o.weeks).length) && !o.postpone) delete all[progId];
    else all[progId] = { weeks: o.weeks || {}, postpone: o.postpone || null };
    writeAll(all);
  }
  function hasAdjustments(progId) {
    var o = getOverrides(progId);
    return !!(o.postpone || Object.keys(o.weeks).length);
  }

  // ---- Option A: consolidation (pure) -------------------------------------
  // Keep the first `targetDays` days; merge the rest in by muscle match, Primary
  // first, under a per-day volume cap. Returns { days:[mergedDay…], dropped:[…] }.
  function consolidate(prog, targetDays) {
    var N = prog.days.length;
    var t = Math.max(1, Math.min(targetDays, N - 1));
    var kept = prog.days.slice(0, t).map(function (d) {
      var c = clone(d); c._mergedFrom = []; return c;
    });
    var dropped = prog.days.slice(t);

    // pool every dropped exercise, tagged with tier + source day
    var poolItems = [];
    dropped.forEach(function (d) {
      (d.exercises || []).forEach(function (ex) {
        poolItems.push({ ex: clone(ex), from: d.name, tier: tierOf(ex), sets: num(ex.sets, 0) });
      });
    });
    // Primary compounds first; within a tier, heavier (more sets) first
    poolItems.sort(function (a, b) {
      if (a.tier !== b.tier) return a.tier === 'primary' ? -1 : 1;
      return b.sets - a.sets;
    });

    // volume cap: an absolute per-session ceiling (~1.7× the heaviest authored
    // day) so a merged day stays time-realistic. Primary compounds are always
    // carried even past the cap; accessory overflow is trimmed. The cap is a
    // fixed ceiling — NOT proportional to merged volume — so deeper cuts trim
    // more, which is the whole point of "cap + drop overflow".
    var maxDaySets = prog.days.reduce(function (m, d) { return Math.max(m, setsSum(d)); }, 0);
    var cap = Math.max(maxDaySets + 3, Math.round(maxDaySets * 1.7));

    var curr = kept.map(setsSum);
    var profile = kept.map(function (d) {
      var p = {}; (d.exercises || []).forEach(function (e) { p[e.muscle] = (p[e.muscle] || 0) + 1; }); return p;
    });
    var droppedOut = [];

    function bestDayFor(muscle) {                 // most same-muscle work, tie → least loaded
      var bi = 0, bs = -1;
      for (var i = 0; i < kept.length; i++) {
        var score = (profile[i][muscle] || 0) * 1000 - curr[i];
        if (score > bs) { bs = score; bi = i; }
      }
      return bi;
    }
    function leastLoadedWithRoom(sets) {
      var bi = -1;
      for (var i = 0; i < kept.length; i++) {
        if (curr[i] + sets <= cap && (bi === -1 || curr[i] < curr[bi])) bi = i;
      }
      return bi;
    }
    function place(item, idx) {
      var ex = item.ex; ex._from = item.from;
      kept[idx].exercises.push(ex);
      curr[idx] += item.sets;
      profile[idx][ex.muscle] = (profile[idx][ex.muscle] || 0) + 1;
      if (kept[idx]._mergedFrom.indexOf(item.from) < 0) kept[idx]._mergedFrom.push(item.from);
    }

    poolItems.forEach(function (item) {
      var target = bestDayFor(item.ex.muscle);
      if (item.tier === 'primary') { place(item, target); return; }   // Primary always carried
      if (curr[target] + item.sets <= cap) { place(item, target); return; }
      var alt = leastLoadedWithRoom(item.sets);
      if (alt >= 0) place(item, alt); else droppedOut.push(item.ex.name);
    });

    return { days: kept, dropped: droppedOut, cap: cap };
  }
  function consolidatedDay(prog, targetDays, cd) {
    var r = consolidate(prog, targetDays);
    return r.days[cd] || null;
  }

  // ---- resolver: the virtual week layout ----------------------------------
  // Builds the displayed week list from base template + postpone insertion +
  // per-week consolidation. dayRefs are reproducible links, not stored data.
  function schedule(prog) {
    var ov = getOverrides(prog.id);
    var N = prog.days.length;
    var weeks = [];
    for (var w = 1; w <= prog.weeks; w++) {
      weeks.push({
        label: w, source: 'normal', adjusted: false, strategy: null, note: '',
        dayRefs: prog.days.map(function (d, i) { return { kind: 'orig', day: i }; })
      });
    }

    // Option B — postpone: split week W, insert a catch-up week after it.
    if (ov.postpone && ov.postpone.atWeek >= 1 && ov.postpone.atWeek <= weeks.length) {
      var W = ov.postpone.atWeek;
      var t = Math.max(1, Math.min(ov.postpone.targetDays, N - 1));
      var idx = W - 1;
      var thisWeek = weeks[idx];
      var movedRefs = thisWeek.dayRefs.slice(t);          // postponed sessions
      thisWeek.dayRefs = thisWeek.dayRefs.slice(0, t);
      thisWeek.adjusted = true; thisWeek.strategy = 'postpone';
      thisWeek.note = t + ' of ' + N + ' this week · rest moved to a catch-up week';
      var catchUp = {
        label: 0, source: 'catchup', adjusted: true, strategy: 'postpone',
        note: 'Catch-up — sessions moved from Week ' + W, dayRefs: movedRefs
      };
      weeks.splice(idx + 1, 0, catchUp);
      weeks.forEach(function (wk, i) { wk.label = i + 1; });   // renumber
    }

    // Option A — consolidate: transform any week whose final label is overridden.
    weeks.forEach(function (wk) {
      var spec = ov.weeks[String(wk.label)];
      if (!spec || spec.strategy !== 'consolidate') return;
      var r = consolidate(prog, spec.targetDays);
      wk.dayRefs = r.days.map(function (d, i) { return { kind: 'cons', cd: i, targetDays: spec.targetDays }; });
      wk.adjusted = true; wk.strategy = 'consolidate';
      wk.note = N + ' days merged into ' + r.days.length +
        (r.dropped.length ? ' · ' + r.dropped.length + ' accessor' + (r.dropped.length === 1 ? 'y' : 'ies') + ' trimmed' : '');
    });

    return { totalWeeks: weeks.length, weeks: weeks };
  }
  function totalWeeks(prog) { return schedule(prog).totalWeeks; }

  // Resolve one displayed week into render-ready day objects (+ provenance/links).
  function daysForWeek(prog, weekLabel) {
    var sch = schedule(prog);
    var wk = sch.weeks.filter(function (x) { return x.label === weekLabel; })[0];
    if (!wk) return { week: wk, days: [] };
    var consCache = {};
    var days = wk.dayRefs.map(function (ref) {
      if (ref.kind === 'orig') {
        var d = prog.days[ref.day];
        return {
          name: d.name, exercises: d.exercises, origIndex: ref.day,
          mergedFrom: [], pid: 'cprog-' + prog.id + '-d' + (ref.day + 1),
          href: 'run-program.html?prog=' + prog.id + '&w=' + weekLabel + '&d=' + (ref.day + 1)
        };
      }
      var r = consCache[ref.targetDays] || (consCache[ref.targetDays] = consolidate(prog, ref.targetDays));
      var md = r.days[ref.cd];
      return {
        name: md.name, exercises: md.exercises, origIndex: null,
        mergedFrom: md._mergedFrom || [],
        pid: 'cprog-' + prog.id + '-cons' + ref.targetDays + '-d' + ref.cd,
        href: 'run-program.html?prog=' + prog.id + '&w=' + weekLabel + '&cons=' + ref.targetDays + '&cd=' + ref.cd
      };
    });
    return { week: wk, days: days };
  }

  // ---- the hook (spec signature) ------------------------------------------
  function adjustFrequency(prog, week, targetDays, strategy) {
    var N = prog.days.length;
    var ov = getOverrides(prog.id);
    if (!targetDays || targetDays >= N) {           // "no change" → clear this week
      delete ov.weeks[String(week)];
      if (ov.postpone && ov.postpone.atWeek === week) ov.postpone = null;
      saveOverrides(prog.id, ov);
      return;
    }
    if (strategy === 'postpone') {
      delete ov.weeks[String(week)];                // postpone replaces a consolidate on the same week
      ov.postpone = { atWeek: week, targetDays: targetDays };
    } else {
      ov.weeks[String(week)] = { strategy: 'consolidate', targetDays: targetDays };
      if (ov.postpone && ov.postpone.atWeek === week) ov.postpone = null;
    }
    saveOverrides(prog.id, ov);
  }
  function reset(progId) { saveOverrides(progId, { weeks: {}, postpone: null }); }

  // ======================================================================== //
  //  Adjust sheet (UI)                                                       //
  // ======================================================================== //
  function injectCss() {
    if (document.getElementById('mc-sched-css')) return;
    var css =
      '.mcs-ov{position:fixed;inset:0;z-index:1400;display:none;align-items:flex-end;' +
        'padding:14px;background:rgba(0,0,0,0.62);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}' +
      '.mcs-ov.open{display:flex;}' +
      '.mcs-sheet{width:100%;max-width:520px;margin:0 auto;background:#0e0e0e;border:1px solid rgba(255,255,255,0.1);' +
        'border-radius:18px;padding:16px;box-shadow:0 -8px 40px rgba(0,0,0,0.6);max-height:84vh;overflow-y:auto;}' +
      '.mcs-title{font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;}' +
      '.mcs-sub{font-size:14px;font-weight:700;color:#e2e8f0;margin:4px 0 14px;}' +
      '.mcs-lbl{font-size:11px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:#94a3b8;margin:14px 2px 8px;}' +
      '.mcs-days{display:flex;flex-wrap:wrap;gap:8px;}' +
      '.mcs-day{min-width:46px;padding:11px 0;flex:1;border-radius:11px;cursor:pointer;font-family:inherit;' +
        'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#cbd5e1;font-size:15px;font-weight:800;text-align:center;}' +
      '.mcs-day.on{background:var(--accent,#34d399);border-color:var(--accent,#34d399);color:#04220f;}' +
      '.mcs-day:disabled{opacity:0.32;cursor:default;}' +
      '.mcs-strat{display:flex;flex-direction:column;gap:8px;}' +
      '.mcs-opt{display:block;width:100%;text-align:left;padding:13px;border-radius:12px;cursor:pointer;font-family:inherit;' +
        'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;}' +
      '.mcs-opt.on{background:rgba(52,211,153,0.1);border-color:var(--accent,#34d399);}' +
      '.mcs-opt-t{font-size:14px;font-weight:800;}' +
      '.mcs-opt-d{font-size:12px;font-weight:600;color:#94a3b8;margin-top:3px;}' +
      '.mcs-btns{display:flex;gap:10px;margin-top:18px;}' +
      '.mcs-btn{flex:1;padding:13px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:800;}' +
      '.mcs-apply{background:var(--accent,#34d399);color:#04220f;}' +
      '.mcs-cancel{background:rgba(255,255,255,0.06);color:#94a3b8;}' +
      '.mcs-reset{background:rgba(248,113,113,0.14);color:#f87171;flex:0 0 92px;}' +
      '.mcs-preview{margin-top:14px;padding:11px 12px;border-radius:11px;background:rgba(52,211,153,0.07);' +
        'border:1px solid rgba(52,211,153,0.2);font-size:12px;font-weight:700;color:#86efac;line-height:1.5;}';
    var s = document.createElement('style'); s.id = 'mc-sched-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  function openSheet(prog, week, onChange) {
    injectCss();
    var N = prog.days.length;
    var ov = getOverrides(prog.id);
    var existing = ov.weeks[String(week)];
    var isPostpone = ov.postpone && ov.postpone.atWeek === week;
    var sel = existing ? existing.targetDays : (isPostpone ? ov.postpone.targetDays : N - 1);
    var strat = isPostpone ? 'postpone' : 'consolidate';

    var ov2 = document.createElement('div');
    ov2.className = 'mcs-ov';
    document.body.appendChild(ov2);

    function dayBtns() {
      var h = '';
      for (var i = 1; i <= N; i++) {
        h += '<button class="mcs-day' + (i === sel ? ' on' : '') + '" data-d="' + i + '"' +
             (i === N ? ' disabled title="Full week — no change"' : '') + '>' + i + '</button>';
      }
      return h;
    }
    function preview() {
      if (sel >= N) return 'Full ' + N + '-day week — no change.';
      if (strat === 'consolidate') {
        var r = consolidate(prog, sel);
        var txt = 'Merge ' + N + ' days into ' + r.days.length + '. ';
        txt += r.dropped.length ? (r.dropped.length + ' low-priority accessor' + (r.dropped.length === 1 ? 'y' : 'ies') + ' trimmed to keep sessions tight.') : 'All work redistributed.';
        return txt;
      }
      return 'Train ' + sel + ' day' + (sel === 1 ? '' : 's') + ' this week; the other ' + (N - sel) +
        ' move into a new catch-up week (program extends to ' + (prog.weeks + 1) + ' weeks).';
    }
    function render() {
      ov2.innerHTML =
        '<div class="mcs-sheet">' +
          '<div class="mcs-title">Adjust schedule</div>' +
          '<div class="mcs-sub">Week ' + week + ' · ' + N + ' days/week</div>' +
          '<div class="mcs-lbl">Days you can train this week</div>' +
          '<div class="mcs-days">' + dayBtns() + '</div>' +
          '<div class="mcs-lbl">How to handle the dropped days</div>' +
          '<div class="mcs-strat">' +
            '<button class="mcs-opt' + (strat === 'consolidate' ? ' on' : '') + '" data-s="consolidate">' +
              '<div class="mcs-opt-t">🧬 Consolidate</div>' +
              '<div class="mcs-opt-d">Merge key lifts into the days you keep. Primary compounds first; overflow accessories trimmed.</div></button>' +
            '<button class="mcs-opt' + (strat === 'postpone' ? ' on' : '') + '" data-s="postpone">' +
              '<div class="mcs-opt-t">📆 Postpone</div>' +
              '<div class="mcs-opt-d">Push the rest into a new catch-up week. Nothing is lost; the program extends by a week.</div></button>' +
          '</div>' +
          '<div class="mcs-preview">' + preview() + '</div>' +
          '<div class="mcs-btns">' +
            (hasAdjustments(prog.id) ? '<button class="mcs-btn mcs-reset" data-act="reset">Reset</button>' : '') +
            '<button class="mcs-btn mcs-cancel" data-act="cancel">Cancel</button>' +
            '<button class="mcs-btn mcs-apply" data-act="apply">Apply</button>' +
          '</div>' +
        '</div>';
    }
    function close() { ov2.classList.remove('open'); setTimeout(function () { ov2.remove(); }, 50); }

    ov2.addEventListener('click', function (e) {
      if (e.target === ov2) { close(); return; }
      var d = e.target.closest('[data-d]');
      if (d) { sel = parseInt(d.dataset.d, 10); render(); return; }
      var s = e.target.closest('[data-s]');
      if (s) { strat = s.dataset.s; render(); return; }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var act = b.dataset.act;
      if (act === 'cancel') { close(); return; }
      if (act === 'reset') { reset(prog.id); close(); if (onChange) onChange(); return; }
      if (act === 'apply') { adjustFrequency(prog, week, sel, strat); close(); if (onChange) onChange(); }
    });
    render();
    requestAnimationFrame(function () { ov2.classList.add('open'); });
  }

  window.MCSchedule = {
    tierOf: tierOf,
    getOverrides: getOverrides,
    hasAdjustments: hasAdjustments,
    consolidate: consolidate,
    consolidatedDay: consolidatedDay,
    schedule: schedule,
    totalWeeks: totalWeeks,
    daysForWeek: daysForWeek,
    adjustFrequency: adjustFrequency,
    reset: reset,
    openSheet: openSheet
  };
})();
