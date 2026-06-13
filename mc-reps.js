/* ==========================================================================
   mc-reps.js  —  single source of truth for the workout reps display
   --------------------------------------------------------------------------
   Renders a sets string into the chip row shown on every workout/catalog card,
   identically on every page so the display never drifts (this logic was
   previously copy-pasted into 60+ HTML files in four diverging variants).

   Grammar of a sets string:
     '/'   separates superset legs            -> A / B leg tags
     ','   separates the sets                 -> chips joined by ·
     'amrap'                                  -> highlighted (special) chip
     drop chain (highlighted):
        'X drop Y'            -> X ↓ Y          (one drop set off X)
        'X drop Y & Z'        -> X ↓ Y ↓ Z      (two drops; '&' chains them)
        'X drop Y drop Z'     -> X ↓ Y ↓ Z      (repeated 'drop' also chains)

   Examples:
     '12,10,8,8 drop 12'      -> 12 · 10 · 8 · (8 ↓ 12)
     '12,10,8 drop 8 & 12'    -> 12 · 10 · (8 ↓ 8 ↓ 12)
     '8/12'                   -> A 8   B 12   (superset legs)

   Loaded synchronously (in <head>, before the page's inline render script) so
   window.aReps is defined by the time cards are built. Depends on nothing.
   ========================================================================== */
(function () {
  if (window.aReps) return;   // a page-local definition (if any) wins; avoid clobbering

  var ARROW = '<span class="a-drop-arrow" aria-label="drop to">↓</span>';

  // self-contained styling so the drop arrow renders consistently on every
  // page, including catalog pages that style .a-rep in their own <style> block
  // rather than linking base.css.
  try {
    var st = document.createElement('style');
    st.textContent = '.a-drop-arrow{display:inline-block;margin:0 4px;font-size:13px;' +
                     'font-weight:900;color:#fb7185;opacity:0.85;vertical-align:middle;}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  // Expand a single rep token into HTML. Drop chains become work ↓ d1 ↓ d2…;
  // anything else is returned unchanged.
  function repHTML(rep) {
    if (!/drop/i.test(rep)) return rep;
    var stages = rep.split(/\s*drop\s*/i);          // ['8', '8 & 12'] | ['8','8','12']
    var work = (stages.shift() || '').trim();
    var seq = work ? [work] : [];
    stages.forEach(function (stage) {
      stage.split('&').forEach(function (d) {
        d = d.trim();
        if (d) seq.push(d);
      });
    });
    if (!seq.length) return rep;
    return seq.join(ARROW);
  }

  function isSpecial(rep) { return /amrap|drop/i.test(rep); }

  function aReps(setsStr) {
    var legs = String(setsStr == null ? '—' : setsStr).split('/').map(function (s) { return s.trim(); });
    return legs.map(function (part, pi) {
      var reps = part.split(',').map(function (r) { return r.trim(); });
      var chips;
      if (reps.length > 1 && reps.every(function (r) { return r === reps[0]; })) {
        var rep = reps[0];
        var sp = isSpecial(rep) || rep.indexOf('×') >= 0;
        chips = '<span class="' + (sp ? 'a-rep special' : 'a-rep live') + '">' +
                  reps.length + '× ' + repHTML(rep) + '</span>';
      } else {
        chips = reps.map(function (rep, ri) {
          var sp = isSpecial(rep);
          var cls = sp ? 'a-rep special' : (ri === 0 ? 'a-rep live' : 'a-rep');
          var sep = ri < reps.length - 1 ? '<span class="a-sep">·</span>' : '';
          return '<span class="' + cls + '">' + repHTML(rep) + '</span>' + sep;
        }).join('');
      }
      var lt = legs.length > 1 ? '<span class="a-legtag">' + (pi === 0 ? 'A' : 'B') + '</span>' : '';
      return '<div class="a-leg">' + lt + chips + '</div>';
    }).join('');
  }

  window.aReps = aReps;
})();
