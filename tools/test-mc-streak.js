#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-streak.js — the streak counts ADHERENCE, not calendar days
   (engine-repair roadmap Phase 4 step 1; audit EN-4)

   Run against the real mc-streak.js, in a vm sandbox, the same technique
   test-mc-bridge.js and test-mc-sync-merge.js use. The module is pure — the
   caller supplies the record, the rest predicate, the day map and `now` — so
   every branch is reachable without a browser.

   THE DEFECT THIS PINS

   Every program in the app rests at least one day a week. The old count
   walked consecutive CALENDAR days, so an athlete following any prescription
   exactly lost the streak on their first prescribed rest day, and the
   seven-day milestone could not be reached without disobeying the program.
   The first assertion below is exactly that case.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {}, module: { exports: {} }, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'mc-streak.js'), 'utf8'), ctx, { filename: 'mc-streak.js' });
const S = ctx.window.MC_STREAK;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra !== undefined ? '  — got ' + JSON.stringify(extra) : ''));
}
function eq(name, got, want) { ok(name, got === want, got); }

const DAY = 86400000;
const NOW = Date.parse('2026-09-10T12:00:00Z');

// ---- fixtures --------------------------------------------------------------

// 5-on 2-off: positions 6 and 7 rest, every week (the Weekly Layout Standard).
const rest57 = d => { const p = ((d - 1) % 7) + 1; return p === 6 || p === 7; };
// mm: one rest day at position 5.
const rest5  = d => (((d - 1) % 7) + 1) === 5;
// hv-shaped: the rest pattern differs per week — [3,6] in week 1, [6,7] in 2.
const restVary = d => {
  const wk = Math.floor((d - 1) / 7) + 1, p = ((d - 1) % 7) + 1;
  return wk === 1 ? (p === 3 || p === 6) : (p === 6 || p === 7);
};
function done(list, ts) {
  const o = {};
  list.forEach(d => { o[String(d)] = { ts: ts === undefined ? NOW : ts }; });
  return o;
}
const rec = (completed, weeks = 6, perWeek = 7) => ({ completed, weeks, perWeek });

// ---- schedule mode ---------------------------------------------------------

// THE headline case: two full 5-on 2-off weeks, trained exactly as prescribed.
// The old calendar count read 5 here — it broke on the first rest day.
eq('a prescribed rest day does not break the streak',
   S.compute({ rec: rec(done([1,2,3,4,5,8,9,10,11,12])), isRest: rest57, now: NOW }).n, 10);

eq('and that makes the seven-day milestone reachable at all',
   S.compute({ rec: rec(done([1,2,3,4,5,8,9])), isRest: rest57, now: NOW }).n >= 7, true);

eq('a missed training day ends it',
   S.compute({ rec: rec(done([1,2,3,5,8,9])), isRest: rest57, now: NOW }).n, 3);

eq('the streak is the run ending at the LAST completed day',
   S.compute({ rec: rec(done([1,2,3,4,5,8,9,10])), isRest: rest57, now: NOW }).n, 8);

eq('no completions at all is zero',
   S.compute({ rec: rec({}), isRest: rest57, now: NOW }).n, 0);

eq('one completed day is one',
   S.compute({ rec: rec(done([1])), isRest: rest57, now: NOW }).n, 1);

eq('schedule mode is reported as such',
   S.compute({ rec: rec(done([1])), isRest: rest57, now: NOW }).mode, 'schedule');

// A single mid-week rest day (mm) is skipped the same way.
eq('a one-day rest pattern is skipped too',
   S.compute({ rec: rec(done([1,2,3,4,6,7])), isRest: rest5, now: NOW }).n, 6);

// A rest pattern that varies by week answers from its own isRest, so nothing
// here needs to know which program it is looking at.
eq('a per-week rest pattern is honoured',
   S.compute({ rec: rec(done([1,2,4,5,7,8,9,10,11,12])), isRest: restVary, now: NOW }).n, 10);

// ---- staleness -------------------------------------------------------------

// Grace is derived: the longest run of consecutive rest days, plus one.
eq('longestRestRun reads the run off isRest — 5-on 2-off', S._longestRestRun(21, rest57), 2);
eq('longestRestRun — a single rest day',                   S._longestRestRun(21, rest5), 1);
eq('longestRestRun — a varying pattern',                   S._longestRestRun(14, restVary), 2);

eq('a streak inside the grace window survives',
   S.compute({ rec: rec(done([1,2,3,4,5], NOW - 2 * DAY)), isRest: rest57, now: NOW }).n, 5);

eq('a streak older than the grace window is dropped',
   S.compute({ rec: rec(done([1,2,3,4,5], NOW - 30 * DAY)), isRest: rest57, now: NOW }).n, 0);

eq('and says so',
   S.compute({ rec: rec(done([1,2,3,4,5], NOW - 30 * DAY)), isRest: rest57, now: NOW }).stale, true);

