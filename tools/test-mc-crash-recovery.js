#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-crash-recovery.js — TEST 2 of the Phase 0 launch gates
   --------------------------------------------------------------------------
   Browser storage is synchronous to the page but flushed to disk
   ASYNCHRONOUSLY by the browser, so a battery death or a force-close inside
   that window loses recent writes. That part is a platform characteristic no
   web app can defeat with browser storage alone, and this gate does not
   pretend otherwise: it never asserts that a kill loses nothing.

   What it asserts is the part that WAS a design choice. A signed-in athlete's
   sets are already inserted into the database one row per set, and until
   FIX-02 nothing in the tree ever read them back — only two functions write
   mc_setlog_v1 and neither restored from the server. So the durable copy
   existed and was unreachable.

   Three passes:

     GRACEFUL   persistent profile, four sets, clean close, relaunch. Every set
                comes back. This is the control: if it fails, the harness is
                broken and the kill pass below means nothing.
     KILL       same profile, same flow, SIGKILL to every process on it.
                Reports what survived. Not an assertion — it is the measurement
                the recovery pass exists to answer.
     REHYDRATE  an EMPTY local store plus cloud rows, and the page must come
                back with the sets restored AND the rows ticked. This is the
                real gate for FIX-02, and it is deterministic.

   The rehydrate pass stubs MC_SB.getSessionSets rather than signing in.
   That is a real limit and it is stated rather than hidden: the client half
   of FIX-02 is exercised end to end in a real browser, the Supabase round
   trip behind it is not reachable from a sandbox and stays the owner's to
   confirm on a real signed-in device (manual scenario M2).

   Usage:
     node tools/test-mc-crash-recovery.js <baseUrl>
     MC_CHROMIUM=/path/to/chromium node tools/test-mc-crash-recovery.js ...
   ========================================================================== */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('usage: node tools/test-mc-crash-recovery.js <baseUrl>');
  process.exit(1);
}

const PAGE = '/mm-p1.html?day=1';
const NEUTRAL = '/manifest.json';
const SK = 'mc_setlog_v1';
const PROFILE = '/tmp/mc-crash-profile';
const SETS = 4;
const EXE = process.env.MC_CHROMIUM || undefined;

let failed = false;
const fail = (m) => { failed = true; console.log('  FAIL  ' + m); };
const pass = (m) => console.log('  ok    ' + m);

const launch = () => chromium.launchPersistentContext(PROFILE,
  EXE ? { executablePath: EXE, viewport: { width: 390, height: 844 } }
      : { viewport: { width: 390, height: 844 } });

const waitStrips = (pg) =>
  pg.waitForFunction(() => document.querySelectorAll('.mcl-strip').length > 0,
    null, { timeout: 20000 });

async function reset(pg) {
  await pg.goto(baseUrl + NEUTRAL, { waitUntil: 'load' });
  await pg.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
  });
  await pg.goto(baseUrl + PAGE, { waitUntil: 'networkidle' });
  await waitStrips(pg);
}

async function logSets(pg, n) {
  let accepted = 0;
  for (let i = 0; i < n; i++) {
    const r = await pg.evaluate((w) => {
      const strip = document.querySelectorAll('.mcl-strip')[0];
      if (!strip) return 'NOSTRIP';
      const card = strip.closest('.ex-card, .ss-ex, .ex-item') || strip.parentElement;
      let wrap = card.querySelector('.mcl-wrap');
      if (!wrap || !wrap.classList.contains('open')) { strip.click(); wrap = card.querySelector('.mcl-wrap'); }
      const ck = wrap && wrap.querySelector('.mcl-ck:not(.done)');
      if (!ck) return 'NOROW';
      const row = ck.closest('.mcl-row');
      const wi = row && row.querySelector('.mcl-w');
      if (wi) { wi.value = String(w); wi.dispatchEvent(new Event('input', { bubbles: true })); }
      ck.click();
      return 'OK';
    }, 135 + i * 5);
    if (r === 'OK') accepted++;
  }
  await pg.waitForTimeout(2000);   // the guarded write waits on a cross-tab lock
  return accepted;
}

const countSets = (pg) => pg.evaluate((key) => {
  let s; try { s = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return -1; }
  return Object.keys(s).reduce((n, k) => {
    const sess = (s[k] || [])[0];
    return n + (sess && sess.sets ? Object.keys(sess.sets).length : 0);
  }, 0);
}, SK);

const countTicked = (pg) => pg.evaluate(() => document.querySelectorAll('.mcl-ck.done').length);

