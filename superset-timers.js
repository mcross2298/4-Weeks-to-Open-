/**
 * superset-timers.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 5 — Automated Superset Timer Logic
 *
 * ROUTING RULES:
 *   Route 1  → 1 timer  — verbiage contains "after each set"
 *   Route 2  → 2 timers — verbiage contains "in between and after each set"
 *   Fallback → 1 timer  — no verbiage (default)
 *
 * HOW TO HOOK INTO A PAGE:
 *   1. Add data-rest-note="..." to each .superset-exercise element
 *      (or leave blank for fallback)
 *   2. Add <script src="superset-timers.js"></script> before </body>
 *   3. That's it — timers are injected and wired automatically
 *
 * EXPECTED HTML STRUCTURE (existing site pattern):
 *   <div class="superset-card" data-superset="1">
 *     <div class="superset-exercise" data-rest-note="after each set">
 *       ...existing badge/note content...
 *       <!-- timer pill already in HTML: <span class="rest-pill">🕐 120 sec</span> -->
 *     </div>
 *     <div class="superset-divider">× SUPERSET ×</div>
 *     <div class="superset-exercise" data-rest-note="in between and after each set">
 *       ...
 *     </div>
 *   </div>
 * ─────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ── CONSTANTS ──────────────────────────────────────────────────

  const ROUTES = {
    AFTER_EACH_SET:     'after_each_set',
    BETWEEN_AND_AFTER:  'between_and_after',
    FALLBACK:           'fallback',
  };

  const TIMER_CONFIG = {
    [ROUTES.AFTER_EACH_SET]: {
      timers: [
        { label: 'Rest After Set', seconds: 90, position: 'after_set' },
      ],
    },
    [ROUTES.BETWEEN_AND_AFTER]: {
      timers: [
        { label: 'Rest Between Sets', seconds: 30,  position: 'between_sets'   },
        { label: 'Rest After Superset', seconds: 90, position: 'after_superset' },
      ],
    },
    [ROUTES.FALLBACK]: {
      timers: [
        { label: 'Rest', seconds: 90, position: 'after_set' },
      ],
    },
  };

  // ── ROUTE RESOLVER ─────────────────────────────────────────────

  function resolveRoute(restNote) {
    const v = (restNote || '').toLowerCase().trim();
    if (v.includes('in between and after')) return ROUTES.BETWEEN_AND_AFTER;
    if (v.includes('after each set'))       return ROUTES.AFTER_EACH_SET;
    return ROUTES.FALLBACK;
  }

  // ── TIMER STATE ────────────────────────────────────────────────

  // One active timer at a time globally — tapping another cancels current
  let activeTimer = null;

  function cancelActive() {
    if (activeTimer) {
      clearInterval(activeTimer.interval);
      activeTimer.btn.classList.remove('timer-running', 'timer-done');
      activeTimer.btn.textContent = activeTimer.originalText;
      activeTimer = null;
    }
  }

  // ── TIMER BUTTON BUILDER ───────────────────────────────────────

  /**
   * Creates a tappable timer pill that matches the existing
   * "🕐 120 sec" rest pill visual style.
   *
   * States:
   *   idle    → shows "🕐 {N} sec"  (gold outlined pill)
   *   running → shows "⏱ {N}s"     (accent fill, pulsing)
   *   done    → shows "✓ Done"      (green, fades after 2s)
   */
  function buildTimerBtn(timerDef) {
    const btn = document.createElement('button');
    btn.className   = 'rest-pill timer-btn';
    btn.dataset.seconds = timerDef.seconds;
    btn.dataset.position = timerDef.position;

    const originalText = `🕐 ${timerDef.seconds} sec · ${timerDef.label}`;
    btn.textContent = originalText;

    btn.addEventListener('click', function () {
      // If this button is already running, cancel it
      if (activeTimer && activeTimer.btn === btn) {
        cancelActive();
        return;
      }
      // Cancel any other running timer
      cancelActive();

      let remaining = parseInt(btn.dataset.seconds, 10);
      btn.classList.add('timer-running');
      btn.textContent = `⏱ ${remaining}s`;

      const interval = setInterval(function () {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(interval);
          btn.classList.remove('timer-running');
          btn.classList.add('timer-done');
          btn.textContent = '✓ Done';
          // Vibrate on mobile if supported
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          // Auto-dismiss after 4s
          setTimeout(function () {
            btn.classList.remove('timer-done');
            btn.textContent = originalText;
            activeTimer = null;
          }, 4000);
        } else {
          btn.textContent = `⏱ ${remaining}s`;
        }
      }, 1000);

      activeTimer = { btn, interval, originalText };
    });

    return btn;
  }

  // ── TIMER WRAPPER BLOCK ────────────────────────────────────────

  /**
   * Builds the full timer injection block for an exercise.
   * Route 1 / Fallback → single timer pill
   * Route 2            → two stacked timer pills with a label row
   */
  function buildTimerBlock(route) {
    const config  = TIMER_CONFIG[route];
    const wrapper = document.createElement('div');
    wrapper.className = 'superset-timer-block';

    if (config.timers.length === 2) {
      // Route 2: label row + two pills
      const label = document.createElement('div');
      label.className   = 'timer-route-label';
      label.textContent = 'Rest Timers';
      wrapper.appendChild(label);
    }

    config.timers.forEach(function (timerDef) {
      wrapper.appendChild(buildTimerBtn(timerDef));
    });

    return wrapper;
  }

  // ── INJECTION ENGINE ───────────────────────────────────────────

  /**
   * Finds every .superset-exercise on the page.
   * For each:
   *   1. Reads data-rest-note to resolve route
   *   2. Removes the static rest pill (already in HTML) — replaced by live timer
   *   3. Injects the dynamic timer block after the note line
   *
   * Falls back gracefully if no .superset-exercise elements found.
   */
  function injectTimers() {
    const exercises = document.querySelectorAll('.superset-exercise');
    if (!exercises.length) return;

    exercises.forEach(function (el) {
      const restNote = el.dataset.restNote || '';
      const route    = resolveRoute(restNote);

      // Remove existing static rest pill so we don't double-show
      const staticPill = el.querySelector('.rest-pill:not(.timer-btn)');
      if (staticPill) staticPill.remove();

      // Build and append the live timer block
      const timerBlock = buildTimerBlock(route);
      el.appendChild(timerBlock);
    });
  }

  // ── STYLES ─────────────────────────────────────────────────────
  // Injected at runtime to match existing site pill aesthetic

  function injectStyles() {
    if (document.getElementById('superset-timer-styles')) return;

    const style = document.createElement('style');
    style.id    = 'superset-timer-styles';
    style.textContent = `

      /* ── Timer block wrapper ── */
      .superset-timer-block {
        display:        flex;
        flex-wrap:      wrap;
        gap:            8px;
        margin-top:     8px;
        align-items:    center;
      }

      .timer-route-label {
        width:          100%;
        font-size:      10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color:          rgba(255,255,255,0.35);
        margin-bottom:  2px;
      }

      /* ── Timer pill — matches existing .rest-pill style ── */
      .timer-btn {
        display:         inline-flex;
        align-items:     center;
        gap:             5px;
        padding:         5px 12px;
        border-radius:   20px;
        border:          1px solid rgba(255,255,255,0.18);
        background:      rgba(255,255,255,0.06);
        color:           rgba(255,255,255,0.75);
        font-size:       13px;
        font-weight:     500;
        cursor:          pointer;
        transition:      background 0.2s, color 0.2s, border-color 0.2s;
        -webkit-tap-highlight-color: transparent;
        font-family:     inherit;
      }

      .timer-btn:active {
        transform: scale(0.97);
      }

      /* Running state — accent color fill */
      .timer-btn.timer-running {
        background:    var(--accent, #c9a84c);
        color:         #1a1008;
        border-color:  var(--accent, #c9a84c);
        font-weight:   700;
        animation:     timerPulse 1s ease-in-out infinite;
      }

      /* Done state — green confirmation */
      .timer-btn.timer-done {
        background:   #2d6a2d;
        color:        #7eff7e;
        border-color: #3a8a3a;
        font-weight:  700;
        animation:    none;
      }

      @keyframes timerPulse {
        0%, 100% { opacity: 1;    }
        50%       { opacity: 0.7; }
      }

    `;

    document.head.appendChild(style);
  }

  // ── INIT ───────────────────────────────────────────────────────

  function init() {
    injectStyles();
    injectTimers();
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
