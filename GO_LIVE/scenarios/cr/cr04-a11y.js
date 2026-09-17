'use strict';
/* ==========================================================================
   cr04-a11y.js — Accessibility Engineer.
   Protocol §0: "keyboard, focus, labels, contrast, semantics, reduced motion,
   screen-reader-friendly behavior where testable."

   Driven, not linted. The distinction matters here: this repo's own history
   shows controls that read correctly in source and announce wrongly at
   runtime — DEF-CR-01 in this very run was a visible tick with
   aria-checked="false". So every check below reads the live accessibility
   state after real interaction.
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, sleep } = require('./_harness');
const D = require('./_drive');
const fs = require('fs');

let pass = 0, fail = 0; const rows = [];
function chk(id, label, got, want, note) {
  const okv = JSON.stringify(got) === JSON.stringify(want);
  okv ? pass++ : fail++;
  rows.push({ id, label, ok: okv, got, want, note: note || '' });
  console.log(`  ${okv ? 'ok  ' : 'FAIL'}  [${id}] ${label}` + (okv ? '' : `  -> want ${JSON.stringify(want)} got ${JSON.stringify(got)}`) + (note && !okv ? `\n          ${note}` : ''));
}

(async () => {
  const b = await browser();
  const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
  await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(900);
  await D.openDay(page, 0); await D.openLogger(page, 0);

  /* ---- semantics of the two controls used most --------------------------- */
  const sem = await page.evaluate(() => {
    const cks = [...document.querySelectorAll('.mcl-ck')];
    const rts = [...document.querySelectorAll('.rest-timer[data-secs]')];
    return {
      ckTotal: cks.length,
      ckButtons: cks.filter(e => e.tagName === 'BUTTON').length,
      ckRole: cks.filter(e => e.getAttribute('role') === 'checkbox').length,
      ckAria: cks.filter(e => e.hasAttribute('aria-checked')).length,
      ckLabel: cks.filter(e => (e.getAttribute('aria-label') || '').trim()).length,
      rtTotal: rts.length,
      rtButtons: rts.filter(e => e.tagName === 'BUTTON').length,
      rtLabel: rts.filter(e => (e.getAttribute('aria-label') || '').trim()).length,
    };
  });
  chk('A-01', 'every set checkbox is a real <button>', sem.ckButtons, sem.ckTotal, `${sem.ckButtons}/${sem.ckTotal}`);
  chk('A-02', 'every set checkbox carries role=checkbox', sem.ckRole, sem.ckTotal);
  chk('A-03', 'every set checkbox carries aria-checked', sem.ckAria, sem.ckTotal);
  chk('A-04', 'every set checkbox carries an accessible name', sem.ckLabel, sem.ckTotal);
  chk('A-05', 'every rest chip is a real <button> with a name',
      sem.rtButtons === sem.rtTotal && sem.rtLabel === sem.rtTotal, true,
      `buttons ${sem.rtButtons}/${sem.rtTotal}, labelled ${sem.rtLabel}/${sem.rtTotal}`);

  /* ---- aria-checked must TRACK the real state, not just exist ------------ */
  {
    const row = page.locator('.mcl-row').first();
    const before = await row.locator('.mcl-ck').getAttribute('aria-checked');
    await row.locator('.mcl-w').fill('100'); await row.locator('.mcl-r').fill('8');
    await row.locator('.mcl-ck').click(); await sleep(400);
    const after = await row.locator('.mcl-ck').getAttribute('aria-checked');
    chk('A-06', 'aria-checked flips false -> true when a set is logged', [before, after], ['false', 'true']);
    await row.locator('.mcl-ck').click(); await sleep(400);
    chk('A-07', 'aria-checked flips back to false when a set is un-logged',
        await row.locator('.mcl-ck').getAttribute('aria-checked'), 'false');
    await row.locator('.mcl-ck').click(); await sleep(400);
  }

  /* ---- keyboard operability: a native button must fire on Space and Enter */
  {
    const row = page.locator('.mcl-row').nth(1);
    await row.locator('.mcl-w').fill('105'); await row.locator('.mcl-r').fill('8');
    const ck = row.locator('.mcl-ck');
    await ck.focus();
    const focused = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? a.className : 'none';
    });
    chk('A-08', 'a set checkbox can take keyboard focus', /mcl-ck/.test(focused), true, focused);
    await page.keyboard.press('Enter'); await sleep(400);
    chk('A-09', 'Enter logs the set (native button semantics)',
        await ck.getAttribute('aria-checked'), 'true');
    await page.keyboard.press(' '); await sleep(400);
    chk('A-10', 'Space toggles it too', await ck.getAttribute('aria-checked'), 'false');
    await page.keyboard.press(' '); await sleep(300);
  }

  /* ---- the count label must be announced, not silently changed ----------- */
  {
    const strip = await page.evaluate(() => {
      const s = document.querySelector('.mcl-strip');
      if (!s) return null;
      return { label: s.getAttribute('aria-label'), text: (s.textContent || '').replace(/\s+/g, ' ').trim() };
    });
    /* The count may be spoken as "2 of 5" rather than rendered as "2/5" — for a
       screen reader that is the better form, so both are accepted. What is
       asserted is that the NUMBER reaches the accessible name at all: R3 made
       this strip the resting state of every card, and its aria-label used to
       override the "2/5 Sets" span inside it, so the count was never announced. */
    chk('A-11', 'the collapsed card strip announces its set count',
        !!(strip && strip.label && /\d+\s*(?:\/|of)\s*\d+/i.test(strip.label)), true,
        JSON.stringify(strip));
  }

  /* ---- focus is never trapped in an invisible element -------------------- */
  {
    /* A zero-size box is not by itself a trap: a control inside a COLLAPSED
       card has an ancestor with display:none, so it renders 0x0 and the
       browser will not focus it at all — which is correct. The only way to
       tell the two apart is to try to focus it and see whether focus lands,
       so that is what this does rather than reasoning from computed style. */
    const trapped = await page.evaluate(() => {
      const foc = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
        .filter(e => !e.disabled && e.tabIndex !== -1);
      const out = [];
      const active = document.activeElement;
      for (const e of foc) {
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) continue;
        try { e.focus(); } catch (x) { continue; }
        if (document.activeElement === e) out.push((e.tagName + '.' + String(e.className)).slice(0, 50));
      }
      try { if (active && active.focus) active.focus(); } catch (x) {}
      return [...new Set(out)].slice(0, 6);
    });
    chk('A-12', 'no zero-size element sits in the keyboard tab order', trapped.length, 0, trapped.join(' | '));
  }

  /* ---- reduced motion is honoured --------------------------------------- */
  await c.close();
  {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const p2 = await c2.newPage(); const s2 = newSink(); attach(p2, s2);
    await p2.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(1000);
    await D.openDay(p2, 0); await sleep(600);
    const motion = await p2.evaluate(() => {
      const honoured = matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Anything still animating for a meaningful duration under reduce.
      const moving = [...document.querySelectorAll('*')].filter(e => {
        const cs = getComputedStyle(e);
        const d = parseFloat(cs.animationDuration) || 0;
        const t = parseFloat(cs.transitionDuration) || 0;
        return cs.animationName !== 'none' && d > 0.3 || t > 0.6;
      }).map(e => (e.tagName + '.' + String(e.className)).slice(0, 44));
      return { honoured, moving: [...new Set(moving)].slice(0, 6) };
    });
    chk('A-13', 'the reduced-motion media query is seen by the page', motion.honoured, true);
    chk('A-14', 'nothing animates long under prefers-reduced-motion', motion.moving.length, 0, motion.moving.join(' | '));
    const errs = s2.thrown.filter(e => !/supabase|fonts\./i.test(e));
    chk('A-15', 'reduced motion introduces no runtime error', errs.length, 0, errs.join(' | '));
    await c2.close();
  }

  await b.close();
  fs.writeFileSync(__dirname + '/../../evidence/cr/cr04-a11y.json', JSON.stringify(rows, null, 1));
  console.log(`\ncr04 ACCESSIBILITY — ${pass + fail} checks   PASS ${pass}   FAIL ${fail}`);
})();
