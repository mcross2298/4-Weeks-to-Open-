/* ==========================================================================
   mc-export.js  —  logged-out backup: export/import training data as JSON
   --------------------------------------------------------------------------
   Symmetric with Mikes-Cookbook's mc-export.js (Phase 1.3 durability): signing
   in (mc-account.js/mc-sync.js) already syncs this data to Supabase, but
   accounts are invite-only, so this gives anyone a manual, no-account way to
   back up and restore. Exports exactly the keys mc-sync.js already tracks as
   "data worth syncing" (its STORES whitelist) — same authoritative list, no
   separate key list to keep in sync.

   Exposed as window.MCExport = { exportJSON(), importJSON(file) }.
   ========================================================================== */
(function () {
  "use strict";
  if (window.MCExport) return;

  // Mirrors mc-sync.js's STORES keys. Kept as a literal list rather than
  // reading mc-sync.js's internals, since that module returns early (no
  // exported STORES) when Supabase isn't configured — export/import must
  // work regardless of that.
  var KEYS = [
    'mc_setlog_v1', 'mc_custom_workouts_v1',
    'mc_custom_programs_v1', 'mc_collections_v1', 'mc_workout_log_v1',
    'mc_cond_log_v1', 'mc_body_v1', 'mc_max_v1', 'mc_activity',
    'mc_daily_v1', 'mc_plan_targets_v1', 'mc_macros_v1'
  ];

  function exportJSON() {
    var data = {};
    KEYS.forEach(function (k) {
      var raw = localStorage.getItem(k);
      if (raw == null) return;
      try { data[k] = JSON.parse(raw); } catch (e) { data[k] = raw; }
    });
    var payload = { app: '4-weeks-to-open', exportedAt: new Date().toISOString(), data: data };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mc-training-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importJSON(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read the file.')); };
      reader.onload = function () {
        var payload;
        try { payload = JSON.parse(reader.result); }
        catch (e) { reject(new Error('Not a valid backup file.')); return; }
        var data = payload && payload.data;
        if (!data || typeof data !== 'object') { reject(new Error('Not a valid backup file.')); return; }
        Object.keys(data).forEach(function (k) {
          if (KEYS.indexOf(k) < 0) return;   // ignore unrelated keys
          try { localStorage.setItem(k, JSON.stringify(data[k])); } catch (e) {}
        });
        resolve();
      };
      reader.readAsText(file);
    });
  }

  window.MCExport = { exportJSON: exportJSON, importJSON: importJSON };
})();
