/* ==========================================================================
   mc-backup-status.js — "Backed up · 2m ago" indicator
   --------------------------------------------------------------------------
   Fills any #backupStatus placeholder with the live cloud-backup state from
   mc-sync.js. Signed out → shows nothing (the app is local-only by design).
   Requires mc-supabase.js + mc-sync.js to be loaded first.
   ========================================================================== */
(function () {
  var el = document.getElementById('backupStatus');
  if (!el) return;

  function ago(ts) {
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.round(h / 24) + 'd ago';
  }

  function render() {
    if (!window.MC_SYNC || !MC_SYNC.status) return;
    var st = MC_SYNC.status();
    if (!st.signedIn) { el.style.display = 'none'; return; }
    var txt, color;
    if (st.pending > 0) {
      txt = '☁️ Backing up…';
      color = '#94a3b8';
    } else if (st.lastPush || st.lastPull) {
      txt = '☁️ Backed up · ' + ago(Math.max(st.lastPush, st.lastPull));
      color = '#34d399';
    } else {
      txt = '☁️ Sync ready';
      color = '#94a3b8';
    }
    el.style.display = 'block';
    el.style.cssText += ';display:block;text-align:center;font-size:11px;font-weight:700;'
      + 'letter-spacing:0.04em;padding:6px 0;color:' + color + ';';
    el.textContent = txt;
  }

  render();
  setInterval(render, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') render();
  });
})();
