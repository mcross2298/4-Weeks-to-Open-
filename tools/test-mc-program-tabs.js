#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-program-tabs.js — regression coverage for mc-program-tabs.js, the
   program landing's Overview | Program list tabs (program-flow-roadmap.md F1).

   Loads the ACTUAL source in a mocked window/localStorage (it's a browser
   IIFE, not a CommonJS module) — same vm technique as
   test-mc-program-progress.js, so the assertions run against shipped code
   rather than a transcribed copy. mc-program-progress.js is loaded into the
   same sandbox because the list's day numbers and completion ticks are
   derived from a real record, not from a fixture of what one looks like.

   What matters here is the ADAPTIVE decision (roadmap decision 6): `splits`
   in mc-pm-data.js means three different things, so Program list renders
   however many levels a program actually has. One group is a program whose
   splits ARE its days and must NOT gain a drill-in level containing one row;
   several groups must. And the `Day N` on a row is the record's continuous
   day number, so a reordered week or a mid-week rest pattern renumbers with
   no renderer change — the same property test-mc-program-progress.js pins on
   the layer underneath.

   Run: node tools/test-mc-program-tabs.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PROGRESS_SRC = fs.readFileSync(path.join(ROOT, 'mc-program-progress.js'), 'utf8');
const TABS_SRC = fs.readFileSync(path.join(ROOT, 'mc-program-tabs.js'), 'utf8');

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
  vm.runInContext(PROGRESS_SRC, sandbox);
  vm.runInContext(TABS_SRC, sandbox);
  return {
    P: sandbox.window.MC_PROGRAM_PROGRESS,
    T: sandbox.window.MC_PROGRAM_TABS,
    store
  };
}

// The real Strength & Supersets block: 6 weeks, 5 training days, the Weekly
// Layout Standard's 5-on 2-off rest pattern.
const SS = {
  weeks: 6, perWeek: 7,
  order: ['legs', 'chest', 'back_shoulders', 'arms_forearms', 'cardio_calves'],
  rest: [6, 7]
};
const TITLES = {
  legs: 'Legs', chest: 'Chest', back_shoulders: 'Back & Shoulders',
  arms_forearms: 'Arms & Forearms', cardio_calves: 'Calves & Cardio'
};
const MINUTES = { legs: 75, chest: 80, back_shoulders: 80, arms_forearms: 80, cardio_calves: 30 };
function dayMeta(id) {
  return TITLES[id] ? { title: TITLES[id], icon: '•', min: MINUTES[id] } : null;
}

const ONE_GROUP = {
  progId: 'ss', def: SS, dayMeta: dayMeta,
  groups: [{ id: 'cycle', name: 'The 6-Week Cycle', days: SS.order.slice() }]
};

// ── 1. one group renders its days directly ──────────────────────────────────
{
  const { P, T } = load({});
  const rec = P.ensure('ss', SS);
  ok('one group -> no drill-in', T.hasDrillIn(ONE_GROUP) === false);

  const m = T.listModel(ONE_GROUP, { P, rec, week: 1 });
  eq('one group -> level is days', m.level, 'days');
  ok('one group -> no context header', m.header === null);
  eq('one group -> five rows', m.rows.length, 5);
  eq('rows are days', m.rows.map(r => r.kind), ['day', 'day', 'day', 'day', 'day']);
  eq('row names come from dayMeta', m.rows.map(r => r.name),
    ['Legs', 'Chest', 'Back & Shoulders', 'Arms & Forearms', 'Calves & Cardio']);
  eq('week 1 day numbers', m.rows.map(r => r.day), [1, 2, 3, 4, 5]);
  eq('meta line is Day N + duration', m.rows[0].meta, 'Day 1 · 75 min');
  eq('nothing is ticked on a fresh record', m.rows.filter(r => r.complete).length, 0);
}

// ── 2. day numbers are continuous across the block ──────────────────────────
{
  const { P, T } = load({});
  const rec = P.ensure('ss', SS);
  // perWeek is 7, so week 2 position 1 is day 8 — not day 6. A renderer that
  // counted training days only would put Legs on day 6 here.
  const m2 = T.listModel(ONE_GROUP, { P, rec, week: 2 });
  eq('week 2 day numbers', m2.rows.map(r => r.day), [8, 9, 10, 11, 12]);
  const m6 = T.listModel(ONE_GROUP, { P, rec, week: 6 });
  eq('week 6 day numbers', m6.rows.map(r => r.day), [36, 37, 38, 39, 40]);
}

