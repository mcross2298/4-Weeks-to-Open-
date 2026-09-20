#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-log-readers.js — every reader of the workout log must guard its shape
   --------------------------------------------------------------------------
   Launch gate L-03. The same five-line reader was copy-pasted into six places
   and all six had the same hole: `JSON.parse(...) || []` catches malformed
   text but not valid JSON of the wrong shape, so an object where an array
   belongs threw "forEach is not a function" and a null member threw "Cannot
   read properties of null" — blanking the stats and history pages.

   The obvious fix, one shared reader, does not work here and the reason is
   worth recording: the only modules loaded on all 83 consumer pages are
   mc-haptics.js, mc-nav.js and mc-sw-update.js, none of which is a sane home
   for a data reader, and adding a new module means a script tag on ~80 pages
   plus a load-order dependency. (mc-data.js, the obvious-sounding candidate,
   is the 23-page split dataset and is loaded by NONE of the consumers — that
   is exactly the mistake that left MC_EXCATALOG absent on 76 of 79 logging
   pages and the cloud muscle column empty.)

   So the duplication stays and this gate holds it safe: any file that reads
   mc_workout_log_v1 must also perform an Array.isArray check. Cheap, static,
   and it fails the moment a seventh copy appears without one.

   Run: node tools/check-log-readers.js
   ========================================================================== */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KEY = 'mc_workout_log_v1';

