'use strict';
const h = require('./harness');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n=== 阶段 1 · 数据层与安全网（PRD 第 10 章 B 组）===');
  const { browser, downloadPath } = await h.launch('stage1');
  let ok = false;
  let backupPath = null;
  let invalidPath = null;
  try {
    const { page, errors, remote } = await h.openApp(browser, { clear: true, downloadPath });
    const s = h.makeSuite('阶段 1');

    await s.check('S1-0 进入数据与设置页，四个分区与存储说明齐全', async () => {
      await h.click(page, 'nav-settings');
      assert.equal(await h.text(page, '#page-title'), '数据与设置');
      const cards = await h.count(page, '.card');
      assert.ok(cards >= 5, '设置页分区不足：' + cards);
      const note = await h.text(page, '[data-testid="storage-note"]');
      assert.ok(/清缓存/.test(note) && /导出/.test(note), '存储说明未写清清缓存会丢与导出备份（F4）');
    });

    await s.check('S1-1 通过 UI 准备数据并导出 JSON，文件内容完整（B1）', async () => {
      await page.evaluate(() => {
        App.store.commit(st => {
          st.data.memos.push({ id: 'm1', text: '买蛋白粉', done: false, createdAt: App.isoNow() });
          st.data.memos.push({ id: 'm2', text: '周末备份', done: false, createdAt: App.isoNow() });
          st.data.today.push({ id: 't1', date: App.todayStr(), time: '09:30', title: '整理选题', source: 'media', done: false });
          st.data.media.topics.push({ id: 'tp1', title: '第一版发布', platform: '公众号', status: 'idea', targetDate: '', createdAt: App.isoNow() });
          st.data.dev.projects.push({ id: 'p1', name: '本地工具', status: 'active', note: '' });
        }, true);
        App.shell.refresh();
      });
      await h.click(page, 'export-btn');
      backupPath = await h.waitForFile(downloadPath, '.json', 12000);
      const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      assert.equal(payload.app, 'worklife-local');
      assert.equal(payload.schemaVersion, 1);
      assert.ok(payload.exportedAt, '缺少导出时间');
      assert.ok(payload.settings && payload.settings.theme, '缺少设置');
      assert.equal(payload.data.memos.length, 2);
      assert.equal(payload.data.media.topics.length, 1);
      assert.ok(/^worklife-backup-\d{4}-\d{2}-\d{2}\.json$/.test(path.basename(backupPath)), '备份文件名不带日期');
    });

    await s.check('S1-2 改动数据后导入旧备份并确认，数据被覆盖恢复（B2）', async () => {
      assert.ok(backupPath, '依赖 S1-1 的备份文件');
      await page.evaluate(() => {
        App.store.commit(st => {
          st.data.memos.push({ id: 'm3', text: '临时改动', done: false, createdAt: App.isoNow() });
          st.data.today = [];
        }, true);
        App.shell.refresh();
      });
      const before = await h.state(page);
      assert.equal(before.data.memos.length, 3);
      const input = await page.$('[data-testid="import-input"]');
      await input.uploadFile(backupPath);
      await page.waitForSelector('[data-testid="import-preview"]', { timeout: 10000 });
      const preview = await h.text(page, '[data-testid="import-preview"]');
      assert.ok(/2 条/.test(preview), '导入预览未显示各模块条目数');
      await h.click(page, 'confirm-ok');
      await page.waitForFunction(() => window.App.state.page === 'home', { timeout: 10000 });
      const after = await h.state(page);
      assert.equal(after.data.memos.length, 2, '导入后备忘数量未恢复');
      assert.equal(after.data.today.length, 1, '导入后今日计划未恢复');
      assert.equal(after.data.media.topics.length, 1, '导入后自媒体选题未恢复');
      assert.ok(!after.data.memos.some(x => x.id === 'm3'), '改动数据未被覆盖');
    });

    await s.check('S1-3 导入前显示预览，取消后数据一条不变；无效备份被拒绝（B3）', async () => {
      assert.ok(backupPath, '依赖 S1-1 的备份文件');
      await h.click(page, 'nav-settings');
      const before = await h.state(page);
      const input = await page.$('[data-testid="import-input"]');
      await input.uploadFile(backupPath);
      await page.waitForSelector('[data-testid="import-preview"]', { timeout: 10000 });
      assert.ok(await page.$('[data-testid="confirm-ok"]'), '缺少确认按钮');
      await h.click(page, 'confirm-cancel');
      const afterCancel = await h.state(page);
      assert.deepEqual(afterCancel.data, before.data, '取消导入后数据发生了变化');

      invalidPath = path.join(path.dirname(backupPath), 'invalid-backup.json');
      fs.writeFileSync(invalidPath, JSON.stringify({ app: 'some-other-app', schemaVersion: 1, data: {}, settings: {} }), 'utf8');
      const input2 = await page.$('[data-testid="import-input"]');
      await input2.uploadFile(invalidPath);
      await page.waitForFunction(() => {
        const t = Array.from(document.querySelectorAll('[data-testid="toast"]')).map(e => e.textContent).join('|');
        return /不是本应用导出的备份文件/.test(t);
      }, { timeout: 10000 });
      const afterInvalid = await h.state(page);
      assert.deepEqual(afterInvalid.data, before.data, '无效备份不应改动数据');
    });

    await s.check('S1-4 全部重置未输入确认词时按钮不可用，数据不被清空（B4）', async () => {
      const before = await h.state(page);
      await h.click(page, 'reset-btn');
      await page.waitForSelector('[data-testid="modal"]', { timeout: 10000 });
      let disabled = await page.$eval('[data-testid="confirm-ok"]', el => el.disabled);
      assert.ok(disabled, '确认按钮初始应禁用');
      await h.fill(page, '[data-testid="confirm-input"]', '随便写点别的');
      disabled = await page.$eval('[data-testid="confirm-ok"]', el => el.disabled);
      assert.ok(disabled, '输入不匹配时确认按钮仍应禁用');
      await h.click(page, 'confirm-cancel');
      const after = await h.state(page);
      assert.deepEqual(after.data, before.data, '取消后数据被改动');
    });

    await s.check('S1-5 单模块清空只影响该模块（B5）', async () => {
      const before = await h.state(page);
      assert.ok(before.data.media.topics.length > 0, '自媒体应有数据可供清空');
      await page.select('[data-testid="clear-module-select"]', 'media');
      await h.click(page, 'clear-module-btn');
      await page.waitForSelector('[data-testid="modal"]', { timeout: 10000 });
      await h.click(page, 'confirm-ok');
      await page.waitForFunction(() => window.App.store.get().data.media.topics.length === 0, { timeout: 10000 });
      const after = await h.state(page);
      assert.equal(after.data.media.topics.length, 0);
      assert.equal(after.data.memos.length, before.data.memos.length, '备忘被误清');
      assert.equal(after.data.today.length, before.data.today.length, '今日计划被误清');
      assert.equal(after.data.dev.projects.length, before.data.dev.projects.length, '开发工作被误清');
    });

    await s.check('S1-6 删除后点「撤销」数据恢复（B6）', async () => {
      await page.evaluate(() => {
        const s = App.store.get();
        const item = s.data.memos[s.data.memos.length - 1];
        window.__undoItem = item;
        App.store.commit(st => { st.data.memos = st.data.memos.filter(x => x.id !== item.id); }, true);
        App.ui.undo('已删除', () => {
          App.store.commit(st => { st.data.memos.push(window.__undoItem); });
        });
      });
      const n0 = (await h.state(page)).data.memos.length;
      await h.click(page, 'toast-action');
      const after = await h.state(page);
      assert.equal(after.data.memos.length, n0 + 1, '撤销后记录未恢复');
      assert.ok(after.data.memos.some(x => x.id === 'm2'), '恢复的不是被删记录');
    });

    await s.check('S1-7 改动即时落盘并提示「已保存」，页面无保存按钮（E1）', async () => {
      await h.click(page, 'theme-dark');
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('[data-testid="toast"]')).some(e => /已保存/.test(e.textContent));
      }, { timeout: 10000 });
      const saveBtns = await page.$$eval('button', els => els.filter(e => /^\s*保存\s*$/.test(e.textContent)).length);
      assert.equal(saveBtns, 0, '不应出现手动保存按钮');
      const st = await h.state(page);
      assert.equal(st.settings.theme, 'dark');
    });

    await s.check('S1-8 浏览器存储写入失败时给出明确提示并建议导出（B7）', async () => {
      await page.evaluate(() => {
        window.__origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
      });
      await h.click(page, 'theme-toggle');
      await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('[data-testid="toast"]')).some(e => /保存失败/.test(e.textContent));
      }, { timeout: 10000 });
      const toasts = await page.$$eval('[data-testid="toast"]', els => els.map(e => e.textContent).join(' | '));
      assert.ok(/保存失败/.test(toasts), '未提示保存失败');
      assert.ok(/导出备份/.test(toasts), '未建议导出备份');
      await page.evaluate(() => { Storage.prototype.setItem = window.__origSetItem; });
    });

    h.assertNoErrors(errors);
    h.assertRemoteEmpty(remote);
    ok = s.finish();
  } catch (e) {
    console.log('  阶段 1 测试异常：' + (e && e.stack ? e.stack : e));
    ok = false;
  } finally {
    await h.shutdown(browser);
  }
  return ok;
}

if (require.main === module) main().then(ok => process.exit(ok ? 0 : 1));
module.exports = main;
