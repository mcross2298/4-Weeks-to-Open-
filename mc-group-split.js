/* ==========================================================================
   mc-group-split.js  —  turn superset/triset exercises into hop-able rows
   --------------------------------------------------------------------------
   Two different authoring shapes both leave a superset/triset with nothing
   for mc-superset-hop.js to hop between, so this module rewrites both into
   the same .ss-card / .ss-ex structure that mc-setlog (per-set logging) and
   mc-superset-hop (the set-by-set hop) understand — with ZERO changes
   required to them:

     1. COMBO cards (push-pull-legs, bro-split, legacy-prep, weeks-to-open,
        arnold-legacy) author the pair/trio as a SINGLE card whose name is
        "A × B × C" and whose sets are "8,8,8 / 10,10,10 / 12,12,12".
        transformCombo() splits that one card's name/sets/tempo fields apart.
     2. SEPARATE-CARD engines (iron-engine.html's hand-written renderer,
        mm-engine.js / The Modality Matrix) give every grouped exercise its
        OWN full .ex-card, joined only by a shared is-ss/is-tri class and
        DOM adjacency (plus, cosmetically, a .group-banner divider between
        them). There's no "×" name to split — transformSiblingRun() instead
        walks forward through same-kind sibling .ex-card elements and merges
        the whole run into one .ss-card. Found via K-audit: both engines
        loaded this file (mm-p1/p2/p3) or mc-superset-hop.js directly
        (iron-engine.html), yet neither ever produced a .ss-card, so the
        hop/auto-expand-together behavior was silently dead on all of them —
        checking a set never advanced to the next station.

   This is the Concept-A revision. It:
     • matches the redesigned cards (.ex-card.is-ss / .is-tri / .is-cluster)
       as well as the legacy .superset / .triset classes,
     • styles the result in the Concept-A language via a scoping class (.a-ss)
       so PMC / MC stations keep their own look,
     • parses the program's rest string into a SHORT "between" rest (member→member
       inside a round) and a LONG "after" rest (the round break), and stamps them
       on the .ss-card as data-between / data-after so mc-superset-hop can pause
       for the right duration at each step. The final member's rest timer is set
       to the "after" value so the post-exercise rest is correct too.

   Safety: every card/run is transformed inside try/catch and only replaced
   if it resolves to >= 2 members. Anything ambiguous is left exactly as-is,
   so a parsing miss degrades to "no hop on that card", never a broken card.
   ========================================================================== */
/* MARKET:STRIP influencer-refs START */
/* Loaded fleet-wide on any grouped-exercise page, not just the four STNDR
   ones — see the two-shape header comment above. */
