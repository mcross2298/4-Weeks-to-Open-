#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-naming.js — unit tests for the v2 naming resolver + override merge
   --------------------------------------------------------------------------
   Loads the real browser modules (program-overrides.js, mc-naming.js) in Node
   with minimal stubs. The modules assign window.MC_PO / window.MC_NAMES before
   their init() call, and init() is gated on document.readyState — so setting
   readyState='loading' lets us exercise the pure public API without a DOM,
   without jsdom, and without touching the source.

   Covers the precedence table in pm-rename-design.md §1.4:
     • exercise page > global > original   (via applyToCard on a fake card)
     • program / split / badge resolution + badge global fallback
     • reset shadowing (entry drops to the next tier)
     • tolerant trim().toLowerCase() lookup
     • exportData() reset filtering + version
     • progOf() mapping incl. the cat-* pages (B2) and unknown → null

   Master-only (lives in tools/, excluded from the market build). Run:
     node tools/test-naming.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const NAME_SEL = '.ex-name, .lift-name, .var-name, .ss-name';
const PAGE = 'pmc-s5-push.html';

let passed = 0, failed = 0;
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) passed++;
  else { failed++; console.error('  ✗ ' + msg + '\n      expected ' + e + '\n      got      ' + a); }
}
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('  ✗ ' + msg); } }

// ---- minimal browser stubs ------------------------------------------------
let cardList = [];
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.CustomEvent = function (type) { this.type = type; };
global.MutationObserver = function () { this.observe = () => {}; this.disconnect = () => {}; this.takeRecords = () => {}; };
global.location = { pathname: '/' + PAGE, search: '' };
const noop = () => {};
global.document = {
  readyState: 'loading',                         // <- keeps init() from running
  addEventListener: noop,
  dispatchEvent: noop,
  createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop, onload: null }),
  head: { appendChild: noop },
  body: {},
  querySelectorAll: (sel) => /mcpo-ss/.test(String(sel)) ? [] : cardList.slice()
};
// In a browser, `window` IS the global object, so the modules use `window.MC_PO`
// and bare `MC_PO` interchangeably. Mirror that so both resolve here.
global.window = global;

// ---- load the real modules in this global context -------------------------
function load(file) { vm.runInThisContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), { filename: file }); }
load('program-overrides.js');
load('mc-naming.js');
// mc-pm-data.js loads before mc-naming.js's own tests run (not just before
// section K's) since splitOf()'s PAGE_SPLIT_MAP is now derived from it (see
// Phase 3.3) — in a real page these are two independently dynamically-
// inserted <script> tags with no guaranteed order, but by the time anything
// actually calls splitOf() both have long since finished loading.
load('mc-pm-data.js');
const PO = global.window.MC_PO;
const N = global.window.MC_NAMES;
ok(PO && N, 'modules loaded (MC_PO + MC_NAMES present)');

function setDoc(doc) {
  PO.setLocal({
    pages: doc.pages || {}, exercises: doc.exercises || {},
    programs: doc.programs || {}, splits: doc.splits || {}, badges: doc.badges || {}
  });
}

// ---- A: exercise global resolver ------------------------------------------
setDoc({ exercises: { 'Romanian Deadlifts': { name: 'RDL' }, 'X': { reset: true } } });
eq(N.exercise('Romanian Deadlifts'), 'RDL', 'A1 global exercise rename');
eq(PO.globalExerciseName('Romanian Deadlifts'), 'RDL', 'A2 globalExerciseName matches');
eq(N.exercise('  romanian deadlifts '), 'RDL', 'A3 tolerant trim/lowercase lookup');
eq(N.exercise('X'), null, 'A4 reset entry resolves to null');
eq(N.exercise('Nope'), null, 'A5 absent entry resolves to null');

