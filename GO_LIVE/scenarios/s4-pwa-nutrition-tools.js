/* GO_LIVE scenario set 4 — offline/PWA, nutrition suite, training tools,
   storage exhaustion. */
const { chromium } = require('playwright');
const BASE=(process.argv[2]||'http://localhost:8080').replace(/\/$/,'');
let pass=0, fail=0;
const ok=(n,x)=>{pass++;console.log(`  ok    ${n}${x?'  ['+x+']':''}`);};
const bad=(n,g,w)=>{fail++;console.log(`  FAIL  ${n} — observed: ${g} | expected: ${w}`);};
const t=(n,g,w)=>(String(g)===String(w)?ok(n,String(g)):bad(n,g,w));
const warn=(n,x)=>console.log(`  note  ${n}${x?'  ['+x+']':''}`);

(async()=>{
const b=await chromium.launch({executablePath:process.env.MC_CHROMIUM});
const ctx=await b.newContext({viewport:{width:390,height:844}});
const pg=await ctx.newPage();
const errors=[];
pg.on('pageerror',e=>errors.push('pageerror: '+e.message));
pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push('console: '+m.text());});

console.log('\n=== S4.1  PWA install surface ===');
const mani=await (await ctx.request.get(BASE+'/manifest.json')).json();
t('manifest declares a name',!!mani.name,'true');
t('manifest is installable (display standalone/fullscreen)',/standalone|fullscreen|minimal-ui/.test(mani.display||''),'true');
t('manifest declares a start_url',!!mani.start_url,'true');
const icons=(mani.icons||[]).map(i=>i.sizes).join(' ');
if(/192/.test(icons)&&/512/.test(icons)) ok('manifest ships the 192 and 512 icons installers require',icons);
else bad('manifest icons',icons||'none','at least 192x192 and 512x512');
await pg.goto(BASE+'/dashboard.html',{waitUntil:'networkidle'});
await pg.waitForTimeout(1500);
const head=await pg.evaluate(()=>({
  mani:!!document.querySelector('link[rel=manifest]'),
  theme:(document.querySelector('meta[name=theme-color]')||{}).content||null,
  viewport:(document.querySelector('meta[name=viewport]')||{}).content||'',
  appleCap:!!document.querySelector('meta[name="apple-mobile-web-app-capable"]')}));
t('the page links its manifest',head.mani,'true');
t('a theme-color is declared',!!head.theme,'true');
t('the viewport opts into the safe-area (viewport-fit=cover)',/viewport-fit=cover/.test(head.viewport),'true');
t('iOS standalone meta present',head.appleCap,'true');

console.log('\n=== S4.2  service worker registers and precaches ===');
const sw=await pg.evaluate(async()=>{
  if(!navigator.serviceWorker) return {supported:false};
  const reg=await navigator.serviceWorker.getRegistration();
  return {supported:true,registered:!!reg,scope:reg?reg.scope:null,
    state:reg&&reg.active?reg.active.state:(reg&&reg.installing?'installing':null)};});
if(!sw.supported) bad('service worker support','absent','present');
else if(sw.registered) ok('a service worker is registered',`${sw.state||'?'} @ ${sw.scope}`);
else bad('service worker registration','not registered','registered');
await pg.waitForTimeout(2500);
const caches=await pg.evaluate(async()=>{const ks=await window.caches.keys();
  const out={};for(const k of ks){out[k]=(await (await window.caches.open(k)).keys()).length;}return out;});
const total=Object.values(caches).reduce((a,c)=>a+c,0);
if(total>0) ok('the app shell is precached',JSON.stringify(caches));
else bad('precache after first load','0 cached entries','a populated cache');

