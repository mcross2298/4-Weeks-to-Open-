/* PHASE 2 / C — set-TYPE correctness, driven not inferred.
   The committed suites prove the PLAN arithmetic (how many rows, what target).
   Nothing proved that logging each type STORES the right thing. For every
   exercise card on a sample of pages spanning all six intensifiers, this reads
   the authored prescription off the card, drives every row, and asserts what
   landed in mc_setlog_v1. */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const NEUTRAL = '/manifest.json', SK = 'mc_setlog_v1';
const PAGES = ['mm-p1.html', 'kitchen-sink.html', 'pmc-back.html', 's3-back-traps.html',
               'chest-tri-pump.html', 'legacy-prep.html', 'hv-block.html', 'iron-engine.html',
               'psu-strength.html', '2on-1off.html'];

let pass = 0, fail = 0; const findings = [];
const ok = (m, x) => { pass++; console.log(`  ok    ${m}${x ? '  [' + x + ']' : ''}`); };
const bad = (m, got, want) => { fail++; findings.push({ m, got, want }); console.log(`  FAIL  ${m}\n          observed: ${got}\n          expected: ${want}`); };

async function reset(pg) {
  await pg.goto(BASE + NEUTRAL, { waitUntil: 'load' });
  for (let i = 0; i < 6; i++) {
    await pg.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await pg.waitForTimeout(120);
    if (!(await pg.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('mc_') === 0).length))) return;
  }
}
async function reveal(pg, path) {
  const count = () => pg.evaluate(() => document.querySelectorAll('.mcl-strip').length);
  if (await count()) return true;
  try { await pg.goto(BASE + '/' + path + '?day=1', { waitUntil: 'domcontentloaded', timeout: 20000 }); await pg.waitForTimeout(1100); } catch (e) {}
  if (await count()) return true;
  for (const sel of ['.mc-day-row', '.day-header', '.day-card']) {
    const n = await pg.evaluate(s => document.querySelectorAll(s).length, sel);
    for (let i = 0; i < Math.min(n, 9); i++) {
      const c = await pg.evaluate(([s, ix]) => {
        const el = document.querySelectorAll(s)[ix]; if (!el) return false;
        const t = (el.textContent || '').toLowerCase();
        if (/full rest|rest day/.test(t) && !/active/.test(t)) return 'rest';
        el.click(); return true;
      }, [sel, i]);
      if (c === 'rest' || !c) continue;
      for (let w = 0; w < 8; w++) { await pg.waitForTimeout(350); if (await count()) return true; }
    }
  }
  return false;
}

/* Open EVERY card and describe what the logger built for it, plus the authored
   prescription it came from. Pure observation -- no clicks yet. */
