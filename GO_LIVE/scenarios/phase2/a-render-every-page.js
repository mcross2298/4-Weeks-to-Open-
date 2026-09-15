/* PHASE 2 / A — render EVERY tracked page, not a 38-page sample.
   Asserts: no uncaught exception, no non-resource console error, no duplicate
   element id, no sideways overflow at 390px. */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const pages = execSync(`git ls-files '*.html'`, { cwd: '/home/user/4-Weeks-to-Open-', encoding: 'utf8' })
  .split('\n').filter(Boolean).filter(p => !p.endsWith('.dc.html'));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MC_CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**://fonts.googleapis.com/**', r => r.abort());
  await ctx.route('**://*.supabase.co/**', r => r.abort());
  const bad = [];
  let clean = 0;
  for (const path of pages) {
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push('THROW ' + e.message.split('\n')[0].slice(0, 110)));
    pg.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/Failed to load resource|net::ERR|ERR_FAILED|ERR_ABORTED/i.test(t)) return;
      errs.push('CONSOLE ' + t.slice(0, 110));
    });
    await pg.addInitScript(() => {
      Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    });
    let nav = null;
    try {
      await pg.goto(BASE + '/' + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await pg.waitForTimeout(700);
    } catch (e) { nav = e.message.split('\n')[0].slice(0, 80); }
    let dup = [], overflow = null;
    if (!nav) {
      try {
        const r = await pg.evaluate(() => {
          const seen = {};
          document.querySelectorAll('[id]').forEach(el => { if (el.id) seen[el.id] = (seen[el.id] || 0) + 1; });
          return {
            dup: Object.keys(seen).filter(k => seen[k] > 1).map(k => k + '×' + seen[k]),
            sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
          };
        });
        dup = r.dup;
        if (r.sw > r.cw + 1) overflow = `${r.sw}px in ${r.cw}px`;
      } catch (e) { /* torn down */ }
    }
    const issues = [];
    if (nav) issues.push('NAV ' + nav);
    if (errs.length) issues.push(...errs.slice(0, 3));
    if (dup.length) issues.push('DUPID ' + dup.join(','));
    if (overflow) issues.push('OVERFLOW ' + overflow);
    if (issues.length) { bad.push({ path, issues }); process.stdout.write('x'); }
    else { clean++; process.stdout.write('.'); }
    await pg.close();
  }
  await browser.close();
  console.log(`\n\nPHASE A — ${pages.length} pages rendered at 390px`);
  console.log(`clean: ${clean}   with findings: ${bad.length}\n`);
  bad.forEach(b => { console.log(b.path); b.issues.forEach(i => console.log('    ' + i)); });
  console.log(JSON.stringify({ total: pages.length, clean, bad }, null, 1).slice(0, 0));
  require('fs').writeFileSync('/tmp/claude-0/-home-user/a74a0f41-f369-5584-b1fd-bd371305a6eb/scratchpad/p2/a-render-all.json', JSON.stringify(bad, null, 1));
})();
