/* ==========================================================================
   mc-program-builder.js — Phase 5 builder logic (build-program.html)
   --------------------------------------------------------------------------
   Builds/edits a custom multi-week program over the shared exercise catalog
   (EXERCISES / MUSCLE_COLORS from exercise-catalog.js) and persists through
   MCPrograms (mc-program-store.js). ?id=<programId> opens an existing
   program for editing.
   ========================================================================== */
(function () {
  var ICONS = ['🧩', '🦍', '⚒️', '🚀', '🐺', '🏆', '⚡', '🔱'];
  var COLORS = ['#34d399', '#e11d48', '#7F77DD', '#d4af37', '#14b8a6',
                '#f97316', '#378ADD', '#D85A30'];
  var MAX_WEEKS = 12;

  var prog = {
    id: null, name: '', icon: ICONS[0], color: COLORS[0], weeks: 4,
    days: [{ name: 'Day 1', exercises: [] }]
  };
  var pickDay = -1;          // which day the exercise picker is adding to
  var pkFilter = 'All';

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---- load for editing -----------------------------------------------------
  (function () {
    var id = new URLSearchParams(location.search).get('id');
    if (!id || !window.MCPrograms) return;
    var p = MCPrograms.get(id);
    if (p) {
      prog = JSON.parse(JSON.stringify(p));
      $('pbTitle').textContent = 'Edit Program';
    }
  })();

  // ---- meta pickers -----------------------------------------------------------
  function renderMeta() {
    $('pName').value = prog.name;
    $('pIcons').innerHTML = ICONS.map(function (i) {
      return '<div class="pick' + (i === prog.icon ? ' sel' : '') + '" data-i="' + i + '">' + i + '</div>';
    }).join('');
    $('pColors').innerHTML = COLORS.map(function (c) {
      return '<div class="pick color-pick' + (c === prog.color ? ' sel' : '') + '" data-c="' + c + '">' +
        '<span class="swatch" style="background:' + c + ';box-shadow:0 0 8px ' + c + '66;"></span></div>';
    }).join('');
    var wk = '';
    [1, 2, 3, 4, 6, 8, 12].forEach(function (n) {
      wk += '<button class="wk-btn' + (n === prog.weeks ? ' sel' : '') + '" data-w="' + n + '">' + n + '</button>';
    });
    $('pWeeks').innerHTML = wk;
  }

  $('pIcons').addEventListener('click', function (e) {
    var p = e.target.closest('.pick'); if (!p) return;
    prog.icon = p.dataset.i; renderMeta(); validate();
  });
  $('pColors').addEventListener('click', function (e) {
    var p = e.target.closest('.pick'); if (!p) return;
    prog.color = p.dataset.c; renderMeta(); validate();
  });
  $('pWeeks').addEventListener('click', function (e) {
    var b = e.target.closest('.wk-btn'); if (!b) return;
    prog.weeks = Math.min(MAX_WEEKS, parseInt(b.dataset.w, 10) || 4);
    renderMeta(); validate();
  });
  $('pName').addEventListener('input', function () {
    prog.name = $('pName').value.trim(); validate();
  });

  // ---- days -------------------------------------------------------------------
  function renderDays() {
    $('pDays').innerHTML = prog.days.map(function (d, di) {
      var rows = d.exercises.map(function (ex, xi) {
        return '<div class="dx-row">' +
          '<span class="dx-name">' + esc(ex.name) + '</span>' +
          '<input class="dx-mini" type="number" value="' + esc(ex.sets) + '" min="1" max="12"' +
            ' onchange="MCPB.upd(' + di + ',' + xi + ',\'sets\',this.value)">' +
          '<input class="dx-mini" value="' + esc(ex.reps) + '" maxlength="6"' +
            ' onchange="MCPB.upd(' + di + ',' + xi + ',\'reps\',this.value)">' +
          '<input class="dx-mini" type="number" value="' + esc(ex.rest) + '" min="0" max="600" step="15"' +
            ' onchange="MCPB.upd(' + di + ',' + xi + ',\'rest\',this.value)">' +
          '<button class="dx-del" onclick="MCPB.delEx(' + di + ',' + xi + ')">✕</button>' +
        '</div>';
      }).join('');
      return '<div class="day-card">' +
        '<div class="day-head">' +
          '<input class="day-name-inp" value="' + esc(d.name) + '" maxlength="28"' +
            ' onchange="MCPB.renameDay(' + di + ',this.value)">' +
          '<button class="day-del" onclick="MCPB.delDay(' + di + ')" title="Delete day">🗑</button>' +
        '</div>' +
        (d.exercises.length
          ? '<div class="dx-hdr"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Rest s</span><span></span></div>' + rows
          : '<div style="font-size:12px;color:#475569;font-weight:700;padding:4px 0;">No exercises yet.</div>') +
        '<button class="add-ex" onclick="MCPB.openPicker(' + di + ')">＋ Add exercise</button>' +
      '</div>';
    }).join('');
  }

  // ---- exercise picker ---------------------------------------------------------
  function pkMuscles() {
    var ms = ['All'];
    (window.EXERCISES || []).forEach(function (e) {
      if (ms.indexOf(e.muscle) === -1) ms.push(e.muscle);
    });
    return ms;
  }
  function renderPicker() {
    $('pkFilters').innerHTML = pkMuscles().map(function (m) {
      return '<button class="pk-f' + (m === pkFilter ? ' on' : '') + '" data-m="' + esc(m) + '">' + esc(m) + '</button>';
    }).join('');
    var q = ($('pkSearch').value || '').toLowerCase().trim();
    var rows = '';
    (window.EXERCISES || []).forEach(function (e, i) {
      if (pkFilter !== 'All' && e.muscle !== pkFilter) return;
      if (q && e.name.toLowerCase().indexOf(q) === -1) return;
      var col = (window.MUSCLE_COLORS || {})[e.muscle] || '#64748b';
      rows += '<div class="pk-row" data-i="' + i + '">' +
        '<span class="pk-dot" style="background:' + col + ';"></span>' +
        '<span class="pk-nm">' + esc(e.name) + '</span>' +
        '<span class="pk-add">＋</span></div>';
    });
    if (!rows && q.length >= 2 && window.MC_EXCATALOG) {
      var muscle = MC_EXCATALOG.classify(q);
      var col = (window.MUSCLE_COLORS && MUSCLE_COLORS[muscle]) || '#d4af37';
      rows = '<button type="button" class="pk-row pk-add-new" data-newex="' + q.replace(/"/g, '&quot;') + '">'
        + '<span class="pk-dot" style="background:' + col + ';box-shadow:0 0 5px ' + col + '44;"></span>'
        + '<span class="pk-nm">＋ Add &ldquo;' + esc(q) + '&rdquo; as new exercise'
        + '<span style="display:block;font-size:11px;color:#64748b;font-weight:600;margin-top:2px;">' + esc(muscle) + ' &middot; saved to your library</span>'
        + '</span>'
        + '<span class="pk-add">+</span></button>';
    }
    $('pkList').innerHTML = rows || '<div class="mc-pm-empty">No matches.</div>';
  }
  $('pkFilters').addEventListener('click', function (e) {
    var b = e.target.closest('.pk-f'); if (!b) return;
    pkFilter = b.dataset.m; renderPicker();
  });
  $('pkSearch').addEventListener('input', renderPicker);
  $('pkList').addEventListener('click', function (e) {
    var row = e.target.closest('.pk-row');
    if (!row || pickDay < 0) return;
    // "Add new exercise" row — data-newex attribute present
    if (row.dataset.newex !== undefined && window.MC_EXCATALOG) {
      var entry = MC_EXCATALOG.add(row.dataset.newex);
      // Queue for PM publish if the owner is editing
      if (window.MC_PM && MC_PM.active()) MC_EXCATALOG.queueForPublish(entry);
      prog.days[pickDay].exercises.push({ name: entry.name, muscle: entry.muscle, sets: 3, reps: '10', rest: 90 });
      renderDays(); validate(); closePicker();
      return;
    }
    // Standard catalog row
    var ex = (window.EXERCISES || [])[parseInt(row.dataset.i, 10)];
    if (!ex) return;
    prog.days[pickDay].exercises.push({ name: ex.name, muscle: ex.muscle, sets: 3, reps: '10', rest: 90 });
    renderDays(); validate();
    closePicker();
  });
  $('pkOverlay').addEventListener('click', function (e) {
    if (e.target === $('pkOverlay')) closePicker();
  });
  function closePicker() { $('pkOverlay').classList.remove('open'); pickDay = -1; }

  // ---- validation + save --------------------------------------------------------
  function validate() {
    var ok = !!prog.name &&
      prog.days.length > 0 &&
      prog.days.every(function (d) { return d.name.trim(); }) &&
      prog.days.some(function (d) { return d.exercises.length > 0; });
    $('saveBtn').disabled = !ok;
    $('saveNote').textContent = ok
      ? prog.weeks + ' weeks · ' + prog.days.length + ' days/week'
      : 'Name it, add at least one day with one exercise.';
    return ok;
  }

  // ---- public API for inline handlers --------------------------------------------
  window.MCPB = {
    addDay: function () {
      prog.days.push({ name: 'Day ' + (prog.days.length + 1), exercises: [] });
      renderDays(); validate();
    },
    delDay: function (di) {
      if (prog.days[di].exercises.length &&
          !confirm('Delete "' + prog.days[di].name + '" and its exercises?')) return;
      prog.days.splice(di, 1);
      renderDays(); validate();
    },
    renameDay: function (di, v) { prog.days[di].name = v.trim() || ('Day ' + (di + 1)); validate(); },
    delEx: function (di, xi) { prog.days[di].exercises.splice(xi, 1); renderDays(); validate(); },
    upd: function (di, xi, field, v) {
      var ex = prog.days[di] && prog.days[di].exercises[xi];
      if (!ex) return;
      if (field === 'sets') ex.sets = Math.max(1, Math.min(12, parseInt(v, 10) || 3));
      else if (field === 'rest') ex.rest = Math.max(0, Math.min(600, parseInt(v, 10) || 90));
      else ex.reps = String(v).slice(0, 6) || '10';
    },
    openPicker: function (di) {
      pickDay = di;
      $('pkOverlay').classList.add('open');
      renderPicker();
      $('pkSearch').focus();
    },
    save: function () {
      if (!validate()) return;
      prog.days = prog.days.filter(function (d) { return d.exercises.length || confirm('"' + d.name + '" has no exercises — keep it anyway?'); });
      var saved = MCPrograms.save(prog);
      applyCreateIntent(saved.id);
      location.href = 'cat-custom.html?prog=' + saved.id + '&new=1';
    }
  };

  // "+ Create" wizard hand-off: when a new program was started from the
  // creator, persist its chosen structure as the program's landing layout
  // override (PM working copy). Consumed once, only for program-typed intents.
  function applyCreateIntent(progId) {
    var intent;
    try { intent = JSON.parse(localStorage.getItem('mc_pm_create_intent') || 'null'); } catch (e) { return; }
    if (!intent || intent.type !== 'program' || !intent.structure) return;
    try { localStorage.removeItem('mc_pm_create_intent'); } catch (e) {}
    try {
      var doc = JSON.parse(localStorage.getItem('mc_pm_overrides') || '{}');
      if (!doc.layouts) doc.layouts = {};
      doc.layouts['landing:cprog-' + progId] = { style: intent.structure };
      localStorage.setItem('mc_pm_overrides', JSON.stringify(doc));
    } catch (e) {}
  }

  renderMeta();
  renderDays();
  validate();
})();
