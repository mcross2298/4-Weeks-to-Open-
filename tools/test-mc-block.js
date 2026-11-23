#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-block.js — the block row and sheet's figures (mc-block.js,
   command-center-roadmap.md PR 1). Runs the real mc-program-progress.js and
   mc-block.js in a vm sandbox, the test-mc-program-progress.js technique.

   What matters: training days counted without rest days (including a
   program whose rest pattern changes by week), "this week vs last week"
   counted by when a day was done, not by block week, and a day before the
   current one with no completion reading as missed.

   Run: node tools/test-mc-block.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PP = fs.readFileSync(path.resolve(__dirname, '../mc-program-progress.js'), 'utf8');
const BL = fs.readFileSync(path.resolve(__dirname, '../mc-block.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.error('::error::' + name); } }
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (!good) console.error('   got ' + JSON.stringify(a) + '  want ' + JSON.stringify(b));
  ok(name, good);
}

function load() {
  const store = {};
  const sandbox = {
    window: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(PP, sandbox);
  vm.runInContext(BL, sandbox);
  return sandbox.window;
}

const DAY = 86400000;
// Wednesday 2026-11-25, 12:00 local
const NOW = new Date(2026, 10, 25, 12, 0, 0).getTime();
const MON = new Date(2026, 10, 23, 0, 0, 0).getTime();

{
  const w = load();
  const P = w.MC_PROGRAM_PROGRESS, B = w.MC_BLOCK;
  const def = { weeks: 2, perWeek: 7, order: ['a', 'b', 'c', 'd', 'e'], rest: [6, 7] };
  P.ensure('x', def);
  // Last week: days 1-3 done Mon/Tue/Wed of the previous week, and day 4 on
  // its Friday (after "the same moment a week ago", so it must not count).
  P.complete('x', 1, { logId: 'L1' }, def);
  P.complete('x', 2, { logId: 'L2' }, def);
  P.complete('x', 3, { logId: 'L3' }, def);
  P.complete('x', 4, { logId: 'L4' }, def);
  P.complete('x', 5, { logId: 'L5' }, def);
  P.complete('x', 8, { logId: 'L8' }, def);
  const rec = P.get('x', def);
  rec.completed['1'].ts = MON - 7 * DAY + 10 * 3600000;
  rec.completed['2'].ts = MON - 6 * DAY + 10 * 3600000;
  rec.completed['3'].ts = MON - 5 * DAY + 10 * 3600000;
  rec.completed['4'].ts = MON - 3 * DAY + 10 * 3600000;
  rec.completed['5'].ts = MON - 2 * DAY + 10 * 3600000;
  rec.completed['8'].ts = MON + 10 * 3600000;
  rec.cursor = 10;

  const s = B.summary(rec, NOW);
  eq('training total excludes rest days', s.trainTotal, 10);
  eq('training done', s.trainDone, 6);
  eq('pct', s.pct, 60);
  eq('current day from the cursor', s.day, 10);
  eq('block week of the current day', s.week, 2);
  eq('total days', s.total, 14);
  eq('this week counts completions since Monday', s.thisWeek, 1);
  eq('last week counts only up to the same moment', s.lastWeek, 3);
  eq('delta', s.delta, -2);

  const g = B.grid(rec, NOW);
  eq('one row per week', g.length, 2);
  eq('week 1 states', g[0].days.map(d => d.state), ['done', 'done', 'done', 'done', 'done', 'rest', 'rest']);
  eq('week 2 states', g[1].days.map(d => d.state), ['done', 'missed', 'today', 'upcoming', 'upcoming', 'rest', 'rest']);
  eq('a done day carries its log id', g[1].days[0].logId, 'L8');
}

{
  // A phased block whose rest pattern changes week by week (hv's shape).
  const w = load();
  const P = w.MC_PROGRAM_PROGRESS, B = w.MC_BLOCK;
  const sc = {
    weeks: 2, perWeek: 7,
    phases: [
      { weeks: 1, rest: [3, 6], days: ['a', 'b', 'c', 'd', 'e'] },
      { weeks: 1, rest: [4], days: ['a', 'b', 'c', 'd', 'e', 'f'] }
    ],
    days: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id: id, ex: 5 }))
  };
  const def = P.defFromSchedule(sc);
  ok('phased def resolves', !!def);
  if (def) {
    P.ensure('h', def);
    const s = B.summary(P.get('h', def), NOW);
    eq('training total follows each week\'s own rest', s.trainTotal, 5 + 6);
    eq('nothing done', s.trainDone, 0);
    eq('nothing this week or last', [s.thisWeek, s.lastWeek, s.delta], [0, 0, 0]);
    const g = B.grid(P.get('h', def), NOW);
    eq('week 2 rest only at position 4', g[1].days.map(d => d.state === 'rest'), [false, false, false, true, false, false, false]);
    eq('day 1 is today, no missed', g[0].days[0].state, 'today');
  }
}

{
  const w = load();
  const B = w.MC_BLOCK;
  eq('Monday of a Sunday is six days back', B.mondayOf(new Date(2026, 10, 29, 9).getTime()), MON);
  eq('Monday of a Monday is itself', B.mondayOf(new Date(2026, 10, 23, 23).getTime()), MON);
}

{
  const B = load().MC_BLOCK;
  eq('dark ink on a mid accent (mm)', B.inkOn('#6f77e0'), 'var(--ink-0)');
  eq('light ink on a deep accent', B.inkOn('#1e3a8a'), 'var(--ink-11)');
  eq('no hex falls back to dark ink', B.inkOn('var(--accent)'), 'var(--ink-0)');
}

console.log('test-mc-block: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
