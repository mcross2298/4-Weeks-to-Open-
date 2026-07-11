/* ==========================================================================
   mm-data.js — single source of truth for The Modality Matrix trio
   (mm-p1.html / mm-p2.html / mm-p3.html).
   --------------------------------------------------------------------------
   Phase 3.2 consolidation. All three pages previously duplicated an
   identical render engine (renderExercise/renderDay/renderWeekTabs/
   switchWeek/render — see mm-engine.js) around per-phase WEEK_THEMES/DAYS
   data and header/summary metadata. WEEK_THEMES is byte-identical across
   all three phases, so it lives once, shared. Each phase's DAYS array and
   its small header/summary metadata (title, modality label, accent color,
   est. time per session) now live here, keyed by program id. Edit exercise
   data or metadata HERE — mm-engine.js and the three HTML shells consume it
   read-only.

   See CLAUDE.md's "Per-Day Intensifier Coverage" section for the fixed
   10-position blueprint this data must satisfy, and
   tools/validate-programs.js for the CI check that enforces it.
   ========================================================================== */
(function () {
  'use strict';

  var WEEK_THEMES = [
  { icon: "🏋️", label: "Week 1 · Low-Rep", text: "Low-Rep Strength — the 4 FEATURE lifts run heavy (5×5 · 8/6/4/4 · 4×6). Every anchor holds its scheme, so each day still carries all 7 intensifiers: low-rep, high-rep, TUT, tri-set, superset, cluster and drop." },
  { icon: "📈", label: "Week 2 · Pyramid", text: "Pyramid — the 4 FEATURE lifts run ascending-weight pyramids (15/12/10/8/6 · 12/10/8). All anchors stay put, so the full intensifier spread is intact." },
  { icon: "⏱️", label: "Week 3 · Tempo", text: "Tempo — the 4 FEATURE lifts use explicit tempo (5×10 @ 4-0-1 · 4×10 @ 3-1-1): slow eccentrics, constant tension. The complete intensifier spread remains across all 10 exercises." },
  { icon: "🔥", label: "Week 4 · High-Rep", text: "High-Rep Hypertrophy — the 4 FEATURE lifts blast 15–20 reps. The low-rep anchor stays heavy so every day keeps both ends of the rep spectrum." },
  { icon: "🔗", label: "Week 5 · Superset", text: "Superset — the 4 FEATURE lifts run paired back-to-back with AMRAP burnouts and minimal rest. Tri-set, cluster, drop, low-rep and high-rep anchors all remain, so every intensifier is still present." },
];

  var PROGRAMS = {
    p1: {
      id: 'p1', phase: 1, title: 'Dumbbell Split', modality: 'DB Only',
      accent: '#3b82f6', estPerSession: '60–75 min', backHref: 'cat-mm.html',
      days: [

  /* ════════════════ DAY 1 — CHEST (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 1", session: "Chest",
    color: "#e11d48", icon: "🏋️", exCount: 10,
    meta: "Archetype A · DB / Bench Anchor",
    exercises: [
      /* Ex 1 — LOW-REP ANCHOR (compound, heavy 5×5 every week) */
      { name: "Incline DB Press", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"heavy 5×5 every week · 3–4 sec eccentric · stretch pec at base · drive through sticking point" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add small load vs W1 · 3–4 sec eccentric · controlled press" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · full chest stretch" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · drive hard" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full control" },
      ]},
      /* Ex 2 — FEATURE compound · 5 sets (rep scheme rotates with weekly theme) */
      { name: "Flat DB Press", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · 2–3 sec bottom pause · lock out clean" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · 3–4 sec eccentric on heavier sets" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 (4 sec down · 0 pause · 1 sec up) · constant tension" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP blast · moderate weight · full ROM · 2–3 sec bottom pause" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Decline DB Press", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · 3–4 sec eccentric · station-anchored at bench" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · controlled descent · chest stretch" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · full stretch at base" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load even on high-rep week · controlled press" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest into the next move" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "DB Hex Press (flat, DBs touching)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · squeeze DBs together throughout" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec stretch pause at base · constant inward pressure" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · mechanical drop from Decline · same DBs" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · squeeze at top · no lockout bounce" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives held even on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rep scheme rotates with weekly theme · always 3 sets) */
      { name: "Incline DB Fly", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavier fly · 2–3 sec bottom pause · full chest stretch" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · squeeze at top" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · slow controlled arc · feel the pec stretch" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · light-moderate · constant tension" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · run as a paired superset · minimal rest" },
      ]},
      /* Ex 6 — SUPERSET A · FEATURE (rep scheme rotates · 4 sets · superset is its home in W5) */
      { name: "Flat DB Fly", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnout rounds · full arc" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · squeeze at peak" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · light-moderate · full ROM" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week) */
      { name: "DB Pullover (supine on flat bench)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"lats + chest stretch · 3–4 sec eccentric · 2 AMRAP rounds · elbows soft" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · feel lats engage · 2–3 sec bottom stretch · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"slow controlled arc · 3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"full stretch overhead · 2–3 sec bottom pause · 2 AMRAP rounds to failure" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — CLUSTER · FEATURE (working sets rotate with theme · always a cluster · 4 sets) */
      { name: "DB Squeeze Press (flat, DBs touching)", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · 15 sec between · squeeze DBs" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · metabolic peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets · + 3 clusters of 12" },
      ]},
      /* Ex 9 — DROP · anchor (4×12 then strip to failure, every week) */
      { name: "Low-Incline DB Press (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"4 working sets then strip ~30% · AMRAP to failure · 3–4 sec eccentric · full ROM" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · strip ~30% · AMRAP to failure · controlled press" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"progress load · double-drop optional · squeeze each rep" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the pump on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Push-Up (bodyweight finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · max reps each set · 3–4 sec eccentric lower · full chest stretch" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · 2–3 sec bottom pause · chest to floor" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled tempo" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"pump finish · full ROM · squeeze at top each rep" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · full ROM" },
      ]},
    ]
  },

  /* ════════════════ DAY 2 — ARMS (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 2", session: "Arms",
    color: "#8b5cf6", icon: "💪", exCount: 10,
    meta: "Archetype A · DB / Bench Anchor",
    exercises: [
      /* Ex 1 — LOW-REP ANCHOR (compound, heavy 5×6 every week) */
      { name: "Seated DB Curl (bilateral)", w: [
        { sets:"5×6", rest:"90 sec", tag:null, note:"heavy 5×6 every week · 3–4 sec eccentric · squeeze hard at peak · full supination" },
        { sets:"5×6", rest:"90 sec", tag:null, note:"same 5×6 · add small load vs W1 · 3–4 sec eccentric · strict form" },
        { sets:"5×6", rest:"90 sec", tag:null, note:"same 5×6 · progress load · 2–3 sec bottom pause · slow curl" },
        { sets:"5×6", rest:"90 sec", tag:null, note:"same 5×6 · stay heavy even on high-rep week · full supination" },
        { sets:"5×6", rest:"90 sec", tag:null, note:"same 5×6 · keep it heavy on superset week · strict form" },
      ]},
      /* Ex 2 — FEATURE compound · 5 sets (rep scheme rotates with weekly theme) */
      { name: "DB Skull Crusher (flat bench)", w: [
        { sets:"5×8",          rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy 5×8 · 2–3 sec bottom pause · elbows stacked over shoulders" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — increase weight each set · 3–4 sec eccentric descent · controlled to forehead" },
        { sets:"5×10 @ 4-0-1", rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 · elbows stay stacked · full ROM lockout" },
        { sets:"5×20",         rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · moderate weight · 2–3 sec bottom pause · squeeze at lockout" },
        { sets:"5×10, + 2×AMRAP", rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Incline DB Curl (bilateral, on incline bench)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · arms hang behind body · 3–4 sec eccentric · full stretch at base" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · incline stretch · slow supination" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · squeeze hard at peak" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · let arms hang fully · 3–4 sec eccentric every rep" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest into the next move" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "Seated DB Overhead Tricep Extension (bilateral)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · elbows tight · full overhead stretch" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec stretch pause overhead · controlled" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · squeeze at lockout · elbows stay narrow" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · keep elbows from flaring · full ROM" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives held even on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rep scheme rotates · always 3 sets) */
      { name: "DB Hammer Curl", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · neutral grip · brachialis focus · 3–4 sec eccentric" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · 2–3 sec bottom pause" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · neutral grip strict form" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP metabolic · 2–3 sec bottom pause · minimal momentum" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · run as a paired superset · minimal rest" },
      ]},
      /* Ex 6 — SUPERSET A · FEATURE (rep scheme rotates · 4 sets · superset is its home in W5) */
      { name: "DB Concentration Curl (seated on bench)", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · elbow braced on inner thigh" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · 2–3 sec bottom pause" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · slow curl · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · moderate weight" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week) */
      { name: "DB Kickback (bent over at bench, bilateral)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"2–3 sec hold at full extension · 2 AMRAP rounds to failure · upper arm parallel" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · 3–4 sec eccentric · squeeze tricep at lockout · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric lower · controlled · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"2–3 sec isometric hold at extension · 2 AMRAP rounds to failure" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — CLUSTER · FEATURE (working sets rotate with theme · always a cluster · 4 sets) */
      { name: "DB 21s (standing, full + partial curls)", w: [
        { sets:"4×21, + Cluster 6/6/6",    rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · 21s working sets then 3 heavy clusters of 6 lower-range · 15 sec between" },
        { sets:"4×21, + Cluster 8/10/12",  rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID cue · ascending cluster 8→10→12 lower-range · 15 sec between" },
        { sets:"4×21 @ 3-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 3-0-1 on the 21s + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×21, + Cluster 15/15/20", rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP · ascending cluster 15→15→20 · metabolic peak" },
        { sets:"4×21, + Cluster 12/12/12", rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the 21s working sets · + 3 clusters of 12" },
      ]},
      /* Ex 9 — DROP · anchor (4×12 then strip to failure, every week) */
      { name: "Single-Arm DB Preacher Curl (on incline bench)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strict preacher position · 3–4 sec eccentric · strip ~30% · AMRAP to failure · squeeze at peak" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 2–3 sec bottom pause · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · full stretch at bottom · drop to absolute failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"double-drop optional · 2–3 sec bottom pause · squeeze hard through failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Diamond Push-Up (bodyweight finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · hands diamond shape · tricep focus · 3–4 sec eccentric lower" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps each set · 2–3 sec bottom pause · chest to hands" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"max reps · minimal rest · 3–4 sec eccentric · tri-pump flush" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · controlled tempo · full ROM" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · full ROM" },
      ]},
    ]
  },

  /* ════════════════ DAY 3 — LEGS (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 3", session: "Legs",
    color: "#10b981", icon: "🦵", exCount: 10,
    meta: "Archetype A · DB / Bench Anchor",
    exercises: [
      /* Ex 1 — LOW-REP ANCHOR (compound, heavy 5×5 every week) */
      { name: "DB Goblet Squat", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"heavy 5×5 every week · 3–4 sec eccentric · heels elevated on plates · drive knees out · full depth" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add small load vs W1 · 3–4 sec eccentric · upright torso" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 2–3 sec bottom pause · drive up · heels flat" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · full ROM every rep" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full depth" },
      ]},
      /* Ex 2 — FEATURE compound · 5 sets (rep scheme rotates with weekly theme) */
      { name: "DB Romanian Deadlift (bilateral)", w: [
        { sets:"5×5",          rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy 5×5 · 3–4 sec eccentric · hinge at hips · squeeze glutes at top" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — increase weight each set · hip hinge strict · 2–3 sec bottom pause" },
        { sets:"5×10 @ 4-0-1", rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 · hamstring fully loaded at the stretch point" },
        { sets:"5×20",         rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · feel hamstring stretch every rep · moderate weight" },
        { sets:"5×10, + 2×AMRAP", rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3 — TRI-SET A · anchor (3×10 each every week) */
      { name: "DB Bulgarian Split Squat (rear foot on bench)", w: [
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"anchor 3×10 each · 3–4 sec eccentric · rear foot on bench · deep split position" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"anchor 3×10 each · add load vs W1 · front heel flat · controlled descent" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"anchor 3×10 each · 2–3 sec bottom pause · knee tracks over toe · deep position" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"anchor 3×10 each · 3–4 sec eccentric · full ROM · hold load on high-rep week" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"anchor 3×10 each · superset week — minimal rest into the next move" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "DB Step-Up (to bench height)", w: [
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives on the lower every step · heel drive throughout" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec hold at top · drive through heel" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · controlled step · no momentum" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full hip extension at top each rep" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives held even on superset week · controlled" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rep scheme rotates · always 3 sets) */
      { name: "DB Hip Thrust (shoulders on bench)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavy · 2–3 sec peak squeeze · drive hips fully at top" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · squeeze glutes" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · 2 sec hold at top · drive through heels" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP glute blast · 3–4 sec eccentric · moderate DB" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · run as a paired superset · minimal rest" },
      ]},
      /* Ex 6 — SUPERSET A · FEATURE (rep scheme rotates · 4 sets · superset is its home in W5) */
      { name: "DB Glute Bridge (feet elevated on bench)", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · 2–3 sec peak hold" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · full hip drive" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · full hip extension every rep" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week) */
      { name: "Seated DB Calf Raise (seated on bench edge)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"2–3 sec peak squeeze · 2 AMRAP rounds to failure · full ROM · DB on knees" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · 3–4 sec eccentric lower · full stretch at bottom · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric lower · 2 AMRAP burnout rounds · feel gastrocnemius stretch" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"2–3 sec peak pause · 2 AMRAP rounds · full range every rep" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — CLUSTER · FEATURE (working sets rotate with theme · always a cluster · 4 sets) */
      { name: "DB Walking Lunge", w: [
        { sets:"4×6 each, + Cluster 6/6/6",     rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 steps each side · 15 sec between" },
        { sets:"12, 10, 8, 6 each, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 each side · 15 sec between" },
        { sets:"4×8 each @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 each · 15 sec micro-rest" },
        { sets:"4×15 each, + Cluster 15/15/20", rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP · ascending cluster 15→15→20 each side · metabolic peak" },
        { sets:"4×12 each, + Cluster 12/12/12", rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets · + 3 clusters of 12 each side" },
      ]},
      /* Ex 9 — DROP · anchor (4×12 then strip to failure, every week) */
      { name: "Heels-Elevated DB Goblet Squat (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"heels on plates · 4 working sets then strip ~30% · AMRAP to failure · 3–4 sec eccentric · full depth" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 2–3 sec bottom pause · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · drive up out of the hole" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the burn on high-rep week · upright torso" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Bodyweight Squat (finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · max reps each set · 3–4 sec eccentric · full depth every rep" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · 2–3 sec bottom pause · drive through heels" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled tempo · no half-reps" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · full ROM · quad pump finish" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · full ROM" },
      ]},
    ]
  },

  /* ════════════════ DAY 4 — BACK & SHOULDERS (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 4", session: "Back & Shoulders",
    color: "#0891b2", icon: "🔙", exCount: 10,
    meta: "Archetype A · DB / Bench Anchor · Prone Incline Tri-Set",
    exercises: [
      /* Ex 1 — LOW-REP ANCHOR (compound, heavy 5×5 every week) */
      { name: "DB Bent-Over Row (bilateral)", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"heavy 5×5 every week · 3–4 sec eccentric lower · hinge at hips · elbows drive back · full retraction" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add small load vs W1 · 2–3 sec peak squeeze · isometric hold" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · neutral grip · full scapular retraction" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · squeeze each rep" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full retraction" },
      ]},
      /* Ex 2 — FEATURE compound · 5 sets (rep scheme rotates with weekly theme) */
      { name: "Seated DB Shoulder Press", w: [
        { sets:"10, 8, 6, 5, 5", rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · 3–4 sec eccentric · full lockout" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — increase weight each set · 2–3 sec bottom pause · controlled descent" },
        { sets:"5×10 @ 4-0-1", rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 · control the descent · full ROM press" },
        { sets:"5×20",         rest:"60 sec", tag:null, note:"Week 4 HIGH-REP shoulder blast · 3–4 sec eccentric · moderate weight · full ROM" },
        { sets:"5×10, + 2×AMRAP", rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Prone Incline DB Row (face down on incline bench)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · chest on bench · 2–3 sec peak squeeze · elbows drive back" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · 3–4 sec eccentric lower · squeeze scapulae at top" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · full arm extension at bottom · stay prone" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · 2–3 sec peak squeeze · hold load on high-rep week · stay prone" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest into the next move" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (2 sec pause + slow negatives, fixed every week) */
      { name: "Prone Incline DB Rear Delt Fly (face down on incline bench)", w: [
        { sets:"3×12", rest:"—", tag:"TRI-SET", note:"2 sec peak squeeze + 3 sec negatives · elbows slightly soft · stay prone" },
        { sets:"3×12", rest:"—", tag:"TRI-SET", note:"2 sec peak squeeze + 3 sec negatives · controlled arc · light load" },
        { sets:"3×12", rest:"—", tag:"TRI-SET", note:"2 sec peak squeeze + 3 sec negatives · rear delt isolation" },
        { sets:"3×12", rest:"—", tag:"TRI-SET", note:"2 sec peak squeeze + 3 sec negatives · very light · rear delt burn" },
        { sets:"3×12", rest:"—", tag:"TRI-SET", note:"2 sec peak squeeze + 3 sec negatives held on superset week · controlled" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rep scheme rotates · always 3 sets) */
      { name: "Prone Incline DB Trap Shrug (face down on incline bench)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavy shrug · 2–3 sec peak squeeze · stay on incline bench" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · full depression at bottom" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · full trap stretch at bottom · squeeze at top" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP trap blast · 2–3 sec peak squeeze · light weight on incline" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · run as a paired superset · minimal rest" },
      ]},
      /* Ex 6 — SUPERSET A · FEATURE (rep scheme rotates · 4 sets · superset is its home in W5) */
      { name: "DB Arnold Press (seated on bench)", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · full rotation neutral→pronated" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · 2–3 sec bottom pause" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · controlled rotation · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · moderate weight" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week) */
      { name: "Seated DB Lateral Raise (seated on bench)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"2–3 sec hold at top · 2 AMRAP rounds to failure · elbows slightly soft" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · 3–4 sec eccentric lower · squeeze at shoulder height · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"strict form · 3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"2–3 sec peak isometric hold · 2 AMRAP rounds every rep controlled" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — CLUSTER · FEATURE (working sets rotate with theme · always a cluster · 4 sets) */
      { name: "DB Upright Row", w: [
        { sets:"4×6, + Cluster 6/6/6",     rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · 15 sec between · elbows drive high" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20", rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP · ascending cluster 15→15→20 · shoulder pump peak" },
        { sets:"4×12, + Cluster 12/12/12", rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets · + 3 clusters of 12" },
      ]},
      /* Ex 9 — DROP · anchor (4×12 then strip to failure, every week) */
      { name: "DB Bent-Over Rear Delt Fly (seated on bench, torso horizontal)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"seated torso horizontal · 2–3 sec peak squeeze · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 3–4 sec eccentric lower · rear delt isolation · strip on final set" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled arc · 3–4 sec eccentric · drop to absolute failure · light to moderate" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"2–3 sec peak squeeze · immediate drop · squeeze through failure on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Superman Hold (bodyweight, prone on floor)", w: [
        { sets:"3×AMRAP reps", rest:"45 sec", tag:"FINISHER", note:"BW only · prone on floor · max reps · 2–3 sec isometric squeeze at full extension" },
        { sets:"3×AMRAP reps", rest:"45 sec", tag:"FINISHER", note:"beat W1 reps · 3–4 sec slow raise · hold at top · rear delt squeeze" },
        { sets:"3×AMRAP reps", rest:"30 sec", tag:"FINISHER", note:"shorter rest · max reps · 2–3 sec isometric squeeze at top" },
        { sets:"3×AMRAP reps", rest:"30 sec", tag:"FINISHER", note:"absolute failure each set · 3–4 sec eccentric · full posterior chain flush" },
        { sets:"3×AMRAP reps", rest:"30 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · full extension each rep" },
      ]},
    ]
  },

  /* ════════════════ DAY 5 — REST ════════════════ */
  { type: "rest", label: "Day 5", session: "Rest Day" },

  /* ════════════════ DAYS 6 & 7 — CONDITIONING ════════════════ */
  { type: "cond", label: "Day 6", session: "Conditioning Corner", icon: "⚡", color: "#d97706" },
  { type: "cond", label: "Day 7", session: "Conditioning Corner", icon: "⚡", color: "#d97706" },
]
    },
    p2: {
      id: 'p2', phase: 2, title: 'Barbell & Smith', modality: 'Barbell & Smith',
      accent: '#ef4444', estPerSession: '60–75 min', backHref: 'cat-mm.html',
      days: [

  /* ════════════════ DAY 1 — SQUAT (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 1", session: "Squat",
    color: "#22c55e", icon: "🦵", exCount: 10,
    meta: "Olympic Barbell · Single-Bar Complexes · Smith Pos 8–9",
    exercises: [
      /* Ex 1 — OLYMPIC BARBELL · LOW-REP ANCHOR (heavy 5×5 every week, standalone) */
      { name: "Barbell Back Squat", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"Olympic barbell · heavy 5×5 every week · brace hard · 3–4 sec eccentric · drive through midfoot · full depth" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add small load vs W1 · controlled descent · knees track toes" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · upright torso · brace" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · drive hard out of the hole" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full depth every rep" },
      ]},
      /* Ex 2 — OLYMPIC BARBELL · FEATURE compound (5 sets, rotates with theme, standalone) */
      { name: "Barbell Front Squat", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · elbows high · brace · full depth" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · upright torso · drive up" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 (4 sec down · 0 pause · 1 sec up) · constant tension · elbows high" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · moderate load · full ROM every rep · controlled" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3–5 — TRI-SET · single bar-on-back barbell complex (one loaded bar, station-anchored) */
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Barbell Good Morning (bar on back)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · same bar on back · hinge at hips · 3–4 sec eccentric · feel hamstrings" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · soft knees · flat back" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · hamstring stretch" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load on high-rep week · controlled hinge" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest into the next move on the same bar" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "Barbell Reverse Lunge (bar on back)", w: [
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives on the lower · same bar on back · drive through front heel" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec pause at the bottom · controlled step back" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · no momentum · torso tall" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full hip extension at top each rep" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives held on superset week · controlled" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rotates · always 3 sets · same bar) */
      { name: "Barbell RDL (bar on back → swing to hang)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavy hinge · same bar · squeeze glutes at top" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · flat back" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · hamstrings loaded at the stretch" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · moderate load · feel the stretch every rep" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · run as a paired superset on the same bar · minimal rest" },
      ]},
      /* Ex 6–7 — SUPERSET · single bar-on-hips barbell complex (one loaded bar, station-anchored) */
      /* Ex 6 — SUPERSET A · FEATURE (rotates · 4 sets · superset is its home in W5) */
      { name: "Barbell Hip Thrust (bar on hips)", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · drive hips · 2 sec peak hold" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · full hip extension" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · squeeze glutes every rep" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week · same bar on hips) */
      { name: "Barbell Glute Bridge (bar on hips)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"same bar on hips · 2–3 sec peak hold · 2 AMRAP rounds to failure" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · full hip drive · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric lower · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"2–3 sec peak pause · 2 AMRAP rounds · full extension" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — SMITH MACHINE · CLUSTER · FEATURE (single station · working sets rotate · always a cluster) */
      { name: "Smith Machine Squat", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · fixed bar path · 15 sec between" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · metabolic peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets on the Smith · + 3 clusters of 12" },
      ]},
      /* Ex 9 — SMITH MACHINE · DROP · anchor (single station · strip the pins every week) */
      { name: "Smith Machine Hack Squat (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"feet forward · 4 working sets then strip the pins ~30% · AMRAP to failure · 3–4 sec eccentric" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 2–3 sec bottom pause · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · drive up" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the burn on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Bodyweight Jump Squat (finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · explosive up · soft landing · max reps each set" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · full depth · drive through heels" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled landing" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · full ROM · quad pump finish" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · explosive" },
      ]},
    ]
  },

  /* ════════════════ DAY 2 — BENCH (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 2", session: "Bench",
    color: "#ef4444", icon: "🏋️", exCount: 10,
    meta: "Olympic Barbell · Single-Bar EZ Complexes · Smith Pos 8–9",
    exercises: [
      /* Ex 1 — OLYMPIC BARBELL · LOW-REP ANCHOR (heavy 5×5 every week, standalone) */
      { name: "Barbell Bench Press", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"Olympic barbell · heavy 5×5 every week · 3–4 sec eccentric · drive bar over chest · tuck elbows" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add small load vs W1 · controlled descent · leg drive" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · pause off the chest" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · explosive press" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full lockout" },
      ]},
      /* Ex 2 — OLYMPIC BARBELL · FEATURE compound (5 sets, rotates with theme, standalone) */
      { name: "Barbell Incline Bench Press", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · 2–3 sec pause off chest · upper-chest drive" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · 3–4 sec eccentric on heavier sets" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 · constant tension · controlled to upper chest" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · moderate load · full ROM · 2–3 sec bottom pause" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3–5 — TRI-SET · single EZ-bar complex at one bench (one loaded bar, station-anchored) */
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "EZ-Bar Close-Grip Bench Press", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · same EZ-bar at the bench · tuck elbows · 3–4 sec eccentric" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · controlled descent · tricep drive" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · full lockout" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load on high-rep week · elbows tight" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest into the next move on the same EZ-bar" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "EZ-Bar Skull Crusher (same EZ-bar)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · same EZ-bar · elbows stacked · controlled to forehead" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec stretch pause behind head · elbows tight" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · squeeze at lockout · no elbow flare" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full ROM · controlled" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives held on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rotates · always 3 sets · same EZ-bar) */
      { name: "EZ-Bar Pullover (same EZ-bar)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavy · same EZ-bar · big stretch over the head" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · feel the lats + chest" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · slow controlled arc · full stretch" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · light-moderate · constant tension" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · paired superset on the same EZ-bar · minimal rest" },
      ]},
      /* Ex 6–7 — SUPERSET · single EZ-bar complex at one bench (one loaded bar, station-anchored) */
      /* Ex 6 — SUPERSET A · FEATURE (rotates · 4 sets · superset is its home in W5) */
      { name: "EZ-Bar Floor Press", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · pause on the floor" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · controlled" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · full lockout" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week · same EZ-bar) */
      { name: "EZ-Bar JM Press (same EZ-bar)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"same EZ-bar · hybrid press/skull · 2 AMRAP rounds to failure" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · elbows tucked · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"controlled · 2 AMRAP rounds · tricep lockout" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — SMITH MACHINE · CLUSTER · FEATURE (single station · working sets rotate · always a cluster) */
      { name: "Smith Machine Bench Press", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · fixed bar path · 15 sec between" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · metabolic peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets on the Smith · + 3 clusters of 12" },
      ]},
      /* Ex 9 — SMITH MACHINE · DROP · anchor (single station · strip the pins every week) */
      { name: "Smith Machine Incline Press (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"4 working sets then strip the pins ~30% · AMRAP to failure · 3–4 sec eccentric" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 2–3 sec pause off chest · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · upper-chest squeeze" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the pump on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Push-Up (bodyweight finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · max reps each set · 3–4 sec eccentric lower · chest to floor" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · 2–3 sec bottom pause · full lockout" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled tempo" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · full ROM · chest pump flush" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · full ROM" },
      ]},
    ]
  },

  /* ════════════════ DAY 3 — DEADLIFT / PULL (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 3", session: "Deadlift / Pull",
    color: "#0891b2", icon: "🔙", exCount: 10,
    meta: "Olympic Barbell · Single-Bar Complexes · Smith Pos 8–9",
    exercises: [
      /* Ex 1 — OLYMPIC BARBELL · LOW-REP ANCHOR (heavy 5×5 every week, standalone) */
      { name: "Barbell Deadlift", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"Olympic barbell · heavy 5×5 every week · brace · flat back · drive the floor away · reset each rep" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add small load vs W1 · lats tight · controlled lower" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · brace hard · bar close to shins" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · full lockout · no hyperextend" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · reset each rep" },
      ]},
      /* Ex 2 — OLYMPIC BARBELL · FEATURE compound (5 sets, rotates with theme, standalone) */
      { name: "Barbell Bent-Over Row", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · hinge at hips · elbows drive back · full retraction" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · 2–3 sec peak squeeze on heavier sets" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 · controlled lower · full scapular retraction" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · moderate load · squeeze each rep · flat back" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3–5 — TRI-SET · single barbell complex (one loaded bar, station-anchored) */
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Barbell Pendlay Row", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · same bar · explosive pull off the floor · 3–4 sec eccentric · reset each rep" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · flat back · elbows drive back" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · full retraction at top" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load on high-rep week · explosive concentric" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest into the next move on the same bar" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "Barbell Shrug (same bar)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · same bar · shrug straight up · 2 sec peak squeeze" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full depression at the bottom · no rolling" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · squeeze traps hard at top" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · controlled · full ROM" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives held on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rotates · always 3 sets · same bar) */
      { name: "Barbell Upright Row (same bar)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavy · same bar · elbows lead high · controlled" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · 2 sec peak squeeze" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · controlled lift · no swing" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · light-moderate · constant tension · trap/delt burn" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · paired superset on the same bar · minimal rest" },
      ]},
      /* Ex 6–7 — SUPERSET · single EZ-bar complex (one loaded bar, station-anchored) */
      /* Ex 6 — SUPERSET A · FEATURE (rotates · 4 sets · superset is its home in W5) */
      { name: "EZ-Bar Curl", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · strict · no swing" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · squeeze at top" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · constant tension" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week · same EZ-bar) */
      { name: "EZ-Bar Reverse Curl (same EZ-bar)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"same EZ-bar · overhand grip · brachioradialis focus · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · strict form · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"controlled · 2 AMRAP rounds · squeeze at top" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — SMITH MACHINE · CLUSTER · FEATURE (single station · working sets rotate · always a cluster) */
      { name: "Smith Machine Rack Pull", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 from pins then 3 clusters of 6 · fixed bar path · 15 sec between" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · upper-back peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets on the Smith · + 3 clusters of 12" },
      ]},
      /* Ex 9 — SMITH MACHINE · DROP · anchor (single station · strip the pins every week) */
      { name: "Smith Machine Shrug (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"4 working sets then strip the pins ~30% · AMRAP to failure · 2 sec peak squeeze" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · full depression · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · squeeze traps" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the burn on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Inverted Row (bodyweight finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · chest to bar · max reps each set · 2 sec peak squeeze" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · 3–4 sec eccentric lower · full retraction" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled tempo" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · feet forward to scale · back pump flush" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · squeeze each rep" },
      ]},
    ]
  },

  /* ════════════════ DAY 4 — OVERHEAD PRESS (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 4", session: "Overhead Press",
    color: "#a855f7", icon: "🏋️", exCount: 10,
    meta: "Olympic Barbell · Single-Bar Complexes · Smith Pos 8–9",
    exercises: [
      /* Ex 1 — OLYMPIC BARBELL · LOW-REP ANCHOR (heavy 5×5 every week, standalone) */
      { name: "Barbell Overhead Press (standing)", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"Olympic barbell · heavy 5×5 every week · brace · glutes tight · drive bar overhead · head through" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add small load vs W1 · controlled lower to chin · no leg drive" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · full lockout overhead" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · strict press" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full lockout" },
      ]},
      /* Ex 2 — OLYMPIC BARBELL · FEATURE compound (5 sets, rotates with theme, standalone) */
      { name: "Barbell Push Press", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · dip-drive · 3–4 sec eccentric lower" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · explosive drive · controlled catch" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 on the lower · strict-ish · constant tension" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · moderate load · full ROM · rhythm reps" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3–5 — TRI-SET · single barbell complex (one loaded bar, station-anchored) */
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Barbell Seated Overhead Press", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · same bar · seated · strict press · 3–4 sec eccentric · no leg drive" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · controlled lower to chin · full lockout" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · brace hard" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load on high-rep week · strict press" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest into the next move on the same bar" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "Barbell Front Raise (same bar)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · same bar · raise to eye level · no swing" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec hold at top · strict front delt" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · controlled · no momentum" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full ROM · front delt burn" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives held on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rotates · always 3 sets · same bar) */
      { name: "Barbell Upright Row (same bar)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavy · same bar · elbows lead high · controlled" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · 2 sec peak squeeze" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · controlled lift · no swing" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · light-moderate · constant tension · delt/trap burn" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · paired superset on the same bar · minimal rest" },
      ]},
      /* Ex 6–7 — SUPERSET · single EZ-bar complex (one loaded bar, station-anchored) */
      /* Ex 6 — SUPERSET A · FEATURE (rotates · 4 sets · superset is its home in W5) */
      { name: "EZ-Bar Seated Overhead Press", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · same EZ-bar · strict press" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · controlled lower" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · full ROM" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week · same EZ-bar) */
      { name: "EZ-Bar Overhead Tricep Extension (same EZ-bar)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"same EZ-bar · elbows tight · full overhead stretch · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · controlled · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"squeeze at lockout · 2 AMRAP rounds · no elbow flare" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — SMITH MACHINE · CLUSTER · FEATURE (single station · working sets rotate · always a cluster) */
      { name: "Smith Machine Shoulder Press", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · fixed bar path · 15 sec between" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · shoulder pump peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets on the Smith · + 3 clusters of 12" },
      ]},
      /* Ex 9 — SMITH MACHINE · DROP · anchor (single station · strip the pins every week) */
      { name: "Smith Machine Upright Row (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"4 working sets then strip the pins ~30% · AMRAP to failure · elbows drive high" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 2 sec peak squeeze · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · delt burn" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the pump on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Pike Push-Up (bodyweight finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · hips high · head toward floor · max reps each set" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · 3–4 sec eccentric lower · shoulder focus" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled tempo" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · elevate feet to scale up · delt pump flush" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · full ROM" },
      ]},
    ]
  },

  /* ════════════════ DAY 5 — REST ════════════════ */
  { type: "rest", label: "Day 5", session: "Rest Day" },

  /* ════════════════ DAYS 6 & 7 — CONDITIONING ════════════════ */
  { type: "cond", label: "Day 6", session: "Conditioning Corner", icon: "⚡", color: "#d97706" },
  { type: "cond", label: "Day 7", session: "Conditioning Corner", icon: "⚡", color: "#d97706" },
]
    },
    p3: {
      id: 'p3', phase: 3, title: 'Cable & Plate-Loaded', modality: 'Cable & Plate-Loaded',
      accent: '#10b981', estPerSession: '60–75 min', backHref: 'cat-mm.html',
      days: [

  /* ════════════════ DAY 1 — PUSH (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 1", session: "Push",
    color: "#f43f5e", icon: "🏋️", exCount: 10,
    meta: "Cable-Dominant · Single-Column Complexes · Plate-Loaded Pos 1·8·9",
    exercises: [
      /* Ex 1 — PLATE-LOADED · LOW-REP ANCHOR (heavy 5×5 every week, standalone) */
      { name: "Plate-Loaded Chest Press (Hammer Strength)", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"plate-loaded · heavy 5×5 every week · 3–4 sec eccentric · drive through the handles · full stretch" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add a plate vs W1 · controlled descent · squeeze at lockout" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · pause at the chest" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · explosive press" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full lockout" },
      ]},
      /* Ex 2 — CABLE · FEATURE compound (5 sets, rotates with theme, standalone) */
      { name: "Cable Chest Press (dual pulley)", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · constant tension · squeeze at the midline" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · 3–4 sec eccentric on heavier sets" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 (4 sec out · 0 pause · 1 sec in) · constant tension" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · moderate load · full ROM · squeeze every rep" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3–5 — TRI-SET · single cable-column complex (one stack, swap attachments, station-anchored) */
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Cable Fly (high-to-low)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · same cable column · big arc · 3–4 sec eccentric · squeeze at the midline" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · controlled stretch · constant tension" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · full stretch" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load on high-rep week · squeeze hard" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest, swap the attachment for the next move" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "Cable Incline Press (same column)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · same column · drive up · constant tension" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec stretch pause · controlled" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · squeeze at lockout · upper-chest focus" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full ROM · no bounce" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives held on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rotates · always 3 sets · same column) */
      { name: "Cable Tricep Pushdown (same column)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavy · same column · elbows pinned · full lockout" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · squeeze" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · slow return · constant tension" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · light-moderate · tricep pump" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · paired superset on the same column · minimal rest" },
      ]},
      /* Ex 6–7 — SUPERSET · single cable-column complex (one stack, swap attachments) */
      /* Ex 6 — SUPERSET A · FEATURE (rotates · 4 sets · superset is its home in W5) */
      { name: "Cable Overhead Tricep Extension", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · full overhead stretch" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · constant tension" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · full stretch" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week · same column) */
      { name: "Cable Lateral Raise (same column)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"same column · lead with the elbow · 2 AMRAP rounds to failure" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · constant tension · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"strict form · 2 AMRAP rounds · no swing" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — PLATE-LOADED · CLUSTER · FEATURE (single station · working sets rotate · always a cluster) */
      { name: "Plate-Loaded Shoulder Press (Hammer Strength)", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · 15 sec between" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · shoulder pump peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets · + 3 clusters of 12" },
      ]},
      /* Ex 9 — PLATE-LOADED · DROP · anchor (single station · strip a plate every week) */
      { name: "Plate-Loaded Incline Press (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"4 working sets then strip a plate per side ~30% · AMRAP to failure · 3–4 sec eccentric" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 2–3 sec pause · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · upper-chest squeeze" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the pump on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Push-Up (bodyweight finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · max reps each set · 3–4 sec eccentric lower · chest to floor" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · 2–3 sec bottom pause · full lockout" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled tempo" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · full ROM · chest pump flush" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · full ROM" },
      ]},
    ]
  },

  /* ════════════════ DAY 2 — PULL (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 2", session: "Pull",
    color: "#0891b2", icon: "🔙", exCount: 10,
    meta: "Cable-Dominant · Single-Column Complexes · Plate-Loaded Pos 1·8·9",
    exercises: [
      /* Ex 1 — PLATE-LOADED · LOW-REP ANCHOR (heavy 5×5 every week, standalone) */
      { name: "Plate-Loaded Row (Hammer Strength)", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"plate-loaded · heavy 5×5 every week · 3–4 sec eccentric · drive elbows back · full retraction" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add a plate vs W1 · 2–3 sec peak squeeze · chest on pad" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · full scapular retraction" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · squeeze each rep" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full retraction" },
      ]},
      /* Ex 2 — CABLE · FEATURE compound (5 sets, rotates with theme, standalone) */
      { name: "Lat Pulldown (cable)", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · drive elbows down · full stretch at top" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · 3–4 sec eccentric on heavier sets" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 · controlled return · constant tension on the lats" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · moderate load · full ROM · squeeze the lats" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3–5 — TRI-SET · single cable-column complex (one stack, swap attachments, station-anchored) */
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Seated Cable Row", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · same cable column · drive elbows back · 2–3 sec peak squeeze · chest tall" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · 3–4 sec eccentric · full retraction" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · no torso swing" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load on high-rep week · squeeze scapulae" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest, swap the attachment for the next move" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "Cable Straight-Arm Pulldown (same column)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · same column · lats drive the bar down · constant tension" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec stretch pause overhead · controlled" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · squeeze the lats at the bottom · soft elbows" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full ROM · no momentum" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives held on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rotates · always 3 sets · same column) */
      { name: "Cable Face Pull (same column)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavier · same column · pull to the forehead · 2 sec squeeze" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · external rotation" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · slow return · rear-delt focus" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · light · constant tension · rear-delt pump" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · paired superset on the same column · minimal rest" },
      ]},
      /* Ex 6–7 — SUPERSET · single cable-column complex (one stack, swap attachments) */
      /* Ex 6 — SUPERSET A · FEATURE (rotates · 4 sets · superset is its home in W5) */
      { name: "Cable Bicep Curl", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · strict · no swing" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · squeeze at top" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · constant tension" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week · same column) */
      { name: "Cable Hammer Curl (rope, same column)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"same column · neutral rope grip · brachialis focus · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · strict form · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"controlled · 2 AMRAP rounds · squeeze at top" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — PLATE-LOADED · CLUSTER · FEATURE (single station · working sets rotate · always a cluster) */
      { name: "Plate-Loaded Iso-Lateral Pulldown", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · 15 sec between" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · lat pump peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets · + 3 clusters of 12" },
      ]},
      /* Ex 9 — PLATE-LOADED · DROP · anchor (single station · strip a plate every week) */
      { name: "Plate-Loaded High Row (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"4 working sets then strip a plate per side ~30% · AMRAP to failure · 2 sec squeeze" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 3–4 sec eccentric · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · lat squeeze" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the pump on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Inverted Row (bodyweight finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · chest to bar · max reps each set · 2 sec peak squeeze" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · 3–4 sec eccentric lower · full retraction" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled tempo" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · feet forward to scale · back pump flush" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · squeeze each rep" },
      ]},
    ]
  },

  /* ════════════════ DAY 3 — LEGS (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 3", session: "Legs",
    color: "#22c55e", icon: "🦵", exCount: 10,
    meta: "Cable-Dominant · Single-Column Complexes · Plate-Loaded Pos 1·8·9",
    exercises: [
      /* Ex 1 — PLATE-LOADED · LOW-REP ANCHOR (heavy 5×5 every week, standalone) */
      { name: "Plate-Loaded Leg Press", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"plate-loaded · heavy 5×5 every week · 3–4 sec eccentric · full depth · drive through midfoot" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add a plate vs W1 · controlled descent · knees track toes" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · deep ROM" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · drive hard" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full ROM" },
      ]},
      /* Ex 2 — CABLE · FEATURE compound (5 sets, rotates with theme, standalone) */
      { name: "Cable Pull-Through (hinge)", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavy descending load · hinge at hips · snap glutes at the top" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · flat back · push hips back" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 · hamstrings loaded at the stretch · constant tension" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · moderate load · feel the stretch every rep · squeeze glutes" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3–5 — TRI-SET · single cable-column complex (one stack, swap attachments, station-anchored) */
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Cable Romanian Deadlift", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · same cable column · hip hinge · 3–4 sec eccentric · feel hamstrings" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · flat back · soft knees" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · 3–4 sec eccentric · hamstring stretch" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load on high-rep week · controlled hinge" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest, swap the attachment for the next move" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "Cable Glute Kickback (same column)", w: [
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · same column · drive heel back · 2 sec glute squeeze" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec hold at full extension · controlled" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · no swing · glute focus" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full ROM · squeeze each rep" },
        { sets:"3×10 each", rest:"—", tag:"TRI-SET", note:"3 sec negatives held on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rotates · always 3 sets · same column) */
      { name: "Cable Goblet Squat (rope, same column)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavy · same column · upright torso · full depth" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · drive up" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · constant tension · deep ROM" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · light-moderate · full depth every rep" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · paired superset on the same column · minimal rest" },
      ]},
      /* Ex 6–7 — SUPERSET · single cable-column complex (one stack, swap attachments) */
      /* Ex 6 — SUPERSET A · FEATURE (rotates · 4 sets · superset is its home in W5) */
      { name: "Cable Hip Thrust (belt/strap)", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · drive hips · 2 sec hold" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · full hip extension" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · squeeze glutes every rep" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week · same column) */
      { name: "Cable Glute Bridge (same column)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"same column · 2–3 sec peak hold · 2 AMRAP rounds to failure" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · full hip drive · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"2–3 sec peak pause · 2 AMRAP rounds · full extension" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — PLATE-LOADED · CLUSTER · FEATURE (single station · working sets rotate · always a cluster) */
      { name: "Plate-Loaded Hack Squat", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · 15 sec between · full depth" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · quad pump peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets · + 3 clusters of 12" },
      ]},
      /* Ex 9 — PLATE-LOADED · DROP · anchor (single station · strip a plate every week) */
      { name: "Plate-Loaded Leg Curl (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"4 working sets then strip a plate per side ~30% · AMRAP to failure · 3–4 sec eccentric" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · 2 sec peak squeeze · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · hamstring squeeze" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the burn on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Bodyweight Walking Lunge (finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · max steps each set · controlled · full ROM each stride" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 steps · drive through front heel · torso tall" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max steps · controlled tempo" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · full ROM · quad/glute pump finish" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max steps · minimal rest · keep moving" },
      ]},
    ]
  },

  /* ════════════════ DAY 4 — DELTS & ARMS (10 exercises) ════════════════ */
  {
    type: "training", label: "Day 4", session: "Delts & Arms",
    color: "#a855f7", icon: "💪", exCount: 10,
    meta: "Cable-Dominant · Single-Column Complexes · Plate-Loaded Pos 1·8·9",
    exercises: [
      /* Ex 1 — PLATE-LOADED · LOW-REP ANCHOR (heavy 5×5 every week, standalone) */
      { name: "Plate-Loaded Shoulder Press (Hammer Strength)", w: [
        { sets:"5×5", rest:"90 sec", tag:null, note:"plate-loaded · heavy 5×5 every week · 3–4 sec eccentric · drive overhead · full lockout" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · add a plate vs W1 · controlled lower · no momentum" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · progress load · 3–4 sec eccentric · brace hard" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · stay heavy even on high-rep week · strict press" },
        { sets:"5×5", rest:"90 sec", tag:null, note:"same 5×5 · keep it heavy on superset week · full lockout" },
      ]},
      /* Ex 2 — CABLE · FEATURE compound (5 sets, rotates with theme, standalone) */
      { name: "Cable Lateral Raise (single arm or dual)", w: [
        { sets:"8, 6, 5, 5, 4",    rest:"90 sec", tag:null, note:"Week 1 LOW-REP · heavier descending load · lead with the elbow · constant tension" },
        { sets:"15, 12, 10, 8, 6", rest:"90 sec", tag:null, note:"Week 2 PYRAMID — add weight each set · controlled · no swing" },
        { sets:"5×10 @ 4-0-1",     rest:"75 sec", tag:null, note:"Week 3 TEMPO · 4-0-1 · slow lower · constant tension on the side delt" },
        { sets:"5×20",             rest:"60 sec", tag:null, note:"Week 4 HIGH-REP · light-moderate · full ROM · side-delt pump" },
        { sets:"5×10, + 2×AMRAP",  rest:"45 sec", tag:null, note:"Week 5 SUPERSET · run paired back-to-back · minimal rest · 2 AMRAP burnout rounds" },
      ]},
      /* Ex 3–5 — TRI-SET · single cable-column complex (one stack, swap attachments, station-anchored) */
      /* Ex 3 — TRI-SET A · anchor (3×10 every week) */
      { name: "Cable Rear Delt Fly", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · same cable column · big arc · 2–3 sec peak squeeze · rear-delt focus" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · add load vs W1 · 3–4 sec eccentric · soft elbows" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · progress load · controlled arc · squeeze at peak" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · hold load on high-rep week · constant tension" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"anchor 3×10 · superset week — minimal rest, swap the attachment for the next move" },
      ]},
      /* Ex 4 — TRI-SET B · TUT ANCHOR (3 sec negatives, fixed every week) */
      { name: "Cable Front Raise (same column)", w: [
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives every rep · same column · raise to eye level · no swing" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · 2 sec hold at top · strict front delt" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · controlled · no momentum" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives · full ROM · front-delt burn" },
        { sets:"3×10", rest:"—", tag:"TRI-SET", note:"3 sec negatives held on superset week · constant tension" },
      ]},
      /* Ex 5 — TRI-SET C · FEATURE (rotates · always 3 sets · same column) */
      { name: "Cable Upright Row (same column)", w: [
        { sets:"3×6",          rest:"75 sec after tri-set", tag:"TRI-SET", note:"Week 1 LOW-REP · heavier · same column · elbows lead high · controlled" },
        { sets:"12, 10, 8",    rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 2 PYRAMID — ascending weight across the 3 sets · 2 sec peak squeeze" },
        { sets:"3×10 @ 4-0-1", rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 3 TEMPO · 4-0-1 · controlled lift · no swing" },
        { sets:"3×20",         rest:"60 sec after tri-set", tag:"TRI-SET", note:"Week 4 HIGH-REP · light · constant tension · delt/trap burn" },
        { sets:"3×12",         rest:"45 sec after tri-set", tag:"TRI-SET", note:"Week 5 SUPERSET · paired superset on the same column · minimal rest" },
      ]},
      /* Ex 6–7 — SUPERSET · single cable-column complex (one stack, swap attachments) */
      /* Ex 6 — SUPERSET A · FEATURE (rotates · 4 sets · superset is its home in W5) */
      { name: "Cable Bicep Curl", w: [
        { sets:"8, 6, 4, 4, + 2×AMRAP",  rest:"—", tag:"SUPERSET", note:"Week 1 LOW-REP · heavy 8/6/4/4 + 2 AMRAP burnouts · strict · no swing" },
        { sets:"12, 10, 8, 6, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 2 PYRAMID working sets + 2 AMRAP rounds · squeeze at top" },
        { sets:"4×10 @ 3-1-1, + 2×AMRAP", rest:"—", tag:"SUPERSET", note:"Week 3 TEMPO · 3-1-1 · + 2 AMRAP burnout rounds" },
        { sets:"4×20, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 4 HIGH-REP + 2 AMRAP rounds · constant tension" },
        { sets:"4×12, + 2×AMRAP",         rest:"—", tag:"SUPERSET", note:"Week 5 SUPERSET — its home week · 4×12 paired + 2 AMRAP burnouts" },
      ]},
      /* Ex 7 — SUPERSET B · anchor (4×12 + 2×AMRAP every week · same column) */
      { name: "Cable Tricep Pushdown (same column)", w: [
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"same column · elbows pinned · full lockout · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"add load · controlled · 2 AMRAP rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"3–4 sec eccentric · 2 AMRAP burnout rounds" },
        { sets:"4×12, + 2×AMRAP", rest:"75 sec after superset", tag:"SUPERSET", note:"squeeze at lockout · 2 AMRAP rounds · no swing" },
        { sets:"4×12, + 2×AMRAP", rest:"60 sec after superset", tag:"SUPERSET", note:"superset week — minimal rest · 2 AMRAP rounds to failure" },
      ]},
      /* Ex 8 — PLATE-LOADED · CLUSTER · FEATURE (single station · working sets rotate · always a cluster) */
      { name: "Plate-Loaded Preacher Curl", w: [
        { sets:"4×6, + Cluster 6/6/6",       rest:"90 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 1 LOW-REP · heavy 4×6 then 3 clusters of 6 · 15 sec between · strict preacher" },
        { sets:"12, 10, 8, 6, + Cluster 8/10/12", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 2 PYRAMID working sets + ascending cluster 8→10→12 · 15 sec between" },
        { sets:"4×8 @ 4-0-1, + Cluster 10/10/10", rest:"75 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 3 TEMPO · 4-0-1 working sets + 3 clusters of 10 · 15 sec micro-rest" },
        { sets:"4×15, + Cluster 15/15/20",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 4 HIGH-REP + ascending cluster 15→15→20 · bicep pump peak" },
        { sets:"4×12, + Cluster 12/12/12",   rest:"60 sec / 15 sec b/t clusters", tag:"CLUSTER", note:"Week 5 SUPERSET · superset the working sets · + 3 clusters of 12" },
      ]},
      /* Ex 9 — PLATE-LOADED · DROP · anchor (single station · strip a plate every week) */
      { name: "Plate-Loaded Seated Dip (drop set)", w: [
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"4 working sets then strip a plate per side ~30% · AMRAP to failure · 3–4 sec eccentric" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"add load vs W1 · full lockout · strip ~30% · AMRAP to failure" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"controlled · 3–4 sec eccentric · double-drop optional · tricep squeeze" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"strip to failure · chase the pump on high-rep week" },
        { sets:"4×12, Drop AMRAP", rest:"60 sec / 0 sec before drop", tag:"DROP", note:"superset week — strip to failure · minimal rest" },
      ]},
      /* Ex 10 — FINISHER · HIGH-REP ANCHOR (bodyweight, high-rep every week) */
      { name: "Diamond Push-Up (bodyweight finisher)", w: [
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"BW only · hands diamond shape · tricep focus · 3–4 sec eccentric lower" },
        { sets:"3×AMRAP", rest:"60 sec", tag:"FINISHER", note:"beat W1 reps · 2–3 sec bottom pause · chest to hands" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"shorter rest · max reps · controlled tempo" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"absolute failure each set · full ROM · tri pump flush" },
        { sets:"3×AMRAP", rest:"45 sec", tag:"FINISHER", note:"superset week — max reps · minimal rest · full ROM" },
      ]},
    ]
  },

  /* ════════════════ DAY 5 — REST ════════════════ */
  { type: "rest", label: "Day 5", session: "Rest Day" },

  /* ════════════════ DAYS 6 & 7 — CONDITIONING ════════════════ */
  { type: "cond", label: "Day 6", session: "Conditioning Corner", icon: "⚡", color: "#d97706" },
  { type: "cond", label: "Day 7", session: "Conditioning Corner", icon: "⚡", color: "#d97706" },
]
    }
  };

  window.MM_DATA = { WEEK_THEMES: WEEK_THEMES, PROGRAMS: PROGRAMS };
})();
