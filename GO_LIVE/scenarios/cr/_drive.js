'use strict';
/* ==========================================================================
   _drive.js — the athlete's hands.
   --------------------------------------------------------------------------
   Every clean-room agent that needs to actually TRAIN goes through here, so
   "logged a set" means one thing across all 11 reports. The DOM contract was
   learned by probing a live page, not by reading mc-setlog.js — the module is
   2269 lines and its rendered output is what a user touches.

   Contract, as measured:
     .mc-day-row        a day in the F3 day list; tapping it renders that day
     .ex-card           one exercise; .mcl-strip is its resting state (R3)
     .mcl-row           one working set: .mcl-w weight, .mcl-r reps, .mcl-ck check
                        id = mclr-<name-derived key>-<setNo>   (Phase 2.1)
     .rest-timer[data-secs]   the one timer (TMR), delegated click
     .mc-day-back       return to the day list
   ========================================================================== */
const { sleep } = require('./_harness');

/* Open a day on a page that presents a day LIST (F3 family). Pages that serve
   a single day have no rows and are already open — that is not a failure. */
async function openDay(page, idx = 0) {
  /* Two day mechanisms exist across the fleet and only one of them is the F3
     day list. Pages converted by F3-1..F3-4 render `.mc-day-row`; the rest
     (legacy-prep.html among them, 26 days) still use a `.day-header` toggle
     with one day already open. Trying only the first leaves every row on those
     pages inside a display:none ancestor. */
  const listRows = await page.locator('.mc-day-row').count();
  if (listRows) {
    const n = Math.min(idx, listRows - 1);
    await page.locator('.mc-day-row').nth(n).click();
    await sleep(700);
    return { listed: listRows, opened: true, index: n, via: 'day-list' };
  }
  /* "A day is already open" is decided by a visible CARD, not a visible row:
     since R3 every card rests as a strip, so a fully open day can legitimately
     have zero rows with a layout box. Testing rows made this helper click a
     .day-header that was already expanded — which toggles it SHUT, leaving the
     page with nothing open and the driver reporting a defect that was its own. */
  const openCards = await page.locator('.ex-card, .ss-ex, .ex-item').filter({ visible: true }).count();
  const openStrips = await page.locator('.mcl-strip').filter({ visible: true }).count();
  if (openCards > 0 || openStrips > 0) {
    return { listed: 0, opened: false, via: 'already-open' };
  }
  const heads = page.locator('.day-header');
  const n = await heads.count();
  if (n) {
    await heads.nth(Math.min(idx, n - 1)).click({ timeout: 4000 }).catch(() => {});
    await sleep(700);
    return { listed: n, opened: true, index: idx, via: 'day-header' };
  }
  return { listed: 0, opened: false, via: 'none' };
}

async function cards(page) { return page.locator('.ex-card, .ss-ex, .ex-item').count(); }

/* Open the logger on the nth exercise.
   Two states have to be told apart, and conflating them is what made the first
   version of this helper hang for 30s a page: since S3, setActiveCard() opens
   the ACTIVE card's logger automatically, and R3 then hides that card's strip
   (display:none) because the strip is the RESTING state. So on every page the
   first strip is invisible and un-clickable BY DESIGN, while its working-set
   rows are already on screen.

   Therefore: if rows are already built, the logger is open — clicking anything
   is wrong. Only when no row exists do we tap a strip, and only a visible one. */
async function openLogger(page, idx = 0) {
  /* VISIBLE rows, not any rows. On a multi-day page every day's loggers are
     built, so a bare .mcl-row count is non-zero even when all of them sit in a
     collapsed day — which made the first version of this helper report
     "already open" and then type into an element no thumb could reach. */
  if (await page.locator('.mcl-row').filter({ visible: true }).count() > 0) return 'already-open';
  const strips = page.locator('.mcl-strip').filter({ visible: true });
  const n = await strips.count();
  if (n === 0) return false;
  try {
    await strips.nth(Math.min(idx, n - 1)).click({ timeout: 4000 });
  } catch (e) { return 'click-blocked:' + String(e.message).split('\n')[0].slice(0, 80); }
  await sleep(500);
  return await page.locator('.mcl-row').filter({ visible: true }).count() > 0 ? 'opened' : 'opened-no-rows';
}

