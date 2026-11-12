(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;

  var NAV = [
    { group: '总览与日程', items: [['home', '首页总览'], ['today', '今日计划']] },
    { group: '工作', items: [['media', '自媒体'], ['dev', '开发工作'], ['consult', '咨询工作']] },
    { group: '生活', items: [['fitness', '健身计划'], ['diet', '饮食计划'], ['games', '游戏娱乐']] },
    { group: '底部独立区', items: [['settings', '数据与设置']] }
  ];

  var current = 'home';

  function applyTheme() {
    var t = App.store.get().settings.theme;
    doc.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  }

  var saveTimer = null;
  function showSaved() {
    var el = doc.getElementById('save-indicator');
    if (!el) return;
    el.textContent = '已自动保存 ✓';
    el.classList.add('show');
    if (saveTimer) root.clearTimeout(saveTimer);
    saveTimer = root.setTimeout(function () { el.classList.remove('show'); }, 1800);
  }
  App.on('saved', showSaved);

  function updateStorageStatus() {
    var el = doc.getElementById('storage-status');
    if (!el) return;
    var s = App.store.get();
    var hasData = App.store.estimateSize() > 400;
    var last = s.settings.lastExportedAt;
    var stale = !last || (Date.now() - new Date(last).getTime() > 7 * 24 * 3600 * 1000);
    if (hasData && stale) {
      el.textContent = '建议立即备份数据';
      el.className = 'storage-status warn';
    } else {
      el.textContent = '数据已保存在本机';
      el.className = 'storage-status';
    }
  }

  function renderNav() {
    var nav = doc.getElementById('nav');
    if (!nav) return;
    nav.innerHTML = NAV.map(function (g, gi) {
      var sep = gi === NAV.length - 1 ? '<div class="nav-sep"></div>' : '';
      return '<div class="nav-group">' + sep + '<div class="nav-label">' + g.group + '</div>' +
        g.items.map(function (it) {
          return '<button type="button" class="nav-item' + (it[0] === current ? ' active' : '') +
            '" data-page="' + it[0] + '" data-testid="nav-' + it[0] + '">' + it[1] + '</button>';
        }).join('') + '</div>';
    }).join('');
    nav.onclick = function (e) {
      var b = e.target.closest && e.target.closest('[data-page]');
      if (b) go(b.getAttribute('data-page'));
    };
  }

  function go(page) {
    if (!App.pages[page]) return;
    current = page;
    App.state.page = page;
    var def = App.pages[page];
    doc.getElementById('page-title').textContent = def.title;
    doc.getElementById('page-desc').textContent = def.desc || '';
    var actions = doc.getElementById('page-actions');
    actions.innerHTML = '';
    if (def.primaryAction) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-primary';
      b.textContent = def.primaryAction.label;
      b.setAttribute('data-testid', 'primary-action');
      b.onclick = def.primaryAction.onClick;
      actions.appendChild(b);
    }
    renderNav();
    var content = doc.getElementById('content');
    content.innerHTML = '';
    content.scrollTop = 0;
    def.render(content);
    updateStorageStatus();
  }

  function refresh() { go(current); }
  function currentPage() { return current; }

  App.shell = {
    NAV: NAV, go: go, refresh: refresh, applyTheme: applyTheme,
    renderNav: renderNav, updateStorageStatus: updateStorageStatus,
    currentPage: currentPage
  };
})(typeof window !== 'undefined' ? window : globalThis);
