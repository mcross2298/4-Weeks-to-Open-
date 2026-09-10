#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-setlog-concurrency.js — TEST 1 of the Phase 0 launch gates
   --------------------------------------------------------------------------
   What it exists for. mc-setlog.js's save() used to read the WHOLE
   mc_setlog_v1 store, mutate it and write it back, with no lock, no re-read
   and no cross-tab listener. Two tabs of the same program page interleaving
   that sequence means the second write is computed from a snapshot taken
   before the first, so it silently overwrites it. Measured on the pre-fix
   build: ten sets accepted across two tabs, five persisted. No error, no
   warning, and each tab shows a correct count in its own view.

   Three passes, and all three must be green:

     CONTROL     one tab, five sets, nothing lost. This exists so a broken
                 harness cannot read as a pass — if the control loses sets the
                 tool is measuring itself, not the app.
     RACE        two tabs logging concurrently, nothing lost.
     LOCK        deterministic. The test itself holds the Web Lock the logger
                 takes, clicks a set in the other tab, and asserts the write
                 has NOT landed while the lock is held and HAS landed once it
                 is released. RACE depends on scheduling to expose the bug;
                 this one does not, so it is the pass that actually fails on
                 an unfixed build every single run.

   Usage:
     node tools/test-mc-setlog-concurrency.js <baseUrl>
     MC_CHROMIUM=/path/to/chromium node tools/test-mc-setlog-concurrency.js ...
   ========================================================================== */
const { chromium } = require('playwright');

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('usage: node tools/test-mc-setlog-concurrency.js <baseUrl>');
  process.exit(1);
}

// One page per card engine is overkill here — the store and its writer are
// shared by every engine, so the race is a property of mc-setlog.js, not of
// the page. mm-p1 is the same probe page the perf budget and the journey gate
// already drive, so a failure here is comparable with theirs.
const PAGE = '/mm-p1.html?day=1';
const SK = 'mc_setlog_v1';

const SETS_PER_TAB = 5;
// Tab B trains a different exercise from tab A, so the two tabs write
// different keys and a shortfall in the total is real loss (see logOneSet).
const TAB_B_CARD = 1;

/* ---- helpers run inside the page ---------------------------------------- */

// Open a card's logger and click one un-checked set row, returning whether a
// click was actually accepted. Mirrors the sequence check-journey.js drives.
// cardIx picks WHICH exercise to log against. This matters more than it
// looks: the store is keyed pageId|exerciseId|setNumber, so two tabs logging
// the SAME exercise write the same slot twice and five surviving entries is
// correct, not a loss. The first draft of this tool drove both tabs onto the
// same card and read that as a 50% loss — the number the audit reported. The
// two tabs must therefore train different exercises for the count to mean
// anything, which is also the realistic case: one athlete, one phone, one
// tab left open from earlier in the session.
async function logOneSet(pg, weight, cardIx) {
  return pg.evaluate(([w, ix]) => {
    const strip = document.querySelectorAll('.mcl-strip')[ix];
    if (!strip) return 'NOSTRIP';
    const card = strip.closest('.ex-card, .ss-ex, .ex-item') || strip.parentElement;

    // Rows are built lazily (audit A-14) — a card only has .mcl-ck elements
    // once it has been made active. Clicking its strip is what builds them,
    // so a first attempt that finds no row is a not-yet-built card, not a
    // finished one: open it and look again rather than reporting NOROW.
    function pick() {
      const wrap = card.querySelector('.mcl-wrap');
      if (!wrap || !wrap.classList.contains('open')) return null;
      return wrap.querySelector('.mcl-ck:not(.done)');
    }
    let ck = pick();
    if (!ck) { strip.click(); ck = pick(); }
    if (!ck) {
      const wrap = card.querySelector('.mcl-wrap');
      return 'NOROW(' + card.className + '|' + (wrap ? wrap.className : 'nowrap') +
             '|ck=' + (wrap ? wrap.querySelectorAll('.mcl-ck').length : -1) +
             '|done=' + (wrap ? wrap.querySelectorAll('.mcl-ck.done').length : -1) + ')';
    }

    const row = ck.closest('.mcl-row') || ck.parentElement;
    const wi = row && row.querySelector('.mcl-w');
    if (wi) {
      wi.value = String(w);
      wi.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ck.click();
    return 'OK';
  }, [weight, cardIx]);
}

async function dumpStore(pg) {
  return pg.evaluate((key) => {
    let store;
    try { store = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
    const out = {};
    Object.keys(store).forEach((k) => {
      out[k] = (store[k] || []).map((s) => Object.keys((s && s.sets) || {}).length);
    });
    return out;
  }, SK);
}

async function countSets(pg) {
  return pg.evaluate((key) => {
    let store;
    try { store = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return -1; }
    return Object.keys(store).reduce((n, k) => {
      const sess = (store[k] || [])[0];
      return n + (sess && sess.sets ? Object.keys(sess.sets).length : 0);
    }, 0);
  }, SK);
}

async function openTab(ctx, errors, label) {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  pg.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Blocked CDN/font/Supabase requests in a sandboxed CI runner, same
    // filter smoke-test-pages.js and check-journey.js already apply.
    if (/Failed to load resource/i.test(m.text())) return;
    errors.push(`${label}: ${m.text()}`);
  });
  await pg.goto(baseUrl + PAGE, { waitUntil: 'networkidle' });
  await waitForStrips(pg);
  return pg;
}

