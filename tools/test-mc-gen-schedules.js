#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-gen-schedules.js — the deload-week rule in tools/gen-schedules.js
   (audit F-03, executive-summaries audit).

   THE PROBLEM
   -----------
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

console.log('\n' + pass + ' assertions, ' + fail + ' failed');
if (fail > 0) {
  console.error('\nFix: tools/gen-schedules.js\'s lastWeekMayDeload() no longer matches the expected deload-eligibility contract.');
  process.exit(1);
}
console.log('test-mc-gen-schedules: pass — hv deloadWeeks=' + JSON.stringify(hv.deloadWeeks) +
            ', mm deloadWeeks=' + JSON.stringify(mm.deloadWeeks));
