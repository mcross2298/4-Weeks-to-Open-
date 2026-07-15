/* ==========================================================================
   mc-macros.js — Nutrition tab (macro tracker)
   --------------------------------------------------------------------------
   A day-based tracker on dashboard.html (#nutritionBody), laid out as:

     1. a live WEEK CALENDAR strip to move between past / future days,
     2. the MACRO TRACKER bar (calories + P/F/C vs. goals) for the picked day,
     3. (today only) a PLANNED MEALS card — roadmap B1 cookbook->workout
        bridge: today's meal-plan entries from Mike's Cookbook (read via
        mc-bridge.js's MCBridge.todaysMeals(), pulled read-only by mc-sync.js),
        each with a one-tap Log button that writes a normal entry into THIS
        store — never back into the cookbook's plan,
     4. an HOUR-BY-HOUR TIMELINE where foods are logged into the hour they
        were eaten (tap the + on any hour, or the search bar / scan).

   Single localStorage store:

     mc_macros_v1 = {
       v: 1,
       ts: <ms>,                       // bumped when profile/goals change
       profile: { sex, age, heightCm, weightLb, activity, goal },
       goals:   { kcal, p, f, c },     // per-day targets
       days: { "YYYY-MM-DD": { entries: [
         { id, ts, at, name, source, unit, qty, per:{kcal,p,f,c} }
       ] } }
     }

   `at` is the slot time (ms) the food is placed at on the timeline; `ts` is the
   last-write time used by sync conflict resolution. Goals come from the
   suggest-then-adjust calculator (mc-macrocalc.js); weight pre-fills from the
   bodyweight log (mc_body_v1). The store is registered in mc-sync.js (strategy
   'macros') so it syncs per user with zero extra backend.
   ========================================================================== */
