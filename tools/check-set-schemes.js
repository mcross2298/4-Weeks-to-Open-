#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-set-schemes.js — every authored rep prescription in the tree must
   produce a logger whose row count and rep targets come from the prescription
   itself (workout-ui-state-audit W0).

   WHY THIS EXISTS
   ---------------
   `mc-setlog.js` derives the number of logging rows, the "0/N Sets" strip
   badge and (via mc-finish.js's plannedSetCount) the whole workout's set total
   from ONE parse of the program's authored `sets:` string. Get that parse
   wrong and the athlete is shown a workout that was never prescribed.

   It was wrong. "25/20/20/15/12" — a five-step pyramid on High Volume
   Training — rendered EIGHT rows, every one of them asking for 25 reps,
   because '/' had no rule and the string fell through to a leading-number
   branch that read "25 sets" and clamped it to 8. 69 authored schemes hit
   that path. A second family, "12, 12, 10 / 10, 10, 8" (a superset written on
   one card as legA / legB), comma-split the WHOLE string into 5 rows for a
   3-round prescription, and handed row 3 a target of "101" — the digits of
   "10 / 10" run together.

   PM-mode inline editing (mc-pm-inline.js) lets the owner retype a sets field
   live, so a fixed parser alone does not keep this closed. Hence a gate.

   WHAT IT ASSERTS — and what it deliberately does NOT
   ---------------------------------------------------
   The four checks below are INVARIANTS over the prescription, not a second
   copy of the parser. A gate that re-implements setCount() and compares the
   two would pass for any pair of matching-but-wrong implementations; these
   hold whatever the parser does internally, so a future rewrite is still
   covered.

     A  CEILING     a scheme can never render more rows than it prescribes
                    sets. The allowance is the N× multiplier when one is
                    present, otherwise the count of rep tokens in the string.
                    This is the check that catches "5 numbers -> 8 rows".
     B  PROVENANCE  every row's rep target must be a number that literally
                    appears in the prescription. Catches the "101" target
                    invented out of two adjacent legs.
     C  LEGS        "A-scheme / B-scheme" is ONE card running two stations
                    through the same rounds, so its row count is one leg's,
                    never the sum of both.
     D  PYRAMID     a comma-free, x-free slash string is one set per slash.

   It runs the REAL parser (mc-setlog.js's Node export hook) against the REAL
   authored data, and mirrors planFor()'s drop-clause handling through the
   same exported parseDrop/stripDrop, so the gate and the logger cannot
   disagree about where the working sets end and the drop rows begin.

   Run: node tools/check-set-schemes.js  [--list]
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SL = require(path.resolve(__dirname, '../mc-setlog.js'));
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--list');

// ── collect every authored prescription, with where it came from ────────────
function collect() {
  const files = cp.execSync("git ls-files '*.html' '*.js'", { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const re = /sets\s*:\s*("([^"]*)"|'([^']*)')/g;
  const seen = new Map();
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
    let m;
    while ((m = re.exec(text))) {
      const s = m[2] !== undefined ? m[2] : m[3];
      if (!s || !s.trim()) continue;
      if (!seen.has(s)) seen.set(s, { uses: 0, files: new Set() });
      const rec = seen.get(s);
      rec.uses++;
      rec.files.add(f);
    }
  }
  return seen;
}

// ── mirror planFor(): the drop clause is appended rows, not working sets ────
// Uses the logger's OWN parseDrop/stripDrop so the two can never disagree.
function working(scheme) {
  const drop = SL.parseDrop('', scheme);
  return {
    work: drop.is ? SL.stripDrop(scheme) : scheme,
    dropRows: drop.is ? drop.drops.length : 0
  };
}

// Rep tokens: numbers, plus the open-ended targets that stand in for one.
function repTokens(s) {
  return (String(s).match(/\d+|amrap|∞|failure/gi) || []);
}
// A multiplier settles the set count on its own ("4x10 / 12 per side" is four
// sets, whatever the slash means) — leading form, or the trailing "AMRAP x 3".
function multiplierOf(s) {
  let m = String(s).match(/^\s*(\d+)\s*[x×]/i);
  if (m) return Math.min(parseInt(m[1], 10), 12);
  m = String(s).match(/[x×]\s*(\d+)\s*$/i);
  if (m) return Math.min(parseInt(m[1], 10), 12);
  return null;
}
// A leading number is a SET count only when the prose says so ("4 sets",
// "3 sets to failure", "3-5 sets"). The same shape with a rep or duration
// unit after it — "100-200 reps", "30 sec each side", "21s" — is a REP
// prescription that names no set count at all, and reading it as one is the
// leading-number half of the same defect the slash families have.
const SET_DECL = /^\s*(\d+)\s*(?:[–\-—]\s*\d+\s*)?\+?\s*sets?\b/i;
function declaredSets(s) {
  const m = String(s).match(SET_DECL);
  return m ? Math.min(parseInt(m[1], 10), 12) : null;
}
// With no multiplier and no declared set count, a prescription can still
// legitimately fall back to the logger's documented no-information default of
// three rows ("AMRAP"), so the allowance is never tighter than that.
const NO_INFO_ROWS = 3;
function slashSegs(s) {
  return String(s).split('/').map(p => p.trim()).filter(Boolean);
}
function commaParts(seg) {
  return String(seg).split(',').map(p => p.trim()).filter(Boolean);
}
// "G1: … / G2: … / G3: …" puts a whole ROUND in each slash segment, so the
// segment count is the round count however many lifts each round names.
function roundLabelled(segs) {
  return segs.length > 1 && segs.every(p => /^(?:G|R|Round)\s*\d+\s*[:.]/i.test(p));
}

const failures = [];
function fail(check, scheme, rec, detail) {
  failures.push({ check, scheme, uses: rec.uses, files: [...rec.files], detail });
}

const schemes = collect();
let checkedA = 0, checkedB = 0, checkedC = 0, checkedD = 0;

for (const [scheme, rec] of schemes) {
  const { work, dropRows } = working(scheme);
  let rows;
  try {
    rows = SL.setCount(work) + dropRows;
  } catch (e) {
    fail('PARSE', scheme, rec, 'setCount() threw: ' + e.message);
    continue;
  }
  const workRows = rows - dropRows;

  // ── A. ceiling ────────────────────────────────────────────────────────────
  const mult = multiplierOf(work);
  const decl = mult == null ? declaredSets(work) : null;
  let allowance, why;
  if (mult != null) { allowance = mult; why = `a ${mult}x multiplier`; }
  else if (decl != null) { allowance = decl; why = `a declared ${decl} sets`; }
  else {
    allowance = Math.max(repTokens(work).length, NO_INFO_ROWS);
    why = `${repTokens(work).length} rep tokens`;
  }
  if (allowance > 0) {
    checkedA++;
    if (workRows > allowance) {
      fail('A ceiling', scheme, rec,
        `renders ${workRows} working rows from a prescription carrying ${why}`);
    }
  }

  // ── B. provenance ─────────────────────────────────────────────────────────
  const allowed = new Set(repTokens(scheme).map(t => String(t)));
  checkedB++;
  for (let i = 0; i < workRows; i++) {
    let target;
    try { target = SL.repFor(work, i); } catch (e) { target = null; }
    if (target == null || target === '') continue;
    if (!allowed.has(String(target))) {
      fail('B provenance', scheme, rec,
        `row ${i + 1} targets "${target}", which does not appear in the prescription`);
      break;
    }
  }

  // ── C. legs ───────────────────────────────────────────────────────────────
  const segs = slashSegs(work);
  if (segs.length > 1 && !roundLabelled(segs) && multiplierOf(work) == null) {
    const parts = segs.map(commaParts);
    const everyIsList = parts.every(p => p.length > 1);
    if (everyIsList && segs.length <= 3) {
      checkedC++;
      const want = Math.max(...parts.map(p => p.length));
      if (workRows !== want) {
        fail('C legs', scheme, rec,
          `${segs.length} legs of ${parts.map(p => p.length).join('/')} sets should render ` +
          `${want} rows (one leg's), rendered ${workRows}`);
      }
    }
    // ── D. pyramid ──────────────────────────────────────────────────────────
    const noCommas = parts.every(p => p.length === 1);
    if (noCommas && !/[x×]/i.test(work)) {
      checkedD++;
      if (workRows !== segs.length) {
        fail('D pyramid', scheme, rec,
          `${segs.length}-step pyramid should render ${segs.length} rows, rendered ${workRows}`);
      }
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
const totalUses = [...schemes.values()].reduce((a, b) => a + b.uses, 0);
console.log(`check-set-schemes: ${schemes.size} distinct prescriptions, ${totalUses} uses`);
console.log(`  A ceiling ${checkedA}  B provenance ${checkedB}  C legs ${checkedC}  D pyramid ${checkedD}`);

if (VERBOSE) {
  for (const [scheme, rec] of [...schemes].sort((a, b) => b[1].uses - a[1].uses)) {
    const { work, dropRows } = working(scheme);
    console.log(`  ${String(SL.setCount(work) + dropRows).padStart(3)} rows  x${String(rec.uses).padEnd(4)} ${JSON.stringify(scheme)}`);
  }
}

if (!failures.length) {
  console.log('OK — every prescription renders the rows it prescribes.');
  process.exit(0);
}

const byCheck = {};
failures.forEach(f => { (byCheck[f.check] = byCheck[f.check] || []).push(f); });
const affected = failures.reduce((a, f) => a + f.uses, 0);
console.error(`\n::error::check-set-schemes: ${failures.length} prescriptions violate the row contract (${affected} uses)`);
for (const check of Object.keys(byCheck).sort()) {
  const list = byCheck[check];
  console.error(`\n  ── ${check} — ${list.length} distinct, ${list.reduce((a, f) => a + f.uses, 0)} uses`);
  list.sort((a, b) => b.uses - a.uses).slice(0, 12).forEach(f => {
    console.error(`     ${JSON.stringify(f.scheme)}  x${f.uses}`);
    console.error(`       ${f.detail}`);
    console.error(`       ${f.files.slice(0, 3).join(', ')}${f.files.length > 3 ? ` +${f.files.length - 3} more` : ''}`);
  });
  if (list.length > 12) console.error(`     … and ${list.length - 12} more`);
}
process.exit(1);
