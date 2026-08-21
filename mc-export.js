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

   Wave 1 (audit G-02): the list below is NOT just mc-sync.js's STORES any
   more, and the old claim that it mirrored them had already drifted --
   mc_session_summary_v1 was synced but missing here, so a downloaded backup
   was missing data the app itself considered worth syncing. Backing a key up
   is strictly cheaper than syncing it (no merge, no conflict semantics), so
   some keys are deliberately export-only. store-registry.json is now the
   declared source of truth for which is which, and
   tools/check-store-coverage.js fails CI the moment this list, mc-sync.js's
   STORES, and the registry stop agreeing.
   ========================================================================== */
(function () {
  "use strict";
  if (window.MCExport) return;

  // Kept as a literal list rather than reading mc-sync.js's internals, since
  // that module returns early (no exported STORES) when Supabase isn't
  // configured — export/import must work regardless of that. Agreement with
  // mc-sync.js and store-registry.json is enforced by CI instead of by
  // convention, which is what the old "mirrors STORES" comment relied on.
  var KEYS = [
    // synced training data
    'mc_setlog_v1', 'mc_custom_workouts_v1',
    'mc_custom_programs_v1', 'mc_collections_v1', 'mc_workout_log_v1',
    'mc_cond_log_v1', 'mc_body_v1', 'mc_max_v1', 'mc_activity',
    'mc_daily_v1', 'mc_plan_targets_v1', 'mc_macros_v1',
    'mc_session_summary_v1',        // synced since B-era; was missing here
    'mc_custom_exercises_v1',       // G-01
    'mc_active_prog', 'mc_weekly_overrides_v1',
    // export-only: per-exercise personalization. Real user decisions worth
    // restoring, but not synced yet — these dicts carry no per-entry
    // timestamp, so a live merge needs a conflict rule of its own (owner
    // decision, K-1.3: back them up now, sync as a follow-up).
    'mc_replacements_global', 'mc_ex_notes', 'mc_ex_favs',
    'mc_ex_tempo', 'mc_ex_order', 'mc_personal_intensifiers'
  ];
  // Per-page swap keys are dynamic ('mc_replacements|<pageId>'), so they can
  // only be matched by prefix — a fixed list can never name them.
  var KEY_PREFIXES = ['mc_replacements|'];
  function isExportable(k) {
    if (KEYS.indexOf(k) >= 0) return true;
    for (var i = 0; i < KEY_PREFIXES.length; i++) {
      if (k.indexOf(KEY_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function exportJSON() {
    var data = {};
    var keys = KEYS.slice();
    // add whatever dynamic prefix keys this device actually has
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var lk = localStorage.key(i);
        if (lk && keys.indexOf(lk) < 0 && isExportable(lk)) keys.push(lk);
      }
    } catch (e) {}
    keys.forEach(function (k) {
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
          if (!isExportable(k)) return;   // ignore unrelated keys
          try { localStorage.setItem(k, JSON.stringify(data[k])); } catch (e) {}
        });
        resolve();
      };
      reader.readAsText(file);
    });
  }

  window.MCExport = { exportJSON: exportJSON, importJSON: importJSON };
})();