// Presence, not visibility: the active card's own strip is collapsed out of
// the layout, so waitForSelector's visibility check fails on a page that is
// in fact fully built.
async function waitForStrips(pg) {
  await pg.waitForFunction(() => document.querySelectorAll('.mcl-strip').length > 0,
    null, { timeout: 15000 });
}

// Clear everything, not a named list. The first draft removed three keys and
// the reloaded page still came back with every row ticked, because the state
// that repaints a checked row is spread across more stores than the set log
// itself. A gate that starts from a half-cleared profile measures the last
// run, not this one.
// Clear-then-reload does not work here, and the reason is worth writing down.
// The workout page holds its session IN MEMORY and mc-session.js persists it
// again as the page unloads — which is exactly when a reload happens. So the
// reload meant to produce a clean page is the very thing that writes the old
// session back, and the page returns with every row already ticked while
// mc_setlog_v1 itself reads empty: two stores telling two different stories.
// Clearing twice does not help either; the second reload writes it back too.
//
// Leaving the page FIRST is what breaks the cycle. Navigate to a neutral
// same-origin document (no app JS, so nothing to persist), clear from there,
// and only then load the workout page.
const NEUTRAL = '/manifest.json';

async function resetTab(pg) {
  await pg.goto(baseUrl + NEUTRAL, { waitUntil: 'load' });
  await clearStore(pg);
  await pg.goto(baseUrl + PAGE, { waitUntil: 'networkidle' });
  await waitForStrips(pg);
}

// A tab that comes up with rows already ticked is a dirty profile, and every
// count taken from it is meaningless. Assert it rather than discovering it as
// a mysterious "no rows left to log".
async function domDone(pg) {
  return pg.evaluate(() => document.querySelectorAll('.mcl-ck.done').length);
}

async function clearStore(pg) {
  await pg.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
  });
}

/* ---- the three passes ---------------------------------------------------- */

async function control(ctx, errors) {
  const pg = await openTab(ctx, errors, 'control');
  await resetTab(pg);
  const dirty = await domDone(pg);
  if (dirty) { await pg.close(); return { accepted: 0, kept: 0, dirty: dirty }; }

  let accepted = 0;
  for (let i = 0; i < SETS_PER_TAB; i++) {
    if (await logOneSet(pg, 100 + i, 0) === 'OK') accepted++;
  }
  await pg.waitForTimeout(2000);
  const kept = await countSets(pg);
  await pg.close();
  return { accepted, kept };
}

async function race(ctx, errors) {
  const a = await openTab(ctx, errors, 'tab A');
  const b = await openTab(ctx, errors, 'tab B');
  // Clear on BOTH tabs and only then reload BOTH. Clearing before the second
  // tab exists is not enough: the tab that is still open re-renders its own
  // restored session over the top, and the reloaded tab comes back with every
  // row already ticked. The first draft did exactly that and read a fully
  // logged card as "no rows left", which looks identical to a page the
  // harness cannot drive.
  await resetTab(a);
  await resetTab(b);
  const start = (await countSets(a)) + (await domDone(a)) + (await domDone(b));
  if (start !== 0) { await a.close(); await b.close(); return { accepted: 0, kept: 0, dirty: start }; }

  let accepted = 0;
  // Alternate without awaiting each pair, so the two read-modify-write
  // sequences genuinely overlap rather than running one after the other.
  for (let i = 0; i < SETS_PER_TAB; i++) {
    const results = await Promise.all([logOneSet(a, 200 + i, 0), logOneSet(b, 300 + i, TAB_B_CARD)]);
    if (process.env.MC_DEBUG) console.log('   round ' + i + ': ' + results.join(' / '));
    accepted += results.filter((r) => r === 'OK').length;
  }
  // The guarded write is asynchronous while it waits on the lock, so give the
  // last one room to land before counting. Counting too early reads as loss.
  await a.waitForTimeout(2000);
  const kept = await countSets(a);
  const detail = process.env.MC_DEBUG ? await dumpStore(a) : null;
  if (detail) console.log('   store: ' + JSON.stringify(detail));
  await a.close();
  await b.close();
  return { accepted, kept };
}

