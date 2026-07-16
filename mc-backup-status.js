/* ==========================================================================
   mc-backup-status.js — "Backed up · 2m ago" indicator
   --------------------------------------------------------------------------
   Fills any #backupStatus placeholder with the live cloud-backup state from
   mc-sync.js. Signed out → shows nothing (the app is local-only by design).
   Requires mc-supabase.js + mc-sync.js to be loaded first.

   Roadmap B4 (cookbook<->workout bridge) — byte-identical shared module in
   both repos, same convention as mc-bridge.js. The element is looked up FRESH
   on every render() call rather than cached once at load: 4-Weeks-to-Open-'s
   dashboard.html keeps a stable DOM so either approach would work there, but
   Mikes-Cookbook's cookbook-home.js is a hub-and-spoke SPA that rebuilds
   Home's whole DOM (`s.innerHTML = ""`) on every visit, so a cached reference
   would go stale (pointing at a detached node) after the first re-render.
   ========================================================================== */
(function () {
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
    var el = document.getElementById('backupStatus');
    if (!el) return;
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

  // Explicit refresh hook — Mikes-Cookbook's cookbook-home.js calls this right
  // after re-creating the #backupStatus placeholder on every Home render, so
  // the status shows immediately instead of waiting up to 15s for the next
  // interval tick. Unused (but harmless) on the workout app's stable-DOM page.
  window.MC_BACKUP_STATUS = { refresh: render };
})();
