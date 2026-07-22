/* ==========================================================================
   mc-sync.js  —  cross-device sync of the signed-in user's training data
   --------------------------------------------------------------------------
   Mirrors a whitelist of localStorage stores to one Supabase table:
     user_sync(user_id, store_key, data jsonb, updated_at, device_id)
   keyed by (user_id, store_key). Each store is merged with type-aware logic so
   two devices converge instead of clobbering each other.

   Runs ONLY when a Supabase user is signed in (MC_SB.currentUser()); RLS
   (auth.uid() = user_id) isolates rows per user — so this works for the owner
   today and for any future per-user account with zero changes ("design for
   later"). When nobody is signed in, the app stays exactly as it was (local
   only) and this module is a no-op.

   Cycle: on load → pull (merge server into local) → push (upload changed
   stores). Also pushes on tab-hide / pagehide and on a periodic timer. If a
   pull brings in data the rendered page doesn't show yet (e.g. set logs on a
   fresh device), it does a single guarded reload so the UI reflects it.
   ========================================================================== */
(function () {
  // Roadmap B5 — Node-side hook so CI can regression-test the real
  // sync-conflict merge functions (same convention as mc-suggest.js), instead
  // of a duplicated inline copy that could silently drift from the real
  // logic. Placed before the early-return guards below on purpose: the merge
  // functions are `function` declarations further down this same closure, so
  // they're hoisted and already defined at this point regardless of whether
  // MC_SB ends up configured — see tools/test-mc-sync-merge.js.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      mergeArrayById: function () { return mergeArrayById.apply(null, arguments); },
      mergeArrayByIdTs: function () { return mergeArrayByIdTs.apply(null, arguments); },
      mergeWorkoutLog: function () { return mergeWorkoutLog.apply(null, arguments); },
      mergeSetlog: function () { return mergeSetlog.apply(null, arguments); },
      mergeActivity: function () { return mergeActivity.apply(null, arguments); },
      mergeDictByTs: function () { return mergeDictByTs.apply(null, arguments); },
      mergeMacros: function () { return mergeMacros.apply(null, arguments); }
    };
  }
  if (window.__mcSync) return;
  window.__mcSync = true;
  if (!window.MC_SB || !MC_SB.configured) return;

  var TABLE = 'user_sync';
  // store_key -> merge strategy
  var STORES = {
    'mc_setlog_v1':          'setlog',
    'mc_custom_workouts_v1': 'arrayByIdTs',
    'mc_custom_programs_v1': 'arrayByIdTs',
    'mc_collections_v1':     'arrayById',
    'mc_workout_log_v1':     'workoutLog',
    'mc_cond_log_v1':        'arrayById',
    'mc_body_v1':            'arrayById',
    'mc_max_v1':             'arrayById',
    'mc_activity':           'activity',
    'mc_daily_v1':           'dictByTs',
    'mc_plan_targets_v1':    'dictByTs',
    'mc_macros_v1':          'macros'
  };
  // Roadmap B0 (cookbook↔workout bridge) — stores this app CONSUMES read-only
  // from Mike's Cookbook via the shared user_sync table. PULLED into local
  // localStorage (so mc-bridge.js can read today's planned meals) but NEVER
  // pushed: this app is not their writer, and one-writer-per-store is exactly
  // what keeps the widened whitelist from creating cross-app conflicts. Merge
  // is 'replace' — the owning app (cookbook) is authoritative. Macro targets
  // are NOT here: they live in mc_macros_v1.goals, which both apps already share.
  var CONSUME = {
    'mc-cookbook:mealplan': 'replace'
  };
  var PUSH_MS = 30000;

  var client = null, user = null;
  var snapshot = {};            // store_key -> JSON string last in sync with server
  var pulledChange = false;
  var status = { lastPush: 0, lastPull: 0, signedIn: false };

  function pendingCount() {
    var n = 0;
    Object.keys(STORES).forEach(function (key) {
      var cur = readRaw(key);
      if (cur != null && cur !== snapshot[key]) n++;
    });
    return n;
  }

  function readRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
  function writeVal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function deviceId() {
    try {
      var d = localStorage.getItem('mc_device_id');
      if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('mc_device_id', d); }
      return d;
    } catch (e) { return 'dev'; }
  }
  var DEVICE = deviceId();

  // ---- merge strategies ----------------------------------------------------
  // Append-only arrays of {id,...}: union, first occurrence of each id wins.
  function mergeArrayById(local, remote) {
    local = Array.isArray(local) ? local : [];
    remote = Array.isArray(remote) ? remote : [];
    var seen = {}, out = [];
    local.concat(remote).forEach(function (e) {
      var id = e && e.id;
      if (id == null) { out.push(e); return; }
      if (!seen[id]) { seen[id] = 1; out.push(e); }
    });
    return out;
  }

  // Arrays of {id,...} whose entries carry an edit timestamp (updatedAt ISO,
  // numeric ts, or created ISO). Union by id; on an id conflict the NEWER
  // entry wins — including {deleted:true} tombstones, so edits and deletes
  // both propagate across devices (plain arrayById kept whichever copy
  // happened to be local, so edits never converged). Entries without any
  // timestamp fall back to the old first-occurrence-wins behavior.
  function entryTs(e) {
    if (!e) return 0;
    if (e.updatedAt) { var t = Date.parse(e.updatedAt); if (!isNaN(t)) return t; }
    if (typeof e.ts === 'number') return e.ts;
    if (e.created) { var c = Date.parse(e.created); if (!isNaN(c)) return c; }
    return 0;
  }
  function mergeArrayByIdTs(local, remote) {
    local = Array.isArray(local) ? local : [];
    remote = Array.isArray(remote) ? remote : [];
    var idx = {}, out = [];
    local.concat(remote).forEach(function (e) {
      var id = e && e.id;
      if (id == null) { out.push(e); return; }
      if (idx[id] == null) { idx[id] = out.length; out.push(e); }
      else if (entryTs(e) > entryTs(out[idx[id]])) out[idx[id]] = e;
    });
    return out;
  }

  // workout log: append-only [{pageId, date, sets, ...}], newest-first, 200 max.
  // Older entries predate the id field, so dedupe on id || pageId|date — two
  // devices that both hold the same finished session converge on one copy.
  function workoutKey(e) { return e && (e.id || ((e.pageId || '') + '|' + (e.date || ''))); }
  function mergeWorkoutLog(local, remote) {
    local = Array.isArray(local) ? local : [];
    remote = Array.isArray(remote) ? remote : [];
    var seen = {}, out = [];
    local.concat(remote).forEach(function (e) {
      var k = workoutKey(e);
      if (!k) { out.push(e); return; }
      if (!seen[k]) { seen[k] = 1; out.push(e); }
    });
    out.sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
    return out.slice(0, 200);
  }

  // setlog: { "page|exId": [ {d, sets:{sn:{w,r}}}, ... ] }  (newest-first, 5 max)
  // Merge sessions by day label d, union set numbers; keep local order, cap 5.
  function mergeSetlog(local, remote) {
    local = local || {}; remote = remote || {};
    var out = {}, keys = {}, k;
    for (k in local) keys[k] = 1;
    for (k in remote) keys[k] = 1;
    for (k in keys) {
      var la = Array.isArray(local[k]) ? local[k] : [];
      var ra = Array.isArray(remote[k]) ? remote[k] : [];
      var order = [], byDay = {};
      la.concat(ra).forEach(function (s) {
        if (!s || !s.d) return;
        if (!byDay[s.d]) { byDay[s.d] = { d: s.d, sets: {} }; order.push(s.d); }
        var sets = s.sets || {};
        for (var sn in sets) if (byDay[s.d].sets[sn] == null) byDay[s.d].sets[sn] = sets[sn];
      });
      out[k] = order.map(function (d) { return byDay[d]; }).slice(0, 5);
    }
    return out;
  }

  // activity: { last:{...,ts}, days:{date:true} } — union days, newest last.
  function mergeActivity(local, remote) {
    local = local || {}; remote = remote || {};
    var days = {}, src = [local.days || {}, remote.days || {}], i, d;
    for (i = 0; i < src.length; i++) for (d in src[i]) if (src[i][d]) days[d] = true;
    var ll = local.last, rl = remote.last, last = ll;
    if (rl && (!ll || (rl.ts || 0) > (ll.ts || 0))) last = rl;
    var out = { days: days };
    if (last) out.last = last;
    return out;
  }

  // daily: { "date|pid": {..., ts} } — union keys, greater ts wins on conflict.
  function mergeDictByTs(local, remote) {
    local = local || {}; remote = remote || {};
    var out = {}, k;
    for (k in local) out[k] = local[k];
    for (k in remote) {
      if (!out[k] || (remote[k] && (remote[k].ts || 0) > (out[k].ts || 0))) out[k] = remote[k];
    }
    return out;
  }

  // macros: { ts, profile, goals, days:{ "date":{entries:[{id,ts,...}]} } }.
  // Scalar parts (profile + goals) resolve by the top-level ts (last edit wins);
  // each day's entries union by id, and within an id the greater entry.ts wins
  // so a same-entry edit on either device converges. (Removals don't propagate
  // — same append-biased tradeoff as the other array stores; fine for v1.)
  function mergeMacros(local, remote) {
    local = local || {}; remote = remote || {};
    var lts = local.ts || 0, rts = remote.ts || 0;
    var newer = rts > lts ? remote : local;
    var out = { v: 1, ts: Math.max(lts, rts), profile: newer.profile, goals: newer.goals, days: {} };
    var ld = local.days || {}, rd = remote.days || {}, dates = {}, d;
    for (d in ld) dates[d] = 1;
    for (d in rd) dates[d] = 1;
    for (d in dates) {
      var le = (ld[d] && ld[d].entries) || [], re = (rd[d] && rd[d].entries) || [];
      var seen = {}, list = [];
      le.concat(re).forEach(function (e) {
        var id = e && e.id;
        if (id == null) { list.push(e); return; }
        if (seen[id] == null) { seen[id] = list.length; list.push(e); }
        else if ((e.ts || 0) > (list[seen[id]].ts || 0)) list[seen[id]] = e;
      });
      out.days[d] = { entries: list };
    }
    return out;
  }

  function mergeStore(strategy, local, remote) {
    if (strategy === 'arrayById') return mergeArrayById(local, remote);
    if (strategy === 'arrayByIdTs') return mergeArrayByIdTs(local, remote);
    if (strategy === 'workoutLog') return mergeWorkoutLog(local, remote);
    if (strategy === 'setlog')    return mergeSetlog(local, remote);
    if (strategy === 'activity')  return mergeActivity(local, remote);
    if (strategy === 'dictByTs')  return mergeDictByTs(local, remote);
    if (strategy === 'macros')    return mergeMacros(local, remote);
    if (strategy === 'replace')   return remote != null ? remote : local; // consumer store: owner is authoritative
    return remote != null ? remote : local;
  }

  // ---- sync cycle ----------------------------------------------------------
  function pull() {
    return client.from(TABLE).select('store_key, data').eq('user_id', user.id)
      .then(function (r) {
        if (r.error) throw r.error;
        var remoteByKey = {};
        (r.data || []).forEach(function (row) { remoteByKey[row.store_key] = row.data; });
        // Owned stores (STORES) are pulled+merged and later pushed; consumed
        // stores (CONSUME) are pulled read-only and never pushed (push() below
        // only ever iterates STORES). Both kinds now have real rendered
        // surfaces (roadmap B1/B2's bridge-driven cards/nudges read the pulled
        // CONSUME data), so a change in either arms the one-shot reload — a
        // fresh sign-in shouldn't need a manual navigation to show cross-app
        // data that just arrived.
        // snapshot = what the SERVER currently holds. If a merge added any
        // local-only data, the local value now differs, so push() uploads the
        // merged result instead of treating it as in-sync (owned stores only —
        // push() never touches CONSUME keys regardless of this snapshot).
        function pullKey(key, strategy) {
          var local = parse(readRaw(key));
          var remote = remoteByKey[key];
          var before = readRaw(key);
          if (remote != null) writeVal(key, mergeStore(strategy, local, remote));
          if (readRaw(key) !== before) pulledChange = true;
          snapshot[key] = remote != null ? JSON.stringify(remote) : null;
        }
        Object.keys(STORES).forEach(function (key) { pullKey(key, STORES[key]); });
        Object.keys(CONSUME).forEach(function (key) { pullKey(key, CONSUME[key]); });
        status.lastPull = Date.now();
      });
  }

  function push() {
    var ops = [];
    Object.keys(STORES).forEach(function (key) {
      var cur = readRaw(key);
      if (cur == null) return;                 // nothing stored locally yet
      if (cur === snapshot[key]) return;        // unchanged since last sync
      var data = parse(cur);
      if (data == null) return;
      ops.push(client.from(TABLE).upsert({
        user_id: user.id, store_key: key, data: data,
        updated_at: new Date().toISOString(), device_id: DEVICE
      }, { onConflict: 'user_id,store_key' }).then(function (r) {
        if (!r.error) { snapshot[key] = cur; status.lastPush = Date.now(); }
      }));
    });
    return ops.length ? Promise.all(ops) : Promise.resolve();
  }

  // a fresh device pulls data the already-rendered page can't show; reload once
  function maybeReload() {
    if (!pulledChange) return;
    try {
      if (sessionStorage.getItem('mc_sync_reloaded') === '1') return;
      sessionStorage.setItem('mc_sync_reloaded', '1');
      location.reload();
    } catch (e) {}
  }

  function start() {
    pull()
      .then(function () { maybeReload(); return push(); })
      .catch(function () {});
    // upload pending changes when the user leaves / hides the page
    var flush = function () { push().catch(function () {}); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    setInterval(flush, PUSH_MS);
  }

  // public hook for manual triggering / tests. kick() starts syncing after a
  // mid-session sign-in (e.g. from the account sheet) without a page reload.
  window.MC_SYNC = {
    pull: function () { return pull(); },
    push: function () { return push(); },
    status: function () {
      return { lastPush: status.lastPush, lastPull: status.lastPull,
               pending: pendingCount(), signedIn: !!user };
    },
    kick: function () {
      if (user || !client) return;
      MC_SB.currentUser().then(function (u) { if (u) { user = u; start(); } }).catch(function () {});
    }
  };

  MC_SB.ready
    .then(function (c) { if (!c) return null; client = c; return MC_SB.currentUser(); })
    .then(function (u) { if (u && client) { user = u; start(); } })
    .catch(function () {});
})();
