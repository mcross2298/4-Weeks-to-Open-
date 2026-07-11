#!/usr/bin/env node
'use strict';
/* ==========================================================================
   validate-programs.js — CI enforcement of CLAUDE.md's "Per-Day Intensifier
   Coverage" Shipping Checklist (item 4: the pre-merge parse-check), for the
   Modality Matrix multi-week programs (mm-p1/p2/p3.html — the only pages
   with a WEEK_THEMES + per-exercise w[] structure today).
   --------------------------------------------------------------------------
   Since Phase 3.2, WEEK_THEMES and each program's DAYS live in mm-data.js
   (mm-p1/p2/p3.html just call MM.init('p1'|'p2'|'p3') against the shared
   mm-engine.js) rather than inline per-page — this reads that module
   directly instead of scraping the pages. mm-data.js wraps everything in an
   IIFE exposing window.MM_DATA, so evaluating the whole file against a
   `window` stub and reading MM_DATA back off it works fine here (unlike the
   old per-page inline <script>, this file has no top-level `const`/`let`
   that need vm-sandbox workarounds — everything's inside the IIFE and
   reachable through the one attached global).

   Checks, per training day × per week (per CLAUDE.md's fixed 10-position
   blueprint — position encodes intensifier role, so tag-per-position IS the
   "all 7 intensifiers present" check):
     • exactly 10 exercises, each with one w[] entry per WEEK_THEMES entry
     • tag sequence matches the blueprint: null, null, TRI-SET×3, SUPERSET×2,
       CLUSTER, DROP, FINISHER (positions 1-10)
     • set-count-per-position matches the documented 2/4/4 mix (5,5 · 4,4,4,4
       · 3,3,3,3) and holds in every week — "tri-sets are always 3 sets" is
       exactly positions 3-5 of that mix
     • the week's theme is visible in the FEATURE lifts' (positions 2,5,6,8)
       set field itself: a real pyramid (distinct values) in the Pyramid
       week, literal "@" tempo notation in the Tempo week, a paired/AMRAP
       "+" addition in the Superset week — not just coaching notes

   Run: node tools/validate-programs.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = 'mm-data.js';
const PROGRAM_IDS = ['p1', 'p2', 'p3'];

// blueprint: 0-indexed position -> expected tag (null = untagged compound)
const EXPECTED_TAGS = [null, null, 'TRI-SET', 'TRI-SET', 'TRI-SET', 'SUPERSET', 'SUPERSET', 'CLUSTER', 'DROP', 'FINISHER'];
// blueprint: 0-indexed position -> expected working-set count (2/4/4 mix)
const EXPECTED_SETS = [5, 5, 3, 3, 3, 4, 4, 4, 4, 3];
// the 4 FEATURE lifts (CLAUDE.md's Pos 2, 5, 6, 8) whose set field must
// visibly carry the week's theme, in the Pyramid (W2) and Tempo (W3) weeks
const FEATURE_POS = [1, 4, 5, 7];
// In the Superset week (W5, last), Pos 5's "paired" nature comes from the
// documented W5 render-time contingency (Ex 4-5 pair up; Ex 3 runs
// standalone) — a display-only swap, not something in Pos 5's own set text.
// Pos 2/6/8 do carry a textual "+ AMRAP"-style addition in W5, so only those
// three are checked there.
const SUPERSET_WEEK_FEATURE_POS = [1, 5, 7];

let fail = false;
function err(msg) { console.error('::error::' + msg); fail = true; }

function loadProgramData() {
  const code = fs.readFileSync(path.join(ROOT, DATA_FILE), 'utf8');

  // item 4's own first step: syntax-check the whole file
  try { new Function(code); }
  catch (e) { err(DATA_FILE + ': failed to parse — ' + e.message); return null; }

  // mm-data.js is a self-invoking IIFE that assigns window.MM_DATA — give it
  // a minimal window stub and run it for real (no `const`-doesn't-attach
  // vm-sandbox problem here since everything is reached through that one
  // attached global, not scraped as separate top-level declarations).
  const sandboxWindow = {};
  const fn = new Function('window', code);
  try { fn(sandboxWindow); }
  catch (e) { err(DATA_FILE + ': threw while evaluating — ' + e.message); return null; }

  const data = sandboxWindow.MM_DATA;
  if (!data || !Array.isArray(data.WEEK_THEMES) || !data.PROGRAMS) {
    err(DATA_FILE + ': window.MM_DATA missing WEEK_THEMES/PROGRAMS after evaluation');
    return null;
  }
  return data;
}

function setCountOf(setsStr) {
  const lead = /^(\d+)\s*[×x]/.exec(setsStr || '');
  if (lead) return parseInt(lead[1], 10);
  const parts = String(setsStr || '').split(',').map(function (s) { return s.trim(); });
  const core = parts.filter(function (p) { return p && !/^\+/.test(p) && !/AMRAP|Drop/i.test(p); });
  return core.length || parts.length;
}

function themeVisible(setsStr, weekIdx, weekCount) {
  const s = setsStr || '';
  if (weekIdx === 1) {                       // Pyramid
    // Numbers anywhere in the string, not just a comma-separated list — a
    // "21s"-convention exercise (fixed "4×21" working sets) expresses its
    // pyramid in an appended cluster range instead ("+ Cluster 8/10/12"),
    // which is still a real ascending scheme, just slash- not comma-joined.
    const nums = (s.match(/\d+/g) || []).map(Number);
    return nums.length >= 3 && nums.some(function (n) { return n !== nums[0]; });
  }
  if (weekIdx === 2) return /@/.test(s);      // Tempo
  if (weekIdx === weekCount - 1) return /\+/.test(s);  // Superset (last week)
  return true;                                // Low-Rep/High-Rep weeks — covered by the set-count/tag checks, not a text pattern
}

function validateProgram(programId, weekThemes, days) {
  const weekCount = weekThemes.length;
  const trainingDays = days.filter(function (d) { return d.type === 'training'; });

  trainingDays.forEach(function (day) {
    const label = programId + ' ' + (day.label || '?') + ' (' + (day.session || '') + ')';
    if (!Array.isArray(day.exercises) || day.exercises.length !== 10) {
      err(label + ': expected exactly 10 exercises, got ' + (day.exercises ? day.exercises.length : 0));
      return;
    }
    day.exercises.forEach(function (ex, pos) {
      if (!Array.isArray(ex.w) || ex.w.length !== weekCount) {
        err(label + ' Pos ' + (pos + 1) + ' "' + ex.name + '": w[] length ' +
          (ex.w ? ex.w.length : 0) + ' !== WEEK_THEMES.length (' + weekCount + ')');
        return;
      }
      ex.w.forEach(function (wk, weekIdx) {
        const wLabel = label + ' Pos ' + (pos + 1) + ' "' + ex.name + '" W' + (weekIdx + 1);
        if (wk.tag !== EXPECTED_TAGS[pos]) {
          err(wLabel + ': tag "' + wk.tag + '" !== expected "' + EXPECTED_TAGS[pos] + '" for this position');
        }
        const sets = setCountOf(wk.sets);
        if (sets !== EXPECTED_SETS[pos]) {
          err(wLabel + ': parsed ' + sets + ' sets from "' + wk.sets + '" !== expected ' + EXPECTED_SETS[pos] + ' for this position');
        }
        const isSupersetWeek = weekIdx === weekCount - 1;
        const featurePosThisWeek = isSupersetWeek ? SUPERSET_WEEK_FEATURE_POS : FEATURE_POS;
        if (featurePosThisWeek.indexOf(pos) >= 0 && !themeVisible(wk.sets, weekIdx, weekCount)) {
          err(wLabel + ': week theme not visibly reflected in the set field ("' + wk.sets + '")');
        }
      });
    });
  });

  if (!fail) console.log(programId + ': OK — ' + trainingDays.length + ' training days × ' + weekCount + ' weeks checked');
}

const mmData = loadProgramData();
if (mmData) {
  PROGRAM_IDS.forEach(function (id) {
    const program = mmData.PROGRAMS[id];
    if (!program) { err(DATA_FILE + ': PROGRAMS.' + id + ' not found'); return; }
    validateProgram(id, mmData.WEEK_THEMES, program.days);
  });
}

if (fail) {
  console.error('\nFix: see CLAUDE.md\'s "Per-Day Intensifier Coverage" Shipping Checklist.');
  process.exit(1);
}
console.log('validate-programs.js: all multi-week programs pass the intensifier-coverage checklist');
