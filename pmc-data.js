/* ==========================================================================
   pmc-data.js — the Project Muscle Confusion dataset, stored once
   --------------------------------------------------------------------------
   7 splits · 30 workouts · Weeks 1-2 as authored · Weeks 3-4 rotated.

   cat-pmc.html and pmc-workout.html each carried a byte-identical copy of
   everything below - 875 lines of prescription data plus the 134-line week-3/4
   resolution engine - with nothing enforcing that the two agreed (audit PG-6,
   PG-7). Two copies of an authored prescription is the drift shape this repo
   already has check-single-impl.js and gen-schedules.js for; the diff between
   them at the time of extraction was three comment lines, which is exactly how
   long a second copy stays honest.

   A file of this name existed before and was retired: it was a 918-line
   artifact that ZERO pages loaded while still riding the precache. This is not
   that file coming back. This one is loaded by both PMC pages and is the only
   copy of the data in the tree.

   The `file:` field on each workout is read by NO code path in the repository.
   24 of its 30 values named pages that do not exist and are removed here. The
   6 that resolve are kept as an accurate cross-reference - and they surface a
   real question left open: this unread field was the PMC hub's only inbound
   link to those six standalone pages, which otherwise reach each other in a
   chain nothing enters. `backUrl` is unread in the same way and is left alone,
   since only `file:` was in scope.

   Load order: after pmc-s7-data.js (split7 renders from PMC_S7 at render time,
   not at definition time, so this is convention rather than a hard dependency)
   and before the page's own inline script.
   ========================================================================== */
