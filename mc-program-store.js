/* ==========================================================================
   mc-program-store.js — custom multi-week programs (Phase 5)
   --------------------------------------------------------------------------
   Store: localStorage 'mc_custom_programs_v1' — synced via mc-sync.js.
     [{ id, name, icon, color, weeks, createdAt, updatedAt,
        days: [{ name, exercises: [{name, muscle, sets, reps, rest}] }] }]

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

  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  window.MCPrograms = {
    getAll: function () { return read(); },
    get: function (id) {
      return read().filter(function (p) { return p.id === id; })[0] || null;
    },
    save: function (prog) {
      var a = read();
      if (!prog.id) { prog.id = uid(); prog.createdAt = new Date().toISOString(); }
      prog.updatedAt = new Date().toISOString();
      var i = a.findIndex(function (p) { return p.id === prog.id; });
      if (i >= 0) a[i] = prog; else a.unshift(prog);
      write(a);
      push();
      return prog;
    },
    remove: function (id) {
      write(read().filter(function (p) { return p.id !== id; }));
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
