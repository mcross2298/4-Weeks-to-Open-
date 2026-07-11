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

  function makeRestTimer(restStr, exName){
    var secs = TMR.parseSeconds(restStr);
    if(!secs) return '<span class="ex-sets" style="opacity:0.5">⏱️ '+esc(restStr)+'</span>';
    return '<span class="rest-timer idle" data-rest="'+esc(restStr)+'" data-label="'+esc(restStr)+'" '+
      'onclick="buildTimerFloat();TMR.toggle(this,'+secs+',\''+esc(exName).substring(0,30)+'...\')" '+
      'title="Tap to start rest timer">'+
      '<span class="rest-timer-icon">⏱️</span>'+
      '<span class="rest-timer-label">'+esc(restStr)+'</span></span>';
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

    return '<div class="ex-card a-card'+ssCls+'" data-d="'+dIdx+'" data-e="'+eIdx+'">' +
      '<div class="ex-body">' +
      '<div class="a-top">' +
        '<div class="a-idx">'+(eIdx+1)+'</div>' +
        '<div class="a-head">' +
          '<div class="ex-name a-name"><span class="editable" data-field="name" data-d="'+dIdx+'" data-e="'+eIdx+'">'+esc(ex.name)+'</span></div>' +
          badgeHtml +
        '</div>' +
      '</div>' +
      '<div class="a-reps">'+repsHtml+'</div>' +
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
  function renderDay(day, dIdx){
    if(day.type === "rest"){
      return '<div class="rest-card"><span style="font-size:20px">😴</span><div><div class="rest-label">REST DAY</div><div class="rest-sub">Full Recovery &amp; Growth</div></div></div>';
    }
    if(day.type === "cond"){
      return '<div class="cond-day-card" data-d="'+dIdx+'">' +
        '<div class="day-header" onclick="MM.toggleCond(this.parentElement,'+dIdx+')">' +
          '<div class="day-icon" style="background:'+day.color+';box-shadow:0 2px 8px '+day.color+'55">'+day.icon+'</div>' +
          '<div class="day-info">' +
            '<div class="day-session">'+esc(day.session)+'</div>' +
            '<div class="day-meta">'+esc(day.label)+' · Conditioning Corner · 4-On 1-Off 2-On</div>' +
          '</div>' +
          '<div class="day-toggle" id="cond-tog-'+dIdx+'">▼</div>' +
        '</div>' +
        '<div class="exercises" id="cond-ex-'+dIdx+'" style="display:none;padding:12px 16px;">' +
          '<div class="cond-activity"><span class="cond-act-icon">🏃</span><div><div class="cond-act-name">Choose Your Session</div><div class="cond-act-desc">Browse the Conditioning Corner for HIIT, circuits, lactate threshold work, and more.</div></div></div>' +
          '<a href="dashboard.html?tab=conditioning" class="cond-link-row"><span>Browse Conditioning Corner →</span></a>' +
        '</div>' +
      '</div>';
    }
    var exHtml = day.exercises.map(function(ex,eIdx){return renderExercise(ex,dIdx,eIdx);}).join("");
    var wt = WEEK_THEMES[currentWeek];
    var themeBar = '<div class="week-theme-bar"><span class="wtb-icon">'+wt.icon+'</span><div><div class="wtb-label">'+esc(wt.label)+'</div><div class="wtb-text">'+esc(wt.text)+'</div></div></div>';
    return '<div class="day-card" data-d="'+dIdx+'">' +
      '<div class="day-header" onclick="MM.toggleDay(this.parentElement,'+dIdx+')">' +
        '<div class="day-icon" style="background:'+day.color+';box-shadow:0 2px 8px '+day.color+'55">'+day.icon+'</div>' +
        '<div class="day-info">' +
          '<div class="day-session">'+esc(day.session)+'</div>' +
          '<div class="day-meta">'+esc(day.label)+' · '+day.exCount+' exercises · '+esc(day.meta)+'</div>' +
        '</div>' +
        '<div class="day-toggle" id="tog-'+dIdx+'">▼</div>' +
      '</div>' +
      '<div class="exercises" id="ex-'+dIdx+'" style="display:none;border-top-color:'+day.color+'33">'+themeBar+exHtml+'</div>' +
    '</div>';
  }

  /* ─────────────────────────────────────────────────
     TOGGLE HELPERS
  ───────────────────────────────────────────────── */
  function toggleDay(card, dIdx){
    var day = DAYS[dIdx];
    var exDiv = document.getElementById('ex-'+dIdx);
    var tog = document.getElementById('tog-'+dIdx);
    var isOpen = card.classList.contains('open');
    card.classList.toggle('open');
    exDiv.style.display = isOpen ? 'none' : 'block';
    tog.textContent = isOpen ? '▼' : '▲';
    if(!isOpen){
      tog.style.background = day.color+'cc';
      card.style.setProperty('--day-rgb', hexToRgb(day.color));
      card.style.boxShadow = '0 4px 24px '+day.color+'22';
    } else {
      tog.style.background = 'rgba(255,255,255,0.06)';
      card.style.boxShadow = 'none';
    }
  }
  function toggleCond(card, dIdx){
    var exDiv = document.getElementById('cond-ex-'+dIdx);
    var tog = document.getElementById('cond-tog-'+dIdx);
    var isOpen = card.classList.contains('open');
    card.classList.toggle('open');
    exDiv.style.display = isOpen ? 'none' : 'block';
    tog.textContent = isOpen ? '▼' : '▲';
  }

  /* ─────────────────────────────────────────────────
     WEEK TABS
  ───────────────────────────────────────────────── */
  function renderWeekTabs(){
    return WEEK_THEMES.map(function(wt,i){
      var short = wt.label.split(' · ')[1] || wt.label;
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
      '<div class="content"><div class="hint">Tap a session to expand · Tap any field to edit</div>'+daysHtml+'</div>';

    bindEditable();
    buildTimerFloat();
    applyReplacements();
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
     REPLACEMENT BADGE (existing mc-replace.js compat)
  ───────────────────────────────────────────────── */
  function applyReplacements(){
    var _PAGE_ID = location.pathname.split('/').pop().split('?')[0];
    var KEY = 'mc_replacements|'+_PAGE_ID;
    var replacements = JSON.parse(localStorage.getItem(KEY)||'{}');
    if(!Object.keys(replacements).length) return;
    document.querySelectorAll('.ex-card').forEach(function(card){
      var nameEl = card.querySelector('.ex-name');
      if(!nameEl) return;
      var orig = nameEl.textContent.trim();
      var rep = replacements[orig.toLowerCase()];
      if(rep){
        nameEl.textContent = rep;
        nameEl.style.color = '#22d3ee';
        if(!card.querySelector('.replaced-badge')){
          var b = document.createElement('span');
          b.className='replaced-badge';
          b.style.cssText='font-size:11px;font-weight:900;color:#22d3ee;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.25);border-radius:4px;padding:2px 5px;margin-left:6px;letter-spacing:0.06em;vertical-align:middle;';
          b.textContent='REPLACED';
          nameEl.parentNode.insertBefore(b, nameEl.nextSibling);
        }
      }
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
    buildTimerFloat();
    render();
    if(typeof updateProgress!=="undefined") updateProgress();
  }

  window.MM = {
    init: init,
    switchWeek: switchWeek,
    toggleDay: toggleDay,
    toggleCond: toggleCond,
    renderSummary: renderSummary
  };
})();
