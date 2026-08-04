#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-one-timer.js — no second rest-timer implementation (audit G5.0,
   renamed + extended for the Volume I CI-integrity finding)
   --------------------------------------------------------------------------
   Formerly check-dead-timer.js. That gate banned one specific dead subsystem
   (a `_T` controller, `_rp()`, `_restFor()`, `_initTF()`, `<div id="_tf">`)
   that briefly existed on 27 pages and never actually ran. It did NOT catch
   the separate, LIVE bug found in the same audit: seven pages
   (bro-split, iron-engine, legs-s3-pump, pmc-workout, s4-legs, cat-pmc,
   cat-strength) carried a full page-local `const TMR = {...}` — a real,
   working second implementation, not a dead one — because they never loaded
   mc-timer.js at all. Migrating those seven onto the shared engine (see
   CLAUDE.md's One rest timer rule) closed the immediate bug, but nothing
   stopped a future page from reintroducing the exact same pattern. This gate
   now checks three things, all pages, every run:

   1. LEGACY — the original dead-subsystem identifiers (still banned; the
      failure mode was silent, so there's no cost to leaving the check in).
   2. DUPLICATE DECLARATION — a page that loads mc-timer.js (which declares
      `const TMR` at file scope) must not ALSO declare its own top-level
      `const/var TMR`. Classic <script> tags share one global lexical
      environment (mc-timer.js's own header comment), so two top-level
      `const TMR` declarations across two <script> tags in the same document
      throw a SyntaxError the instant the second one parses — this is
      exactly the crash `s4-legs.html`'s local `const _progObs` collided on
      during the Volume I migration, just for the TMR identifier itself.
   3. ORPHAN CHIP — a page whose own makeRestTimer()/makeRT()/restTimer()
      clone emits the `.rest-timer` button markup (every variant embeds the
      literal class string `rest-timer idle` in its own inline script — the
      one signature every rest-timer chip fleet-wide shares) must load
      mc-timer.js. Volume II Phase 6 ("Operable by Everyone") moved click
      handling off a per-chip `onclick="...TMR.toggle(...)"` attribute onto
      ONE delegated `document.addEventListener('click', ...)` registered
      inside mc-timer.js itself — so a local `const/var TMR` no longer saves
      a page the way it used to (that escape hatch is gone: before, the
      onclick called `TMR.toggle()` against whatever TMR was in lexical
      scope, local or shared; now the listener that reaches `TMR.toggle()`
      at all only exists if mc-timer.js's own script ran). Skipping
      mc-timer.js now means every rest-timer button on the page is inert —
      no error, no console warning, just a tap that silently does nothing,
      which is a worse failure mode than the old "TMR is not defined" crash
      this check used to catch.

   Note what this deliberately does NOT flag: the-500.html declares its own
   local `const TMR` for an unrelated jump-rope/pushup-ladder buzzer
   (`TMR.buzz()`) — a different API, no `.rest-timer` chip markup anywhere
   on the page, so it never matches ORPHAN CHIP and is left alone.

     node tools/check-one-timer.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Legacy dead-subsystem identifiers (audit G5.0). `_T` is matched as a
// declaration only — a bare `_T` would collide with ordinary minified locals.
const LEGACY_BANNED = [
  { re: /^[ \t]*function\s+_rp\s*\(/m, what: '_rp() — emits a .rest-pill for the orphan timer' },
  { re: /^[ \t]*function\s+_restFor\s*\(/m, what: '_restFor() — duration table for the orphan timer' },
  { re: /^[ \t]*function\s+_initTF\s*\(/m, what: '_initTF() — builds the orphan #_tf float' },
  { re: /^[ \t]*const\s+_T\s*=/m, what: 'const _T — the orphan timer controller' },
  { re: /<div[^>]+id="_tf"/, what: '<div id="_tf"> — host for the orphan float' },
  { re: /\brest-pill\b/, what: '.rest-pill — markup/CSS for the orphan timer' },
];

const HAS_MC_TIMER = /<script\s+src="mc-timer\.js"><\/script>/;
const LOCAL_TMR_DECL = /^[ \t]*(?:const|var)\s+TMR\s*=/m;
const ORPHAN_CHIP = /rest-timer idle/;

const pages = fs.readdirSync(ROOT)
  .filter(f => f.endsWith('.html') && !f.endsWith('.dc.html'))
  .sort();

let bad = 0;
for (const p of pages) {
  const src = fs.readFileSync(path.join(ROOT, p), 'utf8');

  for (const b of LEGACY_BANNED) {
    if (b.re.test(src)) {
      bad++;
      console.error(`::error file=${p}::second rest-timer implementation — ${b.what}. ` +
        `Use makeRestTimer() + TMR from mc-timer.js; see tools/check-one-timer.js.`);
    }
  }

  const hasSharedTimer = HAS_MC_TIMER.test(src);
  const hasLocalTmr = LOCAL_TMR_DECL.test(src);

  if (hasSharedTimer && hasLocalTmr) {
    bad++;
    console.error(`::error file=${p}::loads mc-timer.js AND declares a local ` +
      `"const/var TMR" — two top-level TMR declarations in one document throw ` +
      `a SyntaxError the moment the second one parses. Delete the local copy; ` +
      `see tools/check-one-timer.js.`);
  }

  if (ORPHAN_CHIP.test(src) && !hasSharedTimer) {
    bad++;
    console.error(`::error file=${p}::renders a .rest-timer chip (local makeRT()/` +
      `restTimer() clone) but does not load mc-timer.js — the delegated click ` +
      `listener that makes any .rest-timer button interactive lives only inside ` +
      `mc-timer.js, so every tap on this page silently does nothing. A local TMR ` +
      `declaration does not substitute; add <script src="mc-timer.js"></script>; ` +
      `see tools/check-one-timer.js.`);
  }
}

if (bad) {
  console.error(`\n${bad} rest-timer problem(s). The app has exactly one rest timer ` +
    `(TMR in mc-timer.js); a second one — dead, duplicated, or missing — does not ` +
    `announce itself from source.`);
  process.exit(1);
}
console.log(`Rest-timer check OK — ${pages.length} pages, one implementation (TMR/mc-timer.js), no orphan declarations or toggles.`);
