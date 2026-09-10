#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-pmc-confusion.js — the Project Muscle Confusion week-3/4 rotation
   (engine-repair roadmap Phase 2.5; audit PG-1, PG-3, PG-4).

   Runs against the REAL pmc-data.js in a vm sandbox with a stub `window` —
   the same technique as test-mc-bridge.js and test-mc-program-progress.js —
   so these assertions exercise shipped code rather than a transcribed copy.

   WHAT THIS PINS, and why each one is here
   ----------------------------------------
   Every assertion below corresponds to a defect measured on `main` over the
   real 30-workout dataset, not to a hypothetical:

     PG-1  ROTATE AS A SET. swapBadges() returned a ONE-element array for
           whichever badge matched first. ['tb-pyramid','tb-drop'] — 51
           exercises, the most common pairing in this data — became
           ['tb-highrep20'], so the drop set disappeared from weeks 3 and 4
           entirely. 58 badge sets were truncated. The rotation must now be a
           permutation: same length in, same length out, nothing invented.

     PG-1b CLOSED CYCLE. tb-highrep20 used to rotate to tb-lowrep, which left
           tb-highrep12 with NO predecessor — once an exercise rotated off
           "12-15 reps" nothing could ever rotate back onto it, so the
           intensifier drained out of the program. Every base must have
           exactly one predecessor and one successor.

     PG-3  SUPERSETS SURVIVE. autoConfusion() split each superset into two
           standalone cards numbered 1a/1b — 77 of them — silently changing
           the day's station anchoring.

     PG-4  TEMPO IS NOTATION. A tb-tempo rotation emitted "4x8": a rep scheme
           with nothing tempo about it, 53 times.

     PARSER AGREEMENT. Every string this engine generates is fed to
           mc-setlog.js's OWN setCount/repFor/parseDrop — the parser that
           actually builds the logging rows — so a rotation can never emit a
           prescription the logger reads differently than intended. This is
           the check that would have caught "AMRAP @ 4-0-1", where the tempo
           digits become the rep target.

   Run: node tools/test-mc-pmc-confusion.js
   ========================================================================== */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SL = require(path.resolve(ROOT, 'mc-setlog.js'));

const win = {};
vm.runInContext(
  fs.readFileSync(path.resolve(ROOT, 'pmc-data.js'), 'utf8'),
  vm.createContext({ window: win, console }),
  { filename: 'pmc-data.js' }
);
const D = win.MC_PMC_DATA;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}

// ---------------------------------------------------------------- module ---
ok('pmc-data.js publishes MC_PMC_DATA', !!D);
ok('30 workouts are declared', Object.keys(D.splits).length === 30,
   'got ' + Object.keys(D.splits).length);

// ------------------------------------------------------------- the cycle ---
const BASES = ['tb-lowrep', 'tb-tempo', 'tb-amrap', 'tb-pyramid', 'tb-highrep20', 'tb-highrep12'];
const succ = {}, pred = {};
BASES.forEach(function (b) {
  const out = D.rotateBadges([b]);
  ok('rotating [' + b + '] yields exactly one badge', out.length === 1, JSON.stringify(out));
  succ[b] = out[0];
  pred[out[0]] = (pred[out[0]] || 0) + 1;
});
BASES.forEach(function (b) {
  ok(b + ' rotates to another base', BASES.indexOf(succ[b]) >= 0, '-> ' + succ[b]);
  ok(b + ' has exactly one predecessor (PG-1b: no drained intensifier)',
     pred[b] === 1, 'predecessors=' + (pred[b] || 0));
  ok(b + ' does not rotate to itself', succ[b] !== b);
});
// walking the cycle from any start must visit all six and return
let cur = 'tb-lowrep', seen = [];
for (let i = 0; i < BASES.length; i++) { seen.push(cur); cur = succ[cur]; }
ok('the base cycle is a single 6-cycle', cur === 'tb-lowrep' && new Set(seen).size === 6,
   seen.join(' -> ') + ' -> ' + cur);

// --------------------------------------------------- PG-1: rotate as a set --
ok('PG-1 pyramid+drop keeps BOTH intensifiers',
   JSON.stringify(D.rotateBadges(['tb-pyramid', 'tb-drop'])) === JSON.stringify(['tb-highrep20', 'tb-drop']),
   JSON.stringify(D.rotateBadges(['tb-pyramid', 'tb-drop'])));
ok('PG-1 the drop survives into the set string',
   /\bdrop\b/i.test(D.rotateSets('12,10,8,8 drop 15', ['tb-pyramid', 'tb-drop'])),
   D.rotateSets('12,10,8,8 drop 15', ['tb-pyramid', 'tb-drop']));
ok('non-structural badges ride through untouched',
   JSON.stringify(D.rotateBadges(['tb-superset', 'tb-highrep12', 'tb-minrest']))
     === JSON.stringify(['tb-superset', 'tb-lowrep', 'tb-minrest']),
   JSON.stringify(D.rotateBadges(['tb-superset', 'tb-highrep12', 'tb-minrest'])));
ok('a card with no structural badge is not re-badged',
   JSON.stringify(D.rotateBadges(['tb-optional'])) === JSON.stringify(['tb-optional']));
ok('a card with no structural badge keeps its authored prescription',
   D.rotateSets('100–200 reps', ['tb-optional']) === '100–200 reps',
   D.rotateSets('100–200 reps', ['tb-optional']));

// ------------------------------------------------------ PG-4: real tempo ---
ok('PG-4 a tempo rotation emits tempo notation',
   /@\s*\d+-\d+-\d+/.test(D.rotateSets('5×5', ['tb-lowrep'])),
   D.rotateSets('5×5', ['tb-lowrep']));
