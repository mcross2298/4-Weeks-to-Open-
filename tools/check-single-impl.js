#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-single-impl.js — a declared list of shared functions must exist
   exactly once tree-wide (Volume II Phase 4 / Initiative 06, "The Render
   Contract")
   --------------------------------------------------------------------------
   Extraction audits (G5, LS-3, LS-5, and this repo's own Volume I Initiative
   04) have repeatedly lifted byte-identical code out of hand-cloned pages
   into shared engines — but nothing ever stopped a NEW page-local copy of
   one of those functions from being reintroduced afterward, silently. That
   is exactly how makeRestTimer ended up with 6 behaviorally distinct bodies
   across 21 sites (one of which had a genuinely broken apostrophe escape —
   see mc-timer.js's own header) and applyReplacements ended up with 5,
   two of which never read mc_replacements_global at all.

   This gate declares a list of function NAMES that are meant to have
   exactly one implementation tree-wide, and fails the build the moment a
   second declaration of any of them appears anywhere — regardless of
   whether the new copy is byte-identical to the canonical one. A duplicate
   that matches today can silently drift tomorrow (that's exactly how the
   six makeRestTimer variants came to exist in the first place); banning
   the shape at the source is the fix that doesn't require line-by-line
   vigilance forever.

   Adding a function here means it graduated from "cloned across pages" to
   "lives in exactly one shared module" — update CANONICAL_HOME so a
   violation message points somewhere useful.

     node tools/check-single-impl.js
   ========================================================================== */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// name -> where the one legitimate copy is expected to live (message only;
// not enforced structurally — a function declared inside its canonical
// home file still counts as "one", it just isn't flagged twice).
const CANONICAL_HOME = {
  makeRestTimer: 'mc-timer.js',
  applyReplacements: 'mc-replace.js',
};
const WATCHED = Object.keys(CANONICAL_HOME);

function trackedFiles() {
  const out = execSync('git ls-files "*.html" "*.js"', { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').filter(Boolean).filter(f => !f.endsWith('.dc.html'))
    // git's index can still list a path that was `rm`'d but not yet staged
    // (e.g. mid-refactor, before `git add` runs) — skip rather than crash.
    .filter(f => fs.existsSync(path.join(ROOT, f)));
}

// Finds every `function <name>(` declaration in src and returns the file
// span each one occupies (brace-matched), so a caller can report exact
// locations without needing a real JS parser.
function findDeclarations(src, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(', 'g');
  const spans = [];
  let m;
  while ((m = re.exec(src))) {
    const braceStart = src.indexOf('{', re.lastIndex);
    if (braceStart === -1) continue;
    let depth = 0, i = braceStart;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    const lineNo = src.slice(0, m.index).split('\n').length;
    spans.push({ line: lineNo });
    re.lastIndex = i + 1;
  }
  return spans;
}

const files = trackedFiles();
let bad = 0;

for (const name of WATCHED) {
  const hits = []; // {file, line}
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const span of findDeclarations(src, name)) {
      hits.push({ file: rel, line: span.line });
    }
  }
  if (hits.length > 1) {
    bad++;
    console.error(`::error::${name}() is declared ${hits.length} times tree-wide — must exist exactly once, in ${CANONICAL_HOME[name]}.`);
    hits.forEach(h => console.error(`    ${h.file}:${h.line}`));
  } else if (hits.length === 0) {
    bad++;
    console.error(`::error::${name}() is declared nowhere — expected exactly one copy, in ${CANONICAL_HOME[name]}. ` +
      `Either it was deleted along with its only caller (update WATCHED here too), or it moved somewhere check-single-impl.js didn't look.`);
  }
}

if (bad) {
  console.error(`\n${bad} single-implementation violation(s). See tools/check-single-impl.js for the declared list.`);
  process.exit(1);
}
console.log(`Single-implementation check OK — ${WATCHED.length} function(s) checked (${WATCHED.join(', ')}), each declared exactly once tree-wide.`);
