(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;

  function toast(text, kind, opts) {
    opts = opts || {};
    var box = doc.getElementById('toast-root');
    if (!box) return null;
    var el = doc.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.setAttribute('data-testid', 'toast');
    var span = doc.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    if (opts.actionLabel) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.textContent = opts.actionLabel;
      b.setAttribute('data-testid', 'toast-action');
      b.onclick = function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (opts.onAction) opts.onAction();
      };
      el.appendChild(b);
    }
    box.appendChild(el);
    if (!opts.sticky) {
      root.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, opts.duration || 4000);
    }
    return el;
  }

  function undo(label, fn) {
    return toast(label || '已删除', '', { actionLabel: '撤销', onAction: fn, duration: 6000 });
  }

  function empty(opts) {
    opts = opts || {};
    return '<div class="empty" data-testid="empty"><p>' + App.esc(opts.text) + '</p>' +
      (opts.actionLabel ? '<button type="button" class="btn btn-primary btn-sm" data-empty-action="1" data-testid="empty-action">' + App.esc(opts.actionLabel) + '</button>' : '') +
      '</div>';
  }

  function bindEmpty(container, fn) {
    var list = container.querySelectorAll('[data-empty-action]');
    for (var i = 0; i < list.length; i++) list[i].onclick = fn;
  }

  function formRow(f, val) {
    var v = val == null ? (f.value == null ? '' : f.value) : val;
    var input;
    if (f.type === 'textarea') {
      input = '<textarea class="textarea" name="' + f.key + '" data-field="' + f.key + '">' + App.esc(v) + '</textarea>';
    } else if (f.type === 'select') {
      input = '<select class="select" name="' + f.key + '" data-field="' + f.key + '">' +
        (f.options || []).map(function (o) {
          return '<option value="' + App.esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + App.esc(o[1]) + '</option>';
        }).join('') + '</select>';
    } else {
      var stepAttr = f.step ? f.step : (f.type === 'number' ? 'any' : '');
      input = '<input class="input" type="' + (f.type || 'text') + '" name="' + f.key + '" data-field="' + f.key + '" value="' + App.esc(v) + '"' +
        (stepAttr ? ' step="' + stepAttr + '"' : '') + (f.min !== undefined ? ' min="' + f.min + '"' : '') + '>';
    }
    return '<div class="field"><label>' + App.esc(f.label) + '</label>' + input +
      '<div class="error-text hidden" data-error="' + f.key + '"></div></div>';
  }

  function closeDrawer() {
    var r = doc.getElementById('drawer-root');
    if (r) r.innerHTML = '';
  }

  function drawer(opts) {
    opts = opts || {};
    var r = doc.getElementById('drawer-root');
    var values = opts.values || {};
    r.innerHTML = '<div class="drawer-mask" data-drawer-mask="1"></div>' +
      '<aside class="drawer" data-testid="drawer">' +
      '<div class="drawer-head"><strong>' + App.esc(opts.title || '编辑') + '</strong>' +
      '<button type="button" class="btn btn-sm" data-testid="drawer-close">关闭</button></div>' +
      '<form id="drawer-form" novalidate><div class="drawer-body">' +
      (opts.fields || []).map(function (f) { return formRow(f, values[f.key]); }).join('') +
      (opts.extraHtml || '') +
      '</div><div class="drawer-foot">' +
      (opts.onDelete ? '<button type="button" class="btn btn-danger" data-testid="drawer-delete">删除</button>' : '') +
      '<button type="button" class="btn" data-testid="drawer-cancel">取消</button>' +
      '<button type="submit" class="btn btn-primary" data-testid="drawer-submit">确定</button>' +
      '</div></form></aside>';

    var form = r.querySelector('#drawer-form');
    var mask = r.querySelector('[data-drawer-mask]');
    if (mask) mask.onclick = closeDrawer;
    var closeBtn = r.querySelector('[data-testid="drawer-close"]');
    var cancelBtn = r.querySelector('[data-testid="drawer-cancel"]');
    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (cancelBtn) cancelBtn.onclick = closeDrawer;
    var delBtn = r.querySelector('[data-testid="drawer-delete"]');
    if (delBtn && opts.onDelete) delBtn.onclick = function () { opts.onDelete(); };

    form.onsubmit = function (e) {
      e.preventDefault();
      var out = {};
      var bad = false;
      (opts.fields || []).forEach(function (f) {
        var input = form.querySelector('[data-field="' + f.key + '"]');
        var val = input ? input.value.trim() : '';
        var errBox = form.querySelector('[data-error="' + f.key + '"]');
        if (f.required && !val) {
          bad = true;
          if (errBox) { errBox.textContent = '请填写' + f.label; errBox.classList.remove('hidden'); }
        } else if (errBox) {
          errBox.classList.add('hidden');
        }
        if (f.type === 'number') out[f.key] = val === '' ? '' : Number(val);
        else out[f.key] = val;
      });
      if (bad) return;
      var keep = opts.onSubmit && opts.onSubmit(out);
      if (keep !== false) closeDrawer();
    };
    var first = form.querySelector('.input, .select, .textarea');
    if (first) { try { first.focus(); } catch (e) {} }
  }

  function closeConfirm() {
    var r = doc.getElementById('modal-root');
    if (r) r.innerHTML = '';
  }

  function confirm(opts) {
    opts = opts || {};
    var r = doc.getElementById('modal-root');
    var need = opts.requireText;
    r.innerHTML = '<div class="modal-mask"><div class="modal" data-testid="modal">' +
      '<h3>' + App.esc(opts.title || '确认操作') + '</h3>' +
      '<p>' + App.esc(opts.body || '') + '</p>' +
      (need ? '<div class="field"><label>请输入「' + App.esc(need) + '」以确认</label><input class="input" data-testid="confirm-input" autocomplete="off"></div>' : '') +
      (opts.previewHtml || '') +
      '<div class="modal-foot">' +
      '<button type="button" class="btn" data-testid="confirm-cancel">取消</button>' +
      '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-testid="confirm-ok"' + (need ? ' disabled' : '') + '>' + App.esc(opts.confirmLabel || '确认') + '</button>' +
      '</div></div></div>';

    var cancel = r.querySelector('[data-testid="confirm-cancel"]');
    var okBtn = r.querySelector('[data-testid="confirm-ok"]');
    var input = r.querySelector('[data-testid="confirm-input"]');
    if (cancel) cancel.onclick = closeConfirm;
    if (input) {
      input.oninput = function () {
        okBtn.disabled = input.value.trim() !== need;
      };
    }
    if (okBtn) okBtn.onclick = function () {
      if (okBtn.disabled) return;
      closeConfirm();
      if (opts.onConfirm) opts.onConfirm();
    };
  }

  App.ui = {
    toast: toast, undo: undo, empty: empty, bindEmpty: bindEmpty,
    formRow: formRow, drawer: drawer, closeDrawer: closeDrawer,
    confirm: confirm, closeConfirm: closeConfirm
  };
})(typeof window !== 'undefined' ? window : globalThis);
