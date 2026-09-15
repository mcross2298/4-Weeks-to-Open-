#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-pr-scope.js — a personal record belongs to the LIFT, not the page
   --------------------------------------------------------------------------
   mc-finish.js's getSessionSets() flags each logged set with `pr:true`, and
   that flag is what the Session Complete recap celebrates, what
   mc_workout_log_v1's `prs` count totals, and what mc-stats.js's PR timeline
   and mc-wrapped.js both read. It used to derive "previous best" from
   store[pageId+'|'+exerciseId] — the current PAGE's history alone.

   One exercise catalog feeds ten programs, and every program page owns its own
   set-log key, so the same lift carries a separate and invisible history per
   page. Measured before the fix: seed a 300 lb best for an exercise under
   `kitchen-sink`, log 150 lb of the same exercise on `mm-p1`, finish, and the
   banked workout came back `prs: 1` — a gold PR for a weight the athlete had
   already beaten by 150 lb, in their own history, in this same app.

   The app already held the right notion one layer down: mc-setlog.js's
   signed-in push path asks MC_SB.getMaxWeight(exName), scoped to the exercise.
   So the recap and the push notification disagreed about the same set — the
   same "two implementations of one number" shape roadmap Phase 4.2 fixed for
   the estimated 1RM.

   This is a browser gate rather than a vm-sandboxed one on purpose: the defect
   was not in the arithmetic, it was in WHICH KEYS the arithmetic was handed, so
   the assertion has to run against the real page driving the real completion
   point (window._FW.confirm()).

   Usage: node tools/test-mc-pr-scope.js <baseUrl>
   ========================================================================== */
const { chromium } = require('playwright');

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('::error::usage: node tools/test-mc-pr-scope.js <baseUrl>');
  process.exit(1);
}

const PAGE = '/mm-p1.html?day=1';
const OTHER_PID = 'kitchen-sink';          // a real page id that is not PAGE's
const NEUTRAL = '/manifest.json';
const SK = 'mc_setlog_v1', WL = 'mc_workout_log_v1';

let failed = false, checks = 0;
const pass = (m) => { checks++; console.log('  ok    ' + m); };
const fail = (m) => { checks++; failed = true; console.log('  FAIL  ' + m); };
const eq = (m, got, want) =>
  (String(got) === String(want) ? pass(`${m} (${got})`) : fail(`${m} — got ${got}, expected ${want}`));

// Leaving the page before clearing is what makes the clear stick: the workout
// page persists its in-memory session as it unloads, so a clear-then-reload
// writes the old session straight back (the same reasoning
// test-mc-setlog-concurrency.js records at length).
async function reset(pg) {
  await pg.goto(baseUrl + NEUTRAL, { waitUntil: 'load' });
  for (let i = 0; i < 6; i++) {
    await pg.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await pg.waitForTimeout(200);
    const left = await pg.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.indexOf('mc_') === 0).length);
    if (left === 0) return true;
  }
  return false;
}

// Write prior sessions straight into the store. entries: [[pageId, dayOffset, [weights]], ...]
// dayOffset must be >= 1 — a session dated today is never a "previous best".
async function seed(pg, exId, entries) {
  await pg.goto(baseUrl + NEUTRAL, { waitUntil: 'load' });
  await pg.evaluate(([key, id, rows]) => {
    const store = {};
    rows.forEach(([pid, off, weights]) => {
      const d = new Date(); d.setDate(d.getDate() - off);
      const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                  '-' + String(d.getDate()).padStart(2, '0');
      const sets = {};
      weights.forEach((w, i) => { sets[String(i + 1)] = { w: String(w), r: '8' }; });
      const k = pid + '|' + id;
      store[k] = store[k] || [];
      store[k].push({ d: day, ts: d.getTime(), sets: sets });
    });
    localStorage.setItem(key, JSON.stringify(store));
  }, [SK, exId, entries]);
}

