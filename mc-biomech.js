/* ==========================================================================
   mc-biomech.js — Phase 1: Commercial Gym Adaptability (biomech engine)
   --------------------------------------------------------------------------
   Self-contained substitution engine for crowded-gym swaps. It maps exercises
   by BIOMECHANICAL MOVEMENT PATTERN, EQUIPMENT TYPE, and TARGET MUSCLE, then
   ranks alternatives by similarity and the user's available equipment.

   Decoupled by design: workout pages do NOT load exercise-catalog.js, so this
   module ships its own compact movement library and a keyword classifier. When
   window.EXERCISES *is* present (Library / Build pages) it folds those in too.

   Exposes window.MCBiomech:
     classify(name)                     -> { pattern, equipment, muscle }
     alternatives(name, opts)           -> ranked [{ name, equipment, pattern,
                                                     muscle, weight }]
     fallbackCandidates(name, opts)     -> leftover pool [{ name, equipment,
                                                     pattern, muscle }] beyond
                                            what alternatives() already used —
                                            grounded candidate list for the
                                            coach-substitute LLM fallback
     convertWeight(fromName, toName, w) -> predicted target weight (lb, /5)
     EQUIP                              -> ordered equipment list

   Strict matching (per product decision): an alternative must share BOTH the
   movement pattern AND the primary muscle. Purely catalog-driven — there is
   no gym-profile equipment filter (a locked decision, see CLAUDE.md Task 3.1:
   "no user-input friction"); a gym-availability toggle/getGym()/setGym() used
   to exist here but had no UI ever wired to set it, so it was retired.

   Weight conversion: a static leverage table (machines carry more load than
   free weights for the same effort) predicts the starting weight, but any real
   logged history for the target movement (mc_setlog_v1) always wins.
   ========================================================================== */
