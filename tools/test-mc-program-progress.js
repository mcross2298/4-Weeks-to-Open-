#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-program-progress.js — regression coverage for mc-program-progress.js,
   the per-program day-progression state layer (program-day-view-roadmap.md D0).

   Loads the ACTUAL source in a mocked window/localStorage (it's a browser
   IIFE, not a CommonJS module) — same vm technique as test-mc-bridge.js and
   test-mc-sync-merge.js, so the assertions run against shipped code rather
   than a transcribed copy.

   What matters here is the day model: continuous day numbers across a block,
   rest positions as DATA (a renderer must never hardcode 5-on 2-off), the
   training-position ranking that maps a day number onto the right workout
   under ANY rest pattern, automatic advance onto rest days, and per-week
   reorder that leaves other weeks alone.

   Run: node tools/test-mc-program-progress.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '../mc-program-progress.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('::error::' + name); } }
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (!good) console.error('   got ' + JSON.stringify(a) + '  want ' + JSON.stringify(b));
  ok(name, good);
}

function load(seed) {
  const store = Object.assign({}, seed);
  const sandbox = {
    window: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { P: sandbox.window.MC_PROGRAM_PROGRESS, store };
}

// The real Strength & Supersets definition: 6 weeks, 5 training days, the
// Weekly Layout Standard's 5-on 2-off rest pattern.
const SS = {
  weeks: 6, perWeek: 7,
  order: ['legs', 'chest', 'back_shoulders', 'arms_forearms', 'cardio_calves'],
  rest: [6, 7]
};

// ── 1. day model ────────────────────────────────────────────────────────────
{
  const { P } = load({});
  const rec = P.ensure('ss', SS);

  eq('1a block length is weeks x perWeek', P.totalDays(rec), 42);
  eq('1b day 1 is week 1', P.weekOf(rec, 1), 1);
  eq('1c day 7 is still week 1', P.weekOf(rec, 7), 1);
  eq('1d day 8 is week 2 (the reference UI\'s "Day 8")', P.weekOf(rec, 8), 2);
  eq('1e day 8 is position 1 of its week', P.positionOf(rec, 8), 1);
  eq('1f day 42 is the last day of week 6', P.weekOf(rec, 42), 6);

  ok('1g position 6 is rest', P.isRest(rec, 6));
  ok('1h position 7 is rest', P.isRest(rec, 7));
  ok('1i position 1 is not rest', !P.isRest(rec, 1));
  ok('1j day 13 (week 2 pos 6) is rest', P.isRest(rec, 13));

  eq('1k day 1 -> first workout', P.workoutFor(rec, 1), 'legs');
  eq('1l day 5 -> fifth workout', P.workoutFor(rec, 5), 'cardio_calves');
  eq('1m rest day -> no workout', P.workoutFor(rec, 6), null);
  eq('1n day 8 restarts the order in week 2', P.workoutFor(rec, 8), 'legs');
  eq('1o day 12 is week 2 pos 5', P.workoutFor(rec, 12), 'cardio_calves');
  eq('1p day 36 (week 6 pos 1)', P.workoutFor(rec, 36), 'legs');
}

// ── 2. rest pattern is DATA, not a hardcoded 5-on 2-off ────────────────────
// The reference screenshot's own week reads DAY/DAY/DAY/REST/DAY/DAY/REST —
// rest at positions 4 and 7, not 6 and 7. Under that pattern the training
// positions are 1,2,3,5,6 and must still index the order array 0..4 in
// sequence; this is the ranking rule, and it is the thing most likely to be
// re-broken by someone assuming rest always sits at the end of the week.
{
  const { P } = load({});
  P.ensure('alt', { weeks: 2, perWeek: 7, order: SS.order, rest: [4, 7] });
  const rec = P.get('alt');

  ok('2a position 4 is rest', P.isRest(rec, 4));
  ok('2b position 6 trains under this pattern', !P.isRest(rec, 6));
  eq('2c pos 1 -> order[0]', P.workoutFor(rec, 1), 'legs');
  eq('2d pos 3 -> order[2]', P.workoutFor(rec, 3), 'back_shoulders');
  eq('2e pos 5 -> order[3] (rest at 4 does not consume a slot)', P.workoutFor(rec, 5), 'arms_forearms');
  eq('2f pos 6 -> order[4]', P.workoutFor(rec, 6), 'cardio_calves');
  eq('2g week 2 pos 1 restarts the order', P.workoutFor(rec, 8), 'legs');
}

// ── 3. completion + automatic progression ───────────────────────────────────
{
  const { P } = load({});
  P.ensure('ss', SS);

  eq('3a fresh program opens on day 1', P.currentDay('ss', SS), 1);

  P.complete('ss', 1, { logId: 'cat-strength|iso-1', workoutId: 'legs' }, SS);
  eq('3b completing day 1 advances the cursor to day 2', P.currentDay('ss', SS), 2);
  ok('3c day 1 reads complete', P.dayInfo('ss', 1, SS).complete);
  eq('3d the banked log id is retained for "View log"', P.dayInfo('ss', 1, SS).logId, 'cat-strength|iso-1');
  ok('3e day 2 is not complete', !P.dayInfo('ss', 2, SS).complete);

  // The spec is explicit: progression lands ON a rest day, it does not skip it.
  [2, 3, 4].forEach(d => P.complete('ss', d, {}, SS));
  P.complete('ss', 5, {}, SS);
  eq('3f finishing the week\'s last training day advances onto rest', P.currentDay('ss', SS), 6);
  ok('3g and that day really is a rest day', P.dayInfo('ss', 6, SS).rest);

  // A rest hero needs to name the next training day without moving the cursor.
  const rec = P.get('ss', SS);
  eq('3h next training day after rest day 6 is day 8', P.nextTrainingFrom(rec, 6), 8);
  eq('3i cursor is unchanged by peeking', P.currentDay('ss', SS), 6);

  eq('3j last day of the block has no next day', P.nextDayFrom(rec, 42), null);
}

// ── 4. cursor jumps + un-complete ───────────────────────────────────────────
{
  const { P } = load({});
  P.ensure('ss', SS);
  P.complete('ss', 1, {}, SS);

  P.setCursor('ss', 12, SS);
  eq('4a tapping a day pill jumps the cursor', P.currentDay('ss', SS), 12);
  P.setCursor('ss', 99, SS);
  eq('4b a cursor past the block clamps to the last day', P.currentDay('ss', SS), 42);
  P.setCursor('ss', -3, SS);
  eq('4c a cursor before day 1 clamps to 1', P.currentDay('ss', SS), 1);

  P.uncomplete('ss', 1, true, SS);
  ok('4d un-completing clears the record', !P.dayInfo('ss', 1, SS).complete);
  eq('4e ...and rewinds the cursor when asked', P.currentDay('ss', SS), 1);
}

// ── 5. per-week reorder ─────────────────────────────────────────────────────
{
  const { P } = load({});
  P.ensure('ss', SS);

  P.reorderWeek('ss', 2, ['chest', 'legs', 'back_shoulders', 'arms_forearms', 'cardio_calves'], SS);
  eq('5a week 2 day 1 uses the reordered list', P.workoutFor(P.get('ss', SS), 8), 'chest');
  eq('5b week 2 day 2 follows it', P.workoutFor(P.get('ss', SS), 9), 'legs');
  eq('5c week 1 is untouched', P.workoutFor(P.get('ss', SS), 1), 'legs');
  eq('5d week 3 is untouched', P.workoutFor(P.get('ss', SS), 15), 'legs');

  // Storing an override identical to the program order would silently go stale
  // the day the program's own order changes, so it is dropped instead.
  P.reorderWeek('ss', 3, SS.order.slice(), SS);
  eq('5e a no-op reorder stores no override', P.get('ss', SS).weekOrder['3'], undefined);

  P.reorderWeek('ss', 2, null, SS);
  eq('5f clearing an override restores the program order', P.workoutFor(P.get('ss', SS), 8), 'legs');
}

// ── 6. rest-pattern edits (Workout schedule) ────────────────────────────────
{
  const { P } = load({});
  P.ensure('ss', SS);

  P.setRest('ss', [5, 6, 7], SS);
  const rec = P.get('ss', SS);
  eq('6a four training days a week now', rec.rest.length, 3);
  eq('6b the fourth training day is the last one', P.workoutFor(rec, 4), 'arms_forearms');
  eq('6c position 5 is now rest', P.workoutFor(rec, 5), null);

  // A week with no training slots would make the block unreachable with no UI
  // path back out, so it is refused rather than stored.
  P.setRest('ss', [1, 2, 3, 4, 5, 6, 7], SS);
  ok('6d an all-rest week is refused', P.get('ss', SS).rest.length < 7);

  // Out-of-range and duplicate positions are dropped, not stored.
  P.setRest('ss', [7, 7, 9, 0, 6], SS);
  eq('6e positions are deduped, sorted and range-checked', P.get('ss', SS).rest, [6, 7]);
}

// ── 7. restart ──────────────────────────────────────────────────────────────
{
  const { P } = load({});
  P.ensure('ss', SS);
  [1, 2, 3].forEach(d => P.complete('ss', d, {}, SS));
  P.setCursor('ss', 20, SS);

  P.restart('ss', SS);
  eq('7a restart returns to day 1', P.currentDay('ss', SS), 1);
  eq('7b restart clears completion', Object.keys(P.get('ss', SS).completed).length, 0);
  ok('7c restart re-stamps startedAt', !!P.get('ss', SS).startedAt);
}

// ── 8. one program's progress never touches another's ───────────────────────
// This is exactly why the store is a dict keyed by program id merged with
// mc-sync.js's per-key 'dictBase' strategy rather than a scalar.
{
  const { P, store } = load({});
  P.ensure('ss', SS);
  P.ensure('mm', { weeks: 15, perWeek: 7, order: ['d1', 'd2', 'd3', 'd4'], rest: [5, 6, 7] });
  P.complete('ss', 1, {}, SS);

  eq('8a the other program is unaffected', P.currentDay('mm'), 1);
  eq('8b both programs coexist in one store', Object.keys(JSON.parse(store['mc_program_progress_v1'])).sort(), ['mm', 'ss']);
  eq('8c each keeps its own block length', P.totalDays(P.get('mm')), 105);
}

// ── 9. rest-hero stats ──────────────────────────────────────────────────────
{
  const { P } = load({});
  P.ensure('ss', SS);
  eq('9a nothing completed -> no days-since', P.stats('ss', 1, SS).daysSinceLast, null);

  P.complete('ss', 1, {}, SS);
  P.complete('ss', 2, {}, SS);
  const s = P.stats('ss', 6, SS);
  eq('9b days since a just-now completion is 0', s.daysSinceLast, 0);
  eq('9c this week\'s completed count', s.completedThisWeek, 2);
  eq('9d training days per week derives from the rest pattern', s.trainingDaysPerWeek, 5);
  eq('9e block training total', s.totalTrainingDays, 30);

  // Completions in a different week must not inflate this week's count.
  P.complete('ss', 8, {}, SS);
  eq('9f week 1 count excludes week 2', P.stats('ss', 1, SS).completedThisWeek, 2);
  eq('9g week 2 count excludes week 1', P.stats('ss', 8, SS).completedThisWeek, 1);
  eq('9h total spans weeks', P.stats('ss', 1, SS).completedTotal, 3);
}

// ── 10. persistence + malformed-store tolerance ─────────────────────────────
{
  const seed = {};
  const a = load(seed);
  a.P.ensure('ss', SS);
  a.P.complete('ss', 1, { logId: 'x' }, SS);

  // Reload from the same backing store, as a page reload would.
  const b = load(a.store);
  eq('10a completion survives a reload', b.P.dayInfo('ss', 1, SS).complete, true);
  eq('10b cursor survives a reload', b.P.currentDay('ss', SS), 2);

  const c = load({ 'mc_program_progress_v1': '{{{ not json' });
  eq('10c a corrupt store degrades to a fresh record', c.P.currentDay('ss', SS), 1);

  // A record written before the program gained a week must pick the new
  // length up from the caller's definition rather than need a migration.
  const d = load({ 'mc_program_progress_v1': JSON.stringify({ ss: { completed: { '1': { ts: 1 } } } }) });
  eq('10d an older record inherits the current definition', d.P.totalDays(d.P.get('ss', SS)), 42);
  ok('10e ...while keeping its completion history', d.P.dayInfo('ss', 1, SS).complete);
}

// ── 11. authored phases (roadmap F5) ────────────────────────────────────────
// The Modality Matrix is ONE 15-week program made of three 5-week phases that
// each run a completely different day set. A flat `order` cannot say that, so
// `def.phases` carries the authored content -- and must stay separate from
// weekOrder, which is the athlete's own reorder.
{
  const MM = {
    weeks: 15, perWeek: 7, rest: [5],
    order: ['p1a', 'p1b', 'p1c', 'p1d', 'p1cond1', 'p1cond2'],
    phases: [
      { weeks: 5, order: ['p1a', 'p1b', 'p1c', 'p1d', 'p1cond1', 'p1cond2'] },
      { weeks: 5, order: ['p2a', 'p2b', 'p2c', 'p2d', 'p2cond1', 'p2cond2'] },
      { weeks: 5, order: ['p3a', 'p3b', 'p3c', 'p3d', 'p3cond1', 'p3cond2'] }
    ]
  };
  const { P } = load({});
  const rec = P.ensure('mm', MM);

  eq('11a a 15-week block is 105 days', P.totalDays(rec), 105);
  eq('11b week 5 is the last week of phase 1', P.phaseForWeek(rec, 5).order[0], 'p1a');
  eq('11c week 6 is the FIRST week of phase 2', P.phaseForWeek(rec, 6).order[0], 'p2a');
  eq('11d week 11 is the first week of phase 3', P.phaseForWeek(rec, 11).order[0], 'p3a');
  eq('11e week 15 is still phase 3', P.phaseForWeek(rec, 15).order[0], 'p3a');
  eq('11f a week past the block has no phase', P.phaseForWeek(rec, 16), null);

  eq('11g week 1 runs the phase-1 day set', P.orderForWeek(rec, 1)[1], 'p1b');
  eq('11h week 6 runs the phase-2 day set', P.orderForWeek(rec, 6)[1], 'p2b');
  eq('11i week 11 runs the phase-3 day set', P.orderForWeek(rec, 11)[1], 'p3b');

  // Day 36 = week 6 position 1 (5 weeks x 7 = 35 days behind it), which is
  // phase 2's first workout -- the arithmetic the whole contract turns on.
  eq('11j day 36 is week 6', P.weekOf(rec, 36), 6);
  eq('11k day 36 is position 1', P.positionOf(rec, 36), 1);
  eq('11l day 36 prescribes phase 2, not phase 1', P.workoutFor(rec, 36), 'p2a');
  eq('11m day 1 still prescribes phase 1', P.workoutFor(rec, 1), 'p1a');
  eq('11n day 71 (week 11) prescribes phase 3', P.workoutFor(rec, 71), 'p3a');

  // Position 5 is the block's rest slot in EVERY phase.
  ok('11o position 5 is rest in phase 1', P.isRest(rec, 5));
  ok('11p position 5 is rest in phase 2', P.isRest(rec, 40));

  // An athlete reordering one week must beat the authored phase for THAT week
  // only -- and must not leak into the phase's other weeks.
  const r2 = P.reorderWeek('mm', 6, ['p2c', 'p2a', 'p2b', 'p2d', 'p2cond1', 'p2cond2'], MM);
  eq('11q a reorder wins over the authored phase', P.orderForWeek(r2, 6)[0], 'p2c');
  eq('11r ...for that week only', P.orderForWeek(r2, 7)[0], 'p2a');
  eq('11s ...and never touches another phase', P.orderForWeek(r2, 1)[0], 'p1a');

  // Phase content is AUTHORED: re-derived from def on every read, never
  // persisted. A record stored without it still resolves phases correctly.
  const bare = load({ 'mc_program_progress_v1': JSON.stringify({ mm: { completed: { '36': { ts: 1 } } } }) });
  eq('11t phases come from the definition, not the store',
     bare.P.workoutFor(bare.P.get('mm', MM), 36), 'p2a');
  ok('11u ...while the stored completion survives', bare.P.dayInfo('mm', 36, MM).complete);

  // A program with no phases is unchanged -- the flat order still governs.
  const flat = load({});
  const frec = flat.P.ensure('ss', SS);
  eq('11v a program with no phases uses its flat order', flat.P.orderForWeek(frec, 3)[0], 'legs');
  eq('11w ...and has no phase for any week', flat.P.phaseForWeek(frec, 3), null);
}

console.log((fail ? '✗' : '✓') + ' mc-program-progress: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
