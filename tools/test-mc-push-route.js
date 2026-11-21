#!/usr/bin/env node
// SP1 (settings-pathways-roadmap.md): where a tapped push opens. Runs the
// real mc-push-route.js, the file sw.js loads with importScripts, and checks
// that every sender's type is one the router and push-notify both know.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failed = 0, passed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; } else { failed++; console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

const sandbox = {}; sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('mc-push-route.js'), sandbox, { filename: 'mc-push-route.js' });
const R = sandbox.MC_PUSH_ROUTE;
check('MC_PUSH_ROUTE is published on self', !!R && typeof R.route === 'function');

const cases = [
  [{ type: 'pr' }, 'workout-logs.html', true],
  [{ type: 'checkin' }, 'stats.html', false],
  [{ type: 'streak' }, 'dashboard.html', false],
  [{ type: 'nope' }, 'dashboard.html', false],
  [{ type: 'constructor' }, 'dashboard.html', false],
  [{ type: '__proto__' }, 'dashboard.html', false],
  [{}, 'dashboard.html', false],
  [null, 'dashboard.html', false],
  ['pr', 'dashboard.html', false],
  [{ type: 'pr', url: 'https://evil.example/' }, 'workout-logs.html', true]
];
for (const [p, url, keep] of cases) {
  const r = R.route(p);
  check('route(' + JSON.stringify(p) + ') opens ' + url, r.url === url, 'got ' + r.url);
  check('route(' + JSON.stringify(p) + ') keepOpen=' + keep, r.keepOpen === keep);
  check('route(' + JSON.stringify(p) + ') stays in the app', /^[a-z-]+\.html$/.test(r.url));
}
check('each type has its own tag', /^mc-pr-/.test(R.tag({ type: 'pr' })) && R.tag({ type: 'checkin' }) === 'mc-checkin');
check('two PR pushes never share a tag (one does not replace the other)', R.tag({ type: 'pr' }) !== R.tag({ type: 'pr' }));
check('a check-in still replaces the last one (same tag)', R.tag({ type: 'checkin' }) === R.tag({ type: 'checkin' }));
check('an untyped push keeps the old tag', R.tag({}) === 'mc-milestone');
for (const t of R.TYPES) check('route target exists: ' + R.route({ type: t }).url, fs.existsSync(path.join(ROOT, R.route({ type: t }).url)));

// push-notify forwards only an allowlisted type; it must be the router's list.
const pn = read('supabase/functions/push-notify/index.ts');
const m = pn.match(/const PUSH_TYPES = (\[[^\]]*\]);/);
check('push-notify declares PUSH_TYPES', !!m);
if (m) {
  const list = JSON.parse(m[1]);
  check('push-notify PUSH_TYPES equals MC_PUSH_ROUTE.TYPES', JSON.stringify(list.slice().sort()) === JSON.stringify(Array.from(R.TYPES).sort()), m[1]);
}

