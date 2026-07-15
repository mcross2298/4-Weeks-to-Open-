#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-bridge.js — regression coverage for mc-bridge.js, the shared
   cross-app READ layer (cookbook ↔ workout). Loads the ACTUAL source file in
   a mocked window/localStorage (it's a browser IIFE, not a CommonJS module)
   and asserts both read directions + signed-out degradation.

   The same file ships verbatim in Mikes-Cookbook; keep the two byte-identical.
   Run: node tools/test-mc-bridge.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '../mc-bridge.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('::error::' + name); } }
function eq(name, a, b) { ok(name, JSON.stringify(a) === JSON.stringify(b)); }

function d2(n) { return String(n).padStart(2, '0'); }
function dayKey(d) { return d.getFullYear() + '-' + d2(d.getMonth() + 1) + '-' + d2(d.getDate()); }
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function todayCode() { return DAYS[(new Date().getDay() + 6) % 7]; }

function loadBridge(seed, recipes) {
  const store = Object.assign({}, seed);
  const sandbox = {
    window: { RECIPES: recipes },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return sandbox.window.MCBridge;
}

const today = todayCode();
const other = DAYS[(DAYS.indexOf(today) + 1) % 7];
const now = new Date();
const ykey = dayKey(new Date(Date.now() - 86400000));

// 1a. Workout app reads cookbook meal plan — REAL shape post-B1: the cookbook
// denormalizes {title,icon,macros} onto each meal entry at write time
// (cookbook-home.js's mealSnapshot()), since the workout app never loads
// recipes-data.js and has no other way to resolve a bare recipe id.
let B = loadBridge({
  'mc-cookbook:mealplan': JSON.stringify({ meals: [
    { uid: 'a', id: 'jalapeno-chicken-bake', serving: 4, day: today, slot: 'Dinner', completed: false,
      title: 'Jalapeño Chicken Bake', icon: '🌶️', macros: { kcal: 610, p: 48, f: 30, c: 22 } },
    { uid: 'b', id: 'greek-bowl', serving: 2, day: other, slot: 'Lunch', completed: false,
      title: 'Greek Bowl', icon: '🥙', macros: { kcal: 520, p: 42, f: 20, c: 30 } },
    { uid: 'c', id: 'unscheduled', serving: 2, day: null, slot: null, completed: false }
  ] })
}, undefined);
let meals = B.todaysMeals();
eq('only today’s scheduled meal', meals.length, 1);
eq('right recipe ref', meals[0].recipeId, 'jalapeno-chicken-bake');
eq('serving carried', meals[0].serving, 4);
eq('title from denormalized snapshot', meals[0].title, 'Jalapeño Chicken Bake');
eq('icon from denormalized snapshot', meals[0].icon, '🌶️');
eq('macros from denormalized snapshot', meals[0].macros, { kcal: 610, p: 48, f: 30, c: 22 });

// 1b. Legacy entry with no snapshot (pre-B1 data) + no window.RECIPES:
// degrades to null rather than throwing, same as before B1.
B = loadBridge({
  'mc-cookbook:mealplan': JSON.stringify({ meals: [
    { uid: 'z', id: 'legacy-recipe', serving: 2, day: today, slot: 'Lunch', completed: false }
  ] })
}, undefined);
meals = B.todaysMeals();
eq('legacy entry title null off-cookbook', meals[0].title, null);
eq('legacy entry macros null off-cookbook', meals[0].macros, null);

// 2. Cookbook falls back to a live window.RECIPES lookup for a legacy entry
// that has no denormalized snapshot yet (pre-B1 plan data).
B = loadBridge({
  'mc-cookbook:mealplan': JSON.stringify({ meals: [
    { uid: 'a', id: 'greek-bowl', serving: 2, day: today, slot: 'Lunch', completed: true }
  ] })
}, [
  { recipe_id: 'greek-bowl', title: 'Greek Bowl', icon: '🥙',
    macro_profiles: { serving_2: { kcal: 520, p: 42, f: 20, c: 30 }, serving_4: { kcal: 520, p: 42, f: 20, c: 30 } } }
]);
meals = B.todaysMeals();
eq('title falls back to live RECIPES lookup', meals[0].title, 'Greek Bowl');
eq('macros fall back to live RECIPES lookup', meals[0].macros, { kcal: 520, p: 42, f: 20, c: 30 });
eq('completed flag carried', meals[0].completed, true);

// 3. Cookbook reads workout activity + finished-session log + shared targets.
B = loadBridge({
  'mc_activity': JSON.stringify({
    last: { pageId: 'mc-s1-back.html', title: 'Back & Traps', done: 6, total: 10, ts: Date.now() },
    days: { [dayKey(now)]: true, [ykey]: true }
  }),
  'mc_workout_log_v1': JSON.stringify([
    { id: 'p|1', pageId: 'mc-s1-back.html', workoutName: 'Back & Traps', date: now.toISOString(), prs: 2, duration: '48m' },
    { id: 'p|2', pageId: 'mc-s1-legs.html', workoutName: 'Legs', date: new Date(Date.now() - 2 * 86400000).toISOString(), prs: 0 }
  ]),
  'mc_macros_v1': JSON.stringify({ ts: 1, goals: { kcal: 2400, p: 200, f: 70, c: 220 }, days: {} })
}, undefined);
let w = B.todaysWorkout();
eq('trainedToday true', w.trainedToday, true);
eq('streak today+yesterday', w.streak, 2);
eq('last session surfaced', w.last.title, 'Back & Traps');
eq('macro targets from shared goals', B.macroTargets(), { kcal: 2400, protein: 200, fat: 70, carbs: 220 });
let act = B.recentActivity();
ok('workoutsThisWeek counted', act.workoutsThisWeek >= 1);
eq('recentWorkouts mapped', act.recentWorkouts[0].name, 'Back & Traps');

// 4. Signed-out / empty degrades cleanly (no cross-app keys present).
B = loadBridge({}, undefined);
eq('todaysMeals -> []', B.todaysMeals(), []);
eq('macroTargets -> null', B.macroTargets(), null);
eq('recentWorkouts -> []', B.recentWorkouts(), []);
eq('today() shape intact', B.today(), { meals: [], workout: { trainedToday: false, streak: 0, last: null }, targets: null });

if (fail) { console.error(`\ntest-mc-bridge: ${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`test-mc-bridge: all ${pass} assertions passed`);
