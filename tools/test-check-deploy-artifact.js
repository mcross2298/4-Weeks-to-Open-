#!/usr/bin/env node
/* tools/test-check-deploy-artifact.js — the Rolodex leak scan's verdicts.

   check-deploy-artifact.js asks, per scratch/licensed file, "is it served on
   the live site?". On 2026-11-15 a burst of 503s from GitHub Pages reported
   29 files as "reachable" and turned the deploy red, though nothing had been
   served; and a network error counted as "confirmed absent", so a scan that
   reached nothing would have passed. Only a 404 means absent and only a
   2xx/3xx means reachable; anything else is retried, then reported as
   unverified. No network: fetch is stubbed. */
const assert = require('assert');
const { absenceVerdict, checkAbsent } = require('./check-deploy-artifact.js');

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' — ' + e.message); }
}
const seq = (list) => { let i = 0; const calls = []; const fn = async (u) => { calls.push(u); return list[Math.min(i++, list.length - 1)]; }; fn.calls = calls; return fn; };

(async () => {
  await t('404 is absent', () => assert.strictEqual(absenceVerdict(404), 'absent'));
  await t('200 is reachable', () => assert.strictEqual(absenceVerdict(200), 'reachable'));
  await t('a redirect is reachable', () => assert.strictEqual(absenceVerdict(301), 'reachable'));
  await t('503 is not a leak', () => assert.strictEqual(absenceVerdict(503), 'unknown'));
  await t('429 is not a leak', () => assert.strictEqual(absenceVerdict(429), 'unknown'));
  await t('a network error is not proof of absence', () => assert.strictEqual(absenceVerdict(null), 'unknown'));

  await t('a transient 503 that clears to 404 is absent', async () => {
    const f = seq([503, 503, 404]);
    const r = await checkAbsent('u', { attempts: 4, backoffMs: 0, fetchStatusFn: f });
    assert.deepStrictEqual(r, { verdict: 'absent', status: 404 });
    assert.strictEqual(f.calls.length, 3);
  });
  await t('a 503 that clears to 200 is still a leak', async () => {
    const r = await checkAbsent('u', { attempts: 4, backoffMs: 0, fetchStatusFn: seq([503, 200]) });
    assert.strictEqual(r.verdict, 'reachable');
  });
  await t('a persistent 503 is unverified, never absent or reachable', async () => {
    const f = seq([503]);
    const r = await checkAbsent('u', { attempts: 3, backoffMs: 0, fetchStatusFn: f });
    assert.deepStrictEqual(r, { verdict: 'unknown', status: 503 });
    assert.strictEqual(f.calls.length, 3);
  });
  await t('persistent network errors are unverified', async () => {
    const r = await checkAbsent('u', { attempts: 2, backoffMs: 0, fetchStatusFn: seq([null]) });
    assert.strictEqual(r.verdict, 'unknown');
  });
  await t('a 404 on the first try does not retry', async () => {
    const f = seq([404]);
    await checkAbsent('u', { attempts: 4, backoffMs: 0, fetchStatusFn: f });
    assert.strictEqual(f.calls.length, 1);
  });

  console.log(`test-check-deploy-artifact: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
