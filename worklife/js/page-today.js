(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;
  var viewDate = App.todayStr();
  var filterSource = 'all';

  function isPast() { return viewDate < App.todayStr(); }

  function candidates() {
    var out = [];
    Object.keys(App.pages).forEach(function (key) {
      var def = App.pages[key];
      if (!def || !def.todayCandidates) return;
      def.todayCandidates().forEach(function (c) {
        out.push({
          source: key,
          title: c.title,
          time: c.time || '09:00',
          label: App.label('sources', key)
        });
      });
    });
    return out;
  }

  function joinDrawer() {
    var items = candidates();
    var groups = [];
    items.forEach(function (it, i) {
      var g = null;
      for (var j = 0; j < groups.length; j++) { if (groups[j].label === it.label) { g = groups[j]; break; } }
      if (!g) { g = { label: it.label, rows: [] }; groups.push(g); }
      g.rows.push({ it: it, index: i });
    });
    var extra = items.length
      ? '<div class="hint" style="margin-bottom:10px">勾选后生成今日事项（快照，不与原条目同步）</div>' +
        groups.map(function (g) {
          return '<div class="hint" style="margin:10px 0 4px">' + App.esc(g.label) + '</div>' +
            g.rows.map(function (r) {
              return '<label class="row" style="cursor:pointer">' +
                '<input type="checkbox" class="checkbox" data-join="' + r.index + '">' +
                '<span class="row-main">' + App.esc(r.it.title) + '</span>' +
                '<span class="badge gray">' + App.esc(r.it.label) + '</span></label>';
            }).join('');
        }).join('')
      : App.ui.empty({ text: '其他模块还没有可加入的条目' });

    App.ui.drawer({
      title: '从其他模块加入今天',
      fields: [],
      extraHtml: extra,
      onSubmit: function () {
        var chosen = [];
        var checks = doc.querySelectorAll('#drawer-form [data-join]');
        for (var i = 0; i < checks.length; i++) {
          if (checks[i].checked) chosen.push(items[Number(checks[i].getAttribute('data-join'))]);
        }
        if (!chosen.length) { App.ui.toast('请至少选择一条', 'error'); return false; }
        App.store.commit(function (st) {
          chosen.forEach(function (it) {
            st.data.today.push({
              id: App.uid(), date: viewDate, time: it.time,
              title: it.title, source: it.source, done: false
            });
          });
        });
        App.shell.refresh();
      }
    });
  }

  function addItem() {
    var timeEl = doc.getElementById('today-time');
    var titleEl = doc.getElementById('today-title');
    var sourceEl = doc.getElementById('today-source');
    if (!timeEl || !titleEl || !sourceEl || isPast()) return;
    var title = titleEl.value.trim();
    if (!title) { App.ui.toast('请填写事项标题', 'error'); titleEl.focus(); return; }
    var time = timeEl.value || '09:00';
    var source = sourceEl.value;
    App.store.commit(function (st) {
      st.data.today.push({ id: App.uid(), date: viewDate, time: time, title: title, source: source, done: false });
    });
    App.shell.refresh();
  }

  function focusTitle() {
    var el = doc.getElementById('today-title');
    if (el) el.focus();
  }

  App.register('today', {
    title: '今日计划',
    desc: '按时间安排今天',
    primaryAction: { label: '+ 新增事项', onClick: focusTitle },
    render: function (box) {
      var st = App.store.get();
      var past = isPast();
      var list = (st.data.today || []).filter(function (x) { return x.date === viewDate; })
        .filter(function (x) { return filterSource === 'all' || x.source === filterSource; })
        .sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); });
      var all = (st.data.today || []).filter(function (x) { return x.date === viewDate; });
      var done = all.filter(function (x) { return x.done; }).length;

      var rows = list.map(function (x) {
        return '<div class="row' + (x.done ? ' done' : '') + '" data-today-row="' + x.id + '" data-field="time,title,source,done">' +
          '<input type="checkbox" class="checkbox" data-today-check="' + x.id + '"' + (x.done ? ' checked' : '') + (past ? ' disabled' : '') + '>' +
          '<span class="row-sub" style="width:48px;flex:none">' + App.esc(x.time) + '</span>' +
          '<span class="row-main">' + App.esc(x.title) + '</span>' +
          '<span class="badge gray">' + App.esc(App.label('sources', x.source)) + '</span>' +
          (past ? '' : '<button type="button" class="btn btn-sm" data-today-del="' + x.id + '">删除</button>') +
          '</div>';
      }).join('') || App.ui.empty({ text: past ? '这一天没有记录' : '今天还没有安排，先加一条', actionLabel: past ? '' : '新增事项' });

      box.innerHTML =
        '<div class="card"><div class="inline-form" style="margin-bottom:0">' +
        '<button type="button" class="btn btn-sm" data-testid="today-prev">← 前一天</button>' +
        '<strong data-testid="today-date" style="min-width:150px;text-align:center">' + App.esc(App.fmtDate(viewDate)) + '</strong>' +
        '<button type="button" class="btn btn-sm" data-testid="today-next">后一天 →</button>' +
        '<button type="button" class="btn btn-sm" data-testid="today-today">回到今天</button>' +
        '<button type="button" class="btn btn-sm" data-testid="today-join">从其他模块加入今天</button>' +
        '<select class="select" style="max-width:150px" data-testid="today-filter">' +
        '<option value="all"' + (filterSource === 'all' ? ' selected' : '') + '>全部来源</option>' +
        App.enums.sources.map(function (o) {
          return '<option value="' + o[0] + '"' + (filterSource === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select>' +
        '</div></div>' +

        (past ? '<div class="card" data-testid="today-readonly"><span class="badge warn">历史只读</span> ' +
          '<span class="hint">过去的日期只能查看，不能新增、勾选或删除。</span></div>' : '') +

        '<div class="card" style="margin-top:12px"><div class="inline-form"' + (past ? ' data-disabled="1"' : '') + '>' +
        '<input type="time" class="input" style="max-width:120px" id="today-time" data-testid="today-time" value="09:00"' + (past ? ' disabled' : '') + '>' +
        '<input class="input" id="today-title" data-testid="today-title" placeholder="要做什么，回车即加" autocomplete="off"' + (past ? ' disabled' : '') + '>' +
        '<select class="select" style="max-width:140px" id="today-source" data-testid="today-source"' + (past ? ' disabled' : '') + '>' +
        App.options('sources', 'manual') + '</select>' +
        '<button type="button" class="btn btn-primary" data-testid="today-add"' + (past ? ' disabled' : '') + '>加入</button>' +
        '</div></div>' +

        '<div class="section" style="margin-top:12px">' + rows + '</div>' +
        '<div class="hint" data-testid="today-summary">完成 ' + done + ' / 共 ' + all.length + ' 条</div>';

      App.ui.bindEmpty(box, focusTitle);

      box.onclick = function (e) {
        var t = e.target;
        var hit = t.closest && t.closest('[data-testid]');
        var id = hit ? hit.getAttribute('data-testid') : '';
        if (id === 'today-prev') { viewDate = App.shiftDate(viewDate, -1); App.shell.refresh(); }
        else if (id === 'today-next') { viewDate = App.shiftDate(viewDate, 1); App.shell.refresh(); }
        else if (id === 'today-today') { viewDate = App.todayStr(); App.shell.refresh(); }
        else if (id === 'today-join') { joinDrawer(); }
        else if (id === 'today-add') { addItem(); }
        else if (t.hasAttribute && t.hasAttribute('data-today-del')) {
          if (past) return;
          var tid = t.getAttribute('data-today-del');
          var removed = App.find(App.store.get().data.today, tid);
          if (!removed) return;
          App.store.commit(function (s) {
            s.data.today = s.data.today.filter(function (x) { return x.id !== tid; });
          });
          App.ui.undo('已删除事项', function () {
            App.store.commit(function (x) { x.data.today.push(removed); });
            App.shell.refresh();
          });
          App.shell.refresh();
        }
      };

      box.onchange = function (e) {
        var t = e.target;
        if (t.hasAttribute && t.hasAttribute('data-today-check')) {
          if (past) return;
          var tid = t.getAttribute('data-today-check');
          var val = t.checked;
          App.store.commit(function (s) {
            var item = App.find(s.data.today, tid);
            if (item) item.done = val;
          });
          App.shell.refresh();
        } else if (t.getAttribute && t.getAttribute('data-testid') === 'today-filter') {
          filterSource = t.value;
          App.shell.refresh();
        }
      };

      box.onkeydown = function (e) {
        if (e.key === 'Enter' && e.target.id === 'today-title') { e.preventDefault(); addItem(); }
      };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
