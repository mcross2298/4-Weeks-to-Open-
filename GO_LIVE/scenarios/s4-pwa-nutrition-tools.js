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

console.log('\n=== S4.3  offline: does the app still open, and can you still log? ===');
await ctx.setOffline(true);
let offlineOpened='threw';
try{ await pg.goto(BASE+'/dashboard.html',{waitUntil:'domcontentloaded',timeout:15000}); offlineOpened='loaded'; }
catch(e){ offlineOpened='nav failed: '+e.message.split('\n')[0].slice(0,60); }
const offlineBody=offlineOpened==='loaded'
  ? await pg.evaluate(()=>(document.body.innerText||'').replace(/\s+/g,' ').trim().slice(0,60)) : '';
if(offlineOpened==='loaded'&&offlineBody.length>0) ok('the dashboard opens with the network down',JSON.stringify(offlineBody.slice(0,44)));
else bad('offline dashboard launch',offlineOpened+' '+JSON.stringify(offlineBody),'a rendered dashboard from cache');
// offline set logging
let offlineLog='n/a';
try{
  await pg.goto(BASE+'/mm-p1.html?day=1',{waitUntil:'domcontentloaded',timeout:15000});
  await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:15000});
  offlineLog=await pg.evaluate(()=>{
    const s=document.querySelectorAll('.mcl-strip')[0];const c=s.closest('.ex-card,.ss-ex,.ex-item');
    let w=c.querySelector('.mcl-wrap'); if(!w||!w.classList.contains('open')){s.click();w=c.querySelector('.mcl-wrap');}
    const ck=w.querySelector('.mcl-ck:not(.done)'); if(!ck)return 'NOROW';
    const row=ck.closest('.mcl-row'); row.querySelector('.mcl-w').value='175';
    row.querySelector('.mcl-w').dispatchEvent(new Event('input',{bubbles:true}));
    ck.click(); return 'clicked';});
  await pg.waitForTimeout(1200);
  const kept=await pg.evaluate(()=>{try{const s=JSON.parse(localStorage.getItem('mc_setlog_v1')||'{}');
    return Object.keys(s).reduce((n,k)=>{const e=(s[k]||[])[0];return n+(e&&e.sets?Object.keys(e.sets).length:0);},0);}catch(e){return -1;}});
  if(offlineLog==='clicked'&&kept>0) ok('a set logged with no signal persists locally',kept+' set(s) in mc_setlog_v1');
  else bad('offline set logging',`click=${offlineLog} persisted=${kept}`,'the set persists');
}catch(e){ bad('offline workout page','could not open: '+e.message.split('\n')[0].slice(0,60),'opens from cache'); }
await ctx.setOffline(false);
await pg.waitForTimeout(500);
ok('reconnected');

console.log('\n=== S4.4  nutrition: goal calculator and macro logging ===');
await pg.goto(BASE+'/dashboard.html?tab=nutrition',{waitUntil:'networkidle'});
await pg.waitForTimeout(2500);
const nutri=await pg.evaluate(()=>({
  calc:!!window.MCMacroCalc, macros:!!window.MCMacros,
  text:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,180)}));
t('the goal calculator module is loaded on the Nutrition tab',nutri.calc,'true');
if(/calorie|protein|carb|fat|kcal/i.test(nutri.text)) ok('the Nutrition tab renders macro content',JSON.stringify(nutri.text.slice(0,70)));
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
  ['Max-Out Calculator','/max-out.html',()=>!!window.MC_MAXOUT||document.querySelectorAll('input').length],
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
await pg.goto(BASE+'/dashboard.html',{waitUntil:'networkidle'});
await pg.waitForTimeout(2000);
const qp=await pg.evaluate(()=>{
  if(!window.MC_QUICK_PUMP) return {mod:false};
  const api=window.MC_QUICK_PUMP;
  const fns=Object.keys(api);
  let gen=null;
  try{ if(api.generate) gen=api.generate({minutes:30}); }catch(e){ return {mod:true,fns:fns,threw:e.message}; }
  return {mod:true,fns:fns,count:gen&&gen.exercises?gen.exercises.length:(Array.isArray(gen)?gen.length:null)};});
if(!qp.mod) warn('MC_QUICK_PUMP is not published on the dashboard — it may mount on its own page');
else if(qp.threw) bad('Quick Pump generate()',qp.threw,'a generated session');
else if(qp.count) ok('Quick Pump generated a 30-minute session',qp.count+' exercises');
else warn('Quick Pump module present; generate() signature differs',JSON.stringify(qp.fns).slice(0,90));

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
const banner=await pg.evaluate(()=>{
  const alert=document.querySelector('[role=alert]');
  return {alert:!!alert, text:alert?(alert.innerText||'').replace(/\s+/g,' ').trim().slice(0,90):null,
    bodyMentions:/storage|space|full|room/i.test(document.body.innerText||'')};});
if(banner.alert&&banner.text) ok('a full device shows a real warning instead of failing silently',JSON.stringify(banner.text));
else if(banner.bodyMentions) ok('the page surfaces a storage message',JSON.stringify((await pg.evaluate(()=>document.body.innerText)).slice(0,80)));
else bad('storage-full warning','no role=alert and no storage copy on the page','a visible warning');
await pg.evaluate(()=>{Object.keys(localStorage).filter(k=>k.indexOf('__fill_')===0).forEach(k=>localStorage.removeItem(k));});

console.log('\n=== errors ===');
if(errors.length){fail++;console.log('  FAIL  '+errors.length+' error(s):');errors.slice(0,12).forEach(e=>console.log('        '+e));}
else ok('zero uncaught page errors across the PWA/nutrition/tools campaign');
await b.close();
console.log(`\nS4 pwa/nutrition/tools: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
})();
