#!/usr/bin/env node
'use strict';
/* ==========================================================================
   gen-schedules.js — generate the `schedule` blocks in mc-pm-data.js from each
   program's OWN data (roadmap F5).

   WHY GENERATED. A schedule record restates a program's real prescription:
   how many weeks, which positions rest, and per training day its name, icon,
   exercise count and set count. Typed by hand it is a second copy of the
   authored truth, free to drift the moment a program gains a week or a lift.
   F0 hit exactly that when it froze the ss record's figures at week 1 rather
   than duplicate 30 per-week triples. Derived, the record cannot disagree with
   the page it describes -- the same reasoning behind build-sw.py,
   build-instructions.py and gen-program-css.py.

   SOURCES, each read as the program's own truth:
     mm  ->  mm-data.js         PROGRAMS.p1/p2/p3  (3 phases x 5 weeks = 15)
     hv  ->  hv-block.html      the WEEKS literal   (4 weeks)

   `ss` is NOT generated: its record predates this tool and its figures were
   authored by hand in F0. Regenerating it is a separate decision (its page's
   day data is shaped differently), so this tool leaves it alone rather than
   silently rewriting a hand-authored record.

   Run:  node tools/gen-schedules.js           # write
         node tools/gen-schedules.js --check   # CI: fail on drift
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');

function die(msg) { console.error('::error::gen-schedules: ' + msg); process.exit(1); }

// Sets prescribed by one exercise in ONE week. "5×5" -> 5, "8/6/4/4" -> 4,
// "4×AMRAP" -> 4. Deliberately the same leading-count reading mc-setlog.js's
// setCount() uses, so the record and the logger agree on what a day costs.
function setsOf(str) {
  if (!str) return 0;
  var s = String(str);
  var m = s.match(/^(\d+)\s*[x×]/i);
  if (m) return parseInt(m[1], 10);
  var slash = s.split('/');
  if (slash.length > 1) return slash.length;
  var n = s.match(/^(\d+)/);
  return n ? parseInt(n[1], 10) : 0;
}

// ---- mm: three phases, read from mm-data.js -------------------------------
function buildMM() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'mm-data.js'), 'utf8'), ctx);
  const D = ctx.window.MM_DATA;
  if (!D || !D.PROGRAMS) die('mm-data.js exposed no MM_DATA.PROGRAMS');

  const ids = Object.keys(D.PROGRAMS).sort();       // p1, p2, p3
  const weeksPerPhase = (D.WEEK_THEMES || []).length;
  if (!weeksPerPhase) die('mm-data.js exposed no WEEK_THEMES');

  let perWeek = null, rest = null;
  const phases = [], days = [];

  ids.forEach(function (pid) {
    const prog = D.PROGRAMS[pid];
    const list = prog.days || [];
    // Rest positions are DATA, never assumed -- the whole point of the day
    // model. Every phase must agree on them, or one flat `rest` is a lie.
    const thisRest = [];
    list.forEach(function (d, i) { if (d.type === 'rest') thisRest.push(i + 1); });
    if (perWeek == null) { perWeek = list.length; rest = thisRest; }
    if (list.length !== perWeek) die(pid + ' has ' + list.length + ' days, phase 1 has ' + perWeek);
    if (thisRest.join() !== rest.join()) {
      die(pid + ' rests at [' + thisRest + '] but phase 1 rests at [' + rest + '] — ' +
          'one flat rest pattern cannot describe both; the record shape needs per-phase rest first');
    }

    const order = [];
    list.forEach(function (d, i) {
      if (d.type === 'rest') return;
      const id = pid + '-' + (i + 1);
      order.push(id);
      const ex = d.exercises || [];
      days.push({
        id: id,
        title: d.session,
        icon: d.icon,
        tags: [prog.title || pid, 'Phase ' + prog.phase],
        ex: ex.length,
        // Week 1 figures, the convention F0 set for ss: a per-week set count
        // would need 15 triples per day and would drift from the authored
        // prescription rather than describe it.
        sets: ex.reduce(function (n, e) {
          return n + setsOf(e.w && e.w[0] && e.w[0].sets);
        }, 0),
        href: 'mm-' + pid + '.html?day=' + (i + 1)
      });
    });
    phases.push({ weeks: weeksPerPhase, days: order });
  });

  return {
    weeks: weeksPerPhase * ids.length,
    perWeek: perWeek,
    rest: rest,
    phases: phases,
    days: days
  };
}

// ---- hv: four weeks, each its own day set ---------------------------------
// NOT one repeating day set, and NOT one rest pattern. The first version of
// this tool assumed both and asserted them; real data failed each in turn --
// week 1 day 1 is "Chest" while week 2 day 1 is "Chest & Biceps" (exactly what
// the program's own splits say: "Week 1 · Compound Dominant", "Week 2 · Fully
// Supersetted", …), and week 1 rests at [3,6] while week 2 rests at [6,7].
// Each week is therefore its own phase of length 1 carrying its own rest,
// using the same authored-phase mechanism mm needs for its 5-week blocks.
function buildHV() {
  const src = fs.readFileSync(path.join(ROOT, 'hv-block.html'), 'utf8');
  const m = src.match(/const WEEKS\s*=\s*(\[[\s\S]*?\n\];)/);
  if (!m) die('hv-block.html: could not find the WEEKS literal');
  const ctx = {};
  vm.createContext(ctx);
  const WEEKS = vm.runInContext('(' + m[1].replace(/;\s*$/, '') + ')', ctx);
  if (!Array.isArray(WEEKS) || !WEEKS.length) die('hv-block.html: WEEKS is not a non-empty array');

  let perWeek = null, rest = null;
  const phases = [], days = [];

  WEEKS.forEach(function (w, wi) {
    const list = w.days || [];
    const thisRest = [];
    list.forEach(function (d, i) { if (d.type === 'rest') thisRest.push(i + 1); });
    if (perWeek == null) { perWeek = list.length; rest = thisRest; }
    if (list.length !== perWeek) die('hv week ' + (wi + 1) + ' has ' + list.length + ' days, week 1 has ' + perWeek);

    const order = [];
    list.forEach(function (d, i) {
      if (d.type === 'rest') return;
      const id = 'hv-w' + (wi + 1) + '-' + (i + 1);
      order.push(id);
      const ex = d.exercises || [];
      days.push({
        id: id,
        title: d.session,
        icon: d.icon,
        tags: [d.meta || ('Week ' + (wi + 1))],
        ex: ex.length,
        sets: ex.reduce(function (n, e) { return n + setsOf(e.sets); }, 0),
        href: 'hv-block.html?week=' + (wi + 1) + '&day=' + (i + 1)
      });
    });
    // Per-phase rest: this block genuinely rests on different days each week
    // ([3,6] in week 1, [6,7] in week 2), which is why the record shape carries
    // it per phase rather than once per program.
    phases.push({ weeks: 1, days: order, rest: thisRest });
  });

  return { weeks: WEEKS.length, perWeek: perWeek, rest: rest, phases: phases, days: days };
}

// ---- splice into mc-pm-data.js -------------------------------------------
// Each generated block sits between per-program markers so the tool rewrites
// exactly its own region and never touches hand-authored fields around it.
function render(obj, indent) {
  return JSON.stringify(obj, null, 2).split('\n')
    .map(function (l, i) { return i === 0 ? l : indent + l; }).join('\n');
}

function splice(src, progId, block) {
  const open = '/* GEN:schedule:' + progId + ' */';
  const close = '/* /GEN:schedule:' + progId + ' */';
  const i = src.indexOf(open), j = src.indexOf(close);
  if (i < 0 || j < 0) die('mc-pm-data.js is missing the ' + progId + ' markers (' + open + ' … ' + close + ')');
  const lineStart = src.lastIndexOf('\n', i) + 1;
  const indent = src.slice(lineStart, i).match(/^\s*/)[0];
  const body = open + '\n' + indent + 'schedule: ' + render(block, indent) + ',\n' + indent + close;
  return src.slice(0, i) + body + src.slice(j + close.length);
}

const PM = path.join(ROOT, 'mc-pm-data.js');
const before = fs.readFileSync(PM, 'utf8');
let after = before;
after = splice(after, 'mm', buildMM());
after = splice(after, 'hv', buildHV());

if (CHECK) {
  if (after !== before) {
    die('mc-pm-data.js schedule blocks are stale — regenerate with `node tools/gen-schedules.js`');
  }
  console.log('gen-schedules: mm + hv schedule blocks match their source data');
  process.exit(0);
}
fs.writeFileSync(PM, after);
console.log('gen-schedules: wrote mm + hv schedule blocks to mc-pm-data.js');
