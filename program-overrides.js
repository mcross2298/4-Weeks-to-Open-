/* ==========================================================================
   program-overrides.js  —  permanent program override layer (all users)
   --------------------------------------------------------------------------
   Applies owner-published exercise overrides to workout cards at load time.
   The static workout HTML stays the source of truth; this layer paints a
   committed override file (program-overrides.json) on top of it, so a
   permanent replacement reaches every user once the file is committed and
   GitHub Pages redeploys.

   Two override sources, merged per (pageId, original exercise name):
     1. program-overrides.json  — published, committed to the repo
     2. localStorage mc_pm_overrides — the owner's local working copy
        (instant preview before export; wins over published)

   Override entry (all fields optional):
     { name, sets, rest, note, tempo }   — replace/edit the exercise
     { reset: true }                     — shadow a published override
                                           (renders the original exercise)

   Keys overrides by the ORIGINAL exercise name; cards are stamped with
   data-mc-orig-name on first touch so re-scans still match after the
   visible name changes. Writes are strictly idempotent so this observer
   and mc-card-actions.js's observer settle instead of looping.
   ========================================================================== */
(function () {
  if (window.__mcProgOverrides) return;   // guard against double-include
  window.__mcProgOverrides = true;

  // ---- shared scan scheduler (C2) -----------------------------------------
  // One MutationObserver for the whole engine. Modules that paint on DOM
  // changes (this file, mc-card-actions.js) subscribe a scan callback instead
  // of each running their own observer + debounce. withoutObserver() is shared
  // so any module's DOM writes are muted for ALL subscribers (writes are
  // idempotent across modules, so this only removes redundant re-scans).
  // Defined here because program-overrides.js loads before mc-card-actions.js
  // on every page; the latter falls back to its own observer if MC_SCAN is absent.
  if (!window.MC_SCAN) {
    window.MC_SCAN = (function () {
      var subs = [], mo = null, depth = 0, timer = null;
      function run() { for (var i = 0; i < subs.length; i++) { try { subs[i](); } catch (e) {} } }
      function schedule() { clearTimeout(timer); timer = setTimeout(run, 80); }
      function withoutObserver(fn) {
        if (mo && depth === 0) mo.disconnect();
        depth++;
        try { fn(); }
        finally {
          depth--;
          if (mo && depth === 0) { mo.takeRecords(); mo.observe(document.body, { childList: true, subtree: true }); }
        }
      }
      function start() {
        if (mo || !document.body) return;
        mo = new MutationObserver(schedule);
        mo.observe(document.body, { childList: true, subtree: true });
      }
      return {
        subscribe: function (fn) { if (subs.indexOf(fn) === -1) subs.push(fn); },
        schedule: schedule,
        withoutObserver: withoutObserver,
        start: start
      };
    })();
  }

  var CARD_SEL = '.ex-card, .ex-item, .lift-card, .ss-ex';
  var NAME_SEL = '.ex-name, .lift-name, .var-name, .ss-name';
  var BODY_SEL = '.ex-body, .ss-content';
  var PAGE_ID  = (location.pathname.split('/').pop() || 'index.html').split('?')[0];

  // Multi-week pages (mc-s*-*, pmc-s*-*, run-program.html, …) render a different
  // workout per week off the SAME file, selecting the week via ?w=N (or, for
  // pages that switch weeks in place, window.MC_WEEK). The page-tier override
  // bucket must therefore be week-aware, or an edit to one week paints every
  // week (the "edit week 3 → week 4 mirrors it" bug). The PROGRAM/SPLIT/BADGE
  // tiers stay keyed by the bare filename (via MC_PO.pageId) so naming
  // resolution — MC_NAMES.progOf()/splitOf() — is unaffected.
  //
  // Week 1 (or no week) keeps the bare PAGE_ID so every already-published
  // override on these pages keeps applying unchanged; only weeks ≥ 2 take a
  // "|wN" suffix, which is what makes each later week independently editable.
  function curWeek() {
    if (window.MC_WEEK != null && window.MC_WEEK !== '') return String(window.MC_WEEK);
    try { var w = new URLSearchParams(location.search).get('w'); return w ? String(w) : ''; }
    catch (e) { return ''; }
  }
  function pagesKey() {
    var w = curWeek();
    return (w && w !== '1') ? (PAGE_ID + '|w' + w) : PAGE_ID;
  }

  var LOCAL_KEY = 'mc_pm_overrides';      // v2: { pages, exercises, programs, splits, badges }
  var JSON_URL  = 'program-overrides.json';

  // v2 sections. layouts/themes (PM Phase 2) are 1-level maps keyed by a view
  // scope ('program-cards', 'landing:<id>', 'split:<id>', 'workout:<pageId>',
  // or 'global' for app chrome). Old clients ignore unknown sections, so this
  // stays backward compatible.
  function emptyDoc() { return { pages: {}, exercises: {}, programs: {}, splits: {}, badges: {}, layouts: {}, themes: {} }; }

  var published = emptyDoc();
  var canary = emptyDoc();            // R2: testers-only overlay (naming sections); empty for normal users
  var previewPublishedOnly = false;   // PM "Preview as user": paint published layer only
  // original card values captured before the first override application,
  // so clearing an override reverts live without a reload
  var snapshots = new WeakMap();

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || emptyDoc(); }
    catch (e) { return emptyDoc(); }
  }
  function writeLocal(obj) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function dispatchNamesChanged() {
    try { document.dispatchEvent(new CustomEvent('mc:names-changed')); } catch (e) {}
  }
  // PM Phase 2 — layout/theme repaint signal (mc-layout.js + mc-theme.js listen)
  function dispatchLayoutChanged() {
    dispatchNamesChanged();
    try { document.dispatchEvent(new CustomEvent('mc:layout-changed')); } catch (e) {}
  }

  // merged view: published overlaid with the local working copy (all v2 sections)
  // pages:     2-level  { pageId → { origName → patch } }
  // exercises: 1-level  { origName → patch }
  // programs:  1-level  { progId → patch }
  // splits:    2-level  { progId → { origSplit → patch } }
  // badges:    2-level  { progId → { badgeId → patch } }
  // includeLocal=false yields the published-only view (PM "Preview as user").
  // layers, low→high precedence: published < canary (testers only) < local working copy.
  // includeCanary overlays the testers-only canary set (empty for normal users via
  // RLS); excluded from preview (= normal-user view) and from export.
  function buildEffective(includeLocal, includeCanary) {
    var out = emptyDoc();
    var pid, nm, k, bpid;
    var layers = [published];
    if (includeCanary) layers.push(canary);
    if (includeLocal) layers.push(readLocal());
    layers.forEach(function (layer) {
      // pages: 2-level
      var psrc = (layer && layer.pages) || {};
      for (pid in psrc) {
        if (!out.pages[pid]) out.pages[pid] = {};
        for (nm in psrc[pid]) out.pages[pid][nm] = psrc[pid][nm];
      }
      // exercises, programs: 1-level
      var esrc = (layer && layer.exercises) || {};
      for (k in esrc) out.exercises[k] = esrc[k];
      var prsrc = (layer && layer.programs) || {};
      for (k in prsrc) out.programs[k] = prsrc[k];
      // splits: 2-level
      var ssrc = (layer && layer.splits) || {};
      for (pid in ssrc) {
        if (!out.splits[pid]) out.splits[pid] = {};
        for (k in ssrc[pid]) out.splits[pid][k] = ssrc[pid][k];
      }
      // badges: 2-level
      var bsrc = (layer && layer.badges) || {};
      for (bpid in bsrc) {
        if (!out.badges[bpid]) out.badges[bpid] = {};
        for (k in bsrc[bpid]) out.badges[bpid][k] = bsrc[bpid][k];
      }
      // layouts, themes: 1-level (PM Phase 2)
      var lsrc = (layer && layer.layouts) || {};
      for (k in lsrc) out.layouts[k] = lsrc[k];
      var tsrc = (layer && layer.themes) || {};
      for (k in tsrc) out.themes[k] = tsrc[k];
    });
    return out;
  }
  // paint/resolver view — honors preview mode (preview = pure published, the
  // normal-user view: no local, no canary). Otherwise overlays canary + local.
  function effective() { return buildEffective(!previewPublishedOnly, !previewPublishedOnly); }

  // global exercise name from v2 exercises section (no page-level check — caller must do that)
  function globalExerciseName(origName) {
    var sec = effective().exercises;
    var entry = sec[origName];
    if (!entry) {
      var want = origName.trim().toLowerCase(), k;
      for (k in sec) { if (k.trim().toLowerCase() === want) { entry = sec[k]; break; } }
    }
    return (entry && entry.name && !entry.reset) ? entry.name : null;
  }

  // original (HTML-authored) name stamped on the card, or its visible text
  // before any rename has painted. Reads data-mc-orig-name first so it stays
  // stable mid-scan even after a card's displayed name has been repainted.
  function origNameOfCard(card) {
    var attr = card.getAttribute('data-mc-orig-name');
    if (attr) return attr;
    var el = card.querySelector(NAME_SEL);
    return el ? el.textContent.trim() : '';
  }

  // page-tier override key: the original name, disambiguated by DOM occurrence
  // order when a page repeats a name. Mirrors mc-setlog.js#nameId() so the
  // override layer and the logging layer agree on which card is which. The
  // FIRST occurrence keeps the bare name, so existing published overrides keyed
  // by plain name keep applying unchanged (backward compatible). Without this,
  // two cards sharing an original name resolve to one key and edits to one
  // paint both.
  function cardKey(card) {
    var base = origNameOfCard(card);
    if (!base) return '';
    var want = base.trim().toLowerCase();
    var cards = document.querySelectorAll(CARD_SEL), occ = 0;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] === card) break;
      if (origNameOfCard(cards[i]).trim().toLowerCase() === want) occ++;
    }
    return occ ? base + '#' + occ : base;
  }

  function overrideFor(origName) {
    var page = effective().pages[pagesKey()];
    if (!page) return null;
    var o = page[origName];
    if (!o) {
      // tolerate whitespace/case drift between authored HTML and saved key
      var want = origName.trim().toLowerCase(), k;
      for (k in page) if (k.trim().toLowerCase() === want) { o = page[k]; break; }
    }
    return (o && !o.reset) ? o : null;
  }

  function withoutObserver(fn) { MC_SCAN.withoutObserver(fn); }

  function setText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }

  // the Rest value cell on premier cards: .a-cell whose .k label says "Rest"
  function restCell(card) {
    var cells = card.querySelectorAll('.a-cell');
    for (var i = 0; i < cells.length; i++) {
      var k = cells[i].querySelector('.k');
      if (k && /rest/i.test(k.textContent)) return cells[i].querySelector('.v');
    }
    return null;
  }

  function snapshot(card) {
    if (snapshots.has(card)) return snapshots.get(card);
    var nameEl = card.querySelector(NAME_SEL);
    var setsEl = card.querySelector('[data-field="sets"]') || card.querySelector('.ex-sets');
    var repsEl = card.querySelector('.a-reps');
    var restEl = restCell(card);
    var snap = {
      name: nameEl ? nameEl.textContent : '',
      sets: setsEl ? setsEl.textContent : null,
      reps: repsEl ? repsEl.innerHTML : null,
      rest: restEl ? restEl.textContent : null
    };
    snapshots.set(card, snap);
    return snap;
  }

  // ---- intensifiers (Drop set / Cluster set / superset) -------------------
  // Two layers paint through the SAME engine:
  //   • PM-published — week-aware, stored under the page-tier keys
  //     "<cardKey>@drop" / "<cardKey>@cluster" / "<cardKey>@ss" in the override
  //     doc, pushed to Supabase, live for everyone.
  //   • Personal — any user's own device-only intensifiers, in a separate
  //     localStorage map keyed by pagesKey()→cardKey→{ drop, cluster, ss }.
  //     Never published. Published takes priority; personal fills in where the
  //     owner hasn't set one (and ss flags combine, so a user can build their
  //     own supersets / tri-sets).
  // Patch shapes: drop { on:1, detail? }  cluster { on:1, reps?, rest?, detail? }
  var PERSONAL_KEY = 'mc_personal_intensifiers';
  function readPersonal() { try { return JSON.parse(localStorage.getItem(PERSONAL_KEY)) || {}; } catch (e) { return {}; } }
  function writePersonal(o) { try { localStorage.setItem(PERSONAL_KEY, JSON.stringify(o || {})); } catch (e) {} }
  function personalCard(baseKey) { var pg = readPersonal()[pagesKey()]; return (pg && pg[baseKey]) || null; }

  function intensifierFor(baseKey, kind) {
    var page = effective().pages[pagesKey()];
    var e = page && page[baseKey + '@' + kind];
    if (e && !e.reset && (e.on || e.detail || e.reps || e.rest)) return e;        // PM/published wins
    var p = personalCard(baseKey); p = p && p[kind];                              // else personal
    return (p && (p.on || p.detail || p.reps || p.rest)) ? p : null;
  }
  function dropLine(o)    { return '↘️ Drop set' + (o.detail ? ' — ' + o.detail : ''); }
  function clusterLine(o) {
    var bits = [];
    if (o.reps) bits.push(o.reps + ' per working set');
    if (o.rest) bits.push(o.rest + ' intra-set rest');
    if (o.detail) bits.push(o.detail);
    return '🧩 Cluster set' + (bits.length ? ' — ' + bits.join(' · ') : '');
  }
  // paint (or clear) one intensifier's badge + note on a card. Reversible: when
  // `o` is null we remove anything we previously injected. A cluster carries
  // its rep scheme onto data-mc-cluster/-rest so mc-setlog.js's Log Sets panel
  // can render the matching mini-set bubbles; the badge/note become tappable
  // so any user can adjust the breakdown mid-session (openClusterPersonalEdit
  // below) — always written to the PERSONAL store, never the PM-published one.
  function applyIntensifier(card, kind, o, baseKey) {
    var badgeText = kind === 'drop' ? '↘️ Drop Set' : '🧩 Cluster';
    var noteText  = !o ? '' : (kind === 'drop' ? dropLine(o) : clusterLine(o));
    var noteCls   = 'mcpo-int mcpo-int-' + kind;
    var badgeCls  = 'mcpo-ibadge mcpo-ibadge-' + kind;
    var body = card.querySelector(BODY_SEL) || card;
    var existingNote  = card.querySelector('.mcpo-int-' + kind);
    var existingBadge = card.querySelector('.mcpo-ibadge-' + kind);
    if (kind === 'cluster') {
      // setAttribute/removeAttribute (not .dataset) to match this file's
      // existing convention (see data-mc-orig-name above) and stay portable
      // to the plain-object card mocks tools/test-naming.js exercises this
      // module against.
      if (o && o.reps) {
        card.setAttribute('data-mc-cluster', o.reps);
        card.setAttribute('data-mc-cluster-rest', o.rest || '');
        card.setAttribute('data-mcpo-cluster-owned', '1');
      } else if (card.getAttribute('data-mcpo-cluster-owned')) {
        // Only clear what THIS module previously set. A card can carry a
        // native data-mc-cluster with no PM/personal override at all (e.g.
        // custom workouts stamp it directly at render time) — that one isn't
        // ours to remove, or mc-setlog.js's Log Sets panel loses the cluster
        // mini-set bubbles and silently falls back to a plain reps row.
        card.removeAttribute('data-mc-cluster');
        card.removeAttribute('data-mc-cluster-rest');
        card.removeAttribute('data-mcpo-cluster-owned');
      }
    }
    if (o) {
      var badges = card.querySelector('.a-badges');
      if (badges) {
        if (!existingBadge) { existingBadge = document.createElement('span'); existingBadge.className = badgeCls; badges.appendChild(existingBadge); }
        var shownBadgeText = kind === 'cluster' ? badgeText + ' ✎' : badgeText;
        if (existingBadge.textContent !== shownBadgeText) existingBadge.textContent = shownBadgeText;
      } else if (existingBadge) { existingBadge.remove(); }
      if (!existingNote) { existingNote = document.createElement('div'); existingNote.className = noteCls; body.appendChild(existingNote); }
      if (existingNote.textContent !== noteText) existingNote.textContent = noteText;
      if (kind === 'cluster') {
        [existingBadge, existingNote].forEach(function (el) {
          if (!el || el.getAttribute('data-mcpo-click-wired')) return;
          el.setAttribute('data-mcpo-click-wired', '1');
          el.style.cursor = 'pointer';
          el.title = 'Tap to adjust your cluster reps (personal — never changes the published program)';
          el.addEventListener('click', function (e) { e.stopPropagation(); openClusterPersonalEdit(el, card, baseKey); });
        });
      }
    } else {
      if (existingNote)  existingNote.remove();
      if (existingBadge) existingBadge.remove();
    }
  }
  // applied for EVERY scanned card, independent of whether the card carries a
  // name/sets override — a card may have only an intensifier.
  function applyIntensifiers(card, baseKey) {
    applyIntensifier(card, 'drop', intensifierFor(baseKey, 'drop'), baseKey);
    applyIntensifier(card, 'cluster', intensifierFor(baseKey, 'cluster'), baseKey);
  }

  // ---- live personal cluster editing (mid-session, any user) --------------
  function closeClusterPop() { var p = document.getElementById('mcpoClusterPop'); if (p) p.remove(); }
  function openClusterPersonalEdit(anchor, card, baseKey) {
    closeClusterPop();
    var current = intensifierFor(baseKey, 'cluster') || {};
    var parts = current.reps ? current.reps.split('+').map(function (p) { return p.trim(); }) : ['5', '5', '5'];
    if (parts.length < 3) parts = ['5', '5', '5'];
    var CLUSTER_RESTS = ['10s', '15s', '20s', '30s'];
    var pop = document.createElement('div');
    pop.id = 'mcpoClusterPop';
    pop.className = 'mcpo-cluster-pop';
    var repsHtml = parts.map(function (p, k) {
      return (k > 0 ? '<span class="mcpo-cp-plus">+</span>' : '') +
        '<input class="mcpo-cp-inp" type="text" value="' + p.replace(/"/g, '&quot;') + '">';
    }).join('');
    var restOpts = CLUSTER_RESTS.map(function (r) {
      return '<option value="' + r + '"' + (r === (current.rest || '15s') ? ' selected' : '') + '>⏲ ' + r + ' intra-rest</option>';
    }).join('');
    pop.innerHTML =
      '<div class="mcpo-cp-hd">Your cluster reps <span class="mcpo-cp-sub">(personal — not published)</span></div>' +
      '<div class="mcpo-cp-row"><select class="mcpo-cp-count">' +
        [3, 4].map(function (n) { return '<option value="' + n + '"' + (parts.length === n ? ' selected' : '') + '>' + n + ' mini-sets</option>'; }).join('') +
      '</select></div>' +
      '<div class="mcpo-cp-row mcpo-cp-reps">' + repsHtml + '<span class="mcpo-cp-lbl">reps</span></div>' +
      '<div class="mcpo-cp-row"><select class="mcpo-cp-rest">' + restOpts + '</select></div>' +
      '<div class="mcpo-cp-actions">' +
        '<button type="button" class="mcpo-cp-remove">Remove</button>' +
        '<button type="button" class="mcpo-cp-done">Done</button>' +
      '</div>';
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    var top = Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 12);
    var left = Math.max(12, Math.min(r.left, window.innerWidth - pop.offsetWidth - 12));
    pop.style.top = (top + window.scrollY) + 'px';
    pop.style.left = left + 'px';

    function currentParts() {
      return Array.prototype.map.call(pop.querySelectorAll('.mcpo-cp-inp'), function (inp) { return (inp.value || '5').trim(); });
    }
    function savePersonalCluster(patch) {
      var store = readPersonal(), pk = pagesKey();
      store[pk] = store[pk] || {};
      store[pk][baseKey] = store[pk][baseKey] || {};
      store[pk][baseKey].cluster = patch;
      writePersonal(store);
      applyToCard(card);   // repaint badge/note + data-mc-cluster immediately
      // drop this card's existing Log Sets panel so mc-setlog.js's own
      // MutationObserver rebuilds it against the new scheme — not-yet-logged
      // sets pick up the new targets, already-checked sets keep their history.
      var w = card.querySelector('.mcl-wrap'), t = card.querySelector('.mcl-toggle');
      if (w) w.remove();
      if (t) t.remove();
    }
    pop.querySelector('.mcpo-cp-count').addEventListener('change', function () {
      var n = parseInt(this.value, 10);
      var p2 = currentParts();
      var last = p2[p2.length - 1] || '5';
      while (p2.length < n) p2.push(last);
      p2 = p2.slice(0, n);
      savePersonalCluster({ on: 1, reps: p2.filter(Boolean).join('+'), rest: pop.querySelector('.mcpo-cp-rest').value });
      openClusterPersonalEdit(anchor, card, baseKey);   // re-render with the new count
    });
    pop.querySelector('.mcpo-cp-remove').addEventListener('click', function () {
      savePersonalCluster(null);
      closeClusterPop();
    });
    pop.querySelector('.mcpo-cp-done').addEventListener('click', function () {
      savePersonalCluster({ on: 1, reps: currentParts().filter(Boolean).join('+'), rest: pop.querySelector('.mcpo-cp-rest').value });
      closeClusterPop();
    });
    setTimeout(function () {
      document.addEventListener('click', function onDoc(e) {
        if (pop.contains(e.target)) return;
        document.removeEventListener('click', onDoc);
        closeClusterPop();
      });
    }, 0);
  }

  // ---- supersets (true two-exercise pairing) ------------------------------
  // PM-published, week-aware. Stored on the FIRST leg under "<cardKey>@ss"
  // ({ on:1 }) and means "pair this exercise with the next one on the day".
  // At paint time two adjacent top-level single cards are MOVED into a
  // self-contained .mcpo-ss wrapper (A/B legs). Reversible: removing the
  // override unwraps the cards back to their original place. A self-contained
  // wrapper (rather than each page's native .ss-card markup) keeps rendering
  // consistent and reversible across every page. Tri-sets / 3+ are out of
  // scope for this pass — only two-exercise pairing.
  var SS_SINGLE_SEL = '.ex-card, .ex-item, .lift-card';   // top-level cards (NOT .ss-ex legs)
  function ssOverrideFor(baseKey) {
    var page = effective().pages[pagesKey()];
    var e = page && page[baseKey + '@ss'];
    if (e && !e.reset && e.on) return e;                   // PM/published flag
    var p = personalCard(baseKey);                         // OR a personal flag (they combine)
    return (p && p.ss) ? { on: 1 } : null;
  }
  function nextSingleSibling(card) {
    var n = card.nextElementSibling;
    while (n) { if (n.matches && n.matches(SS_SINGLE_SEL)) return n; n = n.nextElementSibling; }
    return null;
  }
  function legLabel(card, letter) {
    var head = card.querySelector('.a-head') || card.querySelector(BODY_SEL) || card;
    var lab = card.querySelector('.mcpo-ss-leg');
    if (!lab) { lab = document.createElement('span'); lab.className = 'mcpo-ss-leg'; head.insertBefore(lab, head.firstChild); }
    if (lab.textContent !== letter) lab.textContent = letter;
  }
  function stripLeg(card) { var l = card.querySelector('.mcpo-ss-leg'); if (l) l.remove(); }

  // leg cards (in order) inside a wrapper's .mcpo-ss-legs
  function legCardsOf(w) {
    var box = w.querySelector('.mcpo-ss-legs');
    if (!box) return [];
    return Array.prototype.filter.call(box.children, function (el) { return el.matches && el.matches(SS_SINGLE_SEL); });
  }
  // unwrap a .mcpo-ss group: move its leg cards back out (in order) ahead of the
  // wrapper, strip the A/B labels, then drop the wrapper shell.
  function unwrapSS(w) {
    if (!w || typeof w.remove !== 'function') return;   // defensive (non-DOM/stub envs)
    var parent = w.parentNode; if (!parent) { w.remove(); return; }
    legCardsOf(w).forEach(function (c) { stripLeg(c); parent.insertBefore(c, w); });
    w.remove();
  }

  // header / divider wording scales with the number of legs (matches the
  // wording the static pages use): 2 = Superset, 3 = Tri-Set, 4+ = Giant Set.
  function ssWording(n) {
    if (n >= 4) return { label: '⚡ Giant Set', div: '× GIANT SET ×' };
    if (n === 3) return { label: '⚡ Tri-Set', div: '× TRI-SET ×' };
    return { label: '⚡ Superset', div: '× SUPERSET ×' };
  }
  function applySupersets() {
    // suspended during a Reorder session so the day reorders as a flat list
    // (mc-card-actions flattens the wrappers first, then refreshes on Done).
    if (window.MC_PM_SUSPEND_SS) return;
    // 1) teardown — unwrap every group, then rebuild from scratch so chains
    //    that grew/shrank (tri-set ↔ superset) always reflect the current flags.
    document.querySelectorAll('.mcpo-ss').forEach(unwrapSS);
    // 2) build — a card's @ss flag means "joined to the next exercise". Walk a
    //    maximal run of linked cards into ONE group (2 = superset, 3+ = tri/
    //    giant set). Cards already absorbed into an earlier group are skipped.
    Array.prototype.forEach.call(document.querySelectorAll(SS_SINGLE_SEL), function (a) {
      if (a.closest && a.closest('.mcpo-ss')) return;    // absorbed by an earlier group
      if (!ssOverrideFor(cardKey(a))) return;            // a is not joined to the next card
      var legs = [a], cur = a, nxt;
      while (ssOverrideFor(cardKey(cur))) {
        nxt = nextSingleSibling(cur);
        if (!nxt) break;
        legs.push(nxt); cur = nxt;
      }
      if (legs.length < 2) return;
      var parent = a.parentNode; if (!parent) return;
      var word = ssWording(legs.length);
      var w = document.createElement('div'); w.className = 'mcpo-ss';
      var hd = document.createElement('div'); hd.className = 'mcpo-ss-hd'; hd.textContent = word.label;
      var box = document.createElement('div'); box.className = 'mcpo-ss-legs';
      parent.insertBefore(w, a);                         // wrapper takes A's slot → reversible
      w.appendChild(hd); w.appendChild(box);
      legs.forEach(function (leg, i) {
        if (i) { var d = document.createElement('div'); d.className = 'mcpo-ss-div'; d.textContent = word.div; box.appendChild(d); }
        box.appendChild(leg);
        legLabel(leg, String.fromCharCode(65 + i));
      });
    });
  }
  // unconditionally unwrap every superset group (used by Reorder so the day
  // becomes a flat, fully-reorderable list; refresh() re-pairs afterwards).
  function flattenSupersets() {
    withoutObserver(function () {
      document.querySelectorAll('.mcpo-ss').forEach(unwrapSS);
    });
  }

  function applyToCard(card) {
    var nameEl = card.querySelector(NAME_SEL);
    if (!nameEl) return;
    var ck = cardKey(card);
    applyIntensifiers(card, ck);
    var origName = card.getAttribute('data-mc-orig-name') || nameEl.textContent.trim();
    var o = overrideFor(ck);                           // page-level override (per-card; highest priority)
    var gName = (!o || !o.name) ? globalExerciseName(origName) : null; // global fallback
    var body = card.querySelector(BODY_SEL) || card;
    var noteEl = card.querySelector('.mcpo-note');
    var tempoEl = card.querySelector('.mcpo-tempo');

    if (!o && !gName) {
      // no override at all — revert anything we previously painted
      if (snapshots.has(card)) {
        var s = snapshot(card);
        setText(nameEl, s.name.trim());
        var se0 = card.querySelector('[data-field="sets"]') || card.querySelector('.ex-sets');
        if (se0 && s.sets !== null) setText(se0, s.sets);
        var re0 = card.querySelector('.a-reps');
        if (re0 && s.reps !== null && re0.innerHTML !== s.reps) re0.innerHTML = s.reps;
        var rc0 = restCell(card);
        if (rc0 && s.rest !== null) setText(rc0, s.rest);
        card.removeAttribute('data-mc-orig-name');
        snapshots.delete(card);
      }
      if (noteEl) noteEl.remove();
      if (tempoEl) tempoEl.remove();
      return;
    }

    snapshot(card);
    if (card.getAttribute('data-mc-orig-name') !== origName) card.setAttribute('data-mc-orig-name', origName);

    // page-level name > global name > keep original
    var effName = (o && o.name) || gName;
    if (effName) setText(nameEl, effName);

    if (o) {
      if (o.sets) {
        var se = card.querySelector('[data-field="sets"]') || card.querySelector('.ex-sets');
        if (se) setText(se, o.sets);
        var re = card.querySelector('.a-reps');
        if (re && typeof window.aReps === 'function') {
          try { var h = window.aReps(o.sets); if (re.innerHTML !== h) re.innerHTML = h; } catch (e) {}
        }
      }

      if (o.rest) { var rc = restCell(card); if (rc) setText(rc, o.rest); }

      if (o.note) {
        if (!noteEl) { noteEl = document.createElement('div'); noteEl.className = 'mcpo-note'; body.appendChild(noteEl); }
        setText(noteEl, o.note);
      } else if (noteEl) noteEl.remove();

      if (o.tempo) {
        if (!tempoEl) { tempoEl = document.createElement('span'); tempoEl.className = 'mcpo-tempo'; body.appendChild(tempoEl); }
        setText(tempoEl, '⏱ ' + o.tempo);
      } else if (tempoEl) tempoEl.remove();
    } else {
      // global name only — remove any leftover note/tempo from prior page-level override
      if (noteEl) noteEl.remove();
      if (tempoEl) tempoEl.remove();
    }
  }

  function scan() {
    var cards = document.querySelectorAll(CARD_SEL);
    if (!cards.length) return;
    withoutObserver(function () {
      Array.prototype.forEach.call(cards, applyToCard);
      applySupersets();
    });
  }
  function scheduleScan() { MC_SCAN.schedule(); }

  function injectStyles() {
    var css =
      '.mcpo-note{margin:8px 14px 12px;padding:8px 10px;border-radius:8px;' +
        'background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.22);' +
        'color:#67e8f9;font-size:12px;font-weight:600;line-height:1.45;' +
        'white-space:pre-wrap;word-break:break-word;}' +
      '.mcpo-note::before{content:"📌 ";opacity:0.85;}' +
      '.mcpo-tempo{display:inline-flex;align-items:center;margin:4px 14px;' +
        'font-size:11px;font-weight:800;letter-spacing:0.02em;padding:3px 8px;border-radius:6px;' +
        'font-family:"SF Mono",ui-monospace,SFMono-Regular,Menlo,monospace;' +
        'background:rgba(34,211,238,0.12);color:#22d3ee;border:1px solid rgba(34,211,238,0.32);}' +
      // intensifiers (Drop set / Cluster set) — self-contained styling so they
      // render consistently on every page regardless of its own badge CSS.
      '.mcpo-ibadge{display:inline-block;font-size:11px;font-weight:800;padding:3px 8px;border-radius:5px;' +
        'letter-spacing:0.05em;text-transform:uppercase;}' +
      '.mcpo-ibadge-drop{background:rgba(244,63,94,0.15);color:#fb7185;border:1px solid rgba(244,63,94,0.28);}' +
      '.mcpo-ibadge-cluster{background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.28);}' +
      '.mcpo-int{margin:6px 14px 0;padding:7px 10px;border-radius:8px;font-size:12px;font-weight:700;line-height:1.4;' +
        'white-space:pre-wrap;word-break:break-word;}' +
      '.mcpo-int-drop{background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.22);color:#fb7185;}' +
      '.mcpo-int-cluster{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.22);color:#fbbf24;}' +
      // superset wrapper (self-contained; two adjacent cards moved inside)
      '.mcpo-ss{margin:10px 12px;border:1px solid rgba(168,85,247,0.4);border-radius:14px;overflow:hidden;' +
        'background:rgba(168,85,247,0.05);}' +
      '.mcpo-ss-hd{padding:8px 12px;font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;' +
        'color:#c084fc;background:rgba(168,85,247,0.12);border-bottom:1px solid rgba(168,85,247,0.25);}' +
      '.mcpo-ss-legs{padding:4px;}' +
      '.mcpo-ss-legs > .ex-card,.mcpo-ss-legs > .ex-item,.mcpo-ss-legs > .lift-card{margin:4px 0;}' +
      '.mcpo-ss-div{text-align:center;font-size:10px;font-weight:800;letter-spacing:0.12em;color:#a855f7;' +
        'padding:3px 0;opacity:0.75;}' +
      '.mcpo-ss-leg{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;' +
        'margin-right:7px;padding:0 5px;border-radius:6px;background:#a855f7;color:#fff;font-size:11px;font-weight:900;' +
        'vertical-align:middle;}' +
      // live personal cluster-edit popover (openClusterPersonalEdit)
      '.mcpo-cluster-pop{position:fixed;z-index:400;width:min(280px,calc(100vw - 24px));' +
        'background:#0d1f3c;border:1px solid rgba(245,158,11,0.35);border-radius:14px;padding:12px 14px;' +
        'box-shadow:0 10px 32px rgba(0,0,0,0.5);}' +
      '.mcpo-cp-hd{font-size:12px;font-weight:900;letter-spacing:0.02em;color:#fbbf24;margin-bottom:8px;}' +
      '.mcpo-cp-sub{font-size:10px;font-weight:600;color:#94a3b8;text-transform:none;letter-spacing:0;}' +
      '.mcpo-cp-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;}' +
      '.mcpo-cp-count,.mcpo-cp-rest{width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);' +
        'border-radius:8px;padding:8px;color:#e2e8f0;font-size:12px;font-weight:700;font-family:inherit;}' +
      '.mcpo-cp-inp{width:42px;min-height:38px;text-align:center;background:rgba(255,255,255,0.06);' +
        'border:1px solid rgba(255,255,255,0.14);border-radius:8px;color:#e2e8f0;font-size:14px;font-weight:800;font-family:inherit;}' +
      '.mcpo-cp-lbl{font-size:11px;color:#94a3b8;font-weight:700;}' +
      '.mcpo-cp-plus{font-size:13px;font-weight:800;color:#fbbf24;}' +
      '.mcpo-cp-actions{display:flex;justify-content:space-between;align-items:center;gap:8px;}' +
      '.mcpo-cp-remove{background:none;border:none;color:#f87171;font-size:12px;font-weight:700;cursor:pointer;padding:6px 0;font-family:inherit;}' +
      '.mcpo-cp-done{background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#1c1400;border:none;' +
        'border-radius:8px;padding:8px 16px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- public API (used by program-manager.js and mc-naming.js) -----------
  window.MC_PO = {
    pageId: PAGE_ID,
    // week-aware bucket for the page-tier (exercise) override section. Equals
    // pageId on single-week pages and on week 1; "<pageId>|wN" for weeks ≥ 2.
    // Consumers writing/reading the `pages` section (program-manager.js,
    // mc-pm-inline.js) must use this, NOT pageId, so weeks edit independently.
    pagesKey: pagesKey,
    refresh: scan,
    flattenSupersets: flattenSupersets,
    cardKey: cardKey,
    // ---- personal (device-only) intensifiers, for non-PM users ------------
    // kind: 'drop' | 'cluster'; patch null clears it. 'ss' is a bare flag.
    getPersonalIntensifier: function (card, kind) {
      var p = personalCard(cardKey(card)); return (p && p[kind]) || null;
    },
    setPersonalIntensifier: function (card, kind, patch) {
      var store = readPersonal(), pk = pagesKey(), ck = cardKey(card);
      var pg = store[pk] || (store[pk] = {});
      var e = pg[ck] || (pg[ck] = {});
      if (patch) e[kind] = patch; else delete e[kind];
      if (!Object.keys(e).length) delete pg[ck];
      if (!Object.keys(pg).length) delete store[pk];
      writePersonal(store); scan();
    },
    hasPersonalSS: function (card) { var p = personalCard(cardKey(card)); return !!(p && p.ss); },
    // does the owner-published/PM layer (NOT personal) carry this intensifier?
    // used to lock the personal menu items so users can only add their own.
    hasOwnerIntensifier: function (card, kind) {
      var page = effective().pages[pagesKey()];
      var e = page && page[cardKey(card) + '@' + kind];
      return !!(e && !e.reset && (e.on || e.detail || e.reps || e.rest));
    },
    togglePersonalSS: function (card) {
      this.setPersonalIntensifier(card, 'ss', this.hasPersonalSS(card) ? null : 1);
    },
    published: function () { return published; },
    local: readLocal,
    setLocal: function (obj) {
      writeLocal(obj || emptyDoc());
      scan();
      dispatchNamesChanged();
    },
    // PM "Preview as user": paint the published layer only (hide the owner's
    // local working copy) so the owner sees exactly what users see. Does not
    // touch the working copy itself — export/publish still use the full merge.
    setPreview: function (on) {
      previewPublishedOnly = !!on;
      scan();
      dispatchNamesChanged();
    },
    isPreview: function () { return previewPublishedOnly; },
    effective: effective,
    globalExerciseName: globalExerciseName,
    // PM Phase 2 — resolved layout/theme for a view scope (published+local),
    // honoring preview mode. layoutFor → style id | null; themeFor → config | null.
    layoutFor: function (scope) {
      var e = effective().layouts[scope];
      return (e && !e.reset && e.style) ? e.style : null;
    },
    themeFor: function (scope) {
      var e = effective().themes[scope];
      return (e && !e.reset) ? e : null;
    },
    // local-working-copy writers (instant preview; Publish path unchanged).
    // Passing null/empty clears the entry. style/cfg merge into the section.
    setLayoutLocal: function (scope, style) {
      var doc = readLocal();
      if (!doc.layouts) doc.layouts = {};
      if (style) doc.layouts[scope] = { style: style }; else delete doc.layouts[scope];
      writeLocal(doc); scan(); dispatchLayoutChanged();
    },
    setThemeLocal: function (scope, cfg) {
      var doc = readLocal();
      if (!doc.themes) doc.themes = {};
      if (cfg) doc.themes[scope] = cfg; else delete doc.themes[scope];
      writeLocal(doc); scan(); dispatchLayoutChanged();
    },
    // merged export view: local edits over published, reset entries dropped.
    // Always includes the working copy (buildEffective(true)) even in preview.
    exportData: function () {
      var eff = buildEffective(true, false), pages = {}, pid, nm, k, bpid;
      for (pid in eff.pages) {
        for (nm in eff.pages[pid]) {
          if (eff.pages[pid][nm] && !eff.pages[pid][nm].reset) {
            if (!pages[pid]) pages[pid] = {};
            pages[pid][nm] = eff.pages[pid][nm];
          }
        }
      }
      function filterFlat(src) {
        var dst = {};
        for (var fk in src) { if (src[fk] && !src[fk].reset) dst[fk] = src[fk]; }
        return dst;
      }
      function filterNested(src) {
        var dst = {};
        for (var np in src) {
          for (var nk in src[np]) {
            if (src[np][nk] && !src[np][nk].reset) {
              if (!dst[np]) dst[np] = {};
              dst[np][nk] = src[np][nk];
            }
          }
        }
        return dst;
      }
      return {
        version: 2,
        updated: new Date().toISOString(),
        pages:     pages,
        exercises: filterFlat(eff.exercises),
        programs:  filterFlat(eff.programs),
        splits:    filterNested(eff.splits),
        badges:    filterNested(eff.badges),
        layouts:   filterFlat(eff.layouts),
        themes:    filterFlat(eff.themes)
      };
    }
  };

  // committed JSON fallback: used offline, or when Supabase isn't configured/
  // reachable. Accepts both v1 ({ pages }) and v2 ({ pages, exercises, ... }).
  function loadFromJSON() {
    return fetch(JSON_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.pages) {
          published = {
            pages:     data.pages     || {},
            exercises: data.exercises || {},
            programs:  data.programs  || {},
            splits:    data.splits    || {},
            badges:    data.badges    || {},
            layouts:   data.layouts   || {},
            themes:    data.themes    || {}
          };
          scan();
          dispatchLayoutChanged();
        }
      })
      .catch(function () {});
  }

  // Published overrides come from Supabase (live; one-tap publish reaches all
  // users); the committed JSON is the offline/fallback source.
  function loadPublished() {
    if (window.MC_SB && MC_SB.configured) {
      return MC_SB.getOverrides()
        .then(function (data) {
          if (data && data.pages) {
            published.pages = data.pages;
            scan();
            // live updates for page-level overrides
            MC_SB.onChange(function () {
              MC_SB.getOverrides()
                .then(function (d) { if (d && d.pages) { published.pages = d.pages; scan(); } })
                .catch(function () {});
            });
          } else {
            return loadFromJSON();
          }
          // also load naming overrides (non-critical; falls through silently on error)
          if (typeof MC_SB.getNaming === 'function') {
            MC_SB.getNaming()
              .then(function (naming) {
                if (!naming) return;
                published.exercises = naming.exercises || {};
                published.programs  = naming.programs  || {};
                published.splits    = naming.splits    || {};
                published.badges    = naming.badges    || {};
                published.layouts   = naming.layouts   || {};
                published.themes    = naming.themes    || {};
                scan();
                dispatchLayoutChanged();
                if (typeof MC_SB.onNamingChange === 'function') {
                  MC_SB.onNamingChange(function () {
                    MC_SB.getNaming()
                      .then(function (n) {
                        if (!n) return;
                        published.exercises = n.exercises || {};
                        published.programs  = n.programs  || {};
                        published.splits    = n.splits    || {};
                        published.badges    = n.badges    || {};
                        published.layouts   = n.layouts   || {};
                        published.themes    = n.themes    || {};
                        scan();
                        dispatchLayoutChanged();
                      }).catch(function () {});
                  });
                }
              }).catch(function () {});
          }
          // R2: testers-only canary overlay. RLS returns rows only for
          // testers/admins, so this is a no-op (empty) for normal users. Always
          // fail-open: any error keeps the live paint untouched.
          if (typeof MC_SB.getCanaryNaming === 'function') {
            MC_SB.getCanaryNaming()
              .then(function (cn) {
                if (!cn) return;
                canary.exercises = cn.exercises || {};
                canary.programs  = cn.programs  || {};
                canary.splits    = cn.splits    || {};
                canary.badges    = cn.badges    || {};
                scan();
                dispatchNamesChanged();
                if (typeof MC_SB.onCanaryChange === 'function') {
                  MC_SB.onCanaryChange(function () {
                    MC_SB.getCanaryNaming()
                      .then(function (n) {
                        if (!n) return;
                        canary.exercises = n.exercises || {};
                        canary.programs  = n.programs  || {};
                        canary.splits    = n.splits    || {};
                        canary.badges    = n.badges    || {};
                        scan();
                        dispatchNamesChanged();
                      }).catch(function () {});
                  });
                }
              }).catch(function () {});
          }
        })
        .catch(function () { return loadFromJSON(); });
    }
    return loadFromJSON();
  }

  function init() {
    injectStyles();
    MC_SCAN.subscribe(scan);
    MC_SCAN.start();
    scan();
    setTimeout(scan, 300);
    setTimeout(scan, 800);
    loadPublished();
    // dynamically load mc-naming.js → mc-naming-paint.js so both modules
    // are available on all pages without modifying each workout HTML file
    function loadScript(src, onload) {
      var s = document.createElement('script');
      s.src = src;
      if (onload) s.onload = onload;
      document.head.appendChild(s);
    }
    // shared program/badge data (single source consumed by the Rename Center)
    if (!window.MC_PM_DATA) loadScript('mc-pm-data.js');
    // structural layout resolver/painters (PM Phase 2) — self-no-ops on pages
    // without a flagship grid or workout cards; paints published layout styles.
    if (!window.MC_LAYOUT) loadScript('mc-layout.js');
    if (!window.MC_NAMES) {
      loadScript('mc-naming.js', function () {
        if (!window.__mcNamingPaint) loadScript('mc-naming-paint.js');
      });
    } else if (!window.__mcNamingPaint) {
      loadScript('mc-naming-paint.js');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
