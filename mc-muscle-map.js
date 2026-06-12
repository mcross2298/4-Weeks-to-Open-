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

  var GROUPS = [
    { id: 'calves',    label: 'Calves',    icon: '🦶', re: /calf|calves/i },
    { id: 'shoulders', label: 'Shoulders', icon: '🏔️', re: /shoulder|delt|lateral raise|overhead press|military|arnold|upright row|face pull/i },
    { id: 'legs',      label: 'Legs',      icon: '🦵', re: /squat|leg press|lunge|hack|leg extension|hip thrust|leg curl|hamstring|\bham\b|rdl|romanian|deadlift|good morning|glute|step.?up|quad/i },
    { id: 'triceps',   label: 'Triceps',   icon: '💪', re: /tricep|pushdown|skull|kickback|overhead extension|\bdip\b/i },
    { id: 'back',      label: 'Back',      icon: '🪝', re: /back|\brow\b|pull-?up|pull-?down|chin|\blat\b|shrug|\btrap/i },
    { id: 'chest',     label: 'Chest',     icon: '🫷', re: /bench|chest|\bfly\b|flye|incline|decline|\bpec\b|push-?up|press/i },
    { id: 'core',      label: 'Core',      icon: '🔥', re: /\babs?\b|core|crunch|plank|knee raise|sit-?up|leg raise|hollow|russian twist|woodchop/i },
    { id: 'biceps',    label: 'Biceps',    icon: '💪', re: /bicep|curl|preacher|hammer/i },
    { id: 'forearms',  label: 'Forearms',  icon: '🤝', re: /forearm|wrist|grip|farmer/i }
  ];
  var OTHER = { id: 'other', label: 'Other', icon: '🏋️' };

  window.MC_MUSCLES = {
    groups: GROUPS.concat([OTHER]),
    classify: function (name) {
      var n = String(name || '');
      for (var i = 0; i < GROUPS.length; i++) {
        if (GROUPS[i].re.test(n)) return GROUPS[i];
      }
      return OTHER;
    }
  };
})();
