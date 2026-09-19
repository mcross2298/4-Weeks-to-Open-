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
  .filter(f => !f.startsWith('tools/'));            // tools describe the store, they do not read it for the UI

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

for (const f of files) {
  let src;
  try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
  if (src.indexOf(KEY) === -1) continue;
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

console.log('check-log-readers: ' + sites + ' parse sites across ' + readers + ' files, all shape-guarded');
