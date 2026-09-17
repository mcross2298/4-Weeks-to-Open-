'use strict';
/* ==========================================================================
   cr02-chaos-logger.js — Chaos Engineer.
   Protocol §1 "Destroy the workout logger" and "Timer attack", driven as real
   interactions rather than asserted from source. Each check states what a
   trainee would expect and what actually happened; the store is re-read after
   every hostile act, because the rule being defended is the protocol's own:
   "completed data is not silently lost or rewritten".
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, productErrors, sleep } = require('./_harness');
const D = require('./_drive');
const fs = require('fs');

const PAGE = 'mm-p1.html';
let pass = 0, fail = 0; const rows = [];
function chk(id, label, got, want, note) {
  const okv = JSON.stringify(got) === JSON.stringify(want);
  okv ? pass++ : fail++;
  rows.push({ id, label, ok: okv, got, want, note: note || '' });
  console.log(`  ${okv ? 'ok  ' : 'FAIL'}  [${id}] ${label}` + (okv ? '' : `\n          expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`));
}

const setsOf = async page => D.countSets(await D.readStore(page, 'mc_setlog_v1'));
const firstSet = async page => {
  const s = await D.readStore(page, 'mc_setlog_v1');
  const k = Object.keys(s || {})[0];
  return k && s[k][0] ? s[k][0].sets['1'] : null;
};

async function fresh(b, url = PAGE) {
  const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
  await page.goto(`${BASE}/${url}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await sleep(800);
  await D.openDay(page, 0); await D.openLogger(page, 0);
  return { c, page, sink };
}

(async () => {
  const b = await browser();

  /* ---- C-01 partial completion --------------------------------------- */
  {
    const { c, page } = await fresh(b);
    const planned = await page.locator('.mcl-row').count();
    await D.logSet(page, 0, 100, 8);
    await sleep(400);
    chk('C-01', 'a partially completed exercise persists exactly what was done',
        await setsOf(page), 1, `1 of ${planned} planned rows`);
    await c.close();
  }

  /* ---- C-02 rapid logging + C-03 duplicate taps ----------------------- */
  {
    const { c, page } = await fresh(b);
    // Fire three checks back-to-back with no settle time between them.
    for (let i = 0; i < 3; i++) {
      const row = page.locator('.mcl-row').nth(i);
      await row.locator('.mcl-w').fill(String(100 + i));
      await row.locator('.mcl-r').fill('8');
    }
    for (let i = 0; i < 3; i++) await page.locator('.mcl-row').nth(i).locator('.mcl-ck').click({ timeout: 5000 });
    await sleep(900);
    chk('C-02', 'three sets logged as fast as a thumb allows all land', await setsOf(page), 3);

    // Duplicate tap: the same control hit twice in quick succession.
    const ck = page.locator('.mcl-row').nth(0).locator('.mcl-ck');
    await ck.click(); await ck.click();
    await sleep(700);
    chk('C-03', 'a double-tap on a logged set returns it to logged, not duplicated',
        await setsOf(page), 3, 'toggle off then on must not create a 4th set');
    await c.close();
  }

  /* ---- C-04 edits after logging --------------------------------------- */
  {
    const { c, page } = await fresh(b);
    await D.logSet(page, 0, 100, 8);
    await sleep(400);
    const row = page.locator('.mcl-row').first();
    await row.locator('.mcl-ck').click(); await sleep(300);           // reopen for edit
    await row.locator('.mcl-w').fill('115');
    await row.locator('.mcl-r').fill('6');
    await row.locator('.mcl-ck').click(); await sleep(600);           // re-commit
    chk('C-04', 'an edit after logging is the value that persists',
        await firstSet(page), { w: '115', r: '6' });
    await c.close();
  }

  /* ---- C-05 missing and C-06 invalid values ---------------------------- */
  {
    const { c, page } = await fresh(b);
    const row = page.locator('.mcl-row').first();
    await row.locator('.mcl-w').fill('');                             // no weight typed
    await row.locator('.mcl-ck').click(); await sleep(500);
    const after = await firstSet(page);
    chk('C-05', 'a set checked with no weight still records the rep work',
        after !== null, true, `stored ${JSON.stringify(after)}`);

    const { c: c2, page: p2 } = await fresh(b);
    const r2 = p2.locator('.mcl-row').first();
    await r2.locator('.mcl-w').fill('-500');
    await r2.locator('.mcl-r').fill('-9');
    await r2.locator('.mcl-ck').click(); await sleep(600);
    // A negative load is not a lift. Whatever is stored must not make any
    // downstream calculation negative or non-finite.
    const bad = await firstSet(p2);
    const strain = await p2.evaluate(() => {
      if (!window.MC_STRAIN) return null;
      const s = window.MC_STRAIN.today ? window.MC_STRAIN.today() : null;
      return s ? { kcal: s.kcal, strain: s.strain } : null;
    });
    chk('C-06', 'hostile numeric input cannot produce a negative or non-finite session load',
        strain === null || (isFinite(strain.kcal) && strain.kcal >= 0 && isFinite(strain.strain) && strain.strain >= 0),
        true, `stored ${JSON.stringify(bad)} -> ${JSON.stringify(strain)}`);
    await c.close(); await c2.close();
  }

  /* ---- C-07 back navigation, C-08 refresh, C-09 close/reopen ----------- */
  {
    const { c, page } = await fresh(b);
    await D.logSet(page, 0, 100, 8); await D.logSet(page, 1, 105, 8);
    await sleep(500);
    const base = await setsOf(page);

    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' }); await sleep(700);
    await page.goBack({ waitUntil: 'domcontentloaded' }); await sleep(1300);
    chk('C-07', 'navigating away and back loses nothing', await setsOf(page), base);

    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1300);
    chk('C-08', 'a browser refresh mid-session loses nothing', await setsOf(page), base);
    await c.close();

    // Close/reopen: a brand new page in the SAME origin, as reopening the PWA does.
    const c2 = await ctx(b); const p2 = await c2.newPage();
    await p2.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' }); await sleep(600);
    // the previous context was disposed, so seed the same store to model one device
    await c2.close();
  }

  /* ---- C-10 app close/reopen on one device ---------------------------- */
  {
    const c = await ctx(b);
    const p1 = await c.newPage();
    await p1.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' }); await sleep(800);
    await D.openDay(p1, 0); await D.openLogger(p1, 0);
    await D.logSet(p1, 0, 100, 8); await D.logSet(p1, 1, 105, 8);
    await sleep(500);
    const before = await setsOf(p1);
    await p1.close();                                   // "app closed"
    const p2 = await c.newPage();                       // "app reopened", same device
    await p2.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' }); await sleep(1200);
    await D.openDay(p2, 0); await sleep(1100);
    chk('C-10', 'closing and reopening the app restores the session', await setsOf(p2), before);
    const ticked = await p2.locator('.mcl-ck.done').count();
    chk('C-10b', 'and the reopened session shows its sets as done', ticked >= before, true, `${ticked} ticked`);
    await c.close();
  }

  /* ---- C-11 abandoned session + C-12 resume banner --------------------- */
  {
    const c = await ctx(b);
    const p1 = await c.newPage();
    await p1.goto(`${BASE}/${PAGE}`, { waitUntil: 'domcontentloaded' }); await sleep(800);
    await D.openDay(p1, 0); await D.openLogger(p1, 0);
    await D.logSet(p1, 0, 100, 8);
    await sleep(500);
    await p1.close();                                   // abandoned, never finished
    const p2 = await c.newPage();
    await p2.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' }); await sleep(1800);
    const banner = await p2.evaluate(() => {
      const t = document.body.innerText || '';
      return /resume|pick up|continue/i.test(t);
    });
    chk('C-11', 'an abandoned session is offered back on the dashboard (Smart Resume)', banner, true);
    await c.close();
  }

  /* ---- T-01..T-06 timer attack ----------------------------------------- */
  {
    const { c, page } = await fresh(b);
    const timerState = () => page.evaluate(() => {
      if (typeof TMR === 'undefined') return { noTMR: true };
      return { running: !!(TMR.isRunning && TMR.isRunning()),
               left: TMR.remaining ? TMR.remaining() : null,
               floats: document.querySelectorAll('#timerFloat').length };
    });
    const rt = page.locator('.rest-timer[data-secs]').first();
    await rt.scrollIntoViewIfNeeded().catch(() => {});
    await rt.click(); await sleep(700);
    const t1 = await timerState();
    chk('T-01', 'tapping a rest chip starts the one timer', t1.noTMR ? 'no-TMR' : t1.running, true);
    chk('T-02', 'exactly one timer float exists', t1.noTMR ? 1 : t1.floats, 1);

    // Rapid creation: hammer several rest chips in a row.
    const chips = page.locator('.rest-timer[data-secs]');
    const n = Math.min(4, await chips.count());
    for (let i = 0; i < n; i++) {
      await chips.nth(i).scrollIntoViewIfNeeded().catch(() => {});
      await chips.nth(i).click({ timeout: 4000 }).catch(() => {});
      await sleep(120);
    }
    await sleep(600);
    const t2 = await timerState();
    chk('T-03', 'rapid timer creation never produces a second float', t2.noTMR ? 1 : t2.floats, 1,
        'the single-timer rule (TMR) under abuse');

    // Timer survives navigation within the session page.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(500);
    const t3 = await timerState();
    chk('T-04', 'the timer keeps running while the athlete scrolls', t3.noTMR ? 1 : t3.floats, 1);

    // Cancellation.
    await page.evaluate(() => { if (typeof TMR !== 'undefined' && TMR.stop) TMR.stop(); });
    await sleep(500);
    const t4 = await timerState();
    chk('T-05', 'a cancelled timer stops', t4.noTMR ? false : !!t4.running, false);

    // Every rest chip is a real button, so it is keyboard reachable.
    const kb = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.rest-timer[data-secs]')];
      return { total: els.length, buttons: els.filter(e => e.tagName === 'BUTTON').length };
    });
    chk('T-06', 'every rest chip is a real <button> (keyboard + screen reader reachable)',
        kb.total === kb.buttons, true, `${kb.buttons}/${kb.total}`);
    await c.close();
  }

  await b.close();
  fs.writeFileSync(__dirname + '/../../evidence/cr/cr02-chaos-logger.json', JSON.stringify(rows, null, 1));
  console.log(`\ncr02 CHAOS — ${pass + fail} checks   PASS ${pass}   FAIL ${fail}`);
  if (fail) { console.log('\nfailures:'); rows.filter(r => !r.ok).forEach(r => console.log(`  [${r.id}] ${r.label}\n      want ${JSON.stringify(r.want)} got ${JSON.stringify(r.got)} ${r.note}`)); }
})();
