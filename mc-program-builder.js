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

  // ---- intensifiers --------------------------------------------------------
  // Same set of intensifiers the standalone workout builder (build-workout.html)
  // exposes, so a program DAY and a custom workout offer identical tools:
  // tempo, drop sets (a chained sequence), supersets/tri-sets/giant sets
  // (consecutive linked exercises) and cluster sets. Each exercise also keeps
  // its sets/reps/rest. The day runner (run-program.html) reads the same fields.
  var TEMPO_PRESETS = ['3:0:1:0', '4:0:1:0', '5:0:1:0', '3:1:1:0', '2:0:1:2', '3:3:1:0', '2:2:1:0', '3:0:3:0'];
  var DROP_PRESETS = [['AMRAP', 'Drop · to failure'], ['15', 'Drop · 15'], ['12', 'Drop · 12'], ['10', 'Drop · 10'], ['8', 'Drop · 8'], ['6', 'Drop · 6']];
  var CLUSTER_REST = ['10s', '15s', '20s', '30s'];

  function newExercise(name, muscle) {
    return { name: name, muscle: muscle, sets: 3, reps: '10', rest: 90, tempo: '', drops: [], superset: false, cluster: '', clusterRest: '' };
  }
  function groupLabel(n) { return n >= 4 ? 'Giant set' : (n === 3 ? 'Tri-set' : 'Superset'); }
  function parseCluster(val) { return val ? val.split('+').map(function (p) { return p.trim(); }) : []; }
  function buildCluster(parts) { return parts.filter(function (p) { return p; }).join('+'); }

  function tempoSel(di, xi, val) {
    val = val || '';
    var opts = '<option value="">Tempo: none</option>';
    TEMPO_PRESETS.forEach(function (t) { opts += '<option value="' + t + '"' + (t === val ? ' selected' : '') + '>⏱ ' + t + '</option>'; });
    return '<select class="dx-sel" onchange="MCPB.upd(' + di + ',' + xi + ',\'tempo\',this.value)" title="Lifting tempo">' + opts + '</select>';
  }
  function dropStepSel(di, xi, k, val, isFirst) {
    val = val || '';
    var none = isFirst ? 'No drop set' : '— remove drop —';
    var opts = '<option value="">' + none + '</option>';
    DROP_PRESETS.forEach(function (d) { opts += '<option value="' + esc(d[0]) + '"' + (d[0] === val ? ' selected' : '') + '>↘️ ' + esc(d[1]) + '</option>'; });
    return '<select class="dx-sel dx-drop" onchange="MCPB.updDrop(' + di + ',' + xi + ',' + k + ',this.value)" title="Drop set ' + (k + 1) + '">' + opts + '</select>';
  }
  function dropEditor(di, xi, drops) {
    drops = drops || [];
    var h = dropStepSel(di, xi, 0, drops[0] || '', true);
    for (var k = 1; k < drops.length; k++) h += dropStepSel(di, xi, k, drops[k], false);
    if (drops.length >= 1) h += '<button type="button" class="dx-dropadd" onclick="MCPB.addDrop(' + di + ',' + xi + ')" title="Add another drop">＋ drop</button>';
    return h;
  }
  function clusterRestSel(di, xi, val) {
    val = val || '15s';
    var opts = '';
    CLUSTER_REST.forEach(function (r) { opts += '<option value="' + esc(r) + '"' + (r === val ? ' selected' : '') + '>⏲ ' + esc(r) + ' intra-rest</option>'; });
    return '<select class="dx-sel" onchange="MCPB.upd(' + di + ',' + xi + ',\'clusterRest\',this.value)" title="Rest between clusters">' + opts + '</select>';
  }
  function clusterEditor(di, xi, ex) {
    var active = !!ex.cluster;
    var parts = parseCluster(ex.cluster);
    if (active && parts.length < 3) parts = ['5', '5', '5'];
    var h = '<label class="cluster-toggle"><input type="checkbox"' + (active ? ' checked' : '') + ' onchange="MCPB.clusterToggle(' + di + ',' + xi + ',this.checked)"> 🧩 Cluster set</label>';
    if (active) {
      h += '<div class="cluster-config">';
      h += '<select class="dx-sel cluster-count" onchange="MCPB.clusterCount(' + di + ',' + xi + ',this.value)" title="Number of mini-sets">';
      [3, 4].forEach(function (n) { h += '<option value="' + n + '"' + (parts.length === n ? ' selected' : '') + '>' + n + ' mini-sets</option>'; });
      h += '</select>';
      parts.forEach(function (p, k) {
        if (k > 0) h += '<span class="cluster-plus">+</span>';
        h += '<input class="dx-mini cluster-rep" type="text" value="' + esc(p) + '" onchange="MCPB.clusterRep(' + di + ',' + xi + ',' + k + ',this.value)" title="Mini-set ' + (k + 1) + ' reps">';
      });
      h += '<span class="dx-lbl">reps</span></div>';
      h += clusterRestSel(di, xi, ex.clusterRest);
    }
    return h;
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
      // group consecutive superset-linked exercises (per day) so each chain can
      // be labelled by size (superset / tri-set / giant set).
      var grp = [], sizes = [];
      d.exercises.forEach(function (ex, xi) {
        if (xi > 0 && ex.superset && grp.length) { var g = grp[xi - 1]; grp[xi] = g; sizes[g]++; }
        else { var ng = sizes.length; grp[xi] = ng; sizes[ng] = 1; }
      });
      var rows = d.exercises.map(function (ex, xi) {
        var ssActive = !!ex.superset && xi > 0;
        var gSize = sizes[grp[xi]];
        var firstOfGroup = (xi === 0 || grp[xi] !== grp[xi - 1]);
        var groupTag = (gSize > 1 && firstOfGroup) ? '<div class="dx-grouptag">⚡ ' + groupLabel(gSize) + '</div>' : '';
        var ssBtn = xi === 0
          ? '<span class="dx-sshint" title="The first exercise starts a group">—</span>'
          : '<button type="button" class="dx-ss' + (ssActive ? ' on' : '') + '" onclick="MCPB.toggleSuperset(' + di + ',' + xi + ')" title="'
            + (ssActive ? 'Linked as a superset with the exercise above — click to unlink' : 'Link with the exercise above (superset → tri-set → giant set)')
            + '">' + (ssActive ? '⚡ Superset' : '🔗 Make superset') + '</button>';
        var moveBtns = '<button class="dx-move" onclick="MCPB.moveEx(' + di + ',' + xi + ',-1)" ' + (xi === 0 ? 'disabled' : '') + ' title="Move up — reorder to pick superset partners">▲</button>'
          + '<button class="dx-move" onclick="MCPB.moveEx(' + di + ',' + xi + ',1)" ' + (xi === d.exercises.length - 1 ? 'disabled' : '') + ' title="Move down — reorder to pick superset partners">▼</button>';
        return '<div class="dx-item' + (ssActive ? ' ss-linked' : '') + '">' +
          groupTag +
          (ssActive ? '<div class="dx-sslink">⚡ Linked with ' + esc(d.exercises[xi - 1].name) + '</div>' : '') +
          '<div class="dx-top">' + moveBtns +
            '<span class="dx-name">' + esc(ex.name) + '</span>' + ssBtn +
            '<button class="dx-del" onclick="MCPB.delEx(' + di + ',' + xi + ')" title="Remove">✕</button>' +
          '</div>' +
          '<div class="dx-controls">' +
            '<input class="dx-mini" type="number" min="1" max="12" value="' + esc(ex.sets) + '" onchange="MCPB.upd(' + di + ',' + xi + ',\'sets\',this.value)" title="sets"><span class="dx-lbl">sets</span>' +
            '<input class="dx-mini" value="' + esc(ex.reps) + '" maxlength="6" onchange="MCPB.upd(' + di + ',' + xi + ',\'reps\',this.value)" title="reps"><span class="dx-lbl">reps</span>' +
            '<input class="dx-mini" type="number" min="0" max="600" step="15" value="' + esc(ex.rest) + '" onchange="MCPB.upd(' + di + ',' + xi + ',\'rest\',this.value)" title="rest (seconds)"><span class="dx-lbl">rest s</span>' +
            tempoSel(di, xi, ex.tempo) +
          '</div>' +
          '<div class="dx-controls dx-drops">' + dropEditor(di, xi, ex.drops) + '</div>' +
          '<div class="dx-controls cluster-editor">' + clusterEditor(di, xi, ex) + '</div>' +
        '</div>';
      }).join('');
      return '<div class="day-card">' +
        '<div class="day-head">' +
          '<input class="day-name-inp" value="' + esc(d.name) + '" maxlength="28"' +
            ' onchange="MCPB.renameDay(' + di + ',this.value)">' +
          '<button class="day-del" onclick="MCPB.delDay(' + di + ')" title="Delete day">🗑</button>' +
        '</div>' +
        (d.exercises.length
          ? rows
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
      prog.days[pickDay].exercises.push(newExercise(entry.name, entry.muscle));
      renderDays(); validate(); closePicker();
      return;
    }
    // Standard catalog row
    var ex = (window.EXERCISES || [])[parseInt(row.dataset.i, 10)];
    if (!ex) return;
    prog.days[pickDay].exercises.push(newExercise(ex.name, ex.muscle));
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
      // sets/reps/rest/tempo/clusterRest change in place without a re-render so
      // the focused field is not torn down mid-edit; structural changes below
      // (superset, reorder, drops, cluster on/off) do re-render.
      if (field === 'sets') ex.sets = Math.max(1, Math.min(12, parseInt(v, 10) || 3));
      else if (field === 'rest') ex.rest = Math.max(0, Math.min(600, parseInt(v, 10) || 0));
      else if (field === 'tempo') ex.tempo = v || '';
      else if (field === 'clusterRest') ex.clusterRest = v || '15s';
      else ex.reps = String(v).slice(0, 6) || '10';
    },
    // Link/unlink with the exercise directly above. The first exercise in a day
    // can never be a superset (nothing above it), so reorder controls let any
    // two exercises be placed adjacent and paired — not just a fixed neighbour.
    toggleSuperset: function (di, xi) {
      var ex = prog.days[di] && prog.days[di].exercises[xi];
      if (!ex || xi === 0) return;
      ex.superset = !ex.superset;
      renderDays();
    },
    moveEx: function (di, xi, dir) {
      var exs = prog.days[di] && prog.days[di].exercises;
      if (!exs) return;
      var j = xi + dir;
      if (j < 0 || j >= exs.length) return;
      var tmp = exs[xi]; exs[xi] = exs[j]; exs[j] = tmp;
      if (exs[0]) exs[0].superset = false;   // first slot can't superset upward
      renderDays();
    },
    updDrop: function (di, xi, k, v) {
      var ex = prog.days[di] && prog.days[di].exercises[xi];
      if (!ex) return;
      ex.drops = (ex.drops || []).slice();
      if (v === '') ex.drops.splice(k, 1); else ex.drops[k] = v;
      renderDays();
    },
    addDrop: function (di, xi) {
      var ex = prog.days[di] && prog.days[di].exercises[xi];
      if (!ex) return;
      ex.drops = (ex.drops || []).slice();
      ex.drops.push('AMRAP');   // new drop defaults to "to failure"
      renderDays();
    },
    clusterToggle: function (di, xi, checked) {
      var ex = prog.days[di] && prog.days[di].exercises[xi];
      if (!ex) return;
      if (checked) { ex.cluster = ex.cluster || '5+5+5'; if (!ex.clusterRest) ex.clusterRest = '15s'; }
      else { ex.cluster = ''; ex.clusterRest = ''; }
      renderDays();
    },
    clusterCount: function (di, xi, n) {
      var ex = prog.days[di] && prog.days[di].exercises[xi];
      if (!ex) return;
      n = parseInt(n, 10);
      var parts = parseCluster(ex.cluster);
      var last = parts[parts.length - 1] || '5';
      while (parts.length < n) parts.push(last);
      parts = parts.slice(0, n);
      ex.cluster = buildCluster(parts);
      renderDays();
    },
    clusterRep: function (di, xi, k, v) {
      var ex = prog.days[di] && prog.days[di].exercises[xi];
      if (!ex) return;
      var parts = parseCluster(ex.cluster);
      parts[k] = (v || '').trim() || '5';
      ex.cluster = buildCluster(parts);
      renderDays();
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
