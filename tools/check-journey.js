#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-journey.js — drive a complete workout, as a trainee, on every engine
   --------------------------------------------------------------------------
   The gap this closes. Every other check in verify.yml inspects the app at
   REST: smoke-test-pages.js loads a page and reads console errors,
   check-contrast.js samples colours, check-visual-ratchet.js diffs a
   screenshot, measure-session.js runs a timer on one page. None of them ever
   logs a set.

   Three real defects shipped through all of that and were caught only by
   driving a full session (roadmap M5) — and all three were introduced by the
   change that had just been verified green by everything else:

     * two controls in the new session toolbar were 34px tall, under the 44pt
       touch floor — the button that ENDS a workout, and the one that opens the
       summary;
     * the inline rest row's -15s / +15s were 38px;
     * a card strip was permanently occluded by the superset hop buffer, because
       one change cut the in-session bottom reservation to 24px on the (then
       true) basis that nothing sits at the bottom any more, while on a superset
       page a ~75px buffer still does.

   That last one is the argument for this tool. It is not a bug in either piece
   of code. Each was correct in isolation and correct on every page it was
   measured against. It exists only where the two meet, on an engine family
   neither change was tested on. No static check can see that; only walking the
   journey on every engine can.

   What it asserts, per page:
     JOURNEY   the session can actually be completed — day opens, logger opens,
               a set logs, the exercise finishes, End workout opens the recap
     ERRORS    zero console/page errors at any step
     OCCLUSION zero controls still covered after being scrolled to centre
               (a control you cannot reach is worse than one that looks wrong)
     OVERFLOW  no horizontal scroll at any width
     CHROME    covered viewport within budget, at rest and mid-session
     TOUCH     every control in CRITICAL is at least 44x44

   TOUCH is deliberately a named list, not "every control on the page". The app
   still has pre-existing sub-44px controls (.back-link is 29px on every page);
   failing on those would make this gate red from birth and it would be turned
   off. It guards the controls this rebuild owns, and the list is where new ones
   get added.

   Usage:
     node tools/check-journey.js <baseUrl>                    # CI
     node tools/check-journey.js <baseUrl> --viewport "iPhone SE"
     node tools/check-journey.js <baseUrl> --all-viewports    # width sweep
     node tools/check-journey.js <baseUrl> --update           # rewrite budgets
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
if (!baseUrl || baseUrl.startsWith('--')) {
  console.error('usage: node tools/check-journey.js <baseUrl> [--viewport N] [--all-viewports] [--inset px] [--update]');
  process.exit(1);
}
const argv = process.argv.slice(3);
const has = f => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const UPDATE = has('--update');

const BUDGET_FILE = path.resolve(__dirname, 'journey-budgets.json');
const BUDGET_SLACK = 1.35;   // same spirit as perf-budgets: catch drift, not noise

// One page per SHAPE a session can take. "Shape" is not the same as "engine":
// six of these are the shared card engines, and three are hand-written pages
// that no engine covers -- measured, not assumed. A change that works on eight
// of them and not the ninth is exactly the failure this tool exists for.
//
// The last three were added when scoping roadmap F3 (drop the accordion),
// which changes how a session is ENTERED on the 23 pages that render more than
// one day. Only three of those 23 were driven here before; the multi-day
// pages carry three distinct day-opening mechanisms and two of them had no
// coverage at all:
//
//   re-render on toggle   openDayIdx = n; render()      2on-1off, legacy-prep
//   class toggle          card.classList.toggle('open') mm-p1, kitchen-sink-s3,
//                                                       iron-engine (+4 more)
//   inline onclick        onclick="toggleDay(this...)"  hv-block
//
// iron-engine covers a five-page hand-written clone family (bro-split,
// arnold-legacy, push-pull-legs, weeks-to-open carry near-identical toggle
// bodies) and is the only one of the five that is not licensed content.
// legacy-prep is both its own shape and the largest page in the tree -- 26
// days, 163 exercise cards -- so it is where a per-day change fails first.
const PAGES = [
  { page: 'mm-p1.html',           engine: 'mm-engine' },
  { page: '2on-1off.html',        engine: 'mc-freq-engine / mc-workout-engine' },
  { page: 'pmc-back.html',        engine: 'mc-pmc-engine' },
  { page: 's3-back-traps.html',   engine: 'mc-s3-engine' },
  { page: 'kitchen-sink-s3.html', engine: 'ks-engine' },
  { page: 'chest-tri-pump.html',  engine: 'mc-workout-engine' },
  { page: 'iron-engine.html',     engine: 'hand-written (clone family, 5 pages)' },
  { page: 'hv-block.html',        engine: 'hand-written (inline onclick)' },
  { page: 'legacy-prep.html',     engine: 'hand-written (re-render, 26 days)' },
];

