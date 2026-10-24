#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-workout-log-writers.js — one writer for mc_workout_log_v1
   --------------------------------------------------------------------------
   Flagship readiness R1 (D-38, D-24). Five places appended to the workout log
   with their own copy of read-unshift-slice-write, and two more deleted from
   it. The copies drifted the way copies do: three conditioning pages skipped
   the storage-full warning, none of them stamped the id mc-sync.js dedupes
   on, run-workout.html banked zero sets through a key Phase 2.1 had retired,
   and a delete left nothing behind for a sync to respect, so the next pull
   brought the workout straight back.

   mc-log-read.js now owns every write: appendWorkout(), deleteWorkouts(),
   clearWorkouts() and writeWorkoutLog() (the import merge). This gate fails
   on any other file that writes the store directly — setItem, removeItem or
   the shared writeStore() — whether it names the key as a literal or through
   a variable bound to it (`var WL_KEY = 'mc_workout_log_v1'`).

   Not counted, deliberately: mc-sync.js writes every synced store through one
   generic writeVal(key, ...) and never names this key at a write site — that
   is the merge path, and it applies the same deletion records (see its
   mergeWorkoutLog()). A generic loop over a key LIST is likewise invisible to
   a static check, which is why mc-export.js routes this store through
   writeWorkoutLog() explicitly rather than relying on the gate.

   Run: node tools/check-workout-log-writers.js
   ========================================================================== */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KEY = 'mc_workout_log_v1';
const OWNER = 'mc-log-read.js';

const files = execSync('git ls-files "*.js" "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean)
  // generated copies of their members (tools/bundles.json, flagship readiness J)
  .filter(f => !require('./bundle-outputs').isBundle(f))
  // tools/ seed fixtures into the store on purpose; GO_LIVE/ is scratch-listed
  // evidence. Both are excluded by every other gate in this tree.
  .filter(f => !f.startsWith('tools/') && !f.startsWith('GO_LIVE/'));

// Same comment stripper as check-log-readers.js: a header that QUOTES an old
// write to explain what it replaced is not a live write. Newlines are kept so
// the line numbers in the report are real.
function decomment(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g,
    (mm, pre) => (pre || '') + mm.slice((pre || '').length).replace(/[^\n]/g, ' '));
}
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const offenders = [];
let scanned = 0;
for (const f of files) {
  if (f === OWNER) continue;
  let src;
  try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
  if (src.indexOf(KEY) === -1) continue;
  scanned++;
  src = decomment(src);
  const names = ["'" + KEY + "'", '"' + KEY + '"'].map(esc);
  const bind = /(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*['"]mc_workout_log_v1['"]/g;
  let b;
  while ((b = bind.exec(src))) names.push(esc(b[1]) + '\\b');
  const write = new RegExp('\\b(setItem|removeItem|writeStore)\\s*\\(\\s*(?:' + names.join('|') + ')\\s*[,)]', 'g');
  let m;
  while ((m = write.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    offenders.push(`${f}:${line} ${m[1]}()`);
  }
}

if (offenders.length) {
  console.error('check-workout-log-writers: FAIL — ' + offenders.length + ' direct write(s) to ' + KEY + ':');
  offenders.forEach(o => console.error('  ' + o));
  console.error('\nRoute it through ' + OWNER + ': MC_LOG.appendWorkout(entry), MC_LOG.deleteWorkouts(keys),');
  console.error('MC_LOG.clearWorkouts() or MC_LOG.writeWorkoutLog(arr). See flagship-readiness-roadmap.md R1.');
  process.exit(1);
}
console.log('check-workout-log-writers: OK — ' + scanned + ' files reference ' + KEY + ', none writes it outside ' + OWNER);
