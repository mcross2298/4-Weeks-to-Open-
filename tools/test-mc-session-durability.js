#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-session-durability.js — flagship readiness R1, "never lose a set"
   --------------------------------------------------------------------------
   Every other browser gate in verify.yml inspects a session at rest, or logs
   a set and reloads. None of them logs a set and then does something ELSE —
   switches a week tab, starts a rest, types without confirming, unticks,
   finishes, restores a backup — and every R1 defect lived in exactly that
   gap. This drives each of those journeys on the real pages and asserts what
   the athlete would see, not only what is stored:

     ROUNDTRIP  log a set, switch to another week/phase/cycle tab and back, on
                all seven tabbed engines. The session record must survive AND
                the tick must be painted again (D-01: the record was deleted
                at zero ticks, because the re-restore was wired only when a
                record existed at page load).
     REST       log a set, reload mid-rest. The timer must be stored, running,
                visible, and counting toward the ORIGINAL end — not a fresh
                rest (D-04: never stored; restored to a hidden float).
     DRAFT      type a weight and reload while the field still has focus. The
                value must come back (D-05: drafts were saved on blur only).
     UNTICK     log two sets, untick one, finish. One set is banked (D-03:
                untick removed the cloud row and left the local set).
     CUSTOM     a custom workout's Finish banks its sets (D-02: its own Finish
                read a retired key and banked zero).
     FINISHED   after Finish, the session record is gone and STAYS gone while
                the recap is on screen and when the page is left (the ticked
                DOM used to write it straight back on pagehide).
     IMPORT     restoring an older backup keeps a newer workout (D-14).
     DELETE     a deleted workout leaves a deletion record (D-24's sync half
                is unit-tested in test-mc-sync-merge.js).

   CONTROL     a plain refresh restores ticked sets. If it fails, the harness
               is broken and nothing below means anything.

   Usage:
     node tools/test-mc-session-durability.js <baseUrl>
     MC_CHROMIUM=/path/to/chromium node tools/test-mc-session-durability.js ...
   ========================================================================== */
const { chromium } = require('playwright');

const BASE = (process.argv[2] || '').replace(/\/$/, '');
if (!BASE) { console.error('usage: node tools/test-mc-session-durability.js <baseUrl>'); process.exit(1); }
const EXE = process.env.MC_CHROMIUM || undefined;
const BLOCK = /fonts\.(googleapis|gstatic)\.com|supabase\.co|jsdelivr/;

