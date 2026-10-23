#!/usr/bin/env node
'use strict';
/* Flagship audit — browser reproductions (Phase 3 gym-readiness defects).
   Drives the real app in headless Chromium. Every check asserts the EXPECTED
   behaviour from flagship-readiness-roadmap.md, so on the audited tree
   (main @ 27fc096) the open defects show up as FAIL lines. Each one should
   flip to PASS when its roadmap step ships — use them as acceptance tests.

   Usage:
     python3 -m http.server 8080 &          # from the repo root
     NODE_PATH=<dir with playwright> node GO_LIVE/flagship-audit/scenarios/fa-repro.js http://localhost:8080
     MC_CHROMIUM=/path/to/chrome ...        # optional browser override
*/
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const EXE = process.env.MC_CHROMIUM || undefined;
const BLOCK = /fonts\.(googleapis|gstatic)\.com|supabase\.co|jsdelivr/;

let pass = 0, fail = 0;
function report(id, title, ok, expected, observed) {
  if (ok) pass++; else fail++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + id + ' ' + title + ' — expected: ' + expected +
    (ok ? '' : ' | observed: ' + observed));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ctx(browser, init, extra) {
  const c = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, extra || {}));
  await c.route(BLOCK, (r) => r.abort());
  if (init) await c.addInitScript(init);
  return c;
}
async function logSet(page, card, row, w, r) {
  const rw = card.locator('.mcl-row').nth(row);
  const inp = rw.locator('input');
  await inp.nth(0).fill(String(w));
  await inp.nth(1).fill(String(r));
  await rw.locator('.mcl-ck').click();
  await sleep(300);
}
async function finishViaModal(page) {
  await page.locator('#mcsEnd').click();
  await sleep(500);
  await page.evaluate(() => window._FW && _FW.confirm());
  await sleep(2500);
}
const sessionSets = (page, pid) => page.evaluate((p) => {
  const s = JSON.parse(localStorage.getItem('mc_session_v1') || '{}')[p];
  return s && s.sets ? s.sets.length : 0;
}, pid);