// ---- B: program + programMeta ---------------------------------------------
setDoc({ programs: { pmc: { name: 'Project Chaos', icon: '🌀', desc: 'd' } } });
eq(N.program('pmc'), 'Project Chaos', 'B1 program name');
eq(N.programMeta('pmc'), { name: 'Project Chaos', icon: '🌀', desc: 'd' }, 'B2 programMeta full patch');
setDoc({ programs: { pmc: { reset: true } } });
eq(N.program('pmc'), null, 'B3 program reset -> null');
eq(N.programMeta('pmc'), {}, 'B4 programMeta reset -> {}');

// ---- C: split resolution + tolerant lookup + reset ------------------------
setDoc({ splits: { pmc: { 'Split 5': { name: 'Chest Focus' } } } });
eq(N.split('pmc', 'Split 5'), 'Chest Focus', 'C1 split rename');
eq(N.split('pmc', '  split 5 '), 'Chest Focus', 'C2 split tolerant lookup');
eq(N.split('pmc', 'Split 1'), null, 'C3 unrenamed split -> null');
setDoc({ splits: { pmc: { 'Split 5': { reset: true } } } });
eq(N.split('pmc', 'Split 5'), null, 'C4 split reset -> null');

// ---- D: badge program-scope vs global fallback ----------------------------
setDoc({ badges: {
  global: { 'tb-amrap': { label: 'To The Grave' } },
  pmc: { 'tb-superset': { label: 'Chaos Pair', color: '#a855f7' }, 'tb-drop': { reset: true } }
} });
eq(N.badge('pmc', 'tb-superset'), { label: 'Chaos Pair', color: '#a855f7' }, 'D1 program-scoped badge wins');
eq(N.badge('pmc', 'tb-amrap'), { label: 'To The Grave' }, 'D2 falls back to global within program');
eq(N.badge('mc', 'tb-amrap'), { label: 'To The Grave' }, 'D3 global badge applies to other program');
eq(N.badge('mc', 'tb-superset'), null, 'D4 program-scoped badge does not leak to another program');
eq(N.badge('pmc', 'tb-drop'), null, 'D5 badge reset -> null');

// ---- E: progOf mapping incl. cat-* pages (B2) -----------------------------
eq(N.progOf('cat-pmc.html'), 'pmc', 'E1 cat-pmc -> pmc');
eq(N.progOf('cat-mc.html'), 'mc', 'E2 cat-mc -> mc');
eq(N.progOf('cat-strength.html'), 'ss', 'E4 cat-strength -> ss');
eq(N.progOf('cat-stndr.html'), 'stndr', 'E5 cat-stndr -> stndr (master build)');
eq(N.progOf('pmc-s5-push.html'), 'pmc', 'E6 workout page -> pmc');
eq(N.progOf('mc-s1-back.html'), 'mc', 'E7 workout page -> mc');
eq(N.progOf('dashboard.html'), null, 'E8 dashboard -> null');
eq(N.progOf('cat-custom.html'), null, 'E9 cat-custom -> null (explicit)');

// ---- F: splitOf -----------------------------------------------------------
eq(N.splitOf('pmc-split5.html'), 'Split 5', 'F1 pmc-split5 -> Split 5');
eq(N.splitOf('mc-split1.html'), 'Split 1', 'F2 mc-split1 -> Split 1');
eq(N.splitOf('dashboard.html'), null, 'F3 non-hub page -> null');

// ---- G: localNamingEditCount ----------------------------------------------
setDoc({
  exercises: { a: { name: 'A' }, b: { name: 'B' } },
  programs: { pmc: { name: 'P' } },
  splits: { pmc: { 'Split 5': { name: 'S' } } },
  badges: { global: { x: { label: 'X' } }, pmc: { y: { label: 'Y' } } }
});
eq(N.localNamingEditCount(), 6, 'G1 counts exercises+programs+splits+badges (2+1+1+2)');

