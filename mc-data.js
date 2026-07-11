/**
 * mc-data.js — Single source of truth for the MC split fleet (23 day pages).
 * Generated from the previously hand-authored mc-s*.html files (roadmap 3.5).
 * Rendered by mc-engine.js via MC.init(pageId).
 */
const MC_SPLITS = {
  "s1-back": {
    file: "mc-s1-back.html",
    accent: "#f5c842", accentRgb: "245,200,66",
    headerGrad: ["#2a1d00", "#1a1200"],
    titleTag: "MC — Back", eyebrow: "🔙 Split 1", pageTitle: "Back",
    backHref: "mc-split1.html",
    warmup: { icon: "🔥", text: "Pull-Ups (AMRAP)", sub: "Warmup — max reps · full hang · no kipping" },
    data: {
  1:[
    {type:'single',num:1,name:'Wide Grip Lat Pulldowns',sets:'5x5 then 5x10',b:['tb-lowrep','tb-highset','tb-tempo'],note:'3-4 sec negatives · 4:0:1:0 · full stretch at top'},
    {type:'ss',num:2,a:{name:'V Grip Pulldowns',sets:'4x12',b:['tb-midset'],note:'2 sec pause at bottom · 1:0:1:2'},
                  b:{name:'Straight Arm Lat Pulldowns',sets:'12,10,8,8 then AMRAP',b:['tb-pyramid','tb-highrep','tb-amrap'],note:'AMRAP · constant tension · bilateral cable'}},
    {type:'single',num:3,name:'DB Incline Row (6 sets — 2 high / 2 regular / 2 slight)',sets:'6x10',b:['tb-highset'],note:'Change angle every 2 sets · 2 sec pause at top'},
  ],
  2:[{type:'single',num:1,name:'Pull-Ups',sets:'5x12',b:['tb-highset'],note:'High sets · full hang · change angle'},{type:'single',num:2,name:'Seated Cable Row',sets:'5x12 each',b:['tb-highset'],note:'High sets · strict form'},{type:'single',num:3,name:'T-Bar Row',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy pull'},{type:'ss',num:4,a:{name:'Wide Grip Lat Pulldowns',sets:'4x12',b:['tb-midset'],note:'Constant tension · bilateral'},b:{name:'V-Grip Pulldown',sets:'4x10',b:['tb-midset'],note:'2 sec pause at top · same cable station'}}],
  3:[{type:'single',num:1,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'AMRAP · full hang · high sets'},{type:'single',num:2,name:'Seated Cable Row',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 2 sec pause at peak · elbows tight'},{type:'single',num:3,name:'T-Bar Row',sets:'4x12',b:['tb-midset'],note:'Underhand · squeeze at bottom'},{type:'ss',num:4,a:{name:'Wide Grip Lat Pulldowns',sets:'4x12',b:['tb-midset'],note:'2 sec pause at bottom'},b:{name:'V-Grip Pulldown',sets:'4x10',b:['tb-midset'],note:'Elbows tight · drive back hard · same cable station'}}],
  4:[{type:'single',num:1,name:'Pull-Ups',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec pause at top'},{type:'single',num:2,name:'Seated Cable Row',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · drive elbows back'},{type:'single',num:3,name:'T-Bar Row',sets:'4x15',b:['tb-highrep'],note:'High rep · constant tension'},{type:'ss',num:4,a:{name:'Wide Grip Lat Pulldowns',sets:'4x15',b:['tb-highrep'],note:'High rep · full stretch at top'},b:{name:'V-Grip Pulldown',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec pause at peak · same cable station'}}]
},
    summary: {
      subtitle: "Lats · Mid Back · Rear Delts",
      rows: [
      { icon: "💀", name: "Pull-Ups Warmup (AMRAP)", sets: "1+ sets", reps: "Max reps" },
      { icon: "📉", name: "Wide Grip Lat Pulldowns", sets: "5 sets", reps: "5 reps heavy then 5×10" },
      { icon: "🔀", name: "V Grip Pulldowns × Straight Arm PD", sets: "4 sets", reps: "12 reps / 20 reps each" },
      { icon: "📐", name: "Tri-Level DB Incline Row", sets: "6 sets", reps: "10 reps — 2 high / 2 reg / 2 slight" }
    ],
      totals: [
      { val: "16–17 sets", label: "Total Sets" },
      { val: "~180–220 reps total", label: "Est. Reps" },
      { val: "40–50 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s1-chest-shoulders.html", label: "Up Next in this Split", dotColor: "#d4af37", name: "Chest & Shoulders" }
  },
  "s1-bis-tris": {
    file: "mc-s1-bis-tris.html",
    accent: "#f5c842", accentRgb: "245,200,66",
    headerGrad: ["#2a1d00", "#1a1200"],
    titleTag: "MC — Biceps & Triceps", eyebrow: "💥 Split 1", pageTitle: "Biceps & Triceps",
    backHref: "mc-split1.html",
    warmup: null,
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Double Arm DB Curls',sets:'5x12',b:['tb-highset'],note:'High sets · full supination at top'},
                  b:{name:'DB Overhead Tricep Extension',sets:'4x10',b:['tb-midset'],note:'Seated on bench · full overhead stretch · same DBs'}},
    {type:'ss',num:2,a:{name:'Overhead Cable Curl',sets:'4x12',b:['tb-midset'],note:'Low pulley · 2 sec pause at peak · same cable station as pushdowns'},
                  b:{name:'Tricep Pushdowns (rope)',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at bottom · same cable stack'}},
    {type:'ss',num:3,a:{name:'Barbell Curls',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · strict form'},
                  b:{name:'Skull Crushers',sets:'4x10',b:['tb-midset'],note:'2 sec pause at bottom · 1:2:1:0'}},
    {type:'ss',num:4,a:{name:'Cable Curl (low pulley)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full supination · squeeze at peak'},
                  b:{name:'Cable Overhead Tricep Extension',sets:'4x20',b:['tb-highrep'],note:'20 reps · high pulley · full overhead stretch · same cable stack'}},
  ],
  2:[{type:'ss',num:1,a:{name:'Double Arm DB Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full supination'},b:{name:'DB Overhead Tricep Extension',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · full overhead stretch · same DBs'}},{type:'ss',num:2,a:{name:'Overhead Cable Curl',sets:'5x12',b:['tb-highset'],note:'High sets · low pulley · 2 sec pause at peak'},b:{name:'Tricep Pushdowns (rope)',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at bottom'}},{type:'ss',num:3,a:{name:'Barbell Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · strict form'},b:{name:'Skull Crushers',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 2 sec pause at bottom'}},{type:'ss',num:4,a:{name:'Cable Curl (low pulley)',sets:'4x15',b:['tb-highrep'],note:'High rep · constant tension · full supination'},b:{name:'Cable Overhead Tricep Extension',sets:'4x20',b:['tb-highrep'],note:'20 reps · high pulley · full overhead stretch · same cable stack'}}],
  3:[{type:'ss',num:1,a:{name:'Double Arm DB Curls',sets:'5x12',b:['tb-highset'],note:'High sets · full supination'},b:{name:'DB Overhead Tricep Extension',sets:'4x10',b:['tb-midset'],note:'Seated on bench · full overhead stretch · same DBs as curls'}},{type:'ss',num:2,a:{name:'Overhead Cable Curl',sets:'4x12',b:['tb-midset'],note:'Low pulley · 2 sec pause at peak · same cable station as pushdowns'},b:{name:'Tricep Pushdowns (rope)',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at bottom'}},{type:'ss',num:3,a:{name:'Barbell Curls',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · strict form'},b:{name:'Skull Crushers',sets:'4x10',b:['tb-midset'],note:'2 sec pause at bottom · 1:2:1:0'}},{type:'ss',num:4,a:{name:'Cable Curl (low pulley)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full supination · squeeze at peak'},b:{name:'Cable Overhead Tricep Extension',sets:'4x20',b:['tb-highrep'],note:'20 reps · high pulley · full overhead stretch · same cable stack'}}],
  4:[{type:'ss',num:1,a:{name:'Double Arm DB Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full supination'},b:{name:'DB Overhead Tricep Extension',sets:'5x12',b:['tb-highset'],note:'High sets · full overhead stretch · same DBs'}},{type:'ss',num:2,a:{name:'Overhead Cable Curl',sets:'4x15',b:['tb-highrep'],note:'High rep · low pulley · squeeze at peak'},b:{name:'Tricep Pushdowns (rope)',sets:'4x15',b:['tb-highrep'],note:'High rep · squeeze at bottom · bilateral'}},{type:'ss',num:3,a:{name:'Barbell Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · strict form · 2 sec negative'},b:{name:'Skull Crushers',sets:'4x20',b:['tb-highrep'],note:'High rep pump · moderate weight'}},{type:'ss',num:4,a:{name:'Cable Curl (low pulley)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · heavy · full supination · squeeze hard'},b:{name:'Cable Overhead Tricep Extension',sets:'4x20',b:['tb-highrep'],note:'High rep pump · high pulley · same cable stack'}}]
},
    summary: {
      subtitle: "Biceps · Triceps",
      rows: [
      { icon: "🔀", name: "DB Curls × DB Overhead Tricep Extension", sets: "4–5 sets", reps: "12 reps / 10 reps" },
      { icon: "🔀", name: "Overhead Cable Curl × Tricep Pushdowns", sets: "4–5 sets", reps: "12 reps each" },
      { icon: "🔀", name: "Barbell Curls × Skull Crushers", sets: "5 sets", reps: "5 reps / 10 reps" },
      { icon: "🔀", name: "Cable Curl × Cable Overhead Tricep Extension", sets: "4 sets", reps: "12,10,8,8 / 20 reps" }
    ],
      totals: [
      { val: "17–20 sets", label: "Total Sets" },
      { val: "~250–300 reps total", label: "Est. Reps" },
      { val: "40–55 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s1-legs.html", label: "Up Next in this Split", dotColor: "#d4af37", name: "Legs Day 1" }
  },
  "s1-chest-shoulders": {
    file: "mc-s1-chest-shoulders.html",
    accent: "#f5c842", accentRgb: "245,200,66",
    headerGrad: ["#2a1d00", "#1a1200"],
    titleTag: "MC — Chest & Shoulders", eyebrow: "💪 Split 1", pageTitle: "Chest & Shoulders",
    backHref: "mc-split1.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'High Incline DB Flies',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · deep stretch at bottom'},
    {type:'single',num:2,name:'Incline Barbell or DB Press',sets:'5x5',b:['tb-lowrep'],note:'Heavy compound · low rep · drive the bar'},
    {type:'single',num:3,name:'Slight Incline DB Press',sets:'5x12',b:['tb-highset'],note:'High sets · full ROM · controlled descent'},
    {type:'ss',num:4,a:{name:'Pronated DB Flies',sets:'4x15',b:['tb-highrep'],note:'2 sets out front · 2 sets to the side'},
                  b:{name:'Side Lateral Raises',sets:'4x15',b:['tb-highrep'],note:'2 sets out front · 2 sets to the side · squeeze at top'}},
    {type:'single',num:5,name:'Arnold Press',sets:'4x10',b:['tb-midset'],note:'Full rotation · 3 sec negative · 4:0:1:0'},
    {type:'ss',num:6,a:{name:'Incline Bench DB Front Raises',sets:'4x15',b:['tb-highrep'],note:'High rep shoulder burner'},
                  b:{name:'Shrugs',sets:'4x20',b:['tb-highrep'],note:'20 reps · 2 sec pause at top · 1:0:1:2'}},
  ],
  2:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · drive the bar'},{type:'single',num:2,name:'Incline DB Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 2 sec negative · 4:0:1:0'},{type:'single',num:3,name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'High rep pump · deep stretch'},{type:'ss',num:4,a:{name:'Cable Chest Press',sets:'4x12',b:['tb-midset'],note:'Constant tension · full ROM'},b:{name:'Rope Pushdowns',sets:'4x12',b:['tb-midset'],note:'Bilateral · squeeze at bottom'}},{type:'ss',num:5,a:{name:'Seated DB Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · strict press · slight incline'},b:{name:'DB Lateral Raise',sets:'4x15',b:['tb-highrep'],note:'2 sec pause at top · seated · same bench as press'}}],
  3:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Heavy · drive the bar'},{type:'single',num:2,name:'Incline DB Press',sets:'4x12',b:['tb-midset'],note:'Full ROM'},{type:'single',num:3,name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'2 sec peak contraction'},{type:'ss',num:4,a:{name:'Cable Chest Press',sets:'4x12',b:['tb-midset'],note:'Constant tension · full ROM'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'Bilateral · squeeze at bottom'}},{type:'ss',num:5,a:{name:'Seated DB Press',sets:'4x12',b:['tb-midset'],note:'Strict press · 2 sec negative'},b:{name:'DB Lateral Raise',sets:'4x15',b:['tb-highrep'],note:'Constant tension · squeeze at top · same bench as press'}}],
  4:[{type:'single',num:1,name:'Barbell Bench Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · drive the bar'},{type:'single',num:2,name:'Incline DB Press',sets:'4x15',b:['tb-highrep'],note:'High rep · moderate weight'},{type:'single',num:3,name:'Pec Deck Fly',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec peak hold'},{type:'ss',num:4,a:{name:'Cable Chest Press',sets:'4x12',b:['tb-midset'],note:'2 sec pause at peak'},b:{name:'Rope Pushdowns',sets:'4x12',b:['tb-midset'],note:'Squeeze at bottom · bilateral'}},{type:'ss',num:5,a:{name:'Seated DB Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · heavy · strict form'},b:{name:'DB Lateral Raise',sets:'5x12',b:['tb-highset'],note:'High rep · constant tension · seated same bench'}}]
},
    summary: {
      subtitle: "Upper Chest · Mid Chest · Anterior + Lateral Delts · Traps",
      rows: [
      { icon: "🪰", name: "High Incline DB Flies", sets: "3–5 sets", reps: "12,10,8,8 pyramid" },
      { icon: "🏋️", name: "Incline Barbell or DB Press", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "💪", name: "Slight Incline DB Press", sets: "5 sets", reps: "12 reps" },
      { icon: "🔀", name: "Pronated Flies × Side Lateral Raises", sets: "4 sets", reps: "15 reps each" },
      { icon: "🏔️", name: "Arnold Press", sets: "4 sets", reps: "10 reps — 3 sec negative" },
      { icon: "🔀", name: "Incline Front Raises × Shrugs", sets: "4 sets", reps: "15 reps / 20 reps" }
    ],
      totals: [
      { val: "25–27 sets", label: "Total Sets" },
      { val: "~300–350 reps total", label: "Est. Reps" },
      { val: "50–65 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s1-bis-tris.html", label: "Up Next in this Split", dotColor: "#d4af37", name: "Bis & Tris" }
  },
  "s1-legs": {
    file: "mc-s1-legs.html",
    accent: "#f5c842", accentRgb: "245,200,66",
    headerGrad: ["#2a1d00", "#1a1200"],
    titleTag: "MC — Legs", eyebrow: "🦵 Split 1", pageTitle: "Legs",
    backHref: "mc-split1.html",
    warmup: null,
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at top · 3 sec negative'},
                   b:{name:'DB Romanian Deadlifts',sets:'4x10',b:['tb-midset'],note:'DBs pre-staged at extension machine · feel the hamstring stretch'}},
    {type:'ss',num:2,a:{name:'Seated Hamstring Curl',sets:'4x12',b:['tb-midset'],note:'2 sec pause at peak · 1:0:1:2'},
                   b:{name:'Wide Stance Goblet Squats',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy goblet squat · DB held at chest'}},
    {type:'single',num:3,name:'Smith Machine Split Squats',sets:'4x10',b:['tb-midset'],note:'3 sec negative on descent · 4:0:1:0'},
    {type:'single',num:4,name:'Quad Extensions (AMRAP)',sets:'3xfailure',b:['tb-amrap'],note:'Push to failure · rest 90 sec between sets'},
    {type:'single',num:5,name:'Calf Raises',sets:'12,10,8,8 then 20',b:['tb-pyramid','tb-highrep'],note:'20 reps · 2 sec pause at top'},
  ],
  2:[{type:'single',num:1,name:'Smith Machine Cannonball Squats',sets:'5x10',b:['tb-highset'],note:'High sets · close stance · deep squat'},{type:'single',num:2,name:'Hack Squat (low foot placement)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · quad position angle'},{type:'single',num:3,name:'Quad Extensions',sets:'3xfailure',b:['tb-amrap'],note:'AMRAP · full extension'},{type:'ss',num:4,a:{name:'Leg Press (high and wide)',sets:'4x20',b:['tb-highrep'],note:'High rep · anterior delt'},b:{name:'DB Reverse Lunges (in place)',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at leg press · torso upright'}}],
  3:[{type:'single',num:1,name:'Smith Machine Cannonball Squats',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · close stance · deep squat'},{type:'ss',num:2,a:{name:'Leg Press (feet together, close stance)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full ROM'},b:{name:'DB Reverse Lunges (in place)',sets:'4x12 each leg',b:['tb-midset'],note:'DBs pre-staged at leg press · torso upright'}},{type:'single',num:3,name:'Smith Machine Hip Thrust',sets:'4x15',b:['tb-highrep'],note:'Full hip extension · 2 sec squeeze at top'},{type:'single',num:4,name:'Quad Extensions',sets:'5x20',b:['tb-highrep'],note:'High rep · constant tension'}],
  4:[{type:'single',num:1,name:'Smith Machine Cannonball Squats',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 4 sec negative'},{type:'single',num:2,name:'Hack Squat (low foot placement)',sets:'4x10',b:['tb-midset'],note:'Controlled eccentric'},{type:'ss',num:3,a:{name:'Leg Press (feet together, close stance)',sets:'4x10',b:['tb-midset'],note:'Heavy · slow descent'},b:{name:'DB Reverse Lunges (in place)',sets:'3xfailure',b:['tb-amrap'],note:'DBs pre-staged at leg press · failure each side'}},{type:'single',num:4,name:'Smith Machine Hip Thrust',sets:'4x15',b:['tb-highrep'],note:'Full extension · pause at top and bottom'}]
},
    summary: {
      subtitle: "Quads · Hamstrings · Calves",
      rows: [
      { icon: "🔀", name: "Quad Extensions × DB RDLs", sets: "5 sets", reps: "12 reps / 10 reps" },
      { icon: "🦵", name: "Seated Hamstring Curl × Wide Stance Squats", sets: "4–5 sets", reps: "12 reps / 5 reps" },
      { icon: "⚙️", name: "Smith Machine Split Squats", sets: "4 sets", reps: "10 reps each leg" },
      { icon: "💀", name: "Quad Extensions (AMRAP)", sets: "3 sets", reps: "To failure" },
      { icon: "🦶", name: "Calf Raises", sets: "5 sets", reps: "12–20 reps + 2 sec pause" }
    ],
      totals: [
      { val: "21–22 sets", label: "Total Sets" },
      { val: "~200–250 reps total", label: "Est. Reps" },
      { val: "45–60 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s1-legs2.html", label: "Up Next in this Split", dotColor: "#d4af37", name: "Legs Day 2" }
  },
  "s1-legs2": {
    file: "mc-s1-legs2.html",
    accent: "#f5c842", accentRgb: "245,200,66",
    headerGrad: ["#2a1d00", "#1a1200"],
    titleTag: "MC — Legs — Day 2", eyebrow: "🦵 Split 1", pageTitle: "Legs — Day 2",
    backHref: "mc-split1.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Quad Extensions',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · increase weight each set'},
    {type:'single',num:2,name:'Barbell RDLs',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · strong hip hinge'},
    {type:'ss',num:3,a:{name:'Seated Hamstring Curls',sets:'4x12 drop 8',b:['tb-drop'],note:'Drop set on final set · 2 sec pause at peak'},
                  b:{name:'Close Stance Goblet Squats',sets:'4x10',b:['tb-midset'],note:'Close stance · upright torso · heels elevated · DB held at chest'}},
    {type:'ss',num:4,a:{name:'DB Single Leg RDLs',sets:'3x12 each',b:['tb-midset'],note:'DBs pre-staged at extension machine · balance and stretch'},
                  b:{name:'Single Leg Quad Extension',sets:'4x12 drop 15',b:['tb-drop'],note:'Drop set after each set · squeeze at extension'}},
    {type:'single',num:5,name:'Smith Machine Split Squats',sets:'5x12 then AMRAP',b:['tb-highset','tb-highrep','tb-amrap'],note:'3 sets to failure · slow and controlled descent'},
  ],
  2:[{type:'single',num:1,name:'Barbell Squat',sets:'5x12',b:['tb-highset'],note:'High sets · full ROM · squeeze at top'},{type:'single',num:2,name:'Romanian Deadlift',sets:'4x10',b:['tb-midset'],note:'Bilateral · feel the stretch'},{type:'single',num:3,name:'Goblet Squat',sets:'4x15',b:['tb-highrep'],note:'High rep pump · squeeze at top'},{type:'ss',num:4,a:{name:'Seated Calf Raises',sets:'4x20',b:['tb-highrep'],note:'Full ROM · 2 sec pause at top'},b:{name:'DB Reverse Lunges (in place)',sets:'4x12 each',b:['tb-midset'],note:'DBs pre-staged at calf raise machine · torso upright'}}],
  3:[{type:'single',num:1,name:'Barbell Squat',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · heavy bilateral'},{type:'single',num:2,name:'Romanian Deadlift',sets:'5x12',b:['tb-highset'],note:'High sets · full stretch at top'},{type:'single',num:3,name:'Goblet Squat',sets:'4x12',b:['tb-midset'],note:'Controlled · 2 sec pause'},{type:'ss',num:4,a:{name:'Seated Calf Raises',sets:'4x20',b:['tb-highrep'],note:'2 sec pause · forearm squeeze'},b:{name:'DB Reverse Lunges (in place)',sets:'4x12 each',b:['tb-midset'],note:'DBs pre-staged at calf raise machine · torso upright'}}],
  4:[{type:'single',num:1,name:'Barbell Squat',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · heavy bilateral'},{type:'single',num:2,name:'Romanian Deadlift',sets:'4x10',b:['tb-midset'],note:'Bilateral · feel the stretch'},{type:'single',num:3,name:'Goblet Squat',sets:'4x15',b:['tb-highrep'],note:'High rep · upright torso'},{type:'ss',num:4,a:{name:'Seated Calf Raises',sets:'4x20',b:['tb-highrep'],note:'Heavy · 2 sec pause at top'},b:{name:'DB Reverse Lunges (in place)',sets:'3xfailure',b:['tb-amrap'],note:'DBs pre-staged at calf raise machine · failure each side'}}]
},
    summary: {
      subtitle: "Quads · Hamstrings · Glutes",
      rows: [
      { icon: "🦵", name: "Quad Extensions", sets: "4 sets", reps: "12,10,8,8 pyramid" },
      { icon: "🏋️", name: "Barbell RDLs", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "🔀", name: "Seated Ham Curl × Close Stance Squats", sets: "4 sets", reps: "12 drop / 10 reps" },
      { icon: "🔀", name: "DB Single Leg RDL × Single Leg Extension", sets: "3–4 sets", reps: "12 reps / 12 drop set" },
      { icon: "💀", name: "Smith Machine Split Squats", sets: "5 sets", reps: "12 reps then AMRAP" }
    ],
      totals: [
      { val: "21–22 sets", label: "Total Sets" },
      { val: "~220–270 reps total", label: "Est. Reps" },
      { val: "45–60 min", label: "Est. Time" }
    ]
    },
    nextWorkout: null
  },
  "s2-back": {
    file: "mc-s2-back.html",
    accent: "#f87171", accentRgb: "248,113,113",
    headerGrad: ["#2a0808", "#1a0505"],
    titleTag: "MC — Back", eyebrow: "🔙 Split 2", pageTitle: "Back",
    backHref: "mc-split2.html",
    warmup: { icon: "🔥", text: "Pull-Ups (AMRAP)", sub: "Warmup — max reps · full hang" },
    data: {
  1:[
    {type:'single',num:1,name:'Incline DB Rows',sets:'5x5 then 5x10',b:['tb-lowrep','tb-highset','tb-midset','tb-tempo'],note:'2 sec pause at top · 1:0:1:2 · high sets'},
    {type:'single',num:2,name:'Single Arm DB Rows',sets:'4x10 each drop double arm',b:['tb-drop'],note:'3 drop sets: single arm → drop to double arm bent over rows'},
    {type:'ss',num:3,a:{name:'Reverse Seated Pulldowns',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · underhand grip · squeeze at bottom'},
                  b:{name:'Straight Arm Lat Pulldowns',sets:'4x20',b:['tb-highrep'],note:'20 reps · constant tension · bilateral cable'}},
    {type:'single',num:4,name:'Tri-Level DB Row (high / regular / slight incline)',sets:'6x10',b:['tb-highset'],note:'2 sets each angle · 10 reps per set · change angle every 2'},
  ],
  2:[{type:'single',num:1,name:'Pull-Ups',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec pause at top'},{type:'single',num:2,name:'Seated Cable Row',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · elbows tight'},{type:'ss',num:3,a:{name:'Wide Grip Lat Pulldowns',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy'},b:{name:'V-Grip Pulldown',sets:'4x15',b:['tb-highrep'],note:'High rep pump · squeeze at bottom · same cable station'}},{type:'single',num:4,name:'T-Bar Row',sets:'12,10,8,8',b:['tb-pyramid'],note:'Constant tension · bilateral'}],
  3:[{type:'single',num:1,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Low rep heavy sets → pyramid up'},{type:'single',num:2,name:'Barbell Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy · drive elbows back'},{type:'ss',num:3,a:{name:'Seated Cable Row',sets:'12,10,8,8',b:['tb-pyramid'],note:'Elbows tight · 2 sec pause'},b:{name:'Wide Grip Lat Pulldowns',sets:'4x15',b:['tb-highrep'],note:'2 sec pause at bottom · same cable station'}},{type:'single',num:4,name:'T-Bar Row',sets:'4x12',b:['tb-midset'],note:'2 sec pause at top · elbows tight · drive back'}],
  4:[{type:'single',num:1,name:'Pull-Ups',sets:'5x12',b:['tb-highset'],note:'High sets · drive elbows back hard'},{type:'single',num:2,name:'Barbell Row',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy'},{type:'ss',num:3,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Peak · elbows tight'},b:{name:'Wide Grip Lat Pulldowns',sets:'4x15',b:['tb-highrep'],note:'High rep · full stretch at top · same cable station'}},{type:'single',num:4,name:'T-Bar Row',sets:'12,10,8,8',b:['tb-pyramid'],note:'Constant tension · bilateral cable'}]
},
    summary: {
      subtitle: "Lats · Mid Back · Rear Delts",
      rows: [
      { icon: "💀", name: "Pull-Ups Warmup (AMRAP)", sets: "1+ sets", reps: "Max reps" },
      { icon: "📐", name: "Incline DB Rows", sets: "5 sets", reps: "5 reps then 5×10 — tempo" },
      { icon: "↘️", name: "Single Arm DB Rows → Double Arm Drop", sets: "4 sets", reps: "10 each → drop to double arm" },
      { icon: "🔀", name: "Reverse Pulldowns × Straight Arm PD", sets: "4 sets", reps: "12,10,8,8 / 20 reps" },
      { icon: "📐", name: "Tri-Level DB Row", sets: "6 sets", reps: "10 reps per angle" }
    ],
      totals: [
      { val: "20–21 sets", label: "Total Sets" },
      { val: "~200–250 reps total", label: "Est. Reps" },
      { val: "45–55 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s2-legs.html", label: "Up Next in this Split", dotColor: "#a78bfa", name: "Legs Day 1" }
  },
  "s2-chest-bis": {
    file: "mc-s2-chest-bis.html",
    accent: "#f87171", accentRgb: "248,113,113",
    headerGrad: ["#2a0808", "#1a0505"],
    titleTag: "MC — Chest & Biceps", eyebrow: "💪 Split 2", pageTitle: "Chest & Biceps",
    backHref: "mc-split2.html",
    warmup: null,
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Slight Incline DB Flies',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · deep stretch'},
                  b:{name:'Double Arm Hammer Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · both arms · neutral grip'}},
    {type:'single',num:2,name:'Flat Barbell or DB Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy compound press'},
    {type:'ss',num:3,a:{name:'High Incline DB Press',sets:'5x12',b:['tb-highset'],note:'High sets · full ROM'},
                  b:{name:'Alternating Incline DB Curl',sets:'4x12',b:['tb-midset'],note:'Alternate arms · full supination'}},
    {type:'ss',num:4,a:{name:'Fly to Press',sets:'4x10',b:['tb-midset'],note:'Fly in → press out · feel the transition'},
                  b:{name:'Concentration Curls',sets:'4x15 drop 10',b:['tb-highrep','tb-drop'],note:'Drop set · squeeze at peak · 20-30 rep range on drop'}},
    {type:'ss',num:5,a:{name:'Single Arm DB Press (AMRAP)',sets:'3xfailure each',b:['tb-amrap'],note:'Push to failure each arm'},
                  b:{name:'DB Hammer Curls',sets:'5x12',b:['tb-highset'],note:'Same bench as press · neutral grip · 20 sec rest between sets'}},
  ],
  2:[{type:'ss',num:1,a:{name:'Cable Chest Fly',sets:'5x12',b:['tb-highset'],note:'High sets · constant tension · deep stretch'},b:{name:'Cable Curls',sets:'4x15',b:['tb-highrep'],note:'Squeeze at peak · bilateral'}},{type:'ss',num:2,a:{name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'2 sec peak contraction'},b:{name:'Seated DB Curl',sets:'4x12',b:['tb-midset'],note:'Seated at pec deck · 2 sec pause at top · squeeze hard'}},{type:'ss',num:3,a:{name:'Decline DB Press',sets:'4x12',b:['tb-midset'],note:'2 sec negative · tricep emphasis'},b:{name:'Incline DB Curls',sets:'4x12',b:['tb-midset'],note:'Alternate arms · full supination'}}],
  3:[{type:'ss',num:1,a:{name:'Cable Chest Fly',sets:'5x12',b:['tb-highset'],note:'High sets · constant tension · deep stretch'},b:{name:'Cable Curls',sets:'4x15',b:['tb-highrep'],note:'Squeeze at peak · bilateral'}},{type:'ss',num:2,a:{name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'2 sec peak contraction'},b:{name:'Seated DB Curl',sets:'4x12',b:['tb-midset'],note:'Seated at pec deck · 2 sec pause at top · squeeze hard'}},{type:'ss',num:3,a:{name:'Decline DB Press',sets:'4x12',b:['tb-midset'],note:'2 sec negative · tricep emphasis'},b:{name:'Incline DB Curls',sets:'4x12',b:['tb-midset'],note:'Alternate arms · full supination'}}],
  4:[{type:'ss',num:1,a:{name:'Cable Chest Fly',sets:'4x12',b:['tb-midset'],note:'Constant tension · deep stretch'},b:{name:'Cable Curls',sets:'5x12',b:['tb-highset'],note:'2 sec squeeze at peak'}},{type:'ss',num:2,a:{name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'High rep pump · deep stretch'},b:{name:'Seated DB Curl',sets:'5x12',b:['tb-highset'],note:'Seated at pec deck · high sets · squeeze at top'}},{type:'ss',num:3,a:{name:'Decline DB Press',sets:'4x20',b:['tb-highrep'],note:'High rep pump'},b:{name:'Incline DB Curls',sets:'4x12',b:['tb-midset'],note:'Full supination · squeeze at peak'}}]
},
    summary: {
      subtitle: "Chest · Biceps",
      rows: [
      { icon: "🔀", name: "Slight Incline Flies × Hammer Curls", sets: "4 sets", reps: "12,10,8,8 each" },
      { icon: "🏋️", name: "Flat Barbell or DB Press", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "🔀", name: "High Incline Press × Alt Incline Curl", sets: "5 sets", reps: "12 reps each" },
      { icon: "🔀", name: "Fly to Press × Concentration Curls", sets: "4 sets", reps: "10 reps / 15 reps drop" },
      { icon: "🔀", name: "Single Arm Press (AMRAP) × DB Hammer Curls", sets: "3–5 sets", reps: "Failure / 12 reps 20s rest" }
    ],
      totals: [
      { val: "21–23 sets", label: "Total Sets" },
      { val: "~280–320 reps total", label: "Est. Reps" },
      { val: "50–65 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s2-back.html", label: "Up Next in this Split", dotColor: "#a78bfa", name: "Back" }
  },
  "s2-cst": {
    file: "mc-s2-cst.html",
    accent: "#f87171", accentRgb: "248,113,113",
    headerGrad: ["#2a0808", "#1a0505"],
    titleTag: "MC — Chest / Shoulders / Triceps", eyebrow: "💥 Split 2", pageTitle: "Chest / Shoulders / Triceps",
    backHref: "mc-split2.html",
    warmup: null,
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Close Grip Barbell or DB Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · tricep emphasis'},
                  b:{name:'DB Overhead Tricep Extension',sets:'4x10',b:['tb-midset'],note:'Seated at same bench as press · bilateral · full ROM'}},
    {type:'ss',num:2,a:{name:'DB Front Raises',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · anterior delt focus · same DB area'},
                  b:{name:'Double Arm DB Tricep Extensions',sets:'4x20',b:['tb-highrep'],note:'20 reps · overhead · bilateral'}},
    {type:'ss',num:3,a:{name:'Incline Chest Flies',sets:'5x12 pyramid',b:['tb-highset','tb-pyramid'],note:'Pyramid up · deep stretch at bottom'},
                  b:{name:'Seated Front Raises',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · seated for strict form'}},
  ],
  2:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'5x15',b:['tb-highset'],note:'Constant tension · squeeze at top'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at bottom · 2 sec pause at bottom'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · heavy · 2 sec pause'},b:{name:'DB Shrugs',sets:'4x15',b:['tb-highrep'],note:'Heavy traps · 2 sec hold · DBs from same bench area'}},{type:'ss',num:3,a:{name:'DB Rear Delt Fly',sets:'4x15',b:['tb-highrep'],note:'Bilateral · rear delt squeeze'},b:{name:'DB Overhead Tricep Extension',sets:'4x12',b:['tb-midset'],note:'Full extension · 2 sec negative · bilateral · same DB area'}}],
  3:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'4x15',b:['tb-highrep'],note:'Constant tension · squeeze at top'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'Bilateral · squeeze at bottom'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'4x12',b:['tb-midset'],note:'Strict anterior delt focus'},b:{name:'DB Shrugs',sets:'4x15',b:['tb-highrep'],note:'Heavy traps · 2 sec hold · DBs from same bench area'}},{type:'ss',num:3,a:{name:'DB Rear Delt Fly',sets:'4x12',b:['tb-midset'],note:'Bilateral · rear delt squeeze'},b:{name:'DB Overhead Tricep Extension',sets:'4x12',b:['tb-midset'],note:'Full extension · 2 sec negative · bilateral · same DB area'}}],
  4:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec pause at top'},b:{name:'Rope Pushdowns',sets:'4x15',b:['tb-highrep'],note:'High rep · bilateral · squeeze'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · strict press'},b:{name:'DB Shrugs',sets:'5x12',b:['tb-highset'],note:'Heavy · increase weight each set · DBs from same bench area'}},{type:'ss',num:3,a:{name:'DB Rear Delt Fly',sets:'4x15',b:['tb-highrep'],note:'High rep · rear delt pump'},b:{name:'DB Overhead Tricep Extension',sets:'4x15',b:['tb-highrep'],note:'High rep · 2 sec negative · bilateral · same DB area'}}]
},
    summary: {
      subtitle: "Chest · Shoulders · Triceps",
      rows: [
      { icon: "🔀", name: "Close Grip Press × DB Overhead Tri Extension", sets: "5 sets", reps: "5 reps / 10 reps" },
      { icon: "🔀", name: "DB Front Raises × DB Tri Extensions", sets: "4 sets", reps: "15 reps / 20 reps" },
      { icon: "🔀", name: "Incline Flies × Seated Front Raises", sets: "5 sets", reps: "12 reps each — pyramid" }
    ],
      totals: [
      { val: "14–15 sets", label: "Total Sets" },
      { val: "~180–220 reps total", label: "Est. Reps" },
      { val: "35–45 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s2-legs2.html", label: "Up Next in this Split", dotColor: "#a78bfa", name: "Legs Day 2" }
  },
  "s2-legs": {
    file: "mc-s2-legs.html",
    accent: "#f87171", accentRgb: "248,113,113",
    headerGrad: ["#2a0808", "#1a0505"],
    titleTag: "MC — Legs", eyebrow: "🦵 Split 2", pageTitle: "Legs",
    backHref: "mc-split2.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Smith Machine Split Squats',sets:'5x12',b:['tb-highset'],note:'3 sec negative · 4:0:1:0 · both legs'},
    {type:'single',num:2,name:'Close Stance Barbell or Goblet Squats',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · heels elevated if needed'},
    {type:'ss',num:3,a:{name:'Quad Extensions',sets:'12,10,8,8 drop 15',b:['tb-pyramid','tb-drop'],note:'Pyramid + drop set · 2 sec pause'},
                  b:{name:'DB RDLs',sets:'4x10',b:['tb-midset'],note:'DBs pre-staged at extension machine · 3 sec negative · feel the stretch'}},
    {type:'ss',num:4,a:{name:'Seated Hamstring Curls',sets:'4x12 drop 20',b:['tb-drop','tb-highrep'],note:'Drop to 20 reps · 2 sec pause at peak'},
                  b:{name:'BW Sissy Squats (AMRAP)',sets:'3xfailure',b:['tb-amrap'],note:'Bodyweight · in front of hamstring curl machine · failure each set'}},
    {type:'single',num:5,name:'Calf Raises',sets:'5x20',b:['tb-highrep'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
  ],
  2:[{type:'single',num:1,name:'Smith Machine Cannonball Squats',sets:'5x12',b:['tb-highset'],note:'High sets · close stance · outside thighs'},{type:'single',num:2,name:'Hack Squat (low foot placement)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · quad position angle'},{type:'single',num:3,name:'Quad Extensions',sets:'3xfailure',b:['tb-amrap'],note:'AMRAP · full extension'},{type:'ss',num:4,a:{name:'Leg Press (high and wide)',sets:'4x20',b:['tb-highrep'],note:'High rep · anterior delt'},b:{name:'DB Reverse Lunges (in place)',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at leg press · torso upright'}}],
  3:[{type:'single',num:1,name:'Barbell Squat',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid then high sets · constant tension'},{type:'ss',num:2,a:{name:'Cable Lateral Raises',sets:'4x15',b:['tb-highrep'],note:'Constant tension · squeeze at top'},b:{name:'Face Pull',sets:'5x12',b:['tb-highset'],note:'2 sec hold at peak · rear delt focus'}},{type:'ss',num:3,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · heavy · strict press'},b:{name:'DB Rear Delt Fly',sets:'4x12',b:['tb-midset'],note:'Bilateral · squeeze rear delts'}},{type:'single',num:4,name:'DB Walking Lunges',sets:'4x10',b:['tb-midset'],note:'Required · torso upright'}],
  4:[{type:'single',num:1,name:'Barbell Squat',sets:'5x15',b:['tb-highset'],note:'Constant tension'},{type:'ss',num:2,a:{name:'Cable Lateral Raises',sets:'4x10',b:['tb-midset'],note:'Squeeze at top'},b:{name:'Face Pulls',sets:'5x12',b:['tb-highset'],note:'2 sec hold at peak'}},{type:'ss',num:3,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · strict press'},b:{name:'DB Rear Delt Fly',sets:'4x15',b:['tb-highrep'],note:'High rep pump · bilateral'}},{type:'single',num:4,name:'DB Walking Lunges',sets:'3xfailure',b:['tb-amrap'],note:'Walk to failure · heavy'}]
},
    summary: {
      subtitle: "Quads · Hamstrings · Calves",
      rows: [
      { icon: "⚙️", name: "Smith Machine Split Squats", sets: "5 sets", reps: "12 reps" },
      { icon: "🏋️", name: "Close Stance Barbell/Goblet Squats", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "🔀", name: "Quad Extensions × DB RDLs", sets: "4 sets", reps: "12,10,8,8 drop / 10 reps" },
      { icon: "🔀", name: "Seated Ham Curl × BW Sissy Squats", sets: "4 sets", reps: "12 drop / failure" },
      { icon: "🦶", name: "Calf Raises", sets: "5 sets", reps: "20 reps — 2 sec pause" }
    ],
      totals: [
      { val: "23–24 sets", label: "Total Sets" },
      { val: "~230–280 reps total", label: "Est. Reps" },
      { val: "45–60 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s2-cst.html", label: "Up Next in this Split", dotColor: "#a78bfa", name: "CST" }
  },
  "s2-legs2": {
    file: "mc-s2-legs2.html",
    accent: "#f87171", accentRgb: "248,113,113",
    headerGrad: ["#2a0808", "#1a0505"],
    titleTag: "MC — Legs — Day 2", eyebrow: "🦵 Split 2", pageTitle: "Legs — Day 2",
    backHref: "mc-split2.html",
    warmup: null,
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'High sets · 3 sec negative · 4:0:1:0'},
                  b:{name:'DB Goblet Squats',sets:'12,10,8,8',b:['tb-pyramid'],note:'DBs pre-staged at extension machine · upright torso · pyramid up'}},
    {type:'ss',num:2,a:{name:'Single Leg Quad Extensions',sets:'4x12 each drop 15',b:['tb-drop'],note:'Drop set after each set · squeeze at extension'},
                  b:{name:'DB Romanian Deadlifts',sets:'5x5',b:['tb-lowrep'],note:'DBs pre-staged at extension machine · low rep · strong hip hinge'}},
    {type:'single',num:3,name:'Neutral Stance Goblet Squats',sets:'4x10',b:['tb-midset'],note:'4 sec negative · 4:0:1:0 · upright torso'},
    {type:'single',num:4,name:'Single Leg Split Squats + Calf Raises',sets:'4x10 each · 4x20 calves',b:['tb-midset','tb-highrep'],note:'3 sec negative · control the descent'},
  ],
  2:[{type:'single',num:1,name:'Barbell Squat',sets:'5x12',b:['tb-highset'],note:'High sets · 3 sec negative · squeeze at top'},{type:'single',num:2,name:'Romanian Deadlift',sets:'4x10',b:['tb-midset'],note:'Strong hip hinge'},{type:'single',num:3,name:'Goblet Squat',sets:'4x12',b:['tb-midset'],note:'Controlled · 2 sec pause'},{type:'single',num:4,name:'Leg Press',sets:'4x12 drop 15 each',b:['tb-highrep'],note:'Drop set · balance focus'},{type:'ss',num:5,a:{name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'High sets'},b:{name:'DB Reverse Lunges (in place)',sets:'3xfailure',b:['tb-amrap'],note:'DBs pre-staged at extension machine · push to failure'}}],
  3:[{type:'single',num:1,name:'Barbell Squat',sets:'4x12',b:['tb-midset'],note:'Full ROM'},{type:'single',num:2,name:'Romanian Deadlift',sets:'4x10',b:['tb-midset'],note:'Strong hip hinge · bilateral'},{type:'single',num:3,name:'Goblet Squat (wide stance, toes out)',sets:'4x12',b:['tb-midset'],note:'Heels flat · deep squat'},{type:'ss',num:4,a:{name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'3 sec negative · both legs'},b:{name:'DB Reverse Lunges (in place)',sets:'4x15',b:['tb-highrep'],note:'DBs pre-staged at extension machine · drive through front heel'}}],
  4:[{type:'single',num:1,name:'Barbell Squat',sets:'5x5',b:['tb-lowrep'],note:'Strong hip hinge'},{type:'single',num:2,name:'Romanian Deadlift',sets:'4x10',b:['tb-midset'],note:'Leg Press heavy · slow controlled descent'},{type:'single',num:3,name:'Goblet Squat (wide stance, toes out)',sets:'4x15',b:['tb-highrep'],note:'High rep · upright torso'},{type:'ss',num:4,a:{name:'Quad Extensions',sets:'3xfailure',b:['tb-amrap'],note:'AMRAP · to failure'},b:{name:'DB Reverse Lunges (in place)',sets:'3xfailure',b:['tb-amrap'],note:'DBs pre-staged at extension machine · failure each side'}}]
},
    summary: {
      subtitle: "Quads · Hamstrings · Glutes",
      rows: [
      { icon: "🔀", name: "Quad Extensions × DB Goblet Squats", sets: "5 sets", reps: "12 reps / 12,10,8,8" },
      { icon: "🏋️", name: "Single Leg Extensions × DB RDLs", sets: "5 sets", reps: "12 drop / 5 reps" },
      { icon: "🦵", name: "Neutral Stance Goblet Squats", sets: "4 sets", reps: "10 reps — 4 sec negative" },
      { icon: "⚙️", name: "Single Leg Split Squats + Calf Raises", sets: "4 sets", reps: "10 reps each / 20 calves" }
    ],
      totals: [
      { val: "18–19 sets", label: "Total Sets" },
      { val: "~220–260 reps total", label: "Est. Reps" },
      { val: "40–55 min", label: "Est. Time" }
    ]
    },
    nextWorkout: null
  },
  "s3-back-bis-forearms": {
    file: "mc-s3-back-bis-forearms.html",
    accent: "#34d399", accentRgb: "52,211,153",
    headerGrad: ["#082e1a", "#061a10"],
    titleTag: "MC — Back / Biceps / Forearms", eyebrow: "💪 Split 3", pageTitle: "Back / Biceps / Forearms",
    backHref: "mc-split3.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Pendlay Barbell Rows',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · reset each rep · explosive pull'},
    {type:'single',num:2,name:'Wide Grip Lat Pulldown',sets:'5x12',b:['tb-highset'],note:'High sets · full stretch at top'},
    {type:'ss',num:3,a:{name:'Double Arm DB Incline Row',sets:'4x12',b:['tb-midset'],note:'Bilateral · 2 sec pause at top'},
                  b:{name:'Spider Curls',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · squeeze at peak contraction'}},
    {type:'single',num:4,name:'Pinwheel Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · alternate arms'},
    {type:'ss',num:5,a:{name:'Barbell Curls (2 close grip / 2 wide grip)',sets:'4x10',b:['tb-midset','tb-tempo'],note:'2 sets each grip · 2 sec pause at top · 1:0:1:2'},
                  b:{name:'Kneeling Reverse Forearm Curls (bench supported)',sets:'4x20',b:['tb-highrep'],note:'20 reps · 2 sec pause · 1:0:1:2'}},
    {type:'single',num:6,name:'Bench Supported Kneeling Forearm Curl',sets:'4x15',b:['tb-highrep','tb-tempo'],note:'12-15 reps · 2 sec pause at top · forearm squeeze'},
  ],
  2:[{type:'single',num:1,name:'Pull-Ups',sets:'5x10',b:['tb-highset'],note:'Full stretch at top'},{type:'ss',num:2,a:{name:'Incline DB Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy bilateral · 2 sec pause at top'},b:{name:'Incline DB Curl',sets:'4x12',b:['tb-midset'],note:'Alternate arms · full supination · same incline bench'}},{type:'ss',num:3,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Drive the bar'},b:{name:'Cable Curl (low pulley)',sets:'4x15',b:['tb-highrep'],note:'Same cable column · squeeze at peak · bilateral'}},{type:'ss',num:4,a:{name:'T-Bar Row',sets:'4x12',b:['tb-midset'],note:'Both grips'},b:{name:'DB Hammer Curl',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at T-bar machine · neutral grip'}},{type:'single',num:5,name:'Wrist Roller or Plate Pinch',sets:'4x30sec',b:['tb-midset'],note:'2 sec pause · forearm squeeze'}],
  3:[{type:'single',num:1,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Explosive pull · reset each rep'},{type:'ss',num:2,a:{name:'Incline DB Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy bilateral · 2 sec pause at top'},b:{name:'Incline DB Curl',sets:'4x12',b:['tb-midset'],note:'Alternate arms · full supination'}},{type:'ss',num:3,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Elbows tight · 2 sec pause'},b:{name:'Cable Curl (low pulley)',sets:'4x15',b:['tb-highrep'],note:'Same cable column · squeeze at peak · bilateral'}},{type:'ss',num:4,a:{name:'T-Bar Row',sets:'4x12',b:['tb-midset'],note:'Drive elbows back'},b:{name:'DB Reverse Curl',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at T-bar machine · forearm strength'}},{type:'single',num:5,name:'Wrist Roller or Plate Pinch',sets:'4x30sec',b:['tb-midset'],note:'Forearm and grip strength'}],
  4:[{type:'single',num:1,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Explosive pull · reset each rep'},{type:'ss',num:2,a:{name:'Incline DB Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy bilateral · 2 sec pause at top'},b:{name:'Incline DB Curl',sets:'4x12',b:['tb-midset'],note:'2 sec pause at peak'}},{type:'ss',num:3,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Elbows tight'},b:{name:'Cable Curl (low pulley)',sets:'4x15',b:['tb-highrep'],note:'Same cable column · squeeze at peak · bilateral'}},{type:'ss',num:4,a:{name:'T-Bar Row',sets:'4x12',b:['tb-midset'],note:'Drive back hard'},b:{name:'DB Reverse Curl',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at T-bar machine · strict form · forearm focus'}},{type:'single',num:5,name:'Wrist Roller or Plate Pinch',sets:'5x30sec',b:['tb-highset'],note:'Forearm and grip endurance'}]
},
    summary: {
      subtitle: "Lats · Mid Back · Biceps · Forearms",
      rows: [
      { icon: "🏋️", name: "Pendlay Barbell Rows", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "⚡", name: "Wide Grip Lat Pulldown", sets: "5 sets", reps: "12 reps — high sets" },
      { icon: "🔀", name: "DB Incline Row × Spider Curls", sets: "4 sets", reps: "12 reps / 15 reps" },
      { icon: "📈", name: "Pinwheel Curls", sets: "4 sets", reps: "12,10,8,8 pyramid" },
      { icon: "🔀", name: "Barbell Curls × Kneeling Forearm Curls", sets: "4 sets", reps: "10 reps / 20 reps" },
      { icon: "💪", name: "Bench Supported Forearm Curl", sets: "4 sets", reps: "15 reps — 2 sec pause" }
    ],
      totals: [
      { val: "26–27 sets", label: "Total Sets" },
      { val: "~300–350 reps total", label: "Est. Reps" },
      { val: "55–70 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s3-legs-back.html", label: "Up Next in this Split", dotColor: "#34d399", name: "Legs & Back" }
  },
  "s3-back": {
    file: "mc-s3-back.html",
    accent: "#34d399", accentRgb: "52,211,153",
    headerGrad: ["#082e1a", "#061a10"],
    titleTag: "MC — Back", eyebrow: "🔙 Split 3", pageTitle: "Back",
    backHref: "mc-split3.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Barbell Row',sets:'5x5 then 12,10,8,8',b:['tb-lowrep','tb-pyramid'],note:'Pyramid up · reset each rep · drive elbows back'},
    {type:'single',num:2,name:'V Grip Pulldowns',sets:'5x10',b:['tb-highset'],note:'High sets · 2 sec pause at bottom · 1:0:1:2'},
    {type:'single',num:3,name:'DB Slight Incline Row',sets:'4x12',b:['tb-midset'],note:'Bilateral · 2 sec pause at top · 1:0:1:2'},
    {type:'ss',num:4,a:{name:'Reverse Grip Pulldowns',sets:'4x10',b:['tb-midset'],note:'Underhand grip · squeeze at bottom'},
                  b:{name:'Straight Arm Lat Pulldowns',sets:'4x20',b:['tb-highrep'],note:'20 reps · constant tension · bilateral'}},
    {type:'single',num:5,name:'High Incline DB Row',sets:'4x12',b:['tb-midset','tb-tempo'],note:'High incline · 2 sec pause at top · 1:0:1:2'},
  ],
  2:[{type:'single',num:1,name:'Pull-Ups',sets:'5x12',b:['tb-highset'],note:'High sets · full hang · change angle'},{type:'single',num:2,name:'Seated Cable Row',sets:'5x12 each',b:['tb-highset'],note:'High sets · strict form'},{type:'single',num:3,name:'T-Bar Row',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy pull'},{type:'ss',num:4,a:{name:'Wide Grip Lat Pulldowns',sets:'4x12',b:['tb-midset'],note:'Constant tension · bilateral'},b:{name:'V-Grip Pulldown',sets:'4x10',b:['tb-midset'],note:'2 sec pause at top · same cable station'}}],
  3:[{type:'single',num:1,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Failure · full hang'},{type:'single',num:2,name:'Barbell Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy · hip hinge'},{type:'single',num:3,name:'Seated Cable Row',sets:'12,10,8,8',b:['tb-pyramid'],note:'High rep · heels elevated'},{type:'ss',num:4,a:{name:'Seated Cable Row',sets:'4x15',b:['tb-highrep'],note:'High rep · heels elevated'},b:{name:'Straight Arm Lat Pulldowns',sets:'4x12',b:['tb-midset'],note:'Same cable as row · constant tension · feel the lat stretch'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'4x10 each',b:['tb-midset'],note:'Torso upright · drive through heel'}],
  4:[{type:'single',num:1,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Failure · full hang'},{type:'single',num:2,name:'Barbell Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy · hip hinge'},{type:'single',num:3,name:'Seated Cable Row',sets:'12,10,8,8',b:['tb-pyramid'],note:'Heavy · slow controlled descent'},{type:'ss',num:4,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Elbows tight · upright torso'},b:{name:'Straight Arm Lat Pulldowns',sets:'4x12',b:['tb-midset'],note:'Same cable as row · feel the lat stretch'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'3xfailure',b:['tb-amrap'],note:'Walk to failure · required'}]
},
    summary: {
      subtitle: "Lats · Mid Back · Rear Delts",
      rows: [
      { icon: "🏋️", name: "Barbell Row", sets: "5 sets", reps: "5 reps then 12,10,8,8" },
      { icon: "⚡", name: "V Grip Pulldowns", sets: "5 sets", reps: "10 reps — high sets" },
      { icon: "📐", name: "DB Slight Incline Row", sets: "4 sets", reps: "12 reps — 2 sec pause" },
      { icon: "🔀", name: "Reverse Grip PD × Straight Arm PD", sets: "4 sets", reps: "10 reps / 20 reps" },
      { icon: "📐", name: "High Incline DB Row", sets: "4 sets", reps: "12 reps — 2 sec pause" }
    ],
      totals: [
      { val: "22–23 sets", label: "Total Sets" },
      { val: "~220–260 reps total", label: "Est. Reps" },
      { val: "45–55 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s3-legs.html", label: "Up Next in this Split", dotColor: "#34d399", name: "Legs" }
  },
  "s3-chest": {
    file: "mc-s3-chest.html",
    accent: "#34d399", accentRgb: "52,211,153",
    headerGrad: ["#082e1a", "#061a10"],
    titleTag: "MC — Chest", eyebrow: "💪 Split 3", pageTitle: "Chest",
    backHref: "mc-split3.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Barbell Bench or DB Bench',sets:'5x5 then 5x12',b:['tb-lowrep','tb-highset'],note:'Low rep · heavy compound · drive the bar'},
    {type:'single',num:2,name:'Barbell Bench',sets:'4x10',b:['tb-midset','tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0 · strict form'},
    {type:'single',num:3,name:'Incline Barbell or DB Bench',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · increase weight each set'},
    {type:'ss',num:4,a:{name:'Chest Fly Machine (pronated grip)',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · 2 sec pause at peak'},
                  b:{name:'Push-Ups',sets:'4xfailure',b:['tb-amrap'],note:'AMRAP · to failure · full ROM'}},
    {type:'single',num:5,name:'DB Chest Flies',sets:'4x8',b:['tb-midset','tb-tempo'],note:'5-10 sec stretch hold at bottom · 5-8 reps · deep eccentric'},
  ],
  2:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · strict form'},{type:'single',num:2,name:'Incline DB Press',sets:'5x12',b:['tb-highset'],note:'High sets · full ROM'},{type:'single',num:3,name:'Low Cable Chest Fly',sets:'5x12',b:['tb-highset'],note:'High sets · constant tension · squeeze at peak'},{type:'ss',num:4,a:{name:'Decline DB Press',sets:'4x15',b:['tb-highrep'],note:'High rep · tricep emphasis'},b:{name:'BW Push-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Full ROM · to failure · same bench area as press'}},{type:'single',num:5,name:'Cable Crossover',sets:'4x12',b:['tb-midset'],note:'Deep eccentric'}],
  3:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · strict form'},{type:'single',num:2,name:'Incline DB Press',sets:'5x12',b:['tb-highset'],note:'Heavy sets then high volume'},{type:'single',num:3,name:'Low Cable Chest Fly',sets:'5x12',b:['tb-highset'],note:'High sets · constant tension · squeeze at peak'},{type:'ss',num:4,a:{name:'Decline DB Press',sets:'4x15',b:['tb-highrep'],note:'High rep · tricep emphasis'},b:{name:'BW Push-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Full ROM · to failure · same bench area as press'}},{type:'single',num:5,name:'Cable Crossover',sets:'4x12',b:['tb-midset'],note:'Deep eccentric'}],
  4:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · strict form'},{type:'single',num:2,name:'Incline DB Press',sets:'4x12',b:['tb-midset'],note:'2 sec pause at peak · constant tension'},{type:'single',num:3,name:'Low Cable Chest Fly',sets:'4x12',b:['tb-midset'],note:'2 sec pause at peak · constant tension'},{type:'ss',num:4,a:{name:'Decline DB Press',sets:'4x15',b:['tb-highrep'],note:'2 sec negative · tricep emphasis'},b:{name:'BW Push-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Full ROM · to failure · same bench area as press'}},{type:'single',num:5,name:'Cable Crossover',sets:'4x15',b:['tb-highrep'],note:'High rep pump · squeeze at peak'}]
},
    summary: {
      subtitle: "Upper · Mid · Lower Chest",
      rows: [
      { icon: "🏋️", name: "Barbell or DB Bench", sets: "5 sets", reps: "5 reps then 5×12" },
      { icon: "⏱️", name: "Barbell Bench (2 sec pause)", sets: "4 sets", reps: "10 reps — tempo" },
      { icon: "📈", name: "Incline Barbell or DB Bench", sets: "4 sets", reps: "12,10,8,8 pyramid" },
      { icon: "🔀", name: "Fly Machine × Push-Ups", sets: "4 sets", reps: "15 reps / AMRAP" },
      { icon: "⏱️", name: "DB Chest Flies", sets: "4 sets", reps: "5-8 reps — 5-10 sec stretch hold" }
    ],
      totals: [
      { val: "21–22 sets", label: "Total Sets" },
      { val: "~200–250 reps total", label: "Est. Reps" },
      { val: "45–60 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s3-shoulders-tris.html", label: "Up Next in this Split", dotColor: "#34d399", name: "Shoulders & Tris" }
  },
  "s3-legs-back": {
    file: "mc-s3-legs-back.html",
    accent: "#34d399", accentRgb: "52,211,153",
    headerGrad: ["#082e1a", "#061a10"],
    titleTag: "MC — Legs & Back", eyebrow: "🦵 Split 3", pageTitle: "Legs & Back",
    backHref: "mc-split3.html",
    warmup: { icon: "🔥", text: "Pull-Ups (AMRAP)", sub: "Warmup — max reps · dead hang start" },
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Barbell Good Mornings',sets:'4x10',b:['tb-midset','tb-tempo'],note:'2 sec pause at bottom · 1:2:1:0 · hip hinge'},
                  b:{name:'Barbell Row',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · same barbell area · drive elbows back hard'}},
    {type:'single',num:2,name:'Hack Squat',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full ROM · 3 sec negative'},
    {type:'ss',num:3,a:{name:'Double Arm Bent Over DB Row',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at peak'},
                  b:{name:'Goblet Squats',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · heels elevated · upright torso'}},
    {type:'ss',num:4,a:{name:'DB RDLs',sets:'4x12',b:['tb-midset'],note:'Bilateral · feel the stretch every rep'},
                  b:{name:'Reverse DB Flies',sets:'4x20',b:['tb-highrep'],note:'20 reps · bilateral · rear delt squeeze'}},
  ],
  2:[{type:'single',num:1,name:'Barbell Squat',sets:'4x10',b:['tb-midset'],note:'Heavy · hip hinge'},{type:'single',num:2,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Failure · full hang'},{type:'single',num:3,name:'Leg Press',sets:'4x12',b:['tb-midset'],note:'Full ROM'},{type:'ss',num:4,a:{name:'Seated Cable Row',sets:'4x15',b:['tb-highrep'],note:'High rep · heels elevated'},b:{name:'DB Romanian Deadlifts',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at cable station · bilateral · feel the hamstring stretch'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'4x12 each leg',b:['tb-midset'],note:'Torso upright · required for leg days'}],
  3:[{type:'single',num:1,name:'Barbell Squat',sets:'4x10',b:['tb-midset'],note:'Heavy · hip hinge'},{type:'single',num:2,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Failure · full hang'},{type:'single',num:3,name:'Hack Squat (low foot placement)',sets:'4x10',b:['tb-midset'],note:'Quad emphasis'},{type:'ss',num:4,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'High rep · heels elevated'},b:{name:'DB Romanian Deadlifts',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at cable station · feel the hamstring stretch'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'4x12 each leg',b:['tb-midset'],note:'Continuous · torso upright · required'}],
  4:[{type:'single',num:1,name:'Barbell Squat',sets:'4x10',b:['tb-midset'],note:'3 sec negative'},{type:'single',num:2,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'3 sec negative · bilateral'},{type:'single',num:3,name:'Hack Squat (low foot placement)',sets:'4x10',b:['tb-midset'],note:'Heavy · full depth'},{type:'ss',num:4,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Elbows tight'},b:{name:'DB Romanian Deadlifts',sets:'5x12',b:['tb-highset'],note:'DBs pre-staged at cable station · bilateral'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'3xfailure',b:['tb-amrap'],note:'Walk to technical failure · required'}]
},
    summary: {
      subtitle: "Quads · Posterior Chain · Lats · Traps",
      rows: [
      { icon: "💀", name: "Pull-Ups Warmup (AMRAP)", sets: "1+ sets", reps: "Max reps" },
      { icon: "🔀", name: "Barbell Good Mornings × Pull-Ups", sets: "4 sets", reps: "10 reps / failure" },
      { icon: "🏋️", name: "Barbell Row", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "📈", name: "Hack Squat", sets: "4 sets", reps: "12,10,8,8 pyramid" },
      { icon: "🔀", name: "Double Arm DB Row × Goblet Squats", sets: "5 sets", reps: "12 reps / 15 reps" },
      { icon: "🔀", name: "DB RDLs × Reverse DB Flies", sets: "4 sets", reps: "12 reps / 20 reps" }
    ],
      totals: [
      { val: "23–24 sets", label: "Total Sets" },
      { val: "~270–310 reps total", label: "Est. Reps" },
      { val: "50–65 min", label: "Est. Time" }
    ]
    },
    nextWorkout: null
  },
  "s3-legs": {
    file: "mc-s3-legs.html",
    accent: "#34d399", accentRgb: "52,211,153",
    headerGrad: ["#082e1a", "#061a10"],
    titleTag: "MC — Legs", eyebrow: "🦵 Split 3", pageTitle: "Legs",
    backHref: "mc-split3.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Barbell Squats (shoulder width)',sets:'5x10',b:['tb-highset'],note:'High sets · 3 sec negative · 4:0:1:0'},
    {type:'single',num:2,name:'Deadlifts',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy bilateral · reset each rep'},
    {type:'single',num:3,name:'Leg Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · increase weight each set'},
    {type:'ss',num:4,a:{name:'DB RDLs',sets:'4x12',b:['tb-midset'],note:'Bilateral DBs · feel the hamstring stretch'},
                  b:{name:'Close Stance Goblet Squats',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · heels elevated · upright torso'}},
  ],
  2:[{type:'single',num:1,name:'Smith Machine Cannonball Squats',sets:'5x12',b:['tb-highset'],note:'High sets · close stance · deep squat'},{type:'single',num:2,name:'Hack Squat (low foot placement)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · quad position angle'},{type:'ss',num:3,a:{name:'Leg Press (feet together, close stance)',sets:'4x20',b:['tb-highrep'],note:'High rep · quad pump · close stance'},b:{name:'DB Reverse Lunges (in place)',sets:'5x12',b:['tb-highset'],note:'DBs pre-staged at leg press · torso upright · drive through front heel'}},{type:'single',num:4,name:'Smith Machine Hip Thrust',sets:'4x15',b:['tb-highrep'],note:'High rep burnout'}],
  3:[{type:'single',num:1,name:'Barbell Squat',sets:'4x10',b:['tb-midset'],note:'3 sec negative · on descent · both legs'},{type:'single',num:2,name:'Leg Press (feet together)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full ROM'},{type:'single',num:3,name:'Quad Extensions',sets:'4x12',b:['tb-midset'],note:'2 sec pause at top'},{type:'ss',num:4,a:{name:'Smith Machine Hip Thrust',sets:'4x15',b:['tb-highrep'],note:'Heavy · bilateral'},b:{name:'DB Romanian Deadlifts',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged near Smith Machine · bilateral · hip hinge · feel the stretch'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'4x15',b:['tb-highrep'],note:'Continuous · drive through front heel · required'}],
  4:[{type:'single',num:1,name:'Barbell Squat',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 3 sec negative · both legs'},{type:'single',num:2,name:'Leg Press (feet together)',sets:'4x10',b:['tb-midset'],note:'Heavy · slow controlled descent'},{type:'single',num:3,name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at top'},{type:'ss',num:4,a:{name:'Smith Machine Hip Thrust',sets:'4x15',b:['tb-highrep'],note:'Full extension · pause'},b:{name:'DB Romanian Deadlifts',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged near Smith Machine · bilateral · feel the hamstring stretch'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'3xfailure',b:['tb-amrap'],note:'Walk to technical failure · required'}]
},
    summary: {
      subtitle: "Quads · Hamstrings · Posterior Chain",
      rows: [
      { icon: "🏋️", name: "Barbell Squats", sets: "5 sets", reps: "10 reps — high sets" },
      { icon: "💀", name: "Deadlifts", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "📈", name: "Leg Press", sets: "4 sets", reps: "12,10,8,8 pyramid" },
      { icon: "🔀", name: "DB RDLs × Close Stance Goblet Squats", sets: "4 sets", reps: "12 reps / 15 reps" }
    ],
      totals: [
      { val: "18–20 sets", label: "Total Sets" },
      { val: "~200–240 reps total", label: "Est. Reps" },
      { val: "40–55 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s3-chest.html", label: "Up Next in this Split", dotColor: "#34d399", name: "Chest" }
  },
  "s3-shoulders-tris": {
    file: "mc-s3-shoulders-tris.html",
    accent: "#34d399", accentRgb: "52,211,153",
    headerGrad: ["#082e1a", "#061a10"],
    titleTag: "MC — Shoulders & Triceps", eyebrow: "💥 Split 3", pageTitle: "Shoulders & Triceps",
    backHref: "mc-split3.html",
    warmup: null,
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Seated Side Lateral Raises',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at top'},
                  b:{name:'Seated DB Overhead Tricep Extension',sets:'4x10',b:['tb-midset','tb-tempo'],note:'Seated at same area · 2 sec pause at bottom · 1:2:1:0'}},
    {type:'ss',num:2,a:{name:'DB Front Raises',sets:'4x12',b:['tb-midset'],note:'2 sec pause at top · anterior delt focus · same DB area'},
                  b:{name:'Seated Overhead DB Tricep Extension',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · bilateral · full overhead extension'}},
    {type:'single',num:3,name:'Barbell or DB Shoulder Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · strict press'},
    {type:'ss',num:4,a:{name:'Cable Front Raise',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · anterior delt pump · same cable as pushdowns'},
                  b:{name:'Rope Pushdowns',sets:'4x20',b:['tb-highrep'],note:'20 reps · bilateral · squeeze at bottom'}},
    {type:'single',num:5,name:'Wide Grip Tricep Pulldowns',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · bilateral · 2 sec pause at bottom'},
  ],
  2:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at top'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec pause at bottom'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · tricep emphasis'},b:{name:'DB Rear Delt Fly',sets:'3xfailure',b:['tb-amrap'],note:'Seated · same bench as shoulder press · push to failure'}},{type:'ss',num:3,a:{name:'Face Pulls',sets:'4x15',b:['tb-highrep'],note:'High rep · anterior delt pump'},b:{name:'Overhead Cable Tricep Extension',sets:'4x12',b:['tb-midset'],note:'Same cable as face pulls · deep stretch · full ROM'}},{type:'ss',num:4,a:{name:'Cable Lateral Raise',sets:'4x12',b:['tb-midset'],note:'Strict form · pause at top'},b:{name:'Rope Pushdowns',sets:'4x15',b:['tb-highrep'],note:'High sets · bilateral'}}],
  3:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'5x12',b:['tb-highset'],note:'High sets · constant tension · squeeze at top'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'Bilateral · squeeze at bottom'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · tricep emphasis'},b:{name:'DB Rear Delt Fly',sets:'3xfailure',b:['tb-amrap'],note:'Seated · same bench as shoulder press · push to failure'}},{type:'ss',num:3,a:{name:'Cable Lateral Raise',sets:'4x15',b:['tb-highrep'],note:'Constant tension · squeeze at top'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'Bilateral · squeeze at bottom'}},{type:'ss',num:4,a:{name:'Face Pulls',sets:'4x12',b:['tb-midset'],note:'2 sec hold at peak · rear delt focus'},b:{name:'Overhead Cable Tricep Extension',sets:'4x12',b:['tb-midset'],note:'Same cable as face pulls · bilateral · full overhead extension'}}],
  4:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec pause at top'},b:{name:'Rope Pushdowns',sets:'4x15',b:['tb-highrep'],note:'High rep · bilateral · squeeze at bottom'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · tricep emphasis'},b:{name:'DB Rear Delt Fly',sets:'3xfailure',b:['tb-amrap'],note:'Seated · same bench as shoulder press · push to failure'}},{type:'ss',num:3,a:{name:'Cable Lateral Raise',sets:'4x15',b:['tb-highrep'],note:'High rep · 2 sec pause at top'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at bottom'}},{type:'ss',num:4,a:{name:'Face Pulls',sets:'4x15',b:['tb-highrep'],note:'High rep · 2 sec hold at peak'},b:{name:'Overhead Cable Tricep Extension',sets:'4x12',b:['tb-midset'],note:'Same cable as face pulls · full extension · overhead'}}]
},
    summary: {
      subtitle: "Anterior · Lateral · Posterior Delts · Triceps",
      rows: [
      { icon: "🔀", name: "Seated Lateral Raises × DB Overhead Tri Extension", sets: "4–5 sets", reps: "12 reps / 10 reps" },
      { icon: "🔀", name: "DB Front Raises × Overhead DB Extension", sets: "4 sets", reps: "12 reps / 15 reps" },
      { icon: "🏋️", name: "Barbell or DB Shoulder Press", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "🔀", name: "Cable Front Raises × Rope Pushdowns", sets: "4 sets", reps: "15 reps / 20 reps" },
      { icon: "📈", name: "Wide Grip Tricep Pulldowns", sets: "4 sets", reps: "12,10,8,8 pyramid" }
    ],
      totals: [
      { val: "21–23 sets", label: "Total Sets" },
      { val: "~270–310 reps total", label: "Est. Reps" },
      { val: "45–60 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s3-back-bis-forearms.html", label: "Up Next in this Split", dotColor: "#34d399", name: "Back/Bis/Forearms" }
  },
  "s4-bis-tris": {
    file: "mc-s4-bis-tris.html",
    accent: "#fbbf24", accentRgb: "251,191,36",
    headerGrad: ["#271800", "#1a1000"],
    titleTag: "MC — Biceps & Triceps", eyebrow: "💥 Split 4", pageTitle: "Biceps & Triceps",
    backHref: "mc-split4.html",
    warmup: null,
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Pinwheel Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · alternate arms · neutral grip'},
                  b:{name:'Lying DB Extension + Cross Chest Extension',sets:'4x10',b:['tb-midset'],note:'1 rep to ear + 1 rep across chest to opposite ear = 1 rep'}},
    {type:'ss',num:2,a:{name:'Alternating Incline / Hammer Curl',sets:'5x12',b:['tb-highset'],note:'High sets · alternate between incline and hammer each set'},
                  b:{name:'Bent Over DB Tricep Kickbacks',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · bilateral · squeeze at full extension'}},
    {type:'ss',num:3,a:{name:'Concentration Curls',sets:'4x12',b:['tb-midset','tb-tempo'],note:'2 sec pause at peak · 1:0:1:2 · single arm'},
                  b:{name:'Skull Crushers',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · 2 sec pause at bottom'}},
    {type:'ss',num:4,a:{name:'Cable Curl (low pulley)',sets:'4x20',b:['tb-highrep'],note:'20 reps · same cable as pushdown · constant tension · squeeze at top'},
                  b:{name:'Tricep Pushdown',sets:'4x20',b:['tb-highrep'],note:'20 reps · bilateral · constant tension'}},
  ],
  2:[{type:'ss',num:1,a:{name:'Double Arm DB Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full supination at top'},b:{name:'DB Overhead Tricep Extension',sets:'5x5',b:['tb-lowrep'],note:'Same DBs as curls · low rep · 2 sec pause at bottom'}},{type:'ss',num:2,a:{name:'Barbell Curls',sets:'5x12',b:['tb-highset'],note:'High sets · strict form'},b:{name:'Skull Crushers',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec negative · squeeze at bottom'}},{type:'ss',num:3,a:{name:'Spider Curls',sets:'4x10',b:['tb-midset'],note:'2 sec pause at peak'},b:{name:'DB Tricep Kickbacks',sets:'5x12',b:['tb-highset'],note:'Same incline bench as spider curls · bilateral · squeeze at full extension'}}],
  3:[{type:'ss',num:1,a:{name:'Double Arm DB Curls',sets:'5x12',b:['tb-highset'],note:'High sets · full supination'},b:{name:'DB Overhead Tricep Extension',sets:'4x10',b:['tb-midset'],note:'Same DBs as curls · lean head forward · full ROM'}},{type:'ss',num:2,a:{name:'Barbell Curls',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · strict form'},b:{name:'Skull Crushers',sets:'4x10',b:['tb-midset'],note:'2 sec pause at bottom · 1:2:1:0'}},{type:'ss',num:3,a:{name:'Spider Curls',sets:'4x12',b:['tb-midset'],note:'2 sec pause at peak'},b:{name:'DB Tricep Kickbacks',sets:'4x20',b:['tb-highrep'],note:'Same incline bench as spider curls · bilateral · squeeze at top'}}],
  4:[{type:'ss',num:1,a:{name:'Double Arm DB Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full supination'},b:{name:'DB Overhead Tricep Extension',sets:'5x12',b:['tb-highset'],note:'Same DBs as curls · high sets · lean head forward'}},{type:'ss',num:2,a:{name:'Barbell Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · strict form'},b:{name:'Skull Crushers',sets:'4x20',b:['tb-highrep'],note:'High rep pump · moderate weight'}},{type:'ss',num:3,a:{name:'Spider Curls',sets:'4x15',b:['tb-highrep'],note:'High rep · squeeze at peak'},b:{name:'DB Tricep Kickbacks',sets:'4x20',b:['tb-highrep'],note:'Same incline bench as spider curls · bilateral · high rep pump'}}]
},
    summary: {
      subtitle: "Biceps · Triceps",
      rows: [
      { icon: "🔀", name: "Pinwheel Curls × Lying DB Extension", sets: "4 sets", reps: "12,10,8,8 / 10 reps" },
      { icon: "🔀", name: "Incline/Hammer Curl × DB Kickbacks", sets: "5 sets", reps: "12 reps / 15 reps" },
      { icon: "🔀", name: "Concentration Curls × Skull Crushers", sets: "4 sets", reps: "12 reps / 5 reps" },
      { icon: "🔀", name: "Barbell Curl × Tricep Pushdown", sets: "4 sets", reps: "20 reps each" }
    ],
      totals: [
      { val: "17–18 sets", label: "Total Sets" },
      { val: "~260–300 reps total", label: "Est. Reps" },
      { val: "40–55 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s4-legs.html", label: "Up Next in this Split", dotColor: "#f59e0b", name: "Legs" }
  },
  "s4-chest-tris": {
    file: "mc-s4-chest-tris.html",
    accent: "#fbbf24", accentRgb: "251,191,36",
    headerGrad: ["#271800", "#1a1000"],
    titleTag: "MC — Chest & Triceps", eyebrow: "💪 Split 4", pageTitle: "Chest & Triceps",
    backHref: "mc-split4.html",
    warmup: null,
    data: {
  1:[
    {type:'ss',num:1,a:{name:'Close Grip DB Press (DBs touching)',sets:'5x12',b:['tb-highset'],note:'DBs touching throughout · high sets · tricep emphasis'},
                  b:{name:'DB Overhead Tricep Extension',sets:'4x10',b:['tb-midset'],note:'Seated at same bench as press · bilateral · full ROM'}},
    {type:'single',num:2,name:'Barbell Close Grip Bench',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · strict tricep press'},
    {type:'single',num:3,name:'Barbell or DB 1.5 Rep Bench',sets:'4x10',b:['tb-midset'],note:'Full rep + quarter rep at bottom = 1 · feel the eccentric'},
    {type:'single',num:4,name:'Skull Crushers',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 2 sec pause at bottom · 1:2:1:0'},
    {type:'single',num:5,name:'Reverse Tricep Pushdowns',sets:'4x20',b:['tb-highrep'],note:'20 reps · underhand bilateral · squeeze at bottom'},
    {type:'single',num:6,name:'Cable Decline or Incline Flies',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · bilateral cable · constant tension'},
  ],
  2:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · strict form'},{type:'single',num:2,name:'Incline DB Press',sets:'5x12',b:['tb-highset'],note:'High sets · full ROM'},{type:'single',num:3,name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'High rep · deep stretch'},{type:'ss',num:4,a:{name:'Decline DB Press',sets:'4x12',b:['tb-midset'],note:'Heavy · tricep emphasis'},b:{name:'Diamond Push-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Full ROM · to failure'}},{type:'single',num:5,name:'Low Cable Chest Fly',sets:'4x15',b:['tb-highrep'],note:'High rep · deep eccentric · squeeze at top'}],
  3:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · tricep emphasis'},{type:'single',num:2,name:'Incline DB Press',sets:'5x12',b:['tb-highset'],note:'High sets · strict tricep press'},{type:'single',num:3,name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'High rep · peak contraction'},{type:'ss',num:4,a:{name:'Decline DB Press',sets:'4x12',b:['tb-midset'],note:'High rep · tricep emphasis'},b:{name:'Diamond Push-Ups',sets:'3xfailure',b:['tb-amrap'],note:'AMRAP · full ROM · tricep emphasis'}},{type:'single',num:5,name:'Low Cable Chest Fly',sets:'5x12',b:['tb-highset'],note:'High sets · constant tension · squeeze'}],
  4:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · tricep emphasis'},{type:'single',num:2,name:'Incline DB Press',sets:'4x12',b:['tb-midset'],note:'Moderate weight · strict form'},{type:'single',num:3,name:'Pec Deck Fly',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec peak hold'},{type:'ss',num:4,a:{name:'Decline DB Press',sets:'4x12',b:['tb-midset'],note:'Heavy · full ROM'},b:{name:'Diamond Push-Ups',sets:'3xfailure',b:['tb-amrap'],note:'AMRAP · tricep emphasis'}},{type:'single',num:5,name:'Low Cable Chest Fly',sets:'4x15',b:['tb-highrep'],note:'Squeeze at peak'}]
},
    summary: {
      subtitle: "Chest · Triceps",
      rows: [
      { icon: "🔀", name: "Close Grip DB Press × Dips", sets: "5 sets", reps: "12 reps / 10 reps" },
      { icon: "🏋️", name: "Barbell Close Grip Bench", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "⏱️", name: "Barbell or DB 1.5 Rep Bench", sets: "4 sets", reps: "10 reps — eccentric focus" },
      { icon: "📈", name: "Skull Crushers", sets: "4 sets", reps: "12,10,8,8 pyramid" },
      { icon: "🔥", name: "Reverse Tricep Pushdowns", sets: "4 sets", reps: "20 reps" },
      { icon: "🔥", name: "Cable Decline or Incline Flies", sets: "4 sets", reps: "15 reps" }
    ],
      totals: [
      { val: "26–27 sets", label: "Total Sets" },
      { val: "~280–320 reps total", label: "Est. Reps" },
      { val: "50–65 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s4-shoulders.html", label: "Up Next in this Split", dotColor: "#f59e0b", name: "Shoulders" }
  },
  "s4-legs": {
    file: "mc-s4-legs.html",
    accent: "#fbbf24", accentRgb: "251,191,36",
    headerGrad: ["#271800", "#1a1000"],
    titleTag: "MC — Legs", eyebrow: "🦵 Split 4", pageTitle: "Legs",
    backHref: "mc-split4.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Barbell or DB Goblet Squat',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · full depth'},
    {type:'ss',num:2,a:{name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'High sets · 3 sec negative · 4:0:1:0'},
                  b:{name:'DB Goblet Squats',sets:'12,10,8,8',b:['tb-pyramid'],note:'DBs pre-staged at extension machine · pyramid up · heels elevated'}},
    {type:'single',num:3,name:'Box Same Leg Step-Ups',sets:'4x12 each',b:['tb-midset'],note:'12 reps each leg · drive through heel · controlled descent'},
    {type:'single',num:4,name:'Barbell or DB RDLs',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · bilateral · feel the hamstring stretch'},
    {type:'ss',num:5,a:{name:'Calf Raises',sets:'4x20',b:['tb-highrep'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
                  b:{name:'Smith Machine Split Squats',sets:'4x10',b:['tb-midset'],note:'3 sec negative · both legs · full depth'}},
  ],
  2:[{type:'single',num:1,name:'Barbell Squat',sets:'5x12',b:['tb-highset'],note:'Push to failure · slow controlled descent'},{type:'single',num:2,name:'Hack Squat (low foot placement)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · heels elevated'},{type:'single',num:3,name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at top'},{type:'ss',num:4,a:{name:'Smith Machine Hip Thrust',sets:'4x15',b:['tb-highrep'],note:'High rep burnout'},b:{name:'DB Romanian Deadlifts',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged near Smith Machine · bilateral · feel the hamstring stretch'}}],
  3:[{type:'single',num:1,name:'Barbell Squat',sets:'4x10',b:['tb-midset'],note:'3 sec negative · on descent · both legs'},{type:'single',num:2,name:'Leg Press (feet together)',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · full ROM'},{type:'single',num:3,name:'Quad Extensions',sets:'4x12',b:['tb-midset'],note:'2 sec pause at top'},{type:'ss',num:4,a:{name:'Smith Machine Hip Thrust',sets:'4x15',b:['tb-highrep'],note:'Heavy · bilateral'},b:{name:'DB Romanian Deadlifts',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged near Smith Machine · bilateral · heavy'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'4x15',b:['tb-highrep'],note:'Continuous · drive through front heel · required'}],
  4:[{type:'single',num:1,name:'Barbell Squat',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 3 sec negative · both legs'},{type:'single',num:2,name:'Leg Press (feet together)',sets:'4x10',b:['tb-midset'],note:'Heavy · slow controlled descent'},{type:'single',num:3,name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at top'},{type:'ss',num:4,a:{name:'Smith Machine Hip Thrust',sets:'4x15',b:['tb-highrep'],note:'Full extension · pause at top'},b:{name:'DB Romanian Deadlifts',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged near Smith Machine · bilateral · feel the stretch'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'3xfailure',b:['tb-amrap'],note:'Walk to technical failure · required'}]
},
    summary: {
      subtitle: "Quads · Hamstrings · Glutes · Calves",
      rows: [
      { icon: "🏋️", name: "Barbell or DB Goblet Squat", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "🔀", name: "Quad Extensions × Seated Leg Curl", sets: "5 sets", reps: "12 reps / 12,10,8,8" },
      { icon: "🦵", name: "Box Same Leg Step-Ups", sets: "4 sets", reps: "12 reps each leg" },
      { icon: "🔥", name: "Barbell or DB RDLs", sets: "4 sets", reps: "15 reps" },
      { icon: "🔀", name: "Calf Raises × Smith Split Squats", sets: "4 sets", reps: "20 reps / 10 reps" }
    ],
      totals: [
      { val: "22–23 sets", label: "Total Sets" },
      { val: "~250–290 reps total", label: "Est. Reps" },
      { val: "45–60 min", label: "Est. Time" }
    ]
    },
    nextWorkout: null
  },
  "s4-shoulders": {
    file: "mc-s4-shoulders.html",
    accent: "#fbbf24", accentRgb: "251,191,36",
    headerGrad: ["#271800", "#1a1000"],
    titleTag: "MC — Shoulders", eyebrow: "🏔️ Split 4", pageTitle: "Shoulders",
    backHref: "mc-split4.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Side Lateral Raises (DBs outside thighs)',sets:'12,10,8,8 then 5x15',b:['tb-pyramid','tb-highset'],note:'High sets · start position outside thighs · constant tension'},
    {type:'ss',num:2,a:{name:'Side Lateral Raises (DBs at quads)',sets:'4x12',b:['tb-midset'],note:'Start at quad position · different angle activation'},
                  b:{name:'Supermans',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · full extension · 2 sec hold at top'}},
    {type:'ss',num:3,a:{name:'Standing or Incline Supported Barbell Front Raises',sets:'4x12',b:['tb-midset'],note:'Strict form · 2 sec pause at top'},
                  b:{name:'Alternating DB Front Raises',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · alternate arms · controlled eccentric'}},
    {type:'single',num:4,name:'Barbell or DB Shrugs or Barbell Upright Row',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · 2 sec pause at top · 1:0:1:2'},
  ],
  2:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'5x15',b:['tb-highset'],note:'Constant tension · squeeze at top'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'2 sec pause at bottom · heavy bilateral'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · drive the bar'},b:{name:'Side Lateral Raises',sets:'4x15',b:['tb-highrep'],note:'High rep · anterior delt pump'}},{type:'ss',num:3,a:{name:'Face Pulls',sets:'4x15',b:['tb-highrep'],note:'High rep · Moderate weight · deep stretch'},b:{name:'Overhead Cable Tricep Extension',sets:'4x12',b:['tb-midset'],note:'Strict tricep press · 2 sec negative · bilateral'}}],
  3:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'4x15',b:['tb-highrep'],note:'Constant tension · squeeze at top'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'Bilateral · squeeze at bottom'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'4x12',b:['tb-midset'],note:'Strict anterior delt focus'},b:{name:'DB Shrugs',sets:'4x15',b:['tb-highrep'],note:'Heavy · same DBs as press · 2 sec squeeze at top'}},{type:'ss',num:3,a:{name:'Face Pulls',sets:'4x12',b:['tb-midset'],note:'2 sec hold at peak · rear delt focus'},b:{name:'Overhead Cable Tricep Extension',sets:'4x12',b:['tb-midset'],note:'Same cable as face pulls · full overhead extension · bilateral'}}],
  4:[{type:'ss',num:1,a:{name:'Cable Lateral Raises',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec pause at top'},b:{name:'Rope Pushdowns',sets:'4x15',b:['tb-highrep'],note:'High rep · bilateral'}},{type:'ss',num:2,a:{name:'Seated DB Shoulder Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · heavy · strict form'},b:{name:'DB Shrugs',sets:'5x12',b:['tb-highset'],note:'Heavy · same DBs as press · increase weight each set'}},{type:'ss',num:3,a:{name:'Face Pulls',sets:'4x15',b:['tb-highrep'],note:'High rep · 2 sec hold at peak'},b:{name:'Overhead Cable Tricep Extension',sets:'4x12',b:['tb-midset'],note:'Same cable as face pulls · full extension · bilateral'}}]
},
    summary: {
      subtitle: "Anterior · Lateral · Posterior Delts · Traps",
      rows: [
      { icon: "📈", name: "Side Lateral Raises (outside thighs)", sets: "5 sets", reps: "12,10,8,8 then 5×15" },
      { icon: "🔀", name: "Side Lateral Raises × Supermans", sets: "4 sets", reps: "12 reps / 15 reps" },
      { icon: "🔀", name: "Standing/Incline Front Raises × Alt DB Raises", sets: "4 sets", reps: "12 reps / 15 reps" },
      { icon: "🏋️", name: "Barbell Shrugs or Upright Row", sets: "5 sets", reps: "5 reps — heavy" }
    ],
      totals: [
      { val: "18–19 sets", label: "Total Sets" },
      { val: "~220–260 reps total", label: "Est. Reps" },
      { val: "40–50 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s4-bis-tris.html", label: "Up Next in this Split", dotColor: "#f59e0b", name: "Bis & Tris" }
  },
  "s5-legs": {
    file: "mc-s5-legs.html",
    accent: "#a855f7", accentRgb: "168,85,247",
    headerGrad: ["#1e0a3c", "#0d0618"],
    titleTag: "MC — Legs", eyebrow: "🦵 Split 5", pageTitle: "Legs",
    backHref: "mc-split5.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Barbell or DB Goblet Squat',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · full depth · 3 sec negative'},
    {type:'ss',num:2,a:{name:'Quad Extensions',sets:'5x12',b:['tb-highset'],note:'High sets · 3 sec negative · squeeze at top'},
                  b:{name:'DB Goblet Squats',sets:'12,10,8,8',b:['tb-pyramid'],note:'DBs pre-staged at extension machine · pyramid up · heels elevated'}},
    {type:'single',num:3,name:'Leg Press',sets:'4x10',b:['tb-midset'],note:'4 sec negative · 4:0:1:0 · full ROM'},
    {type:'ss',num:4,a:{name:'Smith Machine RDLs',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · same Smith bar · feel the hamstring stretch'},
                  b:{name:'Smith Machine Split Squats',sets:'4x10 each',b:['tb-midset'],note:'Same Smith bar · 3 sec negative on descent · both legs'}},
    {type:'single',num:5,name:'Calf Raises',sets:'4x20',b:['tb-highrep'],note:'20 reps · 2 sec pause at top · 1:0:1:2'},
  ],
  2:[{type:'single',num:1,name:'Barbell Squat',sets:'4x10',b:['tb-midset'],note:'Full depth'},{type:'ss',num:2,a:{name:'Hack Squat',sets:'4x10',b:['tb-midset'],note:'3 sec negative'},b:{name:'DB RDLs',sets:'4x10',b:['tb-midset'],note:'DBs pre-staged at hack squat · bilateral · feel the stretch'}},{type:'single',num:3,name:'Leg Press (feet together)',sets:'4x12',b:['tb-midset'],note:'2 sec pause at peak'},{type:'single',num:4,name:'Romanian Deadlift',sets:'5x5 each',b:['tb-lowrep'],note:'Low rep heavy'},{type:'ss',num:5,a:{name:'Quad Extensions',sets:'4x15',b:['tb-highrep'],note:'High rep burnout'},b:{name:'DB Reverse Lunges (in place)',sets:'3xfailure',b:['tb-amrap'],note:'DBs pre-staged at extension machine · push to failure · torso upright'}}],
  3:[{type:'single',num:1,name:'Barbell Squat',sets:'4x10',b:['tb-midset'],note:'Heavy · full depth'},{type:'ss',num:2,a:{name:'Hack Squat',sets:'4x10',b:['tb-midset'],note:'Quad emphasis'},b:{name:'DB RDLs',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at hack squat · bilateral · feel the stretch'}},{type:'single',num:3,name:'Leg Press (feet together)',sets:'4x12',b:['tb-midset'],note:'Full ROM · controlled descent'},{type:'single',num:4,name:'Romanian Deadlift',sets:'4x12',b:['tb-midset'],note:'High rep'},{type:'ss',num:5,a:{name:'Quad Extensions',sets:'4x15',b:['tb-highrep'],note:'High rep burnout'},b:{name:'DB Reverse Lunges (in place)',sets:'4x10 each',b:['tb-midset'],note:'DBs pre-staged at extension machine · torso upright'}}],
  4:[{type:'single',num:1,name:'Barbell Squat',sets:'4x10',b:['tb-midset'],note:'Heavy · full depth · 3 sec negative'},{type:'ss',num:2,a:{name:'Hack Squat',sets:'4x10',b:['tb-midset'],note:'3 sec negative · bilateral'},b:{name:'DB RDLs',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at hack squat · bilateral · feel the stretch'}},{type:'single',num:3,name:'Leg Press (feet together)',sets:'4x12',b:['tb-midset'],note:'Heavy · slow controlled descent'},{type:'single',num:4,name:'Romanian Deadlift',sets:'4x12',b:['tb-midset'],note:'Bilateral · feel stretch'},{type:'ss',num:5,a:{name:'Quad Extensions',sets:'4x15',b:['tb-highrep'],note:'High rep burnout'},b:{name:'DB Reverse Lunges (in place)',sets:'3xfailure',b:['tb-amrap'],note:'DBs pre-staged at extension machine · to technical failure'}}]
},
    summary: {
      subtitle: "Quads · Hamstrings · Calves",
      rows: [
      { icon: "🏋️", name: "Barbell or DB Goblet Squat", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "🔀", name: "Quad Extensions × Seated Ham Curl", sets: "5 sets", reps: "12 reps / 12,10,8,8" },
      { icon: "⏱️", name: "Leg Press", sets: "4 sets", reps: "10 reps — 4 sec negative" },
      { icon: "🔀", name: "DB RDLs × Smith Split Squats", sets: "4 sets", reps: "15 reps / 10 reps" },
      { icon: "🦶", name: "Calf Raises", sets: "4 sets", reps: "20 reps — 2 sec pause" }
    ],
      totals: [
      { val: "22–23 sets", label: "Total Sets" },
      { val: "~250–290 reps total", label: "Est. Reps" },
      { val: "45–60 min", label: "Est. Time" }
    ]
    },
    nextWorkout: null
  },
  "s5-pull": {
    file: "mc-s5-pull.html",
    accent: "#a855f7", accentRgb: "168,85,247",
    headerGrad: ["#1e0a3c", "#0d0618"],
    titleTag: "MC — Pull Day", eyebrow: "🔙 Split 5", pageTitle: "Pull Day",
    backHref: "mc-split5.html",
    warmup: { icon: "🔥", text: "Pull-Ups (AMRAP)", sub: "Warmup — max reps · full hang · no kipping" },
    data: {
  1:[
    {type:'single',num:1,name:'Barbell Pendlay Rows',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · explosive pull · reset each rep'},
    {type:'ss',num:2,a:{name:'DB Incline Row',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec pause at top · 1:0:1:2'},
                  b:{name:'Spider Curls',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · 2 sec pause at peak'}},
    {type:'single',num:3,name:'Concentration Curls',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · squeeze hard at peak · alternate arms'},
    {type:'ss',num:4,a:{name:'Wide Grip Lat Pulldowns',sets:'4x10',b:['tb-midset'],note:'2 sec pause at bottom · 1:0:1:2 · full stretch at top'},
                  b:{name:'Cable Curl (low pulley)',sets:'4x20',b:['tb-highrep'],note:'Same cable column · 20 reps · constant tension · squeeze at top'}},
    {type:'ss',num:5,a:{name:'Straight Arm Lat Pulldowns',sets:'4x20',b:['tb-highrep'],note:'20 reps · constant tension · bilateral cable'},
                  b:{name:'Cable Curl (low pulley)',sets:'4x12',b:['tb-midset'],note:'Same cable column · 2 sec pause at peak · bilateral'}},
  ],
  2:[{type:'single',num:1,name:'Pull-Ups',sets:'5x10',b:['tb-highset'],note:'Full stretch at top'},{type:'ss',num:2,a:{name:'Incline DB Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy bilateral · 2 sec pause at top'},b:{name:'Incline DB Curl',sets:'4x12',b:['tb-midset'],note:'Same incline bench · alternate arms · full supination'}},{type:'ss',num:3,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Drive the bar'},b:{name:'Cable Curl (low pulley)',sets:'4x15',b:['tb-highrep'],note:'Same cable column · squeeze at peak · bilateral'}},{type:'ss',num:4,a:{name:'T-Bar Row',sets:'4x10',b:['tb-midset'],note:'Reset each rep'},b:{name:'DB Hammer Curl',sets:'4x12',b:['tb-midset'],note:'DBs pre-staged at T-bar machine · neutral grip · bilateral'}},{type:'single',num:5,name:'DB Walking Lunges',sets:'4x12 each leg',b:['tb-midset'],note:'Torso upright · required for leg days'}],
  3:[{type:'single',num:1,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Explosive pull · reset each rep'},{type:'ss',num:2,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Elbows tight · 2 sec pause'},b:{name:'Cable Curl (low pulley)',sets:'4x12',b:['tb-midset'],note:'Same cable column · squeeze at peak · bilateral'}},{type:'ss',num:3,a:{name:'Barbell Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy · full stretch'},b:{name:'Barbell Curls',sets:'4x15',b:['tb-highrep'],note:'Same barbell area as row · squeeze at top · bilateral'}},{type:'ss',num:4,a:{name:'V-Grip Pulldown',sets:'4x10',b:['tb-midset'],note:'Underhand · elbows tight'},b:{name:'Cable Hammer Curl (rope)',sets:'4x12',b:['tb-midset'],note:'Same cable column · rope attachment · neutral grip'}}],
  4:[{type:'single',num:1,name:'Pull-Ups',sets:'3xfailure',b:['tb-amrap'],note:'Explosive pull · reset each rep · drive elbows'},{type:'ss',num:2,a:{name:'Seated Cable Row',sets:'4x12',b:['tb-midset'],note:'Elbows tight'},b:{name:'Cable Curl (low pulley)',sets:'4x12',b:['tb-midset'],note:'Same cable column · squeeze at peak · bilateral'}},{type:'ss',num:3,a:{name:'Barbell Row',sets:'5x5',b:['tb-lowrep'],note:'Heavy · full stretch at top'},b:{name:'Barbell Curls',sets:'4x15',b:['tb-highrep'],note:'Same barbell area as row · squeeze at top · bilateral'}},{type:'ss',num:4,a:{name:'V-Grip Pulldown',sets:'4x10',b:['tb-midset'],note:'At bottom · underhand'},b:{name:'Cable Hammer Curl (rope)',sets:'4x15',b:['tb-highrep'],note:'Same cable column · rope attachment · high rep'}}]
},
    summary: {
      subtitle: "Lats · Mid Back · Biceps",
      rows: [
      { icon: "💀", name: "Pull-Ups Warmup (AMRAP)", sets: "1+ sets", reps: "Max reps" },
      { icon: "🏋️", name: "Barbell Pendlay Rows", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "🔀", name: "DB Incline Row × Spider Curls", sets: "5 sets", reps: "12 reps / 15 reps" },
      { icon: "📈", name: "Concentration Curls", sets: "4 sets", reps: "12,10,8,8 pyramid" },
      { icon: "🔀", name: "Wide Grip Lat PD × Barbell Curls", sets: "4 sets", reps: "10 reps / 20 reps" },
      { icon: "🔀", name: "Straight Arm PD × Preacher Curls", sets: "4 sets", reps: "20 reps / 12 reps" }
    ],
      totals: [
      { val: "23–24 sets", label: "Total Sets" },
      { val: "~290–330 reps total", label: "Est. Reps" },
      { val: "50–65 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s5-legs.html", label: "Up Next in this Split", dotColor: "#c084fc", name: "Legs" }
  },
  "s5-push": {
    file: "mc-s5-push.html",
    accent: "#a855f7", accentRgb: "168,85,247",
    headerGrad: ["#1e0a3c", "#0d0618"],
    titleTag: "MC — Push Day", eyebrow: "💪 Split 5", pageTitle: "Push Day",
    backHref: "mc-split5.html",
    warmup: null,
    data: {
  1:[
    {type:'single',num:1,name:'Barbell Bench or DB Incline Bench',sets:'5x5',b:['tb-lowrep'],note:'Low rep · heavy · alternate bench styles each session'},
    {type:'single',num:2,name:'Arnold Press or Barbell Military Press',sets:'5x12',b:['tb-highset'],note:'High sets · alternate between Arnold and military each session'},
    {type:'single',num:3,name:'Tricep or Close Grip DB Bench',sets:'4x10',b:['tb-midset'],note:'4 sec negative · 4:0:1:0 · full ROM'},
    {type:'ss',num:4,a:{name:'Pronated Chest Flies',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 2 sec pause at peak · deep stretch'},
                  b:{name:'Skull Crushers',sets:'4x15',b:['tb-highrep'],note:'12-15 reps · 2 sec pause at bottom'}},
    {type:'ss',num:5,a:{name:'DB Alternating Press',sets:'4x12',b:['tb-midset'],note:'Alternate arms · slight incline · full ROM'},
                  b:{name:'DB Upright Row',sets:'4x20',b:['tb-highrep'],note:'Same DBs as press · bilateral · 2 sec pause at top'}},
  ],
  2:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Low rep heavy · drive the bar'},{type:'single',num:2,name:'Incline DB Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · 2 sec negative · 4:0:1:0'},{type:'single',num:3,name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'High rep pump · deep stretch'},{type:'ss',num:4,a:{name:'Cable Chest Press',sets:'4x12',b:['tb-midset'],note:'Constant tension · full ROM'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'High sets · squeeze at bottom · bilateral'}},{type:'ss',num:5,a:{name:'Seated DB Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · strict press · slight incline'},b:{name:'DB Lateral Raises',sets:'4x15',b:['tb-highrep'],note:'Same DBs as press · 2 sec pause at top · bilateral'}}],
  3:[{type:'single',num:1,name:'Barbell Bench Press',sets:'5x5',b:['tb-lowrep'],note:'Heavy · drive the bar'},{type:'single',num:2,name:'Incline DB Press',sets:'4x12',b:['tb-midset'],note:'Full ROM'},{type:'single',num:3,name:'Pec Deck Fly',sets:'4x15',b:['tb-highrep'],note:'2 sec peak contraction'},{type:'ss',num:4,a:{name:'Cable Chest Press',sets:'4x12',b:['tb-midset'],note:'Constant tension · full ROM'},b:{name:'Rope Pushdowns',sets:'5x12',b:['tb-highset'],note:'Bilateral · squeeze at bottom'}},{type:'ss',num:5,a:{name:'Seated DB Press',sets:'4x12',b:['tb-midset'],note:'Strict press · 2 sec negative'},b:{name:'DB Lateral Raises',sets:'4x15',b:['tb-highrep'],note:'Same DBs as press · constant squeeze · raise to shoulder level'}}],
  4:[{type:'single',num:1,name:'Barbell Bench Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid up · drive the bar'},{type:'single',num:2,name:'Incline DB Press',sets:'4x15',b:['tb-highrep'],note:'High rep · moderate weight'},{type:'single',num:3,name:'Pec Deck Fly',sets:'5x12',b:['tb-highset'],note:'High sets · 2 sec peak hold'},{type:'ss',num:4,a:{name:'Cable Chest Press',sets:'4x12',b:['tb-midset'],note:'2 sec pause at peak'},b:{name:'Rope Pushdowns',sets:'4x12',b:['tb-midset'],note:'Squeeze at bottom · bilateral'}},{type:'ss',num:5,a:{name:'Seated DB Press',sets:'12,10,8,8',b:['tb-pyramid'],note:'Pyramid · heavy · strict form'},b:{name:'DB Lateral Raises',sets:'5x12',b:['tb-highset'],note:'Same DBs as press · high rep · constant squeeze'}}]
},
    summary: {
      subtitle: "Chest · Shoulders · Triceps",
      rows: [
      { icon: "🏋️", name: "Barbell Bench or DB Incline Bench", sets: "5 sets", reps: "5 reps — heavy" },
      { icon: "⚡", name: "Arnold Press or Military Press", sets: "5 sets", reps: "12 reps — high sets" },
      { icon: "⏱️", name: "Tricep or Close Grip DB Bench", sets: "4 sets", reps: "10 reps — 4 sec negative" },
      { icon: "🔀", name: "Pronated Flies × Skull Crushers", sets: "4 sets", reps: "12,10,8,8 / 15 reps" },
      { icon: "🔀", name: "DB Alt Press × Barbell Upright Row", sets: "4 sets", reps: "12 reps / 20 reps" }
    ],
      totals: [
      { val: "22–23 sets", label: "Total Sets" },
      { val: "~270–310 reps total", label: "Est. Reps" },
      { val: "45–60 min", label: "Est. Time" }
    ]
    },
    nextWorkout: { href: "mc-s5-pull.html", label: "Up Next in this Split", dotColor: "#c084fc", name: "Pull" }
  },
};
