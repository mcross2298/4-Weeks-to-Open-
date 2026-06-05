// Renders the dashboard's Programs tab with headless Chromium and writes
// PNGs to screenshots/. Run on a GitHub runner (which has network access)
// against a local static server. Two shots:
//   1) programs-default.png      — clean default state
//   2) programs-pinned-streak.png — a program pinned + a live Daily Gainz streak
import { chromium } from 'playwright';

const URL = 'http://localhost:8000/dashboard.html?tab=programs';
const VIEWPORT = { width: 430, height: 1560 };

const browser = await chromium.launch();

async function shot(file, seed) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  if (seed) await ctx.addInitScript(seed);
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200); // let fonts + the programs tab + live strip settle
  await page.screenshot({ path: file });
  await ctx.close();
  console.log('wrote', file);
}

// 1) default
await shot('screenshots/programs-default.png', null);

// 2) seeded live state — pinned program + 4-day Gainz streak with a resume target
const seed = () => {
  try {
    const d = new Date();
    const k = (x) => x.getFullYear() + '-' +
      String(x.getMonth() + 1).padStart(2, '0') + '-' +
      String(x.getDate()).padStart(2, '0');
    const days = {};
    for (let i = 0; i < 4; i++) { const c = new Date(); c.setDate(d.getDate() - i); days[k(c)] = true; }
    localStorage.setItem('mc_activity', JSON.stringify({
      days,
      last: { pageId: 'bro-split.html', title: 'Bro Split — Chest Day', done: 5, total: 8, ts: Date.now() }
    }));
    localStorage.setItem('mc_active_prog', JSON.stringify({
      id: 'mc', name: "Mike Cross' Favorite Splits",
      desc: '5 personal splits across every major training style',
      color: '#d4af37', splits: ['Split 1', 'Split 2', 'Split 3', 'Split 4', 'Split 5']
    }));
  } catch (e) {}
};
await shot('screenshots/programs-pinned-streak.png', seed);

await browser.close();
