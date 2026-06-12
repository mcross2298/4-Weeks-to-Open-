/* ==========================================================================
   mc-program-pub.js — globally published custom programs (Phase 3 backend)
   --------------------------------------------------------------------------
   Owner-published programs live in the Supabase `published_programs` table
   (read open to all, writes admin-only via RLS — see supabase/phase3.sql).
   Each row's `program` JSON is the exact mc-program-store.js shape, so the
   same pages (cat-custom.html, run-program.html) render and run them.

   The table is mirrored into localStorage 'mc_published_programs_v1' so all
   sync reads (dashboard tiers, program-select sheet, run pages) work offline
   and before the network answers. refresh() re-pulls at most once a minute
   unless forced, and dispatches 'mc:published-programs' on change.

   window.MCPub — getAll / get / isPublished (sync, cache) ·
                  refresh / publish / unpublish (async, owner-only writes) ·
                  asProgCard (dashboard PROGS shape, like MCPrograms').
   ========================================================================== */
(function () {
  if (window.MCPub) return;

  var KEY = 'mc_published_programs_v1';
  var MAX_AGE = 60 * 1000;          // auto-refresh throttle

  function readCache() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { fetchedAt: 0, programs: [] }; }
    catch (e) { return { fetchedAt: 0, programs: [] }; }
  }
  function writeCache(programs) {
    var changed = JSON.stringify(readCache().programs) !== JSON.stringify(programs);
    try { localStorage.setItem(KEY, JSON.stringify({ fetchedAt: Date.now(), programs: programs })); } catch (e) {}
    if (changed) {
      try { document.dispatchEvent(new CustomEvent('mc:published-programs')); } catch (e) {}
    }
  }

  // mc-supabase.js may load after us (page scripts run bottom-of-body) —
  // resolve the client once the DOM is ready and MC_SB exists.
  function sbClient() {
    return new Promise(function (resolve) {
      if (window.MC_SB) { resolve(window.MC_SB); return; }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { resolve(window.MC_SB || null); });
      } else resolve(null);
    }).then(function (sb) {
      if (!sb || !sb.configured) return null;
      return sb.ready;
    });
  }

  function refresh(force) {
    if (!force && Date.now() - readCache().fetchedAt < MAX_AGE) {
      return Promise.resolve(readCache().programs);
    }
    return sbClient().then(function (c) {
      if (!c) return readCache().programs;
      return c.from('published_programs').select('id, program').then(function (r) {
        if (r.error) throw r.error;
        var programs = (r.data || []).map(function (row) { return row.program; })
          .filter(function (p) { return p && p.id && p.name && p.days; });
        writeCache(programs);
        return programs;
      });
    });
  }

  function publish(prog) {
    return sbClient().then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return MC_SB.currentUser().then(function (u) {
        return c.from('published_programs').upsert({
          id: prog.id, program: prog,
          updated_at: new Date().toISOString(), updated_by: u && u.id
        }, { onConflict: 'id' }).then(function (r) {
          if (r.error) throw r.error;
          var a = readCache().programs.filter(function (p) { return p.id !== prog.id; });
          a.unshift(prog);
          writeCache(a);
          return prog;
        });
      });
    });
  }

  function unpublish(id) {
    return sbClient().then(function (c) {
      if (!c) throw new Error('Supabase not configured');
      return c.from('published_programs').delete().eq('id', id).then(function (r) {
        if (r.error) throw r.error;
        writeCache(readCache().programs.filter(function (p) { return p.id !== id; }));
      });
    });
  }

  window.MCPub = {
    getAll: function () { return readCache().programs; },
    get: function (id) {
      return readCache().programs.filter(function (p) { return p.id === id; })[0] || null;
    },
    isPublished: function (id) { return !!this.get(id); },
    refresh: refresh,
    publish: publish,
    unpublish: unpublish,
    // dashboard PROGS shape — mirrors MCPrograms.asProgCard but links by ?pub=
    asProgCard: function (p) {
      return {
        id: 'pub-' + p.id,
        pubId: p.id,
        icon: p.icon || '📣',
        name: p.name,
        meta: (p.weeks || 1) + (p.weeks > 1 ? ' Weeks' : ' Week') + ' · ' + p.days.length + ' Days · Published',
        color: p.color || '#34d399',
        desc: p.days.map(function (d) { return d.name; }).join(' · ').slice(0, 80),
        href: 'cat-custom.html?pub=' + p.id,
        splits: p.days.map(function (d) { return d.name; })
      };
    }
  };

  // keep the mirror warm: every page that includes this module re-pulls (at
  // most once a minute), so published programs reach users without a redeploy
  function init() { refresh().catch(function () {}); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
