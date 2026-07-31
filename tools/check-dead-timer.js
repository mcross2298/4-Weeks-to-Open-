#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-dead-timer.js — no second rest-timer implementation (audit G5.0)
   --------------------------------------------------------------------------
   Twenty-seven pages carried a complete second rest-timer alongside the real
   one: a `_T` controller object, `_rp()` to emit a `.rest-pill`, `_restFor()`
   to pick a duration, `_initTF()` to build a `#_tf` float, and a static
   `<div id="_tf">` host.

   None of it ran. `_rp()` was declared and never called, so the onclick string
   that reaches `_initTF`/`_T` was never emitted, and `_initTF` early-returns on
   the static host that already exists. Measured in a browser before removing
   it: `.rest-pill` rendered 0 times on every one of those pages, while
   `.rest-timer` — the live path, `makeRestTimer()` -> `TMR` from mc-timer.js —
   rendered 8 to 39 times each. Deleting all of it changed the rendered DOM on
   zero pages (tools/dom-parity.js, 27 pages, byte-identical snapshots).

   The live timer is `mc-timer.js`: `TMR` plus the `#timerFloat` element built
   by `buildTimerFloat()`. That is the only rest timer this app should have.
   This gate fails if any page grows a second one again — the failure mode is
   silent, since a dead timer looks exactly like a working one in source.

     node tools/check-dead-timer.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Identifiers unique to the removed subsystem. `_T` is matched as a
// declaration only — a bare `_T` would collide with ordinary minified locals.
const BANNED = [
  { re: /^[ \t]*function\s+_rp\s*\(/m, what: '_rp() — emits a .rest-pill for the orphan timer' },
  { re: /^[ \t]*function\s+_restFor\s*\(/m, what: '_restFor() — duration table for the orphan timer' },
  { re: /^[ \t]*function\s+_initTF\s*\(/m, what: '_initTF() — builds the orphan #_tf float' },
  { re: /^[ \t]*const\s+_T\s*=/m, what: 'const _T — the orphan timer controller' },
  { re: /<div[^>]+id="_tf"/, what: '<div id="_tf"> — host for the orphan float' },
  { re: /\brest-pill\b/, what: '.rest-pill — markup/CSS for the orphan timer' },
];

const pages = fs.readdirSync(ROOT)
  .filter(f => f.endsWith('.html') && !f.endsWith('.dc.html'))
  .sort();

let bad = 0;
for (const p of pages) {
  const src = fs.readFileSync(path.join(ROOT, p), 'utf8');
  for (const b of BANNED) {
    if (b.re.test(src)) {
      bad++;
      console.error(`::error file=${p}::second rest-timer implementation — ${b.what}. ` +
        `Use makeRestTimer() + TMR from mc-timer.js; see tools/check-dead-timer.js.`);
    }
  }
}

if (bad) {
  console.error(`\n${bad} orphan rest-timer reference(s). The app has exactly one rest timer ` +
    `(TMR in mc-timer.js); a second one does not run and cannot be noticed from source.`);
  process.exit(1);
}
console.log(`Rest-timer check OK — ${pages.length} pages, one implementation (TMR/mc-timer.js).`);
