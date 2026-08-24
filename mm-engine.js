/* ==========================================================================
   mm-engine.js — shared render engine for The Modality Matrix trio
   (mm-p1.html / mm-p2.html / mm-p3.html).
   --------------------------------------------------------------------------
   Phase 3.2 consolidation. renderExercise/renderDay/renderWeekTabs/
   switchWeek/render were byte-identical across all three pages (confirmed
   diff) except for a handful of header strings — now sourced from
   mm-data.js's per-program metadata (title/modality/phase/accent/backHref).
   Each HTML shell just does:
     <script src="mm-data.js"></script>
     <script src="mm-engine.js"></script>
     <script>MM.init('p1');</script>
   ...and later, once the #programSummary placeholder exists in the DOM:
     <script>MM.renderSummary();</script>

   renderWeekTabs() used to carry its own hardcoded ["Low-Rep","Pyramid",...]
   label list in parallel with WEEK_THEMES — a second place that could drift
   out of sync with a WEEK_THEMES edit. It now derives the short label
   straight from WEEK_THEMES[i].label (format "Week N · Short Label").

   renderSummary() replaces what used to be ~30 lines of hand-typed static
   HTML per page (lift counts, intensifier lists, weekly total) — those had
   drifted stale (mm-p1's Day 1/3 rows undercounted at "8 lifts" against an
   actual 10, and the weekly total read "36" against an actual 40). It's now
   computed straight from DAYS, so it can't drift again.
   ========================================================================== */