const files = execSync('git ls-files "*.js" "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean)
  // tools/ describe the store, they do not read it for the UI. GO_LIVE/ is
  // scratch-listed release-assessment evidence, excluded by every other gate
  // in this tree (check-dangling-refs, check-push-chain, check-store-coverage)
  // for the same reason.
  .filter(f => !f.startsWith('tools/') && !f.startsWith('GO_LIVE/'));

// Files that reference the key only in prose (a comment, a store registry, a
// sync whitelist) are not readers. A reader parses it.
// The guard has to be NEAR the parse, not merely somewhere in the file — a
// file with an unrelated Array.isArray elsewhere would otherwise pass while
// its reader stayed unguarded, which is a gate that cannot fail.
const PARSES = /JSON\.parse\s*\(\s*localStorage\.getItem\s*\(\s*(?:WL_KEY|['"]mc_workout_log_v1['"])/g;
// Symmetric, because the guard is legitimately written on either side: after
// the parse when a variable is assigned first, before it when the parse is
// wrapped inline and chained straight into .forEach().
const BEFORE = 220, AFTER = 400;

const offenders = [];
let readers = 0, sites = 0;
// Pass 2 below runs ONLY over these. See its own note for why.
const keyFiles = [];

for (const f of files) {
  let src;
  try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
  if (src.indexOf(KEY) === -1) continue;
  keyFiles.push(f);
  // Strip comments first. mc-log-read.js's own header QUOTES the old buggy
  // reader to explain what it replaced, and counting that as a live call site
  // is a false positive — the exact shape check-design-tokens.js already has a
  // decomment() step for. Replace with spaces so every offset is preserved and
  // the window arithmetic below still lands on real code.
  src = src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g,
    (mm, pre) => (pre || '') + ' '.repeat(mm.length - (pre || '').length));
  PARSES.lastIndex = 0;
  let m, unguarded = 0, here = 0;
  while ((m = PARSES.exec(src))) {
    here++;
    if (!/Array\.isArray/.test(src.slice(Math.max(0, m.index - BEFORE), m.index + AFTER))) unguarded++;
  }
  if (!here) continue;                              // mentions the key but does not parse it
  readers++; sites += here;
  if (unguarded) offenders.push(`${f} (${unguarded} of ${here} call sites)`);
}

if (offenders.length) {
  console.error('::error::These files parse ' + KEY + ' without an Array.isArray guard.');
  console.error('A wrong-shaped value is reachable through sync and will blank the page:');
  offenders.forEach(f => console.error('  - ' + f));
  console.error('\nFix: reject a non-array, then filter null members. See mc-stats.js for the shape.');
  process.exit(1);
}

if (!readers) {
  console.error('::error::found no readers of ' + KEY + ' at all — this gate has stopped testing anything');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Pass 2 — the SAME defect one level down: a log entry's own `sets` field.
//
// Pass 1 guards the ARRAY. It says nothing about a member's `sets`, which is
// whatever was written, and every consumer iterates it. Driven against main
// with mc_workout_log_v1 seeded six ways, workout-detail.html rendered
// COMPLETELY BLANK on four of them (object, string, number, and an array with
// a null member) -- #page innerHTML 0 bytes, one console error, no other
// symptom. `|| []` is a sham guard here for the same reason it was in pass 1:
// it catches undefined and catches nothing else.
//
// mc-log-read.js's readSets() is the single guarded reader and every consumer
// page already loads that file (checked: all 77 mc-finish.js pages, the
// dashboard and workout-detail.html), so unlike pass 1 there IS a shared
// implementation to delegate to here.
//
// Explicit lists rather than a count ratchet, for the reason
// check-design-tokens.js gives: a ratchet seeded at today's number lets a
// DIFFERENT unguarded reader be swapped in for one already counted.
const SETS_SHAM = /\.sets\s*\|\|\s*\[\]/g;                                   // the sham guard
const SETS_BARE = /\.sets\s*\.\s*(?:forEach|filter|map|reduce|some|every|sort|slice|concat)\s*\(/g;  // no guard at all
const SETS_WINDOW = 260;

// Values built in the same function, which are arrays by construction and can
// never arrive from the store. Each is named with the reason it is safe --
// "it looked fine" is not one.
const SETS_LOCAL = {
  'mc-finish.js': [
    // showDone(entry) is handed the entry saveWorkout() JUST built, three
    // statements earlier, whose sets came from getSessionSets(). It is a local
    // variable, not a store read. Listed so a fourth sweep does not re-open it.
    'var sets=entry.sets||[];',
  ],
  'workout-detail.html': [
    // ex.sets is built by groupByExercise() in this same file, which now reads
    // through MC_LOG.readSets -- see pass 2's own fix below it.
    '${ex.sets.map(',
  ],
};

// Known-unfixed, named, and may only SHRINK. Not a ratchet: an entry here must
// still BE an offender, so a fix that removes one fails the gate until the
// entry is removed with it, and anything not listed fails immediately.
const SETS_PENDING = {
  // mc-bridge.js is byte-identity-checked against Mikes-Cookbook on deploy
  // (verify.yml's cross-repo-drift step), so changing it here alone turns the
  // main deploy red until the matching cookbook commit lands. The throw is
  // real and reproduced -- todaysDayType() raises "(e.sets || []).forEach is
  // not a function" on a wrong-shaped entry -- but mc-macros.js wraps the only
  // caller in a try/catch returning null, so the cost is a silently lost day
  // type in the macro generator, not a blank screen. Fix it in the same change
  // as the cookbook's copy.
  'mc-bridge.js': 1,
};

const setsOffenders = [];
let setsSites = 0, setsLocal = 0, setsPendingSeen = {};

// Scoped to files that NAME this store, not every tracked file. `sets` is a
// generic field name and the first draft swept the whole tree for it:
// psu-strength.html flags on `lift.sets`, which is that page's authored
// PRESCRIPTION matrix (a lift x week grid), nothing to do with a logged
// session. The entry-level defect can only exist where the entries came from
// this store.
//
// Scoped to keyFiles rather than pass 1's parse sites for a second reason
// worth recording: mc-bridge.js reads the log through a generic
// `read(WLOG_KEY)` helper, so pass 1's PARSES regex has never matched it at
// all. Its four call sites happen to be correctly guarded, but that was never
// something this gate had verified.
for (const f of keyFiles) {
  let raw;
  try { raw = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
  if (!/\.sets\s*(\|\||\.)/.test(raw)) continue;
  const src = raw.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g,
    (mm, pre) => (pre || '') + ' '.repeat(mm.length - (pre || '').length));
  const allowed = SETS_LOCAL[f] || [];
  let bad = 0;
  for (const RE of [SETS_SHAM, SETS_BARE]) {
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(src))) {
      const line = src.slice(Math.max(0, m.index - 60), m.index + 60);
      if (allowed.some(a => line.indexOf(a) !== -1)) { setsLocal++; continue; }
      setsSites++;
      const win = src.slice(Math.max(0, m.index - SETS_WINDOW), m.index + SETS_WINDOW);
      // The guard must be about THIS value. A bare Array.isArray in the
      // window is not enough: mc-bridge.js guards the log ARRAY six lines
      // above its unguarded .sets read, and the first draft of this pass
      // accepted that and reported the file clean.
      if (/MC_LOG\s*\.\s*readSets|\breadSets\s*\(/.test(win)) continue;
      if (/Array\.isArray\s*\([^)]*\bsets\b/.test(win)) continue;
      bad++;
    }
  }
  if (!bad) continue;
  if (SETS_PENDING[f]) { setsPendingSeen[f] = bad; continue; }
  offenders.push(`${f} — ${bad} unguarded read(s) of an entry's .sets`);
  setsOffenders.push(f);
}

// A pending entry that is no longer an offender must be removed, or the list
// silently keeps excusing a file that no longer needs it.
for (const f of Object.keys(SETS_PENDING)) {
  if (!setsPendingSeen[f]) {
    console.error('::error::' + f + ' is on SETS_PENDING but reads no unguarded .sets any more.');
    console.error('Remove it from the list in this file — a stale exemption excuses the next defect for free.');
    process.exit(1);
  }
}

if (setsOffenders.length) {
  console.error('::error::These files read a log entry\'s .sets without guarding its shape.');
  console.error('Driven against main, this rendered workout-detail.html completely blank on');
  console.error('4 of 6 seeded store shapes, with one console error and no other symptom:');
  setsOffenders.forEach(f => console.error('  - ' + f));
  console.error('\nFix: MC_LOG.readSets(entry) — every consumer page already loads mc-log-read.js.');
  process.exit(1);
}

console.log('check-log-readers: ' + sites + ' parse sites across ' + readers + ' files, all shape-guarded');
console.log('check-log-readers: ' + (setsSites + setsLocal) + ' entry.sets read(s) across ' +
  keyFiles.length + ' files — ' + setsLocal + ' locally built, ' + setsSites + ' store-derived, ' +
  Object.keys(SETS_PENDING).length + ' named pending (' + Object.keys(SETS_PENDING).join(', ') + ')');
