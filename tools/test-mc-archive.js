#!/usr/bin/env node
/* tools/test-mc-archive.js — flagship readiness R7 (D-39, D-36)

   The workout log keeps the newest 200 finished workouts. It used to DROP the
   rest, on this device and in the cloud copy alike. R7 moves them into
   mc_workout_archive_v1 (mc-log-read.js), compacted, synced untrimmed, and
   lists them in History and in the CSV export (mc-export.js).

   Loads the REAL mc-log-read.js and mc-export.js into one vm sandbox with an
   in-memory localStorage (the test-mc-bridge.js technique), so the browser
   path itself is what runs: appendWorkout -> capLog -> archiveWorkouts.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.error('::error::' + name); } }
function eq(name, a, b) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  ok(name + (A === B ? '' : '  got ' + A + ' want ' + B), A === B);
}

function makeSandbox(seed) {
  const store = Object.assign({}, seed || {});
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  const sb = { localStorage, console, JSON, Date, Math, setTimeout, store, module: { exports: {} } };
  sb.window = sb;
  vm.createContext(sb);
  for (const f of ['mc-log-read.js', 'mc-export.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  }
  return sb;
}
function W(i, extra) {
  // Day i of 2026, one set; ids are the real page|iso shape.
  const iso = new Date(Date.UTC(2026, 0, 1 + i, 15)).toISOString();
  return Object.assign({
    id: 'p.html|' + iso, pageId: 'p.html', workoutName: 'Day ' + i, date: iso, time: '10:00 AM',
    duration: '45 min', prs: 0, setsChecked: 1,
    sets: [{ name: 'Bench Press', key: 'x-bench-press', setNum: 1, weight: 100 + i, reps: 8, pr: false }]
  }, extra || {});
}

// ---- compact <-> expand is lossless ----------------------------------------
{
  const sb = makeSandbox();
  const M = sb.module ? sb.module.exports : null;
  const L = sb.MC_LOG;
  ok('MC_LOG exposes the archive API', !!(L && L.readArchive && L.rollover && L.findWorkout &&
     L.readAllWorkouts && L.mergeArchive && L.LOG_CAP === 200));
  void M;
  const e = W(1, { prs: 1, sets: [
    { name: 'Bench Press', key: 'x-bench-press', setNum: 1, weight: 185, reps: 5, pr: true, rpe: 'F' },
    { name: 'Bench Press', key: 'x-bench-press', setNum: 2, weight: '185', reps: '5', pr: false },
    { name: 'DB Row', key: 'x-db-row', setNum: 1, weight: 60, reps: 10, pr: false, swappedFrom: 'Cable Row' },
    { name: 'Plank', key: 'x-plank', setNum: 1, weight: null, reps: 60, pr: false, future: { a: 1 } }
  ]});
  // Through the real archive path: 201 workouts -> the oldest is archived.
  const log = [];
  for (let i = 2; i <= 201; i++) log.push(W(i));
  log.reverse();               // newest first, as the log is stored
  log.push(e);                 // e is the oldest
  ok('writeWorkoutLog accepts 201', L.writeWorkoutLog(log));
  eq('log holds the newest 200', L.readWorkoutLog().length, 200);
  const raw = JSON.parse(sb.store.mc_workout_archive_v1);
  eq('the 201st is archived, not dropped', raw.length, 1);
  ok('archived entry is compacted (no sets array)', !('sets' in raw[0]) && Array.isArray(raw[0]._s));
  eq('lift names are tabled once each', raw[0]._x.length, 3);
  const back = L.findWorkout(e.id);
  ok('findWorkout reaches an archived id', !!back && back.archived === true);
  const strip = (x) => { const o = Object.assign({}, x); delete o.archived; return o; };
  eq('round trip: every entry field survives', Object.keys(strip(back)).sort(), Object.keys(e).sort());
  eq('round trip: sets are identical', back.sets, e.sets);
  eq('round trip: id/date/name', [back.id, back.date, back.workoutName, back.duration, back.prs],
     [e.id, e.date, e.workoutName, e.duration, e.prs]);
  eq('readAllWorkouts = log + archive, newest first', L.readAllWorkouts().length, 201);
  eq('readAllWorkouts ends with the oldest', L.readAllWorkouts()[200].id, e.id);
  ok('an entry with no sets array passes through compact untouched',
     JSON.stringify(sb.module.exports.compactWorkout({ id: 'c', date: 'x', timeSec: 30 })) ===
     JSON.stringify({ id: 'c', date: 'x', timeSec: 30 }));
}

// ---- appendWorkout rolls over; nothing is ever lost --------------------------
{
  const seed = [];
  for (let i = 0; i < 200; i++) seed.push(W(i));
  seed.reverse();
  const sb = makeSandbox({ mc_workout_log_v1: JSON.stringify(seed) });
  const L = sb.MC_LOG;
  const oldest = seed[199].id;
  L.appendWorkout(W(300));
  eq('append at 200: log stays 200', L.readWorkoutLog().length, 200);
  eq('append at 200: newest is first', L.readWorkoutLog()[0].id, W(300).id);
  eq('append at 200: the oldest moved to the archive', L.readArchive().map((x) => x.id), [oldest]);
  L.appendWorkout(W(301));
  eq('second append: archive is newest first', L.readArchive().map((x) => x.id), [seed[198].id, oldest]);

  // A pull can hand the log back past 200 (mc-sync.js no longer cuts it).
  const long = L.readWorkoutLog().concat([W(-5), W(-6)]);
  sb.store.mc_workout_log_v1 = JSON.stringify(long);
  ok('rollover() trims a long log', L.rollover() && L.readWorkoutLog().length === 200);
  eq('rollover() archived the overflow', L.readArchive().length, 4);

  // A pull brings back into the log a workout this device already archived.
  const dup = L.findWorkout(oldest);
  const withDup = L.readWorkoutLog().slice(0, 199).concat([JSON.parse(JSON.stringify(seed[199]))]);
  sb.store.mc_workout_log_v1 = JSON.stringify(withDup);
  const all = L.readAllWorkouts();
  eq('a workout in both stores is listed once', all.filter((x) => x.id === oldest).length, 1);
  ok('...and the log copy wins', !all.find((x) => x.id === oldest).archived);
  void dup;

  // Deleting an archived workout removes it and records the deletion.
  ok('deleteWorkouts reaches the archive', L.deleteWorkouts([seed[198].id]));
  ok('...gone from the archive', !L.readArchive().some((x) => x.id === seed[198].id));
  ok('...with a deletion record', !!JSON.parse(sb.store.mc_workout_log_deleted_v1)[seed[198].id]);
  L.archiveWorkouts([seed[198]]);
  ok('a deleted workout is not re-archived', !L.readArchive().some((x) => x.id === seed[198].id));

  // clearWorkouts clears both.
  L.clearWorkouts();
  eq('clearWorkouts empties log and archive', [L.readWorkoutLog().length, L.readArchive().length], [0, 0]);
}

// ---- a full device: the archive write fails -> the log is NOT trimmed --------
{
  const seed = [];
  for (let i = 0; i < 200; i++) seed.push(W(i));
  seed.reverse();
  const sb = makeSandbox({ mc_workout_log_v1: JSON.stringify(seed) });
  const real = sb.localStorage.setItem;
  sb.localStorage.setItem = (k, v) => {
    if (k === 'mc_workout_archive_v1') { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }
    real(k, v);
  };
  sb.MC_LOG.appendWorkout(W(400));
  eq('archive refused: the log keeps all 201 rather than losing one', sb.MC_LOG.readWorkoutLog().length, 201);
}

// ---- mergeWorkoutLogs (import) no longer drops --------------------------------
{
  const sb = makeSandbox();
  const M = sb.module.exports;
  const a = [], b = [];
  for (let i = 0; i < 150; i++) a.push(W(i));
  for (let i = 150; i < 260; i++) b.push(W(i));
  const r = M.mergeWorkoutLogs(a, b, {});
  eq('import merge keeps every workout', r.log.length, 260);
  eq('import merge reports what moves to the archive', [r.archived, r.dropped], [60, 0]);
}

// ---- mergeArchive: union by identity, deletions honoured ---------------------
{
  const sb = makeSandbox();
  const M = sb.module.exports;
  const x = M.compactWorkout(W(1)), y = M.compactWorkout(W(2)), z = W(3);
  const out = M.mergeArchive([x, y], [z, W(1)], { [W(2).id]: { ts: 1 } });
  eq('mergeArchive: union, newest first, deleted dropped', out.map((e) => e.id), [W(3).id, W(1).id]);
  ok('mergeArchive: compacts what it is handed', out.every((e) => !('sets' in e)));
}

// ---- CSV ------------------------------------------------------------------------
{
  const log = [W(2, { sets: [
    { name: 'Bench, Press "Wide"', key: 'k', setNum: 1, weight: 185, reps: 5, pr: true, rpe: 'F' },
    { name: '=HYPERLINK("x")', key: 'k2', setNum: 2, weight: -5, reps: 8, pr: false, swappedFrom: 'Cable Row' }
  ]}), { id: 'c|1', pageId: 'cond.html', workoutName: 'Intervals', date: W(1).date, duration: '20 min' }];
  const arch = [W(0)];
  const sb = makeSandbox({ mc_workout_log_v1: JSON.stringify(log) });
  sb.MC_LOG.archiveWorkouts(arch);
  const csv = sb.MCExport.buildCSV();
  const lines = csv.trim().split('\r\n');
  eq('CSV header', lines[0], 'date,time,workout,exercise,set,weight_lb,reps,effort,pr,swapped_from,duration');
  eq('CSV: one row per set, archive included, plus one per set-less workout', lines.length, 1 + 1 + 1 + 2);
  ok('CSV: oldest first (the archived workout leads)', lines[1].indexOf('Day 0') > -1);
  ok('CSV: a set-less workout gets one row with its duration', /,Intervals,,,,,,,,20 min$/.test(lines[2]));
  ok('CSV: commas and quotes are quoted', lines[3].indexOf('"Bench, Press ""Wide"""') > -1);
  ok('CSV: effort and PR are words', lines[3].indexOf(',to failure,yes,') > -1);
  ok('CSV: a formula-shaped name is defused', lines[4].indexOf('"\'=HYPERLINK(""x"")"') > -1);
  ok('CSV: a negative number stays a number', lines[4].indexOf(',-5,8,') > -1);
  ok('CSV: swapped-from is carried', lines[4].indexOf(',Cable Row,') > -1);
  ok('CSV: date is a calendar day', /^2026-01-0\d,/.test(lines[1]));
}

// ---- the backup nudge rule -----------------------------------------------------
{
  const log = [W(1), W(2), W(3)];
  const sb = makeSandbox({ mc_workout_log_v1: JSON.stringify(log) });
  const X = sb.MCExport;
  ok('nudge: signed out, 3 workouts, never backed up', X.shouldNudge(false) === true);
  ok('nudge: never for a signed-in athlete', X.shouldNudge(true) === false);
  eq('nudge: label before any backup', X.lastBackupLabel(), 'never');
  X.dismissNudge();
  ok('nudge: "Later" snoozes it', X.shouldNudge(false) === false);
  sb.store.mc_backup_last_v1 = JSON.stringify({ dismissedAt: Date.now() - 8 * 86400000 });
  ok('nudge: returns after the 7-day snooze', X.shouldNudge(false) === true);
  sb.store.mc_backup_last_v1 = JSON.stringify({ ts: Date.now() - 3 * 86400000 });
  ok('nudge: a recent backup quiets it', X.shouldNudge(false) === false);
  eq('nudge: label counts days', X.lastBackupLabel(), '3 days ago');
  sb.store.mc_backup_last_v1 = JSON.stringify({ ts: Date.now() - 15 * 86400000 });
  ok('nudge: back after 14 days without one', X.shouldNudge(false) === true);
  const few = makeSandbox({ mc_workout_log_v1: JSON.stringify([W(1), W(2)]) });
  ok('nudge: not with fewer than 3 workouts', few.MCExport.shouldNudge(false) === false);
}

// ---- deletion records are pruned after a year (Phase T1.2) ----------------
{
  const year = 365 * 86400000, now = Date.now();
  const sb = makeSandbox({
    mc_workout_log_v1: JSON.stringify([W(1), W(2)]),
    mc_workout_log_deleted_v1: JSON.stringify({
      'old|a': { ts: now - year - 86400000 },     // past a year: dropped
      'recent|b': { ts: now - 30 * 86400000 },    // a month: kept
      'bad|c': { ts: 'x' }, 'bad|d': null         // malformed: dropped
    })
  });
  const L = sb.MC_LOG;
  ok('deleteWorkouts still deletes', L.deleteWorkouts([W(1).id]));
  const del = JSON.parse(sb.store.mc_workout_log_deleted_v1);
  eq('pruned to the recent record and the new one', Object.keys(del).sort(), [W(1).id, 'recent|b'].sort());
  eq('the deleted workout is gone from the log', L.readWorkoutLog().map(e => e.id), [W(2).id]);
}

console.log('test-mc-archive: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