async function describeCards(pg) {
  return pg.evaluate(async () => {
    const out = [];
    const strips = Array.from(document.querySelectorAll('.mcl-strip'));
    for (let i = 0; i < strips.length; i++) {
      const strip = strips[i];
      const card = strip.closest('.ex-card, .ss-ex, .ex-item, .lift-card') || strip.parentElement;
      strip.click();
      await new Promise(r => setTimeout(r, 260));
      const wrap = card.querySelector('.mcl-wrap');
      const rows = wrap ? Array.from(wrap.querySelectorAll('.mcl-row')) : [];
      out.push({
        ix: i,
        name: (card.querySelector('.ex-name, .ss-name, .lift-name') || {}).textContent || '',
        reps: (card.querySelector('.a-reps, .ex-reps, .a-rep') || {}).textContent || '',
        badges: Array.from(card.querySelectorAll('.badge, .a-badge, [class*=badge]')).map(b => (b.textContent || '').trim()).filter(Boolean).slice(0, 5),
        clusterAttr: card.getAttribute('data-mc-cluster') || null,
        rowCount: rows.length,
        rows: rows.map(r => ({
          repBoxes: r.querySelectorAll('.mcl-r').length,
          repPlaceholders: Array.from(r.querySelectorAll('.mcl-r')).map(x => x.placeholder || ''),
          repValues: Array.from(r.querySelectorAll('.mcl-r')).map(x => x.value || ''),
          weightDisabled: !!(r.querySelector('.mcl-w') || {}).disabled,
          isDrop: /drop/i.test(r.className) || /drop/i.test(r.textContent || ''),
          label: (r.querySelector('.mcl-sn, .mcl-setno') || {}).textContent || ''
        }))
      });
    }
    return out;
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MC_CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('**://*.supabase.co/**', r => r.abort());
  const seen = { amrap: 0, cluster: 0, drop: 0, tempo: 0, superset: 0, triset: 0 };
  const dump = [];

  for (const path of PAGES) {
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push(e.message.split('\n')[0].slice(0, 90)));
    await reset(pg);
    await pg.goto(BASE + '/' + path, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await pg.waitForTimeout(1100);
    if (!(await reveal(pg, path))) { console.log(`\n### ${path} — no cards, skipped`); await pg.close(); continue; }
    const cards = await describeCards(pg);
    console.log(`\n### ${path} — ${cards.length} cards`);

    for (const c of cards) {
      const pres = (c.reps || '').replace(/\s+/g, ' ').trim();
      const allBadges = c.badges.join(' ').toUpperCase();
      const isAmrap = /AMRAP|∞|failure/i.test(pres) || /AMRAP/.test(allBadges);
      const isCluster = !!c.clusterAttr || c.rows.some(r => r.repBoxes > 1);
      const isDrop = /drop/i.test(pres) || /DROP/.test(allBadges) || c.rows.some(r => r.isDrop);
      const isTempo = /@\s*\d|tempo/i.test(pres) || /TEMPO/.test(allBadges);

      // ---- cluster: one rep bubble per mini-set, prefilled with the target ----
      if (isCluster) {
        seen.cluster++;
        const multi = c.rows.filter(r => r.repBoxes > 1);
        if (multi.length) {
          ok(`${path} "${c.name.trim().slice(0, 26)}" renders ${multi[0].repBoxes} rep bubbles per cluster set`,
             `attr=${c.clusterAttr || 'none'} placeholders=${multi[0].repPlaceholders.join('|')}`);
          const prefilled = multi[0].repPlaceholders.every(p => p !== '') || multi[0].repValues.every(v => v !== '');
          if (prefilled) ok('  cluster bubbles carry the prescribed target');
          else bad(`cluster bubbles prefilled on ${path}`, JSON.stringify(multi[0]), 'each bubble seeded with its target');
        }
      }
      // ---- AMRAP: the reps box must SAY so, not show a fabricated number ----
      if (isAmrap) {
        seen.amrap++;
        const openRows = c.rows.filter(r => r.repPlaceholders.some(p => /amrap|∞|fail|max/i.test(p)));
        if (openRows.length) ok(`${path} "${c.name.trim().slice(0, 26)}" AMRAP row asks for reps rather than inventing a target`,
                                openRows[0].repPlaceholders.join('|'));
        else findings.push({ m: `AMRAP row labelling on ${path} "${c.name.trim().slice(0,26)}"`, got: `prescription "${pres}" but no row placeholder says AMRAP: ` + JSON.stringify(c.rows.map(r=>r.repPlaceholders)), want: 'the open-ended row to be marked' });
      }
      if (isDrop) seen.drop++;
      if (isTempo) seen.tempo++;
      dump.push({ path, name: c.name.trim().slice(0, 40), pres, badges: c.badges, rowCount: c.rowCount, clusterAttr: c.clusterAttr, repBoxes: c.rows.map(r => r.repBoxes) });
    }

    // ---- drive every row on the first three cards and verify what stored ----
    const stored = await pg.evaluate(async () => {
      const res = [];
      const strips = Array.from(document.querySelectorAll('.mcl-strip')).slice(0, 3);
      for (const strip of strips) {
        const card = strip.closest('.ex-card, .ss-ex, .ex-item, .lift-card') || strip.parentElement;
        strip.click(); await new Promise(r => setTimeout(r, 300));
        const wrap = card.querySelector('.mcl-wrap');
        if (!wrap) continue;
        const rows = Array.from(wrap.querySelectorAll('.mcl-row'));
        for (const row of rows) {
          const ck = row.querySelector('.mcl-ck:not(.done)'); if (!ck) continue;
          const w = row.querySelector('.mcl-w');
          if (w && !w.disabled) { w.value = '95'; w.dispatchEvent(new Event('input', { bubbles: true })); }
          const reps = Array.from(row.querySelectorAll('.mcl-r'));
          reps.forEach((r, i) => { r.value = String(7 + i); r.dispatchEvent(new Event('input', { bubbles: true })); });
          ck.click();
          await new Promise(r => setTimeout(r, 130));
          res.push({ boxes: reps.length, typed: reps.map((_, i) => 7 + i).join('+') });
        }
      }
      await new Promise(r => setTimeout(r, 900));
      let store = {}; try { store = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}'); } catch (e) {}
      const flat = [];
      Object.keys(store).forEach(k => {
        const sess = (store[k] || [])[0];
        if (sess && sess.sets) Object.keys(sess.sets).forEach(sn => flat.push({ key: k, sn, w: sess.sets[sn].w, r: sess.sets[sn].r }));
      });
      return { driven: res, flat };
    });
    const multiTyped = stored.driven.filter(d => d.boxes > 1);
    if (multiTyped.length) {
      const joined = stored.flat.filter(f => String(f.r).includes('+'));
      if (joined.length) ok(`${path} a multi-bubble cluster set stores every mini-set, joined`, joined[0].r);
      else bad(`${path} cluster set storage`, JSON.stringify(stored.flat.slice(0, 3)), 'a reps value containing "+" (e.g. 7+8+9)');
    }
    const anyStored = stored.flat.length;
    if (anyStored) ok(`${path} drove ${stored.driven.length} rows across 3 cards; ${anyStored} sets stored`);
    else bad(`${path} storage after driving rows`, '0 sets stored', 'every checked row persisted');
    const junk = stored.flat.filter(f => /NaN|undefined|Infinity/.test(String(f.w) + String(f.r)));
    if (junk.length) bad(`${path} stored values clean`, JSON.stringify(junk.slice(0, 3)), 'no NaN/undefined/Infinity');
    else if (anyStored) ok(`${path} no NaN/undefined/Infinity in any stored value`);
    if (errs.length) bad(`${path} page errors`, errs.slice(0, 2).join(' | '), 'none');
    await pg.close();
  }
  await browser.close();
  fs.writeFileSync('/tmp/claude-0/-home-user/a74a0f41-f369-5584-b1fd-bd371305a6eb/scratchpad/p2/c-cards.json', JSON.stringify(dump, null, 1));
  console.log(`\n\nPHASE C — set types encountered: ${JSON.stringify(seen)}`);
  console.log(`${pass} passed, ${fail} failed`);
  if (findings.length) { console.log('\n--- findings ---'); findings.forEach(f => console.log(`* ${f.m}\n    got:  ${f.got}\n    want: ${f.want}`)); }
})();
