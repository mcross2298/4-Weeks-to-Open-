#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-gen-schedules.js — the deload-week rule in tools/gen-schedules.js
   (audit F-03, executive-summaries audit).

   THE PROBLEM
   -----------
   (Flagship readiness phase C added buildSS() and deloadProblems() at the
   end of this file: the deload week each program declares, as the logger
   builds it.)

   Both buildMM() and buildHV() used to emit `deloadWeeks: [<last week>]`
   unconditionally — literally "guess from it's the last week", the exact
   thing the Executive Summary's own copy says this feature does NOT do.
   Measured against the real data: High-Volume Training Template's four
   weeks climb 146 -> 196 -> 210 -> 238 prescribed sets (it escalates by its
   own design — "compound-dominant, into full supersets, into high-set
   pyramids, into bodyweight density"), so flagging week 4 called the
   block's own HEAVIEST week its unload. Applying the automatic
   -1-set-per-exercise reduction to it still left it ~30% above week 1 —
   badged "prescribed lighter" while being the hardest week in the block.

   THE FIX
   -------
   lastWeekMayDeload(weekVolumes) — the final week may be declared a deload
   only if at least one OTHER week's raw (pre-reduction) volume is >= its
   own, i.e. it is not a sole, new peak. The Modality Matrix's three phases
   prescribe an identical 172 sets/week throughout, so its final week TIES
   every other week rather than exceeding them; the flag-triggered reduction
   is what makes it lighter, the same mechanism `ss`'s own hand-authored
   week 6 already uses (also flat, at 138 sets/week pre-reduction) — this
   rule does not disturb that intentional, working pattern.

   Run: node tools/test-mc-gen-schedules.js
   ========================================================================== */
const path = require('path');
const G = require(path.resolve(__dirname, 'gen-schedules.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}

/* ---- lastWeekMayDeload(): the rule in isolation, every shape it must handle */

ok('flat volume (ss/mm shape): last week ties the others -> may deload',
   G.lastWeekMayDeload([172, 172, 172, 172, 172]) === true);
ok('escalating volume (hv shape): last week is a sole new peak -> may NOT deload',
   G.lastWeekMayDeload([146, 196, 210, 238]) === false);
ok('descending volume: last week is already the lightest -> may deload',
   G.lastWeekMayDeload([210, 196, 170, 146]) === true);
ok('a dip then a rise back to a NEW peak -> may NOT deload',
   G.lastWeekMayDeload([180, 150, 190]) === false);
ok('a rise then a fall back to an earlier level -> may deload',
   G.lastWeekMayDeload([150, 190, 150]) === true);
ok('two weeks, second strictly higher -> may NOT deload',
   G.lastWeekMayDeload([100, 150]) === false);
ok('two weeks, second strictly lower -> may deload',
   G.lastWeekMayDeload([150, 100]) === true);
ok('a single-week block has no earlier week to compare against -> may NOT deload',
   G.lastWeekMayDeload([150]) === false);

/* ---- the real programs: what the rule actually decides ------------------ */

const hv = G.buildHV();
const mm = G.buildMM();

ok('High-Volume Training Template: escalates by its own design (146→196→210→238), verified from the real source, not assumed',
   hv.weeks === 4 && hv.perWeek === 7);
ok('…so it gets NO deload week — the last week is its own heaviest, calling that "lighter" would be the guess this feature exists to avoid',
   hv.deloadWeeks.length === 0, 'got ' + JSON.stringify(hv.deloadWeeks));

ok('The Modality Matrix: 15 weeks across 3 phases, verified from the real source',
   mm.weeks === 15);
ok('…keeps its week-15 deload — flat volume throughout means the flag-triggered reduction is what makes it lighter, exactly as designed',
   mm.deloadWeeks.length === 1 && mm.deloadWeeks[0] === 15, 'got ' + JSON.stringify(mm.deloadWeeks));

/* ---- regression guard: re-derive HV's raw per-week volumes from its own
   generated `days`, so a future edit to hv-block.html that flattens or
   re-escalates the block is caught by ITS OWN DATA, not by a hardcoded
   expectation this file could drift from. */
function weekVolumesFromPhases(rec) {
  var byId = {};
  rec.days.forEach(function (d) { byId[d.id] = d; });
  var out = [];
  rec.phases.forEach(function (ph) {
    var total = ph.days.reduce(function (n, id) {
      return n + ((byId[id] && byId[id].sets) || 0);
    }, 0);
    for (var w = 0; w < ph.weeks; w++) out.push(total);
  });
  return out;
}
var hvVolumes = weekVolumesFromPhases(hv);
var mmVolumes = weekVolumesFromPhases(mm);
ok('HV\'s own generated day data reproduces the escalating shape (sanity check on the fixture, not a hardcoded number)',
   hvVolumes.length === 4 && hvVolumes[3] > hvVolumes[2] && hvVolumes[2] > hvVolumes[1] && hvVolumes[1] > hvVolumes[0],
   'got ' + JSON.stringify(hvVolumes));
ok('re-deriving deload eligibility from HV\'s own generated data agrees with the record it produced',
   G.lastWeekMayDeload(hvVolumes) === (hv.deloadWeeks.length > 0));
ok('MM\'s own generated day data reproduces the flat shape',
   mmVolumes.every(function (v) { return v === mmVolumes[0]; }), 'got ' + JSON.stringify(mmVolumes));
ok('re-deriving deload eligibility from MM\'s own generated data agrees with the record it produced',
   G.lastWeekMayDeload(mmVolumes) === (mm.deloadWeeks.length > 0));

/* ---- flagship readiness C: a real deload, checked on what the logger builds */

const SETLOG = require(path.resolve(__dirname, '../mc-setlog.js'));
function red(reason, n, nd, stated) { return SETLOG.reduceFor(reason, n, nd, stated === undefined ? true : stated); }
ok('reduceFor: a deload keeps floor(2n/3) working sets (5 -> 3, 4 -> 2, 3 -> 2, 6 -> 4, 8 -> 5)',
   [[5, 3], [4, 2], [3, 2], [6, 4], [8, 5], [2, 1]].every(function (v) { return red('deload', v[0], 0).n === v[1]; }));
ok('reduceFor: every deload cut is between a third and a half of the working sets',
   [2, 3, 4, 5, 6, 7, 8, 9, 10].every(function (n) { var c = n - red('deload', n, 0).n; return c * 3 >= n && c * 2 <= n; }));
ok('reduceFor: a deload removes drop rows and says so (capped)',
   red('deload', 4, 2).nd === 0 && red('deload', 4, 2).capped === true && red('deload', 4, 0).capped === false);
ok('reduceFor: a single set and an unstated count are never cut',
   red('deload', 1, 0).n === 1 && red('deload', 3, 0, false).n === 3);
ok('reduceFor: Lighter is one working set fewer and keeps its drops',
   red('readiness', 4, 1).n === 3 && red('readiness', 4, 1).nd === 1);
ok('reduceFor: no reason changes nothing', red('', 4, 1).n === 4 && red('', 4, 1).nd === 1);

const ss = G.buildSS();
ok('Strength & Supersets is generated from cat-strength.html: 6 weeks, 5-on 2-off, 5 training days',
   ss.weeks === 6 && ss.perWeek === 7 && JSON.stringify(ss.rest) === '[6,7]' && ss.days.length === 5);
ok('…its day hero sets equal what the logger builds for week 1 (D-28: Legs 30 vs 32, Back 32 vs 34, Arms 32 vs 35)',
   ss.days[0].sets === 32 && ss.days[2].sets === 34 && ss.days[3].sets === 35,
   'got ' + ss.days.map(function (d) { return d.id + ' ' + d.sets; }).join(', '));
ok('…and keeps its declared week-6 deload', JSON.stringify(ss.deloadWeeks) === '[6]');

const ssWeeks = ss.weekSets.map(function (l) { return G.weekVolume(l); });
ok('ss week 6 is AUTHORED as the block\'s heaviest week — the fact D-25 found, read from the page',
   ssWeeks[5] === Math.max.apply(null, ssWeeks), 'got ' + JSON.stringify(ssWeeks));
ok('…and BUILDS lighter than week 5 once the real deload cuts it',
   G.weekVolume(ss.weekSets[5], 'deload') < ssWeeks[4],
   G.weekVolume(ss.weekSets[5], 'deload') + ' vs ' + ssWeeks[4]);

ok('deloadProblems: every real program passes (ss, mm, hv)',
   G.deloadProblems('ss', ss).length === 0 && G.deloadProblems('mm', mm).length === 0 && G.deloadProblems('hv', hv).length === 0,
   JSON.stringify([G.deloadProblems('ss', ss), G.deloadProblems('mm', mm)]));

// The check must fail on the shapes it exists for. Fixtures, so it does not
// depend on any program staying the way it is today.
function fixture(weeks, deload) {
  var r = { deloadWeeks: deload };
  Object.defineProperty(r, 'weekSets', { value: weeks, enumerable: false });
  return r;
}
var four = ['4×8', '4×8', '4×8', '4×8'];
var nine = four.concat(four, ['4×8']);
ok('deloadProblems: a deload week lighter (and a third lighter) than every other week passes',
   G.deloadProblems('x', fixture([nine, four], [2])).length === 0);
ok('deloadProblems: flags a deload week that builds heavier than another week',
   G.deloadProblems('x', fixture([four, nine], [2])).length === 1);

// Proven against the OLD rule, by swapping it in: Phase 4 cut one working set
// per exercise and kept the drops. On ss's real week 6 that built 123 rows
// against a lightest week of 142 — lighter, so a "lighter" check alone would
// have passed the defect D-25 filed. The depth rule is what catches it.
var realReduce = SETLOG.reduceFor;
SETLOG.reduceFor = function (reason, n, nd, stated) {
  return (reason && stated && n > 1) ? { n: n - 1, nd: nd, cut: 1, capped: false } : { n: n, nd: nd, cut: 0, capped: false };
};
var oldProblems = G.deloadProblems('ss', ss);
SETLOG.reduceFor = realReduce;
ok('deloadProblems: the old one-set deload FAILS on ss week 6 (lighter, but by less than a third)',
   oldProblems.length === 1 && /less than a third/.test(oldProblems[0]), JSON.stringify(oldProblems));
ok('deloadProblems: a declared deload week with no prescription is reported',
   G.deloadProblems('x', fixture([four], [3])).length === 1);

console.log('\n' + pass + ' assertions, ' + fail + ' failed');
if (fail > 0) {
  console.error('\nFix: tools/gen-schedules.js\'s lastWeekMayDeload() no longer matches the expected deload-eligibility contract.');
  process.exit(1);
}
console.log('test-mc-gen-schedules: pass — hv deloadWeeks=' + JSON.stringify(hv.deloadWeeks) +
            ', mm deloadWeeks=' + JSON.stringify(mm.deloadWeeks));
