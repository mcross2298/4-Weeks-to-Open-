/* ==========================================================================
   mc-setlog.js  —  shared set/rep logger (single source of truth)
   --------------------------------------------------------------------------
   Renders the per-set WEIGHT/REPS logger under every exercise card, on every
   workout page, deterministically — replacing the per-page inline scripts that
   were rendering inconsistently. Hardened: does NOT depend on a page's #app
   watch-loop or render timing; runs on its own observer + retry passes.

   Compatibility (so nothing else breaks):
   - Persists to the SAME store ('mc_setlog_v1', keyed PID|exId, sets{sn:{w,r}})
     that the Finish-Workout module reads for history/PRs.
   - Each set's checkbox carries class .set-check and toggles .done, so the
     existing progress observer ("X / Y sets") and Finish-Workout counter pick
     it up with no change.
   - Removes any native .setlog-toggle/.setlog-wrap so there is exactly one
     logger, then renders its own (.mcl-*). Re-runs briefly to win any race
     with the late native render, which then no-ops.
   ========================================================================== */
(function () {
  if (window.__mcSetlog) return;
  window.__mcSetlog = true;

  var SK  = 'mc_setlog_v1';
  // PID namespaces persistence per program. Custom "Build Your Own" workouts run
  // through run-workout.html and set window.MC_PID_OVERRIDE so each saved workout
  // keeps its own logging history instead of colliding on the shared filename.
  var PID = (window.MC_PID_OVERRIDE || location.pathname.split('/').pop().replace('.html', ''));
  // Unique id for this page-load session; groups all sets into one session row.
  var SESSION_ID = 'sess-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // ---- storage (shape-compatible with the Finish-Workout module) ---------
  function st() { try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch (e) { return {}; } }
  function ek(id) { return PID + '|' + id; }
  function save(exId, sn, w, r, rpe) {
    var s = st(), k = ek(exId); if (!s[k]) s[k] = [];
    var d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var sess = s[k][0];
    if (!sess || sess.d !== d) { sess = { d: d, sets: {} }; s[k].unshift(sess); s[k] = s[k].slice(0, 5); }
    var entry = { w: w, r: r };
    if (rpe) entry.rpe = rpe;          // optional — older readers ignore it
    sess.sets[sn] = entry;
    try { localStorage.setItem(SK, JSON.stringify(s)); } catch (e) {}
  }
  function lsess(exId) { var s = st(); return (s[ek(exId)] || [])[0] || null; }
  function lset(exId, sn) { var sess = lsess(exId); return sess ? sess.sets[sn] || null : null; }
  function histText(exId) {
    var sess = lsess(exId); if (!sess) return '';
    var top = null;
    Object.keys(sess.sets).forEach(function (k) {
      var w = parseFloat(sess.sets[k].w) || 0;
      if (w && (!top || w > top.w)) top = { w: w, rpe: sess.sets[k].rpe };
    });
    if (!top) return sess.d;
    return 'Last: ' + top.w + ' lb' + (top.rpe ? ' @' + top.rpe : '') + ' · ' + sess.d;
  }

  // ---- active-exercise highlight ------------------------------------------
  // Marks whichever card the athlete is actually logging sets on right now
  // (opened its Log Sets panel, checked a set, or focused a weight/reps
  // field) with .active, so the accent-ring in base.css follows attention
  // around the workout. Only one card at a time; every other exercise stays
  // fully visible (no accordion/collapse) — purely a focus cue.
  // ---- notes: collapse to one line, tap to expand -------------------------
  // .a-notes is rendered per-page (every program's inline script builds its
  // own noteHtml), so this runs generically over whatever the DOM already
  // has rather than requiring per-page changes. Idempotent via data-mc-notes
  // so repeat run() passes (MutationObserver-driven) don't double-bind.
  function collapseNotes() {
    document.querySelectorAll('.a-notes').forEach(function (n) {
      if (n.dataset.mcNotes) return;
      n.dataset.mcNotes = '1';
      n.classList.add('a-notes-collapsible');
      n.addEventListener('click', function (e) {
        e.stopPropagation();
        n.classList.toggle('a-notes-open');
      });
    });
  }

  function setActiveCard(card) {
    document.querySelectorAll('.ex-card.active, .ss-ex.active').forEach(function (c) {
      if (c !== card) c.classList.remove('active');
    });
    if (card) card.classList.add('active');
  }

  // RPE chip cycle: – → 8 → 8.5 → 9 → 9.5 → 10 → F (to failure) → –
  var RPE_STEPS = ['', '8', '8.5', '9', '9.5', '10', 'F'];

  // ---- parse the prescribed "sets" string --------------------------------
  function setCount(s) {
    if (!s) return 3;
    var x = s.match(/^(\d+)\s*[x×]/i); if (x) return Math.min(parseInt(x[1], 10), 12);
    var c = s.split(','); if (c.length > 1) return c.length;
    var n = s.match(/^(\d+)/); return n ? Math.min(parseInt(n[1], 10), 8) : 3;
  }
  function repFor(s, i) {
    if (!s) return '';
    var c = s.split(','); if (c.length > 1) return (c[i] || c[c.length - 1]).replace(/[^\d]/g, '').slice(0, 3) || '';
    var x = s.match(/[x×]\s*(\d+)/i); if (x) return x[1];
    var n = s.match(/(\d+)/); return n ? n[1] : '';
  }

  // ---- cluster-set detection ----------------------------------------------
  // A cluster set (e.g. "5+5+5") breaks EVERY working set of the exercise into
  // mini-sets with a short intra-set rest. Producers (run-workout.html,
  // program-overrides.js) stamp the scheme onto the card as data-mc-cluster /
  // data-mc-cluster-rest; when absent, rows render exactly as before.
  function parseClusterAttr(s) {
    return s ? s.split('+').map(function (p) { return p.trim(); }).filter(Boolean) : [];
  }

  // ---- drop-set detection -------------------------------------------------
  // A drop set is an EXTRA set tacked onto the working sets — it must not be
  // folded into the working-set count. FOUR notations appear across programs:
  /* MARKET:STRIP influencer-refs START */
  //   • open-ended "drop set"  (Daily Gainz "3×8–12, drop set" / "(drop set)")
  /* MARKET:STRIP influencer-refs END */
  //       → an AMRAP drop (strip weight, reps to failure)
  //   • numeric  "… drop N"    (PMC/MC/Pump "12,10,8,8 drop 15")
  //       → a drop with a prescribed rep target (N)
  //   • word, optionally multiplier-prefixed  "…, Drop AMRAP" / "…, 2× Drop AMRAP"
  //       (Iron Engine/Kitchen Sink word family) → the multiplier repeats the
  //       AMRAP token that many times (one row per drop)
  //   • arrow, trailing           "12, 10, 8, 8 → AMRAP, AMRAP"
  //       (Iron Engine/Kitchen Sink family)
  //   • plus-multiplier, no "drop" word   "8, 6, 4, 4, + 2×AMRAP"
  //       (Modality Matrix superset/tri-set burnout rounds)
  //   • "then"                    "12,10,8,8 then AMRAP"
  // Returns {is, drops} where each entry in drops is a numeric target or 'AMRAP'.
  // A bare "drop" with no number and no "set" (rare) is NOT treated as a drop.
  // "∞" is accepted everywhere "amrap" is, as a display-swapped synonym —
  // pages (e.g. run-workout.html's custom-workout builder) may render the
  // drop target as the ∞ glyph instead of the word "AMRAP"; either spelling
  // normalizes to the same internal 'AMRAP' keyword below, so the Log Sets
  // placeholder always shows literal "AMRAP" (the functional log-it cue)
  // regardless of which glyph the page displays.
  function parseDrop(name, sets) {
    var hay = (name || '') + ' ' + (sets || '');
    function tokensFrom(str) {
      var drops = [], tok = /(\d+)|set|amrap|∞/gi, t;
      while ((t = tok.exec(str))) drops.push(t[1] ? t[1] : 'AMRAP');
      return drops;
    }
    function finish(tokenStr, mult) {
      var drops = tokensFrom(tokenStr);
      if (!drops.length) return { is: false, drops: [] };
      // A leading "N× " multiplier on a SINGLE-token drop clause repeats that
      // token N times ("2× Drop AMRAP" == two successive AMRAP drops).
      if (mult && drops.length === 1) {
        var one = drops[0]; drops = [];
        for (var i = 0; i < mult; i++) drops.push(one);
      }
      return { is: true, drops: drops };
    }
    var m;
    // arrow: "12, 10, 8, 8 → AMRAP, AMRAP" (trailing, end of string)
    m = hay.match(/→\s*((?:amrap|∞|\d+)(?:\s*,\s*(?:amrap|∞|\d+))*)\s*$/i);
    if (m) return finish(m[1], 0);
    // plus-multiplier, no "drop" word: "…, + 2×AMRAP"
    m = hay.match(/\+\s*(\d+)\s*[x×]\s*(?:amrap\b|∞)\s*$/i);
    if (m) return finish('AMRAP', parseInt(m[1], 10));
    // "…, then AMRAP"
    m = hay.match(/\bthen\b\s*((?:amrap|∞|\d+)(?:\s*,\s*(?:amrap|∞|\d+))*)\s*$/i);
    if (m) return finish(m[1], 0);
    // word "drop", optionally "N× drop …" — tokens must immediately follow
    // "drop": one or more of set/AMRAP/∞/number, comma-separated.
    m = hay.match(/(?:(\d+)\s*[x×]\s*)?\bdrop\b\s*((?:set|amrap|∞|\d+)(?:\s*,\s*(?:set|amrap|∞|\d+))*)/i);
    if (m) return finish(m[2], m[1] ? parseInt(m[1], 10) : 0);
    return { is: false, drops: [] };
  }
  // Strip the trailing drop clause (whichever of the four notations matched)
  // so the WORKING sets parse cleanly ("12,10,8,8 drop 15" → "12,10,8,8";
  // "12, 10, 8, 8 → AMRAP, AMRAP" → "12, 10, 8, 8"; no more garbled targets).
  function stripDrop(s) {
    return (s || '')
      .replace(/\s*→\s*(?:amrap|∞|\d+)(?:\s*,\s*(?:amrap|∞|\d+))*\s*$/i, '')
      .replace(/[,+ ]*\+\s*\d+\s*[x×]\s*(?:amrap\b|∞)\s*$/i, '')
      .replace(/[, ]*\bthen\b\s*(?:amrap|∞|\d+)(?:\s*,\s*(?:amrap|∞|\d+))*\s*$/i, '')
      .replace(/[,+ ]*(?:\d+\s*[x×]\s*)?\bdrop\b.*$/i, '')
      .trim();
  }

  // ---- rest seconds from the card's rest timer ---------------------------
  function restSecs(card) {
    var t = card.querySelector('.rest-timer');
    if (t && t.dataset && t.dataset.rest && typeof TMR !== 'undefined' && TMR.parseSeconds)
      return TMR.parseSeconds(t.dataset.rest) || 60;
    return 60;
  }

  // ---- check handler -----------------------------------------------------
  // A cluster working set (see build()'s clusterParts handling) carries
  // SEVERAL .mcl-r reps inputs in one row — one bubble per mini-set — instead
  // of the usual single reps box, so the athlete can log what they actually
  // hit on each mini-set (e.g. "5+5+6" when the last one came up short). Read
  // them all and join with '+' into the same rVal string a plain row would
  // produce; every downstream consumer (save/history/Supabase) just sees text.
  function clusterRVal(row) {
    var mini = row.querySelectorAll('.mcl-r');
    if (mini.length <= 1) return mini.length ? mini[0].value.trim() : '';
    return Array.prototype.map.call(mini, function (m) { return m.value.trim() || m.placeholder || ''; }).join('+');
  }
  function onCheck(card, exId, sn, rs) {
    var row = card.querySelector('#mclr-' + cssId(exId) + '-' + sn);
    if (!row) return;
    var ck = row.querySelector('.mcl-ck');
    var w = row.querySelector('.mcl-w');
    if (ck.classList.contains('done')) {
      ck.classList.remove('done'); ck.textContent = '☐'; row.classList.remove('done-row');
      updateCount(card, exId);
      return;
    }
    var rpeEl = row.querySelector('.mcl-rpe');
    var wVal = w ? w.value.trim() : '';
    var rVal = clusterRVal(row);
    var rpeVal = rpeEl ? (rpeEl.dataset.rpe || '') : '';
    save(exId, sn, wVal, rVal, rpeVal);
    // Best-effort Supabase write — builds durable per-set history for the
    // auto-weight pre-fill, fatigue flag, and PR milestone detection.
    // Never blocks the UI; all Supabase calls are fire-and-forget.
    try {
      if (window.MC_SB && MC_SB.configured && MC_SB.logSet) {
        var nmEl = card.querySelector('.ex-name, .ss-name, .lift-name, .var-name');
        var exName = origNameOf(nmEl);
        var muscle = '';
        try { if (window.MC_EXCATALOG) muscle = MC_EXCATALOG.classify(exName); } catch (me) {}
        var wNum = wVal ? (parseFloat(wVal) || null) : null;
        // A cluster row's rVal is "5+5+6" — sum the mini-sets for a meaningful
        // total rep count rather than parseInt-ing just the first number.
        var repsNum = rVal
          ? rVal.split('+').reduce(function (sum, p) { return sum + (parseInt(p, 10) || 0); }, 0) || null
          : null;
        var logEntry = {
          session_id:   SESSION_ID,
          exercise:     exName,
          muscle:       muscle,
          set_number:   sn,
          weight_lbs:   wNum,
          reps:         repsNum,
          rpe:          rpeVal || null,
          workout_name: document.title || '',
          program_id:   (window.activeProg && activeProg.id) || ''
        };
        // Get previous max weight BEFORE inserting, then check for PR
        var prevMaxP = (wNum && MC_SB.getMaxWeight) ? MC_SB.getMaxWeight(exName) : Promise.resolve(null);
        prevMaxP.then(function (prevMax) {
          MC_SB.logSet(logEntry).then(function () {
            // PR detected: new weight exceeds historical max
            if (wNum && (prevMax === null || wNum > prevMax) && MC_SB.sendPush) {
              MC_SB.sendPush({
                title: '🏆 New PR — ' + exName + '!',
                body: wNum + ' lbs — your best lift ever. Keep pushing!'
              }).catch(function () {});
            }
          }).catch(function () {});
        }).catch(function () {
          MC_SB.logSet(logEntry).catch(function () {});
        });
      }
    } catch (e) {}
    ck.classList.add('done'); ck.textContent = '✓'; row.classList.add('done-row');
    // Light confirming tap on check (respects the timer's haptics pref if loaded).
    try {
      var hp = (typeof MC_PREFS !== 'undefined') ? MC_PREFS.get().haptics : true;
      if (hp && navigator.vibrate) navigator.vibrate(15);
    } catch (e) {}
    updateHist(card, exId);
    updateCount(card, exId);
    if (rs > 0 && typeof TMR !== 'undefined' && TMR.start) {
      var t = card.querySelector('.rest-timer');
      if (t) {
        // Use the rest value carried on the timer (from the program's data),
        // so the auto-countdown matches the prescribed rest exactly.
        var secs = (TMR.parseSeconds && TMR.parseSeconds(t.dataset.rest)) || rs;
        try { (typeof buildTimerFloat === 'function') && buildTimerFloat(); } catch (e) {}
        TMR.start(t, secs, 'Rest');
      }
    }
  }
  function updateHist(card, exId) {
    var h = card.querySelector('.mcl-hist-' + cssId(exId));
    if (h) h.textContent = histText(exId);
  }
  // Collapsed-header "done / total" so set progress reads without expanding.
  function updateCount(card, exId) {
    var cid = cssId(exId);
    var el = card.querySelector('.mcl-count-' + cid);
    if (!el) return;
    var rows = card.querySelectorAll('.mcl-row[id^="mclr-' + cid + '-"]');
    var done = 0;
    Array.prototype.forEach.call(rows, function (r) {
      if (r.querySelector('.mcl-ck.done')) done++;
    });
    el.textContent = done + '/' + rows.length;
    el.classList.toggle('done', done > 0 && done === rows.length);
  }
  function cssId(id) { return String(id).replace(/[^a-zA-Z0-9_-]/g, '_'); }

  // ---- render the logger onto a host element -----------------------------
  function build(host, card, exId, setsStr, rs) {
    if (!host) return;
    // Strip any OTHER wave3 logger / notes UI EVERY pass (before the early
    // return), so page-native scripts that re-add their UI after us (e.g.
    // pmc-workout's .ex-notes) don't win the race.
    /* MARKET:STRIP influencer-refs START */
    // NOTE: we deliberately do NOT strip .set-row — that is PSU's native
    // exercise content, not a stray logger.
    /* MARKET:STRIP influencer-refs END */
    Array.prototype.forEach.call(
      host.querySelectorAll('.setlog-toggle, .setlog-wrap, .note-btn, .note-area, .ex-notes-toggle, .ex-notes-wrap, .log-row'),
      function (n) { n.remove(); }
    );
    if (host.querySelector('.mcl-wrap')) return;   // ours already present

    var cid = cssId(exId);

    // Separate the WORKING sets from any appended drop set so the drop is never
    // folded into (and garbling) the working-set rows. See parseDrop/stripDrop.
    var nmEl = card.querySelector('.ex-name, .ss-name, .lift-name, .var-name');
    var drop = parseDrop(nmEl ? nmEl.textContent : '', setsStr);
    var work = drop.is ? stripDrop(setsStr) : setsStr;
    var n = setCount(work);
    var nd = drop.is ? drop.drops.length : 0;   // number of appended drop rows
    var total = n + nd;
    var dropAmrap = nd === 1 && drop.drops[0] === 'AMRAP';
    var clusterParts = parseClusterAttr(card.dataset.mcCluster);
    var clusterRestLabel = card.dataset.mcClusterRest || '';

    var dropTag = '', dropTitle = '';
    if (drop.is) {
      dropTag = nd > 1 ? ('+ ' + nd + ' DROPS') : (dropAmrap ? '+ AMRAP' : '+ DROP');
      dropTitle = nd > 1
        ? ('Drop sets — ' + nd + ' successive drops after your working sets')
        : (dropAmrap ? 'Drop set — extra set to failure after your working sets'
                     : 'Drop set — strip weight after the last set, rep out (~' + drop.drops[0] + ')');
    }
    var toggle = document.createElement('div');
    toggle.className = 'mcl-toggle';
    toggle.innerHTML = '<span class="mcl-chev">▾</span><span class="mcl-lbl">Log Sets</span>' +
                       '<span class="mcl-count mcl-count-' + cid + '">0/' + total + '</span>' +
                       (drop.is ? '<span class="mcl-amrap" title="' + dropTitle + '">' + dropTag + '</span>' : '') +
                       '<span class="mcl-hist mcl-hist-' + cid + '">' + histText(exId) + '</span>';

    var wrap = document.createElement('div');
    wrap.className = 'mcl-wrap';
    var html = '<div class="mcl-hdr"><div class="mcl-hl">Set</div><div class="mcl-hl">Weight</div>' +
               '<div class="mcl-hl">Reps</div><div class="mcl-hl">RPE</div><div class="mcl-hl"></div></div>';
    for (var i = 0; i < total; i++) {
      var sn = i + 1, last = lset(exId, sn);
      var dropIdx = i - n;                          // ≥0 ⇒ this is a drop row
      var isDropRow = drop.is && dropIdx >= 0;
      var dropTarget = isDropRow ? drop.drops[dropIdx] : '';
      var pr = isDropRow ? '' : repFor(work, i);
      // Quick Pump's history-aware weight seed (Phase 2.4): a fresh Quick
      // Pump session has no mc_setlog_v1 history of its own (new id every
      // generation), so `last` is always empty there — this is local-only
      // (mc_workout_log_v1), set-1-only, and never overrides real history.
      var seedWeight = (i === 0 && !last) ? parseFloat(card.dataset && card.dataset.mcSeedWeight) : 0;
      var wPh = (last && last.w) ? (last.w + ' lb') : (seedWeight ? (seedWeight + ' lb') : 'lb');
      var rPh = isDropRow ? (dropTarget === 'AMRAP' ? 'AMRAP' : dropTarget) : (pr || (last && last.r ? last.r : 'reps'));
      var rpe = (last && last.rpe) || '';
      // One-tap fill values: focusing an empty field drops in last session's
      // weight (and the prescribed / last reps) so the athlete confirms instead
      // of retyping. Carry-down (below) keeps later sets' fill in sync with set 1.
      var wFill = (last && last.w) ? last.w : (seedWeight || '');
      var rFill = isDropRow ? (dropTarget === 'AMRAP' ? '' : dropTarget)
                            : (pr || (last && last.r) || '');

      // A cluster working set (not a drop row) gets N reps bubbles — one per
      // mini-set — pre-populated with what was actually logged last time, or
      // the prescribed target when there's no history, instead of one plain
      // reps box. Everything else about the row (weight, RPE, checkbox, the
      // rest-timer it triggers) is identical to a normal working set.
      var isClusterRow = !isDropRow && clusterParts.length > 0;
      var repsCellHtml, clusterRowHtml = '';
      if (isClusterRow) {
        var lastParts = (last && last.r && last.r.indexOf('+') !== -1) ? last.r.split('+') : null;
        repsCellHtml = '<div class="mcl-rcell"></div>';
        var bubbles = clusterParts.map(function (target, k) {
          var v = (lastParts && lastParts[k] !== undefined) ? lastParts[k].trim() : target;
          return '<input class="mcl-inp mcl-r mcl-rmini" type="number" inputmode="numeric" value="' + v + '" title="Mini-set ' + (k + 1) + ' reps">';
        }).join('<span class="mcl-cluster-plus">+</span>');
        clusterRowHtml = '<div class="mcl-cluster-row">' +
          '<span class="mcl-cluster-lbl">🧩 Cluster' + (clusterRestLabel ? ' · ' + clusterRestLabel : '') + '</span>' +
          '<div class="mcl-cluster-bubbles">' + bubbles + '</div>' +
        '</div>';
      } else {
        repsCellHtml = '<input class="mcl-inp mcl-r" type="number" inputmode="numeric" placeholder="' + rPh + '"' + (rFill !== '' ? ' data-fill="' + rFill + '"' : '') + '>';
      }

      html += '<div class="mcl-row' + (isDropRow ? ' mcl-row-amrap' : '') + '" id="mclr-' + cid + '-' + sn + '">' +
                '<div class="mcl-num">' + (isDropRow ? '↓' : sn) + '</div>' +
                '<input class="mcl-inp mcl-w" type="number" inputmode="decimal" placeholder="' + wPh + '"' + (wFill !== '' ? ' data-fill="' + wFill + '"' : '') + '>' +
                repsCellHtml +
                '<div class="mcl-rpe' + (rpe ? ' set' : '') + '" data-rpe="' + rpe + '" ' +
                  'title="Rate of Perceived Exertion — tap to cycle, F = to failure">' + (rpe || '–') + '</div>' +
                '<div class="mcl-ck set-check" data-sn="' + sn + '">☐</div>' +
                clusterRowHtml +
              '</div>';
    }
    wrap.innerHTML = html;

    // wiring
    toggle.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      var open = wrap.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.querySelector('.mcl-lbl').textContent = open ? 'Hide' : 'Log Sets';
      setActiveCard(open ? card : null);
    });
    wrap.addEventListener('click', function (e) { e.stopPropagation(); });
    Array.prototype.forEach.call(wrap.querySelectorAll('.mcl-ck'), function (ck) {
      ck.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
        setActiveCard(card);
        onCheck(card, exId, parseInt(ck.dataset.sn, 10), rs);
      });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.mcl-rpe'), function (chip) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
        var i = RPE_STEPS.indexOf(chip.dataset.rpe || '');
        var next = RPE_STEPS[(i + 1) % RPE_STEPS.length];
        chip.dataset.rpe = next;
        chip.textContent = next || '–';
        chip.classList.toggle('set', !!next);
        // already-checked set: persist the tweak immediately
        var row = chip.closest('.mcl-row');
        var ck = row && row.querySelector('.mcl-ck');
        if (ck && ck.classList.contains('done')) {
          var w = row.querySelector('.mcl-w');
          save(exId, parseInt(ck.dataset.sn, 10), w ? w.value.trim() : '', clusterRVal(row), next);
          updateHist(card, exId);
        }
      });
    });

    // Tap-to-fill: focusing an empty input drops in its suggested value (last
    // weight / prescribed reps) and selects it, so typing still overrides
    // instantly but a single tap-then-check accepts last time's number.
    Array.prototype.forEach.call(wrap.querySelectorAll('.mcl-inp'), function (inp) {
      inp.addEventListener('focus', function () {
        setActiveCard(card);
        if (!inp.value.trim() && inp.dataset.fill) {
          inp.value = inp.dataset.fill;
          try { inp.select(); } catch (e) {}
        }
      });
    });
    // Carry-down: typing set 1's weight updates the fill/placeholder of every
    // later still-empty working set (drop rows excluded — weight is stripped).
    var wInputs = Array.prototype.slice.call(
      wrap.querySelectorAll('.mcl-row:not(.mcl-row-amrap) .mcl-w'));
    wInputs.forEach(function (inp, idx) {
      inp.addEventListener('input', function () {
        var v = inp.value.trim();
        if (!v) return;
        for (var j = idx + 1; j < wInputs.length; j++) {
          var nxt = wInputs[j];
          if (!nxt.value.trim()) { nxt.placeholder = v + ' lb'; nxt.dataset.fill = v; }
        }
      });
    });

    host.appendChild(toggle);
    host.appendChild(wrap);
  }

  // ---- attach to every exercise card -------------------------------------
  /* MARKET:STRIP influencer-refs START */
  function liftId(card) {
    var nm = card.querySelector('.lift-name');
    return 'psu-' + ((nm ? nm.textContent : '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 20) || 'x');
  }
  /* MARKET:STRIP influencer-refs END */
  // Read the prescribed scheme from whichever element a template uses:
  /* MARKET:STRIP influencer-refs START */
  //   .ex-sets        (PMC/MC/Pump/Gainz chip)
  //   [data-field=sets] / .notes-row  (STNDR editable)
  //   .lift-meta      (PSU "4 × 5" scheme)
  /* MARKET:STRIP influencer-refs END */
  function setsOf(card) {
    var se = card.querySelector('.ex-sets, [data-field="sets"], .notes-row, .lift-meta');
    return se ? se.textContent.trim() : '';
  }
  // The ORIGINAL (HTML-authored) name of an exercise, never the painted one.
  // program-overrides.js stamps the immutable original on the card as
  // data-mc-orig-name the instant it paints a rename, so we key persistence
  // off that — keying off the visible text would fork a renamed exercise onto
  // a brand-new history bucket and orphan everything logged before the rename.
  // Both load orders converge: if this runs before the painter the visible
  // text IS the original; if the painter ran first the attribute holds it.
  function origNameOf(el) {
    if (!el) return '';
    var card = el.closest('.ex-card, .ss-ex, .ex-item, .lift-card');
    var orig = card && card.getAttribute('data-mc-orig-name');
    return orig || el.textContent || '';
  }
  function slugOf(el) {
    return origNameOf(el).trim().replace(/\s+/g, '-').toLowerCase().slice(0, 24) || 'ex';
  }
  // Deterministic id from the original exercise name (NO random fallback — that
  // would change every pass, breaking persistence and re-rendering forever).
  // Duplicate names are disambiguated by their occurrence order in the DOM.
  function nameId(card) {
    var mine = card.querySelector('.ex-name, .ss-name, .lift-name');
    var base = slugOf(mine);
    var all = document.querySelectorAll('.ex-name, .ss-name, .lift-name');
    var occ = 0;
    for (var i = 0; i < all.length; i++) {
      if (slugOf(all[i]) === base) { if (all[i] === mine) break; occ++; }
    }
    return 'x-' + base + (occ ? '-' + occ : '');
  }

  function run() {
    // Match cards WITH OR WITHOUT data-id. Older templates
    /* MARKET:STRIP influencer-refs START */
    // (STNDR push-pull-legs, PSU psu-strength, weeks-to-open, legacy-prep,
    // s4-*, most of pmc-workout)
    /* MARKET:STRIP influencer-refs END */
    // render .ex-card/.lift-card with no data-id, so a data-id-only selector
    // silently skipped them. Fall back to a stable id derived from the name.
    document.querySelectorAll('.ex-card').forEach(function (c) {
      /* MARKET:STRIP influencer-refs START */
      // host varies by template: .ex-content (PMC/MC), .ex-body (STNDR), else card
      /* MARKET:STRIP influencer-refs END */
      build(c.querySelector('.ex-content') || c.querySelector('.ex-body') || c, c, c.dataset.id || nameId(c), setsOf(c), restSecs(c));
    });
    document.querySelectorAll('.ss-ex').forEach(function (c) {
      // Read the prescribed rest from the exercise's own .rest-timer (data),
      // not a hardcoded value — fallback 90s. The superset normalizer below
      // then keeps a single timer on the SECOND row and parks it under the logger.
      build(c.querySelector('.ss-content') || c.querySelector('.ex-body') || c, c, c.dataset.id || nameId(c), setsOf(c), restSecs(c) || 90);
    });
    document.querySelectorAll('.ex-item').forEach(function (c) {
      build(c, c, c.dataset.id || nameId(c), setsOf(c), restSecs(c));
    });
    /* MARKET:STRIP influencer-refs START */
    // NOTE: .lift-card (PSU) is intentionally NOT handled here — PSU pages ship
    // their own complete per-set logger (.set-row: Set 1/2/3 with reps+weight+
    // checkbox). Rendering a second logger there caused duplicate rows and the
    // stray strikethroughs. PSU keeps its native logger.
    /* MARKET:STRIP influencer-refs END */
    normalizeSupersetTimers();
    collapseNotes();
  }

  // ---- superset rest-timer normalization ---------------------------------
  // A superset is "do A then B back-to-back, THEN rest". So there must be a
  // SINGLE rest timer, and it belongs on the SECOND exercise (B) — not the
  // first. We also park it directly under the "Log Sets" dropdown, so the rest
  // auto-starts the moment B's set row is checked off (onCheck handles that).
  function normalizeSupersetTimers() {
    document.querySelectorAll('.ss-card').forEach(function (sc) {
      var exs = sc.querySelectorAll('.ss-ex');
      if (exs.length < 2) return;
      var last = exs[exs.length - 1];
      Array.prototype.forEach.call(exs, function (ex) {
        var timers = ex.querySelectorAll('.rest-timer');
        if (ex !== last) {
          // strip rest timers from every non-final superset row
          Array.prototype.forEach.call(timers, function (t) { t.remove(); });
          return;
        }
        // final row (B): keep exactly one timer, parked under the logger
        var keep = timers[0];
        for (var i = 1; i < timers.length; i++) timers[i].remove();
        if (!keep) return;
        var host = ex.querySelector('.ss-content') || ex;
        var wrap = host.querySelector('.mcl-wrap');
        if (wrap && keep.parentNode && keep.previousElementSibling !== wrap) {
          keep.classList.add('mcl-rest-under');
          wrap.parentNode.insertBefore(keep, wrap.nextSibling);
        }
      });
    });
  }

  // shared parsing helpers for mc-suggest.js (and future analytics) — avoids
  // re-implementing the prescribed-scheme parser anywhere else
  window.MCSetlogUtil = { setCount: setCount, repFor: repFor, pid: PID, histKey: ek };

  // ---- cross-device pre-fill from Supabase ----------------------------------
  // When localStorage has no history (e.g. new device), query Supabase for the
  // last logged weight per exercise and update data-fill on weight inputs.
  // Non-blocking — runs 2s after the initial render to avoid startup latency.
  function trySupabasePrefill() {
    if (!window.MC_SB || !MC_SB.configured || !MC_SB.getLastWeight) return;
    document.querySelectorAll('.mcl-wrap').forEach(function (wrap) {
      var wInputs = wrap.querySelectorAll('.mcl-row:not(.mcl-row-amrap) .mcl-w');
      if (!wInputs.length) return;
      // Only fetch from Supabase when localStorage has no fill for this exercise
      var firstInput = wInputs[0];
      if (firstInput.dataset.fill) return;
      var card = wrap.closest('.ex-card, .ss-ex, .ex-item') || wrap.parentNode;
      var nmEl = card && card.querySelector('.ex-name, .ss-name, .lift-name, .var-name');
      if (!nmEl) return;
      var name = origNameOf(nmEl);
      MC_SB.getLastWeight(name).then(function (w) {
        if (!w) return;
        Array.prototype.forEach.call(wInputs, function (inp) {
          if (!inp.dataset.fill && !inp.value) {
            inp.dataset.fill = String(w);
            inp.placeholder = w + ' lb';
          }
        });
      }).catch(function () {});
    });
  }

  // ---- init: run now + retry passes to win any race with native render ---
  function init() {
    run();
    [250, 700, 1500, 2600].forEach(function (d) { setTimeout(run, d); });
    var mo = new MutationObserver(function () { clearTimeout(init._t); init._t = setTimeout(run, 120); });
    mo.observe(document.body, { childList: true, subtree: true });
    // Supabase pre-fill: after initial render settles
    setTimeout(trySupabasePrefill, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

// Tier 4 Phase 5 — guided linear workout mode (mc-guided.js) is a separate
// opt-in script that attaches wherever this file's .ex-card/.ss-card +
// mcl-count contract exists. Loading it here, rather than hand-adding a
// <script> tag to every program page, gives every page that already does
// set-logging guided-mode capability for free. This file's own behavior is
// unchanged by the addition.
if (typeof document !== 'undefined' && !document.querySelector('script[src="mc-guided.js"]')) {
  var _mcGuidedLoader = document.createElement('script');
  _mcGuidedLoader.src = 'mc-guided.js';
  document.head.appendChild(_mcGuidedLoader);
}
