/* ==========================================================================
   mc-auto.js — what the app does on its own, with Undo, and when it stops
   --------------------------------------------------------------------------
   command-center-roadmap.md PR 4 and autonomy-exec-roadmap.md Part 1. One
   automatic action today, "finish": a session with ticked sets and no Finish
   for 12 hours is banked as a finished workout the next time Home opens. The
   app never changes a program, a load or a day (logbook and suggestions only);
   banking sets the athlete already ticked is bookkeeping.

   How a stale session is found. mc-summary.js keeps mc_daily_v1["<date>|<pid>"]
   for every session with work done, and Finish deletes it. One still there 12
   hours after its last write, whose page has no workout banked that day, with
   sets in mc_setlog_v1 under that page and day, was never finished. The sets
   come from MC_LOG.sessionSets(), the same rules Finish uses.

   Two devices. The banked id is "<pid>|<ISO of the last tick>", so two phones
   banking the same synced session produce the same workout and the log's merge
   keeps one. While a signed-in device hasn't pulled yet this load, nothing is
   banked, so a session finished on the other phone isn't banked twice.

   The kill switch. Undo deletes the workout through MC_LOG.deleteWorkouts()
   (so a sync can't bring it back), puts the session back as it was, and marks
   it left alone so it is never banked again. The second Undo within 30 days,
   counted from the last time the athlete turned it back on, pauses the action:
   Home then asks ("Bank it" / "Leave it") instead of acting.

   Store: mc_auto_v1 (synced, dictByTs): { "<id>": { ts, ... } }
     act:<n>        { kind, at, ref, dailyKey, daily, label, sets, undoneAt }
     pause:<kind>   { paused, at, resumedAt }
     left:<daily>   { at }  a session the athlete left alone; never banked

   window.MC_AUTO: { run(), log(), undo(id), paused(kind), resume(kind),
                     scan(now) (testing), PAUSE_AFTER, WINDOW_MS, STALE_MS }
   ========================================================================== */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.MC_AUTO) return;

  var KEY = 'mc_auto_v1', DAILY = 'mc_daily_v1', SETLOG = 'mc_setlog_v1', ACT = 'mc_activity';
  var HOUR = 3600 * 1000, DAY = 24 * HOUR;
  var STALE_MS = 12 * HOUR, WINDOW_MS = 30 * DAY, PAUSE_AFTER = 2, LEFT_KEEP_MS = 120 * DAY;

  function L() { return (typeof window !== 'undefined' && window.MC_LOG) || null; }
  function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) {
    var s = JSON.stringify(v), M = L();
    if (M && M.writeStore) return M.writeStore(k, s);
    try { localStorage.setItem(k, s); return true; } catch (e) { return false; }
  }
  function store() { var s = read(KEY, {}); return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {}; }
  function put(st) { write(KEY, st); try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {} }

  function prune(st, now) {
    Object.keys(st).forEach(function (k) {
      var r = st[k] || {};
      if (k.indexOf('act:') === 0 && now - (r.undoneAt || r.at || 0) > WINDOW_MS) delete st[k];
      if (k.indexOf('left:') === 0 && now - (r.at || 0) > LEFT_KEEP_MS) delete st[k];
    });
    return st;
  }

  // ---- kill switch ---------------------------------------------------------
  function pauseRec(st, kind) { return st['pause:' + kind] || {}; }
  function paused(kind) { return !!pauseRec(store(), kind || 'finish').paused; }
  function undoCount(st, kind, now) {
    var since = Math.max(now - WINDOW_MS, pauseRec(st, kind).resumedAt || 0);
    return Object.keys(st).filter(function (k) {
      var r = st[k];
      return k.indexOf('act:') === 0 && r && r.kind === kind && r.undoneAt && r.undoneAt > since;
    }).length;
  }
  function resume(kind) {
    kind = kind || 'finish';
    var st = store(), now = Date.now();
    st['pause:' + kind] = { paused: false, resumedAt: now, at: now, ts: now };
    put(st);
  }

  // ---- finding a stale session -----------------------------------------------
  function lastTick(setlog, pid, day) {
    var M = L(), t = 0;
    Object.keys(setlog || {}).forEach(function (k) {
      if (k.indexOf(pid + '|') !== 0) return;
      var sess = (M && M.normalizeSessions ? M.normalizeSessions(setlog[k]) : (setlog[k] || []))[0];
      if (!sess || sess.d !== day || !sess.sets) return;
      Object.keys(sess.sets).forEach(function (sn) { var s = sess.sets[sn]; if (s && s.t > t) t = s.t; });
    });
    return t;
  }
  function bankedOn(pid, day) {
    var M = L(), all = M && M.readAllWorkouts ? M.readAllWorkouts() : [];
    return all.some(function (e) {
      return e && String(e.pageId || '').replace(/\.html$/, '') === pid && M.dayKey(e.date) === day;
    });
  }
  function scan(now) {
    now = now || Date.now();
    var M = L();
    if (!M || !M.sessionSets) return [];
    var daily = read(DAILY, {}), setlog = read(SETLOG, {}), st = store(), out = [];
    var deleted = M.readDeletedWorkouts ? M.readDeletedWorkouts() : {};
    Object.keys(daily || {}).forEach(function (dk) {
      var d = daily[dk];
      if (!d || !d.pid || !d.date || st['left:' + dk]) return;
      if (now - (d.ts || 0) < STALE_MS) return;
      if (bankedOn(d.pid, d.date)) return;
      var sets = M.sessionSets(setlog, d.pid, d.date);
      if (!sets.length) return;
      var t = lastTick(setlog, d.pid, d.date);
      var p = d.date.split('-');
      var when = t ? new Date(t) : new Date(+p[0], +p[1] - 1, +p[2], 12);
      var id = d.pid + '|' + when.toISOString();
      if (deleted && deleted[id]) return;
      out.push({ dailyKey: dk, daily: d, sets: sets, when: when, id: id });
    });
    return out;
  }

  // ---- acting ---------------------------------------------------------------
  function bank(c) {
    var M = L();
    var entry = {
      id: c.id, pageId: c.daily.pid,
      workoutName: c.daily.program || c.daily.pid,
      date: c.when.toISOString(),
      time: c.when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sets: c.sets, prs: c.sets.filter(function (s) { return s.pr; }).length,
      setsChecked: c.sets.length, auto: true
    };
    if (!M.appendWorkout(entry)) return null;
    var daily = read(DAILY, {});
    delete daily[c.dailyKey];
    write(DAILY, daily);
    var act = read(ACT, {});
    if (act && act.last && String(act.last.pageId || '').replace(/\.html$/, '') === c.daily.pid) {
      delete act.last; write(ACT, act);
    }
    return entry;
  }

  function label(c) {
    var d = c.when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return (c.daily.program || c.daily.pid) + ' · ' + d;
  }

  function finishStale(now) {
    var cands = scan(now);
    if (!cands.length) return [];
    if (paused('finish')) { ask(cands[0]); return []; }
    var st = store(), done = [];
    cands.forEach(function (c, i) {
      var entry = bank(c);
      if (!entry) return;
      var id = 'act:' + now + '-' + i;
      st[id] = { kind: 'finish', at: now, ts: now, ref: entry.id, dailyKey: c.dailyKey, daily: c.daily,
        label: label(c), sets: c.sets.length };
      done.push(id);
    });
    if (done.length) { put(prune(st, now)); toast(done); }
    return done;
  }

  function undo(actId) {
    var st = store(), r = st[actId], now = Date.now(), M = L();
    if (!r || r.undoneAt) return null;
    if (M && M.deleteWorkouts) M.deleteWorkouts([r.ref]);
    var daily = read(DAILY, {});
    if (r.dailyKey && r.daily && !daily[r.dailyKey]) {
      daily[r.dailyKey] = Object.assign({}, r.daily, { ts: now });
      write(DAILY, daily);
    }
    r.undoneAt = now; r.ts = now;
    if (r.dailyKey) st['left:' + r.dailyKey] = { at: now, ts: now };
    var nowPaused = false;
    if (undoCount(st, r.kind, now) >= PAUSE_AFTER) {
      st['pause:' + r.kind] = { paused: true, at: now, ts: now, resumedAt: pauseRec(st, r.kind).resumedAt || 0 };
      nowPaused = true;
    }
    put(st);
    return nowPaused ? 'paused' : 'undone';
  }

  function log() {
    var st = store(), now = Date.now();
    return Object.keys(st).filter(function (k) { return k.indexOf('act:') === 0 && now - (st[k].at || 0) <= WINDOW_MS; })
      .map(function (k) { return Object.assign({ id: k }, st[k]); })
      .sort(function (a, b) { return b.at - a.at; });
  }

  // ---- UI on Home: a note after acting, a question while paused --------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function css() {
    if (document.getElementById('mcAutoCss')) return;
    var st = document.createElement('style');
    st.id = 'mcAutoCss';
    st.textContent =
      '.mca-note{position:fixed;left:12px;right:12px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:var(--z-banner,50);max-width:520px;margin:0 auto;' +
        'display:flex;align-items:center;gap:8px;padding:8px 8px 8px 14px;border-radius:var(--r-md,12px);background:var(--card-bg);color:var(--text);' +
        'border:1px solid var(--hairline);box-shadow:0 8px 28px rgba(0,0,0,0.35);}' +
      '.mca-txt{flex:1;min-width:0;font-size:var(--fs-md,14px);line-height:1.4;}' +
      '.mca-txt b{display:block;font-weight:var(--fw-bold,800);}' +
      '.mca-btn{flex-shrink:0;min-width:48px;min-height:48px;padding:0 12px;border-radius:var(--r-md,12px);border:1px solid var(--hairline);' +
        'background:transparent;color:var(--text);font:inherit;font-size:var(--fs-md,14px);font-weight:var(--fw-bold,800);cursor:pointer;}' +
      '.mca-btn.go{background:var(--accent);border-color:transparent;color:var(--ink-0,#000);}' +
      'html[data-theme="light"] .mca-btn.go{color:var(--ink-11,#faf7f0);}' +
      '.mca-ov{position:fixed;inset:0;z-index:var(--z-modal,175);background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;' +
        'padding:16px;padding-top:calc(16px + env(safe-area-inset-top));padding-bottom:calc(16px + env(safe-area-inset-bottom));}' +
      '.mca-card{width:100%;max-width:480px;max-height:100%;overflow:auto;background:var(--surface-bg,var(--card-bg));color:var(--text);' +
        'border:1px solid var(--hairline);border-radius:var(--r-lg,16px);padding:16px;}' +
      '.mca-head{display:flex;align-items:center;gap:12px;}' +
      '.mca-head h2{flex:1;margin:0;font-size:var(--fs-2xl,18px);font-weight:var(--fw-bold,800);}' +
      '.mca-x{min-width:48px;min-height:48px;border:0;background:transparent;color:var(--text);font-size:var(--fs-3xl,20px);cursor:pointer;}' +
      '.mca-p{font-size:var(--fs-sm,13px);color:var(--muted);line-height:1.5;margin:4px 0 12px;}' +
      '.mca-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 0;border-top:1px solid var(--hairline);font-size:var(--fs-md,14px);}' +
      '.mca-row span{flex:1;min-width:0;}' +
      '.mca-row b{display:block;font-weight:var(--fw-bold,800);}' +
      '.mca-row em{font-style:normal;color:var(--muted);font-size:var(--fs-sm,13px);}';
    document.head.appendChild(st);
  }
  function note(html, buttons) {
    var old = document.getElementById('mcaNote');
    if (old) old.remove();
    css();
    var el = document.createElement('div');
    el.id = 'mcaNote';
    el.className = 'mca-note';
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="mca-txt">' + html + '</div>' + buttons.map(function (b, i) {
      return '<button type="button" class="mca-btn' + (b.go ? ' go' : '') + '" data-i="' + i + '"' +
        (b.aria ? ' aria-label="' + esc(b.aria) + '"' : '') + '>' + esc(b.text) + '</button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-i]') : null;
      if (!btn) return;
      var b = buttons[+btn.getAttribute('data-i')];
      el.remove();
      if (b && b.run) b.run();
    });
    document.body.appendChild(el);
    return el;
  }
  function toast(ids) {
    var st = store(), r = st[ids[0]];
    var head = ids.length === 1 ? 'Banked an unfinished workout' : 'Banked ' + ids.length + ' unfinished workouts';
    note('<b>' + esc(head) + '</b>' + esc(r.label + ' · ' + r.sets + (r.sets === 1 ? ' set' : ' sets')) +
      (ids.length > 1 ? ' and more. Each has Undo in Settings → Done for you.' : ''), [
      { text: 'Undo', aria: 'Undo: unbank ' + r.label, run: function () { ids.forEach(undoAndSay); } },
      { text: '×', aria: 'Dismiss' }
    ]);
  }
  function undoAndSay(id) {
    var res = undo(id);
    if (res === 'paused') {
      note('<b>Auto-finish paused</b>That’s the second Undo in 30 days, so Home will ask before banking. Turn it back on in Settings → Done for you.',
        [{ text: 'OK' }]);
    }
  }
  function ask(c) {
    note('<b>Unfinished workout</b>' + esc(label(c) + ' · ' + c.sets.length + (c.sets.length === 1 ? ' set' : ' sets') + ' ticked, never finished.'), [
      { text: 'Bank it', go: true, run: function () {
        var entry = bank(c);
        if (entry) { var st = store(); st['left:' + c.dailyKey] = { at: Date.now(), ts: Date.now() }; put(st); }
      } },
      { text: 'Leave it', run: function () { var st = store(); st['left:' + c.dailyKey] = { at: Date.now(), ts: Date.now() }; put(st); } }
    ]);
  }

  // ---- Settings → Done for you -------------------------------------------------
  function openLog() {
    css();
    var ov = document.createElement('div');
    ov.className = 'mca-ov';
    ov.setAttribute('data-mc-sheet', '');
    ov.setAttribute('aria-label', 'Done for you');
    function paint() {
      var items = log(), isPaused = paused('finish');
      ov.innerHTML = '<div class="mca-card"><div class="mca-head"><h2>Done for you</h2>' +
        '<button type="button" class="mca-x" aria-label="Close">×</button></div>' +
        '<p class="mca-p">When a workout has ticked sets but was never finished, Home banks it 12 hours later so it counts in History and Stats. ' +
        'Undo takes it back out and leaves that session alone. Two Undos in 30 days and Home asks first instead.</p>' +
        (isPaused ? '<div class="mca-row"><span>Paused: Home asks before banking</span><button type="button" class="mca-btn go" data-resume>Turn back on</button></div>' : '') +
        (items.length ? items.map(function (r) {
          var when = new Date(r.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          return '<div class="mca-row"><span><b>' + esc(r.label) + '</b>' + r.sets + (r.sets === 1 ? ' set' : ' sets') + ' · banked ' + esc(when) + '</span>' +
            (r.undoneAt ? '<em>Undone</em>' : '<button type="button" class="mca-btn" data-undo="' + esc(r.id) + '" aria-label="Undo: unbank ' + esc(r.label) + '">Undo</button>') + '</div>';
        }).join('') : '<p class="mca-p">Nothing done for you in the last 30 days.</p>') + '</div>';
    }
    paint();
    ov.addEventListener('click', function (e) {
      var u = e.target.closest('[data-undo]');
      if (u) { undo(u.getAttribute('data-undo')); paint(); return; }
      if (e.target.closest('[data-resume]')) { resume('finish'); paint(); return; }
      if (e.target === ov || e.target.closest('.mca-x')) { ov.remove(); if (window.MC_SHEET) MC_SHEET.check(); }
    });
    document.body.appendChild(ov);
    if (window.MC_SHEET) MC_SHEET.check();
  }

  // ---- when to run -----------------------------------------------------------
  // Signed in means a pull may be about to bring the other phone's Finish, so
  // wait for it; if none comes this load, act next time rather than guess.
  function signedInHere() {
    try {
      for (var i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i))) return true;
    } catch (e) {}
    return false;
  }
  function run() {
    var tries = 0;
    (function attempt() {
      var S = window.MC_SYNC && MC_SYNC.status ? MC_SYNC.status() : null;
      if (signedInHere() && !(S && S.lastPull)) {
        if (++tries <= 6) setTimeout(attempt, 5000);
        return;
      }
      try { finishStale(Date.now()); } catch (e) {}
    })();
  }

  window.MC_AUTO = { run: run, log: log, undo: undo, paused: paused, resume: resume, scan: scan, finishStale: finishStale, openLog: openLog,
    PAUSE_AFTER: PAUSE_AFTER, WINDOW_MS: WINDOW_MS, STALE_MS: STALE_MS };
})();