// Every sender names a type the router knows.
const senders = [
  ['mc-setlog.js', /type: 'pr'/g, 2],
  ['dashboard.html', /sendPush\(\{type:'streak'/g, 1],
  ['supabase/functions/weekly-checkin/index.ts', /type: "checkin"/g, 1]
];
for (const [f, re, n] of senders) {
  const c = (read(f).match(re) || []).length;
  check(f + ' sends its type (' + n + ' site' + (n > 1 ? 's' : '') + ')', c === n, 'found ' + c);
}
check('mc-supabase.js sendPush forwards type', /type: opts\.type/.test(read('mc-supabase.js')));

// SP2: one Settings switch per push type, and every sender honours it.
const ws = read('workout-settings.html');
const nb = ws.match(/var NOTIFY = \[([\s\S]*?)\];/);
check('workout-settings.html declares NOTIFY', !!nb);
if (nb) {
  const keys = Array.from(nb[1].matchAll(/k: '([a-z]+)'/g)).map(x => x[1]).sort();
  check('Settings has a switch for every push type', JSON.stringify(keys) === JSON.stringify(Array.from(R.TYPES).sort()), keys.join(','));
}
check('Settings saves the switches to mc_notify_v1', /var NKEY = 'mc_notify_v1'/.test(ws) && /localStorage\.setItem\(NKEY/.test(ws));
check('mc-supabase.js sendPush skips a muted type', /mc_notify_v1[\s\S]{0,120}\[opts\.type\] === false/.test(read('mc-supabase.js')));
check('push-notify skips a muted type', /store_key", "mc_notify_v1"[\s\S]{0,200}prefs\[type\] === false/.test(pn));
const wc = read('supabase/functions/weekly-checkin/index.ts');
check('weekly-checkin reads mc_notify_v1', /"mc_notify_v1"\]/.test(wc) && /\.checkin === false/.test(wc));
check('weekly-checkin skips a muted user', /if \(body === null\) \{ muted\+\+; continue; \}/.test(wc));
check('mc_notify_v1 syncs per key', /'mc_notify_v1':\s*'dictBase'/.test(read('mc-sync.js')));

// sw.js loads the router and routes the tap through it.
const sw = read('sw.js');
check('sw.js importScripts mc-push-route.js', /importScripts\('\.\/mc-push-route\.js'\)/.test(sw));
check('sw.js notificationclick routes by MC_PUSH_ROUTE', /notificationclick[\s\S]*MC_PUSH_ROUTE[\s\S]*\.route\(event\.notification\.data\)/.test(sw));
check('sw.js stores the type on the notification', /data: \{ type:/.test(sw));

// Drive the real notificationclick handler with mocked windows.
async function click(data, windows) {
  const listeners = {}, opened = [], focused = [];
  const sb = {
    URL, console, setTimeout, clearTimeout,
    caches: { open: async () => ({}), keys: async () => [], match: async () => undefined },
    fetch: async () => { throw new Error('offline'); },
    clients: {
      matchAll: async () => windows.map(u => ({ url: u, focus: async () => { focused.push(u); } })),
      openWindow: async u => { opened.push(u); }
    }
  };
  sb.self = sb;
  sb.addEventListener = (t, cb) => { listeners[t] = cb; };
  sb.importScripts = f => vm.runInContext(read(f.replace(/^\.\//, '')), sb, { filename: f });
  vm.createContext(sb);
  vm.runInContext(sw, sb, { filename: 'sw.js' });
  let wait;
  listeners.notificationclick({ notification: { data, close() {} }, waitUntil: p => { wait = p; } });
  await wait;
  return { opened, focused };
}

(async () => {
  const B = 'https://mcross2298.github.io/4-Weeks-to-Open-/';
  let r = await click({ type: 'pr' }, [B + 'mm-p1.html?day=2']);
  check('PR tap mid-session focuses the open workout', r.focused[0] === B + 'mm-p1.html?day=2' && !r.opened.length, JSON.stringify(r));
  r = await click({ type: 'pr' }, []);
  check('PR tap with no window opens History', r.opened[0] === './workout-logs.html?from=push', JSON.stringify(r));
  r = await click({ type: 'checkin' }, [B + 'mm-p1.html']);
  check('check-in tap never navigates an open workout away', r.opened[0] === './stats.html?from=push' && !r.focused.length, JSON.stringify(r));
  r = await click({ type: 'checkin' }, [B + 'mm-p1.html', B + 'stats.html']);
  check('check-in tap focuses an open Stats window', r.focused[0] === B + 'stats.html' && !r.opened.length, JSON.stringify(r));
  r = await click({ type: 'streak' }, [B + 'dashboard.html?tab=programs']);
  check('streak tap focuses an open Home', r.focused.length === 1 && !r.opened.length, JSON.stringify(r));
  r = await click(null, []);
  check('an untyped push opens Home, as before SP1', r.opened[0] === './dashboard.html?from=push', JSON.stringify(r));
  r = await click({ type: 'stats' }, [B + 'workout-logs.html']);
  check('an unknown type opens Home', r.opened[0] === './dashboard.html?from=push', JSON.stringify(r));

  console.log((failed ? 'FAILED' : 'OK') + '  test-mc-push-route: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
})();
