(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;
  var selected = null;
  var tab = 'tasks';

  function projectDrawer(existing) {
    App.ui.drawer({
      title: existing ? '编辑项目' : '新增项目',
      fields: [
        { key: 'name', label: '项目名称', required: true, value: existing ? existing.name : '' },
        { key: 'status', label: '状态', type: 'select', options: App.enums.projectStatus, value: existing ? existing.status : 'active' },
        { key: 'note', label: '简介', type: 'textarea', value: existing ? existing.note : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          if (existing) {
            var p = App.find(st.data.dev.projects, existing.id);
            if (p) { p.name = v.name; p.status = v.status; p.note = v.note; }
          } else {
            var np = { id: App.uid(), name: v.name, status: v.status, note: v.note };
            st.data.dev.projects.push(np);
            selected = np.id;
          }
        });
        App.shell.refresh();
      }
    });
  }

  function taskDrawer(existing) {
    var st = App.store.get();
    if (!st.data.dev.projects.length) { App.ui.toast('请先新增一个项目', 'error'); return; }
    App.ui.drawer({
      title: existing ? '编辑任务 / Bug' : '新增任务 / Bug',
      fields: [
        { key: 'title', label: '标题', required: true, value: existing ? existing.title : '' },
        { key: 'type', label: '类型', type: 'select', options: App.enums.taskType, value: existing ? existing.type : 'task' },
        { key: 'priority', label: '优先级', type: 'select', options: App.enums.priority, value: existing ? existing.priority : 'mid' },
        { key: 'status', label: '状态', type: 'select', options: App.enums.taskStatus, value: existing ? existing.status : 'todo' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (s) {
          var pid = selected || (s.data.dev.projects[0] && s.data.dev.projects[0].id);
          if (existing) {
            var t = App.find(s.data.dev.tasks, existing.id);
            if (t) { t.title = v.title; t.type = v.type; t.priority = v.priority; t.status = v.status; }
          } else {
            s.data.dev.tasks.push({ id: App.uid(), projectId: pid, title: v.title, type: v.type, priority: v.priority, status: v.status });
          }
        });
        App.shell.refresh();
      }
    });
  }

  function snippetDrawer(existing) {
    App.ui.drawer({
      title: existing ? '编辑速记' : '新增速记',
      fields: [
        { key: 'text', label: '内容', type: 'textarea', required: true, value: existing ? existing.text : '' },
        { key: 'tag', label: '语言 / 用途标签', value: existing ? existing.tag : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (s) {
          if (existing) {
            var sn = App.find(s.data.dev.snippets, existing.id);
            if (sn) { sn.text = v.text; sn.tag = v.tag; }
          } else {
            s.data.dev.snippets.push({ id: App.uid(), text: v.text, tag: v.tag });
          }
        });
        App.shell.refresh();
      }
    });
  }

  App.register('dev', {
    title: '开发工作',
    desc: '项目、任务与速记',
    primaryAction: { label: '+ 新增项目', onClick: function () { projectDrawer(null); } },
    todayCandidates: function () {
      return (App.store.get().data.dev.tasks || [])
        .filter(function (t) { return t.status !== 'done'; })
        .map(function (t) { return { title: t.title, time: '11:00' }; });
    },
    render: function (box) {
      var d = App.store.get().data.dev;
      if (!selected || !App.find(d.projects, selected)) {
        selected = d.projects.length ? d.projects[0].id : null;
      }
      var tasks = (d.tasks || []).filter(function (t) { return t.projectId === selected; });

      var left = '<div class="card"><h3 class="card-title">项目</h3>' +
        '<button type="button" class="btn btn-sm" data-testid="dev-add-project" style="margin-bottom:10px">+ 新增项目</button>' +
        ((d.projects || []).map(function (p) {
          var n = (d.tasks || []).filter(function (t) { return t.projectId === p.id && t.status !== 'done'; }).length;
          return '<div class="master-item' + (selected === p.id ? ' active' : '') + '" data-project="' + p.id + '">' +
            '<div style="display:flex;justify-content:space-between;gap:6px"><strong>' + App.esc(p.name) + '</strong>' +
            '<span class="badge ' + (p.status === 'active' ? 'ok' : 'gray') + '">' + App.esc(App.label('projectStatus', p.status)) + '</span></div>' +
            '<div class="hint">未完成 ' + n + ' 条</div>' +
            '<div style="margin-top:6px;display:flex;gap:6px">' +
            '<button type="button" class="btn btn-sm" data-project-edit="' + p.id + '">编辑</button>' +
            '<button type="button" class="btn btn-sm" data-project-del="' + p.id + '">删除</button></div></div>';
        }).join('') || App.ui.empty({ text: '还没有项目', actionLabel: '新增项目' })) + '</div>';

      var right = '';
      if (tab === 'tasks') {
        right = '<div class="card"><div class="inline-form"><h3 class="card-title" style="margin:0;flex:1">任务与 Bug</h3>' +
          '<button type="button" class="btn btn-sm" data-testid="dev-add-task">+ 新增</button></div>' +
          (selected ? (tasks.map(function (t) {
            return '<div class="row" data-field="title,type,priority,status">' +
              '<span class="row-main"><strong>' + App.esc(t.title) + '</strong>' +
              '<span class="row-sub">' + App.esc(App.label('taskType', t.type)) + ' · ' + App.esc(App.label('priority', t.priority)) + '</span></span>' +
              '<select class="select" style="width:110px" data-task-status="' + t.id + '">' + App.options('taskStatus', t.status) + '</select>' +
              '<button type="button" class="btn btn-sm" data-task-edit="' + t.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-task-del="' + t.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '该项目下还没有任务', actionLabel: '新增任务' }))
            : '<div class="hint">先在左侧新增并选择一个项目</div>') + '</div>';
      } else {
        right = '<div class="card"><div class="inline-form"><h3 class="card-title" style="margin:0;flex:1">代码与命令速记</h3>' +
          '<button type="button" class="btn btn-sm" data-testid="dev-add-snippet">+ 新增</button></div>' +
          ((d.snippets || []).slice().reverse().map(function (s) {
            return '<div class="row" data-field="text,tag"><span class="row-main"><strong>' + App.esc(s.text) + '</strong>' +
              '<span class="row-sub">' + App.esc(s.tag || '未分类') + '</span></span>' +
              '<button type="button" class="btn btn-sm" data-snippet-copy="' + s.id + '">复制</button>' +
              '<button type="button" class="btn btn-sm" data-snippet-edit="' + s.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-snippet-del="' + s.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有速记', actionLabel: '新增速记' })) + '</div>';
      }

      box.innerHTML = '<div class="tabs">' +
        '<button type="button" class="tab' + (tab === 'tasks' ? ' active' : '') + '" data-dev-tab="tasks">任务与 Bug</button>' +
        '<button type="button" class="tab' + (tab === 'snippets' ? ' active' : '') + '" data-dev-tab="snippets">速记本</button>' +
        '</div><div class="master"><div class="master-left">' + left + '</div><div class="master-right">' + right + '</div></div>';

      App.ui.bindEmpty(box, function () {
        if (tab === 'tasks') {
          if (d.projects.length) taskDrawer(null); else projectDrawer(null);
        } else snippetDrawer(null);
      });

      box.onclick = function (e) {
        var t = e.target;
        var tabBtn = t.closest && t.closest('[data-dev-tab]');
        if (tabBtn) { tab = tabBtn.getAttribute('data-dev-tab'); App.shell.refresh(); return; }
        var hit = t.closest && t.closest('[data-testid]');
        var testid = hit ? hit.getAttribute('data-testid') : '';
        if (testid === 'dev-add-project') { projectDrawer(null); return; }
        if (testid === 'dev-add-task') { taskDrawer(null); return; }
        if (testid === 'dev-add-snippet') { snippetDrawer(null); return; }
        var sel = t.closest && t.closest('[data-project]');
        if (sel && !t.closest('button')) { selected = sel.getAttribute('data-project'); App.shell.refresh(); return; }
        var keys = ['project-edit', 'project-del', 'task-edit', 'task-del', 'snippet-edit', 'snippet-del', 'snippet-copy'];
        for (var i = 0; i < keys.length; i++) {
          var el = t.closest && t.closest('[data-' + keys[i] + ']');
          if (!el) continue;
          var id = el.getAttribute('data-' + keys[i]);
          var k = keys[i];
          if (k === 'project-edit') projectDrawer(App.find(App.store.get().data.dev.projects, id));
          else if (k === 'task-edit') taskDrawer(App.find(App.store.get().data.dev.tasks, id));
          else if (k === 'snippet-edit') snippetDrawer(App.find(App.store.get().data.dev.snippets, id));
          else if (k === 'snippet-copy') {
            var sn = App.find(App.store.get().data.dev.snippets, id);
            if (sn) {
              var ta = doc.createElement('textarea');
              ta.value = sn.text; doc.body.appendChild(ta); ta.select();
              try { doc.execCommand('copy'); } catch (err) { /* ignore */ }
              doc.body.removeChild(ta);
              App.ui.toast('已复制到剪贴板');
            }
          } else if (k === 'project-del') {
            var proj = App.find(App.store.get().data.dev.projects, id);
            if (!proj) return;
            var n = (App.store.get().data.dev.tasks || []).filter(function (x) { return x.projectId === id; }).length;
            App.ui.confirm({
              title: '删除项目「' + proj.name + '」？',
              body: '该项目下 ' + n + ' 条任务也会删除，此操作不可撤销。',
              confirmLabel: '删除', danger: true,
              onConfirm: function () {
                App.store.commit(function (s) {
                  s.data.dev.projects = s.data.dev.projects.filter(function (x) { return x.id !== id; });
                  s.data.dev.tasks = s.data.dev.tasks.filter(function (x) { return x.projectId !== id; });
                });
                selected = null;
                App.shell.refresh();
              }
            });
          } else {
            var group = k === 'task-del' ? 'tasks' : 'snippets';
            var removed = App.find(App.store.get().data.dev[group], id);
            if (!removed) return;
            App.store.commit(function (s) {
              s.data.dev[group] = s.data.dev[group].filter(function (x) { return x.id !== id; });
            });
            App.ui.undo('已删除', function () {
              App.store.commit(function (s) { s.data.dev[group].push(removed); });
              App.shell.refresh();
            });
            App.shell.refresh();
          }
          return;
        }
      };

      box.onchange = function (e) {
        var t = e.target;
        if (t.hasAttribute && t.hasAttribute('data-task-status')) {
          var id = t.getAttribute('data-task-status');
          var val = t.value;
          App.store.commit(function (s) {
            var item = App.find(s.data.dev.tasks, id);
            if (item) item.status = val;
          });
          App.shell.refresh();
        }
      };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