/* Log one working set: type a weight, type reps, tap the check.
   Returns the row id so the caller can assert against the store by KEY rather
   than by position — position is exactly what Phase 2.1 proved unsafe. */
async function logSet(page, rowIdx, weight, reps) {
  const rows = page.locator('.mcl-row').filter({ visible: true });
  const total = await rows.count();
  if (rowIdx >= total) return null;
  const row = rows.nth(rowIdx);
  const id = await row.getAttribute('id');
  const w = row.locator('.mcl-w'), r = row.locator('.mcl-r');
  if (weight != null && await w.count()) { await w.fill(String(weight)); }
  if (reps   != null && await r.count()) { await r.fill(String(reps)); }
  /* The nav bar and finish bar are sticky, so a row low on the page can sit
     under them. Scrolling it to centre first is what a thumb does; without it
     a real, reachable control reads as un-clickable. */
  try { await row.locator('.mcl-ck').scrollIntoViewIfNeeded({ timeout: 2000 }); } catch (e) {}
  try { await row.locator('.mcl-ck').click({ timeout: 5000 }); }
  catch (e) { return { id, checked: false, blocked: String(e.message).split('\n')[0].slice(0, 90) }; }
  await sleep(220);
  const checked = await row.locator('.mcl-ck').getAttribute('aria-checked');
  return { id, checked: checked === 'true' };
}

const readStore = (page, key) => page.evaluate(k => {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return { __parseError: String(e.message) }; }
}, key);

const writeStore = (page, key, val) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [key, val]);

/* Count every logged set across the whole setlog.
   The store's real shape, dumped from a live page rather than assumed:

     mc_setlog_v1 = { "<pageId>|<exerciseKey>": [ { d:"YYYY-MM-DD",
                                                    sets:{ "1":{w,r}, "2":{...} },
                                                    ts:<epoch ms> } ] }

   Two things this shape proves on sight and are asserted elsewhere: the day
   key `d` carries a YEAR (roadmap Phase 5.1 / FIX-06 — it used to be the
   display label "Sep 11"), and the exercise key is NAME-derived, not
   positional (Phase 2.1 / EN-1). */
function countSets(setlog) {
  let n = 0;
  for (const entries of Object.values(setlog || {})) {
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const sets = e && e.sets;
      if (!sets || typeof sets !== 'object') continue;
      for (const v of Object.values(sets)) {
        if (v && (v.w != null || v.r != null || v.weight != null || v.reps != null)) n++;
      }
    }
  }
  return n;
}

/* Every distinct exercise key in the store, and every distinct day key — the
   two things Phase 2.1 and Phase 5.1 respectively made safe. */
function setlogKeys(setlog) {
  const ex = new Set(), days = new Set();
  for (const [k, entries] of Object.entries(setlog || {})) {
    ex.add(k);
    if (Array.isArray(entries)) entries.forEach(e => e && e.d && days.add(e.d));
  }
  return { exKeys: [...ex], dayKeys: [...days] };
}

/* Finish the workout through the product's own one completion point
   (_FW.confirm), which is what banks to mc_workout_log_v1 and runs PR
   detection. Driving the button is preferred; the direct call is the fallback
   for pages where the bar is off-screen, and is flagged as such. */
async function finish(page, { viaButton = true } = {}) {
  if (viaButton) {
    const btn = page.locator('#finishBtn, .fw-bar button, .finish-btn, [data-act="finish"]').first();
    if (await btn.count()) {
      try { await btn.click({ timeout: 2500 }); await sleep(500);
        const conf = page.locator('.fw-confirm, .fw-modal .fw-confirm').first();
        if (await conf.count()) { await conf.click(); await sleep(700); return 'button'; }
      } catch (e) { /* fall through to the direct call */ }
    }
  }
  const ok = await page.evaluate(() => {
    if (window._FW && typeof window._FW.confirm === 'function') { window._FW.confirm(); return true; }
    return false;
  });
  await sleep(800);
  return ok ? 'api' : 'unavailable';
}

module.exports = { openDay, cards, openLogger, logSet, readStore, writeStore, countSets, setlogKeys, finish, sleep };
