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
     SKEW       an untick made on a device whose clock runs BEHIND the one
                that ticked still wins the merge, and a re-tick after a
                "future" untick still stays (the N3 clock-skew residual: both
                stamps used to be the bare local clock).
     TWO-WEEKS  the same lift ticked in week 1 and week 2 on ONE day keeps
                both sets, each painted on its own week, and an untick on
                week 2 leaves week 1's set (they used to share one slot, and
                the second tick overwrote the first).
     CUSTOM     a custom workout's Finish banks its sets (D-02: its own Finish
                read a retired key and banked zero).
     FINISHED   after Finish, the session record is gone and STAYS gone while
                the recap is on screen and when the page is left (the ticked
                DOM used to write it straight back on pagehide).
     IMPORT     restoring an older backup keeps a newer workout (D-14).
     DELETE     a deleted workout leaves a deletion record (D-24's sync half
                is unit-tested in test-mc-sync-merge.js).

   Flagship readiness R2 ("screen stays on, rest always lands") rides the same
   journeys, with navigator.wakeLock and page visibility stubbed so a lock can
   be counted and an interruption simulated:

     WAKE       one logged set holds the screen even with no rest running, and
                the session clock starts there (D-06: both waited for a whole
                exercise); a hide/show re-acquires it with no rest running
                (D-07: only a running rest re-acquired); Finish releases it and
                stops the rest; "Keep screen on" off holds it only during a rest.
     REST-END   a rest reaching zero shows a full-width bar a silent phone
                cannot miss. It must never take a tap and must leave End
                workout reachable (its first draft covered it; check-journey
                caught that), and it clears when the rest ends.
     DAY-LIST   the same lock when the session is entered the normal way —
                from the day list, not a ?day= deep link — on all three F3
                engine families. mc-live-tracker.js returned at load when no
                card existed yet (the "cards at load" trap, a sixth time), and
                skipped the .ex-item family outright; mc-summary.js's
                auto-built summary never started the session on a first set.

   Flagship readiness C ("program content and deloads"):

     DELOAD     switching INTO a declared deload week on the page cuts at
                least a third of the planned sets and says so on the card;
                switching back restores the full week (the answer was cached
                once per page load, so an in-page switch built full volume).
     TUT        the Modality Matrix's Pos 4 tempo anchor shows on the card in
                every week (D-26).

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
        shown: [['mclRestVal', ''], ['timerFloat', 'visible'], ['timerVideo', 'visible']].some(([id, cls]) => {
          const el = document.getElementById(id);
          return !!el && (!cls || el.classList.contains(cls)) && vis(el);
        })
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

  await step('SKEW', async () => {
    // A set ticked on another device whose clock runs an hour AHEAD arrives
    // here through sync carrying t = now + 1h. Unticking it here used to stamp
    // the untick with this device's clock -- an hour EARLIER than the tick --
    // so the merge kept the set and the next pull put it back.
    const AHEAD = 3600000;
    const c = await ctx(browser); const p = await page(c, errs, 'skew');
    await p.goto(BASE + '/iron-engine.html?day=1&week=1'); await sleep(2000);
    const card = p.locator('.ex-card').first();
    await logSet(card, 0, 135, 12); await sleep(700);
    const key = await p.evaluate((ahead) => {
      const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      const k = Object.keys(s).find((x) => x.indexOf('iron-engine|') === 0 && s[x][0] && s[x][0].sets && s[x][0].sets[1]);
      s[k][0].sets[1].t = Date.now() + ahead;           // as if synced from the fast device
      localStorage.setItem('mc_setlog_v1', JSON.stringify(s));
      return k;
    }, AHEAD);
    await p.reload(); await sleep(2500);
    await p.locator('.ex-card').first().locator('.mcl-row').nth(0).locator('.mcl-ck').click(); await sleep(800);
    const r = await p.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      const day = Object.keys(JSON.parse(localStorage.getItem('mc_setlog_deleted_v1') || '{}')).find((x) => x.indexOf(k + '|') === 0);
      const rec = day ? JSON.parse(localStorage.getItem('mc_setlog_deleted_v1'))[day] : null;
      return { rec: rec && rec.ts, now: Date.now(), still: !!(s[k] && s[k][0] && s[k][0].sets && s[k][0].sets[1]) };
    }, key);
    check(r.rec && r.rec > r.now + AHEAD - 60000 && !r.still,
      'SKEW an untick is stamped after the tick it removes, even when that tick came from a clock running ahead',
      JSON.stringify(r));
    // The other direction: the untick record is the "future" one now. A
    // re-tick here must still be stamped after it, or the merge drops it.
    await p.evaluate(() => {
      const m = JSON.parse(localStorage.getItem('mc_setlog_deleted_v1') || '{}');
      Object.keys(m).forEach((x) => { if (x.indexOf('iron-engine|') === 0) m[x].ts = Date.now() + 7200000; });
      localStorage.setItem('mc_setlog_deleted_v1', JSON.stringify(m));
    });
    await logSet(p.locator('.ex-card').first(), 0, 140, 10); await sleep(700);
    const t = await p.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      const m = JSON.parse(localStorage.getItem('mc_setlog_deleted_v1') || '{}');
      const set = s[k] && s[k][0] && s[k][0].sets && s[k][0].sets[1];
      const rk = Object.keys(m).find((x) => x.indexOf(k + '|') === 0);
      return { t: set && set.t, rec: rk && m[rk].ts };
    }, key);
    check(t.t && t.rec && t.t > t.rec, 'SKEW a re-tick is stamped after an untick record from a clock running ahead', JSON.stringify(t));
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
    await p.setInputFiles('#acctImportFile', file); await sleep(1200);
    // R5 / D-16: the preview is the in-app confirm (mc-sheet.js) now, not an
    // OS dialog; the native handler above stays as the fallback's catcher.
    if (!preview) {
      preview = await p.evaluate(() => { const m = document.querySelector('.mcsh-overlay .mcsh-msg'); return m ? m.textContent : ''; });
      const ok = p.locator('.mcsh-overlay [data-mcsh-ok]');
      if (await ok.count()) await ok.click();
    }
    await sleep(1500);
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

  // ---- R2 -----------------------------------------------------------------
  const WAKE_STUB = () => {
    window.__wl = []; let cur = null;
    window.__held = () => !!(cur && !cur._r);
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: () => {
      window.__wl.push('request'); const s = new EventTarget();
      s.release = () => { if (!s._r) { s._r = 1; s.dispatchEvent(new Event('release')); window.__wl.push('release'); } return Promise.resolve(); };
      cur = s; return Promise.resolve(s);
    } } });
    window.__hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__hidden ? 'hidden' : 'visible') });
    window.__hide = () => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); if (cur) cur.release(); };
    window.__show = () => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); };
  };

  await step('WAKE', async () => {
    const c = await ctx(browser, WAKE_STUB); const p = await page(c, errs, 'wake');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const before = await p.evaluate(() => ({ req: window.__wl.length, clock: (document.getElementById('mcsTimerVal') || {}).textContent }));
    check(before.req === 0, 'WAKE nothing holds the screen before the first set', JSON.stringify(before));
    const card = p.locator('.ex-card').first();
    await logSet(card, 0, 60, 5); await sleep(900);
    await p.evaluate(() => TMR.stop()); await sleep(500);
    check(await p.evaluate(() => window.__held()), 'WAKE one logged set holds the screen with no rest running');
    await sleep(2100);
    const clock = await p.evaluate(() => (document.getElementById('mcsTimerVal') || {}).textContent || '');
    check(clock && clock !== '00:00', 'WAKE the session clock starts at the first set', 'clock reads "' + clock + '"');
    await p.evaluate(() => window.__hide()); await sleep(200);
    await p.evaluate(() => window.__show()); await sleep(500);
    check(await p.evaluate(() => window.__held()), 'WAKE an interruption with no rest running re-acquires the lock');
    await logSet(card, 1, 60, 5); await sleep(400);
    const resting = await p.evaluate(() => TMR.isRunning());
    await p.evaluate(() => window._FW && _FW.confirm()); await sleep(800);
    const after = await p.evaluate(() => ({ held: window.__held(), running: TMR.isRunning() }));
    check(resting && !after.held && !after.running, 'WAKE Finish releases the lock and ends a running rest',
      'rest running before=' + resting + ', after=' + JSON.stringify(after));
    await c.close();
  });

  await step('WAKE off', async () => {
    const c = await ctx(browser, () => { localStorage.setItem('mc_prefs_v1', JSON.stringify({ keepAwake: false })); });
    await c.addInitScript(WAKE_STUB);
    const p = await page(c, errs, 'wake-off');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    await logSet(p.locator('.ex-card').first(), 0, 60, 5); await sleep(700);
    const during = await p.evaluate(() => window.__held());
    await p.evaluate(() => TMR.stop()); await sleep(500);
    const afterRest = await p.evaluate(() => window.__held());
    check(during && !afterRest, 'WAKE "Keep screen on" off holds the screen only while a rest runs',
      'during rest=' + during + ', after rest=' + afterRest);
    await c.close();
  });

  await step('REST-END', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'rest-end');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    await p.evaluate(() => TMR.start(document.querySelector('.ex-card .rest-timer'), 2, 'Rest')); await sleep(3300);
    const b = await p.evaluate(() => { const e = document.getElementById('mcRestEnd'); if (!e) return null;
      const r = e.getBoundingClientRect();
      const tb = document.querySelector('.prog-bar-wrap.mcs-stat, #progBarWrap');
      const t = tb && tb.getBoundingClientRect();
      const under = t && t.height > 0 && t.bottom > 0 && t.top < 1 ? Math.round(t.bottom) : 0;
      return { show: e.classList.contains('show'), w: r.width, h: r.height, top: Math.round(r.top), expectTop: under }; });
    // Full width, at least 48 tall, directly under the session toolbar (or at
    // the very top when the toolbar is not on screen).
    check(b && b.show && b.w >= 389 && b.h >= 48 && Math.abs(b.top - b.expectTop) <= 1,
      'REST-END a full-width bar shows under the toolbar when the rest reaches zero', JSON.stringify(b));
    if (b && b.show) {
      const hit = await p.evaluate(() => {
        const bar = document.getElementById('mcRestEnd').getBoundingClientRect();
        const atBar = document.elementFromPoint(bar.left + bar.width / 2, bar.top + bar.height / 2);
        const end = document.getElementById('mcsEnd');
        let endOk = true;
        if (end && end.offsetParent !== null) {
          const er = end.getBoundingClientRect();
          const at = document.elementFromPoint(er.left + er.width / 2, er.top + er.height / 2);
          endOk = !!(at && (at === end || end.contains(at)));
        }
        return { barTakesTap: !!(atBar && atBar.id === 'mcRestEnd'), endOk };
      });
      check(!hit.barTakesTap && hit.endOk, 'REST-END the bar never takes a tap and leaves End workout reachable', JSON.stringify(hit));
      await p.evaluate(() => TMR.stop()); await sleep(300);
      check(!(await p.evaluate(() => document.getElementById('mcRestEnd').classList.contains('show'))),
        'REST-END the bar clears when the rest ends');
    }
    await c.close();
  });

  for (const pg of ['mm-p1.html', 'kitchen-sink.html', '2on-1off.html']) {
    await step('DAY-LIST ' + pg, async () => {
      const c = await ctx(browser, WAKE_STUB); const p = await page(c, errs, 'daylist-' + pg);
      await p.goto(BASE + '/' + pg); await sleep(1600);
      if (!(await p.locator('.mc-day-row').count())) { bad('DAY-LIST ' + pg + ' — no day list; the harness no longer matches the page'); await c.close(); return; }
      await p.locator('.mc-day-row').first().click(); await sleep(1500);
      const r = p.locator('.mcl-row:visible').first(); const i = r.locator('input');
      await i.nth(0).fill('60'); await i.nth(1).fill('5'); await r.locator('.mcl-ck').click(); await sleep(1000);
      const during = await p.evaluate(() => window.__held());
      await p.evaluate(() => TMR.stop()); await sleep(600);
      const o = await p.evaluate(() => ({ held: window.__held(), activity: !!(JSON.parse(localStorage.getItem('mc_activity') || '{}').last) }));
      check(during && o.held && o.activity, 'DAY-LIST ' + pg + ': entered from the day list, the screen is held and the session recorded',
        'during rest=' + during + ', after rest=' + o.held + ', activity=' + o.activity);
      await c.close();
    });
  }

  // ---- R5 ("flexible mid-session, one sheet contract") ----------------------
  await step('ADJUST', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'adjust');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const card = p.locator('.ex-card').first();
    const r0 = await card.locator('.mcl-row').count();
    await logSet(card, 0, 60, 5);
    await card.locator('[data-mcl-act=add]').click(); await sleep(900);
    const r1 = await card.locator('.mcl-row').count();
    const kept = await card.locator('.mcl-row').first().locator('.mcl-ck.done').count();
    const planned = await p.evaluate(() => MCSetlogUtil.plannedSetCount(document.querySelector('.ex-card')));
    check(r1 === r0 + 1 && kept === 1 && planned === r0 + 1, 'ADJUST + Add set adds a row, keeps the logged tick and grows the Finish total',
      'rows ' + r0 + '->' + r1 + ', tick kept ' + kept + ', planned ' + planned);
    await p.reload(); await sleep(2200);
    check((await p.locator('.ex-card').first().locator('.mcl-row').count()) === r0 + 1, 'ADJUST the added set is still there after a reload');
    const card2 = p.locator('.ex-card').nth(1);
    await card2.locator('.mcl-strip').click().catch(() => {}); await sleep(600);
    const skippedName = await card2.locator('.ex-name').first().textContent();
    await card2.locator('[data-mcl-act=skip]').click(); await sleep(1000);
    const sk = await p.evaluate(() => { const cd = document.querySelectorAll('.ex-card')[1];
      const a = document.querySelector('.ex-card.active, .ss-ex.active');
      return { planned: MCSetlogUtil.plannedSetCount(cd), checked: cd.classList.contains('checked'),
        active: a ? (a.querySelector('.ex-name, .ss-name') || {}).textContent : null }; });
    check(sk.planned === 0 && !sk.checked, 'ADJUST Skip exercise drops it from the Finish total without marking it trained', JSON.stringify(sk));
    check(sk.active && sk.active !== skippedName, 'ADJUST a skip moves on to the next exercise', JSON.stringify(sk));
    await card2.locator('.mcl-strip').click().catch(() => {}); await sleep(600);
    await card2.locator('[data-mcl-act=unskip]').click(); await sleep(900);
    check((await card2.locator('.mcl-row').count()) > 0, 'ADJUST Undo skip brings its sets back');
    await c.close();
  });

  for (const keep of [false, true]) {
    await step('REORDER ' + (keep ? 'kept' : 'today'), async () => {
      const c = await ctx(browser); const p = await page(c, errs, 'reorder');
      const names = () => p.evaluate(() => [...document.querySelectorAll('.ex-card')].slice(0, 2).map((x) => (x.querySelector('.ex-name') || {}).textContent));
      await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
      const before = await names();
      await p.locator('.ex-card').first().locator('.mc-meatball').click(); await sleep(400);
      await p.locator('.mc-item[data-act=reorder]').click(); await sleep(500);
      const box = await p.locator('.ex-card').first().locator('.mc-down').boundingBox();
      if (keep) await p.locator('.mc-rb-keep').click();
      await p.locator('.ex-card').first().locator('.mc-down').click(); await sleep(300);
      await p.locator('.mc-rb-done').click(); await sleep(300);
      await p.reload(); await sleep(2000);
      const moved = await names();
      await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('mc_ex_order_today_v1') || 'null'); if (v) { v.d = '2000-01-01'; localStorage.setItem('mc_ex_order_today_v1', JSON.stringify(v)); } });
      await p.reload(); await sleep(2000);
      const nextDay = await names();
      check(box && box.height >= 48, 'REORDER the arrows are at least 48px', box ? box.height + 'px' : 'no arrow');
      check(moved[0] === before[1], 'REORDER ' + (keep ? 'a kept' : "today's") + ' order survives a reload', JSON.stringify(moved));
      check(keep ? nextDay[0] === before[1] : nextDay[0] === before[0],
        keep ? 'REORDER a kept order is still there the next day' : 'REORDER a today-only order is gone the next day', JSON.stringify(nextDay));
      await c.close();
    });
  }

  await step('SHEET', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'sheet');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const open = () => p.evaluate(() => !!document.querySelector('.mc-menu-overlay.open'));
    await p.locator('.ex-card').first().locator('.mc-meatball').click(); await sleep(400);
    const a = await p.evaluate(() => { const o = document.querySelector('.mc-menu-overlay.open'); return o && { role: o.getAttribute('role'), modal: o.getAttribute('aria-modal'), focus: o.contains(document.activeElement) }; });
    check(a && a.role === 'dialog' && a.modal === 'true' && a.focus, 'SHEET a sheet is a modal dialog with focus inside it', JSON.stringify(a));
    await p.keyboard.press('Escape'); await sleep(300);
    const back = await p.evaluate(() => !!(document.activeElement && document.activeElement.classList.contains('mc-meatball')));
    check(!(await open()) && back, 'SHEET Escape closes it and focus returns to the control that opened it');
    await p.locator('.ex-card').first().locator('.mc-meatball').click(); await sleep(400);
    await p.goBack(); await sleep(600);
    check(!(await open()) && /mm-p1\.html/.test(p.url()), 'SHEET Back closes the sheet and stays on the page', p.url());
    const r = p.evaluate(() => MC_SHEET.confirm('Discard?', { ok: 'Discard', danger: true }));
    await sleep(300);
    const z = await p.evaluate(() => { const b = document.querySelector('[data-mcsh-ok]').getBoundingClientRect();
      const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!(el && el.closest('[data-mcsh-ok]')); });
    check(z, 'SHEET the in-app confirm sits above the bottom nav (its OK is tappable)');
    await p.locator('[data-mcsh-ok]').click();
    check((await r) === true, 'SHEET the in-app confirm resolves true on OK');
    await c.close();
  });

  await step('DAY-BACK', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'dayback');
    await p.goto(BASE + '/dashboard.html'); await sleep(800);
    await p.goto(BASE + '/mm-p1.html'); await sleep(1500);
    await p.locator('.mc-day-row').first().click(); await sleep(1000);
    await p.locator('.mc-day-back').click(); await sleep(700);
    await p.goBack(); await sleep(1500);
    check(/dashboard\.html/.test(p.url()), 'DAY-BACK after the on-screen "All days", one Back leaves the page (the spent entry is stepped over)', p.url());
    await c.close();
  });

  // ---- C ("program content and deloads") -----------------------------------
  // A declared deload week builds a real deload (D-25), including when the
  // athlete switches into it on the page rather than loading it: the answer
  // used to be cached once per page load, so week 5 -> week 6 built full
  // volume (34 rows of a 33-row week 5) until a reload.
  const planned = (p) => p.evaluate(() => [...document.querySelectorAll('.ex-card,.ss-ex')]
    .reduce((n, c) => n + window.MCSetlogUtil.plannedSetCount(c), 0));
  for (const [url, into, back] of [['/cat-strength.html?day=legs&week=5', 6, 5], ['/mm-p3.html?week=4&day=1', 5, 4]]) {
    await step('DELOAD ' + url, async () => {
      const c = await ctx(browser); const p = await page(c, errs, 'deload');
      await p.goto(BASE + url); await sleep(1500);
      const full = await planned(p);
      await p.locator('.wtab').nth(into - 1).click(); await sleep(1200);
      const dl = await planned(p);
      const note = await p.evaluate(() => (document.querySelector('.mcl-cut-deload') || {}).textContent || '');
      await p.locator('.wtab').nth(back - 1).click(); await sleep(1200);
      const again = await planned(p);
      check(full > 0 && dl * 3 <= full * 2, 'DELOAD ' + url + ' switching into the deload week cuts at least a third (' + full + ' -> ' + dl + ')');
      check(/Deload week/.test(note) && /short of failure/.test(note), 'DELOAD the card says it is a deload and caps the effort', note);
      check(again === full, 'DELOAD switching back out restores the full week (' + again + ')');
      await c.close();
    });
  }

  // ---- T (the tail) ---------------------------------------------------------
  // T1.5: a set ticked on week 1 is week 1's. The history key names the lift,
  // not the week, so it used to paint on week 2's same lift too, on a tab
  // switch and after a reload. Week 1 keeps it either way.
  for (const url of ['/mm-p1.html?day=1&week=1', '/cat-strength.html?day=legs&week=1']) {
    await step('WEEK-TICK ' + url, async () => {
      const c = await ctx(browser); const p = await page(c, errs, 'weektick');
      const ticks = () => p.evaluate(() => document.querySelectorAll('.mcl-ck.done').length);
      await p.goto(BASE + url); await sleep(1500);
      await logSet(p.locator('.ex-card, .ss-ex').first(), 0, 60, 5); await sleep(500);
      const w1 = await ticks();
      await p.locator('.wtab').nth(1).click(); await sleep(1200);
      const w2 = await ticks();
      await p.locator('.wtab').nth(0).click(); await sleep(1200);
      const back = await ticks();
      await p.goto(BASE + url.replace('week=1', 'week=2')); await sleep(1800);
      const w2r = await ticks();
      check(w1 === 1 && w2 === 0 && back === 1 && w2r === 0,
        'WEEK-TICK ' + url + ': a week-1 tick stays on week 1 (tab switch and reload)', JSON.stringify({ w1, w2, back, w2r }));
      await c.close();
    });
  }
  // T3: the same for a page with no day resolver. mc-engine.js keeps its week
  // in a top-level `activeWeek`, which mc-setlog.js now reads, so a week-1
  // tick no longer paints on week 2 after a reload (it did on main).
  await step('WEEK-TICK-PAGE', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'weektickpage');
    const ticks = () => p.evaluate(() => document.querySelectorAll('.mcl-ck.done').length);
    await p.goto(BASE + '/mc-s1-back.html?w=1'); await sleep(1800);
    await logSet(p.locator('.ex-card, .ss-ex').first(), 0, 60, 5); await sleep(500);
    const w1 = await ticks();
    await p.goto(BASE + '/mc-s1-back.html?w=2'); await sleep(1800);
    const w2 = await ticks();
    await p.goto(BASE + '/mc-s1-back.html?w=1'); await sleep(1800);
    const back = await ticks();
    check(w1 === 1 && w2 === 0 && back === 1,
      'WEEK-TICK-PAGE a week-1 tick stays on week 1 on a page with no day resolver', JSON.stringify({ w1, w2, back }));
    await c.close();
  });
  // One lift, two program weeks, one calendar day: both sets are kept. The
  // Modality Matrix is the program whose lifts stay fixed across weeks, so it
  // is where this happens (cat-strength's week 2 prescribes different lifts).
  for (const pg of ['/mm-p1.html?day=1&week=']) {
    await step('TWO-WEEKS ' + pg, async () => {
      const c = await ctx(browser); const p = await page(c, errs, 'twoweeks');
      const wOf = () => p.evaluate(() => { const r = document.querySelector('.mcl-row .mcl-ck.done');
        const row = r && r.closest('.mcl-row'); const w = row && row.querySelector('.mcl-w'); return w ? w.value : null; });
      const first = () => p.locator('.ex-card, .ss-ex').first();
      // After a tick the logger moves on to the next exercise (S3) and a
      // reload reopens THAT one, so the first card's rows may be unbuilt.
      const openFirst = () => p.evaluate(() => { const cd = document.querySelector('.ex-card, .ss-ex');
        if (window.MCSetlogUtil && MCSetlogUtil.ensureRowsBuilt) MCSetlogUtil.ensureRowsBuilt(cd);
        const row = cd.querySelector('.mcl-row'); if (row && !row.offsetParent) { const st = cd.querySelector('.mcl-strip'); if (st) st.click(); } }).then(() => sleep(400));
      await p.goto(BASE + pg + '1'); await sleep(1800);
      await logSet(first(), 0, 100, 5); await sleep(500);
      await p.goto(BASE + pg + '2'); await sleep(1800);
      await openFirst(); await logSet(first(), 0, 110, 5); await sleep(700);
      const stored = await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
        const k = Object.keys(s).find((x) => s[x][0] && s[x][0].sets && s[x][0].sets[1]);
        return k ? Object.keys(s[k][0].sets).map((n) => n + '=' + s[k][0].sets[n].w).sort().join(',') : '';
      });
      await p.reload(); await sleep(2500);
      const w2 = await wOf();
      await p.goto(BASE + pg + '1'); await sleep(1800);
      const w1 = await wOf();
      await p.goto(BASE + pg + '2'); await sleep(1800);
      await openFirst(); await first().locator('.mcl-row').nth(0).locator('.mcl-ck').click(); await sleep(800);
      await p.goto(BASE + pg + '1'); await sleep(1800);
      const w1After = await wOf();
      check(/^1=100,1@\w+=110$/.test(stored) && w2 === '110' && w1 === '100' && w1After === '100',
        'TWO-WEEKS ' + pg + ' both weeks keep their own set 1, and an untick on one leaves the other',
        JSON.stringify({ stored, w2, w1, w1After }));
      await c.close();
    });
  }
  // T1.6: undoing a swap keeps the sets done on the substitute on the card,
  // labelled with the lift they were done on, after a reload too. They used
  // to drop off the card (and out of its count) the moment the swap was undone.
  await step('SWAP-UNDO', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'swapundo');
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(2000);
    const card = p.locator('.ex-card').first();
    await logSet(card, 0, 60, 5); await logSet(card, 1, 60, 5);
    await card.locator('.mc-meatball').click(); await sleep(400);
    await p.locator('.mc-item[data-act=replace]').first().click();
    await p.waitForSelector('.mc-sub-row', { timeout: 15000 });
    await p.locator('.mc-sub-row').first().click(); await sleep(1200);
    await logSet(card, 2, 70, 8);
    // The Undo toast is short-lived; press it the moment the set is in.
    const undone = await p.evaluate(() => { const b = document.querySelector('.mc-toast-btn'); if (!b) return false; b.click(); return true; });
    await sleep(1500);
    const read = () => p.evaluate(() => { const cd = document.querySelector('.ex-card');
      return { done: cd.querySelectorAll('.mcl-ck.done').length, carried: cd.querySelectorAll('.mcl-row.mcl-carried').length }; });
    const now = await read();
    await p.reload(); await sleep(3000);
    const after = await read();
    check(undone && now.done === 3 && now.carried === 1 && after.done === 3 && after.carried === 1,
      'SWAP-UNDO after an undo the substitute\'s set stays on the card, done and labelled (and after a reload)',
      JSON.stringify({ undone, now, after }));
    await c.close();
  });
  // T1.8: a set logged on the program's deload week is marked as one, so the
  // progression engine reads past it the week after.
  await step('DELOAD-TAG', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'dltag');
    await p.goto(BASE + '/cat-strength.html?day=legs&week=6'); await sleep(1500);
    await logSet(p.locator('.ex-card, .ss-ex').first(), 0, 60, 5); await sleep(500);
    const tagged = await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      return Object.keys(s).some((k) => (s[k] || []).some((x) => x && x.sets && Object.values(x.sets).some((v) => v && v.dl === 1)));
    });
    check(tagged, 'DELOAD-TAG a set logged on the deload week carries the deload mark');
    await c.close();
  });

  // Pos 4 is the Modality Matrix's TUT anchor (D-26): its tempo shows on the
  // card in every week, including inside the tri-set group mc-group-split.js
  // builds (whose digit match cut "3s down · 2s pause" to "3").
  await step('TUT', async () => {
    const c = await ctx(browser); const p = await page(c, errs, 'tut');
    let seen = 0;
    for (const w of [1, 2, 3, 4, 5]) {
      await p.goto(BASE + '/mm-p2.html?week=' + w + '&day=2'); await sleep(700);
      const t = await p.evaluate(() => [...document.querySelectorAll('.a-ss-tempo, .a-pill.tempo')].map((e) => e.textContent));
      if (t.some((x) => /3s down · 2s pause/.test(x))) seen++;
    }
    check(seen === 5, 'TUT the Pos 4 tempo badge is on the card in all 5 weeks (' + seen + ')');
    await c.close();
  });

  check(errs.length === 0, 'no page errors on any journey', errs.slice(0, 5).join(' | '));
  await browser.close();
  console.log('\n' + (passed + failed) + ' checks: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