// A one-rest-day program has a tighter window than a two-rest-day one — the
// point of deriving it rather than picking a number.
eq('the grace window is tighter for a one-rest-day program',
   S.compute({ rec: rec(done([1,2,3,4], NOW - 2.5 * DAY)), isRest: rest5, now: NOW }).n, 0);
eq('and the same gap is forgiven for a two-rest-day one',
   S.compute({ rec: rec(done([1,2,3,4,5], NOW - 2.5 * DAY)), isRest: rest57, now: NOW }).n, 5);

// ---- history mode ----------------------------------------------------------

// No schedule: the athlete's own weekdays stand in for one. 2026-09-10 is a
// Thursday.
const MonWedFri = { mon: true, tue: false, wed: true, thu: false, fri: true, sat: false, sun: false };
function daysFor(list) { const o = {}; list.forEach(k => { o[k] = true; }); return o; }

eq('history mode is used when there is no schedule',
   S.compute({ days: daysFor(['2026-09-09']), pattern: MonWedFri, now: NOW }).mode, 'history');

// Thu is a rest weekday, so today is skipped; Wed 9th, Mon 7th, Fri 4th, Wed
// 2nd all trained → 4, then Mon 31 Aug is missing and ends it.
eq('a weekday the athlete rests is skipped',
   S.compute({ days: daysFor(['2026-09-09', '2026-09-07', '2026-09-04', '2026-09-02']),
               pattern: MonWedFri, now: NOW }).n, 4);

eq('a missed training weekday ends it',
   S.compute({ days: daysFor(['2026-09-09', '2026-09-04']), pattern: MonWedFri, now: NOW }).n, 1);

// An all-false pattern would loop forever over "rest" days; it must fall
// through to calendar mode instead.
eq('an empty pattern falls through to calendar mode',
   S.compute({ days: daysFor(['2026-09-10']),
               pattern: { mon:false,tue:false,wed:false,thu:false,fri:false,sat:false,sun:false },
               now: NOW }).mode, 'calendar');

// ---- calendar mode (the original behaviour, kept for a new athlete) ---------

eq('calendar mode counts consecutive days',
   S.compute({ days: daysFor(['2026-09-10', '2026-09-09', '2026-09-08']), now: NOW }).n, 3);

eq('an untrained today does not break the calendar count',
   S.compute({ days: daysFor(['2026-09-09', '2026-09-08']), now: NOW }).n, 2);

eq('no data at all is zero', S.compute({ now: NOW }).n, 0);
eq('and does not throw on no arguments at all', typeof S.compute().n, 'number');

// ---- precedence ------------------------------------------------------------

// A schedule outranks a history pattern; an empty completed map does not
// count as a schedule, so the pattern still gets its turn.
eq('a schedule outranks a history pattern',
   S.compute({ rec: rec(done([1,2])), isRest: rest57, pattern: MonWedFri,
               days: daysFor(['2026-09-09']), now: NOW }).mode, 'schedule');
eq('an empty progress record does not claim schedule mode',
   S.compute({ rec: rec({}), isRest: rest57, pattern: MonWedFri,
               days: daysFor(['2026-09-09']), now: NOW }).mode, 'history');
eq('a record with no isRest does not claim schedule mode',
   S.compute({ rec: rec(done([1,2])), pattern: MonWedFri,
               days: daysFor(['2026-09-09']), now: NOW }).mode, 'history');

// ---- helpers ---------------------------------------------------------------

// mc-bridge.js's likelyTrainingDays() answers with CAPITALISED codes ("Mon",
// "Tue", …) — that file is byte-identical with the cookbook's copy, so the
// casing is not ours to change. Assuming it cost a silent fall-through to
// calendar mode for every history-mode athlete, found only by driving the real
// dashboard. These pin the real shape, taken from mc-bridge.js's own DAYS.
const BRIDGE_SHAPE = { Mon: true, Tue: false, Wed: true, Thu: false, Fri: true, Sat: false, Sun: false };

eq('the real capitalised bridge shape reaches history mode',
   S.compute({ days: daysFor(['2026-09-09']), pattern: BRIDGE_SHAPE, now: NOW }).mode, 'history');

eq('and counts the same as the lower-cased shape',
   S.compute({ days: daysFor(['2026-09-09', '2026-09-07', '2026-09-04', '2026-09-02']),
               pattern: BRIDGE_SHAPE, now: NOW }).n, 4);

eq('normalizePattern lower-cases and drops non-weekday keys',
   JSON.stringify(S._normalizePattern({ Mon: 1, junk: 1, sun: 0 })), '{"mon":true,"sun":false}');

eq('normalizePattern on nothing is null', S._normalizePattern(null), null);

eq('dayKey is local-date, zero-padded', S._dayKey(new Date(2026, 0, 5)), '2026-01-05');
eq('codeOf maps Monday to mon', S._codeOf(new Date(2026, 8, 7)), 'mon');
eq('codeOf maps Sunday to sun', S._codeOf(new Date(2026, 8, 6)), 'sun');

console.log('test-mc-streak: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
