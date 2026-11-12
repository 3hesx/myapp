'use strict';
const h = require('./harness');
const assert = require('assert/strict');

async function main() {
  console.log('\n=== 阶段 2 · 首页与今日计划（A2–A4 / C2 / C3 / C5 / C6）===');
  const first = await h.launch('stage2');
  const opened = [first.browser];
  let ok = false;
  try {
    const { page, errors, remote } = await h.openApp(first.browser, { clear: true, downloadPath: first.downloadPath });
    const s = h.makeSuite('阶段 2');

    await s.check('S2-1 空列表有场景化引导，不显示空白页（E3）', async () => {
      await h.click(page, 'nav-today');
      const empty = await h.count(page, '[data-testid="empty"]');
      assert.ok(empty >= 1, '今日计划空状态缺失');
      const txt = await h.text(page, '[data-testid="empty"]');
      assert.ok(/还没有安排/.test(txt), '空状态文案不符合场景');
    });

    await s.check('S2-2 首页快速备忘回车即存，刷新后仍在（C3 / A2 部分）', async () => {
      await h.click(page, 'nav-home');
      await h.fill(page, '[data-testid="memo-input"]', '周末备份一次数据');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.App.store.get().data.memos.length === 1, { timeout: 10000 });
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-app-ready="1"]');
      const st = await h.state(page);
      assert.equal(st.data.memos.length, 1);
      assert.equal(st.data.memos[0].text, '周末备份一次数据');
      const shown = await page.$eval('#content', el => el.textContent);
      assert.ok(/周末备份一次数据/.test(shown), '刷新后首页未显示备忘');
    });

    await s.check('S2-3 今日计划通过 UI 新增事项，时间轴与小结正确', async () => {
      await h.click(page, 'nav-today');
      await h.fill(page, '[data-testid="today-title"]', '写第一版代码');
      await h.click(page, 'today-add');
      await page.waitForFunction(() => window.App.store.get().data.today.length === 1, { timeout: 10000 });
      const st = await h.state(page);
      assert.equal(st.data.today[0].title, '写第一版代码');
      assert.equal(st.data.today[0].source, 'manual');
      assert.equal(st.data.today[0].date, await page.evaluate(() => App.todayStr()));
      assert.equal(await h.count(page, '[data-today-row]'), 1);
      assert.ok(/完成 0 \/ 共 1 条/.test(await h.text(page, '[data-testid="today-summary"]')));
    });

    await s.check('S2-4 刷新页面后数据仍在（A2）', async () => {
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-app-ready="1"]');
      const st = await h.state(page);
      assert.equal(st.data.memos.length, 1, '备忘丢失');
      assert.equal(st.data.today.length, 1, '今日计划丢失');
      assert.ok(/写第一版代码/.test(await page.$eval('#content', el => el.textContent)));
    });

    await s.check('S2-5 首页勾选今日计划，今日计划页同步为已完成（C2）', async () => {
      await h.click(page, 'nav-home');
      const cb = await page.$('[data-today-check]');
      assert.ok(cb, '首页缺少今日计划勾选框');
      await cb.click();
      await page.waitForFunction(() => window.App.store.get().data.today[0].done === true, { timeout: 10000 });
      const st = await h.state(page);
      assert.equal(st.data.today[0].done, true);
      await h.click(page, 'nav-today');
      const checked = await page.$eval('[data-today-check]', el => el.checked);
      assert.ok(checked, '今日计划页未显示为完成');
    });

    await s.check('S2-6 历史日期只读，不能新增、勾选或删除（C5）', async () => {
      const before = await h.state(page);
      await h.click(page, 'today-prev');
      await page.waitForSelector('[data-testid="today-readonly"]', { timeout: 10000 });
      const addDisabled = await page.$eval('[data-testid="today-add"]', el => el.disabled);
      const titleDisabled = await page.$eval('[data-testid="today-title"]', el => el.disabled);
      assert.ok(addDisabled && titleDisabled, '历史日期的新增控件未禁用');
      const delBtns = await h.count(page, '[data-today-del]');
      assert.equal(delBtns, 0, '历史日期不应出现删除按钮');
      const after = await h.state(page);
      assert.deepEqual(after.data.today, before.data.today, '只读状态下数据被改动');
      await h.click(page, 'today-today');
    });

    await s.check('S2-7 Esc 关闭「加入今天」抽屉（E2）', async () => {
      await h.click(page, 'today-join');
      await page.waitForSelector('[data-testid="drawer"]', { timeout: 10000 });
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-testid="drawer"]'), { timeout: 10000 });
    });

    await s.check('S2-8 首页六张摘要卡片存在且点击直达对应模块（C6 / C1 基础）', async () => {
      await h.click(page, 'nav-home');
      const keys = ['media', 'dev', 'consult', 'fitness', 'diet', 'games'];
      for (const k of keys) {
        assert.ok(await page.$('[data-testid="home-card-' + k + '"]'), '缺少卡片 ' + k);
      }
      await h.click(page, 'home-card-media');
      assert.equal(await h.text(page, '#page-title'), '自媒体');
      await h.click(page, 'nav-home');
      const total = await h.text(page, '[data-testid="home-total"]');
      assert.equal(total, '1', '首页今日计划总数未随数据变化（C1）');
    });

    h.assertNoErrors(errors);
    h.assertRemoteEmpty(remote);

    await s.check('S2-9 关闭浏览器后重新打开，数据仍在（A3）', async () => {
      await h.shutdown(first.browser);
      const second = await h.launch('stage2-reopen', first.profilePath);
      opened.push(second.browser);
      const ctx = await h.openApp(second.browser, { downloadPath: second.downloadPath });
      const st = await h.state(ctx.page);
      assert.equal(st.data.memos.length, 1, '关闭浏览器后备忘丢失');
      assert.equal(st.data.today.length, 1, '关闭浏览器后今日计划丢失');
      assert.equal(st.data.today[0].done, true, '完成状态丢失');
      await h.click(ctx.page, 'nav-home');
      assert.ok(/周末备份一次数据/.test(await ctx.page.$eval('#content', el => el.textContent)));
      await h.shutdown(second.browser);
    });

    await s.check('S2-10 浏览器进程完全退出后用同一持久化数据重新打开，数据仍在（A4 等价验证）', async () => {
      const third = await h.launch('stage2-restart', first.profilePath);
      opened.push(third.browser);
      const ctx = await h.openApp(third.browser, { downloadPath: third.downloadPath });
      const st = await h.state(ctx.page);
      assert.equal(st.data.memos.length, 1);
      assert.equal(st.data.today.length, 1);
      assert.equal(st.data.today[0].title, '写第一版代码');
      await h.shutdown(third.browser);
    });

    ok = s.finish();
  } catch (e) {
    console.log('  阶段 2 测试异常：' + (e && e.stack ? e.stack : e));
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
