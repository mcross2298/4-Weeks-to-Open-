/* The DEF-12 copy fix has to be TRUE on the rendered page, not just in the
   source. quick-tour.html shows one slide at a time; quick-tour-full.html
   renders all of them; quick-tour-overview.html is the Executive Summary. All
   three must carry the corrected sentence and none may still promise the
   mid-session case. */
const { chromium } = require('/tmp/pw-ci/node_modules/playwright');
const BASE = process.argv[2] || 'http://localhost:8099';
const GOOD = 'the rep bubbles pick it up the next time you open the workout';
const BAD = 'adjust the whole breakdown mid-session';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  let fails = 0;

  for (const page of ['quick-tour-full.html', 'quick-tour-overview.html', 'quick-tour.html']) {
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.goto(BASE + '/' + page, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(800);

    // For the step tour, the cluster slide is not the one on screen — read the
    // rendered text of EVERY slide node, visible or not, since the fix is about
    // what the slide says, not which slide is showing.
    const r = await pg.evaluate(() => {
      const nodes = document.querySelectorAll('.qt-slide, .slide, .qtf-sec, li, p');
      let all = '';
      nodes.forEach((n) => { all += ' ' + (n.textContent || ''); });
      return { text: all.replace(/\s+/g, ' '), slideCount: document.querySelectorAll('.qt-slide, .qtf-sec').length };
    });

    const hasGood = r.text.includes(GOOD);
    const hasBad = r.text.includes(BAD);
    const mentionsCluster = /Cluster/i.test(r.text);
    const ok = mentionsCluster && hasGood && !hasBad;
    if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${page}`);
    console.log(`        slides/sections: ${r.slideCount}, mentions Cluster: ${mentionsCluster}`);
    console.log(`        corrected sentence present: ${hasGood}`);
    console.log(`        stale "mid-session" claim present: ${hasBad}`);
    if (errs.length) { console.log('        pageerrors: ' + errs.join(' | ')); fails++; }
    await pg.close();
  }

  console.log(fails ? `\n${fails} FAILED` : '\nall three surfaces carry the corrected copy');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
