#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-setlog-plan.js — regression coverage for mc-setlog.js's prescription
   parser: how many logging rows a `sets:` string renders, and what rep target
   each row carries (workout-ui-state-audit W0/W1).

   Runs against the ACTUAL source via mc-setlog.js's Node export hook — the
   same convention as test-mc-sync-merge.js — so these assertions exercise
   shipped code, not a transcribed copy.

   THE CONTRACT UNDER TEST
   -----------------------
   Row count and rep target come from ONE resolution of the prescription, so
   `setCount(s)` rows always carry `repFor(s, 0..n-1)` targets drawn from that
   same string. They used to be two independent parsers over the same input
   and they disagreed: "25/20/20/15/12" built EIGHT rows, every one of them
   asking for 25 reps, for a five-step descending pyramid.

   '/' is overloaded four ways in the authored data, and the ORDER of the
   parser's branches is what keeps the two that were always correct correct.
   Every one of those four meanings is pinned below, with the two that were
   broken marked, so a future rewrite cannot quietly restore either bug:

     N x multiplier   "4x10 / 12 per side"       4 rows   (was already right)
     cluster inner    "4x6, + Cluster 6/6/6"     4 rows   (was already right)
     leg separator    "12, 12, 10 / 10, 10, 8"   3 rows   (was 5 — FIXED)
     set separator    "25/20/20/15/12"           5 rows   (was 8 — FIXED)

   Two more families are pinned for the same reason: the per-ROUND form
   ("12/12, 10/10, 8/8" — 4 slash segments but 3 rounds) is why the leg rule
   is bounded at 3 segments and cannot simply count slashes, and a leading
   number is a set count only when the prose says "sets" — "100-200 reps" is a
   rep prescription that named no set count and used to render 8 rows.

   Run: node tools/test-mc-setlog-plan.js
   ========================================================================== */
