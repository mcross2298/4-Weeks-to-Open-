#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-store-resilience.js — TEST 3 of the Phase 0 launch gates
   --------------------------------------------------------------------------
   Seeds a corrupt store BEFORE the page loads and asserts the page renders
   with no uncaught exception.

   The shape that matters is not the obvious one. Deliberately breaking four
   stores at once with malformed TEXT produced no errors anywhere — every
   `JSON.parse` in the tree is already wrapped. Every crash found across three
   passes of audit came from VALID JSON of the wrong shape: an object where an
   array belongs (`all.forEach is not a function`) or an array carrying a null
   member (`Cannot read properties of null`). Those went straight through the
   try/catch, and the stats page, the history page and the dashboard each threw
   and rendered half a screen.

   So the malformed case is kept deliberately, as a control: it must stay
   clean, or the harness is measuring something other than what it claims.

   This is the gate that would have caught the three throwing modules the
   audit found by hand.

   A sixth shape was added later, for a gap the first five didn't cover.
   `nullMember` proves a MISSING or null `sets` field is safe; it never
   tests a PRESENT, non-null field of the wrong type. `scalarSets` does —
   an entry whose `sets` is a string, not an array — which is exactly the
   shape that let mc-readiness.js's lastStimulus() keep reading `e.sets`
   directly for a fifth call site after FIX-04's sweep had already moved
   every other reader onto mc-log-read.js's readSets() (post-implementation
   verification pass, finding V-01, 2026-09-12).

   Usage:
     node tools/test-mc-store-resilience.js <baseUrl>
     MC_CHROMIUM=/path/to/chromium node tools/test-mc-store-resilience.js ...
   ========================================================================== */
const { chromium } = require('playwright');

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('usage: node tools/test-mc-store-resilience.js <baseUrl>');
  process.exit(1);
}

const WL = 'mc_workout_log_v1';
const SL = 'mc_setlog_v1';

// Six shapes, chosen from what the stores can actually hold rather than from
// what is easy to construct.
const SHAPES = {
  malformed:  { [WL]: '[[[', [SL]: '{oops' },                       // control: must stay clean
  wrongType:  { [WL]: '{}', [SL]: '[]' },                           // threw before FIX-04
  nullMember: { [WL]: '[null,{"sets":null},{"sets":[null]}]', [SL]: '{"a|b":null}' },
  scalarSets: { [WL]: '[{"date":"2026-01-01T00:00:00.000Z","sets":"chest day, 3 sets logged"}]' }, // V-01: a valid, dated entry with sets as a non-null scalar — one level past nullMember's coverage
  absurd:     { [WL]: '[{"date":"x","duration":"99999999 min","sets":[{"name":"X","weight":1e308,"reps":-5}]}]' },
  deep:       { [WL]: JSON.stringify([{ date: new Date().toISOString(), duration: '60 min',
                 sets: Array.from({ length: 500 }, () => ({ name: 'X', weight: 100, reps: 10 })) }]) }
};

// One page per surface that reads the log: the two reporting screens the audit
// saw break, the history list, and two workout engines (the session path stayed
// clean under every shape and is here to keep it that way).
const PAGES = [
  '/dashboard.html',
  '/stats.html',
  '/workout-logs.html',
  '/mm-p1.html?day=1',
  '/kitchen-sink.html?day=1'
];

(async () => {
  const browser = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  let failed = 0;
  let runs = 0;

  console.log('TEST 3 — hostile-shape resilience\n');

  try {
    for (const shapeName of Object.keys(SHAPES)) {
      const seed = SHAPES[shapeName];
      const bad = [];
      for (const page of PAGES) {
        runs++;
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await ctx.addInitScript((s) => {
          try {
            Object.keys(s).forEach((k) => localStorage.setItem(k, s[k]));
          } catch (e) {}
        }, seed);
        const pg = await ctx.newPage();
        const errors = [];
        pg.on('pageerror', (e) => errors.push(e.message));
        pg.on('console', (m) => {
          if (m.type() !== 'error') return;
          // Blocked CDN/font/Supabase requests in a sandboxed runner, the same
          // filter smoke-test-pages.js and check-journey.js already apply.
          if (/Failed to load resource/i.test(m.text())) return;
          errors.push(m.text());
        });
        try {
          await pg.goto(baseUrl + page, { waitUntil: 'networkidle', timeout: 30000 });
          // Give the modules that render off MC_SCAN a settled frame.
          await pg.waitForTimeout(900);
          // A page that threw during boot can still look "loaded", so assert
          // it actually painted something rather than only that it was quiet.
          const painted = await pg.evaluate(() => document.body && document.body.innerText.trim().length);
          if (!painted) errors.push('page rendered no text at all');
        } catch (e) {
          errors.push('navigation: ' + e.message);
        }
        if (errors.length) {
          failed++;
          bad.push(page + '  ' + errors.slice(0, 3).join(' | '));
        }
        await ctx.close();
      }
      if (bad.length) {
        console.log('  FAIL  ' + shapeName);
        bad.forEach((b) => console.log('        ' + b));
      } else {
        console.log('  ok    ' + shapeName + '  (' + PAGES.length + ' pages clean)');
      }
    }
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + (e && e.message ? e.message : e));
  } finally {
    await browser.close();
  }

  console.log('\n' + runs + ' page loads, ' + failed + ' with errors');
  console.log(failed ? 'test-mc-store-resilience: FAIL' : 'test-mc-store-resilience: pass');
  process.exit(failed ? 1 : 0);
})();
