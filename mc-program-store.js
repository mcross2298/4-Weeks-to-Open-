/* ==========================================================================
   mc-program-store.js — custom multi-week programs (Phase 5)
   --------------------------------------------------------------------------
   Store: localStorage 'mc_custom_programs_v1' — synced via mc-sync.js.
     [{ id, name, icon, color, weeks, createdAt, updatedAt,
        days: [{ name, exercises: [{name, muscle, sets, reps, rest}] }] }]
   A deleted program stays in the array as a tombstone
   { id, deleted:true, updatedAt } so the delete propagates through the
   sync's newest-wins merge instead of resurrecting on the next pull;
   getAll/get never surface tombstones, and they're pruned after 90 days.

   window.MCPrograms — getAll / get / save / remove / asProgCard.
   asProgCard() maps a custom program into the same shape the dashboard's
   PROGS array uses, so the hero card, program-select sheet, and mc-theme.js
   all work on it with zero special-casing.
   ========================================================================== */
(function () {
  if (window.MCPrograms) return;

  var KEY = 'mc_custom_programs_v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function push() { try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {} }

  function live(a) { return a.filter(function (p) { return p && !p.deleted; }); }
  var TOMBSTONE_MS = 90 * 24 * 60 * 60 * 1000;
  function prune(a) {
    var cutoff = Date.now() - TOMBSTONE_MS;
    return a.filter(function (p) {
      if (!p || !p.deleted) return true;
      var t = Date.parse(p.updatedAt || '') || 0;
      return t > cutoff;
    });
  }

  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  window.MCPrograms = {
    getAll: function () { return live(read()); },
    get: function (id) {
      return live(read()).filter(function (p) { return p.id === id; })[0] || null;
    },
    save: function (prog) {
      var a = read();
      if (!prog.id) { prog.id = uid(); prog.createdAt = new Date().toISOString(); }
      prog.updatedAt = new Date().toISOString();
      var i = a.findIndex(function (p) { return p.id === prog.id; });
      if (i >= 0) a[i] = prog; else a.unshift(prog);
      write(prune(a));
      push();
      return prog;
    },
    remove: function (id) {
      var a = read();
      var i = a.findIndex(function (p) { return p && p.id === id; });
      if (i >= 0) a[i] = { id: id, deleted: true, updatedAt: new Date().toISOString() };
      write(prune(a));
      push();
    },
    // dashboard PROGS shape — hero card + select sheet render this directly
    asProgCard: function (p) {
      return {
        id: 'cprog-' + p.id,
        cprogId: p.id,
        icon: p.icon || '🧩',
        name: p.name,
        meta: (p.weeks || 1) + (p.weeks > 1 ? ' Weeks' : ' Week') + ' · ' + p.days.length + ' Days · Custom',
        color: p.color || '#34d399',
        desc: 'Your custom program — ' + p.days.map(function (d) { return d.name; }).join(' · ').slice(0, 80),
        href: 'cat-custom.html?prog=' + p.id,
        splits: p.days.map(function (d) { return d.name; })
      };
    }
  };
})();
