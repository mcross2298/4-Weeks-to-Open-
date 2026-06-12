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
  // engine. A page can opt OUT with window.MC_TEMPO_ENABLED = false. Tempo
  // notation + values are pulled from the STNDR program
  // (Eccentric : Pause-bottom : Concentric : Pause-top). A page can override
  // the menu with window.MC_TEMPO_OPTIONS = [{t:'3:0:1:0',d:'…'}, …].
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
        '<button class="mc-item" data-act="cues"><span class="mc-ico">📖</span>Form cues</button>' +
        '<button class="mc-item" data-act="replace"><span class="mc-ico">🔁</span>Replace exercise</button>' +
        '<button class="mc-item" data-act="reorder"><span class="mc-ico">↕️</span>Reorder exercises</button>' +
        tempoItem +
        '<button class="mc-item" data-act="notes"><span class="mc-ico">📝</span>Notes</button>' +
        '<button class="mc-item" data-act="pm" style="display:none"><span class="mc-ico">🛠️</span>Program Manager edit</button>' +
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
      else if (act === 'cues' && window.MCCues) MCCues.open(cardName(card));
      else if (act === 'reorder') startReorder(card);
      else if (act === 'notes') openNote(card);
      else if (act === 'tempo') openTempo(card);
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
    // owner-only item: visible only while Program Manager mode is unlocked
    var pmBtn = menuOverlay.querySelector('[data-act="pm"]');
    if (pmBtn) pmBtn.style.display = (window.MC_PM && window.MC_PM.active()) ? '' : 'none';
    menuOverlay.classList.add('open');
  }
  function closeMenu() { menuOverlay.classList.remove('open'); activeCard = null; }

  // ====================================================================== //
  //  REPLACE  (reuses existing flow)                                       //
  // ====================================================================== //
  function doReplace(card) {
    var name = cardName(card);
    if (!name) return;
    if (confirm('Replace "' + name.substring(0, 40) + '"?\nTap OK to open Exercise Library.')) {
      window.location.href = 'exercise-library.html?replace=' + encodeURIComponent(name);
    }
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
          withoutObserver(function () { renderNote(noteCard); });
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
  //  TEMPO  (optional on-demand intensifier · STNDR notation)              //
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
  //  REORDER                                                               //
  // ====================================================================== //
  function startReorder(card) {
    var container = card.parentElement;
    if (!container) return;
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
  //  INJECTION + HYDRATION                                                 //
  // ====================================================================== //
  function injectMeatball(card) {
    var host = card.querySelector(BODY_SEL) || card;
    if (host.querySelector(':scope > .mc-meatball')) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var nameEl = card.querySelector(NAME_SEL);
    if (nameEl) nameEl.style.paddingRight = '34px';
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
      var containers = [];
      Array.prototype.forEach.call(cards, function (c) {
        var p = c.parentElement;
        if (p && containers.indexOf(p) === -1) containers.push(p);
      });
      containers.forEach(applyOrder);
      Array.prototype.forEach.call(document.querySelectorAll(CARD_SEL), renderNote);
      if (tempoEnabled()) Array.prototype.forEach.call(document.querySelectorAll(CARD_SEL), renderTempo);
    });
  }

  function scheduleScan() {
    clearTimeout(hydrateTimer);
    hydrateTimer = setTimeout(scan, 60);
  }

  function init() {
    buildChrome();
    mo = new MutationObserver(function () { scheduleScan(); });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();
    // a couple of delayed passes catch render()/setTimeout-based pages
    setTimeout(scan, 300);
    setTimeout(scan, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
