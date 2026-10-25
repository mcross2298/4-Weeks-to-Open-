/* ==========================================================================
   mc-supabase.js  —  Supabase client + owner auth + override data access
   --------------------------------------------------------------------------
   Loaded before program-overrides.js on every page. Exposes window.MC_SB:

     MC_SB.ready            Promise that resolves once the client is created
     MC_SB.client           the configured supabase-js client (or null)
     MC_SB.configured       true when real keys are present
     MC_SB.sdkLoadFailed    true once `ready` settles if the CDN fetch for
                             supabase-js itself failed (almost always offline)
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
  // supabase-js UMD build, loaded on demand. Vendored locally (F-I2, VOC/VOA
  // Kaizen audit) rather than fetched from cdn.jsdelivr.net -- the CDN is
  // cross-origin, so sw.js could never precache it, and offline sign-in
  // failed on every cold launch regardless of prior visits. Same-origin and
  // precached (see tools/build-sw.py's LAZY_ASSETS), so it works offline
  // once a device has loaded it while online. See supabase-vendor.js's own
  // header for the pinned version and update procedure.
  var SDK_URL = './supabase-vendor.js';

  var configured = /^https:\/\/[a-z0-9]+\.supabase\.co/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.indexOf('eyJ') === 0;
  var client = null;
  // W2-2 (VOC/VOA Kaizen audit): distinct from `configured` (a permanent,
  // build-time state) -- this is set only when the SDK itself failed to
  // fetch, almost always because the device is offline. mc-account.js reads
  // it to show "sign-in needs a connection" instead of the sign-in form
  // failing with the misleading "Supabase not configured" error signIn/
  // signInPassword throw when `client` is null for any reason.
  var sdkLoadFailed = false;

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
      }).catch(function (e) { sdkLoadFailed = true; console.warn('[MC_SB]', e && e.message); return null; });

  // A-9: getUser() validates the JWT against the server on every call — a
  // real network round trip, paid by all ~17 call sites that used to route
  // through this function, most of them on the hot path of a checked set.
  // getSession() reads the already-verified session from local storage
  // (supabase-js keeps it fresh via its own autoRefreshToken, so this is not
  // a staleness trade) — four other call sites in this file already use it
  // directly for exactly this reason. Fall back to the network call only
  // when no session is cached yet (first paint, or truly signed out).
  function currentUser() {
    return ready.then(function (c) {
      if (!c) return null;
      return c.auth.getSession().then(function (r) {
        var u = r && r.data && r.data.session && r.data.session.user;
        if (u) return u;
        return c.auth.getUser().then(function (r2) { return (r2 && r2.data && r2.data.user) || null; });
      });
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

  // ---- pm_clients (Client roster in PM Mode, roadmap 4.5) -------------------
  // "Assign" here is a suggestion, never a remote-control write into another
  // user's own data — see phase11-pm-clients.sql's header for why. The PM-side
  // functions manage the roster; getMyAssignment() is what a CLIENT's own
  // device calls to see whether a coach has suggested something for them.

  // Resolves an email to an existing account via the pm-lookup-client Edge
  // Function (server-side, admin-gated — RLS can't expose auth.users to the
  // client directly). Throws with .notFound = true when no account matches.
  function lookupClientByEmail(email) {
    return ready.then(function (c) {
      if (!c) return null;
      return c.auth.getSession().then(function (r) {
        var session = r && r.data && r.data.session;
        if (!session) return null;
        return fetch(SUPABASE_URL + '/functions/v1/pm-lookup-client', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.access_token
          },
          body: JSON.stringify({ email: email })
        }).then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) {
              var err = new Error((data && data.error) || ('Lookup failed: ' + res.status));
              err.notFound = res.status === 404;
              throw err;
            }
            return data; // { user_id, email }
          });
        });
      });
    });
  }
  function listClients() {
    return ready.then(function (c) {
      if (!c) return [];
      return currentUser().then(function (u) {
        if (!u) return [];
        return c.from('pm_clients').select('*').eq('pm_user_id', u.id)
          .order('created_at', { ascending: false })
          .then(function (r) { if (r.error) throw r.error; return r.data || []; });
      });
    });
  }
  function addClient(client) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return currentUser().then(function (u) {
        if (!u) throw new Error('Not signed in');
        return c.from('pm_clients').insert({
          pm_user_id: u.id,
          client_user_id: client.client_user_id,
          client_email: client.client_email,
          client_label: client.client_label || null
        }).then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }
  function updateClientAssignment(id, patch) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      var row = { updated_at: new Date().toISOString() };
      if ('assigned_program_id' in patch) row.assigned_program_id = patch.assigned_program_id;
      if ('assigned_program_name' in patch) row.assigned_program_name = patch.assigned_program_name;
      if ('assigned_macro_goals' in patch) row.assigned_macro_goals = patch.assigned_macro_goals;
      if ('notes' in patch) row.notes = patch.notes;
      return c.from('pm_clients').update(row).eq('id', id)
        .then(function (r) { if (r.error) throw r.error; return r; });
    });
  }
  function removeClient(id) {
    return ready.then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.from('pm_clients').delete().eq('id', id)
        .then(function (r) { if (r.error) throw r.error; return r; });
    });
  }
  // Called by a CLIENT's own device — RLS only ever returns row(s) where
  // client_user_id = them, regardless of whose roster it lives in.
  function getMyAssignment() {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('pm_clients').select('*').eq('client_user_id', u.id)
          .order('updated_at', { ascending: false }).limit(1)
          .then(function (r) { if (r.error) throw r.error; return (r.data && r.data[0]) || null; });
      });
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
  // A-5: deletes every workout_logs row this page-load session wrote, so a
  // discarded workout does not leave server-side rows for local history that
  // no longer exists. RLS scopes deletes to auth.uid() regardless, but
  // filtering by session_id here keeps this from ever touching any other
  // session's rows even in principle. Best-effort — callers should .catch().
  function deleteSessionLog(sessionId) {
    if (!sessionId) return Promise.resolve(null);
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('workout_logs').delete()
          .eq('user_id', u.id).eq('session_id', sessionId)
          .then(function (r) { if (r.error) throw r.error; return r; });
      });
    });
  }
  // ---- workout_logs table (per-set history for suggestions + fatigue flag) -
  // logSet() is best-effort — callers should .catch() silently.
  //
  // FIX-05 (audit EN-6): an UPSERT, not an insert. Re-checking a set used to
  // write a second row, because nothing constrained the table — 4 duplicate
  // groups and 5 surplus rows in 125 live rows when the audit measured it. A
  // fat-fingered weight was therefore permanent and permanently won the
  // all-time maximum used for personal records and cross-device prefill.
  // Keyed on the constraint supabase/phase12-launch-hardening.sql adds; until
  // that migration is applied the upsert behaves exactly as the old insert
  // did, so this is safe to ship ahead of it.
  // ---- the outbox (flagship readiness R3 / D-19) ----------------------------
  // A set ticked with no signal was dropped: logSet() rejected, the caller's
  // .catch() swallowed it, and nothing tried again. The local set log kept the
  // set, but this table is what cross-device prefill, the PR baseline and the
  // crash rehydrate (FIX-02) read, so a gym with no signal left holes in all
  // three. A failed write now waits here and is replayed when the network
  // returns. Both writes are idempotent (an upsert on the row's natural key,
  // and a delete by it), and the outbox keeps only the LATEST operation per
  // set, so a set unticked while offline can never be replayed back in.
  var OUTBOX_KEY = 'mc_workout_logs_outbox_v1';
  var OUTBOX_MAX = 300;                         // operations, oldest dropped first
  var OUTBOX_TTL = 7 * 24 * 60 * 60 * 1000;     // a week-old replay is history, not a set
  function opKey(e) { return (e.session_id || 'unknown') + '|' + (e.exercise || '') + '|' + (e.set_number || 1); }
  function readOutbox() {
    try {
      var v = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
      return Array.isArray(v) ? v.filter(function (o) { return o && o.entry && (o.op === 'up' || o.op === 'del'); }) : [];
    } catch (e) { return []; }
  }
  function writeOutbox(list) {
    try {
      if (list.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(list.slice(-OUTBOX_MAX)));
      else localStorage.removeItem(OUTBOX_KEY);
    } catch (e) {}
  }
  // A replayed set used to write its row and nothing else, so a record set
  // with no signal never reached the lock screen. The caller hands over the
  // push it would have sent, judged from the device's own history (the cloud
  // baseline is exactly what was out of reach), and the replay sends it once
  // the row is written. Only while it is still news: PUSH_FRESH_MS.
  var PUSH_FRESH_MS = 12 * 60 * 60 * 1000;
  function enqueue(op, entry, push) {
    var k = opKey(entry);
    var list = readOutbox().filter(function (o) { return opKey(o.entry) !== k; });
    var item = { op: op, entry: entry, ts: Date.now() };
    if (push && push.title) item.push = { title: String(push.title), body: String(push.body || '') };
    list.push(item);
    writeOutbox(list);
  }
  function dequeue(entry) {
    var k = opKey(entry);
    var list = readOutbox(), kept = list.filter(function (o) { return opKey(o.entry) !== k; });
    if (kept.length !== list.length) writeOutbox(kept);
  }
  // A write the server REFUSES (a bad value, a constraint) fails the same way
  // on every retry, and used to be replayed until the 7-day limit dropped it,
  // stopping every write queued behind it for that week (Phase T1.3). Only a
  // refusal is final: no response at all, a timeout, an expired session, a
  // rate limit or a 5xx is the network or the server having a bad moment,
  // and the write waits as before. 401 and 403 wait too, since signing back
  // in fixes both.
  function rowResult(r) {
    if (r && r.error) {
      var err = r.error;
      try { if (err && typeof err === 'object' && r.status && err.status == null) err.status = r.status; } catch (e) {}
      throw err;
    }
    return r;
  }
  function isRefused(err) {
    if (!err || typeof err !== 'object') return false;
    var code = String(err.code || '');
    if (/^(22|23)/.test(code)) return true;          // SQLSTATE data exception / integrity
    return err.status === 400 || err.status === 404 || err.status === 409 || err.status === 422;
  }
  function noteRefused(op, err) {
    try {
      if (window.MC_ERRLOG && window.MC_ERRLOG.rec) {
        window.MC_ERRLOG.rec('network', 'workout_logs ' + (op === 'del' ? 'delete' : 'write') +
          ' refused: ' + String((err && (err.code || err.status)) || '') + ' ' + String((err && err.message) || '').slice(0, 120));
      }
    } catch (e) {}
  }
  var _flushing = null;
  function flushOutbox() {
    if (_flushing) return _flushing;
    if ('onLine' in navigator && !navigator.onLine) return Promise.resolve(0);
    var now = Date.now();
    var list = readOutbox().filter(function (o) { return !o.ts || now - o.ts < OUTBOX_TTL; });
    if (!list.length) { writeOutbox([]); return Promise.resolve(0); }
    var sent = 0;
    // One at a time, in order: the first failure stops the run and leaves the
    // rest queued, rather than hammering a network that just went away.
    _flushing = list.reduce(function (p, o) {
      return p.then(function (go) {
        if (!go) return false;
        var send = o.op === 'up' ? upsertRow(o.entry) : deleteRow(o.entry);
        return send.then(function (r) {
          if (r === null) return false;                 // no client or nobody signed in: keep it
          var cur = readOutbox();                       // re-read: a tick may have landed meanwhile
          var still = cur.filter(function (x) { return !(opKey(x.entry) === opKey(o.entry) && x.ts === o.ts); });
          if (still.length !== cur.length) writeOutbox(still);
          if (o.op === 'up' && o.push && o.ts && Date.now() - o.ts < PUSH_FRESH_MS) {
            try { sendPush(o.push).catch(function () {}); } catch (pe) {}
          }
          sent++;
          return true;
        }, function (err) {
          if (!isRefused(err)) return false;            // keep it, and stop here
          noteRefused(o.op, err);
          var cur = readOutbox();
          var still = cur.filter(function (x) { return !(opKey(x.entry) === opKey(o.entry) && x.ts === o.ts); });
          if (still.length !== cur.length) writeOutbox(still);
          return true;                                  // the rest of the queue still goes
        });
      });
    }, Promise.resolve(true)).then(function () { _flushing = null; return sent; },
                                   function () { _flushing = null; return sent; });
    return _flushing;
  }
  try {
    window.addEventListener('online', function () { flushOutbox(); });
    setTimeout(function () { flushOutbox(); }, 4000);   // after sign-in has settled
  } catch (e) {}

  function logSet(entry, offlinePush) {
    return upsertRow(entry).then(function (r) {
      dequeue(entry);                                   // a direct success supersedes a queued copy
      return r;
    }, function (err) {
      if (isRefused(err)) noteRefused('up', err); else enqueue('up', entry, offlinePush);
      throw err;
    });
  }
  function upsertRow(entry) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('workout_logs').upsert({
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
        }, { onConflict: 'user_id,session_id,exercise,set_number' })
          .then(rowResult);
      });
    });
  }

  // FIX-05, second half: unchecking a set must remove its cloud row. Without
  // this the correction path is one-way — the tick disappears locally while
  // the row it came from stays in the table forever, and the personal-record
  // query keeps reading it. The policy already permits the delete; the app
  // simply never asked.
  function unlogSet(entry) {
    if (!entry || !entry.session_id || !entry.exercise || entry.set_number == null) {
      return Promise.resolve(null);
    }
    // R3: a queued upsert for this set must not outlive the untick.
    dequeue(entry);
    return deleteRow(entry).then(null, function (err) {
      if (isRefused(err)) noteRefused('del', err); else enqueue('del', entry);
      throw err;
    });
  }
  function deleteRow(entry) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('workout_logs').delete()
          .eq('user_id', u.id)
          .eq('session_id', entry.session_id)
          .eq('exercise', entry.exercise)
          .eq('set_number', entry.set_number)
          .then(rowResult);
      });
    });
  }

  // FIX-02 (audit L-02): read today's rows BACK. A signed-in athlete's sets
  // are already inserted one row per set, but nothing in the tree ever read
  // them again — only two functions write mc_setlog_v1 and neither restores
  // from the server. So a device that died mid-session, was wiped, or was
  // restored from a backup lost the local record while a perfect copy sat in
  // the database. Browser storage is flushed to disk asynchronously, which no
  // web app can defeat with browser storage alone; having the durable copy be
  // unreachable is the part that was a design choice.
  //
  // Scoped by time rather than by page: the row carries session_id and
  // exercise, not the page it was logged on, so a 12-hour window is the
  // honest filter for "this session". Ordered oldest-first so a later row for
  // the same slot wins, matching what the athlete last checked.
  function getSessionSets(sinceIso) {
    return ready.then(function (c) {
      if (!c) return null;
      return currentUser().then(function (u) {
        if (!u) return null;
        return c.from('workout_logs')
          .select('exercise,set_number,weight_lbs,reps,rpe,logged_at')
          .eq('user_id', u.id)
          .gte('logged_at', sinceIso)
          .order('logged_at', { ascending: true })
          .then(function (r) { if (r.error) throw r.error; return r.data || []; });
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
  //
  // FIX (audit EN-3): this used to call res.json() with no status check, so a
  // 404 from a path that did not resolve was parsed as if it were a result and
  // resolved successfully. Combined with callers that swallow errors by
  // design, that is why every personal-record notification failed in total
  // silence for the whole life of the feature. A non-2xx now rejects, which
  // the callers still swallow — but the promise tells the truth, and the
  // console carries the status.
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
        }).then(function (res) {
          if (!res.ok) throw new Error('push-notify failed: ' + res.status);
          return res.json();
        });
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

  // ---- coach-claude Edge Function (AI coaching report, server-side Anthropic)
  // Sends the user's access token to the Edge Function, which reads 30 days of
  // workout_logs and calls the Anthropic API (key never touches the browser).
  // Resolves with a structured report { summary, flags[], volumeWarnings[],
  // swaps[] }, or null if the user is not signed in or the function is
  // unavailable.
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
        }).then(function (data) { return (data && data.summary) ? data : null; });
      });
    });
  }

  // ---- coach-substitute Edge Function (LLM exercise-swap fallback) ---------
  // Used by mc-card-actions.js when the deterministic mc-biomech.js matcher
  // returns fewer than 3 alternatives. Sends the source exercise plus a
  // client-computed candidate pool (already catalog-grounded); the function
  // only picks INDICES into that pool — it can never introduce an exercise
  // name that isn't already in the caller's own catalog. Resolves with
  // { picks: number[] }, or null if signed out or unavailable.
  function callSubstitute(payload) {
    return ready.then(function (c) {
      if (!c) return null;
      return c.auth.getSession().then(function (r) {
        var session = r && r.data && r.data.session;
        if (!session) return null;
        return fetch(SUPABASE_URL + '/functions/v1/coach-substitute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.access_token
          },
          body: JSON.stringify(payload)
        }).then(function (res) {
          if (!res.ok) throw new Error('Substitute call failed: ' + res.status);
          return res.json();
        }).then(function (data) { return (data && Array.isArray(data.picks)) ? data.picks : null; });
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

  window.MC_SB = {
    ready: ready,
    get client() { return client; },
    configured: configured,
    get sdkLoadFailed() { return sdkLoadFailed; },
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
    lookupClientByEmail: lookupClientByEmail,
    listClients: listClients,
    addClient: addClient,
    updateClientAssignment: updateClientAssignment,
    removeClient: removeClient,
    getMyAssignment: getMyAssignment,
    getCanaryNaming: getCanaryNaming,
    listCanary: listCanary,
    upsertCanaryNaming: upsertCanaryNaming,
    removeCanaryNaming: removeCanaryNaming,
    onCanaryChange: onCanaryChange,
    saveActiveProgram: saveActiveProgram,
    getActiveProgram: getActiveProgram,
    logSet: logSet,
    unlogSet: unlogSet,               // FIX-05: the correction path
    flushOutbox: flushOutbox,         // R3 / D-19: replay sets written with no signal
    getSessionSets: getSessionSets,   // FIX-02: the durable copy, read back
    deleteSessionLog: deleteSessionLog,
    getLastWeight: getLastWeight,
    getWeeklyVolume: getWeeklyVolume,
    getMaxWeight: getMaxWeight,
    callCoach: callCoach,
    callSubstitute: callSubstitute,
    savePushSubscription: savePushSubscription,
    deletePushSubscription: deletePushSubscription,
    sendPush: sendPush
  };
})();
