#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-day-key.js — FIX-06 (engine-repair-roadmap.md Phase 5.1).

   mc_setlog_v1 stamped every session with
     new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'})
   which is "Sep 11" — a DISPLAY LABEL used as a primary key. It collides with
   itself every 365 days, it cannot be ordered (which is why mc-sync.js's
   five-session cap had to be patched separately under EN-10), and it is
   locale- and timezone-shaped.

   mc-log-read.js now owns the dated key and the upgrade path. This suite runs
   against that real source through its Node export hook — never a copy — and
   covers the three things that decide whether the migration is safe:

     • the key is LOCAL midnight, not UTC (a 7pm east-coast session must not
       file under tomorrow, which toISOString() would do);
     • a legacy label is dated from the entry's own `ts` when EN-10 stamped
       one, and otherwise from the most recent PAST occurrence;
     • a label it cannot read is returned UNTOUCHED. An unreadable date is
       recoverable; an invented one is not.

   Every case that involves inferring a year passes an explicit `now`, so the
   suite asserts the same thing on every day of the year rather than passing
   in September and failing the following March.

   Run: node tools/test-mc-day-key.js
   ========================================================================== */
const L = require('../mc-log-read.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (detail ? '  — ' + detail : ''));
}
function eq(name, a, b) { ok(name, a === b, JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }

// ---- dayKey: local midnight, zero-padded --------------------------------
eq('dayKey pads a single-digit month and day', L.dayKey(new Date(2026, 0, 5, 12)), '2026-01-05');
eq('dayKey reads December correctly', L.dayKey(new Date(2026, 11, 31, 12)), '2026-12-31');
ok('dayKey of no argument is today',
   L.dayKey() === L.dayKey(new Date()), L.dayKey());

// The UTC trap, stated as a test rather than as a comment: a late-evening
// session in a behind-UTC zone is still TODAY's session.
{
  const late = new Date(2026, 8, 11, 23, 30);
  eq('dayKey uses local time, not UTC', L.dayKey(late), '2026-09-11');
}
eq('dayKey of an unparseable value is empty, never a wrong date', L.dayKey('not a date'), '');
eq('dayKey of an Invalid Date is empty', L.dayKey(new Date('x')), '');

// ---- dayLabel: the athlete-facing text is unchanged ----------------------
eq('dayLabel renders the label this app has always shown', L.dayLabel('2026-09-11'), 'Sep 11');
eq('dayLabel drops the leading zero on the day', L.dayLabel('2026-09-05'), 'Sep 5');
eq('dayLabel leaves a legacy label alone — it already reads right',
   L.dayLabel('Sep 11'), 'Sep 11');
eq('dayLabel of nothing is empty, not "undefined"', L.dayLabel(null), '');
// The round trip is what guarantees the displayed string did not change.
{
  const d = new Date(2026, 8, 11, 12);
  eq('dayLabel(dayKey(d)) equals the pre-fix display string',
     L.dayLabel(L.dayKey(d)),
     d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
}

// ---- normalizeDay: the migration ----------------------------------------
const NOW = new Date(2026, 8, 11, 12);   // Fri 11 Sep 2026

eq('normalizeDay leaves an already-dated key alone',
   L.normalizeDay('2025-01-02', null, NOW), '2025-01-02');
eq('normalizeDay prefers the entry\'s own ts over the label',
   L.normalizeDay('Jan 5', new Date(2024, 0, 5, 12).getTime(), NOW), '2024-01-05');
eq('normalizeDay dates a label with no ts to the most recent PAST occurrence',
   L.normalizeDay('Jan 5', null, NOW), '2026-01-05');
eq('normalizeDay rolls a label later in the year back to last year',
   L.normalizeDay('Dec 25', null, NOW), '2025-12-25');
eq('normalizeDay treats today\'s own label as today, not a year ago',
   L.normalizeDay('Sep 11', null, NOW), '2026-09-11');
eq('normalizeDay accepts a full month name', L.normalizeDay('September 11', null, NOW), '2026-09-11');

// Feb 29 is the case a naive `new Date(year, 1, 29)` gets wrong: it rolls to
// Mar 1 and files the session under the wrong day entirely.
eq('normalizeDay walks back to a year in which Feb 29 exists',
   L.normalizeDay('Feb 29', null, NOW), '2024-02-29');

// Never invent a date.
eq('normalizeDay returns an unreadable label untouched',
   L.normalizeDay('Mon 1/5', null, NOW), 'Mon 1/5');
eq('normalizeDay returns an impossible day untouched',
   L.normalizeDay('Feb 40', null, NOW), 'Feb 40');
eq('normalizeDay returns an unknown month untouched',
   L.normalizeDay('Foo 11', null, NOW), 'Foo 11');
eq('normalizeDay of nothing is empty', L.normalizeDay(null, null, NOW), '');
eq('normalizeDay ignores a nonsense ts and falls back to the label',
   L.normalizeDay('Jan 5', NaN, NOW), '2026-01-05');
eq('normalizeDay ignores a zero ts (the epoch is not a training day)',
   L.normalizeDay('Jan 5', 0, NOW), '2026-01-05');

// ---- normalizeSessions: the store-level upgrade -------------------------
{
  const out = L.normalizeSessions([
    { d: 'Sep 11', sets: { 1: { w: '100' } } },
    { d: 'Sep 10', sets: { 1: { w: '95' } } }
  ], NOW);
  ok('normalizeSessions dates every entry',
     out.every(s => /^\d{4}-\d{2}-\d{2}$/.test(s.d)), JSON.stringify(out.map(s => s.d)));
  eq('normalizeSessions keeps newest first', out[0].d, '2026-09-11');
  eq('normalizeSessions keeps the set data', out[0].sets[1].w, '100');
}
{
  // The collision the upgrade creates and must then resolve: the same
  // training day held once as a legacy label and once as a dated key.
  const out = L.normalizeSessions([
    { d: '2026-09-11', ts: NOW.getTime(), sets: { 1: { w: '100' } } },
    { d: 'Sep 11', sets: { 2: { w: '110' } } }
  ], NOW);
  eq('normalizeSessions collapses a duplicated day to one session', out.length, 1);
  ok('normalizeSessions unions the sets rather than dropping half of them',
     out[0].sets[1] && out[0].sets[2], JSON.stringify(out[0].sets));
  eq('normalizeSessions keeps the newest-first entry\'s value on a conflict',
     out[0].sets[1].w, '100');
}
{
  // Out-of-order input is sortable for the first time, because the key is
  // finally a date. This is the half EN-10 could not fix.
  const out = L.normalizeSessions([
    { d: 'Jan 5', sets: {} }, { d: 'Sep 10', sets: {} }, { d: 'Mar 2', sets: {} }
  ], NOW);
  ok('normalizeSessions sorts an out-of-order list newest first',
     out[0].d === '2026-09-10' && out[2].d === '2026-01-05',
     JSON.stringify(out.map(s => s.d)));
}
{
  // ...but a list still holding an unreadable label keeps encounter order
  // rather than sorting that entry to an arbitrary end.
  const out = L.normalizeSessions([
    { d: 'Mon 1/5', sets: {} }, { d: 'Sep 10', sets: {} }
  ], NOW);
  eq('normalizeSessions leaves a list with an unreadable entry in encounter order',
     out[0].d, 'Mon 1/5');
}
{
  // Totality, the same standard FIX-04 holds the rest of this module to.
  ok('normalizeSessions of a non-array is an empty array',
     Array.isArray(L.normalizeSessions({ d: 'Sep 11' })) &&
     L.normalizeSessions({ d: 'Sep 11' }).length === 0, '');
  ok('normalizeSessions of null is an empty array',
     Array.isArray(L.normalizeSessions(null)) && L.normalizeSessions(null).length === 0, '');
  const dropped = L.normalizeSessions([null, 'nope', 7, { d: 'Sep 11', sets: {} }], NOW);
  eq('normalizeSessions drops null and primitive members', dropped.length, 1);
  ok('normalizeSessions survives a session with no sets object',
     L.normalizeSessions([{ d: 'Sep 11' }, { d: 'Sep 11' }], NOW).length === 1, '');
}

if (fail) {
  console.error(`\ntest-mc-day-key: ${pass} passed, ${fail} FAILED`);
  process.exit(1);
}
console.log(`test-mc-day-key: all ${pass} assertions passed`);