async function lockPass(ctx, errors) {
  const holder = await openTab(ctx, errors, 'lock holder');
  const writer = await openTab(ctx, errors, 'lock writer');
  await resetTab(holder);
  await resetTab(writer);
  const start = (await countSets(writer)) + (await domDone(writer));
  if (start !== 0) { await holder.close(); await writer.close(); return { dirty: start }; }

  const supported = await holder.evaluate(() => !!(navigator.locks && navigator.locks.request));
  if (!supported) return { skipped: 'navigator.locks unavailable in this browser' };

  // Hold the very lock the logger takes, from the other tab.
  await holder.evaluate((key) => {
    window.__mcHeld = new Promise((release) => { window.__mcRelease = release; });
    navigator.locks.request(key, () => window.__mcHeld);
  }, SK);
  await holder.waitForTimeout(200);

  const accepted = await logOneSet(writer, 555, 0);
  await writer.waitForTimeout(600);
  const whileHeld = await countSets(writer);

  await holder.evaluate(() => window.__mcRelease && window.__mcRelease());
  await writer.waitForTimeout(600);
  const afterRelease = await countSets(writer);

  await holder.close();
  await writer.close();
  return { accepted, whileHeld, afterRelease };
}

/* ---- runner -------------------------------------------------------------- */

(async () => {
  const browser = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  let failed = false;

  const fail = (msg) => { failed = true; console.log('  FAIL  ' + msg); };
  const pass = (msg) => console.log('  ok    ' + msg);

  try {
    console.log('TEST 1 — concurrent-write durability on ' + SK);
    console.log('page: ' + PAGE + '\n');

    const c = await control(ctx, errors);
    console.log(`CONTROL  one tab   accepted: ${c.accepted} | persisted: ${c.kept}`);
    if (c.dirty) fail(`control started on a dirty profile (${c.dirty}) — the harness is measuring the previous run`);
    else if (c.accepted === 0) fail('control accepted no clicks — the harness cannot drive this page');
    else if (c.kept !== c.accepted) fail(`control lost ${c.accepted - c.kept} of ${c.accepted} sets in ONE tab (harness or app is broken)`);
    else pass('single-tab control loses nothing');

    const r = await race(ctx, errors);
    console.log(`RACE     two tabs  accepted: ${r.accepted} | persisted: ${r.kept}`);
    if (r.dirty) fail(`race started with ${r.dirty} sets already in the store — setup is not clean`);
    else if (r.accepted === 0) fail('race accepted no clicks');
    else if (r.kept < r.accepted) fail(`LOST ${r.accepted - r.kept} of ${r.accepted} accepted sets across two tabs`);
    else pass('two-tab race loses nothing');

    const l = await lockPass(ctx, errors);
    if (l.dirty) {
      fail(`lock pass started with ${l.dirty} sets already in the store — setup is not clean`);
    } else if (l.skipped) {
      console.log('LOCK     skipped — ' + l.skipped);
    } else {
      console.log(`LOCK     held: ${l.whileHeld} set(s) written | released: ${l.afterRelease}`);
      if (l.accepted !== 'OK') fail('lock pass could not log a set');
      else if (l.whileHeld !== 0) fail('a set-log write landed while the store lock was held — writes are NOT serialised');
      else if (l.afterRelease !== 1) fail(`the write did not land after the lock was released (${l.afterRelease} sets)`);
      else pass('writes wait on the cross-tab lock and land once it clears');
    }

    if (errors.length) {
      failed = true;
      console.log('\nconsole/page errors:');
      errors.slice(0, 20).forEach((e) => console.log('  ' + e));
    }
  } catch (e) {
    failed = true;
    console.log('  FAIL  ' + (e && e.message ? e.message : e));
  } finally {
    await browser.close();
  }

  console.log('\n' + (failed ? 'test-mc-setlog-concurrency: FAIL' : 'test-mc-setlog-concurrency: pass'));
  process.exit(failed ? 1 : 0);
})();
