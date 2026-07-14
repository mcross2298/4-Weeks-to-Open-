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

  // Full program objects (id, tier, icon, name, meta, color, desc, href, splits) —
  // the dashboard uses every field; PM Mode uses name/icon/desc/splits.
  //
  // `tier` drives which runtime list a program renders into on dashboard.html
  // (renderProgramCards(): 'flagship' -> #flagGrid + the Home-screen .prog-rail,
  // 'influencer' -> .influencer-grid only). `color` is each program's muted
  // brand hue as it actually renders in .cat-card/.rail-card today (confirmed
  // against dashboard.html's #scr-programs/#scr-dashboard CSS) — six flagship
  // entries below were still holding an older, more saturated value that had
  // drifted from the live render; this brings the data back in sync with
  // reality instead of the other way around. `desc` for seven entries below
  // was similarly a shorter, stale draft of the copy the card has actually
  // shown for a while — updated to match what's on screen.
  var programs = [
    { id: 'ss',   tier: 'flagship', icon: '🏋️', name: 'Strength & Supersets',      meta: '6-Week Cycle · 5 Days', color: '#c9505a', desc: 'Heavy low-rep compounds paired with high-volume supersets and AMRAP finishers for raw strength and size.', forWho: 'Intermediate+ lifters who want heavy compound strength paired with size-focused supersets, 5 days a week.', href: 'cat-strength.html', splits: ['Legs', 'Chest', 'Back & Shoulders', 'Arms & Forearms', 'Cardio & Calves'] },
    { id: 'pmc',  tier: 'flagship', icon: '⚡', name: 'Project Muscle Confusion',   meta: '7 Splits · 2 Weeks Each', color: '#8b7ff0', desc: 'Constantly varied supersets, pyramids, drop sets, AMRAP and tempo work that never lets your muscles adapt.', forWho: 'Lifters who get bored easily and want constant variety — a new stimulus every split, no two weeks alike.', href: 'cat-pmc.html', splits: ['Split 1', 'Split 2', 'Split 3', 'Split 4', 'Split 5', 'Split 6', 'Split 7'] },
    { id: 'mc',   tier: 'flagship', icon: '👑', name: "Mike Cross' Favorite Splits", meta: '5 Splits · 23 Workouts', color: '#d8b463', desc: "Mike's five personal splits spanning every major training style — the way he actually trains.", forWho: "Trainees who want a well-rounded sample of Mike's own go-to training styles across one program.", href: 'cat-mc.html', splits: ['Split 1', 'Split 2', 'Split 3', 'Split 4', 'Split 5'] },
    { id: 'ks',   tier: 'flagship', icon: '🔥', name: 'Everything Under the Kitchen Sink', meta: '6 Splits · Station-Anchored', color: '#e0a03c', desc: 'Six distinct training splits under one roof — the complete MC arsenal, station-anchored for commercial gym efficiency.', forWho: 'Commercial-gym lifters who want maximum split variety without hogging equipment — everything station-anchored.', href: 'cat-ks.html', splits: ['Everything Under the Kitchen Sink', 'Iron Engine', 'Split 3', 'Split 4', 'Split 5', 'Split 6'] },
    { id: 'mm',   tier: 'flagship', icon: '⬡',  name: 'The Modality Matrix',            meta: '15 Weeks · 3 Phases · 4-Day Split',   color: '#6f77e0', desc: 'Three phases, three modalities — dumbbell isolation, barbell strength, cable conditioning — one complete system.', forWho: 'Lifters committing to a longer block who want to master every major equipment modality in sequence.', href: 'cat-mm.html', splits: ['Phase 1 · Dumbbell', 'Phase 2 · Barbell', 'Phase 3 · Cable'] },
    { id: 'hv',   tier: 'flagship', icon: '💥', name: 'High-Volume Training Template',  meta: '4-Week Block · 5–6 Sets · 15–25 Reps', color: '#9fbf4a', desc: 'Compound-dominant into full supersets, into high-set pyramids, into bodyweight & accessory density — trisets banned throughout.', forWho: 'Lifters chasing hypertrophy through sheer volume — one 4-week block that escalates set density week by week.', href: 'cat-hv.html', splits: ['Week 1 · Compound Dominant', 'Week 2 · Fully Supersetted', 'Week 3 · High-Volume Pyramids', 'Week 4 · Bodyweight & Accessory'] }
    /* MARKET:STRIP influencer-progs START */
    ,
    { id: 'stndr', tier: 'influencer', icon: '🏋️', name: 'STNDR',         meta: '4 Programs',      color: '#1D9E75', desc: 'CBUM-style structured lifting built on progressive overload, supersets and smart periodization.', forWho: "Fans of CBUM's methodical, progressive-overload approach to classic bodybuilding.", href: 'cat-stndr.html', splits: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'] },
    { id: 'pump',  tier: 'influencer', icon: '⚡', name: 'Daily Pump',     meta: '10 Workouts',     color: '#D85A30', desc: 'Fast, high-rep isolation work that chases maximum pump and muscle fullness.', forWho: 'Lifters short on time who want a fast, pump-focused session rather than a max-effort grind.', href: 'cat-pump-new4.html', splits: ['Back', 'Chest', 'Shoulders', 'Arms', 'Legs'] },
    { id: 'gainz', tier: 'influencer', icon: '💪', name: 'Daily Gainz',    meta: '8 Programs',      color: '#378ADD', desc: 'Bradley Martyn volume training — daily builders engineered for steady, consistent size.', forWho: "Lifters who want Bradley Martyn's high-frequency, high-volume approach to steady size gains.", href: 'cat-gainz.html', splits: ['Bro Split', 'Push/Pull', '5 On 2 Off', '3 On 1 Off'], liveBadge: true },
    { id: 'psu',   tier: 'influencer', icon: '🏈', name: 'PSU Football',   meta: 'Strength Program', color: '#639922', desc: "Penn State's strength and conditioning system, built for real athletic performance.", forWho: 'Athletes who want a real collegiate strength & conditioning system, not a bodybuilding split.', href: 'cat-psu.html', splits: ['Phase 1', 'Phase 2', 'Phase 3'] }
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
      'tb-cable': '🔗 Cable', 'tb-barbell': '🏋️‍♂️ Barbell', 'tb-machine': '⚙️ Machine',
      'tb-smith': '🔧 Smith', 'tb-plate': '🔩 Plate-Loaded'
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
