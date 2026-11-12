(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;
  var tab = 'list';
  var statusFilter = 'all';

  function data() { return App.store.get().data.games; }
  function weekMinutes() {
    var wk = App.store.get().settings.weekStartsOn;
    return App.sum((data().sessions || []).filter(function (s) {
      return App.inThisWeek(s.date, wk);
    }), function (s) { return s.minutes; });
  }
  function gameName(id) {
    var g = App.find(data().list || [], id);
    return g ? g.name : '已删除游戏';
  }
  function stars(score) {
    var n = Math.max(0, Math.min(5, Number(score) || 0));
    return n ? new Array(n + 1).join('★') + new Array(6 - n).join('☆') : '未评分';
  }

  function gameDrawer(existing) {
    App.ui.drawer({
      title: existing ? '编辑游戏' : '新增游戏',
      fields: [
        { key: 'name', label: '名称', required: true, value: existing ? existing.name : '' },
        { key: 'platform', label: '平台', value: existing ? existing.platform : '' },
        { key: 'status', label: '状态', type: 'select', options: App.enums.gameStatus, value: existing ? existing.status : 'want' },
        { key: 'score', label: '评分（1~5）', type: 'number', min: 0, value: existing ? existing.score : '' },
        { key: 'review', label: '一句短评', type: 'textarea', value: existing ? existing.review : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          var rec = {
            name: v.name, platform: v.platform, status: v.status,
            score: v.score === '' ? 0 : Math.max(0, Math.min(5, Number(v.score) || 0)),
            review: v.review
          };
          if (existing) {
            var g = App.find(st.data.games.list, existing.id);
            if (g) Object.keys(rec).forEach(function (k) { g[k] = rec[k]; });
          } else {
            rec.id = App.uid();
            st.data.games.list.push(rec);
          }
        });
        App.shell.refresh();
      }
    });
  }

  function sessionDrawer(existing) {
    var list = data().list || [];
    if (!list.length) { App.ui.toast('请先在游戏清单里添加一个游戏', 'error'); return; }
    App.ui.drawer({
      title: existing ? '编辑时长记录' : '记一次游戏时长',
      fields: [
        { key: 'date', label: '日期', type: 'date', required: true, value: existing ? existing.date : App.todayStr() },
        { key: 'gameId', label: '游戏', type: 'select', options: list.map(function (g) { return [g.id, g.name]; }), value: existing ? existing.gameId : list[0].id },
        { key: 'minutes', label: '时长（分钟）', type: 'number', min: 1, required: true, value: existing ? existing.minutes : 60 },
        { key: 'note', label: '备注', value: existing ? existing.note : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          var rec = { date: v.date, gameId: v.gameId, minutes: Number(v.minutes) || 0, note: v.note };
          if (existing) {
            var s = App.find(st.data.games.sessions, existing.id);
            if (s) Object.keys(rec).forEach(function (k) { s[k] = rec[k]; });
          } else {
            rec.id = App.uid();
            st.data.games.sessions.push(rec);
          }
        });
        App.shell.refresh();
      }
    });
  }

  App.register('games', {
    title: '游戏娱乐',
    desc: '想玩清单、时长与评价',
    primaryAction: { label: '+ 新增游戏', onClick: function () { gameDrawer(null); } },
    todayCandidates: function () {
      return (data().list || []).filter(function (g) { return g.status === 'playing'; })
        .map(function (g) { return { title: '继续玩《' + g.name + '》', time: '20:00' }; });
    },
    render: function (box) {
      var d = data();
      var tabs = [['list', '游戏清单'], ['sessions', '时长记录']];
      var mins = weekMinutes();

      var body = '';
      if (tab === 'list') {
        var games = (d.list || []).filter(function (g) { return statusFilter === 'all' || g.status === statusFilter; });
        body = '<div class="inline-form">' +
          '<button type="button" class="btn btn-sm" data-testid="games-add">+ 新增游戏</button>' +
          '<select class="select" style="max-width:150px" data-testid="games-filter">' +
          '<option value="all"' + (statusFilter === 'all' ? ' selected' : '') + '>全部状态</option>' +
          App.enums.gameStatus.map(function (o) {
            return '<option value="' + o[0] + '"' + (statusFilter === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select></div>' +
          (games.map(function (g) {
            return '<div class="row" data-field="name,platform,status,score,review">' +
              '<span class="row-main"><strong>' + App.esc(g.name) + '</strong>' +
              '<span class="row-sub">' + App.esc(g.platform || '未填平台') + ' · ' + App.esc(stars(g.score)) +
              (g.review ? ' · ' + App.esc(g.review) : '') + '</span></span>' +
              '<select class="select" style="width:110px" data-game-status="' + g.id + '">' + App.options('gameStatus', g.status) + '</select>' +
              '<button type="button" class="btn btn-sm" data-game-edit="' + g.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-game-del="' + g.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: statusFilter === 'all' ? '清单还是空的，先记一个想玩的游戏' : '这个状态下没有游戏', actionLabel: '新增游戏' }));
      } else {
        var sessions = (d.sessions || []).slice().sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        });
        body = '<div class="inline-form"><button type="button" class="btn btn-sm" data-testid="games-add-session">+ 记一次时长</button></div>' +
          (sessions.map(function (s) {
            return '<div class="row" data-field="gameId,date,minutes,note">' +
              '<span class="row-main"><strong>' + App.esc(gameName(s.gameId)) + '</strong>' +
              '<span class="row-sub">' + App.esc(s.date) + ' · ' + App.esc(s.minutes) + ' 分钟' +
              (s.note ? ' · ' + App.esc(s.note) : '') + '</span></span>' +
              '<button type="button" class="btn btn-sm" data-session-edit="' + s.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-session-del="' + s.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有时长记录', actionLabel: '记一次时长' }));
      }

      box.innerHTML =
        '<div class="grid-3" style="margin-bottom:12px">' +
        '<div class="stat"><div class="stat-label">本周游戏时长</div><div class="stat-value" data-testid="games-week-minutes">' + mins + ' <span style="font-size:12px">分钟</span></div></div>' +
        '<div class="stat"><div class="stat-label">在玩</div><div class="stat-value" data-testid="games-playing">' +
        (d.list || []).filter(function (g) { return g.status === 'playing'; }).length + ' <span style="font-size:12px">款</span></div></div>' +
        '<div class="stat"><div class="stat-label">清单总数</div><div class="stat-value" data-testid="games-total">' + (d.list || []).length + ' <span style="font-size:12px">款</span></div></div>' +
        '</div>' +
        '<div class="tabs">' + tabs.map(function (t) {
          return '<button type="button" class="tab' + (tab === t[0] ? ' active' : '') + '" data-games-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div>' + body;

      App.ui.bindEmpty(box, function () {
        if (tab === 'list') gameDrawer(null); else sessionDrawer(null);
      });

      box.onclick = function (e) {
        var t = e.target;
        var tabBtn = t.closest && t.closest('[data-games-tab]');
        if (tabBtn) { tab = tabBtn.getAttribute('data-games-tab'); App.shell.refresh(); return; }
        var hit = t.closest && t.closest('[data-testid]');
        var testid = hit ? hit.getAttribute('data-testid') : '';
        if (testid === 'games-add') { gameDrawer(null); return; }
        if (testid === 'games-add-session') { sessionDrawer(null); return; }
        var attrs = ['game-edit', 'game-del', 'session-edit', 'session-del'];
        for (var i = 0; i < attrs.length; i++) {
          var el = t.closest && t.closest('[data-' + attrs[i] + ']');
          if (!el) continue;
          var id = el.getAttribute('data-' + attrs[i]);
          var k = attrs[i];
          if (k === 'game-edit') gameDrawer(App.find(App.store.get().data.games.list, id));
          else if (k === 'session-edit') sessionDrawer(App.find(App.store.get().data.games.sessions, id));
          else {
            var group = k === 'game-del' ? 'list' : 'sessions';
            var removed = App.find(App.store.get().data.games[group], id);
            if (!removed) return;
            App.store.commit(function (st) {
              st.data.games[group] = st.data.games[group].filter(function (x) { return x.id !== id; });
            });
            App.ui.undo('已删除', function () {
              App.store.commit(function (st) { st.data.games[group].push(removed); });
              App.shell.refresh();
            });
            App.shell.refresh();
          }
          return;
        }
      };

      box.onchange = function (e) {
        var t = e.target;
        if (t.getAttribute && t.getAttribute('data-testid') === 'games-filter') {
          statusFilter = t.value;
          App.shell.refresh();
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-game-status')) {
          var id = t.getAttribute('data-game-status');
          var val = t.value;
          App.store.commit(function (st) {
            var g = App.find(st.data.games.list, id);
            if (g) g.status = val;
          });
          App.shell.refresh();
        }
      };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
