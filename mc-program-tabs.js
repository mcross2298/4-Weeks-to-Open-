/* ==========================================================================
   mc-program-tabs.js — the program landing's Overview | Program list tabs
   --------------------------------------------------------------------------
   program-flow-roadmap.md, phase F1. A cat-*.html page is the program LANDING
   (F0 moved the day-by-day module off it and onto dashboard.html), so this is
   where a program's identity content lives: what it is, who it is for, how the
   week is shaped, and the list of workouts you can tap into.

   Built as a fourth view state on pages that already have three
   (#view-dashboard / #view-split / #view-workout) — no new page, no new
   architecture, and the drill-in below reuses #view-split's own mechanism
   rather than inventing a second one.

   ADAPTIVE, because `splits` in mc-pm-data.js means three different things
   (roadmap decision 6). A program's "splits" are either its days directly, or
   phases that are really days in sequence, or true splits that hold days of
   their own — and within that last shape the depth still varies. (The
   program-by-program breakdown lives in program-flow-roadmap.md, which is
   scratch-listed; naming licensed ids here would ship them into the public
   build, which is exactly what tools/build-market.py --check is for.) So the
   caller hands over `groups`, and this file decides how many levels to render:

     one group   -> its days, directly. No drill-in, no back button.
     many groups -> the group rows first; tapping one shows a slim context
                    header (decision 7) above that group's days.

   The ROW COMPONENT IS IDENTICAL at both levels on purpose — a group row and
   a day row differ only in what their meta line says — so the list reads as
   one control rather than as two screens.

   A PURE RENDERER over mc-program-progress.js, same contract as
   mc-day-hero.js: the caller supplies the record and the definition, this
   file owns no state beyond which group is open. Completion ticks and the
   `Day N` numbering both come from the record, so a reordered week renumbers
   itself with no work here.

   REORDER is not reimplemented. mc-program-menu.js already owns a keyboard-
   operable ▲/▼ reorder sheet backed by MC_PROGRAM_PROGRESS.reorderWeek(); the
   affordance on the list opens that. One implementation, per the repo's
   single-implementation rule.

   Usage:
     MC_PROGRAM_TABS.mount(el, {
       progId, accent, def,          // def = the block definition (weeks/perWeek/rest/order)
       rec,                          // optional; re-read from the store when absent
       week,                         // week whose order/completion the list reflects (default: current)
       forWho,                       // "Who this is for" copy (mc-pm-data.js `forWho`)
       desc,                         // one-line program pitch
       guide: { href, label },       // <id>-instructions.html entry point
       groups: [ { id, name, desc, meta, icon, days:[dayId,...] } ],
       dayMeta: fn(dayId) -> { title, icon, tags[], ex, sets, min },
       exerciseNames: [...],         // optional; equipment row is derived from these
       onOpen: fn(dayId, week),      // tap a day row
       onLog:  fn(dayId, logId)      // tap a completed day row's log
     })
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_PROGRAM_TABS) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hexToRgb(hex) {
    var h = String(hex || '#c9505a').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return '201,80,90';
    return r + ',' + g + ',' + b;
  }

  // ---- the list model ------------------------------------------------------
  // Split out from rendering so tools/test-mc-program-tabs.js can assert the
  // adaptive decisions (how many levels, which day numbers, what is ticked)
  // without a DOM. Everything the two panels draw comes from here.

  function groupsOf(cfg) {
    var g = (cfg && cfg.groups) || [];
    return g.filter(function (x) { return x && x.days && x.days.length; });
  }

  // Does this program have a split layer worth drilling into? One group is a
  // program whose "splits" are its days (ss, pump) — showing a single row that
  // opens a list is a level of nothing, so it is skipped.
  function hasDrillIn(cfg) {
    return groupsOf(cfg).length > 1;
  }

  // `Day N` for a day row. The record is the authority: a day's number is its
  // continuous position in the block, so the same workout is Day 2 in week 1
  // and Day 9 in week 2, and a reordered week renumbers with no work here.
  // A day the record does not schedule (a group holding extra workouts, which
  // is normal for a collection program) gets no number rather than a wrong one.
  function dayNumber(rec, week, dayId, P) {
    if (!rec || !P) return null;
    var order = P.orderForWeek(rec, week);
    var rank = order.indexOf(dayId);
    if (rank < 0) return null;
    var seen = -1;
    for (var p = 1; p <= rec.perWeek; p++) {
      if (rec.rest.indexOf(p) >= 0) continue;
      seen++;
      if (seen === rank) return (week - 1) * rec.perWeek + p;
    }
    return null;
  }

  function dayRow(cfg, rec, week, dayId, P) {
    var meta = (cfg.dayMeta && cfg.dayMeta(dayId)) || {};
    var day = dayNumber(rec, week, dayId, P);
    var info = (day && P) ? P.dayInfoFrom(rec, day) : null;
    var bits = [];
    if (day) bits.push('Day ' + day);
    if (meta.min) bits.push(meta.min + ' min');
    else if (meta.ex) bits.push(meta.ex + ' exercises');
    return {
      kind: 'day',
      id: dayId,
      name: meta.title || dayId,
      icon: meta.icon || '•',
      meta: bits.join(' · '),
      day: day,
      complete: !!(info && info.complete),
      logId: info ? info.logId : null
    };
  }

  function groupRow(cfg, g) {
    var n = (g.days || []).length;
    return {
      kind: 'group',
      id: g.id,
      name: g.name || g.id,
      icon: g.icon || '▣',
      meta: g.meta || (n + (n === 1 ? ' workout' : ' workouts')),
      day: null,
      complete: false,
      logId: null
    };
  }

  // The whole Program list panel as data: which level we are on, the context
  // header for a drilled-in group, and the rows.
  function listModel(cfg, state) {
    var P = (state && state.P) || window.MC_PROGRAM_PROGRESS;
    var rec = (state && state.rec) || null;
    var week = (state && state.week) || 1;
    var gs = groupsOf(cfg);
    var openId = state && state.openGroup;
    var open = null;
    for (var i = 0; i < gs.length; i++) if (gs[i].id === openId) open = gs[i];

    // Single-group programs render their days with no level above them, so an
    // openGroup that was never selectable must not strand the list.
    if (!hasDrillIn(cfg)) open = gs[0] || null;

    if (!open) {
      return {
        level: 'groups',
        header: null,
        rows: gs.map(function (g) { return groupRow(cfg, g); })
      };
    }
    // Rows follow THE WEEK'S ORDER, not the group's authored order. Driving
    // the reorder sheet showed why: moving a workout down renumbered the rows
    // (Legs became "Day 2") while leaving them in the same visual order, so
    // reordering appeared to do nothing. Days the record does not schedule
    // have no number to sort by and keep their authored position, after the
    // scheduled ones.
    var rows = open.days.map(function (d) { return dayRow(cfg, rec, week, d, P); });
    rows.sort(function (a, b) {
      if (a.day && b.day) return a.day - b.day;
      if (a.day) return -1;
      if (b.day) return 1;
      return 0;
    });
    return {
      level: 'days',
      header: hasDrillIn(cfg)
        ? { name: open.name || open.id, desc: open.desc || '', meta: open.meta || '' }
        : null,
      rows: rows
    };
  }

  // ---- equipment ----------------------------------------------------------
  // exercise-catalog.js is 87 KB and a landing page has no business loading it.
  // mc-biomech.js is the single implementation of equipment classification and
  // infers it from the exercise NAME with no catalog, so the row is derived
  // from the day data a program page already holds. Absent that module the
  // section is omitted rather than guessed at.
  //
  // COUNTED, not just listed. A plain set of category names came back as all
  // seven of them on the first program tried, which is true and tells the
  // reader nothing. Ordering by how many exercises use each one says what the
  // program actually is ("mostly barbell and dumbbell") in the same row.
  // Note the counts lean toward Barbell: it is equipOf()'s fallback for a name
  // no keyword matches. That is the same inference the substitute picker
  // already trusts app-wide, so this is not a new trust decision — but it is
  // why this row shows proportions rather than claiming an exact inventory.
  function equipmentOf(cfg) {
    var names = (cfg && cfg.exerciseNames) || [];
    if (!names.length || !window.MCBiomech || !window.MCBiomech.classify) return [];
    var count = {};
    for (var i = 0; i < names.length; i++) {
      var e = '';
      try { e = (window.MCBiomech.classify(names[i]) || {}).equipment || ''; } catch (err) { e = ''; }
      if (!e) continue;
      count[e] = (count[e] || 0) + 1;
    }
    // MCBiomech.EQUIP is ordered; it breaks ties so two programs never
    // disagree about the order of two equally-used categories.
    var rank = window.MCBiomech.EQUIP || [];
    return Object.keys(count).map(function (k) { return { name: k, n: count[k] }; })
      .sort(function (a, b) {
        return (b.n - a.n) || (rank.indexOf(a.name) - rank.indexOf(b.name));
      });
  }

  // ---- rendering ----------------------------------------------------------
  function section(title, body) {
    return '<section class="mpt-sec"><h2 class="mpt-sec-h">' + escapeHtml(title) + '</h2>' + body + '</section>';
  }

  function weekStripHtml(rec, week, cfg, P) {
    if (!rec || !P) return '';
    var days = P.weekFrom(rec, week);
    var cells = days.map(function (d) {
      var meta = (!d.rest && cfg.dayMeta) ? (cfg.dayMeta(d.workoutId) || {}) : {};
      var label = d.rest ? 'Rest' : (meta.title || 'Train');
      var cls = 'mpt-wd' + (d.rest ? ' is-rest' : '') + (d.complete ? ' is-done' : '');
      var mark = d.rest ? '☾' : (d.complete ? '✓' : String(d.position));
      return '<div class="' + cls + '"><span class="mpt-wd-mark">' + mark + '</span>' +
        '<span class="mpt-wd-lbl">' + escapeHtml(label) + '</span></div>';
    }).join('');
    return '<div class="mpt-week" aria-label="Week ' + week + ' schedule">' + cells + '</div>';
  }

  function overviewHtml(cfg, rec, week, P) {
    var out = '';
    if (cfg.desc) out += '<p class="mpt-lede">' + escapeHtml(cfg.desc) + '</p>';
    if (cfg.forWho) {
      out += section('Who this is for', '<p class="mpt-body">' + escapeHtml(cfg.forWho) + '</p>');
    }
    var strip = weekStripHtml(rec, week, cfg, P);
    if (strip) {
      var train = rec.perWeek - rec.rest.length;
      out += section('The week',
        '<p class="mpt-body mpt-body-tight">' + train + ' training days · ' +
        rec.rest.length + ' rest · ' + rec.weeks + '-week block</p>' + strip);
    }
    var eq = equipmentOf(cfg);
    if (eq.length) {
      out += section('Equipment', '<div class="mpt-chips">' + eq.map(function (e) {
        return '<span class="mpt-chip">' + escapeHtml(e.name) +
          '<span class="mpt-chip-n">' + e.n + '</span></span>';
      }).join('') + '</div>');
    }
    // F2 folds the full <id>-instructions.html body in here. Until then this
    // is a real entry point to it, not a placeholder for one.
    var links = '';
    if (cfg.guide && cfg.guide.href) {
      links += '<a class="mpt-link" href="' + escapeHtml(cfg.guide.href) + '">' +
        '<span class="mpt-link-ico">📋</span>' +
        '<span class="mpt-link-t">' + escapeHtml(cfg.guide.label || 'Program guide') + '</span>' +
        '<span class="mpt-link-arrow" aria-hidden="true">→</span></a>';
    }
    links += '<a class="mpt-link" href="program-guide.html">' +
      '<span class="mpt-link-ico">📚</span>' +
      '<span class="mpt-link-t">All program guides</span>' +
      '<span class="mpt-link-arrow" aria-hidden="true">→</span></a>';
    out += section('Learn the program', links);
    return out;
  }

  function rowHtml(r) {
    // The tick only exists once a day is banked. An always-present empty
    // circle reads as an unchecked checkbox, and tapping a row opens the
    // workout — it does not check anything.
    var tick = (r.kind === 'day' && r.complete)
      ? '<span class="mpt-row-tick is-done" aria-hidden="true">✓</span>' : '';
    var attrs = r.kind === 'day'
      ? ' data-mpt-day="' + escapeHtml(r.id) + '"'
      : ' data-mpt-group="' + escapeHtml(r.id) + '"';
    var label = r.name + (r.meta ? ', ' + r.meta : '') + (r.complete ? ', completed' : '');
    return '<button type="button" class="mpt-row' + (r.complete ? ' is-done' : '') + '"' + attrs +
      ' aria-label="' + escapeHtml(label) + '">' +
      '<span class="mpt-row-art" aria-hidden="true">' + escapeHtml(r.icon) + '</span>' +
      '<span class="mpt-row-body">' +
        '<span class="mpt-row-n">' + escapeHtml(r.name) + '</span>' +
        (r.meta ? '<span class="mpt-row-m">' + escapeHtml(r.meta) + '</span>' : '') +
      '</span>' + tick +
      '<span class="mpt-row-arrow" aria-hidden="true">›</span></button>';
  }

  function listHtml(cfg, model, week, canReorder) {
    var out = '';
    if (model.header) {
      out += '<div class="mpt-ctx">' +
        '<button type="button" class="mpt-back" data-mpt-act="back">← All splits</button>' +
        '<div class="mpt-ctx-t">' + escapeHtml(model.header.name) + '</div>' +
        (model.header.meta ? '<div class="mpt-ctx-m">' + escapeHtml(model.header.meta) + '</div>' : '') +
        (model.header.desc ? '<p class="mpt-ctx-d">' + escapeHtml(model.header.desc) + '</p>' : '') +
        '</div>';
    }
    if (model.level === 'days' && canReorder) {
      out += '<div class="mpt-listbar">' +
        '<span class="mpt-listbar-t">Week ' + week + '</span>' +
        '<button type="button" class="mpt-reorder" data-mpt-act="reorder">Reorder days</button>' +
        '</div>';
    }
    if (!model.rows.length) {
      out += '<p class="mpt-body">No workouts to show yet.</p>';
    } else {
      out += '<div class="mpt-rows">' + model.rows.map(rowHtml).join('') + '</div>';
    }
    return out;
  }

  // `list:false` renders Overview alone, with no tab bar at all — for a
  // program whose landing has exactly one destination (F1b decision). A tab
  // strip over a Program list holding a single row is a level of nothing, the
  // same reasoning that skips drill-in for a single group.
  function shellHtml(cfg) {
    var tab = function (key, label, sel) {
      return '<button type="button" role="tab" class="mpt-tab' + (sel ? ' is-on' : '') + '"' +
        ' id="mpt-t-' + key + '" aria-controls="mpt-p-' + key + '"' +
        ' aria-selected="' + (sel ? 'true' : 'false') + '" data-mpt-tab="' + key + '">' +
        escapeHtml(label) + '</button>';
    };
    var head = cfg.list === false ? '' :
      '<div class="mpt-tabs" role="tablist" aria-label="Program sections">' +
        tab('overview', 'Overview', true) + tab('list', 'Program list', false) +
      '</div>';
    var listPanel = cfg.list === false ? '' :
      '<div class="mpt-panel is-hidden" id="mpt-p-list" role="tabpanel" aria-labelledby="mpt-t-list"></div>';
    return '<div class="mpt' + (cfg.list === false ? ' mpt-solo' : '') +
      '" style="--mpt-accent:' + escapeHtml(cfg.accent || '#c9505a') +
      ';--mpt-accent-rgb:' + hexToRgb(cfg.accent) + ';">' +
      head +
      '<div class="mpt-panel" id="mpt-p-overview" role="tabpanel"' +
        (cfg.list === false ? '' : ' aria-labelledby="mpt-t-overview"') + '></div>' +
      listPanel +
      '</div>';
  }

  // ---- mount --------------------------------------------------------------
  function mount(el, cfg) {
    if (!el || !cfg) return null;
    var P = window.MC_PROGRAM_PROGRESS;
    // No `def` means the program has no schedule record (only `ss` has one
    // until F5, and a collection like a five-split library never will). Build
    // NO record in that case rather than letting normalize() invent defaults:
    // a fabricated 7-day / 2-rest week would render as this program's real
    // schedule, which is the same "invented pattern" that got the full hero
    // variant retired in F1a. Everything downstream already degrades cleanly —
    // no week strip, no day numbers, no ticks, no reorder.
    var state = {
      P: P,
      rec: cfg.rec || ((P && cfg.def) ? P.get(cfg.progId, cfg.def) : null),
      week: cfg.week || 1,
      openGroup: null,
      tab: 'overview'
    };
    if (P && state.rec && !cfg.week) state.week = P.weekOf(state.rec, P.currentDayFrom(state.rec));

    el.innerHTML = shellHtml(cfg);
    var root = el.querySelector('.mpt');
    var pOverview = el.querySelector('#mpt-p-overview');
    var pList = el.querySelector('#mpt-p-list');

    function drawOverview() { pOverview.innerHTML = overviewHtml(cfg, state.rec, state.week, P); }
    function drawList() {
      if (!pList) return;
      var model = listModel(cfg, state);
      // Reorder edits one week's order, which only means anything when the
      // record actually schedules these days.
      var canReorder = !!(P && state.rec && model.level === 'days' &&
        model.rows.some(function (r) { return r.day; }));
      pList.innerHTML = listHtml(cfg, model, state.week, canReorder);
    }
    function showTab(key) {
      if (!pList) return;                       // Overview-only: nothing to switch
      state.tab = key;
      Array.prototype.forEach.call(root.querySelectorAll('.mpt-tab'), function (b) {
        var on = b.getAttribute('data-mpt-tab') === key;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      pOverview.classList.toggle('is-hidden', key !== 'overview');
      pList.classList.toggle('is-hidden', key !== 'list');
    }

    // One delegated listener on the component root. `data-mpt-*` rather than
    // the `data-act` the D0-D3 drawer first used: mc-card-actions.js keeps its
    // own sheet hidden in the same document with the same values, and a
    // document-wide query opened the wrong one.
    root.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var tab = t.closest('[data-mpt-tab]');
      if (tab) { showTab(tab.getAttribute('data-mpt-tab')); return; }
      var act = t.closest('[data-mpt-act]');
      if (act) {
        var a = act.getAttribute('data-mpt-act');
        if (a === 'back') { state.openGroup = null; drawList(); }
        else if (a === 'reorder') { openReorder(); }
        return;
      }
      var grp = t.closest('[data-mpt-group]');
      if (grp) { state.openGroup = grp.getAttribute('data-mpt-group'); drawList(); return; }
      var day = t.closest('[data-mpt-day]');
      if (day) {
        var id = day.getAttribute('data-mpt-day');
        var row = null, model = listModel(cfg, state);
        for (var i = 0; i < model.rows.length; i++) if (model.rows[i].id === id) row = model.rows[i];
        if (row && row.complete && row.logId && cfg.onLog) cfg.onLog(id, row.logId);
        else if (cfg.onOpen) cfg.onOpen(id, state.week);
      }
    });

    // mc-program-menu.js owns the reorder sheet; `view` opens straight into it
    // rather than making the athlete walk the six-item root menu to reach the
    // control they just tapped. Its onChange takes no argument and mutates its
    // own cfg.rec, so the record is re-read from the store here.
    function openReorder() {
      var M = window.MC_PROGRAM_MENU;
      if (!M || !P || !state.rec) return;
      M.open({
        progId: cfg.progId, def: cfg.def, rec: state.rec, week: state.week,
        accent: cfg.accent, programName: cfg.programName || '',
        dayMeta: cfg.dayMeta,
        view: 'reorder',
        onNavigate: cfg.onNavigate,
        onChange: function () { refresh(); }
      });
    }

    function refresh(next) {
      if (next && next.rec) state.rec = next.rec;
      else if (P) state.rec = P.get(cfg.progId, cfg.def);
      if (next && next.week) state.week = next.week;
      drawOverview();
      drawList();
    }

    drawOverview();
    drawList();
    showTab('overview');

    return { refresh: refresh, showTab: showTab, model: function () { return listModel(cfg, state); } };
  }

  window.MC_PROGRAM_TABS = {
    mount: mount,
    listModel: listModel,
    hasDrillIn: hasDrillIn,
    dayNumber: dayNumber
  };

  // tools/test-mc-program-tabs.js drives this exact source in a vm-sandboxed
  // window (the test-mc-bridge.js technique), so the browser IIFE stays the
  // only runtime path and the test can never drift from what ships.
})();
