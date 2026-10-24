#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-exercise-identity.js — a history key names the EXERCISE, never its
   POSITION (engine-repair roadmap Phase 2.1; audit EN-1, EN-8).

   WHY THIS NEEDS A BROWSER
   ------------------------
   The identity is derived from the rendered card — its name element, its
   data-mc-orig-name, its position among same-named siblings. There is nothing
   to unit-test in a sandbox; the defect only exists once a page has rendered.

   WHAT WAS WRONG
   --------------
   Measured across 12 pages and 456 cards before the fix: 170 of them (37%)
   carried a POSITIONAL data-id — "1-s-3", "ssex-0-2", "0-b-4", "grp-6-0-0" —
   and mc-setlog.js keyed history on it. On a page that serves several workouts
   from one document that is catastrophic. pmc-workout.html renders all 30 PMC
   workouts, so across just 8 of them:

       31 of 32 distinct history keys were shared by DIFFERENT exercises
       the worst single key carried EIGHT of them

   A squat's logged weight sat in the same bucket as a lat pulldown's, and the
   progression engine averaged them into a suggestion.

   WHAT THE FIX IS
   ---------------
   exIdOf() is nameId() for every card: the authored exercise name, slugged,
   with an occurrence index for genuine duplicates, read through
   data-mc-orig-name so a rename does not orphan history. The 286 cards that
   carry no data-id at all have ALWAYS been keyed this way, so this is a
   convergence onto the fleet's own dominant scheme.

   Usage: node tools/test-mc-exercise-identity.js <baseUrl>
          MC_CHROMIUM=/path/to/chromium node tools/... (same override as
          test-mc-setlog-concurrency.js and check-contrast.js)
   ========================================================================== */
const { chromium } = require('playwright');

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('::error::usage: node tools/test-mc-exercise-identity.js <baseUrl>');
  process.exit(1);
}
const NET = /ERR_TUNNEL|ERR_ABORTED|ERR_NAME|Failed to load resource|supabase|fonts\.googleapis|accounts\.google/i;
// A key that ends in a bare position index is the shape this gate exists to
// forbid: "…|1-s-3", "…|ssex-0-2", "…|0-b-4", "…|grp-6-0-0".
const POSITIONAL = /\|(?:\d+-s-\d+|\d+-ss-\d+[ab]?|ssex-(?:\d+-)+\d+|grp-(?:\d+-)+\d+|\d+-b-\d+)$/;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}

// Two spellings of one lift that slug to the same key SHOULD share a history
// bucket — that is the scheme working, not a collision. (Before flagship
// readiness R4 the slug was cut at 24 characters, so this exemption also
// covered long spellings; keys are the whole name now — see the R4 block.)
function sameLift(names) {
  const n = names.map(function (s) { return s.replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/gi, '').toLowerCase(); });
  return n.every(function (x) { return x.indexOf(n[0]) === 0 || n[0].indexOf(x) === 0; });
}

