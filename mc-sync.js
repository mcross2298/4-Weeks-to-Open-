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
      mergeMacros: function () { return mergeMacros.apply(null, arguments); },
      mergeExerciseByName: function () { return mergeExerciseByName.apply(null, arguments); },
      mergeScalarBase: function () { return mergeScalarBase.apply(null, arguments); },
      mergeDictBase: function () { return mergeDictBase.apply(null, arguments); },
      mergeStore: function () { return mergeStore.apply(null, arguments); },
      // K-3.2/A-16
      setlogPageOf: function () { return setlogPageOf.apply(null, arguments); },
      splitSetlogByPage: function () { return splitSetlogByPage.apply(null, arguments); },
      joinSetlogGroups: function () { return joinSetlogGroups.apply(null, arguments); },
      computeSetlogPushOps: function () { return computeSetlogPushOps.apply(null, arguments); },
      computeSetlogPullResult: function () { return computeSetlogPullResult.apply(null, arguments); },
      // S1/S2 (tools/test-mc-sync-merge.js) — same hoisting trick, one level
      // further: these read `client`/`user`/`snapshot`/`quotaBlocked`, which
      // are only assigned once the module runs past the early-return guards
      // below, so each entry is a THUNK (called later, once a configured
      // MC_SB has let the module run to completion) rather than a value.
      writeVal: function () { return writeVal.apply(null, arguments); },
      pull: function () { return pull.apply(null, arguments); },
      push: function () { return push.apply(null, arguments); },
      start: function () { return start.apply(null, arguments); },
      maybeReload: function () { return maybeReload.apply(null, arguments); },
      workoutInProgress: function () { return workoutInProgress.apply(null, arguments); },
      getSnapshot: function () { return snapshot; },
      getQuotaBlocked: function () { return quotaBlocked; }
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
    'mc_session_summary_v1': 'dictByTs',
    'mc_macros_v1':          'macros',
    // Wave 1 (audit G-01/K-1.2): mc-exercise-catalog.js's own header has always
    // documented this store as "synced across the user's own devices via
    // mc-sync.js" — it was in neither this map nor mc-export.js, so a custom
    // exercise library silently never left the phone that made it.
    'mc_custom_exercises_v1': 'exerciseByName',
    // Wave 1 (audit K-1.3, owner-classified as training data, not a device
    // setting): which program you are running, and any schedule shifts, should
    // follow you to a second device mid-block.
    'mc_active_prog':         'scalarBase',
    'mc_weekly_overrides_v1': 'dictBase',
    // program-day-view-roadmap.md D0 — where you are in a program (cursor,
    // completed days, rest pattern, per-week day order). Same reasoning and
    // the same per-key strategy as mc_weekly_overrides_v1 above: a block
    // half-finished on the phone has to be half-finished on the tablet, and
    // two devices advancing two DIFFERENT programs must both survive.
    'mc_program_progress_v1': 'dictBase'
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
  // S1: store keys whose last local write failed (almost always
  // QuotaExceededError — a heavy user near the localStorage cap, where a
  // multi-device merge is strictly larger than either side alone). Set by
  // writeVal() below, cleared the moment a write for that key succeeds again.
  var quotaBlocked = {};

  function pendingCount() {
    var n = 0;
    Object.keys(STORES).forEach(function (key) {
      var cur = readRaw(key);
      if (cur == null) return;
      // K-3.2/A-16: setlog has no whole-store snapshot entry (see
      // computeSetlogPushOps()'s comment on push() below) — "pending" means
      // at least one page-group differs from what the server confirmed.
      if (STORES[key] === 'setlog') {
        var data = parse(cur);
        if (data != null && computeSetlogPushOps(key, data, snapshot).ops.length) n++;
        return;
      }
      if (cur !== snapshot[key]) n++;
    });
    return n;
  }

  function readRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
  // S1: previously `try{...}catch(e){}` — a failed write (quota) was
  // indistinguishable from a successful one to every caller. pullKey() would
  // still advance snapshot[key] to "what the server holds" even though the
  // merged value never actually landed in localStorage, so the NEXT push()
  // would see the stale, still-unmerged local value as "different from what
  // the server holds" and upload it — silently overwriting the server's
  // newer merged data with older local-only data. Returning success lets
  // callers leave snapshot untouched and skip that key's push instead.
  function writeVal(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); delete quotaBlocked[k]; return true; }
    catch (e) { quotaBlocked[k] = true; return false; }
  }

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

  // ---- K-3.2/A-16: delta sync for mc_setlog_v1 -----------------------------
  // mc_setlog_v1 grows without bound in KEY COUNT across a user's whole
  // lifetime of programs (one dict entry per page|exercise ever logged);
  // mergeSetlog's 5-session cap only bounds one key's depth, not the store's
  // breadth. Under the whole-store push in push() below, logging ONE set
  // anywhere re-uploads the ENTIRE lifetime history on the next push cycle —
  // and unlike the store-level "unchanged, skip" short-circuit that already
  // protects every OTHER store, an active workout changes SOME key in this
  // one on almost every push cycle (PUSH_MS, or sooner on pagehide), so the
  // whole-blob upload fires nearly every time regardless of how small the
  // real change was.
  //
  // Fix: split ONLY this store's SYNC unit by page, derived from its own
  // existing "pageId|exId" key format — no new field, no schema change, no
  // change to mergeSetlog itself. The local store shape is untouched
  // (mc-setlog.js/mc-suggest.js never see this split); it's purely how
  // mc-sync.js chunks what it uploads, keyed 'mc_setlog_v1|<pageId>'.
  // Backward compatible: a legacy whole-blob row (store_key exactly
  // 'mc_setlog_v1', from before this shipped) is still pulled and merged in
  // — pushSetlog()/pullSetlog() below are exercised by
  // tools/test-mc-sync-merge.js against fixtures covering exactly that case.
  function setlogPageOf(compoundKey) {
    var i = String(compoundKey).indexOf('|');
    return i < 0 ? compoundKey : compoundKey.slice(0, i);
  }
  function splitSetlogByPage(whole) {
    var byPage = {};
    Object.keys(whole || {}).forEach(function (k) {
      var p = setlogPageOf(k);
      (byPage[p] || (byPage[p] = {}))[k] = whole[k];
    });
    return byPage;
  }
  // Re-assemble page groups back into one whole-store object (inverse of
  // splitSetlogByPage), used by pullSetlog() to write the merged result back
  // to the single local mc_setlog_v1 key mc-setlog.js actually reads.
  function joinSetlogGroups(groups) {
    var whole = {};
    Object.keys(groups || {}).forEach(function (page) {
      var g = groups[page] || {};
      Object.keys(g).forEach(function (k) { whole[k] = g[k]; });
    });
    return whole;
  }

  // Pure planning step for pushing mc_setlog_v1: given the current local
  // whole store and the snapshot values already held per page-group (plus
  // the whole-store snapshot at snapshotByKey[wholeKey], for pendingCount()
  // parity with every other store), returns exactly which page-group rows
  // need a network upsert and what the snapshot should become once they
  // succeed. No I/O — push() below does the actual client.from(...).upsert
  // calls and only commits newSnapshot on a successful response, same
  // all-or-nothing-per-row discipline every other store already has.
  function computeSetlogPushOps(wholeKey, localWhole, snapshotByKey) {
    var groups = splitSetlogByPage(localWhole);
    var ops = [], newSnapshot = {};
    Object.keys(groups).forEach(function (page) {
      var groupKey = wholeKey + '|' + page;
      var groupJson = JSON.stringify(groups[page]);
      if (groupJson !== snapshotByKey[groupKey]) {
        ops.push({ storeKey: groupKey, data: groups[page], json: groupJson });
      } else {
        newSnapshot[groupKey] = groupJson;   // unchanged — carry forward as-is
      }
    });
    return { ops: ops, wholeJson: JSON.stringify(localWhole), carrySnapshot: newSnapshot };
  }

  // Pure planning step for pulling mc_setlog_v1: given the local whole store,
  // every remote row keyed 'mc_setlog_v1|<page>' (plus a legacy whole-blob
  // row at remoteByKey[wholeKey], if one predates this feature), and the
  // snapshot already held per page-group, returns the merged whole store and
  // the snapshot values to record. mergeSetlog itself is untouched — this
  // only decides WHICH slice of the store each remote row merges into.
  function computeSetlogPullResult(wholeKey, localWhole, remoteByKey, snapshotByKey) {
    var localGroups = splitSetlogByPage(localWhole);
    var mergedGroups = {};
    Object.keys(localGroups).forEach(function (p) { mergedGroups[p] = localGroups[p]; });
    var newSnapshot = {};
    var prefix = wholeKey + '|';
    Object.keys(remoteByKey).forEach(function (rk) {
      if (rk.indexOf(prefix) !== 0) return;
      var page = rk.slice(prefix.length);
      var remoteGroup = remoteByKey[rk];
      mergedGroups[page] = mergeSetlog(localGroups[page] || {}, remoteGroup);
      newSnapshot[rk] = JSON.stringify(remoteGroup);
    });
    var whole = joinSetlogGroups(mergedGroups);
    // Legacy whole-blob row, from before this shipped: merge it in once. It
    // is never written back to under the new per-page keys, so once every
    // device has migrated it simply stops changing and stops mattering —
    // deliberately left in the table rather than deleted from client code.
    if (remoteByKey[wholeKey] != null) {
      whole = mergeSetlog(whole, remoteByKey[wholeKey]);
    }
    return { whole: whole, newSnapshot: newSnapshot };
  }

  // Custom exercises: [{name, muscle, programs, master, custom, createdAt}] —
  // note there is NO id field, so mergeArrayById would push every entry
  // unconditionally and duplicate the whole list on each sync. Identity here is
  // the normalized NAME, which is exactly what mc-exercise-catalog.js already
  // dedups on (its normalize()); this mirrors that rule so the sync layer and
  // the catalog cannot disagree about what counts as the same exercise. Union
  // by that key, first writer kept (entries are append-only in practice).
  function normalizeExName(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\*+/g, '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function mergeExerciseByName(local, remote) {
    local = Array.isArray(local) ? local : [];
    remote = Array.isArray(remote) ? remote : [];
    var seen = {}, out = [];
    local.concat(remote).forEach(function (e) {
      var k = normalizeExName(e && e.name);
      if (!k) { out.push(e); return; }
      if (!seen[k]) { seen[k] = 1; out.push(e); }
    });
    return out;
  }

  // Three-way strategies. `base` is snapshot[key] — the value the SERVER held
  // at the last sync, i.e. the common ancestor — so "did this side change?" is
  // answerable without any timestamp embedded in the stored value. That matters
  // for stores whose writers never stamped one (mc_active_prog is written from
  // seven call sites; none of them would be a safe place to start).
  //
  // Tie-break on a true conflict (both sides changed) is LOCAL, deliberately:
  // the device in your hand keeps the choice you just made, and pushes it.
  function sameJson(v, baseRaw) {
    if (baseRaw == null) return false;
    try { return JSON.stringify(v) === JSON.stringify(JSON.parse(baseRaw)); } catch (e) { return false; }
  }
  // Whole-value last-writer-wins, for a single scalar/object pointer.
  function mergeScalarBase(local, remote, base) {
    if (remote === undefined || remote === null) return local;
    if (local === undefined || local === null) return remote;
    return sameJson(local, base) ? remote : local;    // only-remote-changed -> remote
  }
  // Same rule applied PER KEY of a dict, so two devices adjusting different
  // programs both survive instead of one whole object clobbering the other.
  function mergeDictBase(local, remote, base) {
    local = local || {}; remote = remote || {};
    var baseObj = {};
    try { baseObj = base != null ? (JSON.parse(base) || {}) : {}; } catch (e) { baseObj = {}; }
    var out = {}, k;
    for (k in local) out[k] = local[k];
    for (k in remote) {
      if (!(k in out)) { out[k] = remote[k]; continue; }
      var localUnchanged = JSON.stringify(out[k]) === JSON.stringify(baseObj[k]);
      if (localUnchanged) out[k] = remote[k];          // only remote touched it
    }
    return out;
  }

  function mergeStore(strategy, local, remote, base) {
    if (strategy === 'exerciseByName') return mergeExerciseByName(local, remote);
    if (strategy === 'scalarBase') return mergeScalarBase(local, remote, base);
    if (strategy === 'dictBase')   return mergeDictBase(local, remote, base);
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
          if (strategy === 'setlog') { pullSetlogKey(key); return; }
          var local = parse(readRaw(key));
          var remote = remoteByKey[key];
          var before = readRaw(key);
          // S1: only advance snapshot to "what the server holds" once the
          // merged write actually landed locally. On failure, leave
          // snapshot[key] as it was — quotaBlocked[key] (set inside
          // writeVal()) is what keeps push() from uploading the stale,
          // still-unmerged local value over this remote data next cycle.
          var wrote = remote == null || writeVal(key, mergeStore(strategy, local, remote, snapshot[key]));
          if (readRaw(key) !== before) pulledChange = true;
          if (wrote) snapshot[key] = remote != null ? JSON.stringify(remote) : null;
        }
        // K-3.2/A-16: mc_setlog_v1 syncs as per-page rows ('mc_setlog_v1|<page>')
        // instead of one whole-store row — see computeSetlogPullResult()'s own
        // comment above for why. Pure planning happens there; this just applies
        // the result and updates snapshot/pulledChange the same way pullKey()
        // does for every other store.
        function pullSetlogKey(key) {
          var localWhole = parse(readRaw(key)) || {};
          var before = readRaw(key);
          var result = computeSetlogPullResult(key, localWhole, remoteByKey, snapshot);
          // S1: same reasoning as pullKey() above — only record the
          // per-group snapshots (what pushSetlogKey() treats as "server
          // holds this") if the merged whole actually made it into
          // localStorage. On failure quotaBlocked[key] (set inside
          // writeVal()) keeps pushSetlogKey() from uploading a stale group.
          var wrote = writeVal(key, result.whole);
          if (readRaw(key) !== before) pulledChange = true;
          // Only PER-GROUP snapshots are meaningful for this store — see
          // computeSetlogPushOps()'s comment on push() below for why there is
          // deliberately no snapshot[key] (whole-store) entry at all: it
          // would mean "what the server holds," and nothing here confirms
          // the server holds the merged whole, only whichever individual
          // page-group rows actually came back in this pull.
          if (wrote) {
            Object.keys(result.newSnapshot).forEach(function (gk) { snapshot[gk] = result.newSnapshot[gk]; });
          }
        }
        Object.keys(STORES).forEach(function (key) { pullKey(key, STORES[key]); });
        Object.keys(CONSUME).forEach(function (key) { pullKey(key, CONSUME[key]); });
        status.lastPull = Date.now();
      });
  }

  function push() {
    var ops = [];
    // K-3.2/A-16: mc_setlog_v1 uploads only the page-group(s) that actually
    // changed, not the whole store. There is deliberately no snapshot[key]
    // (whole-store) entry for this store at all — only snapshot['mc_setlog_v1
    // |<page>'] per group — because "snapshot" means "what the server
    // confirmed holding," and no single network call ever confirms the
    // WHOLE store at once here, only one page-group at a time. Same
    // all-or-nothing-per-row commit discipline as the generic path below:
    // each group's own snapshot entry is only updated inside a successful
    // upsert's .then(), never optimistically before the call resolves —
    // so a group whose upload fails is retried on the next push() call
    // instead of being silently marked done (see tools/test-mc-sync-merge.js).
    function pushSetlogKey(key, cur) {
      var localWhole = parse(cur);
      if (localWhole == null) return;
      var plan = computeSetlogPushOps(key, localWhole, snapshot);
      Object.keys(plan.carrySnapshot).forEach(function (gk) { snapshot[gk] = plan.carrySnapshot[gk]; });
      plan.ops.forEach(function (op) {
        ops.push(client.from(TABLE).upsert({
          user_id: user.id, store_key: op.storeKey, data: op.data,
          updated_at: new Date().toISOString(), device_id: DEVICE
        }, { onConflict: 'user_id,store_key' }).then(function (r) {
          if (!r.error) { snapshot[op.storeKey] = op.json; status.lastPush = Date.now(); }
        }));
      });
    }
    Object.keys(STORES).forEach(function (key) {
      var cur = readRaw(key);
      if (cur == null) return;                 // nothing stored locally yet
      // S1: never upload a key whose last local write failed (quota) — see
      // writeVal()'s own comment. `cur` here is necessarily the stale,
      // still-unmerged local value in that case, and uploading it would
      // overwrite the server's newer data that this device simply couldn't
      // fit locally. Cleared automatically the moment a write succeeds again.
      if (quotaBlocked[key]) return;
      // setlog has no whole-store snapshot to short-circuit against — its
      // own per-group diff inside pushSetlogKey() IS the cheap no-op check.
      if (STORES[key] === 'setlog') { pushSetlogKey(key, cur); return; }
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

  // S2: same mid-workout signals mc-sw-update.js's workoutInProgress() checks
  // before reloading for a service-worker update — duplicated locally rather
  // than imported, because mc-sync.js runs and can already be mid-pull before
  // mc-sw-update.js's script tag (deliberately tail-positioned, right before
  // </body>) has even executed, so its private predicate isn't reliably
  // available yet on every page that loads both.
  function workoutInProgress() {
    try {
      var tf = document.getElementById('timerFloat');
      if (tf && tf.classList.contains('visible')) return true;
      return !!document.querySelector(
        '.ex-card.checked, .ss-ex.checked, .lift-card.checked, .mcl-ck.done, .set-check.done');
    } catch (e) { return false; }
  }

  // a fresh device pulls data the already-rendered page can't show; reload
  // once — but never mid-workout (S2). A pulled change can arrive from ANY
  // signed-in device (a second tab, another phone), and mc-sync.js had no
  // equivalent to mc-sw-update.js's hold: an unconditional reload here could
  // force-close a card and lose scroll position out from under an in-progress
  // set. Deferring costs nothing — this function is idempotent (pulledChange
  // stays true, the sessionStorage flag isn't set yet), so the
  // visibilitychange/focus listeners wired in start() below simply keep
  // re-checking it until the workout ends.
  function maybeReload() {
    if (!pulledChange) return;
    if (workoutInProgress()) return;
    try {
      if (sessionStorage.getItem('mc_sync_reloaded') === '1') return;
      sessionStorage.setItem('mc_sync_reloaded', '1');
      location.reload();
    } catch (e) {}
  }

  function start() {
    // S2: pull, then push, THEN maybeReload — previously reload was
    // attempted before push() had a chance to run, and an unconditional
    // location.reload() can abort an in-flight/not-yet-sent upload, silently
    // dropping whatever local changes triggered the pull's merge in the
    // first place. Now the upload has already completed (or been given the
    // chance to) by the time a reload could possibly happen.
    pull()
      .then(function () { return push(); })
      .then(function () { maybeReload(); })
      .catch(function () {});
    // upload pending changes when the user leaves / hides the page
    var flush = function () { push().catch(function () {}); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
      else maybeReload();   // S2: drain a reload deferred by workoutInProgress()
    });
    window.addEventListener('focus', maybeReload);   // S2: same drain, tab regains focus
    setInterval(flush, PUSH_MS);
  }

  // public hook for manual triggering / tests. kick() starts syncing after a
  // mid-session sign-in (e.g. from the account sheet) without a page reload.
  window.MC_SYNC = {
    pull: function () { return pull(); },
    push: function () { return push(); },
    status: function () {
      // S1: surfaces which stores are stuck (storage full, write failing) so
      // a future UI (e.g. mc-backup-status.js) can tell the user their data
      // isn't reaching other devices, instead of it failing invisibly.
      return { lastPush: status.lastPush, lastPull: status.lastPull,
               pending: pendingCount(), signedIn: !!user,
               blocked: Object.keys(quotaBlocked) };
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
