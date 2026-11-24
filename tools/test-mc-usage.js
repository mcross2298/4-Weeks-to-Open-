#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-usage.js — autonomy-exec-roadmap.md Part 2's report, run in a vm
   sandbox against the real mc-usage.js: two phones' weeks added together,
   the median seconds to the first set, taps per set and per unchanged set,
   and null (never 0) where nothing was logged.
   Run: node tools/test-mc-usage.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (good) pass++; else { fail++; console.error('::error::' + name + '\n   got ' + JSON.stringify(a) + '  want ' + JSON.stringify(b)); }
}
function dayKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const NOW = new Date(2026, 10, 25, 12).getTime();      // Wed Nov 25
const THIS = dayKey(new Date(2026, 10, 23)), LAST = dayKey(new Date(2026, 10, 16));

function load(store) {
  const sb = { window: {}, document: { getElementById() { return null; } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../mc-usage.js'), 'utf8'), sb);
  return sb.window.MC_USAGE;
}

const U = load({ mc_usage_v1: JSON.stringify({
  phoneA: { ts: 1, weeks: { [THIS]: { sessions: 2, firstSetSecs: [20, 40], taps: 30, sets: 20, ghostSets: 10, ghostTaps: 12 } } },
  phoneB: { ts: 2, weeks: {
    [THIS]: { sessions: 1, firstSetSecs: [25], taps: 10, sets: 10, ghostSets: 10, ghostTaps: 10 },
    [LAST]: { sessions: 0, firstSetSecs: [], taps: 9, sets: 6, ghostSets: 0, ghostTaps: 0 } } }
}) });
const w = U.weeks(NOW, 3);
eq('newest first, Monday-keyed', w.map(x => x.monday), [THIS, LAST, dayKey(new Date(2026, 10, 9))]);
eq('two phones added together', [w[0].sessions, w[0].sets], [3, 30]);
eq('median seconds to the first set, pooled across phones', w[0].medianFirst, 25);
eq('taps per set', w[0].tapsPerSet, round(40 / 30));
eq('taps per unchanged set', w[0].tapsPerUnchanged, round(22 / 20));
eq('a week with sets but no session start: no first-set figure', w[1].medianFirst, null);
eq('a week with no unchanged set: null, not 0', w[1].tapsPerUnchanged, null);
eq('an empty week: nothing', [w[2].sets, w[2].tapsPerSet, w[2].medianFirst], [0, null, null]);
eq('an even count takes the mean of the middle two, rounded', load({ mc_usage_v1: JSON.stringify({ a: { weeks: { [THIS]: { firstSetSecs: [10, 20, 31, 41], sets: 4 } } } }) }).weeks(NOW, 1)[0].medianFirst, 26);
eq('a broken store reads as empty', load({ mc_usage_v1: '[1,2]' }).weeks(NOW, 1)[0].sets, 0);
function round(n) { return Math.round(n * 10) / 10; }

console.log('test-mc-usage: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
