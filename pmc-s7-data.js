/* ==========================================================================
   pmc-s7-data.js — single source of truth for PMC Split 7 (UGEE / Giant Sets)
   --------------------------------------------------------------------------
   Phase 2 consolidation. Previously the Split-7 workout was duplicated three
   ways — the standalone pmc-s7-giant.html, plus inlined copies inside the
   cat-pmc.html and pmc-workout.html SPA engines — which is why edits to the
   standalone file never reached the app. All three now render from this module.

   Canonical data is Week 1 only; Weeks 2–4 are derived:
     • Week 2 / Week 4 flip the rep ranges (8–10 ⇄ 12–15)
     • Week 3 / Week 4 add the "replace 2 exercises" guidance
   Edit exercises/reps HERE and every surface updates together.
   ========================================================================== */
(function () {
  var GIANTS = [
    { part: 'chest', cls: 'chest', icon: '🫁', label: 'Chest', title: 'Chest Giant Set',
      exercises: [
        { name: 'DB Flat Bench',            reps: '8–10'  },
        { name: 'Slight Incline DB Bench',  reps: '12–15' },
        { name: 'High Incline DB Press',    reps: '8–10'  },
        { name: 'High Incline DB Flies',    reps: '12–15' },
        { name: 'Pronated Flat Bench Flies',reps: '8–10'  }
      ] },
    { part: 'arms', cls: 'arms', icon: '💪', label: 'Arms', title: 'Arms Giant Set',
      exercises: [
        { name: 'Barbell Curl',     reps: '8–10'  },
        { name: 'Incline DB Curl',  reps: '12–15' },
        { name: 'Skull Crushers',   reps: '8–10'  },
        { name: 'Rope Pushdowns',   reps: '12–15' },
        { name: 'Hammer Curls',     reps: '8–10'  }
      ] },
    { part: 'back', cls: 'back', icon: '🏋️', label: 'Back', title: 'Back Giant Set',
      exercises: [
        { name: 'Wide Grip Lat Pulldowns', reps: '12–15' },
        { name: 'Reverse DB Flies',        reps: '8–10'  },
        { name: 'Close Grip Pulldowns',    reps: '12–15' },
        { name: 'Wide Grip Cable Rows',    reps: '8–10'  },
        { name: 'Single Arm DB Row',       reps: '12–15' }
      ] },
    { part: 'legs', cls: 'legs', icon: '🦵', label: 'Legs', title: 'Legs Giant Set',
      exercises: [
        { name: 'Goblet Squat',   reps: '12–15' },
        { name: 'DB RDL',         reps: '8–10'  },
        { name: 'Walking Lunges', reps: '12–15' },
        { name: 'DB Step Ups',    reps: '8–10'  }
      ] },
    { part: 'shoulders', cls: 'shoulders', icon: '🎯', label: 'Shoulders', title: 'Shoulder Giant Set',
      exercises: [
        { name: 'DB Shoulder Press', reps: '8–10'  },
        { name: 'Lateral Raises',    reps: '12–15' },
        { name: 'Front Plate Raise', reps: '8–10'  },
        { name: 'Cable Face Pulls',  reps: '12–15' },
        { name: 'Upright Row',       reps: '8–10'  }
      ] }
  ];

  var WEEKS = [
    { id: 'w1', num: 1, flip: false, replace: false,
      label: 'Week 1 — Primary rep ranges assigned. <span>Complete all 5 exercises consecutively before resting.</span>' },
    { id: 'w2', num: 2, flip: true, replace: false,
      label: 'Week 2 — Rep ranges flipped. <span>Every 8–10 becomes 12–15. Every 12–15 becomes 8–10.</span>' },
    { id: 'w3', num: 3, flip: false, replace: true,
      label: 'Week 3 — Same rep pattern as Week 1. <span>Replace 2 exercises per lift using the Exercise Library.</span>' },
    { id: 'w4', num: 4, flip: true, replace: true,
      label: 'Week 4 — Rep ranges flipped. <span>Replace 2 exercises per lift using the Exercise Library.</span>' }
  ];

  var ROUNDS = 5;
  var REST_NOTE = 'Rest: 90–120 sec after completing all {n} exercises. Zero rest between exercises.';

  function flip(reps) { return reps === '8–10' ? '12–15' : (reps === '12–15' ? '8–10' : reps); }
  function repsFor(ex, week) { return week.flip ? flip(ex.reps) : ex.reps; }
  function weekByNum(n) {
    var i = ((n - 1) % WEEKS.length + WEEKS.length) % WEEKS.length;
    return WEEKS[i] || WEEKS[0];
  }

  // ---- consumed by the SPA engines (cat-pmc.html / pmc-workout.html) ------
  function blocksForWeek(weekNum) {
    var wk = weekByNum(weekNum);
    return GIANTS.map(function (g) {
      return {
        title: g.title, part: g.label, cls: g.cls, rounds: ROUNDS,
        note: REST_NOTE.replace('{n}', g.exercises.length),
        replace: wk.replace, weekLabel: wk.label,
        exercises: g.exercises.map(function (e) { return { name: e.name, reps: repsFor(e, wk) }; })
      };
    });
  }

  // ---- full standalone markup (pmc-s7-giant.html) -------------------------
  function sectionHTML(g, wk) {
    var n = g.exercises.length;
    var rounds = Array.from({ length: ROUNDS }, function (_, i) {
      return '<div class="round-btn" onclick="toggleRound(this)">Round ' + (i + 1) + '</div>';
    }).join('');
    var cards = g.exercises.map(function (e, i) {
      return '' +
        '<div class="ex-card" onclick="toggleCheck(this)">' +
          '<div class="ex-num">' + (i + 1) + '</div>' +
          '<div class="ex-info">' +
            '<div class="ex-name">' + e.name + '</div>' +
            '<div class="ex-meta">' +
              '<span class="ex-badge badge-reps">' + repsFor(e, wk) + ' Reps</span>' +
              '<span class="ex-badge badge-sets">' + ROUNDS + ' Rounds</span>' +
            '</div>' +
          '</div>' +
          '<div class="check-icon">⬜</div>' +
        '</div>';
    }).join('');
    return '' +
      '<div class="section-wrap">' +
        '<div class="section-header">' +
          '<div class="section-icon ' + g.cls + '-icon">' + g.icon + '</div>' +
          '<div>' +
            '<div class="section-label">' + g.title + '</div>' +
            '<div class="section-sub">' + ROUNDS + ' rounds · ' + n + ' exercises consecutively</div>' +
          '</div>' +
        '</div>' +
        '<div class="giant-badge ' + g.cls + '">⚡ Giant Set · ' + g.label + '</div>' +
        '<div class="round-tracker" id="' + g.cls + '-' + wk.id + '-rounds">' + rounds + '</div>' +
        '<div class="exercise-list">' + cards + '</div>' +
        '<div class="rest-note"><strong>Rest:</strong> 90–120 sec after completing all ' + n + ' exercises. Zero rest between exercises.</div>' +
      '</div>';
  }

  function weekPanelHTML(weekIndex) {
    var wk = WEEKS[weekIndex] || WEEKS[0];
    var replaceCard = wk.replace ?
      '<div class="rest-note" style="margin:0 0 14px;border:1px solid rgba(251,146,60,0.3);background:rgba(251,146,60,0.06);">' +
        '<strong>Replace week:</strong> Swap out 2 movements per body part to keep the stimulus fresh. ' +
        'Use the <a href="exercise-library.html" style="color:#fb923c;font-weight:700;">Exercise Library</a> to find replacements by muscle group.' +
      '</div>' : '';
    var sections = GIANTS.map(function (g, i) {
      return (i ? '<div class="section-divider"></div>' : '') + sectionHTML(g, wk);
    }).join('');
    return '' +
      '<div class="week-label-bar"><div class="week-label-inner">' + wk.label + '</div></div>' +
      replaceCard + sections;
  }

  window.PMC_S7 = {
    rounds: ROUNDS, giants: GIANTS, weeks: WEEKS,
    flip: flip, repsFor: repsFor, weekByNum: weekByNum,
    blocksForWeek: blocksForWeek, weekPanelHTML: weekPanelHTML
  };
})();
