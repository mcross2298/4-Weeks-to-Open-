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

  function applyToCard(card) {
    var nameEl = card.querySelector(NAME_SEL);
    if (!nameEl) return;
    var origName = card.getAttribute('data-mc-orig-name') || nameEl.textContent.trim();
    var o = overrideFor(cardKey(card));               // page-level override (per-card; highest priority)
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
        'background:rgba(34,211,238,0.12);color:#22d3ee;border:1px solid rgba(34,211,238,0.32);}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- public API (used by program-manager.js and mc-naming.js) -----------
  window.MC_PO = {
    pageId: PAGE_ID,
    refresh: scan,
    cardKey: cardKey,
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