(function () {
  if (window.MC_PMC_DATA) return;

  const PMC_SPLITS = {
    'split1_legs': {
      id: 'split1_legs', file: 'pmc-legs-quad.html', split: 'Split 1',
      title: 'Leg Day — Quad Focus', icon: '🦵', color: '#4ade80', bg: '#052e16',
      backUrl: 'pmc-split1.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Quad Extensions',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · 2 sec pause · 1:0:1:2'},
       b:{name:'Romanian Deadlifts (Barbell or DB)**',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · feel the hamstring stretch'}},
      {type:'single',num:2,name:'Close Stance Barbell Squats or Goblet Squats**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · drive through heels'},
      {type:'single',num:3,name:'Quad Extensions',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up in weight · drop set on final set'},
      {type:'single',num:4,name:'Smith Machine Split Squats',sets:'4×10',badges:['tb-tempo'],note:'4 sec negative on descent · 4:0:1:0'},
      {type:'single',num:5,name:'Leg Press (feet shoulder width)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · moderate weight · full ROM · not a compound primary'},
      {type:'single',num:6,name:'Calf Raises',sets:'5×15',badges:['tb-highrep12'],note:'20+ reps · 2 sec pause at top · 1:0:1:2'},
      {type:'single',num:7,name:'Walking Lunges',sets:'100–200 reps',badges:['tb-optional'],note:'⭐ Optional finisher'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Leg Press (feet shoulder width)',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · 4 sec negative · 4:0:1:0'},
       b:{name:'Lying Hamstring Curl',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · 2 sec pause at peak'}},
      {type:'single',num:2,name:'Neutral Stance Barbell or Goblet Squats**',sets:'12,10,8,8 drop 12',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:3,name:'Cannonball Hack Squat or Leg Press (feet touching, heels elevated)**',sets:'4×6',badges:['tb-lowrep'],note:'Low rep · heavy · feet touching · heels elevated'},
      {type:'single',num:4,name:'Seated Leg Extension',sets:'4×12',badges:['tb-tempo'],note:'4 sec negatives · 4:0:1:0 · slow and controlled'},
      {type:'single',num:5,name:'Seated Hamstring Curl',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at peak · 1:0:1:2'},
      {type:'single',num:6,name:'Calf Raises',sets:'5×15',badges:['tb-highrep12'],note:'20+ reps · 2 sec pause at top · 1:0:1:2'},
      {type:'single',num:7,name:'Walking Lunges',sets:'100–200 reps',badges:['tb-optional'],note:'⭐ Optional finisher'},
    ]
  },
    },

    'split1_back': {
      id: 'split1_back', file: 'pmc-back.html', split: 'Split 1',
      title: 'Back', icon: '🔙', color: '#22d3ee', bg: '#042f2e',
      backUrl: 'pmc-split1.html', type: 'standard',
      data: {
    1:{warmup:true, exercises:[
      {type:'superset',num:1,
       a:{name:'Wide Grip Lat Pulldown',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · full stretch at top'},
       b:{name:'Seated Cable Row (close V grip)',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · squeeze at peak'}},
      {type:'single',num:2,name:'Barbell Pendlay Rows',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · explosive pull · reset each rep'},
      {type:'single',num:3,name:'Machine Low Row',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Incline DB Row (bilateral)',sets:'4×12',badges:['tb-tempo'],note:'2 sec pause at top · 1:0:1:2 · bilateral hold'},
      {type:'single',num:5,name:'Straight Arm Lat Pulldown (cable)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · constant tension · no lockout · bilateral'},
      {type:'single',num:6,name:'Machine High Row',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · lean back slightly · machine pull'},
      {type:'single',num:7,name:'Cable Shrug (bilateral)',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · squeeze at top · 1:0:1:2'},
    ]},
    2:{warmup:true, exercises:[
      {type:'superset',num:1,
       a:{name:'Reverse Grip Lat Pulldown',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · underhand grip'},
       b:{name:'Wide Grip Seated Cable Row',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · 2 sec pause at peak'}},
      {type:'single',num:2,name:'Barbell Pendlay or Bent Over Row**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · drive elbows back'},
      {type:'single',num:3,name:'Wide Grip Lat Pulldown',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'V Grip Lat Pulldown',sets:'4×10',badges:['tb-tempo'],note:'4 sec negatives · 4:0:1:0 · slow controlled pull'},
      {type:'single',num:5,name:'Straight Arm Lat Pulldown (cable)',sets:'5×20',badges:['tb-highrep20'],note:'20 reps · constant tension · no lockout'},
      {type:'single',num:6,name:'Machine Mid Row',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · bilateral pull · squeeze at peak'},
      {type:'single',num:7,name:'Barbell Shrug (wide grip)',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · hold at top · 1:0:1:2'},
    ]}
  },
    },

    'split1_chest': {
      id: 'split1_chest', file: 'pmc-chest-shoulders.html', split: 'Split 1',
      title: 'Chest & Shoulders', icon: '💪', color: '#c084fc', bg: '#1e1040',
      backUrl: 'pmc-split1.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'High Incline DB Flies',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · full stretch at bottom'},
       b:{name:'Side Lateral Raises',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · squeeze at top'}},
      {type:'single',num:2,name:'Incline Barbell or DB Press**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy compound · drive the bar'},
      {type:'single',num:3,name:'Flat Machine Chest Press',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Slight Incline DB Press',sets:'4×12',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:5,name:'Pec Deck Fly Machine',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at peak · machine not compound'},
      {type:'single',num:6,name:'Reverse Pec Deck (Rear Delts)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · squeeze rear delt at peak · 1:0:1:2'},
      {type:'single',num:7,name:'Cable Upright Row',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · 2 sec pause at top · bilateral cable'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'High Incline DB Flies',sets:'4×12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 2 sec pause at stretch · 1:2:1:2'},
       b:{name:'Seated DB Side Lateral',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · constant tension'}},
      {type:'single',num:2,name:'Slight Incline DB Press',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set final set'},
      {type:'single',num:3,name:'Incline Barbell or DB Press**',sets:'4×6',badges:['tb-lowrep'],note:'Low rep · 4 sec negatives · 4:0:1:0'},
      {type:'single',num:4,name:'Flat Machine Chest Press',sets:'4×12',badges:['tb-tempo'],note:'3 sec negatives · 4:0:1:0 · controlled'},
      {type:'single',num:5,name:'Pec Deck Fly Machine',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at peak squeeze'},
      {type:'single',num:6,name:'Reverse Pec Deck',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · rear delt pump · 1:0:1:2'},
      {type:'single',num:7,name:'Cable Lateral Raise (bilateral)',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · bilateral cable · squeeze at top'},
    ]
  },
    },

    'split1_bistris': {
      id: 'split1_bistris', file: 'pmc-bis-tris.html', split: 'Split 1',
      title: 'Bis & Tris', icon: '💪', color: '#f472b6', bg: '#2d0a1e',
      backUrl: 'pmc-split1.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Double Arm DB Curls',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · full supination at top'},
       b:{name:'Tricep Dip Machine',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · full ROM'}},
      {type:'single',num:2,name:'Barbell Curls (close grip)',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · strong bicep contraction'},
      {type:'single',num:3,name:'Machine Preacher Curl',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Skull Crushers (Barbell or EZ-Bar)',sets:'4×10',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:5,name:'Tricep Rope Pushdowns',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · bilateral rope · constant tension · squeeze at bottom'},
      {type:'single',num:6,name:'Cable Curl (bilateral W-bar)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · W-bar · both arms · constant tension'},
      {type:'single',num:7,name:'Preacher Curl Machine',sets:'5×12',badges:['tb-minrest'],note:'5 sets · 20 sec rest between sets'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Incline DB Curl (bilateral)',sets:'4×12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · both arms together · 12 reps'},
       b:{name:'Overhead Tricep Rope Extension (bilateral)',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · both arms · 12–15 reps'}},
      {type:'single',num:2,name:'Barbell Curls (wide grip)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · 3 sec negatives · drop set final set · 4:0:1:0'},
      {type:'single',num:3,name:'Smith Machine Close Grip Bench',sets:'4×6',badges:['tb-lowrep'],note:'Low rep · heavy · tricep emphasis'},
      {type:'single',num:4,name:'Machine Preacher Curl',sets:'4×10',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:5,name:'Tricep V-Bar Pushdowns',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · bilateral · squeeze fully at bottom'},
      {type:'single',num:6,name:'Cable Curl (bilateral EZ-bar)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · EZ-bar · both arms together'},
      {type:'single',num:7,name:'Skull Crushers',sets:'5×10',badges:['tb-minrest'],note:'5 sets · 20 sec rest between sets'},
    ]
  },
    },

    'split1_leghams': {
      id: 'split1_leghams', file: 'pmc-legs-hams.html', split: 'Split 1',
      title: 'Leg Day — Ham Focus', icon: '🦵', color: '#34d399', bg: '#052e1a',
      backUrl: 'pmc-split1.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Lying Hamstring Curl',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · 2 sec pause at peak'},
       b:{name:'Leg Extension',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · squeeze at full extension'}},
      {type:'single',num:2,name:'Barbell or DB RDL (bilateral)**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy bilateral · drive hips back'},
      {type:'single',num:3,name:'Seated Hamstring Curl',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Barbell Good Mornings',sets:'4×10',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0 · hip hinge focus'},
      {type:'single',num:5,name:'Glute Bridge Machine or Hip Thrust Machine',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · machine variation · not barbell compound · squeeze glutes'},
      {type:'single',num:6,name:'Leg Press (feet high and wide)',sets:'4×20',badges:['tb-highrep12'],note:'12-15 reps · high/wide position · glute/ham emphasis'},
      {type:'single',num:7,name:'Walking Lunges',sets:'100–200 reps',badges:['tb-optional'],note:'⭐ Optional finisher'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Seated Hamstring Curl',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · 2 sec pause at peak'},
       b:{name:'Leg Extension',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · squeeze at top'}},
      {type:'single',num:2,name:'Barbell RDL or Conventional Deadlift**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy bilateral compound'},
      {type:'single',num:3,name:'Lying Hamstring Curl',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Barbell Good Mornings',sets:'4×10',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:5,name:'Glute Bridge Machine or Hip Thrust Machine',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · machine variation · squeeze fully at top'},
      {type:'single',num:6,name:'Leg Press (feet high and wide)',sets:'4×15',badges:['tb-highrep12'],note:'12-15 reps · posterior chain emphasis'},
      {type:'single',num:7,name:'Walking Lunges',sets:'100–200 reps',badges:['tb-optional'],note:'⭐ Optional finisher'},
    ]
  },
    },

    'split2_legs': {
      id: 'split2_legs', split: 'Split 2',
      title: 'Leg Day — Quad Focus', icon: '🦵', color: '#4ade80', bg: '#052e16',
      backUrl: 'pmc-split2.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Leg Extension',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · squeeze at top'},
       b:{name:'Lying Hamstring Curl',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · 2 sec pause at peak'}},
      {type:'single',num:2,name:'Neutral Stance Barbell or DB Squat**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy compound · full depth'},
      {type:'single',num:3,name:'Close Stance Cannonball Leg Press (heels elevated)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · feet touching · heels elevated · drop set final set'},
      {type:'single',num:4,name:'Smith Machine Split Squat',sets:'4×10',badges:['tb-tempo'],note:'3 sec negative on descent · 4:0:1:0'},
      {type:'single',num:5,name:'Leg Press (feet shoulder width)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · full ROM · not a primary compound position'},
      {type:'single',num:6,name:'Seated Hamstring Curl',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · 2 sec pause at peak · 1:0:1:2'},
      {type:'single',num:7,name:'Calf Raises',sets:'5×15',badges:['tb-highrep12'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
      {type:'single',num:8,name:'Walking Lunges',sets:'100–200 reps',badges:['tb-optional'],note:'⭐ Optional finisher'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Seated Hamstring Curl',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · 2 sec pause at peak'},
       b:{name:'Leg Extension',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · squeeze at full extension'}},
      {type:'single',num:2,name:'Close Stance Barbell or Goblet Squat (heels elevated)**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · heels elevated on plate'},
      {type:'single',num:3,name:'Neutral Stance Leg Press',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Goblet Squat (heels elevated)',sets:'4×12',badges:['tb-tempo'],note:'4 sec negative · 4:0:1:0 · heels elevated · upright torso'},
      {type:'single',num:5,name:'Leg Extension',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · 3 sec negative · constant tension'},
      {type:'single',num:6,name:'Lying Hamstring Curl',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · 2 sec pause at peak · 1:0:1:2'},
      {type:'single',num:7,name:'Calf Raises',sets:'5×15',badges:['tb-highrep12'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
      {type:'single',num:8,name:'Walking Lunges',sets:'100–200 reps',badges:['tb-optional'],note:'⭐ Optional finisher'},
    ]
  },
    },

    'split2_chest': {
      id: 'split2_chest', split: 'Split 2',
      title: 'Chest & Biceps', icon: '💪', color: '#c084fc', bg: '#1e1040',
      backUrl: 'pmc-split2.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Slight Incline DB Flies',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · Pyramid up in weight'},
       b:{name:'Double Arm Hammer Curls',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset B · Pyramid — match flies cadence'}},
      {type:'single',num:2,name:'Flat Barbell or DB Press**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy compound'},
      {type:'single',num:3,name:'Incline Machine Chest Press',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set · not free weight compound'},
      {type:'single',num:4,name:'High Incline DB Press',sets:'4×12',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0 · 12–15 rep range'},
      {type:'single',num:5,name:'Pec Deck Fly Machine',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at peak · machine not compound'},
      {type:'single',num:6,name:'Cable Curl (bilateral W-bar)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · W-bar · both arms · constant tension'},
      {type:'single',num:7,name:'Machine Preacher Curl',sets:'5×12',badges:['tb-highrep12','tb-minrest'],note:'12 reps · 5 sets · 20 sec rest between sets'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Incline Machine Chest Press',sets:'4×12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12 reps · 2 sec pause at bottom'},
       b:{name:'Incline DB Curl (bilateral)',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset B · Pyramid set · both arms together'}},
      {type:'single',num:2,name:'High Incline Barbell or DB Press**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · 2 sec pause at bottom'},
      {type:'single',num:3,name:'Flat Machine Press',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Slight Incline DB Press',sets:'4×10',badges:['tb-tempo'],note:'4 sec negatives · 4:0:1:0 · controlled descent'},
      {type:'single',num:5,name:'Pec Deck Fly Machine',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · machine · 2 sec pause at squeeze'},
      {type:'single',num:6,name:'Cable Curl (bilateral EZ-bar)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · EZ-bar · both arms · constant tension'},
      {type:'single',num:7,name:'Barbell Curls',sets:'5×12',badges:['tb-highrep12','tb-minrest'],note:'12 reps · 5 sets · 20 sec rest between sets'},
    ]
  },
    },

    'split2_back': {
      id: 'split2_back', split: 'Split 2',
      title: 'Back', icon: '🔙', color: '#22d3ee', bg: '#042f2e',
      backUrl: 'pmc-split2.html', type: 'standard',
      data: {
    1:{warmup:true, exercises:[
      {type:'superset',num:1,
       a:{name:'Wide Grip Lat Pulldown',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · full stretch at top'},
       b:{name:'Straight Arm Lat Pulldown (cable)',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · constant tension'}},
      {type:'single',num:2,name:'Barbell Pendlay Rows',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · explosive pull · reset each rep'},
      {type:'single',num:3,name:'Machine Low Row',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Incline DB Row (bilateral)',sets:'4×12',badges:['tb-tempo'],note:'2 sec pause at top · 1:0:1:2 · both arms together'},
      {type:'single',num:5,name:'Machine High Row',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · bilateral machine pull · lean back slightly'},
      {type:'single',num:6,name:'Seated Cable Row (bilateral, wide grip)',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · wide bilateral grip · squeeze at peak'},
      {type:'single',num:7,name:'Cable Shrug (bilateral)',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · squeeze and hold at top · 1:0:1:2'},
    ]},
    2:{warmup:true, exercises:[
      {type:'superset',num:1,
       a:{name:'Reverse Grip Lat Pulldown',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · underhand grip'},
       b:{name:'Machine High Row',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · lean back slightly'}},
      {type:'single',num:2,name:'Barbell Bent Over Row',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · drive elbows back hard'},
      {type:'single',num:3,name:'Close Grip Barbell Shrug',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Wide Grip Lat Pulldown',sets:'4×10',badges:['tb-tempo'],note:'4 sec negatives · 4:0:1:0 · slow controlled pull'},
      {type:'single',num:5,name:'Seated Cable Row (bilateral, close grip)',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · 2 sec pause at peak · bilateral'},
      {type:'single',num:6,name:'Straight Arm Lat Pulldown (cable)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · constant tension · bilateral cable'},
      {type:'single',num:7,name:'Machine Shrug',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · squeeze at top · 1:0:1:2'},
    ]}
  },
    },

    'split2_cst': {
      id: 'split2_cst', split: 'Split 2',
      title: 'Calves, Shoulders & Tris', icon: '💪', color: '#fb923c', bg: '#2d1500',
      backUrl: 'pmc-split2.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Pec Deck Fly Machine',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · 2 sec pause at peak'},
       b:{name:'Reverse Pec Deck (Rear Delts)',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · squeeze rear delt at peak'}},
      {type:'single',num:2,name:'Close Grip Barbell or DB Press**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · tricep emphasis'},
      {type:'single',num:3,name:'Incline Machine Press',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'High Incline DB or Barbell Press**',sets:'4×10',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:5,name:'Tricep Rope Pushdowns (bilateral)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · bilateral rope · constant tension · squeeze at bottom'},
      {type:'single',num:6,name:'Cable Upright Row (bilateral)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · bilateral cable · 2 sec pause at top'},
      {type:'single',num:7,name:'V Grip Tricep Pushdown (bilateral)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · bilateral V grip · squeeze fully at bottom'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Pec Deck Machine',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · Pyramid · 2 sec pause at peak squeeze'},
       b:{name:'Reverse Pec Deck Fly',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · rear delt focus'}},
      {type:'single',num:2,name:'Flat Barbell or DB Press**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · strong chest drive'},
      {type:'single',num:3,name:'Incline Machine Press',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'DB Hammer Incline Press',sets:'4×12',badges:['tb-tempo'],note:'4 sec negatives · 4:0:1:0 · neutral grip'},
      {type:'single',num:5,name:'Tricep Rope Pushdown (bilateral)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · bilateral rope · constant tension'},
      {type:'single',num:6,name:'Reverse Grip Tricep Pushdown (bilateral)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · underhand bilateral grip · squeeze at bottom'},
      {type:'single',num:7,name:'Cable Lateral Raise (bilateral)',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · bilateral cable · not single arm'},
    ]
  },
    },

    'split2_legs2': {
      id: 'split2_legs2', split: 'Split 2',
      title: 'Leg Day 2', icon: '🦵', color: '#34d399', bg: '#052e1a',
      backUrl: 'pmc-split2.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Leg Extension',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · squeeze at top'},
       b:{name:'Lying Hamstring Curl',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · 2 sec pause at peak'}},
      {type:'single',num:2,name:'Wide Stance Goblet or Barbell Squat [COMPOUND SUB]**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · sub DB if needed'},
      {type:'single',num:3,name:'Leg Press (wide stance, feet high)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · glute/ham emphasis · drop set final set'},
      {type:'single',num:4,name:'Barbell Good Mornings',sets:'4×10',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0 · hip hinge focus'},
      {type:'single',num:5,name:'Seated Hamstring Curl',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at peak · not single leg'},
      {type:'single',num:6,name:'Leg Press (bilateral, feet shoulder width)',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · bilateral · full ROM'},
      {type:'single',num:7,name:'Calf Raises',sets:'5×15',badges:['tb-highrep12'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
      {type:'single',num:8,name:'Walking Lunges',sets:'200 reps',badges:['tb-finisher'],note:'🏁 Finisher'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Seated Hamstring Curl',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · 2 sec pause at peak'},
       b:{name:'Leg Extension',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · squeeze at full extension'}},
      {type:'single',num:2,name:'Wide or Neutral Stance Barbell Squat [COMPOUND SUB]**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · sub DB if needed'},
      {type:'single',num:3,name:'Leg Press (bilateral, wide stance)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Barbell Good Mornings',sets:'4×10',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:5,name:'Lying Hamstring Curl',sets:'4×20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at peak · bilateral machine'},
      {type:'single',num:6,name:'Leg Extension',sets:'4×15',badges:['tb-highrep12'],note:'12–15 reps · 3 sec negative · bilateral'},
      {type:'single',num:7,name:'Calf Raises',sets:'5×15',badges:['tb-highrep12'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
      {type:'single',num:8,name:'Walking Lunges',sets:'100–200 reps',badges:['tb-finisher'],note:'🏁 Finisher'},
    ]
  },
    },

    'split3_back': {
      id: 'split3_back', split: 'Split 3',
      title: 'Back', icon: '🔙', color: '#22d3ee', bg: '#042f2e',
      backUrl: 'pmc-split3.html', type: 'standard',
      data: {
    1:{warmup:true,exercises:[
      {type:'single',num:1,name:'Barbell Row',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up — increase weight each set'},
      {type:'single',num:2,name:'Wide Grip Barbell Shrugs',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · squeeze at top'},
      {type:'superset',num:3,
       a:{name:'V Grip Pulldowns',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sec pause at bottom · 1:0:1:2'},
       b:{name:'Reverse Pec Deck Fly',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · rear delt squeeze'}},
      {type:'single',num:4,name:'Reverse Grip Pulldowns',sets:'4x12',badges:['tb-tempo'],note:'4 sec negatives · 4:0:1:0'},
      {type:'single',num:5,name:'Straight Arm Lat Pulldown',sets:'4x25',badges:['tb-highrep20'],note:'20-30 rep range · constant tension · bilateral cable'},
      {type:'single',num:6,name:'High Incline DB Row',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:7,name:'Seated Cable Row (wide grip)',sets:'5x12',badges:['tb-minrest'],note:'5-6 sets · 20 sec rest between sets'},
    ]},
    2:{warmup:true,exercises:[
      {type:'single',num:1,name:'Pendlay Rows (wide grip)',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · explosive pull · reset each rep'},
      {type:'superset',num:2,
       a:{name:'Rope Attachment Pulldowns',sets:'12,10,8,8 drop 15',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset A · pyramid up · drop set final set'},
       b:{name:'Straight Arm Lat Pulldowns',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · constant tension'}},
      {type:'single',num:3,name:'Wide Grip Cable Row',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at peak · 1:0:1:2'},
      {type:'single',num:4,name:'Close Grip Barbell Shrugs',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:5,name:'Standing Double Arm Row',sets:'4x20',badges:['tb-highrep20'],note:'20-30 rep range · bilateral · squeeze at peak'},
      {type:'single',num:6,name:'T-Bar Row',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at peak · 1:0:1:2'},
      {type:'single',num:7,name:'Machine High Row',sets:'4x15',badges:['tb-highrep12'],note:'12-15 reps · bilateral machine pull'},
    ]}
  },
    },

    'split3_legs': {
      id: 'split3_legs', split: 'Split 3',
      title: 'Legs', icon: '🦵', color: '#4ade80', bg: '#052e16',
      backUrl: 'pmc-split3.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Quad Extensions',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 4 sec negatives · 4:0:1:0'},
       b:{name:'B-Stance DB RDLs',sets:'4x12 each',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · hinge and hold'}},
      {type:'single',num:2,name:'Barbell or DB Squats (shoulder width or cannonball)',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · increase weight each set'},
      {type:'single',num:3,name:'Deadlifts or Barbell RDLs',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy bilateral compound'},
      {type:'single',num:4,name:'Leg Press',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:5,name:'Barbell Good Mornings',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:6,name:'Weighted Walking Lunges',sets:'5x12 drop 15BW',badges:['tb-highrep12'],note:'12-15 reps weighted · drop set: 15 bodyweight lunges after each set'},
      {type:'single',num:7,name:'Quad Extension Finisher',sets:'5x20',badges:['tb-highrep20','tb-minrest'],note:'20-30 reps · 5-6 sets · 20 sec rest between sets'},
    ],
    2:[
      {type:'single',num:1,name:'Goblet Squats (shoulder width, 1.5 reps)',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · full rep + half rep = 1 · heels elevated'},
      {type:'single',num:2,name:'Hack Squat (shoulder width)',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · full ROM'},
      {type:'single',num:3,name:'Deadlifts or Barbell RDLs',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy bilateral'},
      {type:'single',num:4,name:'Leg Press (high and wide, pyramid)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · high and wide foot position · drop set final set'},
      {type:'superset',num:5,
       a:{name:'Barbell Good Mornings',sets:'4x10',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sec pause at bottom · 1:2:1:0'},
       b:{name:'Cannonball Squats',sets:'3xfailure',badges:['tb-superset','tb-amrap'],note:'⚡ Superset B · 3 sets to failure · feet touching heels elevated'}},
      {type:'single',num:6,name:'Calf Raises',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
      {type:'single',num:7,name:'Walking Lunges',sets:'100-200 reps',badges:['tb-optional'],note:'⭐ Optional finisher'},
    ]
  },
    },

    'split3_chest': {
      id: 'split3_chest', split: 'Split 3',
      title: 'Chest', icon: '💪', color: '#c084fc', bg: '#1e1040',
      backUrl: 'pmc-split3.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Weighted Push-Ups or Push-Ups',sets:'4x12',badges:['tb-tempo'],note:'3-4 sec negatives · 4:0:1:0 · full ROM'},
      {type:'single',num:2,name:'Flat Barbell Bench (1-1/4 reps)',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · full rep + quarter rep at bottom = 1 rep'},
      {type:'single',num:3,name:'Decline or Incline Barbell or DB Bench',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Slight Incline DB Hammer Press',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · neutral grip · full ROM'},
      {type:'single',num:5,name:'Chest Fly Machine (pronated grip)',sets:'12,10,8,8 drop 20',badges:['tb-pyramid','tb-drop'],note:'2 sec pause at peak · drop to neutral grip 20 reps · 1:2:1:0'},
      {type:'superset',num:6,
       a:{name:'Floor Press',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · elbows stop at floor'},
       b:{name:'DB Chest Flies',sets:'4x8',badges:['tb-superset','tb-tempo'],note:'⚡ Superset B · 5-10 sec stretch hold · 5-8 reps · feel the eccentric'}},
      {type:'single',num:7,name:'Standing Plate Press Finisher',sets:'3xfailure',badges:['tb-amrap'],note:'3-4 sets to failure · squeeze plates together throughout'},
    ],
    2:[
      {type:'single',num:1,name:'Deficit Push-Ups',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0 · hands on plates or DB handles'},
      {type:'single',num:2,name:'Barbell Bench',sets:'12,10,8,8',badges:['tb-pyramid','tb-tempo'],note:'Pyramid up · 2 sec pause at bottom each rep · 1:2:1:0'},
      {type:'single',num:3,name:'Slight Incline DB Bench',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · slight incline'},
      {type:'single',num:4,name:'DB Floor Press',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · elbows stop at floor · full pause'},
      {type:'superset',num:5,
       a:{name:'DB Chest Flies (pronated grip)',sets:'12,10,8,8 drop 15',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset A · pyramid · drop set final set'},
       b:{name:'Incline Cable Flies',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · constant cable tension · squeeze at peak'}},
      {type:'single',num:6,name:'Incline or Decline Chest Press Machine',sets:'4x15',badges:['tb-highrep12'],note:'12-15 reps · bilateral machine · squeeze at top'},
    ]
  },
    },

    'split3_shoulders': {
      id: 'split3_shoulders', split: 'Split 3',
      title: 'Shoulders & Tris', icon: '💪', color: '#fb923c', bg: '#2d1500',
      backUrl: 'pmc-split3.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Barbell or DB Shoulder Press',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy compound press'},
      {type:'single',num:2,name:'Cable Tricep Crossover',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral cables · squeeze at bottom'},
      {type:'superset',num:3,
       a:{name:'Seated Side Lateral Raises (1/4-1/2 reps)',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · partial range lateral emphasis'},
       b:{name:'Skull Crushers',sets:'12,10,8,8 drop 12',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset B · pyramid up · drop set on final set'}},
      {type:'superset',num:4,
       a:{name:'Pelican Raises',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sec pause at top · 1:0:1:2'},
       b:{name:'Cross Chest Lying DB Tricep Extension',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · extend across to opposite shoulder'}},
      {type:'superset',num:5,
       a:{name:'Standing DB Shrugs',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset A · 20 reps · 2 sec pause at top · 1:0:1:2'},
       b:{name:'Rope Pushdowns',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · 2 sec pause at bottom · 1:0:1:2'}},
    ],
    2:[
      {type:'single',num:1,name:'Arnold Press',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · full rotation'},
      {type:'superset',num:2,
       a:{name:'Seated Side Lateral Raises',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 2 sec pause at top'},
       b:{name:'Double Arm Lying Tricep Extension',sets:'12,10,8,8 drop 12',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset B · pyramid up · drop set final set'}},
      {type:'superset',num:3,
       a:{name:'Barbell Incline Face Pulls',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · rear delt focus'},
       b:{name:'Slight Incline Skull Crushers',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset B · 2 sec pause at bottom · 1:2:1:0'}},
      {type:'superset',num:4,
       a:{name:'Barbell Upright Row',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · elbows drive up'},
       b:{name:'Reverse Grip Pushdowns',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · underhand bilateral grip'}},
      {type:'single',num:5,name:'Rope Tricep Pulldowns',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral rope · constant tension'},
    ]
  },
    },

    'split3_back2': {
      id: 'split3_back2', split: 'Split 3',
      title: 'Back, Bis & Forearms', icon: '🔙', color: '#22d3ee', bg: '#042f2e',
      backUrl: 'pmc-split3.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Wide Grip Lat Pulldowns',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · full stretch at top'},
      {type:'single',num:2,name:'Pinwheel Curls',sets:'12,10,8,8 drop 12',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'superset',num:3,
       a:{name:'Double Arm DB Incline Row',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 2 sec pause at top'},
       b:{name:'Spider Curls',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · squeeze at peak contraction'}},
      {type:'single',num:4,name:'Reverse Barbell Curls',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · pronated grip · forearm activation'},
      {type:'superset',num:5,
       a:{name:'Barbell Curls (2 close grip / 2 wide grip)',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sets close / 2 sets wide · 2 sec pause · 1:0:1:2'},
       b:{name:'Kneeling Reverse Forearm Curls (bench supported)',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · 2 sec pause at top · 1:0:1:2'}},
      {type:'single',num:6,name:'Bench Supported Kneeling Forearm Curl',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · squeeze forearms at top'},
    ],
    2:[
      {type:'single',num:1,name:'Straight Arm Lat Pulldowns',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · bilateral cable · constant tension'},
      {type:'single',num:2,name:'Wide Grip Lat Pulldown',sets:'12,10,8,8 drop 12',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'superset',num:3,
       a:{name:'Double Arm DB Slight Incline Row',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · slight incline'},
       b:{name:'Pinwheel Curls',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · alternate arms'}},
      {type:'single',num:4,name:'Spider Curls',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at peak contraction · 1:0:1:2'},
      {type:'superset',num:5,
       a:{name:'Barbell Curls (2 close grip / 2 wide grip)',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sets each grip · 2 sec pause · 1:0:1:2'},
       b:{name:'Kneeling Reverse Forearm Curls (bench supported)',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · 2 sec pause · 1:0:1:2'}},
      {type:'single',num:6,name:'Bench Supported Kneeling Forearm Curl',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
    ]
  },
    },

    'split4_legsback': {
      id: 'split4_legsback', split: 'Split 4',
      title: 'Legs & Back', icon: '🦵', color: '#4ade80', bg: '#052e16',
      backUrl: 'pmc-split4.html', type: 'standard',
      data: {
    1:{warmup:true,exercises:[
      {type:'superset',num:1,
       a:{name:'Barbell Good Mornings',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sec pause at bottom · 1:2:1:0'},
       b:{name:'Double Arm DB Row',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · squeeze at peak'}},
      {type:'single',num:2,name:'Barbell Row',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at peak · 1:0:1:2'},
      {type:'single',num:3,name:'Hack Squat or Goblet Squat (neutral stance)',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · neutral stance'},
      {type:'superset',num:4,
       a:{name:'V-Grip Lat Pulldowns',sets:'12,10,8,8 drop 15',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset A · pyramid up · drop set final set'},
       b:{name:'Barbell Squats (wide stance)',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · wide stance · controlled descent'}},
      {type:'single',num:5,name:'Walking Lunges',sets:'100-200 reps',badges:['tb-finisher'],note:'🏁 Finisher — loaded if possible'},
    ]},
    2:{warmup:true,exercises:[
      {type:'superset',num:1,
       a:{name:'Goblet Squats (cannonball, 1.5 reps)',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · full + half rep · heels elevated'},
       b:{name:'Wide Grip Lat Pulldowns',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · full stretch at top'}},
      {type:'superset',num:2,
       a:{name:'Wide Grip Pendlay Rows',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · pyramid up · explosive pull'},
       b:{name:'Barbell RDLs',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset B · 3 sec negative · 4:0:1:0'}},
      {type:'single',num:3,name:'Hack Squat or Leg Press (feet touching, pyramid)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:4,name:'Single Arm DB Row',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at top · 1:0:1:2 · brace core'},
      {type:'single',num:5,name:'Quad Extension',sets:'12,10,8,8 drop 20',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop to 20 reps · squeeze at extension'},
      {type:'single',num:6,name:'Barbell Shrugs',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · squeeze at top'},
    ]}
  },
    },

    'split4_chesttris': {
      id: 'split4_chesttris', split: 'Split 4',
      title: 'Chest & Tris', icon: '💪', color: '#c084fc', bg: '#1e1040',
      backUrl: 'pmc-split4.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Diamond Push-Ups',sets:'3xfailure',badges:['tb-amrap'],note:'3 sets to failure · tricep emphasis'},
      {type:'single',num:2,name:'Dips or Weighted Dips',sets:'4xfailure',badges:['tb-amrap'],note:'4 sets to failure · lean slightly forward for chest'},
      {type:'single',num:3,name:'Barbell or Smith Machine Bench (1.5 reps)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · full + quarter rep at bottom = 1 · drop set final set'},
      {type:'single',num:4,name:'Barbell or Smith Machine Bench',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · 2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:5,name:'Barbell Skull Crushers',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'superset',num:6,
       a:{name:'Close Grip DB Press (DBs touching)',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · pyramid up · DBs touching throughout'},
       b:{name:'Tricep Extension Machine',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · bilateral machine · squeeze at bottom'}},
      {type:'single',num:7,name:'Cable Decline or Incline Flies',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral cable · constant tension · squeeze at peak'},
    ],
    2:[
      {type:'single',num:1,name:'Barbell Close Grip Bench',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · tricep dominant'},
      {type:'single',num:2,name:'High Incline DB Bench',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0'},
      {type:'single',num:3,name:'Barbell Bench (underhand grip)',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · reverse grip · lower chest emphasis'},
      {type:'single',num:4,name:'Barbell Skull Crushers',sets:'12,10,8,8 drop 12',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'superset',num:5,
       a:{name:'Pec Deck Flies (pronated grip)',sets:'12,10,8,8 drop 15',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset A · pyramid up · drop set final set'},
       b:{name:'Machine Tricep Extension',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · bilateral machine · squeeze at bottom'}},
      {type:'superset',num:6,
       a:{name:'Incline or Decline Chest Press Machine',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · bilateral machine'},
       b:{name:'Neutral Grip Tricep Pushdowns',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · 2 sec pause at bottom · 1:0:1:2'}},
    ]
  },
    },

    'split4_shoulders': {
      id: 'split4_shoulders', split: 'Split 4',
      title: 'Shoulders', icon: '💪', color: '#fb923c', bg: '#2d1500',
      backUrl: 'pmc-split4.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Seated Side Lateral Raises',sets:'4x15',badges:['tb-highrep12'],note:'12-15 reps · slow controlled · squeeze at top'},
      {type:'single',num:2,name:'Seated DB Shrugs',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · 2 sec squeeze at top'},
      {type:'superset',num:3,
       a:{name:'Reverse Pec Deck',sets:'12,10,8,8 drop 12',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset A · pyramid up · drop set final set'},
       b:{name:'Supermans',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · full extension hold at top'}},
      {type:'superset',num:4,
       a:{name:'Incline Bench Barbell Front Raises',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sec pause at top · 1:0:1:2'},
       b:{name:'Palms Facing Shoulder Press',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · neutral grip press'}},
      {type:'single',num:5,name:'Behind the Back Barbell Shrug drop Wide Grip Barbell Shrug',sets:'4x12 drop 20',badges:['tb-drop'],note:'Behind back 12 reps · drop to wide grip 20 reps'},
      {type:'single',num:6,name:'Barbell Upright Row',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · 2 sec pause at top · 1:0:1:2'},
    ],
    2:[
      {type:'single',num:1,name:'Standing Reverse Delt Cable Flies',sets:'4x15',badges:['tb-highrep12'],note:'12-15 reps · bilateral cable · rear delt focus'},
      {type:'single',num:2,name:'Barbell or DB Shoulder Press',sets:'6x4',badges:['tb-lowrep'],note:'Low rep · very heavy · 6 sets 4 reps'},
      {type:'superset',num:3,
       a:{name:'Seated Side Lateral Raises (half reps heavy, then high rep)',sets:'4x8 drop 20',badges:['tb-superset','tb-drop'],note:'⚡ Superset A · 8 heavy half reps · drop to 20 full reps lighter'},
       b:{name:'Seated Alternating DB Raises',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset B · pyramid up · alternate each arm'}},
      {type:'superset',num:4,
       a:{name:'Reverse Incline Face Pulls',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · rear delt squeeze'},
       b:{name:'Reverse Pec Deck',sets:'12,10,8,8 drop 12',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset B · pyramid up · drop set final set'}},
      {type:'single',num:5,name:'Close Grip Barbell Shrug',sets:'4x12 drop 20',badges:['tb-drop'],note:'12 reps heavy · drop to 20 reps · 2 sec pause at top'},
    ]
  },
    },

    'split4_legs2': {
      id: 'split4_legs2', split: 'Split 4',
      title: 'Leg Day 2', icon: '🦵', color: '#34d399', bg: '#052e1a',
      backUrl: 'pmc-split4.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Quad Extensions',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at top · 1:0:1:2'},
      {type:'single',num:2,name:'Barbell Squat (neutral stance)',sets:'12,10,8,8',badges:['tb-pyramid','tb-lowrep'],note:'Pyramid up · keep heavy and low rep'},
      {type:'single',num:3,name:'Goblet Squat (cannonball) [COMPOUND SUB]**',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · feet together heels elevated · sub DB if needed'},
      {type:'superset',num:4,
       a:{name:'Box Same Leg Step-Ups',sets:'4x12 each leg',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps each leg · drive through heel'},
       b:{name:'Weighted Walking Lunges',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · loaded · torso upright'}},
      {type:'single',num:5,name:'Smith Machine Split Squats',sets:'12,10,8,8 drop 12',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'single',num:6,name:'Quad Extension Finisher',sets:'5x20',badges:['tb-highrep20','tb-minrest'],note:'20 reps · AMRAP style · 5-6 sets · 20 sec rest'},
      {type:'single',num:7,name:'Calf Raises',sets:'4x15',badges:['tb-highrep12'],note:'12-15 reps · 2 sec pause at top · 1:0:1:2'},
    ],
    2:[
      {type:'single',num:1,name:'Lying or Seated Hamstring Curls',sets:'12,10,8,8',badges:['tb-pyramid','tb-tempo'],note:'Pyramid up · 2 sec pause at peak · 1:0:1:2'},
      {type:'single',num:2,name:'Barbell Deadlift or Barbell RDLs [COMPOUND SUB]**',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · sub DB if needed'},
      {type:'single',num:3,name:'Wide Stance Barbell Squats (toes pointed out)',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · wide stance · glute emphasis'},
      {type:'single',num:4,name:'Goblet Squats',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
      {type:'superset',num:5,
       a:{name:'Good Mornings',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sec pause at bottom · 1:2:1:0'},
       b:{name:'Weighted Walking Lunges',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · loaded · keep torso upright'}},
      {type:'superset',num:6,
       a:{name:'Seated Calf Raises',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset A · 20 reps · 2 sec pause at top · 1:0:1:2'},
       b:{name:'Smith Machine Split Squats',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · controlled descent'}},
    ]
  },
    },

    'split4_bistris': {
      id: 'split4_bistris', split: 'Split 4',
      title: 'Bis & Tris', icon: '💪', color: '#f472b6', bg: '#2d0a1e',
      backUrl: 'pmc-split4.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Pinwheel Curls',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · pyramid up · alternate arms'},
       b:{name:'Lying DB Extension + Cross Chest Extension',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset B · pyramid · 1 rep to ear + 1 rep across chest = 1 rep'}},
      {type:'superset',num:2,
       a:{name:'Double Arm Incline Hammer Curl',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · pyramid up · both arms together'},
       b:{name:'Bent Over DB Tricep Kickbacks',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · both arms · squeeze at full extension'}},
      {type:'superset',num:3,
       a:{name:'21s',sets:'4x21',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 7 lower half / 7 upper half / 7 full reps'},
       b:{name:'French Press',sets:'12,10,8,8 drop 12',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset B · pyramid up · drop set on final set'}},
      {type:'superset',num:4,
       a:{name:'Barbell Curl (close grip)',sets:'5x5',badges:['tb-superset','tb-lowrep'],note:'⚡ Superset A · low rep · heavy · 5x5 · strong contraction'},
       b:{name:'Tricep Pushdown',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · bilateral · squeeze at bottom'}},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Seated Alternating DB Curl',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · pyramid up · alternate arms · full supination'},
       b:{name:'Dips or Dip Machine',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · full ROM'}},
      {type:'superset',num:2,
       a:{name:'Barbell Spider Curls',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sec pause at peak contraction · 1:0:1:2'},
       b:{name:'Double Arm Tricep Cable Extension',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · bilateral cable · squeeze at bottom'}},
      {type:'superset',num:3,
       a:{name:'Close Grip Barbell Curls',sets:'5x5',badges:['tb-superset','tb-lowrep'],note:'⚡ Superset A · low rep · heavy · 5x5 · 3 sec negatives · 4:0:1:0'},
       b:{name:'Incline Skull Crushers',sets:'12,10,8,8 drop 12',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset B · pyramid up · drop set final set'}},
      {type:'superset',num:4,
       a:{name:'15s (5 double arm / 5 hammer / 5 chicken wing)',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 5 reps each variation'},
       b:{name:'Tricep Extension Machine',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid','tb-tempo'],note:'⚡ Superset B · pyramid up · 2 sec pause at top and bottom · 1:2:1:2'}},
    ]
  },
    },

    'split5_push': {
      id: 'split5_push', split: 'Split 5',
      title: 'Push', icon: '💪', color: '#c084fc', bg: '#1e1040',
      backUrl: 'pmc-split5.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Flat Barbell Bench',sets:'6x4 drop 15',badges:['tb-lowrep','tb-drop'],note:'Low rep · high sets · drop set each set to 15 reps'},
      {type:'single',num:2,name:'Arnold Press',sets:'4x10',badges:['tb-tempo'],note:'3 sec negative · 4:0:1:0 · full rotation'},
      {type:'single',num:3,name:'Alternating Incline DB Press',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · alternate arms each rep'},
      {type:'superset',num:4,
       a:{name:'Pronated DB Chest Flies',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 2 sec pause at stretch'},
       b:{name:'Close Grip Skull Crushers drop Double Arm DB Tricep Extensions',sets:'4x12 drop 20',badges:['tb-superset','tb-drop'],note:'⚡ Superset B · 12 reps skull crusher · drop to 20 reps extensions'}},
      {type:'superset',num:5,
       a:{name:'Barbell Upright Row',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · pyramid up · elbows drive high'},
       b:{name:'Double Arm Cable Tricep Kickbacks',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset B · pyramid up · bilateral cable'}},
      {type:'single',num:6,name:'Barbell Shrugs (neutral grip)',sets:'12,10,8,8 drop 20',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · 2 sec pause at top · drop set final set · 1:0:1:2'},
    ],
    2:[
      {type:'single',num:1,name:'DB Flat Bench',sets:'6x4',badges:['tb-lowrep'],note:'Low rep · high sets · go heavy'},
      {type:'single',num:2,name:'Incline Barbell Bench',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · increase weight each set'},
      {type:'single',num:3,name:'Barbell or DB Military Press',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · strict press · no leg drive'},
      {type:'single',num:4,name:'Alternating Incline DB Press',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · alternate arms · full ROM'},
      {type:'superset',num:5,
       a:{name:'Slight Incline Chest Flies',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · deep stretch'},
       b:{name:'Skull Crushers',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset B · 2 sec pause at bottom · 1:2:1:0'}},
      {type:'single',num:6,name:'Barbell Upright Row',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · 2 sec pause at top · 1:0:1:2'},
    ]
  },
    },

    'split5_pull': {
      id: 'split5_pull', split: 'Split 5',
      title: 'Pull', icon: '🔙', color: '#22d3ee', bg: '#042f2e',
      backUrl: 'pmc-split5.html', type: 'standard',
      data: {
    1:{warmup:true,exercises:[
      {type:'single',num:1,name:'Barbell Pendlay Rows',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · explosive pull · reset each rep'},
      {type:'superset',num:2,
       a:{name:'DB Incline Row',sets:'6x4',badges:['tb-superset','tb-lowrep'],note:'⚡ Superset A · low rep · high sets · 2 sec pause at top'},
       b:{name:'DB Spider Curls',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset B · 2 sec pause at peak contraction · 1:0:1:2'}},
      {type:'single',num:3,name:'Concentration Curls',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · single arm at a time · squeeze at top'},
      {type:'superset',num:4,
       a:{name:'Wide Grip Lat Pulldowns',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · pyramid up · full stretch at top'},
       b:{name:'Barbell Curls (wide grip)',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · controlled eccentric'}},
      {type:'superset',num:5,
       a:{name:'Straight Arm Lat Pulldowns',sets:'4x25',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset A · 20-30 reps · bilateral cable · constant tension'},
       b:{name:'Preacher Curls',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset B · pyramid up · 2 sec pause at bottom'}},
    ]},
    2:{warmup:true,exercises:[
      {type:'single',num:1,name:'Barbell Pendlay Rows',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · drive elbows back hard'},
      {type:'superset',num:2,
       a:{name:'DB Incline Row',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 2 sec pause at top · 1:0:1:2'},
       b:{name:'Double Arm Incline DB Curl',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · both arms together · full supination'}},
      {type:'single',num:3,name:'Concentration Curls',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · squeeze hard at peak · alternate arms'},
      {type:'superset',num:4,
       a:{name:'V Grip Lat Pulldowns',sets:'12,10,8,8',badges:['tb-superset','tb-pyramid'],note:'⚡ Superset A · pyramid up · 2 sec pause at bottom'},
       b:{name:'Barbell Curls (close grip)',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · controlled eccentric'}},
      {type:'superset',num:5,
       a:{name:'Straight Arm Lat Pulldowns',sets:'4x25',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset A · 20-30 reps · bilateral cable · constant tension'},
       b:{name:'Preacher Curls',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · 2 sec pause at bottom'}},
    ]}
  },
    },

    'split5_legs': {
      id: 'split5_legs', split: 'Split 5',
      title: 'Legs', icon: '🦵', color: '#4ade80', bg: '#052e16',
      backUrl: 'pmc-split5.html', type: 'standard',
      data: {
    1:[
      {type:'superset',num:1,
       a:{name:'Quad Extensions',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · squeeze at full extension'},
       b:{name:'Lying Hamstring Curl',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · 2 sec pause at peak'}},
      {type:'single',num:2,name:'Barbell Squat (neutral stance)',sets:'6x4',badges:['tb-lowrep'],note:'Low rep · high sets · go heavy · full depth'},
      {type:'single',num:3,name:'Goblet Squats (wide stance, toes pointed out)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set · sumo stance'},
      {type:'superset',num:4,
       a:{name:'Smith Machine Split Squats',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 3 sec negative'},
       b:{name:'Cannonball Smith Machine Squats',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · feet together heels elevated'}},
      {type:'superset',num:5,
       a:{name:'Barbell Good Mornings',sets:'4x12',badges:['tb-superset','tb-tempo'],note:'⚡ Superset A · 2 sec pause at bottom · 1:2:1:0'},
       b:{name:'DB RDLs',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · bilateral DBs · feel the stretch'}},
      {type:'single',num:6,name:'Calf Raises',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
    ],
    2:[
      {type:'superset',num:1,
       a:{name:'Quad Extensions',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 3 sec negatives · 4:0:1:0'},
       b:{name:'Lying Hamstring Curl',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · 2 sec pause at peak'}},
      {type:'single',num:2,name:'Barbell/Smith/Goblet Squat (close stance)',sets:'6x4',badges:['tb-lowrep'],note:'Low rep · high sets · close stance · heels elevated'},
      {type:'single',num:3,name:'Goblet Squats (neutral stance)',sets:'12,10,8,8 drop 15',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · 2 sec pause at bottom · drop set final set'},
      {type:'single',num:4,name:'Smith Machine Split Squats',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · 3 sec negative on descent'},
      {type:'single',num:5,name:'Quad Extensions',sets:'4x12',badges:['tb-tempo'],note:'3 sec negatives · 4:0:1:0 · squeeze at top'},
      {type:'single',num:6,name:'Calf Raises',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
    ]
  },
    },

    'split6_chest': {
      id: 'split6_chest', split: 'Split 6',
      title: 'Chest', icon: '💪', color: '#c084fc', bg: '#1e1040',
      backUrl: 'pmc-split6.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Weighted Push-Ups',sets:'4x12',badges:['tb-tempo'],note:'3-4 sec negatives · 4:0:1:0 · plate on back'},
      {type:'single',num:2,name:'Barbell or DB Bench (heavy)',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · strong chest drive'},
      {type:'single',num:3,name:'Incline Alternating DB Press',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · alternate arms · full ROM'},
      {type:'single',num:4,name:'Barbell 1-¼ Rep Bench',sets:'4x12 drop 20',badges:['tb-highrep12','tb-drop'],note:'12-15 reps · full + quarter rep at bottom · drop set final set'},
      {type:'superset',num:5,
       a:{name:'Slight Incline Flies',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · deep stretch at bottom'},
       b:{name:'Slight Incline Hammer Press',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · neutral grip · bilateral'}},
    ],
    2:[
      {type:'single',num:1,name:'Weighted Push-Ups',sets:'4x12',badges:['tb-tempo'],note:'3-4 sec negatives · 4:0:1:0'},
      {type:'single',num:2,name:'Barbell or DB Bench (heavy)',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · increase weight from W1'},
      {type:'single',num:3,name:'Incline Alternating DB Press',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · alternate arms'},
      {type:'single',num:4,name:'Barbell 1-¼ Rep Bench',sets:'4x12 drop 20',badges:['tb-highrep12','tb-drop'],note:'12-15 reps · quarter rep at bottom · drop set final set'},
      {type:'superset',num:5,
       a:{name:'Slight Incline Flies',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 2 sec pause at stretch'},
       b:{name:'Slight Incline Hammer Press',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · neutral grip · heavier than W1'}},
    ]
  },
    },

    'split6_deltsarms': {
      id: 'split6_deltsarms', split: 'Split 6',
      title: 'Delts & Arms', icon: '💪', color: '#fb923c', bg: '#2d1500',
      backUrl: 'pmc-split6.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Reverse Pec Deck Flies',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · rear delt squeeze at peak'},
      {type:'superset',num:2,
       a:{name:'Side Lateral Raises',sets:'12,10,8,8 drop 15',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset A · pyramid up · drop set final set'},
       b:{name:'Skull Crushers',sets:'5x5',badges:['tb-superset','tb-lowrep'],note:'⚡ Superset B · low rep · heavy · 2 sec pause at bottom'}},
      {type:'single',num:3,name:'Barbell Curls (close grip)',sets:'4x12',badges:['tb-tempo'],note:'3 sec negatives · 4:0:1:0 · strict form'},
      {type:'superset',num:4,
       a:{name:'Concentration Curls',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 2 sec pause at peak · 1:0:1:2'},
       b:{name:'Lying Single Arm Tricep Extension',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · full overhead extension'}},
      {type:'single',num:5,name:'Incline Barbell Face Pulls',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · rear delt / upper trap focus · bilateral'},
      {type:'single',num:6,name:'Tricep Pushdowns',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · 2 sec pause at bottom · 1:0:1:2'},
    ],
    2:[
      {type:'single',num:1,name:'Reverse Pec Deck Flies',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · increase weight from W1'},
      {type:'superset',num:2,
       a:{name:'Side Lateral Raises',sets:'12,10,8,8 drop 15',badges:['tb-superset','tb-pyramid','tb-drop'],note:'⚡ Superset A · pyramid up · drop set final set'},
       b:{name:'Skull Crushers',sets:'5x5',badges:['tb-superset','tb-lowrep'],note:'⚡ Superset B · low rep · heavy'}},
      {type:'single',num:3,name:'Barbell Curls (close grip)',sets:'4x12',badges:['tb-tempo'],note:'3 sec negatives · 4:0:1:0'},
      {type:'superset',num:4,
       a:{name:'Concentration Curls',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · 2 sec pause · heavier than W1'},
       b:{name:'Lying Single Arm Tricep Extension',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · both arms'}},
      {type:'single',num:5,name:'Incline Barbell Face Pulls',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · heavier than W1'},
      {type:'single',num:6,name:'Tricep Pushdowns',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · bilateral · 2 sec pause at bottom'},
    ]
  },
    },

    'split6_legs': {
      id: 'split6_legs', split: 'Split 6',
      title: 'Legs', icon: '🦵', color: '#4ade80', bg: '#052e16',
      backUrl: 'pmc-split6.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Quad Extensions',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 3 sec negatives · constant tension'},
      {type:'superset',num:2,
       a:{name:'Goblet Cannonball Squats',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · feet together heels elevated'},
       b:{name:'DB RDLs',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · bilateral · feel the hamstring stretch'}},
      {type:'single',num:3,name:'Neutral Stance Barbell Front or Back Squat',sets:'5x5',badges:['tb-lowrep','tb-tempo'],note:'Low rep · heavy · 3 sec negative on descent · 4:0:1:0'},
      {type:'single',num:4,name:'Weighted Walking Lunges',sets:'12,10,8,8 drop 15BW',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set: 15 bodyweight lunges after each set'},
      {type:'single',num:5,name:'Same Leg Step-Ups',sets:'4x12 each leg',badges:['tb-highrep12'],note:'12-15 reps · drive through the heel · controlled descent'},
      {type:'single',num:6,name:'Calf Raises',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
    ],
    2:[
      {type:'single',num:1,name:'Quad Extensions',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 3 sec negatives · heavier than W1'},
      {type:'superset',num:2,
       a:{name:'Goblet Cannonball Squats',sets:'4x12',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps · heavier than W1'},
       b:{name:'DB RDLs',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · bilateral'}},
      {type:'single',num:3,name:'Neutral Stance Barbell Front or Back Squat',sets:'5x5',badges:['tb-lowrep','tb-tempo'],note:'Low rep · heavier than W1 · 3 sec negative · 4:0:1:0'},
      {type:'single',num:4,name:'Weighted Walking Lunges',sets:'12,10,8,8 drop 15BW',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set bodyweight lunges'},
      {type:'single',num:5,name:'Same Leg Step-Ups',sets:'4x12 each leg',badges:['tb-highrep12'],note:'12-15 reps each leg · heavier than W1'},
      {type:'single',num:6,name:'Calf Raises',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at top · heavier than W1'},
    ]
  },
    },

    'split6_backtraps': {
      id: 'split6_backtraps', split: 'Split 6',
      title: 'Back & Traps', icon: '🔙', color: '#22d3ee', bg: '#042f2e',
      backUrl: 'pmc-split6.html', type: 'standard',
      data: {
    1:[
      {type:'single',num:1,name:'Wide Grip Lat Pulldowns',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · full stretch at top'},
      {type:'single',num:2,name:'Pendlay Rows',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · reset each rep · explosive pull'},
      {type:'single',num:3,name:'Wide Barbell Shrugs',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
      {type:'single',num:4,name:'Wide Grip Cable Rows',sets:'4x15',badges:['tb-highrep12'],note:'12-15 reps · 2 sec pause at peak · 1:0:1:2'},
      {type:'single',num:5,name:'Incline DB Row',sets:'4x12 drop 15',badges:['tb-highrep12','tb-drop','tb-tempo'],note:'12-15 reps · 2 sec pause at top · 1:0:1:2 · drop set final set'},
      {type:'superset',num:6,
       a:{name:'Seated Shrugs',sets:'4xfailure',badges:['tb-superset','tb-amrap'],note:'⚡ Superset A · 4 sets to failure · squeeze hard at top'},
       b:{name:'Wide Grip Lat Pulldowns',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · bilateral · full stretch'}},
    ],
    2:[
      {type:'single',num:1,name:'Wide Grip Lat Pulldowns',sets:'12,10,8,8',badges:['tb-pyramid'],note:'Pyramid up · increase weight from W1'},
      {type:'single',num:2,name:'Pendlay Rows',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavier than W1'},
      {type:'single',num:3,name:'Wide Barbell Shrugs',sets:'4x20',badges:['tb-highrep20'],note:'20 reps · 2 sec pause · heavier than W1'},
      {type:'single',num:4,name:'Wide Grip Cable Rows',sets:'4x15',badges:['tb-highrep12'],note:'12-15 reps · 2 sec pause at peak'},
      {type:'single',num:5,name:'Incline DB Row',sets:'4x12 drop 15',badges:['tb-highrep12','tb-drop'],note:'12-15 reps · 2 sec pause · drop set final set'},
      {type:'superset',num:6,
       a:{name:'Seated Shrugs',sets:'4xfailure',badges:['tb-superset','tb-amrap'],note:'⚡ Superset A · 4 sets to failure · heavier than W1'},
       b:{name:'Wide Grip Lat Pulldowns',sets:'4x20',badges:['tb-superset','tb-highrep20'],note:'⚡ Superset B · 20 reps · bilateral'}},
    ]
  },
    },

    'split5_core': {
      id: 'split5_core', split: 'Split 5',
      title: 'Core', icon: '🎯', color: '#a78bfa', bg: '#1a0d40',
      backUrl: 'pmc-split5.html', type: 'blocks',
      data: [
    {num:1,name:'6-Inch / 45° / 90° Leg Raises',sets:'10 reps at each angle',note:'30 total reps · control the descent · no swinging'},
    {num:2,name:'USA Kettlebell Twist',sets:'3x20 each side',note:'Rotate fully · keep core braced throughout'},
    {num:3,name:'In & Outs',sets:'3x20',note:'Extend fully · tuck knees to chest · no floor contact'},
    {num:4,name:'Around the Worlds',sets:'3x10 each direction',note:'Full circular rotation · controlled movement'},
    {num:5,name:'Side Plank',sets:'30 sec each side',note:'Stack feet or stagger · hips level · brace obliques'},
  ],
    },

    'split6_abs': {
      id: 'split6_abs', split: 'Split 6',
      title: 'Abs Circuit', icon: '🎯', color: '#a78bfa', bg: '#1a0d40',
      backUrl: 'pmc-split6.html', type: 'blocks',
      data: [
    {num:1,name:'6-Inch / 45° / 90° Leg Raises',sets:'3x30 (10 at each angle)',note:'Hold each position · slow and controlled · no swinging'},
    {num:2,name:'In & Outs',sets:'3x20',note:'Full extension · tuck knees · keep feet off floor'},
    {num:3,name:'USA Twists',sets:'3x20 each side',note:'Rotate fully · feet off floor · brace obliques'},
    {num:4,name:'Heels to Heaven',sets:'3x20',note:'Straight legs · drive heels up · hips off floor'},
  ],
    },

    'split7_ugee': {
      id: 'split7_ugee', file: 'pmc-s7-giant.html', split: 'Split 7',
      title: 'UGEE SETS', icon: '⚡', color: '#fb923c', bg: '#2d1500',
      backUrl: 'pmc-split7.html', type: 'blocks', s7: true,
      // Rendered from the shared single source pmc-s7-data.js (PMC_S7) — keeps
      // the app's Split 7 in lockstep with pmc-s7-giant.html (reps, badges, weeks).
      data: [],
    },

  };

  const PMC_SPLIT_META = {
    'split1': { name: 'The Original', color: '#4ade80', workouts: ['split1_legs', 'split1_back', 'split1_chest', 'split1_bistris', 'split1_leghams'] },
    'split2': { name: 'The Rematch', color: '#22d3ee', workouts: ['split2_legs', 'split2_chest', 'split2_back', 'split2_cst', 'split2_legs2'] },
    'split3': { name: 'The Inferno', color: '#f87171', workouts: ['split3_back', 'split3_legs', 'split3_chest', 'split3_shoulders', 'split3_back2'] },
    'split4': { name: 'The Blueprint', color: '#c084fc', workouts: ['split4_legsback', 'split4_chesttris', 'split4_shoulders', 'split4_legs2', 'split4_bistris'] },
    'split5': { name: 'Push/Pull/Legs', color: '#fb923c', workouts: ['split5_push', 'split5_pull', 'split5_legs', 'split5_core'] },
    'split6': { name: 'Body Part Split', color: '#a78bfa', workouts: ['split6_chest', 'split6_deltsarms', 'split6_legs', 'split6_backtraps', 'split6_abs'] },
    'split7': { name: 'UGEE SETS', color: '#fb923c', workouts: ['split7_ugee'] },
  };

  const CONFUSION_SWAPS = {
    'split1_legs': {
      3: [
        {type:'single',num:1,name:'Quad Extensions',sets:'4×6',rest:'120 sec',badges:['tb-lowrep'],note:'🔀 was superset/high rep → low rep heavy'},
        {type:'single',num:2,name:'Romanian Deadlifts (Barbell or DB)**',sets:'4×6',rest:'120 sec',badges:['tb-lowrep'],note:'🔀 was superset/high rep → low rep heavy'},
        {type:'single',num:3,name:'Close Stance Barbell Squats or Goblet Squats**',sets:'12,10,8,8 drop 15',rest:'90 sec',badges:['tb-pyramid','tb-drop'],note:'🔀 was low rep → pyramid + drop set'},
        {type:'single',num:4,name:'Quad Extensions',sets:'4×20',rest:'60 sec',badges:['tb-highrep20'],note:'🔀 was pyramid/drop → high rep constant tension'},
        {type:'single',num:5,name:'Smith Machine Split Squats',sets:'AMRAP',rest:'90 sec',badges:['tb-amrap'],note:'🔀 was tempo → AMRAP · push to failure'},
        {type:'single',num:6,name:'Leg Press (feet shoulder width)',sets:'4×6',rest:'120 sec',badges:['tb-lowrep'],note:'🔀 was high rep → low rep heavy'},
        {type:'single',num:7,name:'Calf Raises',sets:'4×12',rest:'60 sec',badges:['tb-tempo'],note:'🔀 was high rep → tempo · 2:2:1:0'},
        {type:'single',num:8,name:'Walking Lunges',sets:'100–200 reps',rest:'60 sec',badges:['tb-optional'],note:'⭐ Optional finisher'},
      ],
      4: [
        {type:'single',num:1,name:'Leg Press (feet shoulder width)',sets:'4×6',rest:'120 sec',badges:['tb-lowrep'],note:'🔀 was superset/high rep → low rep heavy'},
        {type:'single',num:2,name:'Lying Hamstring Curl',sets:'4×6',rest:'120 sec',badges:['tb-lowrep'],note:'🔀 was superset/high rep → low rep heavy'},
        {type:'single',num:3,name:'Neutral Stance Barbell or Goblet Squats**',sets:'4×20',rest:'75 sec',badges:['tb-highrep20'],note:'🔀 was pyramid/drop → high rep'},
        {type:'single',num:4,name:'Cannonball Hack Squat or Leg Press (heels elevated)**',sets:'4×8',rest:'90 sec',badges:['tb-tempo'],note:'🔀 was low rep → tempo · 3:0:1:0'},
        {type:'single',num:5,name:'Seated Leg Extension',sets:'12,10,8 drop 15',rest:'75 sec',badges:['tb-pyramid','tb-drop'],note:'🔀 was high rep → pyramid + drop'},
        {type:'single',num:6,name:'Seated Hamstring Curl',sets:'AMRAP',rest:'75 sec',badges:['tb-amrap'],note:'🔀 was high rep → AMRAP · push to failure'},
        {type:'single',num:7,name:'Calf Raises',sets:'4×12',rest:'60 sec',badges:['tb-tempo'],note:'🔀 was high rep → tempo · 2:2:1:0'},
        {type:'single',num:8,name:'Walking Lunges',sets:'100–200 reps',rest:'60 sec',badges:['tb-optional'],note:'⭐ Optional finisher'},
      ],
    },
    'split1_back': {
      3: [
        {type:'single',num:1,name:'Wide Grip Lat Pulldown',sets:'12,10,8,6',rest:'90 sec',badges:['tb-pyramid'],note:'🔀 was superset/high rep → pyramid'},
        {type:'single',num:2,name:'Seated Cable Row (close V grip)',sets:'12,10,8,6',rest:'90 sec',badges:['tb-pyramid'],note:'🔀 was superset/high rep → pyramid'},
        {type:'single',num:3,name:'Barbell Pendlay Rows',sets:'4×8',rest:'90 sec',badges:['tb-tempo'],note:'🔀 was low rep → tempo · 4:0:1:0'},
        {type:'single',num:4,name:'Machine Low Row',sets:'4×20',rest:'60 sec',badges:['tb-highrep20'],note:'🔀 was pyramid/drop → high rep'},
        {type:'single',num:5,name:'Incline DB Row (bilateral)',sets:'4×5',rest:'120 sec',badges:['tb-lowrep'],note:'🔀 was tempo → low rep heavy'},
        {type:'single',num:6,name:'Straight Arm Lat Pulldown (cable)',sets:'4×12 drop 20',rest:'60 sec',badges:['tb-drop'],note:'🔀 was high rep → drop set'},
        {type:'single',num:7,name:'Machine High Row',sets:'AMRAP',rest:'75 sec',badges:['tb-amrap'],note:'🔀 was high rep → AMRAP'},
        {type:'single',num:8,name:'Cable Shrug (bilateral)',sets:'15,12,10,8',rest:'60 sec',badges:['tb-pyramid'],note:'🔀 was high rep → pyramid'},
      ],
      4: [
        {type:'single',num:1,name:'Reverse Grip Lat Pulldown',sets:'12,10,8,6',rest:'90 sec',badges:['tb-pyramid'],note:'🔀 was superset/high rep → pyramid'},
        {type:'single',num:2,name:'Wide Grip Seated Cable Row',sets:'12,10,8,6',rest:'90 sec',badges:['tb-pyramid'],note:'🔀 was superset/high rep → pyramid'},
        {type:'single',num:3,name:'Barbell Pendlay or Bent Over Row**',sets:'4×8',rest:'90 sec',badges:['tb-tempo'],note:'🔀 was low rep → tempo · 4:0:1:0'},
        {type:'single',num:4,name:'Wide Grip Lat Pulldown',sets:'4×20',rest:'60 sec',badges:['tb-highrep20'],note:'🔀 was pyramid/drop → high rep'},
        {type:'single',num:5,name:'V Grip Lat Pulldown',sets:'4×5',rest:'120 sec',badges:['tb-lowrep'],note:'🔀 was tempo → low rep heavy'},
        {type:'single',num:6,name:'Straight Arm Lat Pulldown (cable)',sets:'5×12 drop 20',rest:'60 sec',badges:['tb-drop'],note:'🔀 was high rep → drop set'},
        {type:'single',num:7,name:'Machine Mid Row',sets:'AMRAP',rest:'75 sec',badges:['tb-amrap'],note:'🔀 was high rep → AMRAP'},
        {type:'single',num:8,name:'Barbell Shrug (wide grip)',sets:'15,12,10,8',rest:'60 sec',badges:['tb-pyramid'],note:'🔀 was high rep → pyramid'},
      ],
    },
    // Additional splits will use auto-generated swaps via autoConfusion()
  };

  // ── WEEK 3-4 ROTATION ENGINE ──────────────────────────────────────
  // Weeks 3 and 4 re-run weeks 1 and 2 with the INTENSIFIER rotated while the
  // exercise, its station and its set count stay put. That is what the page's
  // own banner promises: "same exercises · lift type rotated".
  //
  // Audit PG-1/PG-3/PG-4 — what the previous implementation actually did, all
  // three measured over the real data before anything was changed:
  //
  //   * It rotated ONE badge. swapBadges() was a ladder of `if
  //     (badges.includes(x)) return [y]`, so it returned a one-element array
  //     for whatever matched first and threw the rest away. The most common
  //     pairing in this dataset is ['tb-pyramid','tb-drop'] (51 exercises):
  //     every one of them lost its drop set outright in weeks 3 and 4. 58
  //     badge sets were truncated this way. swapSets() had the same shape and
  //     the same defect, so the prescription agreed with the truncated badge.
  //
  //   * It broke every superset apart. autoConfusion() turned a superset into
  //     two standalone cards numbered 1a/1b, so 77 supersets stopped being
  //     supersets in weeks 3 and 4 — a station-anchoring change (see
  //     CLAUDE.md's archetypes) that nothing asked for.
  //
  //   * Its tempo rotation emitted no tempo. `tb-lowrep` became `tb-tempo`
  //     with a set string of "4×8" — a rep scheme with nothing tempo about it,
  //     53 times. This project's own rule is that tempo appears as real
  //     notation in the set field ("@ 4-0-1"), not as a coaching note.
  //
  // The model here separates the two roles the badge vocabulary actually
  // carries in the authored data:
  //
  //   BASE       exactly one rep scheme — low rep / pyramid / 12-15 / 20-30 /
  //              tempo / AMRAP. These rotate on a 6-cycle.
  //   MODIFIER   tb-drop. It is never a rep scheme of its own in this data (it
  //              only ever appears ALONGSIDE a base, e.g. "12,10,8,8 drop 15"),
  //              so it rides the rotation rather than being consumed by it.
  //              A drop set staying a drop set while the scheme under it
  //              rotates is the behaviour the banner describes; the old code's
  //              "drop -> high rep" edge is precisely how the drop vanished.
  //
  // Everything else on the badge list (tb-superset, tb-minrest, tb-optional,
  // tb-finisher, equipment badges) is carried through untouched.
  //
  // The 6-cycle keeps five of the old table's six edges. The one that changes
  // is tb-highrep20, which used to point at tb-lowrep — leaving tb-highrep12
  // with no predecessor, so once an exercise rotated off "12-15 reps" nothing
  // could ever rotate back onto it. Pointing highrep20 at highrep12 closes the
  // cycle: every intensifier now has exactly one predecessor and one
  // successor, which is what makes this a rotation rather than a drain.
  var BASE_CYCLE = {
    'tb-lowrep':    'tb-tempo',
    'tb-tempo':     'tb-amrap',
    'tb-amrap':     'tb-pyramid',
    'tb-pyramid':   'tb-highrep20',
    'tb-highrep20': 'tb-highrep12',
    'tb-highrep12': 'tb-lowrep'
  };
  var MODIFIERS = ['tb-drop'];

  // Which base writes the set string when a rotated card carries more than one
  // (the authored data does this too — "pyramid performed at tempo"). A
  // numeric scheme always beats AMRAP, because "AMRAP @ 4-0-1" is not a
  // prescription any parser in this app can read a rep target out of.
  var BASE_PRIORITY = ['tb-lowrep', 'tb-pyramid', 'tb-highrep12', 'tb-highrep20', 'tb-tempo', 'tb-amrap'];

  var SHORT = {
    'tb-lowrep': 'low rep heavy', 'tb-tempo': 'tempo', 'tb-amrap': 'AMRAP',
    'tb-pyramid': 'pyramid', 'tb-highrep20': 'high rep', 'tb-highrep12': '12-15 reps',
    'tb-drop': 'drop set', 'tb-superset': 'superset'
  };

  var PYRAMIDS = {
    2: '12,10', 3: '12,10,8', 4: '12,10,8,8',
    5: '15,12,10,8,8', 6: '15,12,10,8,8,6'
  };

  function isBase(b) { return Object.prototype.hasOwnProperty.call(BASE_CYCLE, b); }
  function isModifier(b) { return MODIFIERS.indexOf(b) >= 0; }

  // Working-set count of an authored prescription. Deliberately a small local
  // reader rather than a reach into mc-setlog.js's MCSetlogUtil: this runs
  // inside render(), which fires before the page's tail <script> tags have
  // loaded that module, so it cannot be there to ask.
  function workSetCount(sets) {
    var work = String(sets == null ? '' : sets).replace(/\s*\bdrop\b.*$/i, '').trim();
    var mult = work.match(/^\s*(\d+)\s*[x×]/i);
    if (mult) return Math.min(Math.max(parseInt(mult[1], 10), 1), 8);
    var parts = work.split(',').filter(function (p) { return /\d/.test(p); });
    if (parts.length > 1) return Math.min(parts.length, 8);
    return 4;                       // no set count stated — the house default
  }

  // Top (heaviest, lowest-rep) working target of a base scheme, used to size
  // the drop. The authored pairs in this file are 8 -> "drop 15" and
  // 12 -> "drop 20"; this reproduces both rather than inventing a formula.
  function dropReps(top) {
    if (!top) return 20;
    if (top <= 8) return 15;
    if (top <= 12) return 20;
    return 25;
  }

  function schemeFor(base, n) {
    if (base === 'tb-lowrep')    return { str: n + '×6',  top: 6 };
    if (base === 'tb-highrep12') return { str: n + '×12', top: 12 };
    if (base === 'tb-highrep20') return { str: n + '×20', top: 20 };
    if (base === 'tb-tempo')     return { str: n + '×8 @ 4-0-1', top: 8 };
    // "N×AMRAP", not a bare "AMRAP": a bare one states no set count, so
    // mc-setlog.js falls back to its 3-row default and the athlete is shown
    // three rows where four were prescribed. Caught by this file's own
    // regression sweep against the real parser, on 50 rotated cards.
    if (base === 'tb-amrap')     return { str: n + '×AMRAP', top: 0 };
    if (base === 'tb-pyramid') {
      var p = PYRAMIDS[n] || PYRAMIDS[4];
      var toks = p.split(',');
      return { str: p, top: parseInt(toks[toks.length - 1], 10) };
    }
    return null;
  }

  // Rotate a whole badge list, as a set: every base advances one step on the
  // cycle, every modifier and every non-structural badge is carried through in
  // its original position. Order is preserved so the rendered badge row keeps
  // the shape the author gave it.
  function rotateBadges(badges) {
    if (!badges || !badges.length) return badges ? badges.slice() : [];
    return badges.map(function (b) { return isBase(b) ? BASE_CYCLE[b] : b; });
  }

  // Build the rotated prescription from the ROTATED badge set, so the string
  // and the badges can never disagree. Returns the authored string unchanged
  // when nothing structural rotated.
  function rotateSets(sets, badges) {
    var rot = rotateBadges(badges);
    var bases = BASE_PRIORITY.filter(function (b) { return rot.indexOf(b) >= 0; });
    var hasDrop = rot.indexOf('tb-drop') >= 0;
    var n = workSetCount(sets);

    var scheme = bases.length ? schemeFor(bases[0], n) : null;
    if (!scheme) {
      // Modifier-only or nothing structural at all. A card whose only
      // structural badge is tb-drop keeps its own working scheme and its own
      // drop clause — there is nothing to re-express.
      return sets;
    }
    var out = scheme.str;
    // tb-tempo present but not the chosen base decorates the scheme instead of
    // replacing it ("12,10,8,8 @ 4-0-1"), which is how mm-data.js writes its
    // own tempo week.
    if (rot.indexOf('tb-tempo') >= 0 && bases[0] !== 'tb-tempo' && bases[0] !== 'tb-amrap') {
      out += ' @ 4-0-1';
    }
    if (hasDrop) out += ' drop ' + dropReps(scheme.top);
    return out;
  }

  function rotationNote(badges) {
    var from = (badges || []).filter(function (b) { return isBase(b) || isModifier(b); });
    if (!from.length) return null;
    var to = from.map(function (b) { return isBase(b) ? BASE_CYCLE[b] : b; });
    function label(list) {
      return list.map(function (b) { return SHORT[b] || b; }).join(' + ');
    }
    return '🔀 was ' + label(from) + ' → ' + label(to);
  }

  function rotateExercise(ex) {
    var note = rotationNote(ex.badges);
    // No structural intensifier (a bodyweight finisher, an optional extra):
    // there is nothing to rotate, so the authored card passes through whole
    // rather than being re-badged or having its coaching note truncated.
    if (!note) return Object.assign({}, ex);
    return Object.assign({}, ex, {
      sets: rotateSets(ex.sets, ex.badges),
      badges: rotateBadges(ex.badges),
      note: note
    });
  }

  // ── AUTO ROTATION (for splits without a hand-authored week 3/4 map) ─────
  // PG-3: a superset stays a superset. The previous implementation split one
  // into two standalone cards numbered "1a"/"1b", which changed the day's
  // station anchoring (CLAUDE.md's superset archetypes) as a side effect of
  // rotating a rep scheme, and cost the pair its shared rest.
  function autoConfusion(exercises, sourceWeek){
    return (exercises || []).map(function (ex) {
      if (ex.type === 'superset') {
        return Object.assign({}, ex, {
          a: rotateExercise(ex.a || {}),
          b: rotateExercise(ex.b || {})
        });
      }
      return rotateExercise(ex);
    });
  }

  function getWeekData(workout, week){
    const raw = workout.data;
    if(workout.type === 'blocks') return null; // blocks handled separately

    // Normalize data structure (some files wrap in {warmup, exercises})
    function getExercises(weekData){
      if(!weekData) return [];
      if(Array.isArray(weekData)) return weekData;
      if(weekData.exercises) return weekData.exercises;
      return [];
    }
    function hasWarmup(weekData){
      if(!weekData) return false;
      return weekData.warmup === true;
    }

    // Which week (if any) this one is rotated FROM comes from the WEEKS table
    // below, not from a `week <= 2` literal — same reason the tab row reads it.
    const src = sourceWeekFor(week);
    if(!src){
      const wd = raw[week] || raw[1];
      return { exercises: getExercises(wd), warmup: hasWarmup(wd) };
    }

    const bwd = raw[src] || raw[1];

    // A hand-authored week 3/4 map always wins over the automatic rotation.
    const manualKey = workout.id;
    if(CONFUSION_SWAPS[manualKey] && CONFUSION_SWAPS[manualKey][week]){
      return { exercises: CONFUSION_SWAPS[manualKey][week], warmup: hasWarmup(bwd) };
    }

    return { exercises: autoConfusion(getExercises(bwd), src), warmup: hasWarmup(bwd) };
  }

  // ── WEEK THEMES ───────────────────────────────────────────────────
  // The block's shape as DATA. Both PMC pages built their week bar from a
  // hardcoded `[1,2,3,4]`, which is exactly what this project's own shipping
  // checklist forbids ("Themes drive the tabs ... never hardcode the week
  // list"): the block length then lives in three places that are free to
  // disagree. The tab row maps over this array now, so adding or removing a
  // week is a one-line change here.
  var WEEKS = [
    { n: 1, label: 'WEEK 1', theme: 'As authored', from: 0 },
    { n: 2, label: 'WEEK 2', theme: 'As authored', from: 0 },
    { n: 3, label: 'WEEK 3', theme: 'Rotated from week 1', from: 1 },
    { n: 4, label: 'WEEK 4', theme: 'Rotated from week 2', from: 2 }
  ];
  function weekRec(w) {
    var n = Number(w);
    return WEEKS.filter(function (x) { return x.n === n; })[0] || null;
  }
  // 0 when the week is authored outright; otherwise the week it rotates from.
  function sourceWeekFor(w) {
    var rec = weekRec(w);
    return rec ? rec.from : 0;
  }
  function isRotatedWeek(w) { return sourceWeekFor(w) > 0; }

  window.MC_PMC_DATA = {
    splits: PMC_SPLITS,
    meta: PMC_SPLIT_META,
    confusionSwaps: CONFUSION_SWAPS,
    weeks: WEEKS,
    isRotatedWeek: isRotatedWeek,
    sourceWeekFor: sourceWeekFor,
    getWeekData: getWeekData,
    autoConfusion: autoConfusion,
    rotateSets: rotateSets,
    rotateBadges: rotateBadges,
    rotateExercise: rotateExercise
  };
})();
