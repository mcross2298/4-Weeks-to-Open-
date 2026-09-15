/* GO_LIVE scenario set 1 — "Destroy the workout logger"
   Personas: serious lifter, real gym user, chaos user.
   Drives the real app in headless Chromium. Every assertion reads the real
   store or the real DOM, never a mock. */
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const PAGE = '/mm-p1.html?day=1';
const NEUTRAL = '/manifest.json';
const SK = 'mc_setlog_v1', WL = 'mc_workout_log_v1', SESS = 'mc_session_v1';

let pass = 0, fail = 0; const notes = [];
const ok = (n, extra) => { pass++; console.log(`  ok    ${n}${extra ? '  [' + extra + ']' : ''}`); };
const bad = (n, got, want) => { fail++; console.log(`  FAIL  ${n} — observed: ${got} | expected: ${want}`); };
const t = (n, g, w) => (String(g) === String(w) ? ok(n, String(g)) : bad(n, g, w));

async function reset(pg) {
  await pg.goto(BASE + NEUTRAL, { waitUntil: 'load' });
  for (let i = 0; i < 6; i++) {
    await pg.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await pg.waitForTimeout(200);
    const left = await pg.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('mc_') === 0).length);
    if (!left) break;
  }
}
async function open(pg, url) {
  await pg.goto(BASE + (url || PAGE), { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => document.querySelectorAll('.mcl-strip').length > 0, null, { timeout: 20000 });
}
// Log one set on card #ix with a given weight; returns 'OK' or a diagnostic.
async function logSet(pg, weight, reps, ix) {
  return pg.evaluate(([w, r, i]) => {
    const strip = document.querySelectorAll('.mcl-strip')[i];
    if (!strip) return 'NOSTRIP';
    const card = strip.closest('.ex-card, .ss-ex, .ex-item') || strip.parentElement;
    const pick = () => {
      const wrap = card.querySelector('.mcl-wrap');
      if (!wrap || !wrap.classList.contains('open')) return null;
      return wrap.querySelector('.mcl-ck:not(.done)');
    };
    let ck = pick(); if (!ck) { strip.click(); ck = pick(); }
    if (!ck) return 'NOROW';
    const row = ck.closest('.mcl-row') || ck.parentElement;
    const wi = row.querySelector('.mcl-w'), ri = row.querySelector('.mcl-r');
    if (wi && w != null) { wi.value = String(w); wi.dispatchEvent(new Event('input', { bubbles: true })); }
    if (ri && r != null) { ri.value = String(r); ri.dispatchEvent(new Event('input', { bubbles: true })); }
    ck.click();
    return 'OK';
  }, [weight, reps, ix || 0]);
}
const countSets = pg => pg.evaluate(k => {
  let s; try { s = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { return -1; }
  return Object.keys(s).reduce((n, key) => { const e = (s[key] || [])[0]; return n + (e && e.sets ? Object.keys(e.sets).length : 0); }, 0);
}, SK);
const stripText = pg => pg.evaluate(() => (document.querySelector('.mcl-strip') || {}).textContent || '');
const store = (pg, k) => pg.evaluate(key => localStorage.getItem(key), k);

(async () => {
  const browser = await chromium.launch(process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errors.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });

  try {
    console.log('\n=== S1.1  serious lifter: log a full exercise, nothing lost ===');
    await reset(pg); await open(pg);
    let accepted = 0;
    for (let i = 0; i < 5; i++) if (await logSet(pg, 135 + i * 5, 8, 0) === 'OK') accepted++;
    await pg.waitForTimeout(1200);
    t('every accepted set persisted', await countSets(pg), accepted);
    ok('sets accepted', accepted);
    console.log('   strip now reads: ' + JSON.stringify((await stripText(pg)).trim().slice(0, 40)));

    console.log('\n=== S1.2  browser refresh mid-session (the gym-floor reload) ===');
    const before = await countSets(pg);
    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForFunction(() => document.querySelectorAll('.mcl-strip').length > 0, null, { timeout: 20000 });
    await pg.waitForTimeout(1500);
    t('set log survives a reload', await countSets(pg), before);
    const txt = (await stripText(pg)).replace(/\s+/g, ' ').trim();
    if (/(\d+)\s*\/\s*(\d+)/.test(txt) && !/(^|[^0-9])0\s*\/\s*\d/.test(txt)) ok('the card badge still shows the logged count after reload', txt.slice(0, 30));
    else bad('card badge after reload', JSON.stringify(txt.slice(0, 40)), 'a non-zero N/M count');

    console.log('\n=== S1.3  chaos: duplicate rapid taps must not double-count ===');
    await reset(pg); await open(pg);
    await logSet(pg, 100, 10, 0);
    await pg.waitForTimeout(400);
    const afterOne = await countSets(pg);
    // hammer the SAME row ten times as fast as the event loop allows
    await pg.evaluate(() => {
      const wrap = document.querySelector('.mcl-wrap.open') || document.querySelector('.mcl-wrap');
      const ck = wrap && wrap.querySelector('.mcl-ck.done');
      if (ck) for (let i = 0; i < 10; i++) ck.click();
    });
    await pg.waitForTimeout(1200);
    const afterSpam = await countSets(pg);
    if (afterSpam <= afterOne) ok('10 rapid taps on a logged row did not invent sets', `${afterOne} -> ${afterSpam}`);
    else bad('duplicate taps', `${afterOne} -> ${afterSpam} sets`, 'no increase');

    console.log('\n=== S1.4  chaos: garbage and hostile values ===');
    await reset(pg); await open(pg);
    for (const [w, r, label] of [[-500, -10, 'negative'], [1e12, 1e12, 'absurd'], ['abc', 'xyz', 'text'], ['', '', 'empty']]) {
      await logSet(pg, w, r, 0);
      await pg.waitForTimeout(250);
      const dump = await pg.evaluate(k => localStorage.getItem(k) || '', SK);
      if (/NaN|Infinity|undefined/.test(dump)) bad(`${label} input kept the store clean`, 'store contains NaN/Infinity/undefined', 'no such tokens');
      else ok(`${label} input never writes NaN/Infinity/undefined into the store`);
    }
    const tonnageSane = await pg.evaluate(() => {
      if (!window.MC_STRAIN) return 'no MC_STRAIN';
      let log; try { log = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}'); } catch (e) { return 'unreadable'; }
      const first = Object.keys(log)[0]; if (!first) return 'no entry';
      const sets = Object.values((log[first][0] || {}).sets || {});
      const s = window.MC_STRAIN.session({ date: new Date().toISOString(), duration: '45 min', sets: sets }, 200);
      return Number.isFinite(s.kcal) && s.kcal >= 0 && Number.isFinite(s.tonnage) && s.tonnage >= 0 ? 'finite' : JSON.stringify(s);
    });
    t('hostile values leave strain/kcal finite and non-negative', tonnageSane, 'finite');

    console.log('\n=== S1.5  interruption: leave the page mid-session, come back ===');
    await reset(pg); await open(pg);
    for (let i = 0; i < 3; i++) await logSet(pg, 185, 5, 0);
    await pg.waitForTimeout(1000);
    const mid = await countSets(pg);
    await pg.goto(BASE + '/dashboard.html', { waitUntil: 'networkidle' });
    await pg.waitForTimeout(1200);
    const sessionAfterLeave = await store(pg, SESS);
    if (sessionAfterLeave && sessionAfterLeave.length > 2) ok('the in-progress session is recorded in mc_session_v1', sessionAfterLeave.length + ' bytes');
    else bad('mc_session_v1 after leaving mid-session', String(sessionAfterLeave), 'a non-empty session record');
    const banner = await pg.evaluate(() => {
      const txt = document.body.innerText || '';
      return /resume|in progress|pick up/i.test(txt) ? 'present' : 'absent';
    });
    t('dashboard offers Smart Resume for the abandoned session', banner, 'present');
    await open(pg);
    await pg.waitForTimeout(1500);
    t('returning to the workout still has every set', await countSets(pg), mid);

    console.log('\n=== S1.6  app close / reopen (a new tab, cold) ===');
    const pg2 = await ctx.newPage();
    pg2.on('pageerror', e => errors.push('tab2 pageerror: ' + e.message));
    await pg2.goto(BASE + PAGE, { waitUntil: 'networkidle' });
    await pg2.waitForTimeout(1500);
    t('a cold reopen reads the same set log', await countSets(pg2), mid);
    await pg2.close();

    console.log('\n=== S1.7  finish the workout: does it bank, and are PRs detected? ===');
    await reset(pg); await open(pg);
    let logged = 0;
    for (let c = 0; c < 3; c++) for (let i = 0; i < 4; i++) if (await logSet(pg, 200 + c * 10, 6, c) === 'OK') logged++;
    await pg.waitForTimeout(1200);
    const finished = await pg.evaluate(() => {
      if (!window._FW || !window._FW.confirm) return 'no _FW.confirm';
      try { window._FW.confirm(); return 'called'; } catch (e) { return 'threw: ' + e.message; }
    });
    t('the app exposes its one completion point', finished, 'called');
    await pg.waitForTimeout(2000);
    const wl = await pg.evaluate(k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return 'unreadable'; } }, WL);
    if (Array.isArray(wl) && wl.length >= 1) {
      ok('a finished workout is banked to mc_workout_log_v1', wl.length + ' entry(ies)');
      const e = wl[0];
      const setCount = e && e.sets ? (Array.isArray(e.sets) ? e.sets.length : Object.keys(e.sets).length) : 0;
      if (setCount >= logged) ok('the banked entry carries every logged set', `${setCount} >= ${logged}`);
      else bad('banked set count', setCount, `>= ${logged} logged`);
      ok('banked entry fields', Object.keys(e).join(','));
    } else bad('mc_workout_log_v1 after finishing', JSON.stringify(wl).slice(0, 80), 'at least one entry');

    console.log('\n=== S1.8  saving and reopening a historical workout ===');
    await pg.goto(BASE + '/workout-logs.html', { waitUntil: 'networkidle' });
    await pg.waitForTimeout(1500);
    const histCards = await pg.evaluate(() => document.querySelectorAll('[class*="log-card"], .wl-card, .hist-card, [data-logid]').length);
    const histText = await pg.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200));
    if (histCards > 0) ok('the finished workout appears in history', histCards + ' card(s)');
    else bad('workout-logs.html shows the finished session', `0 cards; page text: ${JSON.stringify(histText.slice(0, 120))}`, 'at least one history card');

    console.log('\n=== console/page errors across the whole campaign ===');
    if (errors.length) { fail++; console.log('  FAIL  ' + errors.length + ' error(s):'); errors.slice(0, 12).forEach(e => console.log('        ' + e)); }
    else ok('zero uncaught page errors across all 8 scenarios');
  } catch (e) {
    fail++; console.log('  FAIL  harness threw: ' + (e && e.message));
  } finally { await browser.close(); }
  console.log(`\nS1 logger campaign: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
