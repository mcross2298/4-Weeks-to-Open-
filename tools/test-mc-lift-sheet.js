#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-lift-sheet.js — command-center-roadmap.md PR 2's figures, run in a
   vm sandbox against the real sources:
     • mc-exercise-trends.js: the best set (heaviest, more reps breaking a
       tie) and the next suggested load, found by the lift's NAME in
       mc_plan_targets_v1 (mc-suggest.js now records it), newest first.
     • mc-vitals.js: explain()'s parts add up to recoveryScore(), so the
       Recovery sheet can never show a sum that isn't the ring.
   Run: node tools/test-mc-lift-sheet.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (good) pass++; else { fail++; console.error('::error::' + name + '\n   got ' + JSON.stringify(a) + '  want ' + JSON.stringify(b)); }
}
function sandbox(store) {
  const sb = {
    window: {},
    document: { addEventListener() {}, querySelectorAll() { return []; } },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  vm.createContext(sb);
  return sb;
}
const SRC = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

{
  const store = {
    mc_plan_targets_v1: JSON.stringify({
      'mm-p1|x-bench-press': { w: 185, status: 'progress', why: 'All sets hit.', ts: 100, n: 'Bench Press' },
      'cat-strength|x-bench-press': { w: 190, status: 'progress', why: 'Newer.', ts: 200, n: 'bench press ', r: [8, 8, 8] },
      'mm-p1|x-row': { w: 135, ts: 300 }
    })
  };
  const sb = sandbox(store);
  vm.runInContext(SRC('mc-exercise-trends.js'), sb);
  const T = sb.window.MCTrends;
  eq('next load: newest target for the name wins, case and spaces ignored', T._nextFor('Bench Press').w, 190);
  eq('next load: a target with no recorded name is not guessed at', T._nextFor('Row'), null);
  eq('next load: nothing for an unknown lift', T._nextFor('Curl'), null);
  const best = T._bestSet([
    { weight: 185, topReps: 5, date: 'a' }, { weight: 205, topReps: 3, date: 'b' },
    { weight: 205, topReps: 4, date: 'c' }, { weight: 0, topReps: 20, date: 'd' }
  ]);
  eq('best set: heaviest, more reps breaking a tie', [best.weight, best.topReps, best.date], [205, 4, 'c']);
  eq('best set: none from bodyweight-only sessions', T._bestSet([{ weight: 0, topReps: 12 }]), null);
}

{
  const cases = [
    [{ readiness: 4, sleepHrs: 6.5, restingHr: 55 }],
    [{ readiness: 5, sleepHrs: 11 }],
    [{ sleepHrs: 3 }],
    [{ readiness: 1 }]
  ];
  cases.forEach(([entry], i) => {
    const store = { mc_vitals_v1: JSON.stringify([Object.assign({ id: 'x', date: '2026-11-23T08:00:00Z' }, entry)]) };
    const sb = sandbox(store);
    vm.runInContext(SRC('mc-vitals.js'), sb);
    const V = sb.window.MC_VITALS, x = V.explain();
    const sum = Math.round(Math.max(0, Math.min(100, x.parts.reduce((t, p) => t + (p.info ? 0 : p.effect), 0))));
    eq('vitals ' + i + ': the parts add up to the ring', sum, V.recoveryScore());
    eq('vitals ' + i + ': explain() reports the ring', x.score, V.recoveryScore());
  });
  const sb = sandbox({});
  vm.runInContext(SRC('mc-vitals.js'), sb);
  eq('vitals: no entry, nothing to explain', sb.window.MC_VITALS.explain(), null);
}

console.log('test-mc-lift-sheet: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