// Wake-lock stub that records calls and auto-releases on hide, like a browser.
const WAKE_STUB = () => {
  window.__wl = []; let cur = null;
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

async function run(browser, id, title, fn) {
  try { await fn(); }
  catch (e) { report(id, title, false, 'check completes', 'ERROR ' + String(e.message).split('\n')[0].slice(0, 120)); }
}

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  console.log('Flagship audit — browser reproductions against ' + BASE + '\n');

  // C-01 / C-02 — CONTROLS. These pass on the audited tree; if either fails,
  // the harness or the environment is broken and the FAIL lines below mean nothing.
  await run(browser, 'C-01', 'control: a refresh restores ticked sets', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const card = p.locator('.ex-card').first();
    await logSet(p, card, 0, 60, 5); await logSet(p, card, 1, 60, 5); await sleep(800);
    await p.reload(); await sleep(3000);
    const t = await p.evaluate(() => (document.getElementById('fwProgress') || {}).textContent || '');
    report('C-01', 'control: a refresh restores ticked sets', /^2\//.test(t), '2/… on the session counter', t || '(no counter)');
    await c.close();
  });
  await run(browser, 'C-02', 'control: an exercise can be logged out of order', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const later = p.locator('.ex-card').nth(3);
    await later.locator('.mcl-strip').click(); await sleep(700);
    await logSet(p, later, 0, 40, 12); await sleep(600);
    const t = await p.evaluate(() => (document.getElementById('fwProgress') || {}).textContent || '');
    report('C-02', 'control: an exercise can be logged out of order', /^1\//.test(t), '1/… on the session counter', t || '(no counter)');
    await c.close();
  });

  // R-01 — a week/phase/cycle tab round trip keeps the session (7 engines)
  const TAB_PAGES = ['mm-p2.html?day=1&week=1', 'kitchen-sink.html?day=1&week=1', 'iron-engine.html?day=1&week=1',
    'hv-block.html?day=1&week=1', 'cat-strength.html?day=legs&week=1', 'psu-strength.html', 'bro-split.html'];
  for (const pg of TAB_PAGES) {
    await run(browser, 'R-01', 'tab round trip keeps the session on ' + pg.split('?')[0], async () => {
      const c = await ctx(browser); const p = await c.newPage();
      await p.goto(BASE + '/' + pg); await sleep(1800);
      if (/^(bro|psu)/.test(pg)) { const h = p.locator('.day-header').first(); if (await h.count()) { await h.click(); await sleep(800); } }
      const pid = pg.split('.html')[0];
      const r = p.locator('.mcl-row:visible').first(); const i = r.locator('input');
      await i.nth(0).fill('100'); await i.nth(1).fill('8'); await r.locator('.mcl-ck').click(); await sleep(900);
      const tabs = p.locator('button.wtab, button.tab, button.week-tab, button.day-tab, .phase-tab, [data-week]');
      if ((await tabs.count()) > 1) { await tabs.nth(1).click(); await sleep(1200); await tabs.nth(0).click(); await sleep(1500); }
      const n = await sessionSets(p, pid);
      report('R-01', 'tab round trip keeps the session on ' + pid, n >= 1, '≥1 set in mc_session_v1', n + ' sets (record deleted)');
      await c.close();
    });
  }

  // R-02 — the custom workout's own Finish button saves the logged sets
  await run(browser, 'R-02', 'custom workout Finish saves logged sets', async () => {
    const c = await ctx(browser, () => { if (!localStorage.getItem('_fa')) { localStorage.setItem('_fa', '1');
      localStorage.setItem('mc_custom_workouts_v1', JSON.stringify([{ id: 'fa1', name: 'FA Push', exercises: [
        { name: 'Bench Press', sets: 3, reps: '8', rest: 90 }, { name: 'Cable Fly', sets: 3, reps: '12', rest: 60 }] }])); } });
    const p = await c.newPage(); p.on('dialog', (d) => d.accept());
    await p.goto(BASE + '/run-workout.html?id=fa1'); await sleep(2200);
    const card = p.locator('.ex-card').first();
    await logSet(p, card, 0, 135, 8); await logSet(p, card, 1, 135, 8); await sleep(800);
    const bar = p.locator('.fw-bar .fw-btn');
    if (await bar.count()) { await bar.first().click(); await sleep(2500); }
    else { await finishViaModal(p); }
    const n = await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]'); return L.length ? (L[L.length - 1].sets || []).length + '/' + (L[0].sets || []).length : 'none'; });
    const best = Math.max.apply(null, String(n).split('/').map(Number).filter((x) => !isNaN(x)).concat([0]));
    report('R-02', 'custom workout Finish saves logged sets', best === 2, '2 sets saved', n === 'none' ? 'no entry' : best + ' sets saved');
    await c.close();
  });

  // R-03 — unticking a set removes it from the finished workout
  await run(browser, 'R-03', 'untick removes the set', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/iron-engine.html?day=1&week=1'); await sleep(2000);
    const card = p.locator('.ex-card').first();
    await logSet(p, card, 0, 135, 12);
    await logSet(p, card, 1, 155, 12);
    await card.locator('.mcl-row').nth(1).locator('.mcl-ck').click(); await sleep(600);
    await finishViaModal(p);
    const n = await p.evaluate(() => (JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]')[0] || { sets: [] }).sets.length);
    report('R-03', 'untick removes the set', n === 1, '1 set saved', n + ' sets saved');
    await c.close();
  });

  // R-04 — a running rest timer survives a refresh
  await run(browser, 'R-04', 'rest timer survives a refresh', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    await logSet(p, p.locator('.ex-card').first(), 0, 60, 5); await sleep(700);
    const stored = await p.evaluate(() => ((JSON.parse(localStorage.getItem('mc_session_v1') || '{}')['mm-p1'] || {}).timer) || null);
    await p.reload(); await sleep(3000);
    const after = await p.evaluate(() => {
      const vis = (el) => !!(el && el.offsetParent !== null);
      const shown = vis(document.getElementById('mclRestVal')) || vis(document.querySelector('#timerFloat.visible')) || vis(document.querySelector('#timerVideo.visible'));
      return { running: typeof TMR !== 'undefined' && TMR.isRunning(), shown: shown };
    });
    report('R-04', 'rest timer survives a refresh', !!stored && after.running && after.shown,
      'timer stored, running and visible after reload',
      'stored=' + (stored ? 'yes' : 'null') + ', running=' + after.running + ', visible=' + after.shown);
    await c.close();
  });

  // R-05 — a typed (unticked) weight survives a refresh while the field has focus
  await run(browser, 'R-05', 'typed weight survives a refresh', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const inp = p.locator('.ex-card').first().locator('.mcl-row').nth(1).locator('.mcl-w');
    await inp.click(); await inp.fill('142.5'); await sleep(1500);
    await p.reload(); await sleep(3000);
    const v = await p.evaluate(() => { const c0 = document.querySelector('.ex-card'); if (window.MCSetlogUtil && MCSetlogUtil.ensureRowsBuilt) MCSetlogUtil.ensureRowsBuilt(c0);
      const x = c0.querySelectorAll('.mcl-row')[1].querySelector('.mcl-w'); return x.value + (x.classList.contains('mcl-ghost') ? ' (ghost)' : ''); });
    report('R-05', 'typed weight survives a refresh', v === '142.5', '142.5', v || '(empty)');
    await c.close();
  });

  // R-06 — the screen is kept awake from the first logged set
  await run(browser, 'R-06', 'wake lock from the first set', async () => {
    const c = await ctx(browser, WAKE_STUB); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    await logSet(p, p.locator('.ex-card').first(), 0, 60, 5); await sleep(1200);
    const n = await p.evaluate(() => window.__wl.filter((x) => x === 'request').length);
    report('R-06', 'wake lock from the first set', n >= 1, '≥1 wake-lock request after set 1', n + ' requests');
    await c.close();
  });

  // R-07 — the wake lock comes back after an interruption (call, text, app switch)
  await run(browser, 'R-07', 'wake lock re-acquired after an interruption', async () => {
    const c = await ctx(browser, WAKE_STUB); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    const card = p.locator('.ex-card').first();
    for (let s = 0; s < 5; s++) await logSet(p, card, s, 60, 5);
    await sleep(800); await p.evaluate(() => typeof TMR !== 'undefined' && TMR.stop());
    const before = await p.evaluate(() => window.__wl.filter((x) => x === 'request').length);
    await p.evaluate(() => window.__hide()); await sleep(300); await p.evaluate(() => window.__show()); await sleep(800);
    const after = await p.evaluate(() => window.__wl.filter((x) => x === 'request').length);
    report('R-07', 'wake lock re-acquired after an interruption', before >= 1 && after > before,
      'a new request after returning', 'requests before=' + before + ', after return=' + after);
    await c.close();
  });

  // R-08 — the suggested load is what one tap logs
  await run(browser, 'R-08', 'suggested load reaches the prefill', async () => {
    const c = await ctx(browser, () => { if (!localStorage.getItem('_fa')) { localStorage.setItem('_fa', '1');
      localStorage.setItem('mc_setlog_v1', JSON.stringify({ 'iron-engine|x-bb-flat-bench-press': [{ d: '2026-10-16', ts: Date.parse('2026-10-16T10:00:00Z'),
        sets: { 1: { w: '135', r: '12' }, 2: { w: '155', r: '12' }, 3: { w: '175', r: '10' }, 4: { w: '185', r: '8' } } }] })); } });
    const p = await c.newPage(); await p.goto(BASE + '/iron-engine.html?day=1&week=1'); await sleep(4000);
    const o = await p.evaluate(() => { const cd = document.querySelector('.ex-card');
      const sug = ((cd.querySelector('.mcl-suggest') || {}).textContent || '').match(/(\d+(?:\.\d+)?)/);
      const ws = [...cd.querySelectorAll('.mcl-row .mcl-w')].map((x) => x.value); return { sug: sug ? sug[1] : null, top: ws[ws.length - 1] }; });
    report('R-08', 'suggested load reaches the prefill', o.sug && o.top === o.sug, 'top set prefills ' + o.sug, 'top set prefills ' + o.top);
    await c.close();
  });

  // R-09 / R-10 — a swap is today-only and the substitute keeps its own history
  await run(browser, 'R-09', 'swap: substitute sets keep their own history', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(2000);
    const card = p.locator('.ex-card').first();
    await logSet(p, card, 0, 60, 5); await logSet(p, card, 1, 60, 5);
    await card.locator('.mc-meatball').click(); await sleep(400);
    await p.locator('.mc-item[data-act=replace]').first().click();
    await p.waitForSelector('.mc-sub-row', { timeout: 15000 });
    await p.locator('.mc-sub-row').first().click(); await sleep(1200);
    await logSet(p, card, 2, 70, 8); await sleep(600);
    const orig = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}')['mm-p1|x-incline-db-press'];
      return s && s[0] ? Object.keys(s[0].sets).join(',') : ''; });
    report('R-09', 'swap: substitute sets keep their own history', orig === '1,2', "original lift's history holds sets 1,2 only", 'sets ' + orig);
    await p.goto(BASE + '/kitchen-sink.html?day=1'); await sleep(1800);
    const leaked = await p.evaluate(() => document.querySelectorAll('.replaced-badge').length);
    report('R-10', 'swap does not leak into another program', leaked === 0, '0 replaced cards on kitchen-sink', leaked + ' replaced');
    await c.close();
  });

  // R-11 — history shows exercise names, not storage keys
  await run(browser, 'R-11', 'history shows exercise names', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(2000);
    await logSet(p, p.locator('.ex-card').first(), 0, 50, 8); await sleep(500);
    await finishViaModal(p);
    const names = await p.evaluate(() => [...new Set(((JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]')[0] || {}).sets || []).map((s) => s.name))]);
    const raw = names.filter((n) => /^x-/.test(n));
    report('R-11', 'history shows exercise names', names.length > 0 && raw.length === 0, 'names like "Incline DB Press"', JSON.stringify(names));
    await c.close();
  });

  // R-12 — history keys don't collide (real key rule over the whole catalog)
  await run(browser, 'R-12', 'exercise keys do not collide', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(2000);
    await p.waitForFunction(() => window.EXERCISES && window.EXERCISES.length > 500 && window.MCSetlogUtil, null, { timeout: 15000 });
    const o = await p.evaluate(() => {
      const keyOf = (name) => { const d = document.createElement('div'); d.className = 'ex-card';
        d.innerHTML = '<div class="ex-name"></div>'; d.firstChild.textContent = name; return MCSetlogUtil.exIdOf(d); };
      const groups = {}; let drift = 0;
      window.EXERCISES.forEach((e) => { const k = keyOf(e.name); (groups[k] = groups[k] || new Set()).add(e.name);
        if (window.MC_MUSCLES) { const a = MC_MUSCLES.classify(e.name), b = MC_MUSCLES.classify(k); if ((a && a.id) !== (b && b.id)) drift++; } });
      const coll = Object.values(groups).filter((s) => s.size > 1);
      return { groups: coll.length, names: coll.reduce((n, s) => n + s.size, 0), drift: drift, total: window.EXERCISES.length };
    });
    report('R-12', 'exercise keys do not collide', o.groups === 0, '0 shared keys', o.groups + ' keys shared by ' + o.names + ' exercises');
    console.log('        (informational) exercises whose stored key classifies to a different muscle than their name: ' + o.drift + ' of ' + o.total);
    await c.close();
  });

  // R-13 — restoring an older backup never erases newer workouts
  await run(browser, 'R-13', 'older backup keeps newer workouts', async () => {
    const c = await ctx(browser, null, { acceptDownloads: true }); const p = await c.newPage(); p.on('dialog', (d) => d.accept());
    await p.goto(BASE + '/dashboard.html'); await sleep(1200);
    await p.evaluate(() => { const L = [0, 1, 2].map((i) => { const d = new Date(Date.now() - (i + 1) * 1728e5).toISOString();
      return { id: 'mm-p1|' + d, pageId: 'mm-p1', workoutName: 'FA #' + (3 - i), date: d, sets: [{ name: 'Incline DB Press', setNum: 1, weight: '60', reps: '5' }], prs: 0, setsChecked: 1 }; });
      localStorage.setItem('mc_workout_log_v1', JSON.stringify(L)); });
    await p.reload(); await sleep(1500);
    await p.evaluate(() => document.querySelector('.avatar').click()); await sleep(800);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('#acctExport')]);
    const file = await dl.path();
    await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('mc_workout_log_v1'));
      L.unshift({ id: 'mm-p1|new', pageId: 'mm-p1', workoutName: 'FA newest', date: new Date().toISOString(), sets: [], prs: 0, setsChecked: 0 });
      localStorage.setItem('mc_workout_log_v1', JSON.stringify(L)); });
    await p.reload(); await sleep(1200);
    await p.evaluate(() => document.querySelector('.avatar').click()); await sleep(800);
    await p.setInputFiles('#acctImportFile', file); await sleep(2500);
    const names = await p.evaluate(() => JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]').map((e) => e.workoutName));
    report('R-13', 'older backup keeps newer workouts', names.indexOf('FA newest') !== -1, '"FA newest" still present', names.length + ' workouts: ' + JSON.stringify(names));
    await c.close();
  });

  // R-14 — the phone's Back gesture returns from an open day to the day list
  await run(browser, 'R-14', 'Back returns to the day list', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/dashboard.html'); await sleep(800);
    await p.goto(BASE + '/mm-p1.html'); await sleep(1500);
    await p.locator('.mc-day-row').first().click(); await sleep(1200);
    await p.goBack(); await sleep(1200);
    const where = p.url().split('/').pop();
    const rows = await p.evaluate(() => document.querySelectorAll('.mc-day-row').length);
    report('R-14', 'Back returns to the day list', /^mm-p1\.html/.test(where) && rows > 0, 'mm-p1 day list', where + ' (' + rows + ' day rows)');
    await c.close();
  });

  // R-15 — the exercise sheet behaves like a sheet: Escape closes it, the page behind stays put
  await run(browser, 'R-15', 'exercise sheet: Escape closes, page behind locked', async () => {
    const c = await ctx(browser); const p = await c.newPage();
    await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
    await p.locator('.ex-card').first().locator('.mc-meatball').click(); await sleep(500);
    const y0 = await p.evaluate(() => scrollY); await p.mouse.move(195, 150); await p.mouse.wheel(0, 500); await sleep(400);
    const moved = (await p.evaluate(() => scrollY)) - y0;
    await p.keyboard.press('Escape'); await sleep(400);
    const open = await p.evaluate(() => { const o = document.querySelector('.mc-menu-overlay'); return !!(o && getComputedStyle(o).display !== 'none' && o.classList.contains('open')); });
    report('R-15', 'exercise sheet: Escape closes, page behind locked', moved === 0 && !open, 'page did not scroll; sheet closed',
      'page scrolled ' + moved + 'px; sheet ' + (open ? 'still open' : 'closed'));
    await c.close();
  });

  await browser.close();
  console.log('\n' + (pass + fail) + ' checks: ' + pass + ' pass, ' + fail + ' fail' +
    (fail ? '  (each FAIL is an open item in flagship-readiness-roadmap.md)' : ''));
  process.exit(fail ? 1 : 0);
})();