async function openPage(pg) {
  await pg.goto(baseUrl + PAGE, { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => document.querySelectorAll('.mcl-strip').length > 0,
    null, { timeout: 20000 });
}

// Log one set against the first card at a given weight.
async function logSet(pg, weight) {
  return pg.evaluate((w) => {
    const strip = document.querySelectorAll('.mcl-strip')[0];
    if (!strip) return 'NOSTRIP';
    const card = strip.closest('.ex-card, .ss-ex, .ex-item') || strip.parentElement;
    const pick = () => {
      const wrap = card.querySelector('.mcl-wrap');
      return (wrap && wrap.classList.contains('open')) ? wrap.querySelector('.mcl-ck:not(.done)') : null;
    };
    let ck = pick();
    if (!ck) { strip.click(); ck = pick(); }
    if (!ck) return 'NOROW';
    const row = ck.closest('.mcl-row');
    const wi = row && row.querySelector('.mcl-w'), ri = row && row.querySelector('.mcl-r');
    if (wi) { wi.value = String(w); wi.dispatchEvent(new Event('input', { bubbles: true })); }
    if (ri) { ri.value = '8'; ri.dispatchEvent(new Event('input', { bubbles: true })); }
    ck.click();
    return 'OK';
  }, weight);
}

async function finish(pg) {
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { try { window._FW && window._FW.confirm && window._FW.confirm(); } catch (e) {} });
  await pg.waitForTimeout(1600);
  return pg.evaluate((k) => {
    try { return JSON.parse(localStorage.getItem(k) || '[]')[0] || null; } catch (e) { return null; }
  }, WL);
}

(async () => {
  const browser = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  try {
    console.log('TEST — PR scope: the exercise, not the page');
    console.log('page: ' + PAGE + '\n');

    // Discover the real exercise id the first card writes to, so the seed lands
    // on the same key the app will read. Hardcoding a name here would rot the
    // moment the page's first exercise changes.
    if (!(await reset(pg))) { fail('could not clear mc_* storage'); throw new Error('dirty profile'); }
    await openPage(pg);
    await logSet(pg, 111);
    await pg.waitForTimeout(700);
    const key = await pg.evaluate((k) => {
      try { return Object.keys(JSON.parse(localStorage.getItem(k) || '{}'))[0] || null; } catch (e) { return null; }
    }, SK);
    if (!key) { fail('could not discover the set-log key for the first card'); throw new Error('no key'); }
    const EX = key.slice(key.indexOf('|') + 1);
    console.log('  exercise under test: ' + EX + '  (via ' + key + ')\n');

    const cases = [
      { name: 'a prior best on ANOTHER page counts — 150 lb is not a record when 300 lb is already logged',
        seed: [[OTHER_PID, 7, [300]], ['mm-p1', 7, [100]]], log: [150], want: 0 },
      { name: 'the cross-page best is the one to beat — 310 lb beats the 300 lb logged elsewhere',
        seed: [[OTHER_PID, 7, [300]], ['mm-p1', 7, [100]]], log: [310], want: 1 },
      { name: 'a first-ever log is a baseline, not a record (audit G-03)',
        seed: [], log: [225], want: 0 },
      { name: 'equalling the best does not beat it',
        seed: [['mm-p1', 7, [200]]], log: [200], want: 0 },
      { name: 'the best of every prior session counts, not just the latest',
        seed: [['mm-p1', 14, [220]], ['mm-p1', 7, [180]]], log: [210], want: 0 },
      { name: 'two PR sets in one session are both flagged',
        seed: [[OTHER_PID, 7, [100]]], log: [150, 160], want: 2 },
      { name: 'an earlier set THIS session does not block a later one',
        seed: [['mm-p1', 7, [100]]], log: [200, 205], want: 2 }
    ];

    for (const c of cases) {
      if (!(await reset(pg))) { fail('could not clear storage before: ' + c.name); continue; }
      if (c.seed.length) await seed(pg, EX, c.seed);
      await openPage(pg);
      for (const w of c.log) await logSet(pg, w);
      const entry = await finish(pg);
      if (!entry) { fail('no workout was banked for: ' + c.name); continue; }
      eq(c.name, entry.prs, c.want);
    }

    if (errors.length) {
      failed = true;
      console.log('\nconsole/page errors:');
      errors.slice(0, 10).forEach((e) => console.log('  ' + e));
    }
  } catch (e) {
    failed = true;
    console.log('  FAIL  ' + (e && e.message ? e.message : e));
  } finally {
    await browser.close();
  }

  console.log('\n' + checks + ' check(s) — test-mc-pr-scope: ' + (failed ? 'FAIL' : 'pass'));
  process.exit(failed ? 1 : 0);
})();
