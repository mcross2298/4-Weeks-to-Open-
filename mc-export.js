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
    'mc_setlog_deleted_v1',         // unticked sets, so an import does not put them back
    'mc_workout_archive_v1',        // flagship readiness R7 / D-39
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
    noteBackup();
  }

  // ---- when this device last saved a backup (flagship readiness R7 / D-36) --
  // A signed-out athlete's training lives on this one phone, and nothing ever
  // said when it was last copied off it. Only the JSON backup counts: a CSV
  // is for reading in a spreadsheet and cannot be restored.
  var BK_KEY = 'mc_backup_last_v1';   // { ts, dismissedAt }
  function backupState() {
    try { var v = JSON.parse(localStorage.getItem(BK_KEY) || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (e) { return {}; }
  }
  function saveBackupState(patch) {
    var v = backupState(), k;
    for (k in patch) v[k] = patch[k];
    try { localStorage.setItem(BK_KEY, JSON.stringify(v)); } catch (e) {}
  }
  function noteBackup() { saveBackupState({ ts: Date.now() }); }
  function lastBackup() { var t = backupState().ts; return (typeof t === 'number' && t > 0) ? t : null; }
  // "never" / "today" / "yesterday" / "N days ago"
  function lastBackupLabel() {
    var t = lastBackup();
    if (!t) return 'never';
    var days = Math.floor((Date.now() - t) / 86400000);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
  }
  // The reminder: signed out, at least 3 finished workouts to lose, no backup
  // in 14 days, and not dismissed in the last 7. Signed-in athletes sync.
  var NUDGE_WORKOUTS = 3, NUDGE_AGE_DAYS = 14, NUDGE_SNOOZE_DAYS = 7;
  function shouldNudge(signedIn) {
    if (signedIn) return false;
    var L = window.MC_LOG, n = 0;
    try { n = L && L.readAllWorkouts ? L.readAllWorkouts().length : 0; } catch (e) { n = 0; }
    if (n < NUDGE_WORKOUTS) return false;
    var st = backupState(), now = Date.now();
    if (st.ts && now - st.ts < NUDGE_AGE_DAYS * 86400000) return false;
    if (st.dismissedAt && now - st.dismissedAt < NUDGE_SNOOZE_DAYS * 86400000) return false;
    return true;
  }
  function dismissNudge() { saveBackupState({ dismissedAt: Date.now() }); }

  // ---- CSV export (flagship readiness R7 / D-36) ---------------------------
  // One row per logged set, for a spreadsheet: every finished workout, the
  // archive included, oldest first so a sheet reads down in time. A workout
  // with no sets (a conditioning session) gets one row with its duration.
  var CSV_COLS = ['date', 'time', 'workout', 'exercise', 'set', 'weight_lb', 'reps', 'effort', 'pr', 'swapped_from', 'duration'];
  function csvCell(v) {
    var t = v == null ? '' : String(v);
    // A leading = + - @ makes a spreadsheet run the cell as a formula.
    if (/^[=+\-@]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "'" + t;
    return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function effortLabel(rpe) {
    if (!rpe) return '';
    if (rpe === 'F') return 'to failure';
    var n = parseFloat(rpe);
    return isNaN(n) ? String(rpe) : 'RPE ' + n;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function buildCSV() {
    var L = window.MC_LOG;
    var all = (L && L.readAllWorkouts) ? L.readAllWorkouts() : [];
    var rows = [CSV_COLS.join(',')];
    all.slice().reverse().forEach(function (w) {
      var d = w.date ? new Date(w.date) : null;
      // The athlete's own calendar day, not UTC's: an evening session in
      // the US would otherwise land on tomorrow's row.
      var day = d && !isNaN(d) ? d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) : '';
      var name = w.workoutName || w.routineName || w.pageId || '';
      var sets = L.readSets ? L.readSets(w) : (Array.isArray(w.sets) ? w.sets : []);
      if (!sets.length) {
        rows.push([day, w.time || '', name, '', '', '', '', '', '', '', w.duration || ''].map(csvCell).join(','));
        return;
      }
      sets.forEach(function (x) {
        rows.push([day, w.time || '', name, x.name || x.key || '', x.setNum == null ? '' : x.setNum,
          x.weight == null ? '' : x.weight, x.reps == null ? '' : x.reps, effortLabel(x.rpe),
          x.pr ? 'yes' : '', x.swappedFrom || '', w.duration || ''].map(csvCell).join(','));
      });
    });
    return rows.join('\r\n') + '\r\n';
  }
  // The share sheet where the phone has one (save to Files, mail it, open it
  // in a sheet app); a download everywhere else. Resolves 'shared',
  // 'downloaded' or 'cancelled'.
  function exportCSV() {
    var t = new Date();
    var name = 'mc-training-sets-' + t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()) + '.csv';
    var csv = buildCSV();
    var blob = new Blob([csv], { type: 'text/csv' });
    var file = null;
    try { file = new File([blob], name, { type: 'text/csv' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.share) {
      var ok = false;
      try { ok = navigator.canShare({ files: [file] }); } catch (e) { ok = false; }
      if (ok) {
        return navigator.share({ files: [file], title: 'Training log' }).then(function () { return 'shared'; },
          function (err) {
            if (err && err.name === 'AbortError') return 'cancelled';
            download(blob, name); return 'downloaded';
          });
      }
    }
    download(blob, name);
    return Promise.resolve('downloaded');
  }
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
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
  var WLA = 'mc_workout_archive_v1';   // R7: merged like the log, never replaced
  var SLD = 'mc_setlog_deleted_v1';    // unticked sets, unioned like WLD

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
      var unt = {};
      [readJSON(SLD, {}), data[SLD]].forEach(function (d) {
        if (isDict(d)) Object.keys(d).forEach(function (k) {
          if (!unt[k] || ((d[k] && d[k].ts) || 0) > ((unt[k] && unt[k].ts) || 0)) unt[k] = d[k];
        });
      });
      if (Object.keys(unt).length) plan.writes[SLD] = unt;
      if (window.MC_MERGE && MC_MERGE.mergeSetlog) merged = MC_MERGE.mergeSetlog(local, data[SL], unt);
      else { merged = {}; Object.keys(data[SL]).forEach(function (k) { merged[k] = data[SL][k]; });
             Object.keys(local).forEach(function (k) { merged[k] = local[k]; }); }   // device wins per exercise
      plan.writes[SL] = merged;
      plan.setlogMerged = true;
    }
    // R7: the archive merges by identity like the log, so restoring a backup
    // never drops older workouts this device holds.
    if (WLA in data && Array.isArray(data[WLA]) && L && L.mergeArchive) {
      var localArch = readJSON(WLA, []);
      plan.writes[WLA] = L.mergeArchive(Array.isArray(localArch) ? localArch : [], data[WLA], del);
      plan.archiveIn = data[WLA].length;
    }
    Object.keys(data).forEach(function (k) {
      if (!isExportable(k) || k === WL || k === WLD || k === SL || k === WLA || k === SLD) return;
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
      if (w.archived) lines.push(w.archived + ' oldest move to your archive of older workouts — nothing is dropped.');
    }
    if (plan.archiveIn) lines.push('Older workouts: merged with this device’s archive.');
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

  window.MCExport = {
    exportJSON: exportJSON, importJSON: importJSON,
    exportCSV: exportCSV, buildCSV: buildCSV,                 // R7 / D-36
    lastBackup: lastBackup, lastBackupLabel: lastBackupLabel,
    shouldNudge: shouldNudge, dismissNudge: dismissNudge
  };
})();
