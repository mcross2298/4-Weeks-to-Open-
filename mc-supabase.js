/* ==========================================================================
   mc-supabase.js  —  Supabase client + owner auth + override data access
   --------------------------------------------------------------------------
   Loaded before program-overrides.js on every page. Exposes window.MC_SB:

     MC_SB.ready            Promise that resolves once the client is created
     MC_SB.client           the configured supabase-js client (or null)
     MC_SB.configured       true when real keys are present
     MC_SB.currentUser()    -> Promise<user|null>
     MC_SB.isOwner()        -> Promise<bool>   (uid present in admins table)
     MC_SB.signIn(email)    -> magic-link sign-in
     MC_SB.signOut()
     MC_SB.getOverrides()   -> Promise<{ pages: { pageId: { origName: patch } } }>
     MC_SB.upsert(page, name, patch)
     MC_SB.remove(page, name)
     MC_SB.onChange(cb)     realtime subscription on program_overrides
     MC_SB.getNaming()      -> Promise<{ exercises, programs, splits, badges }>
     MC_SB.upsertNaming(scope, scopeId, patch)
     MC_SB.removeNaming(scope, scopeId)
     MC_SB.onNamingChange(cb)  realtime subscription on naming_overrides

   The anon key is public by design — every protection is enforced server-side
   by Row-Level Security (read open to all; writes restricted to admins).
   ========================================================================== */