// ---- H: exportData reset filtering + version ------------------------------
setDoc({
  pages: { [PAGE]: { Orig: { name: 'N' }, Gone: { reset: true } } },
  exercises: { keep: { name: 'K' }, drop: { reset: true } },
  splits: { pmc: { s5: { name: 'S' }, sx: { reset: true } } },
  badges: { global: { b1: { label: 'L' }, b2: { reset: true } } }
});
const ex = PO.exportData();
eq(ex.version, 2, 'H1 export version 2');
ok(ex.pages[PAGE].Orig && !ex.pages[PAGE].Gone, 'H2 pages reset entry filtered out');
ok(ex.exercises.keep && !ex.exercises.drop, 'H3 exercises reset filtered');
ok(ex.splits.pmc.s5 && !(ex.splits.pmc || {}).sx, 'H4 splits reset filtered');
ok(ex.badges.global.b1 && !ex.badges.global.b2, 'H5 badges reset filtered');

// ---- I: effective() merges all sections from the local layer --------------
const eff = PO.effective();
ok(eff.pages && eff.exercises && eff.programs && eff.splits && eff.badges, 'I1 effective() has all v2 sections');

// ---- J: integration — applyToCard page > global > original ----------------
const nameEl = { textContent: 'Pronated DB Chest Flies' };
const card = {
  attrs: {},
  getAttribute(k) { return (k in this.attrs) ? this.attrs[k] : null; },
  setAttribute(k, v) { this.attrs[k] = v; },
  removeAttribute(k) { delete this.attrs[k]; },
  querySelector(sel) { return sel === NAME_SEL ? nameEl : null; },
  querySelectorAll() { return []; }
};
cardList = [card];
setDoc({
  pages: { [PAGE]: { 'Pronated DB Chest Flies': { name: 'Crucifix Flies' } } },
  exercises: { 'Pronated DB Chest Flies': { name: 'GLOBAL FLY' } }
});
PO.refresh();
eq(nameEl.textContent, 'Crucifix Flies', 'J1 page-level name wins over global');
setDoc({ exercises: { 'Pronated DB Chest Flies': { name: 'GLOBAL FLY' } } });
PO.refresh();
eq(nameEl.textContent, 'GLOBAL FLY', 'J2 global name used when no page-level name');
setDoc({});
PO.refresh();
eq(nameEl.textContent, 'Pronated DB Chest Flies', 'J3 reverts to original when both cleared');
cardList = [];

// ---- K: shared program/badge data (mc-pm-data.js, single source) ----------
const D = global.window.MC_PM_DATA;
ok(D, 'K0 MC_PM_DATA loaded');
eq(D.programs.length, 10, 'K1 master build lists all 10 programs');
eq(D.programOrder, ['ss', 'pmc', 'mc', 'ks', 'mm', 'hv', 'stndr', 'pump', 'gainz', 'psu'], 'K2 program order');
eq(D.program('pmc').name, 'Project Muscle Confusion', 'K3 program lookup by id');
eq(D.program('pmc').splits.length, 7, 'K4 program carries splits');
eq(D.program('nope'), null, 'K5 unknown program -> null');
ok(D.badges.card['tb-superset'] && D.badges.legend['lb-ss'], 'K6 badge label maps present');
ok(D.programs[0].id === 'ss' && D.programs[3].id === 'ks', 'K7 flagship tier first, in order');

// ---- L: MC_PM_DATA ↔ progOf coverage (catches B2-style resolution gaps) ----
// Every program's catalog page must resolve back to its id, and every program
// must carry splits; every badge id must have a non-empty label.
D.programs.forEach(function (p) {
  eq(N.progOf(p.href), p.id, 'L: ' + p.id + ' cat page (' + p.href + ') resolves to its program');
  ok(Array.isArray(p.splits) && p.splits.length > 0, 'L: ' + p.id + ' carries splits');
});
['card', 'legend'].forEach(function (grp) {
  Object.keys(D.badges[grp]).forEach(function (bid) {
    ok(typeof D.badges[grp][bid] === 'string' && D.badges[grp][bid].length > 0,
       'L: badge ' + bid + ' has a label');
  });
});

// ---- summary --------------------------------------------------------------
console.log('\nnaming resolver tests: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
