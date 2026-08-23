/* mc-finish.js — Finish-Workout module (extracted from the per-page copy).
   Contracts kept: window._FW, mc_workout_log_v1 entry shape. */
/* ── FINISH-WORKOUT MODULE ── */
(function(){
  var WL_KEY='mc_workout_log_v1';
  var SL_KEY='mc_setlog_v1';
  var SS_KEY='mc_session_summary_v1';
  // Same absolute cross-app URL mc-macros.js's Nutrition tab already deep-links
  // to (roadmap B3) — this file is loaded on ~75 workout pages, not just
  // dashboard.html, so the relative-path MARKET:STRIP swap that dashboard.html's
  // nav icon uses isn't practical here; the absolute URL works unchanged in
  // both the standalone build and the Rolodex market mount.
  var COOKBOOK_URL='https://mcross2298.github.io/Mikes-Cookbook/index.html';
  var startTime=Date.now();
  // MC_PID_OVERRIDE namespaces custom program/workout runners (run-program.html)
  // so each saved day keeps its own history instead of colliding on the filename
  var pageId=(window.MC_PID_OVERRIDE||location.pathname.split('/').pop().replace('.html',''));

  // Get workout name from page title
  function getWorkoutName(){
    var t=document.title||pageId;
    return t.replace(' — MC Training','').replace('MC — ','').replace('PMC — ','');
  }

  // Get duration string
  function getDuration(){
    var mins=Math.round((Date.now()-startTime)/60000);
    if(mins<1)return '<1 min';
    return mins+' min';
  }

  // ---- what counts as "this workout" (S5c-0) ------------------------------
  // A multi-day program page holds EVERY day of the block in the DOM at once,
  // so a document-wide checkbox count sizes the whole block instead of the
  // session. Finishing all 43 sets of Day 1 on mm-p1.html read "43 / 172", and
  // done>=total (the auto-open Finish modal) needed all four days in one
  // sitting. 23 of the 78 pages loading this module render more than one day;
  // the worst page holds 767 set rows across 26 days.
  //
  // Scope is therefore the OPEN day(s) — summed, because most engines let two
  // sit open at once, while a couple are true accordions). A page with no
  // .day-card at all scopes to the document, which is what single-day pages
  // were already doing correctly.
  var UNIT_SEL_FW='.ex-card, .ss-ex, .ex-item';
  function scopeRoots(){
    if(!document.querySelector('.day-card'))return [document];
    var open=[].slice.call(document.querySelectorAll('.day-card.open'));
    if(open.length)return open;
    // Every day closed but sets already logged (the athlete collapsed the day
    // mid-session): stay on the day they actually worked rather than dropping
    // the bar to "0 / 0" and appearing to lose their session.
    return [].slice.call(document.querySelectorAll('.day-card')).filter(function(d){
      return d.querySelector('.set-check.done');
    });
  }
  function eachInScope(sel){
    var out=[];
    scopeRoots().forEach(function(root){
      [].push.apply(out,[].slice.call(root.querySelectorAll(sel)));
    });
    return out;
  }

  // Count checked sets — DOM-derived, narrowed to the same scope. Deliberately
  // NOT read from mc_setlog_v1: save() runs on check but is not cleared on
  // uncheck, so a store-derived count would over-report every unchecked set.
  function getCheckedSets(){
    return eachInScope('.set-check.done').length;
  }
  // Total comes from the PRESCRIPTION, not from rendered checkboxes, so it is
  // right whether or not a card's logger has been built (which is what makes
  // A-14's lazy build safe). Falls back to counting the DOM where mc-setlog.js
  // isn't loaded or a page ships its own logger.
  function getTotalSets(){
    var planned=window.MCSetlogUtil&&MCSetlogUtil.plannedSetCount;
    if(!planned)return eachInScope('.set-check').length;
    var units=eachInScope(UNIT_SEL_FW);
    if(!units.length)return eachInScope('.set-check').length;
    var n=0;
    units.forEach(function(u){
      var c=MCSetlogUtil.plannedSetCount(u);
      // a unit mc-setlog.js doesn't build (page-native logger) still counts
      // whatever checkboxes it did render
      n+=c||u.querySelectorAll('.set-check').length;
    });
    return n;
  }

  // Get all logged set data for this session
  function getSessionSets(){
    try{
      var store=JSON.parse(localStorage.getItem(SL_KEY)||'{}');
      var today=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
      var sets=[];
      Object.keys(store).forEach(function(k){
        if(!k.startsWith(pageId+'|'))return;
        var exName=k.split('|')[1]||k;
        var sess=store[k][0];
        if(sess&&sess.d===today){
          Object.keys(sess.sets).forEach(function(sn){
            var s=sess.sets[sn];
            var e={name:exName,setNum:parseInt(sn),weight:s.w,reps:s.r,pr:false};
            if(s.rpe)e.rpe=s.rpe;
            sets.push(e);
          });
        }
      });
      // Detect PRs — compare to previous sessions
      sets.forEach(function(s){
        var k=pageId+'|'+s.name;
        var history=store[k]||[];
        if(history.length<2)return;
        var prevMax=0;
        history.slice(1).forEach(function(sess){
          Object.values(sess.sets).forEach(function(set){
            if(parseFloat(set.w)>prevMax)prevMax=parseFloat(set.w);
          });
        });
        if(parseFloat(s.weight)>prevMax&&prevMax>0)s.pr=true;
      });
      return sets;
    }catch(e){return[];}
  }

  // ── recap helpers (Phase 5: Finish-Workout payoff) ──────────────────────
  function esc(s){
    return String(s).replace(/[&<>"]/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  // The set store keys exercises by their synthetic id (e.g. "x-bench-press" or
  // "x-bench-press-2" for a duplicate). Reconstruct a clean display name.
  function deSlug(id){
    return String(id)
      .replace(/^x-/,'')          // synthetic id prefix
      .replace(/-\d+$/,'')        // duplicate-occurrence suffix
      .replace(/-/g,' ')
      .replace(/\b\w/g,function(c){return c.toUpperCase();})
      .trim() || String(id);
  }
  function sessionTonnage(sets){
    var t=0;
    (sets||[]).forEach(function(s){
      var w=parseFloat(s.weight)||0, r=parseInt(s.reps,10)||0;
      t+=w*r;
    });
    return t;
  }
  function fmtLb(n){ return Math.round(n).toLocaleString('en-US'); }
  // Dynamic "1 sec" / "45 sec" / "1h 12m" duration text for the exit-dialog
  // stats row — distinct from getDuration() above, whose coarser "<1 min"/"N
  // min" format is a stored field on the mc_workout_log_v1 entry and must
  // stay byte-stable for existing history readers.
  function fmtElapsed(ms){
    var s=Math.max(0,Math.round(ms/1000));
    if(s<60)return s+' sec';
    var m=Math.floor(s/60);
    if(m<60)return m+' min';
    var h=Math.floor(m/60);
    return h+'h '+(m%60)+'m';
  }
  // PR'd exercises with the best (heaviest) PR weight each.
  function prSpotlight(sets){
    var best={};
    (sets||[]).forEach(function(s){
      if(!s.pr)return;
      var w=parseFloat(s.weight)||0, nm=deSlug(s.name);
      if(!(nm in best)||w>best[nm])best[nm]=w;
    });
    return Object.keys(best).map(function(nm){return {name:nm,weight:best[nm]};});
  }

  // Bug: mc-summary.js's live 'daily' snapshot (mc_daily_v1, todayKey()+'|'+PID)
  // was never cleared once a workout was actually Finished and banked here,
  // so the same session could show up twice in Workout Logs — a real
  // finished card plus a stale "in progress" ghost for the same day that
  // never goes away on its own. Clear today's entry for this page the
  // moment it's superseded by a real banked log.
  var DAILY_KEY='mc_daily_v1';
  function todayKey(){
    var d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function clearTodaysDailyEntry(){
    try{
      var store=JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');
      var k=todayKey()+'|'+pageId;
      if(k in store){ delete store[k]; localStorage.setItem(DAILY_KEY,JSON.stringify(store)); }
    }catch(e){}
  }

  // Save to workout log
  function saveWorkout(){
    var sets=getSessionSets();
    var prs=sets.filter(function(s){return s.pr;}).length;
    var iso=new Date().toISOString();
    var entry={
      id:pageId+'|'+iso,   // dedupe key for cross-device sync (mc-sync.js)
      pageId:pageId,
      workoutName:getWorkoutName(),
      date:iso,
      time:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
      duration:getDuration(),
      sets:sets,
      prs:prs,
      setsChecked:getCheckedSets()
    };
    try{
      var logs=JSON.parse(localStorage.getItem(WL_KEY)||'[]');
      logs.unshift(entry);
      logs=logs.slice(0,200);// keep last 200 workouts
      localStorage.setItem(WL_KEY,JSON.stringify(logs));
    }catch(e){}
    clearTodaysDailyEntry();
    return entry;
  }

  // ── CI initiative roadmap Phase 3 / Initiative 03 ("The Refuel Handoff")
  // — mc_session_summary_v1: { "<entry.id>": {date,dayType,kcal,strain,
  // proteinTarget,muscles,ts} }, one record per finished session, registered
  // in mc-sync.js under the same 'dictByTs' strategy as mc_daily_v1/
  // mc_plan_targets_v1 (union keys, greater ts wins on conflict). Keyed by
  // entry.id (pageId+'|'+iso, the same dedupe key mc_workout_log_v1 already
  // uses) rather than date|pageId, since a real two-a-day should keep two
  // distinct summaries — unlike mc-strain.js's daily aggregate, this is a
  // per-SESSION record.
  //
  // dayType reuses mc-macros.js's push/pull/legs/core buckets, but classifies
  // via mc-muscle-map.js's MC_MUSCLES (already loaded on every page that
  // loads this file, since mc-setlog.js — a hard dependency of getSessionSets()
  // above — pulls it in fleet-wide) rather than mc-bridge.js's catalog-name
  // lookup, which is dashboard-only. Two different classifiers landing in the
  // same 4-bucket vocabulary is intentional here: mc-bridge.js's version
  // answers "what's today's AGGREGATE day type across every session logged
  // today," which needs the catalog-driven, page-independent view; this
  // answers "what was THIS session," which only needs the sets already on
  // the page.
  var DAY_TYPE_BUCKET = {
    chest:'push', shoulders:'push', triceps:'push',
    back:'pull', biceps:'pull', forearms:'pull',
    legs:'legs', calves:'legs',
    core:'core'
  };
  function sessionMuscles(sets){
    var seen={}, out=[];
    (sets||[]).forEach(function(s){
      if(!window.MC_MUSCLES)return;
      var id=MC_MUSCLES.classify(s.name).id;
      if(id==='other'||seen[id])return;
      seen[id]=1;out.push(id);
    });
    return out;
  }
  function sessionDayType(sets){
    if(!window.MC_MUSCLES)return null;
    var counts={};
    (sets||[]).forEach(function(s){
      var bucket=DAY_TYPE_BUCKET[MC_MUSCLES.classify(s.name).id];
      if(bucket)counts[bucket]=(counts[bucket]||0)+1;
    });
    var best=null,bestN=0;
    Object.keys(counts).forEach(function(b){if(counts[b]>bestN){best=b;bestN=counts[b];}});
    // same 3-set majority floor mc-bridge.js's todaysDayType() uses, so a
    // stray isolation set can't mislabel the whole session
    return bestN>=3?best:null;
  }
  function saveSessionSummary(entry){
    try{
      var summary={
        date:entry.date,
        dayType:sessionDayType(entry.sets),
        kcal:(window.MC_STRAIN&&MC_STRAIN.session)?MC_STRAIN.session(entry).kcal:0,
        strain:(window.MC_STRAIN&&MC_STRAIN.today)?MC_STRAIN.today().strain:null,
        proteinTarget:(window.MC_STRAIN&&MC_STRAIN.proteinTarget)?MC_STRAIN.proteinTarget():null,
        muscles:sessionMuscles(entry.sets),
        ts:Date.now()
      };
      var store=JSON.parse(localStorage.getItem(SS_KEY)||'{}');
      store[entry.id]=summary;
      localStorage.setItem(SS_KEY,JSON.stringify(store));
    }catch(e){}
  }

  // Update progress display + auto-trigger the Finish flow the moment every
  // set is logged. Guarded on the done<total -> done>=total TRANSITION only
  // (wasComplete), so this fires once — not on every render pass while the
  // workout stays complete, and never again after the workout is saved.
  var wasComplete=false;
  function updateProgress(){
    var done=getCheckedSets();
    var total=getTotalSets();
    var el=document.getElementById('fwProgress');
    // Write ONLY on change (A-2's rule). This function is now also driven by
    // MC_SCAN, whose observer watches childList on body — so an unconditional
    // textContent write here queues a record, which schedules another scan,
    // which writes again. Measured as a real feedback loop before this guard:
    // steady-state mutation records 15 -> 53.9/s and querySelectorAll
    // 291.7 -> 927.1/s. Same output, no write when the readout has not moved.
    // Compact form: this readout now lives in the 390px session toolbar, where
    // 'done / total sets' left only 4px of slack and a three-digit total would
    // have overflowed. The button's aria-label carries the full meaning.
    var txt=done+'/'+total;
    if(el&&el.textContent!==txt)el.textContent=txt;
    // M3c: a session is "active" the moment the first set is logged -- not when
    // the page loads. Until then the athlete is still browsing and the nav is
    // how they browse. classList.toggle with an explicit boolean is idempotent,
    // so this queues no mutation record once the state settles (A-2's rule).
    document.body.classList.toggle('mc-in-session', done>0);
    var isComplete=total>0&&done>=total;
    if(isComplete&&!wasComplete&&!window._FW.finished){
      var modal=document.getElementById('fwModal');
      var already=modal&&modal.classList.contains('open');
      if(!already)window._FW.open();
    }
    wasComplete=isComplete;
  }

  // Build the bottom bar HTML — Finish Workout is the primary action;
  // Workout Summary lives directly underneath it as the secondary one
  // (mc-summary.js appends its button into this bar right after fw-btn).
  var barHTML='<div class="fw-bar" id="fwBar">'+
    '<button class="fw-btn" onclick="_FW.open()">Finish / Exit</button>'+
    '<span class="fw-progress" id="fwProgress">0 / 0 sets</span>'+
    '</div>';

  // Build modal HTML — this IS the exit-confirmation pull-up: opening it
  // (whether by tapping the bar button or via the auto-trigger above)
  // already populates the Total time / Total sets stats below.
  var modalHTML='<div class="fw-modal-overlay" id="fwModal">'+
    '<div class="fw-modal">'+
      '<div class="fw-modal-title">Finish and log workout?</div>'+
      "<div class=\"fw-modal-sub\">Log your workout to complete it and track your progress. If you exit, your workout won't be recorded.</div>"+
      '<div class="fw-stats-row">'+
        '<div class="fw-stat-cell"><div class="fw-stat-val" id="fwStatTime">0 sec</div><div class="fw-stat-lbl">Total time</div></div>'+
        '<div class="fw-stat-cell"><div class="fw-stat-val" id="fwStatSets">0 sets</div><div class="fw-stat-lbl">Total sets</div></div>'+
      '</div>'+
      '<div class="fw-modal-btns" id="fwModalBtns">'+
        '<button class="fw-cancel" onclick="_FW.discard()">Exit &amp; discard</button>'+
        '<button class="fw-confirm" onclick="_FW.confirm()">Log workout</button>'+
      '</div>'+
    '</div>'+
  '</div>';

  // Celebratory "Session Complete" recap shown after Log Workout.
  var doneHTML='<div class="fw-modal-overlay" id="fwDone">'+
    '<div class="fw-modal fw-done-card">'+
      '<div class="fw-done-emoji" id="fwDoneEmoji">💪</div>'+
      '<div class="fw-done-title">Session Complete</div>'+
      '<div class="fw-done-sub" id="fwDoneSub"></div>'+
      '<div class="fw-strain-wrap" id="fwStrainWrap"></div>'+
      '<div class="fw-done-grid" id="fwDoneGrid"></div>'+
      '<div class="fw-done-prs" id="fwDonePRs"></div>'+
      '<div class="fw-refuel-wrap" id="fwRefuelWrap"></div>'+
      '<button class="fw-confirm" style="flex:none;width:100%;" onclick="_FW.doneClose()">Done</button>'+
    '</div>'+
  '</div>';

  function injectDoneCss(){
    if(document.getElementById('fwDoneCss'))return;
    var st=document.createElement('style');st.id='fwDoneCss';
    st.textContent=
      '.fw-done-card{text-align:center;}'+
      '.fw-done-emoji{font-size:46px;line-height:1;margin-bottom:6px;animation:fwPop .5s ease-out;}'+
      '@keyframes fwPop{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1)}}'+
      '.fw-done-title{font-size:22px;font-weight:900;letter-spacing:-0.02em;color:#fff;}'+
      '.fw-done-sub{font-size:13px;color:#64748b;font-weight:700;margin:2px 0 16px;}'+
      '.fw-strain-wrap:not(:empty){display:flex;flex-direction:column;align-items:center;margin-bottom:16px;}'+
      '.fw-strain-circle{position:relative;width:76px;height:76px;}'+
      '.fw-strain-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;}'+
      '.fw-strain-val{font-size:19px;font-weight:900;color:#d4af37;line-height:1.1;text-align:center;}'+
      '.fw-strain-val span{display:block;font-size:9px;font-weight:800;color:#64748b;margin-top:2px;letter-spacing:0.02em;}'+
      '.fw-strain-lbl{font-size:11px;font-weight:700;color:#94a3b8;margin-top:8px;}'+
      '.fw-done-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}'+
      '.fw-done-cell{background:#141414;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:14px 8px;}'+
      '.fw-done-num{font-size:22px;font-weight:900;color:var(--accent,#d4af37);letter-spacing:-0.01em;}'+
      '.fw-done-lbl{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-top:4px;}'+
      '.fw-done-prs:not(:empty){margin-bottom:16px;}'+
      '.fw-done-prs-title{font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#d4af37;margin-bottom:8px;}'+
      '.fw-pr-chip{display:inline-block;margin:3px;padding:7px 12px;border-radius:10px;background:rgba(212,175,55,0.14);border:1px solid rgba(212,175,55,0.35);color:#f5d76e;font-size:12px;font-weight:800;}'+
      '.fw-refuel-wrap:not(:empty){margin-bottom:16px;padding:14px;border-radius:14px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);text-align:left;}'+
      '.fw-refuel-title{font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#d4af37;}'+
      '.fw-refuel-sub{font-size:13px;font-weight:700;color:#e2e8f0;margin-top:4px;}'+
      '.fw-refuel-btn{display:block;margin-top:10px;padding:11px;border-radius:10px;background:#d4af37;color:#0a0a0a;text-align:center;text-decoration:none;font-size:13px;font-weight:800;}';
    document.head.appendChild(st);
  }

  function cell(val,lbl){
    return '<div class="fw-done-cell"><div class="fw-done-num">'+val+'</div><div class="fw-done-lbl">'+lbl+'</div></div>';
  }
  // CI roadmap Phase 2 / Initiative 01 — session kcal (mc-strain.js's
  // session(), a pure function over the entry just saved) plus today's
  // aggregate 0-21 strain score (today(), which already includes this
  // session — saveWorkout() persisted it to mc_workout_log_v1 before
  // showDone() runs). No-op (leaves the host empty) on any page that hasn't
  // loaded mc-strain.js, or when there's nothing to estimate from yet.
  function renderStrain(entry){
    var wrap=document.getElementById('fwStrainWrap');
    if(!wrap)return;
    wrap.innerHTML='';
    if(!window.MC_STRAIN)return;
    try{
      var s=MC_STRAIN.session(entry);
      if(!s.kcal)return;
      var day=MC_STRAIN.today();
      var pct=day.strain==null?0:Math.round((day.strain/21)*100);
      var ringSvg=window.MC_CHART?MC_CHART.ring(pct,{size:76,stroke:6,color:'#d4af37'}):'';
      var lbl=day.strain==null?'Building your strain baseline':"Today's Strain: "+day.strain+' / 21';
      wrap.innerHTML=
        '<div class="fw-strain-circle">'+ringSvg+
          '<div class="fw-strain-center"><span class="fw-strain-val">'+s.kcal+'<span>kcal</span></span></div>'+
        '</div>'+
        '<div class="fw-strain-lbl">'+lbl+'</div>';
    }catch(e){wrap.innerHTML='';}
  }
  // "The Refuel Handoff" (Phase 3 / Initiative 03) — a one-tap deep link from
  // the Session Complete screen straight into a recipe search sized to what
  // this specific session calls for, reusing the same ?mkcal=&mp=&dt= query
  // contract mc-macros.js's "Cook to hit your remaining macros" link already
  // established (roadmap B3) so the cookbook-side consumer needs no new
  // parsing. proteinTarget() is a single-feeding number (not the day's
  // remaining macros mc-macros.js's version passes), which is exactly what a
  // post-workout refuel search should filter for.
  function renderRefuel(entry){
    var wrap=document.getElementById('fwRefuelWrap');
    if(!wrap)return;
    wrap.innerHTML='';
    if(!window.MC_STRAIN||!MC_STRAIN.proteinTarget)return;
    try{
      var protein=MC_STRAIN.proteinTarget();
      if(!protein)return;
      var kcal=MC_STRAIN.session?MC_STRAIN.session(entry).kcal:0;
      var dt=sessionDayType(entry.sets);
      var href=COOKBOOK_URL+'?mp='+protein+(kcal?'&mkcal='+kcal:'')+(dt?'&dt='+dt:'')+'#recipes';
      wrap.innerHTML=
        '<div class="fw-refuel-title">🍽️ Refuel</div>'+
        '<div class="fw-refuel-sub">'+protein+'g protein'+(kcal?' · '+kcal+' kcal':'')+' to recover from this session</div>'+
        '<a class="fw-refuel-btn" href="'+href+'" target="_blank" rel="noopener">Find a recipe →</a>';
    }catch(e){wrap.innerHTML='';}
  }
  function showDone(entry){
    var sets=entry.sets||[];
    var prList=prSpotlight(sets);
    renderStrain(entry);
    renderRefuel(entry);
    var grid=document.getElementById('fwDoneGrid');
    if(grid){
      grid.innerHTML=
        cell(entry.duration,'Duration')+
        cell(sets.length,'Sets')+
        cell(fmtLb(sessionTonnage(sets)),'Volume (lb)')+
        cell(prList.length?('🏆 '+prList.length):'—','PRs');
    }
    var sub=document.getElementById('fwDoneSub');
    if(sub)sub.textContent=entry.workoutName||'';
    var emoji=document.getElementById('fwDoneEmoji');
    if(emoji)emoji.textContent=prList.length?'🏆':'💪';
    var prEl=document.getElementById('fwDonePRs');
    if(prEl){
      prEl.innerHTML=prList.length
        ?('<div class="fw-done-prs-title">New Personal Records</div>'+
          prList.map(function(p){return '<div class="fw-pr-chip">🏆 '+esc(p.name)+' · '+p.weight+' lb</div>';}).join(''))
        :'';
    }
    if(prList.length)MC_HAPTICS.pr();else MC_HAPTICS.confirm();
    var ov=document.getElementById('fwDone');
    if(ov)ov.classList.add('open');
  }

  // Inject UI
  var _injected=false;
  function inject(){
    // Idempotency: inject() had no guard at all, so anything that evaluated
    // this module twice produced two of everything.
    if(_injected)return; _injected=true;
    injectDoneCss();
    // A few pages own their own .fw-bar because it drives page-specific logic
    // this module cannot replicate (run-workout.html's finishWorkout() writes a
    // custom-workout log entry). Injecting ours on top of theirs produced two
    // elements sharing id="fwBar" and two progress counters that disagreed --
    // getElementById() then silently resolved to whichever came first.
    // Take the modal and the done overlay regardless; skip only the bar.
    // M3: the bottom Finish bar is retired. Its two jobs moved into the session
    // toolbar that mc-summary.js builds at the top of the page -- "End workout"
    // and the progress readout (which keeps id="fwProgress", so updateProgress()
    // below still drives it unchanged). The bar cost 105px of a 844px viewport
    // and, stacked with the nav and the rest float, put 470px of chrome on
    // screen during a rest period. The modal and the done overlay are still
    // injected: those are the flow "End workout" opens.
    // A page that authored its own .fw-bar keeps it (run-workout.html's drives
    // custom-workout logging this module cannot replicate).
    document.body.insertAdjacentHTML('beforeend', modalHTML+doneHTML);
    // Watch for set check changes. NOT a document click-delegation listener —
    // mc-setlog.js's checkbox handler calls stopPropagation() (so does its
    // .mcl-wrap click guard), so a click on .set-check never bubbles to
    // document and a delegated listener here would silently never fire.
    // A class-attribute MutationObserver (same pattern mc-rep-progress.js and
    // mc-live-tracker.js already use for the identical problem) sees the
    // .done toggle directly, regardless of where the click originated or
    // whether it bubbles.
    var _upDbt=null;
    function debounceUpdate(){ clearTimeout(_upDbt); _upDbt=setTimeout(updateProgress,100); }
    new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var t=muts[i].target;
        if(t.classList&&t.classList.contains('set-check')){
          debounceUpdate();
          return;
        }
        // S5c-0: the denominator is now the OPEN day, so opening or closing
        // one resizes the workout — without this the bar sits at "0 / 0" from
        // page load until the first set is checked. Day headers are tapped a
        // handful of times a session, so this adds no meaningful churn.
        if(t.classList&&t.classList.contains('day-card')){
          debounceUpdate();
          return;
        }
      }
    }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
    // ...but not every page opens a day by toggling a class on the SAME node.
    // some pages re-render their day cards on open, so the card carrying
    // .open is a brand-new element and no attribute mutation is ever delivered
    // (measured: zero .day-card class records on such a page, one on
    // mm-p1.html, which toggles the class in place). Pick
    // that case up from MC_SCAN, the shared debounced body observer S5a moved
    // six modules onto — it already publishes exactly this "the cards just
    // re-rendered" signal, so this costs no new observer.
    if(window.MC_SCAN&&MC_SCAN.subscribe){
      MC_SCAN.subscribe(debounceUpdate);
      MC_SCAN.start();
    }
    updateProgress();
  }


  window._FW={
    finished:false,   // once true, updateProgress()'s auto-trigger stops firing
    open:function(){
      var elapsed=Date.now()-startTime;
      var checked=getCheckedSets();
      var timeEl=document.getElementById('fwStatTime');
      if(timeEl)timeEl.textContent=fmtElapsed(elapsed);
      var setsEl=document.getElementById('fwStatSets');
      if(setsEl)setsEl.textContent=checked+' set'+(checked===1?'':'s');
      // Zero-set / <30s accidental-open guard: nudge the default action
      // toward discard instead of logging a blank session.
      var btns=document.getElementById('fwModalBtns');
      if(btns)btns.classList.toggle('fw-emph',checked===0&&elapsed<30000);
      var m=document.getElementById('fwModal');
      if(m)m.classList.add('open');
    },
    close:function(){
      var m=document.getElementById('fwModal');
      if(m)m.classList.remove('open');
    },
    // Fully purges this attempt's draft state (no history entry is ever
    // written — saveWorkout()/saveSessionSummary()/MC_SYNC.push() are simply
    // never called) and returns to the dashboard. Resets DOM check state
    // first so mc-live-tracker.js's pagehide-triggered logSession() (which
    // reads live .checked/.done DOM state, not localStorage) can't resurrect
    // a "Resume last workout" pointer at this now-discarded session.
    //
    // A-5: this is the single most destructive control in the app — it ran
    // with zero confirmation and no way back, next to "Log workout" in the
    // same modal (D-2). Two changes: a confirm() naming exactly what is
    // lost, matching the project's own convention for a destructive action
    // (mc-card-actions.js's doReplace() uses the same pattern before
    // navigating to the exercise library); and a snapshot written BEFORE the
    // wipe, since discard() ends by navigating to dashboard.html — there is
    // no page left afterward to hold an in-memory Undo toast the way
    // applySwap()'s recoverable-swap pattern does. The dashboard offers
    // "Restore discarded workout" from that snapshot on arrival.
    discard:function(){
      var checked=getCheckedSets();
      if(checked>0){
        var noun=checked===1?'set':'sets';
        if(!confirm('Discard '+checked+' logged '+noun+'? You can restore this from the dashboard right after, but it will be gone if you log a new workout first.'))return;
      }
      try{
        var sessAll=JSON.parse(localStorage.getItem('mc_session_v1')||'{}');
        var slAll=JSON.parse(localStorage.getItem(SL_KEY)||'{}');
        var today=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
        var removedSets={};
        Object.keys(slAll).forEach(function(k){
          if(k.indexOf(pageId+'|')!==0)return;
          if(slAll[k][0]&&slAll[k][0].d===today)removedSets[k]=slAll[k][0];
        });
        var snapshot={
          pageId:pageId,
          workoutName:getWorkoutName(),
          ts:Date.now(),
          session:sessAll[pageId]||null,
          sets:removedSets
        };
        if(checked>0||snapshot.session){
          localStorage.setItem('mc_discard_snapshot_v1',JSON.stringify(snapshot));
        }
      }catch(e){}
      document.querySelectorAll('.ex-card.checked,.ss-ex.checked,.lift-card.checked,.ex-item.checked').forEach(function(c){c.classList.remove('checked');});
      document.querySelectorAll('.set-check.done').forEach(function(c){c.classList.remove('done');});
      try{
        var sess=JSON.parse(localStorage.getItem('mc_session_v1')||'{}');
        if(sess[pageId]){delete sess[pageId];localStorage.setItem('mc_session_v1',JSON.stringify(sess));}
      }catch(e){}
      try{
        var sl=JSON.parse(localStorage.getItem(SL_KEY)||'{}');
        var today2=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
        var changed=false;
        Object.keys(sl).forEach(function(k){
          if(k.indexOf(pageId+'|')!==0)return;
          if(sl[k][0]&&sl[k][0].d===today2){sl[k].shift();changed=true;}
          if(!sl[k].length){delete sl[k];changed=true;}
        });
        if(changed)localStorage.setItem(SL_KEY,JSON.stringify(sl));
      }catch(e){}
      try{
        // mc-live-tracker.js's own PAGE_ID keeps the ".html" suffix (unlike
        // this file's pageId, which strips it for the setlog/log-entry keys)
        // — match either form so a resume pointer written mid-session (e.g.
        // by a normal tab-switch triggering its visibilitychange listener)
        // still gets cleared here.
        var act=JSON.parse(localStorage.getItem('mc_activity')||'{}');
        if(act.last&&(act.last.pageId===pageId||act.last.pageId===pageId+'.html')){delete act.last;localStorage.setItem('mc_activity',JSON.stringify(act));}
      }catch(e){}
      clearTodaysDailyEntry();
      // Local and cloud used to diverge here: every checked set had already
      // written a row to Supabase's workout_logs via mc-setlog.js's onCheck()
      // (independent of Finish/discard), but discard() never called
      // saveWorkout()/MC_SYNC.push() so nothing ever removed them again.
      // Best-effort, scoped to exactly this page load's session id.
      try{
        if(window.MC_SB&&MC_SB.deleteSessionLog&&window.MCSetlogUtil&&MCSetlogUtil.sessionId){
          MC_SB.deleteSessionLog(MCSetlogUtil.sessionId).catch(function(){});
        }
      }catch(e){}
      try{if(window.MCActivity&&MCActivity.releaseSessionLock)MCActivity.releaseSessionLock();}catch(e){}
      window._FW.finished=true;
      window._FW.close();
      location.href='dashboard.html';
    },
    confirm:function(){
      window._FW.finished=true;
      var entry=saveWorkout();
      saveSessionSummary(entry);
      try{if(window.MCActivity&&MCActivity.releaseSessionLock)MCActivity.releaseSessionLock();}catch(e){}
      // back up the finished session right away (no-op when signed out)
      try{if(window.MC_SYNC&&MC_SYNC.push)MC_SYNC.push();}catch(e){}
      window._FW.close();
      // program-day-view-roadmap.md D1 — the ONE completion point in this
      // module, and until now it emitted nothing. A day-by-day program view
      // that lives on the same page as its workout (cat-strength.html is a
      // three-view SPA) has no other way to learn that the session it opened
      // was just banked. Detail carries the entry so a listener can keep the
      // log id and deep-link back into history.
      // Inert on the 77 other pages that load this file and don't listen.
      try{
        document.dispatchEvent(new CustomEvent('mc:workout-finished',{detail:{entry:entry,pageId:pageId}}));
      }catch(e){}
      // Celebratory recap instead of just a button flash
      showDone(entry);
      // Flash confirmation on the bar too
      var btn=document.querySelector('.fw-btn');
      if(btn){btn.textContent='✓ Saved!';btn.style.background='#34d399';}
      setTimeout(function(){
        if(btn){btn.textContent='Finish / Exit';btn.style.background='';}
      },2000);
    },
    doneClose:function(){
      var ov=document.getElementById('fwDone');
      if(ov)ov.classList.remove('open');
    }
  };

  // Run after DOM ready
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',inject);
  }else{
    inject();
  }
})();
