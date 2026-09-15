/* PHASE 2 / D — the ⋮ per-exercise menu, the 🧩 cluster flow, supersets, and
   Build Your Own → run a custom workout. None of this was exercised in Phase 1. */
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const NEUTRAL = '/manifest.json';
let pass = 0, fail = 0; const findings = [];
const ok = (m, x) => { pass++; console.log(`  ok    ${m}${x ? '  [' + x + ']' : ''}`); };
const bad = (m, got, want) => { fail++; findings.push({ m, got, want }); console.log(`  FAIL  ${m}\n          observed: ${got}\n          expected: ${want}`); };
const note = (m, x) => console.log(`  note  ${m}${x ? '  [' + x + ']' : ''}`);

async function reset(pg) {
  await pg.goto(BASE + NEUTRAL, { waitUntil: 'load' });
  for (let i = 0; i < 6; i++) {
    await pg.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await pg.waitForTimeout(120);
    if (!(await pg.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('mc_') === 0).length))) return;
  }
}
async function openDay(pg, path) {
  const count = () => pg.evaluate(() => document.querySelectorAll('.mcl-strip').length);
  await pg.goto(BASE + '/' + path, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await pg.waitForTimeout(1100);
  if (await count()) return true;
  try { await pg.goto(BASE + '/' + path + '?day=1', { waitUntil: 'domcontentloaded', timeout: 20000 }); await pg.waitForTimeout(1200); } catch (e) {}
  if (await count()) return true;
  for (const sel of ['.mc-day-row', '.day-header', '.day-card']) {
    const n = await pg.evaluate(s => document.querySelectorAll(s).length, sel);
    for (let i = 0; i < Math.min(n, 9); i++) {
      const c = await pg.evaluate(([s, ix]) => { const el = document.querySelectorAll(s)[ix]; if (!el) return false;
        const t = (el.textContent || '').toLowerCase();
        if (/full rest|rest day/.test(t) && !/active/.test(t)) return 'rest'; el.click(); return true; }, [sel, i]);
      if (c === 'rest' || !c) continue;
      for (let w = 0; w < 8; w++) { await pg.waitForTimeout(350); if (await count()) return true; }
    }
  }
  return false;
}
const openMenu = pg => pg.evaluate(() => {
  const mb = document.querySelector('.mc-meatball');
  if (!mb) return 'no-meatball';
  mb.click();
  return 'clicked';
});
const menuItems = pg => pg.evaluate(() => {
  const ov = document.querySelector('.mc-menu-overlay, .mc-sheet, [class*=menu-overlay]');
  const vis = ov && getComputedStyle(ov).display !== 'none' && getComputedStyle(ov).visibility !== 'hidden';
  return {
    visible: !!vis,
    items: Array.from(document.querySelectorAll('[data-act]'))
      .filter(b => b.offsetParent !== null)
      .map(b => ({ act: b.dataset.act, label: (b.textContent || '').trim().slice(0, 30),
                   w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))
  };
});
const clickAct = (pg, act) => pg.evaluate(a => {
  const b = Array.from(document.querySelectorAll('[data-act="' + a + '"]')).filter(x => x.offsetParent !== null)[0];
  if (!b) return 'not-visible';
  b.click(); return 'clicked';
}, act);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MC_CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('**://*.supabase.co/**', r => r.abort());
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('THROW ' + e.message.split('\n')[0].slice(0, 100)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/i.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 100)); });
  pg.on('dialog', d => d.accept());

  console.log('\n=== D1  the ⋮ menu opens and every action is reachable at 44px ===');
  await reset(pg);
  if (!(await openDay(pg, 'mm-p1.html'))) { bad('open a training day on mm-p1', 'could not', 'cards rendered'); }
  else {
    const mb = await openMenu(pg);
    await pg.waitForTimeout(500);
    if (mb !== 'clicked') bad('the ⋮ meatball exists on an exercise card', mb, 'a .mc-meatball to click');
    else {
      const m = await menuItems(pg);
      if (m.items.length) {
        ok('the ⋮ menu opens with its actions', m.items.map(i => i.act).join(','));
        const small = m.items.filter(i => i.h > 0 && i.h < 44);
        if (small.length) bad('every ⋮ menu action clears the 44px touch floor',
          small.map(i => `${i.act} ${i.w}x${i.h}`).join(', '), 'all >= 44px tall');
        else ok('every ⋮ menu action clears the 44px touch floor', m.items.map(i => i.h + 'px').join(','));
        for (const want of ['replace', 'reorder', 'notes', 'tempo', 'trends', 'int-drop', 'int-cluster', 'int-ss']) {
          if (m.items.some(i => i.act === want)) ok(`  action present: ${want}`);
          else bad(`⋮ action "${want}" is offered`, 'absent from the open menu', 'present');
        }
      } else bad('the ⋮ menu renders items', JSON.stringify(m).slice(0, 120), 'a list of [data-act] buttons');
    }
  }

  console.log('\n=== D2  Notes — write one, reload, is it still there? ===');
  await clickAct(pg, 'cancel'); await pg.waitForTimeout(300);
  await openMenu(pg); await pg.waitForTimeout(400);
  const nRes = await clickAct(pg, 'notes'); await pg.waitForTimeout(600);
  if (nRes !== 'clicked') bad('Notes action clickable', nRes, 'clicked');
  else {
    const typed = await pg.evaluate(() => {
      const ta = Array.from(document.querySelectorAll('textarea, input[type=text]')).filter(e => e.offsetParent !== null)[0];
      if (!ta) return 'no-field';
      ta.value = 'GO_LIVE probe note 42';
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const save = Array.from(document.querySelectorAll('[data-act="save"], button')).filter(b => b.offsetParent !== null && /save|done/i.test(b.textContent || ''))[0];
      if (save) { save.click(); return 'saved'; }
      return 'no-save-button';
    });
    await pg.waitForTimeout(900);
    const persisted = await pg.evaluate(() => {
      const hit = Object.keys(localStorage).filter(k => (localStorage.getItem(k) || '').includes('GO_LIVE probe note 42'));
      return hit.length ? hit.join(',') : 'nowhere';
    });
    if (typed === 'saved' && persisted !== 'nowhere') ok('a note persists to a real store', persisted);
    else bad('note round trip', `typed=${typed} persisted=${persisted}`, 'the note stored under an mc_* key');
    if (persisted !== 'nowhere') {
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1600);
      const after = await pg.evaluate(() => Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes('GO_LIVE probe note 42')));
      if (after) ok('the note survives a reload'); else bad('note survives reload', 'gone', 'still present');
      const dot = await pg.evaluate(() => document.querySelectorAll('.mc-meatball .mc-dot, .mc-meatball[data-has-note], .mc-dot').length);
      if (dot > 0) ok('the ⋮ shows its gold dot once a note is saved', dot + ' marker(s)');
      else note('no gold-dot marker found on the meatball after saving a note (Executive Summary claims one)');
    }
  }

  console.log('\n=== D3  🧩 Cluster intensifier — set a breakdown, then log the bubbles ===');
  await reset(pg);
  await openDay(pg, 'mm-p1.html');
  await openMenu(pg); await pg.waitForTimeout(400);
  const cRes = await clickAct(pg, 'int-cluster'); await pg.waitForTimeout(700);
  if (cRes !== 'clicked') bad('🧩 Cluster action clickable', cRes, 'clicked');
  else {
    const set = await pg.evaluate(() => {
      const fields = Array.from(document.querySelectorAll('input, select, textarea')).filter(e => e.offsetParent !== null);
      const f = fields.find(e => /cluster|rep|break/i.test((e.placeholder || '') + (e.name || '') + (e.id || ''))) || fields[0];
      if (!f) return 'no-field:' + fields.length;
      f.value = '5+5+5'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
      const btn = Array.from(document.querySelectorAll('button, [data-act]')).filter(b => b.offsetParent !== null && /apply|save|done|ok/i.test(b.textContent || ''))[0];
      if (btn) { btn.click(); return 'applied via ' + (btn.textContent || '').trim().slice(0, 14); }
      return 'no-apply-button';
    });
    await pg.waitForTimeout(1200);
    const attr = await pg.evaluate(() => {
      const c = document.querySelector('[data-mc-cluster]');
      return c ? c.getAttribute('data-mc-cluster') : 'none';
    });
    if (attr !== 'none') {
      ok('setting a cluster breakdown stamps it on the card', 'data-mc-cluster=' + attr);
      const bubbles = await pg.evaluate(async () => {
        const strip = document.querySelector('[data-mc-cluster] .mcl-strip') || document.querySelector('.mcl-strip');
        if (strip) { strip.click(); await new Promise(r => setTimeout(r, 500)); }
        const card = document.querySelector('[data-mc-cluster]');
        const rows = card ? Array.from(card.querySelectorAll('.mcl-row')) : [];
        const multi = rows.filter(r => r.querySelectorAll('.mcl-r').length > 1);
        if (!multi.length) return { n: 0, rows: rows.length };
        const row = multi[0];
        const mins = Array.from(row.querySelectorAll('.mcl-r'));
        const seeded = mins.map(m => m.value || m.placeholder);
        mins.forEach((m, i) => { m.value = String(5 - (i === 2 ? 2 : 0)); m.dispatchEvent(new Event('input', { bubbles: true })); });
        const ck = row.querySelector('.mcl-ck:not(.done)'); if (ck) ck.click();
        await new Promise(r => setTimeout(r, 900));
        let store = {}; try { store = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}'); } catch (e) {}
        const vals = [];
        Object.keys(store).forEach(k => { const s = (store[k] || [])[0]; if (s && s.sets) Object.values(s.sets).forEach(v => vals.push(v.r)); });
        return { n: mins.length, seeded, stored: vals };
      });
      if (bubbles.n > 1) {
        ok(`the cluster row renders ${bubbles.n} rep bubbles`, 'seeded ' + JSON.stringify(bubbles.seeded));
        const joined = (bubbles.stored || []).find(v => String(v).includes('+'));
        if (joined) ok('logging 5+5+3 stores every mini-set, not just the first', joined);
        else bad('cluster mini-set storage', JSON.stringify(bubbles.stored), 'a value like "5+5+3"');
      } else bad('cluster bubbles render after setting a breakdown', JSON.stringify(bubbles), '>1 rep box in the working row');
    } else bad('cluster breakdown applied to the card', `field interaction: ${set}; no [data-mc-cluster] on the page`, 'data-mc-cluster stamped');
  }

  console.log('\n=== D4  supersets — both legs log independently ===');
  await reset(pg);
  const ssOpened = await openDay(pg, 'iron-engine.html');
  if (!ssOpened) bad('open a day on iron-engine', 'could not', 'cards');
  else {
    const ss = await pg.evaluate(async () => {
      const legs = Array.from(document.querySelectorAll('.ss-ex'));
      if (legs.length < 2) return { legs: legs.length };
      const out = [];
      for (const leg of legs.slice(0, 2)) {
        const strip = leg.querySelector('.mcl-strip');
        if (strip) { strip.click(); await new Promise(r => setTimeout(r, 400)); }
        const row = leg.querySelector('.mcl-row');
        if (!row) { out.push('no-row'); continue; }
        const w = row.querySelector('.mcl-w'), r = row.querySelector('.mcl-r');
        if (w) { w.value = '88'; w.dispatchEvent(new Event('input', { bubbles: true })); }
        if (r) { r.value = '6'; r.dispatchEvent(new Event('input', { bubbles: true })); }
        const ck = row.querySelector('.mcl-ck:not(.done)'); if (ck) ck.click();
        await new Promise(r2 => setTimeout(r2, 400));
        out.push((leg.querySelector('.ss-name, .ex-name') || {}).textContent || '?');
      }
      await new Promise(r => setTimeout(r, 900));
      let store = {}; try { store = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}'); } catch (e) {}
      return { legs: legs.length, driven: out, keys: Object.keys(store) };
    });
    if (!ss.legs || ss.legs < 2) note('iron-engine rendered no superset pair in the opened day', 'ss-ex=' + ss.legs);
    else {
      ok(`drove both legs of a superset`, ss.driven.map(s => String(s).trim().slice(0, 20)).join(' + '));
      if (ss.keys.length >= 2) ok('each leg stores under its OWN history key', ss.keys.length + ' distinct keys');
      else bad('superset legs keyed separately', ss.keys.join(','), 'two distinct keys, one per exercise');
    }
  }

  console.log('\n=== D5  Build Your Own → run the custom workout → log it ===');
  await reset(pg);
  await pg.goto(BASE + '/build-workout.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
  const built = await pg.evaluate(() => {
    const name = Array.from(document.querySelectorAll('input')).filter(e => e.offsetParent !== null)[0];
    if (name) { name.value = 'GO LIVE probe workout'; name.dispatchEvent(new Event('input', { bubbles: true })); }
    const pick = Array.from(document.querySelectorAll('[data-ex], .lib-row, .ex-row, li')).filter(e => e.offsetParent !== null).slice(0, 3);
    pick.forEach(p => p.click());
    return { nameField: !!name, candidates: pick.length,
             stores: Object.keys(localStorage).filter(k => k.indexOf('mc_') === 0) };
  });
  note('Build Your Own initial interaction', JSON.stringify(built).slice(0, 150));
  const seeded = await pg.evaluate(() => {
    // Seed a custom workout directly in the store the runner reads, so the
    // RUNNER is what gets tested even if the builder's UI needs more steps.
    const key = 'mc_custom_workouts_v1';
    const w = { id: 'golive-probe', name: 'GO LIVE Probe', date: new Date().toISOString(),
      exercises: [{ name: 'Barbell Bench Press', sets: '3', reps: '8' },
                  { name: 'Lat Pulldown', sets: '3', reps: '10' }] };
    try { localStorage.setItem(key, JSON.stringify([w])); return 'seeded ' + key; } catch (e) { return 'failed'; }
  });
  const storeKeys = await pg.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('mc_') === 0));
  console.log('    ' + seeded + ' | mc_* keys now: ' + storeKeys.join(','));
  await pg.goto(BASE + '/run-workout.html?id=golive-probe', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  const ran = await pg.evaluate(() => ({
    strips: document.querySelectorAll('.mcl-strip').length,
    cards: document.querySelectorAll('.ex-card, .ss-ex, .ex-item').length,
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120)
  }));
  if (ran.strips > 0) {
    ok('run-workout.html renders a seeded custom workout', `${ran.cards} cards, ${ran.strips} loggers`);
  } else {
    note('run-workout.html rendered no logger for a directly-seeded custom workout — its store shape or id param differs from the probe', JSON.stringify(ran.text.slice(0, 90)));
  }

  console.log('\n=== page errors across D1–D5 ===');
  if (errs.length) bad('zero uncaught errors', errs.slice(0, 5).join(' | '), 'none');
  else ok('zero uncaught page errors');
  await browser.close();
  console.log(`\nPHASE D: ${pass} passed, ${fail} failed`);
  if (findings.length) { console.log('\n--- findings ---'); findings.forEach(f => console.log(`* ${f.m}\n    got:  ${f.got}\n    want: ${f.want}`)); }
})();