(function () {
  if (window.MCMacros) return;
  var host = document.getElementById('nutritionBody');
  if (!host) return;

  var KEY = 'mc_macros_v1';
  var BODY_KEY = 'mc_body_v1';   // existing bodyweight log, for weight pre-fill

  // macro colors — theme-driven (base.css :root), not hardcoded hex
  var COL = { kcal: 'var(--macro-kcal)', p: 'var(--macro-protein)', f: 'var(--macro-fat)', c: 'var(--macro-carb)' };
  var WD = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  // Companion cookbook (reverse of its "Log to tracker" handoff): the Recipes
  // screen consumes ?mkcal=&mp= and answers with recipes that fit the day.
  var COOKBOOK_URL = 'https://mcross2298.github.io/Mikes-Cookbook/index.html';

  // ---- tiny helpers --------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function pad(n) { return String(n).padStart(2, '0'); }

  // auto-dismissing confirmation with an optional undo action
  function toast(msg, actionLabel, onAction) {
    var t = el('div', 'mc-toast');
    t.appendChild(el('span', 'mc-toast-msg', esc(msg)));
    if (actionLabel) {
      var btn = el('button', 'mc-toast-btn', esc(actionLabel));
      btn.type = 'button';
      btn.addEventListener('click', function () {
        onAction();
        t.classList.remove('show');
        setTimeout(function () { t.remove(); }, 300);
      });
      t.appendChild(btn);
    }
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 5000);
  }

  // ---- date helpers --------------------------------------------------------
  function keyFromDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateFromKey(k) { var p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayKey() { return keyFromDate(new Date()); }
  function addDays(k, n) { var d = dateFromKey(k); d.setDate(d.getDate() + n); return keyFromDate(d); }
  function mondayOf(k) { var d = dateFromKey(k); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return keyFromDate(d); }
  function hourLabel(h) { var ap = h < 12 ? 'AM' : 'PM'; var hh = h % 12; if (hh === 0) hh = 12; return hh + ' ' + ap; }
  function timeLabel(ms) { var d = new Date(ms); var h = d.getHours(); var ap = h < 12 ? 'AM' : 'PM'; var hh = h % 12; if (hh === 0) hh = 12; return hh + ':' + pad(d.getMinutes()) + ' ' + ap; }
  function prettyDay(k) {
    if (k === todayKey()) return 'Today';
    return dateFromKey(k).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // selected day + the slot the next add lands on
  var selKey = todayKey();
  var addSlotMs = null;
  // Empty-hour runs collapse into one tappable strip (see renderTimeline) —
  // remembers which collapsed runs the user has expanded, keyed by the run's
  // first hour, so re-renders (e.g. after logging food) don't snap shut.
  var expandedRuns = {};

  function defaultSlot() {
    if (selKey === todayKey()) return Date.now();
    var d = dateFromKey(selKey); d.setHours(12, 0, 0, 0); return d.getTime();
  }
  function hourSlot(hour) { var d = dateFromKey(selKey); d.setHours(hour, 0, 0, 0); return d.getTime(); }
  function entryHour(e) { return new Date(e.at || e.ts || Date.now()).getHours(); }

  // ---- store ---------------------------------------------------------------
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; }
    catch (e) { return {}; }
  }
  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {}
  }
  function getDay(obj, key) {
    obj.days = obj.days || {};
    if (!obj.days[key]) obj.days[key] = { entries: [] };
    if (!Array.isArray(obj.days[key].entries)) obj.days[key].entries = [];
    return obj.days[key];
  }
  function latestWeightLb() {
    try {
      var a = JSON.parse(localStorage.getItem(BODY_KEY) || '[]') || [];
      for (var i = 0; i < a.length; i++) { var w = num(a[i] && a[i].w); if (w > 0) return Math.round(w); }
    } catch (e) {}
    return 0;
  }

  // Real training load (trailing 7 days) from mc-recap.js's MC_RECAP —
  // mc_workout_log_v1-derived sessions + tonnage, not just a day-count ping —
  // so the macro calculator's Activity level reflects actual training stress,
  // not a one-time guess disconnected from what the user did.
  function weeklyLoadStats() {
    try { return (window.MC_RECAP && MC_RECAP.weeklyStats) ? MC_RECAP.weeklyStats() : null; }
    catch (e) { return null; }
  }
  // A heavy trailing-7-day tonnage is the one signal that can push the
  // suggestion to 'athlete' — a tier the old day-count-only heuristic could
  // never reach, since showing up 6+ days doesn't distinguish a light week
  // from a genuinely brutal one.
  var ATHLETE_TONNAGE_LB = 50000;
  function suggestActivityFromLoad(stats) {
    if (!stats) return null;
    var n = stats.sessions || 0;
    if (n <= 1) return 'sedentary';
    if (n <= 3) return 'light';
    if (n <= 5) return 'moderate';
    if (n >= 6 && stats.tonnage >= ATHLETE_TONNAGE_LB) return 'athlete';
    return 'active';
  }

  // Train-day calorie bonus (Phase 2.2): a flat kcal add-on applied only when
  // rendering *today* and today has a finished, logged workout — the stored
  // mc_macros_v1.goals.kcal itself never changes, so nothing else that reads
  // goals (the calculator, sync, other days' views) needs to know about this.
  var TRAIN_DAY_BONUS_KCAL = 200;
  function trainedToday() {
    try {
      var log = JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]') || [];
      var tk = todayKey();
      return log.some(function (e) { return e.date && keyFromDate(new Date(e.date)) === tk; });
    } catch (e) { return false; }
  }

  // Coarse day-type for today (Phase 2.6 cross-wiring), derived from what was
  // actually logged today — not a schedule prediction. No program here tracks
  // a machine-readable day-of-week -> day-type mapping (the CLAUDE.md
  // archetype table is authoring content, not runtime data), so this reads
  // the majority muscle group among today's *finished* sets instead, via the
  // same catalog-name-lookup technique mc-quick-pump.js uses for its <48h
  // bias — collapsing the catalog's granular muscle strings ('Legs - Quads',
  // 'Legs - Hamstrings', ...) into the coarse push/pull/legs/core buckets the
  // cookbook handoff actually needs.
  var DAY_TYPE_GROUPS = {
    'Chest': 'push', 'Shoulders': 'push', 'Triceps': 'push',
    'Back': 'pull', 'Biceps': 'pull', 'Forearms': 'pull',
    'Legs - Quads': 'legs', 'Legs - Hamstrings': 'legs', 'Legs - Glutes': 'legs', 'Calves': 'legs', 'Adductors': 'legs',
    'Core': 'core'
  };
  function catalogMuscle(name) {
    if (!window.EXERCISES) return null;
    var nl = (name || '').toLowerCase();
    for (var i = 0; i < window.EXERCISES.length; i++) {
      if (window.EXERCISES[i].name.toLowerCase() === nl) return window.EXERCISES[i].muscle;
    }
    return null;
  }
  function todaysDayType() {
    var log;
    try { log = JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]') || []; } catch (e) { log = []; }
    var tk = todayKey();
    var counts = {};
    log.forEach(function (e) {
      if (!e.date || keyFromDate(new Date(e.date)) !== tk) return;
      (e.sets || []).forEach(function (s) {
        var group = DAY_TYPE_GROUPS[catalogMuscle(s.name)];
        if (group) counts[group] = (counts[group] || 0) + 1;
      });
    });
    var best = null, bestN = 0;
    Object.keys(counts).forEach(function (g) { if (counts[g] > bestN) { best = g; bestN = counts[g]; } });
    // require a real majority (3+ sets), not one stray isolation set, before
    // confidently labeling the whole day
    return bestN >= 3 ? best : null;
  }
  function totalsOf(entries) {
    var t = { kcal: 0, p: 0, f: 0, c: 0 };
    (entries || []).forEach(function (e) {
      var q = num(e.qty, 1), per = e.per || {};
      t.kcal += num(per.kcal) * q; t.p += num(per.p) * q; t.f += num(per.f) * q; t.c += num(per.c) * q;
    });
    t.kcal = Math.round(t.kcal); t.p = Math.round(t.p); t.f = Math.round(t.f); t.c = Math.round(t.c);
    return t;
  }

  // ---- Adaptive macro control loop (Phase 2.3) ------------------------------
  // Weekly, deterministic reconcile of the stored goal against what actually
  // happened: logged intake (via mc_macros_v1's own days — only ever created
  // once ≥1 entry is logged, so this can't be thrown off by days the tracker
  // just wasn't opened) vs. a smoothed bodyweight trend (MC_BODY.trend7d())
  // vs. the profile's goal direction. Never silent — always a one-tap
  // Apply/Not now suggestion, same as the plateau/deload and activity hints.
  var NUDGE_KEY = 'mc_macro_nudge_v1';
  var NUDGE_INTERVAL_MS = 7 * 24 * 3600 * 1000;
  var NUDGE_KCAL_STEP = 100;
  var MIN_LOGGED_DAYS = 4;      // of the trailing 7, need at least this many kcal-logged days
  var FLAT_LB = 0.5;            // a cut/bulk week smaller than this (lb) counts as "flat"
  var MAINTAIN_DRIFT_LB = 1.5;  // maintenance drift big enough to flag (more forgiving than a cut/bulk)

  function readNudgeState() {
    try { return JSON.parse(localStorage.getItem(NUDGE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeNudgeState(s) { try { localStorage.setItem(NUDGE_KEY, JSON.stringify(s)); } catch (e) {} }

  // Average kcal actually logged per day over the trailing 7 days, counting
  // only days present in `days` (see the note above — that's a real "the
  // tracker was used" signal, not a coincidental zero).
  function loggedKcalTrend() {
    var data = read();
    var tk = todayKey();
    var sum = 0, n = 0;
    for (var i = 0; i < 7; i++) {
      var k = addDays(tk, -i);
      var day = data.days && data.days[k];
      if (day && day.entries && day.entries.length) { sum += totalsOf(day.entries).kcal; n++; }
    }
    if (n < MIN_LOGGED_DAYS) return null;
    return { avgKcal: Math.round(sum / n), days: n };
  }

  // Returns { delta, why } or null (insufficient data, or reality already
  // matches the goal — nothing worth suggesting).
  function computeMacroNudge(goals, profile) {
    if (!goals || !goals.kcal) return null;
    var kcalTrend = loggedKcalTrend();
    var wTrend = (window.MC_BODY && MC_BODY.trend7d) ? MC_BODY.trend7d() : null;
    if (!kcalTrend || !wTrend) return null;

    var goal = (profile && profile.goal) || 'maintain';
    var compliant = Math.abs(kcalTrend.avgKcal - goals.kcal) <= goals.kcal * 0.1;
    var d = wTrend.deltaLb;

    if (goal === 'cut' && compliant && d >= -FLAT_LB) {
      return { delta: -NUDGE_KCAL_STEP, why: 'Weight has been flat this week even though you’ve been hitting your target.' };
    }
    if (goal === 'bulk' && compliant && d <= FLAT_LB) {
      return { delta: NUDGE_KCAL_STEP, why: 'Weight hasn’t moved this week even though you’ve been hitting your target.' };
    }
    if (goal !== 'cut' && goal !== 'bulk' && compliant && Math.abs(d) >= MAINTAIN_DRIFT_LB) {
      return {
        delta: d > 0 ? -NUDGE_KCAL_STEP : NUDGE_KCAL_STEP,
        why: 'Weight has drifted ' + (d > 0 ? 'up' : 'down') + ' this week on your maintenance target.'
      };
    }
    return null;
  }

  function renderMacroNudge(goals, profile) {
    if (!goals || !goals.kcal || selKey !== todayKey()) return null;
    var state = readNudgeState();
    var now = Date.now();
    var due = !state.lastCheckTs || (now - state.lastCheckTs) >= NUDGE_INTERVAL_MS;
    var suggestion = state.pending || null;

    if (due) {
      suggestion = computeMacroNudge(goals, profile);
      state.lastCheckTs = now;
      state.pending = suggestion;
      writeNudgeState(state);
    }
    if (!suggestion) return null;

    var newKcal = goals.kcal + suggestion.delta;
    var card = el('div', 'ntx-nudge');
    card.innerHTML =
      '<div class="ntx-nudge-txt"><b>Adjust your calorie target?</b>' +
      '<span>' + esc(suggestion.why) + ' Try ' + newKcal + ' kcal (' +
        (suggestion.delta > 0 ? '+' : '') + suggestion.delta + ').</span></div>' +
      '<div class="ntx-nudge-actions">' +
        '<button type="button" class="ntx-nudge-apply">Apply</button>' +
        '<button type="button" class="ntx-nudge-dismiss">Not now</button>' +
      '</div>';
    card.querySelector('.ntx-nudge-apply').onclick = function () {
      var obj = read();
      obj.goals = obj.goals || {};
      obj.goals.kcal = newKcal;
      obj.ts = Date.now();
      write(obj);
      state.pending = null;
      writeNudgeState(state);
      render();
    };
    card.querySelector('.ntx-nudge-dismiss').onclick = function () {
      state.pending = null;
      writeNudgeState(state);
      render();
    };
    return card;
  }

  // most-logged foods first, ties broken by most recent; for quick re-add
  function recentFoods(limit) {
    var days = read().days || {};
    var map = {};
    Object.keys(days).forEach(function (dk) {
      (days[dk].entries || []).forEach(function (e) {
        var key = e.code ? ('c:' + e.code) : ('n:' + String(e.name).toLowerCase());
        var ts = e.ts || e.at || 0;
        var rec = map[key];
        if (!rec) { map[key] = { entry: e, count: 1, lastTs: ts }; }
        else { rec.count++; if (ts > rec.lastTs) { rec.lastTs = ts; rec.entry = e; } }
      });
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) { return b.count - a.count || b.lastTs - a.lastTs; });
    return list.slice(0, limit || 8).map(function (x) { return x.entry; });
  }

  // ====================================================================== //
  //  RENDER                                                                 //
  // ====================================================================== //
  function render() {
    var data = read();
    var goals = data.goals || null;
    var entries = getDay(data, selKey).entries;
    var totals = totalsOf(entries);

    // Train-day bonus only ever applies to today's rendered target — the
    // stored goal is untouched, so yesterday/tomorrow's views, the
    // calculator, and sync all still see the plain baseline.
    var trainBonusApplied = false;
    if (goals && goals.kcal && selKey === todayKey() && trainedToday()) {
      goals = Object.assign({}, goals, { kcal: goals.kcal + TRAIN_DAY_BONUS_KCAL });
      trainBonusApplied = true;
    }

    host.innerHTML = '';
    var root = el('div', 'ntx');
    root.appendChild(renderHead());
    root.appendChild(renderCalendar());
    root.appendChild(renderSummary(totals, goals, trainBonusApplied));
    var planEl = renderPlannedMeals();
    if (planEl) root.appendChild(planEl);
    var nudgeEl = renderMacroNudge(data.goals, data.profile);
    if (nudgeEl) root.appendChild(nudgeEl);
    root.appendChild(renderTrend());
    var recentEl = renderRecent();
    if (recentEl) root.appendChild(recentEl);
    var cookEl = renderCookbookLink(totals, goals);
    if (cookEl) root.appendChild(cookEl);
    root.appendChild(renderFind());
    root.appendChild(renderTimeline(entries));
    host.appendChild(root);
  }

  function renderHead() {
    var head = el('div', 'ntx-head');
    head.appendChild(el('div', 'ntx-head-date', esc(prettyDay(selKey))));
    var actions = el('div', 'ntx-head-actions');
    var today = el('button', 'ntx-ico', '◎'); today.title = 'Jump to today'; today.setAttribute('aria-label', 'Jump to today');
    today.onclick = function () { selKey = todayKey(); render(); };
    var fav = el('button', 'ntx-ico', '★'); fav.title = 'Favorite foods'; fav.setAttribute('aria-label', 'Favorite foods');
    fav.onclick = function () { addSlotMs = defaultSlot(); openFavorites(); };
    var gear = el('button', 'ntx-ico', '⚙'); gear.title = 'Goals'; gear.setAttribute('aria-label', 'Goals');
    gear.onclick = openCalculator;
    actions.appendChild(today); actions.appendChild(fav); actions.appendChild(gear);
    head.appendChild(actions);
    return head;
  }

  function renderCalendar() {
    var cal = el('div', 'ntx-cal');
    var prev = el('button', 'ntx-cal-nav', '‹'); prev.setAttribute('aria-label', 'Previous week');
    prev.onclick = function () { selKey = addDays(selKey, -7); render(); };
    var next = el('button', 'ntx-cal-nav', '›'); next.setAttribute('aria-label', 'Next week');
    next.onclick = function () { selKey = addDays(selKey, 7); render(); };
    var days = el('div', 'ntx-cal-days');
    var start = mondayOf(selKey), tk = todayKey();
    for (var i = 0; i < 7; i++) {
      (function (k) {
        var d = dateFromKey(k);
        var hasEntries = getDay(read(), k).entries.length > 0;
        var cls = 'ntx-day' + (k === selKey ? ' sel' : '') + (k === tk ? ' today' : '') + (hasEntries ? ' has' : '');
        var cell = el('div', cls,
          '<div class="ntx-day-wd">' + WD[(d.getDay() + 6) % 7] + '</div>' +
          '<div class="ntx-day-num">' + d.getDate() + '</div>' +
          '<div class="ntx-day-dot"></div>');
        cell.onclick = function () { selKey = k; render(); };
        days.appendChild(cell);
      })(addDays(start, i));
    }
    cal.appendChild(prev); cal.appendChild(days); cal.appendChild(next);
    return cal;
  }

  function renderSummary(totals, goals, trainBonusApplied) {
    var sum = el('div', 'ntx-sum');
    sum.title = 'Edit goals';
    var row = el('div', 'ntx-sum-row');
    var metrics = el('div', 'ntx-sum-metrics');
    metrics.appendChild(metric('🔥', totals.kcal, goals && goals.kcal, COL.kcal, true));
    metrics.appendChild(metric('P', totals.p, goals && goals.p, COL.p, false));
    metrics.appendChild(metric('F', totals.f, goals && goals.f, COL.f, false));
    metrics.appendChild(metric('C', totals.c, goals && goals.c, COL.c, false));
    row.appendChild(metrics);
    row.appendChild(el('div', 'ntx-sum-exp', '›'));
    sum.appendChild(row);
    if (trainBonusApplied) {
      sum.appendChild(el('div', 'ntx-train-bonus', '💪 +' + TRAIN_DAY_BONUS_KCAL + ' kcal today — you trained'));
    }
    sum.onclick = openCalculator;
    return sum;
  }

  function metric(ic, have, goal, color, isCal) {
    var pct = goal ? Math.min(100, Math.round((have / goal) * 100)) : 0;
    var over = goal && have > goal;
    var m = el('div', 'ntx-met');
    m.innerHTML =
      '<div class="ntx-met-top">' +
        '<span class="ntx-met-ic" style="color:' + color + '">' + ic + '</span>' +
        '<span class="ntx-met-val">' + have + '</span>' +
        '<span class="ntx-met-goal">/' + (goal || '—') + '</span>' +
      '</div>' +
      '<div class="ntx-met-track"><div class="ntx-met-fill" style="width:' + pct + '%;background:' + (over ? '#f87171' : color) + '"></div></div>';
    return m;
  }

  // "Cook to hit your remaining macros" — deep-links today's remaining
  // kcal/protein into the cookbook's Recipes screen. Today only (remaining
  // macros mean nothing on a past/future day) and only while ≥100 kcal is
  // still unlogged, so a finished day doesn't nag.
  function renderCookbookLink(totals, goals) {
    if (!goals || !goals.kcal || selKey !== todayKey()) return null;
    var kcalLeft = Math.round(goals.kcal - totals.kcal);
    if (kcalLeft < 100) return null;
    var pLeft = Math.max(0, Math.round(num(goals.p) - totals.p));
    var dt = todaysDayType();
    var a = el('a', 'ntx-cook',
      '<span class="ntx-cook-ic">🍳</span>' +
      '<span class="ntx-cook-txt"><b>Cook to hit your remaining macros</b>' +
      '<span>' + kcalLeft + ' kcal' + (pLeft ? ' · ' + pLeft + ' g protein' : '') + ' left — find a recipe in the cookbook</span></span>' +
      '<span class="ntx-cook-arr">›</span>');
    a.href = COOKBOOK_URL + '?mkcal=' + kcalLeft + '&mp=' + pLeft + (dt ? '&dt=' + dt : '') + '#recipes';
    return a;
  }

  // ---- planned meals (cookbook->workout bridge, roadmap B1) ----------------
  // Reads MCBridge.todaysMeals() — meals the trainee planned in Mike's
  // Cookbook for today, pulled read-only via mc-sync.js. Only shown while
  // viewing today (selKey === todayKey()): the bridge always answers for the
  // real calendar day, so showing it under a past/future selKey would mismatch
  // what's on screen. Never writes to mc-cookbook:mealplan (cookbook-owned) —
  // logging a meal only ever writes a normal entry into THIS store.
  function plannedLoggedEntry(dayObj, uid) {
    var entries = dayObj.entries || [];
    for (var i = 0; i < entries.length; i++) if (entries[i].planUid === uid) return entries[i];
    return null;
  }
  function renderPlannedMealRow(m, dayObj) {
    var row = el('div', 'ntx-plan-row');
    row.appendChild(el('span', 'ntx-plan-ic', esc(m.icon || '🍽')));
    var info = el('div', 'ntx-plan-info');
    info.appendChild(el('div', 'ntx-plan-name', esc(m.title || 'Planned meal')));
    var mac = m.macros;
    var subParts = [];
    if (m.slot) subParts.push(m.slot);
    if (mac && mac.kcal) subParts.push(Math.round(mac.kcal) + ' kcal' + (mac.p ? ' · ' + Math.round(mac.p) + 'g protein' : ''));
    info.appendChild(el('div', 'ntx-plan-sub', esc(subParts.join(' · '))));
    row.appendChild(info);

    var logged = plannedLoggedEntry(dayObj, m.uid);
    var btn = el('button', 'ntx-plan-log' + (logged ? ' done' : ''), logged ? '✓ Logged' : 'Log');
    btn.type = 'button';
    if (logged) { btn.disabled = true; }
    else if (!mac || !mac.kcal) { btn.disabled = true; btn.title = 'No macro data for this recipe yet'; }
    else {
      btn.onclick = function () {
        addSlotMs = defaultSlot();
        addEntry({
          name: m.title || 'Planned meal', source: 'plannedMeal', unit: 'serving', qty: 1,
          per: { kcal: mac.kcal, p: mac.p, f: mac.f, c: mac.c }, planUid: m.uid
        });
        render();
        toast((m.title || 'Meal') + ' logged', 'Undo', function () {
          var obj = read(), d = getDay(obj, todayKey());
          d.entries = d.entries.filter(function (e) { return e.planUid !== m.uid; });
          write(obj); render();
        });
      };
    }
    row.appendChild(btn);
    return row;
  }
  function renderPlannedMeals() {
    if (selKey !== todayKey() || !window.MCBridge) return null;
    var meals = MCBridge.todaysMeals();
    var signedIn = false;
    try { signedIn = !!(window.MC_SYNC && MC_SYNC.status().signedIn); } catch (e) {}

    var card = el('div', 'ntx-plan');
    var head = el('div', 'ntx-plan-h');
    head.appendChild(el('span', 'ntx-plan-h-ic', '🍽'));
    head.appendChild(el('span', null, "Today's Planned Meals"));
    card.appendChild(head);

    if (!meals.length) {
      var empty = el('div', 'empty-state');
      empty.appendChild(el('div', 'empty-icon', '🍽'));
      if (signedIn) {
        empty.appendChild(el('div', 'empty-text', 'No meals planned for today'));
        empty.appendChild(el('div', 'empty-sub', "Build your week in Mike's Cookbook and it'll show up here"));
      } else {
        empty.appendChild(el('div', 'empty-text', "Sign in to see today's planned meals"));
        empty.appendChild(el('div', 'empty-sub', "Plan your week in Mike's Cookbook, then sign in here to link them"));
      }
      card.appendChild(empty);
      return card;
    }

    var goals = read().goals;
    if (goals && goals.kcal) {
      var totals = meals.reduce(function (acc, m) {
        var mac = m.macros || {};
        acc.kcal += num(mac.kcal); acc.p += num(mac.p);
        return acc;
      }, { kcal: 0, p: 0 });
      card.appendChild(el('div', 'ntx-plan-target',
        'Planned: ' + Math.round(totals.kcal) + ' / ' + goals.kcal + ' kcal' +
        (goals.p ? ' · ' + Math.round(totals.p) + ' / ' + goals.p + 'g protein' : '')));
    }

    var dayObj = getDay(read(), todayKey());
    var list = el('div', 'ntx-plan-list');
    meals.forEach(function (m) { list.appendChild(renderPlannedMealRow(m, dayObj)); });
    card.appendChild(list);
    return card;
  }

  function renderTrend() {
    var card = el('div', 'ntx-trend');
    if (!window.MC_CHART) return card;
    var data = read(), tk = todayKey();
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var k = addDays(tk, -i);
      var d = dateFromKey(k);
      days.push({ key: k, label: WD[(d.getDay() + 6) % 7], value: totalsOf(getDay(data, k).entries).kcal });
    }
    var hi = -1;
    days.forEach(function (d, i) { if (d.key === selKey) hi = i; });
    card.innerHTML =
      '<div class="ntx-trend-h">Last 7 days · calories</div>' +
      MC_CHART.bars(days.map(function (d) { return { label: d.label, value: d.value }; }), { height: 56, highlight: hi, color: COL.kcal });
    return card;
  }

  function renderRecent() {
    var recents = recentFoods(8);
    if (!recents.length) return null;
    var wrap = el('div', 'ntx-recent');
    wrap.appendChild(el('div', 'ntx-recent-h', 'Recent & Frequent'));
    var row = el('div', 'ntx-recent-row');
    recents.forEach(function (e) {
      var per = e.per || {};
      var chip = el('button', 'ntx-recent-chip');
      chip.innerHTML =
        '<div class="ntx-recent-name">' + esc(e.name) + '</div>' +
        '<div class="ntx-recent-kcal">' + Math.round(num(per.kcal)) + ' kcal</div>';
      chip.onclick = function () { addSlotMs = defaultSlot(); openFacts(foodFromEntry(e), {}); };
      row.appendChild(chip);
    });
    wrap.appendChild(row);
    return wrap;
  }

  function renderFind() {
    var bar = el('div', 'ntx-find');
    bar.appendChild(el('span', 'ntx-find-ic', '🔍'));
    var txt = el('button', 'ntx-find-txt', 'Search food database');
    txt.onclick = function () { addSlotMs = defaultSlot(); openSearch(); };
    bar.appendChild(txt);
    if (window.MCBarcode && MCBarcode.supported()) {
      var scan = el('button', 'ntx-find-scan', '▦'); scan.title = 'Scan barcode'; scan.setAttribute('aria-label', 'Scan barcode');
      scan.onclick = function () { addSlotMs = defaultSlot(); openScan(); };
      bar.appendChild(scan);
    }
    return bar;
  }

  // One real hour row: rail (label + add button) + any logged food cards.
  function hourRow(h, list, nowHour) {
    var row = el('div', 'ntx-hr' + (list.length ? ' has' : '') + (h === nowHour ? ' now' : ''));
    var rail = el('div', 'ntx-hr-rail');
    rail.appendChild(el('div', 'ntx-hr-lbl', hourLabel(h)));
    var add = el('button', 'ntx-hr-add', '+'); add.setAttribute('aria-label', 'Add food at ' + hourLabel(h));
    add.onclick = function () { openHourAdd(h); };
    rail.appendChild(add);
    row.appendChild(rail);

    var body = el('div', 'ntx-hr-body');
    list.forEach(function (e) {
      var q = num(e.qty, 1), per = e.per || {};
      var card = el('div', 'ntx-fcard');
      card.innerHTML =
        '<div class="ntx-fcard-top">' +
          '<div class="ntx-fcard-name">' + esc(e.name) + (q !== 1 ? ' ×' + q : '') + '</div>' +
          '<div class="ntx-fcard-time">' + timeLabel(e.at || e.ts || Date.now()) + '</div>' +
        '</div>' +
        '<div class="ntx-fcard-macros">' +
          '<b style="color:' + COL.kcal + '">🔥' + Math.round(num(per.kcal) * q) + '</b>  ' +
          'P ' + Math.round(num(per.p) * q) + '  F ' + Math.round(num(per.f) * q) + '  C ' + Math.round(num(per.c) * q) +
        '</div>';
      card.onclick = function () { openFacts(foodFromEntry(e), { entryId: e.id, qty: num(e.qty, 1) }); };
      body.appendChild(card);
    });
    row.appendChild(body);
    return row;
  }

  function renderTimeline(entries) {
    // bucket entries by hour
    var byHour = {};
    (entries || []).forEach(function (e) { (byHour[entryHour(e)] = byHour[entryHour(e)] || []).push(e); });
    Object.keys(byHour).forEach(function (h) {
      byHour[h].sort(function (a, b) { return (a.at || a.ts || 0) - (b.at || b.ts || 0); });
    });

    var nowHour = (selKey === todayKey()) ? new Date().getHours() : -1;
    // Once a run is expanded, every hour it originally covered renders
    // individually forever (not just its first hour) — otherwise expanding
    // just reveals hour 1 and immediately re-collapses hours 2+ into a new
    // strip, since the run-detection below would treat them as a fresh run.
    function isExpandedHour(h) {
      return Object.keys(expandedRuns).some(function (startKey) {
        var range = expandedRuns[startKey];
        return h >= range.start && h <= range.end;
      });
    }
    var time = el('div', 'ntx-time');
    var h = 0;
    while (h < 24) {
      var list = byHour[h] || [];
      // A run of 3+ consecutive empty hours (never including "now", so the
      // current hour is always visible on its own) collapses into one
      // tappable strip instead of an unbroken wall of empty + buttons.
      if (!list.length && h !== nowHour && !isExpandedHour(h)) {
        var runStart = h, runEnd = h;
        while (runEnd + 1 < 24 && !(byHour[runEnd + 1] || []).length &&
               runEnd + 1 !== nowHour && !isExpandedHour(runEnd + 1)) runEnd++;
        var runLen = runEnd - runStart + 1;
        if (runLen >= 3) {
          (function (start, end) {
            var strip = el('div', 'ntx-hr-collapsed');
            strip.setAttribute('role', 'button');
            strip.tabIndex = 0;
            var label = hourLabel(start) + ' – ' + hourLabel(end) + ' · nothing logged';
            strip.textContent = label + '  ▸';
            function expand() { expandedRuns[start] = { start: start, end: end }; render(); }
            strip.onclick = expand;
            strip.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand(); } };
            time.appendChild(strip);
          })(runStart, runEnd);
          h = runEnd + 1;
          continue;
        }
      }
      time.appendChild(hourRow(h, list, nowHour));
      h++;
    }
    return time;
  }

  // ====================================================================== //
  //  SHEETS (bottom-sheet overlay)                                          //
  // ====================================================================== //
  function sheet(title, sub) {
    var ov = el('div', 'nt-overlay');
    var sh = el('div', 'nt-sheet');
    var handle = el('div', 'nt-handle');
    sh.appendChild(handle);
    sh.appendChild(el('div', 'nt-sheet-title', esc(title)));
    if (sub) sh.appendChild(el('div', 'nt-sheet-sub', esc(sub)));
    ov.appendChild(sh);
    ov.addEventListener('click', function (ev) { if (ev.target === ov) close(); });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    function close() { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 200); }

    // swipe-down to dismiss on the drag handle
    var startY = 0;
    handle.addEventListener('touchstart', function (e) {
      startY = e.touches[0].clientY;
      sh.style.transition = 'none';
    }, { passive: true });
    handle.addEventListener('touchmove', function (e) {
      var delta = e.touches[0].clientY - startY;
      if (delta > 0 && sh.scrollTop === 0) {
        sh.style.transform = 'translateY(' + delta + 'px)';
      }
    }, { passive: true });
    handle.addEventListener('touchend', function (e) {
      var delta = e.changedTouches[0].clientY - startY;
      sh.style.transition = '';
      if (delta >= 50) {
        close();
      } else {
        sh.style.transform = '';
      }
    });
    handle.addEventListener('click', function () { close(); });

    return { ov: ov, sh: sh, close: close };
  }

  function stepper(label, value, step, min, onChange) {
    var row = el('div', 'nt-step');
    row.innerHTML = '<div class="nt-step-lbl">' + esc(label) + '</div>';
    var ctl = el('div', 'nt-step-ctl');
    var minus = el('button', 'nt-step-btn', '−'); minus.setAttribute('aria-label', 'Decrease ' + label);
    var val = el('div', 'nt-step-val', String(value));
    var plus = el('button', 'nt-step-btn', '+'); plus.setAttribute('aria-label', 'Increase ' + label);
    function set(v) { v = Math.max(min, Math.round(v)); val.textContent = String(v); onChange(v); }
    minus.onclick = function () { set(num(val.textContent) - step); };
    plus.onclick = function () { set(num(val.textContent) + step); };
    ctl.appendChild(minus); ctl.appendChild(val); ctl.appendChild(plus);
    row.appendChild(ctl);
    row.setVal = function (v) { val.textContent = String(Math.round(v)); };
    return row;
  }

  // ---- per-hour add chooser ------------------------------------------------
  function openHourAdd(hour) {
    addSlotMs = hourSlot(hour);
    var s = sheet('Add food · ' + hourLabel(hour), prettyDay(selKey));
    var w = el('div', 'nt-actions-wrap');
    if (window.MCBarcode && MCBarcode.supported()) {
      var b1 = el('button', 'nt-btn nt-btn-gold', '📷 Scan barcode');
      b1.onclick = function () { s.close(); openScan(); };
      w.appendChild(b1);
    }
    var row = el('div', 'nt-actions');
    var b2 = el('button', 'nt-btn', '🔍 Search');
    b2.onclick = function () { s.close(); openSearch(); };
    var b3 = el('button', 'nt-btn', '✏️ Manual');
    b3.onclick = function () { s.close(); openManual(); };
    row.appendChild(b2); row.appendChild(b3);
    w.appendChild(row);
    var b4 = el('button', 'nt-btn nt-btn-describe', '💬 Describe what you ate');
    b4.onclick = function () { s.close(); openDescribe(); };
    w.appendChild(b4);
    s.sh.appendChild(w);
  }

  // ---- calculator sheet ----------------------------------------------------
  function openCalculator() {
    var data = read();
    var p = data.profile || {};
    var s = sheet('Macro calculator', 'Suggested from your stats — adjust to taste.');

    var ftStart = p.heightCm ? Math.floor((p.heightCm / 2.54) / 12) : 5;
    var inStart = p.heightCm ? Math.round((p.heightCm / 2.54) % 12) : 10;

    var form = el('div', 'nt-form');
    form.innerHTML =
      '<div class="nt-seg" id="ntSex">' +
        '<button data-v="male" class="' + (p.sex !== 'female' ? 'on' : '') + '">Male</button>' +
        '<button data-v="female" class="' + (p.sex === 'female' ? 'on' : '') + '">Female</button>' +
      '</div>' +
      '<div class="nt-grid2">' +
        '<label class="nt-field"><span>Age</span><input id="ntAge" type="number" inputmode="numeric" value="' + (p.age || '') + '" placeholder="30"></label>' +
        '<label class="nt-field"><span>Weight (lb)</span><input id="ntWt" type="number" inputmode="decimal" value="' + (p.weightLb || latestWeightLb() || '') + '" placeholder="180"></label>' +
      '</div>' +
      '<div class="nt-grid2">' +
        '<label class="nt-field"><span>Height (ft)</span><input id="ntFt" type="number" inputmode="numeric" value="' + ftStart + '"></label>' +
        '<label class="nt-field"><span>Height (in)</span><input id="ntIn" type="number" inputmode="numeric" value="' + inStart + '"></label>' +
      '</div>' +
      '<label class="nt-field"><span>Activity</span><select id="ntAct">' +
        MCMacroCalc.ACTIVITY.map(function (a) { return '<option value="' + a.id + '"' + (p.activity === a.id ? ' selected' : '') + '>' + a.label + ' — ' + a.sub + '</option>'; }).join('') +
      '</select></label>' +
      '<div class="nt-act-hint" id="ntActHint"></div>' +
      '<div class="nt-seg nt-seg-3" id="ntGoal">' +
        MCMacroCalc.GOALS.map(function (g) { return '<button data-v="' + g.id + '" class="' + (p.goal === g.id ? 'on' : '') + '">' + g.label + '</button>'; }).join('') +
      '</div>';
    s.sh.appendChild(form);

    // Nudge the Activity field toward what the user actually trained this
    // week (real sessions + tonnage from mc-recap.js) instead of leaving it
    // a static guess.
    (function () {
      var stats = weeklyLoadStats();
      var suggested = suggestActivityFromLoad(stats);
      var hintEl = $('#ntActHint', s.sh);
      if (!hintEl || !stats) return;
      var n = stats.sessions;
      var current = p.activity || 'sedentary';
      if (suggested && suggested !== current) {
        var label = MCMacroCalc.ACTIVITY.filter(function (a) { return a.id === suggested; })[0];
        hintEl.innerHTML = 'Logged ' + n + ' session' + (n === 1 ? '' : 's') + ' this week — ' +
          '<button type="button" class="nt-act-apply" id="ntActApply">use "' + (label ? label.label : suggested) + '"</button>';
        $('#ntActApply', hintEl).onclick = function () {
          $('#ntAct', s.sh).value = suggested;
          hintEl.textContent = 'Set to match your last 7 days of training (' + n + ' session' + (n === 1 ? '' : 's') + ').';
        };
      } else {
        hintEl.textContent = 'Matches your last 7 days of training (' + n + ' session' + (n === 1 ? '' : 's') + ').';
      }
    }());

    function seg(id, fallback) {
      var box = $('#' + id, s.sh);
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      return function () { var on = box.querySelector('button.on'); return on ? on.getAttribute('data-v') : fallback; };
    }
    var getSex = seg('ntSex', 'male');
    var getGoal = seg('ntGoal', 'maintain');

    function readProfile() {
      var ft = num($('#ntFt', s.sh).value), inch = num($('#ntIn', s.sh).value);
      return {
        sex: getSex(),
        age: num($('#ntAge', s.sh).value),
        heightCm: Math.round((ft * 12 + inch) * 2.54),
        weightLb: num($('#ntWt', s.sh).value),
        activity: $('#ntAct', s.sh).value,
        goal: getGoal()
      };
    }

    var calcBtn = el('button', 'nt-btn nt-btn-gold', 'Calculate suggested macros');
    s.sh.appendChild(calcBtn);

    var adjust = el('div', 'nt-adjust');
    adjust.style.display = 'none';
    s.sh.appendChild(adjust);

    var cur = data.goals ? { kcal: data.goals.kcal, p: data.goals.p, f: data.goals.f, c: data.goals.c } : null;
    var profSnapshot = null;
    var kcalStep, pStep, fStep, cStep, summary;

    function buildAdjust() {
      adjust.innerHTML = '';
      adjust.appendChild(el('div', 'nt-adjust-head', 'Fine-tune your targets'));
      summary = el('div', 'nt-calsum');
      adjust.appendChild(summary);

      kcalStep = stepper('Calories', cur.kcal, 50, 0, function (v) {
        cur.kcal = v;
        var sp = MCMacroCalc.splitFromCalories(v, profSnapshot.weightLb, profSnapshot.goal);
        cur.p = sp.p; cur.f = sp.f; cur.c = sp.c;
        pStep.setVal(cur.p); fStep.setVal(cur.f); cStep.setVal(cur.c);
        refreshSummary();
      });
      pStep = stepper('Protein (g)', cur.p, 5, 0, function (v) { cur.p = v; cur.kcal = MCMacroCalc.kcalFromMacros(cur.p, cur.f, cur.c); kcalStep.setVal(cur.kcal); refreshSummary(); });
      fStep = stepper('Fat (g)', cur.f, 5, 0, function (v) { cur.f = v; cur.kcal = MCMacroCalc.kcalFromMacros(cur.p, cur.f, cur.c); kcalStep.setVal(cur.kcal); refreshSummary(); });
      cStep = stepper('Carbs (g)', cur.c, 5, 0, function (v) { cur.c = v; cur.kcal = MCMacroCalc.kcalFromMacros(cur.p, cur.f, cur.c); kcalStep.setVal(cur.kcal); refreshSummary(); });
      adjust.appendChild(kcalStep); adjust.appendChild(pStep); adjust.appendChild(fStep); adjust.appendChild(cStep);

      var save = el('button', 'nt-btn nt-btn-gold', 'Save as my goals');
      save.onclick = function () {
        var obj = read();
        obj.v = 1; obj.ts = Date.now();
        obj.profile = profSnapshot;
        obj.goals = { kcal: cur.kcal, p: cur.p, f: cur.f, c: cur.c };
        write(obj);
        s.close(); render();
      };
      adjust.appendChild(save);
      refreshSummary();
    }

    function refreshSummary() {
      var pc = MCMacroCalc.macroPercents(cur.p, cur.f, cur.c);
      summary.innerHTML =
        '<span class="nt-calsum-k">' + cur.kcal + ' kcal</span>' +
        '<span class="nt-calsum-split">' + pc.p + 'P / ' + pc.f + 'F / ' + pc.c + 'C</span>';
    }

    calcBtn.onclick = function () {
      profSnapshot = readProfile();
      if (!profSnapshot.weightLb || !profSnapshot.age || !profSnapshot.heightCm) {
        calcBtn.textContent = 'Enter age, height & weight first';
        setTimeout(function () { calcBtn.textContent = 'Calculate suggested macros'; }, 1800);
        return;
      }
      var rec = MCMacroCalc.recommend(profSnapshot);
      cur = { kcal: rec.kcal, p: rec.p, f: rec.f, c: rec.c };
      calcBtn.textContent = 'Recalculate';
      buildAdjust();
      adjust.style.display = 'block';
      adjust.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    if (cur) { profSnapshot = data.profile || readProfile(); calcBtn.textContent = 'Recalculate'; buildAdjust(); adjust.style.display = 'block'; }
  }

  // ---- search sheet --------------------------------------------------------
  function queryTokens(q) { return q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean); }

  function tokenFilter(items, q) {
    var tokens = queryTokens(q);
    if (tokens.length <= 1) return items;
    var threshold = tokens.length >= 4 ? tokens.length : Math.ceil(tokens.length / 2);
    var scored = items.map(function (it) {
      var hay = ((it.name || '') + ' ' + (it.brand || '')).toLowerCase();
      var score = tokens.filter(function (t) { return hay.indexOf(t) >= 0; }).length;
      return { item: it, score: score };
    }).filter(function (x) { return x.score >= threshold; });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (x) { return x.item; });
  }

  // edit distance — typo-tolerant fallback when substring matching finds nothing
  function levenshtein(a, b) {
    a = a || ''; b = b || '';
    var m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      cur[0] = i;
      for (var j2 = 1; j2 <= n; j2++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j2 - 1) ? 0 : 1;
        cur[j2] = Math.min(prev[j2] + 1, cur[j2 - 1] + 1, prev[j2 - 1] + cost);
      }
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }
  function fuzzyTokenMatch(hay, token) {
    var maxDist = token.length <= 4 ? 1 : (token.length <= 8 ? 2 : 3);
    var words = hay.split(/\s+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) { if (levenshtein(words[i], token) <= maxDist) return true; }
    return false;
  }
  function fuzzyFilter(items, tokens) {
    var threshold = tokens.length >= 4 ? tokens.length : Math.ceil(tokens.length / 2);
    var scored = items.map(function (it) {
      var hay = ((it.name || '') + ' ' + (it.brand || '')).toLowerCase();
      var score = tokens.filter(function (t) { return hay.indexOf(t) >= 0 || fuzzyTokenMatch(hay, t); }).length;
      return { item: it, score: score };
    }).filter(function (x) { return x.score >= threshold; });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (x) { return x.item; });
  }

  function openSearch() {
    var s = sheet('Search foods', 'Powered by Open Food Facts.');
    var input = el('input', 'nt-input');
    input.type = 'search'; input.placeholder = 'e.g. "chobani yogurt", "rxbar"…';
    s.sh.appendChild(input);
    var results = el('div', 'nt-results');
    s.sh.appendChild(results);

    function showEmpty() {
      results.innerHTML = '<div class="nt-results-msg">🔍 Type at least 2 characters to search the food database.</div>';
    }
    showEmpty();

    var timer = null;
    function run() {
      var q = input.value.trim();
      if (q.length < 2) { showEmpty(); return; }
      results.innerHTML = '<div class="nt-results-msg">Searching…</div>';
      MCFoodAPI.search(q).then(function (items) {
        var tokens = queryTokens(q);
        var filtered = tokenFilter(items, q);
        if (!filtered.length && items.length && tokens.length > 1) {
          filtered = fuzzyFilter(items, tokens);
        }
        if (!filtered.length) {
          // items.networkError (set by mc-foodapi.js when both the
          // aggregator and the direct-OFF retry failed) means this is a
          // connectivity problem, not a real zero-match search — a
          // "no matches" message is actively misleading on flaky gym/
          // kitchen Wi-Fi, since the food may well exist.
          var msg = items.networkError
            ? "Can't reach the food database — check your connection or add it manually."
            : (items.length && tokens.length > 1
                ? 'No exact matches — try fewer keywords.'
                : 'No matches. Try a different term or add it manually.');
          results.innerHTML = '<div class="nt-results-msg">' + esc(msg) + '</div>';
          return;
        }
        results.innerHTML = '';
        filtered.forEach(function (it) {
          var row = el('div', 'nt-result');
          row.innerHTML =
            '<div class="nt-result-main">' +
              '<div class="nt-result-name">' + esc(it.name) + '</div>' +
              '<div class="nt-result-sub">' + (it.brand ? esc(it.brand) + ' · ' : '') + 'per ' + esc(it.servingLabel) + '</div>' +
            '</div>' +
            '<div class="nt-result-kcal">' + it.kcal + '<span>kcal</span></div>';
          row.onclick = function () { s.close(); openFacts(foodFromItem(it), {}); };
          results.appendChild(row);
        });
      });
    }
    input.addEventListener('input', function () {
      clearTimeout(timer);
      if (!input.value.trim()) { showEmpty(); return; }
      timer = setTimeout(run, 350);
    });
    setTimeout(function () { input.focus(); }, 250);
  }

  // ---- natural-language describe flow (roadmap 4.2) -------------------------
  // Free text -> parse-food (extracts {query,qty,unit} only, no macros) ->
  // each query runs through the same search() used everywhere else, so the
  // logged macros are always real database numbers, never LLM-invented ones.
  function openDescribe() {
    var s = sheet('Describe what you ate', 'e.g. "two eggs and a slice of toast with butter"');
    var wrap = el('div', 'nt-describe-wrap');
    var input = el('textarea', 'nt-input nt-describe-input');
    input.placeholder = 'Type naturally — I’ll find the foods.';
    input.rows = 2;
    wrap.appendChild(input);
    var go = el('button', 'nt-btn nt-btn-gold', 'Find foods');
    wrap.appendChild(go);
    var results = el('div', 'nt-describe-results');
    wrap.appendChild(results);
    s.sh.appendChild(wrap);

    function matchAndRender(items) {
      results.innerHTML = '<div class="nt-results-msg">Matching foods…</div>';
      Promise.all(items.map(function (it) {
        return MCFoodAPI.search(it.query).then(function (matches) { return { parsed: it, match: (matches && matches[0]) || null }; });
      })).then(renderRows);
    }

    function renderRows(rows) {
      results.innerHTML = '';
      var rowState = [];
      rows.forEach(function (r) {
        var row = el('div', 'nt-describe-row');
        if (!r.match) {
          row.innerHTML =
            '<div class="nt-describe-main">' +
              '<div class="nt-describe-name">' + esc(r.parsed.query) + '</div>' +
              '<div class="nt-describe-sub">No match found</div>' +
            '</div>';
          var manualBtn = el('button', 'nt-btn nt-describe-manual', 'Add manually');
          manualBtn.onclick = function () { s.close(); openManual({ name: r.parsed.query }); };
          row.appendChild(manualBtn);
          results.appendChild(row);
          return;
        }
        var qty = r.parsed.qty || 1;
        var check = el('input', 'nt-describe-check');
        check.type = 'checkbox'; check.checked = true;
        check.setAttribute('aria-label', 'Include ' + r.match.name);
        var main = el('div', 'nt-describe-main');
        function subText() { return qty + ' ' + r.parsed.unit + ' · ' + Math.round(r.match.kcal * qty) + ' kcal'; }
        main.innerHTML = '<div class="nt-describe-name">' + esc(r.match.name) + '</div>' +
          '<div class="nt-describe-sub">' + esc(subText()) + '</div>';
        row.appendChild(check);
        row.appendChild(main);
        var ctl = el('div', 'nt-describe-ctl');
        var minus = el('button', 'nt-describe-ctlbtn', '−'); minus.setAttribute('aria-label', 'Decrease quantity');
        var val = el('div', 'nt-describe-ctlval', String(qty));
        var plus = el('button', 'nt-describe-ctlbtn', '+'); plus.setAttribute('aria-label', 'Increase quantity');
        function setQty(v) {
          qty = Math.max(1, Math.round(v));
          val.textContent = String(qty);
          var sub = $('.nt-describe-sub', main);
          if (sub) sub.textContent = subText();
        }
        minus.onclick = function () { setQty(qty - 1); };
        plus.onclick = function () { setQty(qty + 1); };
        ctl.appendChild(minus); ctl.appendChild(val); ctl.appendChild(plus);
        row.appendChild(ctl);
        results.appendChild(row);
        rowState.push({ check: check, match: r.match, getQty: function () { return qty; } });
      });
      if (rowState.length) {
        var addBtn = el('button', 'nt-btn nt-btn-gold nt-describe-add', 'Log checked foods');
        addBtn.onclick = function () {
          rowState.forEach(function (rs) {
            if (!rs.check.checked) return;
            var food = foodFromItem(rs.match);
            addEntry({ name: food.name, source: 'nl', unit: food.basis, qty: rs.getQty(),
              per: food.per, nutr: food.nutr, grams: food.grams, code: food.code });
          });
          s.close(); render();
        };
        results.appendChild(addBtn);
      }
    }

    go.onclick = function () {
      var text = input.value.trim();
      if (!text) return;
      go.disabled = true; go.textContent = 'Finding…';
      results.innerHTML = '';
      var parseFn = (window.MCFoodAPI && MCFoodAPI.parse) ? MCFoodAPI.parse(text) : Promise.resolve([]);
      parseFn.then(function (items) {
        go.disabled = false; go.textContent = 'Find foods';
        if (!items.length) {
          results.innerHTML = '<div class="nt-results-msg">Couldn’t make sense of that — try Search or Manual instead.</div>';
          return;
        }
        matchAndRender(items);
      });
    };
    setTimeout(function () { input.focus(); }, 250);
  }

  // ---- barcode scan flow ---------------------------------------------------
  function openScan() {
    if (!(window.MCBarcode && MCBarcode.supported())) { openManual(); return; }
    MCBarcode.scan().then(function (code) {
      if (!code) return;
      var s = sheet('Looking up…', 'Barcode ' + code);
      MCFoodAPI.lookup(code).then(function (it) {
        s.close();
        if (it) {
          openFacts(foodFromItem({ name: it.name, brand: it.brand, basis: it.basis, servingLabel: it.servingLabel, grams: it.grams, kcal: it.kcal, p: it.p, f: it.f, c: it.c, nutr: it.nutr, source: 'barcode', code: it.code }), {});
        } else {
          openManual({ source: 'barcode', note: 'No match for barcode ' + code + '. Enter its macros manually.' });
        }
      }).catch(function () { s.close(); openManual({ source: 'barcode', note: 'Lookup failed (offline?). Enter macros manually.' }); });
    }).catch(function (err) {
      var s = sheet('Scanner unavailable', (err && err.message) || 'Could not open the scanner.');
      var ok = el('button', 'nt-btn nt-btn-gold', 'OK');
      ok.onclick = function () { s.close(); };
      s.sh.appendChild(ok);
    });
  }

  // ---- manual entry sheet --------------------------------------------------
  function openManual(prefill) {
    prefill = prefill || {};
    var s = sheet('Manual entry', prefill.note || ('Adding to ' + prettyDay(selKey) + ' · ' + timeLabel(addSlotMs || defaultSlot())));
    var form = el('div', 'nt-form');
    form.innerHTML =
      '<label class="nt-field"><span>Food name</span><input id="mName" type="text" value="' + esc(prefill.name || '') + '" placeholder="Ribeye steak"></label>' +
      '<div class="nt-grid2">' +
        '<label class="nt-field"><span>Calories</span><input id="mK" type="number" inputmode="numeric" value="' + (prefill.kcal != null ? esc(prefill.kcal) : '') + '"></label>' +
        '<label class="nt-field"><span>Servings</span><input id="mQ" type="number" inputmode="decimal" value="' + (prefill.qty || 1) + '"></label>' +
      '</div>' +
      '<div class="nt-grid3">' +
        '<label class="nt-field"><span>Protein g</span><input id="mP" type="number" inputmode="numeric" value="' + (prefill.p != null ? esc(prefill.p) : '') + '"></label>' +
        '<label class="nt-field"><span>Fat g</span><input id="mF" type="number" inputmode="numeric" value="' + (prefill.f != null ? esc(prefill.f) : '') + '"></label>' +
        '<label class="nt-field"><span>Carbs g</span><input id="mC" type="number" inputmode="numeric" value="' + (prefill.c != null ? esc(prefill.c) : '') + '"></label>' +
      '</div>';
    s.sh.appendChild(form);
    var add = el('button', 'nt-btn nt-btn-gold', 'Add');
    add.onclick = function () {
      var name = $('#mName', s.sh).value.trim();
      if (!name) { add.textContent = 'Enter a name first'; setTimeout(function () { add.textContent = 'Add'; }, 1500); return; }
      addEntry({
        name: name, source: prefill.source || 'manual', unit: 'serving', qty: num($('#mQ', s.sh).value, 1),
        per: { kcal: num($('#mK', s.sh).value), p: num($('#mP', s.sh).value), f: num($('#mF', s.sh).value), c: num($('#mC', s.sh).value) }
      });
      s.close(); render();
    };
    s.sh.appendChild(add);
  }

  // ---- add an entry at the pending slot ------------------------------------
  function addEntry(e) {
    var slot = (typeof addSlotMs === 'number') ? addSlotMs : defaultSlot();
    var dk = keyFromDate(new Date(slot));
    var obj = read(), day = getDay(obj, dk);
    e.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    e.ts = Date.now();
    e.at = slot;
    day.entries.push(e);
    write(obj);
    addSlotMs = null;
  }

  // ---- deep-link ingestion (cookbook "Log to tracker" handoff) -------------
  // dashboard.html?tab=nutrition&log=1&name=…&kcal=…&p=…&f=…&c=…
  function consumeDeepLink() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('log') !== '1') return;
      var pre = { name: q.get('name') || '', kcal: q.get('kcal') || '', p: q.get('p') || '', f: q.get('f') || '', c: q.get('c') || '' };
      ['log', 'name', 'kcal', 'p', 'f', 'c'].forEach(function (k) { q.delete(k); });
      var qs = q.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      selKey = todayKey(); addSlotMs = defaultSlot();
      openManual(pre);
    } catch (e) {}
  }

  // ====================================================================== //
  //  NUTRITION FACTS SHEET  (Phase 3 — UOM toggle · keypad · micronutrients) //
  // ====================================================================== //
  var OZ_G = 28.3495;

  // build a sheet-ready "food" from a search/barcode item or a logged entry.
  function foodFromItem(it) {
    return {
      name: it.name + (it.brand ? ' (' + it.brand + ')' : ''), brand: it.brand || '',
      basis: it.basis || 'serving', servingLabel: it.servingLabel || 'serving',
      grams: (it.grams && it.grams > 0) ? it.grams : null,
      per: { kcal: it.kcal, p: it.p, f: it.f, c: it.c }, nutr: it.nutr || {},
      source: it.source || 'search', code: it.code || ''
    };
  }
  function foodFromEntry(e) {
    return {
      name: e.name, brand: '', basis: e.unit || 'serving',
      servingLabel: e.unit === '100g' ? '100 g' : 'serving',
      grams: (e.grams && e.grams > 0) ? e.grams : null,
      per: e.per || {}, nutr: e.nutr || {}, source: e.source || 'manual', code: e.code || ''
    };
  }
  function baseGramsOf(food) {
    if (food.basis === '100g') return 100;
    return (food.grams && food.grams > 0) ? food.grams : null;
  }
  function fmt(n, dp) { var v = num(n, 0); return dp ? (+v.toFixed(dp)) : Math.round(v); }

  // ---- favorites store (lives inside mc_macros_v1) -------------------------
  function favKey(food) { return food.code ? ('c:' + food.code) : ('n:' + String(food.name).toLowerCase()); }
  function getFavs() { var d = read(); return d.favorites || []; }
  function isFav(food) { var k = favKey(food); return getFavs().some(function (f) { return favKey(f) === k; }); }
  function toggleFav(food) {
    var d = read(); d.favorites = d.favorites || [];
    var k = favKey(food), i = -1;
    d.favorites.forEach(function (f, idx) { if (favKey(f) === k) i = idx; });
    if (i >= 0) { d.favorites.splice(i, 1); }
    else {
      d.favorites.unshift({
        name: food.name, brand: food.brand, basis: food.basis, servingLabel: food.servingLabel,
        grams: food.grams, per: food.per, nutr: food.nutr, code: food.code,
        source: food.source || 'fav'
      });
    }
    write(d); return i < 0;
  }

  // ---- the facts sheet -----------------------------------------------------
  function openFacts(food, opts) {
    opts = opts || {};
    var editId = opts.entryId || null;
    var baseG = baseGramsOf(food);
    var unit = (opts.unit === 'g' || opts.unit === 'oz') && baseG ? opts.unit : 'base';
    var qty = (opts.qty != null) ? String(opts.qty) : '1';
    var goals = read().goals || null;

    var s = sheet(food.name, (food.brand ? esc(food.brand) + ' · ' : '') + 'Nutrition facts');
    var body = el('div', 'nt-facts');
    s.sh.appendChild(body);

    function multBase() {                          // current quantity in BASE units
      var q = num(qty, 0);
      if (unit === 'base' || !baseG) return q;
      var grams = unit === 'oz' ? q * OZ_G : q;
      return grams / baseG;
    }
    function pct(have, goal) { return goal ? Math.min(999, Math.round((have / goal) * 100)) : null; }

    function ringTile(lbl, val, suf, color, p) {
      var ringSvg = window.MC_CHART ? MC_CHART.ring(p == null ? 0 : p, { size: 52, stroke: 4, color: color }) : '';
      return '<div class="nt-ring" style="--rc:' + color + '">' +
        '<div class="nt-ring-circle">' + ringSvg +
          '<div class="nt-ring-center"><span class="nt-ring-val">' + val + '<span>' + suf + '</span></span></div>' +
        '</div>' +
        '<div class="nt-ring-lbl">' + lbl + '</div>' +
        '<div class="nt-ring-pct">' + (p == null ? '' : p + '%') + '</div></div>';
    }
    function nutrRow(lbl, val, suf) {
      var has = val !== '' && val != null;
      return '<div class="nt-nrow"><span>' + lbl + '</span><b>' + (has ? val + ' ' + suf : '—') + '</b></div>';
    }

    function refresh() {
      var m = multBase(), per = food.per || {}, nu = food.nutr || {};
      var kcal = fmt(per.kcal * m), p = fmt(per.p * m), f = fmt(per.f * m), c = fmt(per.c * m);
      var fib = nu.fiber != null ? fmt(nu.fiber * m, 1) : '';
      var sug = nu.sugar != null ? fmt(nu.sugar * m, 1) : '';
      var cho = nu.chol != null ? fmt(nu.chol * m) : '';
      var sod = nu.sodium != null ? fmt(nu.sodium * m) : '';
      var fav = isFav(food);

      body.innerHTML =
        '<div class="nt-rings">' +
          ringTile('Cal', kcal, '', COL.kcal, pct(kcal, goals && goals.kcal)) +
          ringTile('Protein', p, 'g', COL.p, pct(p, goals && goals.p)) +
          ringTile('Fat', f, 'g', COL.f, pct(f, goals && goals.f)) +
          ringTile('Carbs', c, 'g', COL.c, pct(c, goals && goals.c)) +
        '</div>' +
        '<div class="nt-nutrients">' +
          '<div class="nt-nutrients-h">Nutrients</div>' +
          nutrRow('Fiber', fib, 'g') + nutrRow('Sugars', sug, 'g') +
          nutrRow('Cholesterol', cho, 'mg') + nutrRow('Sodium', sod, 'mg') +
        '</div>' +
        '<div class="nt-uomrow">' +
          '<div class="nt-uom" id="ntUom">' +
            '<button data-u="base"' + (unit === 'base' ? ' class="on"' : '') + '>' + esc(food.servingLabel || 'serving') + '</button>' +
            (baseG ? '<button data-u="g"' + (unit === 'g' ? ' class="on"' : '') + '>grams</button>' +
                     '<button data-u="oz"' + (unit === 'oz' ? ' class="on"' : '') + '>oz</button>' : '') +
          '</div>' +
          '<div class="nt-qty"><span id="ntQty">' + esc(qty) + '</span>' +
            '<small>' + (unit === 'base' ? '×' : unit) + '</small></div>' +
        '</div>' +
        keypadHtml() +
        '<div class="nt-facts-btns">' +
          '<button class="nt-fav" id="ntFav" title="Favorite" aria-label="' + (fav ? 'Remove from favorites' : 'Add to favorites') + '">' + (fav ? '★' : '☆') + '</button>' +
          '<button class="nt-btn nt-btn-gold" id="ntLog">' + (editId ? 'Update' : 'Log Food') + '</button>' +
        '</div>' +
        (editId ? '<button class="nt-btn nt-btn-danger" id="ntDel">Remove from log</button>' : '');

      wire();
    }
    function keypadHtml() {
      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
      return '<div class="nt-keypad" id="ntPad">' + keys.map(function (k) {
        var label = k === '⌫' ? ' aria-label="Backspace"' : (k === '.' ? ' aria-label="Decimal point"' : '');
        return '<button data-k="' + k + '"' + label + '>' + k + '</button>';
      }).join('') + '</div>';
    }
    function press(k) {
      if (k === '⌫') { qty = qty.length > 1 ? qty.slice(0, -1) : '0'; }
      else if (k === '.') { if (qty.indexOf('.') < 0) qty += '.'; }
      else { qty = (qty === '0') ? k : (qty.length < 6 ? qty + k : qty); }
      $('#ntQty', s.sh).textContent = qty;
      // live-update everything except the keypad (cheap full refresh is fine)
      var m = multBase(), per = food.per || {}, nu = food.nutr || {};
      refreshNumbers(m, per, nu);
    }
    function refreshNumbers(m, per, nu) {
      var rings = s.sh.querySelectorAll('.nt-ring-val');
      if (rings.length === 4) {
        rings[0].innerHTML = fmt(per.kcal * m) + '<span></span>';
        rings[1].innerHTML = fmt(per.p * m) + '<span>g</span>';
        rings[2].innerHTML = fmt(per.f * m) + '<span>g</span>';
        rings[3].innerHTML = fmt(per.c * m) + '<span>g</span>';
      }
      var goalsArr = [goals && goals.kcal, goals && goals.p, goals && goals.f, goals && goals.c];
      var vals = [fmt(per.kcal * m), fmt(per.p * m), fmt(per.f * m), fmt(per.c * m)];
      var pcArr = vals.map(function (v, i) { return pct(v, goalsArr[i]); });
      var pcts = s.sh.querySelectorAll('.nt-ring-pct');
      pcts.forEach(function (e, i) { e.textContent = pcArr[i] == null ? '' : pcArr[i] + '%'; });
      var arcs = s.sh.querySelectorAll('.mcchart-ring-arc');
      if (arcs.length === 4 && window.MC_CHART) {
        var circ = MC_CHART.ringCircumference({ size: 52, stroke: 4 });
        arcs.forEach(function (arc, i) {
          var p = Math.max(0, Math.min(100, pcArr[i] || 0));
          arc.setAttribute('stroke-dasharray', ((p / 100) * circ).toFixed(2) + ' ' + circ.toFixed(2));
        });
      }
      var nrows = s.sh.querySelectorAll('.nt-nrow b');
      if (nrows.length === 4) {
        nrows[0].textContent = nu.fiber != null ? fmt(nu.fiber * m, 1) + ' g' : '—';
        nrows[1].textContent = nu.sugar != null ? fmt(nu.sugar * m, 1) + ' g' : '—';
        nrows[2].textContent = nu.chol != null ? fmt(nu.chol * m) + ' mg' : '—';
        nrows[3].textContent = nu.sodium != null ? fmt(nu.sodium * m) + ' mg' : '—';
      }
    }
    function setUnit(u) {
      if (u === unit) return;
      var curMult = multBase();
      if (u === 'base') { qty = String(+curMult.toFixed(2)); }
      else { var grams = curMult * baseG; qty = String(u === 'oz' ? +(grams / OZ_G).toFixed(1) : Math.round(grams)); }
      unit = u; refresh();
    }
    function wire() {
      var pad = $('#ntPad', s.sh);
      pad.onclick = function (e) { var b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
      var uom = $('#ntUom', s.sh);
      uom.onclick = function (e) { var b = e.target.closest('[data-u]'); if (b) setUnit(b.dataset.u); };
      $('#ntFav', s.sh).onclick = function () {
        toggleFav(food); var on = isFav(food);
        this.textContent = on ? '★' : '☆'; this.classList.toggle('on', on);
        this.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
      };
      $('#ntFav', s.sh).classList.toggle('on', isFav(food));
      $('#ntLog', s.sh).onclick = function () {
        var m = multBase();
        if (!(m > 0)) return;
        if (editId) {
          var obj = read(), d = getDay(obj, selKey);
          d.entries.forEach(function (e) { if (e.id === editId) { e.qty = m; e.unit = food.basis; e.ts = Date.now(); } });
          write(obj);
        } else {
          addEntry({ name: food.name, source: food.source || 'manual', unit: food.basis, qty: m,
            per: food.per, nutr: food.nutr, grams: food.grams, code: food.code });
        }
        s.close(); render();
      };
      if (editId) $('#ntDel', s.sh).onclick = function () {
        var obj = read(), d = getDay(obj, selKey);
        var removed = null;
        d.entries.forEach(function (e) { if (e.id === editId) removed = e; });
        d.entries = d.entries.filter(function (e) { return e.id !== editId; });
        write(obj); s.close(); render();
        if (removed) {
          toast(removed.name + ' removed', 'Undo', function () {
            addSlotMs = removed.at;
            addEntry({
              name: removed.name, source: removed.source, unit: removed.unit, qty: removed.qty,
              per: removed.per, nutr: removed.nutr, grams: removed.grams, code: removed.code
            });
            render();
          });
        }
      };
    }
    refresh();
  }

  // ====================================================================== //
  //  FAVORITES LIBRARY  (Phase 3)                                            //
  // ====================================================================== //
  function openFavorites() {
    addSlotMs = addSlotMs || defaultSlot();
    var s = sheet('Favorite Foods', 'Quick-log the foods you eat most.');
    var pending = [];
    var wrap = el('div', 'nt-fav-wrap');
    s.sh.appendChild(wrap);
    var bar = el('div', 'nt-fav-bar');
    s.sh.appendChild(bar);

    function paint() {
      var favs = getFavs();
      wrap.innerHTML =
        (favs.length ? '<div class="nt-fav-list">' + favs.map(function (f, i) {
          var per = f.per || {};
          return '<div class="nt-fav-row" data-i="' + i + '">' +
            '<div class="nt-fav-main"><div class="nt-fav-name">' + esc(f.name) + '</div>' +
              '<div class="nt-fav-macros">🔥' + fmt(per.kcal) + ' · P' + fmt(per.p) + ' F' + fmt(per.f) + ' C' + fmt(per.c) + '</div></div>' +
            '<button class="nt-fav-add" data-add="' + i + '" aria-label="Add ' + esc(f.name) + ' to log">+</button></div>';
        }).join('') + '</div>'
        : '<div class="nt-results-msg">No favorite foods yet. Tap ☆ on any food’s nutrition facts to save it here.</div>');
      paintBar();
    }
    function paintBar() {
      bar.innerHTML =
        '<div class="nt-fav-count">' + pending.length + ' item' + (pending.length === 1 ? '' : 's') + ' added</div>' +
        '<button class="nt-btn nt-btn-gold nt-fav-log"' + (pending.length ? '' : ' disabled') + '>Log Food</button>';
      var lg = bar.querySelector('.nt-fav-log');
      if (lg) lg.onclick = function () {
        pending.forEach(function (f) {
          addEntry({ name: f.name, source: 'favorite', unit: f.basis, qty: 1, per: f.per, nutr: f.nutr, grams: f.grams, code: f.code });
        });
        s.close(); render();
      };
    }
    wrap.onclick = function (e) {
      var add = e.target.closest('[data-add]');
      if (add) { var f = getFavs()[+add.dataset.add]; if (f) { pending.push(f); paintBar(); add.textContent = '✓'; setTimeout(function () { add.textContent = '+'; }, 700); } return; }
      var row = e.target.closest('.nt-fav-row');
      if (row) { var ff = getFavs()[+row.dataset.i]; if (ff) openFacts(ff, {}); }
    };
    paint();
  }

  // ---- styles (injected once, mirrors mc-account.js's self-contained CSS) ---
  (function injectStyles() {
    if (document.getElementById('nt-styles')) return;
    var css =
      '#nutritionBody{max-width:680px;margin:0 auto;padding:0 16px 24px;}' +
      '.ntx{padding-top:2px;}' +
      /* header */
      '.ntx-head{display:flex;align-items:center;justify-content:space-between;margin:0 2px 12px;}' +
      '.ntx-head-date{font-size:16px;font-weight:900;color:var(--text);letter-spacing:-0.01em;}' +
      '.ntx-head-actions{display:flex;gap:8px;}' +
      '.ntx-ico{width:38px;height:38px;border-radius:11px;border:1px solid var(--border2);background:var(--surface2);' +
        'color:var(--text);font-size:16px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;}' +
      /* calendar */
      '.ntx-cal{display:flex;align-items:center;gap:2px;margin-bottom:14px;}' +
      '.ntx-cal-nav{flex:0 0 auto;width:24px;height:48px;border:none;background:none;color:var(--muted2);font-size:20px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.ntx-cal-days{flex:1;display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}' +
      '.ntx-day{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0 5px;border-radius:12px;' +
        'cursor:pointer;border:1.5px solid transparent;}' +
      '.ntx-day-wd{font-size:9px;font-weight:800;letter-spacing:0.04em;color:var(--muted2);}' +
      '.ntx-day-num{font-size:15px;font-weight:800;color:var(--text);}' +
      '.ntx-day-dot{width:4px;height:4px;border-radius:50%;background:transparent;}' +
      '.ntx-day.has .ntx-day-dot{background:var(--gold);opacity:0.5;}' +
      '.ntx-day.today .ntx-day-dot{background:var(--gold);opacity:1;}' +
      '.ntx-day.sel{border-color:var(--gold);background:rgba(212,175,55,0.08);}' +
      '.ntx-day.sel .ntx-day-num{color:var(--gold);}' +
      /* macro summary */
      '.ntx-sum{background:var(--surface);border:1px solid var(--border2);' +
        'border-radius:16px;padding:12px;margin-bottom:14px;cursor:pointer;}' +
      '.ntx-sum-row{display:flex;align-items:center;gap:8px;}' +
      '.ntx-train-bonus{margin-top:8px;padding-top:8px;border-top:1px solid var(--border2);' +
        'font-size:11px;font-weight:800;color:#34d399;text-align:center;}' +
      '.ntx-sum-metrics{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:9px;min-width:0;}' +
      '.ntx-met{min-width:0;}' +
      '.ntx-met-top{display:flex;align-items:baseline;gap:2px;white-space:nowrap;overflow:hidden;}' +
      '.ntx-met-ic{font-size:11px;font-weight:900;flex:0 0 auto;}' +
      '.ntx-met-val{font-size:13px;font-weight:900;color:var(--text);}' +
      '.ntx-met-goal{font-size:10px;color:var(--muted2);font-weight:700;}' +
      '.ntx-met-track{height:3px;border-radius:2px;background:rgba(255,255,255,0.1);margin-top:6px;overflow:hidden;}' +
      '.ntx-met-fill{height:100%;border-radius:2px;transition:width 0.3s ease;}' +
      '.ntx-sum-exp{flex:0 0 auto;color:var(--muted2);font-size:20px;font-weight:800;line-height:1;}' +
      /* adaptive macro nudge */
      '.ntx-nudge{background:var(--surface);border:1px solid rgba(52,211,153,0.35);border-radius:16px;' +
        'padding:12px 14px;margin-bottom:14px;}' +
      '.ntx-nudge-txt{display:flex;flex-direction:column;gap:3px;margin-bottom:10px;}' +
      '.ntx-nudge-txt b{font-size:13px;font-weight:800;color:var(--text);}' +
      '.ntx-nudge-txt span{font-size:11.5px;font-weight:700;color:var(--muted);line-height:1.4;}' +
      '.ntx-nudge-actions{display:flex;gap:8px;}' +
      '.ntx-nudge-actions button{flex:1;border:none;border-radius:10px;padding:9px;font-size:12px;' +
        'font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.ntx-nudge-apply{background:#34d399;color:#04231a;}' +
      '.ntx-nudge-dismiss{background:rgba(255,255,255,0.07);color:var(--muted);}' +
      /* 7-day trend */
      '.ntx-trend{background:var(--surface);border:1px solid var(--border2);border-radius:16px;padding:12px 14px;margin-bottom:14px;}' +
      '.ntx-trend-h{font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:8px;}' +
      /* recent & frequent foods */
      '.ntx-recent{margin-bottom:14px;}' +
      '.ntx-recent-h{font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:8px;}' +
      '.ntx-recent-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;-webkit-overflow-scrolling:touch;}' +
      '.ntx-recent-chip{flex:0 0 auto;min-width:112px;max-width:150px;background:var(--surface);border:1px solid var(--border2);' +
        'border-radius:12px;padding:9px 12px;text-align:left;cursor:pointer;font-family:inherit;}' +
      '.ntx-recent-name{font-size:12px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.ntx-recent-kcal{font-size:11px;font-weight:700;color:var(--muted);margin-top:3px;}' +
      /* cookbook remaining-macros handoff */
      '.ntx-cook{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid rgba(var(--accent-rgb),0.35);' +
        'border-radius:13px;padding:11px 12px;margin-bottom:14px;text-decoration:none;min-height:44px;}' +
      '.ntx-cook-ic{font-size:17px;flex:0 0 auto;}' +
      '.ntx-cook-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}' +
      '.ntx-cook-txt b{font-size:13px;font-weight:800;color:var(--text);}' +
      '.ntx-cook-txt span{font-size:11.5px;font-weight:700;color:var(--muted);}' +
      '.ntx-cook-arr{flex:0 0 auto;color:var(--muted2);font-size:18px;font-weight:800;}' +
      /* planned meals (cookbook->workout bridge, roadmap B1) */
      '.ntx-plan{background:var(--surface);border:1px solid var(--border2);border-radius:16px;' +
        'padding:12px 14px;margin-bottom:14px;}' +
      '.ntx-plan-h{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;' +
        'letter-spacing:0.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:10px;}' +
      '.ntx-plan-h-ic{font-size:13px;}' +
      '.ntx-plan-target{font-size:12px;font-weight:700;color:var(--muted);margin-bottom:10px;' +
        'padding-bottom:10px;border-bottom:1px solid var(--border2);}' +
      '.ntx-plan-list{display:flex;flex-direction:column;gap:8px;}' +
      '.ntx-plan-row{display:flex;align-items:center;gap:10px;}' +
      '.ntx-plan-ic{font-size:19px;flex:0 0 auto;width:30px;text-align:center;}' +
      '.ntx-plan-info{flex:1;min-width:0;}' +
      '.ntx-plan-name{font-size:13px;font-weight:800;color:var(--text);white-space:nowrap;' +
        'overflow:hidden;text-overflow:ellipsis;}' +
      '.ntx-plan-sub{font-size:11px;font-weight:700;color:var(--muted);margin-top:1px;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.ntx-plan-log{flex:0 0 auto;min-height:32px;padding:0 12px;border-radius:9px;border:1px solid rgba(var(--accent-rgb),0.4);' +
        'background:rgba(var(--accent-rgb),0.12);color:var(--gold);font-size:12px;font-weight:800;' +
        'cursor:pointer;font-family:inherit;}' +
      '.ntx-plan-log:disabled{opacity:0.4;cursor:default;}' +
      '.ntx-plan-log.done{background:rgba(52,211,153,0.12);border-color:rgba(52,211,153,0.4);color:#34d399;cursor:default;}' +
      /* find bar */
      '.ntx-find{display:flex;align-items:center;gap:9px;background:var(--surface);border:1px solid var(--border2);' +
        'border-radius:13px;padding:10px 12px;margin-bottom:16px;}' +
      '.ntx-find-ic{font-size:14px;}' +
      '.ntx-find-txt{flex:1;text-align:left;background:none;border:none;color:var(--muted);font-size:14px;' +
        'cursor:pointer;font-family:inherit;padding:0;}' +
      '.ntx-find-scan{width:34px;height:34px;border-radius:9px;border:1px solid var(--border2);background:var(--surface2);' +
        'color:var(--text);font-size:15px;cursor:pointer;font-family:inherit;}' +
      /* timeline */
      '.ntx-time{position:relative;}' +
      '.ntx-hr{display:grid;grid-template-columns:52px 1fr;gap:10px;align-items:stretch;}' +
      '.ntx-hr-rail{display:flex;flex-direction:column;align-items:center;padding-top:5px;' +
        'border-right:1px dashed rgba(255,255,255,0.12);}' +
      '.ntx-hr-lbl{font-size:10px;font-weight:800;color:var(--muted2);white-space:nowrap;}' +
      '.ntx-hr-add{margin-top:6px;width:26px;height:26px;border-radius:50%;border:1px solid var(--border2);' +
        'background:var(--surface2);color:var(--gold);font-size:17px;line-height:1;cursor:pointer;font-family:inherit;}' +
      '.ntx-hr-body{padding:4px 0 12px;display:flex;flex-direction:column;gap:6px;min-width:0;}' +
      '.ntx-hr.has .ntx-hr-rail{border-right-color:rgba(212,175,55,0.35);}' +
      '.ntx-hr.now .ntx-hr-lbl{color:var(--gold);}' +
      '.ntx-hr-collapsed{cursor:pointer;padding:10px 8px 10px 62px;font-size:11px;font-weight:700;' +
        'color:var(--muted2,#64748b);-webkit-tap-highlight-color:transparent;}' +
      '.ntx-hr-collapsed:active{color:var(--muted,#94a3b8);}' +
      '.ntx-fcard{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:9px 12px;cursor:pointer;}' +
      '.ntx-fcard-top{display:flex;justify-content:space-between;gap:8px;align-items:baseline;}' +
      '.ntx-fcard-name{font-size:13px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}' +
      '.ntx-fcard-time{font-size:10px;color:var(--muted2);font-weight:700;flex:0 0 auto;}' +
      '.ntx-fcard-macros{font-size:11px;color:var(--muted2);font-weight:600;margin-top:3px;}' +
      '.ntx-fcard-macros b{font-weight:800;}' +
      /* buttons reused across sheets */
      '.nt-btn{width:100%;box-sizing:border-box;padding:14px;border-radius:13px;border:1px solid var(--border2);' +
        'background:var(--surface2);color:var(--text);font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.nt-btn-gold{background:var(--gold);border-color:var(--gold);color:#000;}' +
      '.nt-btn-danger{background:transparent;border-color:rgba(248,113,113,0.4);color:#f87171;margin-top:8px;}' +
      '.nt-actions-wrap{display:flex;flex-direction:column;gap:10px;}' +
      '.nt-actions{display:flex;gap:10px;}' +
      /* sheets */
      '.nt-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
        'display:flex;align-items:flex-end;justify-content:center;z-index:1200;opacity:0;transition:opacity 0.2s;}' +
      '.nt-overlay.open{opacity:1;}' +
      '.nt-sheet{width:100%;max-width:560px;background:#0e0e0e;border-top:1px solid var(--border2);border-radius:24px 24px 0 0;' +
        'padding:14px 18px calc(28px + env(safe-area-inset-bottom));max-height:90vh;overflow-y:auto;' +
        'transform:translateY(16px);transition:transform 0.2s;}' +
      '.nt-overlay.open .nt-sheet{transform:translateY(0);}' +
      '.nt-handle{width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 16px;padding:12px 0;box-sizing:content-box;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      '.nt-sheet-title{font-size:19px;font-weight:900;color:var(--text);letter-spacing:-0.01em;}' +
      '.nt-sheet-sub{font-size:13px;color:var(--muted);margin:4px 0 16px;line-height:1.5;}' +
      '.nt-form{display:flex;flex-direction:column;gap:12px;margin-bottom:16px;}' +
      '.nt-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}' +
      '.nt-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}' +
      '.nt-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--muted);}' +
      '.nt-field input,.nt-field select,.nt-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);' +
        'border:1px solid var(--border2);border-radius:11px;padding:12px;color:var(--text);font-size:15px;font-family:inherit;}' +
      '.nt-input{margin-bottom:12px;}' +
      '.nt-seg{display:flex;gap:8px;}' +
      '.nt-seg button{flex:1;padding:12px;border-radius:11px;border:1px solid var(--border2);background:rgba(255,255,255,0.04);' +
        'color:var(--muted);font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.nt-seg button.on{background:var(--gold);border-color:var(--gold);color:#000;}' +
      '.nt-act-hint{font-size:11.5px;color:var(--muted2);margin-top:-4px;}' +
      '.nt-act-apply{background:none;border:none;padding:0;color:var(--gold);font-weight:800;font-size:11.5px;' +
        'text-decoration:underline;cursor:pointer;font-family:inherit;}' +
      '.nt-results{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow-y:auto;}' +
      '.nt-results-msg{font-size:13px;color:var(--muted2);text-align:center;padding:18px;}' +
      '.nt-result{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);' +
        'border-radius:12px;padding:11px 13px;cursor:pointer;}' +
      '.nt-result-main{flex:1;min-width:0;}' +
      '.nt-result-name{font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.nt-result-sub{font-size:11px;color:var(--muted2);font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.nt-result-kcal{font-size:15px;font-weight:900;color:var(--text);flex-shrink:0;text-align:center;}' +
      '.nt-result-kcal span{display:block;font-size:9px;color:var(--muted2);font-weight:700;}' +
      /* natural-language describe flow (4.2) */
      '.nt-btn-describe{background:rgba(192,132,252,0.1);border-color:rgba(192,132,252,0.35);color:#e9d5ff;}' +
      '.nt-describe-wrap{display:flex;flex-direction:column;gap:12px;}' +
      '.nt-describe-input{resize:vertical;min-height:52px;font-family:inherit;margin-bottom:0;}' +
      '.nt-describe-results{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow-y:auto;}' +
      '.nt-describe-row{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);' +
        'border-radius:12px;padding:11px 13px;}' +
      '.nt-describe-check{width:20px;height:20px;flex-shrink:0;accent-color:var(--gold);}' +
      '.nt-describe-main{flex:1;min-width:0;}' +
      '.nt-describe-name{font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.nt-describe-sub{font-size:11px;color:var(--muted2);font-weight:600;margin-top:2px;}' +
      '.nt-describe-manual{width:auto;flex-shrink:0;padding:8px 12px;font-size:12px;}' +
      '.nt-describe-ctl{display:flex;align-items:center;gap:6px;flex-shrink:0;}' +
      '.nt-describe-ctlbtn{width:26px;height:26px;border-radius:8px;border:1px solid var(--border2);background:var(--surface2);' +
        'color:var(--text);font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;line-height:1;padding:0;}' +
      '.nt-describe-ctlval{min-width:18px;text-align:center;font-size:13px;font-weight:800;color:var(--text);}' +
      '.nt-describe-add{margin-top:4px;}' +
      '.nt-adjust{margin-top:8px;}' +
      '.nt-adjust-head{font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted2);margin-bottom:10px;}' +
      '.nt-calsum{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;}' +
      '.nt-calsum-k{font-size:26px;font-weight:900;color:var(--gold);}' +
      '.nt-calsum-split{font-size:13px;font-weight:700;color:var(--muted);}' +
      '.nt-step{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border);}' +
      '.nt-step-lbl{font-size:14px;font-weight:800;color:var(--text);}' +
      '.nt-step-ctl{display:flex;align-items:center;gap:14px;}' +
      '.nt-step-btn{width:38px;height:38px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);' +
        'color:var(--text);font-size:20px;font-weight:800;cursor:pointer;font-family:inherit;line-height:1;}' +
      '.nt-step-val{min-width:54px;text-align:center;font-size:18px;font-weight:900;color:var(--text);}' +
      /* ── Nutrition Facts sheet (Phase 3) ── */
      '.nt-facts{display:flex;flex-direction:column;gap:14px;}' +
      '.nt-rings{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;}' +
      '.nt-ring{position:relative;border:1.5px solid color-mix(in srgb, var(--rc) 45%, transparent);border-radius:14px;' +
        'padding:10px 4px 9px;text-align:center;background:color-mix(in srgb, var(--rc) 9%, transparent);}' +
      '.nt-ring-circle{position:relative;width:52px;height:52px;margin:0 auto;}' +
      '.nt-ring-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}' +
      '.nt-ring-val{font-size:13px;font-weight:900;color:var(--text);line-height:1.1;text-align:center;}' +
      '.nt-ring-val span{display:block;font-size:8px;font-weight:800;color:var(--muted);margin-top:1px;}' +
      '.nt-ring-lbl{font-size:10px;font-weight:800;letter-spacing:0.03em;color:var(--text);margin-top:6px;}' +
      '.nt-ring-pct{font-size:11px;font-weight:900;color:var(--rc);margin-top:3px;min-height:13px;}' +
      '.nt-nutrients{border:1px solid var(--border2);border-radius:14px;padding:4px 14px;}' +
      '.nt-nutrients-h{font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted2);padding:10px 0 4px;}' +
      '.nt-nrow{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-top:1px solid var(--border);font-size:13px;font-weight:800;color:var(--text);}' +
      '.nt-nrow b{color:var(--text);font-weight:800;}' +
      '.nt-uomrow{display:flex;align-items:center;gap:12px;}' +
      '.nt-uom{flex:1;display:flex;gap:6px;}' +
      '.nt-uom button{flex:1;padding:10px 4px;border-radius:10px;border:1px solid var(--border2);background:rgba(255,255,255,0.04);' +
        'color:var(--muted);font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.nt-uom button.on{background:var(--gold);border-color:var(--gold);color:#000;}' +
      '.nt-qty{flex:0 0 auto;display:flex;align-items:baseline;gap:4px;font-size:26px;font-weight:900;color:var(--text);min-width:74px;justify-content:flex-end;}' +
      '.nt-qty small{font-size:13px;font-weight:800;color:var(--muted);}' +
      '.nt-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}' +
      '.nt-keypad button{padding:15px 0;border-radius:12px;border:1px solid var(--border2);background:var(--surface2);' +
        'color:var(--text);font-size:20px;font-weight:800;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}' +
      '.nt-keypad button:active{background:rgba(212,175,55,0.18);}' +
      '.nt-facts-btns{display:flex;gap:10px;align-items:stretch;}' +
      '.nt-fav{flex:0 0 52px;border-radius:13px;border:1px solid var(--border2);background:var(--surface2);' +
        'color:var(--muted2);font-size:22px;cursor:pointer;font-family:inherit;}' +
      '.nt-fav.on{color:var(--gold);border-color:var(--gold);}' +
      /* ── Favorites library (Phase 3) ── */
      '.nt-fav-list{display:flex;flex-direction:column;gap:8px;max-height:54vh;overflow-y:auto;}' +
      '.nt-fav-row{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px 13px;cursor:pointer;}' +
      '.nt-fav-main{flex:1;min-width:0;}' +
      '.nt-fav-name{font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.nt-fav-macros{font-size:11px;color:var(--muted2);font-weight:700;margin-top:2px;}' +
      '.nt-fav-add{flex:0 0 38px;height:38px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);' +
        'color:var(--gold);font-size:20px;font-weight:800;cursor:pointer;font-family:inherit;line-height:1;}' +
      '.nt-fav-bar{display:flex;align-items:center;gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border2);position:sticky;bottom:0;background:#0e0e0e;}' +
      '.nt-fav-count{flex:1;font-size:13px;font-weight:800;color:var(--muted);}' +
      '.nt-fav-log{width:auto;flex:0 0 auto;padding:13px 26px;}' +
      '.nt-fav-log:disabled{opacity:0.4;}' +
      '@media (prefers-reduced-motion: reduce){.nt-overlay,.nt-sheet,.ntx-met-fill{transition:none;}}' +
      /* undo toast (log-entry deletion) */
      '.mc-toast{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));z-index:1360;' +
        'transform:translate(-50%,16px);display:flex;align-items:center;gap:14px;max-width:calc(100vw - 32px);' +
        'padding:12px 14px 12px 16px;background:#0e0e0e;color:#e2e8f0;border:1px solid rgba(255,255,255,0.1);' +
        'border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,0.55);font-size:13.5px;font-weight:600;' +
        'opacity:0;pointer-events:none;transition:opacity 200ms ease,transform 200ms ease;}' +
      '.mc-toast.show{opacity:1;transform:translate(-50%,0);pointer-events:auto;}' +
      '.mc-toast-msg{white-space:nowrap;}' +
      '.mc-toast-btn{appearance:none;cursor:pointer;flex:0 0 auto;border:0;border-radius:8px;' +
        'background:var(--gold,#d4af37);color:#1a1208;font-family:inherit;font-size:13px;font-weight:800;' +
        'padding:8px 14px;transition:transform 120ms ease;}' +
      '.mc-toast-btn:active{transform:scale(0.95);}' +
      '@media (prefers-reduced-motion: reduce){.mc-toast{transition:none;}}';
    var st = document.createElement('style');
    st.id = 'nt-styles'; st.textContent = css;
    document.head.appendChild(st);
  })();

  // re-render when another tab/device changes the store (sync pull)
  window.addEventListener('storage', function (ev) {
    if (ev.key === KEY || ev.key === 'mc-cookbook:mealplan') render();
  });

  // land near "now" (or the first logged food) instead of always at 12 AM
  function scrollToRelevant() {
    var target = host.querySelector('.ntx-hr.now') || host.querySelector('.ntx-hr.has');
    if (!target) return;
    requestAnimationFrame(function () { target.scrollIntoView({ block: 'center', behavior: 'auto' }); });
  }

  render();
  scrollToRelevant();
  consumeDeepLink();
  window.MCMacros = { render: render, openCalculator: openCalculator };
})();
