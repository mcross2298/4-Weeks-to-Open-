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
    onChange: onChange
  };
})();