(async () => {
  const b = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  const errs = [];

  async function cardsOn(page, url, prep) {
    await page.goto(baseUrl + '/' + url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1100);
    if (prep) await prep(page);
    const row = await page.$('.mc-day-row');
    if (row) { try { await row.click({ timeout: 3000 }); } catch (e) {} await page.waitForTimeout(800); }
    return page.evaluate(() => {
      const U = window.MCSetlogUtil;
      if (!U || !U.exIdOf) return null;
      return Array.from(document.querySelectorAll('.ex-card,.ss-ex,.ex-item,.lift-card')).map(c => {
        const nm = c.querySelector('.ex-name,.ss-name,.lift-name,.var-name');
        if (!nm) return null;
        return { name: (c.getAttribute('data-mc-orig-name') || nm.textContent).trim(),
                 key: U.histKey(U.exIdOf(c)) };
      }).filter(Boolean);
    });
  }

  /* ---- EN-1: the multi-workout page, which is where it was worst --------- */
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on('pageerror', e => { if (!NET.test(e.message)) errs.push(e.message); });
  p.on('console', m => { if (m.type() === 'error' && !NET.test(m.text())) errs.push(m.text()); });

  const byKey = new Map();
  const IDS = ['split1_legs', 'split1_back', 'split1_chest', 'split2_legs',
               'split3_back', 'split4_shoulders', 'split5_push', 'split6_chest'];
  let seen = 0;
  for (const id of IDS) {
    for (const wk of [1, 3]) {
      const rows = await cardsOn(p, 'pmc-workout.html#' + id, async (pg) => {
        await pg.evaluate(w => { if (typeof activeWeek !== 'undefined') { activeWeek = w; render(); } }, wk);
        await pg.waitForTimeout(350);
      });
      if (!rows) continue;
      for (const r of rows) {
        seen++;
        if (!byKey.has(r.key)) byKey.set(r.key, new Set());
        byKey.get(r.key).add(r.name.toLowerCase());
      }
    }
  }
  ok('the PMC sweep actually rendered cards', seen > 100, seen + ' cards');

  const collisions = [...byKey].filter(([, s]) => s.size > 1 && !sameLift([...s]));
  ok('EN-1 no history key is shared by different exercises', collisions.length === 0,
     collisions.length + ' collide, worst carries ' +
     Math.max(0, ...collisions.map(([, s]) => s.size)) + ': ' +
     collisions.slice(0, 3).map(([k, s]) => k + ' = ' + [...s].join(' | ')).join('  ;  '));

  const positional = [...byKey.keys()].filter(k => POSITIONAL.test(k));
  ok('EN-8 no history key is a bare position index', positional.length === 0,
     positional.length + ': ' + positional.slice(0, 5).join(', '));

  /* ---- and one page per remaining engine family -------------------------- */
  // The four STNDR pages are all here on purpose: they are the ones that
  // rendered a completion chip INSIDE .ex-name, and the name-purity check
  // below is the assertion that would have caught it at the source.
  for (const pg of ['hv-block.html', 'mm-p1.html', 'kitchen-sink.html', 'iron-engine.html',
                    'bro-split.html', 'weeks-to-open.html', 'push-pull-legs.html',
                    'legacy-prep.html']) {
    const rows = await cardsOn(p, pg);
    ok(pg + ' renders cards with resolvable ids', !!(rows && rows.length), rows ? '0 cards' : 'no MCSetlogUtil');
    if (!rows) continue;
    const bad = rows.filter(r => POSITIONAL.test(r.key));
    ok(pg + ': no positional history key', bad.length === 0,
       bad.length + ': ' + bad.slice(0, 3).map(r => r.key).join(', '));
    const named = rows.filter(r => /\|x-/.test(r.key));
    ok(pg + ': keys are derived from the exercise name', named.length === rows.length,
       named.length + ' of ' + rows.length + ': ' +
       rows.filter(r => !/\|x-/.test(r.key)).slice(0, 3).map(r => r.key).join(', '));
    // A key must not carry rendered CHROME. stndr-checkoff.js used to insert a
    // ✓ chip inside .ex-name, and origNameOf() slugged it straight into the
    // history key.
    const ticked = rows.filter(r => /[✓✔]/.test(r.key));
    ok(pg + ': no history key carries a completion tick', ticked.length === 0,
       ticked.slice(0, 3).map(r => r.key).join(', '));

    // NAME PURITY — the assertion at the source, not at the key. mc-setlog.js
    // reads .ex-name's textContent as the exercise's identity, so nothing may
    // render inside it. Its origNameOf() drops tick glyphs defensively, which
    // is the identity layer doing its job, but that defence only covers the
    // one glyph anybody happened to inject; a badge, a set counter or a
    // superset letter placed there would sail past it. This compares the name
    // element's own text against the authored name node (or the card's
    // data-mc-orig-name), so ANY injected text fails, not just a tick.
    //
    // Measured on the tree before stndr-checkoff.js was corrected: 191 of 266
    // cards across these four pages carried a "✓" prefix, and every other page
    // here was already clean.
    const dirty = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('.ex-card,.ss-ex,.ex-item,.lift-card').forEach(c => {
        const nm = c.querySelector('.ex-name,.ss-name,.lift-name,.var-name');
        if (!nm) return;
        const authored = nm.querySelector('[data-field="name"]');
        const want = (c.getAttribute('data-mc-orig-name') ||
                      (authored ? authored.textContent : nm.textContent) || '').trim();
        const got = (nm.textContent || '').trim();
        if (got !== want) out.push(JSON.stringify(got) + ' vs ' + JSON.stringify(want));
      });
      return out;
    });
    ok(pg + ': nothing is rendered inside the exercise name element', dirty.length === 0,
       dirty.length + ' of ' + rows.length + ': ' + dirty.slice(0, 3).join(' ; '));
  }

  /* ---- the round trip: a logged set must come back under the new key ----- */
  const rt = await (async () => {
    await p.goto(baseUrl + '/pmc-workout.html#split1_legs', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      const c = document.querySelector('.ex-card,.ss-ex,.ex-item');
      const U = window.MCSetlogUtil;
      if (c && U && U.activateCard) U.activateCard(c);
    });
    await p.waitForTimeout(800);
    const wrote = await p.evaluate(() => {
      const c = document.querySelector('.ex-card,.ss-ex,.ex-item');
      const w = c && c.querySelector('.mcl-w'), ck = c && c.querySelector('.mcl-ck');
      if (!w || !ck) return null;
      w.value = '135'; w.dispatchEvent(new Event('input', { bubbles: true }));
      ck.click();
      return true;
    });
    if (!wrote) return null;
    await p.waitForTimeout(900);
    await p.goto(baseUrl + '/pmc-workout.html#split1_legs', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      const c = document.querySelector('.ex-card,.ss-ex,.ex-item');
      const U = window.MCSetlogUtil;
      if (c && U && U.activateCard) U.activateCard(c);
    });
    await p.waitForTimeout(900);
    return p.evaluate(() => {
      const c = document.querySelector('.ex-card,.ss-ex,.ex-item');
      return { count: (c.querySelector('.mcl-count') || {}).textContent || '',
               weight: (c.querySelector('.mcl-w') || {}).value || '',
               keys: Object.keys(JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}')) };
    });
  })();
  ok('a logged set survives a reload under the new key', !!(rt && /^1\//.test(rt.count)),
     rt ? 'count="' + rt.count + '"' : 'could not log a set');
  ok('and its typed weight is restored', !!(rt && rt.weight === '135'), rt ? '"' + rt.weight + '"' : '');
  ok('the store key it landed in is name-derived', !!(rt && rt.keys.every(k => /\|x-[a-z0-9]/.test(k))),
     rt ? rt.keys.join(', ') : '');

  /* ---- flagship readiness R4: a key is the whole name, history shows it -- */
  async function fresh(init) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } });
    if (init) await c.addInitScript(init.fn, init.arg);
    const pg = await c.newPage();
    pg.on('pageerror', e => { if (!NET.test(e.message)) errs.push(e.message); });
    return { c, pg };
  }

  // R-12 / D-12: over the whole catalog, no two exercise names share a key.
  // The 24-character slug made 12 keys shared by 34 names.
  {
    const { c, pg } = await fresh();
    await pg.goto(baseUrl + '/mm-p1.html?day=1'); await pg.waitForTimeout(1200);
    await pg.waitForFunction(() => window.EXERCISES && window.EXERCISES.length > 500 && window.MCSetlogUtil, null, { timeout: 15000 }).catch(() => {});
    const o = await pg.evaluate(() => {
      if (!window.EXERCISES || !window.MCSetlogUtil) return null;
      const g = {};
      window.EXERCISES.forEach(e => { const d = document.createElement('div'); d.className = 'ex-card';
        d.innerHTML = '<div class="ex-name"></div>'; d.firstChild.textContent = e.name;
        const k = MCSetlogUtil.exIdOf(d); (g[k] = g[k] || new Set()).add(e.name); });
      const shared = Object.values(g).filter(x => x.size > 1);
      return { shared: shared.length, sample: shared.slice(0, 2).map(x => [...x].join(' | ')), total: window.EXERCISES.length };
    });
    ok('R4 R-12 no catalog exercise shares a history key with another', !!(o && o.shared === 0),
       o ? o.shared + ' shared (of ' + o.total + '): ' + o.sample.join(' ; ') : 'catalog never reached the page');
    await c.close();
  }

  // D-12 migration: a long name's pre-R4 bucket is carried to its whole-name
  // key when nothing else could have written there, and LEFT where it is when
  // a catalog name shares the prefix — a bucket that may hold two lifts is
  // attributed to neither (Phase 2.1's rule). The legacy bucket survives both.
  const LEG = 'mm-p1|x-db-hex-press-(flat,-dbs-', NEW = 'mm-p1|x-db-hex-press-(flat,-dbs-touching)';
  for (const shared of [false, true]) {
    const { c, pg } = await fresh({ fn: ([LEG, shared]) => {
      if (!localStorage.getItem('_r4')) { localStorage.setItem('_r4', '1');
        localStorage.setItem('mc_setlog_v1', JSON.stringify({ [LEG]: [{ d: '2026-10-16', ts: Date.parse('2026-10-16T10:00:00Z'), sets: { 1: { w: '60', r: '10' } } }] })); }
      if (shared) window.EXERCISES = [{ name: 'DB Hex Press (flat, dbs touching)' }, { name: 'DB Hex Press (flat, dbs apart)' }];
    }, arg: [LEG, shared] });
    await pg.goto(baseUrl + '/mm-p1.html?day=1'); await pg.waitForTimeout(2200);
    const o = await pg.evaluate(([LEG, NEW]) => { const st = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      return { legacy: !!st[LEG], moved: !!st[NEW], card: [...document.querySelectorAll('.ex-card, .ss-ex, .ex-item')].some(cd => MCSetlogUtil.exIdOf(cd) === NEW.split('|')[1]) }; }, [LEG, NEW]);
    if (!o.card) { ok('R4 migration harness: mm-p1 day 1 still renders "DB Hex Press (flat, dbs touching)"', false); await c.close(); continue; }
    ok(shared ? 'R4 a legacy bucket whose prefix another catalog name shares is NOT carried forward'
              : 'R4 a long name\'s legacy history is carried to its whole-name key',
       shared ? !o.moved : o.moved, JSON.stringify(o));
    ok('R4 the legacy bucket itself is left in place' + (shared ? ' (shared)' : ''), o.legacy, JSON.stringify(o));
    await c.close();
  }

  // R-11 / D-11: a finished workout banks the lift's name, keeps the key
  // beside it, and a PR is still judged against the lift's history on another
  // page (compared by key).
  {
    const { c, pg } = await fresh({ fn: () => { if (!localStorage.getItem('_r4')) { localStorage.setItem('_r4', '1');
      localStorage.setItem('mc_setlog_v1', JSON.stringify({ 'kitchen-sink|x-incline-db-press': [{ d: '2026-10-16', ts: Date.parse('2026-10-16T10:00:00Z'), sets: { 1: { w: '50', r: '8' } } }] })); } } });
    await pg.goto(baseUrl + '/mm-p1.html?day=1'); await pg.waitForTimeout(1800);
    const row = pg.locator('.ex-card').first().locator('.mcl-row').first();
    await row.locator('.mcl-w').fill('70'); await row.locator('.mcl-r').first().fill('8');
    await row.locator('.mcl-ck').click(); await pg.waitForTimeout(600);
    await pg.evaluate(() => window._FW && _FW.confirm()); await pg.waitForTimeout(1800);
    const s0 = await pg.evaluate(() => ((JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]')[0] || {}).sets || [])[0] || null);
    ok('R4 R-11 a finished set is banked under the lift\'s name', !!(s0 && s0.name === 'Incline DB Press'), JSON.stringify(s0));
    ok('R4 and keeps its history key beside the name', !!(s0 && s0.key === 'x-incline-db-press'), JSON.stringify(s0));
    ok('R4 a PR is still found against the same lift on another page', !!(s0 && s0.pr === true), JSON.stringify(s0));
    await c.close();
  }

  // Legacy entries (banked under the key) read as names on both history
  // screens, and the stored entry is not rewritten by reading it.
  {
    const d = new Date(Date.now() - 864e5).toISOString();
    const { c, pg } = await fresh({ fn: (d) => { if (!localStorage.getItem('_r4')) { localStorage.setItem('_r4', '1');
      localStorage.setItem('mc_workout_log_v1', JSON.stringify([{ id: 'mm-p1|' + d, pageId: 'mm-p1', workoutName: 'Legacy', date: d, prs: 0, setsChecked: 2,
        sets: [{ name: 'x-incline-db-press', setNum: 1, weight: '60', reps: '8' }, { name: 'x-db-rdl', setNum: 1, weight: '50', reps: '10' }] }])); } }, arg: d });
    await pg.goto(baseUrl + '/workout-logs.html'); await pg.waitForTimeout(1300);
    const list = await pg.evaluate(() => [...document.querySelectorAll('.set-ex')].map(x => x.textContent));
    await pg.goto(baseUrl + '/workout-detail.html?id=' + encodeURIComponent('mm-p1|' + d)); await pg.waitForTimeout(1300);
    const detail = await pg.evaluate(() => [...document.querySelectorAll('.ex-card-name')].map(x => x.textContent));
    const stored = await pg.evaluate(() => JSON.parse(localStorage.getItem('mc_workout_log_v1'))[0].sets[0].name);
    ok('R4 History shows a legacy entry by name', list.join('|') === 'Incline DB Press|DB RDL', JSON.stringify(list));
    ok('R4 the workout detail page shows it by name too', detail.join('|') === 'Incline DB Press|DB RDL', JSON.stringify(detail));
    ok('R4 reading a legacy entry does not rewrite it', stored === 'x-incline-db-press', stored);
    await c.close();
  }

  // R-08 / D-08: the suggested load is what one tap logs. Since S2 the fill is
  // a ghost value, and the suggestion skipped every non-empty field.
  {
    const { c, pg } = await fresh({ fn: () => { if (!localStorage.getItem('_r4')) { localStorage.setItem('_r4', '1');
      localStorage.setItem('mc_setlog_v1', JSON.stringify({ 'iron-engine|x-bb-flat-bench-press': [{ d: '2026-10-16', ts: Date.parse('2026-10-16T10:00:00Z'),
        sets: { 1: { w: '135', r: '12' }, 2: { w: '155', r: '12' }, 3: { w: '175', r: '10' }, 4: { w: '185', r: '8' } } }] })); } } });
    await pg.goto(baseUrl + '/iron-engine.html?day=1&week=1'); await pg.waitForTimeout(2500);
    const o = await pg.evaluate(() => { const cd = document.querySelector('.ex-card');
      const sug = ((cd.querySelector('.mcl-suggest') || {}).textContent || '').match(/(\d+(?:\.\d+)?)/);
      const ws = [...cd.querySelectorAll('.mcl-row:not(.mcl-row-amrap) .mcl-w')];
      return { sug: sug ? sug[1] : null, vals: ws.map(x => x.value), ghost: ws.map(x => !!x.dataset.ghost) }; });
    ok('R4 R-08 the top set prefills the suggested load', !!(o.sug && o.vals[o.vals.length - 1] === o.sug), JSON.stringify(o));
    ok('R4 lighter pyramid sets keep last session\'s weight', o.vals.slice(0, 3).join(',') === '135,155,175', JSON.stringify(o.vals));
    ok('R4 the planned load stays a ghost until it is confirmed', o.ghost.every(Boolean), JSON.stringify(o.ghost));
    await c.close();
  }

  ok('no app-level console errors across the sweep', errs.length === 0, errs.slice(0, 3).join(' ~ '));
  await b.close();

  console.log('test-mc-exercise-identity: ' + pass + ' passed, ' + fail + ' failed  (' +
              seen + ' PMC cards, ' + byKey.size + ' distinct keys)');
  if (fail) {
    console.error('\nFix: mc-setlog.js is keying history on something other than the exercise name.');
    process.exit(1);
  }
})();
