/* ==========================================================================
   boxing-camp.js — 12-Week Boxing Training Camp engine (boxing-camp.html)
   --------------------------------------------------------------------------
   Renders a phase picked from MC_BOXING_CAMP (boxing-camp-data.js):
     • phase switcher (Weeks 1–4 / 5–8 / 9–12), remembered per device in
       mc_boxing_camp_v1 and deep-linkable with ?phase=N
     • the punch legend, once, collapsible
     • a combo board: round pills + All / New only, NEW vs carried chips
     • a session timeline: every round drill runs 3:00 work / 0:30 rest
       (Jump Rope and Heavy Bag scale by phase); the Heavy Bag card carries a
       live panel showing the CURRENT round's combos, which follows the round
       as it runs and previews the next one during the rest
     • count-up finishers (sit-ups to failure, run) with rep / distance logs
   Timers are wall-clock (endAt arithmetic), the same Countdown / CountUp
   shape boxing-routine.html uses. A screen wake lock is held while any timer
   is running.
   ========================================================================== */
(function () {
  if (window.__mcBoxingCamp) return;
  window.__mcBoxingCamp = true;

  var CAMP = window.MC_BOXING_CAMP;
  var STORE = 'mc_boxing_camp_v1';
  if (!CAMP) return;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function buzz(p) {
    try { if (window.MC_HAPTICS) MC_HAPTICS.pattern(p || [200, 100, 200]); } catch (e) {}
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach(function (t, i) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = 'sine';
        o.frequency.value = i === 2 ? 880 : 660;
        g.gain.setValueAtTime(0.32, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.22);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
      });
    } catch (e) {}
  }

  /* ── timers ─────────────────────────────────────────────────────────── */
  function Countdown(total, hooks) {
    this.total = total; this.remaining = total; this.running = false;
    this.endAt = 0; this.iv = null;
    this.onTick = hooks.onTick || function () {}; this.onDone = hooks.onDone || function () {};
  }
  Countdown.prototype.start = function () {
    if (this.running || this.remaining <= 0) return;
    this.running = true; this.endAt = Date.now() + this.remaining * 1000;
    var s = this; this.iv = setInterval(function () { s._tick(); }, 200); this._tick();
  };
  Countdown.prototype._tick = function () {
    this.remaining = Math.max(0, Math.round((this.endAt - Date.now()) / 1000));
    this.onTick(this.remaining);
    if (this.remaining <= 0) { this._clear(); this.running = false; this.onDone(); }
  };
  Countdown.prototype._clear = function () { if (this.iv) { clearInterval(this.iv); this.iv = null; } };
  Countdown.prototype.pause = function () {
    if (!this.running) return;
    this.remaining = Math.max(0, Math.round((this.endAt - Date.now()) / 1000));
    this.running = false; this._clear(); this.onTick(this.remaining);
  };

  function CountUp(onTick) { this.elapsed = 0; this.running = false; this.startAt = 0; this.iv = null; this.onTick = onTick; }
  CountUp.prototype.toggle = function () {
    if (this.running) {
      this.elapsed += Date.now() - this.startAt; this.running = false;
      if (this.iv) { clearInterval(this.iv); this.iv = null; }
    } else {
      this.startAt = Date.now(); this.running = true;
      var s = this; this.iv = setInterval(function () { s.onTick(s.now()); }, 200);
    }
    this.onTick(this.now());
  };
  CountUp.prototype.now = function () { return (this.elapsed + (this.running ? Date.now() - this.startAt : 0)) / 1000; };
  CountUp.prototype.stop = function () { if (this.iv) { clearInterval(this.iv); this.iv = null; } if (this.running) { this.elapsed += Date.now() - this.startAt; this.running = false; } };

  /* ── wake lock (held while any timer runs) ──────────────────────────── */
  var wakeLock = null;
  function syncWakeLock(want) {
    try {
      if (want && !wakeLock && 'wakeLock' in navigator && !document.hidden) {
        wakeLock = 'pending';
        navigator.wakeLock.request('screen').then(function (l) {
          wakeLock = l; l.addEventListener('release', function () { wakeLock = null; });
        }).catch(function () { wakeLock = null; });
      } else if (!want && wakeLock && wakeLock !== 'pending') {
        wakeLock.release(); wakeLock = null;
      }
    } catch (e) {}
  }

  /* ── phase choice ───────────────────────────────────────────────────── */
  function initialPhase() {
    var q = parseInt(new URLSearchParams(location.search).get('phase'), 10);
    if (CAMP.phaseById(q)) return q;
    var sv = readSession();
    if (sv) return sv.phase;
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && CAMP.phaseById(s.phase)) return s.phase;
    } catch (e) {}
    return 1;
  }
  function rememberPhase(id) {
    try { localStorage.setItem(STORE, JSON.stringify({ phase: id })); } catch (e) {}
  }

  var phase = CAMP.phaseById(initialPhase());
  var board = { round: 1, mode: 'all' };   // combo board view state

  /* ── chips ──────────────────────────────────────────────────────────── */
  // tag:false drops the NEW marker — used when a round carries nothing
  // over (Round 1), where every chip being "new" is noise, not information.
  function chip(c, small, tag) {
    var showTag = c.isNew && tag !== false;
    return '<span class="bc-chip' + (c.isNew ? ' is-new' : ' is-carried') + (c.isNew && !showTag ? ' no-tag' : '') + (small ? ' is-sm' : '') + '" title="' + esc(c.name) + '">'
      + '<span class="bc-code">' + esc(c.code) + '</span>'
      + (small ? '' : '<span class="bc-name">' + esc(c.name) + '</span>')
      + (showTag ? '<span class="bc-new">New</span>' : '')
      + '</span>';
  }
  function comboList(list, mode, small) {
    var fresh = list.filter(function (c) { return c.isNew; });
    var old = list.filter(function (c) { return !c.isNew; });
    var h = '';
    if (fresh.length) h += '<div class="bc-chips">' + fresh.map(function (c) { return chip(c, false, old.length > 0); }).join('') + '</div>';
    if (mode === 'new') {
      if (!fresh.length) h += '<div class="bc-empty">Nothing new this round — repeat the full set.</div>';
      return h;
    }
    if (old.length) {
      h += '<div class="bc-carried-lbl">' + (fresh.length ? 'Carried over' : 'Full set') + ' · ' + old.length + '</div>'
        + '<div class="bc-chips">' + old.map(function (c) { return chip(c, small); }).join('') + '</div>';
    }
    return h;
  }

  /* ── static sections ────────────────────────────────────────────────── */
  function renderPhases() {
    $('bcPhases').innerHTML = CAMP.phases.map(function (p) {
      var on = p.id === phase.id;
      return '<button type="button" role="tab" class="bc-phase' + (on ? ' is-on' : '') + '" aria-selected="' + on + '" data-phase="' + p.id + '">'
        + '<span class="bc-phase-wk">Weeks ' + p.weeks[0] + '–' + p.weeks[1] + '</span>'
        + '<span class="bc-phase-lbl">' + esc(p.label) + '</span></button>';
    }).join('');
    $('bcSchedule').textContent = 'Phase ' + phase.id + ' · Weeks ' + phase.weeks[0] + '–' + phase.weeks[1] + ' · ' + phase.label;
  }

  function renderStrip() {
    var items = [
      '🪢 Rope ' + phase.rope + '×',
      '🥊 Bag ' + phase.bag + '×',
      '⏱ ' + fmt(CAMP.WORK) + ' / ' + fmt(CAMP.REST)
    ];
    phase.finishers.forEach(function (f) {
      items.push(f.icon + ' ' + (f.target ? 'Sit-ups ' + f.target + '+' : f.note));
    });
    $('bcStrip').innerHTML = items.map(function (t) { return '<span class="bc-stat">' + esc(t) + '</span>'; }).join('');
  }

  function renderLegend() {
    var P = CAMP.PUNCHES;
    $('bcLegendKeys').textContent = Object.keys(P).join(' · ');
    $('bcLegendGrid').innerHTML = Object.keys(P).map(function (n) {
      return '<div class="bc-key"><span class="bc-key-n">' + esc(n) + '</span><span class="bc-key-nm">' + esc(P[n]) + '</span></div>';
    }).join('');
  }

  function renderBoard() {
    var n = phase.bagRounds.length;
    if (board.round > n) board.round = 1;
    var pills = '';
    for (var r = 1; r <= n; r++) {
      var on = r === board.round;
      pills += '<button type="button" class="bc-rpill' + (on ? ' is-on' : '') + '" aria-pressed="' + on + '" data-round="' + r + '">R' + r + '</button>';
    }
    $('bcRounds').innerHTML = pills;
    var mt = $('bcMode');
    mt.querySelectorAll('button').forEach(function (b) {
      var on = b.getAttribute('data-mode') === board.mode;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
    });
    var list = CAMP.roundCombos(phase, board.round);
    var spec = phase.bagRounds[board.round - 1];
    var fresh = list.filter(function (c) { return c.isNew; }).length;
    $('bcBoardHead').innerHTML = '<span class="bc-bh-r">Round ' + board.round + '</span>'
      + '<span class="bc-bh-c">' + (fresh && fresh < list.length ? fresh + ' new · ' : '') + list.length + ' total'
      + (spec.same ? ' · same as R' + spec.same : '') + '</span>'
      + (spec.note ? '<span class="bc-bh-note">' + esc(spec.note) + '</span>' : '');
    $('bcBoard').innerHTML = comboList(list, board.mode, false);
  }

  /* ── session engine ─────────────────────────────────────────────────── */
  var S = { steps: [], activeIdx: 0, complete: false };

  function build() {
    S.steps = [];
    phase.drills.forEach(function (d) {
      S.steps.push({ key: d.key, type: 'interval', name: d.name, sub: d.sub, icon: d.icon,
        rounds: d.rounds, work: CAMP.WORK, rest: CAMP.REST, combos: !!d.combos,
        group: 'Round Drills', iround: 0, iphase: 'idle', itimer: null, ielapsed: 0, done: false });
    });
    phase.finishers.forEach(function (f) {
      S.steps.push({ key: f.key, type: 'countup', name: f.name, icon: f.icon, unit: f.unit,
        target: f.target, note: f.note, group: 'Finishers · off the round clock',
        up: null, logged: null, loggedSec: 0, done: false });
    });
    S.steps.forEach(function (s, i) { s.idx = i; });
    S.activeIdx = 0; S.complete = false;
  }

  function started() {
    return S.steps.some(function (s) {
      return s.done || (s.type === 'interval' && s.iphase !== 'idle') || (s.type === 'countup' && s.up && s.up.now() > 0);
    });
  }
  function stopAll() {
    S.steps.forEach(function (s) { if (s.itimer) s.itimer.pause(); if (s.up) s.up.stop(); });
  }

  function stepHTML(st) {
    var inner, target;
    if (st.type === 'interval') {
      target = (st.rounds > 1 ? st.rounds + ' rounds · ' : '1 round · ') + fmt(st.work) + ' / ' + fmt(st.rest) + ' rest'
        + (st.sub ? ' · ' + st.sub : '');
      inner = '<div class="rn-wrap">'
        + '<div class="rn-roundline"><span class="rn-move" id="rnmove-' + st.key + '">Ready · Round 1 / ' + st.rounds + '</span>'
        + '<span class="badge idle" id="rnphase-' + st.key + '">Idle</span></div>'
        + '<div class="rn-disp" id="rndisp-' + st.key + '">' + fmt(st.work) + '</div>'
        + '<div class="rn-phaselabel" id="rnlabel-' + st.key + '">Press start</div>'
        + (st.combos ? '<div class="bc-live" id="bcLive" aria-live="polite"></div>' : '')
        + '<div class="rn-ctrls"><button type="button" class="rn-ctrl go bc-btn" id="rngo-' + st.key + '" data-act="go" data-key="' + st.key + '">▶ Start</button>'
        + '<button type="button" class="rn-ctrl skip bc-btn" data-act="skip" data-key="' + st.key + '">⤳ Skip</button></div>'
        + (st.rounds > 1 ? '<div class="rn-chips" id="rnchips-' + st.key + '"></div>' : '')
        + '</div>';
    } else {
      target = st.note;
      inner = '<div class="cd-box"><div class="cd-mini-label">⏱️ Count-Up</div>'
        + '<div class="cd-disp" id="cu-disp-' + st.key + '">0:00</div>'
        + '<div class="cd-btns"><button type="button" class="cd-btn go bc-btn" id="cu-go-' + st.key + '" data-act="cu" data-key="' + st.key + '">▶ Start</button></div></div>'
        + '<div class="log-row"><label for="log-' + st.key + '">' + (st.unit === 'mi' ? 'Distance' : 'Reps') + '</label>'
        + '<input class="log-input" id="log-' + st.key + '" type="number" inputmode="' + (st.unit === 'mi' ? 'decimal' : 'numeric') + '"'
        + ' step="' + (st.unit === 'mi' ? '0.1' : '1') + '" min="0" placeholder="' + (st.target || st.unit) + '"><label for="log-' + st.key + '">' + st.unit + '</label></div>'
        + '<button type="button" class="pstep-complete bc-btn" id="done-' + st.key + '" data-act="done" data-key="' + st.key + '" disabled>✓ Complete</button>';
    }
    return '<div class="pstep locked" id="step-' + st.key + '">'
      + '<div class="pstep-top"><div class="pstep-stepnum">' + (st.idx + 1) + '</div><div class="pstep-ico" aria-hidden="true">' + st.icon + '</div>'
      + '<div class="pstep-main"><div class="pstep-name">' + esc(st.name) + '</div><div class="pstep-target">' + esc(target) + '</div></div>'
      + '<span class="badge idle" id="badge-' + st.key + '">Locked</span></div>' + inner + '</div>';
  }

  function renderSession() {
    var h = '', last = null;
    S.steps.forEach(function (st) {
      if (st.group !== last) { h += '<div class="sec-head">' + esc(st.group) + '</div>'; last = st.group; }
      h += stepHTML(st);
    });
    $('timelineMount').innerHTML = h;
    S.steps.forEach(function (st) {
      if (st.type === 'interval') ivUI(st);
      else st.up = new CountUp(function (sec) { var d = $('cu-disp-' + st.key); if (d) d.textContent = fmt(sec); });
    });
    refreshStates();
    $('doneBanner').classList.remove('show');
    $('sumTitleText').textContent = '📊 Summary';
    updateSummary();
  }

  /* the round whose combos the live panel shows, and how it is labelled */
  function liveRound(st) {
    if (st.iphase === 'work') return { r: st.iround + 1, lbl: 'Now' };
    if (st.iphase === 'rest' && st.iround + 1 < st.rounds) return { r: st.iround + 2, lbl: 'Up next' };
    if (st.iphase === 'done') return { r: st.rounds, lbl: 'Done' };
    if (st.iphase === 'rest') return { r: st.iround + 1, lbl: 'Done' };
    return { r: 1, lbl: 'First up' };
  }
  function renderLive(st) {
    var host = $('bcLive'); if (!host) return;
    var lr = liveRound(st);
    var list = CAMP.roundCombos(phase, lr.r);
    var spec = phase.bagRounds[lr.r - 1] || {};
    var fresh = list.filter(function (c) { return c.isNew; }).length;
    if (fresh === list.length) fresh = 0;   // Round 1: all of it is the full set
    host.innerHTML = '<div class="bc-live-hd"><span class="bc-live-tag">' + lr.lbl + '</span>'
      + '<span class="bc-live-r">Round ' + lr.r + ' combos</span>'
      + '<span class="bc-live-c">' + (fresh ? fresh + ' new' : (spec.note || 'Full set')) + '</span></div>'
      + comboList(list, 'all', true);
  }

  function ivUI(st) {
    var disp = $('rndisp-' + st.key), badge = $('rnphase-' + st.key), label = $('rnlabel-' + st.key),
        move = $('rnmove-' + st.key), go = $('rngo-' + st.key);
    if (!disp) return;
    disp.className = 'rn-disp ' + (st.iphase === 'idle' ? '' : st.iphase);
    if (st.iphase === 'work') {
      badge.className = 'badge work'; badge.textContent = '🔥 Round ' + (st.iround + 1);
      label.textContent = 'Work — ' + fmt(st.work); move.textContent = 'Round ' + (st.iround + 1) + ' / ' + st.rounds;
      go.textContent = '⏸ Pause'; go.className = 'rn-ctrl pause bc-btn';
    } else if (st.iphase === 'rest') {
      badge.className = 'badge rest'; badge.textContent = '💧 Rest';
      label.textContent = 'Rest — ' + fmt(st.rest); move.textContent = 'Round ' + (st.iround + 1) + ' / ' + st.rounds + ' done';
      go.textContent = '⏸ Pause'; go.className = 'rn-ctrl pause bc-btn';
    } else if (st.iphase === 'done') {
      badge.className = 'badge green'; badge.textContent = '✓ Done';
      label.textContent = st.rounds > 1 ? 'All rounds done' : 'Round done';
      move.textContent = st.rounds + ' / ' + st.rounds + ' complete'; disp.textContent = '✓';
      go.textContent = '✓ Done'; go.className = 'rn-ctrl go bc-btn'; go.disabled = true;
    }
    var host = $('rnchips-' + st.key);
    if (host) {
      var h = '';
      for (var i = 0; i < st.rounds; i++) {
        var cls = 'rn-chip';
        if (st.iphase === 'done' || (st.iphase !== 'idle' && i < st.iround) || (st.iphase === 'rest' && i === st.iround)) cls += ' done';
        else if (st.iphase === 'work' && i === st.iround) cls += ' current';
        h += '<span class="' + cls + '">R' + (i + 1) + '</span>';
      }
      host.innerHTML = h;
    }
    if (st.combos) renderLive(st);
  }

  // `secs` starts the phase part-way through and `quiet` skips the cue: both
  // are for resuming a saved session, where the round did not just begin.
  function ivWork(st, secs, quiet) {
    st.iphase = 'work'; ivUI(st); if (!quiet) buzz([300]);
    st.itimer = new Countdown(secs || st.work, {
      onTick: function (rem) { var d = $('rndisp-' + st.key); if (d) d.textContent = fmt(rem); st.ielapsed = st.iround * (st.work + st.rest) + (st.work - rem); },
      onDone: function () { buzz([200, 100, 200, 100, 400]); ivRest(st); }
    });
    st.itimer.start();
  }
  function ivRest(st, secs) {
    st.iphase = 'rest'; ivUI(st);
    st.itimer = new Countdown(secs || st.rest, {
      onTick: function (rem) { var d = $('rndisp-' + st.key); if (d) d.textContent = fmt(rem); st.ielapsed = st.iround * (st.work + st.rest) + st.work + (st.rest - rem); },
      onDone: function () { st.iround++; if (st.iround >= st.rounds) ivFinish(st); else ivWork(st); }
    });
    st.itimer.start();
  }
  function ivFinish(st, quiet) {
    st.iphase = 'done'; st.itimer = null; st.done = true;
    st.ielapsed = Math.max(st.ielapsed, st.rounds * st.work);
    ivUI(st);
    if (quiet) return;
    buzz([200, 100, 200, 100, 500]); advance();
  }

  function act(kind, key) {
    var st = byKey(key); if (!st || S.steps[S.activeIdx] !== st) return;
    if (kind === 'go') {
      var go = $('rngo-' + key);
      if (st.iphase === 'idle') { st.iround = 0; ivWork(st); }
      else if (st.itimer && st.itimer.running) { st.itimer.pause(); go.textContent = '▶ Resume'; go.className = 'rn-ctrl go bc-btn'; }
      else if (st.itimer) { st.itimer.start(); go.textContent = '⏸ Pause'; go.className = 'rn-ctrl pause bc-btn'; }
    } else if (kind === 'skip') {
      if (st.itimer) st.itimer.pause();
      if (st.iphase === 'idle' || st.iphase === 'work') { if (st.iphase === 'idle') st.iround = 0; ivRest(st); }
      else if (st.iphase === 'rest') { st.iround++; if (st.iround >= st.rounds) ivFinish(st); else ivWork(st); }
    } else if (kind === 'cu') {
      st.up.toggle();
      var b = $('cu-go-' + key), d = $('cu-disp-' + key);
      b.textContent = st.up.running ? '⏸ Pause' : '▶ Resume';
      b.className = 'cd-btn bc-btn ' + (st.up.running ? 'pause' : 'go');
      d.className = 'cd-disp' + (st.up.running ? ' running' : '');
    } else if (kind === 'done') {
      st.up.stop(); st.loggedSec = st.up.now();
      var inp = $('log-' + key), v = inp ? parseFloat(inp.value) : NaN;
      st.logged = isNaN(v) ? null : v; if (inp) inp.disabled = true;
      st.done = true; buzz([200]); advance();
    }
    updateSummary();
  }

  function advance() {
    var i = S.activeIdx;
    while (i < S.steps.length && S.steps[i].done) i++;
    S.activeIdx = i; refreshStates();
    if (i < S.steps.length) {
      try { var el = $('step-' + S.steps[i].key); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    } else {
      S.complete = true; $('doneBanner').classList.add('show');
      $('sumTitleText').textContent = '🏆 Complete'; buzz([200, 100, 200, 100, 500]);
      clearSession();
      // mc-cond.js logs it (history, conditioning log, the program's owed
      // conditioning day) from the total time carried here.
      try { document.dispatchEvent(new CustomEvent('mc:cond-session-done', { detail: { routineId: 'boxing-camp', phase: phase.id, timeSec: totalSec() } })); } catch (e) {}
    }
    updateSummary();
  }

  function refreshStates() {
    S.steps.forEach(function (st, i) {
      var card = $('step-' + st.key); if (!card) return;
      var state = st.done ? 'done' : (i === S.activeIdx && !S.complete ? 'active' : 'locked');
      card.className = 'pstep ' + state;
      var btn = $('done-' + st.key); if (btn) btn.disabled = state !== 'active';
      var badge = $('badge-' + st.key);
      if (badge) {
        if (st.done) { badge.className = 'badge green'; badge.textContent = '✓ Done'; }
        else if (state === 'active') { badge.className = 'badge crimson'; badge.textContent = '● Active'; }
        else { badge.className = 'badge idle'; badge.textContent = 'Locked'; }
      }
    });
  }

  function byKey(k) { for (var i = 0; i < S.steps.length; i++) if (S.steps[i].key === k) return S.steps[i]; return null; }

  /* ── session save / resume (council audit fix 5) ────────────────────────
     Only the phase used to be remembered, so a reload, a deploy's update
     reload, or the OS dropping a backgrounded tab started the session over.
     The session is saved as wall-clock facts — a running countdown's endAt,
     a count-up's start time — so a resume can tell how much time passed while
     the page was gone and catch the round clock up, exactly as the timers
     themselves already compute time. Device-local, not synced: an in-progress
     session belongs to the device running its clock. Dropped after 12 hours,
     the same window mc-session.js uses for a lifting session. */
  var SESSION_KEY = 'mc_boxing_camp_session_v1';
  var SESSION_MAX_MS = 12 * 3600 * 1000;
  var lastSaved = null;

  function snapshot() {
    return {
      v: 1, phase: phase.id, activeIdx: S.activeIdx, complete: S.complete,
      steps: S.steps.map(function (st) {
        if (st.type === 'interval') {
          var t = st.itimer;
          return { key: st.key, done: st.done, iround: st.iround, iphase: st.iphase,
            running: !!(t && t.running), endAt: t && t.running ? t.endAt : 0,
            remaining: t && !t.running ? t.remaining : 0 };
        }
        var inp = $('log-' + st.key);
        return { key: st.key, done: st.done, logged: st.logged, loggedSec: st.loggedSec,
          elapsed: st.up ? st.up.elapsed : 0, running: !!(st.up && st.up.running),
          startAt: st.up && st.up.running ? st.up.startAt : 0,
          input: inp && !inp.disabled ? inp.value : '' };
      })
    };
  }
  function saveSession() {
    // Nothing started yet, or already finished and logged: nothing to keep.
    // Removal is explicit (clearSession), never inferred here, so opening
    // another phase by link cannot silently erase a session saved for this one.
    if (!S.steps.length || S.complete || !started()) return;
    var json;
    try { json = JSON.stringify(snapshot()); } catch (e) { return; }
    if (json === lastSaved) return;            // only on a real state change
    lastSaved = json;
    try {
      localStorage.setItem(SESSION_KEY, '{"ts":' + Date.now() + ',"s":' + json + '}');
    } catch (e) {
      try { if (window.MC_ERRLOG) MC_ERRLOG.rec('storage', 'boxing camp session save failed'); } catch (_) {}
    }
  }
  function clearSession() {
    lastSaved = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }
  function readSession() {
    try {
      var w = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!w || !w.s || !Array.isArray(w.s.steps) || !CAMP.phaseById(w.s.phase)) return null;
      if (!(Date.now() - (w.ts || 0) < SESSION_MAX_MS)) return null;
      return w.s;
    } catch (e) { return null; }
  }

  // Walk a running interval's clock forward past every phase boundary that
  // fell while the page was gone. Returns the remaining seconds in the phase
  // the step is in now, or -1 when the step finished meanwhile.
  function catchUp(st, saved) {
    var endAt = saved.endAt, now = Date.now();
    st.iround = saved.iround; st.iphase = saved.iphase;
    var guard = 0;
    while (endAt <= now && guard++ < 1000) {
      if (st.iphase === 'work') { st.iphase = 'rest'; endAt += st.rest * 1000; }
      else { st.iround++; if (st.iround >= st.rounds) return -1; st.iphase = 'work'; endAt += st.work * 1000; }
    }
    return Math.max(1, Math.round((endAt - now) / 1000));
  }

  function restoreSession(saved) {
    var any = false;
    saved.steps.forEach(function (ss) {
      var st = byKey(ss.key); if (!st) return;
      if (st.type === 'interval') {
        if (ss.done || ss.iphase === 'done') { st.iround = st.rounds; st.iphase = 'done'; st.done = true; st.ielapsed = st.rounds * (st.work + st.rest); ivUI(st); any = true; return; }
        if (ss.iphase !== 'work' && ss.iphase !== 'rest') return;
        any = true;
        var rem = ss.running ? catchUp(st, ss) : Math.max(1, ss.remaining | 0);
        if (!ss.running) { st.iround = ss.iround; st.iphase = ss.iphase; }
        if (rem < 0) { ivFinish(st, true); return; }
        var len = st.iphase === 'work' ? st.work : st.rest;
        st.ielapsed = st.iround * (st.work + st.rest) + (st.iphase === 'rest' ? st.work : 0) + (len - rem);
        // The same Countdown the live path builds, at the time left, no cue.
        if (st.iphase === 'work') ivWork(st, rem, true); else ivRest(st, rem);
        if (!ss.running) {
          st.itimer.pause();
          var go = $('rngo-' + st.key);
          if (go) { go.textContent = '▶ Resume'; go.className = 'rn-ctrl go bc-btn'; }
        }
      } else {
        if (!st.up) return;
        st.up.elapsed = Math.max(0, Number(ss.elapsed) || 0);
        if (ss.running && ss.startAt > 0) {
          // Time since it was started counts, as it would have live.
          st.up.elapsed += Math.max(0, Date.now() - ss.startAt);
        }
        if (st.up.elapsed > 0 || ss.done) any = true;
        var inp = $('log-' + st.key);
        if (ss.done) {
          st.done = true; st.logged = ss.logged; st.loggedSec = ss.loggedSec || 0;
          if (inp) { inp.value = ss.logged != null ? ss.logged : ''; inp.disabled = true; }
        } else if (inp && ss.input) { inp.value = ss.input; any = true; }
        st.up.onTick(st.up.now());
        if (ss.running && !ss.done) {
          st.up.toggle();                         // resumes counting from elapsed
          var b = $('cu-go-' + st.key), dd = $('cu-disp-' + st.key);
          if (b) { b.textContent = '⏸ Pause'; b.className = 'cd-btn bc-btn pause'; }
          if (dd) dd.className = 'cd-disp running';
        } else if (st.up.elapsed > 0 && !ss.done) {
          var b2 = $('cu-go-' + st.key); if (b2) b2.textContent = '▶ Resume';
        }
      }
    });
    if (!any) return false;
    S.activeIdx = 0;
    while (S.activeIdx < S.steps.length && S.steps[S.activeIdx].done) S.activeIdx++;
    S.complete = S.activeIdx >= S.steps.length;
    refreshStates();
    if (S.complete) { $('doneBanner').classList.add('show'); $('sumTitleText').textContent = '🏆 Complete'; }
    updateSummary();
    return true;
  }

  function totalSec() {
    var sec = 0;
    S.steps.forEach(function (st) {
      if (st.type === 'interval') sec += st.ielapsed || 0;
      else if (st.up) sec += st.up.now();
    });
    return Math.round(sec);
  }

  function liveValue(key) {
    var st = byKey(key); if (!st) return null;
    if (st.done) return st.logged;
    var inp = $('log-' + key); if (!inp || inp.value === '') return null;
    var v = parseFloat(inp.value); return isNaN(v) ? null : v;
  }

  function updateSummary() {
    if (!S.steps.length) return;
    var sec = 0, rounds = 0, totalRounds = 0, running = false;
    S.steps.forEach(function (st) {
      if (st.type === 'interval') {
        sec += st.ielapsed || 0; totalRounds += st.rounds;
        rounds += st.iphase === 'done' ? st.rounds : (st.iphase === 'rest' ? st.iround + 1 : st.iround);
        if (st.itimer && st.itimer.running) running = true;
      } else if (st.up) {
        sec += st.up.now(); if (st.up.running) running = true;
      }
    });
    syncWakeLock(running && !document.hidden);
    var sit = liveValue('sit'), run = liveValue('run');
    $('qMin').textContent = (sec / 60).toFixed(1);
    $('qRounds').textContent = rounds;
    $('dMin').textContent = fmt(sec);
    $('dRounds').innerHTML = rounds + ' <small>/ ' + totalRounds + '</small>';
    $('dSit').innerHTML = (sit != null ? sit : '—') + ' <small>reps</small>';
    var runRow = $('dRunRow');
    runRow.hidden = !byKey('run');
    $('dRun').innerHTML = (run != null ? run : '—') + ' <small>mi</small>';
    var done = S.steps.filter(function (s) { return s.done; }).length, total = S.steps.length;
    $('sumStep').textContent = 'Step ' + (S.complete ? total : Math.min(S.activeIdx + 1, total)) + ' / ' + total;
    var fill = $('progFill'); if (fill) fill.style.width = Math.round((done / total) * 100) + '%';
    saveSession();
  }

  /* ── phase switching ────────────────────────────────────────────────── */
  function setPhase(id) {
    if (id === phase.id) return;
    function go() {
      stopAll(); clearSession();
      phase = CAMP.phaseById(id); rememberPhase(id);
      board.round = 1;
      renderPhases(); renderStrip(); renderBoard();
      build(); renderSession();
    }
    if (!started() || S.complete) { go(); return; }
    var q = 'Switch to Weeks ' + CAMP.phaseById(id).weeks.join('–') + '? Your current session resets.';
    (window.MC_SHEET ? MC_SHEET.confirm(q, { ok: 'Switch', danger: true }) : Promise.resolve(window.confirm(q)))
      .then(function (ok) { if (ok) go(); });
  }

  function resetSession() {
    var q = 'Reset this session? All timers and logged reps clear.';
    (window.MC_SHEET ? MC_SHEET.confirm(q, { ok: 'Reset', danger: true }) : Promise.resolve(window.confirm(q)))
      .then(function (ok) { if (ok) { stopAll(); clearSession(); build(); renderSession(); } });
  }

  /* ── wiring ─────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-phase],[data-round],[data-mode],[data-act],#sumHandle,#sumReset');
    if (!t) return;
    if (t.hasAttribute('data-phase')) setPhase(parseInt(t.getAttribute('data-phase'), 10));
    else if (t.hasAttribute('data-round')) { board.round = parseInt(t.getAttribute('data-round'), 10); renderBoard(); }
    else if (t.hasAttribute('data-mode')) { board.mode = t.getAttribute('data-mode'); renderBoard(); }
    else if (t.hasAttribute('data-act')) act(t.getAttribute('data-act'), t.getAttribute('data-key'));
    else if (t.id === 'sumHandle') {
      var d = $('sumDrawer'); d.classList.toggle('open');
      t.setAttribute('aria-expanded', String(d.classList.contains('open')));
    } else if (t.id === 'sumReset') resetSession();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'sumHandle' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('input', function (e) { if (e.target.classList && e.target.classList.contains('log-input')) updateSummary(); });
  document.addEventListener('visibilitychange', updateSummary);
  setInterval(updateSummary, 1000);

  rememberPhase(phase.id);
  renderPhases(); renderStrip(); renderLegend(); renderBoard();
  build(); renderSession();
  (function () {
    var sv = readSession();
    if (sv && sv.phase === phase.id && restoreSession(sv)) {
      lastSaved = null; saveSession();
    }
  })();

  window.MC_BOXING_CAMP_UI = {
    phase: function () { return phase.id; },
    setPhase: setPhase,
    steps: function () { return S.steps; }
  };
})();