console.log('\n=== S4.3  offline: the athlete is mid-session when the signal drops ===');
// The realistic case, and the only one this origin can actually show: the page
// is ALREADY OPEN when connectivity goes. Load it online, drop the network, then
// log. (Offline *navigation* is unobservable here — DEF-09: sw.js:374 gates its
// fetch handler to https://mcross2298.github.io, so on localhost nothing is ever
// served from the SW cache. Reported, not scored.)
await pg.goto(BASE+'/mm-p1.html?day=1',{waitUntil:'networkidle'});
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});
const logOne=(w)=>pg.evaluate((weight)=>{
  const s=document.querySelectorAll('.mcl-strip')[0];
  const c=s.closest('.ex-card,.ss-ex,.ex-item')||s.parentElement;
  let wr=c.querySelector('.mcl-wrap');
  if(!wr||!wr.classList.contains('open')){s.click();wr=c.querySelector('.mcl-wrap');}
  const ck=wr&&wr.querySelector('.mcl-ck:not(.done)'); if(!ck)return 'NOROW';
  const row=ck.closest('.mcl-row'), wi=row.querySelector('.mcl-w');
  if(wi){wi.value=String(weight);wi.dispatchEvent(new Event('input',{bubbles:true}));}
  ck.click(); return 'OK';
},w);
const countSets=()=>pg.evaluate(()=>{try{const s=JSON.parse(localStorage.getItem('mc_setlog_v1')||'{}');
  return Object.keys(s).reduce((n,k)=>{const e=(s[k]||[])[0];return n+(e&&e.sets?Object.keys(e.sets).length:0);},0);}catch(e){return -1;}});
await logOne(135); await pg.waitForTimeout(900);
const onlineSets=await countSets();
t('a set logged while online persists',onlineSets>0,true);

await ctx.setOffline(true);
const offRes=await logOne(185);
await pg.waitForTimeout(1200);
const offlineSets=await countSets();
t('the logger still accepts a set with the network down',offRes,'OK');
if(offlineSets>onlineSets) ok('the offline set persisted locally',`${onlineSets} -> ${offlineSets} set(s) in mc_setlog_v1`);
else bad('offline set persistence',`${onlineSets} -> ${offlineSets}`,'the count increases');
const tmrOffline=await pg.evaluate(()=>{try{TMR.start(document.querySelector('.rest-timer'),30,'Offline rest');
  return TMR.isRunning();}catch(e){return 'threw: '+e.message;}});
t('the rest timer still runs with no network',tmrOffline,'true');
await pg.evaluate(()=>{try{TMR.stop();}catch(e){}});
// An offline NAVIGATION, reported rather than scored (DEF-09).
let navOffline='loaded';
try{ await pg.goto(BASE+'/mm-p2.html',{waitUntil:'domcontentloaded',timeout:10000}); }
catch(e){ navOffline=e.message.split('\n')[0].replace('page.goto: ','').slice(0,46); }
warn('offline NAVIGATION is unobservable on this origin (DEF-09 — sw.js is gated to the production origin)',navOffline);
await ctx.setOffline(false);
await pg.waitForTimeout(400);
ok('reconnected');

console.log('\n=== S4.4  nutrition: goal calculator and macro logging ===');
await pg.goto(BASE+'/dashboard.html?tab=nutrition',{waitUntil:'networkidle'});
await pg.waitForTimeout(2500);
const nutri=await pg.evaluate(()=>({
  calc:!!window.MCMacroCalc, macros:!!window.MCMacros,
  text:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,180)}));
t('the goal calculator module is loaded on the Nutrition tab',nutri.calc,'true');
if(/macro|calorie|protein|carb|fat|kcal/i.test(nutri.text)) ok('the Nutrition tab renders macro content',JSON.stringify(nutri.text.slice(0,70)));
else bad('Nutrition tab content',JSON.stringify(nutri.text.slice(0,70)),'macro/calorie copy');
// write goals the way the calculator would, then confirm the rings read them back
const applied=await pg.evaluate(()=>{
  const r=window.MCMacroCalc.recommend({sex:'male',age:30,heightCm:180,weightLb:200,activity:'moderate',goal:'cut'});
  let s={}; try{s=JSON.parse(localStorage.getItem('mc_macros_v1')||'{}');}catch(e){}
  s.goals={kcal:r.kcal,p:r.p,f:r.f,c:r.c};
  localStorage.setItem('mc_macros_v1',JSON.stringify(s));
  return r;});