const firstExerciseName = (pg) => pg.evaluate(() => {
  const card = document.querySelector('.ex-card, .ss-ex, .ex-item');
  const nm = card && card.querySelector('.ex-name, .ss-name, .lift-name, .var-name');
  return nm ? (card.getAttribute('data-mc-orig-name') || nm.textContent).trim() : '';
});

(async () => {
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}

  console.log('TEST 2 — crash durability and cloud recovery');
  console.log('page: ' + PAGE + '\n');

  /* ---- GRACEFUL: the control -------------------------------------------- */
  let ctx = await launch();
  let pg = ctx.pages()[0] || await ctx.newPage();
  await reset(pg);
  const acceptedG = await logSets(pg, SETS);
  const beforeG = await countSets(pg);
  const exName = await firstExerciseName(pg);
  await ctx.close();

  ctx = await launch();
  pg = ctx.pages()[0] || await ctx.newPage();
  await pg.goto(baseUrl + PAGE, { waitUntil: 'networkidle' });
  await waitStrips(pg);
  await pg.waitForTimeout(1500);
  const afterG = await countSets(pg);
  await ctx.close();

  console.log(`GRACEFUL   logged: ${acceptedG} | before: ${beforeG} | after relaunch: ${afterG}`);
  if (acceptedG !== SETS) fail('the harness could not log ' + SETS + ' sets');
  else if (afterG < beforeG) fail('a CLEAN close lost sets — the harness or the app is broken');
  else pass('a clean close loses nothing');

  /* ---- KILL: the measurement -------------------------------------------- */
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  ctx = await launch();
  pg = ctx.pages()[0] || await ctx.newPage();
  await reset(pg);
  const acceptedK = await logSets(pg, SETS);
  const beforeK = await countSets(pg);
  try { execSync(`pkill -9 -f "user-data-dir=${PROFILE}"`); } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));

  ctx = await launch();
  pg = ctx.pages()[0] || await ctx.newPage();
  await pg.goto(baseUrl + PAGE, { waitUntil: 'networkidle' });
  await waitStrips(pg);
  await pg.waitForTimeout(1500);
  const afterK = await countSets(pg);
  await ctx.close();

  console.log(`KILL       logged: ${acceptedK} | before: ${beforeK} | after relaunch: ${afterK}` +
    (afterK < beforeK ? '   <- ' + (beforeK - afterK) + ' lost to the kill' : '   <- flushed in time'));
  if (acceptedK !== SETS) fail('the harness could not log ' + SETS + ' sets before the kill');

  /* ---- REHYDRATE: the gate for FIX-02 ----------------------------------- */
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  ctx = await launch();
  pg = ctx.pages()[0] || await ctx.newPage();
  await reset(pg);

  // Empty local store, four rows waiting in the cloud for the exercise this
  // page actually renders. Patched onto the real MC_SB after it loads rather
  // than replacing it, so nothing else on the page loses its client.
  await ctx.addInitScript(([name, n]) => {
    const rows = [];
    for (let i = 1; i <= n; i++) {
      rows.push({ exercise: name, set_number: i, weight_lbs: 200 + i, reps: 8,
                  rpe: null, logged_at: new Date().toISOString() });
    }
    const patch = () => {
      if (!window.MC_SB) return false;
      window.MC_SB.configured = true;
      window.MC_SB.getSessionSets = () => Promise.resolve(rows);
      return true;
    };
    if (!patch()) {
      const t = setInterval(() => { if (patch()) clearInterval(t); }, 20);
      setTimeout(() => clearInterval(t), 8000);
    }
  }, [exName, SETS]);

  await pg.goto(baseUrl + NEUTRAL, { waitUntil: 'load' });
  await pg.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await pg.goto(baseUrl + PAGE, { waitUntil: 'networkidle' });
  await waitStrips(pg);
  await pg.waitForTimeout(4000);          // rehydrate fires at 1200ms, then paints
  const restored = await countSets(pg);
  const ticked = await countTicked(pg);
  await ctx.close();

  console.log(`REHYDRATE  cloud rows: ${SETS} | restored to the store: ${restored} | rows ticked: ${ticked}`);
  if (!exName) fail('could not read an exercise name off the page');
  else if (restored < SETS) fail(`only ${restored} of ${SETS} cloud sets reached the local store`);
  else if (ticked < SETS) fail(`the store was restored but only ${ticked} of ${SETS} rows show as logged ` +
    '— the athlete would see an unlogged session');
  else pass('an empty device recovers the session from the cloud, ticks and all');

  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  console.log('\n' + (failed ? 'test-mc-crash-recovery: FAIL' : 'test-mc-crash-recovery: pass'));
  process.exit(failed ? 1 : 0);
})();