// Viewports differ on two axes that matter independently: WIDTH (where text
// wraps, where a toolbar stops fitting) and SAFE-AREA INSET (which no viewport
// size predicts). The default run covers engines at one width; --all-viewports
// sweeps the width extremes.
const VIEWPORTS = {
  'iPhone SE':          { width: 375, height: 667 },   // narrowest common
  'iPhone 13':          { width: 390, height: 844 },   // project baseline
  'iPhone 15 Pro Max':  { width: 430, height: 932 },
  'iPhone 16 Pro Max':  { width: 440, height: 956 },   // widest common
};

// Controls this rebuild owns. New session controls belong here.
const CRITICAL = [
  { sel: '#mcsEnd',        name: 'End workout (toolbar)' },
  { sel: '#fwProgress',    name: 'progress / summary (toolbar)' },
  { sel: '.mcl-rest-adj',  name: 'rest +/-15s (inline row)' },
  { sel: '.mcl-ck',        name: 'set checkbox' },
];

/* ── in-page measurement ─────────────────────────────────────────────────── */
const MEASURE = (criticalSel) => {
  const vh = innerHeight, vw = innerWidth;
  const d = e => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
    ((typeof e.className === 'string' && e.className) ? '.' + e.className.trim().split(/\s+/).slice(0,2).join('.') : '') : 'null';

  // union of vertical space under fixed layers, overlaps counted once
  const fx = [...document.querySelectorAll('body > *')].filter(e => {
    const c = getComputedStyle(e);
    return c.position === 'fixed' && c.display !== 'none' && c.visibility !== 'hidden'
      && e.getBoundingClientRect().height > 2;
  });
  const iv = fx.map(e => { const r = e.getBoundingClientRect();
    return [Math.max(0, r.top), Math.min(vh, r.bottom)]; })
    .filter(([a, z]) => z > a).sort((a, b) => a[0] - b[0]);
  let cov = 0, cur = null;
  iv.forEach(([a, z]) => { if (!cur) { cur = [a, z]; return; }
    if (a <= cur[1]) cur[1] = Math.max(cur[1], z); else { cov += cur[1] - cur[0]; cur = [a, z]; } });
  if (cur) cov += cur[1] - cur[0];

  // Permanent occlusion: scroll the control to centre first. A control merely
  // sitting under a bar right now is fine — you scroll. One still covered at
  // centre cannot be reached at any scroll position.
  const SEL = 'button,a[href],input,select,[role="button"],[role="checkbox"],.mcl-ck,.rest-timer,.mc-meatball';
  const occluded = [];
  [...document.querySelectorAll(SEL)].forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r0 = el.getBoundingClientRect();
    if (!r0.width || !r0.height || r0.height > 340) return;   // skip page-sized containers
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cy < 0 || cy >= vh || cx < 0 || cx >= vw) return;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return;
    occluded.push(d(el) + ' <- ' + d(hit));
  });

  // touch floor, on the named controls only
  const tooSmall = [];
  criticalSel.forEach(c => {
    document.querySelectorAll(c.sel).forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.width < 44 || r.height < 44) {
        tooSmall.push(c.name + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    });
  });

  return {
    coveredPx: Math.round(cov),
    coveredPct: Math.round(cov / vh * 1000) / 10,
    hOverflow: document.documentElement.scrollWidth - vw,
    occluded: [...new Set(occluded)],
    tooSmall: [...new Set(tooSmall)],
  };
};

