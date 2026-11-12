(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;
  App.state = { page: 'home' };

  function bindGlobal() {
    var themeBtn = doc.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.onclick = function () {
        App.store.commit(function (st) {
          st.settings.theme = st.settings.theme === 'dark' ? 'light' : 'dark';
        });
        App.shell.applyTheme();
      };
    }
    var backupBtn = doc.getElementById('quick-backup');
    if (backupBtn) {
      backupBtn.onclick = function () {
        App.store.exportJson();
        if (App.ui && App.ui.toast) App.ui.toast('已导出备份文件');
        App.shell.updateStorageStatus();
      };
    }
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && App.ui && App.ui.closeDrawer) App.ui.closeDrawer();
    });
  }

  function boot() {
    App.store.load();
    App.shell.applyTheme();
    bindGlobal();
    App.shell.go('home');
    doc.documentElement.setAttribute('data-app-ready', '1');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
