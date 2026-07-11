/* ==========================================================================
   mc-card-actions.js  —  Phase 1 shared module
   --------------------------------------------------------------------------
   Adds a meatball (⋮) actions menu to every exercise card and consolidates:
     • Replace exercise  (reuses the existing exercise-library.html?replace= flow)
     • Reorder exercises (▲/▼ buttons; order persists per workout container)
     • Notes             (per-card text note; persists)

   Design notes:
   - Works purely on the DOM, so it is decoupled from each page's own data model
     and portable to any page that renders .ex-card / .ex-item / .lift-card.
   - State persists to localStorage and is re-applied on load (survives refresh).
   - Our own DOM mutations are wrapped in withoutObserver() so they never feed
     back into the MutationObserver (which would loop). Self-contained IIFE.
   ========================================================================== */
(function () {
  if (window.__mcCardActions) return;      // guard against double-include
  window.__mcCardActions = true;

  var CARD_SEL = '.ex-card, .ex-item, .lift-card, .ss-ex';
  var NAME_SEL = '.ex-name, .lift-name, .var-name, .ss-name';
  // body/content wrapper inside a card — meatball, note and arrows mount here.
  // .ss-ex (superset sub-exercise) uses .ss-content as its body.
  var BODY_SEL = '.ex-body, .ss-content';
  var PAGE_ID  = (location.pathname.split('/').pop() || 'index.html');

  var ORDER_KEY = 'mc_ex_order';   // { pageId: { containerKey: [name, name, ...] } }
  var NOTES_KEY = 'mc_ex_notes';   // { pageId: { name: "text" } }
  var TEMPO_KEY = 'mc_ex_tempo';   // { pageId: { name: "3:0:1:0" } }

  // "Add Tempo" add-in — on by default for every program that loads this
  // engine. A page can opt OUT with window.MC_TEMPO_ENABLED = false.
  /* MARKET:STRIP influencer-refs START */
  // Tempo notation + values are pulled from the STNDR program.
  /* MARKET:STRIP influencer-refs END */
  // Tempo format is (Eccentric : Pause-bottom : Concentric : Pause-top). A page
  // can override the menu with window.MC_TEMPO_OPTIONS = [{t:'3:0:1:0',d:'…'}, …].
  var TEMPO_OPTIONS = (window.MC_TEMPO_OPTIONS && window.MC_TEMPO_OPTIONS.length) ? window.MC_TEMPO_OPTIONS : [
    { t: '3:0:1:0', d: '3s lower · explosive lift up' },
    { t: '4:0:1:0', d: '4s negative · controlled lift' },
    { t: '5:0:1:0', d: '5s negative · heavy eccentric overload' },
    { t: '3:1:1:0', d: '3s lower · 1s pause at bottom · 1s lift' },
    { t: '2:0:1:2', d: '2s lower · 1s lift · 2s squeeze at top' },
    { t: '3:3:1:0', d: '3s lower · 3s pause in the stretch' },
    { t: '2:2:1:0', d: '2s lower · 2s pause · 1s lift' },
    { t: '3:0:3:0', d: '3s lower · 3s lift — slow both ways' },
  ];
  function tempoEnabled() { return window.MC_TEMPO_ENABLED !== false; }

  var mo = null;                   // the MutationObserver (assigned in init)
  var obsDepth = 0;                // re-entrancy guard for withoutObserver

  // Run a block of our own DOM mutations without the observer reacting to them.
  // Re-entrant: only the OUTERMOST call disconnects/reconnects, so nested calls
  // (scan → applyOrder/renderNote) never re-observe mid-flight and loop.
  function withoutObserver(fn) {
    // C2: use the shared engine scheduler when present (program-overrides.js
    // defines it and loads first); otherwise fall back to our own observer.
    if (window.MC_SCAN) { window.MC_SCAN.withoutObserver(fn); return; }
    if (mo && obsDepth === 0) mo.disconnect();
    obsDepth++;
    try { fn(); }
    finally {
      obsDepth--;
      if (mo && obsDepth === 0) { mo.takeRecords(); mo.observe(document.body, { childList: true, subtree: true }); }
    }
  }
  function hashStr(s) { var h = 5381, i = s.length; while (i) h = (h * 33) ^ s.charCodeAt(--i); return (h >>> 0).toString(36); }

  // ---- storage helpers ----------------------------------------------------
  function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; } }
  function writeJSON(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {} }

  // auto-dismissing confirmation with an optional undo action
  function toast(msg, actionLabel, onAction) {
    var t = document.createElement('div'); t.className = 'mc-toast';
    var span = document.createElement('span'); span.className = 'mc-toast-msg'; span.textContent = msg;
    t.appendChild(span);
    if (actionLabel) {
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'mc-toast-btn'; btn.textContent = actionLabel;
      btn.addEventListener('click', function () {
        onAction();
        t.classList.remove('show');
        setTimeout(function () { t.remove(); }, 300);
      });
      t.appendChild(btn);
    }
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 5000);
  }

  function getOrder(cKey) { var o = readJSON(ORDER_KEY); return (o[PAGE_ID] && o[PAGE_ID][cKey]) || null; }
  function setOrder(cKey, arr) {
    var o = readJSON(ORDER_KEY); if (!o[PAGE_ID]) o[PAGE_ID] = {};
    o[PAGE_ID][cKey] = arr; writeJSON(ORDER_KEY, o);
  }
  function getNote(name) { var n = readJSON(NOTES_KEY); return (n[PAGE_ID] && n[PAGE_ID][name]) || ''; }
  function setNote(name, text) {
    var n = readJSON(NOTES_KEY); if (!n[PAGE_ID]) n[PAGE_ID] = {};
    if (text && text.trim()) n[PAGE_ID][name] = text.trim(); else if (n[PAGE_ID]) delete n[PAGE_ID][name];
    writeJSON(NOTES_KEY, n);
  }
  function getTempo(name) { var t = readJSON(TEMPO_KEY); return (t[PAGE_ID] && t[PAGE_ID][name]) || ''; }
  function setTempo(name, val) {
    var t = readJSON(TEMPO_KEY); if (!t[PAGE_ID]) t[PAGE_ID] = {};
    if (val) t[PAGE_ID][name] = val; else if (t[PAGE_ID]) delete t[PAGE_ID][name];
    writeJSON(TEMPO_KEY, t);
  }

  // ---- DOM identity helpers ----------------------------------------------
  // Read the exercise name fresh from the DOM every time (no caching): pages may
  // rewrite .ex-name after a Replace, and multi-week pages re-render the same
  // container slots — a cached name would key notes/order to the wrong exercise.
  function cardName(card) {
    var el = card.querySelector(NAME_SEL);
    return el ? el.textContent.trim() : (card.textContent || '').trim().slice(0, 60);
  }
  // Key a reorder container by a fingerprint of its exercise SET (sorted names),
  // not by DOM position. This is stable across reorders (sorted) yet distinct per
  // workout, so day-N of week-1 and day-N of week-2 (same data-d, different lifts)
  // never share a saved order. Identical workouts intentionally share one order.
  function containerKey(container) {
    var names = siblingsOf(container).map(cardName).slice().sort();
    return 'k' + hashStr(names.join(''));
  }

  function siblingsOf(container) {
    return Array.prototype.filter.call(container.children, function (el) { return el.matches && el.matches(CARD_SEL); });
  }

  // ====================================================================== //
  //  MENU (bottom sheet)                                                   //
  // ====================================================================== //
  var menuOverlay, sheetTitle, activeCard = null;
  var reorderBar, reorderContainer = null;

  function buildChrome() {
    menuOverlay = document.createElement('div');
    menuOverlay.className = 'mc-menu-overlay';
    var tempoItem = tempoEnabled()
      ? '<button class="mc-item" data-act="tempo"><span class="mc-ico">⏱️</span>Add Tempo</button>'
      : '';
    menuOverlay.innerHTML =
      '<div class="mc-sheet" role="menu">' +
        '<div class="mc-sheet-title" id="mcSheetTitle">Exercise</div>' +
        '<button class="mc-item" data-act="trends"><span class="mc-ico">📈</span>Exercise progress</button>' +
        '<button class="mc-item" data-act="replace"><span class="mc-ico">🔁</span>Replace exercise</button>' +
        '<button class="mc-item" data-act="reorder"><span class="mc-ico">↕️</span>Reorder exercises</button>' +
        tempoItem +
        '<button class="mc-item" data-act="notes"><span class="mc-ico">📝</span>Notes</button>' +
        '<button class="mc-item mc-item-int" data-act="int-drop" style="display:none"><span class="mc-ico">↘️</span>Drop set</button>' +
        '<button class="mc-item mc-item-int" data-act="int-cluster" style="display:none"><span class="mc-ico">🧩</span>Cluster set</button>' +
        '<button class="mc-item mc-item-int" data-act="int-ss" style="display:none"><span class="mc-ico">⚡</span><span class="mc-ss-label">Make superset</span></button>' +
        '<button class="mc-item mc-item-pm" data-act="pm" style="display:none"><span class="mc-ico">🛠️</span>Program Manager edit</button>' +
        '<button class="mc-item mc-item-cancel" data-act="cancel">Cancel</button>' +
      '</div>';
    document.body.appendChild(menuOverlay);
    sheetTitle = menuOverlay.querySelector('#mcSheetTitle');

    menuOverlay.addEventListener('click', function (e) {
      if (e.target === menuOverlay) { closeMenu(); return; }
      var btn = e.target.closest('.mc-item'); if (!btn) return;
      var act = btn.dataset.act;
      var card = activeCard; closeMenu();
      if (!card && act !== 'cancel') return;
      if (act === 'replace') doReplace(card);
      else if (act === 'trends' && window.MCTrends) MCTrends.open(cardName(card));
      else if (act === 'reorder') startReorder(card);
      else if (act === 'notes') openNote(card);
      else if (act === 'tempo') openTempo(card);
      // intensifiers: in PM mode they publish to everyone; otherwise they save
      // personally to this device (like Notes / Add Tempo).
      else if (act === 'int-drop') { if (pmActive() && window.MC_PM) MC_PM.openIntensifier(card, 'drop'); else openPersonalIntensifier(card, 'drop'); }
      else if (act === 'int-cluster') { if (pmActive() && window.MC_PM) MC_PM.openIntensifier(card, 'cluster'); else openPersonalIntensifier(card, 'cluster'); }
      else if (act === 'int-ss') { if (pmActive() && window.MC_PM) MC_PM.toggleSuperset(card); else if (window.MC_PO) MC_PO.togglePersonalSS(card); }
      else if (act === 'pm' && window.MC_PM) window.MC_PM.openEditor(card);
    });

    reorderBar = document.createElement('div');
    reorderBar.className = 'mc-reorder-bar';
    reorderBar.innerHTML =
      '<span class="mc-rb-label">Reorder exercises — use ▲ ▼</span>' +
      '<button class="mc-rb-done">Done</button>';
    document.body.appendChild(reorderBar);
    reorderBar.querySelector('.mc-rb-done').addEventListener('click', endReorder);
  }

  function openMenu(card) {
    activeCard = card;
    sheetTitle.textContent = cardName(card) || 'Exercise';
    var pmOn = pmActive();
    // owner-only item ("Program Manager edit"): visible only while PM unlocked
    Array.prototype.forEach.call(menuOverlay.querySelectorAll('.mc-item-pm'), function (b) {
      b.style.display = pmOn ? '' : 'none';
    });
    // intensifiers (Drop / Cluster / superset): available to everyone on a
    // top-level single card (needs the paint engine to render + persist).
    var isTop = !!(card.matches && card.matches('.ex-card, .ex-item, .lift-card'));
    var intOn = !!window.MC_PO && isTop;
    Array.prototype.forEach.call(menuOverlay.querySelectorAll('.mc-item-int'), function (b) {
      b.style.display = intOn ? '' : 'none';
    });
    if (intOn) {
      // outside PM, users can only ADD their own — lock Drop/Cluster when the
      // owner already published one on this card (published always wins).
      if (!pmOn) {
        ['drop', 'cluster'].forEach(function (kind) {
          var it = menuOverlay.querySelector('[data-act="int-' + kind + '"]');
          if (it && window.MC_PO.hasOwnerIntensifier && MC_PO.hasOwnerIntensifier(card, kind)) it.style.display = 'none';
        });
      }
      // superset item: contextual label, hidden when there's nothing to pair
      // or (for users) when the card belongs to one of the owner's pairings.
      var ssItem = menuOverlay.querySelector('[data-act="int-ss"]');
      if (ssItem) {
        var show, label = 'Make superset';
        if (pmOn) {
          var pairedPM = !!(window.MC_PM && MC_PM.isSuperset && MC_PM.isSuperset(card));
          label = pairedPM ? 'Unpair superset' : 'Make superset';
          show = pairedPM || hasNextTopCard(card);
        } else {
          var personal = !!(MC_PO.hasPersonalSS && MC_PO.hasPersonalSS(card));
          if (personal) { show = true; label = 'Unpair superset'; }
          else if (card.closest && card.closest('.mcpo-ss')) { show = false; }   // owner's pairing — locked
          else { show = hasNextTopCard(card); label = 'Make superset'; }
        }
        ssItem.style.display = show ? '' : 'none';
        var ssLbl = ssItem.querySelector('.mc-ss-label');
        if (ssLbl) ssLbl.textContent = label;
      }
    }
    menuOverlay.classList.add('open');
  }
  function pmActive() { return !!(window.MC_PM && window.MC_PM.active()); }
  // is there a following top-level exercise card (document order, wrapper-safe)?
  function hasNextTopCard(card) {
    var all = document.querySelectorAll('.ex-card, .ex-item, .lift-card');
    for (var i = 0; i < all.length; i++) { if (all[i] === card) return !!all[i + 1]; }
    return false;
  }
  function closeMenu() { menuOverlay.classList.remove('open'); activeCard = null; }

  // ====================================================================== //
  //  SUBSTITUTE  (Phase 1 — biomechanical, in-place swap)                  //
  //  Opens a bottom-sheet of alternatives ranked by movement + muscle       //
  //  similarity (catalog-driven only, no gym-profile filter), each with a   //
  //  predicted starting weight. Picking one swaps the card in place, badges //
  //  it REPLACED (mc-replace.js storage shape) and paints a weight hint —   //
  //  master templates are never touched.                                    //
  // ====================================================================== //
  var REPLACE_KEY  = 'mc_replacements|' + PAGE_ID;   // { origLower: newName } — per-page override
  var GLOBAL_REPLACE_KEY = 'mc_replacements_global'; // { origLower: newName } — applies on every page
  var SWAP_SUG_KEY = 'mc_swap_suggest|' + PAGE_ID;   // { nameLower: weightLb }
  // { origLower: { altLower: count } } — read by MCBiomech.alternatives() to
  // rank a previously-accepted substitute first next time. Undo decrements
  // instead of leaving a phantom "accept" from a fat-thumb tap.
  var ACCEPT_KEY = 'mc_swap_accept_v1';
  function bumpAccept(origKey, altKey, delta) {
    var all = readJSON(ACCEPT_KEY);
    var bucket = all[origKey] || {};
    var n = (bucket[altKey] || 0) + delta;
    if (n > 0) bucket[altKey] = n; else delete bucket[altKey];
    if (Object.keys(bucket).length) all[origKey] = bucket; else delete all[origKey];
    writeJSON(ACCEPT_KEY, all);
  }
  var subOverlay = null, subCard = null;

  function subEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Best-effort: the weight last logged for a card (heaviest set), so the
  // conversion has a real number to scale from. Reads mc-setlog's store.
  function lastLoggedWeight(card) {
    try {
      var store = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      var name = cardName(card);
      var slug = name.trim().replace(/\s+/g, '-').toLowerCase().slice(0, 24);
      var best = 0;
      Object.keys(store).forEach(function (k) {
        if (k.toLowerCase().indexOf(slug) < 0) return;
        var sets = store[k] && store[k].sets; if (!sets) return;
        Object.keys(sets).forEach(function (sn) {
          var w = parseFloat(sets[sn] && sets[sn].w); if (isFinite(w) && w > best) best = w;
        });
      });
      return best;
    } catch (e) { return 0; }
  }

  // entry from the meatball menu
  function doReplace(card) {
    var name = cardName(card);
    if (!name) return;
    if (!window.MCBiomech) {           // engine missing → old library flow
      if (confirm('Replace "' + name.substring(0, 40) + '"?\nTap OK to open Exercise Library.')) {
        window.location.href = 'exercise-library.html?replace=' + encodeURIComponent(name) +
          '&from=' + encodeURIComponent(PAGE_ID);
      }
      return;
    }
    openSubstitute(card);
  }

  function openSubstitute(card) {
    subCard = card;
    if (!subOverlay) {
      subOverlay = document.createElement('div');
      subOverlay.className = 'mc-menu-overlay';
      document.body.appendChild(subOverlay);
      subOverlay.addEventListener('click', function (e) {
        if (e.target === subOverlay) { closeSub(); return; }
        var act = e.target.closest('[data-sub]');
        if (act) {
          var a = act.dataset.sub;
          if (a === 'cancel') { closeSub(); return; }
          if (a === 'library') {
            var nm = cardName(subCard);
            var inf = window.MCBiomech ? MCBiomech.classify(nm) : {};
            closeSub();
            window.location.href = 'exercise-library.html?replace=' + encodeURIComponent(nm) +
              (inf.muscle ? '&muscle=' + encodeURIComponent(inf.muscle) : '') +
              '&from=' + encodeURIComponent(PAGE_ID);
            return;
          }
          return;
        }
        var pick = e.target.closest('[data-pick]');
        if (pick) { applySwap(subCard, pick.dataset.pick, pick.dataset.w); }
      });
    }
    renderSub();
    subOverlay.classList.add('open');
  }
  function closeSub() { if (subOverlay) subOverlay.classList.remove('open'); subCard = null; }

  function renderSub() {
    var card = subCard;
    var name = cardName(card);
    var info = MCBiomech.classify(name);
    var lastWeight = lastLoggedWeight(card);
    var alts = MCBiomech.alternatives(name, { lastWeight: lastWeight }).slice(0, 3);
    var needMore = 3 - alts.length;
    var rows = alts.length ? alts.map(subRow).join('')
      : (needMore > 0 ? '' : '<div class="mc-sub-empty">No exact matches — try fewer keywords</div>');
    var patt = String(info.pattern || '').replace(/-/g, ' ');
    subOverlay.innerHTML =
      '<div class="mc-sheet mc-sub-sheet" role="menu">' +
        '<div class="mc-sub-head">' +
          '<div class="mc-sub-title">Substitute exercise</div>' +
          '<div class="mc-sub-sub">' + subEsc(name) + ' &middot; <span class="mc-sub-tag">' + subEsc(info.muscle) + ' &middot; ' + subEsc(patt) + '</span></div>' +
        '</div>' +
        '<div class="mc-sub-list" id="mcSubList">' + rows +
          (needMore > 0 ? '<div class="mc-sub-loading" id="mcSubLoading">🔎 Looking for more options…</div>' : '') +
        '</div>' +
        '<button class="mc-item mc-sub-lib" data-sub="library"><span class="mc-ico">📚</span>Browse all for ' + subEsc(info.muscle) + '…</button>' +
        '<button class="mc-item mc-item-cancel" data-sub="cancel">Cancel</button>' +
      '</div>';
    if (needMore > 0) loadSubFallback(card, name, info, lastWeight, needMore);
  }

  // LLM fallback (roadmap 4.3): only fires when the deterministic tiers in
  // mc-biomech.js's alternatives() come up short. Signed-out or offline users
  // just keep today's behavior — the loading row is removed with nothing to
  // show, never a dead spinner. Guards against the sheet being closed or
  // reopened for a different card before the response lands.
  function loadSubFallback(card, name, info, lastWeight, need) {
    if (!window.MCBiomech || !MCBiomech.fallbackCandidates || !window.MC_SB || !MC_SB.callSubstitute) {
      removeSubLoading(card);
      return;
    }
    var pool = MCBiomech.fallbackCandidates(name, { muscle: info.muscle });
    if (!pool.length) { removeSubLoading(card); return; }
    MC_SB.callSubstitute({
      name: name, muscle: info.muscle, pattern: info.pattern, equipment: info.equipment,
      need: need, candidates: pool
    }).then(function (picks) {
      if (subCard !== card) return; // sheet moved on — discard this response
      if (!picks || !picks.length) { removeSubLoading(card); return; }
      var rowsHtml = picks.map(function (i) {
        var c = pool[i]; if (!c) return '';
        var w = MCBiomech.convertWeight(name, c.name, lastWeight);
        return subRow({
          name: c.name, equipment: c.equipment, pattern: c.pattern, muscle: c.muscle,
          weight: w, weightSource: w ? 'estimate' : 'none', acceptCount: 0, aiSuggested: true
        });
      }).join('');
      var loading = document.getElementById('mcSubLoading');
      if (loading) loading.outerHTML = rowsHtml;
      if (!rowsHtml) {
        var list = document.getElementById('mcSubList');
        if (list && !list.querySelector('.mc-sub-row')) {
          list.innerHTML = '<div class="mc-sub-empty">No exact matches — try fewer keywords</div>';
        }
      }
    }).catch(function () { if (subCard === card) removeSubLoading(card); });
  }
  function removeSubLoading(card) {
    if (subCard !== card) return;
    var loading = document.getElementById('mcSubLoading');
    if (!loading) return;
    var list = document.getElementById('mcSubList');
    loading.remove();
    if (list && !list.querySelector('.mc-sub-row')) {
      list.innerHTML = '<div class="mc-sub-empty">No exact matches — try fewer keywords</div>';
    }
  }

  // No gym-profile UI exists to ever set a piece of equipment unavailable
  // (a locked product decision — see CLAUDE.md Task 3.1: "gym-profile
  // filtering removed... catalog-driven only, no user-input friction"), so
  // a.available is always true here. Retired the dead "not in gym" flag
  // rather than rendering a state that can never actually occur.
  function subRow(a) {
    // 'history' = a real logged weight on this exact movement (confident);
    // 'estimate' = the leverage-table guess (a starting point, not a fact) —
    // shown differently so a lifter knows which one to trust on set 1.
    var wt = a.weightSource === 'history' ? '<span class="mc-sub-wt mc-sub-wt-real">' + a.weight + ' lb <em>from your log</em></span>'
      : a.weightSource === 'estimate' ? '<span class="mc-sub-wt">≈ ' + a.weight + ' lb</span>'
      : '';
    var used = a.acceptCount > 0 ? '<span class="mc-sub-used">↻ Used before</span>' : '';
    var ai = a.aiSuggested ? '<span class="mc-sub-ai" title="AI-suggested — outside the usual muscle/pattern match">✨ AI</span>' : '';
    return '<button class="mc-sub-row' + (a.aiSuggested ? ' mc-sub-row-ai' : '') + '" data-pick="' + subEsc(a.name) + '" data-w="' + (a.weight || '') + '">' +
             '<span class="mc-sub-eq mc-eq-' + a.equipment.toLowerCase().replace(/[^a-z]/g, '') + '">' + subEsc(a.equipment) + '</span>' +
             '<span class="mc-sub-name">' + subEsc(a.name) + '</span>' +
             ai + used + wt +
           '</button>';
  }

  // Apply the swap: persist (mc-replace.js shape, re-rooted to the immutable
  // original), repaint name + REPLACED badge in place, store + paint the
  // predicted weight, and pre-fill the set logger's empty weight fields.
  // Persistence chain: writes {origLower: newName} either to this page's
  // mc_replacements|<pageId> or to mc_replacements_global (see writeToPage
  // below); on the next page load mc-replace.js::applyReplacements() reads
  // both and re-paints the swap, so it survives a refresh without any
  // additional write-back.
  function applySwap(card, newName, weight) {
    if (!card || !newName) { closeSub(); return; }
    var nameEl = card.querySelector(NAME_SEL); if (!nameEl) { closeSub(); return; }
    var visible = cardName(card);
    var pageReps = readJSON(REPLACE_KEY);
    var globalReps = readJSON(GLOBAL_REPLACE_KEY);
    var effective = Object.assign({}, globalReps, pageReps);
    // re-root: if the current name is itself a replacement target, resolve to
    // the original key (wherever it lives) so a reload chains correctly
    // instead of forking.
    var rootKey = visible.toLowerCase();
    Object.keys(effective).forEach(function (k) {
      if (effective[k] && effective[k].toLowerCase() === rootKey) rootKey = k;
    });
    // This exercise already has a page-specific override → keep respecting
    // it. Otherwise write globally by default, so the swap follows this
    // exercise onto every other program page instead of requiring the same
    // manual re-decision everywhere it appears (repeated gym-floor
    // constraints were the actual friction this was fixing).
    var writeToPage = Object.prototype.hasOwnProperty.call(pageReps, rootKey);
    var targetKey = writeToPage ? REPLACE_KEY : GLOBAL_REPLACE_KEY;
    var targetMap = writeToPage ? pageReps : globalReps;
    var hadRoot = Object.prototype.hasOwnProperty.call(targetMap, rootKey);
    var prevRootVal = targetMap[rootKey];
    targetMap[rootKey] = newName;
    writeJSON(targetKey, targetMap);

    // weight suggestion store, keyed by the new name (what the card now shows)
    var sug = readJSON(SWAP_SUG_KEY);
    var newKey = newName.toLowerCase();
    var hadSug = Object.prototype.hasOwnProperty.call(sug, newKey);
    var prevSugVal = sug[newKey];
    if (weight) sug[newKey] = weight; else delete sug[newKey];
    writeJSON(SWAP_SUG_KEY, sug);

    bumpAccept(rootKey, newKey, 1);

    withoutObserver(function () {
      paintReplaced(card, newName);
      renderSwapPill(card);
      prefillWeight(card, weight);
    });
    closeSub();

    // A fat-thumb tap swaps a lift mid-set with no recovery path otherwise —
    // give it a few seconds to undo back to exactly the pre-swap state.
    toast(newName + ' — swapped', 'Undo', function () {
      var m2 = readJSON(targetKey);
      if (hadRoot) m2[rootKey] = prevRootVal; else delete m2[rootKey];
      writeJSON(targetKey, m2);

      var sug2 = readJSON(SWAP_SUG_KEY);
      if (hadSug) sug2[newKey] = prevSugVal; else delete sug2[newKey];
      writeJSON(SWAP_SUG_KEY, sug2);

      bumpAccept(rootKey, newKey, -1);

      withoutObserver(function () {
        if (hadRoot) { paintReplaced(card, visible); } else { restorePlain(card, visible); }
        renderSwapPill(card);
      });
    });
  }

  // revert a card to its true, never-swapped original name (clears the
  // REPLACED badge + cyan color paintReplaced() applied)
  function restorePlain(card, name) {
    var nameEl = card.querySelector(NAME_SEL); if (!nameEl) return;
    nameEl.textContent = name;
    nameEl.style.color = '';
    var badge = card.querySelector('.replaced-badge');
    if (badge) badge.remove();
  }

  // mirror mc-replace.js's applyReplacements paint (cyan name + REPLACED badge)
  function paintReplaced(card, newName) {
    var nameEl = card.querySelector(NAME_SEL); if (!nameEl) return;
    nameEl.textContent = newName;
    nameEl.style.color = '#22d3ee';
    if (!card.querySelector('.replaced-badge')) {
      var badge = document.createElement('span');
      badge.className = 'replaced-badge';
      badge.style.cssText = 'font-size:11px;font-weight:900;color:#22d3ee;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.25);border-radius:4px;padding:2px 5px;margin-left:6px;letter-spacing:0.06em;vertical-align:middle;';
      badge.textContent = 'REPLACED';
      nameEl.parentNode.insertBefore(badge, nameEl.nextSibling);
    }
  }

  // paint (or clear) the "≈ N lb to start" hint for the swapped card
  function renderSwapPill(card) {
    var sug = readJSON(SWAP_SUG_KEY);
    var w = sug[cardName(card).toLowerCase()];
    var host = card.querySelector('.ex-tags') || card.querySelector(BODY_SEL) || card;
    var existing = card.querySelector('.mc-swap-pill');
    if (w) {
      if (!existing) { existing = document.createElement('span'); existing.className = 'mc-swap-pill'; host.appendChild(existing); }
      var label = '≈ ' + w + ' lb to start';
      if (existing.textContent !== label) existing.textContent = label;
    } else if (existing) { existing.remove(); }
  }

  // best-effort: drop the predicted weight into the logger's empty weight
  // inputs (placeholder + tap-to-fill) so a single tap accepts it.
  function prefillWeight(card, weight) {
    if (!weight) return;
    var inputs = card.querySelectorAll('.mcl-w');
    Array.prototype.forEach.call(inputs, function (inp) {
      if (!inp.value.trim()) { inp.placeholder = weight + ' lb'; inp.dataset.fill = String(weight); }
    });
  }

  // ====================================================================== //
  //  NOTES                                                                 //
  // ====================================================================== //
  var noteOverlay, noteTA, noteCard = null;

  function openNote(card) {
    noteCard = card;
    if (!noteOverlay) {
      noteOverlay = document.createElement('div');
      noteOverlay.className = 'mc-menu-overlay';
      noteOverlay.innerHTML =
        '<div class="mc-note-modal">' +
          '<div class="mc-sheet-title" id="mcNoteTitle">Notes</div>' +
          '<textarea class="mc-note-ta" id="mcNoteTA" placeholder="Add a note for this exercise…"></textarea>' +
          '<div class="mc-note-btns">' +
            '<button class="mc-btn mc-btn-cancel" data-act="cancel">Cancel</button>' +
            '<button class="mc-btn mc-btn-save" data-act="save">Save</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(noteOverlay);
      noteTA = noteOverlay.querySelector('#mcNoteTA');
      noteOverlay.addEventListener('click', function (e) {
        if (e.target === noteOverlay) { noteOverlay.classList.remove('open'); return; }
        var b = e.target.closest('.mc-btn'); if (!b) return;
        if (b.dataset.act === 'save') {
          setNote(cardName(noteCard), noteTA.value);
          withoutObserver(function () { renderNote(noteCard); renderQuickActions(noteCard); });
        }
        noteOverlay.classList.remove('open');
      });
    }
    noteOverlay.querySelector('#mcNoteTitle').textContent = cardName(card) || 'Notes';
    noteTA.value = getNote(cardName(card));
    noteOverlay.classList.add('open');
    setTimeout(function () { noteTA.focus(); }, 50);
  }

  // paint (or clear) the saved note + meatball indicator for a card
  function renderNote(card) {
    var name = cardName(card);
    var text = getNote(name);
    var body = card.querySelector(BODY_SEL) || card;
    var existing = card.querySelector('.mc-note');
    if (text) {
      if (!existing) { existing = document.createElement('div'); existing.className = 'mc-note'; body.appendChild(existing); }
      if (existing.textContent !== text) existing.textContent = text;
    } else if (existing) { existing.remove(); }
    var mb = card.querySelector('.mc-meatball');
    if (mb) mb.classList.toggle('mc-has-note', !!text);
  }

  // ====================================================================== //
  //  TEMPO  (optional on-demand intensifier · tempo notation)              //
  // ====================================================================== //
  var tempoOverlay, tempoCard = null;

  function openTempo(card) {
    tempoCard = card;
    if (!tempoOverlay) {
      tempoOverlay = document.createElement('div');
      tempoOverlay.className = 'mc-menu-overlay';
      var opts = TEMPO_OPTIONS.map(function (o) {
        return '<button class="mc-tempo-opt" data-t="' + o.t + '">' +
                 '<span class="mc-tempo-val">⏱ ' + o.t + '</span>' +
                 '<span class="mc-tempo-desc">' + o.d + '</span>' +
               '</button>';
      }).join('');
      tempoOverlay.innerHTML =
        '<div class="mc-sheet mc-tempo-sheet" role="menu">' +
          '<div class="mc-sheet-title" id="mcTempoTitle">Add Tempo</div>' +
          '<div class="mc-tempo-legend">Eccentric : Pause&nbsp;bottom : Concentric : Pause&nbsp;top — slow a lift down to cut reps and raise output.</div>' +
          '<div class="mc-tempo-list">' + opts + '</div>' +
          '<button class="mc-item mc-tempo-remove" data-t="">Remove tempo</button>' +
          '<button class="mc-item mc-item-cancel" data-act="cancel">Cancel</button>' +
        '</div>';
      document.body.appendChild(tempoOverlay);
      tempoOverlay.addEventListener('click', function (e) {
        if (e.target === tempoOverlay) { tempoOverlay.classList.remove('open'); return; }
        if (e.target.closest('.mc-item-cancel')) { tempoOverlay.classList.remove('open'); return; }
        var btn = e.target.closest('[data-t]'); if (!btn) return;
        setTempo(cardName(tempoCard), btn.dataset.t);
        withoutObserver(function () { renderTempo(tempoCard); });
        tempoOverlay.classList.remove('open');
      });
    }
    var current = getTempo(cardName(card));
    tempoOverlay.querySelector('#mcTempoTitle').textContent = cardName(card) || 'Add Tempo';
    Array.prototype.forEach.call(tempoOverlay.querySelectorAll('.mc-tempo-opt'), function (b) {
      b.classList.toggle('mc-tempo-active', b.dataset.t === current);
    });
    tempoOverlay.classList.add('open');
  }

  // paint (or clear) the tempo pill + meatball indicator for a card
  function renderTempo(card) {
    var name = cardName(card);
    var val = getTempo(name);
    var host = card.querySelector('.ex-tags') || card.querySelector(BODY_SEL) || card;
    var existing = card.querySelector('.mc-tempo-pill');
    if (val) {
      if (!existing) { existing = document.createElement('span'); existing.className = 'mc-tempo-pill'; host.appendChild(existing); }
      var label = '⏱ ' + val;
      if (existing.textContent !== label) existing.textContent = label;
    } else if (existing) { existing.remove(); }
    var mb = card.querySelector('.mc-meatball');
    if (mb) mb.classList.toggle('mc-has-tempo', !!val);
  }

  // ====================================================================== //
  //  PERSONAL INTENSIFIERS  (device-only Drop / Cluster · non-PM users)    //
  //  Routed through MC_PO so the paint engine renders them identically to  //
  //  the owner-published ones, but they live in localStorage and never     //
  //  publish. Superset is a one-tap toggle handled in the click router.    //
  // ====================================================================== //
  var piOverlay = null, piCard = null, piKind = null;
  var PI_LBL = 'display:block;font-size:11px;font-weight:800;letter-spacing:0.04em;color:#94a3b8;margin:12px 2px 5px;text-transform:uppercase;';
  var PI_IN = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:11px 12px;color:#e2e8f0;font-size:14px;font-family:inherit;outline:none;';
  function piEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function openPersonalIntensifier(card, kind) {
    if (!window.MC_PO || !MC_PO.setPersonalIntensifier) return;
    piCard = card; piKind = kind;
    if (!piOverlay) {
      piOverlay = document.createElement('div');
      piOverlay.className = 'mc-menu-overlay';
      document.body.appendChild(piOverlay);
      piOverlay.addEventListener('click', function (e) {
        if (e.target === piOverlay) { piOverlay.classList.remove('open'); return; }
        var b = e.target.closest('.mc-btn'); if (!b) return;
        if (b.dataset.act === 'save') savePersonalIntensifier();
        else if (b.dataset.act === 'remove') MC_PO.setPersonalIntensifier(piCard, piKind, null);
        piOverlay.classList.remove('open');
      });
    }
    var cur = MC_PO.getPersonalIntensifier(card, kind) || {};
    var title = (kind === 'drop' ? '↘️ Drop set' : '🧩 Cluster set') + ' · ' + piEsc(cardName(card) || 'Exercise');
    var fields;
    if (kind === 'drop') {
      fields = '<label style="' + PI_LBL + '">Detail (optional)</label>' +
        '<input class="pi-f" data-f="detail" style="' + PI_IN + '" placeholder="e.g. triple drop, −20% each" value="' + piEsc(cur.detail) + '"/>';
    } else {
      fields = '<label style="' + PI_LBL + '">Reps per cluster (optional)</label>' +
        '<input class="pi-f" data-f="reps" style="' + PI_IN + '" placeholder="e.g. 3 × 3" value="' + piEsc(cur.reps) + '"/>' +
        '<label style="' + PI_LBL + '">Intra-set rest (optional)</label>' +
        '<input class="pi-f" data-f="rest" style="' + PI_IN + '" placeholder="e.g. 15 sec" value="' + piEsc(cur.rest) + '"/>' +
        '<label style="' + PI_LBL + '">Detail (optional)</label>' +
        '<input class="pi-f" data-f="detail" style="' + PI_IN + '" placeholder="e.g. rest-pause to a hard 10" value="' + piEsc(cur.detail) + '"/>';
    }
    piOverlay.innerHTML =
      '<div class="mc-note-modal">' +
        '<div class="mc-sheet-title">' + title + '</div>' +
        fields +
        '<div class="mc-note-btns">' +
          '<button class="mc-btn" data-act="remove" style="background:rgba(248,113,113,0.14);color:#f87171;">Remove</button>' +
          '<button class="mc-btn mc-btn-cancel" data-act="cancel">Cancel</button>' +
          '<button class="mc-btn mc-btn-save" data-act="save">Save</button>' +
        '</div>' +
      '</div>';
    piOverlay.classList.add('open');
  }
  function savePersonalIntensifier() {
    function v(f) { var el = piOverlay.querySelector('[data-f="' + f + '"]'); return el ? el.value.trim() : ''; }
    var patch = { on: 1 }, d;
    if (piKind === 'drop') { if ((d = v('detail'))) patch.detail = d; }
    else { if ((d = v('reps'))) patch.reps = d; if ((d = v('rest'))) patch.rest = d; if ((d = v('detail'))) patch.detail = d; }
    MC_PO.setPersonalIntensifier(piCard, piKind, patch);
  }

  // ====================================================================== //
  //  REORDER                                                               //
  // ====================================================================== //
  function startReorder(card) {
    // Flatten any superset blocks so the whole day reorders as one flat list
    // (cards inside a .mcpo-ss wrapper would otherwise only move within it).
    // The flag keeps the paint engine from re-wrapping mid-reorder; endReorder
    // clears it and refreshes so pairs re-form around the new order.
    window.MC_PM_SUSPEND_SS = true;
    if (window.MC_PO && MC_PO.flattenSupersets) MC_PO.flattenSupersets();
    var container = card.parentElement;
    if (!container) { window.MC_PM_SUSPEND_SS = false; return; }
    reorderContainer = container;
    withoutObserver(function () {
      container.classList.add('mc-reordering');
      Array.prototype.forEach.call(container.querySelectorAll(CARD_SEL), addArrows);
    });
    refreshArrowStates();
    reorderBar.classList.add('open');
  }

  function endReorder() {
    if (reorderContainer) {
      var c = reorderContainer;
      withoutObserver(function () {
        c.classList.remove('mc-reordering');
        Array.prototype.forEach.call(c.querySelectorAll('.mc-reorder-ctrls'), function (x) { x.remove(); });
      });
    }
    reorderContainer = null;
    reorderBar.classList.remove('open');
    // resume + re-pair supersets around the new order
    if (window.MC_PM_SUSPEND_SS) {
      window.MC_PM_SUSPEND_SS = false;
      if (window.MC_PO && MC_PO.refresh) MC_PO.refresh();
    }
  }

  function addArrows(card) {
    if (card.querySelector('.mc-reorder-ctrls')) return;
    var ctrls = document.createElement('div');
    ctrls.className = 'mc-reorder-ctrls';
    ctrls.innerHTML = '<button class="mc-arrow mc-up" aria-label="Move up">▲</button>' +
                      '<button class="mc-arrow mc-down" aria-label="Move down">▼</button>';
    (card.querySelector(BODY_SEL) || card).appendChild(ctrls);
    ctrls.querySelector('.mc-up').addEventListener('click', function (e) { e.stopPropagation(); move(card, -1); });
    ctrls.querySelector('.mc-down').addEventListener('click', function (e) { e.stopPropagation(); move(card, 1); });
  }

  function move(card, dir) {
    var container = reorderContainer || card.parentElement;
    var cards = siblingsOf(container);
    var i = cards.indexOf(card);
    if (i === -1) return;
    var j = i + dir;
    if (j < 0 || j >= cards.length) return;
    withoutObserver(function () {
      if (dir === -1) container.insertBefore(card, cards[j]);
      else container.insertBefore(cards[j], card);
    });
    refreshArrowStates();
    persistOrder(container);
  }

  function refreshArrowStates() {
    if (!reorderContainer) return;
    var cards = siblingsOf(reorderContainer);
    cards.forEach(function (c, idx) {
      var up = c.querySelector('.mc-up'), dn = c.querySelector('.mc-down');
      if (up) up.disabled = (idx === 0);
      if (dn) dn.disabled = (idx === cards.length - 1);
    });
  }

  function persistOrder(container) {
    setOrder(containerKey(container), siblingsOf(container).map(cardName));
  }

  // apply a previously saved order to a container's cards (no-op if already in order)
  function applyOrder(container) {
    var saved = getOrder(containerKey(container));
    if (!saved || !saved.length) return;
    var cards = siblingsOf(container);
    if (cards.length < 2) return;
    // build the target order: saved names that exist, then any leftovers in current order
    var byName = {};
    cards.forEach(function (c) { (byName[cardName(c)] = byName[cardName(c)] || []).push(c); });
    var target = [], used = {};
    saved.forEach(function (nm) {
      var b = byName[nm]; var k = (used[nm] = (used[nm] || 0));
      if (b && b[k]) { target.push(b[k]); used[nm] = k + 1; }
    });
    cards.forEach(function (c) { if (target.indexOf(c) === -1) target.push(c); });
    // skip if DOM already matches target order (avoids needless mutations)
    var same = target.length === cards.length && target.every(function (c, idx) { return c === cards[idx]; });
    if (same) return;
    withoutObserver(function () { target.forEach(function (c) { container.appendChild(c); }); });
  }

  // ====================================================================== //
  //  QUICK ACTIONS  (Replace / Reorder / Notes surfaced on the card face)   //
  //  Same handlers as the meatball menu's corresponding items — this is a   //
  //  second entry point, not new logic. Prepended (rather than inserted     //
  //  after the name) because card markup varies per program page (.a-top/  //
  //  .a-head vs .ss-content vs bespoke layouts) with no single reliable     //
  //  "right under the name" anchor across all of them.                     //
  // ====================================================================== //
  function injectQuickActions(card) {
    var host = card.querySelector(BODY_SEL) || card;
    if (host.querySelector(':scope > .mc-quick-actions')) return;
    var row = document.createElement('div');
    row.className = 'mc-quick-actions';
    row.innerHTML =
      '<button type="button" class="mc-qa-btn" data-qa="replace"><span class="mc-qa-ico">🔁</span>Replace</button>' +
      '<button type="button" class="mc-qa-btn" data-qa="reorder"><span class="mc-qa-ico">↕️</span>Reorder</button>' +
      '<button type="button" class="mc-qa-btn mc-qa-notes" data-qa="notes"><span class="mc-qa-ico">📝</span>Notes</button>';
    row.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      var btn = e.target.closest('.mc-qa-btn'); if (!btn) return;
      var act = btn.dataset.qa;
      if (act === 'replace') doReplace(card);
      else if (act === 'reorder') startReorder(card);
      else if (act === 'notes') openNote(card);
    });
    host.insertBefore(row, host.firstChild);
  }

  // paint (or clear) the Notes pill's "has a saved note" highlight
  function renderQuickActions(card) {
    var btn = card.querySelector(':scope > .mc-quick-actions .mc-qa-notes') ||
              card.querySelector('.mc-quick-actions .mc-qa-notes');
    if (btn) btn.classList.toggle('mc-qa-on', !!getNote(cardName(card)));
  }

  // ====================================================================== //
  //  QUICK PUMP TRIGGER  (page-level "short on time?" abbreviate action)    //
  //  Piggybacks on this module's scan() — already loaded on every workout   //
  //  page — so abbreviate mode needs no per-page wiring. Only mounts once   //
  //  there are enough cards on the page to be worth trimming.               //
  // ====================================================================== //
  var qpOverlay = null;
  var QP_MIN_CARDS = 3;

  function injectQuickPumpTrigger() {
    if (document.querySelector('.mc-qp-trigger')) return;
    if (document.querySelectorAll(CARD_SEL).length < QP_MIN_CARDS) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-qp-trigger';
    btn.innerHTML = '⏱ <span>Short on time?</span>';
    btn.addEventListener('click', openQuickPumpSheet);
    document.body.appendChild(btn);
  }

  function loadQuickPump(cb) {
    if (window.MCQuickPump) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'mc-quick-pump.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function openQuickPumpSheet() {
    if (!qpOverlay) {
      qpOverlay = document.createElement('div');
      qpOverlay.className = 'mc-menu-overlay';
      qpOverlay.innerHTML =
        '<div class="mc-sheet" role="menu">' +
          '<div class="mc-sheet-title">Abbreviate this workout</div>' +
          '<div class="mc-qp-legend">Trim it down to fit your time, keeping station-anchored pairs together.</div>' +
          '<button class="mc-item" data-qp="30"><span class="mc-ico">⏱</span>30 minutes</button>' +
          '<button class="mc-item" data-qp="45"><span class="mc-ico">⏱</span>45 minutes</button>' +
          '<button class="mc-item mc-item-cancel" data-qp="cancel">Cancel</button>' +
        '</div>';
      document.body.appendChild(qpOverlay);
      qpOverlay.addEventListener('click', function (e) {
        if (e.target === qpOverlay) { qpOverlay.classList.remove('open'); return; }
        var btn = e.target.closest('[data-qp]'); if (!btn) return;
        var v = btn.dataset.qp;
        qpOverlay.classList.remove('open');
        if (v === 'cancel') return;
        loadQuickPump(function () {
          var built = MCQuickPump.abbreviateCurrentPage(parseInt(v, 10));
          MCQuickPump.saveAndStart(built);
        });
      });
    }
    qpOverlay.classList.add('open');
  }

  // ====================================================================== //
  //  INJECTION + HYDRATION                                                 //
  // ====================================================================== //
  function injectMeatball(card) {
    var host = card.querySelector(BODY_SEL) || card;
    if (host.querySelector(':scope > .mc-meatball')) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var nameEl = card.querySelector(NAME_SEL);
    if (nameEl) nameEl.style.paddingRight = '44px';
    var btn = document.createElement('button');
    btn.className = 'mc-meatball';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Exercise actions');
    btn.innerHTML = '⋮<span class="mc-dot-ind"></span>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      openMenu(card);
    });
    host.appendChild(btn);
  }

  var hydrateTimer = null;

  function scan() {
    var cards = document.querySelectorAll(CARD_SEL);
    if (!cards.length) return;
    // One suppressed unit: inject buttons, re-apply saved order, then notes.
    // Re-entrant withoutObserver keeps applyOrder's internal suppression safe.
    withoutObserver(function () {
      Array.prototype.forEach.call(cards, injectMeatball);
      Array.prototype.forEach.call(cards, injectQuickActions);
      injectQuickPumpTrigger();
      var containers = [];
      Array.prototype.forEach.call(cards, function (c) {
        var p = c.parentElement;
        if (p && containers.indexOf(p) === -1) containers.push(p);
      });
      containers.forEach(applyOrder);
      Array.prototype.forEach.call(document.querySelectorAll(CARD_SEL), renderNote);
      Array.prototype.forEach.call(document.querySelectorAll(CARD_SEL), renderQuickActions);
      if (tempoEnabled()) Array.prototype.forEach.call(document.querySelectorAll(CARD_SEL), renderTempo);
      Array.prototype.forEach.call(document.querySelectorAll(CARD_SEL), renderSwapPill);
    });
  }

  function scheduleScan() {
    if (window.MC_SCAN) { window.MC_SCAN.schedule(); return; }
    clearTimeout(hydrateTimer);
    hydrateTimer = setTimeout(scan, 60);
  }

  function init() {
    buildChrome();
    // Phase 1: lazy-load the biomech substitution engine (pages don't include
    // it directly). Precached by the SW, so it's available offline too.
    if (!window.MCBiomech) {
      var bs = document.createElement('script');
      bs.src = 'mc-biomech.js'; bs.async = true;
      document.head.appendChild(bs);
    }
    if (!window.EXERCISES) {
      var cs = document.createElement('script');
      cs.src = 'exercise-catalog.js'; cs.async = true;
      document.head.appendChild(cs);
    }
    // 4.4: lazy-load opt-in voice control (mounts a small floating toggle;
    // stays silent/off until the trainee taps it — see mc-voice.js header).
    if (!window.MCVoice) {
      var vs = document.createElement('script');
      vs.src = 'mc-voice.js'; vs.async = true;
      document.head.appendChild(vs);
    }
    // C2: subscribe to the shared engine observer when available; else run our own
    if (window.MC_SCAN) {
      window.MC_SCAN.subscribe(scan);
      window.MC_SCAN.start();
    } else {
      mo = new MutationObserver(function () { scheduleScan(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    scan();
    // a couple of delayed passes catch render()/setTimeout-based pages
    setTimeout(scan, 300);
    setTimeout(scan, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
