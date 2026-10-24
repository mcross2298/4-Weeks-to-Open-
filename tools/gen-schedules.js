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
   the page it describes -- the same reasoning behind build-sw.py and
   gen-program-css.py.

   SOURCES, each read as the program's own truth:
     mm  ->  mm-data.js         PROGRAMS.p1/p2/p3  (3 phases x 5 weeks = 15)
     hv  ->  hv-block.html      the WEEKS literal   (4 weeks)
     ss  ->  cat-strength.html  PMC_SPLITS + PMC_SPLIT_META.cycle (6 weeks)

   `ss` used to be hand-typed (F0) and was left out of this tool. Its day hero
   then disagreed with the logger on 3 of 5 days (flagship readiness D-28:
   Legs 30 vs 32, Back 32 vs 34, Arms 32 vs 35), which is the drift this file
   exists to prevent, so it is generated now (phase C step 4).

   DELOAD CHECK (phase C step 2, D-25). Every declared deload week, as the
   logger will BUILD it (mc-setlog.js's own reduceFor()), must be lighter
   than every other week of its block. A hand-declared deload is checked too:
   ss declared week 6 by hand while authoring it as the block's heaviest week.

   Run:  node tools/gen-schedules.js           # write
         node tools/gen-schedules.js --check   # CI: fail on drift
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');

function die(msg) { console.error('::error::gen-schedules: ' + msg); process.exit(1); }

// Sets prescribed by one exercise in ONE week — the number of logging rows
// mc-setlog.js will actually build for it, working sets plus any appended
// drop rows, read from THE LOGGER ITSELF via its Node export hook.
//
// This used to be a private re-implementation whose comment claimed it was
// "deliberately the same leading-count reading mc-setlog.js's setCount()
// uses, so the record and the logger agree on what a day costs". It was not,
// and measurement is what showed it: the two disagreed on 5 of 12 real
// shapes in this tree. It never handled a comma list at all, so "12,10,8,8"
// fell through to the leading number and returned 12 instead of 4, and it
// counted no drop rows, so "4×8, Drop AMRAP" returned 4 instead of 5.
//
// The records shipped wrong because of it: every mm training day really costs
// 43 sets — the figure mm-p1.html's own finish bar shows — while the record
// claimed 45, 42 and 47, and 15 of hv's 21 days undercounted by their drop
// set. A number the dashboard shows the athlete, contradicting the screen
// they train on.
//
// Calling the real parser is the point of the whole file: a derived record
// cannot disagree with the page it describes, which is why build-sw.py and
// gen-program-css.py exist too. A second copy of a shared function is
// exactly what check-single-impl.js was written to stop.
const SETLOG = require(path.join(ROOT, 'mc-setlog.js'));
function setsOf(str, reason) {
  if (!str) return 0;
  const drop = SETLOG.parseDrop('', str);
  const work = drop.is ? SETLOG.stripDrop(str) : str;
  let n = SETLOG.setCount(work), nd = drop.is ? drop.drops.length : 0;
  if (reason) {
    const r = SETLOG.reduceFor(reason, n, nd, SETLOG.statesSetCount(work));
    n = r.n; nd = r.nd;
  }
  return n + nd;
}

// A week's total rows, raw or as a deload builds it. `weekSets` is one list
// of prescription strings per block week, attached to each record below as a
// non-enumerable property so it never reaches mc-pm-data.js.
function weekVolume(list, reason) {
  return list.reduce(function (n, str) { return n + setsOf(str, reason); }, 0);
}
function withWeekSets(rec, weekSets) {
  Object.defineProperty(rec, 'weekSets', { value: weekSets, enumerable: false });
  return rec;
}
// Two rules, both on what the logger builds. LIGHTER: no other week of the
// block is as light. DEEP ENOUGH: it removes at least a third of the block's
// lightest other week, the floor of the "cut a third to half" decision. The
// second is what the old one-set cut failed: ss's week 6 built 123 rows
// against a lightest week of 142, lighter but only by 13%.
// Returns the problems, so the test file can assert them; main() dies on any.
function deloadProblems(progId, rec) {
  const out = [], ws = rec.weekSets || [], dl = rec.deloadWeeks || [];
  dl.forEach(function (w) {
    const list = ws[w - 1];
    if (!list) { out.push(progId + ': deload week ' + w + ' has no prescription'); return; }
    const built = weekVolume(list, 'deload');
    let lightest = Infinity, lightestWeek = 0;
    ws.forEach(function (other, i) {
      if (i === w - 1 || dl.indexOf(i + 1) !== -1) return;
      const raw = weekVolume(other);
      if (raw < lightest) { lightest = raw; lightestWeek = i + 1; }
    });
    if (!lightestWeek) return;
    if (built >= lightest) {
      out.push(progId + ': deload week ' + w + ' builds ' + built + ' sets, not lighter than week ' +
               lightestWeek + "'s " + lightest);
    } else if (built * 3 > lightest * 2) {
      out.push(progId + ': deload week ' + w + ' builds ' + built + ' sets, less than a third below week ' +
               lightestWeek + "'s " + lightest);
    }
  });
  return out;
}

// Which MC_MUSCLES groups a day's own exercise list actually trains
// (flagship-immersive-roadmap.md H4b) — read the real classifier the same
// way mm-data.js/hv-block.html are read above (a vm'd `window` shim, since
// mc-muscle-map.js is a plain browser IIFE with no module.exports hook of
// its own), so this cannot disagree with what mc-stats.js's Muscle Map or
// the pre-session Readiness Brief render for the same names. Agreement is a
// property of loading the SAME THREE FILES a page loads, not of reusing the
// map — see classifier() below for what happened when only the map was read.
let MC_MUSCLES = null;
function classifier() {
  if (MC_MUSCLES) return MC_MUSCLES;
  const ctx = { window: {} };
  vm.createContext(ctx);
  // The catalog and mc-classify.js FIRST, in that order. mc-muscle-map.js
  // projects from window.MC_CLASSIFY.catalogMuscle() and only falls back to
  // its own regexes for a name the catalog does not carry (roadmap Phase
  // 2.2, "the catalog is the authority"). This generator used to read the map
  // alone, which ran it permanently in that fallback mode: every `muscles`
  // value it wrote was a regex answer, while the two surfaces that consume
  // them load all three files and read the curated record. Wiring the catalog
  // in changed eight day records — a Chest day stopped reporting Triceps
  // (only "Dip Machine", which the catalog files as Chest, ever said so), an
  // Arms day stopped reporting Chest, three Back days gained Shoulders from
  // their shrug and rear-delt work, and "Cable Crossover" resolved at all for
  // the first time instead of "other".
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'exercise-catalog.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'mc-classify.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'mc-muscle-map.js'), 'utf8'), ctx);
  MC_MUSCLES = ctx.window.MC_MUSCLES;
  return MC_MUSCLES;
}
function musclesFor(names) {
  const MC = classifier();
  const set = new Set();
  names.forEach(function (n) {
    const g = MC.classify(n);
    if (g.id !== 'other') set.add(g.id);
  });
  return Array.from(set).sort();
}

