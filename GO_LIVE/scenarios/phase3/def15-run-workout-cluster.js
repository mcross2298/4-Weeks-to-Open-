/* Does run-workout.html lose a logged set when a cluster is edited mid-session?
   Its cluster handlers call render() — a full re-render — after saving. If
   mc-setlog rebuilds rows and nothing re-applies the checked sets, that is data
   loss, which is strictly worse than DEF-12's symptom on the program pages.
   Driven, not reasoned about. */
const { chromium } = require('/tmp/pw-ci/node_modules/playwright');
const BASE = process.argv[2] || 'http://localhost:8099';

const WORKOUT = {
  id: 'golive-cluster-probe',
  name: 'Cluster Probe',
  exercises: [
    { name: 'Barbell Bench Press', sets: 3, reps: '8', rest: 90, cluster: '5+5+5', clusterRest: '15s' },
    { name: 'Barbell Row', sets: 3, reps: '8', rest: 90 }
  ]
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // seed the custom workout before any script runs
  await pg.addInitScript((wk) => {
    try {
      localStorage.setItem('mc_custom_workouts_v1', JSON.stringify([wk]));
      localStorage.removeItem('mc_setlog_v1');
      localStorage.removeItem('mc_session_v1');
    } catch (e) {}
  }, WORKOUT);

  await pg.goto(BASE + '/run-workout.html?id=' + WORKOUT.id, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);

  const snap = async (label) => {
    const s = await pg.evaluate(() => {
      const card = document.querySelector('.ex-card, .ex-item');
      const bubbles = document.querySelectorAll('.mcl-mini, .mcl-rep-mini, input.mcl-mini-inp');
      let store = {};
      try { store = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}'); } catch (e) {}
      let logged = 0;
      Object.keys(store).forEach((k) => {
        const days = store[k] || {};
        Object.keys(days).forEach((d) => {
          const sets = (days[d] || {}).sets || {};
          logged += Object.keys(sets).length;
        });
      });
      return {
        clusterAttr: card ? (card.dataset.mcCluster || card.getAttribute('data-mc-cluster') || null) : null,
        checked: document.querySelectorAll('.mcl-ck[aria-checked="true"], .mcl-ck.done, .sl-ck.done').length,
        bubbleInputs: bubbles.length,
        countBadge: (document.querySelector('.mcl-strip-count, .mcl-count') || {}).textContent || null,
        loggedSetsInStore: logged
      };
    });
    console.log(`  ${label}:`, JSON.stringify(s));
    return s;
  };

  // open the logger on the first card
  const opened = await pg.evaluate(() => {
    const t = document.querySelector('.mcl-toggle, .mcl-strip');
    if (t) { t.click(); return true; }
    return false;
  });
  console.log('logger opened:', opened);
  await pg.waitForTimeout(900);
  console.log('after opening the logger');
  const a = await snap('A');

  // log one set: fill weight + reps, then check it
  await pg.evaluate(() => {
    const row = document.querySelector('.mcl-row');
    if (!row) return;
    row.querySelectorAll('input').forEach((inp) => {
      if (!inp.value) inp.value = '135';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const ck = row.querySelector('.mcl-ck');
    if (ck) ck.click();
  });
  await pg.waitForTimeout(1200);
  console.log('after logging one set');
  const b = await snap('B');

  // now edit the cluster mid-session, the DEF-12 action
  const clicked = await pg.evaluate(() => {
    const badge = document.querySelector('.tb-cluster');
    if (!badge) return 'no .tb-cluster badge';
    badge.click();
    return 'clicked';
  });
  console.log('cluster badge:', clicked);
  await pg.waitForTimeout(700);

  const saved = await pg.evaluate(() => {
    const pop = document.getElementById('clusterPop');
    if (!pop) return 'no popover';
    const inps = pop.querySelectorAll('.cluster-pop-inp');
    if (inps.length) {
      inps[inps.length - 1].value = '3';           // 5+5+5 -> 5+5+3
      inps[inps.length - 1].dispatchEvent(new Event('input', { bubbles: true }));
    }
    const done = pop.querySelector('.cluster-pop-done');
    if (done) { done.click(); return 'saved'; }
    return 'no Done button';
  });
  console.log('popover:', saved);
  await pg.waitForTimeout(1500);
  console.log('after the cluster edit + render()');
  const c = await snap('C');

  console.log('\n--- verdict ---');
  console.log('cluster attr repainted to 5+5+3 :', c.clusterAttr);
  console.log('logged sets in store before / after :', b.loggedSetsInStore, '/', c.loggedSetsInStore);
  console.log('checked rows in DOM before / after  :', b.checked, '/', c.checked);
  const storeKept = c.loggedSetsInStore >= b.loggedSetsInStore && b.loggedSetsInStore > 0;
  console.log(storeKept ? 'STORE: set survived the re-render' : 'STORE: SET LOST — data loss on this page');
  console.log('console/page errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
