#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-exercise-identity.js — a history key names the EXERCISE, never its
   POSITION (engine-repair roadmap Phase 2.1; audit EN-1, EN-8).

   WHY THIS NEEDS A BROWSER
   ------------------------
   The identity is derived from the rendered card — its name element, its
   data-mc-orig-name, its position among same-named siblings. There is nothing
   to unit-test in a sandbox; the defect only exists once a page has rendered.

   WHAT WAS WRONG
   --------------
   Measured across 12 pages and 456 cards before the fix: 170 of them (37%)
   carried a POSITIONAL data-id — "1-s-3", "ssex-0-2", "0-b-4", "grp-6-0-0" —
   and mc-setlog.js keyed history on it. On a page that serves several workouts
   from one document that is catastrophic. pmc-workout.html renders all 30 PMC
   workouts, so across just 8 of them:

       31 of 32 distinct history keys were shared by DIFFERENT exercises
       the worst single key carried EIGHT of them

   A squat's logged weight sat in the same bucket as a lat pulldown's, and the
   progression engine averaged them into a suggestion.

   WHAT THE FIX IS
   ---------------
   exIdOf() is nameId() for every card: the authored exercise name, slugged,
   with an occurrence index for genuine duplicates, read through
   data-mc-orig-name so a rename does not orphan history. The 286 cards that
   carry no data-id at all have ALWAYS been keyed this way, so this is a
   convergence onto the fleet's own dominant scheme.

   Usage: node tools/test-mc-exercise-identity.js <baseUrl>
          MC_CHROMIUM=/path/to/chromium node tools/... (same override as
          test-mc-setlog-concurrency.js and check-contrast.js)
   ========================================================================== */
const { chromium } = require('playwright');

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('::error::usage: node tools/test-mc-exercise-identity.js <baseUrl>');
  process.exit(1);
}
const NET = /ERR_TUNNEL|ERR_ABORTED|ERR_NAME|Failed to load resource|supabase|fonts\.googleapis|accounts\.google/i;
// A key that ends in a bare position index is the shape this gate exists to
// forbid: "…|1-s-3", "…|ssex-0-2", "…|0-b-4", "…|grp-6-0-0".
const POSITIONAL = /\|(?:\d+-s-\d+|\d+-ss-\d+[ab]?|ssex-(?:\d+-)+\d+|grp-(?:\d+-)+\d+|\d+-b-\d+)$/;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}

// Two spellings of one lift truncating to the same 24-char slug SHOULD share a
// history bucket — that is the scheme working, not a collision.
function sameLift(names) {
  const n = names.map(function (s) { return s.replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/gi, '').toLowerCase(); });
  return n.every(function (x) { return x.indexOf(n[0]) === 0 || n[0].indexOf(x) === 0; });
}

