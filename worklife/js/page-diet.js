(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;
  var viewDate = App.todayStr();
  var targetMeal = 'breakfast';
  var MEALS = [['breakfast', '早餐'], ['lunch', '午餐'], ['dinner', '晚餐'], ['snack', '加餐']];

  function isPast() { return viewDate < App.todayStr(); }

  function day() {
    var days = App.store.get().data.diet.days || {};
    return days[viewDate] || { breakfast: [], lunch: [], dinner: [], snack: [], water: 0, note: '' };
  }

  function ensureDay(st) {
    if (!st.data.diet.days) st.data.diet.days = {};
    if (!st.data.diet.days[viewDate]) {
      st.data.diet.days[viewDate] = { breakfast: [], lunch: [], dinner: [], snack: [], water: 0, note: '' };
    }
    var d = st.data.diet.days[viewDate];
    MEALS.forEach(function (m) { if (!Array.isArray(d[m[0]])) d[m[0]] = []; });
    if (typeof d.water !== 'number') d.water = Number(d.water) || 0;
    if (typeof d.note !== 'string') d.note = String(d.note || '');
    return d;
  }

  function addFood(meal) {
    if (isPast()) return;
    var nameEl = doc.getElementById('diet-name-' + meal);
    var amountEl = doc.getElementById('diet-amount-' + meal);
    if (!nameEl) return;
    var name = nameEl.value.trim();
    if (!name) { App.ui.toast('请填写食物名称', 'error'); nameEl.focus(); return; }
    var amount = amountEl ? amountEl.value.trim() : '';
    App.store.commit(function (st) {
      ensureDay(st)[meal].push({ id: App.uid(), name: name, amount: amount });
    });
    App.shell.refresh();
  }

  function addCommon(name) {
    if (isPast()) return;
    var clean = String(name || '').trim();
    if (!clean) return;
    App.store.commit(function (st) {
      st.data.diet.commonFoods.push({ id: App.uid(), name: clean });
    });
    App.shell.refresh();
  }

  function useCommon(id) {
    if (isPast()) return;
    var f = App.find(App.store.get().data.diet.commonFoods || [], id);
    if (!f) return;
    App.store.commit(function (st) {
      ensureDay(st)[targetMeal].push({ id: App.uid(), name: f.name, amount: '' });
    });
    App.shell.refresh();
  }

  App.register('diet', {
    title: '饮食计划',
    desc: '按天记四餐、饮水与小结',
    primaryAction: {
      label: '+ 加常用食物',
      onClick: function () {
        var el = doc.getElementById('diet-common-input');
        if (el) el.focus();
      }
    },
    todayCandidates: function () { return []; },
    render: function (box) {
      var st = App.store.get();
      var d = day();
      var past = isPast();
      var mealCount = MEALS.filter(function (m) { return (d[m[0]] || []).length > 0; }).length;
      var common = st.data.diet.commonFoods || [];

      var mealBlocks = MEALS.map(function (m) {
        var items = d[m[0]] || [];
        return '<div class="meal-block" data-meal="' + m[0] + '" data-field="name,amount">' +
          '<h4>' + m[1] + ' <span class="hint">' + items.length + ' 条</span></h4>' +
          (items.map(function (f) {
            return '<div class="row" style="padding:5px 8px;margin-bottom:5px">' +
              '<span class="row-main">' + App.esc(f.name) + '</span>' +
              '<span class="row-sub">' + App.esc(f.amount || '') + '</span>' +
              (past ? '' : '<button type="button" class="btn btn-sm" data-food-del="' + f.id + '">删除</button>') +
              '</div>';
          }).join('') || '<div class="hint">还没有记录</div>') +
          (past ? '' : '<div class="inline-form" style="margin-top:8px;margin-bottom:0;gap:5px">' +
            '<input class="input" id="diet-name-' + m[0] + '" data-testid="diet-name-' + m[0] + '" placeholder="食物名" autocomplete="off">' +
            '<input class="input" id="diet-amount-' + m[0] + '" data-testid="diet-amount-' + m[0] + '" placeholder="份量" autocomplete="off">' +
            '<button type="button" class="btn btn-sm" data-testid="diet-add-' + m[0] + '">加入</button></div>') +
          '</div>';
      }).join('');

      box.innerHTML =
        '<div class="card"><div class="inline-form" style="margin-bottom:0">' +
        '<button type="button" class="btn btn-sm" data-testid="diet-prev">← 前一天</button>' +
        '<strong data-testid="diet-date" style="min-width:150px;text-align:center">' + App.esc(App.fmtDate(viewDate)) + '</strong>' +
        '<button type="button" class="btn btn-sm" data-testid="diet-next">后一天 →</button>' +
        '<button type="button" class="btn btn-sm" data-testid="diet-today">回到今天</button>' +
        '</div></div>' +
        (past ? '<div class="card" data-testid="diet-readonly"><span class="badge warn">历史只读</span> ' +
          '<span class="hint">过去的日期只能查看，不能补记或改动。</span></div>' : '') +

        '<div class="grid-2" style="margin-top:12px">' +
        '<div class="stat"><div class="stat-label">今日已记录餐次</div><div class="stat-value" data-testid="diet-meal-count">' + mealCount + ' / 4</div></div>' +
        '<div class="stat"><div class="stat-label">饮水</div>' +
        '<div class="stat-value"><span data-testid="diet-water">' + (d.water || 0) + '</span> <span style="font-size:12px">杯</span></div>' +
        (past ? '' : '<div style="margin-top:6px;display:flex;gap:6px">' +
          '<button type="button" class="btn btn-sm" data-testid="diet-water-minus">− 1</button>' +
          '<button type="button" class="btn btn-sm" data-testid="diet-water-plus">+ 1</button></div>') + '</div></div>' +

        '<div class="grid-4" style="margin-top:12px">' + mealBlocks + '</div>' +

        '<div class="grid-2" style="margin-top:12px">' +
        '<div class="card"><h3 class="card-title">常用食物 · 一键加入</h3>' +
        '<div class="inline-form" style="margin-bottom:10px">' +
        '<select class="select" style="max-width:130px" data-testid="diet-target-meal">' +
        MEALS.map(function (m) { return '<option value="' + m[0] + '"' + (targetMeal === m[0] ? ' selected' : '') + '>加到' + m[1] + '</option>'; }).join('') +
        '</select>' +
        (past ? '' : '<input class="input" id="diet-common-input" data-testid="diet-common-input" placeholder="添加常用食物" autocomplete="off">' +
          '<button type="button" class="btn btn-sm" data-testid="diet-common-add">添加</button>') + '</div>' +
        '<div>' + (common.map(function (f) {
          return '<span class="chip" data-field="name">' + App.esc(f.name) +
            (past ? '' : ' <button type="button" class="link-btn" data-common-use="' + f.id + '">加入</button>' +
              ' <button type="button" class="link-btn" data-common-del="' + f.id + '">×</button>') + '</span>';
        }).join('') || '<span class="hint">还没有常用食物</span>') + '</div></div>' +
        '<div class="card"><h3 class="card-title">每日小结</h3>' +
        '<textarea class="textarea" data-testid="diet-note" placeholder="例如：外食偏油，晚上少吃了主食"' + (past ? ' disabled' : '') + '>' + App.esc(d.note || '') + '</textarea>' +
        '<div class="hint" style="margin-top:6px">不计算卡路里，只记一句自己的观察；改完即时保存。</div></div>' +
        '</div>';

      box.onclick = function (e) {
        var t = e.target;
        var hit = t.closest && t.closest('[data-testid]');
        var testid = hit ? hit.getAttribute('data-testid') : '';
        if (testid === 'diet-prev') { viewDate = App.shiftDate(viewDate, -1); App.shell.refresh(); return; }
        if (testid === 'diet-next') { viewDate = App.shiftDate(viewDate, 1); App.shell.refresh(); return; }
        if (testid === 'diet-today') { viewDate = App.todayStr(); App.shell.refresh(); return; }
        if (testid === 'diet-water-plus' || testid === 'diet-water-minus') {
          if (past) return;
          var delta = testid === 'diet-water-plus' ? 1 : -1;
          App.store.commit(function (s) {
            var dd = ensureDay(s);
            dd.water = Math.max(0, (Number(dd.water) || 0) + delta);
          });
          App.shell.refresh();
          return;
        }
        if (testid === 'diet-common-add') {
          var input = doc.getElementById('diet-common-input');
          addCommon(input ? input.value : '');
          return;
        }
        var mealBtn = MEALS.filter(function (m) { return testid === 'diet-add-' + m[0]; })[0];
        if (mealBtn) { addFood(mealBtn[0]); return; }

        var use = t.closest && t.closest('[data-common-use]');
        if (use) { useCommon(use.getAttribute('data-common-use')); return; }

        var attrs = ['food-del', 'common-del'];
        for (var i = 0; i < attrs.length; i++) {
          var el = t.closest && t.closest('[data-' + attrs[i] + ']');
          if (!el) continue;
          if (past) return;
          var id = el.getAttribute('data-' + attrs[i]);
          if (attrs[i] === 'food-del') {
            var removed = null;
            App.store.commit(function (s) {
              var dd = ensureDay(s);
              MEALS.forEach(function (m) {
                var found = App.find(dd[m[0]], id);
                if (found && !removed) {
                  removed = { item: found, meal: m[0] };
                  dd[m[0]] = dd[m[0]].filter(function (x) { return x.id !== id; });
                }
              });
            });
            App.ui.undo('已删除食物', function () {
              if (!removed) return;
              App.store.commit(function (s) { ensureDay(s)[removed.meal].push(removed.item); });
              App.shell.refresh();
            });
          } else {
            var c = App.find(App.store.get().data.diet.commonFoods || [], id);
            if (!c) return;
            App.store.commit(function (s) {
              s.data.diet.commonFoods = s.data.diet.commonFoods.filter(function (x) { return x.id !== id; });
            });
            App.ui.undo('已删除常用食物', function () {
              App.store.commit(function (s) { s.data.diet.commonFoods.push(c); });
              App.shell.refresh();
            });
          }
          App.shell.refresh();
          return;
        }
      };

      box.onchange = function (e) {
        var t = e.target;
        if (past) return;
        if (t.getAttribute && t.getAttribute('data-testid') === 'diet-target-meal') {
          targetMeal = t.value;
          return;
        }
        if (t.getAttribute && t.getAttribute('data-testid') === 'diet-note') {
          var note = t.value;
          App.store.commit(function (s) { ensureDay(s).note = note; });
        }
      };

      box.onkeydown = function (e) {
        if (e.key !== 'Enter') return;
        var id = e.target.id || '';
        var meal = MEALS.filter(function (m) { return id === 'diet-name-' + m[0] || id === 'diet-amount-' + m[0]; })[0];
        if (meal) { e.preventDefault(); addFood(meal[0]); return; }
        if (id === 'diet-common-input') { e.preventDefault(); addCommon(e.target.value); }
      };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
