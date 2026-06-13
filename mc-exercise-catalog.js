/* ==========================================================================
   mc-exercise-catalog.js — custom exercise store, auto-classifier, dedup
   --------------------------------------------------------------------------
   Extends the static exercise-catalog.js with user-created and PM-published
   exercises. Two persistence tiers (same pattern as MCPrograms / MC_PO):

     1. localStorage mc_custom_exercises_v1 — per-user local additions;
        synced across the user's own devices via mc-sync.js.
     2. Supabase published_exercises — PM-published, live for all users.

   Muscle group is auto-classified from the exercise name via keyword rules —
   no user picker, no manual choice required.

   Dedup: normalized exact-match (case/space/punctuation-insensitive) against
   the full EXERCISES array before storing anything. Near-duplicates are NOT
   auto-merged; only byte-equivalent names after normalization are blocked.

   window.MC_EXCATALOG:
     normalize(name)         -> canonical string for comparison
     classify(name)          -> muscle group string (one of MUSCLE_COLORS keys)
     isKnown(name)           -> existing entry | null
     add(name)               -> add locally; returns entry (existing if duplicate)
     mergeInto(exercises)    -> push custom + published entries into a live array
     getCustom()             -> array of locally-saved entries
     queueForPublish(entry)  -> stage for next PM Publish
     getPending()            -> staged entries not yet published
     clearPending()
     publishPending()        -> Promise — upserts pending to Supabase, clears queue
     loadPublished()         -> fetch Supabase published_exercises → merge live
   ========================================================================== */
