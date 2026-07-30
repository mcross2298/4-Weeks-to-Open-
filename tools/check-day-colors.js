#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-day-colors.js — governed day-card accent palette (audit G-05)
   --------------------------------------------------------------------------
   Recovery days already had a spec and hit it perfectly: conditioning amber,
   active-rest teal, rest slate, 100% adherence across every day card. Training
   days had no spec at all, so 194 of them carried 18 ad-hoc hexes — including
   five near-duplicate clusters indistinguishable in use (three purples within
   12 degrees of hue, five oranges, two reds, two greens, two blues), and one
   real semantic break: #0d9488, the colour RESERVED for active-rest days, used
   as a TRAINING accent on bro-split.html.

   This gate fixes the set, not the meaning. Each training hex was folded into
   the most-used member of its own hue family — a data-driven consolidation, not
   an invented role-to-colour scheme. Assigning "legs are always green, chest is
   always crimson" is a further design decision the usage data does not settle
   on its own (arms and shoulders both trend violet; chest+triceps days trend
   orange while chest days trend crimson), so it is deliberately left open.

     node tools/check-day-colors.js          # CI: fail on an ungoverned colour
     node tools/check-day-colors.js --fix    # rewrite day colours to the palette

   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Reserved per CLAUDE.md's 7-day layout standard. A training day may never use
// one of these — that is what made bro-split.html a real defect rather than
// just an inconsistency.
const RECOVERY = {
  conditioning: '#d97706',   // amber
  activerest:   '#0d9488',   // teal
  rest:         '#334155'    // slate
};

// The governed training palette: one anchor per hue family, each the most-used
// member of that family at the time of consolidation.
const TRAINING = ['#e11d48', '#f97316', '#16a34a', '#0891b2', '#0369a1', '#7c3aed'];

// Everything previously in use, mapped to its nearest-hue anchor.
const FOLD = {
  '#ef4444': '#e11d48', '#dc2626': '#e11d48',
  '#ea580c': '#f97316', '#b45309': '#f97316', '#f59e0b': '#f97316', '#fbbf24': '#f97316',
  '#10b981': '#16a34a', '#059669': '#16a34a',
  '#0d9488': '#0891b2',   // the reserved-teal collision (bro-split.html)
  '#3b82f6': '#0369a1',
  '#8b5cf6': '#7c3aed', '#a855f7': '#7c3aed'
};

const DAY_RE = /(\{type:"(\w+)",label:"[^"]*",session:"[^"]*",color:")(#[0-9a-fA-F]{6})(")/g;

function pages() {
  return fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && !f.endsWith('.dc.html') && f !== 'stndr-card-concepts.html')
    .sort();
}

function main() {
  const fix = process.argv.includes('--fix');
  let problems = 0, rewritten = 0, filesTouched = 0, checked = 0;

  for (const name of pages()) {
    const file = path.join(ROOT, name);
    const src = fs.readFileSync(file, 'utf8');
    let changed = false;

    const out = src.replace(DAY_RE, (m, head, type, color, tail) => {
      checked++;
      const lower = color.toLowerCase();

      if (type !== 'training') {
        const want = RECOVERY[type];
        if (want && lower !== want) {
          console.error(`::error file=${name}::${type} day uses ${color}, but the reserved ${type} colour is ${want}`);
          problems++;
        }
        return m;
      }

      // training day
      if (TRAINING.includes(lower)) return m;

      const folded = FOLD[lower];
      const reserved = Object.entries(RECOVERY).find(([, v]) => v === lower);
      if (!folded) {
        console.error(`::error file=${name}::training day uses ${color}, which is not in the governed palette and has no mapping. Add it to TRAINING or FOLD in tools/check-day-colors.js.`);
        problems++;
        return m;
      }
      if (fix) {
        changed = true;
        rewritten++;
        return head + folded + tail;
      }
      const why = reserved
        ? ` — and ${color} is RESERVED for ${reserved[0]} days`
        : '';
      console.error(`::error file=${name}::training day uses ungoverned colour ${color}${why}; run node tools/check-day-colors.js --fix (maps to ${folded})`);
      problems++;
      return m;
    });

    if (changed) {
      fs.writeFileSync(file, out);
      filesTouched++;
    }
  }

  if (fix) {
    console.log(`Day colours normalised — ${rewritten} card(s) recoloured across ${filesTouched} page(s); ${checked} day cards checked.`);
    return problems ? 1 : 0;
  }
  if (problems) {
    console.error(`\n${problems} day card(s) outside the governed palette.`);
    return 1;
  }
  console.log(`Day colours OK — ${checked} day cards checked against ${TRAINING.length} training anchors + 3 reserved recovery colours.`);
  return 0;
}

process.exit(main());
