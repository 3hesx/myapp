(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;

  var CARDS = [
    ['media', '自媒体'], ['dev', '开发工作'], ['consult', '咨询工作'],
    ['fitness', '健身计划'], ['diet', '饮食计划'], ['games', '游戏娱乐']
  ];

  function summaries() {
    var s = App.store.get();
    var d = s.data;
    var today = App.todayStr();
    var month = App.monthKey(today);
    var wk = s.settings.weekStartsOn;
    var p = today.split('-').map(Number);
    var wd = new Date(p[0], p[1] - 1, p[2]).getDay();
    var weekKey = wd === 0 ? 7 : wd;
    var dietDay = (d.diet.days || {})[today] || null;
    var meals = ['breakfast', 'lunch', 'dinner', 'snack'];
    var mealCount = dietDay ? meals.filter(function (m) { return (dietDay[m] || []).length > 0; }).length : 0;

    return {
      media: {
        main: (d.media.topics || []).filter(function (t) { return t.status === 'ready'; }).length,
        mainLabel: '待发布',
        sub: '本月已发 ' + (d.media.posts || []).filter(function (x) { return App.monthKey(x.date) === month; }).length,
        has: (d.media.topics || []).length + (d.media.posts || []).length + (d.media.metrics || []).length + (d.media.ideas || []).length > 0
      },
      dev: {
        main: (d.dev.projects || []).filter(function (x) { return x.status === 'active'; }).length,
        mainLabel: '进行中',
        sub: '未完成 ' + (d.dev.tasks || []).filter(function (x) { return x.status !== 'done'; }).length,
        has: (d.dev.projects || []).length + (d.dev.tasks || []).length + (d.dev.snippets || []).length > 0
      },
      consult: {
        main: (d.consult.followups || []).filter(function (x) { return !x.done; }).length,
        mainLabel: '待跟进',
        sub: '本月 ' + (d.consult.sessions || []).filter(function (x) { return App.monthKey(x.date) === month; }).length + ' 次',
        has: (d.consult.clients || []).length + (d.consult.sessions || []).length + (d.consult.followups || []).length > 0
      },
      fitness: {
        main: (d.fitness.weekPlan || {})[weekKey] || '休息',
        mainLabel: '今日应练',
        sub: '本周已练 ' + (d.fitness.workouts || []).filter(function (x) { return App.inThisWeek(x.date, wk); }).length + ' 次',
        has: (d.fitness.workouts || []).length + (d.fitness.exercises || []).length + (d.fitness.body || []).length > 0 ||
          Object.keys(d.fitness.weekPlan || {}).some(function (k) { return d.fitness.weekPlan[k]; })
      },
      diet: {
        main: mealCount + ' / 4',
        mainLabel: '餐次',
        sub: '饮水 ' + (dietDay ? (dietDay.water || 0) : 0) + ' 杯',
        has: Object.keys(d.diet.days || {}).length > 0 || (d.diet.commonFoods || []).length > 0
      },
      games: {
        main: (d.games.list || []).filter(function (x) { return x.status === 'playing'; }).length,
        mainLabel: '在玩',
        sub: '本周 ' + (App.sum((d.games.sessions || []).filter(function (x) { return App.inThisWeek(x.date, wk); }), function (x) { return x.minutes; }) / 60).toFixed(1) + ' 小时',
        has: (d.games.list || []).length + (d.games.sessions || []).length > 0
      }
    };
  }

  function cardHtml(key, name, info) {
    var sub = info.has ? info.sub : '去添加 →';
    return '<div class="card clickable" data-goto="' + key + '" data-testid="home-card-' + key + '">' +
      '<div class="stat-label">' + name + '</div>' +
      '<div class="stat-value"><span data-testid="home-main-' + key + '">' + App.esc(info.main) + '</span> ' +
      '<span style="font-size:11px;font-weight:400;color:var(--text-3)">' + App.esc(info.mainLabel) + '</span></div>' +
      '<div class="stat-sub" data-testid="home-sub-' + key + '">' + App.esc(sub) + '</div></div>';
  }

  function focusMemo() {
    var el = doc.getElementById('memo-input');
    if (el) el.focus();
  }

  App.register('home', {
    title: '首页总览',
    desc: '一眼看清今天',
    primaryAction: { label: '+ 新增备忘', onClick: focusMemo },
    render: function (box) {
      var s = App.store.get();
      var d = s.data;
      var today = App.todayStr();
      var list = (d.today || []).filter(function (x) { return x.date === today; })
        .sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); });
      var done = list.filter(function (x) { return x.done; }).length;
      var pct = list.length ? Math.round(done / list.length * 100) : 0;
      var memos = (d.memos || []).slice(-5).reverse();
      var info = summaries();
      var visibleCards = (s.settings.homeCards || []).slice();

      var todayRows = list.slice(0, 5).map(function (x) {
        return '<div class="row' + (x.done ? ' done' : '') + '" data-field="time,title,source">' +
          '<input type="checkbox" class="checkbox" data-today-check="' + x.id + '"' + (x.done ? ' checked' : '') + '>' +
          '<span class="row-sub" style="width:44px;flex:none">' + App.esc(x.time) + '</span>' +
          '<span class="row-main">' + App.esc(x.title) + '</span>' +
          '<span class="badge gray">' + App.esc(App.label('sources', x.source)) + '</span></div>';
      }).join('') || '<div class="hint">今天还没有安排</div>';

      var memoRows = memos.map(function (m) {
        return '<div class="row' + (m.done ? ' done' : '') + '">' +
          '<input type="checkbox" class="checkbox" data-memo-check="' + m.id + '"' + (m.done ? ' checked' : '') + '>' +
          '<span class="row-main">' + App.esc(m.text) + '</span>' +
          '<button type="button" class="btn btn-sm" data-memo-del="' + m.id + '">删除</button></div>';
      }).join('') || '<div class="hint">还没有备忘，随手记一句吧</div>';

      box.innerHTML =
        '<div class="card" data-testid="home-welcome">' +
        '<div style="display:flex;align-items:center;gap:18px">' +
        '<div style="flex:none"><div class="stat-label">今日完成</div>' +
        '<div class="stat-value"><span data-testid="home-done">' + done + '</span> / <span data-testid="home-total">' + list.length + '</span></div></div>' +
        '<div style="flex:1"><div class="progress"><i style="width:' + pct + '%"></i></div>' +
        '<div class="hint" style="margin-top:6px">' + App.fmtDate(today) + ' · 打开就看清今天</div></div></div></div>' +

        '<div class="grid-2" style="margin-top:12px">' +
        '<div class="card"><h3 class="card-title">今日计划 · 前 5 条</h3>' + todayRows +
        '<div class="hint clickable" style="margin-top:10px" data-testid="home-today-all" data-goto="today">查看全部 →</div></div>' +
        '<div class="card"><h3 class="card-title">快速备忘</h3>' +
        '<input class="input" id="memo-input" data-testid="memo-input" placeholder="随手记一句，回车即存…" autocomplete="off">' +
        '<div style="margin-top:10px">' + memoRows + '</div></div>' +
        '</div>' +

        '<h3 class="card-title" style="margin:18px 0 10px">模块摘要</h3>' +
        '<div class="grid-3">' + CARDS.filter(function (c) { return visibleCards.indexOf(c[0]) >= 0; })
          .map(function (c) { return cardHtml(c[0], c[1], info[c[0]]); }).join('') + '</div>';

      box.onclick = function (e) {
        var t = e.target;
        var goto = t.closest && t.closest('[data-goto]');
        if (goto) { App.shell.go(goto.getAttribute('data-goto')); return; }
        var del = t.closest && t.closest('[data-memo-del]');
        if (del) {
          var id = del.getAttribute('data-memo-del');
          var removed = App.find(App.store.get().data.memos, id);
          if (!removed) return;
          App.store.commit(function (st) {
            st.data.memos = st.data.memos.filter(function (x) { return x.id !== id; });
          });
          App.ui.undo('已删除备忘', function () {
            App.store.commit(function (st) { st.data.memos.push(removed); });
            App.shell.refresh();
          });
          App.shell.refresh();
        }
      };

      box.onchange = function (e) {
        var t = e.target;
        if (t.hasAttribute && t.hasAttribute('data-today-check')) {
          var id = t.getAttribute('data-today-check');
          var val = t.checked;
          App.store.commit(function (st) {
            var item = App.find(st.data.today, id);
            if (item) item.done = val;
          });
          App.shell.refresh();
        } else if (t.hasAttribute && t.hasAttribute('data-memo-check')) {
          var mid = t.getAttribute('data-memo-check');
          var mval = t.checked;
          App.store.commit(function (st) {
            var item = App.find(st.data.memos, mid);
            if (item) item.done = mval;
          });
          App.shell.refresh();
        }
      };

      box.onkeydown = function (e) {
        if (e.key !== 'Enter' || e.target.id !== 'memo-input') return;
        var text = e.target.value.trim();
        if (!text) return;
        e.preventDefault();
        App.store.commit(function (st) {
          st.data.memos.push({ id: App.uid(), text: text, done: false, createdAt: App.isoNow() });
        });
        App.shell.refresh();
        focusMemo();
      };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
