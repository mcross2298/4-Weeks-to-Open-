/* ==========================================================================
   mc-freq-engine.js — day renderer and tab wiring for the eight frequency-split pages (audit G5)
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

function bindEvents(){
  document.querySelectorAll(".day-card").forEach(card=>{
    const header=card.querySelector(".day-header");
    header.addEventListener("click",e=>{
      if(e.target.classList.contains("ex-item")||e.target.closest(".ex-item"))return;
      const dIdx=parseInt(card.dataset.d);
      openDayIdx=openDayIdx===dIdx?null:dIdx;
      render();
    });
  });
  document.querySelectorAll(".ex-item").forEach(item=>{
    item.addEventListener("click",e=>{
      e.stopPropagation();
      const id=item.dataset.id;
      checkState[id]=!checkState[id];
      item.classList.toggle("checked");
    });
  });
}

function renderDay(day,dIdx){
  const isOpen=openDayIdx===dIdx;
  const exHtml=day.exercises.map((ex,eIdx)=>{
    const id=`d${dIdx}e${eIdx}`;
    const checked=checkState[id]?"checked":"";
    return `<div class="ex-item ${checked}" data-id="${id}">
      <div class="checkbox"></div>
      <span class="ex-name">${escapeHtml(ex.name)}</span>
      <span class="ex-sets">${escapeHtml(ex.sets)}</span>
    <div style="margin-top:4px;">${makeRestTimer(ex.rest||"60 sec",ex.name)}</div>
    </div>`;
  }).join("");
  return `<div class="day-card ${isOpen?'open':''}" data-d="${dIdx}">
    <div class="day-header">
      <div class="day-icon">${day.icon}</div>
      <div class="day-info">
        <div class="day-session">${escapeHtml(day.name)}</div>
        <div class="day-meta">${day.exercises.length} exercises</div>
      </div>
      <div class="day-toggle">${isOpen?'▲':'▼'}</div>
    </div>
    <div class="exercises">${exHtml}</div>
  </div>`;
}