ok('PG-4 tempo alongside another base decorates it rather than replacing it',
   /@\s*\d+-\d+-\d+/.test(D.rotateSets('12,10,8,8', ['tb-amrap', 'tb-lowrep'])),
   D.rotateSets('12,10,8,8', ['tb-amrap', 'tb-lowrep']));

// -------------------------------------------- set count is not invented ----
ok('a 4-set prescription rotates to a 4-set prescription',
   SL.setCount(SL.stripDrop(D.rotateSets('12,10,8,8 drop 15', ['tb-pyramid', 'tb-drop']))) === 4,
   D.rotateSets('12,10,8,8 drop 15', ['tb-pyramid', 'tb-drop']));
ok('a 5-set prescription rotates to a 5-set prescription',
   SL.setCount(D.rotateSets('5×5', ['tb-lowrep'])) === 5,
   D.rotateSets('5×5', ['tb-lowrep']));

// ------------------------- sweep the WHOLE dataset through the real parser --
const STRUCT = BASES.concat(['tb-drop']);
let cards = 0, supersets = 0, brokenSS = 0, truncated = 0, tempoNoNotation = 0,
    unreadable = 0, countDrift = 0, invented = 0;
const firstBad = [];

Object.keys(D.splits).forEach(function (id) {
  const wo = D.splits[id];
  if (wo.type === 'blocks') return;
  D.weeks.forEach(function (wk) {
    const src = D.sourceWeekFor(wk.n);
    if (!src) return;                       // weeks 1-2 are authored, not rotated
    if (D.confusionSwaps[id] && D.confusionSwaps[id][wk.n]) return;   // hand-authored
    const raw = wo.data && (wo.data[src] || wo.data[1]);
    const before = Array.isArray(raw) ? raw : (raw && raw.exercises) || [];
    const after = D.autoConfusion(before, src);

    ok(id + ' w' + wk.n + ': rotation preserves the card count',
       after.length === before.length, before.length + ' -> ' + after.length);

    before.forEach(function (b, i) {
      const a = after[i];
      if (!a) return;
      if (b.type === 'superset') {
        supersets++;
        if (a.type !== 'superset' || !a.a || !a.b) brokenSS++;
      }
      const pairs = b.type === 'superset' ? [[b.a, a.a], [b.b, a.b]] : [[b, a]];
      pairs.forEach(function (p) {
        const s = p[0] || {}, r = p[1] || {};
        cards++;
        const sb = (s.badges || []), rb = (r.badges || []);
        if (sb.length !== rb.length) {
          truncated++;
          if (firstBad.length < 5) firstBad.push('badge length ' + s.name + ' ' + JSON.stringify(sb) + ' -> ' + JSON.stringify(rb));
        }
        if (s.name !== r.name && firstBad.length < 5) firstBad.push('name changed: ' + s.name + ' -> ' + r.name);
        if (rb.indexOf('tb-tempo') >= 0 && !/@\s*\d+-\d+-\d+/.test(String(r.sets))) {
          tempoNoNotation++;
          if (firstBad.length < 5) firstBad.push('tempo badge, no notation: ' + s.name + ' "' + r.sets + '"');
        }
        // the rotated string must be readable by the logger that builds the rows
        const work = SL.stripDrop(String(r.sets));
        const n = SL.setCount(work);
        if (!(n >= 1 && n <= 12)) {
          unreadable++;
          if (firstBad.length < 5) firstBad.push('unreadable row count ' + n + ': "' + r.sets + '"');
        }
        // and the rep targets it hands each row must appear in that string
        for (let k = 0; k < n; k++) {
          const t = String(SL.repFor(work, k) || '');
          if (t && work.indexOf(t) < 0) {
            invented++;
            if (firstBad.length < 5) firstBad.push('rep target "' + t + '" not in "' + work + '"');
          }
        }
        // a rotation must not change how many working sets are prescribed
        if (sb.some(function (x) { return STRUCT.indexOf(x) >= 0; })) {
          const sn = SL.setCount(SL.stripDrop(String(s.sets)));
          if (sn !== n) {
            countDrift++;
            if (firstBad.length < 5) firstBad.push('set count ' + sn + ' -> ' + n + ' on "' + s.sets + '" -> "' + r.sets + '"');
          }
        }
      });
    });
  });
});

ok('PG-3 every superset stays a superset', brokenSS === 0, brokenSS + ' of ' + supersets + ' broken apart');
ok('PG-1 no badge set is truncated', truncated === 0, truncated + ' truncated');
ok('PG-4 no tb-tempo badge without tempo notation', tempoNoNotation === 0, tempoNoNotation + ' bare');
ok('every rotated prescription is readable by mc-setlog.js', unreadable === 0, unreadable + ' unreadable');
ok('no rep target is invented out of the prescription', invented === 0, invented + ' invented');
ok('no rotation changes the prescribed working-set count', countDrift === 0, countDrift + ' drifted');
ok('the sweep actually covered the dataset', cards > 300 && supersets > 50,
   cards + ' cards, ' + supersets + ' supersets');

if (firstBad.length) firstBad.forEach(function (m) { console.error('   ' + m); });

console.log('test-mc-pmc-confusion: ' + pass + ' passed, ' + fail + ' failed  (' +
            cards + ' rotated cards, ' + supersets + ' supersets swept)');
if (fail) {
  console.error('\nFix: pmc-data.js\'s week-3/4 rotation no longer matches the PG-1/PG-3/PG-4 contract.');
  process.exit(1);
}
