/* ==========================================================================
   mc-interval.js — guided interval timer for conditioning challenges (4.2)
   --------------------------------------------------------------------------
   Drives conditioning-timer.html (?id=hell-week) from the protocol metadata
   in conditioning-data.js: rounds × steps, where each step is either timed
   (countdown with 10s warning + zero buzz, both from mc-timer.js's TMR and
   honoring the lifter's mc_prefs_v1 cue settings) or open (secs:0 — a
   stopwatch station the lifter advances with Next).

   Wall-clock based throughout (endTs arithmetic), holds a screen wake lock
   for the whole run, and snapshots state to sessionStorage so an accidental
   reload mid-round restores in place. On finish, the total time is saved to
   mc_cond_log_v1 via MCCond (mc-cond.js) with instant PB feedback.
   ========================================================================== */
(function () {
  var qs = new URLSearchParams(location.search);
  var ROUTINE_ID = qs.get('id') || '';
  var SNAP_KEY = 'mc_interval_snap';

  function findRoutine() {
    if (typeof CONDITIONING === 'undefined') return null;
    var found = null;
    CONDITIONING.subcategories.forEach(function (sub) {
      (sub.routines || []).forEach(function (r) {
        if (r.id === ROUTINE_ID) found = r;
      });
    });
    return found;
  }

  var routine = findRoutine();
  var $ = function (id) { return document.getElementById(id); };

  $('ivBack').addEventListener('click', function () {
    location.href = (routine && routine.href) || 'dashboard.html?tab=conditioning';
  });

  if (!routine || !routine.protocol) {
    $('ivBody').innerHTML =
      '<div class="iv-missing">No guided protocol for this workout.<br><br>' +
      '<a href="dashboard.html?tab=conditioning">← Conditioning</a></div>';
    return;
  }

  // ---- flatten rounds × steps into one sequence ---------------------------
  var proto = routine.protocol;
  var seq = [];
  for (var r = 1; r <= (proto.rounds || 1); r++) {
    proto.steps.forEach(function (s) {
      seq.push({ label: s.label, secs: s.secs || 0, rest: !!s.rest, round: r });
    });
  }

  // ---- state ---------------------------------------------------------------
  var idx = -1;              // current step (-1 = not started)
  var stepEndTs = 0;         // wall-clock end of a timed step
  var stepStartTs = 0;       // start of an open step (stopwatch)
  var runStartTs = 0;        // total-time clock
  var pausedAt = 0;          // >0 while paused (Date.now() of pause)
  var tick = null;
  var wakeLock = null;
  var cued10 = false;

  function fmt(s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60), x = s % 60;
    return m + ':' + String(x).padStart(2, '0');
  }

  // ---- wake lock -----------------------------------------------------------
  function lock() {
    try {
      if ('wakeLock' in navigator && !wakeLock && !document.hidden) {
        navigator.wakeLock.request('screen').then(function (l) {
          wakeLock = l;
          l.addEventListener('release', function () { wakeLock = null; });
        }).catch(function () {});
      }
    } catch (e) {}
  }
  function unlock() { try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {} }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && idx >= 0 && idx < seq.length) lock();
  });

  // ---- snapshot (survive accidental reloads) -------------------------------
  function snap() {
    try {
      sessionStorage.setItem(SNAP_KEY, JSON.stringify({
        id: ROUTINE_ID, idx: idx, stepEndTs: stepEndTs, stepStartTs: stepStartTs,
        runStartTs: runStartTs, pausedAt: pausedAt, ts: Date.now()
      }));
    } catch (e) {}
  }
  function restore() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SNAP_KEY) || 'null');
      if (!s || s.id !== ROUTINE_ID || (Date.now() - s.ts) > 2 * 3600 * 1000) return false;
      if (s.idx < 0 || s.idx >= seq.length) return false;
      idx = s.idx; stepEndTs = s.stepEndTs; stepStartTs = s.stepStartTs;
      runStartTs = s.runStartTs; pausedAt = s.pausedAt;
      return true;
    } catch (e) { return false; }
  }
  function clearSnap() { try { sessionStorage.removeItem(SNAP_KEY); } catch (e) {} }

  // ---- rendering -----------------------------------------------------------
  function renderShell() {
    document.title = routine.name + ' — Guided Timer';
    $('ivName').textContent = routine.name;
    $('ivTag').textContent = routine.tag || '';
    renderDots();
  }

  function renderDots() {
    var rounds = proto.rounds || 1;
    if (rounds < 2) { $('ivDots').innerHTML = ''; return; }
    var curRound = idx >= 0 && idx < seq.length ? seq[idx].round : (idx >= seq.length ? rounds : 0);
    var h = '';
    for (var i = 1; i <= rounds; i++) {
      h += '<span class="iv-dot' + (i < curRound ? ' done' : i === curRound ? ' cur' : '') + '"></span>';
    }
    $('ivDots').innerHTML = h + '<span class="iv-dot-lbl">Round ' + Math.max(1, curRound) + '/' + rounds + '</span>';
  }

  function renderStep() {
    var s = seq[idx];
    var next = seq[idx + 1];
    $('ivStage').classList.toggle('rest', !!(s && s.rest));
    $('ivStep').textContent = s ? s.label : '';
    $('ivNext').textContent = next ? ('Next: ' + next.label) : 'Last station — finish strong';
    $('ivStepN').textContent = (idx + 1) + ' / ' + seq.length;
    $('ivSkip').textContent = s && !s.secs ? '✓ Next station' : 'Skip ▸';
    renderDots();
  }

  function paint() {
    if (idx < 0 || idx >= seq.length) return;
    var s = seq[idx];
    var now = pausedAt || Date.now();
    $('ivTotal').textContent = fmt((now - runStartTs) / 1000);
    if (s.secs) {
      var remain = (stepEndTs - now) / 1000;
      $('ivTime').textContent = fmt(remain);
      var pct = Math.max(0, Math.min(100, (remain / s.secs) * 100));
      $('ivBar').style.width = pct + '%';
      if (!pausedAt) {
        var ri = Math.ceil(remain);
        if (ri === 10 && s.secs > 15 && !cued10 && typeof TMR !== 'undefined') { cued10 = true; TMR.cue10(); }
        if (remain <= 0) { if (typeof TMR !== 'undefined') TMR.buzz(); advance(); }
      }
    } else {
      $('ivTime').textContent = fmt((now - stepStartTs) / 1000);
      $('ivBar').style.width = '100%';
    }
  }

  // ---- flow ----------------------------------------------------------------
  function startStep() {
    var s = seq[idx];
    cued10 = false;
    if (s.secs) stepEndTs = Date.now() + s.secs * 1000;
    else stepStartTs = Date.now();
    renderStep();
    snap();
  }

  function advance() {
    idx++;
    if (idx >= seq.length) { finish(); return; }
    startStep();
  }

  function start() {
    runStartTs = Date.now();
    idx = -1;
    $('ivIntro').style.display = 'none';
    $('ivRun').style.display = 'block';
    lock();
    advance();
    if (!tick) tick = setInterval(paint, 250);
  }

  function resumeFromSnap() {
    $('ivIntro').style.display = 'none';
    $('ivRun').style.display = 'block';
    lock();
    if (pausedAt) $('ivPause').textContent = '▶ Resume';
    renderStep();
    if (!tick) tick = setInterval(paint, 250);
  }

  function togglePause() {
    if (idx < 0 || idx >= seq.length) return;
    if (pausedAt) {
      var delta = Date.now() - pausedAt;
      stepEndTs += delta; stepStartTs += delta; runStartTs += delta;
      pausedAt = 0;
      $('ivPause').textContent = '⏸ Pause';
      lock();
    } else {
      pausedAt = Date.now();
      $('ivPause').textContent = '▶ Resume';
      unlock();
    }
    snap();
  }

  function finish() {
    if (tick) { clearInterval(tick); tick = null; }
    unlock();
    clearSnap();
    var totalSec = Math.round(((pausedAt || Date.now()) - runStartTs) / 1000);
    idx = seq.length;
    $('ivRun').style.display = 'none';
    $('ivDone').style.display = 'block';
    $('ivDoneTime').textContent = fmt(totalSec);

    var pbLine = '';
    if (window.MCCond) {
      var prev = MCCond.best(ROUTINE_ID);
      MCCond.log(ROUTINE_ID, totalSec);
      if (!prev) pbLine = '🏆 First completion logged — that’s the time to beat.';
      else if (totalSec < prev.timeSec) pbLine = '🏆 NEW PERSONAL BEST — previous: ' + fmt(prev.timeSec);
      else pbLine = 'Personal best: ' + fmt(prev.timeSec);
    }
    $('ivDonePb').textContent = pbLine;
  }

  function quit() {
    if (!confirm('End this session? Nothing will be logged.')) return;
    if (tick) { clearInterval(tick); tick = null; }
    unlock();
    clearSnap();
    location.href = routine.href || 'dashboard.html?tab=conditioning';
  }

  // ---- wire up -------------------------------------------------------------
  renderShell();
  $('ivIntroMeta').textContent = routine.meta || '';
  $('ivIntroPlan').innerHTML = seq.slice(0, proto.steps.length).map(function (s) {
    return '<div class="iv-plan-row"><span>' + s.label + '</span><span>' +
      (s.secs ? fmt(s.secs) : 'own pace') + '</span></div>';
  }).join('') + ((proto.rounds || 1) > 1 ? '<div class="iv-plan-rounds">× ' + proto.rounds + ' rounds</div>' : '');

  $('ivStart').addEventListener('click', start);
  $('ivSkip').addEventListener('click', function () { if (idx >= 0) advance(); });
  $('ivPause').addEventListener('click', togglePause);
  $('ivQuit').addEventListener('click', quit);

  if (restore()) resumeFromSnap();
})();