// Audit F-03: the last week of a block may be declared a deload only if
// doing so doesn't contradict the block's OWN prescribed volume. Measured
// against the real data this generator reads: High-Volume's four weeks climb
// (161 -> 211 -> 225 -> 238 rows today), so flagging week 4 called the
// block's own heaviest week its unload — a genuinely escalating block has no
// week that deserves the label "lighter than what came before it". The
// Modality Matrix's week-1 day records sum to the same figure in every
// phase, so its final week ties the others by that measure.
//
// This rule only PROPOSES a deload for a generated block. Whether a deload
// week, proposed or declared, really is light is deloadProblems()'s job,
// measured on every week's own prescription as the logger builds it (phase C
// step 2). That is the stricter measure: the Modality Matrix's fifth week of
// each phase actually carries 192 rows against 184, and ss's declared week 6
// carries 157 against 142-154. Both build lighter than every other week only
// because the real deload cuts them (88 and 89 rows).
//
// The rule: the final week may deload only if at least one OTHER week's
// volume is >= its own — i.e. it is not a sole, new peak. `weekVolumes` is
// each week's raw prescribed total, in order, BEFORE any deload reduction.
function lastWeekMayDeload(weekVolumes) {
  const last = weekVolumes[weekVolumes.length - 1];
  return weekVolumes.some(function (v, i) {
    return i < weekVolumes.length - 1 && v >= last;
  });
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
  const phases = [], days = [], weekVolumes = [], weekSets = [];

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
    let phaseVolume = 0;
    list.forEach(function (d, i) {
      if (d.type === 'rest') return;
      const id = pid + '-' + (i + 1);
      order.push(id);
      const ex = d.exercises || [];
      const sets = ex.reduce(function (n, e) {
        return n + setsOf(e.w && e.w[0] && e.w[0].sets);
      }, 0);
      phaseVolume += sets;
      days.push({
        id: id,
        title: d.session,
        icon: d.icon,
        tags: [prog.title || pid, 'Phase ' + prog.phase],
        ex: ex.length,
        // Week 1 figures, the convention F0 set for ss: a per-week set count
        // would need 15 triples per day and would drift from the authored
        // prescription rather than describe it.
        sets: sets,
        // Exercise identity (not just its per-week scheme) is fixed across
        // all 5 weeks of a phase, so unlike ex/sets this needs no "week 1"
        // caveat — the same list trains the same muscles every week.
        muscles: musclesFor(ex.map(function (e) { return e.name; })),
        href: 'mm-' + pid + '.html?day=' + (i + 1)
      });
    });
    phases.push({ weeks: weeksPerPhase, days: order });
    // Same volume every week of the phase (the day list itself doesn't vary
    // week to week — see the muscles comment above), so it repeats once per
    // week the phase spans, in block-week order.
    for (let w = 0; w < weeksPerPhase; w++) weekVolumes.push(phaseVolume);
    // The exact prescription of each week of the phase, for the deload check.
    for (let w = 0; w < weeksPerPhase; w++) {
      const sets = [];
      list.forEach(function (d) {
        if (d.type === 'rest') return;
        (d.exercises || []).forEach(function (e) { sets.push(e.w && e.w[w] && e.w[w].sets); });
      });
      weekSets.push(sets);
    }
  });

  const weeks = weeksPerPhase * ids.length;
  return withWeekSets({
    weeks: weeks,
    perWeek: perWeek,
    rest: rest,
    // Roadmap Phase 4 step 3 (audit PG-2): the last week of the block is a
    // deload. It is emitted as DATA rather than left as a "last week" rule in
    // a renderer, so a program can declare none or later declare several, and
    // so mc-program-progress.js never has to invent one. Deliberately the last
    // week of the BLOCK and not of each phase: this block is three five-week
    // phases, but the High-Volume block below is four phases of ONE week each,
    // where per-phase would make every week a deload.
    //
    // lastWeekMayDeload() (audit F-03) gates it: this block's three phases
    // prescribe an identical 172 sets/week throughout, so week 15 ties every
    // other week rather than contradicting the block's own trend.
    deloadWeeks: lastWeekMayDeload(weekVolumes) ? [weeks] : [],
    phases: phases,
    days: days
  }, weekSets);
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
  const phases = [], days = [], weekVolumes = [], weekSets = [];

  WEEKS.forEach(function (w, wi) {
    const list = w.days || [];
    const thisRest = [];
    list.forEach(function (d, i) { if (d.type === 'rest') thisRest.push(i + 1); });
    if (perWeek == null) { perWeek = list.length; rest = thisRest; }
    if (list.length !== perWeek) die('hv week ' + (wi + 1) + ' has ' + list.length + ' days, week 1 has ' + perWeek);

    const order = [];
    let weekVolume = 0;
    list.forEach(function (d, i) {
      if (d.type === 'rest') return;
      const id = 'hv-w' + (wi + 1) + '-' + (i + 1);
      order.push(id);
      const ex = d.exercises || [];
      const sets = ex.reduce(function (n, e) { return n + setsOf(e.sets); }, 0);
      weekVolume += sets;
      days.push({
        id: id,
        title: d.session,
        icon: d.icon,
        tags: [d.meta || ('Week ' + (wi + 1))],
        ex: ex.length,
        sets: sets,
        muscles: musclesFor(ex.map(function (e) { return e.name; })),
        href: 'hv-block.html?week=' + (wi + 1) + '&day=' + (i + 1)
      });
    });
    // Per-phase rest: this block genuinely rests on different days each week
    // ([3,6] in week 1, [6,7] in week 2), which is why the record shape carries
    // it per phase rather than once per program.
    phases.push({ weeks: 1, days: order, rest: thisRest });
    weekVolumes.push(weekVolume);
    const sets = [];
    list.forEach(function (d) { if (d.type !== 'rest') (d.exercises || []).forEach(function (e) { sets.push(e.sets); }); });
    weekSets.push(sets);
  });

  // lastWeekMayDeload() (audit F-03): this block ESCALATES by its own design
  // (146 -> 196 -> 210 -> 238 sets across its four weeks — "compound-dominant,
  // into full supersets, into high-set pyramids, into bodyweight density" per
  // the program's own description), so its final week is the block's own
  // heaviest, not its lightest. Flagging it a deload previously had the app
  // badge the hardest week of the block "prescribed lighter" and apply the
  // -1-set-per-exercise reduction to it — still 30% above week 1 afterward.
  return withWeekSets({ weeks: WEEKS.length, perWeek: perWeek, rest: rest,
           deloadWeeks: lastWeekMayDeload(weekVolumes) ? [WEEKS.length] : [],
           phases: phases, days: days }, weekSets);
}