// ── 3. rest positions are DATA, including mid-week ──────────────────────────
{
  // A program resting Thursday and Sunday. The five training workouts rank
  // onto positions 1,2,3,5,6 — so the third workout is day 3 and the fourth
  // is day 5. Hardcoding "5-on 2-off" anywhere would get this wrong.
  const MID = { weeks: 4, perWeek: 7, order: SS.order.slice(), rest: [4, 7] };
  const cfg = { progId: 'x', def: MID, dayMeta: dayMeta,
    groups: [{ id: 'g', name: 'G', days: MID.order.slice() }] };
  const { P, T } = load({});
  const rec = P.ensure('x', MID);
  const m = T.listModel(cfg, { P, rec, week: 1 });
  eq('mid-week rest -> day numbers skip the rest position', m.rows.map(r => r.day), [1, 2, 3, 5, 6]);
  const m2 = T.listModel(cfg, { P, rec, week: 2 });
  eq('mid-week rest -> week 2 offsets by perWeek', m2.rows.map(r => r.day), [8, 9, 10, 12, 13]);
}

// ── 4. a reordered week renumbers, and only that week ───────────────────────
{
  const { P, T } = load({});
  P.ensure('ss', SS);
  const rec = P.reorderWeek('ss', 2, ['chest', 'legs', 'back_shoulders', 'arms_forearms', 'cardio_calves'], SS);
  const m2 = T.listModel(ONE_GROUP, { P, rec, week: 2 });
  // Rows follow the WEEK'S order, not the group's authored order. Driving the
  // reorder sheet is what settled this: with rows pinned to the authored
  // order, moving a workout down renumbered it in place and reordering looked
  // like it had done nothing.
  eq('reorder -> rows follow the week order',
    m2.rows.map(r => r.id), ['chest', 'legs', 'back_shoulders', 'arms_forearms', 'cardio_calves']);
  eq('reorder -> day numbers ascend down the list', m2.rows.map(r => r.day), [8, 9, 10, 11, 12]);
  const m1 = T.listModel(ONE_GROUP, { P, rec, week: 1 });
  eq('reorder -> week 1 is untouched', m1.rows.map(r => r.id), SS.order);
  eq('reorder -> week 1 numbers are untouched', m1.rows.map(r => r.day), [1, 2, 3, 4, 5]);
}

// ── 5. completion ticks come from the record ────────────────────────────────
{
  const { P, T } = load({});
  P.ensure('ss', SS);
  const rec = P.complete('ss', 2, { logId: 'log-abc' }, SS);
  const m = T.listModel(ONE_GROUP, { P, rec, week: 1 });
  eq('only the completed day is ticked', m.rows.map(r => r.complete), [false, true, false, false, false]);
  eq('the completed row carries its logId', m.rows[1].logId, 'log-abc');
  ok('an uncompleted row has no logId', m.rows[0].logId === null);
  // Week 2 is a different set of days — the tick must not follow the workout.
  const m2 = T.listModel(ONE_GROUP, { P, rec, week: 2 });
  eq('the tick does not leak into another week', m2.rows.filter(r => r.complete).length, 0);
}

// ── 6. several groups -> a real drill-in level ──────────────────────────────
{
  const MANY = {
    progId: 'multi', def: SS, dayMeta: dayMeta,
    groups: [
      { id: 'a', name: 'Split A', desc: 'First split', days: ['legs', 'chest'] },
      { id: 'b', name: 'Split B', days: ['back_shoulders', 'arms_forearms', 'cardio_calves'] }
    ]
  };
  const { P, T } = load({});
  const rec = P.ensure('multi', SS);
  ok('several groups -> drill-in', T.hasDrillIn(MANY) === true);

  const top = T.listModel(MANY, { P, rec, week: 1 });
  eq('top level is groups', top.level, 'groups');
  eq('one row per group', top.rows.map(r => r.name), ['Split A', 'Split B']);
  eq('group rows are groups', top.rows.map(r => r.kind), ['group', 'group']);
  eq('a group row counts its workouts', top.rows[0].meta, '2 workouts');
  eq('the count is singular at one', T.listModel(
    { progId: 'm', def: SS, dayMeta, groups: [{ id: 'a', days: ['legs'] }, { id: 'b', days: ['chest'] }] },
    { P, rec, week: 1 }).rows[0].meta, '1 workout');
  ok('a group row is never ticked', top.rows.every(r => r.complete === false));

  const inB = T.listModel(MANY, { P, rec, week: 1, openGroup: 'b' });
  eq('drilled in -> level is days', inB.level, 'days');
  eq('drilled in -> that group\'s days', inB.rows.map(r => r.id),
    ['back_shoulders', 'arms_forearms', 'cardio_calves']);
  eq('drilled in -> context header names the split', inB.header.name, 'Split B');
  eq('drilled in -> header carries the group description',
    T.listModel(MANY, { P, rec, week: 1, openGroup: 'a' }).header.desc, 'First split');
  eq('drilled in -> day numbers still come from the record', inB.rows.map(r => r.day), [3, 4, 5]);
}