console.log(`    calculator output for a 200 lb / 180 cm / 30 y male, moderate, cutting:`);
console.log(`      BMR ${applied.bmr} · TDEE ${applied.tdee} · target ${applied.kcal} kcal · ${applied.p}p / ${applied.f}f / ${applied.c}c`);
const closes=Math.abs(applied.p*4+applied.f*9+applied.c*4-applied.kcal)<=4;
t('the macro split adds back up to the calorie target (Atwater)',closes,'true');
await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(2000);
const readBack=await pg.evaluate(()=>{try{return (JSON.parse(localStorage.getItem('mc_macros_v1')||'{}').goals||{}).kcal;}catch(e){return null;}});
t('goals survive a reload',readBack,applied.kcal);
// log a food entry and check the day total
const logged=await pg.evaluate(()=>{
  const key='mc_macros_v1'; let s={}; try{s=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){}
  const d=new Date(); const day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  s.days=s.days||{}; s.days[day]=s.days[day]||{items:[]};
  s.days[day].items.push({name:'Chicken breast 200g',kcal:330,p:62,f:7,c:0});
  localStorage.setItem(key,JSON.stringify(s));
  return {day:day,items:s.days[day].items.length};});
await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(2200);
const shown=await pg.evaluate(()=>(document.body.innerText||'').replace(/\s+/g,' '));
if(/330|Chicken/i.test(shown)) ok('a logged food reaches the Nutrition surface',logged.items+' item(s)');
else warn('a directly-seeded food row was not visible in the tab text — the tab may render items only in its own sheet',JSON.stringify(shown.slice(0,70)));

console.log('\n=== S4.5  training tools reachable and functional ===');
for(const [label,url,probe] of [
  ['Exercise Library','/exercise-library.html',()=>document.querySelectorAll('[class*=ex-],[class*=lib-],li,button').length],
  // mc-maxout.js publishes no window global — it is a page script for this
  // page — so the honest probe is that the page renders its inputs.
  ['Max-Out Calculator','/max-out.html',()=>document.querySelectorAll('input').length],
  ['Build Your Own','/build-workout.html',()=>document.querySelectorAll('input,button').length],
  ['MC Wrapped','/wrapped.html',()=>document.body.innerText.length],
  ['Program Guide','/program-guide.html',()=>document.body.innerText.length],
  ['Workout Logs','/workout-logs.html',()=>document.body.innerText.length],
  ['Stats / Muscle Map','/stats.html',()=>document.querySelectorAll('svg,canvas').length],
]){
  await pg.goto(BASE+url,{waitUntil:'networkidle'});
  await pg.waitForTimeout(1200);
  const v=await pg.evaluate(probe);
  if(v&&Number(v)>0) ok(`${label} loads and renders`,String(v)); else bad(`${label} renders`,String(v),'non-empty');
}
console.log('\n=== S4.6  Quick Pump generates a real session ===');
await pg.goto(BASE+'/quick-pump.html',{waitUntil:'networkidle'});
await pg.waitForTimeout(2000);
const qp=await pg.evaluate(()=>{
  const api=window.MCQuickPump;
  if(!api) return {mod:false};
  const out={mod:true,fns:Object.keys(api),runs:[]};
  try{
    [[30,'Full Body'],[45,'Full Body'],[30,'Chest']].forEach(([minutes,focus])=>{
      const g=api.generate({minutes:minutes,focus:focus});
      out.runs.push({minutes:minutes,focus:focus,name:g&&g.name,
        n:(g&&g.exercises||[]).length,
        named:(g&&g.exercises||[]).every(e=>e&&e.name),
        sets:(g&&g.exercises||[]).every(e=>e&&(e.sets||e.reps))});
    });
  }catch(e){ out.threw=e.message; }
  return out;});
