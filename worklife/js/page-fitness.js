(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;
  var tab = 'week';
  var workoutDate = App.todayStr();
  var WEEK = [[1, '周一'], [2, '周二'], [3, '周三'], [4, '周四'], [5, '周五'], [6, '周六'], [7, '周日']];
  var calY = new Date().getFullYear();
  var calM = new Date().getMonth() + 1;
  var fitnessDateFilter = false;

  function data() { return App.store.get().data.fitness; }
  function todayKey() {
    var p = App.todayStr().split('-').map(Number);
    var wd = new Date(p[0], p[1] - 1, p[2]).getDay();
    return wd === 0 ? 7 : wd;
  }
  function plan(k) { return (data().weekPlan || {})[k] || ''; }
  function exerciseName(id) {
    var e = App.find(data().exercises || [], id);
    return e ? e.name + (e.part ? ' · ' + e.part : '') : '已删除动作';
  }
  function weekStats() {
    var wk = App.store.get().settings.weekStartsOn;
    var planned = WEEK.filter(function (w) { return String(plan(w[0])).trim(); }).length;
    var dates = {};
    (data().workouts || []).forEach(function (w) { if (App.inThisWeek(w.date, wk)) dates[w.date] = 1; });
    var done = Object.keys(dates).length;
    return { planned: planned, done: done, pct: planned ? Math.min(100, Math.round(done / planned * 100)) : 0 };
  }

  function workoutDrawer(existing) {
    var ex = data().exercises || [];
    if (!ex.length) { App.ui.toast('请先到「训练记录」页添加一个动作', 'error'); return; }
    App.ui.drawer({
      title: existing ? '编辑训练记录' : '记一组训练',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, value: existing ? existing.date : workoutDate },
        { key: 'exerciseId', label: '动作', type: 'select', options: ex.map(function (e) { return [e.id, e.name + (e.part ? ' · ' + e.part : '')]; }), value: existing ? existing.exerciseId : ex[0].id },
        { key: 'sets', label: '组数', type: 'number', min: 1, value: existing ? existing.sets : 3 },
        { key: 'reps', label: '每组次数', type: 'number', min: 1, value: existing ? existing.reps : 10 },
        { key: 'weight', label: '重量（kg）', type: 'number', min: 0, value: existing ? existing.weight : 0 }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          var rec = {
            date: v.date, exerciseId: v.exerciseId,
            sets: Number(v.sets) || 0, reps: Number(v.reps) || 0, weight: Number(v.weight) || 0
          };
          if (existing) {
            var w = App.find(st.data.fitness.workouts, existing.id);
            if (w) Object.keys(rec).forEach(function (k) { w[k] = rec[k]; });
          } else {
            rec.id = App.uid();
            st.data.fitness.workouts.push(rec);
          }
        });
        App.shell.refresh();
      }
    });
  }

  function bodyDrawer(existing) {
    App.ui.drawer({
      title: existing ? '编辑身体数据' : '记一次体重',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, value: existing ? existing.date : App.todayStr() },
        { key: 'weight', label: '体重（kg）', type: 'number', min: 0, required: true, value: existing ? existing.weight : '' },
        { key: 'fat', label: '体脂（%，可选）', type: 'number', min: 0, value: existing ? existing.fat : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          var rec = { date: v.date, weight: Number(v.weight) || 0, fat: v.fat === '' ? null : Number(v.fat) };
          if (existing) {
            var b = App.find(st.data.fitness.body, existing.id);
            if (b) Object.keys(rec).forEach(function (k) { b[k] = rec[k]; });
          } else {
            rec.id = App.uid();
            st.data.fitness.body.push(rec);
          }
        });
        App.shell.refresh();
      }
    });
  }

  function trendSvg() {
    var arr = (data().body || []).slice().sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    }).slice(-12);
    var vals = arr.map(function (x) { return Number(x.weight) || 0; });
    if (!vals.length) {
      return '<div class="hint" data-testid="body-trend" data-count="0">还没有体重数据，记录后这里会出现趋势线</div>';
    }
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var span = max - min || 1;
    var pts = vals.map(function (v, i) {
      var x = vals.length === 1 ? 300 : 20 + i * (560 / (vals.length - 1));
      var y = 70 - ((v - min) / span) * 50;
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    return '<svg data-testid="body-trend" data-count="' + arr.length + '" viewBox="0 0 600 80" width="100%" height="80" role="img" aria-label="体重趋势">' +
      '<polyline points="' + pts.join(' ') + '" style="fill:none;stroke:var(--accent);stroke-width:2" />' +
      pts.map(function (p) {
        var xy = p.split(',');
        return '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="3" style="fill:var(--accent)" />';
      }).join('') + '</svg>';
  }

  function addExercise() {
    var nameEl = doc.getElementById('exercise-name');
    var partEl = doc.getElementById('exercise-part');
    if (!nameEl) return;
    var name = nameEl.value.trim();
    if (!name) { App.ui.toast('请填写动作名称', 'error'); nameEl.focus(); return; }
    App.store.commit(function (st) {
      st.data.fitness.exercises.push({ id: App.uid(), name: name, part: partEl ? partEl.value.trim() : '' });
    });
    App.shell.refresh();
  }

  function calendarView() {
    var wk = App.store.get().settings.weekStartsOn;
    var grid = App.monthGrid(calY, calM, wk);
    var today = App.todayStr();
    var byDate = {};
    (data().workouts || []).forEach(function (w) {
      (byDate[w.date] || (byDate[w.date] = [])).push(w);
    });
    var names = [];
    for (var i = 0; i < 7; i++) names.push(App.weekNames[(wk + i) % 7]);
    var cells = '';
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < 7; c++) {
        var date = grid[r][c];
        var p = App.parseDate(date);
        var out = (p.y !== calY || p.m !== calM);
        var items = byDate[date] || [];
        var has = items.length > 0;
        var tags = items.slice(0, 2).map(function (w) {
          var e = App.find(data().exercises || [], w.exerciseId);
          var part = e && e.part ? e.part : '';
          return '<span class="cal-tag" title="' + App.esc((e ? e.name : '已删动作') + (part ? ' · ' + part : '') + ' ' + w.sets + '×' + w.reps) + '">' +
            App.esc((part ? part + ' ' : '') + w.sets + '×' + w.reps) + '</span>';
        }).join('');
        if (items.length > 2) tags += '<span class="cal-more">+' + (items.length - 2) + '</span>';
        var cls = 'cal-cell' + (date === today ? ' today' : '') + (out ? ' out' : '') + (has ? ' has' : '');
        cells += '<div class="' + cls + '" data-cal-date="' + date + '" data-testid="cal-cell">' +
          '<div class="cal-date">' + p.d + '</div>' +
          (tags ? '<div class="cal-tags">' + tags + '</div>' : '') + '</div>';
      }
    }
    var head = '<div class="cal-bar"><button type="button" class="btn btn-sm" data-testid="fitness-cal-prev">← 上月</button>' +
      '<strong data-testid="fitness-cal-label">' + calY + ' 年 ' + calM + ' 月</strong>' +
      '<div style="display:flex;gap:6px"><button type="button" class="btn btn-sm" data-testid="fitness-cal-today">本月</button>' +
      '<button type="button" class="btn btn-sm" data-testid="fitness-cal-next">下月 →</button></div></div>';
    return '<div class="card">' + head +
      '<div class="cal-weekdays">' + names.map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</div>' +
      '<div class="cal-grid">' + cells + '</div></div>' +
      '<div class="hint" style="margin-top:10px">点任意一天，跳到「训练记录」查看或补记当天的训练；月历本身只读。</div>';
  }

  App.register('fitness', {
    title: '健身计划',
    desc: '周计划、训练日志与体重',
    primaryAction: {
      label: '+ 记一组训练',
      onClick: function () {
        if (tab === 'body') { bodyDrawer(null); return; }
        if (tab === 'week') tab = 'workouts';
        workoutDrawer(null);
        App.shell.refresh();
      }
    },
    todayCandidates: function () {
      var p = String(plan(todayKey())).trim();
      return p ? [{ title: '训练：' + p, time: '18:00' }] : [];
    },
    render: function (box) {
      var d = data();
      var stats = weekStats();
      var tabs = [['week', '本周计划'], ['workouts', '训练记录'], ['body', '身体数据'], ['calendar', '月历']];

      var body = '';
      if (tab === 'week') {
        body = '<div class="card"><h3 class="card-title">本周计划 · 点格子直接改，改完即时保存</h3>' +
          '<div class="week-grid">' + WEEK.map(function (w) {
            var val = plan(w[0]);
            return '<div class="week-cell" data-field="day,content"' + (w[0] === todayKey() ? ' style="border-color:var(--accent)"' : '') + '>' +
              '<strong>' + w[1] + (w[0] === todayKey() ? ' · 今天' : '') + '</strong>' +
              '<input class="input" style="margin-top:6px;padding:5px 7px;font-size:12px" data-week-day="' + w[0] + '" ' +
              'value="' + App.esc(val) + '" placeholder="休息 / 训练内容" autocomplete="off"></div>';
          }).join('') + '</div>' +
          '<div class="hint" style="margin-top:10px">首页「今日应练」读取今天这一格；空白视为休息。</div></div>';
      } else if (tab === 'workouts') {
        var workoutsAll = (d.workouts || []).slice().sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        });
        var workoutList = workoutsAll;
        var fitnessFilterBanner = '';
        if (fitnessDateFilter) {
          workoutList = workoutsAll.filter(function (w) { return w.date === workoutDate; });
          fitnessFilterBanner = '<div class="hint" style="margin-bottom:10px">正在查看 <strong>' + App.esc(App.fmtDate(workoutDate)) + '</strong> 的训练 · <button type="button" class="link-btn" data-testid="fitness-clear-filter">看全部</button></div>';
        }
        body = fitnessFilterBanner + '<div class="card"><div class="inline-form">' +
          '<label class="hint">日期 <input type="date" class="input" style="width:150px" data-testid="fitness-date" value="' + App.esc(workoutDate) + '"></label>' +
          '<button type="button" class="btn btn-primary btn-sm" data-testid="fitness-add-workout">+ 记一组训练</button></div>' +
          ((d.exercises || []).length ? '' : '<div class="hint">先在下方动作库添加一个动作，才能记录训练。</div>') +
          '</div>' +
          '<div class="card"><h3 class="card-title">动作库</h3>' +
          '<div class="inline-form">' +
          '<input class="input" id="exercise-name" data-testid="exercise-name" placeholder="动作名，如 卧推" autocomplete="off">' +
          '<input class="input" id="exercise-part" data-testid="exercise-part" placeholder="部位，如 胸" autocomplete="off">' +
          '<button type="button" class="btn btn-sm" data-testid="exercise-add">添加动作</button></div>' +
          '<div style="margin-top:8px">' + ((d.exercises || []).map(function (e) {
            return '<span class="chip" data-field="name,part">' + App.esc(e.name) +
              (e.part ? ' <span class="hint">· ' + App.esc(e.part) + '</span>' : '') +
              ' <button type="button" class="link-btn" data-exercise-del="' + e.id + '">×</button></span>';
          }).join('') || '<span class="hint">动作库还是空的</span>') + '</div></div>' +
          '<div class="card"><h3 class="card-title">训练记录 · 按日期倒序</h3>' +
          (workoutList.map(function (w) {
            return '<div class="row" data-field="date,exerciseId,sets,reps,weight">' +
              '<span class="row-main"><strong>' + App.esc(exerciseName(w.exerciseId)) + '</strong>' +
              '<span class="row-sub">' + App.esc(w.date) + ' · ' + App.esc(w.sets) + ' 组 × ' + App.esc(w.reps) + ' 次 · ' + App.esc(w.weight) + ' kg</span></span>' +
              '<button type="button" class="btn btn-sm" data-workout-edit="' + w.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-workout-del="' + w.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有训练记录', actionLabel: '记一组训练' })) + '</div>';
      } else if (tab === 'body') {
        var bodies = (d.body || []).slice().sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        });
        body = '<div class="card"><h3 class="card-title">体重趋势（最近 12 次）</h3>' + trendSvg() + '</div>' +
          '<div class="card"><div class="inline-form"><button type="button" class="btn btn-primary btn-sm" data-testid="fitness-add-body">+ 记一次体重</button></div>' +
          (bodies.map(function (b) {
            return '<div class="row" data-field="date,weight,fat">' +
              '<span class="row-main"><strong>' + App.esc(b.weight) + ' kg</strong>' +
              '<span class="row-sub">' + App.esc(b.date) + (b.fat != null && b.fat !== '' ? ' · 体脂 ' + App.esc(b.fat) + '%' : '') + '</span></span>' +
              '<button type="button" class="btn btn-sm" data-body-edit="' + b.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-body-del="' + b.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有身体数据', actionLabel: '记一次体重' })) + '</div>';
      } else {
        body = calendarView();
      }

      box.innerHTML =
        '<div class="grid-3" style="margin-bottom:12px">' +
        '<div class="stat"><div class="stat-label">本周计划训练</div><div class="stat-value" data-testid="fitness-planned">' + stats.planned + ' <span style="font-size:12px">天</span></div></div>' +
        '<div class="stat"><div class="stat-label">本周已练</div><div class="stat-value" data-testid="fitness-done">' + stats.done + ' <span style="font-size:12px">天</span></div></div>' +
        '<div class="stat"><div class="stat-label">本周完成度</div><div class="stat-value" data-testid="fitness-pct">' + stats.pct + '%</div>' +
        '<div class="progress" style="margin-top:6px"><i style="width:' + stats.pct + '%"></i></div></div></div>' +
        '<div class="tabs">' + tabs.map(function (t) {
          return '<button type="button" class="tab' + (tab === t[0] ? ' active' : '') + '" data-fitness-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div>' + body;

      App.ui.bindEmpty(box, function () {
        if (tab === 'workouts') workoutDrawer(null);
        else if (tab === 'body') bodyDrawer(null);
      });

      box.onclick = function (e) {
        var t = e.target;
        var tabBtn = t.closest && t.closest('[data-fitness-tab]');
        if (tabBtn) { tab = tabBtn.getAttribute('data-fitness-tab'); if (tab === 'workouts') fitnessDateFilter = false; App.shell.refresh(); return; }
        var calPrev = t.closest && t.closest('[data-testid="fitness-cal-prev"]');
        if (calPrev) { var pm = App.addMonths(calY, calM, -1); calY = pm.y; calM = pm.m; App.shell.refresh(); return; }
        var calNext = t.closest && t.closest('[data-testid="fitness-cal-next"]');
        if (calNext) { var nm = App.addMonths(calY, calM, 1); calY = nm.y; calM = nm.m; App.shell.refresh(); return; }
        var calToday = t.closest && t.closest('[data-testid="fitness-cal-today"]');
        if (calToday) { var nd = new Date(); calY = nd.getFullYear(); calM = nd.getMonth() + 1; App.shell.refresh(); return; }
        var calCell = t.closest && t.closest('[data-cal-date]');
        if (calCell) { workoutDate = calCell.getAttribute('data-cal-date'); fitnessDateFilter = true; tab = 'workouts'; App.shell.refresh(); return; }
        var clearF = t.closest && t.closest('[data-testid="fitness-clear-filter"]');
        if (clearF) { fitnessDateFilter = false; App.shell.refresh(); return; }
        var hit = t.closest && t.closest('[data-testid]');
        var testid = hit ? hit.getAttribute('data-testid') : '';
        if (testid === 'fitness-add-workout') { workoutDrawer(null); return; }
        if (testid === 'fitness-add-body') { bodyDrawer(null); return; }
        if (testid === 'exercise-add') { addExercise(); return; }
        var attrs = ['workout-edit', 'workout-del', 'body-edit', 'body-del', 'exercise-del'];
        for (var i = 0; i < attrs.length; i++) {
          var el = t.closest && t.closest('[data-' + attrs[i] + ']');
          if (!el) continue;
          var id = el.getAttribute('data-' + attrs[i]);
          var k = attrs[i];
          if (k === 'workout-edit') workoutDrawer(App.find(App.store.get().data.fitness.workouts, id));
          else if (k === 'body-edit') bodyDrawer(App.find(App.store.get().data.fitness.body, id));
          else {
            var group = k === 'workout-del' ? 'workouts' : k === 'body-del' ? 'body' : 'exercises';
            var removed = App.find(App.store.get().data.fitness[group], id);
            if (!removed) return;
            App.store.commit(function (st) {
              st.data.fitness[group] = st.data.fitness[group].filter(function (x) { return x.id !== id; });
            });
            App.ui.undo('已删除', function () {
              App.store.commit(function (st) { st.data.fitness[group].push(removed); });
              App.shell.refresh();
            });
            App.shell.refresh();
          }
          return;
        }
      };

      box.onchange = function (e) {
        var t = e.target;
        if (t.getAttribute && t.getAttribute('data-testid') === 'fitness-date') {
          workoutDate = t.value || App.todayStr();
          if (fitnessDateFilter) App.shell.refresh();
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-week-day')) {
          var k = t.getAttribute('data-week-day');
          var val = t.value;
          App.store.commit(function (st) {
            if (!st.data.fitness.weekPlan) st.data.fitness.weekPlan = {};
            st.data.fitness.weekPlan[k] = val;
          });
        }
      };

      box.onkeydown = function (e) {
        if (e.key !== 'Enter') return;
        if (e.target.id === 'exercise-name' || e.target.id === 'exercise-part') {
          e.preventDefault(); addExercise();
        }
      };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