(function () {
  'use strict';

  var currentWeek = 0;
  // Roadmap F3: null = the DAY LIST, a number = that day on its own screen.
  // The Modality Matrix trio used to render all four days of the block at
  // once as an accordion; now a day is its own screen. See renderDay().
  var openDayIdx = null;
  var activeProgram = null;
  var DAYS = [];
  var WEEK_THEMES = [];

  /* ─────────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────────── */
  function hexToRgb(hex){
    var r=parseInt(hex.slice(1,3),16);
    var g=parseInt(hex.slice(3,5),16);
    var b=parseInt(hex.slice(5,7),16);
    return r+','+g+','+b;
  }
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  // Shared so renderWeekTabs and renderDay's header note can't drift apart
  // the way the old hardcoded label list once did (see file header comment).
  function weekShortLabel(wt){ return wt.label.split(' · ')[1] || wt.label; }

  // A drop/burnout AMRAP set renders as a bare "∞" (one per AMRAP set), never
  // a "2×∞" shorthand. "Drop AMRAP" and "+ N×AMRAP" always convert (the word
  // "Drop" or a leading "+" signals an added set after real working sets,
  // regardless of context — this covers the Week 5 superset "+ 2×AMRAP"
  // burnout rounds). A BARE "N×AMRAP"/"AMRAP" with neither marker only
  // converts when it's one leg of a multi-exercise superset — never when
  // it's a standalone exercise's entire prescription (a Pos-10 finisher,
  // e.g. solo "3×AMRAP").
  function amrapToInfinity(s,isMultiLeg){
    s=String(s).replace(/(\+\s*)?(\d+)\s*[x×]\s*(drop\s*)?amrap\b/gi,function(m,plus,n,dropWord){return (!plus&&!dropWord&&!isMultiLeg)?m:(plus||'')+Array(parseInt(n,10)).fill('∞').join(' ');});
    s=s.replace(/\bdrop\s+amrap\b/gi,'∞');
    if(isMultiLeg)s=s.replace(/^\s*amrap\s*$/i,'∞');
    return s;
  }


  /* ─────────────────────────────────────────────────
     RENDER EXERCISE CARD
  ───────────────────────────────────────────────── */
  function renderExercise(ex, dIdx, eIdx){
    var wd = ex.w[currentWeek];
    var tag = wd.tag;
    var note = wd.note;
    // ── Superset-week contingency ──────────────────────────────────────
    // The final theme week (W5) is superset-dominant, so a tri-set defeats the
    // logic. Collapse the Pos 3–5 tri-set: Ex 3 (eIdx 2) runs STANDALONE while
    // Ex 4–5 pair as the superset. Render-only — blueprint data is unchanged.
    if(currentWeek === WEEK_THEMES.length - 1 && wd.tag === "TRI-SET"){
      if(eIdx === 2){ tag = null; note = "SUPERSET WEEK — run STANDALONE (tri-set collapses; Ex 4–5 pair as the superset) · " + note; }
      else { tag = "SUPERSET"; }
    }
    var isSS = tag === "SUPERSET";
    var isTS = tag === "TRI-SET";
    var isCL = tag === "CLUSTER";
    var isDR = tag === "DROP";
    var isFN = tag === "FINISHER";
    var ssCls = isSS ? " is-ss" : (isTS ? " is-tri" : (isCL ? " is-cluster" : (isDR ? " is-drop" : "")));

    var parts = String(wd.sets||"—").split("/").map(function(s){return s.trim();});
    var repsHtml = parts.map(function(part,pi){
      var reps = part.split(",").map(function(r){return r.trim();});
      var legTag = parts.length>1 ? '<span class="a-legtag">'+["A","B","C"][pi]+'</span>' : "";
      var chips = reps.map(function(rep,ri){
        var special = rep.toUpperCase().includes("AMRAP")||rep.includes("Drop")||rep.includes("×")||rep.includes("Cluster")||rep.includes("BW");
        var cls = special?"a-rep special":(ri===0?"a-rep live":"a-rep");
        var sep = ri<reps.length-1?'<span class="a-sep">·</span>':"";
        return '<span class="'+cls+'">'+esc(amrapToInfinity(rep,parts.length>1))+'</span>'+sep;
      }).join("");
      return '<div class="a-leg">'+legTag+chips+'</div>';
    }).join("");

    var pillCls = isSS?"grp":isTS?"grp triset":isCL?"grp cluster":isDR?"grp drop":isFN?"grp finisher":"grp";
    var pillLabel = isSS?"⚡ Superset":isTS?"▲ Tri-Set":isCL?"◈ Cluster":isDR?"↘ Drop Set":isFN?"🏁 Finisher":"";
    var badgeHtml = tag ? '<div class="a-badges"><span class="a-pill '+pillCls+'">'+pillLabel+'</span></div>' : "";
    var noteHtml = note ? '<div class="a-notes">'+esc(note)+'</div>' : "";

    var infoHtml = note ? '<button type="button" class="a-info" aria-expanded="false" aria-label="Show coaching note">ⓘ</button>' : "";

    return '<div class="ex-card a-card a-hdr-card'+ssCls+'" data-d="'+dIdx+'" data-e="'+eIdx+'">' +
      '<div class="ex-body">' +
      '<div class="a-hdr">' +
        '<div class="a-idx">'+(eIdx+1)+'</div>' +
        '<div class="a-head">' +
          '<div class="ex-name a-name"><span class="editable" data-field="name" data-d="'+dIdx+'" data-e="'+eIdx+'">'+esc(ex.name)+'</span></div>' +
        '</div>' +
        infoHtml +
        '<div class="a-hdr-meta">'+badgeHtml+'<div class="a-reps">'+repsHtml+'</div></div>' +
      '</div>' +
      '<div class="a-strip">' +
        '<div class="a-cell"><span class="k">Sets</span><span class="v"><span class="editable" data-field="sets" data-d="'+dIdx+'" data-e="'+eIdx+'">'+esc(wd.sets)+'</span></span></div>' +
        '<div class="a-cell"><span class="k">Rest</span><span class="v"><span class="editable" data-field="rest" data-d="'+dIdx+'" data-e="'+eIdx+'">'+esc(wd.rest)+'</span></span></div>' +
      '</div>' +
      '<div class="a-timerbar">'+makeRestTimer(wd.rest||'60 sec', ex.name)+'</div>' +
      noteHtml +
      '</div></div>';
  }

  /* ─────────────────────────────────────────────────
     RENDER DAY CARD
  ───────────────────────────────────────────────── */
  // A day ROW -- the list level. Reuses .day-card/.day-header/.day-icon/
  // .day-info/.day-toggle so this page's existing per-day-colour CSS styles it
  // unchanged; the row and Back affordances are the shared .mc-day-row /
  // .mc-day-back from base.css that every F3-converted family uses.
  //
  // The row keeps the inline onclick these headers already carry, so the
  // toggle path is the SAME function whether you are opening a day from the
  // list or closing one back to it -- there is no second code path to drift.
  function renderDayRow(day, dIdx){
    var cond = day.type === "cond";
    var meta = cond
      ? esc(day.label) + ' \u00B7 Conditioning Corner'
      : esc(day.label) + ' \u00B7 ' + day.exCount + ' exercises';
    var fn = cond ? 'MM.toggleCond' : 'MM.toggleDay';
    return '<div class="day-card mc-day-row" data-d="'+dIdx+'">' +
      '<div class="day-header" onclick="'+fn+'(this.parentElement,'+dIdx+')">' +
        '<div class="day-icon" style="background:'+day.color+';box-shadow:0 2px 8px '+day.color+'55">'+day.icon+'</div>' +
        '<div class="day-info">' +
          '<div class="day-session">'+esc(day.session)+'</div>' +
          '<div class="day-meta">'+meta+'</div>' +
        '</div>' +
        '<div class="day-toggle">\u203A</div>' +
      '</div>' +
    '</div>';
  }

  // One hint line, two states -- it cannot tell the athlete to "expand" a
  // session on the screen where sessions are rows.
  function hintText(){
    return openDayIdx === null
      ? 'Pick a session to start training'
      : 'Tap any field to edit \u00B7 Back returns to the session list';
  }

  function backBtn(){
    return '<button type="button" class="mc-day-back" onclick="MM.showDayList()">\u2190 All days</button>';
  }

  function renderDay(day, dIdx){
    // A rest day has no exercises and nothing to drill into, so it stays the
    // compact informational card it already was -- in the LIST only. It is
    // never a destination, so day mode omits it entirely.
    if(openDayIdx === null && day.type !== "rest") return renderDayRow(day, dIdx);
    if(openDayIdx !== null && openDayIdx !== dIdx) return "";   // one workout, one screen

    if(day.type === "rest"){
      return '<div class="rest-card"><span style="font-size:20px">😴</span><div><div class="rest-label">REST DAY</div><div class="rest-sub">Full Recovery &amp; Growth</div></div></div>';
    }
    if(day.type === "cond"){
      return backBtn() + '<div class="cond-day-card open" data-d="'+dIdx+'">' +
        '<div class="day-header" onclick="MM.toggleCond(this.parentElement,'+dIdx+')">' +
          '<div class="day-icon" style="background:'+day.color+';box-shadow:0 2px 8px '+day.color+'55">'+day.icon+'</div>' +
          '<div class="day-info">' +
            '<div class="day-session">'+esc(day.session)+'</div>' +
            '<div class="day-meta">'+esc(day.label)+' · Conditioning Corner · 4-On 1-Off 2-On</div>' +
          '</div>' +
          '<div class="day-toggle" id="cond-tog-'+dIdx+'">▲</div>' +
        '</div>' +
        '<div class="exercises" id="cond-ex-'+dIdx+'" style="padding:12px 16px;">' +
          '<div class="cond-activity"><span class="cond-act-icon">🏃</span><div><div class="cond-act-name">Choose Your Session</div><div class="cond-act-desc">Browse the Conditioning Corner for HIIT, circuits, lactate threshold work, and more.</div></div></div>' +
          '<a href="dashboard.html?tab=conditioning" class="cond-link-row"><span>Browse Conditioning Corner →</span></a>' +
        '</div>' +
      '</div>';
    }
    var exHtml = day.exercises.map(function(ex,eIdx){return renderExercise(ex,dIdx,eIdx);}).join("");
    var wt = WEEK_THEMES[currentWeek];
    var themeBar = '<div class="week-theme-bar"><span class="wtb-icon">'+wt.icon+'</span><div><div class="wtb-label">'+esc(wt.label)+'</div><div class="wtb-text">'+esc(wt.text)+'</div></div></div>';
    // VOC-B2: the week tabs switch schemes correctly, but a collapsed day
    // card gave no hint of what changed — the athlete had to expand it and
    // diff "5×5" against memory. A one-line note on the header (visible
    // before any tap) names this week's theme so the 4 feature lifts'
    // delta is signposted up front; the full per-week explanation stays
    // in the existing themeBar once expanded.
    var weekNote = ' · This week: '+wt.icon+' '+esc(weekShortLabel(wt));
    return backBtn() + '<div class="day-card open" data-d="'+dIdx+'">' +
      '<div class="day-header" onclick="MM.toggleDay(this.parentElement,'+dIdx+')">' +
        '<div class="day-icon" style="background:'+day.color+';box-shadow:0 2px 8px '+day.color+'55">'+day.icon+'</div>' +
        '<div class="day-info">' +
          '<div class="day-session">'+esc(day.session)+'</div>' +
          '<div class="day-meta">'+esc(day.label)+' · '+day.exCount+' exercises · '+esc(day.meta)+weekNote+'</div>' +
        '</div>' +
        '<div class="day-toggle" id="tog-'+dIdx+'">▲</div>' +
      '</div>' +
      '<div class="exercises" id="ex-'+dIdx+'" style="border-top-color:'+day.color+'33">'+themeBar+exHtml+'</div>' +
    '</div>';
  }

  /* ─────────────────────────────────────────────────
     TOGGLE HELPERS
  ───────────────────────────────────────────────── */
  // F3: these no longer show/hide a pre-built panel in place -- they move
  // between the two screens. render() is the single path, so a day's cards are
  // BUILT on open and gone on close, which is what makes the DOM win real
  // rather than cosmetic. Same signature as before, because the headers'
  // inline onclick is unchanged and mc-session.js reopens a day by
  // synthesising a real .day-header click (S3) -- that keeps working here
  // exactly as it does on the engines F3 has not reached yet.
  function showDay(dIdx){
    openDayIdx = dIdx;
    render();
    window.scrollTo(0, 0);
  }
  function showDayList(){
    openDayIdx = null;
    render();
    window.scrollTo(0, 0);
  }
  function toggleDay(card, dIdx){
    if(openDayIdx === dIdx) showDayList(); else showDay(dIdx);
  }
  function toggleCond(card, dIdx){
    if(openDayIdx === dIdx) showDayList(); else showDay(dIdx);
  }

  // `?day=N` (1-based, matching the day numbers on the rows) opens straight
  // into a day; `?week=N` picks the block week. Both are clamped to what the
  // program actually has -- an unclamped index renders every day as "" and
  // leaves a blank screen with no way back, which is exactly what shipped in
  // F3-1's first draft and was only caught by driving the URL.
  function applyDeepLink(){
    var q;
    try { q = new URLSearchParams(location.search); } catch(e){ return; }
    var w = parseInt(q.get('week'), 10);
    if(!isNaN(w) && w >= 1 && w <= WEEK_THEMES.length) currentWeek = w - 1;
    var d = parseInt(q.get('day'), 10);
    if(!isNaN(d) && d >= 1 && d <= DAYS.length && DAYS[d-1].type !== 'rest') openDayIdx = d - 1;
  }

  /* ─────────────────────────────────────────────────
     WEEK TABS
  ───────────────────────────────────────────────── */
  function renderWeekTabs(){
    return WEEK_THEMES.map(function(wt,i){
      var short = weekShortLabel(wt);
      return '<button class="wtab'+(i===currentWeek?' active':'')+'" onclick="MM.switchWeek('+i+')">W'+(i+1)+'<span class="wt-label">'+short+'</span></button>';
    }).join("");
  }

  function switchWeek(w){
    currentWeek = w;
    render();
  }

  /* ─────────────────────────────────────────────────
     MAIN RENDER
  ───────────────────────────────────────────────── */
  function render(){
    var p = activeProgram;
    var daysHtml = DAYS.map(function(d,i){return renderDay(d,i);}).join("");
    document.getElementById("app").innerHTML =
      '<div class="header"><a href="'+p.backHref+'" class="back-link">← The Modality Matrix</a>' +
      '<div class="header-inner">' +
        '<div class="eyebrow">⬡ The Modality Matrix · Phase '+p.phase+'</div>' +
        '<div class="title">'+esc(p.title)+'</div>' +
        '<span class="schedule">5-Week Block · 4-On / 1-Off / 2-On · '+esc(p.modality)+'</span>' +
        '<div style="font-size:12px;font-weight:700;color:var(--accent);opacity:0.85;margin-top:8px;">✍️ Designed by Mike Cross</div>' +
      '</div></div>' +
      '<div class="week-selector" id="weekSel">'+renderWeekTabs()+'</div>' +
      '<div class="content"><div class="hint">'+hintText()+'</div>'+daysHtml+'</div>';

    bindEditable();
    buildTimerFloat();
    // MC_REPLACE.apply() (mc-replace.js), not a local render()-wrap: this
    // render() is IIFE-scoped, not global, so mc-replace.js's usual
    // "wrap window.render" trick can't find it — see mc-replace.js's own
    // comment on window.MC_REPLACE.
    if (window.MC_REPLACE) MC_REPLACE.apply();
  }

  /* ─────────────────────────────────────────────────
     EDITABLE FIELDS
  ───────────────────────────────────────────────── */
  function bindEditable(){
    document.querySelectorAll(".editable").forEach(function(el){
      el.addEventListener("click",function(e){
        e.stopPropagation();
        var field = el.dataset.field;
        var dIdx = parseInt(el.dataset.d);
        var eIdx = parseInt(el.dataset.e);
        var day = DAYS[dIdx];
        var ex = day.exercises[eIdx];
        var wd = ex.w[currentWeek];
        var input = document.createElement("input");
        input.value = field==="name" ? ex.name : wd[field];
        input.className = "edit-input";
        el.replaceWith(input);
        input.focus();
        var save = function(){
          if(field==="name") ex.name = input.value;
          else wd[field] = input.value;
          render();
        };
        input.addEventListener("blur",save);
        input.addEventListener("keydown",function(ev){ if(ev.key==="Enter") input.blur(); });
      });
    });
  }

  /* ─────────────────────────────────────────────────
     PROGRAM SUMMARY (computed — see file header)
  ───────────────────────────────────────────────── */
  var TAG_ORDER = ['TRI-SET','SUPERSET','CLUSTER','DROP','FINISHER'];
  var TAG_LABELS = {'TRI-SET':'Tri-Set','SUPERSET':'Superset','CLUSTER':'Cluster','DROP':'Drop','FINISHER':'Finisher'};

  // Tag-per-position never changes week to week (only the FEATURE lifts'
  // text does), so week 0 is representative for every week.
  function dayTagsLabel(day){
    var present = {};
    day.exercises.forEach(function(ex){
      var tag = ex.w[0].tag;
      if(tag) present[tag] = true;
    });
    return TAG_ORDER.filter(function(t){return present[t];}).map(function(t){return TAG_LABELS[t];}).join(' · ');
  }

  function sumRow(icon, name, stat, desc, accent){
    return '<div class="sum-row" style="border-bottom-color:'+accent+'22;">' +
      '<span class="sum-ico">'+icon+'</span>' +
      '<span class="sum-nm">'+esc(name)+'</span>' +
      '<div class="sum-dt"><span class="sum-st" style="color:'+accent+';">'+esc(stat)+'</span><span class="sum-rp" style="color:'+accent+';">'+esc(desc)+'</span></div>' +
    '</div>';
  }
  function sumTot(value, label, accent){
    return '<div class="sum-tot" style="background:'+accent+'14;border:1px solid '+accent+'26;">' +
      '<div class="sum-tv" style="color:'+accent+';">'+esc(value)+'</div>' +
      '<div class="sum-tl" style="color:'+accent+';">'+esc(label)+'</div>' +
    '</div>';
  }

  function renderSummary(){
    var container = document.getElementById('programSummary');
    if(!container) return;
    var p = activeProgram;
    var accent = p.accent;
    var trainingDays = DAYS.filter(function(d){return d.type==='training';});
    var restDays = DAYS.filter(function(d){return d.type==='rest';});
    var condDays = DAYS.filter(function(d){return d.type==='cond';});
    var totalLifts = trainingDays.reduce(function(sum,d){return sum+d.exercises.length;},0);

    var rows =
      trainingDays.map(function(d){
        return sumRow(d.icon, d.session+' — '+d.label, d.exercises.length+' lifts', dayTagsLabel(d), accent);
      }).join('') +
      restDays.map(function(d){
        return sumRow('😴', d.session+' — '+d.label, '—', 'Full recovery', accent);
      }).join('') +
      (condDays.length ? sumRow('⚡', 'Conditioning — Days '+condDays.map(function(d){return d.label.replace('Day ','');}).join(' & '), '×'+condDays.length, 'Conditioning Corner', accent) : '');

    container.innerHTML =
      '<div class="sum-section">' +
        '<div class="sum-hd" style="color:'+accent+';">📊 Phase '+p.phase+' Summary' +
          '<span style="flex:1;height:1px;background:linear-gradient(90deg,'+accent+'4d,transparent);display:block;margin-left:8px;"></span>' +
        '</div>' +
        '<div class="sum-card" style="background:#0f0f0f;border:1px solid '+accent+'33;">' +
          '<div class="sum-sub" style="color:'+accent+';">Phase '+p.phase+' · '+esc(p.title)+' · 5-Week Block · 4-On / 1-Off / 2-On</div>' +
          rows +
          '<div class="sum-div" style="background:'+accent+'26;"></div>' +
          '<div class="sum-grid">' +
            sumTot(totalLifts+' lifts','Per Week',accent) +
            sumTot(p.modality,'Phase '+p.phase+' Modality',accent) +
            sumTot(p.estPerSession,'Est. Per Session',accent) +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ─────────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────────── */
  function init(programId){
    activeProgram = MM_DATA.PROGRAMS[programId];
    DAYS = activeProgram.days;
    WEEK_THEMES = MM_DATA.WEEK_THEMES;
    currentWeek = 0;
    openDayIdx = null;
    applyDeepLink();          // ?day= / ?week=, clamped -- see applyDeepLink()
    buildTimerFloat();
    render();
    if(typeof updateProgress!=="undefined") updateProgress();
  }

  // F4 — the day-identity contract. Registered from INSIDE this IIFE because
  // currentWeek and openDayIdx live here and are unreachable from outside; a
  // constant declared elsewhere could not see them, and could not see them
  // CHANGE, which is the whole reason the contract takes a function.
  //
  // `position` is openDayIdx + 1 directly: this engine's day array includes its
  // rest entries, so the array index already IS the slot in the week.
  //
  // Inert until mm carries a `schedule` record in mc-pm-data.js (roadmap F5) —
  // mc-program-day.js refuses to invent one, so until then this resolves and
  // is then correctly declined rather than banking against a made-up block.
  window.MC_PROGRAM_DAY_RESOLVER = function () {
    if (openDayIdx === null || !activeProgram) return null;
    var day = DAYS[openDayIdx];
    if (!day || day.type === 'rest') return null;
    return { prog: 'mm', week: currentWeek + 1, position: openDayIdx + 1 };
  };

  window.MM = {
    init: init,
    switchWeek: switchWeek,
    toggleDay: toggleDay,
    toggleCond: toggleCond,
    showDayList: showDayList,   // F3: the day list's Back control
    renderSummary: renderSummary
  };
})();
