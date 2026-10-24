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
    'mc_cond_log_v1', 'mc_body_v1', 'mc_vitals_v1', 'mc_max_v1', 'mc_activity',
    'mc_daily_v1', 'mc_plan_targets_v1', 'mc_macros_v1',
    'mc_session_summary_v1',        // synced since B-era; was missing here
    'mc_workout_log_deleted_v1',    // flagship readiness R1 / D-24
    'mc_custom_exercises_v1',       // G-01
    'mc_active_prog', 'mc_weekly_overrides_v1',
    'mc_program_progress_v1',       // program-day-view-roadmap.md D0
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

  // Flagship readiness R1 / D-14: restoring a backup REPLACED every store
  // with the file's copy, with no confirmation — so restoring last month's
  // backup silently erased every workout finished since. Measured: three
  // workouts and a backup, one more workout, restore, and the newest was gone.
  //
  // Now the import is planned first, shown, and applied only on confirm:
  //   * the workout log is MERGED by identity (mc-log-read.js's
  //     mergeWorkoutLogs): every workout on this device is kept, the backup
  //     adds what is missing, and a workout deleted on this device stays
  //     deleted. Deletion records from both sides are unioned.
  //   * the set log is merged with mc-sync.js's own mergeSetlog — the same
  //     rule a pull applies — so per-set history since the backup survives.
  //   * every other store is still restored from the file, as before, and the
  //     preview names them so that is a choice rather than a surprise. Making
  //     those merge-safe too is R7's data-mobility work, not this step.
  var WL = 'mc_workout_log_v1', WLD = 'mc_workout_log_deleted_v1', SL = 'mc_setlog_v1';

  function readJSON(k, fallback) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function isDict(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function planImport(data, exportedAt) {
    var L = window.MC_LOG;
    var del = {};
    [readJSON(WLD, {}), data[WLD]].forEach(function (d) {
      if (isDict(d)) Object.keys(d).forEach(function (k) {
        if (!del[k] || ((d[k] && d[k].ts) || 0) > ((del[k] && del[k].ts) || 0)) del[k] = d[k];
      });
    });
    var plan = { writes: {}, workouts: null, setlogMerged: false, replaced: [], exportedAt: exportedAt };
    if (WL in data) {
      if (!L || !L.mergeWorkoutLogs) throw new Error('This page cannot import workouts safely. Open the dashboard and try again.');
      var r = L.mergeWorkoutLogs(L.readWorkoutLog(), data[WL], del);
      plan.workouts = r;
      plan.workouts.inBackup = Array.isArray(data[WL]) ? data[WL].length : 0;
      plan.workouts.onDevice = L.readWorkoutLog().length;
    }
    if (Object.keys(del).length) plan.writes[WLD] = del;
    if (SL in data && isDict(data[SL])) {
      var local = readJSON(SL, {});
      if (!isDict(local)) local = {};
      var merged;
      if (window.MC_MERGE && MC_MERGE.mergeSetlog) merged = MC_MERGE.mergeSetlog(local, data[SL]);
      else { merged = {}; Object.keys(data[SL]).forEach(function (k) { merged[k] = data[SL][k]; });
             Object.keys(local).forEach(function (k) { merged[k] = local[k]; }); }   // device wins per exercise
      plan.writes[SL] = merged;
      plan.setlogMerged = true;
    }
    Object.keys(data).forEach(function (k) {
      if (!isExportable(k) || k === WL || k === WLD || k === SL) return;
      plan.writes[k] = data[k];
      plan.replaced.push(k);
    });
    return plan;
  }

  function describe(plan) {
    var when = plan.exportedAt ? new Date(plan.exportedAt) : null;
    var lines = ['Restore from this backup' +
      (when && !isNaN(when) ? ' (saved ' + when.toLocaleDateString() + ')' : '') + '?', ''];
    var w = plan.workouts;
    if (w) {
      lines.push('Workouts: ' + w.added + ' added from the backup, ' + w.onDevice +
        ' on this device kept.');
      if (w.skippedDeleted) lines.push(w.skippedDeleted + ' skipped — you deleted ' +
        (w.skippedDeleted === 1 ? 'it' : 'them') + ' on this device.');
      if (w.dropped) lines.push(w.dropped + ' oldest left out — history keeps the latest 200.');
    }
    if (plan.setlogMerged) lines.push('Set history: merged. Nothing on this device is removed.');
    if (plan.replaced.length) {
      lines.push('', 'Replaced with the backup’s copy (' + plan.replaced.length + '): ' +
        plan.replaced.map(function (k) { return k.replace(/^mc_/, '').replace(/_v\d+$/, '').replace(/[_|]/g, ' '); }).join(', ') + '.');
    }
    return lines.join('\n');
  }

  function applyPlan(plan) {
    var L = window.MC_LOG;
    var ok = true;
    function put(k, v) {
      var s = JSON.stringify(v);
      if (L && L.writeStore) { if (!L.writeStore(k, s)) ok = false; }
      else { try { localStorage.setItem(k, s); } catch (e) { ok = false; } }
    }
    // Deletion records first, for the same reason deleteWorkouts() writes
    // them first: a partial import must never let a sync resurrect anything.
    if (plan.writes[WLD]) put(WLD, plan.writes[WLD]);
    Object.keys(plan.writes).forEach(function (k) { if (k !== WLD) put(k, plan.writes[k]); });
    if (plan.workouts && !L.writeWorkoutLog(plan.workouts.log)) ok = false;
    return ok;
  }

  // opts.confirm: injectable for tests. It may return a boolean or a Promise;
  // the default is the in-app confirm (mc-sheet.js, flagship readiness R5).
  function importJSON(file, opts) {
    var ask = (opts && opts.confirm) || function (t) {
      return window.MC_SHEET ? MC_SHEET.confirm(t, { ok: 'Import' }) : window.confirm(t);
    };
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read the file.')); };
      reader.onload = function () {
        var payload;
        try { payload = JSON.parse(reader.result); }
        catch (e) { reject(new Error('Not a valid backup file.')); return; }
        var data = payload && payload.data;
        if (!data || typeof data !== 'object') { reject(new Error('Not a valid backup file.')); return; }
        var plan;
        try { plan = planImport(data, payload.exportedAt); }
        catch (e) { reject(e); return; }
        Promise.resolve(ask(describe(plan))).then(function (ok) {
          if (!ok) { reject(new Error('Import cancelled — nothing was changed.')); return; }
          if (!applyPlan(plan)) { reject(new Error('Some of the backup could not be saved — this device may be out of storage.')); return; }
          resolve(plan);
        }, reject);
      };
      reader.readAsText(file);
    });
  }

  window.MCExport = { exportJSON: exportJSON, importJSON: importJSON };
})();
