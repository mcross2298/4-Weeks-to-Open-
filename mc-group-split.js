/* ==========================================================================
   mc-group-split.js  —  split combined superset/triset cards into hop-able rows
   --------------------------------------------------------------------------
   A few programs (push-pull-legs, bro-split, legacy-prep, weeks-to-open) render
   a superset/triset as a SINGLE card whose name is "A × B × C" and whose sets
   are "3×8 / 3×12 / 3×15". With one card there is nothing to hop between.

   This module rewrites each such card into the same .ss-card / .ss-ex structure
   the PMC pages use, so mc-setlog (per-set logging) and mc-superset-hop (the
   set-by-set hop) both work with zero changes to them.

   Safety: every card is transformed inside try/catch and only replaced if it
   parses into >= 2 named parts. Anything ambiguous is left exactly as-is, so a
   parsing miss degrades to "no hop on that card", never a broken card.
   ========================================================================== */
(function () {
  if (window.__mcGroupSplit) return;
  window.__mcGroupSplit = true;

  function txt(el) { return el ? el.textContent.trim() : ''; }
  function letter(i) { return String.fromCharCode(65 + i); } // A, B, C, ...

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

  function row(name, sets, tempo, rest, id, idx, isLast) {
    var ex = document.createElement('div');
    ex.className = 'ss-ex';
    ex.setAttribute('data-type', 'ssex');
    if (id) ex.setAttribute('data-id', id);

    var num = document.createElement('div');
    num.className = 'ss-num';
    num.textContent = letter(idx);

    var content = document.createElement('div');
    content.className = 'ss-content';

    var nm = document.createElement('div');
    nm.className = 'ss-name';
    nm.textContent = name;
    content.appendChild(nm);

    var tags = document.createElement('div');
    tags.className = 'ex-tags';
    var st = document.createElement('span');
    st.className = 'ex-sets';
    st.textContent = sets || '';
    tags.appendChild(st);
    content.appendChild(tags);

    if (tempo) {
      var note = document.createElement('div');
      note.className = 'ex-note';
      note.textContent = 'Tempo ' + tempo;
      content.appendChild(note);
    }
    // One rest timer, on the final row (rest comes after the whole group).
    if (isLast) {
      var rest_ = document.createElement('div');
      rest_.className = 'ex-rest';
      rest_.appendChild(restTimerNode(rest, name));
      content.appendChild(rest_);
    }

    ex.appendChild(num);
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
      var isSuper = card.classList.contains('superset');
      var isTri = card.classList.contains('triset');
      if (!isSuper && !isTri) return;

      var rawName = txt(card.querySelector('.ex-name .editable') || card.querySelector('.ex-name'));
      if (rawName.indexOf('×') < 0) return;                 // not a grouped name
      var names = rawName.split('×').map(function (s) { return s.trim(); }).filter(Boolean);
      if (names.length < 2) return;                          // nothing to hop between

      var rawSets = txt(card.querySelector('[data-field="sets"]') || card.querySelector('.notes-row'));
      var setGroups = rawSets ? rawSets.split('/').map(function (s) { return s.trim(); }) : [];
      var rest = txt(card.querySelector('[data-field="rest"]')) || '120 sec';
      var tempos = Array.prototype.map.call(
        card.querySelectorAll('.tempo-chip'), function (c) { return c.textContent.trim(); });

      var tri = isTri || names.length >= 3;
      var ed = card.querySelector('.editable[data-field="name"]');
      var dI = ed ? ed.getAttribute('data-d') : null;
      var eI = ed ? ed.getAttribute('data-e') : null;
      var base = (dI != null && eI != null)
        ? ('grp-' + dI + '-' + eI)
        : ('grp-' + rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24));

      var ssCard = document.createElement('div');
      ssCard.className = 'ss-card';
      var hd = document.createElement('div');
      hd.className = 'ss-header';
      var lbl = document.createElement('span');
      lbl.className = 'ss-label';
      lbl.textContent = tri ? '⚡ Triset' : '⚡ Superset';
      hd.appendChild(lbl);
      ssCard.appendChild(hd);

      var dividerLabel = tri ? '× TRISET ×' : '× SUPERSET ×';
      names.forEach(function (nm, i) {
        var sets = setGroups.length
          ? (setGroups[i] != null ? setGroups[i] : setGroups[setGroups.length - 1])
          : rawSets;
        var tempo = tempos.length ? (tempos[i] != null ? tempos[i] : tempos[0]) : '';
        var isLast = (i === names.length - 1);
        ssCard.appendChild(row(nm, sets, tempo, rest, base + '-' + i, i, isLast));
        if (!isLast) {
          var dv = document.createElement('div');
          dv.className = 'ss-divider';
          var dx = document.createElement('span');
          dx.className = 'ss-x';
          dx.textContent = dividerLabel;
          dv.appendChild(dx);
          ssCard.appendChild(dv);
        }
      });

      if (card.parentNode) card.parentNode.replaceChild(ssCard, card);
    } catch (e) { /* leave the original card untouched on any parse failure */ }
  }

  function run() {
    var cards = document.querySelectorAll('.ex-card.superset, .ex-card.triset');
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
