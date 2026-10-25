/* ==========================================================================
   mc-log-read.js — the ONE reader for mc_workout_log_v1 (FIX-04, audit L-03)
   --------------------------------------------------------------------------
   Six modules carried the same five-line reader:

     function logs() {
       try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]') || []; }
       catch (e) { return []; }
     }

   and all six had the same hole. try/catch catches malformed TEXT. It does
   not catch valid JSON of the wrong SHAPE, which is what actually reaches
   these modules: an object where an array belongs (`all.forEach is not a
   function`) or an array carrying a null member (`Cannot read properties of
   null`). The stats page, the history page and the dashboard each threw and
   rendered half a screen. Deliberately corrupting four stores at once with
   malformed text produced no errors anywhere — every crash found in three
   passes of audit came through this narrower door.

   So the reader is total: anything that is not an array of objects comes back
   as an empty array, and a bad member is dropped rather than handed on.
   `readWorkoutLog` is registered in tools/check-single-impl.js, so a seventh
   copy cannot appear — including a byte-identical one, since a duplicate that
   agrees today is exactly how six divergent variants came to exist before.

   Load order: this file has no dependencies and every consumer calls it at
   runtime, not at parse time, so its tag only has to be on the same page.

   It also owns the DAY KEY (FIX-06, roadmap Phase 5.1) — see the block above
   the window export. That lives here rather than in mc-setlog.js for one
   practical reason: mc-setlog.js, mc-sync.js, mc-suggest.js, mc-finish.js and
   mc-live-tracker.js all need it, and this is the only one of the six that is
   both a plain <script> on every page that logs sets AND require()-able from
   Node, so the browser and the vm-sandboxed suites read the same code.
   ========================================================================== */
