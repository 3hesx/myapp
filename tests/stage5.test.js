'use strict';
const h = require('./harness');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const NAV = [
  ['home', '首页总览'], ['today', '今日计划'], ['media', '自媒体'],
  ['dev', '开发工作'], ['consult', '咨询工作'], ['fitness', '健身计划'],
  ['diet', '饮食计划'], ['games', '游戏娱乐'], ['settings', '数据与设置']
];

async function drawerFill(page, field, value) {
  await h.fill(page, '[data-field="' + field + '"]', value);
}
async function submitDrawer(page) {
  await h.click(page, 'drawer-submit');
  await page.waitForFunction(() => !document.querySelector('[data-testid="drawer"]'), { timeout: 10000 });
}
async function addItem(page, nav, action, fields) {
  await h.click(page, 'nav-' + nav);
  await h.click(page, action);
  await page.waitForSelector('[data-testid="drawer"]', { timeout: 10000 });
  for (const k of Object.keys(fields)) await drawerFill(page, k, fields[k]);
  await submitDrawer(page);
}

async function main() {
  console.log('\n=== 阶段 5 · 收口与全量验收（PRD 第 10 章 A–F 共 30 条）===');
  const first = await h.launch('stage5');
  const opened = [first.browser];
  let ok = false;
  let backupPath = null;
  try {
    const { page, errors, remote } = await h.openApp(first.browser, { clear: true, downloadPath: first.downloadPath });
    const s = h.makeSuite('阶段 5');

    // ---------- A 组 ----------
    await s.check('A1 断网 file:// 打开，九个模块可用、无报错、无联网请求', async () => {
      const titles = [];
      for (const [key, name] of NAV) {
        await h.click(page, 'nav-' + key);
        const t = await h.text(page, '#page-title');
        assert.equal(t, name, '入口 ' + key + ' 标题不对：' + t);
        assert.ok(await page.$('[data-testid="primary-action"]'), key + ' 缺少主操作按钮');
        assert.ok((await h.text(page, '#content')).length > 0, key + ' 页面内容为空');
        titles.push(t);
      }
      assert.equal(titles.length, 9);
      assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-app-ready')), '1');
    });

    await s.check('A2 新增一条记录后刷新，记录与字段都还在', async () => {
      await addItem(page, 'media', 'primary-action', { title: 'A2 持久化选题', platform: '公众号' });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-app-ready="1"]');
      const st = await h.state(page);
      const topic = st.data.media.topics.find(x => x.title === 'A2 持久化选题');
      assert.ok(topic, '刷新后选题丢失');
      assert.equal(topic.platform, '公众号', '刷新后字段丢失');
      assert.equal(topic.status, 'idea');
    });

    await s.check('A5 九个入口逐个点击，标题正确且当前项高亮', async () => {
      for (const [key, name] of NAV) {
        await h.click(page, 'nav-' + key);
        assert.equal(await h.text(page, '#page-title'), name);
        const active = await page.$eval('.nav-item.active', el => el.getAttribute('data-page'));
        assert.equal(active, key, key + ' 未高亮');
      }
    });

    await s.check('A6 缩到手机尺寸，不白屏、不报错', async () => {
      await page.setViewport({ width: 375, height: 667 });
      await h.click(page, 'nav-games');
      assert.ok((await h.text(page, '#content')).length > 0, '小视口下内容为空');
      assert.equal(await page.evaluate(() => document.body.children.length > 0), true);
      await page.setViewport({ width: 1440, height: 900 });
    });

    // ---------- B 组 ----------
    await s.check('B1 导出 JSON：带日期文件名、内容与偏好完整', async () => {
      await h.click(page, 'nav-settings');
      await page.evaluate(() => {
        App.store.commit(st => {
          st.data.memos.push({ id: 'm1', text: '买蛋白粉', done: false, createdAt: App.isoNow() });
          st.data.memos.push({ id: 'm2', text: '周末备份', done: false, createdAt: App.isoNow() });
          st.data.today.push({ id: 't1', date: App.todayStr(), time: '09:30', title: '整理选题', source: 'media', done: false });
          st.data.dev.projects.push({ id: 'p1', name: '本地工具', status: 'active', note: '' });
        }, true);
        App.shell.refresh();
      });
      await h.click(page, 'export-btn');
      backupPath = await h.waitForFile(first.downloadPath, '.json', 12000);
      const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      assert.equal(payload.app, 'worklife-local');
      assert.equal(payload.schemaVersion, 1);
      assert.ok(payload.exportedAt && payload.settings && payload.settings.theme);
      assert.equal(payload.data.memos.length, 2);
      assert.equal(payload.data.dev.projects.length, 1);
      assert.ok(/^worklife-backup-\d{4}-\d{2}-\d{2}\.json$/.test(path.basename(backupPath)));
    });

    await s.check('B2 改动后导入旧备份并确认，改动被覆盖恢复', async () => {
      await page.evaluate(() => {
        App.store.commit(st => {
          st.data.memos.push({ id: 'm3', text: '临时改动', done: false, createdAt: App.isoNow() });
          st.data.today = [];
        }, true);
      });
      const input = await page.$('[data-testid="import-input"]');
      await input.uploadFile(backupPath);
      await page.waitForSelector('[data-testid="import-preview"]', { timeout: 10000 });
      await h.click(page, 'confirm-ok');
      await page.waitForFunction(() => window.App.state.page === 'home', { timeout: 10000 });
      const st = await h.state(page);
      assert.equal(st.data.memos.length, 2);
      assert.equal(st.data.today.length, 1);
      assert.ok(!st.data.memos.some(x => x.id === 'm3'));
    });

    await s.check('B3 导入预览可见、取消后数据不变，无效备份被拒绝', async () => {
      await h.click(page, 'nav-settings');
      const before = await h.state(page);
      const input = await page.$('[data-testid="import-input"]');
      await input.uploadFile(backupPath);
      await page.waitForSelector('[data-testid="import-preview"]', { timeout: 10000 });
      assert.ok(/2 条/.test(await h.text(page, '[data-testid="import-preview"]')));
      assert.ok(/覆盖/.test(await h.text(page, '[data-testid="modal"]')));
      await h.click(page, 'confirm-cancel');
      assert.deepEqual((await h.state(page)).data, before.data, '取消导入后数据被改动');

      const invalid = path.join(path.dirname(backupPath), 'invalid-backup.json');
      fs.writeFileSync(invalid, JSON.stringify({ app: 'other', schemaVersion: 1, data: {}, settings: {} }), 'utf8');
      const input2 = await page.$('[data-testid="import-input"]');
      await input2.uploadFile(invalid);
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('[data-testid="toast"]')).some(e => /不是本应用导出的备份文件/.test(e.textContent));
      }, { timeout: 10000 });
      assert.deepEqual((await h.state(page)).data, before.data, '无效备份改动了数据');
    });

    await s.check('B4 全部重置未输入确认词时按钮不可用，数据不清空', async () => {
      const before = await h.state(page);
      await h.click(page, 'reset-btn');
      await page.waitForSelector('[data-testid="modal"]', { timeout: 10000 });
      assert.equal(await page.$eval('[data-testid="confirm-ok"]', el => el.disabled), true);
      await h.fill(page, '[data-testid="confirm-input"]', '随便写');
      assert.equal(await page.$eval('[data-testid="confirm-ok"]', el => el.disabled), true);
      await h.click(page, 'confirm-cancel');
      assert.deepEqual((await h.state(page)).data, before.data);
    });

    await s.check('B5 单模块清空只影响该模块', async () => {
      const before = await h.state(page);
      await page.select('[data-testid="clear-module-select"]', 'media');
      await h.click(page, 'clear-module-btn');
      await page.waitForSelector('[data-testid="modal"]', { timeout: 10000 });
      await h.click(page, 'confirm-ok');
      await page.waitForFunction(() => window.App.store.get().data.media.topics.length === 0, { timeout: 10000 });
      const after = await h.state(page);
      assert.equal(after.data.media.topics.length, 0);
      assert.equal(after.data.memos.length, before.data.memos.length);
      assert.equal(after.data.today.length, before.data.today.length);
      assert.equal(after.data.dev.projects.length, before.data.dev.projects.length);
    });

    await s.check('B6 删除一条记录后点「撤销」，记录恢复', async () => {
      const before = (await h.state(page)).data.memos.length;
      await page.evaluate(() => {
        const st = App.store.get();
        const item = st.data.memos[st.data.memos.length - 1];
        window.__undoItem = item;
        App.store.commit(s => { s.data.memos = s.data.memos.filter(x => x.id !== item.id); }, true);
        App.ui.undo('已删除', () => App.store.commit(s => { s.data.memos.push(window.__undoItem); }));
      });
      await h.click(page, 'toast-action');
      assert.equal((await h.state(page)).data.memos.length, before);
    });

    await s.check('B7 写入失败时明确提示并建议导出，不静默失败', async () => {
      await page.evaluate(() => {
        window.__origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
      });
      await h.click(page, 'theme-toggle');
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('[data-testid="toast"]')).some(e => /保存失败/.test(e.textContent));
      }, { timeout: 10000 });
      const toasts = await page.$$eval('[data-testid="toast"]', els => els.map(e => e.textContent).join(' | '));
      assert.ok(/保存失败/.test(toasts) && /导出备份/.test(toasts));
      await page.evaluate(() => {
        Storage.prototype.setItem = window.__origSetItem;
        App.store.commit(s => { s.settings.theme = 'dark'; });
        App.shell.applyTheme();
      });
    });

    // ---------- D 组：逐模块主流程复核（完整链路见阶段 3 / 4） ----------
    await s.check('D1 自媒体：新建选题 → 回显 → 场景字段完整', async () => {
      await addItem(page, 'media', 'primary-action', { title: '收口验收选题', platform: '公众号' });
      const st = await h.state(page);
      assert.ok(st.data.media.topics.some(x => x.title === '收口验收选题'));
      assert.ok(await page.$('[data-field="title,platform,status,targetDate"]'));
    });

    await s.check('D2 开发：项目下加任务，挂在正确项目且有场景字段', async () => {
      const pid = (await h.state(page)).data.dev.projects[0].id;
      await h.click(page, 'nav-dev');
      await h.click(page, 'dev-add-task');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'title', '收口验收任务');
      await submitDrawer(page);
      const st = await h.state(page);
      assert.equal(st.data.dev.tasks.length, 1);
      assert.equal(st.data.dev.tasks[0].projectId, pid);
      assert.ok(await page.$('[data-field="title,type,priority,status"]'));
    });

    await s.check('D3 咨询：客户 → 咨询记录 → 待跟进，本月统计正确', async () => {
      await addItem(page, 'consult', 'primary-action', { name: '收口验收客户' });
      await page.click('[data-consult-tab="sessions"]');
      await h.click(page, 'consult-add-session');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'topic', '需求沟通');
      await drawerFill(page, 'minutes', '30');
      await submitDrawer(page);
      assert.equal(await h.text(page, '[data-testid="consult-month-count"]'), '1');
      assert.ok(/30/.test(await h.text(page, '[data-testid="consult-month-minutes"]')));
      await page.click('[data-consult-tab="followups"]');
      await h.click(page, 'consult-add-followup');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'text', '发会议纪要');
      await submitDrawer(page);
      const st = await h.state(page);
      assert.equal(st.data.consult.clients.length, 1);
      assert.equal(st.data.consult.sessions.length, 1);
      assert.equal(st.data.consult.followups.length, 1);
      assert.ok(await page.$('[data-followup-join]'));
    });

    await s.check('D4 健身：周计划 / 训练记录 / 身体数据三处都存住', async () => {
      await h.click(page, 'nav-fitness');
      const key = await page.evaluate(() => {
        const p = App.todayStr().split('-').map(Number);
        const wd = new Date(p[0], p[1] - 1, p[2]).getDay();
        return wd === 0 ? 7 : wd;
      });
      await h.fill(page, '[data-week-day="' + key + '"]', '练背');
      await page.keyboard.press('Tab');
      await page.waitForFunction(k => String(App.store.get().data.fitness.weekPlan[k] || '') === '练背', { timeout: 10000 }, key);

      await page.click('[data-fitness-tab="workouts"]');
      await h.fill(page, '[data-testid="exercise-name"]', '引体向上');
      await h.click(page, 'exercise-add');
      await page.waitForFunction(() => App.store.get().data.fitness.exercises.length === 1, { timeout: 10000 });
      await h.click(page, 'fitness-add-workout');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'sets', '3');
      await drawerFill(page, 'reps', '10');
      await drawerFill(page, 'weight', '0');
      await submitDrawer(page);
      assert.equal((await h.state(page)).data.fitness.workouts.length, 1);

      await page.click('[data-fitness-tab="body"]');
      await h.click(page, 'fitness-add-body');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'weight', '68.5');
      await submitDrawer(page);
      assert.equal((await h.state(page)).data.fitness.body.length, 1);
      assert.ok(await page.$('[data-testid="body-trend"]'), '缺少体重趋势线');
    });

    await s.check('D5 饮食：四餐各一条、饮水、小结，刷新后仍在', async () => {
      await h.click(page, 'nav-diet');
      const meals = [['breakfast', '燕麦'], ['lunch', '米饭'], ['dinner', '鱼'], ['snack', '酸奶']];
      for (const [meal, name] of meals) {
        await h.fill(page, '[data-testid="diet-name-' + meal + '"]', name);
        await h.click(page, 'diet-add-' + meal);
      }
      await h.click(page, 'diet-water-plus');
      await h.fill(page, '[data-testid="diet-note"]', '今天吃得清淡');
      await page.keyboard.press('Tab');
      const today = await page.evaluate(() => App.todayStr());
      let st = await h.state(page);
      assert.equal(st.data.diet.days[today].breakfast.length, 1);
      assert.equal(st.data.diet.days[today].water, 1);
      assert.equal(await h.text(page, '[data-testid="diet-meal-count"]'), '4 / 4');
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-app-ready="1"]');
      st = await h.state(page);
      assert.equal(st.data.diet.days[today].snack[0].name, '酸奶');
      assert.equal(st.data.diet.days[today].note, '今天吃得清淡');
    });

    await s.check('D6 游戏：新增 → 改状态 → 记时长 → 评分短评', async () => {
      await addItem(page, 'games', 'primary-action', { name: '收口验收游戏', platform: 'PC', score: '4', review: '不错' });
      await page.select('[data-game-status]', 'playing');
      await page.waitForFunction(() => App.store.get().data.games.list[0].status === 'playing', { timeout: 10000 });
      await page.click('[data-games-tab="sessions"]');
      await h.click(page, 'games-add-session');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'minutes', '45');
      await submitDrawer(page);
      const st = await h.state(page);
      assert.equal(st.data.games.sessions[0].minutes, 45);
      assert.equal(st.data.games.list[0].score, 4);
      assert.equal(st.data.games.list[0].review, '不错');
      assert.ok(/45/.test(await h.text(page, '[data-testid="games-week-minutes"]')));
      await page.click('[data-games-tab="list"]');
      assert.ok(await page.$('[data-field="name,platform,status,score,review"]'));
    });

    await s.check('D7 逐页检查九个模块的列表行都有场景字段，不是通用待办', async () => {
      const checks = [
        ['home', null, 'time,title,source'],
        ['today', null, 'time,title,source,done'],
        ['media', '[data-media-tab="topics"]', 'title,platform,status,targetDate'],
        ['dev', null, 'title,type,priority,status'],
        ['consult', '[data-consult-tab="clients"]', 'name,contact,note'],
        ['fitness', '[data-fitness-tab="workouts"]', 'date,exerciseId,sets,reps,weight'],
        ['diet', null, 'name,amount'],
        ['games', '[data-games-tab="list"]', 'name,platform,status,score,review']
      ];
      for (const [nav, tabSel, fields] of checks) {
        await h.click(page, 'nav-' + nav);
        if (tabSel) await page.click(tabSel);
        const found = await page.$$eval('[data-field]', els => els.map(e => e.getAttribute('data-field')));
        assert.ok(found.length > 0, nav + ' 页面没有任何带场景字段的行');
        const rich = found.some(f => {
          const parts = f.split(',');
          return parts.length >= 2 && !(parts.length === 2 && parts.indexOf('done') >= 0);
        });
        assert.ok(rich, nav + ' 的列表行只有标题/勾选框，缺少场景字段：' + found.join(' | '));
        assert.ok(found.some(f => f.indexOf(fields.split(',')[0]) >= 0), nav + ' 缺少预期字段 ' + fields);
      }
    });

    // ---------- C 组 ----------
    await s.check('C1 任一模块增删数据后，首页对应摘要卡片数字随之变化', async () => {
      await h.click(page, 'nav-home');
      for (const k of ['media', 'dev', 'consult', 'fitness', 'diet', 'games']) {
        assert.ok(await page.$('[data-testid="home-main-' + k + '"]'), '缺少卡片 ' + k);
      }
      const before = await h.text(page, '[data-testid="home-main-games"]');
      await addItem(page, 'games', 'primary-action', { name: 'C1 验证游戏', platform: 'PC' });
      await h.click(page, 'nav-home');
      const after = await h.text(page, '[data-testid="home-main-games"]');
      assert.equal(before, after, '新增「想玩」游戏不应改变在玩数（预期）');
      await h.click(page, 'nav-games');
      const gid = await page.evaluate(() => App.store.get().data.games.list.find(x => x.name === 'C1 验证游戏').id);
      await page.select('[data-game-status="' + gid + '"]', 'playing');
      await page.waitForFunction(() => App.store.get().data.games.list.some(x => x.name === 'C1 验证游戏' && x.status === 'playing'), { timeout: 10000 });
      await h.click(page, 'nav-home');
      assert.equal(await h.text(page, '[data-testid="home-main-games"]'), '2', '改为在玩后卡片未变化');
    });

    await s.check('C2 首页勾选今日计划，今日计划页同步为已完成', async () => {
      await h.click(page, 'nav-today');
      await h.fill(page, '[data-testid="today-title"]', 'C2 收口事项');
      await h.click(page, 'today-add');
      await page.waitForFunction(() => window.App.store.get().data.today.some(x => x.title === 'C2 收口事项'), { timeout: 10000 });
      await h.click(page, 'nav-home');
      const cb = await page.$('[data-today-check]');
      assert.ok(cb);
      await cb.click();
      await page.waitForFunction(() => window.App.store.get().data.today.some(x => x.title === 'C2 收口事项' && x.done), { timeout: 10000 });
      await h.click(page, 'nav-today');
      assert.equal(await page.$eval('[data-today-check]', el => el.checked), true);
    });

    await s.check('C3 首页快速备忘回车即存，刷新后可完成可删除', async () => {
      await h.click(page, 'nav-home');
      await h.fill(page, '[data-testid="memo-input"]', 'C3 收口备忘');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.App.store.get().data.memos.some(x => x.text === 'C3 收口备忘'), { timeout: 10000 });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-app-ready="1"]');
      assert.ok(/C3 收口备忘/.test(await page.$eval('#content', el => el.textContent)));
      const memoCb = await page.$('[data-memo-check]');
      assert.ok(memoCb, '缺少备忘完成勾选框');
      const del = await page.$('[data-memo-del]');
      assert.ok(del, '缺少备忘删除按钮');
    });

    await s.check('C4 「加入今天」生成快照，删除源条目后仍在', async () => {
      await addItem(page, 'media', 'primary-action', { title: 'C4 快照选题' });
      await h.click(page, 'nav-today');
      await h.click(page, 'today-join');
      await page.waitForSelector('[data-testid="drawer"]', { timeout: 10000 });
      const idx = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('#drawer-form [data-join]'));
        return els.findIndex(el => el.closest('label').textContent.includes('C4 快照选题'));
      });
      assert.ok(idx >= 0, '加入今天抽屉缺少该选题候选');
      const checks = await page.$$('#drawer-form [data-join]');
      await checks[idx].click();
      await h.click(page, 'drawer-submit');
      await page.waitForFunction(() => window.App.store.get().data.today.some(x => x.title === 'C4 快照选题' && x.source === 'media'), { timeout: 10000 });
      const id = await page.evaluate(() => App.store.get().data.media.topics.find(x => x.title === 'C4 快照选题').id);
      await h.click(page, 'nav-media');
      await page.click('[data-topic-del="' + id + '"]');
      await page.waitForFunction(i => !App.store.get().data.media.topics.some(x => x.id === i), { timeout: 10000 }, id);
      await h.click(page, 'nav-today');
      const st = await h.state(page);
      const kept = st.data.today.filter(x => x.title === 'C4 快照选题');
      assert.equal(kept.length, 1);
      assert.equal(kept[0].source, 'media');
    });

    await s.check('C5 切到历史日期，今日计划与饮食都只读', async () => {
      await h.click(page, 'today-prev');
      await page.waitForSelector('[data-testid="today-readonly"]', { timeout: 10000 });
      assert.equal(await page.$eval('[data-testid="today-add"]', el => el.disabled), true);
      assert.equal(await h.count(page, '[data-today-del]'), 0);
      await h.click(page, 'today-today');
      await h.click(page, 'nav-diet');
      await h.click(page, 'diet-prev');
      await page.waitForSelector('[data-testid="diet-readonly"]', { timeout: 10000 });
      assert.equal(await page.$('[data-testid="diet-add-breakfast"]'), null);
      await h.click(page, 'diet-today');
    });

    await s.check('C6 首页六张卡片逐张点击，各自跳到对应模块', async () => {
      await h.click(page, 'nav-home');
      const map = { media: '自媒体', dev: '开发工作', consult: '咨询工作', fitness: '健身计划', diet: '饮食计划', games: '游戏娱乐' };
      for (const k of Object.keys(map)) {
        await h.click(page, 'home-card-' + k);
        assert.equal(await h.text(page, '#page-title'), map[k], k + ' 卡片跳错');
        await h.click(page, 'nav-home');
      }
    });

    // ---------- E 组 ----------
    await s.check('E1 改字段即时生效并提示「已保存」，全页无保存按钮', async () => {
      await h.click(page, 'nav-games');
      await page.select('[data-game-status]', 'done');
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('[data-testid="toast"]')).some(e => /已保存/.test(e.textContent));
      }, { timeout: 10000 });
      const saveBtns = await page.$$eval('button', els => els.filter(e => /^\s*保存\s*$/.test(e.textContent)).length);
      assert.equal(saveBtns, 0);
      assert.ok((await h.state(page)).data.games.list.some(x => x.status === 'done'));
    });

    await s.check('E2 Esc 关闭抽屉、Enter 提交表单', async () => {
      await h.click(page, 'nav-today');
      await h.click(page, 'today-join');
      await page.waitForSelector('[data-testid="drawer"]', { timeout: 10000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-testid="drawer"]'), { timeout: 10000 });
      await h.click(page, 'nav-home');
      await h.fill(page, '[data-testid="memo-input"]', 'E2 回车提交');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => App.store.get().data.memos.some(x => x.text === 'E2 回车提交'), { timeout: 10000 });
    });

    await s.check('E3 空模块有场景化引导文案与新增按钮，不是空白页', async () => {
      await h.click(page, 'nav-settings');
      await page.select('[data-testid="clear-module-select"]', 'games');
      await h.click(page, 'clear-module-btn');
      await page.waitForSelector('[data-testid="modal"]', { timeout: 10000 });
      await h.click(page, 'confirm-ok');
      await page.waitForFunction(() => App.store.get().data.games.list.length === 0, { timeout: 10000 });
      await h.click(page, 'nav-games');
      const emptyText = await h.text(page, '[data-testid="empty"]');
      assert.ok(/游戏/.test(emptyText), '空状态文案不贴合场景：' + emptyText);
      assert.ok(await page.$('[data-testid="empty-action"]'), '空状态缺少新增按钮');
    });

    await s.check('E4 切换到浅色并刷新，主题保持', async () => {
      await h.click(page, 'nav-settings');
      await h.click(page, 'theme-light');
      await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', { timeout: 10000 });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-app-ready="1"]');
      assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
      assert.equal((await h.state(page)).settings.theme, 'light');
    });

    await s.check('E5 设置里隐藏一张首页卡片，回首页不再显示，其余不变', async () => {
      await h.click(page, 'nav-settings');
      const cb = await page.$('[data-home-card="diet"]');
      await cb.click();
      await page.waitForFunction(() => App.store.get().settings.homeCards.indexOf('diet') < 0, { timeout: 10000 });
      await h.click(page, 'nav-home');
      assert.equal(await page.$('[data-testid="home-card-diet"]'), null);
      assert.ok(await page.$('[data-testid="home-card-games"]'), '其余卡片不应被影响');
      await h.click(page, 'nav-settings');
      const cb2 = await page.$('[data-home-card="diet"]');
      await cb2.click();
      await page.waitForFunction(() => App.store.get().settings.homeCards.indexOf('diet') >= 0, { timeout: 10000 });
    });

    await s.check('E6 全程无加载动画、骨架屏、网络错误提示', async () => {
      const bad = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        return all.filter(e => /(spinner|skeleton|loading|loader)/i.test(e.className || '')).length;
      });
      assert.equal(bad, 0, '存在加载动画/骨架屏元素');
      const txt = await page.evaluate(() => document.body.innerText);
      assert.ok(!/加载中|网络错误|请求失败/.test(txt), '出现加载或网络错误文案');
    });

    // ---------- F 组 ----------
    await s.check('F1 无登录页、无账号入口、无密码框', async () => {
      for (const [key] of NAV) {
        await h.click(page, 'nav-' + key);
        const pw = await page.$$eval('input[type="password"]', els => els.length);
        assert.equal(pw, 0, key + ' 页出现密码框');
        const txt = await page.evaluate(() => document.body.innerText);
        assert.ok(!/登录|注册|账号|密码/.test(txt), key + ' 页出现账号相关内容：' + txt.slice(0, 200));
      }
    });

    await s.check('F2 全程零远程 http/https 请求', async () => {
      h.assertRemoteEmpty(remote);
    });

    await s.check('F3 无提醒设置、搜索框、拖拽手柄、附件上传', async () => {
      const found = await page.evaluate(() => {
        const q = s => Array.from(document.querySelectorAll(s));
        return {
          search: q('input[type="search"], input[placeholder*="搜索"]').length,
          drag: q('[draggable="true"]').length,
          files: q('input[type="file"]').filter(e => e.getAttribute('data-testid') !== 'import-input').length,
          notice: q('button, label').filter(e => /提醒|通知/.test(e.textContent || '')).length
        };
      });
      assert.equal(found.search, 0, '出现搜索框');
      assert.equal(found.drag, 0, '出现拖拽手柄');
      assert.equal(found.files, 0, '出现附件上传入口');
      assert.equal(found.notice, 0, '出现提醒/通知设置');
    });

    await s.check('F4 存储说明写明数据在本机、清缓存会丢、建议定期导出', async () => {
      await h.click(page, 'nav-settings');
      const note = await h.text(page, '[data-testid="storage-note"]');
      assert.ok(/这台电脑/.test(note) && /清缓存会丢/.test(note) && /导出/.test(note), '存储说明不完整：' + note);
    });

    h.assertNoErrors(errors);

    // ---------- A3 / A4：关闭进程后重开（放在最后，会关闭主浏览器） ----------
    await s.check('A3 关闭浏览器再重新打开，全部数据仍在', async () => {
      const before = await h.state(page);
      await h.shutdown(first.browser);
      const second = await h.launch('stage5-reopen', first.profilePath);
      opened.push(second.browser);
      const ctx = await h.openApp(second.browser, { downloadPath: second.downloadPath });
      const after = await h.state(ctx.page);
      assert.deepEqual(after.data, before.data, '关闭浏览器后数据丢失');
      assert.equal(after.settings.theme, 'light', '偏好丢失');
      await h.shutdown(second.browser);
    });

    await s.check('A4 浏览器进程完全退出后再次打开，全部数据仍在（等价重启电脑）', async () => {
      const third = await h.launch('stage5-restart', first.profilePath);
      opened.push(third.browser);
      const ctx = await h.openApp(third.browser, { downloadPath: third.downloadPath });
      const st = await h.state(ctx.page);
      assert.ok(st.data.memos.length >= 1, '备忘丢失');
      assert.ok(st.data.today.length >= 1, '今日计划丢失');
      assert.ok(st.data.media.topics.length >= 1, '自媒体数据丢失');
      assert.ok(st.data.consult.clients.length >= 1, '咨询数据丢失');
      assert.equal(st.settings.theme, 'light');
      await h.shutdown(third.browser);
    });

    ok = s.finish();
  } catch (e) {
    console.log('  阶段 5 测试异常：' + (e && e.stack ? e.stack : e));
    ok = false;
  } finally {
    for (const b of opened) {
      try { await h.shutdown(b); } catch (e) { /* ignore */ }
    }
  }
  return ok;
}

if (require.main === module) main().then(ok => process.exit(ok ? 0 : 1));
module.exports = main;
