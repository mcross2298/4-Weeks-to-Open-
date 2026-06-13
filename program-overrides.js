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

  var LOCAL_KEY = 'mc_pm_overrides';      // v2: { pages, exercises, programs, splits, badges }
  var JSON_URL  = 'program-overrides.json';

  function emptyDoc() { return { pages: {}, exercises: {}, programs: {}, splits: {}, badges: {} }; }

  var published = emptyDoc();
  var mo = null, obsDepth = 0, scanTimer = null;
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

  // merged view: published overlaid with the local working copy (all v2 sections)
  function effective() {
    var out = emptyDoc();
    var flatSecs = ['exercises', 'programs', 'splits', 'badges'];
    var pid, nm, k, i;
    [published, readLocal()].forEach(function (layer) {
      var psrc = (layer && layer.pages) || {};
      for (pid in psrc) {
        if (!out.pages[pid]) out.pages[pid] = {};
        for (nm in psrc[pid]) out.pages[pid][nm] = psrc[pid][nm];
      }
      for (i = 0; i < flatSecs.length; i++) {
        var sec = flatSecs[i];
        var src = (layer && layer[sec]) || {};
        for (k in src) out[sec][k] = src[k];
      }
    });
    return out;
  }

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
    var o = overrideFor(origName);                    // page-level override (highest priority)
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

  // ---- public API (used by program-manager.js and mc-naming.js) -----------
  window.MC_PO = {
    pageId: PAGE_ID,
    refresh: scan,
    published: function () { return published; },
    local: readLocal,
    setLocal: function (obj) {
      writeLocal(obj || emptyDoc());
      scan();
      dispatchNamesChanged();
    },
    effective: effective,
    globalExerciseName: globalExerciseName,
    // merged export view: local edits over published, reset entries dropped
    exportData: function () {
      var eff = effective(), pages = {}, pid, nm;
      for (pid in eff.pages) {
        for (nm in eff.pages[pid]) {
          if (eff.pages[pid][nm] && !eff.pages[pid][nm].reset) {
            if (!pages[pid]) pages[pid] = {};
            pages[pid][nm] = eff.pages[pid][nm];
          }
        }
      }
      function filterFlat(src) {
        var dst = {}, k;
        for (k in src) { if (src[k] && !src[k].reset) dst[k] = src[k]; }
        return dst;
      }
      return {
        version: 2,
        updated: new Date().toISOString(),
        pages: pages,
        exercises: filterFlat(eff.exercises),
        programs: filterFlat(eff.programs),
        splits:   filterFlat(eff.splits),
        badges:   filterFlat(eff.badges)
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
            badges:    data.badges    || {}
          };
          scan();
          dispatchNamesChanged();
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
                scan();
                dispatchNamesChanged();
                if (typeof MC_SB.onNamingChange === 'function') {
                  MC_SB.onNamingChange(function () {
                    MC_SB.getNaming()
                      .then(function (n) {
                        if (!n) return;
                        published.exercises = n.exercises || {};
                        published.programs  = n.programs  || {};
                        published.splits    = n.splits    || {};
                        published.badges    = n.badges    || {};
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
    mo = new MutationObserver(scheduleScan);
    mo.observe(document.body, { childList: true, subtree: true });
    scan();
    setTimeout(scan, 300);
    setTimeout(scan, 800);
    loadPublished();
    // dynamically load mc-naming.js so naming resolver is available on all
    // pages without modifying each workout HTML file
    if (!window.MC_NAMES) {
      var s = document.createElement('script');
      s.src = 'mc-naming.js';
      document.head.appendChild(s);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
