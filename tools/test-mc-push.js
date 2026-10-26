#!/usr/bin/env node
'use strict';
/* tools/test-mc-push.js — the VAPID key rotation (2026-10-26)

   A push subscription is bound to the VAPID public key it was created under,
   and the browser refuses a subscribe() with a different key while the old
   subscription exists. So rotating the key would leave every subscribed
   device reporting "on" while no push could reach it. mc-push.js's migrate()
   replaces a subscription made under any other key, once, without asking for
   permission again.

   Runs the REAL mc-push.js in a vm sandbox with a fake PushManager and a fake
   MC_SB (the test-mc-bridge.js technique). Run: node tools/test-mc-push.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '../mc-push.js'), 'utf8');
const KEY = /VAPID_PUBLIC_KEY\s*=\s*'([A-Za-z0-9_-]+)'/.exec(SRC)[1];
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } }
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

function load(opts) {
  const ls = Object.assign({}, opts.ls || {});
  const log = { subscribed: [], unsubscribed: 0, saved: [], deleted: [] };
  let current = opts.existing ? { endpoint: 'https://push/old', unsubscribe: () => { log.unsubscribed++; current = null; return Promise.resolve(true); },
                                  toJSON: () => ({ endpoint: 'https://push/old', keys: {} }) } : null;
  const pushManager = {
    getSubscription: () => Promise.resolve(current),
    subscribe: (o) => {
      if (current) return Promise.reject(new Error('InvalidStateError: a subscription with a different key exists'));
      const k = Buffer.from(o.applicationServerKey).toString('base64url');
      log.subscribed.push(k);
      current = { endpoint: 'https://push/new', unsubscribe: () => { current = null; return Promise.resolve(true); },
                  toJSON: () => ({ endpoint: 'https://push/new', keys: { p256dh: 'p', auth: 'a' } }) };
      return Promise.resolve(current);
    },
  };
  const timers = [];
  const win = {
    MC_SB: {
      savePushSubscription: (s) => { log.saved.push(s.endpoint); return Promise.resolve(); },
      deletePushSubscription: (e) => { log.deleted.push(e); return Promise.resolve(); },
    },
  };
  const sb = {
    window: win, PushManager: function () {}, Notification: { permission: opts.permission || 'granted', requestPermission: () => Promise.resolve(opts.permission || 'granted') },
    navigator: { serviceWorker: { ready: Promise.resolve({ pushManager }) } },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    setTimeout: (fn) => { timers.push(fn); return 0; },
    Promise, Uint8Array,
  };
  sb.window.PushManager = sb.PushManager; sb.window.Notification = sb.Notification;
  sb.MC_SB = win.MC_SB;   // a browser global is also a bare name
  vm.createContext(sb);
  vm.runInContext(SRC, sb, { filename: 'mc-push.js' });
  return { P: win.MC_PUSH, ls, log, timers };
}

(async () => {
  // 1. A device subscribed before the rotation is moved onto the new key, on load.
  {
    const t = load({ existing: true });
    ok(t.timers.length === 1, '1a: migrate() is scheduled on load');
    t.timers[0](); await flush();
    ok(t.log.unsubscribed === 1, '1b: the old subscription is dropped');
    ok(t.log.deleted[0] === 'https://push/old', '1c: and removed from Supabase');
    ok(t.log.subscribed.length === 1 && t.log.subscribed[0] === KEY, '1d: a new one is made with the current key');
    ok(t.log.saved[0] === 'https://push/new', '1e: and saved to Supabase');
    ok(t.ls.mc_push_key_v1 === KEY, '1f: the key it was made with is recorded');
    await t.P.migrate(); await flush();
    ok(t.log.subscribed.length === 1, '1g: a second load changes nothing');
  }
  // 2. A device that never subscribed is not subscribed by a migration.
  {
    const t = load({ existing: false });
    await t.P.migrate(); await flush();
    ok(t.log.subscribed.length === 0, '2: no subscription, no migration');
  }
  // 3. Permission not granted: nothing happens, and no prompt is shown.
  {
    const t = load({ existing: true, permission: 'default' });
    await t.P.migrate(); await flush();
    ok(t.log.unsubscribed === 0 && t.log.subscribed.length === 0, '3: no permission, no migration');
  }
  // 4. Turning notifications on from the dashboard on an old-key device does
  //    not hit the browser's "different key" error.
  {
    const t = load({ existing: true });
    const sub = await t.P.requestAndSubscribe(); await flush();
    ok(sub && sub.endpoint === 'https://push/new' && t.log.subscribed[0] === KEY, '4: requestAndSubscribe() replaces a stale subscription');
  }
  // 5. A device already on the current key keeps its subscription.
  {
    const t = load({ existing: true, ls: { mc_push_key_v1: KEY } });
    await t.P.migrate(); await flush();
    ok(t.log.unsubscribed === 0 && t.log.subscribed.length === 0, '5: current-key subscription is left alone');
  }
  console.log('test-mc-push: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
