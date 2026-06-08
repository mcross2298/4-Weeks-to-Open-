/* ==========================================================================
   custom-workouts-store.js  —  "Build Your Own Conditioning Workout"
   --------------------------------------------------------------------------
   Client-side data layer for user-created conditioning workouts.
   Storage key: mc_custom_workouts  (separate from mc_activity / mc_history)

   Workout schema:
     {
       id:        string,          // uid (timestamp + random)
       name:      string,          // user-supplied label
       created:   string,          // YYYY-MM-DD
       lastRun:   string|null,     // YYYY-MM-DD
       restSecs:  number,          // rest between exercises (default 30)
       exercises: [
         { name: string, mode: 'reps'|'duration', target: number }
         // mode='reps'     → target = integer rep count
         // mode='duration' → target = seconds
       ]
     }

   Exposed as window.CustomWorkouts  (IIFE, no framework deps).
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'mc_custom_workouts';

  function read() {
    try { return JSON.parse(global.localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }

  function write(arr) {
    try { global.localStorage.setItem(KEY, JSON.stringify(arr)); }
    catch (e) {}
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  global.CustomWorkouts = {

    getAll: function () {
      return read();
    },

    findById: function (id) {
      return read().find(function (w) { return w.id === id; }) || null;
    },

    /* Save a brand-new workout. Returns the saved object (with id). */
    save: function (workout) {
      var arr = read();
      var rec = {
        id:        uid(),
        name:      workout.name || 'My Workout',
        created:   today(),
        lastRun:   null,
        restSecs:  workout.restSecs != null ? workout.restSecs : 30,
        exercises: workout.exercises || []
      };
      arr.unshift(rec);   // newest first
      write(arr);
      return rec;
    },

    /* Overwrite an existing workout's name + exercises (keeps id / created). */
    update: function (id, changes) {
      var arr = read().map(function (w) {
        if (w.id !== id) return w;
        return Object.assign({}, w, {
          name:      changes.name      != null ? changes.name      : w.name,
          restSecs:  changes.restSecs  != null ? changes.restSecs  : w.restSecs,
          exercises: changes.exercises != null ? changes.exercises : w.exercises
        });
      });
      write(arr);
    },

    /* Stamp lastRun = today when a workout is started. */
    markRun: function (id) {
      var arr = read().map(function (w) {
        return w.id === id ? Object.assign({}, w, { lastRun: today() }) : w;
      });
      write(arr);
    },

    remove: function (id) {
      write(read().filter(function (w) { return w.id !== id; }));
    }
  };

}(window));
