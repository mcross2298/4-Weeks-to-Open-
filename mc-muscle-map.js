/* ==========================================================================
   mc-muscle-map.js — shared exercise-name → muscle-group classifier
   --------------------------------------------------------------------------
   Single source for the regex taxonomy that mc-summary.js's iconFor() seeded,
   now also powering the Stats hub's volume-by-muscle-group view. Order
   matters: more specific patterns (calves, shoulders) match before broader
   ones (legs, press).
   ========================================================================== */
(function () {
  if (window.MC_MUSCLES) return;

  // Order matters: more specific patterns (calves, shoulders) match before
  // broader ones (legs, press). Three of these were measured wrong against the
  // curated catalog and are corrected here (audit P2-14, roadmap Phase 2.2):
  //
  //   \brow\b did not match "Rows". "Underhand Cable Rows", "V Grip Cable
  //   Rows" and "Underhand Bent Over Barbell Rows" — real catalog entries —
  //   fell past Back entirely.
  //
  //   `grip` in the FOREARMS pattern then caught two of them. "Close Grip
  //   Cable Rows" and "V Grip Cable Rows" came back Forearms. Grip is a
  //   modifier on other lifts far more often than it names the target, so it
  //   only counts here when the name is really about grip work.
  //
  //   `overhead extension` required the two words adjacent, so "Overhead
  //   Dumbbell Extension" and "Overhead Rope Extension" matched nothing at all
  //   and came back "other".
  //
  //   `\bfly\b|flye` missed the plural. "Cable Flies" came back "other", and
  //   "Flies" is how this app's own programs spell it.
  var GROUPS = [
    { id: 'calves',    label: 'Calves',    icon: '🦶', re: /calf|calves/i },
    { id: 'shoulders', label: 'Shoulders', icon: '🏔️', re: /shoulder|delt|lateral raise|overhead press|military|arnold|upright row|face pull/i },
    { id: 'legs',      label: 'Legs',      icon: '🦵', re: /squat|leg press|lunge|hack|leg extension|hip thrust|leg curl|hamstring|\bham\b|rdl|romanian|deadlift|good morning|glute|step.?up|quad/i },
    { id: 'triceps',   label: 'Triceps',   icon: '💪', re: /tricep|pushdown|skull|kickback|overhead[a-z\s-]*extension|\bdip\b/i },
    { id: 'back',      label: 'Back',      icon: '🪝', re: /back|\brows?\b|pull-?up|pull-?down|\bchins?\b|\blat\b|shrug|\btrap/i },
    { id: 'chest',     label: 'Chest',     icon: '🫷', re: /bench|chest|\bfl(?:y|ies)\b|flye|incline|decline|\bpec\b|push-?up|press/i },
    { id: 'core',      label: 'Core',      icon: '🔥', re: /\babs?\b|core|crunch|plank|knee raise|sit-?up|leg raise|hollow|russian twist|woodchop/i },
    { id: 'biceps',    label: 'Biceps',    icon: '💪', re: /bicep|curl|preacher|hammer/i },
    { id: 'forearms',  label: 'Forearms',  icon: '🤝', re: /forearm|wrist|grip strength|gripper|farmer|\bwrist roller\b/i }
  ];

  // exercise-catalog.js's own muscle labels, projected onto the group ids
  // above. The catalog is the authority; these regexes are the fallback for a
  // name it does not carry (audit P2-14).
  var CATALOG_GROUP = {
    'chest': 'chest', 'back': 'back', 'shoulders': 'shoulders',
    'biceps': 'biceps', 'triceps': 'triceps', 'forearms': 'forearms',
    'core': 'core', 'abs': 'core', 'calves': 'calves',
    'legs - quads': 'legs', 'legs - hamstrings': 'legs', 'legs - glutes': 'legs',
    'quads': 'legs', 'hamstrings': 'legs', 'glutes': 'legs',
    'adductors': 'legs', 'abductors': 'legs', 'legs': 'legs'
  };
  var OTHER = { id: 'other', label: 'Other', icon: '🏋️' };

  window.MC_MUSCLES = {
    groups: GROUPS.concat([OTHER]),
    classify: function (name) {
      // Parentheses on an exercise name carry a COACHING CUE, not the
      // movement: "Barbell Squat (shoulder width)" is a squat, and
      // "Leg Press (feet shoulder width)" is a leg press. Classifying the cue
      // put both of them under Shoulders — found by dry-running this
      // classifier over the real logged exercise names before backfilling the
      // cloud attribution column (roadmap Phase 1.4), not by reading the
      // regexes. Two of the 39 live names were affected, and both were
      // squats. The taxonomy below is untouched; only the text it is given
      // changes, so this cannot reshuffle anything that was already right.
      // THE CURATED CATALOG FIRST (audit P2-14, roadmap Phase 2.2). All 577
      // exercises carry a hand-checked `muscle`; a regex over the name is a
      // guess about the same question, and where the two disagreed the
      // catalog was right. Measured before this landed: the regexes alone
      // agreed with the catalog on 416 of 556 comparable exercises (74.8%)
      // and answered "other" for 66 of them, "21s" among them — a name with
      // no keyword in it at all, which no regex can ever resolve and the
      // catalog answers outright.
      var viaCatalog = (typeof window !== 'undefined' && window.MC_CLASSIFY)
        ? CATALOG_GROUP[String(window.MC_CLASSIFY.catalogMuscle(name) || '').toLowerCase()]
        : null;
      if (viaCatalog) {
        for (var c = 0; c < GROUPS.length; c++) if (GROUPS[c].id === viaCatalog) return GROUPS[c];
      }
      var n = String(name || '').replace(/\([^)]*\)/g, ' ');
      for (var i = 0; i < GROUPS.length; i++) {
        if (GROUPS[i].re.test(n)) return GROUPS[i];
      }
      return OTHER;
    }
  };
})();