const STATE = () => ({
  strips: document.querySelectorAll('.mcl-strip').length,
  rows: document.querySelectorAll('.mcl-row').length,
  done: document.querySelectorAll('.mcl-ck.done').length,
  inlineRest: !!document.getElementById('mclRest'),
  navVisible: (() => { const n = document.querySelector('nav.mc-nav');
    return n ? getComputedStyle(n).display !== 'none' : null; })(),
  toolbar: !!document.querySelector('.mcs-stat-row'),
});

// D11 guard — a SOURCE check. It was written as one because a runtime check
// was unsound at the time (see below); that is no longer strictly true --
// runInsetPass() further down now sets a REAL inset over CDP and asserts at
// runtime. Both are kept: this one needs no browser, covers the rules rather
// than one rendered state, and still runs where the CDP override is missing.
//
// env(safe-area-inset-top) resolves to 0 in headless Chromium, so an
// inset-AWARE rule -- calc(54px + env(safe-area-inset-top,0px)) -- computes to
// exactly the same 54px as an inset-BLIND one. The two are indistinguishable
// at runtime, on any viewport, at any simulated inset. The first version of
// this check simulated an inset and passed on known-broken CSS; it was testing
// its own override, not the page.
//
// So this reads the rule instead. D11's shape: a declaration positioned
// relative to the session stat bar, written as a flat pixel value. The bar
// itself sits at top:env(safe-area-inset-top), so anything measured down from
// it must carry the inset too, or it is correct only where the inset is zero --
// which is everywhere CI can test, and nowhere a real phone lives.
function checkInsetSource() {
  const file = path.resolve(__dirname, '..', 'mc-summary.css');
  if (!fs.existsSync(file)) return [];
  const css = fs.readFileSync(file, 'utf8');
  const bad = [];
  const re = /body\.mcs-stat-active[^{]*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const body = m[1];
    const sel = m[0].slice(0, m[0].indexOf('{')).trim().replace(/\s+/g, ' ');
    // only offsets matter — colour/display declarations in the same block don't
    const offsets = body.match(/(?:^|;)\s*(top|padding-top)\s*:[^;]+/g) || [];
    offsets.forEach(decl => {
      if (!/\d+px/.test(decl)) return;
      if (/env\(safe-area-inset-top/.test(decl)) return;
      bad.push(sel + ' {' + decl.replace(/^[;\s]+/, '') + '}');
    });
  }
  return bad;
}

/* ── the journey ─────────────────────────────────────────────────────────── */
// Adaptive rather than per-engine: mc-setlog.js is shared, so once cards render
// the logging flow is identical everywhere. Only "reveal the cards" differs.
async function revealCards(pg) {
  const strips = async () => pg.evaluate(() => document.querySelectorAll('.mcl-strip').length);
  if (await strips() > 0) return 'already rendered';
  const tried = [];
  try {
    const ok = await pg.evaluate(() => {
      if (typeof window.render === 'function') { window.openDayIdx = 0; window.render(); return true; }
      return false;
    });
    if (ok) { tried.push('render()'); await pg.waitForTimeout(1600);
      if (await strips() > 0) return tried.join(' -> '); }
  } catch (e) { /* engine has no global render(); fall through to clicking */ }
  for (const sel of ['.day-header', '.day-hdr', '.dcard-hdr', '.day-card', '.wtab', '.tabs-bar button']) {
    const els = await pg.$$(sel);
    for (let i = 0; i < Math.min(els.length, 3); i++) {
      try { await els[i].click({ timeout: 1200, force: true }); } catch (e) { continue; }
      tried.push(sel + '[' + i + ']');
      await pg.waitForTimeout(900);
      if (await strips() > 0) return tried.join(' -> ');
    }
  }
  return null;
}

/* ── REAL safe-area pass (D11-runtime) ───────────────────────────────────────
   The source check above exists because "env(safe-area-inset-top) resolves to
   0 in headless Chromium" -- true when it was written, and no longer true:
   CDP's Emulation.setSafeAreaInsetsOverride sets a REAL inset that env()
   resolves against, so an inset-aware rule and an inset-blind one finally
   compute differently and can be told apart at runtime.

   That matters because the source check can only see what it knows to read --
   `body.mcs-stat-active` blocks in mc-summary.css. It is blind to a page's OWN
   chrome, and 33 of the pages that load mc-finish.js declare a sticky top bar
   (.tabs-bar on 27, .week-selector on 4, .phase-tabs and a sticky .topbar on
   one each) in their own <style> with a flat `top:0`. At inset 0 those sit
   exactly where they should; at inset 59 they sit inside the notch, and once
   the session bar became an opaque lid over that whole band they became
   unreachable -- elementFromPoint at a tab's centre returned the bar. A green
   run of every other check in this file said nothing about it.

   So: drive the same session again at a real Dynamic Island inset and assert
   the two things only a nonzero inset can break -- that every sticky top bar
   clears both the notch and the session bar, and that the controls this shell
   owns are still hit-testable. Degrades to a skip (never a failure) where the
   CDP command is unavailable, so an older Chromium can't turn this into a
   red build on a repo that is fine. */
const INSET_TOP = 59;    // iPhone 15/16 Pro Dynamic Island, portrait
const STICKY_TOP_SEL = '.tabs-bar, .week-tabs, .week-selector, .phase-tabs, .topbar';

async function runInsetPass(ctx, entry) {
  const out = { page: entry.page, failures: [], skipped: null };
  const pg = await ctx.newPage();
  try {
    const cdp = await ctx.newCDPSession(pg);
    try {
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: INSET_TOP, bottom: 34 } });
    } catch (e) {
      out.skipped = 'Emulation.setSafeAreaInsetsOverride unavailable in this Chromium';
      await pg.close(); return out;
    }
    await pg.goto(baseUrl + '/' + entry.page, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await pg.waitForTimeout(2200);

    // Confirm the override actually took, or the whole pass is meaningless --
    // this is the mistake the original runtime check made (testing its own
    // override). If env() still reads 0 we skip rather than assert on nothing.
    const envTop = await pg.evaluate(() => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:0;width:1px;height:env(safe-area-inset-top,0px);';
      document.body.appendChild(d);
      const h = d.getBoundingClientRect().height; d.remove(); return h;
    });
    if (Math.round(envTop) !== INSET_TOP) {
      out.skipped = 'env(safe-area-inset-top) read back as ' + envTop + 'px, not ' + INSET_TOP;
      await pg.close(); return out;
    }

    // A page whose cards cannot be revealed has nothing to assert against, so
    // this pass bails -- but it MUST bail as a skip, not as a pass. It used to
    // `return out` with skipped:null, which the summary counts as clean: a page
    // that reveals nothing reported "inset pass clean" while asserting nothing
    // at all. The main pass catches an unrevealable page (JOURNEY: no exercise
    // cards could be revealed), so this never went wrong in practice -- but
    // roadmap F3 changes precisely this reveal path on 23 pages, which is the
    // moment a silently-clean inset pass would start lying.
    if (!(await revealCards(pg))) {
      out.skipped = 'no exercise cards could be revealed at inset';
      await pg.close(); return out;
    }
    await pg.evaluate(() => { const s = document.querySelectorAll('.mcl-strip'); const t = s[1] || s[0]; if (t) t.click(); });
    await pg.waitForTimeout(1000);
    await pg.evaluate(() => { const w = document.querySelector('.mcl-wrap.open .mcl-w');
      if (w) { w.value = '185'; w.dispatchEvent(new Event('input', { bubbles: true })); }
      const c = document.querySelector('.mcl-wrap.open .mcl-ck'); if (c) c.click(); });
    await pg.waitForTimeout(1800);
    // push the sticky chrome hard against its offset so it is actually stuck
    await pg.evaluate(() => window.scrollBy(0, 900));
    await pg.waitForTimeout(500);

    const res = await pg.evaluate(({ inset, stickySel, critical }) => {
      const bar = document.querySelector('.prog-bar-wrap.mcs-stat');
      const barBottom = bar ? bar.getBoundingClientRect().bottom : inset;
      const bad = [];
      // NOTE: the sticky-chrome scan below must run before the critical-control
      // loop, which scrolls elements to centre and would move the page under it.
      document.querySelectorAll(stickySel).forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.position !== 'sticky' || cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.height < 4) return;
        const name = '.' + String(el.className || '').trim().split(/\s+/)[0];
        if (r.top < Math.round(barBottom) - 1) {
          // Two distinct failures, both real, and worth telling apart: inside
          // the notch means the status bar is drawn over it; below the notch
          // but above the bar's bottom means the bar covers it.
          bad.push(name + ' sticks at y' + Math.round(r.top) + ' — ' +
            (r.top < inset
              ? 'inside the ' + inset + 'px notch, where the status bar paints over it'
              : 'behind the session bar (which ends at y' + Math.round(barBottom) + ')') +
            '. Sticky top chrome must pin below both.');
          return;
        }
        const tab = el.querySelector('button,a,.wtab') || el.firstElementChild;
        if (!tab) return;
        const q = tab.getBoundingClientRect();
        if (!q.width || !q.height) return;
        const hit = document.elementFromPoint(Math.round(q.left + q.width / 2), Math.round(q.top + q.height / 2));
        if (!(hit && (hit === tab || tab.contains(hit) || hit.contains(tab)))) {
          bad.push(name + ' is covered — a tap at its first control lands on ' +
            (hit ? hit.tagName.toLowerCase() + '.' + String(hit.className || '').split(' ')[0] : 'nothing'));
        }
      });
      // The session shell's own controls must survive the inset too -- but
      // PERMANENT occlusion only, exactly as MEASURE() defines it. A control
      // that happens to be under the bar at this scroll position is fine (you
      // scroll); one still covered after being centred is not. Skipping the
      // scrollIntoView here reported every set checkbox that had drifted under
      // the toolbar, on pages that are completely fine.
      critical.forEach(c => {
        document.querySelectorAll(c.sel).forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const r0 = el.getBoundingClientRect();
          if (!r0.width || !r0.height) return;
          el.scrollIntoView({ block: 'center' });
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          if (cy < 0 || cy >= innerHeight || cx < 0 || cx >= innerWidth) return;
          const hit = document.elementFromPoint(Math.round(cx), Math.round(cy));
          if (hit && !(hit === el || el.contains(hit) || hit.contains(el))) {
            bad.push(c.name + ' unreachable at inset — tap lands on ' +
              hit.tagName.toLowerCase() + '.' + String(hit.className || '').split(' ')[0]);
          }
        });
      });
      return [...new Set(bad)];
    }, { inset: INSET_TOP, stickySel: STICKY_TOP_SEL, critical: CRITICAL });

    out.failures = res;
  } catch (e) {
    out.failures.push('inset pass threw — ' + String(e).slice(0, 120));
  }
  await pg.close();
  return out;
}