(function () {
  "use strict";
  if (window.MCBiomech) return;

  // Equipment buckets, ordered roughly most-supported -> least. Each maps to a
  // leverage factor: how much external load the movement tends to carry vs. a
  // free barbell baseline (1.0). Machines stabilize the path, so they hold more.
  var EQUIP = ['Machine', 'Plate-Loaded', 'Smith', 'Cable', 'Barbell', 'Dumbbell', 'Bodyweight'];
  var LEVERAGE = {
    'Machine': 1.20, 'Plate-Loaded': 1.10, 'Smith': 1.08,
    'Cable': 0.90, 'Barbell': 1.00, 'Dumbbell': 0.82, 'Bodyweight': 1.00
  };

  // ---- equipment inference from the exercise name -------------------------
  function equipOf(name) {
    var s = ' ' + String(name || '').toLowerCase() + ' ';
    if (/hammer strength|plate.?loaded|hack squat|t-?bar|pendulum|prowler|sled/.test(s)) return 'Plate-Loaded';
    if (/smith/.test(s)) return 'Smith';
    if (/\bcable\b|pulldown|pull-?down|pushdown|push-?down|rope |lat pull|face pull|cable cross/.test(s)) return 'Cable';
    if (/\bmachine\b|pec deck|leg press|leg extension|leg curl|chest press machine|pec-deck|abductor|adductor machine|seated calf|assisted/.test(s)) return 'Machine';
    if (/barbell|\bbb\b|landmine|ez-?bar|ez bar|trap bar|deadlift|^squat| squat\b/.test(s)) return 'Barbell';
    if (/dumbbell|\bdb\b/.test(s)) return 'Dumbbell';
    if (/push-?up|pull-?up|chin-?up|\bdip\b|bodyweight|plank|sit-?up|hanging|nordic/.test(s)) return 'Bodyweight';
    return 'Barbell'; // safe default — most named lifts are barbell movements
  }

  // ---- movement-pattern inference ----------------------------------------
  // Pattern is the biomechanical signature used for strict similarity. Inferred
  // from name keywords, disambiguated by the muscle when known.
  function patternOf(name, muscle) {
    var s = ' ' + String(name || '').toLowerCase() + ' ';
    var m = String(muscle || '').toLowerCase();
    // pulls
    if (/pulldown|pull-?down|pull-?up|chin-?up|lat pull/.test(s)) return 'vertical-pull';
    if (/face pull|rear delt|reverse fly|reverse pec|rear-delt/.test(s)) return 'rear-delt';
    if (/\brow\b|rows\b|row\b/.test(s)) return 'horizontal-pull';
    if (/shrug|upright row/.test(s)) return 'shrug';
    // presses / push
    if (/lateral|side raise|lat raise|side lateral/.test(s)) return 'lateral-raise';
    if (/overhead|shoulder press|military|ohp|arnold press/.test(s)) return 'vertical-push';
    if (/incline/.test(s) && /press|bench/.test(s)) return 'incline-push';
    if (/decline/.test(s) && /press|bench/.test(s)) return 'horizontal-push';
    if (/(bench|chest) press|chest press|\bpress\b/.test(s) && (m.indexOf('chest') >= 0 || /bench/.test(s))) return 'horizontal-push';
    if (/push-?up/.test(s)) return 'horizontal-push';
    if (/\bfly\b|flye|pec deck|pec-deck|cable cross|crossover/.test(s)) return 'chest-fly';
    // arms
    if (/curl/.test(s) && (m.indexOf('bicep') >= 0 || /bicep|preacher|hammer curl|spider/.test(s)) && !/leg curl/.test(s)) return 'elbow-flexion';
    if (/pushdown|push-?down|tricep|skull|overhead extension|kickback|\bdip\b|close grip|close-grip|jm press/.test(s)) return 'elbow-extension';
    // legs
    if (/leg curl|ham curl|hamstring curl|nordic|glute-?ham|ghr/.test(s)) return 'knee-flexion';
    if (/leg extension|knee extension/.test(s)) return 'knee-extension';
    if (/deadlift|rdl|romanian|good morning|hip thrust|hip-?thrust|back extension|hyperextension|pull-?through|kettlebell swing/.test(s)) return 'hip-hinge';
    if (/lunge|split squat|bulgarian|step-?up|step up/.test(s)) return 'lunge';
    if (/squat|leg press|hack/.test(s)) return 'squat';
    if (/calf|calve|toe press|tibialis/.test(s)) return 'calf';
    if (/abduct/.test(s)) return 'hip-abduction';
    if (/adduct/.test(s)) return 'hip-adduction';
    // core
    if (/crunch|sit-?up|plank|leg raise|knee raise|woodchop|pallof|rollout|ab wheel|hanging/.test(s)) return 'core';
    // generic presses that fell through (e.g. machine "press")
    if (/\bpress\b/.test(s)) return m.indexOf('shoulder') >= 0 ? 'vertical-push' : 'horizontal-push';
    return 'other';
  }

  // Muscle inference when no muscle metadata is supplied (workout cards rarely
  // carry it). Keyword-first, then pattern-implied.
  function muscleOf(name, pattern) {
    var s = ' ' + String(name || '').toLowerCase() + ' ';
    if (/bicep|preacher|spider|hammer curl/.test(s)) return 'Biceps';
    if (/tricep|pushdown|skull|kickback|close grip|\bdip\b/.test(s)) return 'Triceps';
    if (/calf|calve|tibialis/.test(s)) return 'Calves';
    // posterior chain & legs BEFORE the broad "Back" keyword check, so e.g.
    // "Romanian Deadlift" -> Hamstrings and "Smith Machine Squat" -> Quads
    // instead of being swept into Back by "deadlift"/"squat machine" wording.
    if (/leg curl|ham\b|hamstring|rdl|romanian|stiff-?leg|glute-?ham/.test(s)) return 'Hamstrings';
    if (/hip thrust|hip-?thrust|\bglute/.test(s)) return 'Glutes';
    if (/squat|leg press|leg extension|knee extension|\blunge|hack|split squat|step-?up|goblet/.test(s)) return 'Quads';
    if (/lateral|side raise|delt|shoulder|overhead|military|arnold|upright row/.test(s)) return 'Shoulders';
    if (/chest|bench|pec|fly|push-?up/.test(s)) return 'Chest';
    if (/row|pulldown|pull-?up|chin|lat |back ext|deadlift|shrug/.test(s)) return 'Back';
    if (/crunch|sit-?up|plank|ab |core|woodchop|pallof/.test(s)) return 'Core';
    var byPat = {
      'horizontal-push': 'Chest', 'incline-push': 'Chest', 'chest-fly': 'Chest',
      'vertical-push': 'Shoulders', 'lateral-raise': 'Shoulders', 'rear-delt': 'Shoulders',
      'horizontal-pull': 'Back', 'vertical-pull': 'Back', 'shrug': 'Back',
      'elbow-flexion': 'Biceps', 'elbow-extension': 'Triceps',
      'squat': 'Quads', 'lunge': 'Quads', 'knee-extension': 'Quads',
      'knee-flexion': 'Hamstrings', 'hip-hinge': 'Hamstrings', 'calf': 'Calves'
    };
    return byPat[pattern] || 'Other';
  }

  // Normalize the many muscle labels in EXERCISES down to the buckets above so
  // strict same-muscle matching actually lines up (e.g. "Legs - Quads" -> Quads).
  function normMuscle(m) {
    var s = String(m || '').toLowerCase();
    if (/quad/.test(s)) return 'Quads';
    if (/ham/.test(s)) return 'Hamstrings';
    if (/glute/.test(s)) return 'Glutes';
    if (/calf|calve/.test(s)) return 'Calves';
    if (/bicep/.test(s)) return 'Biceps';
    if (/tricep/.test(s)) return 'Triceps';
    if (/shoulder|delt/.test(s)) return 'Shoulders';
    if (/chest|pec/.test(s)) return 'Chest';
    if (/back|lat|trap/.test(s)) return 'Back';
    if (/core|ab/.test(s)) return 'Core';
    if (/adduct/.test(s)) return 'Adductors';
    if (/forearm/.test(s)) return 'Forearms';
    return m ? (m.charAt(0).toUpperCase() + m.slice(1)) : 'Other';
  }

  function classify(name, muscle) {
    var pattern = patternOf(name, muscle);
    var mus = muscle ? normMuscle(muscle) : muscleOf(name, pattern);
    return { pattern: pattern, equipment: equipOf(name), muscle: mus };
  }

  // ---- embedded movement library -----------------------------------------
  // Compact, hand-curated pool of common alternatives across the main patterns,
  // so swaps work on any workout page without the full catalog. {n:name}; muscle
  // + pattern + equipment are derived by the classifier so this stays terse.
  var SEED = [
    // Chest — horizontal push
    'Barbell Bench Press', 'Dumbbell Bench Press', 'Machine Chest Press',
    'Smith Machine Bench Press', 'Push-Up', 'Cable Chest Press',
    // Chest — incline
    'Incline Barbell Bench Press', 'Incline Dumbbell Press', 'Incline Machine Press',
    'Incline Smith Press',
    // Chest — fly
    'Pec Deck Machine', 'Cable Crossover', 'Dumbbell Fly', 'Incline Dumbbell Fly',
    // Shoulders — vertical push
    'Barbell Overhead Press', 'Dumbbell Shoulder Press', 'Machine Shoulder Press',
    'Arnold Press', 'Smith Machine Shoulder Press',
    // Shoulders — lateral
    'Dumbbell Lateral Raise', 'Cable Lateral Raise', 'Machine Lateral Raise',
    // Shoulders — rear delt
    'Cable Face Pull', 'Reverse Pec Deck', 'Dumbbell Rear Delt Fly',
    // Back — horizontal pull
    'Barbell Row', 'Dumbbell Row', 'Machine Row', 'Seated Cable Row',
    'Chest-Supported Row', 'T-Bar Row',
    // Back — vertical pull
    'Lat Pulldown', 'Pull-Up', 'Assisted Pull-Up Machine', 'Cable Pulldown',
    // Back — shrug / traps
    'Barbell Shrug', 'Dumbbell Shrug', 'Cable Upright Row',
    // Biceps
    'Barbell Curl', 'Dumbbell Curl', 'Cable Curl', 'Preacher Curl Machine',
    'Hammer Curl', 'Incline Dumbbell Curl',
    // Triceps
    'Cable Pushdown', 'Overhead Dumbbell Extension', 'Skull Crusher',
    'Close Grip Bench Press', 'Triceps Dip', 'Triceps Machine',
    // Quads — squat
    'Barbell Back Squat', 'Leg Press', 'Hack Squat', 'Smith Machine Squat',
    'Goblet Squat',
    // Quads — knee extension / lunge
    'Leg Extension Machine', 'Walking Lunge', 'Bulgarian Split Squat', 'Step-Up',
    // Hamstrings
    'Lying Leg Curl', 'Seated Leg Curl', 'Romanian Deadlift', 'Stiff-Leg Deadlift',
    'Glute-Ham Raise',
    // Hip hinge / glutes
    'Barbell Deadlift', 'Trap Bar Deadlift', 'Hip Thrust', 'Back Extension',
    'Cable Pull-Through',
    // Calves
    'Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf Raise',
    // Hips
    'Hip Abduction Machine', 'Hip Adduction Machine'
  ];

  // Build the master pool once: SEED + window.EXERCISES (when available),
  // de-duped by lowercase name, each pre-classified.
  var _pool = null;
  function pool() {
    if (_pool) return _pool;
    var seen = {}, out = [];
    function add(name, muscle) {
      var key = String(name || '').trim().toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = 1;
      var c = classify(name, muscle);
      out.push({ name: name, muscle: c.muscle, pattern: c.pattern, equipment: c.equipment });
    }
    SEED.forEach(function (n) { add(n); });
    try {
      if (window.EXERCISES && window.EXERCISES.length) {
        window.EXERCISES.forEach(function (e) {
          if (e && e.name && e.muscle !== 'Cardio') add(e.name, e.muscle);
        });
      }
    } catch (e) {}
    _pool = out;
    return out;
  }

  // ---- learned ranking from accepted swaps --------------------------------
  // mc-card-actions.js increments mc_swap_accept_v1[origLower][altLower] each
  // time a user actually picks that alternative for that original exercise
  // (and decrements on Undo, so a fat-thumb tap doesn't teach anything). Pure
  // re-sort of the existing strict-match candidates — never injects a name
  // outside the same-pattern/same-muscle pool, so it can't override the
  // locked "strict matching" product decision above.
  function acceptCounts(origName) {
    try {
      var all = JSON.parse(localStorage.getItem('mc_swap_accept_v1') || '{}') || {};
      return all[String(origName || '').trim().toLowerCase()] || {};
    } catch (e) { return {}; }
  }

  // ---- alternatives -------------------------------------------------------
  // Catalog-driven only, no gym-profile filtering: tier 1 is same movement
  // pattern AND same primary muscle; tier 2 (used to fill out the top 3 when
  // tier 1 is thin) is same muscle, any pattern. Within each tier, exercises
  // the user has previously picked as a substitute for this exact original
  // sort first (most-accepted first); the rest stay alphabetical.
  // Shared by alternatives() and fallbackCandidates(): splits the pool (minus
  // self) into tier1 (same pattern + muscle), tier2 (same muscle, other
  // pattern), and rest (everything else) so the LLM fallback can be handed
  // exactly what the deterministic matcher didn't already use.
  function tieredCandidates(name, opts) {
    var src = classify(name, opts.muscle);
    var selfKey = String(name || '').trim().toLowerCase();
    var candidates = pool().filter(function (e) {
      return e.name.toLowerCase() !== selfKey;
    });
    var tier1 = candidates.filter(function (e) {
      return e.pattern === src.pattern && e.muscle === src.muscle;
    });
    var usedKeys = {};
    tier1.forEach(function (e) { usedKeys[e.name.toLowerCase()] = 1; });
    var tier2 = candidates.filter(function (e) {
      return e.muscle === src.muscle && e.pattern !== src.pattern && !usedKeys[e.name.toLowerCase()];
    });
    tier2.forEach(function (e) { usedKeys[e.name.toLowerCase()] = 1; });
    var rest = candidates.filter(function (e) { return !usedKeys[e.name.toLowerCase()]; });
    return { tier1: tier1, tier2: tier2, rest: rest };
  }

  function alternatives(name, opts) {
    opts = opts || {};
    var tiers = tieredCandidates(name, opts);
    var counts = acceptCounts(name);
    function toRow(e) {
      var w = convertWeight(name, e.name, opts.lastWeight);
      return {
        name: e.name, equipment: e.equipment, pattern: e.pattern, muscle: e.muscle,
        weight: w,
        weightSource: !w ? 'none' : (historyWeight(e.name) > 0 ? 'history' : 'estimate'),
        acceptCount: counts[e.name.toLowerCase()] || 0
      };
    }
    function byAcceptThenName(a, b) {
      if (a.acceptCount !== b.acceptCount) return b.acceptCount - a.acceptCount;
      return a.name.localeCompare(b.name);
    }
    return tiers.tier1.map(toRow).sort(byAcceptThenName).concat(tiers.tier2.map(toRow).sort(byAcceptThenName));
  }

  // ---- LLM fallback candidate pool -----------------------------------------
  // Everything alternatives() didn't already surface (tier1+tier2), for the
  // coach-substitute Edge Function to rank when the deterministic tiers come
  // up short (<3 total). Purely catalog-driven — never includes an exercise
  // outside this pool, so the LLM can only pick among real, known movements;
  // it cannot invent one. Capped to bound the request payload/prompt size.
  function fallbackCandidates(name, opts) {
    opts = opts || {};
    var rest = tieredCandidates(name, opts).rest;
    return rest.slice(0, 200).map(function (e) {
      return { name: e.name, equipment: e.equipment, pattern: e.pattern, muscle: e.muscle };
    });
  }

  // ---- weight conversion --------------------------------------------------
  // Predicted starting load when switching machines/free weights, scaled by the
  // leverage table. Real logged history for the target movement always wins.
  function round5(n) { return n > 0 ? Math.max(5, Math.round(n / 5) * 5) : 0; }

  function historyWeight(name) {
    // Scan mc_setlog_v1 for any logged set on the target movement; take the
    // heaviest. Keys look like "PID|x-<slug>"; sets are { sn: {w, r} }.
    try {
      var store = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      var slug = String(name || '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 24);
      if (!slug) return 0;
      var best = 0;
      Object.keys(store).forEach(function (k) {
        if (k.toLowerCase().indexOf(slug) < 0) return;
        var sets = store[k] && store[k].sets; if (!sets) return;
        Object.keys(sets).forEach(function (sn) {
          var w = parseFloat(sets[sn] && sets[sn].w);
          if (isFinite(w) && w > best) best = w;
        });
      });
      return best;
    } catch (e) { return 0; }
  }

  function convertWeight(fromName, toName, lastWeight) {
    var hist = historyWeight(toName);
    if (hist > 0) return round5(hist);          // real data wins
    var w = parseFloat(lastWeight);
    if (!isFinite(w) || w <= 0) w = historyWeight(fromName);
    if (!w || w <= 0) return 0;                 // nothing to base a guess on
    var f = LEVERAGE[equipOf(fromName)] || 1.0;
    var t = LEVERAGE[equipOf(toName)] || 1.0;
    return round5(w * (t / f));
  }

  window.MCBiomech = {
    classify: classify,
    alternatives: alternatives,
    fallbackCandidates: fallbackCandidates,
    convertWeight: convertWeight,
    EQUIP: EQUIP
  };
})();