(function () {
  var WL_KEY = 'mc_workout_log_v1';

  function readWorkoutLog() {
    var v;
    try { v = JSON.parse(localStorage.getItem(WL_KEY) || '[]'); }
    catch (e) { return []; }                     // malformed text
    if (!Array.isArray(v)) return [];            // valid JSON, wrong type
    return v.filter(function (e) {               // null / primitive members
      return e && typeof e === 'object';
    });
  }

  // A finished session's own set list has the same problem one level down:
  // entry.sets is whatever was written, and every consumer iterates it.
  function readSets(entry) {
    var s = entry && entry.sets;
    if (!Array.isArray(s)) return [];
    return s.filter(function (x) { return x && typeof x === 'object'; })
      .map(function (x) {
        if (!isKeyName(x.name)) return x;
        // A legacy entry: hand back a copy, never the stored object, so no
        // reader can write the resolved name into the log by accident.
        var c = {}, f;
        for (f in x) c[f] = x[f];
        c.key = x.key || x.name;
        c.name = setName(x);
        return c;
      });
  }

  // ---- a finished set's readable name (flagship readiness R4 / D-11) -----
  // mc-finish.js banked each set under the history key's segment
  // ("x-incline-db-press") and every screen showed it as the name: History,
  // the detail page, the recap. Muscle attribution classified the key rather
  // than the lift, and drifted on 187 of 580 catalog exercises (D-13). New
  // entries carry the real name, plus the key as `key`. Old ones are resolved
  // here, on read, so every reader that goes through readSets() gets the
  // name with no change of its own — the way FIX-06 dated the day key in the
  // read path rather than in eight comparison sites.
  //
  // Resolution, best first: the exact catalog name whose history key is this
  // one, when the catalog is on the page and exactly one name maps to it;
  // otherwise the key spelled back out, with the abbreviations this app's
  // names use restored to capitals. A key two catalog names share is never
  // guessed at — it is spelled out, which is legible and claims nothing.
  function isKeyName(n) { return typeof n === 'string' && /^x-[a-z0-9]/.test(n); }
  var _catIdx = null, _catLen = -1;
  function catalogIndex() {
    var cat = (typeof window !== 'undefined' && Array.isArray(window.EXERCISES)) ? window.EXERCISES : null;
    if (!cat) return null;
    if (_catIdx && _catLen === cat.length) return _catIdx;
    var idx = Object.create(null);
    cat.forEach(function (e) {
      if (!e || typeof e.name !== 'string') return;
      var full = e.name.trim().replace(/\s+/g, '-').toLowerCase();
      // both key generations: the 24-character legacy slug and the full one
      [full, full.slice(0, 24)].forEach(function (k) {
        if (!(k in idx)) idx[k] = e.name;
        else if (idx[k] !== e.name) idx[k] = null;   // shared — do not guess
      });
    });
    _catIdx = idx; _catLen = cat.length;
    return idx;
  }
  var ABBR = { db: 'DB', bb: 'BB', ez: 'EZ', kb: 'KB', bw: 'BW', rdl: 'RDL', ohp: 'OHP',
               sl: 'SL', ssb: 'SSB', trx: 'TRX', amrap: 'AMRAP' };
  function spellKey(base) {
    return base.split('-').filter(Boolean).map(function (w) {
      return ABBR[w] || (w.charAt(0).toUpperCase() + w.slice(1));
    }).join(' ');
  }
  function setName(s) {
    var n = s && s.name;
    if (!isKeyName(n)) return typeof n === 'string' ? n : '';
    var base = n.slice(2);
    var idx = catalogIndex();
    if (idx) {
      if (idx[base]) return idx[base];
      var bare = base.replace(/-\d+$/, '');          // duplicate-occurrence suffix
      if (bare !== base && idx[bare]) return idx[bare];
    }
    return spellKey(base.replace(/-\d+$/, '')) || n;
  }

  // ---- reps on a CLUSTER set (audit P2-08) --------------------------------
  // mc-setlog.js's clusterRVal() writes one logged value per mini-set, joined
  // with '+': a cluster of 5, then 5, then 6 is stored as the string "5+5+6".
  // Every consumer then ran parseInt over it, which stops at the first '+' and
  // reads 5 — so a cluster set reported a third of the reps the athlete
  // actually did. In the progression classifier that is fatal rather than
  // merely wrong: the set is compared against its rep target, comes up short
  // every time, and the exercise is judged a failed session forever. 48
  // distinct cluster prescriptions are authored in this tree.
  //
  // The two right answers differ by what is being asked, so there are two
  // functions rather than one that quietly picks:
  //
  //   repsTotal  every rep performed in the set. This is the volume answer —
  //              sets × reps × weight, weekly tonnage, session strain — and
  //              the one the progression comparison wants, since the question
  //              is "did the prescribed work get done".
  //   repsTop    the largest single mini-set. This is the STRENGTH answer: an
  //              Epley estimate off "16 reps" for a 5+5+6 cluster would invent
  //              a one-rep max the athlete has no claim to, because a cluster
  //              is rested mid-set and a straight set is not.
  function splitReps(v) {
    var str = String(v == null ? '' : v).trim();
    if (!str) return [];
    return str.split('+').map(function (p) { return parseInt(p, 10); })
              .filter(function (n) { return isFinite(n); });
  }
  function repsTotal(v) {
    var parts = splitReps(v);
    if (!parts.length) return 0;
    return parts.reduce(function (a, b) { return a + b; }, 0);
  }
  function repsTop(v) {
    var parts = splitReps(v);
    if (!parts.length) return 0;
    return Math.max.apply(null, parts);
  }
  // True only when the value really is a logged number (or cluster of them),
  // so "did the athlete log reps at all" stays distinguishable from "0".
  function repsLogged(v) {
    return splitReps(v).length > 0;
  }

  // ---- estimated one-rep max (roadmap Phase 4 step 2) ---------------------
  // ONE estimate, because there were two and they disagreed about the same
  // logged set. mc-maxout.js capped reps at 12 and discounted leverage-assisted
  // equipment by 15%; mc-exercise-trends.js did neither. Measured on real
  // shapes before this landed:
  //
  //   Tricep Rope Pushdown  60 x 20   Cable     71 vs 100  (+41%)
  //   Cable Crossover       40 x 25   Cable     48 vs  73  (+52%)
  //   Leg Press            300 x 15   Machine  357 vs 450  (+26%)
  //   Barbell Bench Press  225 x 5    Barbell  263 vs 263    (0%)
  //
  // They agreed only on a barbell or dumbbell set at or under the cap, so the
  // same lift reported two different maxes depending on which screen the
  // athlete opened. This file is the home because every page that loads
  // mc-exercise-trends.js already loads it (79 of 79, checked) and so does
  // max-out.html — one implementation, no new script tag anywhere.
  //
  // Epley (w x (1 + r/30)) is fitted on low-rep work and runs away above about
  // a dozen reps: a 25-rep set would claim a max 83% over the working weight.
  // The cap is a claim about the FORMULA, not about the athlete.
  var EPLEY_REP_CAP = 12;

  // Resolved lazily, never at parse time: script order across ~140 pages does
  // not guarantee mc-classify.js has run when this file parses. Same shape
  // mc-maxout.js and mc-suggest.js already use for the one equipment resolver.
  function _cls() {
    if (typeof window !== 'undefined' && window.MC_CLASSIFY) return window.MC_CLASSIFY;
    try { return require('./mc-classify.js'); } catch (e) { return null; }
  }

  // Cable/Machine/Plate-Loaded estimates are discounted to offset machine
  // leverage; Smith and everything else (Barbell included) are unchanged.
  // Takes an equipment CATEGORY, not a name — mc-maxout.js's ladder already
  // has the category in hand and should not re-resolve it.
  function applyEquipCoeff(e1, equip) {
    e1 = Number(e1);
    if (!isFinite(e1) || e1 <= 0) return 0;
    var C = _cls();
    return (C ? C.isLeverageAssisted(equip)
              : (equip === 'Cable' || equip === 'Machine' || equip === 'Plate-Loaded'))
      ? Math.round(e1 * 0.85) : e1;
  }

  // The estimate itself, from a logged set. `reps` should already be the TOP
  // mini-set for a cluster (repsTop above), never the total — a cluster is
  // rested mid-set, so an estimate off its summed reps invents a max nobody
  // lifted. Total for every input: a negative weight used to yield a negative
  // max and negative reps an estimate BELOW the working weight (audit L-05).
  function e1rm(weight, reps, name) {
    var w = Number(weight), r = Number(reps);
    if (!isFinite(w) || w <= 0) return 0;
    if (!isFinite(r) || r < 1) r = 1;
    // Flagship readiness R4 / D-23: a true single IS the max — Epley at r = 1
    // reported 315 × 1 as 326, a lift the athlete never made. Returned as the
    // weight lifted, with no equipment discount either: the discount converts
    // an ESTIMATE, and a single is a measurement.
    if (r <= 1) return Math.round(w);
    var raw = Math.round(w * (1 + Math.min(r, EPLEY_REP_CAP) / 30));
    if (!isFinite(raw) || raw <= 0) return 0;
    var C = _cls();
    return applyEquipCoeff(raw, C ? C.equipCat(name) : 'Barbell');
  }

  // ---- FIX-06 (roadmap Phase 5.1): a day key that carries a year ----------
  // mc_setlog_v1 stamped every session with
  //   new Date().toLocaleDateString('en-US', {month:'short', day:'numeric'})
  // which is "Sep 11" — a DISPLAY LABEL used as a primary key. Three things
  // break on it, and only the first is obvious:
  //
  //   1. It collides with itself every 365 days. Two sessions a year apart
  //      land in the same bucket and their set numbers union together, so a
  //      set logged last September silently becomes part of this one.
  //   2. It cannot be ordered. mc-sync.js's five-session cap has to decide
  //      which sessions to drop when two devices merge, and a label gives it
  //      nothing to sort by — EN-10 could only patch that by adding a
  //      separate numeric `ts` and reordering when EVERY entry happened to
  //      carry one, which a store with any older session does not.
  //   3. It is locale- and timezone-shaped. The same instant renders a
  //      different key under a different locale, so the athlete who travels
  //      gets a second bucket for one training day.
  //
  // The key is ISO `YYYY-MM-DD` in LOCAL time (never toISOString(), which is
  // UTC — a 7pm session on the US east coast would file under tomorrow).
  // `dayLabel()` turns it back into the "Sep 11" the athlete reads, so the
  // display text is unchanged; only the stored value moved.
  //
  // Nothing is orphaned: normalizeDay() upgrades a legacy label in place. It
  // prefers the entry's own `ts` when EN-10 stamped one, and otherwise
  // resolves "Sep 11" to the most recent PAST Sep 11, which is right for
  // every entry the five-session cap can still be holding. A label it cannot
  // parse is returned untouched rather than replaced with a guess — an
  // unreadable date is recoverable, an invented one is not.
  var ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var LEGACY_DAY_RE = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})$/;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function dayKey(d) {
    var dt = (d instanceof Date) ? d : (d == null ? new Date() : new Date(d));
    if (!dt || isNaN(dt.getTime())) return '';
    return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
  }

  function dayLabel(d) {
    var m = ISO_DAY_RE.exec(String(d == null ? '' : d));
    if (!m) return String(d == null ? '' : d);   // a legacy label already reads right
    var mi = parseInt(m[2], 10) - 1;
    if (mi < 0 || mi > 11) return String(d);
    return MONTHS[mi] + ' ' + parseInt(m[3], 10);
  }

  function monthIndex(word) {
    var w = String(word || '').slice(0, 3).toLowerCase();
    for (var i = 0; i < MONTHS.length; i++) {
      if (MONTHS[i].toLowerCase() === w) return i;
    }
    return -1;
  }

  function normalizeDay(d, ts, now) {
    var s = String(d == null ? '' : d).trim();
    if (ISO_DAY_RE.test(s)) return s;
    if (typeof ts === 'number' && isFinite(ts) && ts > 0) {
      var k = dayKey(new Date(ts));
      if (k) return k;
    }
    var m = LEGACY_DAY_RE.exec(s);
    if (!m) return s;                            // unreadable: never invent one
    var mi = monthIndex(m[1]), day = parseInt(m[2], 10);
    if (mi < 0 || !(day >= 1 && day <= 31)) return s;
    var ref = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();
    var todayMs = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
    // Walk back a year at a time: the first candidate that is both a REAL
    // date (Feb 29 is not, three years in four — Date rolls it to Mar 1) and
    // not in the future. Bounded so a nonsense input cannot spin.
    for (var back = 0; back < 8; back++) {
      var cand = new Date(ref.getFullYear() - back, mi, day);
      if (cand.getMonth() !== mi || cand.getDate() !== day) continue;   // rolled over
      if (cand.getTime() <= todayMs) return dayKey(cand);
    }
    return s;
  }

  // One session list for one exercise, upgraded to dated keys. Two entries
  // can land on the same day once the year is known — a legacy "Sep 11" and
  // a freshly written "2026-09-11" are the same training day — so they are
  // UNIONED rather than one silently shadowing the other. The newest-first
  // entry's set wins on a conflict, which is the same precedence
  // mergeSetlog() already applies.
  function normalizeSessions(list, now) {
    if (!Array.isArray(list)) return [];
    var out = [], byDay = {};
    list.forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      var d = normalizeDay(s.d, s.ts, now);
      var prev = byDay[d];
      if (!prev) {
        s.d = d;
        byDay[d] = s;
        out.push(s);
        return;
      }
      var sets = s.sets || {};
      if (!prev.sets) prev.sets = {};
      for (var sn in sets) if (prev.sets[sn] == null) prev.sets[sn] = sets[sn];
      if (typeof s.ts === 'number' && s.ts > (prev.ts || 0)) prev.ts = s.ts;
    });
    // Sortable for the first time — but only when EVERY key is dated. A list
    // still holding an unparseable label keeps its encounter order rather
    // than having that entry sorted to an arbitrary end.
    if (out.length > 1 && out.every(function (x) { return ISO_DAY_RE.test(x.d); })) {
      out.sort(function (a, b) { return a.d < b.d ? 1 : (a.d > b.d ? -1 : 0); });
    }
    return out;
  }

  // ---- roadmap Phase 5.3 (manual scenario M7): a full store, visibly ------
  // Every localStorage write in this app sits inside a catch, and a full
  // store therefore failed SILENTLY: the row ticked, the count went up, the
  // screen said the set was logged, and nothing reached disk. Phase 0 left a
  // stopgap here that called MC_TOAST — a function that is defined NOWHERE in
  // the tree, behind an `if (window.MC_TOAST)` guard that swallowed it. So
  // the warning Phase 0 believed it had added has never once been shown. Same
  // shape as the #pushChip element Phase 4.5 found: a guard around something
  // that was never built. This one therefore builds its own element and
  // depends on nothing.
  //
  // Published as MC_LOG.writeStore() (and, for existing callers, as
  // MCSetlogUtil.writeStore()) so the writers on the session path share it
  // rather than each growing a private copy — the same reasoning
  // check-single-impl.js applies to the readers. It moved here from
  // mc-setlog.js in flagship readiness R1 (D-38): three conditioning pages
  // bank a workout without loading the set logger, so their writes failed
  // silently. This file is on every page that writes a session store.
  function isQuotaError(e) {
    if (!e) return false;
    // Chrome/Safari: code 22. Firefox: 1014 with its own name. Safari in a
    // private window throws QuotaExceededError at a quota of zero, which is
    // the same message to the athlete: this device will not keep the set.
    if (e.code === 22 || e.code === 1014) return true;
    return e.name === 'QuotaExceededError' ||
           e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
           e.name === 'QUOTA_EXCEEDED_ERR';
  }

  var _quotaShown = false;
  function warnStorageFull(quota) {
    // One banner per page load, not one per set — and dismissing it is
    // final for that load rather than re-arming on the next failed write,
    // which would put it back on screen every few seconds while the athlete
    // is mid-session. A reload re-arms it.
    if (_quotaShown) return;
    if (typeof document === 'undefined' || !document.body) return;
    _quotaShown = true;
    var el = document.createElement('div');
    el.className = 'mc-quota';
    el.setAttribute('role', 'alert');
    var body = document.createElement('div');
    body.className = 'mc-quota-body';
    var title = document.createElement('div');
    title.className = 'mc-quota-title';
    title.textContent = quota ? 'Storage full — this set was not saved'
                              : 'This browser is not saving your sets';
    var msg = document.createElement('div');
    msg.className = 'mc-quota-msg';
    // Built as nodes, not innerHTML: the only variable part is the link, and
    // an alert about losing data is the last place to introduce a parse path.
    msg.appendChild(document.createTextNode(quota
      ? 'Keep training — your sets still reach the cloud if you are signed in. To fix it on this device, '
      : 'Private browsing and blocked site data both do this. Your sets still reach the cloud if you are signed in. You can '));
    var a = document.createElement('a');
    a.href = 'dashboard.html';
    a.textContent = 'export a backup and clear old logs';
    msg.appendChild(a);
    msg.appendChild(document.createTextNode(' from your account panel.'));
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'mc-quota-x';
    x.setAttribute('aria-label', 'Dismiss storage warning');
    x.textContent = '\u2715';
    x.addEventListener('click', function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    body.appendChild(title); body.appendChild(msg);
    el.appendChild(body); el.appendChild(x);
    document.body.appendChild(el);
  }

  // Returns true when the value actually reached disk. Callers that care can
  // act on false; callers that don't at least no longer report success.
  function writeStore(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) {
      warnStorageFull(isQuotaError(e));
      // Phase S5: into the Diagnostics drawer as well. Best effort — with the
      // device genuinely full this write can fail too, which is why the
      // banner above, not this, is the athlete-facing signal.
      try { if (typeof window !== 'undefined' && window.MC_ERRLOG) window.MC_ERRLOG.rec('storage', (isQuotaError(e) ? 'Storage full: ' : 'Storage write refused: ') + key, e && e.name); } catch (_) {}
      return false;
    }
  }


  // ---- the ONE writer for mc_workout_log_v1 (flagship readiness R1) -------
  // D-38: five places appended to this store, each with its own copy of
  // read-unshift-slice-write; three of them skipped the storage-full warning
  // and none of them stamped an id on a conditioning entry, which is what
  // mc-sync.js dedupes on. D-24: a deleted workout came back on the next
  // pull, because the merge is a union and a removal leaves nothing behind.
  // So every append, delete and import goes through these functions, and
  // tools/check-workout-log-writers.js fails CI on any other write.
  //
  // Deletion records live in their OWN store rather than as tombstone
  // entries inside the log. The log has twenty readers — one of them
  // byte-identical with Mike's Cookbook — and every one of them would have
  // had to learn to skip a tombstone. A separate map changes no reader.
  var DEL_KEY = 'mc_workout_log_deleted_v1';   // { workoutKey: { ts } }
  var LOG_CAP = 200;
  // A deletion record only has to outlive the copies of its workout that
  // could still be on another device. A year covers a phone left in a drawer
  // and keeps the store from growing for ever (Phase T1.2); it is pruned when
  // a new deletion is written, the way mc-setlog.js prunes its untick records.
  var DEL_KEEP_MS = 365 * 24 * 60 * 60 * 1000;
  function pruneDeleted(del, now) {
    var cut = (now || Date.now()) - DEL_KEEP_MS, out = {};
    Object.keys(del || {}).forEach(function (k) {
      var r = del[k];
      if (r && isFinite(r.ts) && r.ts > cut) out[k] = r;
    });
    return out;
  }

  // The identity mc-sync.js's merge already dedupes on: the id, or for an
  // entry that predates ids, page + timestamp.
  function workoutKey(e) {
    return e ? (e.id || ((e.pageId || '') + '|' + (e.date || ''))) : '';
  }

  function readDeletedWorkouts() {
    var v;
    try { v = JSON.parse(localStorage.getItem(DEL_KEY) || '{}'); } catch (e) { return {}; }
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }

  // ---- the archive: workouts past the newest 200 (flagship readiness R7) ---
  // D-39: the log kept the newest 200 finished workouts and DROPPED the rest,
  // on this device and in the cloud copy alike (mc-sync.js's merge cut to 200
  // too). About ten months of five days a week, then the oldest went for good.
  //
  // Owner's call: the newest 200 stay exactly as they are, so the twenty
  // readers of the log (History, Stats, the streak, the bridge...) are
  // unchanged and stay fast; anything older moves into
  // mc_workout_archive_v1, compacted, which syncs to the cloud UNTRIMMED. So
  // nothing is lost and the cloud copy is whole again: log + archive.
  //
  // Compact form: the same entry, but its `sets` become rows over a table of
  // the lift names they use, since the same name repeats on every set:
  //   { ...entry fields, sets: undefined, _x: [[name, key, swappedFrom]...],
  //     _s: [[nameIdx, setNum, weight, reps, rpe, pr]...] }
  // Fields this file does not know are kept as written, so a conditioning
  // entry, or anything a later build adds, survives the round trip.
  var ARCH_KEY = 'mc_workout_archive_v1';
  var SET_FIELDS = { name: 1, key: 1, setNum: 1, weight: 1, reps: 1, rpe: 1, pr: 1, swappedFrom: 1 };
  function compactWorkout(e) {
    if (!e || typeof e !== 'object' || !Array.isArray(e.sets)) return e;
    var out = {}, f, names = [], idx = {}, rows = [];
    for (f in e) if (f !== 'sets') out[f] = e[f];
    e.sets.forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var id = (x.name || '') + '\u0001' + (x.key || '') + '\u0001' + (x.swappedFrom || '');
      if (idx[id] == null) { idx[id] = names.length; names.push([x.name || '', x.key || '', x.swappedFrom || '']); }
      var row = [idx[id], x.setNum == null ? null : x.setNum, x.weight == null ? null : x.weight,
                 x.reps == null ? null : x.reps, x.rpe || 0, x.pr ? 1 : 0];
      // A set field this file does not know rides along whole, so the
      // compaction is lossless for whatever a later build adds.
      var extra = null, g;
      for (g in x) if (!SET_FIELDS[g]) { extra = extra || {}; extra[g] = x[g]; }
      if (extra) row.push(extra);
      rows.push(row);
    });
    out._x = names; out._s = rows;
    return out;
  }
  function expandWorkout(c) {
    if (!c || typeof c !== 'object' || !Array.isArray(c._s)) return c;
    var out = {}, f, names = Array.isArray(c._x) ? c._x : [];
    for (f in c) if (f !== '_x' && f !== '_s') out[f] = c[f];
    out.sets = c._s.map(function (r) {
      var n = names[r[0]] || ['', '', ''];
      var x = { name: n[0], key: n[1], setNum: r[1], weight: r[2], reps: r[3], pr: !!r[5] };
      if (r[4]) x.rpe = r[4];
      if (n[2]) x.swappedFrom = n[2];
      if (r[6] && typeof r[6] === 'object') for (var g in r[6]) x[g] = r[6][g];
      return x;
    });
    out.archived = true;
    return out;
  }
  function readArchiveRaw() {
    var v;
    try { v = JSON.parse(localStorage.getItem(ARCH_KEY) || '[]'); } catch (e) { return []; }
    return Array.isArray(v) ? v.filter(function (e) { return e && typeof e === 'object'; }) : [];
  }
  // Every archived workout, expanded to the log's own shape, newest first.
  function readArchive() { return readArchiveRaw().map(expandWorkout); }
  // Union into the archive by the log's own identity, newest first. A workout
  // deleted on this device is not archived. Uncapped on purpose: a full
  // device warns through writeStore() rather than dropping history quietly.
  function mergeArchive(arch, entries, deleted) {
    deleted = deleted || {};
    var seen = {}, out = [];
    (entries || []).concat(arch || []).forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var k = workoutKey(e);
      if (!k || deleted[k] || seen[k]) return;
      seen[k] = 1; out.push(Array.isArray(e.sets) ? compactWorkout(e) : e);
    });
    out.sort(function (a, b) { return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0); });
    return out;
  }
  function archiveWorkouts(entries) {
    if (!entries || !entries.length) return true;
    return writeStore(ARCH_KEY, JSON.stringify(mergeArchive(readArchiveRaw(), entries, readDeletedWorkouts())));
  }
  // Keep the newest LOG_CAP in the log, move the rest to the archive. The
  // archive is written FIRST, so a failure there leaves the log untrimmed
  // rather than losing the overflow.
  function capLog(log) {
    log = Array.isArray(log) ? log : [];
    if (log.length <= LOG_CAP) return writeStore(WL_KEY, JSON.stringify(log));
    if (!archiveWorkouts(log.slice(LOG_CAP))) return writeStore(WL_KEY, JSON.stringify(log));
    return writeStore(WL_KEY, JSON.stringify(log.slice(0, LOG_CAP)));
  }
  // mc-sync.js calls this after a pull: its merge no longer cuts at 200, so a
  // pull that brings the log past the cap is rolled over here, in one place.
  function rollover() {
    var log = readWorkoutLog();
    return log.length > LOG_CAP ? capLog(log) : true;
  }
  // A workout by id, wherever it lives (workout-detail.html).
  function findWorkout(id) {
    if (!id) return null;
    var hit = null;
    readWorkoutLog().some(function (e) { if (workoutKey(e) === id || e.id === id) { hit = e; return true; } return false; });
    if (hit) return hit;
    readArchiveRaw().some(function (e) { if (workoutKey(e) === id || e.id === id) { hit = expandWorkout(e); return true; } return false; });
    return hit;
  }
  // Every finished workout, newest first: the log, then the archive. A pull
  // can bring back into the log a workout this device already archived (the
  // other device still holds it in its newest 200), so the log's copy wins
  // and the archive's is skipped rather than listed twice.
  function readAllWorkouts() {
    var log = readWorkoutLog(), seen = {};
    log.forEach(function (e) { seen[workoutKey(e)] = 1; });
    return log.concat(readArchive().filter(function (e) { return !seen[workoutKey(e)]; }));
  }

  function appendWorkout(entry) {
    if (!entry || typeof entry !== 'object') return false;
    if (!entry.id && entry.pageId && entry.date) entry.id = entry.pageId + '|' + entry.date;
    var log = readWorkoutLog();
    log.unshift(entry);
    return capLog(log);
  }

  // Removes the workouts with these keys and records each deletion, so a
  // pull from another device cannot bring them back. The record is written
  // first: if the log write then fails, the workout is still on screen and
  // the athlete can retry, but a sync can never resurrect a half-deleted one.
  function deleteWorkouts(keys) {
    var want = {}, n = 0, now = Date.now();
    (keys || []).forEach(function (k) { if (k) { want[k] = 1; n++; } });
    if (!n) return false;
    var del = pruneDeleted(readDeletedWorkouts(), now);
    Object.keys(want).forEach(function (k) { del[k] = { ts: now }; });
    writeStore(DEL_KEY, JSON.stringify(del));
    // R7: an archived workout can be deleted too (History's older list).
    var arch = readArchiveRaw(), archKept = arch.filter(function (e) { return !want[workoutKey(e)]; });
    if (archKept.length !== arch.length) writeStore(ARCH_KEY, JSON.stringify(archKept));
    var kept = readWorkoutLog().filter(function (e) { return !want[workoutKey(e)]; });
    return writeStore(WL_KEY, JSON.stringify(kept));
  }

  function clearWorkouts() {
    return deleteWorkouts(readWorkoutLog().concat(readArchiveRaw()).map(workoutKey));
  }

  // Import (D-14): restoring an older backup used to REPLACE the log, so
  // every workout finished since that backup was erased. A merge by identity
  // instead: entries are immutable once banked, so the copy already on the
  // device wins a tie, an entry deleted on this device stays deleted, and the
  // result is newest first under the same cap. Pure, so the import preview
  // can show exactly what a confirm will do before anything is written.
  function mergeWorkoutLogs(local, incoming, deleted) {
    local = Array.isArray(local) ? local : [];
    incoming = Array.isArray(incoming) ? incoming : [];
    deleted = deleted || {};
    var seen = {}, out = [], added = 0, skippedDeleted = 0, duplicates = 0;
    local.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var k = workoutKey(e);
      if (seen[k]) return;
      seen[k] = 1; out.push(e);
    });
    incoming.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var k = workoutKey(e);
      if (deleted[k]) { skippedDeleted++; return; }
      if (seen[k]) { duplicates++; return; }
      seen[k] = 1; out.push(e); added++;
    });
    out.sort(function (a, b) { return (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0); });
    // R7: past the cap is ARCHIVED, not dropped (writeWorkoutLog does it), so
    // `archived` is how many the preview can say will move there.
    var over = Math.max(0, out.length - LOG_CAP);
    return { log: out, added: added, duplicates: duplicates,
             skippedDeleted: skippedDeleted, archived: over, dropped: 0 };
  }

  function writeWorkoutLog(arr) {
    return capLog(Array.isArray(arr) ? arr : []);
  }

  if (typeof window !== 'undefined') {
    window.MC_LOG = window.MC_LOG || {};
    window.MC_LOG.readWorkoutLog = readWorkoutLog;
    window.MC_LOG.readSets = readSets;
    window.MC_LOG.setName = setName;
    window.MC_LOG.repsTotal = repsTotal;
    window.MC_LOG.repsTop = repsTop;
    window.MC_LOG.repsLogged = repsLogged;
    window.MC_LOG.e1rm = e1rm;
    window.MC_LOG.applyEquipCoeff = applyEquipCoeff;
    window.MC_LOG.EPLEY_REP_CAP = EPLEY_REP_CAP;
    window.MC_LOG.dayKey = dayKey;
    window.MC_LOG.dayLabel = dayLabel;
    window.MC_LOG.normalizeDay = normalizeDay;
    window.MC_LOG.normalizeSessions = normalizeSessions;
    window.MC_LOG.writeStore = writeStore;
    window.MC_LOG.workoutKey = workoutKey;
    window.MC_LOG.readDeletedWorkouts = readDeletedWorkouts;
    window.MC_LOG.appendWorkout = appendWorkout;
    window.MC_LOG.deleteWorkouts = deleteWorkouts;
    window.MC_LOG.clearWorkouts = clearWorkouts;
    window.MC_LOG.mergeWorkoutLogs = mergeWorkoutLogs;
    window.MC_LOG.writeWorkoutLog = writeWorkoutLog;
    window.MC_LOG.readArchive = readArchive;          // R7 / D-39
    window.MC_LOG.archiveWorkouts = archiveWorkouts;
    window.MC_LOG.mergeArchive = mergeArchive;
    window.MC_LOG.rollover = rollover;
    window.MC_LOG.findWorkout = findWorkout;
    window.MC_LOG.readAllWorkouts = readAllWorkouts;
    window.MC_LOG.LOG_CAP = LOG_CAP;
  }

  // Node-side hook so tools/test-mc-numeric-guards.js can call the real
  // implementation rather than a copy of it.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      readWorkoutLog: readWorkoutLog, readSets: readSets, setName: setName,
      repsTotal: repsTotal, repsTop: repsTop, repsLogged: repsLogged,
      e1rm: e1rm, applyEquipCoeff: applyEquipCoeff, EPLEY_REP_CAP: EPLEY_REP_CAP,
      dayKey: dayKey, dayLabel: dayLabel,
      normalizeDay: normalizeDay, normalizeSessions: normalizeSessions,
      workoutKey: workoutKey, mergeWorkoutLogs: mergeWorkoutLogs,
      compactWorkout: compactWorkout, expandWorkout: expandWorkout, mergeArchive: mergeArchive,
      LOG_CAP: LOG_CAP, pruneDeleted: pruneDeleted, DEL_KEEP_MS: DEL_KEEP_MS
    };
  }
})();
