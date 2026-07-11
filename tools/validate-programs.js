#!/usr/bin/env node
'use strict';
/* ==========================================================================
   validate-programs.js — CI enforcement of CLAUDE.md's "Per-Day Intensifier
   Coverage" Shipping Checklist (item 4: the pre-merge parse-check), for the
   Modality Matrix multi-week programs (mm-p1/p2/p3.html — the only pages
   with a WEEK_THEMES + per-exercise w[] structure today).
   --------------------------------------------------------------------------
   Pulls each page's inline <script>, syntax-checks the whole thing with
   `new Function()`, then extracts just the WEEK_THEMES/DAYS array literals
   (balanced-bracket matching, same technique tools/check-program-colors.js
   uses for PROGRAM_ICONS) and evaluates each standalone — top-level `const`
   doesn't attach to a vm sandbox's global object, so running the whole
   script the way tools/test-naming.js does for plain .js modules doesn't
   expose these declarations; this sidesteps that entirely, and also skips
   the render()/DOM calls at the bottom of the script that would throw in
   a headless context anyway.

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
const PAGES = ['mm-p1.html', 'mm-p2.html', 'mm-p3.html'];

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

function extractScript(src, file) {
  const start = src.indexOf('<script>');
  const end = src.indexOf('</script>', start);
  if (start < 0 || end < 0) { err(file + ': could not find an inline <script> block'); return null; }
  return src.slice(start + '<script>'.length, end);
}

// Balanced-bracket array-literal extraction (same brace-depth-matching
// technique tools/check-program-colors.js uses for PROGRAM_ICONS) — top-level
// `const` declarations don't attach to a vm sandbox's global object, so the
// whole-script vm approach test-naming.js uses for plain .js modules doesn't
// work here; pulling just the array literal and evaluating it standalone
// (via `new Function('return ' + text)`) sidesteps that entirely.
function extractArrayLiteral(code, constName, file) {
  const marker = 'const ' + constName + ' = [';
  const start = code.indexOf(marker);
  if (start < 0) { err(file + ': "' + marker + '" not found'); return null; }
  let i = start + marker.length - 1;   // sit on the opening '['
  let depth = 0;
  for (; i < code.length; i++) {
    if (code[i] === '[') depth++;
    else if (code[i] === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  const text = code.slice(start + marker.length - 1, i);
  try { return new Function('return ' + text)(); }
  catch (e) { err(file + ': ' + constName + ' failed to evaluate — ' + e.message); return null; }
}

function loadPage(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const code = extractScript(src, file);
  if (code == null) return null;

  // item 4's own first step: syntax-check the whole inline script
  try { new Function(code); }
  catch (e) { err(file + ': inline <script> failed to parse — ' + e.message); return null; }

  const weekThemes = extractArrayLiteral(code, 'WEEK_THEMES', file);
  const days = extractArrayLiteral(code, 'DAYS', file);
  if (!Array.isArray(weekThemes) || !Array.isArray(days)) return null;
  return { weekThemes: weekThemes, days: days };
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

function validatePage(file) {
  const data = loadPage(file);
  if (!data) return;
  const weekCount = data.weekThemes.length;
  const trainingDays = data.days.filter(function (d) { return d.type === 'training'; });

  trainingDays.forEach(function (day) {
    const label = file + ' ' + (day.label || '?') + ' (' + (day.session || '') + ')';
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

  if (!fail) console.log(file + ': OK — ' + trainingDays.length + ' training days × ' + weekCount + ' weeks checked');
}

PAGES.forEach(validatePage);

if (fail) {
  console.error('\nFix: see CLAUDE.md\'s "Per-Day Intensifier Coverage" Shipping Checklist.');
  process.exit(1);
}
console.log('validate-programs.js: all multi-week programs pass the intensifier-coverage checklist');
