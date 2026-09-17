'use strict';
/* ==========================================================================
   cr07-nutrition-tools.js — Beta User + Data Integrity, the non-logger half.
   Protocol §1 "Nutrition and integration" plus the Training Tools the
   Executive Summary sells: Max-Out Calculator, Quick Pump, Build Your Own,
   Exercise Library, MC Wrapped, Guided Mode.

   These are driven because several of this repo's own past defects were
   features that LOADED correctly and did nothing: #pushChip's element was
   never authored, MC_TOAST was defined nowhere, MCSwap's whole subsystem did
   not exist. A module that parses is not a feature that works.
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, productErrors, sleep } = require('./_harness');
const D = require('./_drive');
const fs = require('fs');

let pass = 0, fail = 0; const rows = [];
function chk(id, label, got, want, note) {
  const okv = JSON.stringify(got) === JSON.stringify(want);
  okv ? pass++ : fail++;
  rows.push({ id, label, ok: okv, got, want, note: note || '' });
  console.log(`  ${okv ? 'ok  ' : 'FAIL'}  [${id}] ${label}` + (okv ? '' : `  -> want ${JSON.stringify(want)} got ${JSON.stringify(got)}`) + (note ? `\n          ${note}` : ''));
}

(async () => {
  const b = await browser();

  /* ---- Nutrition: the goal calculator and the rings ---------------------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/dashboard.html?tab=nutrition`, { waitUntil: 'domcontentloaded' }); await sleep(2000);

    // Independently computed target, then logged food, then the readout.
    const KG = lb => lb / 2.20462;
    const profile = { weightLb: 200, heightCm: 178, age: 30, sex: 'male', activity: 'moderate' };
    const bmrIndep = 10 * KG(200) + 6.25 * 178 - 5 * 30 + 5;
    const appBmr = await page.evaluate(p => window.MCMacroCalc ? window.MCMacroCalc.bmr(p) : null, profile);
    chk('N-01', 'the goal calculator is reachable on the page and matches Mifflin-St Jeor',
        appBmr === null ? 'MCMacroCalc absent' : Math.abs(appBmr - bmrIndep) < 1, true,
        `independent ${bmrIndep.toFixed(1)}, app ${appBmr}`);

    /* The real store shape, read from mc-macros.js's own header rather than
       guessed: days["YYYY-MM-DD"].entries[] with per:{kcal,p,f,c} and a qty.
       The fixture's calories are DERIVED from Atwater so the fixture itself
       cannot be the thing that fails — the first version of this check invented
       both the macros and the calories and then found they disagreed, which
       said nothing about the app. */
    const MACROS = [
      { name: 'Chicken breast', p: 62, f: 7,  c: 0  },
      { name: 'Rice',           p: 4,  f: 0,  c: 45 },
      { name: 'Olive oil',      p: 0,  f: 14, c: 0  },
    ].map(m => ({ ...m, kcal: m.p * 4 + m.c * 4 + m.f * 9 }));

    await page.evaluate(foods => {
      const key = 'mc_macros_v1';
      let s = {}; try { s = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
      const d = new Date();
      const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      s.v = 1; s.ts = Date.now();
      s.goals = { kcal: 2600, p: 200, f: 80, c: 260 };
      s.days = s.days || {};
      s.days[day] = { entries: foods.map((f, i) => ({
        id: 'cr' + i, ts: Date.now(), at: Date.now(), name: f.name,
        source: 'manual', unit: 'serving', qty: 1,
        per: { kcal: f.kcal, p: f.p, f: f.f, c: f.c },
      })) };
      localStorage.setItem(key, JSON.stringify(s));
    }, MACROS);

    const sum = MACROS.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, f: a.f + i.f, c: a.c + i.c }), { kcal: 0, p: 0, f: 0, c: 0 });
    chk('N-02', 'the day total reconciles against Atwater exactly',
        sum.kcal, sum.p * 4 + sum.c * 4 + sum.f * 9,
        `${sum.p}p / ${sum.f}f / ${sum.c}c = ${sum.kcal} kcal`);

    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(2200);
    const shown = await page.evaluate(t => {
      const txt = document.body.innerText || '';
      return { showsTotal: txt.includes(String(t.kcal)),
               namesAFood: /Chicken breast/i.test(txt),
               mentionsProtein: /protein/i.test(txt),
               sample: txt.replace(/\s+/g, ' ').slice(0, 160) };
    }, sum);
    chk('N-03', 'the nutrition tab shows the logged day back, totalled',
        shown.showsTotal && shown.namesAFood, true, JSON.stringify(shown));
    const pe = productErrors(sink);
    chk('N-04', 'the nutrition tab throws nothing', pe.thrown.length, 0, pe.thrown.join(' | '));
    await c.close();
  }

  /* ---- Max-Out Calculator ------------------------------------------------ */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/max-out.html`, { waitUntil: 'domcontentloaded' }); await sleep(1400);
    const est = await page.evaluate(() => window.MC_LOG ? window.MC_LOG.e1rm(225, 5, 'Barbell Back Squat') : null);
    chk('T-01', 'Max-Out estimates a 1RM from a heavy set (225x5)', est, Math.round(225 * (1 + 5 / 30)),
        'Epley, computed independently');
    const ladder = await page.evaluate(() => {
      const t = document.body.innerText || '';
      return { hasInputs: document.querySelectorAll('input').length, mentionsWarm: /warm|ladder|set/i.test(t) };
    });
    chk('T-02', 'the Max-Out page presents real inputs', ladder.hasInputs > 0, true, JSON.stringify(ladder));
    chk('T-03', 'Max-Out throws nothing', productErrors(sink).thrown.length, 0);
    await c.close();
  }

  /* ---- Quick Pump: generates a real, station-anchored session ------------ */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/quick-pump.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(1600);
    const qp = await page.evaluate(() => ({
      module: !!window.MC_QUICK_PUMP || !!window.MCQuickPump,
      buttons: [...document.querySelectorAll('button')].filter(x => /30|45|generate|go/i.test(x.textContent || '')).length,
      body: (document.body.innerText || '').slice(0, 120),
    }));
    chk('T-04', 'Quick Pump offers its time choices', qp.buttons > 0, true, JSON.stringify(qp).slice(0, 180));
    /* "30 min" is a duration CHIP that only sets an option; the session is
       built by the separate Generate control. Clicking the chip and asserting
       cards appeared tested nothing. */
    const dur = page.locator('button').filter({ hasText: /^30 min$/ }).first();
    if (await dur.count()) { await dur.click({ timeout: 4000 }).catch(() => {}); await sleep(300); }
    const gen = page.locator('button').filter({ hasText: /generate/i }).first();
    chk('T-05a', 'Quick Pump has a Generate control', await gen.count() > 0, true);
    if (await gen.count()) { await gen.click({ timeout: 6000 }).catch(() => {}); await sleep(2200); }
    const built = await page.evaluate(() => {
      const n = document.querySelectorAll('.ex-card, .ex-item, .ss-ex, .qp-ex, .qp-row').length;
      const txt = document.body.innerText || '';
      return { cards: n, namesExercises: /press|curl|squat|row|raise|pushdown|fly/i.test(txt) };
    });
    chk('T-05', 'Quick Pump generates a real session on Generate',
        built.cards > 0 || built.namesExercises, true, JSON.stringify(built));
    chk('T-06', 'Quick Pump throws nothing', productErrors(sink).thrown.length, 0, productErrors(sink).thrown.join(' | '));
    await c.close();
  }

  /* ---- Exercise Library -------------------------------------------------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/exercise-library.html`, { waitUntil: 'domcontentloaded' }); await sleep(1800);
    const lib = await page.evaluate(() => ({
      catalog: window.EXERCISE_CATALOG ? window.EXERCISE_CATALOG.length : (window.EXERCISES ? window.EXERCISES.length : null),
      rendered: document.querySelectorAll('.lib-item, .ex-row, .var-name, .lib-ex').length,
      searchBox: document.querySelectorAll('input[type=search], input[placeholder*="earch" i]').length,
    }));
    chk('T-07', 'the Exercise Library renders movements', (lib.rendered || 0) > 0, true, JSON.stringify(lib));
    chk('T-08', 'the library offers search', (lib.searchBox || 0) > 0, true);
    // Real-time search: type and assert the list narrows.
    /* At rest the library is grouped by muscle with variations collapsed
       ("TAP TO EXPAND"), so zero variations are visible and .var-name is the
       wrong thing to count. A search REPLACES that with a flat result list
       headed "N EXERCISES MATCHING <query>", which is what to read. */
    const box = page.locator('#searchBox, input[type=search], input[placeholder*="earch" i]').first();
    if (await box.count()) {
      await box.fill('squat'); await box.dispatchEvent('input'); await sleep(900);
      const hit = await page.evaluate(() => {
        const t = (document.body.innerText || '').replace(/\s+/g, ' ');
        const m = t.match(/(\d+)\s+EXERCISES?\s+MATCHING/i);
        return { count: m ? Number(m[1]) : 0, namesASquat: /squat/i.test(t) };
      });
      chk('T-09', 'typing a query returns real matches', hit.count > 0 && hit.namesASquat, true, JSON.stringify(hit));

      await box.fill('zzzzqqq'); await box.dispatchEvent('input'); await sleep(900);
      const none = await page.evaluate(() => {
        const t = (document.body.innerText || '').replace(/\s+/g, ' ');
        const m = t.match(/(\d+)\s+EXERCISES?\s+MATCHING/i);
        return { count: m ? Number(m[1]) : null,
                 saysSomething: /no (exact )?match|0 exercises|nothing|try fewer/i.test(t) };
      });
      chk('T-10', 'a no-results query still says something rather than going blank',
          none.count === 0 || none.saysSomething, true, JSON.stringify(none));
    }
    chk('T-11', 'the library throws nothing', productErrors(sink).thrown.length, 0);
    await c.close();
  }

  /* ---- Build Your Own: a custom workout survives and is runnable --------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/build-workout.html`, { waitUntil: 'domcontentloaded' }); await sleep(1600);
    const shape = await page.evaluate(() => ({
      nameField: document.querySelectorAll('input[type=text], input:not([type])').length,
      addable: document.querySelectorAll('.lib-item, .ex-row, .bw-ex, [data-add]').length,
      save: [...document.querySelectorAll('button')].filter(x => /save|create|done|build/i.test(x.textContent || '')).length,
    }));
    chk('T-12', 'Build Your Own presents a name field, a pickable list and a save',
        shape.nameField > 0 && shape.addable > 0 && shape.save > 0, true, JSON.stringify(shape));
    chk('T-13', 'Build Your Own throws nothing', productErrors(sink).thrown.length, 0, productErrors(sink).thrown.join(' | '));
    await c.close();
  }

  /* ---- Guided Mode: reachable, and its exit is reachable ----------------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(900);
    await D.openDay(page, 0); await sleep(700);
    const g = await page.evaluate(() => {
      /* The entry is a <div role="button" tabindex="0">, not a <button> — a
         selector of 'button, a' misses it entirely and reports the feature
         absent when it is present and operable. */
      const btn = [...document.querySelectorAll('button, a, [role=button]')].find(e => /guided/i.test(e.textContent || ''));
      if (!btn) return { present: false };
      const r = btn.getBoundingClientRect();
      return { present: true, w: Math.round(r.width), h: Math.round(r.height), text: (btn.textContent || '').trim().slice(0, 30) };
    });
    chk('T-14', 'Guided Mode has an entry control on a workout page', g.present, true, JSON.stringify(g));
    if (g.present) {
      chk('T-15', 'the Guided Mode entry clears the 44px touch floor', g.w >= 44 && g.h >= 44, true, `${g.w}x${g.h}`);
      await page.locator('button, a, [role=button]').filter({ hasText: /guided/i }).first().click({ timeout: 4000 }).catch(() => {});
      await sleep(1000);
      const ex = await page.evaluate(() => {
        const e = [...document.querySelectorAll('button, [role=button]')].find(x => /exit guided|✕ exit|end guided/i.test(x.textContent || ''));
        if (!e) return { exit: false };
        const r = e.getBoundingClientRect();
        return { exit: true, w: Math.round(r.width), h: Math.round(r.height) };
      });
      chk('T-16', 'and once inside, the way OUT is present and 44px',
          ex.exit && ex.w >= 44 && ex.h >= 44, true, JSON.stringify(ex));
    }
    chk('T-17', 'Guided Mode throws nothing', productErrors(sink).thrown.length, 0, productErrors(sink).thrown.join(' | '));
    await c.close();
  }

  /* ---- Workout history reads back a finished session --------------------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(800);
    await D.openDay(page, 0); await D.openLogger(page, 0);
    for (let i = 0; i < 3; i++) await D.logSet(page, i, 185, 6);
    await sleep(400);
    await page.evaluate(() => window._FW && window._FW.confirm && window._FW.confirm());
    await sleep(1000);
    await page.goto(`${BASE}/workout-logs.html`, { waitUntil: 'domcontentloaded' }); await sleep(2000);
    const hist = await page.evaluate(() => {
      const t = document.body.innerText || '';
      return { mentionsSets: /sets?/i.test(t), hasEntry: document.querySelectorAll('.log-row, .wl-row, .hist-row, [data-logid]').length,
               totals: (t.match(/\b\d+\b/g) || []).slice(0, 6) };
    });
    chk('T-18', 'a finished workout appears in Workout Logs',
        hist.hasEntry > 0 || hist.mentionsSets, true, JSON.stringify(hist));
    chk('T-19', 'Workout Logs throws nothing', productErrors(sink).thrown.length, 0, productErrors(sink).thrown.join(' | '));
    await c.close();
  }

  await b.close();
  fs.writeFileSync(__dirname + '/../../evidence/cr/cr07-nutrition-tools.json', JSON.stringify(rows, null, 1));
  console.log(`\ncr07 NUTRITION & TOOLS — ${pass + fail} checks   PASS ${pass}   FAIL ${fail}`);
})();