(function () {
  if (window.MC_SB) return;

  // ---- CONFIG (anon key is safe to ship; RLS is the real boundary) --------
  var SUPABASE_URL = 'https://dhlxmoyjfxohbeiexwnr.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobHhtb3lqZnhvaGJlaWV4d25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjgwNDAsImV4cCI6MjA5NjcwNDA0MH0.G9XpWjEqaGhY7mdLjz8yAaQBFl5EXvYFfAkJMivG38E';
  // supabase-js UMD build, loaded on demand (browser isn't sandboxed)
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  var configured = /^https:\/\/[a-z0-9]+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.indexOf('eyJ') === 0;
  var client = null;

  function loadSDK() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('supabase-js failed to load')); };
      document.head.appendChild(s);
    });
  }

  var ready = (!configured)
    ? Promise.resolve(null)
    : loadSDK().then(function () {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        return client;
      }).catch(function (e) { console.warn('[MC_SB]', e && e.message); return null; });

  function currentUser() {
    return ready.then(function (c) {
      if (!c) return null;
      return c.auth.getUser().then(function (r) { return (r && r.data && r.data.user) || null; });
    });
  }

  function isOwner() {
    return ready.then(function (c) {
      if (!c) return false;
      return currentUser().then(function (u) {
        if (!u) return false;
        return c.from('admins').select('user_id').eq('user_id', u.id).maybeSingle()
          .then(function (r) { return !!(r && r.data); })
          .catch(function () { return false; });
      });
    });
  }

  // email + password sign-in (reliable on mobile — no email round-trip).
  // Resolves with the session data, or throws on bad credentials.
  function signInPassword(email, password) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
        if (r.error) throw r.error;
        return r.data;
      });
    });
  }

  // magic-link sign-in (kept as an alternative; not used by the default flow)
  function signIn(email) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.href } });
    });
  }

  function signOut() { return ready.then(function (c) { return c ? c.auth.signOut() : null; }); }

  function getOverrides() {
    return ready.then(function (c) {
      if (!c) return null;
      return c.from('program_overrides').select('page_id, orig_name, patch').then(function (r) {
        if (r.error) throw r.error;
        var pages = {};
        (r.data || []).forEach(function (row) {
          (pages[row.page_id] = pages[row.page_id] || {})[row.orig_name] = row.patch;
        });
        return { version: 1, pages: pages };
      });
    });
  }

  function upsert(pageId, origName, patch) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return currentUser().then(function (u) {
        return c.from('program_overrides').upsert({
          page_id: pageId, orig_name: origName, patch: patch,
          updated_at: new Date().toISOString(), updated_by: u && u.id
        }, { onConflict: 'page_id,orig_name' }).then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }

  function remove(pageId, origName) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.from('program_overrides').delete().eq('page_id', pageId).eq('orig_name', origName)
        .then(function (r) { if (r.error) throw r.error; return r; });
    });
  }

  function onChange(cb) {
    ready.then(function (c) {
      if (!c) return;
      try {
        c.channel('program_overrides_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'program_overrides' }, cb)
          .subscribe();
      } catch (e) {}
    });
  }

  // ---- published_exercises table (PM-pushed catalog additions) -------------
  function getExercises() {
    return ready.then(function (c) {
      if (!c) return [];
      return c.from('published_exercises').select('name, muscle, master, programs')
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    });
  }

  function upsertExercise(entry) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return currentUser().then(function (u) {
        return c.from('published_exercises').upsert({
          name: entry.name,
          muscle: entry.muscle,
          master: entry.master || null,
          programs: entry.programs || ['Custom'],
          added_by: u && u.id
        }, { onConflict: 'name' }).then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }

  function removeExercise(name) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.from('published_exercises').delete().eq('name', name)
        .then(function (r) { if (r.error) throw r.error; return r; });
    });
  }

  // ---- naming_overrides table (v2 rename layer) ----------------------------
  // Returns:
  //   exercises: { origName → patch }
  //   programs:  { progId  → patch }
  //   splits:    { progId  → { origSplit → patch } }  (scope_id = "progId|origSplit")
  //   badges:    { progId  → { badgeId   → patch } }  (scope_id = "progId|badgeId")
  //   layouts:   { viewScope → { style } }            (scope = 'layout')
  //   themes:    { themeScope → ThemeConfig }          (scope = 'theme')
  function getNaming() {
    return ready.then(function (c) {
      if (!c) return null;
      return c.from('naming_overrides').select('scope, scope_id, patch')
        .then(function (r) {
          if (r.error) throw r.error;
          var result = { exercises: {}, programs: {}, splits: {}, badges: {}, layouts: {}, themes: {} };
          (r.data || []).forEach(function (row) {
            var idx;
            if (row.scope === 'exercise') {
              result.exercises[row.scope_id] = row.patch;
            } else if (row.scope === 'program') {
              result.programs[row.scope_id] = row.patch;
            } else if (row.scope === 'layout') {
              // scope_id = view scope ('program-cards', 'workout:<id>', …); patch = { style }
              result.layouts[row.scope_id] = row.patch;
            } else if (row.scope === 'theme') {
              // scope_id = theme scope ('global', …); patch = ThemeConfig
              result.themes[row.scope_id] = row.patch;
            } else if (row.scope === 'split') {
              // scope_id = "progId|origSplit"
              idx = row.scope_id.indexOf('|');
              if (idx > -1) {
                var spid = row.scope_id.slice(0, idx), sname = row.scope_id.slice(idx + 1);
                if (!result.splits[spid]) result.splits[spid] = {};
                result.splits[spid][sname] = row.patch;
              }
            } else if (row.scope === 'badge') {
              // scope_id = "progId|badgeId" or "global|badgeId"
              idx = row.scope_id.indexOf('|');
              if (idx > -1) {
                var bpid = row.scope_id.slice(0, idx), bid = row.scope_id.slice(idx + 1);
                if (!result.badges[bpid]) result.badges[bpid] = {};
                result.badges[bpid][bid] = row.patch;
              }
            }
          });
          return result;
        });
    });
  }

  function upsertNaming(scope, scopeId, patch) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return currentUser().then(function (u) {
        return c.from('naming_overrides').upsert({
          scope: scope, scope_id: scopeId, patch: patch,
          updated_at: new Date().toISOString(), updated_by: u && u.id
        }, { onConflict: 'scope,scope_id' })
          .then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }

  function removeNaming(scope, scopeId) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.from('naming_overrides').delete()
        .eq('scope', scope).eq('scope_id', scopeId)
        .then(function (r) { if (r.error) throw r.error; return r; });
    });
  }

  function onNamingChange(cb) {
    ready.then(function (c) {
      if (!c) return;
      try {
        c.channel('naming_overrides_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'naming_overrides' }, cb)
          .subscribe();
      } catch (e) {}
    });
  }

  // ---- pm_publish_log table (Process & history: changelog + restore) -------
  // entries: [{ section, scope_id, action, patch, prev }]. Best-effort: logging
  // failures must never fail a publish, so callers should not block on this.
  function logPublish(entries) {
    if (!entries || !entries.length) return Promise.resolve(null);
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        var rows = entries.map(function (e) {
          return {
            by: u && u.id,
            section: e.section, scope_id: e.scope_id, action: e.action,
            patch: e.patch || null, prev: e.prev || null
          };
        });
        return c.from('pm_publish_log').insert(rows)
          .then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }

  function getPublishLog(limit) {
    return ready.then(function (c) {
      if (!c) return [];
      return c.from('pm_publish_log')
        .select('id, at, section, scope_id, action, patch, prev')
        .order('at', { ascending: false })
        .limit(limit || 100)
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    });
  }

  // ---- pm_drafts table (Staged rollout R1: server-side draft snapshots) ----
  // doc is a full v2 overrides document (the MC_PO working copy). Owner-only.
  function saveDraft(name, doc) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return currentUser().then(function (u) {
        return c.from('pm_drafts').insert({ name: name, doc: doc, updated_by: u && u.id })
          .then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }
  function listDrafts() {
    return ready.then(function (c) {
      if (!c) return [];
      return c.from('pm_drafts').select('id, name, updated_at')
        .order('updated_at', { ascending: false }).limit(50)
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    });
  }
  function getDraft(id) {
    return ready.then(function (c) {
      if (!c) return null;
      return c.from('pm_drafts').select('id, name, doc').eq('id', id).maybeSingle()
        .then(function (r) { if (r.error) throw r.error; return r.data || null; });
    });
  }
  function deleteDraft(id) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.from('pm_drafts').delete().eq('id', id)
        .then(function (r) { if (r.error) throw r.error; return r; });
    });
  }

  // ---- naming_overrides_canary + testers (Staged rollout R2) ---------------
  // Same shape as getNaming(); RLS returns rows only for testers/admins, so for
  // a normal user this resolves to an empty overlay.
  function getCanaryNaming() {
    return ready.then(function (c) {
      if (!c) return null;
      return c.from('naming_overrides_canary').select('scope, scope_id, patch')
        .then(function (r) {
          if (r.error) throw r.error;
          var out = { exercises: {}, programs: {}, splits: {}, badges: {} };
          (r.data || []).forEach(function (row) {
            var idx;
            if (row.scope === 'exercise') out.exercises[row.scope_id] = row.patch;
            else if (row.scope === 'program') out.programs[row.scope_id] = row.patch;
            else if (row.scope === 'split') {
              idx = row.scope_id.indexOf('|');
              if (idx > -1) { var sp = row.scope_id.slice(0, idx), sn = row.scope_id.slice(idx + 1); (out.splits[sp] || (out.splits[sp] = {}))[sn] = row.patch; }
            } else if (row.scope === 'badge') {
              idx = row.scope_id.indexOf('|');
              if (idx > -1) { var bp = row.scope_id.slice(0, idx), bd = row.scope_id.slice(idx + 1); (out.badges[bp] || (out.badges[bp] = {}))[bd] = row.patch; }
            }
          });
          return out;
        });
    });
  }
  // raw rows, for promotion (canary → live)
  function listCanary() {
    return ready.then(function (c) {
      if (!c) return [];
      return c.from('naming_overrides_canary').select('scope, scope_id, patch')
        .then(function (r) { if (r.error) throw r.error; return r.data || []; });
    });
  }
  function upsertCanaryNaming(scope, scopeId, patch) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return currentUser().then(function (u) {
        return c.from('naming_overrides_canary').upsert({
          scope: scope, scope_id: scopeId, patch: patch,
          updated_at: new Date().toISOString(), updated_by: u && u.id
        }, { onConflict: 'scope,scope_id' })
          .then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }
  function removeCanaryNaming(scope, scopeId) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.from('naming_overrides_canary').delete().eq('scope', scope).eq('scope_id', scopeId)
        .then(function (r) { if (r.error) throw r.error; return r; });
    });
  }
  function onCanaryChange(cb) {
    ready.then(function (c) {
      if (!c) return;
      try {
        c.channel('naming_overrides_canary_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'naming_overrides_canary' }, cb)
          .subscribe();
      } catch (e) {}
    });
  }
  // ---- workout_logs table (per-set history for suggestions + fatigue flag) -
  // logSet() is best-effort — callers should .catch() silently.
  function logSet(entry) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('workout_logs').insert({
          user_id:      u.id,
          session_id:   entry.session_id   || 'unknown',
          exercise:     entry.exercise     || '',
          muscle:       entry.muscle       || null,
          set_number:   entry.set_number   || 1,
          weight_lbs:   entry.weight_lbs   != null ? entry.weight_lbs : null,
          reps:         entry.reps         != null ? entry.reps : null,
          rpe:          entry.rpe          || null,
          workout_name: entry.workout_name || null,
          program_id:   entry.program_id   || null
        }).then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }

  // Most recent weight logged for a given exercise (for cross-device pre-fill).
  function getLastWeight(exercise) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('workout_logs')
          .select('weight_lbs')
          .eq('user_id', u.id)
          .eq('exercise', exercise)
          .order('logged_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(function (r) {
            if (r.error) throw r.error;
            return r.data ? r.data.weight_lbs : null;
          });
      });
    });
  }

  // Rolling set count per muscle group for the last N days.
  // Returns an object: { 'Chest': 24, 'Back': 18, ... }
  function getWeeklyVolume(daysBack) {
    return ready.then(function (c) {
      if (!c) return {};
      return currentUser().then(function (u) {
        if (!u) return {};
        var since = new Date(Date.now() - (daysBack || 7) * 86400000).toISOString();
        return c.from('workout_logs')
          .select('muscle')
          .eq('user_id', u.id)
          .gte('logged_at', since)
          .then(function (r) {
            if (r.error) throw r.error;
            var counts = {};
            (r.data || []).forEach(function (row) {
              var m = row.muscle || 'Other';
              counts[m] = (counts[m] || 0) + 1;
            });
            return counts;
          });
      });
    });
  }

  // ---- push_subscriptions table (Web Push opt-in) --------------------------
  function savePushSubscription(sub) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('push_subscriptions').upsert({
          user_id: u.id,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth
        }, { onConflict: 'endpoint' }).then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }

  function deletePushSubscription(endpoint) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('push_subscriptions').delete()
          .eq('user_id', u.id).eq('endpoint', endpoint)
          .then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }

  // Calls the push-notify Edge Function to send a Web Push to the current user.
  // Best-effort — caller should .catch() silently.
  function sendPush(opts) {
    return ready.then(function (c) {
      if (!c) return null;
      return c.auth.getSession().then(function (r) {
        var session = r && r.data && r.data.session;
        if (!session) return null;
        return fetch(SUPABASE_URL + '/functions/v1/push-notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.access_token
          },
          body: JSON.stringify({ title: opts.title || 'MC Training', body: opts.body || '' })
        }).then(function (res) { return res.json(); });
      });
    });
  }

  // All-time max weight for an exercise (used for PR detection).
  function getMaxWeight(exercise) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('workout_logs')
          .select('weight_lbs')
          .eq('user_id', u.id)
          .eq('exercise', exercise)
          .order('weight_lbs', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(function (r) {
            if (r.error) throw r.error;
            return r.data ? r.data.weight_lbs : null;
          });
      });
    });
  }

  // ---- coach-claude Edge Function (AI coaching note, server-side Anthropic) -
  // Sends the user's access token to the Edge Function, which reads 30 days of
  // workout_logs and calls the Anthropic API (key never touches the browser).
  // Resolves with a coaching note string, or null if the user is not signed in
  // or the function is unavailable.
  function callCoach() {
    return ready.then(function (c) {
      if (!c) return null;
      return c.auth.getSession().then(function (r) {
        var session = r && r.data && r.data.session;
        if (!session) return null;
        return fetch(SUPABASE_URL + '/functions/v1/coach-claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.access_token
          }
        }).then(function (res) {
          if (!res.ok) throw new Error('Coach call failed: ' + res.status);
          return res.json();
        }).then(function (data) { return data.note || null; });
      });
    });
  }

  // ---- user_programs table (active program + start date) -------------------
  // program_data stores the full prog card; started_at is the ISO timestamp
  // from which training day count is calculated.
  function saveActiveProgram(progCard) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('user_programs').upsert({
          user_id: u.id,
          program_id: progCard.id,
          program_name: progCard.name,
          started_at: progCard.startedAt || new Date().toISOString(),
          program_data: progCard,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' }).then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }

  function getActiveProgram() {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('user_programs').select('program_data, started_at')
          .eq('user_id', u.id).maybeSingle()
          .then(function (r) {
            if (r.error) throw r.error;
            if (!r.data) return null;
            var card = Object.assign({}, r.data.program_data || {});
            card.startedAt = r.data.started_at;
            return card;
          });
      });
    });
  }

  // is the signed-in user a canary tester? (RLS exposes only the caller's own row)
  function isTester() {
    return ready.then(function (c) {
      if (!c) return false;
      return currentUser().then(function (u) {
        if (!u) return false;
        return c.from('testers').select('user_id').eq('user_id', u.id).maybeSingle()
          .then(function (r) { return !!(r && r.data); })
          .catch(function () { return false; });
      });
    });
  }

  window.MC_SB = {
    ready: ready,
    get client() { return client; },
    configured: configured,
    currentUser: currentUser,
    isOwner: isOwner,
    signIn: signIn,
    signInPassword: signInPassword,
    signOut: signOut,
    getOverrides: getOverrides,
    upsert: upsert,
    remove: remove,
    onChange: onChange,
    getExercises: getExercises,
    upsertExercise: upsertExercise,
    removeExercise: removeExercise,
    getNaming: getNaming,
    upsertNaming: upsertNaming,
    removeNaming: removeNaming,
    onNamingChange: onNamingChange,
    logPublish: logPublish,
    getPublishLog: getPublishLog,
    saveDraft: saveDraft,
    listDrafts: listDrafts,
    getDraft: getDraft,
    deleteDraft: deleteDraft,
    getCanaryNaming: getCanaryNaming,
    listCanary: listCanary,
    upsertCanaryNaming: upsertCanaryNaming,
    removeCanaryNaming: removeCanaryNaming,
    onCanaryChange: onCanaryChange,
    isTester: isTester,
    saveActiveProgram: saveActiveProgram,
    getActiveProgram: getActiveProgram,
    logSet: logSet,
    getLastWeight: getLastWeight,
    getWeeklyVolume: getWeeklyVolume,
    getMaxWeight: getMaxWeight,
    callCoach: callCoach,
    savePushSubscription: savePushSubscription,
    deletePushSubscription: deletePushSubscription,
    sendPush: sendPush
  };
})();
