/* ==========================================================================
   mc-group-split.js  —  split combined superset/triset cards into hop-able rows
   --------------------------------------------------------------------------
   A few programs (push-pull-legs, bro-split, legacy-prep, weeks-to-open) author
   a superset/triset as a SINGLE card whose name is "A × B × C" and whose sets
   are "8,8,8 / 10,10,10 / 12,12,12". With one card there is nothing to hop
   between, so this module rewrites each such card into the .ss-card / .ss-ex
   structure that mc-setlog (per-set logging) and mc-superset-hop (the set-by-set
   hop) both understand — with ZERO changes required to them.

   This is the Concept-A revision. It:
     • matches the redesigned cards (.ex-card.is-ss / .is-cluster) as well as the
       legacy .superset / .triset classes,
     • styles the result in the Concept-A language via a scoping class (.a-ss) so
       PMC / MC stations keep their own look,
     • parses the program's rest string into a SHORT "between" rest (member→member
       inside a round) and a LONG "after" rest (the round break), and stamps them
       on the .ss-card as data-between / data-after so mc-superset-hop can pause
       for the right duration at each step. The final member's rest timer is set
       to the "after" value so the post-exercise rest is correct too.

   Safety: every card is transformed inside try/catch and only replaced if it
   parses into >= 2 named parts. Anything ambiguous is left exactly as-is, so a
   parsing miss degrades to "no hop on that card", never a broken card. Only the
   four STNDR pages load this file.
   ========================================================================== */
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
    s.innerHTML = '<span class="rest-timer-icon">⏱️</span>' +
                  '<span class="rest-timer-label">' + (rest || '120 sec') + '</span>';
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
        '.setlog-wrap,.sl-ck,.sl-inp,.rest-timer,input,button,a,select,textarea')) return;
      ex.classList.toggle('checked');
    });
    return ex;
  }

  function transform(card) {
    try {
      var grouped = card.classList.contains('is-ss') || card.classList.contains('is-cluster') ||
                    card.classList.contains('superset') || card.classList.contains('triset');
      if (!grouped) return;

      var rawName = txt(card.querySelector('.ex-name .editable') || card.querySelector('.ex-name'));
      if (rawName.indexOf('×') < 0) return;             // not a grouped name
      var names = rawName.split('×').map(function (s) { return s.trim(); }).filter(Boolean);
      if (names.length < 2) return;                          // nothing to hop between

      var rawSets = txt(card.querySelector('[data-field="sets"]') ||
                        card.querySelector('.a-cell .editable[data-field="sets"]') ||
                        card.querySelector('.notes-row'));
      var setGroups = rawSets ? rawSets.split('/').map(function (s) { return s.trim(); }) : [];
      var restRaw = txt(card.querySelector('[data-field="rest"]')) || '120 sec';
      var rest = parseRest(restRaw);
      // tempo: Concept-A uses .a-pill.tempo ("⏱ 3:1:1:0"); legacy uses .tempo-chip.
      var tempoEls = card.querySelectorAll('.a-pill.tempo, .tempo-chip');
      var tempos = Array.prototype.map.call(tempoEls, function (c) {
        var m = c.textContent.match(/[\d:]+/); return m ? m[0] : '';
      }).filter(Boolean);

      var tri = card.classList.contains('triset') || names.length >= 3;
      var ed = card.querySelector('.editable[data-field="name"]');
      var dI = ed ? ed.getAttribute('data-d') : null;
      var eI = ed ? ed.getAttribute('data-e') : null;
      var base = (dI != null && eI != null)
        ? ('grp-' + dI + '-' + eI)
        : ('grp-' + rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24));

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
      names.forEach(function (nm, i) {
        var sets = setGroups.length
          ? (setGroups[i] != null ? setGroups[i] : setGroups[setGroups.length - 1])
          : rawSets;
        var tempo = tempos.length ? (tempos[i] != null ? tempos[i] : tempos[0]) : '';
        var isLast = (i === names.length - 1);
        ssCard.appendChild(row(nm, sets, tempo, afterStr, base + '-' + i, i, isLast));
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

      if (card.parentNode) card.parentNode.replaceChild(ssCard, card);
    } catch (e) { /* leave the original card untouched on any parse failure */ }
  }

  function run() {
    var cards = document.querySelectorAll(
      '.ex-card.is-ss, .ex-card.is-cluster, .ex-card.superset, .ex-card.triset');
    Array.prototype.forEach.call(cards, transform);
  }

  function init() {
    run();
    [150, 500, 1200, 2500].forEach(function (d) { setTimeout(run, d); });
    var t;
    var mo = new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 120); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
