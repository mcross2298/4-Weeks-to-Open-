/* ==========================================================================
   mc-naming.js  —  v2 naming resolver (Phase 1 + Phase 2)
   --------------------------------------------------------------------------
   Loaded dynamically by program-overrides.js init() so it's available on
   every page without touching each workout HTML file.

   Reads from MC_PO.effective() on demand — no state of its own beyond the
   static page → program/split maps. Writes go through MC_PO.setLocal() so
   the same single working copy and Publish pipeline handle all override types.

   Document sections:
     exercises: { origName → patch }              (1-level)
     programs:  { progId  → patch }               (1-level)
     splits:    { progId  → { origSplit → patch } }  (2-level)
     badges:    { progId  → { badgeId  → patch } }   (2-level, 'global' key for app-wide)

   window.MC_NAMES:
     exercise(origName)           -> resolved display name | null
     program(progId)              -> resolved name | null
     split(progId, origSplit)     -> resolved display name | null
     badge(progId, badgeId)       -> { label, color } | null  (global fallback)
     progOf(pageId)               -> program id string | null
     splitOf(pageId)              -> canonical split name (from PROGS) | null
     setLocal(section, key, patch [, subKey])
     clearLocal(section, key [, subKey])
     localNamingEditCount()       -> count of pending naming edits (excl. pages)
   ========================================================================== */
