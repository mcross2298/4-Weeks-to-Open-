/* ==========================================================================
   mc-bonus-routing.js — automated "Bonus Workouts" routing (PM Phase 1)
   --------------------------------------------------------------------------
   A custom workout (build-workout.html → localStorage 'mc_custom_workouts_v1')
   that is published WITHOUT being assigned to a core program is a "bonus"
   workout. This module is the routing engine the design doc calls for: it
   catches unassigned workouts and surfaces them — with no manual linking step
   — in a permanent "Bonus Workouts" container, newest first
   (SortOrder: Descending by publish date).

   No server is needed; the app is a static PWA, so the "backend pipeline" is
   this client-side router over the synced custom-workout store. State lives ON
   the workout object (program / publishedAt), so mc-sync.js carries it like
   any other custom-workout field. Nothing here rewrites logs or authored HTML.

     window.MC_BONUS
       .list()                  → bonus workouts, newest first
       .route(wk)               → stamp routing fields on a freshly-built wk
       .assign(id, programId)   → (re)assign; falsy programId ⇒ back to bonus
       .renderDashboardCard(el) → paint the dashboard container card (or hide)
       .renderLanding(el)       → paint the bonus-workouts.html module list
       .CONTAINER               → { name, icon, accent } for the container
   ========================================================================== */