/* MARKET:STRIP influencer-refs END */
(function () {
  if (window.__mcGroupSplit) return;
  window.__mcGroupSplit = true;

  var DEFAULT_BETWEEN = 10;   // member→member pause when the data gives no "between"

  function txt(el) { return el ? el.textContent.trim() : ''; }
  function letter(i) { return String.fromCharCode(65 + i); } // A, B, C, ...
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ---- rest parsing: "between" (short) vs "after" (round break, long) --------
  function firstSecs(s) {
    s = String(s || '').toLowerCase();
    var mn = s.match(/(\d+)\s*min/), sc = s.match(/(\d+)\s*sec/), secs = 0;
    if (mn) secs += parseInt(mn[1], 10) * 60;
    if (sc) secs += parseInt(sc[1], 10);
    if (!secs) { var p = s.match(/(\d+)/); if (p) secs = parseInt(p[1], 10); }
    return secs || 0;
  }
  function num(re, s) { var m = s.match(re); return m ? parseInt(m[1], 10) : null; }
  function parseRest(raw) {
    var s = String(raw || '').toLowerCase().trim();
    if (!s || s === '—') return { between: DEFAULT_BETWEEN, after: DEFAULT_BETWEEN };
    var both = num(/(\d+)\s*sec\s*between\s*&\s*after/, s);
    if (both != null) return { between: both, after: both };
    var b = num(/(\d+)\s*sec\s*between/, s);
    if (b == null) b = num(/(\d+)\s*sec\s*b\/t/, s);
    if (b == null) b = num(/(\d+)\s*b\/t/, s);
    var a = num(/(\d+)\s*sec\s*(?:&\s*)?after/, s);
    if (a == null && s.indexOf('/') >= 0) a = firstSecs(s.split('/')[0]); // "60 sec / 15 b/t"
    if (a == null) a = firstSecs(s) || null;                              // plain "180 sec"
    if (b == null) b = DEFAULT_BETWEEN;
    if (a == null) a = b;
    return { between: b, after: a };
  }

  function restTimerNode(rest, name) {
    if (typeof makeRestTimer === 'function') {
      var d = document.createElement('div');
      d.innerHTML = makeRestTimer(rest || '120 sec', name || '');
      if (d.firstChild) return d.firstChild;
    }
    var s = document.createElement('span');
    s.className = 'rest-timer idle';
    s.setAttribute('data-rest', rest || '120 sec');
    // Same static-prescription wording as every other chip in the fleet (see
    // mc-timer.js's makeRestTimer). This one carries no data-secs, so the
    // delegated listener never picks it up — it was always display-only.
    s.innerHTML = '<span class="rest-timer-icon">⏱️</span>' +
                  '<span class="rest-timer-label">Rest: ' + (rest || '120 sec') + '</span>';
    return s;
  }

  // Concept-A hero reps for one station ("8,8,8" -> 8 · 8 · 8, first set lit).
  function heroReps(sets) {
    var reps = String(sets || '').split(',').map(function (r) { return r.trim(); }).filter(Boolean);
    if (!reps.length) return '';
    return '<div class="a-ss-reps">' + reps.map(function (r, i) {
      var special = /amrap/i.test(r) || /drop/i.test(r) || r.indexOf('×') >= 0;
      var cls = special ? 'a-rep special' : (i === 0 ? 'a-rep live' : 'a-rep');
      var sep = i < reps.length - 1 ? '<span class="a-sep">·</span>' : '';
      return '<span class="' + cls + '">' + esc(r) + '</span>' + sep;
    }).join('') + '</div>';
  }

  function row(name, sets, tempo, restAfterStr, id, idx, isLast) {
    var ex = document.createElement('div');
    ex.className = 'ss-ex';
    ex.setAttribute('data-type', 'ssex');
    if (id) ex.setAttribute('data-id', id);

    var num_ = document.createElement('div');
    num_.className = 'ss-num';
    num_.textContent = letter(idx);

    var content = document.createElement('div');
    content.className = 'ss-content';

    var nm = document.createElement('div');
    nm.className = 'ss-name';
    nm.textContent = name;
    content.appendChild(nm);

    // Concept-A hero reps (visible) …
    if (sets) {
      var hero = document.createElement('div');
      hero.innerHTML = heroReps(sets);
      if (hero.firstChild) content.appendChild(hero.firstChild);
    }
    // … plus the raw scheme kept for mc-setlog / mc-summary (single .ex-sets,
    //    hidden so it doesn't duplicate the hero).
    var tags = document.createElement('div');
    tags.className = 'ex-tags a-ss-sets-hidden';
    var st = document.createElement('span');
    st.className = 'ex-sets';
    st.textContent = sets || '';
    tags.appendChild(st);
    content.appendChild(tags);

    if (tempo) {
      var note = document.createElement('div');
      note.className = 'ex-note a-ss-tempo';
      note.textContent = '⏱ ' + tempo;
      content.appendChild(note);
    }
    // One rest timer, on the final row — carries the LONG "after" rest so the
    // logger's auto-countdown after the last set is the real round/exercise rest.
    if (isLast) {
      var rest_ = document.createElement('div');
      rest_.className = 'ex-rest';
      rest_.appendChild(restTimerNode(restAfterStr, name));
      content.appendChild(rest_);
    }

    ex.appendChild(num_);
    ex.appendChild(content);

    // Tap-to-check-off parity with PMC rows (ignores logger / inputs / timer).
    ex.addEventListener('click', function (e) {
      if (e.target.closest('.mcl-toggle,.mcl-wrap,.mcl-ck,.mcl-inp,.setlog-toggle,' +
        '.setlog-wrap,.sl-inp,.rest-timer,input,button,a,select,textarea')) return;
      ex.classList.toggle('checked');
    });
    return ex;
  }

  // Builds the shared .ss-card wrapper (header + members + dividers) given
  // an already-resolved list of {name, sets, tempo} members. Both authoring
  // shapes converge on this one builder, so the output markup — and every
  // downstream consumer of it — cannot drift between the two.
  function buildGroup(members, tri, restRaw, idBase) {
    var rest = parseRest(restRaw);
    var ssCard = document.createElement('div');
    ssCard.className = 'ss-card a-ss' + (tri ? ' is-tri' : '');
    // the hop reads these to pause for the right duration at each step
    ssCard.setAttribute('data-between', rest.between);
    ssCard.setAttribute('data-after', rest.after);

    var hd = document.createElement('div');
    hd.className = 'ss-header';
    var lbl = document.createElement('span');
    lbl.className = 'ss-label';
    lbl.textContent = (tri ? '⚡ Triset' : '⚡ Superset');
    hd.appendChild(lbl);
    var rl = document.createElement('span');
    rl.className = 'ss-rests';
    rl.textContent = rest.between + 's between · ' + rest.after + 's after';
    hd.appendChild(rl);
    ssCard.appendChild(hd);

    var afterStr = rest.after + ' sec';
    var dividerLabel = (tri ? '× TRISET ×' : '× SUPERSET ×');
    members.forEach(function (m, i) {
      var isLast = (i === members.length - 1);
      ssCard.appendChild(row(m.name, m.sets, m.tempo, afterStr, idBase + '-' + i, i, isLast));
      if (!isLast) {
        var dv = document.createElement('div');
        dv.className = 'ss-divider';
        var dx = document.createElement('span');
        dx.className = 'ss-x';
        dx.textContent = dividerLabel;
        dv.appendChild(dx);
        var bt = document.createElement('span');
        bt.className = 'ss-btw';
        bt.textContent = '↺ ' + rest.between + 's';
        dv.appendChild(bt);
        ssCard.appendChild(dv);
      }
    });
    return ssCard;
  }

  function cardName(card) {
    return txt(card.querySelector('.ex-name .editable') || card.querySelector('.ex-name'));
  }
  function cardSets(card) {
    return txt(card.querySelector('[data-field="sets"]') ||
               card.querySelector('.a-cell .editable[data-field="sets"]') ||
               card.querySelector('.notes-row'));
  }
  function cardRest(card) {
    return txt(card.querySelector('[data-field="rest"]')) || '120 sec';
  }
  // tempo: Concept-A uses .a-pill.tempo ("⏱ 3:1:1:0"); legacy uses .tempo-chip.
  function cardTempos(card) {
    var tempoEls = card.querySelectorAll('.a-pill.tempo, .tempo-chip');
    return Array.prototype.map.call(tempoEls, function (c) {
      var m = c.textContent.match(/[\d:]+/); return m ? m[0] : '';
    }).filter(Boolean);
  }
  function groupIdBase(card, rawName) {
    var ed = card.querySelector('.editable[data-field="name"]');
    var dI = ed ? ed.getAttribute('data-d') : null;
    var eI = ed ? ed.getAttribute('data-e') : null;
    return (dI != null && eI != null)
      ? ('grp-' + dI + '-' + eI)
      : ('grp-' + rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24));
  }

  // A card is TRI-SET-kind under either authoring convention: iron-engine.html
  // and mm-engine.js stamp "is-triset" (plus a generic "is-ss"); the combo-card
  // pages and mc-freq-engine-style pages stamp "is-tri". "triset" is the older
  // legacy class name kept for backward compatibility.
  function isTriCard(c) {
    return c.classList.contains('is-triset') || c.classList.contains('is-tri') ||
           c.classList.contains('triset');
  }
  // A card is SUPERSET-kind if it carries "is-superset" (iron-engine/mm), or
  // carries the shared "is-ss" class without ALSO being tri-kind (every
  // convention above uses is-ss as the umbrella "grouped, not cluster/drop"
  // marker, with is-tri/is-triset narrowing it down to tri-set specifically).
  function isSupersetCard(c) {
    return c.classList.contains('is-superset') ||
           (c.classList.contains('is-ss') && !isTriCard(c)) ||
           c.classList.contains('superset');
  }

  // ---- shape 1: one card named "A × B × C" -------------------------------
  function transformCombo(card, rawName) {
    var names = rawName.split('×').map(function (s) { return s.trim(); }).filter(Boolean);
    if (names.length < 2) return;                          // nothing to hop between

    var rawSets = cardSets(card);
    var setGroups = rawSets ? rawSets.split('/').map(function (s) { return s.trim(); }) : [];
    var restRaw = cardRest(card);
    var tempos = cardTempos(card);
    var tri = card.classList.contains('triset') || names.length >= 3;
    var idBase = groupIdBase(card, rawName);

    var members = names.map(function (nm, i) {
      return {
        name: nm,
        sets: setGroups.length ? (setGroups[i] != null ? setGroups[i] : setGroups[setGroups.length - 1]) : rawSets,
        tempo: tempos.length ? (tempos[i] != null ? tempos[i] : tempos[0]) : ''
      };
    });

    var ssCard = buildGroup(members, tri, restRaw, idBase);
    if (card.parentNode) card.parentNode.replaceChild(ssCard, card);
  }

  // ---- shape 2: one .ex-card PER member, joined only by a shared is-ss/
  // is-tri class + DOM adjacency (iron-engine.html, mm-engine.js) ----------
  function transformSiblingRun(card) {
    var tri = isTriCard(card), ss = isSupersetCard(card);
    if (!tri && !ss) return;                  // cluster/drop: single station, never grouped

    // Collect this card + every immediately-following .ex-card sibling that
    // shares the same kind, skipping non-card nodes in between (the cosmetic
    // .group-banner divider these engines render between grouped exercises).
    // Stops at the first .ex-card of a different kind (the next exercise/group).
    var members = [card];
    var sib = card.nextElementSibling;
    while (sib) {
      if (sib.classList && sib.classList.contains('ex-card')) {
        var sameKind = tri ? isTriCard(sib) : (isSupersetCard(sib) && !isTriCard(sib));
        if (!sameKind) break;
        members.push(sib);
      }
      sib = sib.nextElementSibling;
    }
    if (members.length < 2) return;            // solo card — nothing to hop between

    // The real round-rest is authored on the LAST member only (both engines'
    // data give every earlier member rest:"—", meaning "no standalone rest,
    // handled by the group") -- reading the first member here would silently
    // replace a real "2 min" round rest with the 10s default, the exact
    // regression this file's own header comment already names once
    // (kitchen-sink.html, before the derive-from-last-member fix).
    var restRaw = cardRest(members[members.length - 1]);
    var rawName = cardName(card);
    var idBase = groupIdBase(card, rawName);
    var rowMembers = members.map(function (m) {
      return { name: cardName(m), sets: cardSets(m), tempo: cardTempos(m)[0] || '' };
    });

    var ssCard = buildGroup(rowMembers, tri, restRaw, idBase);

    // Drop the .group-banner sitting immediately before the FIRST member —
    // it's the divider this run's own tag introduced; ss-header/ss-divider
    // above supersede it. Members after the first are simply removed along
    // with any banner immediately preceding them (there shouldn't be one,
    // since same-kind runs don't re-print the banner between their own
    // members, but a defensive check costs nothing).
    members.forEach(function (m) {
      var prevBanner = m.previousElementSibling;
      if (prevBanner && prevBanner.classList && prevBanner.classList.contains('group-banner')) {
        prevBanner.parentNode.removeChild(prevBanner);
      }
    });
    if (card.parentNode) card.parentNode.replaceChild(ssCard, card);
    members.slice(1).forEach(function (m) {
      if (m.parentNode) m.parentNode.removeChild(m);
    });
  }

  function transform(card) {
    try {
      if (!card.parentNode) return;            // already consumed by an earlier run merge
      var grouped = card.classList.contains('is-ss') || card.classList.contains('is-tri') ||
                    card.classList.contains('is-cluster') ||
                    card.classList.contains('superset') || card.classList.contains('triset');
      if (!grouped) return;

      var rawName = cardName(card);
      if (rawName.indexOf('×') >= 0) { transformCombo(card, rawName); return; }
      transformSiblingRun(card);
    } catch (e) { /* leave the original card(s) untouched on any parse failure */ }
  }

  function run() {
    var cards = document.querySelectorAll(
      '.ex-card.is-ss, .ex-card.is-tri, .ex-card.is-cluster, .ex-card.superset, .ex-card.triset');
    Array.prototype.forEach.call(cards, transform);
  }

  // A-13: shared render signal instead of a private observer + ladder.
  function init() {
    if (window.MC_SCAN && MC_SCAN.subscribe) {
      MC_SCAN.subscribe(run); MC_SCAN.start(); MC_SCAN.schedule();
    } else {
      var t;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 120); })
        .observe(document.body, { childList: true, subtree: true });
      setTimeout(run, 600);
    }
    run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