(function () {
  if (window.MC_NAMES) return;

  // ---- page → program identifier -------------------------------------------
  var PAGE_PROG_EXPLICIT = {
    'index.html': null, 'dashboard.html': null,
    'exercise-library.html': null, 'conditioning.html': null,
    'cat-custom.html': null
  };

  function progOf(pageId) {
    if (pageId in PAGE_PROG_EXPLICIT) return PAGE_PROG_EXPLICIT[pageId];
    // workout pages: content-prefixed filenames
    if (/^pmc-/.test(pageId)) return 'pmc';
    if (/^mc-/.test(pageId))  return 'mc';
    if (/^ss-/.test(pageId))  return 'ss';
    // catalog/schedule pages: filenames differ from the content prefix
    // (cat-pmc.html, cat-mc.html, cat-strength.html) so they need their own
    // mapping or program-scoped badge/split paint never fires
    if (/^cat-pmc/.test(pageId))      return 'pmc';
    if (/^cat-mc/.test(pageId))       return 'mc';
    if (/^cat-strength/.test(pageId)) return 'ss';
    if (pageId === 'cat-ks.html' || pageId === 'kitchen-sink.html') return 'ks';
    if (pageId === 'cat-ie.html' || pageId === 'iron-engine.html') return 'ie';
    if (pageId === 'cat-mm.html' || /^mm-/.test(pageId)) return 'mm';
    if (pageId === 'cat-hv.html' || /^hv-/.test(pageId)) return 'hv';
    /* MARKET:STRIP influencer-progs START */
    if (/^stndr-/.test(pageId) || /^cat-stndr/.test(pageId)) return 'stndr';
    if (/^pump-/.test(pageId)  || /^cat-pump/.test(pageId))  return 'pump';
    if (/^gainz-/.test(pageId) || /^cat-gainz/.test(pageId)) return 'gainz';
    if (/^psu-/.test(pageId)   || /^cat-psu/.test(pageId))   return 'psu';
    /* MARKET:STRIP influencer-progs END */
    return null;
  }

  // ---- page → canonical split label (from PROGS.splits) -------------------
  // Split hub pages only — provides the PROGS-matching key for split renames.
  // 'pmc' and 'mc' are the only two programs whose split hubs follow a fixed
  // <progId>-split<N>.html naming convention, so this derives their entries
  // from mc-pm-data.js's programs[].splits instead of hand-duplicating the
  // list here — a split rename/reorder only needs to change once, in
  // mc-pm-data.js. Built lazily (not at module load): mc-naming.js and
  // mc-pm-data.js are loaded as two independent dynamically-inserted
  // <script> tags with no guaranteed load-completion order (see
  // program-overrides.js's init()), so window.MC_PM_DATA may not exist yet
  // the moment this file first runs.
  var SPLIT_HUB_PROG_IDS = ['pmc', 'mc'];
  var _pageSplitMap = null;
  function pageSplitMap() {
    if (_pageSplitMap) return _pageSplitMap;
    var progs = (window.MC_PM_DATA && window.MC_PM_DATA.programs) || [];
    if (!progs.length) return {}; // not loaded yet — don't cache an empty result
    var map = {};
    SPLIT_HUB_PROG_IDS.forEach(function (progId) {
      var prog = progs.filter(function (p) { return p.id === progId; })[0];
      if (!prog) return;
      prog.splits.forEach(function (split, i) {
        map[progId + '-split' + (i + 1) + '.html'] = { progId: progId, split: split };
      });
    });
    _pageSplitMap = map;
    return map;
  }

  function splitOf(pageId) {
    var e = pageSplitMap()[pageId];
    return e ? e.split : null;
  }

  // ---- effective() shorthand -----------------------------------------------
  function eff() {
    return (window.MC_PO && typeof MC_PO.effective === 'function')
      ? MC_PO.effective()
      : { pages: {}, exercises: {}, programs: {}, splits: {}, badges: {} };
  }

  // ---- 1-level resolver (exercises, programs) ------------------------------
  function resolve1(section, key) {
    if (!key) return null;
    var sec = eff()[section] || {};
    var entry = sec[key];
    if (!entry) {
      var want = key.trim().toLowerCase(), k;
      for (k in sec) { if (k.trim().toLowerCase() === want) { entry = sec[k]; break; } }
    }
    return (entry && entry.name && !entry.reset) ? entry.name : null;
  }

  // ---- 2-level resolver for splits ----------------------------------------
  function split(progId, origSplit) {
    if (!progId || !origSplit) return null;
    var splits = eff().splits || {};
    var progSplits = splits[progId] || {};
    var entry = progSplits[origSplit];
    if (!entry) {
      var want = origSplit.trim().toLowerCase(), k;
      for (k in progSplits) { if (k.trim().toLowerCase() === want) { entry = progSplits[k]; break; } }
    }
    return (entry && entry.name && !entry.reset) ? entry.name : null;
  }

  // ---- 2-level resolver for badges ----------------------------------------
  // Checks program-scoped first, then 'global'. Returns { label, color } | null.
  function badge(progId, badgeId) {
    if (!badgeId) return null;
    var badges = eff().badges || {};
    var progBadges = (progId && badges[progId]) ? badges[progId] : {};
    var globalBadges = badges['global'] || {};
    var entry = progBadges[badgeId] || globalBadges[badgeId] || null;
    return (entry && !entry.reset) ? entry : null;
  }

  // ---- public resolvers ----------------------------------------------------
  function exercise(origName) { return resolve1('exercises', origName); }
  function program(progId)    { return resolve1('programs',  progId); }

  // full merged program patch ({ name, icon, desc } subset) — for surfaces
  // that paint more than just the name (dashboard hero icon/description).
  function programMeta(progId) {
    if (!progId) return {};
    var sec = eff().programs || {};
    var entry = sec[progId];
    if (!entry) {
      var want = progId.trim().toLowerCase(), k;
      for (k in sec) { if (k.trim().toLowerCase() === want) { entry = sec[k]; break; } }
    }
    return (entry && !entry.reset) ? entry : {};
  }

  // ---- write helpers -------------------------------------------------------
  // For 1-level sections (exercises, programs): setLocal(section, key, patch)
  // For 2-level sections (splits, badges):      setLocal(section, key, patch, subKey)
  function setLocal(section, key, patch, subKey) {
    if (!window.MC_PO) return;
    var data = MC_PO.local();
    if (subKey !== undefined) {
      if (!data[section]) data[section] = {};
      if (!data[section][key]) data[section][key] = {};
      data[section][key][subKey] = patch;
    } else {
      if (!data[section]) data[section] = {};
      data[section][key] = patch;
    }
    MC_PO.setLocal(data);
  }

  function clearLocal(section, key, subKey) {
    if (!window.MC_PO) return;
    var data = MC_PO.local();
    if (subKey !== undefined) {
      if (data[section] && data[section][key]) {
        delete data[section][key][subKey];
        if (!Object.keys(data[section][key]).length) delete data[section][key];
      }
    } else {
      if (data[section]) delete data[section][key];
    }
    MC_PO.setLocal(data);
  }

  function localNamingEditCount() {
    if (!window.MC_PO) return 0;
    var local = MC_PO.local();
    var n = 0, pid, bpid;
    n += Object.keys(local.exercises || {}).length;
    n += Object.keys(local.programs  || {}).length;
    var splits = local.splits || {};
    for (pid in splits) n += Object.keys(splits[pid]).length;
    var badges = local.badges || {};
    for (bpid in badges) n += Object.keys(badges[bpid]).length;
    return n;
  }

  window.MC_NAMES = {
    exercise: exercise,
    program: program,
    programMeta: programMeta,
    split: split,
    badge: badge,
    progOf: progOf,
    splitOf: splitOf,
    setLocal: setLocal,
    clearLocal: clearLocal,
    localNamingEditCount: localNamingEditCount
  };
})();