(function () {
  if (window.MC_BONUS) return;

  var KEY = 'mc_custom_workouts_v1';

  // Permanent container identity. Plain, original strings only (leak-safe —
  // no brand terms). Blue matches the existing `.cat-card.bonus` dashboard style.
  var CONTAINER = { name: 'Bonus Workouts', icon: '🎁', accent: '#38bdf8' };

  // muscle → row emoji (best-effort; falls back to a dumbbell)
  var MUSCLE_EMOJI = {
    Chest: '🫁', Back: '🔙', Shoulders: '🏔️', Biceps: '💪', Triceps: '🦾',
    Arms: '💪', Legs: '🦵', Quads: '🦵', Hamstrings: '🍑', Glutes: '🍑',
    Calves: '🦿', Abs: '🔥', Core: '🔥', Forearms: '🤝', Cardio: '🏃', Traps: '🔝'
  };

  // Raw store, deletion records included -- for read-modify-write, so writing
  // back cannot drop one (council audit fix 2). live() is what lists show.
  function read() {
    try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function live() { return read().filter(function (w) { return w && typeof w === 'object' && !w.deleted; }); }
  // Council audit cleanup: a failed write of athlete data used to vanish in an
  // empty catch. MC_LOG.writeStore (mc-log-read.js) shows the storage-full
  // banner and records it in Diagnostics; without that module the old quiet
  // fallback stands. Returns whether the write landed.
  function write(a) {
    var _v = JSON.stringify(a);
    if (window.MC_LOG && typeof window.MC_LOG.writeStore === 'function') return window.MC_LOG.writeStore(KEY, _v);
    try { localStorage.setItem(KEY, _v); return true; } catch (e) { return false; }
  }
  function sync() { try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {} }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // A workout is "bonus" when it carries no core-program assignment.
  function isBonus(w) { return !!w && !w.program; }
  function publishDate(w) { return w.publishedAt || w.created || ''; }

  // Stamp the routing fields a freshly-built workout needs. The builder still
  // owns writing the store; this only normalizes the bonus-relevant fields so
  // an unassigned workout sorts and renders correctly everywhere.
  function route(wk) {
    if (!wk) return wk;
    if (!wk.program) wk.program = '';                 // '' ⇒ bonus
    if (!wk.publishedAt) wk.publishedAt = wk.created || new Date().toISOString();
    return wk;
  }

  // Bonus workouts, descending by publish date (newest at top).
  function list() {
    return live().filter(isBonus).sort(function (a, b) {
      return publishDate(b).localeCompare(publishDate(a));
    });
  }

  // (Re)assign a workout to a program. Empty/falsy ⇒ routes back to bonus.
  function assign(id, programId) {
    var all = read(), changed = false;
    for (var i = 0; i < all.length; i++) {
      if (all[i] && all[i].id === id && !all[i].deleted) {
        all[i].program = programId || '';
        all[i].updatedAt = new Date().toISOString();   // an edit in place: see mc-sync.js mergeArrayByIdTs
        if (!all[i].publishedAt) all[i].publishedAt = all[i].created || new Date().toISOString();
        changed = true;
        break;
      }
    }
    if (changed) { write(all); sync(); }
    return changed;
  }

  function summarize(w) {
    var n = (w.exercises || []).length;
    var muscles = [];
    (w.exercises || []).forEach(function (e) {
      if (e.muscle && muscles.indexOf(e.muscle) === -1) muscles.push(e.muscle);
    });
    return {
      count: n,
      emoji: MUSCLE_EMOJI[(w.exercises && w.exercises[0] && w.exercises[0].muscle)] || '🏋️',
      detail: muscles.slice(0, 4).join(' · ') || 'Custom workout',
      badge: n + ' ex'
    };
  }

  // Dashboard container card — rendered only when ≥1 bonus workout exists.
  // Mirrors the dashboard's `.cat-card.bonus` style + the dynamic-card pattern
  // used by renderCustomPrograms().
  function renderDashboardCard(el) {
    el = el || document.getElementById('bonusCardSlot');
    if (!el) return;
    var items = list();
    if (!items.length) { el.innerHTML = ''; return; }
    el.innerHTML =
      '<a href="bonus-workouts.html" class="cat-card bonus">' +
        '<span class="cat-icon">' + CONTAINER.icon + '</span>' +
        '<div class="cat-tag">Auto-collected · Standalone</div>' +
        '<div class="cat-name">' + esc(CONTAINER.name) + '</div>' +
        '<div class="cat-meta">Standalone sessions not tied to a program — newest first. ' +
          'Publish a workout without assigning it and it lands here automatically.</div>' +
        '<div class="cat-count">' + items.length + ' workout' + (items.length !== 1 ? 's' : '') + ' →</div>' +
        '<div class="cat-designer">✍️ Auto-collected</div>' +
      '</a>';
  }

  // bonus-workouts.html landing — one collapsible module listing every bonus
  // workout as a workout-row (newest first). Self-contained markup; the page
  // supplies the matching CSS + toggle().
  function renderLanding(el) {
    if (!el) return;
    var items = list();
    if (!items.length) {
      el.innerHTML = '<div class="bonus-empty">No bonus workouts yet.<br>' +
        'Build a workout and leave it unassigned — it shows up here automatically.<br><br>' +
        '<a class="bonus-cta" href="build-workout.html">＋ Build a Workout</a></div>';
      return;
    }
    var rows = items.map(function (w) {
      var s = summarize(w);
      return '<a href="run-workout.html?id=' + encodeURIComponent(w.id) + '" class="workout-row">' +
        '<div class="row-emoji">' + s.emoji + '</div>' +
        '<div class="row-text"><div class="row-name">' + esc(w.name) + '</div>' +
        '<div class="row-detail">' + esc(s.detail) + '</div></div>' +
        '<div class="row-badge">' + s.badge + '</div><div class="row-arrow">›</div></a>';
    }).join('');
    el.innerHTML =
      '<div class="module m-bonus open" onclick="toggle(this)">' +
        '<div class="module-header">' +
          '<div class="module-icon">' + CONTAINER.icon + '</div>' +
          '<div class="module-label">' +
            '<div class="module-tag">Bonus</div>' +
            '<div class="module-name">Bonus Workouts</div>' +
            '<div class="module-count">' + items.length + ' workout' + (items.length !== 1 ? 's' : '') + '</div>' +
          '</div>' +
          '<div class="chevron">›</div>' +
        '</div>' +
        '<div class="drill"><div class="drill-inner"><div class="drill-divider"></div>' + rows + '</div></div>' +
      '</div>';
  }

  window.MC_BONUS = {
    CONTAINER: CONTAINER,
    list: list,
    route: route,
    assign: assign,
    isBonus: isBonus,
    renderDashboardCard: renderDashboardCard,
    renderLanding: renderLanding
  };
})();
