#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-store-coverage.js — the store registry is the truth, and CI says so
   --------------------------------------------------------------------------
   Audit G-01/G-02, roadmap K-1.1.

   Three lists used to describe the same thing and were maintained by hand:
   the keys the code actually reads/writes, mc-sync.js's STORES (what syncs),
   and mc-export.js's KEYS (what lands in a backup). They had already drifted:

     • mc_custom_exercises_v1 — mc-exercise-catalog.js's own header says it is
       "synced across the user's own devices via mc-sync.js". It was in neither
       STORES nor the export list, so a custom exercise library silently never
       left the phone that created it, and was absent from that user's own
       backup file.
     • mc_session_summary_v1 — synced, but missing from the export list, so a
       downloaded backup lacked data the app itself treats as worth syncing.

   Neither was visible to CI, because nothing compared the lists to each other.
   store-registry.json now declares every key once; this gate fails the moment
   the code, the sync map, the export list and the registry stop agreeing.

   Checks:
     1. every mc_* key literal in tracked source is declared (exactly or by a
        registered prefix)
     2. registry sync entries === mc-sync.js STORES, strategy names included
     3. registry export entries === mc-export.js KEYS (+ prefixes vs
        KEY_PREFIXES)
     4. no stale registry entry (declared, but used nowhere in source)
     5. every strategy the registry names is routed in mc-sync.js's mergeStore

   Exit 1 on any failure, with the offending keys named.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const rel = p => path.relative(ROOT, p);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const failures = [];
function fail(msg, items) {
  failures.push(msg + (items && items.length ? '\n      ' + items.join('\n      ') : ''));
}

// ---- inputs ---------------------------------------------------------------
const reg = JSON.parse(read('store-registry.json'));
const stores = reg.stores || {};
const prefixes = reg.prefixes || {};
const prefixList = Object.keys(prefixes);

const sourceFiles = execSync('git ls-files "*.js" "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter(f => !f.startsWith('tools/'));       // tools describe stores, don't own them

// ---- 1 + 4: code usage vs registry ---------------------------------------
const usedKeys = new Map();                     // key -> first file seen in
for (const f of sourceFiles) {
  let text;
  try { text = read(f); } catch (e) { continue; }
  const re = /['"](mc_[A-Za-z0-9_]+)['"]/g;
  let m;
  while ((m = re.exec(text))) if (!usedKeys.has(m[1])) usedKeys.set(m[1], f);
}
const matchesPrefix = k => prefixList.some(p => k.indexOf(p) === 0 || p.indexOf(k) === 0);

const undeclared = [...usedKeys.keys()]
  .filter(k => !(k in stores) && !matchesPrefix(k))
  .map(k => `${k}  (first seen in ${usedKeys.get(k)})`);
if (undeclared.length) {
  fail('Key used in code but not declared in store-registry.json — add it there, ' +
       'with its sync/export intent:', undeclared);
}

const stale = Object.keys(stores).filter(k => !usedKeys.has(k));
if (stale.length) {
  fail('Declared in store-registry.json but used nowhere in source (stale entry?):', stale);
}

// ---- 2: registry sync flags vs mc-sync.js STORES -------------------------
const syncSrc = read('mc-sync.js');
const storesBlock = syncSrc.match(/var STORES = \{([\s\S]*?)\n  \};/);
if (!storesBlock) {
  fail('Could not locate the STORES map in mc-sync.js (shape changed?)');
} else {
  const actualSync = {};
  const re = /'([^']+)'\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(storesBlock[1]))) actualSync[m[1]] = m[2];

  const wantSync = {};
  for (const [k, v] of Object.entries(stores)) if (v.sync) wantSync[k] = v.sync;

  const missing = Object.keys(wantSync).filter(k => !(k in actualSync))
    .map(k => `${k} (registry says sync:'${wantSync[k]}', absent from STORES)`);
  const extra = Object.keys(actualSync).filter(k => !(k in wantSync))
    .map(k => `${k} (in STORES, but registry says sync:false)`);
  const differ = Object.keys(wantSync).filter(k => k in actualSync && actualSync[k] !== wantSync[k])
    .map(k => `${k} (registry '${wantSync[k]}' vs STORES '${actualSync[k]}')`);
  if (missing.length || extra.length || differ.length) {
    fail('store-registry.json and mc-sync.js STORES disagree:', [...missing, ...extra, ...differ]);
  }

  // ---- 5: strategies must actually be routed --------------------------------
  const dispatcher = syncSrc.match(/function mergeStore\([\s\S]*?\n  \}/);
  if (!dispatcher) {
    fail('Could not locate mergeStore() in mc-sync.js (shape changed?)');
  } else {
    const unrouted = [...new Set(Object.values(wantSync))]
      .filter(s => dispatcher[0].indexOf(`'${s}'`) < 0);
    if (unrouted.length) {
      fail('Merge strategy named in the registry but not routed in mergeStore():', unrouted);
    }
  }
}

// ---- 3: registry export flags vs mc-export.js ----------------------------
const exportSrc = read('mc-export.js');
const keysBlock = exportSrc.match(/var KEYS = \[([\s\S]*?)\];/);
const prefBlock = exportSrc.match(/var KEY_PREFIXES = \[([\s\S]*?)\];/);
if (!keysBlock) {
  fail('Could not locate the KEYS list in mc-export.js (shape changed?)');
} else {
  const actualExport = new Set((keysBlock[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)));
  const wantExport = new Set(Object.entries(stores).filter(([, v]) => v.export).map(([k]) => k));

  const missing = [...wantExport].filter(k => !actualExport.has(k))
    .map(k => `${k} (registry says export:true, absent from mc-export.js KEYS)`);
  const extra = [...actualExport].filter(k => !wantExport.has(k))
    .map(k => `${k} (in mc-export.js KEYS, but registry says export:false)`);
  if (missing.length || extra.length) {
    fail('store-registry.json and mc-export.js KEYS disagree:', [...missing, ...extra]);
  }

  const actualPrefixes = new Set(prefBlock
    ? (prefBlock[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)) : []);
  const wantPrefixes = new Set(Object.entries(prefixes).filter(([, v]) => v.export).map(([k]) => k));
  const pMissing = [...wantPrefixes].filter(p => !actualPrefixes.has(p))
    .map(p => `${p} (registry says export:true, absent from KEY_PREFIXES)`);
  const pExtra = [...actualPrefixes].filter(p => !wantPrefixes.has(p))
    .map(p => `${p} (in KEY_PREFIXES, but registry says export:false)`);
  if (pMissing.length || pExtra.length) {
    fail('store-registry.json prefixes and mc-export.js KEY_PREFIXES disagree:', [...pMissing, ...pExtra]);
  }
}

// ---- report ---------------------------------------------------------------
if (failures.length) {
  console.error('check-store-coverage: FAIL\n');
  failures.forEach(f => console.error('  - ' + f + '\n'));
  process.exit(1);
}
const synced = Object.values(stores).filter(v => v.sync).length;
const exported = Object.values(stores).filter(v => v.export).length;
console.log(`check-store-coverage: OK — ${Object.keys(stores).length} stores + ` +
            `${prefixList.length} prefixes declared; ${synced} synced, ${exported} exported; ` +
            `${usedKeys.size} keys used in ${sourceFiles.length} source files, all accounted for.`);
