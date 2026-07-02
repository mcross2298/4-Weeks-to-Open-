/* ==========================================================================
   mc-pm-data.js  —  single source of truth for program + badge display data
   --------------------------------------------------------------------------
   Consumed by BOTH the dashboard (its PROGS array) and PM Mode's Rename Center
   (program-manager.js). Previously this data was duplicated in three places
   (dashboard PROGS, program-manager PROG_DEFAULTS/PROG_ORDER, BADGE_DEFAULTS),
   each needing its own MARKET:STRIP markers — the duplication that let licensed
   brand terms leak into the public build.

   Now the licensed/influencer programs are wrapped in MARKET:STRIP in ONE
   place: tools/build-market.py drops them here, so the public build's
   dashboard and Rename Center both show only the flagship programs with no
   per-consumer markers to keep in sync.

   Loaded as a plain <script> on the dashboard (before its inline PROGS script)
   and dynamically by program-overrides.js on every other PM page.
   ========================================================================== */
(function () {
  if (window.MC_PM_DATA) return;

  // Full program objects (id, icon, name, meta, color, desc, href, splits) —
  // the dashboard uses every field; PM Mode uses name/icon/desc/splits.
  var programs = [
    { id: 'ss',   icon: '🏋️', name: 'Strength & Supersets',      meta: '6-Week Cycle · 5 Days', color: '#e11d48', desc: 'Heavy compounds paired with high-volume supersets + AMRAP finishers', href: 'cat-strength.html', splits: ['Legs', 'Chest', 'Back & Shoulders', 'Arms & Forearms', 'Cardio & Calves'] },
    { id: 'pmc',  icon: '⚡', name: 'Project Muscle Confusion',   meta: '7 Splits · 2 Weeks Each', color: '#7F77DD', desc: 'Supersets, pyramids, drop sets, AMRAP, and tempo', href: 'cat-pmc.html', splits: ['Split 1', 'Split 2', 'Split 3', 'Split 4', 'Split 5', 'Split 6', 'Split 7'] },
    { id: 'mc',   icon: '👑', name: "Mike Cross' Favorite Splits", meta: '5 Splits · 23 Workouts', color: '#d4af37', desc: '5 personal splits across every major training style', href: 'cat-mc.html', splits: ['Split 1', 'Split 2', 'Split 3', 'Split 4', 'Split 5'] },
    { id: 'ks',   icon: '🔥', name: 'Everything Under the Kitchen Sink', meta: '6 Splits · Station-Anchored', color: '#f59e0b', desc: 'Six distinct training splits under one roof — the complete MC arsenal, station-anchored for commercial gym efficiency.', href: 'cat-ks.html', splits: ['Everything Under the Kitchen Sink', 'Iron Engine', 'Split 3', 'Split 4', 'Split 5', 'Split 6'] },
    { id: 'mm',   icon: '⬡',  name: 'The Modality Matrix',            meta: '15 Weeks · 3 Phases · 4-Day Split',   color: '#6366f1', desc: 'Three phases, three modalities — dumbbell isolation, barbell strength, cable conditioning — one complete system.', href: 'cat-mm.html', splits: ['Phase 1 · Dumbbell', 'Phase 2 · Barbell', 'Phase 3 · Cable'] }
    /* MARKET:STRIP influencer-progs START */
    ,
    { id: 'stndr', icon: '🏋️', name: 'STNDR',         meta: '4 Programs',      color: '#1D9E75', desc: 'Structured progressive overload — CBUM method', href: 'cat-stndr.html', splits: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'] },
    { id: 'pump',  icon: '⚡', name: 'Daily Pump',     meta: '10 Workouts',     color: '#D85A30', desc: 'Julian Smith pump protocols — in and out fast', href: 'cat-pump-new4.html', splits: ['Back', 'Chest', 'Shoulders', 'Arms', 'Legs'] },
    { id: 'gainz', icon: '💪', name: 'Daily Gainz',    meta: '8 Programs',      color: '#378ADD', desc: 'Bradley Martyn volume — built for size', href: 'cat-gainz.html', splits: ['Bro Split', 'Push/Pull', '5 On 2 Off', '3 On 1 Off'] },
    { id: 'psu',   icon: '🏈', name: 'PSU Football',   meta: 'Strength Program', color: '#639922', desc: 'Penn State strength and conditioning', href: 'cat-psu.html', splits: ['Phase 1', 'Phase 2', 'Phase 3'] }
    /* MARKET:STRIP influencer-progs END */
  ];

  // Default badge labels keyed by stable id. "card" badges (tb-*) render on
  // workout cards; "legend" badges (lb-*) render in the cat-page key. Distinct
  // ids painted independently, so both are listed. No licensed content.
  var badges = {
    card: {
      'tb-superset': '⚡ Superset', 'tb-pyramid': '📈 Pyramid', 'tb-lowrep': '🏋️ Low Rep',
      'tb-tempo': '⏱️ Tempo', 'tb-highrep12': '🔥 12–15 Reps', 'tb-highrep20': '🔥 20–30 Reps',
      'tb-drop': '↘️ Drop Set', 'tb-amrap': '💀 AMRAP', 'tb-minrest': '⚡ 20s Rest',
      'tb-optional': '⭐ Optional', 'tb-finisher': '🏁 Finisher', 'tb-dumbbell': '🏋️ Dumbbell',
      'tb-cable': '🔗 Cable'
    },
    legend: {
      'lb-ss': '⚡ Superset', 'lb-py': '📈 Pyramid', 'lb-lr': '🏋️ Low Rep', 'lb-tm': '⏱️ Tempo',
      'lb-hr': '🔥 High Rep', 'lb-dr': '↘️ Drop Set', 'lb-am': '💀 AMRAP', 'lb-mr': '⚡ 20s Rest'
    }
  };

  var byId = {};
  for (var i = 0; i < programs.length; i++) byId[programs[i].id] = programs[i];

  window.MC_PM_DATA = {
    programs: programs,                                  // array, in display order
    program: function (id) { return byId[id] || null; }, // id → full object | null
    programOrder: programs.map(function (p) { return p.id; }),
    badges: badges
  };
})();
