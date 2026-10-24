#!/usr/bin/env node
/* tools/test-mc-error-beacon.js — flagship readiness E (D-35)

   Loads the REAL mc-error-beacon.js into a vm sandbox with an in-memory
   localStorage and a fake MC_SB, and holds it to its rules: signed-in only,
   each entry sent once, a 10-minute spacing, a failed send retried later, and
   nothing beyond the error itself leaving the device (the source is reduced to
   a file name; long messages are cut to the table's limit).
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.error('::error::' + name); } }
function eq(name, a, b) { const A = JSON.stringify(a), B = JSON.stringify(b); ok(name + (A === B ? '' : '  got ' + A + ' want ' + B), A === B); }

const SRC = fs.readFileSync(path.join(__dirname, '..', 'mc-error-beacon.js'), 'utf8');

function sandbox(opts) {
  const store = Object.assign({}, opts.store || {});
  const sent = [];
  const sb = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone: true },
    document: { readyState: 'loading' },
    addEventListener: () => {},
    setTimeout: () => 0,
    console, JSON, Date, Math, Promise, String, Array,
    MC_SB: opts.noBackend ? undefined : {
      configured: true,
      currentUser: () => Promise.resolve(opts.user === undefined ? { id: 'u1' } : opts.user),
      client: {
        from: (table) => ({
          upsert: (rows, o) => { sent.push({ table, rows, o }); return Promise.resolve(opts.fail ? { error: { message: 'relation does not exist' } } : { error: null }); }
        })
      }
    }
  };
  sb.window = sb;
  sb.matchMedia = () => ({ matches: false });
  vm.createContext(sb);
  vm.runInContext(SRC, sb, { filename: 'mc-error-beacon.js' });
  return { sb, store, sent, B: sb.MC_ERROR_BEACON };
}
const E = (t, m, extra) => Object.assign({ t, k: 'error', m, s: 'https://mcross2298.github.io/4-Weeks-to-Open-/mc-setlog.js?v=3#x', l: 42, p: 'mm-p1.html' }, extra || {});

(async () => {
  {
    const { store, sent, B } = sandbox({ store: { mc_errors_v1: JSON.stringify([E(2000, 'b is undefined'), E(1000, 'a is null')]) } });
    eq('first flush sends both', await B.flush(false), 'sent 2');
    eq('into client_errors', sent[0].table, 'client_errors');
    eq('as an upsert that ignores duplicates', [sent[0].o.onConflict, sent[0].o.ignoreDuplicates], ['user_id,fingerprint,occurred_at', true]);
    const r = sent[0].rows[0];
    eq('source is the file name only', r.source, 'mc-setlog.js');
    eq('row shape', [r.kind, r.line, r.page, r.platform, typeof r.fingerprint, r.occurred_at],
      ['error', 42, 'mm-p1.html', 'ios-pwa', 'string', new Date(2000).toISOString()]);
    eq('throttled inside 10 minutes', await B.flush(false), 'throttled');
    eq('nothing new to send', await B.flush(true), 'nothing');
    // a new error arrives
    store.mc_errors_v1 = JSON.stringify([E(3000, 'c'), E(2000, 'b is undefined'), E(1000, 'a is null')]);
    eq('only the new one is sent', await B.flush(true), 'sent 1');
    eq('...and it is the new one', sent[1].rows.map((x) => x.message), ['c']);
  }
  {
    const { sent, B } = sandbox({ user: null, store: { mc_errors_v1: JSON.stringify([E(1, 'x')]) } });
    eq('signed out: nothing leaves the device', await B.flush(true), 'signed-out');
    eq('...no request', sent.length, 0);
  }
  {
    const { sent, B } = sandbox({ noBackend: true, store: { mc_errors_v1: JSON.stringify([E(1, 'x')]) } });
    eq('no backend configured', await B.flush(true), 'no-backend');
    eq('...no request', sent.length, 0);
  }
  {
    const { B, store } = sandbox({ fail: true, store: { mc_errors_v1: JSON.stringify([E(1, 'x')]) } });
    eq('a failed send (table missing) reports failed', await B.flush(true), 'failed');
    eq('...and the entry stays pending for a later visit', B._pending().length, 1);
    ok('...but the try is spaced', JSON.parse(store.mc_errors_sent_v1).at > 0);
  }
  {
    const long = 'x'.repeat(900);
    const { B } = sandbox({ store: {} });
    const r = B._toRow({ t: 5, k: 'unhandledrejection', m: long, s: '', p: '' });
    eq('message cut to 500', r.message.length, 500);
    eq('rejection kind kept; empty source and page are null', [r.kind, r.source, r.page], ['unhandledrejection', null, null]);
    eq('same error, same fingerprint', B._toRow(E(1, 'm')).fingerprint, B._toRow(E(99, 'm')).fingerprint);
    ok('different error, different fingerprint', B._toRow(E(1, 'm')).fingerprint !== B._toRow(E(1, 'n')).fingerprint);
  }
  {
    const { B } = sandbox({ store: { mc_errors_v1: '{"not":"an array"}' } });
    eq('a malformed log is ignored, not thrown on', await B.flush(true), 'nothing');
  }
  console.log('test-mc-error-beacon: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
