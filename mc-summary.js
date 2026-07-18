/* ==========================================================================
   mc-summary.js  —  live Workout Summary + session timer + stat bar
   --------------------------------------------------------------------------
   Adds three capabilities on top of the existing summary card:

   1. STAT BAR — expands the existing .prog-bar-wrap into a 46px sticky strip
      showing workout duration (MM:SS) on the left and total sets done on the
      right. The 3px progress fill runs along the bottom of the strip.
      Timer starts on the first exercise check-off (not page load).

   2. SUMMARY TOGGLE — the existing Summary button now shows/hides the summary
      card instead of scrolling to it. Card is hidden by default.

   3. LIVE SUMMARY CARD — unchanged PATH A / PATH B logic below.

   Self-contained IIFE. Pure DOM, no framework dependencies.
   ========================================================================== */
(function () {
  if (window.__mcSummary) return;
  window.__mcSummary = true;

  var CARD_SEL  = '.ex-card, .ss-ex, .ex-item, .lift-card';
  var NAME_SEL  = '.ex-name, .ss-name, .lift-name';
  var SETS_SEL  = '.ex-sets, .lift-meta, [data-field="sets"]';
  var SUMSEC_SEL = '.sum-section, .summary-section';
  var DAILY_KEY  = 'mc_daily_v1';
  var PID = (window.MC_PID_OVERRIDE || location.pathname.split('/').pop().replace('.html','') || 'workout');
  var GOLD = { r:245, g:200, b:66 };

  /* ── timer state ─────────────────────────────────────────────────── */
  var _timerStarted  = false;
  var _timerInterval = null;
  var _elapsedSecs   = 0;

  function fmtTime(secs) {
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    if (h > 0) {
      return h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    }
    return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }

  function startTimer() {
    if (_timerStarted) return;
    _timerStarted = true;
    // survive reloads (incl. the SW deploy force-reload): seed the elapsed
    // clock from the persisted session start (mc-session.js)
    try {
      if (window.MCSession && MCSession.startedTs)
        _elapsedSecs = Math.max(_elapsedSecs,
          Math.floor((Date.now() - MCSession.startedTs) / 1000));
    } catch (e) {}
    try { if (window.MCActivity && MCActivity.enableSessionLock) MCActivity.enableSessionLock(); } catch (e) {}
    _timerInterval = setInterval(function () {
      _elapsedSecs++;
      var el = document.getElementById('mcsTimerVal');
      if (el) el.textContent = fmtTime(_elapsedSecs);
    }, 1000);
  }

  /* ── small utils ─────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function isVisible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }
  function programName() {
    var h = document.querySelector('.workout-title,.wk-title,.topbar-title,h1');
    var t = (h && h.textContent || document.title || '').trim();
    return t.replace(/\s*[—-]\s*MC Training.*$/i,'').slice(0,60) || PID;
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  /* ── visible exercise cards (current day / week only) ──────────── */
  function cards() {
    return Array.prototype.filter.call(document.querySelectorAll(CARD_SEL), isVisible);
  }

  /* ── parse sets string → {sets, reps} ───────────────────────────── */
  function parseSetsReps(txt) {
    txt = (txt||'').replace(/⏱️[^]*/,'').trim();
    if (!txt) return {sets:0,reps:0};
    var mx = txt.match(/(\d+)\s*[×x]\s*(\d+)/);
    if (mx) { var s=+mx[1]; return {sets:s,reps:s*(+mx[2])}; }
    var tokens = txt.split(/[,/]/).map(function(t){return t.trim();}).filter(Boolean);
    var setTokens = tokens.filter(function(t){return /\d/.test(t)||/amrap|max|failure/i.test(t);});
    var reps=0;
    setTokens.forEach(function(t){
      if(/amrap|max|failure/i.test(t))return;
      var n=t.match(/\d+/);if(n)reps+=+n[0];
    });
    return {sets:setTokens.length||1,reps:reps};
  }
  function cardSetsText(card) {
    var els = card.querySelectorAll(SETS_SEL);
    for (var i=0;i<els.length;i++){
      var el=els[i];
      if(el.classList&&el.classList.contains('rest-timer'))continue;
      var txt=(el.textContent||'').trim();
      if(txt&&/\d/.test(txt)&&!/^⏱️/.test(txt))return txt;
    }
    return els.length?(els[0].textContent||'').trim():'';
  }
  function cardSetsReps(card){return parseSetsReps(cardSetsText(card));}
  function cardName(card){
    var el=card.querySelector(NAME_SEL);
    return (el?el.textContent:'').trim();
  }
  function cleanScheme(txt){
    return (txt||'').replace(/⏱️[^]*/,'').replace(/\s+/g,' ').trim().slice(0,42);
  }

  /* ── icon for exercise ───────────────────────────────────────────── */
  function iconFor(name,scheme){
    var n=((name||'')+' '+(scheme||'')).toLowerCase();
    if(/amrap|to failure|\bfailure\b/.test(n))return'💀';
    if(/calf|calves/.test(n))return'🦶';
    if(/shoulder|delt|lateral raise|overhead press|military|arnold|upright row|face pull/.test(n))return'🏔️';
    if(/squat|leg press|lunge|hack|leg extension|hip thrust|leg curl|hamstring|\bham\b|rdl|romanian|deadlift|good morning|glute|step.?up/.test(n))return'🦵';
    if(/tricep|pushdown|skull|kickback|overhead extension|\bdip\b/.test(n))return'💪';
    if(/back|\brow\b|pull-?up|pull-?down|chin|\blat\b|shrug|\btrap/.test(n))return'🪝';
    if(/bench|chest|\bfly\b|flye|incline|decline|\bpec\b|push-?up|press/.test(n))return'🫷';
    if(/\babs?\b|core|crunch|plank|knee raise|sit-?up|leg raise|hollow/.test(n))return'🔥';
    if(/bicep|curl|preacher|hammer/.test(n))return'💪';
    return'🏋️';
  }

  /* ── accent colour ───────────────────────────────────────────────── */
  function parseRgb(s){
    var m=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s||'');
    return m?{r:+m[1],g:+m[2],b:+m[3]}:null;
  }
  function isGray(c){return Math.max(c.r,c.g,c.b)-Math.min(c.r,c.g,c.b)<20;}
  function rgb(c){return'rgb('+c.r+','+c.g+','+c.b+')';}
  function rgba(c,a){return'rgba('+c.r+','+c.g+','+c.b+','+a+')';}
  function accentOf(){
    var probe=document.createElement('div');
    probe.className='sum-hd';
    probe.style.cssText='position:absolute;left:-99999px;top:0;height:0;overflow:hidden;';
    document.body.appendChild(probe);
    var c=parseRgb(getComputedStyle(probe).color);
    if(probe.parentNode)probe.parentNode.removeChild(probe);
    if(!c||isGray(c))return GOLD;
    return c;
  }

  /* ── live session totals ─────────────────────────────────────────── */
  function totals(){
    var t={doneSets:0,doneReps:0,totalSets:0,exTotal:0,exDone:0,doneNames:{}};
    cards().forEach(function(c){
      var sr=cardSetsReps(c);
      t.exTotal++;
      t.totalSets+=sr.sets;
      if(c.classList.contains('checked')){
        t.doneSets+=sr.sets;t.doneReps+=sr.reps;t.exDone++;
        var nm=cardName(c);if(nm)t.doneNames[nm]=true;
      }
    });
    return t;
  }

  /* ── daily session persistence ───────────────────────────────────── */
  function saveDaily(t,pct){
    if(!t.doneSets&&!t.exDone)return;
    var store;
    try{store=JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');}catch(e){store={};}
    var k=todayKey()+'|'+PID;
    store[k]={
      date:todayKey(),pid:PID,program:programName(),
      doneSets:t.doneSets,doneReps:t.doneReps,
      exTotal:t.exTotal,exDone:t.exDone,pct:pct,ts:Date.now()
    };
    try{localStorage.setItem(DAILY_KEY,JSON.stringify(store));}catch(e){}
  }
  function todayEntry(){
    var store;
    try{store=JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');}catch(e){return null;}
    return store[todayKey()+'|'+PID]||null;
  }
  function todayLineText(){
    var e=todayEntry();
    return e?'✅ Saved today · '+e.doneSets+' sets · '+e.doneReps+' reps logged':'';
  }
  function subtitle(){
    var el=document.querySelector('.sum-subtitle,.title,.workout-title,.day-session');
    var s=el?(el.textContent||'').trim():'';
    s=s.replace(/\s*[—-]\s*MC Training.*$/i,'').trim();
    return s.slice(0,60);
  }

  /* ── STAT BAR ────────────────────────────────────────────────────── */
  function buildStatBar(){
    if(!cards().length)return;  // only activate on actual workout pages
    var wrap=document.getElementById('progBarWrap')||document.querySelector('.prog-bar-wrap');
    if(!wrap||wrap.classList.contains('mcs-stat'))return;

    var acc=accentOf();
    wrap.classList.add('mcs-stat');
    document.body.classList.add('mcs-stat-active');

    var row=document.createElement('div');
    row.className='mcs-stat-row';
    row.innerHTML=
      '<div class="mcs-timer-wrap">'+
        '<span class="mcs-timer" id="mcsTimerVal">00:00</span>'+
        '<span class="mcs-timer-label">elapsed</span>'+
      '</div>'+
      '<div class="mcs-sets-wrap">'+
        '<span class="mcs-sets-live" id="mcsSetsLive" style="color:'+rgb(acc)+';">0</span>'+
        '<span class="mcs-sets-label">sets done</span>'+
      '</div>';
    wrap.insertBefore(row, wrap.firstChild);
  }

  function updateStatBar(t){
    var setsEl=document.getElementById('mcsSetsLive');
    if(setsEl) setsEl.textContent=t.doneSets;
    var fill=document.getElementById('progFill');
    if(fill&&t.exTotal) fill.style.width=Math.round((t.exDone/t.exTotal)*100)+'%';
  }

  /* ── SUMMARY TOGGLE ──────────────────────────────────────────────── */
  // Appended (not inserted first) so it lands as the secondary row UNDER
  // the primary Finish Workout button in the bar's stacked layout — see
  // base.css's .fw-bar (flex-direction:column) and mc-finish.js's barHTML.
  function injectSummaryButton(){
    var fwbar=document.querySelector('.fw-bar');
    if(!fwbar||fwbar.querySelector('.mcs-sumbtn'))return;
    var btn=document.createElement('button');
    btn.type='button';
    btn.className='mcs-sumbtn';
    btn.innerHTML='📊<span>Workout Summary</span>';
    btn.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      var host=document.querySelector(SUMSEC_SEL);
      if(!host)return;
      var isOpen=host.classList.toggle('mcs-open');
      btn.classList.toggle('mcs-btn-open',isOpen);
      if(isOpen) host.scrollIntoView({behavior:'smooth',block:'start'});
    });
    fwbar.appendChild(btn);
  }

  /* =========================================================================
     PATH A — MC gold `.summary-section`: keep static breakdown,
               overlay live progress bar + rewrite three totals.
     ========================================================================= */
  function renderMC(host){
    var card=host.querySelector('.sum-card')||host;
    if(!host.querySelector('.mcs-progress')){
      var wrap=document.createElement('div');
      wrap.className='mcs-progress';
      wrap.innerHTML=
        '<div class="mcs-progress-top"><span class="mcs-progress-label">Live progress</span>'+
        '<span class="mcs-progress-pct" id="mcsPct">0%</span></div>'+
        '<div class="mcs-progress-track"><div class="mcs-progress-fill" id="mcsFill"></div></div>';
      card.insertBefore(wrap,card.firstChild);
    }
    var t=totals();
    var pct=t.exTotal?Math.round((t.exDone/t.exTotal)*100):0;
    var fill=host.querySelector('#mcsFill'),label=host.querySelector('#mcsPct');
    if(fill)fill.style.width=pct+'%';
    if(label)label.textContent=pct+'%';
    host.classList.toggle('mcs-complete',pct===100&&t.exTotal>0);

    var tvs=host.querySelectorAll('.sum-total-val');
    var tls=host.querySelectorAll('.sum-total-label');
    if(tvs.length>=3){
      tvs[0].textContent=t.exDone+' / '+t.exTotal;
      tvs[1].textContent=String(t.doneSets);
      tvs[2].textContent=String(t.doneReps);
    }
    if(tls.length>=3){
      tls[0].textContent='Exercises';tls[1].textContent='Sets Done';tls[2].textContent='Reps Done';
    }

    saveDaily(t,pct);
    var tl=host.querySelector('.mcs-today');
    if(!tl){tl=document.createElement('div');tl.className='mcs-today';card.appendChild(tl);}
    tl.textContent=todayLineText();
    tl.style.display=tl.textContent?'':'none';

    Array.prototype.forEach.call(host.querySelectorAll('.sum-row'),function(row){
      var nm=row.querySelector('.sum-name,.sum-nm');
      var done=nm&&t.doneNames[nm.textContent.trim()];
      row.classList.toggle('mcs-row-done',!!done);
    });

    updateStatBar(t);
    if(t.exDone>0) startTimer();
  }

  /* =========================================================================
     PATH B — every other program: rebuild card from visible exercise cards.
     ========================================================================= */
  function totCard(val,lbl,acc){
    return '<div class="sum-tot" style="background:'+rgba(acc,0.08)+';border:1px solid '+rgba(acc,0.16)+';">'+
             '<div class="sum-tv" style="color:'+rgb(acc)+';">'+esc(val)+'</div>'+
             '<div class="sum-tl" style="color:'+rgb(acc)+';">'+esc(lbl)+'</div>'+
           '</div>';
  }
  function rowsHTML(acc){
    var html='';
    cards().forEach(function(c){
      var nm=cardName(c);if(!nm)return;
      var setsTxt=cardSetsText(c);
      var sr=parseSetsReps(setsTxt);
      var done=c.classList.contains('checked');
      var setLabel=sr.sets?(sr.sets+' set'+(sr.sets>1?'s':'')):'—';
      var repLabel=cleanScheme(setsTxt);
      html+='<div class="sum-row'+(done?' mcs-row-done':'')+'" style="border-bottom-color:'+rgba(acc,0.13)+';">'+
              '<span class="sum-ico">'+iconFor(nm,setsTxt)+'</span>'+
              '<span class="sum-nm">'+esc(nm)+'</span>'+
              '<div class="sum-dt">'+
                '<span class="sum-st" style="color:'+rgb(acc)+';">'+setLabel+'</span>'+
                (repLabel?'<span class="sum-rp" style="color:'+rgb(acc)+';">'+esc(repLabel)+'</span>':'')+
              '</div>'+
            '</div>';
    });
    return html;
  }
  function buildGenerated(host){
    var acc=accentOf();
    var t=totals();
    var pct=t.exTotal?Math.round((t.exDone/t.exTotal)*100):0;
    var sig=pct+'|'+cards().map(function(c){
      return cardName(c)+(c.classList.contains('checked')?'1':'0');
    }).join('~')+'|'+todayLineText();
    if(host.__mcsSig===sig)return;
    host.__mcsSig=sig;

    var sub=subtitle();
    var today=todayLineText();
    host.innerHTML=
      '<div class="sum-hd" style="color:'+rgb(acc)+';">📊 Workout Summary'+
        '<span style="flex:1;height:1px;background:linear-gradient(90deg,'+rgba(acc,0.3)+',transparent);display:block;margin-left:8px;"></span>'+
      '</div>'+
      '<div class="sum-card" style="background:rgba(10,14,24,0.92);border:1px solid '+rgba(acc,0.28)+';">'+
        '<div class="mcs-progress">'+
          '<div class="mcs-progress-top"><span class="mcs-progress-label">Live progress</span>'+
          '<span class="mcs-progress-pct" style="color:'+rgb(acc)+';">'+pct+'%</span></div>'+
          '<div class="mcs-progress-track"><div class="mcs-progress-fill" style="width:'+pct+'%;background:'+rgb(acc)+';"></div></div>'+
        '</div>'+
        (sub?'<div class="sum-sub" style="color:'+rgb(acc)+';">'+esc(sub)+'</div>':'')+
        '<div class="mcs-rows">'+rowsHTML(acc)+'</div>'+
        '<div class="sum-div" style="background:'+rgba(acc,0.18)+';"></div>'+
        '<div class="sum-grid">'+
          totCard(t.exDone+' / '+t.exTotal,'Exercises',acc)+
          totCard(String(t.doneSets),'Sets Done',acc)+
          totCard(String(t.doneReps),'Reps Done',acc)+
        '</div>'+
        (today?'<div class="mcs-today">'+esc(today)+'</div>':'')+
      '</div>';
    host.classList.toggle('mcs-complete',pct===100&&t.exTotal>0);
    saveDaily(t,pct);
    updateStatBar(t);
    if(t.exDone>0) startTimer();
  }

  /* ── auto-build empty host when page ships no summary ──────────── */
  function autoBuild(){
    if(document.querySelector(SUMSEC_SEL))return;
    if(!cards().length)return;
    var sec=document.createElement('section');
    sec.className='sum-section mcs-auto';
    var fw=document.querySelector('.fw-bar');
    var main=document.querySelector('main,.content,.workout-wrap,#app')||document.body;
    if(fw&&fw.parentNode)fw.parentNode.insertBefore(sec,fw);
    else main.appendChild(sec);
  }

  /* ── FINISH WORKOUT RECAP ────────────────────────────────────────── */
  function workoutName(){
    var el=document.querySelector('.title,.workout-title,h1');
    return (el?el.textContent:'').replace(/\s*[—-]\s*MC Training.*$/i,'').trim()||'Workout';
  }
  function todayLabel(){
    var d=new Date();
    return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  }

  function buildRecapRows(t,acc){
    var html='<div class="fw-recap-rows">';
    cards().forEach(function(c){
      var nm=cardName(c); if(!nm)return;
      var setsTxt=cardSetsText(c);
      var sr=parseSetsReps(setsTxt);
      var done=c.classList.contains('checked');
      var setLabel=sr.sets?(sr.sets+' set'+(sr.sets>1?'s':'')):'—';
      html+='<div class="fw-recap-row'+(done?' fw-recap-done':'')+'">'+
              '<span class="fw-recap-row-ico">'+iconFor(nm,setsTxt)+'</span>'+
              '<span class="fw-recap-row-name">'+esc(nm)+'</span>'+
              '<span class="fw-recap-row-sets" style="color:'+rgb(acc)+';">'+setLabel+'</span>'+
            '</div>';
    });
    html+='</div>';
    return html;
  }

  function showRecap(){
    var existing=document.getElementById('fwRecap');
    if(existing)existing.parentNode.removeChild(existing);

    var t=totals();
    var acc=accentOf();
    var timeStr=fmtTime(_elapsedSecs);
    var prs=[];
    try{
      if(window._FW&&window._FW._getPRs)prs=window._FW._getPRs();
    }catch(e){}

    var el=document.createElement('div');
    el.className='fw-recap-overlay';
    el.id='fwRecap';
    el.innerHTML=
      '<div class="fw-recap-sheet">'+
        '<div class="fw-recap-handle"></div>'+
        '<div class="fw-recap-header">'+
          '<div class="fw-recap-badge">🏆</div>'+
          '<div class="fw-recap-title">Workout Complete</div>'+
          '<div class="fw-recap-sub">'+esc(workoutName())+' · '+todayLabel()+'</div>'+
        '</div>'+
        '<div class="fw-recap-hero">'+
          '<div class="fw-recap-hero-time">'+esc(timeStr)+'</div>'+
          '<div class="fw-recap-hero-label">Total Time</div>'+
        '</div>'+
        '<div class="fw-recap-stats">'+
          '<div class="fw-recap-stat">'+
            '<div class="fw-recap-stat-val" style="color:'+rgb(acc)+';">'+t.exDone+' <span style="font-size:13px;opacity:0.55;">/ '+t.exTotal+'</span></div>'+
            '<div class="fw-recap-stat-label">Exercises</div>'+
          '</div>'+
          '<div class="fw-recap-stat">'+
            '<div class="fw-recap-stat-val" style="color:'+rgb(acc)+';">'+t.doneSets+'</div>'+
            '<div class="fw-recap-stat-label">Sets Done</div>'+
          '</div>'+
          '<div class="fw-recap-stat">'+
            '<div class="fw-recap-stat-val" style="color:'+rgb(acc)+';">'+t.doneReps+'</div>'+
            '<div class="fw-recap-stat-label">Reps Done</div>'+
          '</div>'+
        '</div>'+
        buildRecapRows(t,acc)+
        '<div class="fw-recap-actions">'+
          '<button class="fw-recap-cancel" id="fwRecapCancel">← Keep Training</button>'+
          '<button class="fw-recap-save" id="fwRecapSave" style="background:'+rgb(acc)+';">Log Workout</button>'+
        '</div>'+
      '</div>';

    document.body.appendChild(el);

    // Animate open next frame
    requestAnimationFrame(function(){el.classList.add('open');});

    // Cancel — close sheet
    document.getElementById('fwRecapCancel').addEventListener('click',function(){
      el.classList.remove('open');
      setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},350);
    });

    // Log Workout — actually finalize and save. Was calling window._FW._save /
    // window.saveWorkout, neither of which was EVER defined anywhere in the
    // codebase (verified by search) — so on every page where this recap sheet
    // is the active flow (patchFWOpen() below makes it so on 70 of 74 workout
    // pages), tapping this button never wrote the real mc_workout_log_v1 entry
    // (sets/weights/PRs/volume); it only bumped the lightweight daily-progress
    // tracker and navigated away, silently discarding the session's actual
    // logged data. _FW.confirm() is mc-finish.js's real, already-correct save
    // path (writes the log entry, releases the session lock, backs up via
    // sync, shows the Session Complete recap) — call that instead of
    // duplicating/re-guessing save logic here.
    document.getElementById('fwRecapSave').addEventListener('click',function(){
      el.classList.remove('open');
      setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},350);
      if(_timerInterval){clearInterval(_timerInterval);_timerInterval=null;}
      if(window._FW&&window._FW.confirm) window._FW.confirm();
    });
  }

  function patchFWOpen(){
    if(!window._FW){setTimeout(patchFWOpen,100);return;}
    // Store original for fallback
    window._FW._origOpen=window._FW.open;
    // Replace open with recap
    window._FW.open=function(){ showRecap(); };
  }

  /* ── main recompute ──────────────────────────────────────────────── */
  var writing=false;
  function recompute(){
    // Only activate on actual workout session pages (those with a finish-workout bar)
    if(!document.querySelector('.fw-bar'))return;
    writing=true;
    try{
      autoBuild();
      injectSummaryButton();
      buildStatBar();
      var host=document.querySelector(SUMSEC_SEL);
      if(!host)return;
      if(host.classList.contains('summary-section')){
        renderMC(host);
      }else if(host.classList.contains('mcs-auto')&&cards().length){
        buildGenerated(host);
      }else if(cards().length){
        renderMC(host);  // pre-authored .sum-section: overlay progress, don't rewrite
      }
    }finally{
      setTimeout(function(){writing=false;},0);
    }
  }

  var tId=null;
  function schedule(){if(writing)return;clearTimeout(tId);tId=setTimeout(recompute,150);}

  function init(){
    recompute();
    patchFWOpen();
    var mo=new MutationObserver(schedule);
    mo.observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true,childList:true});
    setTimeout(recompute,400);
    setTimeout(recompute,1000);
    setTimeout(recompute,2200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();

  // expose daily store for workout-logs.html
  window.mcDailySessions=function(){
    try{return JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');}catch(e){return {};}
  };
})();