// ---- ss: one day set, six weeks, read from cat-strength.html --------------
// PMC_SPLITS holds each training day's exercises per week (a superset is one
// item carrying two lifts, a and b); PMC_SPLIT_META.cycle names the day order,
// the rest positions and the declared deload. The record keeps F0's shape:
// ex/sets/min are WEEK 1 figures, and `min` is 2.5 minutes a set rounded to
// 5, the ratio every one of F0's hand-typed durations already used.
function buildSS() {
  const src = fs.readFileSync(path.join(ROOT, 'cat-strength.html'), 'utf8');
  const ms = src.match(/const PMC_SPLITS\s*=\s*(\{[\s\S]*?\n\});/);
  const mm = src.match(/const PMC_SPLIT_META\s*=\s*(\{[\s\S]*?\n\});/);
  if (!ms || !mm) die('cat-strength.html: could not find PMC_SPLITS / PMC_SPLIT_META');
  const ctx = {};
  vm.createContext(ctx);
  const SPLITS = vm.runInContext('(' + ms[1].replace(/;\s*$/, '') + ')', ctx);
  const META = vm.runInContext('(' + mm[1].replace(/;\s*$/, '') + ')', ctx);
  const cycle = META.cycle;
  if (!cycle || !Array.isArray(cycle.workouts) || !cycle.workouts.length) die('cat-strength.html: PMC_SPLIT_META.cycle names no workouts');
  if (!Array.isArray(cycle.rest)) die('cat-strength.html: PMC_SPLIT_META.cycle declares no rest positions');

  function lifts(list) {
    const out = [];
    (list || []).forEach(function (it) {
      if (it.type === 'superset') { if (it.a) out.push(it.a); if (it.b) out.push(it.b); }
      else out.push(it);
    });
    return out;
  }

  let weeks = null;
  cycle.workouts.forEach(function (id) {
    const w = SPLITS[id];
    if (!w || !w.data) die('cat-strength.html: workout ' + id + ' has no data');
    const n = Object.keys(w.data).length;
    if (weeks == null) weeks = n;
    if (n !== weeks) die('cat-strength.html: ' + id + ' has ' + n + ' weeks, ' + cycle.workouts[0] + ' has ' + weeks);
  });

  const days = cycle.workouts.map(function (id) {
    const w = SPLITS[id], wk1 = lifts(w.data[1]);
    const sets = wk1.reduce(function (n, e) { return n + setsOf(e.sets); }, 0);
    return {
      id: id, title: w.title, icon: w.icon, tags: (w.tags || []).slice(),
      ex: wk1.length, sets: sets, min: Math.round(sets * 2.5 / 5) * 5,
      muscles: musclesFor(wk1.map(function (e) { return e.name; }))
    };
  });

  const weekSets = [];
  for (let k = 1; k <= weeks; k++) {
    const sets = [];
    cycle.workouts.forEach(function (id) { lifts(SPLITS[id].data[k]).forEach(function (e) { sets.push(e.sets); }); });
    weekSets.push(sets);
  }

  return withWeekSets({
    weeks: weeks,
    perWeek: cycle.workouts.length + cycle.rest.length,
    rest: cycle.rest.slice(),
    // Declared by the program, not proposed by lastWeekMayDeload(): ss's
    // week 6 is authored as its heaviest week (157 rows against 142-154) and
    // made light by the real deload at render. deloadProblems() checks that.
    deloadWeeks: (cycle.deloadWeeks || []).slice(),
    days: days
  }, weekSets);
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

// Guarded so tools/test-mc-gen-schedules.js can require() buildMM/buildHV/
// lastWeekMayDeload directly (against the real mm-data.js/hv-block.html
// sources — both read from disk relative to ROOT, not to the caller's cwd)
// without triggering a write, the way require()-ing this file always used to.
if (require.main === module) {
  const PM = path.join(ROOT, 'mc-pm-data.js');
  const before = fs.readFileSync(PM, 'utf8');
  let after = before;
  const recs = { ss: buildSS(), mm: buildMM(), hv: buildHV() };
  const problems = [];
  Object.keys(recs).forEach(function (id) { problems.push.apply(problems, deloadProblems(id, recs[id])); });
  if (problems.length) die('a declared deload week is not lighter than the rest of its block:\n  ' + problems.join('\n  '));
  Object.keys(recs).forEach(function (id) { after = splice(after, id, recs[id]); });

  if (CHECK) {
    if (after !== before) {
      die('mc-pm-data.js schedule blocks are stale — regenerate with `node tools/gen-schedules.js`');
    }
    console.log('gen-schedules: ss + mm + hv schedule blocks match their source data; every deload week builds lighter than the rest of its block');
    process.exit(0);
  }
  fs.writeFileSync(PM, after);
  console.log('gen-schedules: wrote ss + mm + hv schedule blocks to mc-pm-data.js');
}

module.exports = { buildMM: buildMM, buildHV: buildHV, buildSS: buildSS, lastWeekMayDeload: lastWeekMayDeload,
                   deloadProblems: deloadProblems, weekVolume: weekVolume };
