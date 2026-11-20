/* ==========================================================================
   boxing-camp-data.js — 12-Week Boxing Training Camp (boxing-camp.html)
   --------------------------------------------------------------------------
   Pure data, no DOM. Read by boxing-camp.js and by
   tools/test-boxing-camp-data.js (vm-sandboxed), which holds it to the camp
   brief: round counts per phase, the 3:00 / 0:30 default, the combo
   progression and the finisher targets.

   Shapes
     PUNCHES  { '<n>': 'Name' }               the legend, shown once
     COMBOS   { '<code>': 'Name' }            every combo used anywhere;
                                              a code is punch numbers joined
                                              by '+'
     phases[] { id, weeks:[from,to], label, rope, bag,
                drills:[{key, name, icon, rounds}],
                bagRounds:[{add:[codes]} | {same:<round#>, note?}],
                finishers:[{key, name, icon, unit, target?, range?, note}] }

   A heavy-bag round lists only the combos it ADDS. "Carried over" is derived
   (everything earlier rounds added), so a round's full list cannot drift from
   the additions. `same:N` repeats round N's full set with nothing new.
   ========================================================================== */
(function () {
  var WORK = 180;   // 3:00 — every round-based drill
  var REST = 30;    // 0:30

  var PUNCHES = {
    '1': 'Jab', '2': 'Cross', '3': 'Left Hook', '4': 'Right Uppercut',
    '6': 'Left Body Shot', '7': 'Right Body Shot'
  };

  // Names as the camp brief writes them (e.g. "Double Jab", not "Jab + Jab").
  var COMBOS = {
    '1': 'Jab',
    '2': 'Cross',
    '1+2': 'Jab + Cross',
    '1+1': 'Double Jab',
    '1+1+2': 'Double Jab + Cross',
    '1+2+1+2': 'Jab + Cross + Jab + Cross',
    '3': 'Left Hook',
    '1+2+3': 'Jab + Cross + Left Hook',
    '1+3': 'Jab + Left Hook',
    '1+1+3': 'Jab + Jab + Left Hook',
    '1+1+2+3': 'Jab + Jab + Cross + Left Hook',
    '1+4': 'Jab + Right Uppercut',
    '1+2+3+4': 'Jab + Cross + Left Hook + Right Uppercut',
    '3+7': 'Left Hook + Right Body Shot',
    '1+3+7': 'Jab + Left Hook + Right Body Shot',
    '1+1+7': 'Double Jab + Right Body Shot',
    '6+7': 'Left Body Shot + Right Body Shot',
    '6+7+6+7': 'Left Body Shot + Right Body Shot + Left Body Shot + Right Body Shot'
  };

  var BASICS = ['1', '2', '1+2', '1+1', '1+1+2', '1+2+1+2'];
  var HOOKS = ['3', '1+2+3', '1+3', '1+1+3', '1+1+2+3'];
  var UPPERS = ['1+4', '1+2+3+4'];
  var BODY = ['3+7', '1+3+7', '1+1+7', '6+7', '6+7+6+7'];

  // The single-round drills, in camp order. Jump Rope opens the circuit and
  // Heavy Bag closes it; both scale by phase.
  var SINGLES = [
    { key: 'pu', name: 'Pushups', icon: '💪' },
    { key: 'lr', name: 'Leg Raises', icon: '🦵' },
    { key: 'jj', name: 'Jumping Jacks', icon: '⭐' },
    { key: 'fk', name: 'Flutter + Scissor Kicks', icon: '✂️' },
    { key: 'bp', name: 'Burpees', icon: '💀' },
    { key: 'sb', name: 'Shadow Box', icon: '🥷' },
    { key: 'su', name: 'Slip Unders', icon: '🦆', sub: 'Walk the Line' }
  ];

  function drills(n) {
    var out = [{ key: 'jr', name: 'Jump Rope', icon: '🪢', rounds: n }];
    SINGLES.forEach(function (d) {
      out.push({ key: d.key, name: d.name, icon: d.icon, sub: d.sub, rounds: 1 });
    });
    out.push({ key: 'hb', name: 'Heavy Bag', icon: '🥊', rounds: n, combos: true });
    return out;
  }

  function situps(target) {
    return { key: 'sit', name: 'Sit-ups to Failure', icon: '🔥', unit: 'reps',
      target: target, note: 'Target ' + target + ' — then push past it' };
  }
  function run(lo, hi, label) {
    return { key: 'run', name: 'Run', icon: '🏃', unit: 'mi',
      range: [lo, hi], note: label };
  }

  var phases = [
    { id: 1, weeks: [1, 4], label: 'Foundation', rope: 3, bag: 3,
      drills: drills(3),
      bagRounds: [
        { add: BASICS },
        { add: HOOKS },
        { add: UPPERS }
      ],
      finishers: [situps(50)] },
    { id: 2, weeks: [5, 8], label: 'Build', rope: 4, bag: 4,
      drills: drills(4),
      bagRounds: [
        { add: BASICS },
        { add: HOOKS.concat(UPPERS) },
        { add: BODY },
        { same: 3 }
      ],
      finishers: [situps(75), run(0.5, 1, '½ – 1 mile')] },
    { id: 3, weeks: [9, 12], label: 'Fight Ready', rope: 5, bag: 5,
      drills: drills(5),
      bagRounds: [
        { add: BASICS },
        { add: HOOKS.concat(UPPERS) },
        { add: BODY },
        { same: 3, note: 'Full camp intensity' },
        { same: 3, note: 'Full camp intensity' }
      ],
      finishers: [situps(100), run(1, 2, '1 – 2 miles')] }
  ];

  /* Every combo for round r (1-based) of a phase, each marked new or carried.
     [{code, name, isNew}] — new first, in authored order, then carried. */
  function roundCombos(phase, r) {
    var rounds = phase.bagRounds;
    var spec = rounds[r - 1];
    if (!spec) return [];
    if (spec.same) {
      return roundCombos(phase, spec.same).map(function (c) {
        return { code: c.code, name: c.name, isNew: false };
      });
    }
    var carried = [];
    for (var i = 0; i < r - 1; i++) {
      (rounds[i].add || []).forEach(function (code) {
        if (carried.indexOf(code) < 0) carried.push(code);
      });
    }
    var out = [];
    spec.add.forEach(function (code) {
      if (carried.indexOf(code) < 0) out.push({ code: code, name: COMBOS[code] || code, isNew: true });
    });
    carried.forEach(function (code) {
      out.push({ code: code, name: COMBOS[code] || code, isNew: false });
    });
    return out;
  }

  function phaseById(id) {
    for (var i = 0; i < phases.length; i++) if (phases[i].id === id) return phases[i];
    return null;
  }

  var api = {
    WORK: WORK, REST: REST, PUNCHES: PUNCHES, COMBOS: COMBOS,
    phases: phases, roundCombos: roundCombos, phaseById: phaseById
  };
  if (typeof window !== 'undefined') window.MC_BOXING_CAMP = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
