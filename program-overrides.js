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

  var CARD_SEL = '.ex-card, .ex-item, .lift-card, .ss-ex';
  var NAME_SEL = '.ex-name, .lift-name, .var-name, .ss-name';
  var BODY_SEL = '.ex-body, .ss-content';
  var PAGE_ID  = (location.pathname.split('/').pop() || 'index.html').split('?')[0];

  var LOCAL_KEY = 'mc_pm_overrides';      // { pages: { pageId: { origName: {...} } } }
  var JSON_URL  = 'program-overrides.json';

  var published = { pages: {} };
  var mo = null, obsDepth = 0, scanTimer = null;
  // original card values captured before the first override application,
  // so clearing an override reverts live without a reload
  var snapshots = new WeakMap();

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { pages: {} }; }
    catch (e) { return { pages: {} }; }
  }
  function writeLocal(obj) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  // merged view: published overlaid with the local working copy
  function effective() {
    var out = { pages: {} }, src, pid, nm;
    [published, readLocal()].forEach(function (layer) {
      src = (layer && layer.pages) || {};
      for (pid in src) {
        if (!out.pages[pid]) out.pages[pid] = {};
        for (nm in src[pid]) out.pages[pid][nm] = src[pid][nm];
      }
    });
    return out;
  }

  function overrideFor(origName) {
    var page = effective().pages[PAGE_ID];
    if (!page) return null;
    var o = page[origName];
    if (!o) {
      // tolerate whitespace/case drift between authored HTML and saved key
      var want = origName.trim().toLowerCase(), k;
      for (k in page) if (k.trim().toLowerCase() === want) { o = page[k]; break; }
    }
    return (o && !o.reset) ? o : null;
  }

  function withoutObserver(fn) {
    if (mo && obsDepth === 0) mo.disconnect();
    obsDepth++;
    try { fn(); }
    finally {
      obsDepth--;
      if (mo && obsDepth === 0) { mo.takeRecords(); mo.observe(document.body, { childList: true, subtree: true }); }
    }
  }

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

  function applyToCard(card) {
    var nameEl = card.querySelector(NAME_SEL);
    if (!nameEl) return;
    var origName = card.getAttribute('data-mc-orig-name') || nameEl.textContent.trim();
    var o = overrideFor(origName);
    var body = card.querySelector(BODY_SEL) || card;
    var noteEl = card.querySelector('.mcpo-note');
    var tempoEl = card.querySelector('.mcpo-tempo');

    if (!o) {
      // no (or cleared) override — revert anything we previously painted
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

    if (o.name) setText(nameEl, o.name);

    if (o.sets) {
      var se = card.querySelector('[data-field="sets"]') || card.querySelector('.ex-sets');
      if (se) setText(se, o.sets);
      // premier MC/PMC cards render set chips from the page's own aReps()
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
  }

  function scan() {
    var cards = document.querySelectorAll(CARD_SEL);
    if (!cards.length) return;
    withoutObserver(function () {
      Array.prototype.forEach.call(cards, applyToCard);
    });
  }
  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 80); }

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
        'background:rgba(34,211,238,0.12);color:#22d3ee;border:1px solid rgba(34,211,238,0.32);}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- public API (used by program-manager.js) ----------------------------
  window.MC_PO = {
    pageId: PAGE_ID,
    refresh: scan,
    published: function () { return published; },
    local: readLocal,
    setLocal: function (obj) { writeLocal(obj || { pages: {} }); scan(); },
    effective: effective,
    // merged export view: local edits over published, reset entries dropped
    exportData: function () {
      var eff = effective(), pages = {}, pid, nm, any;
      for (pid in eff.pages) {
        any = false;
        for (nm in eff.pages[pid]) {
          if (eff.pages[pid][nm] && !eff.pages[pid][nm].reset) {
            if (!pages[pid]) pages[pid] = {};
            pages[pid][nm] = eff.pages[pid][nm];
            any = true;
          }
        }
      }
      return { version: 1, updated: new Date().toISOString(), pages: pages };
    }
  };

  // committed JSON fallback: used offline, or when Supabase isn't configured/
  // reachable. cache:'no-store' + the network-first SW means a freshly
  // committed file is still picked up on the next load.
  function loadFromJSON() {
    return fetch(JSON_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.pages) { published = data; scan(); }
      })
      .catch(function () {});
  }

  // Published overrides come from Supabase (live; one-tap publish reaches all
  // users); the committed JSON is the offline/fallback source. This module
  // stays agnostic — it just paints whatever `published` holds.
  function loadPublished() {
    if (window.MC_SB && MC_SB.configured) {
      return MC_SB.getOverrides()
        .then(function (data) {
          if (data && data.pages) { published = data; scan(); }
          else return loadFromJSON();
          // live updates: re-paint when the owner publishes from another device
          MC_SB.onChange(function () {
            MC_SB.getOverrides().then(function (d) { if (d && d.pages) { published = d; scan(); } }).catch(function () {});
          });
        })
        .catch(function () { return loadFromJSON(); });
    }
    return loadFromJSON();
  }

  function init() {
    injectStyles();
    mo = new MutationObserver(scheduleScan);
    mo.observe(document.body, { childList: true, subtree: true });
    scan();
    setTimeout(scan, 300);
    setTimeout(scan, 800);
    loadPublished();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
