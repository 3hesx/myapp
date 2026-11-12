'use strict';
const h = require('./harness');
const assert = require('assert/strict');

async function main() {
  console.log('\n=== 阶段 6 · v1.1 用户反馈增强验收（PRD §11 G1–G7）===');
  const first = await h.launch('stage6');
  const opened = [first.browser];
  let ok = false;
  try {
    const { page, errors } = await h.openApp(first.browser, { clear: true, downloadPath: first.downloadPath });
    const s = h.makeSuite('阶段 6');

    const today = await page.evaluate(() => App.todayStr());

    // ---------- G1：顶部「已自动保存 ✓」指示 ----------
    await s.check('G1 改动后顶部出现「已自动保存 ✓」，且初始不显示', async () => {
      const before = await page.$eval('[data-testid="save-indicator"]', el => el.textContent || '');
      assert.ok(!/已自动保存/.test(before), '改动前不该出现保存指示：' + before);
      await page.evaluate(() => {
        App.store.commit(st => { st.data.memos.push({ id: 'g1', text: 'G1 自动保存指示', done: false, createdAt: App.isoNow() }); });
      });
      await page.waitForFunction(() => /已自动保存/.test((document.querySelector('[data-testid="save-indicator"]') || {}).textContent || ''), { timeout: 5000 });
      const txt = await page.$eval('[data-testid="save-indicator"]', el => el.textContent);
      assert.ok(/已自动保存/.test(txt) && /✓/.test(txt), '保存指示文案不完整：' + txt);
    });

    // ---------- G2：开发模块无项目时「新增任务」不再死路 ----------
    await s.check('G2 无项目时「新增任务」引导先建项目（抽屉出现项目字段），按钮文案正确', async () => {
      await page.evaluate(() => App.shell.go('dev'));
      await page.waitForFunction(() => App.state.page === 'dev', { timeout: 5000 });
      await page.waitForFunction(() => App.store.get().data.dev.projects.length === 0, { timeout: 5000 });
      const addTaskLabel = await page.$eval('[data-testid="dev-add-task"]', el => el.textContent);
      const addProjLabel = await page.$eval('[data-testid="dev-add-project"]', el => el.textContent);
      assert.ok(/新增任务/.test(addTaskLabel), '新增任务按钮文案不对：' + addTaskLabel);
      assert.ok(/新增项目/.test(addProjLabel), '新增项目按钮文案不对：' + addProjLabel);
      await page.evaluate(() => document.querySelector('[data-testid="dev-add-task"]').click());
      await page.waitForSelector('[data-testid="drawer"]', { timeout: 5000 });
      const field = await page.$('[data-field="name"]');
      assert.ok(field, '无项目点「新增任务」未引导到建项目抽屉');
      // 建一个项目，确认衔接自动弹出任务抽屉
      await h.fill(page, '[data-field="name"]', 'G2 衔接项目');
      await h.click(page, 'drawer-submit');
      await page.waitForFunction(() => App.store.get().data.dev.projects.length === 1, { timeout: 5000 });
      await page.waitForSelector('[data-testid="drawer"]', { timeout: 5000 });
      const taskField = await page.$('[data-field="title"]');
      assert.ok(taskField, '建完项目后未自动衔接到新增任务抽屉');
      // 关掉任务抽屉
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-testid="drawer"]'), { timeout: 5000 });
    });

    // ---------- G3：咨询客户删除按钮明显可用，可删除并撤销 ----------
    await s.check('G3 咨询客户每行有「删除」按钮，点击删除并可撤销', async () => {
      await h.click(page, 'nav-consult');
      await page.evaluate(() => {
        App.store.commit(st => {
          st.data.consult.clients = [];
          st.data.consult.clients.push({ id: 'c1', name: 'G3 客户', contact: '', note: '' });
        }, true);
        App.shell.refresh();
      });
      await page.waitForFunction(() => App.store.get().data.consult.clients.length === 1, { timeout: 5000 });
      const delBtn = await page.$('[data-client-del="c1"]');
      assert.ok(delBtn, '客户行缺少删除按钮');
      const label = await page.evaluate(el => el.textContent.trim(), delBtn);
      assert.equal(label, '删除', '删除按钮文案不对：' + label);
      const visible = await page.evaluate(el => {
        const cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
      }, delBtn);
      assert.ok(visible, '删除按钮不可见');
      await delBtn.click();
      await page.waitForFunction(() => App.store.get().data.consult.clients.length === 0, { timeout: 5000 });
      await h.click(page, 'toast-action');
      await page.waitForFunction(() => App.store.get().data.consult.clients.length === 1, { timeout: 5000 });
    });

    // ---------- G4：自媒体数据记录页柱状对比图与汇总卡片 ----------
    await s.check('G4 自媒体数据记录页渲染汇总卡片与柱状对比图（有数据时出柱）', async () => {
      await page.evaluate(() => {
        App.store.commit(st => {
          st.data.media.posts.push({ id: 'p1', topicId: '', date: App.todayStr(), platform: '公众号', title: 'G4 视频A', link: '' });
          st.data.media.posts.push({ id: 'p2', topicId: '', date: App.todayStr(), platform: '视频号', title: 'G4 视频B', link: '' });
          st.data.media.metrics.push({ id: 'm1', postId: 'p1', views: 1200, interactions: 80, followers: 30 });
          st.data.media.metrics.push({ id: 'm2', postId: 'p2', views: 3000, interactions: 200, followers: 90 });
        }, true);
        App.shell.refresh();
      });
      await h.click(page, 'nav-media');
      await page.click('[data-media-tab="metrics"]');
      await page.waitForSelector('[data-testid="media-chart"]', { timeout: 5000 });
      assert.equal(await h.count(page, '[data-testid="bar-group"]'), 2, '柱状分组数量应等于发布数');
      assert.ok((await h.count(page, '[data-testid="bar-v"]')) >= 2, '缺少阅读柱子');
      const total = await page.$eval('[data-testid="metric-total-v"]', el => el.textContent.trim());
      assert.equal(Number(total), 4200, '总阅读汇总不对：' + total);
      const avg = await page.$eval('[data-testid="metric-avg-v"]', el => el.textContent.trim());
      assert.equal(Number(avg), 2100, '平均阅读汇总不对：' + avg);
    });

    // ---------- G5：健身月历 ----------
    await s.check('G5 健身月历：42 格、有训练日显示摘要、点某天跳转训练记录并按该日查看', async () => {
      await page.evaluate(() => {
        App.store.commit(st => {
          st.data.fitness.exercises.push({ id: 'ex1', name: '引体向上', part: '背' });
          st.data.fitness.workouts.push({ id: 'w1', date: App.todayStr(), exerciseId: 'ex1', sets: 3, reps: 10, weight: 0 });
        }, true);
        App.shell.refresh();
      });
      await h.click(page, 'nav-fitness');
      await page.click('[data-fitness-tab="calendar"]');
      await page.waitForSelector('[data-testid="fitness-cal-label"]', { timeout: 5000 });
      assert.equal(await h.count(page, '[data-testid="cal-cell"]'), 42, '月历应为 6×7=42 格');
      const todayCell = await page.$('[data-cal-date="' + today + '"]');
      assert.ok(todayCell, '找不到今天的月历格');
      const has = await page.evaluate(el => el.classList.contains('has'), todayCell);
      assert.ok(has, '今天有训练但月历格未标记 has');
      const tag = await page.evaluate(el => (el.querySelector('.cal-tag') || {}).textContent || '', todayCell);
      assert.ok(/10/.test(tag), '月历今天格未显示组次摘要：' + tag);
      await todayCell.click();
      await page.waitForSelector('[data-testid="fitness-clear-filter"]', { timeout: 5000 });
      const dateVal = await page.$eval('[data-testid="fitness-date"]', el => el.value);
      assert.equal(dateVal, today, '点月历格后训练记录日期未切到当天');
    });

    // ---------- G6：饮食月历 ----------
    await s.check('G6 饮食月历：42 格、有记录日显示餐次/饮水、点某天跳转当日记录', async () => {
      await page.evaluate(() => {
        App.store.commit(st => {
          if (!st.data.diet.days[App.todayStr()]) st.data.diet.days[App.todayStr()] = { breakfast: [], lunch: [], dinner: [], snack: [], water: 0, note: '' };
          st.data.diet.days[App.todayStr()].breakfast.push({ id: 'f1', name: '燕麦', amount: '' });
          st.data.diet.days[App.todayStr()].water = 2;
        }, true);
        App.shell.refresh();
      });
      await h.click(page, 'nav-diet');
      await page.click('[data-diet-tab="calendar"]');
      await page.waitForSelector('[data-testid="diet-cal-label"]', { timeout: 5000 });
      assert.equal(await h.count(page, '[data-testid="cal-cell"]'), 42, '饮食月历应为 42 格');
      const todayCell = await page.$('[data-cal-date="' + today + '"]');
      assert.ok(todayCell, '找不到今天的饮食月历格');
      const has = await page.evaluate(el => el.classList.contains('has'), todayCell);
      assert.ok(has, '今天有饮食记录但月历格未标记 has');
      const tag = await page.evaluate(el => (el.querySelector('.cal-tag') || {}).textContent || '', todayCell);
      assert.ok(/餐/.test(tag), '饮食月历今天格未显示餐次：' + tag);
      await todayCell.click();
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="diet-date"]');
        return el && /今天/.test(el.textContent) === false; // 日视图会显示具体日期
      }, { timeout: 5000 }).catch(() => {});
      const content = await h.text(page, '#content');
      assert.ok(/燕麦/.test(content), '点月历格后未跳到当日饮食记录');
    });

    // ---------- G7：整体视觉升级 ----------
    await s.check('G7 视觉升级：卡片圆角生效、按钮有质感、暗亮双主题均正常', async () => {
      await h.click(page, 'nav-home');
      const radius = await page.$eval('.card', el => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
      assert.ok(radius >= 10, '卡片圆角未生效：' + radius);
      const primaryShadow = await page.$eval('.btn-primary', el => getComputedStyle(el).boxShadow);
      assert.ok(primaryShadow && primaryShadow !== 'none', '主按钮缺少阴影质感：' + primaryShadow);
      const primaryBg = await page.$eval('.btn-primary', el => getComputedStyle(el).backgroundImage);
      assert.ok(/gradient/.test(primaryBg), '主按钮缺少渐变质感：' + primaryBg);
      const indColor = await page.$eval('[data-testid="save-indicator"]', el => getComputedStyle(el).color);
      assert.ok(indColor && indColor !== 'rgba(0, 0, 0, 0)', '保存指示缺少配色');
      await h.click(page, 'nav-settings');
      await h.click(page, 'theme-light');
      await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', { timeout: 5000 });
      await h.click(page, 'nav-home');
      assert.equal(await h.text(page, '#page-title'), '首页总览');
      await h.click(page, 'nav-settings');
      await h.click(page, 'theme-dark');
      await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', { timeout: 5000 });
    });

    h.assertNoErrors(errors);

    ok = s.finish();
  } catch (e) {
    console.log('  阶段 6 测试异常：' + (e && e.stack ? e.stack : e));
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