async function runJourney(ctx, entry, vpName) {
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e).slice(0, 140)));
  pg.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/i.test(m.text())) return;   // blocked CDN/font in CI
    errors.push('console: ' + m.text().slice(0, 130));
  });

  const r = { page: entry.page, engine: entry.engine, viewport: vpName,
              errors, failures: [], atRest: null, inSession: null };
  try {
    await pg.goto(baseUrl + '/' + entry.page, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await pg.waitForTimeout(2500);
    r.atRest = await pg.evaluate(MEASURE, CRITICAL);

    const how = await revealCards(pg);
    if (!how) { r.failures.push('JOURNEY: no exercise cards could be revealed'); await pg.close(); return r; }
    r.driver = how;

    await pg.evaluate(() => { const s = document.querySelectorAll('.mcl-strip'); const t = s[1] || s[0]; if (t) t.click(); });
    await pg.waitForTimeout(1200);
    if (await pg.evaluate(() => document.querySelectorAll('.mcl-wrap.open .mcl-ck').length) === 0) {
      r.failures.push('JOURNEY: opening an exercise produced no set rows');
      await pg.close(); return r;
    }

    await pg.evaluate(() => { const w = document.querySelector('.mcl-wrap.open .mcl-w');
      if (w) { w.value = '185'; w.dispatchEvent(new Event('input', { bubbles: true })); } });
    await pg.evaluate(() => { const c = document.querySelector('.mcl-wrap.open .mcl-ck'); if (c) c.click(); });
    await pg.waitForTimeout(1700);

    const mid = await pg.evaluate(STATE);
    if (!mid.done) r.failures.push('JOURNEY: checking a set did not record it');
    r.inSession = await pg.evaluate(MEASURE, CRITICAL);

    await pg.evaluate(() => { document.querySelectorAll('.mcl-wrap.open .mcl-ck:not(.done)').forEach(c => c.click()); });
    await pg.waitForTimeout(1800);

    await pg.evaluate(() => { const e = document.getElementById('mcsEnd'); if (e) e.click(); });
    await pg.waitForTimeout(1400);
    const ended = await pg.evaluate(() => {
      const o = [...document.querySelectorAll('.fw-modal-overlay,.fw-recap-overlay,#fwDone')]
        .find(e => getComputedStyle(e).display !== 'none');
      return o ? (o.className || o.id) : null;
    });
    if (!ended) r.failures.push('JOURNEY: End workout did not open the finish flow');

  } catch (e) {
    r.failures.push('JOURNEY: threw — ' + String(e).slice(0, 140));
  }
  await pg.close();
  return r;
}

