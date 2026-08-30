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
  // W0 — Node-side hook so CI can regression-test the REAL prescription
  // parser (same convention as mc-sync.js / mc-suggest.js) instead of a
  // transcribed copy that could drift from what ships. Placed above the
  // `window` guard on purpose: there is no window in Node, and the parser
  // functions are `function` declarations further down this same closure, so
  // hoisting has already defined them by the time this runs. See
  // tools/test-mc-setlog-plan.js and tools/check-set-schemes.js.
  if (typeof module !== 'undefined' && module.exports) {
    // Deliberately only the four functions that already existed before W1:
    // the tests assert the PUBLIC contract ("how many rows, targeting what"),
    // not this file's internal decomposition, so they run unchanged against
    // the old parser and the new one — which is what lets them be proven to
    // fail on the tree before the fix lands.
    module.exports = {
      setCount:   function () { return setCount.apply(null, arguments); },
      repFor:     function () { return repFor.apply(null, arguments); },
      parseDrop:  function () { return parseDrop.apply(null, arguments); },
      stripDrop:  function () { return stripDrop.apply(null, arguments); }
    };
    return;
  }
  if (window.__mcSetlog) return;
  window.__mcSetlog = true;

  var SK  = 'mc_setlog_v1';
  // PID namespaces persistence per program. Custom "Build Your Own" workouts run
  // through run-workout.html and set window.MC_PID_OVERRIDE so each saved workout
  // keeps its own logging history instead of colliding on the shared filename.
  var PID = (window.MC_PID_OVERRIDE || location.pathname.split('/').pop().replace('.html', ''));
  // Unique id for this page-load session; groups all sets into one session row.
  var SESSION_ID = 'sess-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // A-9: PR-check local high-water mark. getMaxWeight() was called before
  // EVERY checked set to learn the historical max for that exercise — a real
  // network round trip on the hottest path in the app, to answer a question
  // that only changes when THIS session sets a new PR. In-memory only (not
  // persisted): a fresh page load re-seeds from the server once per exercise
  // the first time it matters, which is correct — this cache exists to avoid
  // repeat queries within one session, not to second-guess the server's
  // cross-device truth. undefined = not yet seeded; null = seeded, no prior
  // max; a number = seeded, known max.
  var _prCache = {};
  function prCacheKey(exName) { return String(exName || '').toLowerCase(); }
  function localMaxP(exName) {
    var k = prCacheKey(exName);
    if (k in _prCache) return Promise.resolve(_prCache[k]);
    if (!window.MC_SB || !MC_SB.getMaxWeight) return Promise.resolve(null);
    return MC_SB.getMaxWeight(exName).then(function (v) { _prCache[k] = v; return v; });
  }
  function noteMax(exName, w) {
    var k = prCacheKey(exName);
    if (w && (!(k in _prCache) || _prCache[k] === null || w > _prCache[k])) _prCache[k] = w;
  }

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

  // ---- A-10: typed-but-unchecked values survive a reload -------------------
  // Nothing persisted a weight/reps field until the checkbox was tapped —
  // onCheck() was the only path into storage. An interrupted set (a mid-
  // session sign-in reload via mc-sync.js, the SW's forced deploy reload, a
  // dropped phone) erased whatever the athlete had just typed, and worse:
  // the next reload's carry-down would then repopulate the empty field with
  // the PREVIOUS set's number, nudging the athlete toward the wrong load.
  // Separate small store, not folded into mc_setlog_v1 — these are drafts,
  // not committed sets, and must never appear in history/PR/Supabase logic.
  // Pruned by age the same way mc_session_v1 is, since an abandoned exercise
  // should not hold a stale pending value forever.
  var PK = 'mc_setlog_pending_v1';
  var PENDING_MAX_AGE = 12 * 3600 * 1000;
  function readPending() {
    var p; try { p = JSON.parse(localStorage.getItem(PK) || '{}') || {}; } catch (e) { p = {}; }
    var now = Date.now(), changed = false;
    Object.keys(p).forEach(function (k) {
      if (!p[k] || (now - (p[k].ts || 0)) > PENDING_MAX_AGE) { delete p[k]; changed = true; }
    });
    if (changed) try { localStorage.setItem(PK, JSON.stringify(p)); } catch (e) {}
    return p;
  }
  function pendingKey(exId, sn) { return PID + '|' + exId + '|' + sn; }
  function getPending(exId, sn) { return readPending()[pendingKey(exId, sn)] || null; }
  function setPending(exId, sn, w, r) {
    var p = readPending(), k = pendingKey(exId, sn);
    if (!w && !r) { delete p[k]; }
    else { p[k] = { w: w || '', r: r || '', ts: Date.now() }; }
    try { localStorage.setItem(PK, JSON.stringify(p)); } catch (e) {}
  }
  function clearPending(exId, sn) {
    var p = readPending(), k = pendingKey(exId, sn);
    if (p[k]) { delete p[k]; try { localStorage.setItem(PK, JSON.stringify(p)); } catch (e) {} }
  }
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

  // A-11 / M-1 / §3.4: the app already knows which card has the athlete's
  // attention — becoming active now also opens that card's own logger, so
  // the "Log Sets" tap (an information-free gesture repeated once per
  // exercise, every session) is only ever needed to open a card out of
  // order. Every existing caller of setActiveCard() already implied an open
  // wrap (you can't focus a hidden input or tap a hidden checkbox); the one
  // caller that does NOT — the card-handoff promotion below — is exactly
  // the case this was missing for.
  // R4: the program's coaching cue (.a-notes) moved behind the header's ⓘ
  // button on cards using the consolidated header. ONE delegated listener for
  // every such button on the page, however it was rendered — the same pattern
  // mc-timer.js uses for .rest-timer, and the reason a per-engine copy of this
  // handler would be the exact duplication check-single-impl.js exists to
  // prevent. A real <button> is keyboard-focusable and fires click on both
  // Space and Enter for free, so the cue stays reachable without a pointer.
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.a-info');
    if (!btn) return;
    e.stopPropagation(); e.preventDefault();
    var card = btn.closest('.ex-card, .ss-ex, .ex-item');
    if (!card) return;
    var open = card.classList.toggle('a-note-open');
    btn.setAttribute('aria-expanded', String(open));
  });

  // ---- the expansion unit is the GROUP, not the card ---------------------
  // A superset or tri-set is one block the athlete performs as a unit —
  // A set 1, B set 1, A set 2 — so expanding one leg while its partners stay
  // collapsed hides exactly the rows the next thirty seconds need. And a
  // collapsed partner is not merely smaller: mc-setlog.css collapses a leg to
  // its 48px strip with `display:none!important` on every other child, so its
  // logger leaves the layout entirely. mc-superset-hop.js's openLog() adding
  // .open to a wrap inside a collapsed leg therefore changed nothing on
  // screen — the hop landed the athlete on an invisible logger.
  //
  // FOCUS stays per-exercise while EXPANSION is group-wide: exactly one unit
  // carries .active (the one being performed, which the hop advances leg by
  // leg and mc-voice reads), and every member of its group is open. A
  // standalone exercise is a group of one, so this is the same code path for
  // every card in the tree rather than a superset special case — which is
  // what makes it hold on the ~9 rendering engines without per-engine work.
  function groupOf(unit) {
    return (unit && unit.closest && unit.closest('.ss-card')) || unit;
  }
  function membersOf(unit) {
    var group = groupOf(unit);
    if (group && group.classList && group.classList.contains('ss-card')) {
      var legs = group.querySelectorAll('.ss-ex');
      if (legs.length) return Array.prototype.slice.call(legs);
    }
    return unit ? [unit] : [];
  }

  function setActiveCard(card) {
    document.querySelectorAll('.ex-card.active, .ss-ex.active').forEach(function (c) {
      if (c !== card) c.classList.remove('active');
    });
    // R3: one exercise expanded at a time — the one being performed. Every
    // other card rests as its 48px .mcl-strip. This reverses base.css's
    // recorded "no accordion" decision, which was made when a card was ~150px
    // and is being revisited now that S1-S4 measured it at 272px collapsed.
    // Signed off by the owner (roadmap decision 2). "One exercise" reads as
    // one GROUP now — the smallest block that is coherent to train.
    if (card) {
      var members = membersOf(card);
      // A-14: build every member's rows now if they were only ever
      // strip-built — openLogger() below assumes .mcl-wrap exists. Superset
      // legs are already eager (see run()) so this is a no-op there, but a
      // standalone card still needs it and a future eager/lazy change to
      // legs must not silently reveal an empty partner.
      members.forEach(ensureRowsBuilt);
      document.querySelectorAll(UNIT_SEL_R3).forEach(function (c) {
        if (members.indexOf(c) < 0 && c.querySelector('.mcl-strip')) setCollapsed(c, true);
      });
      card.classList.add('active');
      members.forEach(function (m) { setCollapsed(m, false); openLogger(m); });
    }
  }

  // A-14: build a specific card's rows on demand, from whatever setActiveCard()
  // or a session restore hands it — resolves host/exId/setsStr/rs the same
  // way run() does per unit type, so this reaches the identical DOM build()
  // itself would have. Superset legs (.ss-ex) are already fully eager (run()
  // calls build() for them directly), so this is a safe no-op there.
  function ensureRowsBuilt(card) {
    if (!card || card.classList.contains('ss-ex')) return;
    var host = card.classList.contains('ex-card')
      ? (card.querySelector('.ex-content') || card.querySelector('.ex-body') || card)
      : card;
    buildRows(host, card, card.dataset.id || nameId(card), setsOf(card), restSecs(card));
  }
  var UNIT_SEL_R3 = '.ex-card, .ss-ex, .ex-item';
  function openLogger(card) {
    var wrap = card.querySelector('.mcl-wrap');
    var toggle = card.querySelector('.mcl-toggle');
    if (!wrap || wrap.classList.contains('open')) return;
    wrap.classList.add('open');
    if (toggle) {
      toggle.classList.add('open');
      var lbl = toggle.querySelector('.mcl-lbl');
      if (lbl) lbl.textContent = 'Hide';
    }
  }

  // ---- §3.4 card handoff: find the next not-yet-finished exercise --------
  // Mirrors mc-timer.js's getUpNext() sibling-walk, at the same top-level
  // granularity (.ex-card / .ss-card) — a superset's two .ss-ex legs are
  // nested inside one .ss-card, so promoting "the next exercise" out of a
  // finished .ex-card has to climb out of and back into that structure
  // rather than just walking .nextElementSibling on the logging unit itself.
  function topUnitOf(unit) { return (unit.closest && unit.closest('.ex-card, .ss-card')) || unit; }
  function firstIncompleteLeg(topEl) {
    if (topEl.classList && topEl.classList.contains('ss-card')) {
      var legs = topEl.querySelectorAll('.ss-ex'), i;
      for (i = 0; i < legs.length; i++) { if (!legs[i].__mclDone) return legs[i]; }
      return legs[0] || null;
    }
    return topEl;
  }
  function nextTopUnit(topEl) {
    var n = topEl.nextElementSibling;
    while (n && !(n.classList && (n.classList.contains('ex-card') || n.classList.contains('ss-card')))) {
      n = n.nextElementSibling;
    }
    return n;
  }
  function nextIncompleteUnit(fromCard) {
    var top = topUnitOf(fromCard);
    // A superset's other leg lives inside the SAME top-level unit fromCard
    // just finished — check there before walking to the next position, or
    // finishing leg A always skips straight past leg B.
    var here = firstIncompleteLeg(top);
    if (here && here !== fromCard && !here.__mclDone) return here;
    var next = nextTopUnit(top);
    while (next) {
      var candidate = firstIncompleteLeg(next);
      if (candidate && !candidate.__mclDone) return candidate;
      next = nextTopUnit(next);
    }
    return null;
  }
  // VOC-A2: the cold-start counterpart of nextIncompleteUnit() — instead of
  // walking forward from a just-finished card, find the very first
  // incomplete top-level unit on the page at all, so a fresh visit (no
  // mc_session_v1 record yet — see mc-session.js) can land the athlete on it
  // directly. Reuses firstIncompleteLeg() so a superset's first leg is
  // returned rather than its .ss-card wrapper, exactly as nextIncompleteUnit()
  // already does. On a genuinely fresh page every unit's __mclDone is
  // undefined (rows haven't been checked, so nothing has run updateCount()
  // yet), so in practice this returns the first unit in DOM order — but it
  // stays correct rather than assuming that, in case a future caller invokes
  // it after some cards are already marked done.
  function firstIncompleteUnit() {
    var units = document.querySelectorAll('.ex-card, .ss-card, .ex-item');
    for (var i = 0; i < units.length; i++) {
      var candidate = firstIncompleteLeg(units[i]);
      if (candidate && !candidate.__mclDone) return candidate;
    }
    return null;
  }

  // RPE chip cycle: – → 8 → 8.5 → 9 → 9.5 → 10 → F (to failure) → –
  var RPE_STEPS = ['', '8', '8.5', '9', '9.5', '10', 'F'];

  // ---- parse the prescribed "sets" string --------------------------------
  // ONE resolution, read by both setCount() and repFor(): a prescription
  // becomes an ordered list of per-row rep targets, so the number of logging
  // rows IS that list's length and row i's target IS list[i]. They used to be
  // two independent parsers over the same string, and they disagreed —
  // "25/20/20/15/12" built EIGHT rows, every one asking for 25 reps, for a
  // five-step descending pyramid. Everything downstream inherits this: the
  // "0/N Sets" strip badge, and (through planFor -> plannedSetCount)
  // mc-finish.js's whole-workout total.
  //
  // '/' is overloaded FOUR ways in the authored data, and the order of the
  // branches below is what keeps the two that were always correct correct —
  // the multiplier settles the count before any slash is looked at:
  //
  //   1. "4×10 / 12 per side"       N× multiplier   -> 4 rows  (always right)
  //   2. "4×6, + Cluster 6/6/6"     cluster inner   -> 4 rows  (always right)
  //   3. "12, 12, 10 / 10, 10, 8"   leg separator   -> 3 rows  (was 5)
  //   4. "25/20/20/15/12"           set separator   -> 5 rows  (was 8)
  //
  // See tools/test-mc-setlog-plan.js (every shape pinned) and
  // tools/check-set-schemes.js (the fleet-wide invariants).

  // Everything this parser needs is a FUNCTION DECLARATION, never a `var`
  // initialiser: the Node export hook at the top of this file returns before
  // any statement in the closure body runs, so a `var X = …` would still be
  // undefined when CI calls in. Declarations hoist; assignments do not.

  // A superset is 2 legs and a tri-set is 3 — ks-engine.js's GROUP_SIZE and
  // mc-group-split.js's `tri = names.length >= 3` both say so. The bound
  // matters: it is what separates a leg list from the per-ROUND form
  // "12/12, 10/10, 8/8", where the COMMA is the outer separator and each
  // slash pairs the two legs' reps inside one round. That form has 4 slash
  // segments for 3 rounds, so a leg rule that just counted slashes would get
  // it wrong; raising this bound needs a different discriminator, not a
  // bigger number.
  function maxLegs() { return 3; }
  // A leading number is a SET count only when the prose says so ("4 sets",
  // "3 sets to failure", "4–5 sets"). The same shape carrying a rep or
  // duration unit — "100–200 reps", "30 sec each side", "21s" — prescribes
  // REPS and names no set count at all; reading it as one clamped a
  // hundred-rep finisher into eight logging rows.
  function declaredSets(s) {
    var m = String(s).match(/^\s*(\d+)\s*(?:[–\-—]\s*\d+\s*)?\+?\s*sets?\b/i);
    return m ? Math.min(parseInt(m[1], 10), 12) : null;
  }

  // The rep target one row asks for, read off its own slice of the
  // prescription. It takes the FIRST number, never every digit in the slice
  // run together: a slice routinely carries a second number that is not a rep
  // target at all — a drop or cluster round ("10 + 1× Drop"), a back-off set
  // ("4 + 1× back-off 12 reps"), or the other leg's reps ("12/12") — and
  // concatenating them invented targets like 101, 411 and 121 that appear
  // nowhere in the program. A LEADING multiplier is stripped first, because
  // in "3× Cluster 8 reps" the 3 counts rounds and the 8 is the actual rep
  // target. Guarded fleet-wide by tools/check-set-schemes.js's provenance
  // check: no row may target a number its prescription does not contain.
  function repDigits(r) {
    var s = String(r == null ? '' : r).replace(/^[^\dA-Za-z]*\d+\s*[x×]\s*/i, '');
    var n = s.match(/\d+/);
    return n ? n[0].slice(0, 3) : '';
  }
  function slashSegs(s) {
    return String(s).split('/').map(function (p) { return p.trim(); })
      .filter(function (p) { return p.length; });
  }
  // "G1: … / G2: … / G3: …" (push-pull-legs' giant sets) puts a whole ROUND
  // in each slash segment, so the segment count is the round count however
  // many lifts each round happens to name.
  function roundLabelled(segs) {
    return segs.length > 1 && segs.every(function (p) {
      return /^(?:G|R|Round)\s*\d+\s*[:.]/i.test(p);
    });
  }
  // The fallback rep target for a prescription that carries no per-row list:
  // the reps beside a multiplier ("4×12" -> 12), else the first number.
  function loneRep(s) {
    var x = String(s).match(/[x×]\s*(\d+)/i); if (x) return x[1];
    var n = String(s).match(/(\d+)/); return n ? n[1] : '';
  }
  function fill(n, rep) {
    var out = [], i;
    for (i = 0; i < n; i++) out.push(rep);
    return out;
  }

  function computeRepList(s) {
    if (!s) return ['', '', ''];                    // no information -> 3 rows

    // (1)(2) an N× multiplier states the set count outright, so it wins over
    // every slash rule below — this is why "4×10 / 12 per side" stays 4 rows
    // and a cluster's inner "6/6/6" never becomes rows of its own.
    var mult = String(s).match(/^\s*(\d+)\s*[x×]/i);
    if (mult) return fill(Math.min(parseInt(mult[1], 10), 12), loneRep(s));

    var segs = slashSegs(s);
    if (segs.length > 1) {
      if (roundLabelled(segs)) return fill(segs.length, '');
      var parts = segs.map(function (p) {
        return p.split(',').map(function (x) { return x.trim(); })
          .filter(function (x) { return x.length; });
      });
      var anyList = parts.some(function (p) { return p.length > 1; });

      // (4) no commas anywhere -> the slashes ARE the set separator: an
      // ascending or descending pyramid, one prescribed set per step.
      if (!anyList) return segs.map(repDigits);

      // (3) a comma list on at least one side of the slash -> leg separator.
      // The legs are the SAME rounds performed at two or three stations, so
      // the row count is one leg's, never the sum. It takes the LONGEST leg,
      // which covers three real shapes at once: matched legs ("12, 12, 10 /
      // 10, 10, 8" -> 3), a leg written as a single token beside a full list
      // ("AMRAP / 3, 3, 3", "8, 8 / 2× AMRAP" -> the list's length), and
      // irregular authoring where one leg carries more sets than the other
      // ("10, 8, 20, 15 / 20, 20, 15" -> 4). Showing one spare row is
      // recoverable; silently dropping a prescribed set is not.
      if (segs.length <= maxLegs()) {
        var longest = parts[0], k;
        for (k = 1; k < parts.length; k++) {
          if (parts[k].length > longest.length) longest = parts[k];
        }
        return longest.map(repDigits);
      }
      // Anything else (a lone token beside a real leg, "AMRAP / 3, 3, 3";
      // the per-round form) falls through to the comma split below, which is
      // the outer separator in exactly those cases.
    }

    var c = String(s).split(',');
    if (c.length > 1) return c.map(repDigits);

    var decl = declaredSets(s);
    if (decl != null) return fill(decl, '');
    return fill(3, loneRep(s));
  }

  // Pure over its input, and the same ~530 authored strings recur on every
  // card of every page, so memoise rather than re-parse per row. Callers read
  // the array (length / index) and never mutate it. The cache hangs off the
  // function itself rather than a closure `var` for the hoisting reason above
  // — a `var` initialiser has not run when the Node export hook calls in.
  function repList(s) {
    if (!repList.cache) repList.cache = {};
    // Prefix every key so a prescription can never collide with an inherited
    // Object.prototype member ("constructor" is not a real sets string, but a
    // cache that answers one is a bug waiting for the day something is).
    var key = '§' + (s == null ? '' : String(s));
    var hit = repList.cache[key];
    if (hit) return hit;
    return (repList.cache[key] = computeRepList(s));
  }
  function setCount(s) { return repList(s).length; }
  function repFor(s, i) {
    var L = repList(s);
    if (!L.length) return '';
    return (L[i] != null ? L[i] : L[L.length - 1]) || '';
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
  // folded into the working-set count. Several notations appear across programs:
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
  //   • arrow + repeat×target, trailing   "15, 12, 12 → 3×10"
  //       (Kitchen Sink cluster-round notation: N additional numeric-target
  //       rows tacked on after the base pyramid, e.g. "3 base sets, then 3
  //       cluster micro-sets of 10" — reuses the drop-row machinery below
  //       since a numeric-target extra row is exactly what a drop already is)
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
    // arrow + repeat×target: "15, 12, 12 → 3×10" (Kitchen Sink cluster round) —
    // N additional rows, each targeting the same numeric rep count.
    m = hay.match(/→\s*(\d+)\s*[x×]\s*(\d+)\s*$/i);
    if (m) return finish(m[2], parseInt(m[1], 10));
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
      .replace(/\s*→\s*\d+\s*[x×]\s*\d+\s*$/i, '')
      .replace(/[,+ ]*\+\s*\d+\s*[x×]\s*(?:amrap\b|∞)\s*$/i, '')
      .replace(/[, ]*\bthen\b\s*(?:amrap|∞|\d+)(?:\s*,\s*(?:amrap|∞|\d+))*\s*$/i, '')
      .replace(/[,+ ]*(?:\d+\s*[x×]\s*)?\bdrop\b.*$/i, '')
      .trim();
  }

  // ---- planned row count (S5c-0) -----------------------------------------
  // The number of set rows build() WILL render for a card, derived from the
  // prescription alone — no DOM required. build() calls it too, so the
  // "planned" count and the "built" count are the same expression rather than
  // two copies that can drift.
  //
  // mc-finish.js reads it to size a workout from the program data instead of
  // counting rendered checkboxes. That was never a safe proxy: every day of a
  // multi-day block lives in the DOM at once, so the document-wide count made
  // a finished day on mm-p1.html read "43 / 172 sets" and put the auto-open
  // Finish modal out of reach until all four days were done. It also stops
  // being true at all once loggers are built lazily (A-14).
  //
  // A cluster scheme puts N reps bubbles INSIDE one row, so it never changes
  // the row count — only working sets plus appended drop rows do.
  function planFor(card, setsStr) {
    if (setsStr == null) setsStr = setsOf(card);
    var nmEl = card.querySelector('.ex-name, .ss-name, .lift-name, .var-name');
    var drop = parseDrop(nmEl ? nmEl.textContent : '', setsStr);
    var work = drop.is ? stripDrop(setsStr) : setsStr;
    var n = setCount(work);
    var nd = drop.is ? drop.drops.length : 0;   // number of appended drop rows
    return { nmEl: nmEl, drop: drop, work: work, n: n, nd: nd, total: n + nd };
  }
  function plannedSetCount(card) {
    try { return planFor(card).total; } catch (e) { return 0; }
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
    var rEl = row.querySelector('.mcl-r:not(.mcl-rmini)');
    if (ck.classList.contains('done')) {
      ck.classList.remove('done'); ck.textContent = '☐'; ck.setAttribute('aria-checked', 'false');
      row.classList.remove('done-row');
      updateCount(card, exId);
      // A-10: unchecking re-opens the row for edits, so it is typed-but-
      // unconfirmed again — re-arm the pending snapshot from whatever is in
      // the fields right now, same as if it had never been checked.
      setPending(exId, sn, w ? w.value.trim() : '', rEl ? rEl.value.trim() : '');
      return;
    }
    var rpeEl = row.querySelector('.mcl-rpe');
    var wVal = w ? w.value.trim() : '';
    var rVal = clusterRVal(row);
    var rpeVal = rpeEl ? (rpeEl.dataset.rpe || '') : '';
    save(exId, sn, wVal, rVal, rpeVal);
    // Now committed for real — checking always solidifies a ghosted
    // suggestion (typing is not required), and the pending draft is
    // superseded by the real entry mc_setlog_v1 now holds.
    Array.prototype.forEach.call([w, rEl], function (inp) {
      if (inp && inp.dataset.ghost) { inp.classList.remove('mcl-ghost'); delete inp.dataset.ghost; }
    });
    clearPending(exId, sn);
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
        // Local high-water mark first (A-9) — a real network call only on
        // this exercise's first checked set THIS page load; every later one
        // this session is a synchronous cache read.
        var prevMaxP = wNum ? localMaxP(exName) : Promise.resolve(null);
        prevMaxP.then(function (prevMax) {
          MC_SB.logSet(logEntry).then(function () {
            // PR detected: new weight beats a REAL historical max (audit G-03).
            // prevMax === null does not mean "no record to beat" — getMaxWeight()
            // returns null for three different situations: no Supabase client,
            // nobody signed in, and genuinely no history for this exercise. The
            // old `prevMax === null ||` read all three as a PR, so every first
            // logged set of every exercise fired "your best lift ever" — about
            // ten of them in a new user's first session, which is how a
            // celebration turns into noise people mute. A first log is a
            // baseline, not a record: require a known previous max to beat.
            if (wNum && prevMax !== null && wNum > prevMax && MC_SB.sendPush) {
              MC_SB.sendPush({
                title: '🏆 New PR — ' + exName + '!',
                body: wNum + ' lbs — your best lift ever. Keep pushing!'
              }).catch(function () {});
            }
            noteMax(exName, wNum);
          }).catch(function () {});
        }).catch(function () {
          MC_SB.logSet(logEntry).catch(function () {});
        });
      }
    } catch (e) {}
    ck.classList.add('done'); ck.textContent = '✓'; ck.setAttribute('aria-checked', 'true');
    row.classList.add('done-row');
    // Light confirming tap on check.
    MC_HAPTICS.tap();
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
    var allDone = done > 0 && done === rows.length;
    el.classList.toggle('done', allDone);
    // Logging every set is itself completion — mirror it onto the card's
    // .checked class so every consumer that already reads .checked (session
    // progress bar, live-summary %, activity log) picks it up without the
    // athlete also needing to tap the whole card as a separate gesture.
    card.classList.toggle('checked', allDone);

    var stripCount = card.querySelector('.mcl-strip-count-' + cid);
    if (stripCount) stripCount.textContent = done + '/' + rows.length + ' Sets';
    // R3: the strip is every card's resting state now, so it has to show
    // whether this one is actually finished rather than always looking done.
    var stripEl = card.querySelector('.mcl-strip');
    if (stripEl) {
      stripEl.classList.toggle('is-done', allDone);
      var dotEl = stripEl.querySelector('.mcl-strip-dot');
      if (dotEl) {
        var idxEl2 = card.querySelector('.a-idx');
        var want = allDone ? '✓' : ((idxEl2 && idxEl2.textContent.trim()) || '•');
        if (dotEl.textContent !== want) dotEl.textContent = want;
      }
      // The strip carries an aria-label, and a label OVERRIDES the element's
      // own text for assistive tech — so the '3/5 Sets' span inside it is not
      // announced. Harmless while the strip only ever meant "finished"; under
      // R3 it is the resting state of every card and progress is the whole
      // point of it, so the label has to carry the count itself.
      var wantLbl = 'Expand ' + (stripEl.querySelector('.mcl-strip-name') || {}).textContent
                  + ', ' + done + ' of ' + rows.length + ' sets logged';
      if (stripEl.getAttribute('aria-label') !== wantLbl) stripEl.setAttribute('aria-label', wantLbl);
    }
    var toggleEl = card.querySelector('.mcl-toggle');
    if (toggleEl) toggleEl.classList.toggle('mcl-alldone', allDone);

    var wasDone = !!card.__mclDone;
    card.__mclDone = allDone;
    if (allDone && !wasDone) {
      clearTimeout(card.__mclCollapseTimer);
      // §3.4 card handoff: collapse the just-finished card, then promote
      // whichever exercise is next in the day so the athlete's next tap is
      // already where they need it — the "auto-open" half of A-11 doing its
      // real work for the first time, since every OTHER setActiveCard()
      // caller only fires on a wrap the athlete already opened by hand.
      card.__mclCollapseTimer = setTimeout(function () {
        var next = nextIncompleteUnit(card);
        // Collapsing is setActiveCard's job now, and it collapses everything
        // outside the NEXT exercise's group. That distinction is the whole
        // point: finishing leg A of a superset does not end the block, so A
        // must stay open while the athlete works leg B — the old
        // unconditional collapse here closed A and setActiveCard(B) reopened
        // it a frame later. With nothing left to promote there is no group to
        // belong to, so the finished card collapses on its own.
        if (!next) { setCollapsed(card, true); return; }
        setActiveCard(next);
        try {
          var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
          next.scrollIntoView(reduced ? { block: 'nearest' } : { behavior: 'smooth', block: 'nearest' });
        } catch (e) {}
      }, 600);
    } else if (wasDone && !allDone) {
      // Unchecking a set on a FINISHED card re-expands it — the checkboxes
      // have to be visible to uncheck another one. Guarded on the
      // done->not-done transition (wasDone), not on !allDone alone: under R3
      // every card is collapsed at rest, so the old unguarded form re-expanded
      // all ten of them on every updateCount() pass.
      clearTimeout(card.__mclCollapseTimer);
      membersOf(card).forEach(function (m) { setCollapsed(m, false); });
    } else if (!allDone) {
      clearTimeout(card.__mclCollapseTimer);
    }
  }
  function cssId(id) { return String(id).replace(/[^a-zA-Z0-9_-]/g, '_'); }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ---- auto-collapse to a compact strip once every set is done -----------
  // Fires only on the false->true transition of "all sets done" (tracked via
  // card.__mclDone), never on every updateCount() pass — so an athlete who
  // reopens an already-finished card to tweak an RPE isn't fought by the
  // timer re-collapsing it out from under them. Unchecking a set (allDone
  // flips back to false) force-expands immediately and cancels any pending
  // auto-collapse, since the checkboxes have to be visible to uncheck one.
  function setCollapsed(card, val) {
    card.classList.toggle('mcl-collapsed', val);
    var strip = card.querySelector('.mcl-strip');
    if (strip) strip.setAttribute('aria-expanded', String(!val));
  }

  // ---- A-14: split the collapsed strip from the expensive logger body ----
  // build() used to do both in one pass, for every card on the page, even
  // though R3 already collapses every card but one to a 71px strip — a
  // multi-day page built the full per-set <input> markup (ghost-fill, two
  // localStorage history reads per row, blur/input listeners) for cards
  // nobody had opened yet. buildStrip() is the cheap part every card still
  // gets eagerly (the 0/N badge has to read correctly at rest); buildRows()
  // is the expensive part, now built only when a card is actually activated
  // (see setActiveCard() and MCSetlogUtil.ensureRowsBuilt below). build()
  // itself stays as a "do both" entry point, unchanged for callers that
  // still want the old eager behavior — run() keeps using it for superset
  // legs (see run(), and the note there on why supersets stay eager).
  function buildStrip(host, card, exId, setsStr, rs) {
    if (!host) return;
    // Strip any OTHER wave3 logger / notes UI EVERY pass (before the early
    // return), so page-native scripts that re-add their UI after us (e.g.
    // pmc-workout's .ex-notes) don't win the race. Runs here (not in
    // buildRows) so it still happens for every card every pass, not just
    // whichever one is currently active.
    /* MARKET:STRIP influencer-refs START */
    // NOTE: we deliberately do NOT strip .set-row — that is PSU's native
    // exercise content, not a stray logger.
    /* MARKET:STRIP influencer-refs END */
    Array.prototype.forEach.call(
      host.querySelectorAll('.setlog-toggle, .setlog-wrap, .note-btn, .note-area, .ex-notes-toggle, .ex-notes-wrap, .log-row'),
      function (n) { n.remove(); }
    );
    if (card.querySelector('.mcl-strip')) return;   // ours already present

    var cid = cssId(exId);
    var plan = planFor(card, setsStr);
    var nmEl = plan.nmEl;
    var exNameText = nmEl ? nmEl.textContent.trim() : 'Exercise';
    var total = plan.total;

    // ---- collapsed-strip view ---------------------------------------------
    // Appended as a sibling of `host` (i.e. a direct child of `card` itself,
    // whether or not host === card) rather than inside it, so a single CSS
    // rule keyed off `card` — "hide every direct child except .mcl-strip" —
    // hides the ENTIRE original card content (name/badges/reps/timer/notes/
    // logger) in one shot, on every template shape this file renders onto
    // (single .ex-body wrapper, bare .ss-ex/.ex-item children, etc.) with no
    // per-page markup change required. See mc-setlog.css .mcl-collapsed.
    var strip = document.createElement('button');
    strip.type = 'button';
    strip.className = 'mcl-strip';
    strip.setAttribute('aria-expanded', 'false');
    strip.setAttribute('aria-label', 'Expand ' + exNameText + ', 0 of ' + total + ' sets logged');
    // R3: the dot carries the exercise's position while the card is
    // unstarted, and updateCount() swaps it for a ✓ once every set is
    // logged. It used to be a hard-coded ✓ because the strip only ever
    // appeared on finished cards.
    var idxEl = card.querySelector('.a-idx');
    var idxTxt = idxEl ? idxEl.textContent.trim() : '';
    strip.innerHTML =
      '<span class="mcl-strip-dot" aria-hidden="true">' + escHtml(idxTxt || '•') + '</span>' +
      '<span class="mcl-strip-name">' + escHtml(exNameText) + '</span>' +
      '<span class="mcl-strip-count mcl-strip-count-' + cid + '">0/' + total + ' Sets</span>' +
      '<span class="mcl-strip-chev" aria-hidden="true">›</span>';
    strip.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      clearTimeout(card.__mclCollapseTimer);
      // Tapping a strip promotes that exercise — which collapses whichever
      // card was expanded (setActiveCard also builds its rows under A-14).
      setActiveCard(card);
    });
    card.appendChild(strip);
    // R3: a freshly built card rests collapsed unless it is the one the
    // athlete is already on. Guarded on first build only (__mclR3Init) so a
    // later re-render pass never re-collapses a card mid-set.
    if (!card.__mclR3Init) {
      card.__mclR3Init = true;
      if (!card.classList.contains('active')) setCollapsed(card, true);
    }
  }

  // ---- render the full per-set logger onto a host element ----------------
  // The expensive half: history reads, ghost-fill, one <input> row per
  // prescribed set. Idempotent (checks .mcl-wrap) and safe to call whether
  // or not buildStrip() already ran for this card.
  function buildRows(host, card, exId, setsStr, rs) {
    if (!host) return;
    buildStrip(host, card, exId, setsStr, rs);
    if (host.querySelector('.mcl-wrap')) return;   // ours already present

    var cid = cssId(exId);

    // Separate the WORKING sets from any appended drop set so the drop is never
    // folded into (and garbling) the working-set rows. See parseDrop/stripDrop.
    var plan = planFor(card, setsStr);
    var nmEl = plan.nmEl;
    var exNameText = nmEl ? nmEl.textContent.trim() : 'Exercise';
    var drop = plan.drop;
    var work = plan.work;
    var n = plan.n;
    var nd = plan.nd;                           // number of appended drop rows
    var total = plan.total;
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

    // Manual collapse control — only visible once mcl-alldone is set on this
    // toggle (updateCount()), i.e. after every set is logged. Lets an athlete
    // who reopened a finished card (e.g. to tweak an RPE) shrink it back down
    // themselves instead of waiting for the auto-collapse, which only fires
    // once, on the moment the LAST set gets checked.
    var collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'mcl-collapse-btn';
    collapseBtn.setAttribute('aria-label', 'Collapse ' + exNameText);
    collapseBtn.textContent = 'Collapse';
    collapseBtn.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      clearTimeout(card.__mclCollapseTimer);
      setCollapsed(card, true);
    });
    toggle.appendChild(collapseBtn);

    var wrap = document.createElement('div');
    wrap.className = 'mcl-wrap';
    // R2: the column-header row (SET/WEIGHT/REPS/RPE) was deleted — 23px on
    // every card, times every exercise on the page. The row-number divs
    // (1, 2, 3…) already read as "set" positionally, the RPE chip carries
    // its own descriptive title attribute, and the weight/reps inputs' own
    // placeholder text ("lb" / "reps" when nothing else fills it) already
    // does the labeling job the header row was duplicating — "the inputs'
    // own placeholders, which is where a mobile form puts them anyway."
    var html = '';
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

      // A-10 + ghost prefill (§3.3): a typed-but-unchecked value left over
      // from before an interrupted reload is REAL and wins outright. Failing
      // that, the suggested fill above (last session's weight / the
      // prescribed-or-last reps) is shown AS the field's value rather than
      // only as a placeholder, marked .mcl-ghost so it reads as "suggested,
      // not yet confirmed" (see mc-setlog.css) — tapping ✓ commits it exactly
      // as typed, same as any other value. Drop-row reps are a task label
      // (AMRAP / a numeric target), not history, so they are never ghosted —
      // ghosting a target as if it were "what you did last time" would lie.
      var pend = getPending(exId, sn);
      var wValue = (pend && pend.w) ? pend.w : wFill;
      var wGhost = !(pend && pend.w) && wValue !== '';
      var rValue = (pend && pend.r) ? pend.r : (isDropRow ? '' : rFill);
      var rGhost = !(pend && pend.r) && !isDropRow && rValue !== '';

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
        repsCellHtml = '<input class="mcl-inp mcl-r' + (rGhost ? ' mcl-ghost' : '') + '" type="number" inputmode="numeric" placeholder="' + rPh + '"' +
          (rValue !== '' ? ' value="' + rValue + '"' : '') +
          (rFill !== '' ? ' data-fill="' + rFill + '"' : '') +
          (rGhost ? ' data-ghost="1"' : '') + '>';
      }

      html += '<div class="mcl-row' + (isDropRow ? ' mcl-row-amrap' : '') + '" id="mclr-' + cid + '-' + sn + '">' +
                '<div class="mcl-num">' + (isDropRow ? '↓' : sn) + '</div>' +
                '<input class="mcl-inp mcl-w' + (wGhost ? ' mcl-ghost' : '') + '" type="number" inputmode="decimal" placeholder="' + wPh + '"' +
                  (wValue !== '' ? ' value="' + wValue + '"' : '') +
                  (wFill !== '' ? ' data-fill="' + wFill + '"' : '') +
                  (wGhost ? ' data-ghost="1"' : '') + '>' +
                repsCellHtml +
                '<div class="mcl-rpe' + (rpe ? ' set' : '') + '" data-rpe="' + rpe + '" ' +
                  'title="Rate of Perceived Exertion — tap to cycle, F = to failure">' + (rpe || '–') + '</div>' +
                '<button type="button" class="mcl-ck set-check" role="checkbox" aria-checked="false" ' +
                  'aria-label="Set ' + sn + '" data-sn="' + sn + '">☐</button>' +
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
    // A ghosted input already carries that value (as its real, visible
    // value — see the row-build loop above), so this only fires for the
    // legacy placeholder-only cases (cluster mini-set bubbles, or a row with
    // no suggestion at all) — it never fights the ghost's own focus-select.
    Array.prototype.forEach.call(wrap.querySelectorAll('.mcl-inp'), function (inp) {
      inp.addEventListener('focus', function () {
        setActiveCard(card);
        if (!inp.value.trim() && inp.dataset.fill) {
          inp.value = inp.dataset.fill;
          try { inp.select(); } catch (e) {}
        }
      });
    });
    // A-10 + ghost prefill wiring (§3.3). A ghost value is a SUGGESTION, not
    // something the athlete typed: focusing it selects the text (one tap,
    // then either type to override or just check to accept), and the first
    // keystroke solidifies it — loses .mcl-ghost the instant it stops being
    // exactly the suggested number. Persistence only ever touches real,
    // athlete-confirmed text: a still-ghosted field is never written to the
    // pending store, which is the whole point of doing this before A-10
    // rather than after — a prefill the athlete never touched must not
    // survive a reload disguised as something they typed.
    Array.prototype.forEach.call(wrap.querySelectorAll('.mcl-w, .mcl-r:not(.mcl-rmini)'), function (inp) {
      if (inp.dataset.ghost) {
        inp.addEventListener('focus', function () { try { inp.select(); } catch (e) {} }, { once: true });
      }
      inp.addEventListener('input', function () {
        if (inp.dataset.ghost) { inp.classList.remove('mcl-ghost'); delete inp.dataset.ghost; }
      });
      inp.addEventListener('blur', function () {
        var row = inp.closest('.mcl-row');
        if (!row) return;
        var ckEl = row.querySelector('.mcl-ck');
        if (ckEl && ckEl.classList.contains('done')) return;   // already committed via onCheck
        var ckSn = parseInt(ckEl && ckEl.dataset.sn, 10);
        if (!ckSn) return;
        var wEl = row.querySelector('.mcl-w'), rEl2 = row.querySelector('.mcl-r:not(.mcl-rmini)');
        var wv = (wEl && !wEl.dataset.ghost) ? wEl.value.trim() : '';
        var rv = (rEl2 && !rEl2.dataset.ghost) ? rEl2.value.trim() : '';
        setPending(exId, ckSn, wv, rv);
      });
    });
    // Carry-down: typing set 1's weight updates the fill/placeholder of every
    // later still-empty working set (drop rows excluded — weight is stripped).
    // A ghosted later set is still just a suggestion the athlete has not
    // touched, so it counts as "empty" here too — carry-down overwrites the
    // stale ghost with today's number and keeps it ghosted, since it is
    // still unconfirmed either way. A real (pending or already-typed) value
    // is never touched.
    var wInputs = Array.prototype.slice.call(
      wrap.querySelectorAll('.mcl-row:not(.mcl-row-amrap) .mcl-w'));
    wInputs.forEach(function (inp, idx) {
      inp.addEventListener('input', function () {
        var v = inp.value.trim();
        if (!v) return;
        for (var j = idx + 1; j < wInputs.length; j++) {
          var nxt = wInputs[j];
          if (!nxt.value.trim() || nxt.dataset.ghost) {
            nxt.placeholder = v + ' lb'; nxt.dataset.fill = v;
            nxt.value = v; nxt.classList.add('mcl-ghost'); nxt.dataset.ghost = '1';
          }
        }
      });
    });

    host.appendChild(toggle);
    host.appendChild(wrap);
    // Strip creation lives in buildStrip() now, called at the top of this
    // function — nothing left to do here once the rows are appended.
  }

  // Combined "do both phases now" entry point — unchanged contract for any
  // caller that wants the old fully-eager behavior (run() uses it for
  // superset legs; see run() below for why they stay eager rather than lazy).
  function build(host, card, exId, setsStr, rs) {
    buildStrip(host, card, exId, setsStr, rs);
    buildRows(host, card, exId, setsStr, rs);
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
  // Per-pass occurrence index. nameId() used to issue a document-wide
  // querySelectorAll — and then slugOf() every result — once PER CARD, purely
  // to learn how many earlier cards share this card's slug. That is O(n²) over
  // the page, re-run on every observer pass, and it was one of the two biggest
  // consumers of main-thread time during a rest period. The answer is identical
  // for every card in a single pass, so compute it once and look it up.
  // Invalidated at the top of run(); nothing else can change the DOM mid-pass.
  var _nameIdx = null;
  function buildNameIdx() {
    var map = new Map(), counts = Object.create(null);
    var all = document.querySelectorAll('.ex-name, .ss-name, .lift-name');
    for (var i = 0; i < all.length; i++) {
      var base = slugOf(all[i]);
      var occ = counts[base] || 0;
      counts[base] = occ + 1;
      map.set(all[i], 'x-' + base + (occ ? '-' + occ : ''));
    }
    return { map: map, counts: counts };
  }
  // Deterministic id from the original exercise name (NO random fallback — that
  // would change every pass, breaking persistence and re-rendering forever).
  // Duplicate names are disambiguated by their occurrence order in the DOM.
  function nameId(card) {
    var mine = card.querySelector('.ex-name, .ss-name, .lift-name');
    if (!_nameIdx) _nameIdx = buildNameIdx();
    var hit = _nameIdx.map.get(mine);
    if (hit) return hit;
    // Name element is not in the document (detached card, or one added since
    // the index was built). The old loop never hit its break in that case and
    // fell through with occ === the total count of matching slugs; preserve
    // that exactly rather than quietly changing an id that may be persisted.
    var base = slugOf(mine);
    var n = _nameIdx.counts[base] || 0;
    return 'x-' + base + (n ? '-' + n : '');
  }

  // ---- K-3.3/G-08: last-3-session micro-trend on the card header ---------
  // Progression at the point of the load decision (the day's card list),
  // not buried behind the meatball's full trend sheet. Reuses this file's
  // OWN store read (st()) and history key (ek()) — mc-suggest.js has a
  // near-identical completedSessions()/historyKey() pair, but it's private
  // to that file's IIFE, not exported, so this is a deliberate small
  // duplicate rather than a cross-module reach (same reasoning as
  // mc-cond-suggest.js's local copy of workoutInProgress()).
  // A-2/S1: one localStorage read per run() pass, not one per card. The
  // first cut of this called st() straight from trendFor() per-card, which
  // the K-3.1 perf budget caught immediately (storageReads 17 -> 83 on one
  // of its probe pages, well past its 1.5x ceiling) — the exact per-card-
  // storage-read shape S1 spent this whole roadmap eliminating.
  var _stCache = null;
  function trendFor(exId) {
    var hist = (_stCache || (_stCache = st()))[ek(exId)] || [];   // newest-first, capped at 5
    var today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var tops = [];
    for (var i = 0; i < hist.length && tops.length < 3; i++) {
      var sess = hist[i];
      if (!sess || sess.d === today || !sess.sets) continue;   // skip today's in-progress session
      var weights = Object.keys(sess.sets).map(function (k) {
        return parseFloat(sess.sets[k].w) || 0;
      }).filter(Boolean);
      if (!weights.length) continue;                // bodyweight/unweighted session
      tops.push(Math.max.apply(null, weights));
    }
    if (tops.length < 2) return null;                // need 2 sessions for a direction
    var latest = tops[0], prior = tops[1];
    var arrow = latest > prior ? '↑' : (latest < prior ? '↓' : '→');
    return { arrow: arrow, weight: latest };
  }

  function injectTrend(card, exId) {
    var nameEl = card.querySelector('.ex-name, .ss-name, .lift-name');
    // Never write inside nameEl itself — origNameOf()/slugOf() read its
    // textContent as the exercise's identity for history-key + Supabase
    // lookups, and this file's own nameId() depends on that staying exactly
    // the authored name. The badge is a SIBLING, never a child.
    if (!nameEl || !nameEl.parentNode) return;
    var t = trendFor(exId);
    var el = nameEl.nextElementSibling;
    if (!(el && el.classList && el.classList.contains('a-trend'))) el = null;
    if (!t) { if (el) el.parentNode.removeChild(el); return; }
    var dir = t.arrow === '↑' ? 'up' : (t.arrow === '↓' ? 'down' : 'flat');
    var label = t.arrow + ' ' + t.weight + ' lb';
    if (el && el.textContent === label) return;      // A-2: write only on change
    if (!el) {
      el = document.createElement('div');
      nameEl.parentNode.insertBefore(el, nameEl.nextSibling);
    }
    el.className = 'a-trend a-trend-' + dir;
    el.textContent = label;
    el.setAttribute('aria-label', 'Weight trend versus last session: ' + label);
  }

  function run() {
    _nameIdx = null;                            // one index per pass
    _stCache = null;                            // one storage read per pass (K-3.3)
    // Match cards WITH OR WITHOUT data-id. Older templates
    /* MARKET:STRIP influencer-refs START */
    // (STNDR push-pull-legs, PSU psu-strength, weeks-to-open, legacy-prep,
    // s4-*, most of pmc-workout)
    /* MARKET:STRIP influencer-refs END */
    // render .ex-card/.lift-card with no data-id, so a data-id-only selector
    // silently skipped them. Fall back to a stable id derived from the name.
    // A-14: plain units build their strip eagerly (cheap — the 0/N badge has
    // to read right at rest) but their expensive per-set rows only when
    // active — a fresh page starts with nothing active, so nothing beyond
    // the strips gets built until the trainee (or a restored session, or
    // VOC-A2's cold-start auto-open) actually opens one via setActiveCard(),
    // which calls MCSetlogUtil.ensureRowsBuilt(). A card already marked
    // .active from an earlier pass (e.g. this run() re-firing after a DOM
    // mutation elsewhere on the page) keeps its rows built here too, rather
    // than relying on setActiveCard() having been the one to trigger it.
    document.querySelectorAll('.ex-card').forEach(function (c) {
      /* MARKET:STRIP influencer-refs START */
      // host varies by template: .ex-content (PMC/MC), .ex-body (STNDR), else card
      /* MARKET:STRIP influencer-refs END */
      var host = c.querySelector('.ex-content') || c.querySelector('.ex-body') || c;
      var exId = c.dataset.id || nameId(c), setsStr = setsOf(c), rs = restSecs(c);
      buildStrip(host, c, exId, setsStr, rs);
      if (c.classList.contains('active')) buildRows(host, c, exId, setsStr, rs);
      injectTrend(c, exId);
    });
    // Superset legs stay fully eager (build(), both phases) — excluded from
    // A-14's lazy scope. mc-superset-hop.js's leg-cycling (hasUndoneSet())
    // reads a leg's .mcl-ck directly to decide whether it still has work
    // left; an unbuilt leg reads as "nothing left to do" and gets skipped,
    // which is the exact "handoff skips the second leg" bug S3 already fixed
    // once. Supersets are a small fraction of a page's cards, not the source
    // of the multi-day boot-cost problem A-14 targets, so excluding them
    // trades a small amount of the win for zero risk to that engine.
    document.querySelectorAll('.ss-ex').forEach(function (c) {
      // Read the prescribed rest from the exercise's own .rest-timer (data),
      // not a hardcoded value — fallback 90s. The superset normalizer below
      // then keeps a single timer on the SECOND row and parks it under the logger.
      var exId = c.dataset.id || nameId(c);
      build(c.querySelector('.ss-content') || c.querySelector('.ex-body') || c, c, exId, setsOf(c), restSecs(c) || 90);
      injectTrend(c, exId);
    });
    document.querySelectorAll('.ex-item').forEach(function (c) {
      var exId = c.dataset.id || nameId(c), setsStr = setsOf(c), rs = restSecs(c);
      buildStrip(c, c, exId, setsStr, rs);
      if (c.classList.contains('active')) buildRows(c, c, exId, setsStr, rs);
      injectTrend(c, exId);
    });
    /* MARKET:STRIP influencer-refs START */
    // NOTE: .lift-card (PSU) has no dedicated handler of its own here — it
    // doesn't need one. K-1.5/G-04 migrated psu-strength.html's loggable
    // lifts onto this engine by adding .ex-card alongside .lift-card, so
    // they're already picked up by the .ex-card loop above; .lift-name /
    // .lift-meta are pre-existing selectors this file reads directly
    // (origNameOf/planFor/setsOf/trySupabasePrefill), and nameId()'s
    // fallback for cards with no data-id already named PSU explicitly (see
    // run()'s top comment) — this used to be a real native-logger page
    // (.set-row: Set 1/2/3 with reps+weight+checkbox, kept deliberately
    // unhandled here to avoid a duplicate logger) but that native UI is gone
    // now; only its `header`/`pick`-type informational cards (no .ex-card
    // class) still render with no logger, by design.
    /* MARKET:STRIP influencer-refs END */
    normalizeSupersetTimers();
    collapseNotes();
    _nameIdx = null;                            // index is pass-scoped only
    _stCache = null;                            // cache is pass-scoped only
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

  // Derives exId the same way run() does (card.dataset.id || nameId(card)) and
  // runs the full updateCount() derivation for that card — badge text, the
  // .checked mirror, the collapsed-strip count, .mcl-alldone, and the
  // auto-collapse timer. Exposed for mc-session.js#restoreSets() (A-7): a
  // reload writes .done directly onto restored rows without going through
  // onCheck(), so none of the above ever ran for a restored card without
  // this being called afterward.
  function updateCountByCard(card) {
    if (!card) return;
    updateCount(card, card.dataset.id || nameId(card));
  }

  // shared parsing helpers for mc-suggest.js (and future analytics) — avoids
  // re-implementing the prescribed-scheme parser anywhere else
  window.MCSetlogUtil = {
    setCount: setCount, repFor: repFor, pid: PID, histKey: ek,
    updateCountByCard: updateCountByCard,
    sessionId: SESSION_ID,   // A-5: lets mc-finish.js purge exactly this
                              // page-load's Supabase workout_logs rows on discard
    activateCard: setActiveCard,  // §3.4: lets mc-session.js re-open the card
                                    // the athlete was on when a session restores
    plannedSetCount: plannedSetCount,  // S5c-0: lets mc-finish.js size a workout
                                    // from the prescription, not from rendered
                                    // checkboxes (see planFor above)
    ensureRowsBuilt: ensureRowsBuilt,  // A-14: lets mc-session.js build a specific
                                    // card's rows before restoring checks onto it
    firstIncompleteUnit: firstIncompleteUnit  // VOC-A2: lets mc-session.js find
                                    // where to land a genuinely fresh visit
  };

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

  // ---- init (A-13) --------------------------------------------------------
  // Was: run(), then a [250,700,1500,2600] retry ladder, then a PRIVATE
  // body-scoped MutationObserver. Nine modules each carried their own copy of
  // that belt-and-braces pair, because nothing told them when a page's cards
  // were actually rendered — ~31 speculative whole-page passes at boot across
  // the fleet, and nine observers waking on every DOM change forever after.
  //
  // program-overrides.js already publishes exactly the signal that was
  // missing: MC_SCAN, ONE shared, debounced body observer with subscribe() /
  // schedule() / withoutObserver(). Subscribing to it replaces both the
  // ladder and the private observer, and MC_SCAN.schedule() is the explicit
  // "cards just rendered" announcement a lazy build (A-14) makes rather than
  // waiting on an observer round-trip.
  //
  // The fallback branch is real, not defensive boilerplate: run-program.html
  // renders exercise cards but does not load program-overrides.js, so MC_SCAN
  // genuinely is absent there. One deferred pass replaces the four-step
  // ladder in that branch too.
  function init() {
    if (window.MC_SCAN && MC_SCAN.subscribe) {
      MC_SCAN.subscribe(run); MC_SCAN.start(); MC_SCAN.schedule();
    } else {
      var mo = new MutationObserver(function () { clearTimeout(init._t); init._t = setTimeout(run, 120); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(run, 600);
    }
    run();
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
