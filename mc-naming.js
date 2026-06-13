/* ==========================================================================
   mc-naming.js  —  v2 naming resolver (Phase 1)
   --------------------------------------------------------------------------
   Loaded dynamically by program-overrides.js init() so it's available on
   every page without touching each workout HTML file.

   Reads from MC_PO.effective() on demand — no state of its own beyond the
   page→program map. Writes go through MC_PO.setLocal() so the same single
   working copy and Publish pipeline are used for all override types.

   window.MC_NAMES:
     exercise(origName)       -> resolved display name or null
     program(origId)          -> resolved name or null
     split(origId)            -> resolved name or null
     badge(origId)            -> resolved name or null
     progOf(pageId)           -> program identifier string or null
     setLocal(section, k, p)  -> write a naming override to local working copy
     clearLocal(section, k)   -> remove a naming override from local
     localNamingEditCount()   -> count of pending naming edits (excl. pages)
   ========================================================================== */
(function () {
  if (window.MC_NAMES) return;

  // pageId → program identifier
  // Pattern-based: /^pmc-/ → 'pmc', /^mc-/ → 'mc'. Add explicit entries for
  // home/category pages that don't follow the filename convention.
  var PAGE_PROG_EXPLICIT = {
    'index.html': null,
    'dashboard.html': null,
    'exercise-library.html': null,
    'conditioning.html': null
  };

  function progOf(pageId) {
    if (pageId in PAGE_PROG_EXPLICIT) return PAGE_PROG_EXPLICIT[pageId];
    if (/^pmc-/.test(pageId)) return 'pmc';
    if (/^mc-/.test(pageId))  return 'mc';
    return null;
  }

  function eff() {
    return (window.MC_PO && typeof MC_PO.effective === 'function')
      ? MC_PO.effective()
      : { pages: {}, exercises: {}, programs: {}, splits: {}, badges: {} };
  }

  function resolveSection(section, key) {
    if (!key) return null;
    var sec = eff()[section] || {};
    var entry = sec[key];
    if (!entry) {
      var want = key.trim().toLowerCase(), k;
      for (k in sec) { if (k.trim().toLowerCase() === want) { entry = sec[k]; break; } }
    }
    return (entry && entry.name && !entry.reset) ? entry.name : null;
  }

  // exercise: global exercises section only (page-level is handled by MC_PO directly)
  function exercise(origName) { return resolveSection('exercises', origName); }
  function program(origId)    { return resolveSection('programs', origId); }
  function split(origId)      { return resolveSection('splits', origId); }
  function badge(origId)      { return resolveSection('badges', origId); }

  function setLocal(section, key, patch) {
    if (!window.MC_PO) return;
    var data = MC_PO.local();
    if (!data[section]) data[section] = {};
    data[section][key] = patch;
    MC_PO.setLocal(data);
  }

  function clearLocal(section, key) {
    if (!window.MC_PO) return;
    var data = MC_PO.local();
    if (data[section]) {
      delete data[section][key];
    }
    MC_PO.setLocal(data);
  }

  function localNamingEditCount() {
    if (!window.MC_PO) return 0;
    var local = MC_PO.local();
    var n = 0, secs = ['exercises', 'programs', 'splits', 'badges'], i;
    for (i = 0; i < secs.length; i++) n += Object.keys(local[secs[i]] || {}).length;
    return n;
  }

  window.MC_NAMES = {
    exercise: exercise,
    program: program,
    split: split,
    badge: badge,
    progOf: progOf,
    setLocal: setLocal,
    clearLocal: clearLocal,
    localNamingEditCount: localNamingEditCount
  };
})();
