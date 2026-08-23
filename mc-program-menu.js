/* ==========================================================================
   mc-program-menu.js — program context drawer (the meatball menu)
   --------------------------------------------------------------------------
   program-day-view-roadmap.md, phase D2. The six-action sheet behind the
   top-right menu icon:

     All programs · Workout logs · Calendar ·
     Workout schedule · Reorder days · Restart program

   Built on the bottom-sheet markup mc-card-actions.css ALREADY defines
   (.mc-menu-overlay / .mc-sheet / .mc-sheet-title / .mc-item / .mc-ico) —
   this app has been through two audits about second implementations of a
   thing it already had (check-one-timer.js, check-single-impl.js), so the
   sheet chrome is reused rather than re-cut. Only the two inline editors
   below (schedule + reorder) add markup of their own, and they live inside
   the same sheet.

   The action attribute is `data-mpm-act`, NOT `data-act`, and that matters:
   mc-card-actions.js builds its own .mc-menu-overlay at load and leaves it
   in the DOM hidden, carrying `data-act="reorder"` and `data-act="cancel"`
   buttons of its own. Two sheets in one document using the same attribute
   with the same values means any document-wide query — a future refactor,
   a test, an automation script — silently addresses the wrong sheet. Found
   live: a driver clicking `[data-act="reorder"]` opened the card meatball's
   "Reorder exercises" instead of this drawer's "Reorder days". The listeners
   here are scoped to this sheet either way, so nothing was broken at
   runtime; the namespace removes the ambiguity rather than relying on
   every future caller to scope correctly.

   Reorder is drag-and-drop where a pointer supports it, but every row also
   carries real ▲/▼ buttons: drag-only reordering is unreachable by keyboard
   and unreliable on a sweaty gym-floor touchscreen, which is the same
   reasoning that turned the rest-timer chip into a real <button>.

   Usage:
     MC_PROGRAM_MENU.open({
       rec, week, accent, programName,
       dayMeta: fn(workoutId) -> { title, icon },
       onNavigate: fn(action),   // 'programs' | 'logs' | 'calendar'
       onChange:   fn()          // state was written; re-render the page
     })
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_PROGRAM_MENU) return;

  var OVERLAY_ID = 'mcProgMenu';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ICONS = {
    programs: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    logs: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15.5l2 2 4-4"/>',
    reorder: '<path d="M7 4v16M7 20l-3-3M7 20l3-3"/><path d="M17 20V4M17 4l-3 3M17 4l3 3"/>',
    restart: '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4v5h5"/>'
  };
  function ico(key) {
    return '<svg class="mpm-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + (ICONS[key] || '') + '</svg>';
  }

  // ---- overlay plumbing ----------------------------------------------------

  function ensureOverlay() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.className = 'mc-menu-overlay mpm-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Program menu');
    document.body.appendChild(ov);
    // Backdrop tap closes; a tap inside the sheet must not.
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) close();
    });
    return ov;
  }

  var lastFocus = null;

  function close() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov) { ov.classList.remove('open'); ov.innerHTML = ''; }
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  function onKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); close(); }
  }

  function show(html, accent) {
    var ov = ensureOverlay();
    ov.style.setProperty('--mpm-accent', accent || '#c9505a');
    ov.innerHTML = '<div class="mc-sheet mpm-sheet">' + html + '</div>';
    ov.classList.add('open');
    document.addEventListener('keydown', onKey);
    var first = ov.querySelector('button:not([disabled])');
    if (first && first.focus) { try { first.focus(); } catch (e) {} }
    return ov;
  }

  function item(action, key, label, sub) {
    return '<button type="button" class="mc-item mpm-item" data-mpm-act="' + escapeHtml(action) + '">' +
      ico(key) +
      '<span class="mpm-item-text"><span class="mpm-item-lbl">' + escapeHtml(label) + '</span>' +
      (sub ? '<span class="mpm-item-sub">' + escapeHtml(sub) + '</span>' : '') +
      '</span></button>';
  }

  // ---- root menu -----------------------------------------------------------

  function rootHtml(cfg) {
    var rec = cfg.rec;
    var trainPerWeek = (rec.perWeek || 7) - ((rec.rest || []).length);
    return '<div class="mc-sheet-title">' + escapeHtml(cfg.programName || 'Program') + '</div>' +
      item('programs', 'programs', 'All programs', 'Jump to the full library') +
      item('logs', 'logs', 'Workout logs', 'History for this program') +
      item('calendar', 'calendar', 'Calendar', 'Monthly overview') +
      item('schedule', 'schedule', 'Workout schedule', trainPerWeek + ' training days a week') +
      item('reorder', 'reorder', 'Reorder days', 'Week ' + (cfg.week || 1)) +
      item('restart', 'restart', 'Restart program', 'Back to Day 1') +
      '<button type="button" class="mc-item mc-item-cancel mpm-item" data-mpm-act="close">Cancel</button>';
  }

  // ---- workout schedule (rest-day pattern) --------------------------------

  function scheduleHtml(cfg) {
    var rec = cfg.rec;
    var perWeek = rec.perWeek || 7;
    var rows = '';
    for (var p = 1; p <= perWeek; p++) {
      var resting = (rec.rest || []).indexOf(p) >= 0;
      rows += '<button type="button" class="mpm-toggle' + (resting ? ' is-rest' : '') + '" ' +
        'data-pos="' + p + '" role="switch" aria-checked="' + (resting ? 'true' : 'false') + '">' +
        '<span class="mpm-toggle-pos">Day ' + p + '</span>' +
        '<span class="mpm-toggle-state">' + (resting ? 'Rest' : 'Train') + '</span>' +
        '</button>';
    }
    return '<div class="mc-sheet-title">Workout schedule</div>' +
      '<p class="mpm-note">Tap a day to switch it between training and rest. This changes your ' +
      'schedule only — the program itself is never edited.</p>' +
      '<div class="mpm-toggles">' + rows + '</div>' +
      '<button type="button" class="mc-item mc-item-cancel mpm-item" data-mpm-act="root">Done</button>';
  }

  // ---- reorder days --------------------------------------------------------

  function reorderHtml(cfg) {
    var P = window.MC_PROGRAM_PROGRESS;
    var rec = cfg.rec;
    var week = cfg.week || 1;
    var order = P.orderForWeek(rec, week);
    var rows = order.map(function (id, i) {
      var meta = (typeof cfg.dayMeta === 'function' ? cfg.dayMeta(id) : null) || {};
      return '<li class="mpm-row" draggable="true" data-id="' + escapeHtml(id) + '" data-i="' + i + '">' +
        '<span class="mpm-row-grip" aria-hidden="true">⠿</span>' +
        '<span class="mpm-row-ico" aria-hidden="true">' + escapeHtml(meta.icon || '🏋️') + '</span>' +
        '<span class="mpm-row-name">' + escapeHtml(meta.title || id) + '</span>' +
        '<span class="mpm-row-btns">' +
        '<button type="button" class="mpm-move" data-dir="-1" data-i="' + i + '"' +
        (i === 0 ? ' disabled' : '') + ' aria-label="Move ' + escapeHtml(meta.title || id) + ' up">▲</button>' +
        '<button type="button" class="mpm-move" data-dir="1" data-i="' + i + '"' +
        (i === order.length - 1 ? ' disabled' : '') + ' aria-label="Move ' + escapeHtml(meta.title || id) + ' down">▼</button>' +
        '</span></li>';
    }).join('');

    return '<div class="mc-sheet-title">Reorder days &middot; Week ' + week + '</div>' +
      '<p class="mpm-note">Drag a day, or use the arrows. Only this week changes.</p>' +
      '<ul class="mpm-list">' + rows + '</ul>' +
      '<div class="mpm-row-actions">' +
      '<button type="button" class="mc-item mpm-item mpm-reset" data-mpm-act="reorder-reset">Reset to program order</button>' +
      '<button type="button" class="mc-item mc-item-cancel mpm-item" data-mpm-act="root">Done</button>' +
      '</div>';
  }

  // ---- wiring --------------------------------------------------------------

  function openRoot(cfg) {
    var ov = show(rootHtml(cfg), cfg.accent);
    ov.querySelector('.mpm-sheet').onclick = function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-mpm-act]') : null;
      if (!btn) return;
      var act = btn.getAttribute("data-mpm-act");
      if (act === 'close') { close(); return; }
      if (act === 'schedule') { openSchedule(cfg); return; }
      if (act === 'reorder') { openReorder(cfg); return; }
      if (act === 'restart') { doRestart(cfg); return; }
      close();
      if (typeof cfg.onNavigate === 'function') cfg.onNavigate(act);
    };
  }

  function openSchedule(cfg) {
    var P = window.MC_PROGRAM_PROGRESS;
    var ov = show(scheduleHtml(cfg), cfg.accent);
    ov.querySelector('.mpm-sheet').onclick = function (ev) {
      var back = ev.target.closest ? ev.target.closest('[data-mpm-act="root"]') : null;
      if (back) { openRoot(cfg); return; }
      var t = ev.target.closest ? ev.target.closest('.mpm-toggle') : null;
      if (!t) return;
      var pos = parseInt(t.getAttribute('data-pos'), 10);
      var rest = (cfg.rec.rest || []).slice();
      var at = rest.indexOf(pos);
      if (at >= 0) rest.splice(at, 1); else rest.push(pos);

      var before = (cfg.rec.rest || []).join(',');
      cfg.rec = P.setRest(cfg.progId, rest, cfg.def);
      // setRest refuses an all-rest week; say so rather than silently
      // no-op'ing the tap the athlete just made.
      if (cfg.rec.rest.join(',') === before) {
        var note = ov.querySelector('.mpm-note');
        if (note) note.textContent = 'Keep at least one training day in the week.';
        return;
      }
      openSchedule(cfg);
      if (typeof cfg.onChange === 'function') cfg.onChange();
    };
  }

  function applyOrder(cfg, order) {
    var P = window.MC_PROGRAM_PROGRESS;
    cfg.rec = P.reorderWeek(cfg.progId, cfg.week, order, cfg.def);
    openReorder(cfg);
    if (typeof cfg.onChange === 'function') cfg.onChange();
  }

  function openReorder(cfg) {
    var P = window.MC_PROGRAM_PROGRESS;
    var ov = show(reorderHtml(cfg), cfg.accent);
    var sheet = ov.querySelector('.mpm-sheet');
    var list = sheet.querySelector('.mpm-list');

    sheet.onclick = function (ev) {
      var back = ev.target.closest ? ev.target.closest('[data-mpm-act="root"]') : null;
      if (back) { openRoot(cfg); return; }
      var reset = ev.target.closest ? ev.target.closest('[data-mpm-act="reorder-reset"]') : null;
      if (reset) { applyOrder(cfg, null); return; }

      var mv = ev.target.closest ? ev.target.closest('.mpm-move') : null;
      if (!mv || mv.disabled) return;
      var i = parseInt(mv.getAttribute('data-i'), 10);
      var dir = parseInt(mv.getAttribute('data-dir'), 10);
      var order = P.orderForWeek(cfg.rec, cfg.week).slice();
      var j = i + dir;
      if (j < 0 || j >= order.length) return;
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      applyOrder(cfg, order);
    };

    // Drag-and-drop, on top of the arrows above — never instead of them.
    var dragId = null;
    list.addEventListener('dragstart', function (ev) {
      var row = ev.target.closest ? ev.target.closest('.mpm-row') : null;
      if (!row) return;
      dragId = row.getAttribute('data-id');
      row.classList.add('is-dragging');
      try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', dragId); } catch (e) {}
    });
    list.addEventListener('dragend', function () {
      var d = list.querySelector('.is-dragging');
      if (d) d.classList.remove('is-dragging');
      dragId = null;
    });
    list.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    list.addEventListener('drop', function (ev) {
      ev.preventDefault();
      var row = ev.target.closest ? ev.target.closest('.mpm-row') : null;
      if (!row || !dragId) return;
      var target = row.getAttribute('data-id');
      if (target === dragId) return;
      var order = P.orderForWeek(cfg.rec, cfg.week).slice();
      var from = order.indexOf(dragId), to = order.indexOf(target);
      if (from < 0 || to < 0) return;
      order.splice(from, 1);
      order.splice(to, 0, dragId);
      applyOrder(cfg, order);
    });
  }

  function doRestart(cfg) {
    // The one destructive action in this sheet. D-2's lesson (the app's
    // zero-confirmation "Exit & discard") is that a destructive control names
    // exactly what it is about to remove.
    var P = window.MC_PROGRAM_PROGRESS;
    var done = Object.keys(cfg.rec.completed || {}).length;
    var msg = done
      ? 'Restart ' + (cfg.programName || 'this program') + '?\n\n' + done +
        ' completed day' + (done === 1 ? '' : 's') + ' will be cleared and you will go back to Day 1.\n\n' +
        'Your workout history and logged sets are NOT deleted.'
      : 'Restart ' + (cfg.programName || 'this program') + ' back to Day 1?';
    if (!window.confirm(msg)) return;
    cfg.rec = P.restart(cfg.progId, cfg.def);
    close();
    if (typeof cfg.onChange === 'function') cfg.onChange();
  }

  function open(cfg) {
    if (!cfg || !cfg.rec || !window.MC_PROGRAM_PROGRESS) return;
    lastFocus = document.activeElement;
    openRoot(cfg);
  }

  window.MC_PROGRAM_MENU = { open: open, close: close };
})();
