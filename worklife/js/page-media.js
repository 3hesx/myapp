(function (root) {
  'use strict';
  var App = root.App;
  var doc = root.document;
  var tab = 'topics';
  var topicFilter = 'all';

  function topicDrawer(existing) {
    App.ui.drawer({
      title: existing ? '编辑选题' : '新增选题',
      fields: [
        { key: 'title', label: '选题标题', required: true, value: existing ? existing.title : '' },
        { key: 'platform', label: '平台', value: existing ? existing.platform : '' },
        { key: 'status', label: '状态', type: 'select', options: App.enums.topicStatus, value: existing ? existing.status : 'idea' },
        { key: 'targetDate', label: '目标发布日期', type: 'date', value: existing ? existing.targetDate : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          if (existing) {
            var t = App.find(st.data.media.topics, existing.id);
            if (t) { t.title = v.title; t.platform = v.platform; t.status = v.status; t.targetDate = v.targetDate; }
          } else {
            st.data.media.topics.push({
              id: App.uid(), title: v.title, platform: v.platform, status: v.status,
              targetDate: v.targetDate, createdAt: App.isoNow()
            });
          }
        });
        App.shell.refresh();
      }
    });
  }

  function postDrawer(existing) {
    App.ui.drawer({
      title: existing ? '编辑发布记录' : '新增发布记录',
      fields: [
        { key: 'date', label: '发布日期', type: 'date', required: true, value: existing ? existing.date : App.todayStr() },
        { key: 'platform', label: '平台', value: existing ? existing.platform : '' },
        { key: 'title', label: '标题', required: true, value: existing ? existing.title : '' },
        { key: 'link', label: '链接', value: existing ? existing.link : '' }
      ],
      onSubmit: function (v) {
        App.store.commit(function (st) {
          if (existing) {
            var p = App.find(st.data.media.posts, existing.id);
            if (p) { p.date = v.date; p.platform = v.platform; p.title = v.title; p.link = v.link; }
          } else {
            st.data.media.posts.push({ id: App.uid(), topicId: '', date: v.date, platform: v.platform, title: v.title, link: v.link });
          }
        });
        App.shell.refresh();
      }
    });
  }

  function publishTopic(id) {
    App.store.commit(function (st) {
      var t = App.find(st.data.media.topics, id);
      if (!t) return;
      t.status = 'published';
      st.data.media.posts.push({
        id: App.uid(), topicId: t.id, date: App.todayStr(),
        platform: t.platform, title: t.title, link: ''
      });
    });
    App.shell.refresh();
    App.ui.toast('已转为发布记录');
  }

  function metricOf(postId) {
    var m = App.store.get().data.media.metrics;
    for (var i = 0; i < m.length; i++) { if (m[i].postId === postId) return m[i]; }
    return { postId: postId, views: 0, interactions: 0, followers: 0 };
  }

  function metricSummary(posts) {
    var totalV = 0, totalI = 0, totalF = 0;
    posts.forEach(function (p) {
      var m = metricOf(p.id);
      totalV += Number(m.views) || 0; totalI += Number(m.interactions) || 0; totalF += Number(m.followers) || 0;
    });
    var avg = posts.length ? Math.round(totalV / posts.length) : 0;
    function stat(label, val, tid) {
      return '<div class="stat"><div class="stat-label">' + label + '</div>' +
        '<div class="stat-value" data-testid="' + tid + '">' + val + '</div></div>';
    }
    return '<div class="summary-grid">' +
      stat('总阅读', totalV, 'metric-total-v') +
      stat('总互动', totalI, 'metric-total-i') +
      stat('总涨粉', totalF, 'metric-total-f') +
      stat('平均阅读', avg, 'metric-avg-v') + '</div>';
  }

  function metricChart(posts) {
    var ms = posts.map(function (p) { return metricOf(p.id); });
    var maxV = Math.max.apply(null, ms.map(function (m) { return Number(m.views) || 0; }).concat([1]));
    var maxI = Math.max.apply(null, ms.map(function (m) { return Number(m.interactions) || 0; }).concat([1]));
    var maxF = Math.max.apply(null, ms.map(function (m) { return Number(m.followers) || 0; }).concat([1]));
    var groups = posts.slice().reverse().map(function (p) {
      var m = metricOf(p.id);
      var hv = Math.max(2, Math.round((Number(m.views) || 0) / maxV * 100));
      var hi = Math.max(2, Math.round((Number(m.interactions) || 0) / maxI * 100));
      var hf = Math.max(2, Math.round((Number(m.followers) || 0) / maxF * 100));
      var label = App.esc(p.title).slice(0, 8);
      return '<div class="bar-group" data-testid="bar-group">' +
        '<div class="bar-col">' +
        '<div class="bar v" style="height:' + hv + '%" data-testid="bar-v"><title>' + (Number(m.views) || 0) + ' 阅读</title></div>' +
        '<div class="bar i" style="height:' + hi + '%" data-testid="bar-i"><title>' + (Number(m.interactions) || 0) + ' 互动</title></div>' +
        '<div class="bar f" style="height:' + hf + '%" data-testid="bar-f"><title>' + (Number(m.followers) || 0) + ' 涨粉</title></div>' +
        '</div><div class="bar-label" title="' + App.esc(p.title) + '">' + label + '</div></div>';
    }).join('');
    return '<div class="card chart-wrap"><h3 class="card-title">发布数据对比 · 每根柱按该指标自身最大值归一化，悬停看具体数值</h3>' +
      '<div class="chart" data-testid="media-chart">' + groups + '</div>' +
      '<div class="chart-legend">' +
      '<span class="legend-item"><span class="legend-dot" style="background:var(--accent)"></span>阅读</span>' +
      '<span class="legend-item"><span class="legend-dot" style="background:var(--ok)"></span>互动</span>' +
      '<span class="legend-item"><span class="legend-dot" style="background:var(--warn)"></span>涨粉</span>' +
      '</div></div>';
  }

  App.register('media', {
    title: '自媒体',
    desc: '从选题到发布数据',
    primaryAction: { label: '+ 新增选题', onClick: function () { topicDrawer(null); } },
    todayCandidates: function () {
      return (App.store.get().data.media.topics || [])
        .filter(function (t) { return t.status !== 'published'; })
        .map(function (t) { return { title: t.title, time: '10:00' }; });
    },
    render: function (box) {
      var d = App.store.get().data.media;
      var tabs = [['topics', '选题库'], ['posts', '发布记录'], ['metrics', '数据记录']];

      var body = '';
      if (tab === 'topics') {
        var topics = (d.topics || []).filter(function (t) { return topicFilter === 'all' || t.status === topicFilter; });
        body =
          '<div class="inline-form"><select class="select" style="max-width:160px" data-testid="media-filter">' +
          '<option value="all"' + (topicFilter === 'all' ? ' selected' : '') + '>全部状态</option>' +
          App.enums.topicStatus.map(function (o) {
            return '<option value="' + o[0] + '"' + (topicFilter === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select></div>' +
          (topics.map(function (t) {
            return '<div class="row" data-topic-row="' + t.id + '" data-field="title,platform,status,targetDate">' +
              '<span class="row-main"><strong>' + App.esc(t.title) + '</strong>' +
              '<span class="row-sub">' + App.esc(t.platform || '未填平台') + (t.targetDate ? ' · 目标 ' + App.esc(t.targetDate) : '') + '</span></span>' +
              '<select class="select" style="width:110px" data-topic-status="' + t.id + '">' + App.options('topicStatus', t.status) + '</select>' +
              '<button type="button" class="btn btn-sm" data-topic-publish="' + t.id + '">转已发布</button>' +
              '<button type="button" class="btn btn-sm" data-topic-edit="' + t.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-topic-del="' + t.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有选题，先记一个想法', actionLabel: '新增选题' })) +
          '<div class="card" style="margin-top:14px"><h3 class="card-title">灵感速记</h3>' +
          '<input class="input" data-testid="idea-input" placeholder="想到一句就记下来，回车即存" autocomplete="off">' +
          '<div style="margin-top:10px">' + ((d.ideas || []).slice(-5).reverse().map(function (i) {
            return '<div class="row" data-field="text"><span class="row-main">' + App.esc(i.text) + '</span>' +
              '<button type="button" class="btn btn-sm" data-idea-topic="' + i.id + '">转为选题</button>' +
              '<button type="button" class="btn btn-sm" data-idea-del="' + i.id + '">删除</button></div>';
          }).join('') || '<div class="hint">还没有灵感速记</div>') + '</div></div>';
      } else if (tab === 'posts') {
        body = '<div class="inline-form"><button type="button" class="btn" data-testid="media-add-post">+ 新增发布记录</button></div>' +
          ((d.posts || []).slice().reverse().map(function (p) {
            return '<div class="row" data-field="date,platform,title,link">' +
              '<span class="row-main"><strong>' + App.esc(p.title) + '</strong>' +
              '<span class="row-sub">' + App.esc(p.date) + ' · ' + App.esc(p.platform || '未填平台') + (p.link ? ' · ' + App.esc(p.link) : '') + '</span></span>' +
              '<button type="button" class="btn btn-sm" data-post-edit="' + p.id + '">编辑</button>' +
              '<button type="button" class="btn btn-sm" data-post-del="' + p.id + '">删除</button></div>';
          }).join('') || App.ui.empty({ text: '还没有发布记录', actionLabel: '新增发布记录' }));
      } else {
        var posts = d.posts || [];
        body = posts.length
          ? metricSummary(posts) + metricChart(posts) +
            '<div class="hint" style="margin:14px 0 10px">填写每条发布后的数据，修改即时保存；下方数字改动后上方图表会同步更新。</div>' +
            posts.map(function (p) {
              var m = metricOf(p.id);
              return '<div class="row" data-field="postId,views,interactions,followers">' +
                '<span class="row-main" style="min-width:150px">' + App.esc(p.title) + '<span class="row-sub">' + App.esc(p.date) + '</span></span>' +
                '<label class="hint">阅读<input type="number" min="0" class="input" style="width:88px" data-metric="' + p.id + '" data-mkey="views" value="' + (m.views || 0) + '"></label>' +
                '<label class="hint">互动<input type="number" min="0" class="input" style="width:88px" data-metric="' + p.id + '" data-mkey="interactions" value="' + (m.interactions || 0) + '"></label>' +
                '<label class="hint">涨粉<input type="number" min="0" class="input" style="width:88px" data-metric="' + p.id + '" data-mkey="followers" value="' + (m.followers || 0) + '"></label></div>';
            }).join('')
          : App.ui.empty({ text: '还没有可填数据的发布记录' });
      }

      box.innerHTML = '<div class="tabs">' + tabs.map(function (t) {
        return '<button type="button" class="tab' + (tab === t[0] ? ' active' : '') + '" data-media-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' + body;

      App.ui.bindEmpty(box, function () {
        if (tab === 'topics') topicDrawer(null);
        else if (tab === 'posts') postDrawer(null);
      });

      box.onclick = function (e) {
        var t = e.target;
        var tabBtn = t.closest && t.closest('[data-media-tab]');
        if (tabBtn) { tab = tabBtn.getAttribute('data-media-tab'); App.shell.refresh(); return; }
        var hit = t.closest && t.closest('[data-testid]');
        var testid = hit ? hit.getAttribute('data-testid') : '';
        if (testid === 'media-add-post') { postDrawer(null); return; }
        var attrs = ['topic-publish', 'topic-edit', 'topic-del', 'post-edit', 'post-del', 'idea-topic', 'idea-del'];
        for (var i = 0; i < attrs.length; i++) {
          var el = t.closest && t.closest('[data-' + attrs[i] + ']');
          if (!el) continue;
          var id = el.getAttribute('data-' + attrs[i]);
          var key = attrs[i];
          if (key === 'topic-publish') publishTopic(id);
          else if (key === 'topic-edit') topicDrawer(App.find(App.store.get().data.media.topics, id));
          else if (key === 'post-edit') postDrawer(App.find(App.store.get().data.media.posts, id));
          else if (key === 'idea-topic') {
            var idea = App.find(App.store.get().data.media.ideas, id);
            if (idea) {
              App.store.commit(function (st) {
                st.data.media.topics.push({ id: App.uid(), title: idea.text, platform: '', status: 'idea', targetDate: '', createdAt: App.isoNow() });
                st.data.media.ideas = st.data.media.ideas.filter(function (x) { return x.id !== id; });
              });
              App.shell.refresh();
            }
          } else if (key === 'topic-del' || key === 'post-del' || key === 'idea-del') {
            var group = key === 'topic-del' ? 'topics' : key === 'post-del' ? 'posts' : 'ideas';
            var removed = App.find(App.store.get().data.media[group], id);
            if (!removed) return;
            App.store.commit(function (st) {
              st.data.media[group] = st.data.media[group].filter(function (x) { return x.id !== id; });
            });
            App.ui.undo('已删除', function () {
              App.store.commit(function (st) { st.data.media[group].push(removed); });
              App.shell.refresh();
            });
            App.shell.refresh();
          }
          return;
        }
      };

      box.onchange = function (e) {
        var t = e.target;
        if (t.getAttribute && t.getAttribute('data-testid') === 'media-filter') { topicFilter = t.value; App.shell.refresh(); return; }
        if (t.hasAttribute && t.hasAttribute('data-topic-status')) {
          var id = t.getAttribute('data-topic-status');
          var val = t.value;
          App.store.commit(function (st) {
            var item = App.find(st.data.media.topics, id);
            if (item) item.status = val;
          });
          App.shell.refresh();
          return;
        }
        if (t.hasAttribute && t.hasAttribute('data-metric')) {
          var pid = t.getAttribute('data-metric');
          var mkey = t.getAttribute('data-mkey');
          var num = Number(t.value) || 0;
          App.store.commit(function (st) {
            var m = st.data.media.metrics;
            var found = null;
            for (var i = 0; i < m.length; i++) { if (m[i].postId === pid) { found = m[i]; break; } }
            if (!found) { found = { id: App.uid(), postId: pid, views: 0, interactions: 0, followers: 0 }; m.push(found); }
            found[mkey] = num;
          });
          App.shell.refresh();
        }
      };

      box.onkeydown = function (e) {
        if (e.key !== 'Enter' || !e.target.hasAttribute || !e.target.hasAttribute('data-testid')) return;
        if (e.target.getAttribute('data-testid') !== 'idea-input') return;
        var text = e.target.value.trim();
        if (!text) return;
        e.preventDefault();
        App.store.commit(function (st) {
          st.data.media.ideas.push({ id: App.uid(), text: text, createdAt: App.isoNow() });
        });
        App.shell.refresh();
      };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
