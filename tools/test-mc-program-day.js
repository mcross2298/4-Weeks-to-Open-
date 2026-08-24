#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-program-day.js — regression coverage for mc-program-day.js, the
   day-identity contract (program-flow-roadmap.md F4).

   Loads the ACTUAL source alongside the real mc-program-progress.js in a
   mocked window/localStorage — the same vm technique as
   test-mc-program-progress.js and test-mc-bridge.js — so the assertions run
   against shipped code rather than a transcribed copy.

   What matters here is attribution: a page's live resolver turning into the
   right CONTINUOUS day number, the rank->position conversion for pages that
   list only trainable workouts, and the refusals — never invent a schedule for
   a program that has no record, never bank a rest slot, never bank when no day
   is open. A wrong answer here silently ticks off the wrong training day,
   which is worse than not recording one at all.

   Run: node tools/test-mc-program-day.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROG_SRC = fs.readFileSync(path.resolve(__dirname, '../mc-program-progress.js'), 'utf8');
const DAY_SRC  = fs.readFileSync(path.resolve(__dirname, '../mc-program-day.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('::error::' + name); } }
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (!good) console.error('   got ' + JSON.stringify(a) + '  want ' + JSON.stringify(b));
  ok(name, good);
}

// The real Strength & Supersets shape: 6 weeks, 5 training days, the Weekly
// Layout Standard's 5-on 2-off rest pattern.
const SS = { weeks: 6, perWeek: 7, order: ['legs','chest','back_shoulders','arms_forearms','cardio_calves'], rest: [6,7] };

// A program whose rest days sit MID-week — the case a renderer that hardcodes
// "the last two slots are rest" gets wrong.
const MID = { weeks: 4, perWeek: 7, order: ['push','pull','legs','upper','lower'], rest: [3,7] };

function load(programs, seed) {
  const store = Object.assign({}, seed || {});
  const listeners = {};
  const sandbox = {
    window: {},
    document: {
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      dispatchEvent: ev => { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; }
    },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(PROG_SRC, sandbox);
  // mc-pm-data.js is a big data file; the contract only ever reads
  // .program(id).schedule, so a stub keeps the test about attribution.
  sandbox.window.MC_PM_DATA = { program: id => (programs[id] ? { id, schedule: programs[id] } : null) };
  vm.runInContext(DAY_SRC, sandbox);
  return {
    D: sandbox.window.MC_PROGRAM_DAY,
    P: sandbox.window.MC_PROGRAM_PROGRESS,
    store,
    finish: entry => sandbox.document.dispatchEvent(
      new sandbox.CustomEvent('mc:workout-finished', { detail: { entry: entry || {} } })),
    banked: () => { const out = []; (listeners['mc:program-day-banked'] || []); return out; },
    sandbox, listeners
  };
}

// ── 1. no resolver / unusable answers ───────────────────────────────────────
{
  const { D } = load({ ss: SS });
  eq('1a no resolver registered -> null', D.current(), null);
  eq('1b and no day number', D.dayNumber(), null);
  eq('1c and banking is a no-op', D.bank({ id: 'x' }), null);

  D.provide(() => null);
  eq('1d resolver returning null (no day open) -> null', D.current(), null);

  D.provide(() => { throw new Error('page blew up'); });
  eq('1e a throwing resolver is contained, not propagated', D.current(), null);

  D.provide(() => ({ week: 1, position: 1 }));
  eq('1f missing prog -> null', D.current(), null);

  D.provide(() => ({ prog: 'ss', position: 1 }));
  eq('1g missing week -> null', D.current(), null);

  D.provide(() => ({ prog: 'ss', week: 1 }));
  eq('1h neither position nor rank -> null', D.current(), null);

  D.provide(() => ({ prog: 'ss', week: 0, position: 1 }));
  eq('1i week 0 is not a week', D.current(), null);

  D.provide(() => ({ prog: 'ss', week: 1, position: 0 }));
  eq('1j position 0 is not a position', D.current(), null);
}

// ── 2. position -> continuous day number ────────────────────────────────────
{
  const { D } = load({ ss: SS });
  D.provide(() => ({ prog: 'ss', week: 1, position: 1 }));
  eq('2a week 1 position 1 is day 1', D.dayNumber(), 1);

  D.provide(() => ({ prog: 'ss', week: 2, position: 1 }));
  eq('2b week 2 position 1 is day 8 (the reference UI\'s "Day 8")', D.dayNumber(), 8);

  D.provide(() => ({ prog: 'ss', week: 6, position: 5 }));
  eq('2c last training day of the block is day 40', D.dayNumber(), 40);

  D.provide(() => ({ prog: 'ss', week: 3, position: 9 }));
  eq('2d a position past the week length is refused', D.dayNumber(), null);

  D.provide(() => ({ prog: 'ss', week: 2, position: 2 }));
  eq('2e current() normalises to {prog,week,position}', D.current(), { prog: 'ss', week: 2, position: 2 });
}

// ── 3. rank -> position, under a real rest pattern ──────────────────────────
{
  const { D } = load({ ss: SS });
  D.provide(() => ({ prog: 'ss', week: 1, rank: 1 }));
  eq('3a rank 1 is position 1', D.current().position, 1);
  D.provide(() => ({ prog: 'ss', week: 1, rank: 5 }));
  eq('3b rank 5 is position 5 (rest is 6-7, so they do not shift)', D.current().position, 5);
  D.provide(() => ({ prog: 'ss', week: 1, rank: 6 }));
  eq('3c rank 6 does not exist -- only 5 training days', D.current(), null);
}
{
  // The case that makes rank->position worth centralising: rest MID-week.
  const { D } = load({ mid: MID });
  D.provide(() => ({ prog: 'mid', week: 1, rank: 3 }));
  eq('3d with rest at 3, the 3rd training day is position 4', D.current().position, 4);
  D.provide(() => ({ prog: 'mid', week: 1, rank: 5 }));
  eq('3e and the 5th is position 6', D.current().position, 6);
  D.provide(() => ({ prog: 'mid', week: 2, rank: 1 }));
  eq('3f week 2 rank 1 is day 8', D.dayNumber(), 8);
}

// ── 4. never invent a schedule ──────────────────────────────────────────────
{
  const { D, store } = load({});          // no program carries a record
  D.provide(() => ({ prog: 'mm', week: 1, position: 1 }));
  eq('4a a program with no schedule record resolves position directly', D.current(), { prog: 'mm', week: 1, position: 1 });
  eq('4b but has no day number to attribute against', D.dayNumber(), null);
  eq('4c and banking is refused', D.bank({ id: 'x' }), null);
  eq('4d nothing was written', Object.keys(store).length, 0);
}
{
  const { D } = load({ ss: SS });
  D.provide(() => ({ prog: 'nosuch', week: 1, rank: 1 }));
  eq('4e an unknown program cannot convert a rank', D.current(), null);
}

// ── 5. banking, and the rest-slot refusal ───────────────────────────────────
{
  const { D, P, store } = load({ ss: SS });
  D.provide(() => ({ prog: 'ss', week: 1, position: 2 }));
  eq('5a bank returns the day it recorded', D.bank({ id: 'log-1' }), 2);

  const rec = P.get('ss', SS);
  ok('5b the day is marked completed', !!rec.completed['2']);
  eq('5c the banked log id is kept for the deep link', rec.completed['2'].logId, 'log-1');
  eq('5d the week is recorded with it', rec.completed['2'].week, 1);
  ok('5e something was persisted', Object.keys(store).length > 0);

  D.provide(() => ({ prog: 'ss', week: 1, position: 6 }));   // 6 and 7 are rest
  eq('5f a rest slot is never banked as a trained day', D.bank({ id: 'log-2' }), null);
  ok('5g and left no completion behind', !P.get('ss', SS).completed['6']);
}

// ── 6. the finish event is the one completion point ─────────────────────────
{
  const { D, P, finish, listeners } = load({ ss: SS });
  D.provide(() => ({ prog: 'ss', week: 2, position: 1 }));

  let announced = null;
  listeners['mc:program-day-banked'] = [ev => { announced = ev.detail; }];

  finish({ id: 'log-9' });
  ok('6a finishing a workout banks the open day', !!P.get('ss', SS).completed['8']);
  eq('6b and announces what it banked', announced, { prog: 'ss', week: 2, day: 8 });
}
{
  const { P, finish, listeners } = load({ ss: SS });
  let announced = null;
  listeners['mc:program-day-banked'] = [ev => { announced = ev.detail; }];
  finish({ id: 'log-9' });                 // no resolver registered
  eq('6c a page that never registered banks nothing', Object.keys(P.get('ss', SS).completed).length, 0);
  eq('6d and announces nothing', announced, null);
}

// ── 7. the resolver is live, not captured ───────────────────────────────────
{
  const { D } = load({ ss: SS });
  let week = 1, position = 1;              // stands in for an engine's own state
  D.provide(() => ({ prog: 'ss', week: week, position: position }));
  eq('7a reads the state as it is now', D.dayNumber(), 1);
  week = 4; position = 3;                  // the athlete switched week and day
  eq('7b and again after it changes -- no value was captured at load', D.dayNumber(), 24);
}

console.log('test-mc-program-day.js: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
