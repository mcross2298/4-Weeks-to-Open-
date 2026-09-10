/* ==========================================================================
   mc-classify.js — the ONE exercise-name -> equipment resolver
   (engine-repair roadmap Phase 2.4; audit P2-13, EN-11, EN-12)
   --------------------------------------------------------------------------
   `equipCat()` existed TWICE, in mc-suggest.js and mc-maxout.js, and the two
   copies disagreed:

     mc-suggest.js   Cable · Machine · Dumbbell · Barbell (default)
     mc-maxout.js    Cable · Machine ·            Barbell (default)

   So the same dumbbell lift was "Dumbbell" to the progression engine and
   "Barbell" to the one-rep-max estimator, and neither knew Smith,
   Plate-Loaded or Bodyweight existed at all — three of the seven values the
   catalog actually uses, covering 119 of its 577 exercises. Whichever engine
   asked got a different answer about the same lift.

   THE CATALOG IS AUTHORITATIVE, the keywords are the fallback. exercise-catalog.js
   tags all 577 exercises with a real `equipment` value; that is the answer
   whenever the name resolves, and the regexes below only ever run for a name
   the catalog does not carry (a page's authored variant wording, a custom
   exercise, an owner-published one).

   Load order: no dependencies. exercise-catalog.js is read at CALL time, never
   captured at parse time, so this file may load before or after it.
   ========================================================================== */
(function () {
  if (typeof window !== 'undefined' && window.MC_CLASSIFY) return;

  // The seven values exercise-catalog.js actually uses. Anything outside this
  // set coming back from the catalog is passed through untouched rather than
  // silently remapped — a new equipment type should surface, not disappear.
  var EQUIP = ['Machine', 'Plate-Loaded', 'Smith', 'Cable', 'Barbell', 'Dumbbell', 'Bodyweight'];

  // ---- catalog lookup ------------------------------------------------------
  // Built once, lazily, and rebuilt if the catalog's length changes (the
  // Library and Build pages append to window.EXERCISES). A linear scan per
  // call is what the two old copies did — 577 string comparisons on every
  // suggestion, on every card, on every render pass.
  var _index = null, _indexedLen = -1;
  function catalog() {
    var list = (typeof window !== 'undefined' && window.EXERCISES) || null;
    if (!list || !list.length) return null;
    if (_index && _indexedLen === list.length) return _index;
    var map = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e || !e.name) continue;
      var k = norm(e.name);
      if (!(k in map)) map[k] = e;
    }
    _index = map; _indexedLen = list.length;
    return map;
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  // The catalog record for a name, or null. This is the shared authority both
  // muscle taxonomies project from (audit P2-14): mc-muscle-map.js needs the
  // coarse group an athlete reads on the Stats hub, mc-biomech.js needs the
  // fine bucket that decides whether one lift can substitute for another, and
  // before this they each guessed independently from the name. One record,
  // two projections, and the regexes demoted to a fallback for names the
  // catalog does not carry.
  function entry(name) {
    var map = catalog();
    if (!map) return null;
    return map[norm(name)] || null;
  }
  function catalogEquip(name) {
    var hit = entry(name);
    return (hit && hit.equipment) || '';
  }
  function catalogMuscle(name) {
    var hit = entry(name);
    return (hit && hit.muscle) || '';
  }

  // ---- keyword fallback ----------------------------------------------------
  // Only reached for a name the catalog does not carry. Ordered most specific
  // first: a "Hammer Strength Chest Press" is Plate-Loaded, not Machine, and a
  // "Smith Machine Squat" is Smith, not Machine — both of which the two old
  // copies got wrong by not having the branch at all.
  function keywordEquip(name) {
    var s = ' ' + norm(name) + ' ';
    if (/hammer strength|plate.?loaded|hack squat|t-?bar|pendulum|prowler|sled/.test(s)) return 'Plate-Loaded';
    if (/smith/.test(s)) return 'Smith';
    if (/\bcable\b|pulldown|pull-?down|pushdown|push-?down|\brope\b|lat pull|face pull|crossover|cross-?over/.test(s)) return 'Cable';
    if (/\bmachine\b|pec deck|pec-?deck|leg press|leg extension|leg curl|abductor|adductor|assisted/.test(s)) return 'Machine';
    if (/dumbbell|\bdb\b|\bdbs\b|goblet/.test(s)) return 'Dumbbell';
    if (/push-?up|pull-?up|chin-?up|\bdip\b|bodyweight|\bbw\b|plank|sit-?up|hanging|nordic|air squat/.test(s)) return 'Bodyweight';
    if (/barbell|\bbb\b|landmine|ez-?bar|ez bar|trap bar|deadlift|\bsquat\b|bench press/.test(s)) return 'Barbell';
    return 'Barbell';   // most named lifts are barbell movements
  }

  // The equipment an exercise uses. Catalog first, keywords second, and never
  // an empty string — every caller treats the answer as a bucket key.
  function equipCat(name) {
    return catalogEquip(name) || keywordEquip(name);
  }

  // Does this lift load an Olympic bar? The warm-up ladder floors every rung
  // at an empty 45 lb barbell, which is right for a back squat and nonsense
  // for a cable pushdown or a dumbbell curl — a 20 lb working set produced a
  // ladder starting ABOVE it (audit EN-12).
  function usesBarbell(name) {
    var eq = equipCat(name);
    return eq === 'Barbell' || eq === 'Smith';
  }

  // Machine-assisted leverage: these hold more external load for the same
  // effort, so a one-rep-max estimate off them is discounted and their
  // progression step is the smaller plate the stack actually moves.
  // Plate-Loaded was missing from both old copies despite being 26 catalog
  // entries and holding the heavy anchor, cluster and drop positions of an
  // entire flagship phase (audit EN-11).
  function isLeverageAssisted(equip) {
    return equip === 'Cable' || equip === 'Machine' || equip === 'Plate-Loaded';
  }

  var API = {
    EQUIP: EQUIP,
    equipCat: equipCat,
    entry: entry,
    catalogEquip: catalogEquip,
    catalogMuscle: catalogMuscle,
    keywordEquip: keywordEquip,
    usesBarbell: usesBarbell,
    isLeverageAssisted: isLeverageAssisted
  };

  if (typeof window !== 'undefined') window.MC_CLASSIFY = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