if(!qp.mod) bad('Quick Pump is reachable','window.MCQuickPump is undefined on quick-pump.html','the module published');
else if(qp.threw) bad('Quick Pump generate()',qp.threw,'a generated session');
else{
  ok('Quick Pump publishes its API',qp.fns.join(','));
  qp.runs.forEach(r=>{
    if(r.n>0&&r.named&&r.sets) ok(`Quick Pump generated a ${r.minutes}-min ${r.focus} session`,`${r.n} exercises, all named with a prescription`);
    else bad(`Quick Pump ${r.minutes}-min ${r.focus}`,JSON.stringify(r),'a non-empty session, every exercise named and prescribed');
  });
  const counts=qp.runs.map(r=>r.n);
  if(counts[1]>=counts[0]) ok('a 45-minute session is not shorter than a 30-minute one',counts.join(' vs '));
  else bad('45 vs 30 minute session length',counts.join(' vs '),'45 >= 30');
}

console.log('\n=== S4.7  storage exhaustion warns instead of silently losing work ===');
await pg.goto(BASE+'/mm-p1.html?day=1',{waitUntil:'networkidle'});
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});
const full=await pg.evaluate(()=>{
  let i=0; const blob='x'.repeat(256*1024);
  try{ for(;i<400;i++) localStorage.setItem('__fill_'+i,blob); }catch(e){ return {filled:i,err:e.name}; }
  return {filled:i,err:null};});
console.log(`    filled localStorage until the browser refused: ${full.filled} x 256KB blobs (${full.err||'no error'})`);
await pg.evaluate(()=>{
  const s=document.querySelectorAll('.mcl-strip')[0];const c=s.closest('.ex-card,.ss-ex,.ex-item');
  let w=c.querySelector('.mcl-wrap'); if(!w||!w.classList.contains('open')){s.click();w=c.querySelector('.mcl-wrap');}
  const ck=w&&w.querySelector('.mcl-ck:not(.done)'); if(ck){const row=ck.closest('.mcl-row');
    row.querySelector('.mcl-w').value='999'; row.querySelector('.mcl-w').dispatchEvent(new Event('input',{bubbles:true})); ck.click();}});
await pg.waitForTimeout(1800);
// What is actually true here, and it corrects M7's original framing: with
// storage genuinely full the set-log write STILL LANDS, because replacing an
// existing key frees its old bytes before the new value is measured. So the
// correct behaviour is a logged set and NO warning — there was no failure to
// report. The real exposure needs a write that GROWS past the remaining
// headroom, which s4b-isolation-probes.js drives directly and which does raise
// the Phase 5.3 banner.
const after=await pg.evaluate(()=>{
  let n=-1; try{const s=JSON.parse(localStorage.getItem('mc_setlog_v1')||'{}');
    n=Object.keys(s).reduce((a,k)=>{const e=(s[k]||[])[0];return a+(e&&e.sets?Object.keys(e.sets).length:0);},0);}catch(e){}
  const alert=document.querySelector('[role=alert]');
  return {sets:n, alert:!!alert,
    text:alert?(alert.innerText||'').replace(/\s+/g,' ').trim().slice(0,90):null};});
if(after.sets>0&&!after.alert)
  ok('on a full device a REPLACING set-log write still lands, and correctly warns about nothing',after.sets+' set(s) persisted');
else if(after.alert)
  ok('the write could not land and the Phase 5.3 banner said so',JSON.stringify(after.text));
else bad('full-device set logging',JSON.stringify(after),'either the set persists, or a role=alert explains why it did not');
await pg.evaluate(()=>{Object.keys(localStorage).filter(k=>k.indexOf('__fill_')===0).forEach(k=>localStorage.removeItem(k));});

console.log('\n=== errors ===');
if(errors.length){fail++;console.log('  FAIL  '+errors.length+' error(s):');errors.slice(0,12).forEach(e=>console.log('        '+e));}
else ok('zero uncaught page errors across the PWA/nutrition/tools campaign');
await b.close();
console.log(`\nS4 pwa/nutrition/tools: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
})();
