/* ==========================================================================
   mc-s3-engine.js — exercise renderer for the three Split-3 pages (audit G5)
   --------------------------------------------------------------------------
   Lifted verbatim out of the pages that used to carry byte-identical copies of
   it. Behaviour is unchanged: these are the same function bodies, now stored
   once. Each page keeps its own render(), which is genuinely per-page — it
   names that page's data and sections.

   Reads page-level state (activeIdx, checkState, the page's workout data) and
   TMR from mc-timer.js. Classic scripts share one global lexical environment,
   so those resolve at call time; load this after mc-timer.js and before the
   page's inline script.
   ========================================================================== */

function esc(s){return escapeHtml(s);}

function renderEx(ex, prefix, idx) {
  const id = `${activeIdx}-${prefix}-${idx}`;
  const checked = checkState[id] ? "checked" : "";
  const rest = ex.rest || "60 sec";
  const badgeHtml = ex.tempo ? `<div class="a-badges"><span class="ex-tempo">${esc(ex.tempo)}</span></div>` : "";
  const noteHtml = ex.note ? `<div class="a-notes">📝 ${esc(ex.note)}</div>` : "";
  return `<div class="ex-card a-card ${checked}" data-id="${id}" data-type="single">
    <div class="ex-body">
      <div class="a-top">
        <div class="a-idx">${idx+1}</div>
        <div class="a-head">
          <div class="ex-name a-name">${esc(ex.name)}</div>
          ${badgeHtml}
        </div>
      </div>
      <div class="a-reps">${aReps(ex.sets)}</div>
      <div class="a-strip">
        <div class="a-cell"><span class="k">Sets</span><span class="v"><span data-field="sets">${esc(ex.sets)}</span></span></div>
        <div class="a-cell"><span class="k">Rest</span><span class="v">${esc(rest)}</span></div>
      </div>
      <div class="a-timerbar">${makeRestTimer(rest, ex.name)}</div>
      ${noteHtml}
    </div>
  </div>`;
}
