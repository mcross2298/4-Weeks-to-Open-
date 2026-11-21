#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-boxing-camp-data.js — the 12-Week Boxing Camp data vs. its brief
   --------------------------------------------------------------------------
   boxing-camp-data.js is loaded in a vm sandbox (the test-mc-bridge.js
   technique) and held to the camp brief (boxing-camp-roadmap.md):
     * 3 phases covering weeks 1-4 / 5-8 / 9-12, contiguous
     * the round clock is 3:00 work / 0:30 rest
     * only Jump Rope and Heavy Bag scale (3 / 4 / 5); every other drill is 1x
     * the heavy-bag combo set per round, cumulative, with new vs. carried
     * finishers: sit-up targets 50 / 75 / 100, runs only in phases 2 and 3
     * every combo is named, and uses only legend punches
   It also checks the CONDITIONING routine entry that puts the camp on the
   Conditioning tab.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'boxing-camp-data.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'conditioning-data.js'), 'utf8') + ';window.CONDITIONING=CONDITIONING;', sandbox);
const CAMP = sandbox.window.MC_BOXING_CAMP;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  FAIL ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }

ok(!!CAMP, 'window.MC_BOXING_CAMP is published');
eq(CAMP.WORK, 180, 'round work is 3:00');
eq(CAMP.REST, 30, 'round rest is 0:30');
eq(Object.keys(CAMP.PUNCHES).sort(), ['1', '2', '3', '4', '6', '7'], 'legend punches');
eq(CAMP.PUNCHES['4'], 'Right Uppercut', '4 is the Right Uppercut');
eq(CAMP.PUNCHES['6'], 'Left Body Shot', '6 is the Left Body Shot');

eq(CAMP.phases.map(p => p.weeks), [[1, 4], [5, 8], [9, 12]], 'phase week ranges');

const SINGLES = ['Pushups', 'Leg Raises', 'Jumping Jacks', 'Flutter + Scissor Kicks', 'Burpees', 'Shadow Box', 'Slip Unders'];
const SCALE = { 1: 3, 2: 4, 3: 5 };
CAMP.phases.forEach(p => {
  const n = SCALE[p.id];
  eq(p.drills.map(d => d.name), ['Jump Rope'].concat(SINGLES, ['Heavy Bag']), 'P' + p.id + ' drill order');
  p.drills.forEach(d => {
    const want = (d.name === 'Jump Rope' || d.name === 'Heavy Bag') ? n : 1;
    eq(d.rounds, want, 'P' + p.id + ' ' + d.name + ' rounds');
  });
  eq([p.rope, p.bag], [n, n], 'P' + p.id + ' rope/bag summary');
  eq(p.bagRounds.length, n, 'P' + p.id + ' heavy-bag round specs = bag rounds');
});

/* expected cumulative combo sets per round, straight from the brief */
const R1 = ['1', '2', '1+2', '1+1', '1+1+2', '1+2+1+2'];
const HOOK = ['3', '1+2+3', '1+3', '1+1+3', '1+1+2+3'];
const UP = ['1+4', '1+2+3+4'];
const BODY = ['3+7', '1+3+7', '1+1+7', '6+7', '6+7+6+7'];
const EXPECT = {
  1: [[R1, []], [HOOK, R1], [UP, R1.concat(HOOK)]],
  2: [[R1, []], [HOOK.concat(UP), R1], [BODY, R1.concat(HOOK, UP)], [[], R1.concat(HOOK, UP, BODY)]],
  3: [[R1, []], [HOOK.concat(UP), R1], [BODY, R1.concat(HOOK, UP)],
      [[], R1.concat(HOOK, UP, BODY)], [[], R1.concat(HOOK, UP, BODY)]]
};
const sorted = a => a.slice().sort();
CAMP.phases.forEach(p => {
  EXPECT[p.id].forEach(([fresh, carried], i) => {
    const r = i + 1, got = CAMP.roundCombos(p, r);
    eq(sorted(got.filter(c => c.isNew).map(c => c.code)), sorted(fresh), 'P' + p.id + ' R' + r + ' new');
    eq(sorted(got.filter(c => !c.isNew).map(c => c.code)), sorted(carried), 'P' + p.id + ' R' + r + ' carried');
    eq(new Set(got.map(c => c.code)).size, got.length, 'P' + p.id + ' R' + r + ' no duplicate chips');
    ok(got.every(c => c.name && c.name !== c.code), 'P' + p.id + ' R' + r + ' every chip is named');
  });
  eq(CAMP.roundCombos(p, p.bagRounds.length + 1), [], 'P' + p.id + ' past the last round is empty');
});

Object.keys(CAMP.COMBOS).forEach(code => {
  ok(code.split('+').every(n => CAMP.PUNCHES[n]), 'combo ' + code + ' uses legend punches only');
});

/* finishers */
const sit = p => p.finishers.find(f => f.key === 'sit');
const run = p => p.finishers.find(f => f.key === 'run');
eq(CAMP.phases.map(p => sit(p).target), [50, 75, 100], 'sit-up targets');
eq(CAMP.phases.map(p => run(p) ? run(p).range : null), [null, [0.5, 1], [1, 2]], 'run ranges');

/* Conditioning tab entry */
const routines = [];
sandbox.window.CONDITIONING.subcategories.forEach(s => (s.routines || []).forEach(r => routines.push(r)));
const entry = routines.find(r => r.id === 'boxing-camp');
ok(!!entry, 'Conditioning Corner lists boxing-camp');
ok(entry && entry.href === 'boxing-camp.html' && fs.existsSync(path.join(ROOT, entry.href)), 'boxing-camp href resolves to a page');
eq(routines.filter(r => r.id === 'boxing-camp').length, 1, 'boxing-camp listed once');

console.log((fail ? 'test-boxing-camp-data: FAIL' : 'test-boxing-camp-data: OK') + ' — ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