const path = require('path');
const SL = require(path.resolve(__dirname, '../mc-setlog.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}
function eq(name, got, want) {
  const good = JSON.stringify(got) === JSON.stringify(want);
  ok(name, good, good ? '' : `got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`);
}

// The row targets a prescription actually renders, read the way build() does.
function targets(scheme) {
  const n = SL.setCount(scheme);
  const out = [];
  for (let i = 0; i < n; i++) out.push(SL.repFor(scheme, i));
  return out;
}
// planFor()'s split: working sets, then appended drop rows. Mirrored through
// the logger's own parseDrop/stripDrop so the two cannot drift.
function totalRows(scheme) {
  const drop = SL.parseDrop('', scheme);
  const work = drop.is ? SL.stripDrop(scheme) : scheme;
  return SL.setCount(work) + (drop.is ? drop.drops.length : 0);
}

// ── 1. the N x multiplier settles the count before '/' is ever looked at ─────
// These two families were always correct. They are pinned FIRST because the
// fix for the other two must not reach them: the multiplier branch has to
// keep running ahead of every slash rule.
{
  eq('1a plain multiplier',            SL.setCount('4×12'), 4);
  eq('1b … targets its own reps',      targets('4×12'), ['12', '12', '12', '12']);
  eq('1c per-side reps after a slash', SL.setCount('4×10 / 12 per side'), 4);
  eq('1d … target is the rep, not the side count', targets('4×10 / 12 per side'),
     ['10', '10', '10', '10']);
  eq('1e spaced multiplier',           SL.setCount('3 × 10 fwd / 10 back'), 3);
  eq('1f "each" suffix',               SL.setCount('5x12 each'), 5);
  eq('1g failure reps',                SL.setCount('3xfailure'), 3);
  eq('1h ascii x, two legs',           SL.setCount('4×10 / 4×4'), 4);

  // A cluster puts its mini-sets INSIDE one row, so it never adds rows. The
  // rep target must be the working rep (6), not the digits of "4×6" run
  // together — which is what a comma-split-first parser produced.
  eq('1i cluster row count',   SL.setCount('4×6, + Cluster 6/6/6'), 4);
  eq('1j cluster rep target',  targets('4×6, + Cluster 6/6/6'), ['6', '6', '6', '6']);
  eq('1k tempo is not a rep',  targets('4×8 @ 4-0-1, + Cluster 10/10/10'),
     ['8', '8', '8', '8']);
}

// ── 2. '/' as SET separator — the reported pyramid bug ──────────────────────
{
  eq('2a five-step pyramid',   SL.setCount('25/20/20/15/12'), 5);
  eq('2b … descends',          targets('25/20/20/15/12'), ['25', '20', '20', '15', '12']);
  eq('2c four steps',          SL.setCount('20/20/15/15'), 4);
  eq('2d six steps',           SL.setCount('25/25/20/20/15/15'), 6);
  eq('2e six, mixed',          SL.setCount('15/15/15/12/12/12'), 6);
  eq('2f ascending',           targets('12/12/15/20/25'), ['12', '12', '15', '20', '25']);
  eq('2g three steps',         SL.setCount('8/10/12'), 3);
  eq('2h reverse pyramid',     targets('15/15/20/20/25'), ['15', '15', '20', '20', '25']);
}

// ── 3. '/' as LEG separator — one card, two stations, shared rounds ─────────
{
  eq('3a two legs of three',   SL.setCount('12, 12, 10 / 10, 10, 8'), 3);
  eq('3b … targets one leg, never digits spanning both',
     targets('12, 12, 10 / 10, 10, 8'), ['12', '12', '10']);
  eq('3c three legs of three', SL.setCount('8,8,8 / 10,10,10 / 12,12,12'), 3);
  eq('3d three legs of two',   SL.setCount('12,12 / 10,10 / 8,8'), 2);
  eq('3e two legs of four',    SL.setCount('12, 10, 8, 6 / 10, 8, 6, 4'), 4);
  eq('3f AMRAP leg',           SL.setCount('AMRAP / 3, 3, 3'), 3);
  eq('3g multiplier inside a leg', SL.setCount('8, 8 / 2× AMRAP'), 2);
  eq('3h a leg that is one token', SL.setCount('15, 12, 10 / 12, 12, 10 / AMRAP'), 3);

  // Irregular authoring: a 4-set leg paired with a 3-set leg. Take the LONGER
  // leg — dropping a prescribed set is worse than showing one spare row.
  eq('3i mismatched leg lengths take the longer',
     SL.setCount('10, 8, 20, 15 / 20, 20, 15'), 4);
}

// ── 4. per-ROUND slashes — why the leg rule is bounded at 3 segments ────────
// Here the COMMA is the outer separator and each slash pairs the two legs'
// reps within one round. Counting slash segments would give 4/5/6 rounds for
// prescriptions of 3/4/5. This is the case that stops the leg rule from
// simply counting slashes, so it is pinned explicitly.
{
  eq('4a three rounds, both legs per round', SL.setCount('12/12, 10/10, 8/8'), 3);
  eq('4b four rounds',  SL.setCount('12/12, 10/10, 8/8, 8/8'), 4);
  eq('4c five rounds',  SL.setCount('12/12, 10/10, 8/8, 10/10, 12/12'), 5);
}

// ── 5. round-labelled circuits — each segment is a whole round ──────────────
{
  const g = 'G1: 10 FS, 12 OCE, 10 FS, AMRAP OCE / G2: 10 FS, 12 OCE, AMRAP OCE'
          + ' / G3: 12 OCE, AMRAP OCE';
  eq('5a three labelled rounds, not seven exercises', SL.setCount(g), 3);
}

// ── 6. a leading number is a set count only when the prose says "sets" ──────
{
  eq('6a plain declaration',      SL.setCount('4 sets'), 4);
  eq('6b five',                   SL.setCount('5 sets'), 5);
  eq('6c with a qualifier',       SL.setCount('3 sets to failure'), 3);
  eq('6d a range declares its floor', SL.setCount('4–5 sets'), 4);
  eq('6e open-ended',             SL.setCount('1+ sets'), 1);

  // These name a REP target and no set count at all. Reading the rep number
  // as a set count clamped it to 8 — a hundred-rep finisher rendered eight
  // logging rows.
  eq('6f rep range is not a set count', SL.setCount('100–200 reps'), 3);
  eq('6g … ascii hyphen too',           SL.setCount('100-200 reps'), 3);
  eq('6h single rep target',            SL.setCount('200 reps'), 3);
  eq('6i prose after the reps',         SL.setCount('100 reps as quick as possible'), 3);
  eq('6j a duration is not a set count', SL.setCount('30 sec each side'), 3);
  eq('6k … and neither is "21s"',        SL.setCount('21s'), 3);
  eq('6l the rep target survives',       targets('100–200 reps'), ['100', '100', '100']);
}

// ── 7. no information at all falls back to three rows ───────────────────────
{
  eq('7a bare AMRAP',  SL.setCount('AMRAP'), 3);
  eq('7b empty',       SL.setCount(''), 3);
  eq('7c null',        SL.setCount(null), 3);
  eq('7d undefined',   SL.setCount(undefined), 3);
}

// ── 8. plain comma lists — the majority of the tree, unchanged ──────────────
{
  eq('8a four sets',   SL.setCount('12,10,8,8'), 4);
  eq('8b … targets',   targets('12,10,8,8'), ['12', '10', '8', '8']);
  eq('8c spaced',      SL.setCount('15, 12, 10'), 3);
  eq('8d … targets',   targets('15, 12, 10'), ['15', '12', '10']);
}

// ── 9. drop rows are APPENDED, never folded into the working count ──────────
// planFor()'s split, which mc-finish.js sizes the whole workout from.
{
  eq('9a drop adds one row',        totalRows('4×8, Drop AMRAP'), 5);
  eq('9b numeric drop',             totalRows('12,10,8,8 drop 15'), 5);
  eq('9c arrow drops add two',      totalRows('12, 10, 8, 8 → AMRAP, AMRAP'), 6);
  eq('9d cluster-round notation',   totalRows('15, 12, 12 → 3×10'), 6);
  eq('9e working sets parse clean under a drop',
     targets(SL.stripDrop('12,10,8,8 drop 15')), ['12', '10', '8', '8']);
}

// ── 10. every row target is drawn from its own prescription ────────────────
// The invariant tools/check-set-schemes.js enforces fleet-wide, pinned here
// on the shapes that used to violate it by concatenating digits across a
// comma part or across two legs.
{
  const provenance = [
    '4×6, + Cluster 6/6/6', '12, 12, 10 / 10, 10, 8', '10, 12, 15 / 12, 10, 8',
    '8, 8 / 2× AMRAP', '8,8,8 / 10,10,10 / 12,12,12', '25/20/20/15/12',
    '12, 10, 8, 6, + Cluster 8/10/12', '4×15, + Cluster 15/15/20'
  ];
  provenance.forEach(s => {
    const tokens = new Set((s.match(/\d+/g) || []));
    const bad = targets(s).filter(t => t !== '' && !tokens.has(String(t)));
    ok('10 · every target appears in ' + JSON.stringify(s),
       bad.length === 0, bad.length ? 'invented ' + JSON.stringify(bad) : '');
  });
}

console.log(`test-mc-setlog-plan: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
