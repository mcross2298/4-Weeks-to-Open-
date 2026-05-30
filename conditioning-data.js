/* ==========================================================================
   conditioning-data.js  —  Phase 1
   --------------------------------------------------------------------------
   Data for the standalone "Conditioning" tab (cardio · conditioning · core).
   Kept in its own file so it is cleanly decoupled and portable for the Phase 3
   repository split (Workout-Rolodex). Add future sub-categories by appending to
   CONDITIONING.subcategories — no other code changes required.

   Sub-category shapes:
     { type:'routines',  ... routines:[{name,tag,meta,href,stats:[]}] }
     { type:'exercises', ... exercises:[{name,muscle}] }   // reference list
   All routine text mirrors cat-faint.html verbatim.
   ========================================================================== */
const CONDITIONING = {
  subcategories: [
    {
      id: 'faint',
      type: 'routines',
      name: 'Not for the Faint of Heart',
      icon: '🔥',
      color: '#E24B4A',
      blurb: 'High-intensity circuits and challenge workouts.',
      routines: [
        { name: 'The 500', tag: 'Challenge Workout', href: 'the-500.html',
          meta: '300 walking lunges + 15 min jump rope + the 1–18 pushup ladder. A test of grit.',
          stats: ['🔥 ~45 min', '💀 Full body'] },
        { name: 'Driveway Demolition', tag: 'Pushups + Core', href: 'driveway-demolition.html',
          meta: 'The 1–18 pushup challenge (171 reps) paired with rotating 1-minute max-effort core circuits.',
          stats: ['⏱️ Daily', '💪 Pushups + Core'] },
        { name: 'Hell Week', tag: '5 Rounds · No Quitting', href: 'hell-week.html',
          meta: '5 rounds of 1-min max effort exercises. Burpees, lunges, jump rope, and a finisher built to break you.',
          stats: ['🔥 5 rounds', '💀 Elite only'] },
        { name: '30 Minute Turn & Burn', tag: '30 Min · 2 Options', href: 'turn-and-burn.html',
          meta: '15 min jump rope + your choice: 10 rounds of max effort burpees OR the brutal 1–18 pushup ladder (171 reps).',
          stats: ['⏱️ 30 min', '🔥 2 options'] },
        { name: 'Full Body Pyramid', tag: 'Pyramid · Timed + Reps', href: 'full-body-pyramid.html',
          meta: 'Two pyramid formats — timed rounds (90s–2min per exercise) or rep-based with alternating ascending/descending rounds.',
          stats: ['🔺 2 formats', '💀 Full body'] },
        { name: '45 Minute Burner', tag: '⏱️ 45 Min · Cardio Burn', href: '45-minute-burner.html',
          meta: 'Incline treadmill + jump rope + 10 rounds of max effort burpees. Structured cardio conditioning built to break you.',
          stats: ['⏱️ ~45 min', '💀 10 rounds'] },
        { name: 'Popeye', tag: '💪 Forearm Destroyer', href: 'popeye.html',
          meta: 'Forearm circuit — wrist rolls, reverse curls, and grip work on a 30s on / 30s off protocol. ~20-30 min.',
          stats: ['💪 Forearms', '⏱️ ~25 min'] },
        { name: 'Boxing Routine', tag: '🥊 3 Phases · ~50 Min', href: 'boxing-routine.html',
          meta: '3 rounds of jump rope + heavy bag, conditioning circuit (push-ups, burpees, shadow boxing), AMRAP sit-ups, and a 1–2 mile run.',
          stats: ['🥊 3 phases', '⏱️ ~50 min'] },
        { name: 'Battle Ropes', tag: '🪢 5 Levels · Gauntlet', href: 'battle-ropes.html',
          meta: '8-movement gauntlet across 5 difficulty levels — Basic through Advanced L3. Includes EMOM push-ups or burpees and jump rope finisher.',
          stats: ['🪢 5 levels', '⚡ EMOM included'] }
      ]
    },
    {
      id: 'cardio-core',
      type: 'exercises',
      name: 'Cardio & Core',
      icon: '🏃',
      color: '#f59e0b',
      blurb: 'Standalone cardio and core movements — drop them in after a lift or run them on their own.',
      exercises: [
        // Cardio
        { name: 'Battle Ropes Phase 1 — Basic', muscle: 'Cardio' },
        { name: 'Battle Ropes — Intermediate', muscle: 'Cardio' },
        { name: 'Battle Ropes — Advanced Level 1', muscle: 'Cardio' },
        { name: 'Battle Ropes — Advanced Level 2', muscle: 'Cardio' },
        { name: 'Battle Ropes — Advanced Level 3', muscle: 'Cardio' },
        { name: 'Burpees', muscle: 'Cardio' },
        { name: 'Jump Rope', muscle: 'Cardio' },
        { name: 'Run', muscle: 'Cardio' },
        { name: 'Walk the Line', muscle: 'Cardio' },
        // Core
        { name: 'Ab Wheel Rollout', muscle: 'Core' },
        { name: 'Abdominals', muscle: 'Core' },
        { name: 'DB Twists', muscle: 'Core' },
        { name: 'GHD', muscle: 'Core' },
        { name: 'Hanging Leg Raises', muscle: 'Core' },
        { name: 'Heavy Bag', muscle: 'Core' },
        { name: 'Heels to Heaven', muscle: 'Core' },
        { name: 'High Pull Cable Crunch', muscle: 'Core' },
        { name: 'In & Outs', muscle: 'Core' },
        { name: 'Jumping Jacks', muscle: 'Core' },
        { name: 'Plank', muscle: 'Core' },
        { name: 'Shadow Boxing', muscle: 'Core' },
        { name: 'Side Plank', muscle: 'Core' },
        { name: 'Sit-Ups (AMRAP)', muscle: 'Core' },
        { name: 'Supermans', muscle: 'Core' },
        { name: 'USA Kettlebell Twist', muscle: 'Core' },
        { name: 'USA Twists', muscle: 'Core' }
      ]
    }
    // Future: append low-intensity conditioning sub-categories here.
  ]
};
