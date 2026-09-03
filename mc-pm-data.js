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
  //
  // `tagTint`/`tagTintLight` (DG-5, card-integration-roadmap): the one part
  // of a program's card look that ISN'T a mechanical alpha-variant of
  // `color` — tools/gen-program-css.py derives every other value in
  // dashboard.html's .cat-card.<id>/.rail-card.<id> blocks (gradients,
  // borders, glows) straight from `color` + `tier`, but the .cat-tag TEXT
  // color is a hand-tuned lighter tint per program, so it's stored
  // explicitly to keep generation byte-faithful to the existing design.
  // `tagTintLight` is the light-theme variant; omit it (as 'mc' does, whose
  // tag already reads var(--o-gold), a self-adapting owner-theme token) for
  // a program whose tag needs no separate light-mode override.
  var programs = [
    { id: 'ss',   tier: 'flagship', icon: '🏋️', name: 'Strength & Supersets',      meta: '6-Week Cycle · 5 Days', color: '#c9505a', tagTint: '#fda4af', tagTintLight: '#a13c46', desc: 'Heavy low-rep compounds paired with high-volume supersets and AMRAP finishers for raw strength and size.', forWho: 'Intermediate+ lifters who want heavy compound strength paired with size-focused supersets, 5 days a week.', href: 'cat-strength.html', splits: ['Legs', 'Chest', 'Back & Shoulders', 'Arms & Forearms', 'Cardio & Calves'],
      // program-flow-roadmap.md F0 — the day module mounts on dashboard.html,
      // which cannot see cat-strength.html's inline PMC_SPLITS. This is the
      // record it reads: block shape plus one entry per training day.
      //
      // `rest` is the Weekly Layout Standard's 5-on 2-off, as DATA — the
      // renderers rank a training day among the week's non-rest positions,
      // so a program resting mid-week needs no renderer change.
      //
      // ex/sets/min are WEEK 1 figures, measured off the rendered page across
      // all 30 training days. They are deliberately not stored per week: the
      // authored prescription lives in cat-strength.html and duplicating 30
      // triples here would drift the moment the program is edited, which is
      // the exact failure mode check-program-colors.js and check-single-impl.js
      // exist to catch elsewhere. The program page shows the exact per-week
      // numbers; this is the at-a-glance figure for the dashboard hero.
      // `muscles` (flagship-immersive-roadmap.md H4b): which MC_MUSCLES groups
      // week 1's real exercise list (cat-strength.html's PMC_SPLITS[id].data[1])
      // actually classifies to via mc-muscle-map.js's real classify() — computed,
      // not guessed, same as mm/hv's generated `muscles` below, just hand-typed
      // here since this whole block already is (not run through gen-schedules.js
      // — see the file header above). `legs` includes "shoulders" because
      // "Barbell/Hack Squat (shoulder width)" contains that literal phrase as a
      // stance descriptor, a known false positive in the shared classifier's
      // shoulders regex (narrow — 3 catalog-wide instances) left as-is rather
      // than risk a broader regex change; `arms_forearms` includes "back" for
      // the same reason ("Behind-the-Back Barbell Curls" literally contains
      // "back"). `cardio_calves` has none: its exercise list is pulled live
      // from the Conditioning Corner at runtime, not authored here, so there
      // is nothing to classify — empty, not guessed.
      schedule: {
        weeks: 6, perWeek: 7, rest: [6, 7],
        days: [
          { id: 'legs',           title: 'Legs',              icon: '🦵', tags: ['Quads', 'Hamstrings', 'Calves'],       ex: 8, sets: 30, min: 75, muscles: ['calves', 'legs', 'shoulders'] },
          { id: 'chest',          title: 'Chest',             icon: '💪', tags: ['Chest', 'Push'],                       ex: 8, sets: 32, min: 80, muscles: ['chest'] },
          { id: 'back_shoulders', title: 'Back & Shoulders',  icon: '🔙', tags: ['Back', 'Delts', 'Pull'],               ex: 8, sets: 32, min: 80, muscles: ['back', 'shoulders'] },
          { id: 'arms_forearms',  title: 'Arms & Forearms',   icon: '💥', tags: ['Biceps', 'Triceps', 'Forearms'],       ex: 9, sets: 32, min: 80, muscles: ['back', 'biceps', 'chest', 'triceps'] },
          { id: 'cardio_calves',  title: 'Calves & Cardio',   icon: '🏃', tags: ['Calves', 'Cardio'],                    ex: 3, sets: 12, min: 30, muscles: [] }
        ]
      } },
    { id: 'pmc',  tier: 'flagship', icon: '⚡', name: 'Project Muscle Confusion',   meta: '7 Splits · 2 Weeks Each', color: '#8b7ff0', tagTint: '#c4bdfa', tagTintLight: '#5b4fc7', desc: 'Constantly varied supersets, pyramids, drop sets, AMRAP and tempo work that never lets your muscles adapt.', forWho: 'Lifters who get bored easily and want constant variety — a new stimulus every split, no two weeks alike.', href: 'cat-pmc.html', splits: ['Split 1', 'Split 2', 'Split 3', 'Split 4', 'Split 5', 'Split 6', 'Split 7'] },
    { id: 'mc',   tier: 'flagship', icon: '👑', name: "Mike Cross' Favorite Splits", meta: '5 Splits · 23 Workouts', color: '#d8b463', tagTint: 'var(--o-gold)', desc: "Mike's five personal splits spanning every major training style — the way he actually trains.", forWho: "Trainees who want a well-rounded sample of Mike's own go-to training styles across one program.", href: 'cat-mc.html', splits: ['Split 1', 'Split 2', 'Split 3', 'Split 4', 'Split 5'] },
    { id: 'ks',   tier: 'flagship', icon: '🔥', name: 'Everything Under the Kitchen Sink', meta: '6 Splits · Station-Anchored', color: '#e0a03c', tagTint: '#f0c078', tagTintLight: '#a3701f', desc: 'Six distinct training splits under one roof — the complete MC arsenal, station-anchored for commercial gym efficiency.', forWho: 'Commercial-gym lifters who want maximum split variety without hogging equipment — everything station-anchored.', href: 'cat-ks.html', splits: ['Everything Under the Kitchen Sink', 'Iron Engine', 'Split 3', 'Split 4', 'Split 5', 'Split 6'] },
    { id: 'mm',   tier: 'flagship', icon: '⬡',  name: 'The Modality Matrix',            meta: '15 Weeks · 3 Phases · 4-Day Split',   color: '#6f77e0', tagTint: '#a3a8f2', tagTintLight: '#454dc4', desc: 'Three phases, three modalities — dumbbell isolation, barbell strength, cable conditioning — one complete system.', forWho: 'Lifters committing to a longer block who want to master every major equipment modality in sequence.', href: 'cat-mm.html', splits: ['Phase 1 · Dumbbell', 'Phase 2 · Barbell', 'Phase 3 · Cable'],
      /* GEN:schedule:mm */
      schedule: {
        "weeks": 15,
        "perWeek": 7,
        "rest": [
          5
        ],
        "phases": [
          {
            "weeks": 5,
            "days": [
              "p1-1",
              "p1-2",
              "p1-3",
              "p1-4",
              "p1-6",
              "p1-7"
            ]
          },
          {
            "weeks": 5,
            "days": [
              "p2-1",
              "p2-2",
              "p2-3",
              "p2-4",
              "p2-6",
              "p2-7"
            ]
          },
          {
            "weeks": 5,
            "days": [
              "p3-1",
              "p3-2",
              "p3-3",
              "p3-4",
              "p3-6",
              "p3-7"
            ]
          }
        ],
        "days": [
          {
            "id": "p1-1",
            "title": "Chest",
            "icon": "🏋️",
            "tags": [
              "Dumbbell Split",
              "Phase 1"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "chest"
            ],
            "href": "mm-p1.html?day=1"
          },
          {
            "id": "p1-2",
            "title": "Arms",
            "icon": "💪",
            "tags": [
              "Dumbbell Split",
              "Phase 1"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "biceps",
              "chest",
              "triceps"
            ],
            "href": "mm-p1.html?day=2"
          },
          {
            "id": "p1-3",
            "title": "Legs",
            "icon": "🦵",
            "tags": [
              "Dumbbell Split",
              "Phase 1"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "calves",
              "legs",
              "shoulders"
            ],
            "href": "mm-p1.html?day=3"
          },
          {
            "id": "p1-4",
            "title": "Back & Shoulders",
            "icon": "🔙",
            "tags": [
              "Dumbbell Split",
              "Phase 1"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "back",
              "shoulders"
            ],
            "href": "mm-p1.html?day=4"
          },
          {
            "id": "p1-6",
            "title": "Conditioning Corner",
            "icon": "⚡",
            "tags": [
              "Dumbbell Split",
              "Phase 1"
            ],
            "ex": 0,
            "sets": 0,
            "muscles": [],
            "href": "mm-p1.html?day=6"
          },
          {
            "id": "p1-7",
            "title": "Conditioning Corner",
            "icon": "⚡",
            "tags": [
              "Dumbbell Split",
              "Phase 1"
            ],
            "ex": 0,
            "sets": 0,
            "muscles": [],
            "href": "mm-p1.html?day=7"
          },
          {
            "id": "p2-1",
            "title": "Squat",
            "icon": "🦵",
            "tags": [
              "Barbell & Smith",
              "Phase 2"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "legs"
            ],
            "href": "mm-p2.html?day=1"
          },
          {
            "id": "p2-2",
            "title": "Bench",
            "icon": "🏋️",
            "tags": [
              "Barbell & Smith",
              "Phase 2"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "chest",
              "triceps"
            ],
            "href": "mm-p2.html?day=2"
          },
          {
            "id": "p2-3",
            "title": "Deadlift / Pull",
            "icon": "🔙",
            "tags": [
              "Barbell & Smith",
              "Phase 2"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "back",
              "biceps",
              "legs",
              "shoulders"
            ],
            "href": "mm-p2.html?day=3"
          },
          {
            "id": "p2-4",
            "title": "Overhead Press",
            "icon": "🏋️",
            "tags": [
              "Barbell & Smith",
              "Phase 2"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "chest",
              "shoulders",
              "triceps"
            ],
            "href": "mm-p2.html?day=4"
          },
          {
            "id": "p2-6",
            "title": "Conditioning Corner",
            "icon": "⚡",
            "tags": [
              "Barbell & Smith",
              "Phase 2"
            ],
            "ex": 0,
            "sets": 0,
            "muscles": [],
            "href": "mm-p2.html?day=6"
          },
          {
            "id": "p2-7",
            "title": "Conditioning Corner",
            "icon": "⚡",
            "tags": [
              "Barbell & Smith",
              "Phase 2"
            ],
            "ex": 0,
            "sets": 0,
            "muscles": [],
            "href": "mm-p2.html?day=7"
          },
          {
            "id": "p3-1",
            "title": "Push",
            "icon": "🏋️",
            "tags": [
              "Cable & Plate-Loaded",
              "Phase 3"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "chest",
              "shoulders",
              "triceps"
            ],
            "href": "mm-p3.html?day=1"
          },
          {
            "id": "p3-2",
            "title": "Pull",
            "icon": "🔙",
            "tags": [
              "Cable & Plate-Loaded",
              "Phase 3"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "back",
              "biceps",
              "shoulders"
            ],
            "href": "mm-p3.html?day=2"
          },
          {
            "id": "p3-3",
            "title": "Legs",
            "icon": "🦵",
            "tags": [
              "Cable & Plate-Loaded",
              "Phase 3"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "legs"
            ],
            "href": "mm-p3.html?day=3"
          },
          {
            "id": "p3-4",
            "title": "Delts & Arms",
            "icon": "💪",
            "tags": [
              "Cable & Plate-Loaded",
              "Phase 3"
            ],
            "ex": 10,
            "sets": 43,
            "muscles": [
              "biceps",
              "chest",
              "shoulders",
              "triceps"
            ],
            "href": "mm-p3.html?day=4"
          },
          {
            "id": "p3-6",
            "title": "Conditioning Corner",
            "icon": "⚡",
            "tags": [
              "Cable & Plate-Loaded",
              "Phase 3"
            ],
            "ex": 0,
            "sets": 0,
            "muscles": [],
            "href": "mm-p3.html?day=6"
          },
          {
            "id": "p3-7",
            "title": "Conditioning Corner",
            "icon": "⚡",
            "tags": [
              "Cable & Plate-Loaded",
              "Phase 3"
            ],
            "ex": 0,
            "sets": 0,
            "muscles": [],
            "href": "mm-p3.html?day=7"
          }
        ]
      },
      /* /GEN:schedule:mm */
    },
    { id: 'hv',   tier: 'flagship', icon: '💥', name: 'High-Volume Training Template',  meta: '4-Week Block · 5–6 Sets · 15–25 Reps', color: '#9fbf4a', tagTint: '#c3dc8f', tagTintLight: '#6b8a2a', desc: 'Compound-dominant into full supersets, into high-set pyramids, into bodyweight & accessory density — trisets banned throughout.', forWho: 'Lifters chasing hypertrophy through sheer volume — one 4-week block that escalates set density week by week.', href: 'cat-hv.html', splits: ['Week 1 · Compound Dominant', 'Week 2 · Fully Supersetted', 'Week 3 · High-Volume Pyramids', 'Week 4 · Bodyweight & Accessory'],
      /* GEN:schedule:hv */
      schedule: {
        "weeks": 4,
        "perWeek": 7,
        "rest": [
          3,
          6
        ],
        "phases": [
          {
            "weeks": 1,
            "days": [
              "hv-w1-1",
              "hv-w1-2",
              "hv-w1-4",
              "hv-w1-5",
              "hv-w1-7"
            ],
            "rest": [
              3,
              6
            ]
          },
          {
            "weeks": 1,
            "days": [
              "hv-w2-1",
              "hv-w2-2",
              "hv-w2-3",
              "hv-w2-4",
              "hv-w2-5"
            ],
            "rest": [
              6,
              7
            ]
          },
          {
            "weeks": 1,
            "days": [
              "hv-w3-1",
              "hv-w3-2",
              "hv-w3-4",
              "hv-w3-5",
              "hv-w3-6"
            ],
            "rest": [
              3,
              7
            ]
          },
          {
            "weeks": 1,
            "days": [
              "hv-w4-1",
              "hv-w4-2",
              "hv-w4-3",
              "hv-w4-5",
              "hv-w4-6",
              "hv-w4-7"
            ],
            "rest": [
              4
            ]
          }
        ],
        "days": [
          {
            "id": "hv-w1-1",
            "title": "Chest",
            "icon": "🏋️",
            "tags": [
              "3 Pyramids · 1 Static · 1 Drop · 1 Cluster"
            ],
            "ex": 6,
            "sets": 28,
            "muscles": [
              "chest",
              "triceps"
            ],
            "href": "hv-block.html?week=1&day=1"
          },
          {
            "id": "hv-w1-2",
            "title": "Arms",
            "icon": "💪",
            "tags": [
              "3 Pyramids · 1 Static · 1 Drop · 1 Cluster"
            ],
            "ex": 6,
            "sets": 31,
            "muscles": [
              "biceps",
              "chest",
              "triceps"
            ],
            "href": "hv-block.html?week=1&day=2"
          },
          {
            "id": "hv-w1-4",
            "title": "Legs",
            "icon": "🦵",
            "tags": [
              "3 Pyramids · 1 Static · 1 Drop · 1 Cluster"
            ],
            "ex": 6,
            "sets": 28,
            "muscles": [
              "legs"
            ],
            "href": "hv-block.html?week=1&day=4"
          },
          {
            "id": "hv-w1-5",
            "title": "Shoulders",
            "icon": "🎯",
            "tags": [
              "3 Pyramids · 1 Static · 1 Drop · 1 Cluster"
            ],
            "ex": 6,
            "sets": 31,
            "muscles": [
              "chest",
              "shoulders"
            ],
            "href": "hv-block.html?week=1&day=5"
          },
          {
            "id": "hv-w1-7",
            "title": "Back",
            "icon": "🔙",
            "tags": [
              "3 Pyramids · 1 Static · 1 Drop · 1 Cluster"
            ],
            "ex": 6,
            "sets": 28,
            "muscles": [
              "back"
            ],
            "href": "hv-block.html?week=1&day=7"
          },
          {
            "id": "hv-w2-1",
            "title": "Chest & Biceps",
            "icon": "🏋️",
            "tags": [
              "3 Pyramids · 4 Supersets · 120 sec Rest"
            ],
            "ex": 8,
            "sets": 38,
            "muscles": [
              "biceps",
              "chest"
            ],
            "href": "hv-block.html?week=2&day=1"
          },
          {
            "id": "hv-w2-2",
            "title": "Shoulders & Triceps",
            "icon": "🎯",
            "tags": [
              "3 Pyramids · 4 Supersets · 120 sec Rest"
            ],
            "ex": 8,
            "sets": 41,
            "muscles": [
              "shoulders",
              "triceps"
            ],
            "href": "hv-block.html?week=2&day=2"
          },
          {
            "id": "hv-w2-3",
            "title": "Legs",
            "icon": "🦵",
            "tags": [
              "3 Pyramids · 4 Supersets · 120 sec Rest"
            ],
            "ex": 8,
            "sets": 38,
            "muscles": [
              "calves",
              "legs"
            ],
            "href": "hv-block.html?week=2&day=3"
          },
          {
            "id": "hv-w2-4",
            "title": "Back",
            "icon": "🔙",
            "tags": [
              "3 Pyramids · 4 Supersets · 120 sec Rest"
            ],
            "ex": 8,
            "sets": 41,
            "muscles": [
              "back"
            ],
            "href": "hv-block.html?week=2&day=4"
          },
          {
            "id": "hv-w2-5",
            "title": "Rear Delts & Traps",
            "icon": "🔺",
            "tags": [
              "3 Pyramids · 4 Supersets · 120 sec Rest"
            ],
            "ex": 8,
            "sets": 38,
            "muscles": [
              "back",
              "chest",
              "shoulders"
            ],
            "href": "hv-block.html?week=2&day=5"
          },
          {
            "id": "hv-w3-1",
            "title": "Chest & Shoulders",
            "icon": "🏋️",
            "tags": [
              "Pyramid/Reverse-Pyramid · 1 Superset · 1 Drop · 1 Cluster"
            ],
            "ex": 8,
            "sets": 42,
            "muscles": [
              "chest",
              "shoulders"
            ],
            "href": "hv-block.html?week=3&day=1"
          },
          {
            "id": "hv-w3-2",
            "title": "Arms",
            "icon": "💪",
            "tags": [
              "Pyramid/Reverse-Pyramid · 1 Superset · 1 Drop · 1 Cluster"
            ],
            "ex": 8,
            "sets": 42,
            "muscles": [
              "biceps",
              "chest",
              "triceps"
            ],
            "href": "hv-block.html?week=3&day=2"
          },
          {
            "id": "hv-w3-4",
            "title": "Back & Traps",
            "icon": "🔙",
            "tags": [
              "Pyramid/Reverse-Pyramid · 1 Superset · 1 Drop · 1 Cluster"
            ],
            "ex": 8,
            "sets": 42,
            "muscles": [
              "back"
            ],
            "href": "hv-block.html?week=3&day=4"
          },
          {
            "id": "hv-w3-5",
            "title": "Legs",
            "icon": "🦵",
            "tags": [
              "Pyramid/Reverse-Pyramid · 1 Superset · 1 Drop · 1 Cluster"
            ],
            "ex": 8,
            "sets": 42,
            "muscles": [
              "legs"
            ],
            "href": "hv-block.html?week=3&day=5"
          },
          {
            "id": "hv-w3-6",
            "title": "Rear Delts + Arms",
            "icon": "🔺",
            "tags": [
              "Pyramid/Reverse-Pyramid · 1 Superset · 1 Drop · 1 Cluster"
            ],
            "ex": 8,
            "sets": 42,
            "muscles": [
              "biceps",
              "chest",
              "shoulders"
            ],
            "href": "hv-block.html?week=3&day=6"
          },
          {
            "id": "hv-w4-1",
            "title": "Full Body (Circuit Format)",
            "icon": "🔁",
            "tags": [
              "Continuous Circuit · 45–60 sec Rest"
            ],
            "ex": 8,
            "sets": 40,
            "muscles": [
              "chest",
              "legs",
              "shoulders"
            ],
            "href": "hv-block.html?week=4&day=1"
          },
          {
            "id": "hv-w4-2",
            "title": "Core (Circuit Format)",
            "icon": "🎯",
            "tags": [
              "Continuous Circuit · 45–60 sec Rest"
            ],
            "ex": 8,
            "sets": 40,
            "muscles": [
              "core"
            ],
            "href": "hv-block.html?week=4&day=2"
          },
          {
            "id": "hv-w4-3",
            "title": "Calves & Forearms",
            "icon": "🦶",
            "tags": [
              "3 Pyramids · 1 Static · 2 Supersets · 45–60 sec Rest"
            ],
            "ex": 8,
            "sets": 39,
            "muscles": [
              "biceps",
              "calves",
              "forearms"
            ],
            "href": "hv-block.html?week=4&day=3"
          },
          {
            "id": "hv-w4-5",
            "title": "Full Body (Circuit Format)",
            "icon": "🔁",
            "tags": [
              "Continuous Circuit · 45–60 sec Rest"
            ],
            "ex": 8,
            "sets": 40,
            "muscles": [
              "chest",
              "legs",
              "shoulders"
            ],
            "href": "hv-block.html?week=4&day=5"
          },
          {
            "id": "hv-w4-6",
            "title": "Core (Circuit Format)",
            "icon": "🎯",
            "tags": [
              "Continuous Circuit · 45–60 sec Rest"
            ],
            "ex": 8,
            "sets": 40,
            "muscles": [
              "core"
            ],
            "href": "hv-block.html?week=4&day=6"
          },
          {
            "id": "hv-w4-7",
            "title": "Calves & Forearms",
            "icon": "🦶",
            "tags": [
              "3 Pyramids · 1 Static · 2 Supersets · 45–60 sec Rest"
            ],
            "ex": 8,
            "sets": 39,
            "muscles": [
              "biceps",
              "calves",
              "forearms"
            ],
            "href": "hv-block.html?week=4&day=7"
          }
        ]
      },
      /* /GEN:schedule:hv */
    }
    /* MARKET:STRIP influencer-progs START */
    ,
    { id: 'stndr', tier: 'influencer', icon: '🏋️', name: 'STNDR',         meta: '4 Programs',      color: '#1D9E75', tagTint: '#6ee7b7', tagTintLight: '#157a56', desc: 'CBUM-style structured lifting built on progressive overload, supersets and smart periodization.', forWho: "Fans of CBUM's methodical, progressive-overload approach to classic bodybuilding.", href: 'cat-stndr.html', splits: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'] },
    { id: 'pump',  tier: 'influencer', icon: '⚡', name: 'Daily Pump',     meta: '10 Workouts',     color: '#D85A30', tagTint: '#f5a683', tagTintLight: '#a8431f', desc: 'Fast, high-rep isolation work that chases maximum pump and muscle fullness.', forWho: 'Lifters short on time who want a fast, pump-focused session rather than a max-effort grind.', href: 'cat-pump-new4.html', splits: ['Back', 'Chest', 'Shoulders', 'Arms', 'Legs'] },
    { id: 'gainz', tier: 'influencer', icon: '💪', name: 'Daily Gainz',    meta: '8 Programs',      color: '#378ADD', tagTint: '#93c5fd', tagTintLight: '#1f5fa8', desc: 'Bradley Martyn volume training — daily builders engineered for steady, consistent size.', forWho: "Lifters who want Bradley Martyn's high-frequency, high-volume approach to steady size gains.", href: 'cat-gainz.html', splits: ['Bro Split', 'Push/Pull', '5 On 2 Off', '3 On 1 Off'], liveBadge: true },
    { id: 'psu',   tier: 'influencer', icon: '🏈', name: 'PSU Football',   meta: 'Strength Program', color: '#639922', tagTint: '#bef264', tagTintLight: '#4d7a1a', desc: "Penn State's strength and conditioning system, built for real athletic performance.", forWho: 'Athletes who want a real collegiate strength & conditioning system, not a bodybuilding split.', href: 'cat-psu.html', splits: ['Phase 1', 'Phase 2', 'Phase 3'] }
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
