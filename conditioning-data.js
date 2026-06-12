/* ==========================================================================
   conditioning-data.js  —  Phase 1
   --------------------------------------------------------------------------
   Data for the standalone "Conditioning" tab (cardio · conditioning · core).
   Kept in its own file so it is cleanly decoupled and portable for the Phase 3
   repository split (Workout-Rolodex). Add future sub-categories by appending to
   CONDITIONING.subcategories — no other code changes required.

   Sub-category shapes:
     { type:'routines',  ... routines:[{id,name,tag,meta,href,stats[],protocol?}] }
     { type:'exercises', ... exercises:[{name,muscle}] }   // reference list
   All routine text mirrors cat-faint.html verbatim.

   protocol (Phase 4 guided interval timer — mc-interval.js):
     { rounds:N, scoring:'time', steps:[{label, secs, rest?}] }
     secs:0 = untimed station (stopwatch counts up, lifter taps Next).
     Routines without a protocol still get result logging + PBs, just no
     guided timer.
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
        { id: 'the-500', name: 'The 500', tag: 'Challenge Workout', href: 'the-500.html',
          meta: '300 walking lunges + 15 min jump rope + the 1–18 pushup ladder. A test of grit.',
          stats: ['🔥 ~45 min', '💀 Full body'],
          protocol: { rounds: 1, scoring: 'time', steps: [
            { label: '300 Walking Lunges', secs: 0 },
            { label: 'Jump Rope', secs: 900 },
            { label: 'Pushup Ladder 1–18 (171 reps)', secs: 0 }
          ] } },
        { id: 'driveway-demolition', name: 'Driveway Demolition', tag: 'Pushups + Core', href: 'driveway-demolition.html',
          meta: 'The 1–18 pushup challenge (171 reps) paired with rotating 1-minute max-effort core circuits.',
          stats: ['⏱️ Daily', '💪 Pushups + Core'],
          protocol: { rounds: 1, scoring: 'time', steps: [
            { label: 'Pushup Ladder 1–18 (171 reps)', secs: 0 },
            { label: 'Core Circuit 1 — max effort', secs: 60 },
            { label: 'Core Circuit 2 — max effort', secs: 60 },
            { label: 'Core Circuit 3 — max effort', secs: 60 },
            { label: 'Core Circuit 4 — max effort', secs: 60 }
          ] } },
        { id: 'hell-week', name: 'Hell Week', tag: '5 Rounds · No Quitting', href: 'hell-week.html',
          meta: '5 rounds of 1-min max effort exercises. Burpees, lunges, jump rope, and a finisher built to break you.',
          stats: ['🔥 5 rounds', '💀 Elite only'],
          protocol: { rounds: 5, scoring: 'time', steps: [
            { label: 'Burpees — max effort', secs: 60 },
            { label: 'Walking Lunges — max effort', secs: 60 },
            { label: 'Jump Rope — max effort', secs: 60 },
            { label: 'Finisher — max effort', secs: 60 },
            { label: 'Rest', secs: 60, rest: true }
          ] } },
        { id: 'turn-and-burn', name: '30 Minute Turn & Burn', tag: '30 Min · 2 Options', href: 'turn-and-burn.html',
          meta: '15 min jump rope + your choice: 10 rounds of max effort burpees OR the brutal 1–18 pushup ladder (171 reps).',
          stats: ['⏱️ 30 min', '🔥 2 options'],
          protocol: { rounds: 1, scoring: 'time', steps: [
            { label: 'Jump Rope', secs: 900 },
            { label: 'Burpees ×10 rounds OR Pushup Ladder 1–18', secs: 0 }
          ] } },
        { id: 'full-body-pyramid', name: 'Full Body Pyramid', tag: 'Pyramid · Timed + Reps', href: 'full-body-pyramid.html',
          meta: 'Two pyramid formats — timed rounds (90s–2min per exercise) or rep-based with alternating ascending/descending rounds.',
          stats: ['🔺 2 formats', '💀 Full body'] },
        { id: '45-minute-burner', name: '45 Minute Burner', tag: '⏱️ 45 Min · Cardio Burn', href: '45-minute-burner.html',
          meta: 'Incline treadmill + jump rope + 10 rounds of max effort burpees. Structured cardio conditioning built to break you.',
          stats: ['⏱️ ~45 min', '💀 10 rounds'],
          protocol: { rounds: 1, scoring: 'time', steps: [
            { label: 'Incline Treadmill', secs: 900 },
            { label: 'Jump Rope', secs: 900 },
            { label: 'Burpees — 10 rounds max effort', secs: 0 }
          ] } },
        { id: 'popeye', name: 'Popeye', tag: '💪 Forearm Destroyer', href: 'popeye.html',
          meta: 'Forearm circuit — wrist rolls, reverse curls, and grip work on a 30s on / 30s off protocol. ~20-30 min.',
          stats: ['💪 Forearms', '⏱️ ~25 min'],
          protocol: { rounds: 10, scoring: 'time', steps: [
            { label: 'Work — 30s on', secs: 30 },
            { label: 'Rest — 30s off', secs: 30, rest: true }
          ] } },
        { id: 'boxing-routine', name: 'Boxing Routine', tag: '🥊 3 Phases · ~50 Min', href: 'boxing-routine.html',
          meta: '3 rounds of jump rope + heavy bag, conditioning circuit (push-ups, burpees, shadow boxing), AMRAP sit-ups, and a 1–2 mile run.',
          stats: ['🥊 3 phases', '⏱️ ~50 min'],
          protocol: { rounds: 3, scoring: 'time', steps: [
            { label: 'Jump Rope', secs: 180 },
            { label: 'Heavy Bag', secs: 180 },
            { label: 'Rest', secs: 60, rest: true }
          ] } },
        { id: 'battle-ropes', name: 'Battle Ropes', tag: '🪢 5 Levels · Gauntlet', href: 'battle-ropes.html',
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
