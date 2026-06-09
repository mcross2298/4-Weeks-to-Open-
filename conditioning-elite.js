/* ==========================================================================
   conditioning-elite.js — Elite Conditioning Corner behaviors
   --------------------------------------------------------------------------
   The "full experience" layer on top of conditioning-elite.css:
     • Card entrance — staggered scroll-reveal so the workout feels produced.
     • Completion celebration — a confetti burst + glow pulse (+ haptic) when a
       step/round/finisher is marked complete. Bigger burst for finishers.
   Purely additive: it reads the page's existing completion buttons / done
   state and never alters timers, counters, or logic. Safe on any page (no-op
   unless body.cond-elite is present). Self-contained IIFE.
   ========================================================================== */
(function () {
  if (window.__condElite) return;
  window.__condElite = true;

  var CARD_SEL = '.step-card,.burn-card,.bp-card,.fin-card,.section-card,.cfg-card,.total-card';
  var DONE_BTN = '.complete-btn,.pstep-complete,.burn-complete,.complete-set-btn';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // ── staggered scroll-reveal ──────────────────────────────────────────
  var io = null;
  function reveal() {
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('ce-in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.08 });
    }
    var cards = document.querySelectorAll(CARD_SEL), i = 0;
    cards.forEach(function (c) {
      if (c.classList.contains('ce-reveal')) return;
      c.classList.add('ce-reveal');
      c.style.transitionDelay = Math.min(i * 40, 240) + 'ms';
      io.observe(c);
      i++;
    });
    // Safety net: never leave a card permanently hidden if it never intersects.
    setTimeout(function () {
      document.querySelectorAll('.ce-reveal:not(.ce-in)').forEach(function (c) { c.classList.add('ce-in'); });
    }, 1800);
  }

  // ── celebration ──────────────────────────────────────────────────────
  function confettiAt(x, y, big) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var n = big ? 28 : 16, colors = ['#ef4444', '#f87171', '#34d399', '#fbbf24', '#ffffff'];
    for (var i = 0; i < n; i++) {
      var p = document.createElement('div');
      var ang = Math.random() * Math.PI * 2, dist = (big ? 130 : 85) * (0.5 + Math.random());
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 45;
      p.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;width:8px;height:8px;' +
        'border-radius:2px;z-index:99999;pointer-events:none;background:' + colors[i % colors.length] + ';';
      document.body.appendChild(p);
      (function (el) {
        el.animate(
          [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
           { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (Math.random() * 540) + 'deg)', opacity: 0 }],
          { duration: 700 + Math.random() * 420, easing: 'cubic-bezier(.2,.7,.3,1)' }
        ).onfinish = function () { el.remove(); };
      })(p);
    }
  }

  function celebrate(card, big) {
    if (card) {
      card.classList.add('ce-celebrate');
      setTimeout(function () { card.classList.remove('ce-celebrate'); }, 850);
    }
    var x = window.innerWidth / 2, y = Math.min(window.innerHeight / 2, 260);
    if (card) { var r = card.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + Math.min(r.height / 2, 170); }
    confettiAt(x, y, big);
    try { if (navigator.vibrate) navigator.vibrate(big ? [40, 40, 90] : 30); } catch (e) {}
  }

  function onClick(e) {
    var btn = e.target.closest && e.target.closest(DONE_BTN);
    if (!btn) return;
    // Let the page's own handler toggle done state first, then check it.
    setTimeout(function () {
      var card = btn.closest(CARD_SEL);
      var txt = btn.textContent || '';
      var cls = (card ? card.className : '') + ' ' + txt;
      // Only fire when completing (not un-completing).
      var done = /✓|done|complete/i.test(txt) || (card && /\bis-done\b|\bdone\b/.test(card.className));
      if (done) celebrate(card, /finish|finisher/i.test(cls));
    }, 40);
  }

  ready(function () {
    if (!document.body.classList.contains('cond-elite')) return;
    reveal();
    document.addEventListener('click', onClick, true);
    var t = null;
    var mo = new MutationObserver(function () { clearTimeout(t); t = setTimeout(reveal, 150); });
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();
