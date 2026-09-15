const { chromium } = require('playwright');
const BASE='http://localhost:8080';
(async()=>{
const b=await chromium.launch({executablePath:process.env.MC_CHROMIUM});
const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route('**://fonts.googleapis.com/**',r=>r.abort()); await ctx.route('**://*.supabase.co/**',r=>r.abort());
const pg=await ctx.newPage(); pg.on('dialog',d=>d.accept());
const errs=[]; pg.on('pageerror',e=>errs.push(e.message.slice(0,90)));

await pg.goto(BASE+'/manifest.json'); await pg.evaluate(()=>localStorage.clear());
await pg.goto(BASE+'/mm-p1.html?day=1',{waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});
await pg.waitForTimeout(700);

// state of card 0's logger BEFORE we touch anything
const before = await pg.evaluate(()=>{
  const s=document.querySelectorAll('.mcl-strip')[0];
  const c=s.closest('.ex-card,.ss-ex,.ex-item');
  const wrap=c.querySelector('.mcl-wrap');
  return { wrapExists:!!wrap, wrapOpen: wrap?wrap.classList.contains('open'):null,
           rows: wrap?wrap.querySelectorAll('.mcl-row').length:0,
           attr: c.getAttribute('data-mc-cluster') };
});
console.log('card 0 at load: '+JSON.stringify(before));

// set the cluster breakdown via the real ⋮ flow
await pg.evaluate(()=>document.querySelector('.mc-meatball').click()); await pg.waitForTimeout(400);
await pg.evaluate(()=>document.querySelector('[data-act="int-cluster"]').click()); await pg.waitForTimeout(600);
await pg.evaluate(()=>{const f=document.querySelector('.pi-f[data-f="reps"]'); f.value='5+5+5'; f.dispatchEvent(new Event('input',{bubbles:true}));
  document.querySelector('.mc-menu-overlay.open [data-act="save"]').click();});
await pg.waitForTimeout(1500);

const mid = await pg.evaluate(()=>{
  const c=document.querySelector('[data-mc-cluster]');
  const wrap=c?c.querySelector('.mcl-wrap'):null;
  return { attr:c?c.getAttribute('data-mc-cluster'):null,
           wrapExists:!!wrap, rows: wrap?wrap.querySelectorAll('.mcl-row').length:0,
           multiRepRows: wrap?Array.from(wrap.querySelectorAll('.mcl-row')).filter(r=>r.querySelectorAll('.mcl-r').length>1).length:0 };
});
console.log('immediately after Save (mid-session): '+JSON.stringify(mid));

// what store did it write?
const stores = await pg.evaluate(()=>{const o={};Object.keys(localStorage).filter(k=>k.indexOf('mc_')===0).forEach(k=>{const v=localStorage.getItem(k)||'';o[k]=v.length>160?v.slice(0,160)+'…':v;});return o;});
console.log('\nstores written:'); Object.entries(stores).forEach(([k,v])=>console.log('  '+k+' = '+v));

// now RELOAD, so the attribute is stamped before any logger builds
await pg.reload({waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});
await pg.waitForTimeout(1600);
const after = await pg.evaluate(async()=>{
  const c=document.querySelector('[data-mc-cluster]');
  if(!c) return {attr:null};
  const s=c.querySelector('.mcl-strip'); if(s){s.click(); await new Promise(r=>setTimeout(r,800));}
  const wrap=c.querySelector('.mcl-wrap');
  const rows=wrap?Array.from(wrap.querySelectorAll('.mcl-row')):[];
  const multi=rows.filter(r=>r.querySelectorAll('.mcl-r').length>1);
  return { attr:c.getAttribute('data-mc-cluster'), rows:rows.length, multiRepRows:multi.length,
    seeded: multi.length?Array.from(multi[0].querySelectorAll('.mcl-r')).map(x=>x.value||x.placeholder):null,
    clusterLabel: (c.querySelector('.mcl-cluster-lbl')||{}).textContent||null };
});
console.log('\nafter a RELOAD (attribute present before build): '+JSON.stringify(after));
console.log('\nVERDICT: mid-session bubbles='+(mid.multiRepRows>0?'YES':'NO')+'   after-reload bubbles='+(after.multiRepRows>0?'YES':'NO'));
if(errs.length) console.log('page errors: '+errs.join(' | '));
await b.close();})();
