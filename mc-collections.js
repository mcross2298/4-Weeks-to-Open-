/* ==========================================================================
   mc-collections.js — Collections / Folders (PM Module 8)
   --------------------------------------------------------------------------
   Tag-based grouping of custom workouts, independent of programs. A collection
   is the owner's own content (like custom programs/workouts): a small record
   in localStorage 'mc_collections_v1' (synced via mc-sync.js). A workout joins
   a collection by carrying `collection: <id>` (set in build-workout.html); a
   workout can still be program-assigned or Bonus — collection is an orthogonal
   tag.

     window.MC_COLLECTIONS
       .getAll() / .get(id) / .save(c) / .remove(id)
       .workoutsIn(id)            → member custom workouts, newest first
       .renderDashboardCards(el)  → one card per non-empty collection
       .renderLanding(el, id)     → the collection's workout list (module rows)
   ========================================================================== */
(function () {
  if (window.MC_COLLECTIONS) return;

  var KEY = 'mc_collections_v1';
  var WK_KEY = 'mc_custom_workouts_v1';

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function readWk() { try { return JSON.parse(localStorage.getItem(WK_KEY) || '[]') || []; } catch (e) { return []; } }
  function sync() { try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {} }
  function uid() { return 'col-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pubDate(w) { return w.publishedAt || w.created || ''; }

  var MUSCLE_EMOJI = {
    Chest: '🫁', Back: '🔙', Shoulders: '🏔️', Biceps: '💪', Triceps: '🦾', Arms: '💪',
    Legs: '🦵', Quads: '🦵', Hamstrings: '🍑', Glutes: '🍑', Calves: '🦿', Abs: '🔥',
    Core: '🔥', Forearms: '🤝', Cardio: '🏃', Traps: '🔝'
  };

  function getAll() { return read(); }
  function get(id) { return read().filter(function (c) { return c.id === id; })[0] || null; }
  function save(c) {
    var a = read();
    if (!c.id) { c.id = uid(); c.createdAt = new Date().toISOString(); }
    var i = a.findIndex(function (x) { return x.id === c.id; });
    if (i >= 0) a[i] = c; else a.unshift(c);
    write(a); sync();
    return c;
  }
  function remove(id) { write(read().filter(function (c) { return c.id !== id; })); sync(); }

  function workoutsIn(id) {
    return readWk().filter(function (w) { return w.collection === id; })
      .sort(function (a, b) { return pubDate(b).localeCompare(pubDate(a)); });
  }

  function summarize(w) {
    var n = (w.exercises || []).length;
    var muscles = [];
    (w.exercises || []).forEach(function (e) { if (e.muscle && muscles.indexOf(e.muscle) === -1) muscles.push(e.muscle); });
    return {
      emoji: MUSCLE_EMOJI[(w.exercises && w.exercises[0] && w.exercises[0].muscle)] || '🏋️',
      detail: muscles.slice(0, 4).join(' · ') || 'Custom workout',
      badge: n + ' ex'
    };
  }

  // One dashboard card per collection that has ≥1 workout. Mirrors the
  // dynamic-card pattern (renderCustomPrograms / Bonus).
  function renderDashboardCards(el) {
    el = el || document.getElementById('collectionsSlot');
    if (!el) return;
    var cols = read().filter(function (c) { return workoutsIn(c.id).length; });
    if (!cols.length) { el.innerHTML = ''; return; }
    el.innerHTML = cols.map(function (c) {
      var col = c.color || '#a855f7';
      var n = workoutsIn(c.id).length;
      return '<a href="collections.html?id=' + encodeURIComponent(c.id) + '" class="cat-card" ' +
        'style="border-color:' + col + '55;background:linear-gradient(135deg,' + col + '14,var(--surface,#0a0a0a));">' +
        '<span class="cat-icon">' + (c.icon || '🗂️') + '</span>' +
        '<div class="cat-tag" style="color:' + col + ';">Collection</div>' +
        '<div class="cat-name">' + esc(c.name) + '</div>' +
        '<div class="cat-meta">A folder of standalone workouts grouped by you.</div>' +
        '<div class="cat-count">' + n + ' workout' + (n !== 1 ? 's' : '') + ' →</div>' +
        '<div class="cat-designer">🗂️ Collection</div>' +
      '</a>';
    }).join('');
  }

  // Collection landing — module list of its workouts (same shape as Bonus).
  function renderLanding(el, id) {
    if (!el) return;
    var c = get(id);
    var items = workoutsIn(id);
    if (!c) { el.innerHTML = '<div class="bonus-empty">Collection not found.</div>'; return; }
    if (!items.length) {
      el.innerHTML = '<div class="bonus-empty">No workouts in “' + esc(c.name) + '” yet.<br>' +
        'Build a workout and pick this collection.<br><br><a class="bonus-cta" href="build-workout.html">＋ Build a Workout</a></div>';
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
          '<div class="module-icon">' + (c.icon || '🗂️') + '</div>' +
          '<div class="module-label"><div class="module-tag">Collection</div>' +
            '<div class="module-name">' + esc(c.name) + '</div>' +
            '<div class="module-count">' + items.length + ' workout' + (items.length !== 1 ? 's' : '') + '</div></div>' +
          '<div class="chevron">›</div>' +
        '</div>' +
        '<div class="drill"><div class="drill-inner"><div class="drill-divider"></div>' + rows + '</div></div>' +
      '</div>';
  }

  window.MC_COLLECTIONS = {
    getAll: getAll, get: get, save: save, remove: remove,
    workoutsIn: workoutsIn,
    renderDashboardCards: renderDashboardCards,
    renderLanding: renderLanding
  };
})();
