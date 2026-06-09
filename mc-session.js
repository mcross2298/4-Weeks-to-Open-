/* mc-session.js — Consolidated state layer
   Merges fragmented localStorage keys into a single mc_session object.
   Non-breaking: all existing read/write paths remain intact.
   Call MCSession.migrate() once on app load to build the index. */
(function () {
  'use strict';
  var SESSION_KEY = 'mc_session';

  var DEFAULTS = {
    activeProgram: null,   // program id string, e.g. 'mc'
    activeSplit: null,     // URL of last active split page
    lastWorkout: null,     // URL of last opened workout page
    lastVisited: [],       // recently visited workout URLs (newest first)
    streak: { count: 0, lastDate: null }
  };

  function read() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') || clone(DEFAULTS);
    } catch (e) { return clone(DEFAULTS); }
  }

  function persist(data) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function migrate() {
    var session = read();
    var changed = false;

    // activeProgram — from mc_active_prog (written by dashboard.html confirmProg())
    if (!session.activeProgram) {
      try {
        var prog = JSON.parse(localStorage.getItem('mc_active_prog') || 'null');
        if (prog && prog.id) { session.activeProgram = prog.id; changed = true; }
      } catch (e) {}
    }

    // activeSplit — from per-category split keys
    if (!session.activeSplit) {
      var splitHref = localStorage.getItem('mc_active_split_href') ||
                      localStorage.getItem('pmc_active_split');
      if (splitHref) { session.activeSplit = splitHref; changed = true; }
    }

    // streak — from mc_daily_v1 (written by mc-summary.js saveDaily())
    if (!session.streak.lastDate) {
      try {
        var daily = JSON.parse(localStorage.getItem('mc_daily_v1') || '{}');
        var entries = Object.values(daily);
        if (entries.length) {
          var latest = entries.reduce(function (a, b) {
            return (a.ts || 0) > (b.ts || 0) ? a : b;
          }, {});
          if (latest.date) {
            session.streak.lastDate = latest.date;
            changed = true;
          }
        }
      } catch (e) {}
    }

    if (changed) persist(session);
    return session;
  }

  window.MCSession = {
    get: read,

    update: function (partial) {
      var s = read();
      Object.keys(partial).forEach(function (k) { s[k] = partial[k]; });
      persist(s);
      return s;
    },

    /* Record a workout page visit (newest-first, max 10) */
    recordVisit: function (url) {
      var s = read();
      s.lastVisited = s.lastVisited.filter(function (u) { return u !== url; });
      s.lastVisited.unshift(url);
      if (s.lastVisited.length > 10) s.lastVisited.length = 10;
      s.lastWorkout = url;
      persist(s);
    },

    migrate: migrate
  };

  /* Auto-migrate on first load (non-destructive, silently skipped if already done) */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', migrate);
  } else {
    migrate();
  }
})();
