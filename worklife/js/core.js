(function (root) {
  'use strict';
  var App = root.App || (root.App = {});

  App.version = '1.0.0';
  App.pages = {};
  App.register = function (name, def) { App.pages[name] = def; };

  var listeners = {};
  App.on = function (evt, fn) { (listeners[evt] || (listeners[evt] = [])).push(fn); };
  App.emit = function (evt, payload) {
    (listeners[evt] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { root.console && root.console.error('[App.on] ' + evt, e); }
    });
  };

  App.enums = {
    topicStatus: [['idea', '想法'], ['writing', '撰写中'], ['ready', '待发'], ['published', '已发']],
    projectStatus: [['active', '进行中'], ['archived', '已归档']],
    taskType: [['task', '任务'], ['bug', 'Bug']],
    priority: [['high', '高'], ['mid', '中'], ['low', '低']],
    taskStatus: [['todo', '待办'], ['doing', '进行中'], ['done', '完成']],
    gameStatus: [['want', '想玩'], ['playing', '在玩'], ['done', '通关'], ['dropped', '弃坑']],
    sources: [['media', '自媒体'], ['dev', '开发工作'], ['consult', '咨询工作'], ['fitness', '健身计划'], ['diet', '饮食计划'], ['games', '游戏娱乐'], ['manual', '手动']],
    meals: [['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['snack', '加餐']]
  };

  App.label = function (group, value) {
    var list = App.enums[group] || [];
    for (var i = 0; i < list.length; i++) { if (list[i][0] === value) return list[i][1]; }
    return value || '';
  };
  App.options = function (group, current) {
    return (App.enums[group] || []).map(function (it) {
      return '<option value="' + it[0] + '"' + (it[0] === current ? ' selected' : '') + '>' + it[1] + '</option>';
    }).join('');
  };

  App.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  App.pad2 = pad2;
  App.todayStr = function (d) {
    var x = d || new Date();
    return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
  };
  App.shiftDate = function (str, delta) {
    var p = String(str).split('-').map(Number);
    return App.todayStr(new Date(p[0], p[1] - 1, p[2] + delta));
  };
  App.weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  App.weekday = function (str) {
    var p = String(str).split('-').map(Number);
    return App.weekNames[new Date(p[0], p[1] - 1, p[2]).getDay()];
  };
  App.fmtDate = function (str) {
    var p = String(str).split('-').map(Number);
    return p[1] + '月' + p[2] + '日 ' + App.weekday(str);
  };
  App.nowTime = function () {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  };
  App.isoNow = function () { return new Date().toISOString(); };
  App.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  App.find = function (arr, id) {
    for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) return arr[i]; }
    return null;
  };
  App.remove = function (arr, id) {
    var i = arr.findIndex(function (x) { return x.id === id; });
    if (i >= 0) return arr.splice(i, 1)[0];
    return null;
  };
  App.sum = function (arr, fn) {
    return arr.reduce(function (a, b) { return a + (Number(fn(b)) || 0); }, 0);
  };
  App.monthKey = function (dateStr) { return String(dateStr).slice(0, 7); };
  App.parseDate = function (str) {
    var p = String(str).split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  };
  App.addMonths = function (y, m, delta) {
    var t = new Date(y, m - 1 + delta, 1);
    return { y: t.getFullYear(), m: t.getMonth() + 1 };
  };
  App.monthGrid = function (year, month, startsOn) {
    startsOn = (startsOn === 0 || startsOn === 1) ? startsOn : 1;
    var first = new Date(year, month - 1, 1);
    var offset = (first.getDay() - (startsOn === 0 ? 0 : 1) + 7) % 7;
    var cur = new Date(year, month - 1, 1 - offset);
    var weeks = [];
    for (var w = 0; w < 6; w++) {
      var week = [];
      for (var d = 0; d < 7; d++) {
        week.push(App.todayStr(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate())));
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  };
  App.weekStart = function (dateStr, startsOn) {
    var p = String(dateStr).split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    var diff = (d.getDay() - (startsOn === 0 ? 0 : 1) + 7) % 7;
    return App.todayStr(new Date(p[0], p[1] - 1, p[2] - diff));
  };
  App.inThisWeek = function (dateStr, startsOn) {
    return String(dateStr) >= App.weekStart(App.todayStr(), startsOn) && String(dateStr) <= App.todayStr();
  };
})(typeof window !== 'undefined' ? window : globalThis);