/* ── main ────────────────────────────────────────────────────────────────── */
(async () => {
  const vpNames = has('--all-viewports')
    ? Object.keys(VIEWPORTS)
    : [val('--viewport', 'iPhone 13')];
  for (const v of vpNames) {
    if (!VIEWPORTS[v]) { console.error('unknown viewport: ' + v +
      ' (known: ' + Object.keys(VIEWPORTS).join(', ') + ')'); process.exit(1); }
  }

  let budgets = {};
  if (fs.existsSync(BUDGET_FILE)) {
    try { budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')); } catch (e) { budgets = {}; }
  }

  // Source-level guard first — it needs no browser, and a failure here means
  // every viewport below would have passed while a real phone stayed broken.
  const insetBad = checkInsetSource();
  if (insetBad.length && !UPDATE) {
    console.error('\ncheck-journey: SAFE-AREA — offsets measured from the session bar that do not carry the inset:');
    insetBad.forEach(b => console.error('    ::error file=mc-summary.css::SAFE-AREA: ' + b +
      ' is a flat pixel offset. The bar sits at top:env(safe-area-inset-top), so this is correct only where the inset is zero.'));
  }

  const browser = await chromium.launch();
  const results = [];
  const insetResults = [];
  for (const vpName of vpNames) {
    const ctx = await browser.newContext({
      viewport: VIEWPORTS[vpName], deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    // Third-party requests aren't reachable in CI and aren't the point.
    await ctx.route('**://fonts.googleapis.com/**', r => r.abort());
    await ctx.route('**://cdn.jsdelivr.net/**', r => r.abort());
    for (const entry of PAGES) results.push(await runJourney(ctx, entry, vpName));
    // One real-inset pass per page, at the baseline viewport only — the inset
    // is what this tests, not the width, so sweeping widths would just re-run
    // the same assertion four times.
    if (vpName === 'iPhone 13') {
      for (const entry of PAGES) insetResults.push(await runInsetPass(ctx, entry));
    }
    await ctx.close();
  }
  await browser.close();

  /* budgets: chrome coverage only. Everything else is a hard assertion — an
     unreachable control or a broken journey has no acceptable level. */
  const nextBudgets = {};
  let failed = 0;

  for (const r of results) {
    const key = r.page + ' @ ' + r.viewport;
    const line = [];
    if (r.atRest)    line.push('rest ' + r.atRest.coveredPct + '%');
    if (r.inSession) line.push('session ' + r.inSession.coveredPct + '%');

    if (r.atRest && r.inSession) {
      nextBudgets[key] = { atRest: r.atRest.coveredPct, inSession: r.inSession.coveredPct };
      const b = budgets[key];
      if (b && !UPDATE) {
        if (r.atRest.coveredPct > b.atRest * BUDGET_SLACK)
          r.failures.push('CHROME: at rest ' + r.atRest.coveredPct + '% vs budget ' + b.atRest + '%');
        if (r.inSession.coveredPct > b.inSession * BUDGET_SLACK)
          r.failures.push('CHROME: in session ' + r.inSession.coveredPct + '% vs budget ' + b.inSession + '%');
      }
    }
    for (const phase of ['atRest', 'inSession']) {
      const m = r[phase]; if (!m) continue;
      m.occluded.forEach(o => r.failures.push('OCCLUSION (' + phase + '): ' + o));
      m.tooSmall.forEach(t => r.failures.push('TOUCH (' + phase + '): ' + t + ' is under 44x44'));
      if (m.hOverflow > 0) r.failures.push('OVERFLOW (' + phase + '): page scrolls ' + m.hOverflow + 'px sideways');
    }
    r.errors.slice(0, 4).forEach(e => r.failures.push('ERROR: ' + e));

    if (r.failures.length) {
      failed++;
      console.error('\n✗ ' + key + '  [' + r.engine + ']  ' + line.join('  '));
      r.failures.forEach(f => console.error('    ::error file=' + r.page + '::' + f));
    } else {
      console.log('✓ ' + key.padEnd(44) + line.join('  '));
    }
  }

  if (UPDATE) {
    fs.writeFileSync(BUDGET_FILE, JSON.stringify(nextBudgets, null, 2) + '\n');
    console.log('\nBudgets written — ' + Object.keys(nextBudgets).length + ' entr(ies) to ' + path.basename(BUDGET_FILE));
    process.exit(0);
  }

  // real-inset pass
  const insetSkipped = insetResults.filter(r => r.skipped);
  const insetBadPages = insetResults.filter(r => r.failures.length);
  if (insetSkipped.length && insetSkipped.length === insetResults.length) {
    console.log('\ncheck-journey: real-inset pass SKIPPED — ' + insetSkipped[0].skipped);
  } else if (insetBadPages.length && !UPDATE) {
    insetBadPages.forEach(r => {
      console.error('\n\u2717 ' + r.page + '  @ safe-area inset ' + INSET_TOP + 'px');
      r.failures.forEach(f => console.error('    ::error file=' + r.page + '::SAFE-AREA(runtime): ' + f));
    });
    failed += insetBadPages.length;
  } else if (insetResults.length) {
    console.log('\ncheck-journey: real-inset pass clean on ' +
      (insetResults.length - insetSkipped.length) + ' page(s) at a ' + INSET_TOP + 'px inset.');
    // Name a PARTIAL skip. "clean on 8 page(s)" after nine were requested is
    // only readable if the ninth says why it dropped out.
    insetSkipped.forEach(r => console.log('    - skipped ' + r.page + ': ' + r.skipped));
  }

  console.log('\ncheck-journey: ' + (results.length - failed) + '/' + results.length +
    ' complete workout journeys clean across ' + vpNames.length + ' viewport(s)' +
    (insetBad.length ? '' : ', safe-area offsets all inset-aware'));
  if (insetBad.length) failed++;
  if (failed) {
    console.error('\ncheck-journey: ' + failed + ' journey/journeys failed. ' +
      'These are defects a resting page cannot show — re-run locally with ' +
      '`node tools/check-journey.js <url>` and drive the page yourself.');
    process.exit(1);
  }
})().catch(e => { console.error('::error::check-journey.js crashed — ' + e.message); process.exit(1); });
