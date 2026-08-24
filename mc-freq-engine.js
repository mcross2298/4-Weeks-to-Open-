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

/* ── F3-1: one workout, one screen ─────────────────────────────────────────
   These eight pages used to render every day of the block at once, as an
   accordion. Per roadmap F3 the day list is now a real level: the page opens
   as a list of tappable day ROWS and nothing else, tapping one renders THAT
   DAY ONLY, and Back returns to the list. `?day=N` deep-links straight in.

   `openDayIdx === null` is the list; a number is that day. Each page's own
   render() still maps every day through renderDay(), unchanged -- renderDay
   returns a row in list mode and an empty string for the days that are not
   open, so the page files need no change to their render() at all.

   Why this matters beyond the clutter: in list mode NO .ex-item is built, so
   the day the athlete is not training costs nothing. Measured across the 23
   multi-day pages, 83% of day-card DOM belonged to days nobody was training.

   It also makes mc-session.js's VOC-A2 auto-open a no-op here rather than a
   fight: firstIncompleteUnit() looks for '.ex-card, .ss-card, .ex-item', and
   in list mode there are none, so it finds nothing to land on and the page
   stays on the list -- which is what roadmap decision 11 asks for. Nothing in
   mc-session.js needed changing to get that.

   mc-finish.js already scopes its counters to `.day-card.open` (S5c-0), so the
   finish bar reads the open day's real prescription with no change here. */

// Deep link: `?day=N` is 1-based, matching the day numbers a trainee reads on
// the rows themselves. Anything out of range falls back to the day list.
//
// The upper bound is not optional and was not there first: without it,
// `?day=99` set openDayIdx to 98, every renderDay() call returned "" because
// no day matched, and the page rendered a COMPLETELY BLANK screen -- no rows,
// no day, no way back. Caught by driving the URL, not by reading the code,
// which had a comment claiming it fell back to the list.
//
// Each page declares `const DATA` immediately above its `openDayIdx`, so the
// real day count is in scope by the time this runs (classic scripts share one
// global lexical environment). Guarded anyway rather than assumed.
function freqInitialDay(){
  try{
    var q=parseInt(new URLSearchParams(location.search).get('day'),10);
    if(isNaN(q)||q<1) return null;
    var n=(typeof DATA!=='undefined'&&DATA&&DATA.days)?DATA.days.length:0;
    if(!n||q>n) return null;
    return q-1;
  }catch(e){}
  return null;
}

// The hint line each page renders above its content. It is one string in two
// states now, so it cannot tell the athlete to "expand" a day on the screen
// where days are rows, or to pick a day on the screen where one is already
// open.
// "1 exercises" read fine buried in a collapsed accordion; on the day LIST it
// is the row's only subtitle and every rest day says it. Pluralise properly.
function freqCount(n){ return n+" exercise"+(n===1?"":"s"); }

function freqHint(){
  return openDayIdx===null
    ? "Pick a day to start training"
    : "Tap exercises to check off \u00B7 Back returns to the day list";
}

function freqShowDayList(){
  openDayIdx=null;
  render();
  window.scrollTo(0,0);
}

function bindEvents(){
  var back=document.querySelector('[data-mc-day-back]');
  if(back) back.addEventListener('click',freqShowDayList);

  document.querySelectorAll(".day-card").forEach(card=>{
    const header=card.querySelector(".day-header");
    if(!header)return;
    header.addEventListener("click",e=>{
      if(e.target.classList.contains("ex-item")||e.target.closest(".ex-item"))return;
      const dIdx=parseInt(card.dataset.d);
      // In day mode the header is the second way back to the list (the first
      // being the Back control). That is NOT the in-page day switcher decision
      // 9 rejects -- it returns to the list, it does not hop to another day.
      openDayIdx=openDayIdx===dIdx?null:dIdx;
      render();
      window.scrollTo(0,0);
    });
  });
  document.querySelectorAll(".ex-item").forEach(item=>{
    item.addEventListener("click",e=>{
      // The rest chip is a real button with its own job, and mc-timer.js
      // reaches it through ONE delegated listener on `document` (the One rest
      // timer rule). An unconditional stopPropagation() here swallowed the
      // click before it ever got there, so every rest chip on the 8 pages this
      // engine drives was silently inert -- a tap that did nothing, no error.
      // That is the exact failure mode check-one-timer.js's ORPHAN CHIP rule
      // exists to prevent, arriving through a door it can't see: the page DOES
      // load mc-timer.js, an ancestor just eats the event. Found by driving a
      // tap rather than reading the source, and it predates this change --
      // the chip was a live countdown before, so it LOOKED responsive while
      // being just as untappable.
      if(e.target.closest(".rest-timer"))return;
      e.stopPropagation();
      const id=item.dataset.id;
      checkState[id]=!checkState[id];
      item.classList.toggle("checked");
    });
  });
}

// A day ROW: the whole list level. Reuses .day-card/.day-header/.day-icon/
// .day-info/.day-toggle so each page's existing (per-page, per-accent) CSS
// styles it with no new rules; the row and Back affordances come from the
// shared .mc-day-row / .mc-day-back in base.css, which F3 uses on every
// converted family rather than cloning per engine.
function renderDayRow(day,dIdx){
  return `<div class="day-card mc-day-row" data-d="${dIdx}">
    <div class="day-header" role="button" tabindex="0" aria-label="Open ${escapeHtml(day.name)}">
      <div class="day-icon">${day.icon}</div>
      <div class="day-info">
        <div class="day-session">${escapeHtml(day.name)}</div>
        <div class="day-meta">${freqCount(day.exercises.length)}</div>
      </div>
      <div class="day-toggle">\u203A</div>
    </div>
  </div>`;
}

function renderDay(day,dIdx){
  if(openDayIdx===null) return renderDayRow(day,dIdx);
  if(openDayIdx!==dIdx) return "";      // one workout, one screen
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
  return `<button type="button" class="mc-day-back" data-mc-day-back>\u2190 All days</button>
  <div class="day-card open" data-d="${dIdx}">
    <div class="day-header">
      <div class="day-icon">${day.icon}</div>
      <div class="day-info">
        <div class="day-session">${escapeHtml(day.name)}</div>
        <div class="day-meta">${freqCount(day.exercises.length)}</div>
      </div>
      <div class="day-toggle">\u25B2</div>
    </div>
    <div class="exercises">${exHtml}</div>
  </div>`;
}
