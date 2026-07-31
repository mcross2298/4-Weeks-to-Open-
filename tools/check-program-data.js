#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-program-data.js — program-data conventions, fleet-wide (audit G-07/G-10)
   --------------------------------------------------------------------------
   validate-programs.js checks the intensifier blueprint, but only on the three
   Modality Matrix pages — 3 of roughly 46 pages that carry program data. Two
   whole classes of drift lived outside its reach:

   G-10 — exercise coaching text was `note` on 22 pages and `notes` on 8, split
   cleanly along engine lineage, so every reader matched its own writer and
   nothing looked broken. It was still a trap: the two dialects blocked engine
   consolidation, and push-pull-legs.html had already fallen into it — five
   authored tempo/TUT notes that never rendered, because its data said `note`
   while its renderer read `ex.notes`.

   G-07 — CLAUDE.md attaches a specific 7-card day spec to the schedule label
   `5-on 2-off` (Days 1-4 training, Day 5 Conditioning, Day 6 Active Rest,
   Day 7 Rest). kitchen-sink-s4.html claimed that label while running five
   training days with no Conditioning Day and closing rest -> active-rest.
   A label that carries a spec has to be checked against it, or it is decoration.

   Run: node tools/check-program-data.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DAY_TYPES = ['training', 'conditioning', 'activerest', 'rest'];

// The governed label and the day sequence CLAUDE.md binds to it. A page is only
// held to this if it claims the label — other cadences (3-on 2-off,
// 4-on 1-off 2-on, and the free-form "5 Training · 2 Recovery") are legitimate
// and describe genuinely different weeks.
const GOVERNED_LABEL = '5-on 2-off';
const GOVERNED_SEQUENCE =
  ['training', 'training', 'training', 'training', 'conditioning', 'activerest', 'rest'];

const DAY_RE = /\{type:"(\w+)",label:"([^"]*)",session:"([^"]*)"/g;

function pages() {
  return fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && !f.endsWith('.dc.html') && f !== 'stndr-card-concepts.html')
    .sort();
}

// Objects that carry `sets:` are exercises; anything else using these names is
// a week/phase note, which legitimately stays `note` on a different object.
function exerciseObjects(src) {
  const out = [];
  const re = /\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    if (/[,{\s]sets\s*:/.test(m[1])) out.push(m[1]);
  }
  return out;
}

let problems = 0;
// The note-field checks run on every page; the day-taxonomy checks only reach
// pages whose days use the {type,label,session} shape. Other program pages
// carry different structures and are covered by validate-programs.js.
let scanned = 0, pagesWithDays = 0, exObjs = 0, dayCards = 0;

for (const name of pages()) {
  const src = fs.readFileSync(path.join(ROOT, name), 'utf8');
  scanned++;

  // ── G-10: one name for exercise coaching text, and readers that match ──────
  const exs = exerciseObjects(src);
  exObjs += exs.length;
  const plural = exs.filter(o => /[,{\s]notes\s*:/.test(o)).length;
  if (plural) {
    console.error(`::error file=${name}::${plural} exercise object(s) use \`notes:\`; the fleet-wide field is \`note:\``);
    problems++;
  }
  if (/\bex\.notes\b/.test(src)) {
    console.error(`::error file=${name}::renderer reads \`ex.notes\`, but exercise data uses \`note\` — coaching notes would silently not render`);
    problems++;
  }

  // ── G-07: day-type vocabulary + the governed schedule label ────────────────
  const days = [];
  let d;
  DAY_RE.lastIndex = 0;
  while ((d = DAY_RE.exec(src))) days.push({ type: d[1], label: d[2] });
  if (!days.length) continue;
  pagesWithDays++;
  dayCards += days.length;

  for (const day of days) {
    if (!DAY_TYPES.includes(day.type)) {
      console.error(`::error file=${name}::day "${day.label}" has unknown type "${day.type}"; expected one of ${DAY_TYPES.join(', ')}`);
      problems++;
    }
  }

  const sched = /sched:'([^']*)'/.exec(src);
  if (!sched || !sched[1].includes(GOVERNED_LABEL)) continue;

  // The page claims the governed label — hold it to the spec. Compare one
  // block's worth of days, since multi-week pages repeat the same shape.
  const cycle = days.slice(0, GOVERNED_SEQUENCE.length).map(x => x.type);
  if (cycle.join(',') !== GOVERNED_SEQUENCE.join(',')) {
    console.error(
      `::error file=${name}::claims schedule "${GOVERNED_LABEL}", whose spec is ` +
      `[${GOVERNED_SEQUENCE.join(' · ')}], but its week runs [${cycle.join(' · ')}]. ` +
      `Either implement the spec or use a schedule label that does not claim it.`);
    problems++;
  }
}

if (problems) {
  console.error(`\n${problems} program-data convention problem(s).`);
  process.exit(1);
}
console.log(`Program data OK — note field checked on ${scanned} pages (${exObjs} exercise objects); ` +
  `day taxonomy + schedule claims checked on ${dayCards} day cards across ${pagesWithDays} pages.`);
