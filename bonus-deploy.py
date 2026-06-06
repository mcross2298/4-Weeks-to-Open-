#!/usr/bin/env python3
"""
bonus-deploy.py — generator for the "Bonus Workouts" section.

Bonus Workouts are ad-hoc daily-variation workouts (no progression, no two alike).
They live behind one top-level "Bonus Workouts" category card -> a hub
(cat-bonus.html) -> a handful of category pages, each holding a few workouts the
user can browse by tab or jump to via a "Surprise Me" pick.

──────────────────────────────────────────────────────────────────────────────
DATA-FIRST WORKFLOW (collect everything, categorize last)
We deliberately do NOT force workouts into predetermined buckets as they arrive.
Every transcribed workout goes into the flat ALL_WORKOUTS list below, in the
order received. Each carries only a *tentative* `group` tag — a memory aid, not a
commitment. Once all ~30 workouts are in, we run an affinity sort, decide the
final set of categories (count + names), re-tag, and regenerate ONCE.

To add a workout: append to ALL_WORKOUTS and re-run:  python3 bonus-deploy.py
Workout schema:
  {"group": "push", "title": "...", "note": "...optional intro...",
   "exercises": [
      {"name": "...", "sets": "4x10", "tempo": "1:2:1:0"(opt),
       "note": "..."(opt), "rest": "90 sec"(opt)},
   ]}
──────────────────────────────────────────────────────────────────────────────

This script regenerates cat-bonus.html plus one page per category in CATEGORIES.
Each category page is produced by cloning the proven workout-page engine in
bonus-pump-cst.html (tabs, set-logging via mc_setlog_v1, TMR rest timers,
finish-workout, progress bar) and swapping in that category's header + workouts.
After running, register any NEW page files in sw.js and bump CACHE_NAME.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "bonus-pump-cst.html")

# Bonus Workouts accent theme — sky/cyan (#38bdf8), distinct from existing themes.
ACCENT_TEXT = "#7dd3fc"
ACCENT_RGB = "56,189,248"

# ── PROVISIONAL category definitions ───────────────────────────────────────
# These buckets are NOT final — they exist so the flow is reviewable while we
# collect all ~30 workouts. After every workout is in ALL_WORKOUTS, revisit this
# list (rename / merge / split / reorder) to match the real distribution.
# `key` matches the `group` tag on workouts; `slug` is the output filename.
CATEGORIES = [
    {"key": "push",     "slug": "bonus-push",     "icon": "💥", "name": "Push",
     "tag": "Chest · Shoulders · Triceps",
     "meta": "Pressing-focused sessions for chest, shoulders, and triceps."},
    {"key": "pull",     "slug": "bonus-pull",     "icon": "🔙", "name": "Pull",
     "tag": "Back · Biceps",
     "meta": "Pulling-focused sessions for back width, thickness, and biceps."},
    {"key": "legs",     "slug": "bonus-legs",     "icon": "🦵", "name": "Legs",
     "tag": "Quads · Hams · Glutes",
     "meta": "Lower-body builders for quads, hamstrings, glutes, and calves."},
    {"key": "core",     "slug": "bonus-core",     "icon": "🔥", "name": "Core & Conditioning",
     "tag": "Abs · Cardio",
     "meta": "Ab circuits and conditioning finishers to cap off any day."},
    {"key": "fullbody", "slug": "bonus-fullbody", "icon": "⚡", "name": "Full Body",
     "tag": "Total Body",
     "meta": "Full-body circuits and anything-goes total-body sessions."},
]

# ── FLAT STAGING LIST — every workout, in the order received ────────────────
# `group` is a TENTATIVE tag only. Finalize categories after all ~30 are in.
ALL_WORKOUTS = [
    # ── Batch 1 (IMG_9753–9757) ──
    {"group": "push", "title": "Upper Chest & Anterior Delts", "exercises": [
        {"name": "Low Pulley Cable Cross Over", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Smith Machine Incline Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Hammer Strength Incline Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Hammer Strength Military Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Barbell Front Raise", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Push Ups", "sets": "4xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
    ]},
    {"group": "push", "title": "Traps & Shoulders", "exercises": [
        {"name": "Upright Row", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Barbell Shrug", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Chest Supported T-Bar Row (wide grip)", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Seated DB Shoulder Tri-Set", "sets": "4x8-12", "rest": "1 min", "note": "Per exercise: DB Lateral Raise → DB Overhead Press → DB Front Raise → Bent-Over Lateral Raise"},
        {"name": "Machine Overhead Press", "sets": "4x8-12", "rest": "1 min", "note": "Last set: drop set to failure"},
    ]},
    {"group": "pull", "title": "Back — Hammer Rows", "exercises": [
        {"name": "Hammer Strength High Row", "sets": "4x12-15", "rest": "1 min", "note": "Last set: rest-pause to failure"},
        {"name": "Hammer Strength Low Row", "sets": "4x12-15", "rest": "1 min", "note": "Last set: rest-pause to failure"},
        {"name": "Single Arm DB Row", "sets": "3x12-15", "rest": "30-60 sec", "note": "Per arm"},
        {"name": "Close Grip Cable Row", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Wide Grip Cable Row", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Face Pull", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Rower Machine", "sets": "1 round", "note": "2000m on the rower machine — finisher"},
    ]},
    {"group": "pull", "title": "Arms & Forearms", "exercises": [
        {"name": "Alternating Pinwheel Curl", "sets": "2x8-12", "rest": "1 min", "note": "Go heavier than a hammer curl — same muscles"},
        {"name": "Reverse Grip Barbell Curl", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Single Arm DB Preacher Curl", "sets": "3x8-12", "rest": "30 sec", "note": "Per arm"},
        {"name": "DB Wrist Curl", "sets": "3x12-15", "rest": "0 sec", "note": "Per arm · no rest between arms"},
        {"name": "Plate Pinch", "sets": "3xfailure", "rest": "30-60 sec", "note": "Holds to failure — pinch a plate with thumb & fingers"},
        {"name": "Towel Hangs", "sets": "3xfailure", "rest": "30 sec", "note": "Holds to failure"},
    ]},
    {"group": "fullbody", "title": "Full Body Bodyweight Workout", "exercises": [
        {"name": "Push Ups", "sets": "3xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Dips", "sets": "3xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Pull Ups", "sets": "3xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Chin Ups", "sets": "3xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Spider Crawl", "sets": "3x8-12", "rest": "30-60 sec", "note": "Per side"},
        {"name": "Step Up with Knee Raise", "sets": "3x12-15", "rest": "30 sec", "note": "Per side"},
        {"name": "Single Leg Glute Bridge", "sets": "3x8-12", "rest": "30 sec", "note": "Per side"},
        {"name": "Pistol Squat", "sets": "3x8-12", "rest": "30 sec", "note": "Per side"},
        {"name": "V-Sit", "sets": "5x10-15", "rest": "30 sec"},
        {"name": "Plank", "sets": "3x1 min", "rest": "30 sec", "note": "1-minute holds"},
        {"name": "Jump Rope", "sets": "10 min", "note": "Don't count rest toward the 10 minutes of jumping"},
    ]},
    # ── Batch 2 (IMG_9748–9752) ──
    {"group": "legs", "title": "Squat Power & Calves", "exercises": [
        {"name": "Squat Jumps", "sets": "3x10", "rest": "30 sec", "note": "Warm-up — explosive"},
        {"name": "Barbell Squat", "sets": "5x6-8", "rest": "2-3 min"},
        {"name": "Standing Long Jump", "sets": "5x8", "rest": "1 min", "note": "Be explosive — challenging after the squats"},
        {"name": "Standing Calf Raise", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Seated Calf Raise", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Jump Rope / Burpees", "sets": "5-10 rounds", "note": "30-60 sec jump rope + 5-10 burpees per round; total rounds depend on conditioning"},
    ]},
    {"group": "legs", "title": "Hanging Hamstrings", "exercises": [
        {"name": "Bodyweight Walking Lunges", "sets": "3x10", "rest": "30 sec", "note": "Per leg"},
        {"name": "High & Wide Stance Leg Press", "sets": "5x8-12", "rest": "1-2 min"},
        {"name": "DB Stiff Leg Deadlift", "sets": "5x8-12", "rest": "1-2 min"},
        {"name": "Lying Leg Curl", "sets": "3x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Seated Leg Curl", "sets": "3x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
    ]},
    {"group": "pull", "title": "Pump Arm Day", "exercises": [
        {"name": "Close Grip Cable EZ Bar Curl", "sets": "3x12-15", "rest": "30-60 sec", "note": "Last set: drop set to failure"},
        {"name": "Wide Grip Cable EZ Bar Curl", "sets": "3x12-15", "rest": "30-60 sec", "note": "Last set: drop set to failure"},
        {"name": "Reverse Grip Cable EZ Bar Curl", "sets": "3x12-15", "rest": "30-60 sec", "note": "Last set: drop set to failure"},
        {"name": "Alternating Pinwheel Curls", "sets": "3x8-12", "rest": "30-60 sec", "note": "Per arm"},
        {"name": "V-Grip Pressdown", "sets": "3x12-15", "rest": "30-60 sec", "note": "Last set: drop set to failure"},
        {"name": "Skull Crushers", "sets": "3x8-12", "rest": "30-60 sec"},
        {"name": "Rope Overhead Extension", "sets": "3x12-15", "rest": "30-60 sec"},
        {"name": "Rope Pressdown", "sets": "3x12-15", "rest": "30-60 sec", "note": "Last set: drop set to failure"},
    ]},
    # ── Batch 3 (IMG_9743–9747) ──
    {"group": "legs", "title": "Strong Leg Day", "exercises": [
        {"name": "Bodyweight Squats", "sets": "3x10", "rest": "1 min"},
        {"name": "Bodyweight Lunges", "sets": "3x10", "rest": "30 sec", "note": "Per leg"},
        {"name": "Squats", "sets": "10x5", "rest": "1-3 min", "note": "Take your time — this is the main work of the day"},
        {"name": "Leg Press", "sets": "3x12-15", "rest": "1 min", "note": "Slightly lighter than normal — chase the pump"},
        {"name": "Calf Press on Leg Press", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Stairmaster", "sets": "15 min", "note": "Low intensity cardio"},
    ]},
    {"group": "core", "title": "Strong Core", "note": "Circuit style — 1-2 min rest between exercises. Repeat for 5-10 rounds. Can be done on its own or added onto any workout.", "exercises": [
        {"name": "Incline Sit Up", "sets": "10 reps"},
        {"name": "Plank", "sets": "1 min"},
        {"name": "Hanging Leg Raise", "sets": "10 reps"},
        {"name": "Plank", "sets": "1 min"},
        {"name": "Back Hyperextension", "sets": "10 reps"},
    ]},
    {"group": "fullbody", "title": "This Isn't Crossfit", "note": "Circuit style — 1-2 min rest between sets. Repeat for 5-10 rounds.", "exercises": [
        {"name": "Bodyweight Squats", "sets": "30 sec", "note": "As many reps as possible in 30 sec"},
        {"name": "Push Ups", "sets": "30 sec", "note": "As many reps as possible in 30 sec"},
        {"name": "Pull Ups", "sets": "30 sec", "note": "As many reps as possible in 30 sec"},
        {"name": "Smith Machine Squat", "sets": "10 reps"},
        {"name": "Flat Smith Machine Press", "sets": "10 reps"},
        {"name": "Rack Chins on Smith Machine", "sets": "15 reps"},
    ]},
    {"group": "pull", "title": "Strong Deadlifts", "exercises": [
        {"name": "Deadlift", "sets": "5x5", "rest": "2-3 min"},
        {"name": "Barbell Shrug", "sets": "5x12-15", "rest": "1-2 min"},
        {"name": "Close Stance Leg Press", "sets": "5x8-12", "rest": "1-2 min"},
        {"name": "Close Grip Cable Row", "sets": "3x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Wide Grip Cable Row", "sets": "3x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
    ]},
    {"group": "legs", "title": "Weird Squat Workout", "exercises": [
        {"name": "Overhead Squat", "sets": "3x12-15", "rest": "1-2 min", "note": "Warm-up"},
        {"name": "Zercher Squat", "sets": "5x5", "rest": "2-3 min"},
        {"name": "Barbell Hack Squat", "sets": "4x8-12", "rest": "1-2 min"},
        {"name": "Jefferson Squat", "sets": "4x12-15", "rest": "1-2 min"},
        {"name": "Bulgarian Split Squat", "sets": "2x12-15", "rest": "30-60 sec", "note": "Per leg"},
    ]},
    # ── Batch 4 (IMG_9738–9742) ──
    {"group": "legs", "title": "Legs and Shoulders", "exercises": [
        {"name": "DB Lateral Raise", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Barbell Front Raise", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Machine Overhead Press", "sets": "4x8-12", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Back Squat", "sets": "4x8-12", "rest": "1-2 min"},
        {"name": "Overhead Squat", "sets": "3x8-12", "rest": "1 min", "note": "Try a broomstick/PVC pipe or preloaded barbell overhead"},
        {"name": "Overhead Lunge", "sets": "3 sets", "rest": "1 min", "note": "Reps per leg · hold a broomstick/PVC, barbell, DBs, or KBs overhead"},
    ]},
    {"group": "pull", "title": "Back and Shoulders", "exercises": [
        {"name": "Pull Ups", "sets": "3xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Underhand Grip Lat Pulldown", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Wide Grip Cable Row", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Deadlift", "sets": "5x5", "rest": "1-3 min"},
        {"name": "Single Arm Cable Lateral Raise", "sets": "3x8-12", "rest": "30 sec", "note": "Per arm"},
        {"name": "Standing Single Arm Overhead Press", "sets": "4x8-12", "rest": "1 min", "note": "Per arm"},
        {"name": "Rope Upright Row", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Facepull", "sets": "3x12-15", "rest": "1 min"},
    ]},
    {"group": "pull", "title": "Arm Day — Cables & Tempo", "note": "Title was not captured in the source screenshot.", "exercises": [
        {"name": "Cable Barbell Curl", "sets": "4x8-12", "rest": "1 min", "note": "5 sec concentric / 5 sec eccentric each rep"},
        {"name": "Pinwheel Curl", "sets": "4x8-12", "rest": "1 min"},
        {"name": "DB Hammer Preacher Curl", "sets": "4x8-12", "rest": "1 min"},
        {"name": "2 Arm DB Kickback", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Seated EZ Bar Overhead Extension", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Tate Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Rope Pressdown", "sets": "4x8-12", "rest": "1 min", "note": "Last set: drop set to failure"},
    ]},
    {"group": "push", "title": "Chest, Traps & Rower", "note": "Title was not captured in the source screenshot.", "exercises": [
        {"name": "Push Ups", "sets": "3xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Decline Smith Machine Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Dips", "sets": "4x8-12", "rest": "1 min", "note": "Add weight with a dip belt for difficulty"},
        {"name": "DB Incline Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Barbell Shrugs", "sets": "5x12-15", "rest": "1 min"},
        {"name": "Cable Upright Row", "sets": "4x8-12", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Rower Machine", "sets": "1 round", "note": "2000m on the rower machine — finisher"},
    ]},
    # ── Batch 5 (IMG_9733–9737) ──
    {"group": "legs", "title": "Quads and Triceps", "exercises": [
        {"name": "V-Grip Pressdown", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Rope Overhead Extension", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Leg Extension", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Step Up", "sets": "4x8-12", "rest": "1 min", "note": "Optional: hold DBs to add resistance"},
        {"name": "Narrow Stance Hack Squat", "sets": "4x8-12", "rest": "1 min", "note": "Feet almost touching"},
        {"name": "Sissy Squat", "sets": "4x8-12", "rest": "1 min", "note": "Optional: slow the eccentric on each rep"},
    ]},
    {"group": "legs", "title": "Glutes & Posterior", "note": "Title was not captured in the source screenshot.", "exercises": [
        {"name": "Donkey Kicks", "sets": "4x8-12", "rest": "0 sec", "note": "Per leg · focus on the glute contraction"},
        {"name": "Hip Thrusts", "sets": "4x15-20", "rest": "1 min"},
        {"name": "Glute Bridge", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Good Morning", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Goblet Squat", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Incline Treadmill", "sets": "10 min", "note": "Low intensity cardio"},
        {"name": "Stairmaster", "sets": "10 min", "note": "Low intensity · add a kickback + glute contraction each step"},
    ]},
    {"group": "pull", "title": "Back and Biceps", "exercises": [
        {"name": "Close Grip Lat Pulldown", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Single Arm Cable Row", "sets": "4x12-15", "rest": "30 sec", "note": "Per arm · last set: drop set to failure"},
        {"name": "DB Pullover", "sets": "4x12-15", "rest": "1 min", "note": "Focus on the stretch over total weight"},
        {"name": "Chin Ups", "sets": "5xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Close Grip EZ Bar Preacher Curl", "sets": "3x8-12", "rest": "1 min"},
        {"name": "Reverse Grip EZ Bar Preacher Curl", "sets": "3x8-12", "rest": "1 min"},
    ]},
    {"group": "push", "title": "Chest and Triceps", "exercises": [
        {"name": "Pec Deck", "sets": "4x12-15", "rest": "1 min", "note": "Hold the contraction 3-5 sec each rep"},
        {"name": "Single Arm Hammer Strength Incline", "sets": "4x8-12", "rest": "30-60 sec", "note": "Per side · one side at a time"},
        {"name": "Hammer Strength Decline", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Cable Crossover", "sets": "3x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Dip Machine", "sets": "4x8-12", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Rope Overhead Extension", "sets": "4x8-12", "rest": "1 min"},
        {"name": "DB Kickback", "sets": "4x8-12", "rest": "1 min"},
    ]},
    # ── Batch 6 (IMG_9728–9732) ──
    {"group": "legs", "title": "Quad Focused Leg Day", "exercises": [
        {"name": "Leg Extension", "sets": "4x20-25", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Bulgarian Split Squat", "sets": "3x8-12", "rest": "30 sec", "note": "Per leg"},
        {"name": "Front Squat", "sets": "4x8-12", "rest": "1-2 min"},
        {"name": "Hack Squat", "sets": "3x12-15", "rest": "1-2 min"},
        {"name": "Walking Lunges", "sets": "200 total", "note": "200 total bodyweight lunges — rest as needed"},
        {"name": "Stairmaster", "sets": "5 min", "note": "Low intensity, performed in reverse on the machine"},
    ]},
    {"group": "pull", "title": "Compound Arm Day", "exercises": [
        {"name": "Reverse Grip Barbell Curls", "sets": "4x8-12", "rest": "1 min", "note": "Thumbless grip for added challenge"},
        {"name": "Barbell Curls", "sets": "4x8-12", "rest": "1 min"},
        {"name": "EZ Bar Preacher Curls", "sets": "3x12-15", "rest": "1 min", "note": "Wide or close grip — whichever feels best"},
        {"name": "Close Grip Bench Press", "sets": "4x8-12", "rest": "1-2 min"},
        {"name": "Dead Skulls", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Seated EZ Bar Overhead Extension", "sets": "3x12-15", "rest": "1 min"},
    ]},
    {"group": "pull", "title": "Back, Delts & Rower", "note": "Title was not captured in the source screenshot.", "exercises": [
        {"name": "Pull Ups / Chin Ups", "sets": "2xfailure", "rest": "1 min", "note": "2 sets of each — bodyweight to failure"},
        {"name": "Lat Pulldown", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Close Grip Lat Pulldown", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Wide Grip Cable Row", "sets": "4x8-12", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "DB Lateral Raise", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Upright Row", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Rower Machine", "sets": "1 round", "note": "2000m total"},
    ]},
    {"group": "push", "title": "Be Strong Overhead", "exercises": [
        {"name": "High Incline Smith Machine Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Seated DB Military Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Standing Push Press", "sets": "5x6-8", "rest": "1-2 min"},
        {"name": "Overhead Squat", "sets": "3x8-12", "rest": "1-2 min"},
        {"name": "Turkish Get Up", "sets": "3x5", "rest": "30-60 sec", "note": "Per side"},
    ]},
    {"group": "core", "title": "Grip & Core", "note": "Title was not captured in the source screenshot.", "exercises": [
        {"name": "DB Wrist Curl", "sets": "4x12-15", "rest": "0 sec", "note": "Per arm · no rest between arms"},
        {"name": "Towel Hang Leg Raise", "sets": "5x10", "rest": "30 sec", "note": "Drape two towels over a pull-up bar and grip them"},
        {"name": "Single Arm Rope Hammer Curl", "sets": "3x12-15", "rest": "30 sec", "note": "Per arm"},
        {"name": "Incline Sit Up", "sets": "5x10", "rest": "30 sec", "note": "Optional: hold a plate"},
        {"name": "Fingertip Plank", "sets": "5x30-60 sec", "rest": "30-60 sec", "note": "Plank from a push-up position on your fingertips"},
        {"name": "Plate Pinch", "sets": "5x20-30 sec", "rest": "30 sec", "note": "Holds"},
    ]},
    # ── Batch 7 (IMG_9723–9727) ──
    {"group": "pull", "title": "Back — Pulldowns & Rows", "note": "Title was not captured in the source screenshot.", "exercises": [
        {"name": "Pull Ups / Chin Ups", "sets": "6xfailure", "rest": "1 min", "note": "3 sets pull ups + 3 sets chin ups — bodyweight to failure"},
        {"name": "Lat Pull Down", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Single Arm Hammer Strength Row", "sets": "4x8-12", "rest": "30-60 sec"},
        {"name": "Close Grip Cable Row", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Wide Grip Cable Row", "sets": "4x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "DB Pullover", "sets": "4x12-15", "rest": "1 min", "note": "Focus on the stretch of the negative over heavy weight"},
    ]},
    {"group": "core", "title": "Calves / Abs / Cardio", "exercises": [
        {"name": "Seated Calf Raise", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Calf Press on Leg Press", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Standing Calf Raise", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Incline Sit Up", "sets": "5x10", "rest": "1 min"},
        {"name": "Hanging Leg Raise", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Ab Wheel", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Stairmaster", "sets": "20 min", "note": "Low intensity cardio"},
    ]},
    {"group": "pull", "title": "All Barbell Back Workout", "exercises": [
        {"name": "Barbell Shrug", "sets": "4x15-20", "rest": "1 min", "note": "Slight pelvic tilt forward; shrug up-and-back in one motion"},
        {"name": "Barbell Row", "sets": "4x8-12", "rest": "1 min"},
        {"name": "T-Bar Row", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Meadows Row", "sets": "4x12-15", "rest": "30 sec", "note": "Per arm · take extra rest if needed, finish strong"},
        {"name": "Barbell Pullover", "sets": "4x12-15", "rest": "1 min"},
    ]},
    {"group": "push", "title": "All Dumbbell Chest Workout", "exercises": [
        {"name": "Flat DB Flye Press", "sets": "4x8-12", "rest": "1 min", "note": "Eccentric as a flye, concentric as a press"},
        {"name": "Decline DB Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Flat DB Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Incline DB Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Decline DB Flye", "sets": "4x8-12", "rest": "1 min", "note": "5 sec negative; focus on the stretch, keep weight moderate"},
    ]},
    {"group": "fullbody", "title": "Upper Body Strength", "exercises": [
        {"name": "Push Ups", "sets": "3xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Barbell Bench Press", "sets": "5x3-5", "rest": "2-3 min"},
        {"name": "Standing Overhead Press", "sets": "5x5-8", "rest": "2-3 min"},
        {"name": "Pull Ups", "sets": "3xfailure", "rest": "1 min", "note": "Bodyweight to failure"},
        {"name": "Barbell Row", "sets": "5x8-12", "rest": "1-2 min"},
        {"name": "Cardio", "sets": "1 round", "note": "2000m on the rower OR 10 min HIIT on the stationary bike"},
    ]},
    # ── Batch 8 (IMG_9717–9722) ──
    {"group": "pull", "title": "Back/Triceps Supersets", "note": "Pair one back (pull) move with one triceps (push) move as a superset. 5 sets of 12-15 reps, 1 min rest after each superset.", "exercises": [
        {"name": "Chin Ups / Push Ups", "sets": "5x12-15", "rest": "1 min", "note": "Superset"},
        {"name": "Pull Ups / Dips", "sets": "5x12-15", "rest": "1 min", "note": "Superset"},
        {"name": "Smith Machine Barbell Row / Close Grip Bench Press (Smith)", "sets": "5x12-15", "rest": "1 min", "note": "Superset"},
        {"name": "2 Arm DB Row / 2 Arm DB Kickback", "sets": "5x12-15", "rest": "1 min", "note": "Superset"},
        {"name": "Rope Pullover / Rope Pressdown", "sets": "5x12-15", "rest": "1 min", "note": "Superset"},
    ]},
    {"group": "push", "title": "Chest/Biceps Supersets", "note": "Pair one chest (push) move with one biceps (pull) move as a superset. 5 sets of 12-15 reps, 1 min rest after each superset.", "exercises": [
        {"name": "Cable Crossover / Front Double Bicep Curl", "sets": "5x12-15", "rest": "1 min", "note": "Superset · curl with cables set on the high pulley"},
        {"name": "Barbell Bench Press / Seated Alternating DB Curl", "sets": "5x12-15", "rest": "1 min", "note": "Superset · do the curl at the foot of the bench"},
        {"name": "Hammer Strength Decline Press / Single Arm Concentration Curl", "sets": "5x12-15", "rest": "1 min", "note": "Superset"},
        {"name": "Push Ups / EZ Bar Preacher Curl", "sets": "5x12-15", "rest": "1 min", "note": "Superset"},
        {"name": "DB Fly / 2 Arm DB Hammer Curl", "sets": "5x12-15", "rest": "1 min", "note": "Superset · same dbells for both"},
    ]},
    {"group": "legs", "title": "Leg Press Foot-Placement Circuit", "note": "Title not captured. A full-leg circuit on the leg press varying foot placement — slightly heavier on standard placements, lighter on the others.", "exercises": [
        {"name": "Standard Foot Placement", "sets": "2x8-12", "rest": "1-2 min"},
        {"name": "High & Wide", "sets": "2x12-15", "rest": "1-2 min"},
        {"name": "Close & Narrow", "sets": "2x12-15", "rest": "1-2 min"},
        {"name": "Standard Wide", "sets": "2x8-12", "rest": "1-2 min"},
        {"name": "High & Narrow", "sets": "2x12-15", "rest": "1-2 min"},
        {"name": "Close & Wide", "sets": "2x12-15", "rest": "1-2 min"},
    ]},
    # ── Batch 9 (IMG_9712–9716) ──
    {"group": "push", "title": "Shoulders/Traps Volume Work", "note": "Add volume by using a rest-pause technique or a drop set on your last set of each exercise.", "exercises": [
        {"name": "Cable Upright Row", "sets": "3x12-15", "rest": "1 min"},
        {"name": "DB Lateral Raise", "sets": "4x12-15", "rest": "1 min"},
        {"name": "DB Military Press", "sets": "5x12-15", "rest": "1 min"},
        {"name": "Reverse Pec Deck", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Barbell Front Raise", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Barbell Shrug", "sets": "5x12-15", "rest": "1 min"},
    ]},
    {"group": "legs", "title": "Cardio Leg Day Challenge", "note": "Cardio + bodyweight lower-body challenge. Perform the mini-circuit back-to-back for 10 total rounds (= 1000 jumps, 200 lunges). Calf stretch gives a short rest between rounds. Optional: hold DBs during lunges.", "exercises": [
        {"name": "Jump Rope", "sets": "100 jumps", "note": "Per round"},
        {"name": "Walking Lunges", "sets": "10 per leg", "note": "Per round"},
        {"name": "Calf Stretch", "sets": "15 sec", "note": "Per leg, between rounds"},
    ]},
    {"group": "push", "title": "Chest/Shoulders/Back", "exercises": [
        {"name": "Pec Deck", "sets": "3x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Reverse Pec Deck", "sets": "3x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Incline Hammer Strength Press", "sets": "4x8-12", "rest": "1 min", "note": "Last set: rest-pause to failure"},
        {"name": "Hammer Strength Decline Press", "sets": "4x8-12", "rest": "1 min", "note": "Last set: rest-pause to failure"},
        {"name": "Hammer Strength High Row", "sets": "4x8-12", "rest": "1 min", "note": "Last set: rest-pause to failure"},
        {"name": "Close Grip Lat Pulldown", "sets": "3x12-15", "rest": "1 min", "note": "Last set: drop set to failure"},
        {"name": "Rower Machine", "sets": "1 round", "note": "2000m on the rower machine"},
    ]},
    {"group": "fullbody", "title": "Arms & Legs", "note": "Title was not captured in the source screenshot.", "exercises": [
        {"name": "Barbell Curl", "sets": "3x8-12", "rest": "1 min"},
        {"name": "Reverse Grip Barbell Curl", "sets": "3x8-12", "rest": "1 min"},
        {"name": "Dead Skulls", "sets": "3x8-12", "rest": "1 min"},
        {"name": "Rope Extension", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Leg Extension", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Leg Curls", "sets": "3x12-15", "rest": "1 min"},
        {"name": "Squats", "sets": "5x8-10", "rest": "1-2 min"},
        {"name": "Standing Calf Raise", "sets": "4x12-15", "rest": "1 min"},
    ]},
    # ── Batch 10 (IMG_9707–9711) ──
    {"group": "push", "title": "Machine Only Push Workout", "note": "Optional: make your last set of every exercise a drop set to failure.", "exercises": [
        {"name": "Dip Machine", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Flat Chest Press Machine", "sets": "4x8-12", "rest": "1-2 min"},
        {"name": "Machine Overhead Press", "sets": "4x8-12", "rest": "1-2 min"},
        {"name": "Leg Extension", "sets": "4x20-25", "rest": "1 min"},
        {"name": "Standing Calf Raise", "sets": "4x20-25", "rest": "1 min"},
    ]},
    {"group": "pull", "title": "Machine Only Pull Workout", "note": "Optional: make your last set of every exercise a drop set to failure. Add weight to the hyperextension if needed.", "exercises": [
        {"name": "Lat Pull Down", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Close Grip Cable Row", "sets": "4x12-15", "rest": "1 min"},
        {"name": "Lying Hamstring Curl", "sets": "4x20-25", "rest": "1 min"},
        {"name": "Cable Barbell Curl", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Hyperextension", "sets": "4x12-15", "rest": "1 min"},
    ]},
    {"group": "fullbody", "title": "Full Body Kettlebell/DBell Workout", "note": "Can be performed with kettlebells or dumbbells.", "exercises": [
        {"name": "Ballistic Row", "sets": "4x10-15", "rest": "1 min", "note": "Per arm"},
        {"name": "2 Arm Standing Overhead Press", "sets": "4x8-12", "rest": "1 min"},
        {"name": "Sots Press", "sets": "5x10", "rest": "1 min"},
        {"name": "Jump Squat", "sets": "10x5", "rest": "30 sec"},
        {"name": "Reverse Lunge", "sets": "4x8-12", "rest": "30 sec", "note": "Per leg"},
    ]},
    {"group": "legs", "title": "Lower Body Explosiveness", "exercises": [
        {"name": "HIIT Cardio (Stationary Bike)", "sets": "10 min", "note": "Start the session with this"},
        {"name": "Standing Long Jump", "sets": "5x5", "rest": "30 sec", "note": "Set feet, perfect form — try to jump farther each time"},
        {"name": "Back Squat", "sets": "5x5", "rest": "2-3 min"},
        {"name": "Leg Press", "sets": "5x5", "rest": "2-3 min", "note": "Lower halfway + pause 2-3s, lower fully + pause 2-3s, explode up without locking the knees"},
        {"name": "Jump Squat w/ Kettlebell or DB", "sets": "5x8-10", "rest": "1 min"},
        {"name": "Burpees", "sets": "3x10", "rest": "1 min"},
        {"name": "Jump Rope", "sets": "5-10 min", "note": "Don't count rest toward the time"},
    ]},
    # ── Batch 11+ goes here as screenshots arrive ──
    # ⚠ MISSING: a home/circuit-style workout (intro seen between "Be Strong
    #   Overhead" and "Grip & Core"); only its intro + last line were captured.
    #   Needs a clean screenshot before it can be transcribed.
]

# Shown on a category page that has no real workouts yet.
COMING_SOON = {"title": "More workouts coming soon",
               "note": "Workouts for this category are being added from the screenshot library.",
               "exercises": [{"name": "Workouts pending import", "sets": "—"}]}


def workouts_for(key):
    """All staged workouts tentatively tagged for this category, in order."""
    return [w for w in ALL_WORKOUTS if w.get("group") == key]


def _label(i):
    return "W" + str(i + 1)


def build_workouts_js(items):
    """Convert workout dicts into the WORKOUTS array the page engine expects."""
    out = []
    for i, w in enumerate(items):
        wo = {"id": chr(ord("a") + i), "label": _label(i), "title": w["title"]}
        if w.get("note"):
            wo["note"] = w["note"]
        wo["exercises"] = w["exercises"]
        out.append(wo)
    return "const WORKOUTS = " + json.dumps(out, ensure_ascii=False, indent=2) + ";"


def build_category_page(cat, items):
    with open(TEMPLATE, "r", encoding="utf-8") as f:
        base = f.read()

    # 1) Swap the WORKOUTS array (between the declaration and `let activeIdx`).
    i = base.index("const WORKOUTS = [")
    j = base.index("let activeIdx = 0;")
    base = base[:i] + build_workouts_js(items) + "\n\n" + base[j:]

    # 2) Title + accent theme.
    base = base.replace(
        "<title>Bonus Pump – Chest / Shoulders / Triceps</title>",
        "<title>Bonus Workouts – {}</title>".format(cat["name"]))
    base = base.replace(
        ":root{--accent:#93c5fd;--accent-rgb:147,197,253;}",
        ":root{{--accent:{};--accent-rgb:{};}}".format(ACCENT_TEXT, ACCENT_RGB))

    # 3) "Surprise Me" button styling.
    base = base.replace(
        "@keyframes rp{0%,100%{opacity:1;}50%{opacity:0.65;}}\n</style>",
        "@keyframes rp{0%,100%{opacity:1;}50%{opacity:0.65;}}\n"
        ".surprise-wrap{max-width:680px;margin:0 auto;padding:12px 12px 0;}\n"
        ".surprise-btn{width:100%;padding:13px 16px;border:none;border-radius:12px;"
        "cursor:pointer;font-weight:900;font-size:14px;letter-spacing:0.04em;color:#04141f;"
        "background:linear-gradient(135deg,var(--accent),#38bdf8);"
        "box-shadow:0 4px 16px rgba(var(--accent-rgb),0.3);}\n"
        ".surprise-btn:active{transform:scale(0.98);}\n</style>")

    # 4) Header block inside render() — back-link, eyebrow, title, subtitle, count.
    base = base.replace(
        '<a href="cat-pump.html" class="back-link">← Back</a>',
        '<a href="cat-bonus.html" class="back-link">← Back</a>')
    base = base.replace(
        '<div class="eyebrow">⭐ Bonus Pump</div>',
        '<div class="eyebrow">{} Bonus Workouts</div>'.format(cat["icon"]))
    base = base.replace(
        '<div class="title">Chest / Shoulders / Triceps</div>',
        '<div class="title">{}</div>'.format(cat["name"]))
    base = base.replace(
        '<div class="subtitle">Uncategorized split workouts</div>',
        '<div class="subtitle">{}</div>'.format(cat["tag"]))
    base = base.replace(
        '<div><span class="schedule">8 Workout Variations</span></div>',
        '<div><span class="schedule">{} Workouts</span></div>'.format(len(items)))
    base = base.replace(
        '<div class="bonus-badge">⭐ Bonus Pump</div>',
        '<div class="bonus-badge">{} Bonus Workouts</div>'.format(cat["icon"]))

    # 5) Inject the "Surprise Me" button into the rendered layout.
    base = base.replace(
        '<div class="tabs-bar"><div class="tabs">${tabsHtml}</div></div>',
        '<div class="tabs-bar"><div class="tabs">${tabsHtml}</div></div>\n'
        '    <div class="surprise-wrap"><button class="surprise-btn" '
        'onclick="surpriseMe()">🎲 Surprise Me</button></div>')

    # 6) Define surpriseMe() and expose it before the first render() call.
    base = base.replace(
        'render();\nif(typeof updateProgress!=="undefined")updateProgress();',
        'function surpriseMe(){if(WORKOUTS.length<2)return;var n;do{'
        'n=Math.floor(Math.random()*WORKOUTS.length);}while(n===activeIdx);'
        'activeIdx=n;render();window.scrollTo({top:0,behavior:"smooth"});}\n'
        'window.surpriseMe=surpriseMe;\n'
        'render();\nif(typeof updateProgress!=="undefined")updateProgress();')

    return base


HUB_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Bonus Workouts</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif;}}
body{{background:#0a0a0a;min-height:100vh;color:#fff;padding:32px 18px 60px;}}
.container{{max-width:680px;margin:0 auto;}}
.back-link{{display:inline-block;color:#7dd3fc;text-decoration:none;font-size:13px;font-weight:700;background:rgba(56,189,248,0.12);padding:6px 14px;border-radius:20px;border:1px solid rgba(56,189,248,0.3);margin-bottom:24px;letter-spacing:0.04em;}}
.eyebrow{{font-size:11px;font-weight:800;letter-spacing:0.25em;color:#7dd3fc;text-transform:uppercase;margin-bottom:10px;}}
.title{{font-size:30px;font-weight:900;color:#fff;letter-spacing:-0.02em;margin-bottom:6px;}}
.subtitle{{font-size:13px;color:#0e7490;margin-bottom:20px;}}
.intro{{font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:24px;background:rgba(56,189,248,0.06);border-left:3px solid rgba(56,189,248,0.4);padding:12px 14px;border-radius:0 8px 8px 0;}}
.plan-card{{display:block;text-decoration:none;color:inherit;border-radius:16px;padding:18px 20px;margin-bottom:11px;position:relative;overflow:hidden;transition:transform 0.15s;background:linear-gradient(135deg,rgba(56,189,248,0.08),#04141f);border:1px solid rgba(56,189,248,0.2);}}
.plan-card:active{{transform:scale(0.98);}}
.plan-icon{{position:absolute;right:18px;top:50%;transform:translateY(-50%);font-size:30px;opacity:0.35;}}
.plan-tag{{font-size:11px;font-weight:900;letter-spacing:0.16em;padding:3px 9px;border-radius:5px;text-transform:uppercase;margin-bottom:9px;display:inline-block;background:rgba(56,189,248,0.14);color:#7dd3fc;border:1px solid rgba(56,189,248,0.25);}}
.plan-name{{font-size:19px;font-weight:900;color:#fff;margin-bottom:4px;padding-right:46px;}}
.plan-meta{{font-size:12px;color:#7dd3fc;opacity:0.75;line-height:1.5;padding-right:46px;}}
.plan-count{{margin-top:8px;font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;}}
</style>
<link rel="stylesheet" href="base.css"/>
<link rel="stylesheet" href="mc-nav.css"/>
<style>.back-link{{position:static;}}</style>
</head>
<body>
<div class="container">
  <a href="index.html" class="back-link">← Categories</a>
  <div class="eyebrow">⭐ Bonus Workouts</div>
  <h1 class="title">Bonus Workouts</h1>
  <p class="subtitle">Daily-variation extras · Pick a focus to get started</p>
  <div class="intro">A grab-bag of standalone workouts with no set progression — perfect for mixing things up. Choose a category, then browse the variations or tap <b>🎲 Surprise Me</b> to get one at random.</div>
{cards}
</div>

<script>
/* ── SMART BACK NAV ── */
(function(){{
  var back = sessionStorage.getItem('mc_back_to');
  if(!back) return;
  document.querySelectorAll('a').forEach(function(a){{
    var href = a.getAttribute('href')||'';
    if(href === 'index.html' || href === '../' || href === '/' ||
       href.includes('index') || a.textContent.trim().startsWith('←')){{
      a.href = back;
      a.addEventListener('click', function(){{ sessionStorage.removeItem('mc_back_to'); }});
    }}
  }});
}})();
</script>
<script src="mc-nav.js"></script>
<script src="mc-sw-update.js?v=45"></script>
</body>
</html>
"""

