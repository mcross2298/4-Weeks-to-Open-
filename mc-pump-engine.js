/* ==========================================================================
   mc-pump-engine.js — exercise-card renderer for the nine pump pages (audit G5)
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

function renderExercise(ex, idx, prefix, mod) {
  // prefix: section key for pages whose day is split into groups, so two
  // sections cannot collide on the same checkState id. mod: extra card class.
  const id = prefix ? `${activeIdx}-${prefix}-${idx}` : `${activeIdx}-${idx}`;
  const checked = checkState[id] ? "checked" : "";
  const cls = ["ex-card", mod, checked].filter(Boolean).join(" ");
  const tempoHtml = ex.tempo ? `<span class="ex-tempo">${escapeHtml(ex.tempo)}</span>` : "";
  const noteHtml = ex.note ? `<div class="ex-note">${escapeHtml(ex.note)}</div>` : "";
  return `<div class="${cls}" data-id="${id}">
    <div class="ex-row">
      <div class="ex-num">${idx+1}</div>
      <div class="ex-content">
        <div class="ex-name">${escapeHtml(ex.name)}</div>
        <div class="ex-sets-row">
          <span class="ex-sets">${escapeHtml(ex.sets)}</span>
          ${tempoHtml}
        </div>
        <div style="margin-top:6px;">${makeRestTimer(ex.rest||"60 sec",ex.name)}</div>
        ${noteHtml}
      </div>
    </div>
  </div>`;
}
