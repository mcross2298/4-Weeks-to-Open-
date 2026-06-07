/* ==========================================================================
   mc-subs.js  —  Conditioning exercise library + live per-workout swaps
   --------------------------------------------------------------------------
   • window.MC_SUBS_LIB  — the cardio/conditioning exercise library (browse +
                           swap picker source). Single source of truth, also
                           used by the dashboard "Conditioning Corner ▸ Exercises" tab.
   • window.MC_SUBS      — suggested swaps keyed by base movement name.
   • window.MCSwap       — per-page override store (localStorage). A swap renames
                           a movement's label on the current workout and persists.
   • window.MCSubs       — UI: the slide-up swap sheet (movement list → picker)
                           and libGroupsHTML() for the dashboard browse tab.

   A workout page opts in by defining BEFORE this script loads:
       window.MC_SWAP_MOVEMENTS = [{key, base, def}, ...]   // swappable movements
       window.MC_SWAP_ONCHANGE  = function(){ ...re-render... }
   If MC_SWAP_MOVEMENTS is absent (e.g. dashboard) no floating button is shown.
   ========================================================================== */
(function () {
  /* suggested swaps keyed by canonical movement name */
  window.MC_SUBS = {
    'Jump Rope':         ['High knees (in place)', 'Jumping jacks', 'Mountain climbers', 'Treadmill / bike sprints', 'Speed skaters'],
    'Pull-ups':          ['Inverted rows', 'Lat pulldown', 'Band-assisted pull-ups', 'Negatives (slow lower)', 'Dead hang + shrugs'],
    'Pushups':           ['Knee pushups', 'Incline pushups', 'Bench / floor press', 'Dips', 'Band chest press'],
    'Squat Jumps':       ['Bodyweight squats', 'Jump lunges', 'Box jumps', 'Kettlebell swings', 'Tuck jumps'],
    'Heels to Heaven':   ['Hanging knee raises', 'Lying leg raises', 'Flutter kicks', 'V-ups', 'Toes-to-bar'],
    'Mountain Climbers': ['Plank jacks', 'High knees', 'Burpees', 'Bear crawls'],
    'Kettlebell Thrusts':['Dumbbell thrusters', 'Goblet squat + press', 'Wall balls', 'Push press'],
    'Walking Lunges':    ['Reverse lunges', 'Split squats', 'Step-ups', 'Stationary lunges', 'Bulgarian split squats'],
    'Burpees':           ['Squat thrusts (no jump)', 'Up-downs', 'Mountain climbers', 'Jumping jacks + squat'],
    'Flutter Kicks':     ['Heels to heaven', 'Scissor kicks', 'Hollow hold', 'Leg raises'],
    'Bicycle Kicks':     ['Russian twists', 'Seated twists', 'Flutter kicks', 'Mountain climbers'],
    'Around the Worlds': ['Russian twists', 'Wood chops', 'Side bends', 'Plank reach'],
    'Mountain Climbers + KB Thrusts': ['Burpees', 'Squat thrusts', 'Thruster + knee drive']
  };

  /* the conditioning exercise library (browse + picker) */
  window.MC_SUBS_LIB = {
    Cardio: ['Jump Rope', 'High Knees', 'Jumping Jacks', 'Burpees', 'Mountain Climbers', 'Speed Skaters',
             'Box Jumps', 'Squat Jumps', 'Tuck Jumps', 'Battle Ropes', 'Row', 'Run', 'Bike Sprints', 'Walk the Line'],
    Core:   ['Heels to Heaven', 'Reverse Crunches', 'Flutter Kicks', 'Scissor Kicks', 'Hanging Leg Raises',
             'Lying Leg Raises', 'V-Ups', 'Toes-to-Bar', 'Plank', 'Side Plank', 'Hollow Hold', 'Bicycle Kicks',
             'Russian Twists', 'USA Twists', 'In & Outs', 'Sit-Ups (AMRAP)', 'Ab Wheel Rollout', 'Supermans', 'Around the Worlds'],
    Strength: ['Pull-ups', 'Inverted Rows', 'Lat Pulldown', 'Pushups', 'Knee Pushups', 'Incline Pushups', 'Dips',
               'Bench Press', 'Walking Lunges', 'Reverse Lunges', 'Split Squats', 'Step-ups', 'Bulgarian Split Squats',
               'Kettlebell Thrusts', 'Dumbbell Thrusters', 'Goblet Squat + Press', 'Wall Balls', 'Kettlebell Swings']
  };

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── per-page override store ── */
  window.MCSwap = {
    pageId: (location.pathname.split('/').pop().replace('.html','') || 'page'),
    _key: function () { return 'mc_cond_swaps|' + this.pageId; },
    map: function () { try { return JSON.parse(localStorage.getItem(this._key()) || '{}'); } catch (e) { return {}; } },
    name: function (key, def) { var m = this.map(); return m[key] || def; },
    isSwapped: function (key) { return !!this.map()[key]; },
    set: function (key, newName) {
      var m = this.map();
      if (newName) m[key] = newName; else delete m[key];
      try { localStorage.setItem(this._key(), JSON.stringify(m)); } catch (e) {}
      if (typeof window.MC_SWAP_ONCHANGE === 'function') window.MC_SWAP_ONCHANGE();
    }
  };

  window.MCSubs = {
    _view: 'list', _key: null, _base: null, _def: null, _q: '',

    libGroupsHTML: function (query, pickable) {
      injectStyles();
      query = (query || '').toLowerCase();
      var L = window.MC_SUBS_LIB, out = '';
      Object.keys(L).forEach(function (g) {
        var items = L[g].filter(function (n) { return !query || n.toLowerCase().indexOf(query) >= 0; });
        if (!items.length) return;
        out += '<div class="mcsubs-group"><div class="mcsubs-group-hd">' + g + '</div><div class="mcsubs-swaps">' +
          items.map(function (n) {
            var click = pickable ? (' onclick="MCSubs.pick(\'' + n.replace(/'/g, "\\'") + '\')"') : '';
            return '<span class="mcsubs-chip' + (pickable ? ' pickable' : '') + '"' + click + '>' + esc(n) + '</span>';
          }).join('') + '</div></div>';
      });
      return out || '<div class="mcsubs-sub">No matches.</div>';
    },

    open: function () { this._view = 'list'; this._q = ''; this.render(); var o = document.getElementById('mcsubsSheet'); if (o) o.classList.add('open'); },
    close: function () { var o = document.getElementById('mcsubsSheet'); if (o) o.classList.remove('open'); },

    openMovement: function (key, base, def) { this._view = 'pick'; this._key = key; this._base = base; this._def = def; this._q = ''; this.render(); },
    back: function () { this._view = 'list'; this.render(); },
    filter: function (q) { this._q = q; var el = document.getElementById('mcsubsLib'); if (el) el.innerHTML = this.libGroupsHTML(q, true); },
    pick: function (name) { MCSwap.set(this._key, name); this._view = 'list'; this.render(); },
    reset: function (key) { MCSwap.set(key, null); this.render(); },

    render: function () {
      var inner = document.getElementById('mcsubsInner'); if (!inner) return;
      if (this._view === 'pick') {
        var base = this._base, def = this._def;
        var sugg = (window.MC_SUBS[base] || []);
        var current = MCSwap.name(this._key, def);
        inner.innerHTML =
          '<div class="mcsubs-hd"><div class="mcsubs-title">↩ Replace ' + esc(def) + '</div>' +
            '<button class="mcsubs-x" onclick="MCSubs.back()">‹ Back</button></div>' +
          '<div class="mcsubs-sub">Currently: <b style="color:#fed7aa">' + esc(current) + '</b>' +
            (MCSwap.isSwapped(this._key) ? ' · <a href="#" onclick="MCSubs.reset(\'' + this._key + '\');return false" style="color:#fb7185;font-weight:800;text-decoration:none">reset</a>' : '') + '</div>' +
          (sugg.length ? '<div class="mcsubs-group"><div class="mcsubs-group-hd">Suggested</div><div class="mcsubs-swaps">' +
            sugg.map(function (n) { return '<span class="mcsubs-chip pickable" onclick="MCSubs.pick(\'' + n.replace(/'/g, "\\'") + '\')">' + esc(n) + '</span>'; }).join('') + '</div></div>' : '') +
          '<input class="mcsubs-search" placeholder="Search the conditioning library…" oninput="MCSubs.filter(this.value)">' +
          '<div id="mcsubsLib">' + this.libGroupsHTML('', true) + '</div>';
      } else {
        var movs = window.MC_SWAP_MOVEMENTS || [];
        inner.innerHTML =
          '<div class="mcsubs-hd"><div class="mcsubs-title">🔁 Substitute a movement</div>' +
            '<button class="mcsubs-x" onclick="MCSubs.close()">✕</button></div>' +
          '<div class="mcsubs-sub">Tap a movement to swap it for an alternative — the change applies live on this workout and is saved.</div>' +
          '<div class="mcsubs-list">' + movs.map(function (m) {
            var cur = MCSwap.name(m.key, m.def), sw = MCSwap.isSwapped(m.key);
            return '<div class="mcsubs-item pickable" onclick="MCSubs.openMovement(\'' + m.key + '\',\'' + (m.base || m.def).replace(/'/g, "\\'") + '\',\'' + m.def.replace(/'/g, "\\'") + '\')">' +
              '<div class="mcsubs-mv">' + esc(cur) + (sw ? ' <span class="mcsubs-swapped">⇄ swapped</span>' : '') + '</div>' +
              '<div class="mcsubs-sub2">' + (sw ? 'was ' + esc(m.def) : 'tap to swap') + ' ›</div>' +
            '</div>';
          }).join('') + '</div>';
      }
    }
  };

  function injectStyles() {
    if (document.getElementById('mcsubs-style')) return;
    var css =
      '.mcsubs-fab{position:fixed;right:16px;bottom:152px;z-index:120;background:linear-gradient(135deg,#f97316,#e11d48);color:#fff;border:none;border-radius:24px;padding:11px 16px;font-size:13px;font-weight:900;letter-spacing:0.03em;box-shadow:0 6px 20px rgba(225,29,72,0.45);cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}' +
      '.mcsubs-fab:active{transform:scale(0.96);}' +
      '.mcsubs-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;align-items:flex-end;z-index:200;}' +
      '.mcsubs-overlay.open{display:flex;}' +
      '.mcsubs-sheet{width:100%;max-width:680px;margin:0 auto;background:#0e0e0e;border:1px solid rgba(255,255,255,0.1);border-radius:22px 22px 0 0;padding:18px 18px calc(20px + env(safe-area-inset-bottom));max-height:84vh;overflow-y:auto;}' +
      '.mcsubs-handle{width:42px;height:4px;border-radius:2px;background:rgba(255,255,255,0.2);margin:0 auto 14px;}' +
      '.mcsubs-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:10px;}' +
      '.mcsubs-title{font-size:18px;font-weight:900;color:#fff;letter-spacing:-0.01em;}' +
      '.mcsubs-x{background:transparent;border:none;color:#94a3b8;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;line-height:1;white-space:nowrap;}' +
      '.mcsubs-sub{font-size:12px;color:#94a3b8;margin-bottom:14px;line-height:1.45;}' +
      '.mcsubs-sub2{font-size:11px;color:#64748b;font-weight:700;margin-top:2px;}' +
      '.mcsubs-search{width:100%;padding:11px 13px;border-radius:11px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#f1f5f9;font-size:14px;font-family:inherit;outline:none;margin:6px 0 14px;}' +
      '.mcsubs-search:focus{border-color:rgba(249,115,22,0.5);}' +
      '.mcsubs-list{display:flex;flex-direction:column;}' +
      '.mcsubs-item{padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.07);}' +
      '.mcsubs-item:last-child{border-bottom:none;}' +
      '.mcsubs-item.pickable{cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      '.mcsubs-item.pickable:active{opacity:0.6;}' +
      '.mcsubs-mv{font-size:15px;font-weight:900;color:#f1f5f9;display:flex;align-items:center;gap:8px;}' +
      '.mcsubs-swapped{font-size:10px;font-weight:800;color:#fed7aa;background:rgba(249,115,22,0.16);border:1px solid rgba(249,115,22,0.35);border-radius:10px;padding:2px 7px;letter-spacing:0.02em;}' +
      '.mcsubs-group{margin-bottom:12px;}' +
      '.mcsubs-group-hd{font-size:11px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#fb7185;margin:6px 0 8px;}' +
      '.mcsubs-swaps{display:flex;flex-wrap:wrap;gap:6px;}' +
      '.mcsubs-chip{font-size:12px;font-weight:700;color:#fed7aa;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:14px;padding:6px 12px;}' +
      '.mcsubs-chip.pickable{cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      '.mcsubs-chip.pickable:active{background:rgba(249,115,22,0.28);}';
    var st = document.createElement('style');
    st.id = 'mcsubs-style'; st.textContent = css;
    document.head.appendChild(st);
  }
  window.MCSubs.ensureStyles = injectStyles;

  function injectButton() {
    if (document.getElementById('mcsubsFab')) return;
    injectStyles();
    var fab = document.createElement('button');
    fab.id = 'mcsubsFab'; fab.className = 'mcsubs-fab'; fab.innerHTML = '🔁 Swap';
    fab.onclick = function () { window.MCSubs.open(); };
    document.body.appendChild(fab);

    var ov = document.createElement('div');
    ov.id = 'mcsubsSheet'; ov.className = 'mcsubs-overlay';
    ov.addEventListener('click', function (e) { if (e.target === ov) window.MCSubs.close(); });
    ov.innerHTML = '<div class="mcsubs-sheet"><div class="mcsubs-handle"></div><div id="mcsubsInner"></div></div>';
    document.body.appendChild(ov);
    window.MCSubs.render();
  }

  /* only show the floating swap tool on workout pages that registered movements */
  if (!window.MC_SUBS_NO_BUTTON && window.MC_SWAP_MOVEMENTS) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectButton);
    else injectButton();
  }
})();
