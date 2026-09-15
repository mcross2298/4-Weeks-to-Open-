/* PHASE 2 / F — dark mode is the app's DEFAULT theme and the one axis with no
   CI gate. check-contrast --dark counts findings but, with no baseline file,
   prints only a total. This probe surfaces the actionable class directly:
   text that is effectively INVISIBLE (contrast < 1.6:1) against what is
   actually painted behind it. */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const BASE=(process.argv[2]||'http://localhost:8080').replace(/\/$/,'');
const all = execSync(`git ls-files '*.html'`,{cwd:'/home/user/4-Weeks-to-Open-',encoding:'utf8'})
  .split('\n').filter(Boolean).filter(p=>!p.endsWith('.dc.html'));
// one page per family + every page W-I3 named
const pick = ['dashboard.html','dashboard.html?tab=nutrition','dashboard.html?tab=conditioning',
  'stats.html','workout-logs.html','exercise-library.html','program-guide.html','quick-tour.html',
  'max-out.html','build-workout.html','wrapped.html','collections.html','psu-strength.html',
  'mm-p1.html','kitchen-sink.html','pmc-back.html','s3-back-traps.html','chest-tri-pump.html',
  'legacy-prep.html','hv-block.html','iron-engine.html','2on-1off.html','battle-ropes.html',
  'cat-strength.html','cat-pmc.html','index.html'].filter(p=>all.includes(p.split('?')[0]));

const PROBE = () => {
  const lum = c => { const [r,g,b]=c; const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const parse = s => { const m=/rgba?\(([^)]+)\)/.exec(s||''); if(!m) return null;
    const p=m[1].split(',').map(x=>parseFloat(x)); return {c:[p[0],p[1],p[2]], a:p.length>3?p[3]:1}; };
  // A gradient or image background paints pixels this probe cannot read, so an
  // element sitting on one is UNKNOWABLE rather than invisible. Reporting a
  // gold-gradient button with dark text as "1.15:1 on black" would be a false
  // positive -- exactly the kind this pass must not produce. Walk up looking
  // for a solid colour, and bail out the moment a painted gradient/image is in
  // the way.
  const bgOf = el => { let n=el;
    while(n && n!==document.documentElement){
      const cs=getComputedStyle(n);
      if(cs.backgroundImage && cs.backgroundImage !== 'none') return 'GRADIENT';
      const b=parse(cs.backgroundColor);
      if(b && b.a>0.5) return b.c;
      n=n.parentElement; }
    const hb=parse(getComputedStyle(document.body).backgroundColor); return hb?hb.c:[0,0,0]; };
  const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05);};
  const out=[];
  document.querySelectorAll('*').forEach(el=>{
    if(el.children.length) return;                       // leaf text only
    const t=(el.textContent||'').trim(); if(!t || t.length>90) return;
    const r=el.getBoundingClientRect(); if(r.width<4||r.height<4) return;
    const cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)<0.15) return;
    const fg=parse(cs.color); if(!fg||fg.a<0.35) return;
    const bg=bgOf(el);
    if(bg==='GRADIENT') return;                 // unreadable by this method, not a finding
    const rt=ratio(fg.c,bg);
    if(rt<1.6) out.push({sel:(el.tagName.toLowerCase()+'.'+String(el.className||'').split(' ').filter(Boolean).slice(0,2).join('.')).slice(0,44),
      text:t.slice(0,28), ratio:+rt.toFixed(2), color:cs.color, bg:'rgb('+bg.join(',')+')'});
  });
  const seen={}; return out.filter(o=>{const k=o.sel+o.ratio; if(seen[k])return false; seen[k]=1; return true;}).slice(0,10);
};

(async()=>{
const b=await chromium.launch({executablePath:process.env.MC_CHROMIUM});
const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route('**://fonts.googleapis.com/**',r=>r.abort());
await ctx.route('**://*.supabase.co/**',r=>r.abort());
// force the app's own dark theme the way it stores it
await ctx.addInitScript(()=>{ try{ localStorage.setItem('mc_theme_mode','dark'); }catch(e){} });
let total=0; const rows=[];
for(const page of pick){
  const pg=await ctx.newPage();
  try{
    await pg.goto(BASE+'/'+page,{waitUntil:'domcontentloaded',timeout:22000});
    await pg.waitForTimeout(1500);
    const theme=await pg.evaluate(()=>document.documentElement.getAttribute('data-theme')||'(none)');
    const hits=await pg.evaluate(PROBE);
    if(hits.length){ total+=hits.length; rows.push({page,theme,hits}); process.stdout.write('x'); }
    else process.stdout.write('.');
  }catch(e){ process.stdout.write('!'); }
  await pg.close();
}
await b.close();
console.log(`\n\nPHASE F — dark mode, ${pick.length} pages, text with contrast < 1.6:1 (effectively invisible)`);
console.log(`pages with at least one: ${rows.length}   distinct findings: ${total}\n`);
rows.forEach(r=>{ console.log(`${r.page}  [data-theme=${r.theme}]`);
  r.hits.forEach(h=>console.log(`    ${h.ratio}:1  ${h.sel}  "${h.text}"   ${h.color} on ${h.bg}`)); });
})();
