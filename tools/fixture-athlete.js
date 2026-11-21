#!/usr/bin/env node
// SP4 (settings-pathways-roadmap.md): a made-up athlete for gates and
// screenshots. athlete(today) returns { storeKey: jsonString } — the stores a
// trained athlete has after a month — so a page renders a realistic state
// without anyone's real training on screen.
//
// Everything is generated from the date and a fixed seed, so the same day
// always gives the same athlete. Program pages and exercise names are the
// app's own content; the weights, reps, dates, bodyweight and food are
// invented here. tools/check-fixture.js holds every key to store-registry.json
// and every value to the app's own readers.
'use strict';

const DAY = 86400000;

const PLAN = [
  { pageId: 'mm-p1', workoutName: 'The Modality Matrix — Phase 1', ex: [
    ['Flat DB Press', 60, 8], ['Incline DB Fly', 30, 12], ['Seated DB Shoulder Press', 45, 10], ['DB Hammer Curl', 30, 12]] },
  { pageId: 'mm-p1', workoutName: 'The Modality Matrix — Phase 1', ex: [
    ['DB Goblet Squat', 70, 10], ['DB Romanian Deadlift', 65, 10], ['DB Walking Lunge', 40, 12], ['DB Calf Raise', 50, 15]] },
  { pageId: 'cat-strength', workoutName: 'Strength & Supersets', ex: [
    ['Barbell Back Squat', 205, 5], ['Leg Press', 360, 10], ['Leg Extension', 110, 12], ['Lying Leg Curl', 90, 12]] }
];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const slug = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function athlete(today) {
  const now = today ? new Date(today) : new Date();
  now.setHours(18, 0, 0, 0);
  const r = rng(20261121);

  // 12 finished workouts over 4 weeks, three a week, loads climbing slowly.
  const workouts = [];
  const best = {};
  for (let i = 11; i >= 0; i--) {
    const plan = PLAN[i % PLAN.length];
    const when = new Date(now.getTime() - (Math.floor(i / 3) * 7 + (i % 3) * 2 + 1) * DAY);
    const iso = when.toISOString();
    const week = 3 - Math.floor(i / 3);
    const sets = [];
    plan.ex.forEach(([name, base, reps]) => {
      const w = base + Math.floor(week / 2) * (base >= 100 ? 10 : 5);
      for (let n = 1; n <= 3; n++) {
        const weight = w - (n === 3 ? (base >= 100 ? 10 : 5) : 0);
        const done = reps - Math.floor(r() * 2);
        const pr = n === 1 && (best[name] === undefined || weight > best[name]) && best[name] !== undefined;
        if (best[name] === undefined || weight > best[name]) best[name] = weight;
        sets.push({ name, key: slug(name), setNum: n, weight, reps: done, pr });
      }
    });
    workouts.push({
      id: plan.pageId + '|' + iso, pageId: plan.pageId, workoutName: plan.workoutName,
      date: iso, time: '6:00 PM', duration: (48 + Math.floor(r() * 20)) + ' min',
      sets, prs: sets.filter(s => s.pr).length, setsChecked: sets.length
    });
  }
  workouts.reverse(); // newest first, as appendWorkout() keeps it

  // Bodyweight twice a week, trending gently down.
  const body = [];
  for (let i = 9; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3 * DAY);
    body.unshift({ id: d.toISOString(), date: d.toISOString(), w: Math.round((188 - (9 - i) * 0.4 + (r() - 0.5)) * 10) / 10 });
  }

  // Macro goals and the last 7 days of food.
  const FOODS = [['Greek yogurt', 150, 15, 6, 4], ['Chicken breast', 280, 52, 0, 6], ['Rice', 210, 4, 45, 1], ['Banana', 105, 1, 27, 0], ['Oats', 300, 10, 54, 5]];
  const days = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    const k = dayKey(d);
    days[k] = { entries: FOODS.slice(0, 3 + (i % 3)).map((f, j) => ({
      id: k + '-' + j, ts: d.getTime() + j, at: d.getTime() - (8 - j * 3) * 3600000, name: f[0], source: 'custom', unit: 'serving',
      qty: 1, per: { kcal: f[1], p: f[2], c: f[3], f: f[4] }
    })) };
  }
  const macros = { v: 1, ts: now.getTime(), goals: { kcal: 2600, p: 190, f: 80, c: 270 }, days };

  return {
    mc_workout_log_v1: JSON.stringify(workouts),
    mc_body_v1: JSON.stringify(body),
    mc_macros_v1: JSON.stringify(macros),
    // A copy of the program's mc-pm-data.js entry, as dashboard.html pins it.
    mc_active_prog: JSON.stringify({ id: 'mm', name: 'The Modality Matrix', color: '#6f77e0', href: 'cat-mm.html',
      meta: '15 Weeks · 3 Phases · 4 Lift + 2 Conditioning Days', tier: 'flagship' })
  };
}

module.exports = { athlete, WORKOUTS: 12 };
