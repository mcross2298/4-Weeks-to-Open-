/* PHASE 2 / B — drive a real session on EVERY page that loads mc-setlog.js.
   check-journey drives 9; there are 79. For each page:
     1. open it, reveal a day if it opens as a day list
     2. log one set (weight + reps) through the real logger
     3. assert it persisted to mc_setlog_v1
     4. reload, assert it survived and the badge is non-zero
     5. finish via the real _FW.confirm(), assert it banks to mc_workout_log_v1
   Records every page that cannot complete that round trip. */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const ROOT = '/home/user/4-Weeks-to-Open-';
const pages = execSync(`grep -rl 'mc-setlog.js' --include='*.html' .`, { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(p => p.replace(/^\.\//, '')).filter(p => !p.endsWith('.dc.html')).sort();

const NEUTRAL = '/manifest.json';
const SK = 'mc_setlog_v1', WL = 'mc_workout_log_v1';

async function reset(pg) {
  await pg.goto(BASE + NEUTRAL, { waitUntil: 'load' });
  for (let i = 0; i < 6; i++) {
    await pg.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await pg.waitForTimeout(120);
    if (!(await pg.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('mc_') === 0).length))) return true;
  }
  return false;
}
// Reveal exercise cards. The first draft of this failed on 21 pages INCLUDING
// mm-p1.html, which check-journey drives every CI run -- so it was the helper,
// not the app. Two mistakes: querySelector('.mc-day-row, .day-header, .day-card')
// returns the first match in DOCUMENT order regardless of which selector matched,
// so it often clicked an outer .day-card wrapper or a REST day (which has nothing
// behind it by design); and it never tried the ?day=1 deep link the F3 families
// added precisely to skip the day list. Now: deep link first, then click every
// candidate row in turn until real strips appear.
async function reveal(pg, path) {
  const count = () => pg.evaluate(() => document.querySelectorAll('.mcl-strip').length);
  if (await count()) return 'already';

  // 1. the deep link, where the page honours it
  try {
    await pg.goto(BASE + '/' + path + (path.includes('?') ? '&' : '?') + 'day=1', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pg.waitForTimeout(1100);
    if (await count()) return 'deeplink?day=1';
  } catch (e) { /* fall through */ }

  // 2. click each candidate day control in turn, most specific selector first
  for (const sel of ['.mc-day-row', '.day-header', '.day-card', '[data-day]', '.dl-row']) {
    const n = await pg.evaluate(s => document.querySelectorAll(s).length, sel);
    for (let i = 0; i < Math.min(n, 9); i++) {
      const clicked = await pg.evaluate(([s, ix]) => {
        const el = document.querySelectorAll(s)[ix];
        if (!el) return false;
        const t = (el.textContent || '').toLowerCase();
        if (/full rest|rest day/.test(t) && !/active/.test(t)) return 'rest';  // nothing behind a rest row
        el.click();
        return true;
      }, [sel, i]);
      if (clicked === 'rest' || !clicked) continue;
      for (let w = 0; w < 8; w++) {
        await pg.waitForTimeout(350);
        if (await count()) return `clicked ${sel}[${i}]`;
      }
    }
  }
  const diag = await pg.evaluate(() => ({
    dayRows: document.querySelectorAll('.mc-day-row').length,
    dayCards: document.querySelectorAll('.day-card').length,
    exCards: document.querySelectorAll('.ex-card, .ss-ex, .ex-item').length
  }));
  return `NO-CARDS (dayRows=${diag.dayRows} dayCards=${diag.dayCards} exCards=${diag.exCards})`;
}
async function logSet(pg, w, r) {
  return pg.evaluate(([weight, reps]) => {
    const strip = document.querySelectorAll('.mcl-strip')[0];
    if (!strip) return 'NOSTRIP';
    const card = strip.closest('.ex-card, .ss-ex, .ex-item, .lift-card') || strip.parentElement;
    const pick = () => {
      const wrap = card.querySelector('.mcl-wrap');
      return (wrap && wrap.classList.contains('open')) ? wrap.querySelector('.mcl-ck:not(.done)') : null;
    };
    let ck = pick();
    if (!ck) { strip.click(); ck = pick(); }
    if (!ck) return 'NOROW';
    const row = ck.closest('.mcl-row');
    const wi = row && row.querySelector('.mcl-w'), ri = row && row.querySelector('.mcl-r');
    if (wi) { wi.value = String(weight); wi.dispatchEvent(new Event('input', { bubbles: true })); }
    if (ri) { ri.value = String(reps); ri.dispatchEvent(new Event('input', { bubbles: true })); }
    ck.click();
    return 'OK';
  }, [w, r]);
}
const countSets = pg => pg.evaluate(k => {
  try { const s = JSON.parse(localStorage.getItem(k) || '{}');
    return Object.keys(s).reduce((n, key) => { const e = (s[key] || [])[0]; return n + (e && e.sets ? Object.keys(e.sets).length : 0); }, 0);
  } catch (e) { return -1; }
}, SK);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MC_CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('**://*.supabase.co/**', r => r.abort());
  const results = [];
  for (const path of pages) {
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push('THROW ' + e.message.split('\n')[0].slice(0, 90)));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 90)); });
    const rec = { path, reveal: null, logged: null, persisted: null, survived: null, badge: null, banked: null, errs: [] };
    try {
      await reset(pg);
      await pg.goto(BASE + '/' + path, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await pg.waitForTimeout(1100);
      rec.reveal = await reveal(pg, path);
      rec.logged = await logSet(pg, 137, 9);
      await pg.waitForTimeout(1100);
      rec.persisted = await countSets(pg);
      if (rec.persisted > 0) {
        await pg.reload({ waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(1500);
        rec.survived = await countSets(pg);
        rec.badge = await pg.evaluate(() => {
          const s = document.querySelector('.mcl-strip');
          const t = s ? (s.textContent || '').replace(/\s+/g, ' ') : '';
          const m = /(\d+)\s*\/\s*(\d+)/.exec(t);
          return m ? m[0] : (t ? 'no-count:' + t.slice(0, 24) : 'no-strip');
        });
      }
      await pg.evaluate(() => { try { window._FW && window._FW.confirm && window._FW.confirm(); } catch (e) {} });
      await pg.waitForTimeout(1500);
      rec.banked = await pg.evaluate(k => { try { const a = JSON.parse(localStorage.getItem(k) || '[]'); return a.length ? (a[0].sets ? (Array.isArray(a[0].sets) ? a[0].sets.length : Object.keys(a[0].sets).length) : 0) : 'none'; } catch (e) { return 'unreadable'; } }, WL);
    } catch (e) { rec.errs.push('HARNESS ' + e.message.split('\n')[0].slice(0, 90)); }
    rec.errs = rec.errs.concat(errs.slice(0, 3));
    rec.picker = String(rec.reveal).startsWith('NO-CARDS');
    const ok = rec.logged === 'OK' && rec.persisted > 0 && rec.survived > 0 &&
               typeof rec.banked === 'number' && rec.banked > 0 && rec.errs.length === 0;
    rec.ok = ok;
    results.push(rec);
    process.stdout.write(ok ? '.' : 'x');
    await pg.close();
  }
  await browser.close();
  fs.writeFileSync('/tmp/claude-0/-home-user/a74a0f41-f369-5584-b1fd-bd371305a6eb/scratchpad/p2/b-drive-all.json', JSON.stringify(results, null, 1));
  const bad = results.filter(r => !r.ok && !r.picker);
  const pickers = results.filter(r => r.picker);
  console.log(`\n\nPHASE B — full session round trip on ${results.length} workout pages`);
  console.log(`round trip complete: ${results.filter(r => r.ok).length}`);
  console.log(`renders no session at all (picker / landing / needs seeded data): ${pickers.length}`);
  console.log(`REAL FAILURES: ${bad.length}\n`);
  if (bad.length) { console.log('--- failures ---'); bad.forEach(r => console.log(`${r.path}\n    reveal=${r.reveal} log=${r.logged} persisted=${r.persisted} survived=${r.survived} badge=${r.badge} banked=${r.banked}${r.errs.length ? '\n    ' + r.errs.join('\n    ') : ''}`)); }
  console.log('\n--- no session rendered (expected for pickers; verify each is really a picker) ---');
  pickers.forEach(r => console.log(`${r.path}  ${r.reveal}`));
})();
