/**
 * pmc-data.js — Single source of truth for all PMC workout data
 * 7 splits · 30 workouts · Weeks 1–2 original · Weeks 3–4 confusion swaps
 */

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
    id: 'split2_legs', file: 'pmc-s2-legs-quad.html', split: 'Split 2',
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
    id: 'split2_chest', file: 'pmc-s2-chest-biceps.html', split: 'Split 2',
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
    id: 'split2_back', file: 'pmc-s2-back.html', split: 'Split 2',
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
    id: 'split2_cst', file: 'pmc-s2-cst.html', split: 'Split 2',
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
    id: 'split2_legs2', file: 'pmc-s2-legs-day2.html', split: 'Split 2',
    title: 'Leg Day 2', icon: '🦵', color: '#34d399', bg: '#052e1a',
    backUrl: 'pmc-split2.html', type: 'standard',
    data: {
  1:[
    {type:'superset',num:1,
     a:{name:'Leg Extension',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12–15 reps · squeeze at top'},
     b:{name:'Lying Hamstring Curl',sets:'4×15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12–15 reps · 2 sec pause at peak'}},
    {type:'single',num:2,name:'Wide Stance Goblet or Barbell Squat [COMPOUND SUB]**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · '+SUB},
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
    {type:'single',num:2,name:'Wide or Neutral Stance Barbell Squat [COMPOUND SUB]**',sets:'5×5',badges:['tb-lowrep'],note:'Low rep · heavy · '+SUB},
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
    id: 'split3_back', file: 'pmc-s3-back.html', split: 'Split 3',
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
    id: 'split3_legs', file: 'pmc-s3-legs.html', split: 'Split 3',
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
    id: 'split3_chest', file: 'pmc-s3-chest.html', split: 'Split 3',
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
    id: 'split3_shoulders', file: 'pmc-s3-shoulders-tris.html', split: 'Split 3',
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
    id: 'split3_back2', file: 'pmc-s3-back-bis-forearms.html', split: 'Split 3',
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
    id: 'split4_legsback', file: 'pmc-s4-legs-back.html', split: 'Split 4',
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
    id: 'split4_chesttris', file: 'pmc-s4-chest-tris.html', split: 'Split 4',
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
    id: 'split4_shoulders', file: 'pmc-s4-shoulders.html', split: 'Split 4',
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
    id: 'split4_legs2', file: 'pmc-s4-legs-day2.html', split: 'Split 4',
    title: 'Leg Day 2', icon: '🦵', color: '#34d399', bg: '#052e1a',
    backUrl: 'pmc-split4.html', type: 'standard',
    data: {
  1:[
    {type:'single',num:1,name:'Quad Extensions',sets:'4x12',badges:['tb-tempo'],note:'2 sec pause at top · 1:0:1:2'},
    {type:'single',num:2,name:'Barbell Squat (neutral stance)',sets:'12,10,8,8',badges:['tb-pyramid','tb-lowrep'],note:'Pyramid up · keep heavy and low rep'},
    {type:'single',num:3,name:'Goblet Squat (cannonball) [COMPOUND SUB]**',sets:'4x12',badges:['tb-highrep12'],note:'12-15 reps · feet together heels elevated · '+SUB},
    {type:'superset',num:4,
     a:{name:'Box Same Leg Step-Ups',sets:'4x12 each leg',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset A · 12-15 reps each leg · drive through heel'},
     b:{name:'Weighted Walking Lunges',sets:'4x15',badges:['tb-superset','tb-highrep12'],note:'⚡ Superset B · 12-15 reps · loaded · torso upright'}},
    {type:'single',num:5,name:'Smith Machine Split Squats',sets:'12,10,8,8 drop 12',badges:['tb-pyramid','tb-drop'],note:'Pyramid up · drop set on final set'},
    {type:'single',num:6,name:'Quad Extension Finisher',sets:'5x20',badges:['tb-highrep20','tb-minrest'],note:'20 reps · AMRAP style · 5-6 sets · 20 sec rest'},
    {type:'single',num:7,name:'Calf Raises',sets:'4x15',badges:['tb-highrep12'],note:'12-15 reps · 2 sec pause at top · 1:0:1:2'},
  ],
  2:[
    {type:'single',num:1,name:'Lying or Seated Hamstring Curls',sets:'12,10,8,8',badges:['tb-pyramid','tb-tempo'],note:'Pyramid up · 2 sec pause at peak · 1:0:1:2'},
    {type:'single',num:2,name:'Barbell Deadlift or Barbell RDLs [COMPOUND SUB]**',sets:'5x5',badges:['tb-lowrep'],note:'Low rep · heavy · '+SUB},
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
    id: 'split4_bistris', file: 'pmc-s4-bis-tris.html', split: 'Split 4',
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
    id: 'split5_push', file: 'pmc-s5-push.html', split: 'Split 5',
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
    id: 'split5_pull', file: 'pmc-s5-pull.html', split: 'Split 5',
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
    id: 'split5_legs', file: 'pmc-s5-legs.html', split: 'Split 5',
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
    id: 'split6_chest', file: 'pmc-s6-chest.html', split: 'Split 6',
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
    id: 'split6_deltsarms', file: 'pmc-s6-delts-arms.html', split: 'Split 6',
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
    id: 'split6_legs', file: 'pmc-s6-legs.html', split: 'Split 6',
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
    id: 'split6_backtraps', file: 'pmc-s6-back-traps.html', split: 'Split 6',
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
    id: 'split5_core', file: 'pmc-s5-core.html', split: 'Split 5',
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
    id: 'split6_abs', file: 'pmc-s6-abs-circuit.html', split: 'Split 6',
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
    backUrl: 'pmc-split7.html', type: 'blocks',
    data: [
  {title:'Chest Giant Set',rounds:5,
   warmup:'Push-Ups — 3 sets warmup',
   note:'Complete all 5 exercises back to back = 1 round. Rest 2-3 min between rounds.',
   exercises:[
     'DB Flat Bench',
     'Slight Incline DB Bench',
     'High Incline DB Press',
     'High Incline DB Flies',
     'Pronated Flat Bench Flies',
   ]},
  {title:'Arms Giant Set',rounds:5,
   warmup:'Dips — 3 sets warmup',
   note:'Complete all 6 exercises consecutively = 1 round. Rest 2-3 min between rounds.',
   exercises:[
     'Double Arm Incline Curl',
     'DB Spider Curl',
     'Concentration Curls',
     'Flat Bench Skull Crushers',
     'Double Arm DB Skull Crushers',
   ]},
  {title:'Back Giant Set',rounds:5,
   warmup:'Pull-Ups — 3 sets warmup',
   note:'Complete all 5 exercises back to back = 1 round. Rest 2-3 min between rounds.',
   exercises:[
     'Wide Grip Lat Pulldown',
     'Wide Grip Cable Row',
     'V Grip Lat Pulldown',
     'Double Arm DB Row',
     'Straight Arm Lat Pulldown',
   ]},
  {title:'Shoulder Giant Set',rounds:5,
   note:'Complete all 6 exercises consecutively = 1 round. Rest 2-3 min between rounds.',
   exercises:[
     'Seated Side Lateral Raises',
     'Double Arm Incline Bench Front Raises',
     'Barbell Upright Row',
     'Barbell Face Pulls',
     'Reverse Incline Bench DB Delt Flies',
     'Seated DB Shrugs',
   ]},
],
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