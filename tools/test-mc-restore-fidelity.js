#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-restore-fidelity.js — a restored set must show what was PERFORMED
   --------------------------------------------------------------------------
   The defect this locks down (GO LIVE clean-room run, DEF-CR-01).

   Two restore paths existed and had drifted:

     mc-setlog.js  paintRestored()   cloud rehydrate — value + ghost-clear + aria
     mc-session.js restoreSets()     local reload    — tick class and text ONLY

   The local path is the one every athlete takes: a pull-to-refresh, a dropped
   tab, and the service worker's own forced reload on a deploy all go through
   it. Because it never repainted the inputs, a restored row kept whatever
   build() had put there — the PRESCRIPTION, styled .mcl-ghost. Logging
   205 lb x 9 and reloading redisplayed the set as 205 x 5.

   mc_setlog_v1 was correct throughout; only the screen lied. But the ghost is
   a live input, so unchecking and re-checking that row ran onCheck() over it
   and committed the prescription — 9 became 5 for real, and flowed on into
   tonnage, session kcal, PR detection and banked history.

   Why a browser test and not a unit test: the bug lives in the gap between two
   modules and a rendered input's ghost state. Nothing short of logging a set,
   reloading, and reading the input back can see it — which is exactly why it
   survived every gate in verify.yml.

   Usage: node tools/test-mc-restore-fidelity.js <baseUrl>
   ========================================================================== */
const path = require('path');
module.paths.push('/opt/node22/lib/node_modules');
const { chromium } = require('playwright');

const BASE = process.argv[2] || process.env.MC_BASE || 'http://localhost:8080';

/* One page per rendering engine family. The bug was engine-independent (it is
   in the shared session/setlog pair), but so was the assumption that broke it,
   so each family is asserted rather than one sampled. */
const PAGES = [
  { url: 'mm-p1.html',        engine: 'mm-engine (.ex-card, day list)' },
  { url: '2on-1off.html',     engine: 'mc-freq-engine (.ex-item)' },
  { url: 'kitchen-sink.html', engine: 'ks-engine' },
  { url: 'iron-engine.html',  engine: 'hand-written toggle' },
];

const WEIGHT = 205, REPS = 9;   // deliberately NOT any program's prescription
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0; const failures = [];
const ok  = (m) => { pass++; };
const bad = (m) => { fail++; failures.push(m); };

async function openDay(page) {
  const n = await page.locator('.mc-day-row').count();
  if (n) { await page.locator('.mc-day-row').first().click(); await sleep(700); }
  return n;
}
async function openLogger(page) {
  if (await page.locator('.mcl-row').count()) return;          // already open (S3)
  const s = page.locator('.mcl-strip:visible');
  if (await s.count()) { await s.first().click({ timeout: 4000 }).catch(() => {}); await sleep(500); }
}
const rowState = page => page.evaluate(() => [...document.querySelectorAll('.mcl-row')].slice(0, 3).map(r => {
  const w = r.querySelector('.mcl-w'), rp = r.querySelector('.mcl-r:not(.mcl-rmini)'), ck = r.querySelector('.mcl-ck');
  return { w: w && w.value, r: rp && rp.value,
           wGhost: !!(w && w.dataset.ghost), rGhost: !!(rp && rp.dataset.ghost),
           done: !!(ck && ck.classList.contains('done')), aria: ck && ck.getAttribute('aria-checked') };
}));
const storeSets = page => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
  const k = Object.keys(s)[0];
  return k && s[k] && s[k][0] ? s[k][0].sets : null;
});

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const P of PAGES) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await c.newPage();
    const tag = `${P.url} [${P.engine}]`;
    try {
      await page.goto(`${BASE}/${P.url}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(800);
      await openDay(page); await openLogger(page);
      const rows = await page.locator('.mcl-row').count();
      if (!rows) { bad(`${tag}: no working-set row rendered — cannot assert restore`); await c.close(); continue; }

      for (let i = 0; i < Math.min(3, rows); i++) {
        const row = page.locator('.mcl-row').nth(i);
        await row.locator('.mcl-w').fill(String(WEIGHT));
        const rp = row.locator('.mcl-r:not(.mcl-rmini)');
        if (await rp.count()) await rp.fill(String(REPS));
        await row.locator('.mcl-ck').scrollIntoViewIfNeeded().catch(() => {});
        await row.locator('.mcl-ck').click({ timeout: 5000 });
        await sleep(200);
      }
      await sleep(500);
      const beforeStore = await storeSets(page);

      await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1500);
      await openDay(page); await sleep(1300);
      const st = await rowState(page);

      st.forEach((r, i) => {
        if (String(r.w) !== String(WEIGHT))
          bad(`${tag} set ${i + 1}: restored WEIGHT reads ${r.w}, performed ${WEIGHT}`);
        else ok();
        if (String(r.r) !== String(REPS))
          bad(`${tag} set ${i + 1}: restored REPS reads ${r.r}, performed ${REPS} — the prescription is being shown instead of the work`);
        else ok();
        if (r.wGhost || r.rGhost)
          bad(`${tag} set ${i + 1}: a LOGGED set is still styled .mcl-ghost (suggested) — w=${r.wGhost} r=${r.rGhost}`);
        else ok();
        if (!r.done) bad(`${tag} set ${i + 1}: restored set lost its tick`); else ok();
        if (r.aria !== 'true')
          bad(`${tag} set ${i + 1}: aria-checked="${r.aria}" on a completed set — a screen reader announces it as not done`);
        else ok();
      });

      /* The corruption path: the ghost is a live input, so a post-reload edit
         used to commit the prescription over the performed reps. */
      const ck = page.locator('.mcl-row').first().locator('.mcl-ck');
      await ck.click(); await sleep(500);      // uncheck
      await ck.click(); await sleep(600);      // re-check
      const afterStore = await storeSets(page);
      const s1 = afterStore && afterStore['1'];
      if (!s1 || String(s1.r) !== String(REPS))
        bad(`${tag}: uncheck+re-check after reload rewrote set 1 reps to ${s1 && s1.r} (performed ${REPS})`);
      else ok();
      if (!s1 || String(s1.w) !== String(WEIGHT))
        bad(`${tag}: uncheck+re-check after reload rewrote set 1 weight to ${s1 && s1.w} (performed ${WEIGHT})`);
      else ok();
      if (JSON.stringify(beforeStore) !== JSON.stringify(afterStore))
        bad(`${tag}: mc_setlog_v1 changed across reload+edit\n      before ${JSON.stringify(beforeStore)}\n      after  ${JSON.stringify(afterStore)}`);
      else ok();
    } catch (e) {
      bad(`${tag}: ${String(e.message).split('\n')[0]}`);
    }
    await c.close();
  }
  await b.close();

  console.log(`restore fidelity — ${pass + fail} assertions across ${PAGES.length} engine families`);
  console.log(`  PASS ${pass}   FAIL ${fail}`);
  if (fail) {
    console.log('');
    failures.forEach(f => console.log('  ::error::' + f));
    process.exit(1);
  }
})();
