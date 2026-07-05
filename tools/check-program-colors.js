#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-program-colors.js — CI guard against flagship program color drift
   --------------------------------------------------------------------------
   mc-pm-data.js's `color` field is the documented source of truth for each
   flagship/influencer program, but dashboard.html's #flagGrid renders from
   its own hand-maintained .cat-card.<id> CSS blocks (see CLAUDE.md's "Known
   gap" note — the grid/rail aren't data-driven yet). Nothing enforced the
   two stayed in sync, so a hand-edit to one could silently drift from the
   other with no visible error until someone compared them by eye.

   This does NOT fix that duplication (a real UI refactor CLAUDE.md already
   flags as bigger than it looks) — it just makes drift a hard CI failure
   instead of a silent visual bug. Run: node tools/check-program-colors.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pmData = fs.readFileSync(path.join(ROOT, 'mc-pm-data.js'), 'utf8');
const dash = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');

// { id: '#hex' } for every flagship/influencer program entry (skips MARKET:STRIP
// markers themselves — they're comments, not program objects).
function parseProgramColors(src) {
  const out = {};
  const re = /id:\s*'([a-z0-9-]+)'[^{}]*?color:\s*'(#[0-9a-fA-F]{3,8})'/g;
  let m;
  while ((m = re.exec(src))) out[m[1]] = m[2];
  return out;
}

// .cat-card.<id>{ ... border-top: Npx solid #hex ... }
function parseCatCardColors(src) {
  const out = {};
  const re = /\.cat-card\.([a-z0-9-]+)\{[^}]*?border-top:\s*\d+px solid (#[0-9a-fA-F]{3,8})/g;
  let m;
  while ((m = re.exec(src))) if (!(m[1] in out)) out[m[1]] = m[2];
  return out;
}

const dataColors = parseProgramColors(pmData);
const gridColors = parseCatCardColors(dash);

let fail = false;
const skip = new Set(['faint', 'bonus']); // Conditioning Corner / bonus cards aren't MC_PM_DATA programs

Object.keys(dataColors).forEach((id) => {
  if (skip.has(id)) return;
  const dataColor = dataColors[id];
  const gridColor = gridColors[id];
  if (!gridColor) {
    console.error(`::error::Program '${id}' has a color in mc-pm-data.js (${dataColor}) but no .cat-card.${id} block in dashboard.html`);
    fail = true;
    return;
  }
  if (gridColor.toLowerCase() !== dataColor.toLowerCase()) {
    console.error(`::error::Program '${id}' color mismatch — mc-pm-data.js=${dataColor} vs dashboard.html .cat-card.${id}=${gridColor}`);
    fail = true;
  }
});

if (fail) {
  console.error('\nFix: update dashboard.html\'s .cat-card.<id> (and matching .cat-tag color) to match mc-pm-data.js, or vice versa.');
  process.exit(1);
}
console.log(`Program colors OK — ${Object.keys(dataColors).length} programs checked, mc-pm-data.js matches dashboard.html's #flagGrid.`);
