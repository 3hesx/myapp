(function (root) {
  'use strict';
  var App = root.App;
  var tab = 'clients';

  function clientOptions(current) {
    return (App.store.get().data.consult.clients || []).map(function (c) {
      return [c.id, c.name];
    }).concat(current ? [] : []);
  }

  function clientName(id) {
    var c = App.find(App.store.get().data.consult.clients, id);
    return c ? c.name : '已删除客户';
  }

  function clientDrawer(existing) {
    App.ui.drawer({
      title: existing ? '编辑客户' : '新增客户',
      fields: [
        { key: 'name', label: '名称', required: true, value: existing ? existing.name : '' },
        { key: 'contact', label: '联系方式', value: existing ? existing.contact : '' },
        { key: 'note', label: '备注', type: 'textarea', value: existing ? existing.note : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          if (existing) {
            var c = App.find(st.data.consult.clients, existing.id);
            if (c) { c.name = v.name; c.contact = v.contact; c.note = v.note; }
          } else {
            st.data.consult.clients.push({ id: App.uid(), name: v.name, contact: v.contact, note: v.note });
          }
        });
        App.shell.refresh();
      }
    });
  }

  function sessionDrawer(existing) {
    var clients = App.store.get().data.consult.clients;
    if (!clients.length) { App.ui.toast('请先新增一个客户', 'error'); return; }
    App.ui.drawer({
      title: existing ? '编辑咨询记录' : '记一次咨询',
      fields: [
        { key: 'clientId', label: '客户', type: 'select', options: clients.map(function (c) { return [c.id, c.name]; }), value: existing ? existing.clientId : clients[0].id },
        { key: 'date', label: '日期', type: 'date', required: true, value: existing ? existing.date : App.todayStr() },
        { key: 'topic', label: '主题', required: true, value: existing ? existing.topic : '' },
        { key: 'minutes', label: '时长（分钟）', type: 'number', min: 0, value: existing ? existing.minutes : 60 },
        { key: 'summary', label: '结论纪要', type: 'textarea', value: existing ? existing.summary : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          if (existing) {
            var s = App.find(st.data.consult.sessions, existing.id);
            if (s) { s.clientId = v.clientId; s.date = v.date; s.topic = v.topic; s.minutes = v.minutes; s.summary = v.summary; }
          } else {
            st.data.consult.sessions.push({
              id: App.uid(), clientId: v.clientId, date: v.date, topic: v.topic,
              minutes: v.minutes, summary: v.summary
            });
          }
        });
        App.shell.refresh();
      }
    });
  }

  function followupDrawer(existing) {
    var clients = App.store.get().data.consult.clients;
    if (!clients.length) { App.ui.toast('请先新增一个客户', 'error'); return; }
    App.ui.drawer({
      title: existing ? '编辑跟进' : '新增待跟进',
      fields: [
        { key: 'clientId', label: '客户', type: 'select', options: clients.map(function (c) { return [c.id, c.name]; }), value: existing ? existing.clientId : clients[0].id },
        { key: 'dueDate', label: '下次时间', type: 'date', required: true, value: existing ? existing.dueDate : App.todayStr() },
        { key: 'text', label: '事项', required: true, value: existing ? existing.text : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          if (existing) {
            var f = App.find(st.data.consult.followups, existing.id);
            if (f) { f.clientId = v.clientId; f.dueDate = v.dueDate; f.text = v.text; }
          } else {
            st.data.consult.followups.push({ id: App.uid(), clientId: v.clientId, dueDate: v.dueDate, text: v.text, done: false });
          }
        });
        App.shell.refresh();
      }
    });
  }

  App.register('consult', {
    title: '咨询工作',
    desc: '客户、纪要与跟进',
    primaryAction: { label: '+ 新增客户', onClick: function () { clientDrawer(null); } },
    todayCandidates: function () {
      return (App.store.get().data.consult.followups || [])
        .filter(function (f) { return !f.done; })
        .map(function (f) { return { title: f.text, time: '14:00' }; });
    },
    render: function (box) {
      var st = App.store.get();
      var d = st.data.consult;
      var month = App.monthKey(App.todayStr());
      var monthSessions = (d.sessions || []).filter(function (s) { return App.monthKey(s.date) === month; });
      var tabs = [['clients', '客户档案'], ['sessions', '咨询记录'], ['followups', '待跟进']];

      var body = '';
      if (tab === 'clients') {
        body = '<div class="inline-form"><button type="button" class="btn btn-sm" data-testid="consult-add-client">+ 新增客户</button></div>' +
          ((d.clients || []).map(function (c) {
            return '<div class="row" data-field="name,contact,note"><span class="row-main"><strong>' + App.esc(c.name) + '</strong>' +
              '<span class="row-sub">' + App.esc(c.contact || '未填联系方式') + ' · ' + App.esc(c.note || '无备注') + '</span></span>' +
              '<button type="button" class="btn btn-sm" data-client-edit="' + c.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-client-del="' + c.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有客户档案', actionLabel: '新增客户' }));
      } else if (tab === 'sessions') {
        body = '<div class="inline-form"><button type="button" class="btn btn-sm" data-testid="consult-add-session">+ 记一次咨询</button></div>' +
          ((d.sessions || []).slice().reverse().map(function (s) {
            return '<div class="row" data-field="clientId,date,topic,minutes,summary"><span class="row-main"><strong>' +
              App.esc(s.topic) + '</strong><span class="row-sub">' + App.esc(clientName(s.clientId)) + ' · ' +
              App.esc(s.date) + ' · ' + App.esc(s.minutes) + ' 分钟' +
              (s.summary ? ' · ' + App.esc(s.summary) : '') + '</span></span>' +
              '<button type="button" class="btn btn-sm" data-session-edit="' + s.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-session-del="' + s.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有咨询记录', actionLabel: '记一次咨询' }));
      } else {
        var sorted = (d.followups || []).slice().sort(function (a, b) {
          var ad = a.done ? 1 : 0, bd = b.done ? 1 : 0;
          if (ad !== bd) return ad - bd;
          return String(a.dueDate).localeCompare(String(b.dueDate));
        });
        body = '<div class="inline-form"><button type="button" class="btn btn-sm" data-testid="consult-add-followup">+ 新增待跟进</button></div>' +
          (sorted.map(function (f) {
            var overdue = !f.done && f.dueDate <= App.todayStr();
            return '<div class="row' + (f.done ? ' done' : '') + '" data-field="clientId,dueDate,text,done">' +
              '<input type="checkbox" class="checkbox" data-followup-check="' + f.id + '"' + (f.done ? ' checked' : '') + '>' +
              '<span class="row-main"><strong>' + App.esc(f.text) + '</strong><span class="row-sub">' +
              App.esc(clientName(f.clientId)) + ' · ' + App.esc(f.dueDate) + '</span></span>' +
              (overdue ? '<span class="badge warn">到期</span>' : '') +
              (f.done ? '' : '<button type="button" class="btn btn-sm" data-followup-join="' + f.id + '">加入今天</button>') +
              '<button type="button" class="btn btn-sm" data-followup-edit="' + f.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-followup-del="' + f.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有待跟进事项', actionLabel: '新增待跟进' }));
      }

      box.innerHTML =
        '<div class="grid-2" style="margin-bottom:12px">' +
        '<div class="stat"><div class="stat-label">本月咨询次数</div><div class="stat-value" data-testid="consult-month-count">' + monthSessions.length + '</div></div>' +
        '<div class="stat"><div class="stat-label">本月累计时长</div><div class="stat-value" data-testid="consult-month-minutes">' +
        App.sum(monthSessions, function (s) { return s.minutes; }) + ' <span style="font-size:12px">分钟</span></div></div></div>' +
        '<div class="tabs">' + tabs.map(function (t) {
          return '<button type="button" class="tab' + (tab === t[0] ? ' active' : '') + '" data-consult-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div>' + body;

      App.ui.bindEmpty(box, function () {
        if (tab === 'clients') clientDrawer(null);
        else if (tab === 'sessions') sessionDrawer(null);
        else followupDrawer(null);
      });

      box.onclick = function (e) {
        var t = e.target;
        var tabBtn = t.closest && t.closest('[data-consult-tab]');
        if (tabBtn) { tab = tabBtn.getAttribute('data-consult-tab'); App.shell.refresh(); return; }
        var hit = t.closest && t.closest('[data-testid]');
        var testid = hit ? hit.getAttribute('data-testid') : '';
        if (testid === 'consult-add-client') { clientDrawer(null); return; }
        if (testid === 'consult-add-session') { sessionDrawer(null); return; }
        if (testid === 'consult-add-followup') { followupDrawer(null); return; }
        var keys = ['client-edit', 'client-del', 'session-edit', 'session-del', 'followup-edit', 'followup-del', 'followup-join'];
        for (var i = 0; i < keys.length; i++) {
          var el = t.closest && t.closest('[data-' + keys[i] + ']');
          if (!el) continue;
          var id = el.getAttribute('data-' + keys[i]);
          var k = keys[i];
          if (k === 'client-edit') clientDrawer(App.find(App.store.get().data.consult.clients, id));
          else if (k === 'session-edit') sessionDrawer(App.find(App.store.get().data.consult.sessions, id));
          else if (k === 'followup-edit') followupDrawer(App.find(App.store.get().data.consult.followups, id));
          else if (k === 'followup-join') {
            var f = App.find(App.store.get().data.consult.followups, id);
            if (f) {
              App.store.commit(function (s) {
                s.data.today.push({ id: App.uid(), date: App.todayStr(), time: '14:00', title: f.text, source: 'consult', done: false });
              });
              App.ui.toast('已加入今天');
            }
          } else {
            var group = k === 'client-del' ? 'clients' : k === 'session-del' ? 'sessions' : 'followups';
            var removed = App.find(App.store.get().data.consult[group], id);
            if (!removed) return;
            App.store.commit(function (s) {
              s.data.consult[group] = s.data.consult[group].filter(function (x) { return x.id !== id; });
            });
            App.ui.undo('已删除', function () {
              App.store.commit(function (s) { s.data.consult[group].push(removed); });
              App.shell.refresh();
            });
            App.shell.refresh();
          }
          return;
        }
      };

      box.onchange = function (e) {
        var t = e.target;
        if (t.hasAttribute && t.hasAttribute('data-followup-check')) {
          var id = t.getAttribute('data-followup-check');
          var val = t.checked;
          App.store.commit(function (s) {
            var item = App.find(s.data.consult.followups, id);
            if (item) item.done = val;
          });
          App.shell.refresh();
        }
      };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
