'use strict';
/* ==========================================================================
   cr05-security.js — Security & Data Isolation Engineer.
   Protocol §0: "auth boundaries, data isolation, unsafe exposure, client-side
   trust assumptions, and sensitive data handling."

   Scope note, stated up front: live row-level-security attacks against the
   real Supabase project need a direct database URL, which this session does
   not hold (tests/test_rls.py SKIPS without SUPABASE_DB_URL rather than
   failing). What IS in scope here — and is the larger client-side surface —
   is everything the browser can be made to do on its own: what an
   unauthenticated device can read, what the owner-only surfaces do when
   nobody is signed in, whether a secret ever leaves the device, and whether
   licensed content leaks into the public build.
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, sleep } = require('./_harness');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0, unver = 0; const rows = [];
function chk(id, label, got, want, note) {
  const okv = JSON.stringify(got) === JSON.stringify(want);
  okv ? pass++ : fail++;
  rows.push({ id, label, ok: okv, got, want, note: note || '' });
  console.log(`  ${okv ? 'ok  ' : 'FAIL'}  [${id}] ${label}` + (okv ? '' : `  -> want ${JSON.stringify(want)} got ${JSON.stringify(got)}`) + (note && !okv ? `\n          ${note}` : ''));
}
function unverified(id, label, why) {
  unver++; rows.push({ id, label, ok: null, unverified: why });
  console.log(`  ----  [${id}] ${label}\n          UNVERIFIED: ${why}`);
}
const ROOT = path.join(__dirname, '../../..');

(async () => {
  const b = await browser();

  /* ---- S-01 the owner-only surface must not open to a stranger ---------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/pm-mode.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(1500);
    const st = await page.evaluate(() => {
      const t = (document.body.innerText || '');
      return {
        gated: /sign in|unlock|not authorised|not authorized|owner|face id|touch id|passcode/i.test(t),
        editable: document.querySelectorAll('[contenteditable=true]').length,
        publishBtns: [...document.querySelectorAll('button')].filter(x => /publish|save to cloud|push live/i.test(x.textContent || '')).filter(x => !x.disabled).length,
      };
    });
    chk('S-01', 'the Program Manager does not hand editing to an unauthenticated device',
        st.editable === 0, true, `contenteditable=${st.editable}, gated-copy=${st.gated}, enabled publish buttons=${st.publishBtns}`);
    await c.close();
  }

  /* ---- S-02 a secret must never be exported or synced ------------------- */
  {
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-registry.json'), 'utf8'));
    const stores = reg.stores || reg;
    const secretish = Object.entries(stores).filter(([k]) => /bio_cred|token|secret|password|passcode/i.test(k));
    const leaking = secretish.filter(([, v]) => v.export === true || v.sync);
    chk('S-02', 'no credential store is marked exportable or syncable',
        leaking.map(([k]) => k), [], `${secretish.length} credential-shaped store(s) declared`);
  }

  /* ---- S-03 the device must not ship a service-role / admin key --------- */
  {
    const files = fs.readdirSync(ROOT).filter(f => /\.(js|html|json)$/.test(f));
    const hits = [];
    for (const f of files) {
      const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
      // A Supabase service_role JWT carries this claim; an anon/publishable key does not.
      if (/service_role/.test(s)) hits.push(f + ' :: service_role');
      if (/SUPABASE_SERVICE|SERVICE_ROLE_KEY/.test(s)) hits.push(f + ' :: service key name');
    }
    chk('S-03', 'no service-role key or name is shipped to the browser', hits, []);
  }

  /* ---- S-04 client-side trust: the store is attacker-controlled --------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' }); await sleep(600);
    // Anything on the device can write localStorage. Forge an owner/admin flag
    // and a foreign user id, then see whether the client grants anything.
    await page.evaluate(() => {
      try {
        localStorage.setItem('mc_is_owner', 'true');
        localStorage.setItem('mc_role', 'admin');
        localStorage.setItem('mc_pm_unlocked', '1');
        localStorage.setItem('mc_bio_optout', '1');
      } catch (e) {}
    });
    await page.goto(`${BASE}/pm-mode.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(1600);
    const forged = await page.evaluate(() => ({
      editable: document.querySelectorAll('[contenteditable=true]').length,
      signedIn: !!(window.MC_SB && window.MC_SB.currentUser && false),
    }));
    chk('S-04', 'forging owner/admin flags in localStorage does not unlock the owner surface',
        forged.editable, 0, 'client-side flags must not be the authority');
    await c.close();
  }

  /* ---- S-05 no cross-origin exfiltration of training data --------------- */
  {
    const c = await ctx(b); const page = await c.newPage();
    const out = [];
    page.on('request', r => {
      const u = r.url();
      if (/^https?:\/\//.test(u) && !u.startsWith(BASE)) out.push(r.method() + ' ' + u.split('?')[0]);
    });
    await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'load' }); await sleep(2200);
    const hosts = [...new Set(out.map(u => (u.split(' ')[1] || '').split('/').slice(0, 3).join('/')))];
    // Known and intended: the app's own Supabase project and Google Fonts.
    const unexpected = hosts.filter(h => !/supabase\.co|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(h));
    chk('S-05', 'a workout page contacts no third-party host beyond its own backend and fonts',
        unexpected, [], `contacted: ${hosts.join(', ') || 'none'}`);
    await c.close();
  }

  /* ---- S-06 licensed content must not reach the public build ------------ */
  {
    const { execSync } = require('child_process');
    let ok = true, note = '';
    try { note = execSync('python3 tools/build-market.py --check', { cwd: ROOT }).toString().trim().split('\n').pop(); }
    catch (e) { ok = false; note = String(e.stdout || e.message).slice(0, 200); }
    chk('S-06', 'no licensed content or brand term is reachable from the public Rolodex build', ok, true, note);
  }

  /* ---- S-07 internal planning docs must not ship ------------------------ */
  {
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-manifest.json'), 'utf8'));
    const rootMd = fs.readdirSync(ROOT).filter(f => f.endsWith('.md'));
    const unlisted = rootMd.filter(f => !(man.scratch || []).includes(f) && !(man.shippable || []).includes(f));
    chk('S-07', 'every root document is classified scratch or shippable (no accidental disclosure)',
        unlisted, [], `${rootMd.length} root .md files`);
  }

  /* ---- S-08 live RLS: named as out of reach, not passed ----------------- */
  unverified('S-08', 'live cross-user row-level-security attacks',
    'tests/test_rls.py needs SUPABASE_DB_URL (a direct Postgres URL). This session has none, and the egress proxy denies CONNECT to the project host, so the suite would SKIP rather than run. Reported as unverified; the prior assessment executed 12 such attacks and recorded all blocked.');

  await b.close();
  fs.writeFileSync(__dirname + '/../../evidence/cr/cr05-security.json', JSON.stringify(rows, null, 1));
  console.log(`\ncr05 SECURITY — ${pass + fail} checks   PASS ${pass}   FAIL ${fail}   UNVERIFIED ${unver}`);
})();
