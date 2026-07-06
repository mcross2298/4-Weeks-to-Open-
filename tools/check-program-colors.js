#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-program-colors.js — CI guard against flagship program color drift
   --------------------------------------------------------------------------
   mc-pm-data.js's `color` field is the source of truth for each flagship/
   influencer program's accent hue. #flagGrid, the Home-screen .prog-rail,
   and .influencer-grid all render their markup at runtime from
   MC_PM_DATA.programs now (see renderProgramCards() in dashboard.html's
   inline script) — the .cat-card.<id> / .rail-card.<id> CSS blocks that
   supply each program's gradient/glow are the only hand-maintained part
   left, and dashboard.html carries TWO such blocks per id: an older
   unscoped `.cat-card.<id>{...}` rule (also shared with .faint/.bonus,
   which have no scoped replacement) and a later `#scr-programs
   .cat-card.<id>{...}` / `#scr-dashboard .rail-card.<id>{...}` rule that
   wins the cascade by specificity. Only the scoped rule is what a user
   ever actually sees — this check reads that one specifically (falling
   back to the unscoped rule only if no scoped one exists for an id), and
   also cross-checks the rail against the same value, so a hand-edit to
   any of the three can't silently drift from the other two with no
   visible error until someone compares them by eye.

   Run: node tools/check-program-colors.js
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

// Border-top width is a plain integer in the older unscoped rule (e.g. 3px)
// but a decimal in the scoped rule that actually renders (e.g. 2.5px).
const BORDER_TOP = /border-top:\s*[\d.]+px solid (#[0-9a-fA-F]{3,8})/;

// Prefers `<scopePrefix> .cat-card.<id>{...border-top...}` (what actually
// renders); falls back to the bare `.cat-card.<id>{...}` rule for ids that
// have no scoped override (.faint, .bonus — not MC_PM_DATA programs, so
// never looked up by id here anyway, but harmless to support).
function parseSelectorColors(src, selector, scopePrefix) {
  const scoped = {};
  const unscoped = {};
  const re = new RegExp('(' + scopePrefix.replace(/[.#]/g, '\\$&') + '\\s+)?'
    + selector.replace('.', '\\.') + '\\.([a-z0-9-]+)\\{([^}]*)\\}', 'g');
  let m;
  while ((m = re.exec(src))) {
    const isScoped = !!m[1];
    const id = m[2];
    const body = m[3];
    const bm = BORDER_TOP.exec(body);
    if (!bm) continue;
    const bucket = isScoped ? scoped : unscoped;
    if (!(id in bucket)) bucket[id] = bm[1];
  }
  return Object.assign({}, unscoped, scoped); // scoped wins where both exist
}

const dataColors = parseProgramColors(pmData);
const gridColors = parseSelectorColors(dash, '.cat-card', '#scr-programs');
const railColors = parseSelectorColors(dash, '.rail-card', '#scr-dashboard');

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
  // Not every program has a Home-rail card (influencer programs don't) —
  // only cross-check ids that actually have a .rail-card.<id> block.
  const railColor = railColors[id];
  if (railColor && railColor.toLowerCase() !== dataColor.toLowerCase()) {
    console.error(`::error::Program '${id}' color mismatch — mc-pm-data.js=${dataColor} vs dashboard.html .rail-card.${id}=${railColor}`);
    fail = true;
  }
});

if (fail) {
  console.error('\nFix: update dashboard.html\'s .cat-card.<id> / .rail-card.<id> (and matching .cat-tag color) to match mc-pm-data.js, or vice versa.');
  process.exit(1);
}
console.log(`Program colors OK — ${Object.keys(dataColors).length} programs checked against dashboard.html's #flagGrid and .prog-rail.`);
