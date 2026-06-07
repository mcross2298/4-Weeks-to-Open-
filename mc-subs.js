/* ==========================================================================
   mc-subs.js  —  Global Exercise Substitution directory
   --------------------------------------------------------------------------
   Single source of truth for movement swaps across the Conditioning Corner
   workouts (The 500, Daily Driveway Beatdown, Hell Week). Rebuilt after the
   original dataset was lost.

   • window.MC_SUBS         — the directory data
   • window.MCSubs.listHTML()  — renders the directory markup (used by the
                                 dashboard Conditioning Corner + the sheet)
   • Auto-injects a floating "🔁 Swap" button + bottom sheet on any page that
     includes this script, UNLESS window.MC_SUBS_NO_BUTTON is truthy
     (the dashboard sets that flag — it renders the list inline instead).
   ========================================================================== */
(function () {
  window.MC_SUBS = [
    { name: 'Jump Rope', icon: '🪢',
      swaps: ['High knees (in place)', 'Jumping jacks', 'Mountain climbers', 'Treadmill / bike sprints', 'Speed skaters'] },
    { name: 'Pull-ups', icon: '🏋️',
      swaps: ['Inverted rows', 'Lat pulldown', 'Band-assisted pull-ups', 'Negatives (slow lower)', 'Dead hang + shrugs'] },
    { name: 'Pushups', icon: '💪',
      swaps: ['Knee pushups', 'Incline pushups (hands elevated)', 'Bench / floor press', 'Dips', 'Band chest press'] },
    { name: 'Squat Jumps', icon: '🦵',
      swaps: ['Bodyweight squats', 'Jump lunges', 'Box jumps', 'Kettlebell swings', 'Tuck jumps'] },
    { name: 'Heels to Heaven', icon: '🔥',
      swaps: ['Hanging knee raises', 'Lying leg raises', 'Flutter kicks', 'V-ups', 'Toes-to-bar'] },
    { name: 'Mountain Climbers', icon: '⛰️',
      swaps: ['Plank jacks', 'High knees', 'Burpees', 'Bear crawls'] },
    { name: 'Kettlebell Thrusts', icon: '🏐',
      swaps: ['Dumbbell thrusters', 'Goblet squat + press', 'Wall balls', 'Push press'] },
    { name: 'Walking Lunges', icon: '🚶',
      swaps: ['Reverse lunges', 'Split squats', 'Step-ups', 'Stationary lunges', 'Bulgarian split squats'] },
    { name: 'Burpees', icon: '💀',
      swaps: ['Squat thrusts (no jump)', 'Up-downs', 'Mountain climbers', 'Jumping jacks + squat'] }
  ];

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  window.MCSubs = {
    listHTML: function () {
      injectStyles();
      return '<div class="mcsubs-list">' + window.MC_SUBS.map(function (m) {
        return '<div class="mcsubs-item">' +
          '<div class="mcsubs-mv"><span class="mcsubs-ico">' + m.icon + '</span>' + esc(m.name) + '</div>' +
          '<div class="mcsubs-swaps">' + m.swaps.map(function (s) {
            return '<span class="mcsubs-chip">' + esc(s) + '</span>';
          }).join('') + '</div>' +
        '</div>';
      }).join('') + '</div>';
    },
    open: function () { var o = document.getElementById('mcsubsSheet'); if (o) o.classList.add('open'); },
    close: function () { var o = document.getElementById('mcsubsSheet'); if (o) o.classList.remove('open'); }
  };

  function injectStyles() {
    if (document.getElementById('mcsubs-style')) return;
    var css =
      '.mcsubs-fab{position:fixed;right:16px;bottom:152px;z-index:120;background:linear-gradient(135deg,#f97316,#e11d48);color:#fff;border:none;border-radius:24px;padding:11px 16px;font-size:13px;font-weight:900;letter-spacing:0.03em;box-shadow:0 6px 20px rgba(225,29,72,0.45);cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}' +
      '.mcsubs-fab:active{transform:scale(0.96);}' +
      '.mcsubs-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:none;align-items:flex-end;z-index:200;}' +
      '.mcsubs-overlay.open{display:flex;}' +
      '.mcsubs-sheet{width:100%;max-width:680px;margin:0 auto;background:#0e0e0e;border:1px solid rgba(255,255,255,0.1);border-radius:22px 22px 0 0;padding:18px 18px calc(20px + env(safe-area-inset-bottom));max-height:82vh;overflow-y:auto;}' +
      '.mcsubs-handle{width:42px;height:4px;border-radius:2px;background:rgba(255,255,255,0.2);margin:0 auto 14px;}' +
      '.mcsubs-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}' +
      '.mcsubs-title{font-size:18px;font-weight:900;color:#fff;letter-spacing:-0.01em;}' +
      '.mcsubs-x{background:transparent;border:none;color:#94a3b8;font-size:22px;cursor:pointer;font-family:inherit;line-height:1;}' +
      '.mcsubs-sub{font-size:12px;color:#94a3b8;margin-bottom:14px;line-height:1.4;}' +
      '.mcsubs-item{padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.07);}' +
      '.mcsubs-item:last-child{border-bottom:none;}' +
      '.mcsubs-mv{font-size:14px;font-weight:900;color:#f1f5f9;display:flex;align-items:center;gap:8px;margin-bottom:8px;}' +
      '.mcsubs-ico{font-size:17px;}' +
      '.mcsubs-swaps{display:flex;flex-wrap:wrap;gap:6px;}' +
      '.mcsubs-chip{font-size:12px;font-weight:700;color:#fed7aa;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:14px;padding:5px 11px;}';
    var st = document.createElement('style');
    st.id = 'mcsubs-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function injectButton() {
    if (document.getElementById('mcsubsFab')) return;
    injectStyles();
    var fab = document.createElement('button');
    fab.id = 'mcsubsFab';
    fab.className = 'mcsubs-fab';
    fab.innerHTML = '🔁 Swap';
    fab.onclick = window.MCSubs.open;
    document.body.appendChild(fab);

    var ov = document.createElement('div');
    ov.id = 'mcsubsSheet';
    ov.className = 'mcsubs-overlay';
    ov.addEventListener('click', function (e) { if (e.target === ov) window.MCSubs.close(); });
    ov.innerHTML =
      '<div class="mcsubs-sheet">' +
        '<div class="mcsubs-handle"></div>' +
        '<div class="mcsubs-hd"><div class="mcsubs-title">🔁 Substitutions</div>' +
          '<button class="mcsubs-x" onclick="MCSubs.close()">✕</button></div>' +
        '<div class="mcsubs-sub">Master swap directory — works for any conditioning routine. Pick an alternative if you lack the equipment or need a regression/progression.</div>' +
        window.MCSubs.listHTML() +
      '</div>';
    document.body.appendChild(ov);
  }

  if (!window.MC_SUBS_NO_BUTTON) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectButton);
    else injectButton();
  }
})();