// ── 7. shapes that must not strand the list ─────────────────────────────────
{
  const { P, T } = load({});
  const rec = P.ensure('ss', SS);

  // A single-group program can never select a group, so a stale openGroup
  // must fall back to that group's days rather than render an empty level.
  const m = T.listModel(ONE_GROUP, { P, rec, week: 1, openGroup: 'nope' });
  eq('single group ignores a stale openGroup', m.level, 'days');
  eq('single group still renders its days', m.rows.length, 5);

  // An openGroup naming a group that does not exist, on a multi-group program,
  // returns to the group level rather than showing nothing.
  const MANY = { progId: 'm', def: SS, dayMeta,
    groups: [{ id: 'a', days: ['legs'] }, { id: 'b', days: ['chest'] }] };
  eq('unknown openGroup falls back to the group level',
    T.listModel(MANY, { P, rec, week: 1, openGroup: 'zzz' }).level, 'groups');

  // Empty groups are dropped, so a program mid-authoring does not render rows
  // that open nothing — and a program left with one real group loses its
  // drill-in, which is the correct shape for it.
  const SPARSE = { progId: 's', def: SS, dayMeta,
    groups: [{ id: 'a', days: ['legs', 'chest'] }, { id: 'b', days: [] }, { id: 'c' }] };
  ok('an empty group does not create a level', T.hasDrillIn(SPARSE) === false);
  eq('an empty group renders no rows', T.listModel(SPARSE, { P, rec, week: 1 }).rows.map(r => r.id),
    ['legs', 'chest']);

  // No groups at all: an empty list, not a crash.
  const NONE = { progId: 'n', def: SS, dayMeta, groups: [] };
  eq('no groups -> empty group level', T.listModel(NONE, { P, rec, week: 1 }).rows.length, 0);
  eq('no groups -> no drill-in', T.hasDrillIn(NONE), false);
  eq('missing groups key -> empty', T.listModel({ progId: 'q', def: SS }, { P, rec, week: 1 }).rows.length, 0);
}

// ── 8. a day the record does not schedule ───────────────────────────────────
{
  // Collection programs hold workouts beyond the block's own order. Such a row
  // still renders — it just carries no day number, because it has none.
  const EXTRA = {
    progId: 'ss', def: SS, dayMeta: function (id) {
      return dayMeta(id) || { title: 'Bonus Arms', icon: '•', min: 25 };
    },
    groups: [{ id: 'g', name: 'G', days: ['legs', 'bonus_arms'] }]
  };
  const { P, T } = load({});
  const rec = P.ensure('ss', SS);
  const m = T.listModel(EXTRA, { P, rec, week: 1 });
  eq('an unscheduled day gets no number', m.rows.map(r => r.day), [1, null]);
  eq('an unscheduled day sorts after the scheduled ones', m.rows.map(r => r.id), ['legs', 'bonus_arms']);
  eq('an unscheduled day still shows its duration', m.rows[1].meta, '25 min');
  ok('an unscheduled day is never ticked', m.rows[1].complete === false);
  // ... and it stays after them even when authored first.
  const FIRST = Object.assign({}, EXTRA, {
    groups: [{ id: 'g', name: 'G', days: ['bonus_arms', 'legs'] }]
  });
  eq('an unscheduled day authored first still sorts last',
    T.listModel(FIRST, { P, rec, week: 1 }).rows.map(r => r.id), ['legs', 'bonus_arms']);
  eq('dayNumber() agrees', T.dayNumber(rec, 1, 'bonus_arms', P), null);
  eq('dayNumber() for a scheduled day', T.dayNumber(rec, 3, 'chest', P), 16);
}

// ── 9. a day with no dayMeta at all ─────────────────────────────────────────
{
  const { P, T } = load({});
  const rec = P.ensure('ss', SS);
  const BARE = { progId: 'ss', def: SS, groups: [{ id: 'g', days: ['legs'] }] };
  const m = T.listModel(BARE, { P, rec, week: 1 });
  eq('no dayMeta -> the id is the name', m.rows[0].name, 'legs');
  eq('no dayMeta -> the meta line is still the day number', m.rows[0].meta, 'Day 1');
}

console.log((fail ? '::error::' : '') + 'mc-program-tabs: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
