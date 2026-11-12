(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;

  var MODULES = [
    ['memos', '快速备忘'], ['today', '今日计划'], ['media', '自媒体'],
    ['dev', '开发工作'], ['consult', '咨询工作'], ['fitness', '健身计划'],
    ['diet', '饮食计划'], ['games', '游戏娱乐']
  ];

  function earliest() {
    var s = App.store.get().data;
    var dates = [];
    (s.today || []).forEach(function (x) { if (x.date) dates.push(x.date); });
    ['media', 'consult', 'fitness', 'games'].forEach(function (k) {
      var group = s[k] || {};
      Object.keys(group).forEach(function (j) {
        if (Array.isArray(group[j])) group[j].forEach(function (x) { if (x && x.date) dates.push(x.date); });
      });
    });
    Object.keys(s.diet && s.diet.days || {}).forEach(function (d) { dates.push(d); });
    if (!dates.length) return '暂无记录';
    dates.sort();
    return dates[0];
  }

  function doExport() {
    App.store.exportJson();
    App.ui.toast('已导出备份文件');
    App.shell.updateStorageStatus();
  }

  function previewHtml(payload) {
    var c = App.store.countsOf(payload);
    var rows = MODULES.map(function (m) {
      return '<div class="kv"><span>' + m[1] + '</span><strong>' + (c[m[0]] || 0) + ' 条</strong></div>';
    }).join('');
    return '<div class="card" data-testid="import-preview" style="margin-top:12px">' +
      '<div class="hint" style="margin-bottom:8px">备份导出时间：' + App.esc(payload.exportedAt || '未知') + '</div>' + rows + '</div>';
  }

  function handleFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var payload;
      try { payload = JSON.parse(reader.result); }
      catch (e) { App.ui.toast('文件不是有效的 JSON', 'error'); return; }
      var err = App.store.validate(payload);
      if (err) { App.ui.toast(err, 'error'); return; }
      App.ui.confirm({
        title: '确认导入并覆盖？',
        body: '导入会覆盖当前全部数据，此操作不可撤销。请先确认下面的备份内容。',
        previewHtml: previewHtml(payload),
        confirmLabel: '覆盖导入',
        danger: true,
        onConfirm: function () {
          var res = App.store.importJson(payload);
          if (!res.ok) { App.ui.toast(res.error, 'error'); return; }
          App.shell.applyTheme();
          App.shell.go('home');
          App.ui.toast('已恢复备份数据');
        }
      });
    };
    reader.readAsText(file);
  }

  App.register('settings', {
    title: '数据与设置',
    desc: '备份、恢复与偏好',
    primaryAction: { label: '导出备份', onClick: doExport },
    render: function (box) {
      var st = App.store.get();
      var c = App.store.counts();
      var cards = st.settings.homeCards || [];

      box.innerHTML =
        '<div class="card"><h3 class="card-title">数据概览</h3><div data-testid="overview">' +
        '<div class="grid-4">' + MODULES.map(function (m) {
          return '<div class="stat"><div class="stat-label">' + m[1] + '</div><div class="stat-value">' + (c[m[0]] || 0) + '</div></div>';
        }).join('') + '</div>' +
        '<div class="kv" style="margin-top:12px"><span>最早记录</span><span>' + App.esc(earliest()) + '</span></div>' +
        '<div class="kv"><span>当前占用（估算）</span><span>' + (App.store.estimateSize() / 1024).toFixed(1) + ' KB</span></div>' +
        '</div></div>' +

        '<div class="card"><h3 class="card-title">备份与恢复</h3>' +
        '<p class="hint">导出会下载一个 JSON 文件到本机；换电脑或误清缓存后，用它恢复。</p>' +
        '<div class="inline-form">' +
        '<button type="button" class="btn btn-primary" data-testid="export-btn">导出 JSON 备份</button>' +
        '<input type="file" class="input" style="max-width:260px" accept=".json,application/json" data-testid="import-input" id="import-file">' +
        '<button type="button" class="btn" data-testid="import-btn">从文件导入</button>' +
        '</div><div class="hint" id="import-status">选择备份文件后，会先显示条目数预览并要求确认覆盖。</div></div>' +

        '<div class="card"><h3 class="card-title">清理</h3>' +
        '<div class="inline-form">' +
        '<select class="select" style="max-width:200px" data-testid="clear-module-select">' +
        MODULES.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('') +
        '</select>' +
        '<button type="button" class="btn" data-testid="clear-module-btn">清空该模块</button>' +
        '<button type="button" class="btn btn-danger" data-testid="reset-btn">全部重置</button>' +
        '</div></div>' +

        '<div class="card"><h3 class="card-title">偏好</h3>' +
        '<div class="kv"><span>界面主题</span><span class="seg">' +
        '<button type="button" data-testid="theme-dark" class="' + (st.settings.theme === 'dark' ? 'active' : '') + '">深色</button>' +
        '<button type="button" data-testid="theme-light" class="' + (st.settings.theme === 'light' ? 'active' : '') + '">浅色</button>' +
        '</span></div>' +
        '<div class="kv"><span>每周起始日</span><select class="select" style="max-width:140px" data-testid="week-start">' +
        '<option value="1"' + (st.settings.weekStartsOn === 1 ? ' selected' : '') + '>周一</option>' +
        '<option value="0"' + (st.settings.weekStartsOn === 0 ? ' selected' : '') + '>周日</option></select></div>' +
        '<div style="margin-top:12px"><div class="hint" style="margin-bottom:6px">首页显示的摘要卡片</div>' +
        [['media', '自媒体'], ['dev', '开发工作'], ['consult', '咨询工作'], ['fitness', '健身计划'], ['diet', '饮食计划'], ['games', '游戏娱乐']]
          .map(function (m) {
            return '<label style="margin-right:16px;font-size:13px"><input type="checkbox" class="checkbox" data-home-card="' + m[0] + '"' +
              (cards.indexOf(m[0]) >= 0 ? ' checked' : '') + '> ' + m[1] + '</label>';
          }).join('') + '</div></div>' +

        '<div class="card"><h3 class="card-title">存储说明</h3>' +
        '<p class="muted" data-testid="storage-note">数据只保存在这台电脑的这个浏览器里，不会上传到任何地方，也不需要联网。' +
        '清理浏览器缓存或数据、换浏览器、换电脑，或者移动这个文件夹，都可能导致数据读不到。' +
        '清缓存会丢数据，所以请定期点「导出 JSON 备份」把文件留在本机；需要恢复时用「从文件导入」。</p></div>';

      box.onclick = function (e) {
        var t = e.target;
        var hit = t.closest && t.closest('[data-testid]');
        var id = hit ? hit.getAttribute('data-testid') : '';
        if (id === 'export-btn') { doExport(); }
        else if (id === 'import-btn') {
          var input = box.querySelector('#import-file');
          if (!input || !input.files || !input.files.length) { App.ui.toast('请先选择备份文件', 'error'); return; }
          handleFile(input.files[0]);
        }
        else if (id === 'theme-dark' || id === 'theme-light') {
          var theme = id === 'theme-dark' ? 'dark' : 'light';
          App.store.commit(function (s) { s.settings.theme = theme; });
          App.shell.applyTheme();
          App.shell.refresh();
        }
        else if (id === 'clear-module-btn') {
          var sel = box.querySelector('[data-testid="clear-module-select"]');
          var key = sel.value;
          var label = sel.options[sel.selectedIndex].text;
          App.ui.confirm({
            title: '清空「' + label + '」？',
            body: '该模块的全部数据将被删除，其他模块与设置不受影响。此操作不可撤销。',
            confirmLabel: '清空', danger: true,
            onConfirm: function () {
              App.store.clearModule(key);
              App.shell.refresh();
              App.ui.toast('已清空「' + label + '」');
            }
          });
        }
        else if (id === 'reset-btn') {
          App.ui.confirm({
            title: '全部重置？',
            body: '所有模块的数据与偏好都会恢复到初始状态，此操作不可撤销。',
            requireText: '重置', confirmLabel: '确认重置', danger: true,
            onConfirm: function () {
              App.store.reset();
              App.shell.applyTheme();
              App.shell.go('home');
              App.ui.toast('已全部重置');
            }
          });
        }
      };

      var fileInput = box.querySelector('#import-file');
      if (fileInput) fileInput.onchange = function () { handleFile(fileInput.files && fileInput.files[0]); };
      var weekStart = box.querySelector('[data-testid="week-start"]');
      if (weekStart) weekStart.onchange = function () {
        App.store.commit(function (s) { s.settings.weekStartsOn = Number(weekStart.value); });
      };
      var checks = box.querySelectorAll('[data-home-card]');
      for (var i = 0; i < checks.length; i++) {
        checks[i].onchange = (function (cb) {
          return function () {
            var key = cb.getAttribute('data-home-card');
            App.store.commit(function (s) {
              var list = s.settings.homeCards || [];
              var idx = list.indexOf(key);
              if (cb.checked && idx < 0) list.push(key);
              if (!cb.checked && idx >= 0) list.splice(idx, 1);
              s.settings.homeCards = list;
            });
          };
        })(checks[i]);
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