(async () => {
  const b = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  const errs = [];

  async function cardsOn(page, url, prep) {
    await page.goto(baseUrl + '/' + url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1100);
    if (prep) await prep(page);
    const row = await page.$('.mc-day-row');
    if (row) { try { await row.click({ timeout: 3000 }); } catch (e) {} await page.waitForTimeout(800); }
    return page.evaluate(() => {
      const U = window.MCSetlogUtil;
      if (!U || !U.exIdOf) return null;
      return Array.from(document.querySelectorAll('.ex-card,.ss-ex,.ex-item,.lift-card')).map(c => {
        const nm = c.querySelector('.ex-name,.ss-name,.lift-name,.var-name');
        if (!nm) return null;
        return { name: (c.getAttribute('data-mc-orig-name') || nm.textContent).trim(),
                 key: U.histKey(U.exIdOf(c)) };
      }).filter(Boolean);
    });
  }

  /* ---- EN-1: the multi-workout page, which is where it was worst --------- */
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => { if (!NET.test(e.message)) errs.push(e.message); });
  p.on('console', m => { if (m.type() === 'error' && !NET.test(m.text())) errs.push(m.text()); });

  const byKey = new Map();
  const IDS = ['split1_legs', 'split1_back', 'split1_chest', 'split2_legs',
               'split3_back', 'split4_shoulders', 'split5_push', 'split6_chest'];
  let seen = 0;
  for (const id of IDS) {
    for (const wk of [1, 3]) {
      const rows = await cardsOn(p, 'pmc-workout.html#' + id, async (pg) => {
        await pg.evaluate(w => { if (typeof activeWeek !== 'undefined') { activeWeek = w; render(); } }, wk);
        await pg.waitForTimeout(350);
      });
      if (!rows) continue;
      for (const r of rows) {
        seen++;
        if (!byKey.has(r.key)) byKey.set(r.key, new Set());
        byKey.get(r.key).add(r.name.toLowerCase());
      }
    }
  }
  ok('the PMC sweep actually rendered cards', seen > 100, seen + ' cards');

  const collisions = [...byKey].filter(([, s]) => s.size > 1 && !sameLift([...s]));
  ok('EN-1 no history key is shared by different exercises', collisions.length === 0,
     collisions.length + ' collide, worst carries ' +
     Math.max(0, ...collisions.map(([, s]) => s.size)) + ': ' +
     collisions.slice(0, 3).map(([k, s]) => k + ' = ' + [...s].join(' | ')).join('  ;  '));

  const positional = [...byKey.keys()].filter(k => POSITIONAL.test(k));
  ok('EN-8 no history key is a bare position index', positional.length === 0,
     positional.length + ': ' + positional.slice(0, 5).join(', '));

  /* ---- and one page per remaining engine family -------------------------- */
  for (const pg of ['hv-block.html', 'mm-p1.html', 'kitchen-sink.html', 'iron-engine.html', 'bro-split.html']) {
    const rows = await cardsOn(p, pg);
    ok(pg + ' renders cards with resolvable ids', !!(rows && rows.length), rows ? '0 cards' : 'no MCSetlogUtil');
    if (!rows) continue;
    const bad = rows.filter(r => POSITIONAL.test(r.key));
    ok(pg + ': no positional history key', bad.length === 0,
       bad.length + ': ' + bad.slice(0, 3).map(r => r.key).join(', '));
    const named = rows.filter(r => /\|x-/.test(r.key));
    ok(pg + ': keys are derived from the exercise name', named.length === rows.length,
       named.length + ' of ' + rows.length + ': ' +
       rows.filter(r => !/\|x-/.test(r.key)).slice(0, 3).map(r => r.key).join(', '));
    // A key must not carry rendered CHROME. stndr-checkoff.js inserts a ✓ chip
    // inside .ex-name on some pages, and origNameOf() used to slug it straight
    // into the history key.
    const ticked = rows.filter(r => /[✓✔]/.test(r.key));
    ok(pg + ': no history key carries a completion tick', ticked.length === 0,
       ticked.slice(0, 3).map(r => r.key).join(', '));
  }

  /* ---- the round trip: a logged set must come back under the new key ----- */
  const rt = await (async () => {
    await p.goto(baseUrl + '/pmc-workout.html#split1_legs', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      const c = document.querySelector('.ex-card,.ss-ex,.ex-item');
      const U = window.MCSetlogUtil;
      if (c && U && U.activateCard) U.activateCard(c);
    });
    await p.waitForTimeout(800);
    const wrote = await p.evaluate(() => {
      const c = document.querySelector('.ex-card,.ss-ex,.ex-item');
      const w = c && c.querySelector('.mcl-w'), ck = c && c.querySelector('.mcl-ck');
      if (!w || !ck) return null;
      w.value = '135'; w.dispatchEvent(new Event('input', { bubbles: true }));
      ck.click();
      return true;
    });
    if (!wrote) return null;
    await p.waitForTimeout(900);
    await p.goto(baseUrl + '/pmc-workout.html#split1_legs', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      const c = document.querySelector('.ex-card,.ss-ex,.ex-item');
      const U = window.MCSetlogUtil;
      if (c && U && U.activateCard) U.activateCard(c);
    });
    await p.waitForTimeout(900);
    return p.evaluate(() => {
      const c = document.querySelector('.ex-card,.ss-ex,.ex-item');
      return { count: (c.querySelector('.mcl-count') || {}).textContent || '',
               weight: (c.querySelector('.mcl-w') || {}).value || '',
               keys: Object.keys(JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}')) };
    });
  })();
  ok('a logged set survives a reload under the new key', !!(rt && /^1\//.test(rt.count)),
     rt ? 'count="' + rt.count + '"' : 'could not log a set');
  ok('and its typed weight is restored', !!(rt && rt.weight === '135'), rt ? '"' + rt.weight + '"' : '');
  ok('the store key it landed in is name-derived', !!(rt && rt.keys.every(k => /\|x-[a-z0-9]/.test(k))),
     rt ? rt.keys.join(', ') : '');

  ok('no app-level console errors across the sweep', errs.length === 0, errs.slice(0, 3).join(' ~ '));
  await b.close();

  console.log('test-mc-exercise-identity: ' + pass + ' passed, ' + fail + ' failed  (' +
              seen + ' PMC cards, ' + byKey.size + ' distinct keys)');
  if (fail) {
    console.error('\nFix: mc-setlog.js is keying history on something other than the exercise name.');
    process.exit(1);
  }
})();