(function () {
  if (window.MC_EXCATALOG) return;

  var STORE_KEY   = 'mc_custom_exercises_v1';
  var PENDING_KEY = 'mc_pm_pending_exercises';

  // ---- normalize: dedup-safe comparison ------------------------------------
  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\*+/g, '')            // strip trailing **
      .replace(/\([^)]*\)/g, ' ')     // strip parentheticals
      .replace(/[^a-z0-9 ]/g, ' ')   // punctuation → space
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---- auto-classifier: keyword-based muscle group -------------------------
  // Rules are priority-ordered — first match wins. More-specific patterns
  // precede more-general ones to prevent false hits (e.g. "upright row"
  // should hit Shoulders before "row" hits Back; "leg curl" hits Hamstrings
  // before "curl" hits Biceps).
  // Leading \b anchors the keyword to a word start; no trailing \b so plural/
  // derived forms match correctly ("sprints", "adduction", "crusher", "shrugs").
  var RULES = [
    // Cardio — before "row" to catch "rower machine" before Back's "row" rule
    [/\b(cardio|sprint|jog|elliptical|stairmaster|treadmill|rower\s+machine|stationary\s+bike|jump\s+rope|hiit|liss|sled\s+push|sled\s+drag|battle\s+rope)/, 'Cardio'],
    // Glutes
    [/\b(glute|hip\s+thrust|donkey\s+kick|booty)/, 'Legs - Glutes'],
    // Hamstrings — before generic "leg" and before "curl" hits Biceps
    [/\b(hamstring|rdl|romanian|good\s+morning|stiff[\s-]leg|leg\s+curl|nordic|posterior\s+chain)/, 'Legs - Hamstrings'],
    // Adductors — "adduction" starts with "adduct" so leading \b + no trailing is enough
    [/\b(adduct|inner\s+thigh|groin)/, 'Adductors'],
    // Calves
    [/\b(calf|calves)/, 'Calves'],
    // Core — "leg raise" captured here before "leg" hits Quads
    [/\b(crunch|plank|sit[\s-]up|v[\s-]up|russian\s+twist|oblique|hollow\s+body|dead\s+bug|bird\s+dog|leg\s+raise|ab\s|abdominal|anti[\s-]rotation|pallof)/, 'Core'],
    [/\babs\b/, 'Core'],
    // Forearms — "wrist curl" before "curl" hits Biceps
    [/\b(forearm|wrist\s+curl|wrist\s+roll|grip\s+strength|pinch|rice\s+bucket)/, 'Forearms'],
    // Quads — after hamstrings so "leg curl" is already claimed
    [/\b(squat|leg\s+press|leg\s+extension|lunge|split\s+squat|step[\s-]up|hack\s+squat|quad|sissy\s+squat|goblet|front\s+squat)/, 'Legs - Quads'],
    // Biceps — curl now only hits movements not claimed above
    [/\b(curl|preacher|spider\s+curl|concentration\s+curl|zottman)/, 'Biceps'],
    // Triceps — before Shoulders so "overhead extension" is caught here
    [/\b(tricep|skull[\s-]?crush|pushdown|press[\s-]down|overhead\s+extension|tricep\s+dip)/, 'Triceps'],
    // Shoulders — "upright row" before generic "row" hits Back;
    // "reverse fly/pec" before Chest's "fly" rule
    [/\b(rear\s+delt|face\s+pull|lateral\s+raise|side\s+raise|front\s+raise|shoulder\s+press|military\s+press|overhead\s+press|arnold|upright\s+row|shrug|reverse\s+fly|reverse\s+pec)/, 'Shoulders'],
    // Back — "row" won't catch shoulder or cardio movements (already claimed above)
    [/\b(row|pull[\s-]?up|pulldown|lat\s|deadlift|rack\s+pull|hyperextension|back\s+extension|rhomboid|lats\b|trap\s+bar)/, 'Back'],
    // Chest
    [/\b(bench|chest|fly|flies|pec\b|push[\s-]?up|pullover|incline\s+press|decline\s+press|dip)/, 'Chest'],
    // Shoulders fallback — any remaining "press" / "overhead" / "raise"
    [/\b(press|overhead|raise)/, 'Shoulders'],
  ];

  function classify(name) {
    var s = normalize(name);
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(s)) return RULES[i][1];
    }
    return 'Full Body';
  }

  // ---- storage -------------------------------------------------------------
  function readCustom() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function writeCustom(a) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(a)); } catch (e) {}
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {}
  }

  function readPending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function writePending(a) {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(a)); } catch (e) {}
  }

  // ---- dedup ---------------------------------------------------------------
  // Checks the full live EXERCISES array (static + already-merged custom).
  function isKnown(name) {
    var n = normalize(name);
    var all = window.EXERCISES || [];
    for (var i = 0; i < all.length; i++) {
      if (normalize(all[i].name) === n) return all[i];
    }
    return null;
  }

  // ---- add (local path) ----------------------------------------------------
  function addLocal(name) {
    var known = isKnown(name);
    if (known) return known;
    var muscle = classify(name);
    var entry = {
      name: name.trim(),
      muscle: muscle,
      programs: ['Custom'],
      master: null,
      custom: true,
      createdAt: new Date().toISOString()
    };
    var a = readCustom();
    a.push(entry);
    writeCustom(a);
    // Push into the live array immediately so pickers see it without reload
    if (window.EXERCISES) window.EXERCISES.push(entry);
    return entry;
  }

  // ---- merge custom + published into a live exercises array ----------------
  // Call this after exercise-catalog.js has populated window.EXERCISES.
  // Safe to call multiple times — won't double-insert.
  function mergeInto(arr) {
    if (!arr) return;
    var known = {};
    arr.forEach(function (e) { known[normalize(e.name)] = true; });
    readCustom().forEach(function (e) {
      if (!known[normalize(e.name)]) { arr.push(e); known[normalize(e.name)] = true; }
    });
    // published exercises loaded from Supabase are merged via loadPublished()
    // which also calls this after the fetch resolves
  }

  // ---- PM publish queue ----------------------------------------------------
  function queueForPublish(entry) {
    var q = readPending();
    if (!q.some(function (e) { return normalize(e.name) === normalize(entry.name); })) {
      q.push(entry);
      writePending(q);
    }
  }

  function clearPending() {
    try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
  }

  // Returns a Promise. Called by program-manager.js doPublish().
  function publishPending() {
    var pending = readPending();
    if (!pending.length) return Promise.resolve();
    if (!window.MC_SB || !MC_SB.configured) return Promise.resolve();
    if (typeof MC_SB.upsertExercise !== 'function') return Promise.resolve();
    return Promise.all(pending.map(function (e) {
      return MC_SB.upsertExercise(e);
    })).then(function () {
      clearPending();
      // Move the custom entries to 'Published' so the library reflects their status
      var stored = readCustom();
      pending.forEach(function (pub) {
        var n = normalize(pub.name);
        stored = stored.map(function (e) {
          if (normalize(e.name) === n) {
            e.programs = ['Published'];
            delete e.custom;
          }
          return e;
        });
      });
      writeCustom(stored);
    });
  }

  // ---- load published exercises from Supabase ------------------------------
  // Fetches and merges into window.EXERCISES. Called at page init.
  function loadPublished() {
    if (!window.MC_SB || !MC_SB.configured) return;
    if (typeof MC_SB.getExercises !== 'function') return;
    MC_SB.getExercises().then(function (rows) {
      if (!rows || !rows.length) return;
      rows.forEach(function (row) {
        if (!isKnown(row.name)) {
          var entry = {
            name: row.name,
            muscle: row.muscle,
            programs: row.programs || ['Published'],
            master: row.master || null
          };
          if (window.EXERCISES) window.EXERCISES.push(entry);
        }
      });
    }).catch(function () {});
  }

  window.MC_EXCATALOG = {
    normalize: normalize,
    classify: classify,
    isKnown: isKnown,
    add: addLocal,
    mergeInto: mergeInto,
    getCustom: readCustom,
    queueForPublish: queueForPublish,
    getPending: readPending,
    clearPending: clearPending,
    publishPending: publishPending,
    loadPublished: loadPublished
  };

  // Bootstrap: if the static catalog is already loaded, merge immediately.
  // If not (lazy-load pages), mergeInto() will be called explicitly after load.
  if (window.EXERCISES) {
    mergeInto(window.EXERCISES);
    loadPublished();
  }
})();