let failed = 0, passed = 0;
const ok = (m) => { passed++; console.log('  ok    ' + m); };
const bad = (m) => { failed++; console.log('  FAIL  ' + m); };
const check = (cond, m, why) => (cond ? ok(m) : bad(m + (why ? ' — ' + why : '')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ctx(browser, init, extra) {
  const c = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, extra || {}));
  await c.route(BLOCK, (r) => r.abort());
  if (init) await c.addInitScript(init);
  return c;
}
async function page(c, errs, tag) {
  const p = await c.newPage();
  p.on('pageerror', (e) => errs.push(tag + ': ' + e.message));
  p.on('dialog', (d) => d.accept());
  return p;
}
async function logSet(card, row, w, r) {
  const rw = card.locator('.mcl-row').nth(row);
  const inp = rw.locator('input');
  await inp.nth(0).fill(String(w));
  await inp.nth(1).fill(String(r));
  await rw.locator('.mcl-ck').click();
  await sleep(300);
}
const sessionOf = (p, pid) => p.evaluate((k) => (JSON.parse(localStorage.getItem('mc_session_v1') || '{}')[k]) || null, pid);
const lastLog = (p) => p.evaluate(() => (JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]')[0]) || null);

async function step(name, fn) {
  try { await fn(); } catch (e) { bad(name + ' — threw: ' + String(e.message).split('\n')[0].slice(0, 160)); }
}

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const errs = [];
  console.log('test-mc-session-durability against ' + BASE + '\n');

  await step('CONTROL', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'control');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const card = p.locator('.ex-card').first();
    await logSet(card, 0, 60, 5); await logSet(card, 1, 60, 5); await sleep(700);
    await p.reload(); await sleep(3000);
    const t = await p.evaluate(() => (document.getElementById('fwProgress') || {}).textContent || '');
    check(/^2\//.test(t), 'CONTROL a refresh restores two ticked sets', 'counter read "' + t + '"');
    await c.close();
  });

  const TABBED = ['mm-p2.html?day=1&week=1', 'kitchen-sink.html?day=1&week=1', 'iron-engine.html?day=1&week=1',
    'hv-block.html?day=1&week=1', 'cat-strength.html?day=legs&week=1', 'psu-strength.html', 'bro-split.html'];
  for (const pg of TABBED) {
    const pid = pg.split('.html')[0];
    await step('ROUNDTRIP ' + pid, async () => {
      const c = await ctx(browser); const p = await page(c, errs, pid);
      await p.goto(BASE + '/' + pg); await sleep(1800);
      if (/^(bro|psu)/.test(pg)) { const h = p.locator('.day-header').first(); if (await h.count()) { await h.click(); await sleep(800); } }
      const r = p.locator('.mcl-row:visible').first(); const i = r.locator('input');
      await i.nth(0).fill('100'); await i.nth(1).fill('8'); await r.locator('.mcl-ck').click(); await sleep(900);
      // Count starts from here on. A restart re-derives the same startTime from
      // the stored end, so comparing start times cannot see one; a call can.
      const t0 = await p.evaluate(() => {
        if (typeof TMR === 'undefined' || !TMR.isRunning()) return null;
        window.__sdStarts = 0;
        const o = TMR.start;
        TMR.start = function () { window.__sdStarts++; return o.apply(TMR, arguments); };
        return 0;
      });
      const tabs = p.locator('button.wtab, button.tab, button.week-tab, button.day-tab, .phase-tab, [data-week]');
      if ((await tabs.count()) < 2) { bad('ROUNDTRIP ' + pid + ' — no second tab found; the harness no longer matches the page'); await c.close(); return; }
      await tabs.nth(1).click(); await sleep(1200);
      await tabs.nth(0).click(); await sleep(2500);
      const s = await sessionOf(p, pid);
      const ticks = await p.evaluate(() => document.querySelectorAll('.mcl-ck.done').length);
      check(s && s.sets && s.sets.length >= 1 && ticks >= 1, 'ROUNDTRIP ' + pid + ': record kept and tick repainted',
        'record sets=' + (s && s.sets ? s.sets.length : 0) + ', ticks on screen=' + ticks);
      // The re-restore runs mid-session now; it must repaint, never restart a
      // rest that is already counting down.
      if (t0 != null) {
        const n = await p.evaluate(() => window.__sdStarts);
        check(n === 0, 'ROUNDTRIP ' + pid + ': the running rest was not restarted', n + ' TMR.start() call(s) during the round trip');
      }
      await c.close();
    });
  }

  await step('REST', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'rest');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    await logSet(p.locator('.ex-card').first(), 0, 60, 5); await sleep(600);
    const before = await sessionOf(p, 'mm-p1');
    await sleep(3000);
    await p.reload(); await sleep(3500);
    const after = await p.evaluate(() => {
      const vis = (el) => !!(el && el.offsetParent !== null);
      return {
        running: typeof TMR !== 'undefined' && TMR.isRunning(),
        endTs: TMR.startTime != null ? TMR.startTime + TMR.duration * 1000 : null,
        shown: vis(document.getElementById('mclRestVal')) || vis(document.querySelector('#timerFloat.visible')) || vis(document.querySelector('#timerVideo.visible'))
      };
    });
    const t = before && before.timer;
    check(!!t && t.endTs > Date.now() - 60000, 'REST the running rest is stored', JSON.stringify(t));
    check(after.running && after.shown, 'REST it is running and visible after a reload', JSON.stringify(after));
    check(!!t && after.endTs != null && Math.abs(after.endTs - t.endTs) < 1500,
      'REST it counts toward the original end, not a fresh rest',
      'stored ' + (t && t.endTs) + ' vs restored ' + after.endTs);
    await c.close();
  });

  await step('DRAFT', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'draft');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const inp = p.locator('.ex-card').first().locator('.mcl-row').nth(1).locator('.mcl-w');
    await inp.click(); await inp.fill('142.5'); await sleep(900);   // no blur
    await p.reload(); await sleep(3000);
    const v = await p.evaluate(() => {
      const c0 = document.querySelector('.ex-card');
      if (window.MCSetlogUtil && MCSetlogUtil.ensureRowsBuilt) MCSetlogUtil.ensureRowsBuilt(c0);
      const x = c0.querySelectorAll('.mcl-row')[1].querySelector('.mcl-w');
      return x.value + (x.classList.contains('mcl-ghost') ? ' (ghost)' : '');
    });
    check(v === '142.5', 'DRAFT a typed weight survives a reload with the field still focused', 'read "' + v + '"');
    await c.close();
  });

  await step('UNTICK', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'untick');
    await p.goto(BASE + '/iron-engine.html?day=1&week=1'); await sleep(2000);
    const card = p.locator('.ex-card').first();
    await logSet(card, 0, 135, 12); await logSet(card, 1, 155, 12);
    await card.locator('.mcl-row').nth(1).locator('.mcl-ck').click(); await sleep(700);
    const s = await sessionOf(p, 'iron-engine');
    check(s && s.sets && s.sets.length === 1, 'UNTICK the live session drops the unticked set', 'record holds ' + (s && s.sets ? s.sets.length : 0));
    await p.locator('#mcsEnd').click(); await sleep(500);
    await p.evaluate(() => window._FW && _FW.confirm()); await sleep(2000);
    const e = await lastLog(p);
    const n = e && Array.isArray(e.sets) ? e.sets.length : -1;
    check(n === 1, 'UNTICK finish banks only the set still ticked', n + ' sets banked');
    await sleep(600);
    check(!(await sessionOf(p, 'iron-engine')), 'FINISHED the session record is cleared and stays cleared under the recap');
    await p.goto(BASE + '/dashboard.html'); await sleep(800);
    check(!(await sessionOf(p, 'iron-engine')), 'FINISHED leaving the page does not write it back');
    await c.close();
  });

  await step('CUSTOM', async () => {
    const c = await ctx(browser, () => {
      if (localStorage.getItem('_mcSd')) return;
      localStorage.setItem('_mcSd', '1');
      localStorage.setItem('mc_custom_workouts_v1', JSON.stringify([{ id: 'sd1', name: 'SD Push', exercises: [
        { name: 'Bench Press', sets: 3, reps: '8', rest: 90 }, { name: 'Cable Fly', sets: 3, reps: '12', rest: 60 }] }]));
    });
    const p = await page(c, errs, 'custom');
    await p.goto(BASE + '/run-workout.html?id=sd1'); await sleep(2200);
    check((await p.locator('.fw-bar').count()) === 0, 'CUSTOM the page carries no second Finish of its own');
    const card = p.locator('.ex-card').first();
    await logSet(card, 0, 135, 8); await logSet(card, 1, 135, 8); await sleep(700);
    await p.locator('#mcsEnd').click(); await sleep(500);
    await p.evaluate(() => window._FW && _FW.confirm()); await sleep(2000);
    const e = await lastLog(p);
    check(e && e.pageId === 'custom-sd1' && Array.isArray(e.sets) && e.sets.length === 2 && !!e.id,
      'CUSTOM Finish banks both sets under the custom workout, with an id',
      JSON.stringify(e && { pageId: e.pageId, id: e.id, sets: (e.sets || []).length }));
    await c.close();
  });

  await step('IMPORT', async () => {
    const c = await ctx(browser, null, { acceptDownloads: true }); const p = await page(c, errs, 'import');
    await p.goto(BASE + '/dashboard.html'); await sleep(1200);
    await p.evaluate(() => {
      const L = [0, 1, 2].map((i) => { const d = new Date(Date.now() - (i + 1) * 1728e5).toISOString();
        return { id: 'mm-p1|' + d, pageId: 'mm-p1', workoutName: 'SD #' + (3 - i), date: d,
          sets: [{ name: 'Incline DB Press', setNum: 1, weight: '60', reps: '5' }], prs: 0, setsChecked: 1 }; });
      localStorage.setItem('mc_workout_log_v1', JSON.stringify(L));
    });
    await p.reload(); await sleep(1500);
    await p.evaluate(() => document.querySelector('.avatar').click()); await sleep(800);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('#acctExport')]);
    const file = await dl.path();
    await p.evaluate(() => {
      const L = JSON.parse(localStorage.getItem('mc_workout_log_v1'));
      L.unshift({ id: 'mm-p1|new', pageId: 'mm-p1', workoutName: 'SD newest', date: new Date().toISOString(), sets: [], prs: 0, setsChecked: 0 });
      localStorage.setItem('mc_workout_log_v1', JSON.stringify(L));
    });
    await p.reload(); await sleep(1200);
    let preview = '';
    p.removeAllListeners('dialog');
    p.on('dialog', (d) => { preview = d.message(); d.accept(); });
    await p.evaluate(() => document.querySelector('.avatar').click()); await sleep(800);
    await p.setInputFiles('#acctImportFile', file); await sleep(2500);
    const names = await p.evaluate(() => JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]').map((e) => e.workoutName));
    check(/Workouts:/.test(preview), 'IMPORT a preview is shown before anything is written', JSON.stringify(preview.slice(0, 80)));
    check(names.indexOf('SD newest') !== -1 && names.length === 4, 'IMPORT an older backup keeps the newer workout', JSON.stringify(names));
    await c.close();
  });

  await step('DELETE', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'delete');
    await p.goto(BASE + '/workout-logs.html'); await sleep(800);
    const r = await p.evaluate(() => {
      localStorage.setItem('mc_workout_log_v1', JSON.stringify([
        { id: 'x|1', pageId: 'x', date: '2026-10-20T10:00:00Z', sets: [] },
        { pageId: 'legacy', date: '2026-10-19T10:00:00Z', sets: [] }]));
      MC_LOG.deleteWorkouts(['x|1', MC_LOG.workoutKey({ pageId: 'legacy', date: '2026-10-19T10:00:00Z' })]);
      return { left: MC_LOG.readWorkoutLog().length, rec: Object.keys(MC_LOG.readDeletedWorkouts()) };
    });
    check(r.left === 0 && r.rec.length === 2, 'DELETE removes both (one with no id) and records each deletion', JSON.stringify(r));
    await c.close();
  });

  check(errs.length === 0, 'no page errors on any journey', errs.slice(0, 5).join(' | '));
  await browser.close();
  console.log('\n' + (passed + failed) + ' checks: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