HUB_CARD = """  <a href="{slug}.html" class="plan-card">
    <span class="plan-icon">{icon}</span>
    <div class="plan-tag">{tag}</div>
    <div class="plan-name">{name}</div>
    <div class="plan-meta">{meta}</div>
    <div class="plan-count">{count}</div>
  </a>
"""


def _count_label(n):
    return "{} Workouts →".format(n) if n else "Coming soon"


def build_hub():
    cards = "\n".join(
        HUB_CARD.format(
            slug=c["slug"], icon=c["icon"], tag=c["tag"], name=c["name"],
            meta=c["meta"], count=_count_label(len(workouts_for(c["key"]))))
        for c in CATEGORIES)
    return HUB_TEMPLATE.format(cards=cards)


def write(path, content):
    with open(os.path.join(HERE, path), "w", encoding="utf-8") as f:
        f.write(content)
    print("  wrote", path)


def main():
    print("Generating Bonus Workouts pages… ({} workouts staged)".format(len(ALL_WORKOUTS)))
    write("cat-bonus.html", build_hub())
    for c in CATEGORIES:
        items = workouts_for(c["key"]) or [COMING_SOON]
        write(c["slug"] + ".html", build_category_page(c, items))
    print("Done. Register any new page files in sw.js and bump CACHE_NAME.")


if __name__ == "__main__":
    main()
