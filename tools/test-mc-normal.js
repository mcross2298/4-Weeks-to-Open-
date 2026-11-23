#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-normal.js — "what's normal" (command-center-roadmap.md PR 3).
   Runs the real mc-log-read.js and mc-recap.js in a vm sandbox and checks
   MC_RECAP.weekNormal(): the average of the up to six calendar weeks before
   a week that have training in them, an empty week left out, nothing older
   than six weeks counted, and null until there are three weeks to go on.
   Run: node tools/test-mc-normal.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (good) pass++; else { fail++; console.error('::error::' + name + '\n   got ' + JSON.stringify(a) + '  want ' + JSON.stringify(b)); }
}
const SRC = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

// Wednesday noon, `weeksBack` calendar weeks before this one (Mon-Sun).
function wedOf(weeksBack) {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 2 - 7 * weeksBack);
  return d.toISOString();
}
function session(weeksBack, n, sets) {
  const set = { name: 'Bench Press', weight: 100, reps: 10 };
  return { id: 'w' + weeksBack + '-' + n, date: wedOf(weeksBack), sets: Array.from({ length: sets }, () => Object.assign({}, set)) };
}
function load(log) {
  const store = { mc_workout_log_v1: JSON.stringify(log) };
  const sb = {
    window: {},
    document: { readyState: 'complete', getElementById() { return null; }, addEventListener() {} },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  vm.createContext(sb);
  vm.runInContext(SRC('mc-log-read.js'), sb);
  vm.runInContext(SRC('mc-recap.js'), sb);
  return sb.window.MC_RECAP;
}

{
  const R = load([
    session(0, 1, 7),                                  // this week: not part of its own normal
    session(1, 1, 10), session(1, 2, 10),               // 2 sessions, 20 sets
    session(2, 1, 10), session(2, 2, 10), session(2, 3, 10),
    session(4, 1, 5),                                   // week 3 is empty
    session(7, 1, 40)                                   // older than six weeks
  ]);
  const n = R.weekNormal(0);
  eq('weeks with training only', n.weeks, 3);
  eq('sessions averaged', n.sessions, 2);
  eq('sets averaged', n.sets, Math.round(55 / 3));
  eq('tonnage averaged (weight x reps)', n.tonnage, Math.round(55000 / 3));
  eq('this week is the same arithmetic', R.statsForWeek(0).sets, 7);
  eq('a past week has its own normal (offset 1: weeks 2..7, three with training)', R.weekNormal(1).weeks, 3);
}

{
  const R = load([session(1, 1, 10), session(2, 1, 10)]);
  eq('fewer than three weeks: no normal yet', R.weekNormal(0), null);
}

{
  const R = load([]);
  eq('no history: no normal', R.weekNormal(0), null);
}

console.log('test-mc-normal: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
