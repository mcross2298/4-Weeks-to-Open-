#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-cluster-reps.js — a cluster set's logged reps (engine-repair
   roadmap Phase 2.3; audit P2-08).

   mc-setlog.js's clusterRVal() stores one value per mini-set joined with '+':
   a cluster of 5, then 5, then 6 is the string "5+5+6". Every consumer then
   ran parseInt over it, which stops at the first '+' and reads 5.

   In the progression classifier that is not merely inaccurate, it is
   terminal: the set is compared against its rep target, comes up short every
   time, and the exercise is judged a failed session forever — so a cluster
   lift can never progress. 48 distinct cluster prescriptions are authored in
   this tree.

   TWO answers, not one, and the distinction is the point:
     repsTotal  every rep performed. The VOLUME answer — tonnage, weekly
                sets x reps, session strain — and what the progression
                comparison wants.
     repsTop    the largest single mini-set. The STRENGTH answer: a cluster is
                rested mid-set, so an Epley estimate off "16 reps" would claim
                a one-rep max the athlete never lifted.

   Runs against the real mc-log-read.js.
   Run: node tools/test-mc-cluster-reps.js
   ========================================================================== */
const path = require('path');
const L = require(path.resolve(__dirname, '../mc-log-read.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}

// the audit's own example
ok('P2-08 "5+5+6" totals 16, not 5', L.repsTotal('5+5+6') === 16, 'got ' + L.repsTotal('5+5+6'));
ok('P2-08 "5+5+6" tops out at 6', L.repsTop('5+5+6') === 6, 'got ' + L.repsTop('5+5+6'));

// a plain set is unchanged by both readers — this is what makes the swap safe
// at the ~7 call sites that used to parseInt
[['12', 12], ['0', 0], ['1', 1], ['100', 100]].forEach(function (c) {
  ok('plain "' + c[0] + '" totals ' + c[1], L.repsTotal(c[0]) === c[1]);
  ok('plain "' + c[0] + '" tops ' + c[1], L.repsTop(c[0]) === c[1]);
});

// real cluster shapes from the authored prescriptions in this tree
[['6+6+6', 18, 6], ['8+6+4', 18, 8], ['10+10+10', 30, 10], ['2+2+2+2+2+2', 12, 2]].forEach(function (c) {
  ok('"' + c[0] + '" totals ' + c[1], L.repsTotal(c[0]) === c[1], 'got ' + L.repsTotal(c[0]));
  ok('"' + c[0] + '" tops ' + c[2], L.repsTop(c[0]) === c[2], 'got ' + L.repsTop(c[0]));
});

// total, so a corrupt or empty value cannot propagate NaN into tonnage
[null, undefined, '', '   ', 'abc', '+', '++', {}, []].forEach(function (v) {
  ok('repsTotal(' + JSON.stringify(v) + ') is 0, never NaN',
     L.repsTotal(v) === 0, 'got ' + L.repsTotal(v));
  ok('repsTop(' + JSON.stringify(v) + ') is 0, never NaN',
     L.repsTop(v) === 0, 'got ' + L.repsTop(v));
  ok('repsLogged(' + JSON.stringify(v) + ') is false', L.repsLogged(v) === false);
});

// "logged nothing" must stay distinguishable from "logged zero", because the
// progression classifier treats an unlogged set as non-blocking and a logged
// zero as a real miss.
ok('repsLogged("0") is true', L.repsLogged('0') === true);
ok('repsLogged("") is false', L.repsLogged('') === false);
ok('repsLogged("5+5+6") is true', L.repsLogged('5+5+6') === true);

// partial garbage keeps the numbers it does have rather than collapsing
ok('"5++6" totals 11', L.repsTotal('5++6') === 11, 'got ' + L.repsTotal('5++6'));

console.log('test-mc-cluster-reps: ' + pass + ' passed, ' + fail + ' failed');
if (fail) {
  console.error('\nFix: mc-log-read.js\'s repsTotal/repsTop/repsLogged no longer match the P2-08 contract.');
  process.exit(1);
}
