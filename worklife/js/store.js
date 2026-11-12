(function (root) {
  'use strict';
  var App = root.App;
  var KEY = 'worklife:v1';
  var APP_ID = 'worklife-local';
  var SCHEMA = 1;
  var state = null;

  function defaults() {
    return {
      schemaVersion: SCHEMA,
      settings: {
        theme: 'dark',
        homeCards: ['media', 'dev', 'consult', 'fitness', 'diet', 'games'],
        weekStartsOn: 1,
        lastExportedAt: null
      },
      data: {
        memos: [],
        today: [],
        media: { topics: [], posts: [], metrics: [], ideas: [] },
        dev: { projects: [], tasks: [], snippets: [] },
        consult: { clients: [], sessions: [], followups: [] },
        fitness: { weekPlan: { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '' }, exercises: [], workouts: [], body: [] },
        diet: { days: {}, commonFoods: [] },
        games: { list: [], sessions: [] }
      }
    };
  }

  function merge(base, incoming) {
    var out = base;
    if (incoming.settings) {
      Object.keys(base.settings).forEach(function (k) {
        if (incoming.settings[k] !== undefined) out.settings[k] = incoming.settings[k];
      });
    }
    if (incoming.data) {
      Object.keys(base.data).forEach(function (k) {
        var inc = incoming.data[k];
        if (inc === undefined) return;
        if (Array.isArray(base.data[k])) { if (Array.isArray(inc)) out.data[k] = inc; }
        else if (base.data[k] && typeof base.data[k] === 'object') {
          Object.keys(base.data[k]).forEach(function (j) {
            if (inc[j] !== undefined) out.data[k][j] = inc[j];
          });
        }
      });
    }
    return out;
  }

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.schemaVersion === SCHEMA && parsed.data) {
          state = merge(defaults(), parsed);
          return state;
        }
      }
    } catch (e) { /* 读取失败时回落到默认数据 */ }
    state = defaults();
    return state;
  }

  function get() { return state || load(); }

  function notify(kind, text) {
    if (App.ui && App.ui.toast) App.ui.toast(text, kind === 'fail' ? 'error' : 'warn');
    else if (root.console && root.console.error) root.console.error(text);
  }

  function save() {
    try {
      var str = JSON.stringify(state);
      if (str.length > 4 * 1024 * 1024) notify('warn', '数据接近浏览器存储上限，请立即导出备份');
      root.localStorage.setItem(KEY, str);
      App.emit('change');
      return true;
    } catch (e) {
      notify('fail', '保存失败：浏览器存储不可用，请立即导出备份');
      return false;
    }
  }

  function commit(fn, silent) {
    if (!state) load();
    fn(state);
    var ok = save();
    if (ok && !silent && App.ui && App.ui.toast) App.ui.toast('已保存');
    return ok;
  }

  function estimateSize() {
    try { return JSON.stringify(state).length; } catch (e) { return 0; }
  }

  function exportJson() {
    var s = get();
    var payload = {
      app: APP_ID,
      schemaVersion: SCHEMA,
      exportedAt: App.isoNow(),
      settings: JSON.parse(JSON.stringify(s.settings)),
      data: JSON.parse(JSON.stringify(s.data))
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = root.document.createElement('a');
    a.href = url;
    a.download = 'worklife-backup-' + App.todayStr() + '.json';
    root.document.body.appendChild(a);
    a.click();
    root.document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    commit(function (st) { st.settings.lastExportedAt = App.isoNow(); });
    return payload;
  }

  function validate(payload) {
    if (!payload || payload.app !== APP_ID) return '不是本应用导出的备份文件';
    if (payload.schemaVersion !== SCHEMA) return '备份文件版本不兼容（版本 ' + payload.schemaVersion + '）';
    if (!payload.data || !payload.settings) return '备份文件内容不完整';
    return null;
  }

  function countsOf(payload) {
    var d = payload.data;
    return {
      memos: (d.memos || []).length,
      today: (d.today || []).length,
      media: (d.media && d.media.topics || []).length,
      dev: (d.dev && d.dev.projects || []).length,
      consult: (d.consult && d.consult.clients || []).length,
      fitness: (d.fitness && d.fitness.workouts || []).length,
      diet: Object.keys(d.diet && d.diet.days || {}).length,
      games: (d.games && d.games.list || []).length
    };
  }

  function importJson(payload) {
    var err = validate(payload);
    if (err) return { ok: false, error: err };
    state = merge(defaults(), payload);
    save();
    return { ok: true };
  }

  var MODULE_KEYS = {
    memos: 'memos', today: 'today', media: 'media', dev: 'dev',
    consult: 'consult', fitness: 'fitness', diet: 'diet', games: 'games'
  };

  function clearModule(key) {
    if (!MODULE_KEYS[key]) return false;
    commit(function (st) { st.data[key] = JSON.parse(JSON.stringify(defaults().data[key])); });
    return true;
  }

  function reset() {
    state = defaults();
    save();
  }

  function counts() { return countsOf({ data: get().data }); }

  App.store = {
    KEY: KEY, APP_ID: APP_ID, SCHEMA: SCHEMA,
    defaults: defaults, load: load, get: get, save: save, commit: commit,
    estimateSize: estimateSize, exportJson: exportJson, validate: validate,
    countsOf: countsOf, importJson: importJson, clearModule: clearModule,
    reset: reset, counts: counts
  };
})(typeof window !== 'undefined' ? window : globalThis);
