'use strict';
const h = require('./harness');
const assert = require('assert/strict');

const PAGES = [
  ['home', '首页总览'], ['today', '今日计划'], ['media', '自媒体'],
  ['dev', '开发工作'], ['consult', '咨询工作'], ['fitness', '健身计划'],
  ['diet', '饮食计划'], ['games', '游戏娱乐'], ['settings', '数据与设置']
];

async function main() {
  console.log('\n=== 阶段 0 · 可打开的骨架 ===');
  const { browser, downloadPath } = await h.launch('stage0');
  let ok = false;
  try {
    const { page, errors, remote } = await h.openApp(browser, { clear: true, downloadPath });
    const s = h.makeSuite('阶段 0');

    await s.check('S0-1 应用能加载并完成启动，无 JS 报错', async () => {
      h.assertNoErrors(errors);
      const ready = await page.$eval('html', el => el.getAttribute('data-app-ready'));
      assert.equal(ready, '1');
    });

    await s.check('S0-2 断网可用，无任何 http/https 远程请求（A1 / F2）', async () => {
      h.assertRemoteEmpty(remote);
      const title = await h.text(page, '#page-title');
      assert.ok(title.length > 0, '页面标题为空');
    });

    await s.check('S0-3 侧栏存在 9 个导航入口，分 4 组（A5）', async () => {
      const n = await h.count(page, '[data-testid^="nav-"]');
      assert.equal(n, 9, '导航入口数量应为 9，实际 ' + n);
      const groups = await h.count(page, '.nav-group');
      assert.equal(groups, 4, '导航分组数量应为 4');
    });

    await s.check('S0-4 逐个点击 9 个入口：标题正确、主操作按钮存在、当前项高亮（A5）', async () => {
      for (const [key, title] of PAGES) {
        await h.click(page, 'nav-' + key);
        const got = await h.text(page, '#page-title');
        assert.equal(got, title, key + ' 页标题不正确：' + got);
        const btn = await page.$('[data-testid="primary-action"]');
        assert.ok(btn, key + ' 页缺少主操作按钮');
        const active = await page.$eval('[data-testid="nav-' + key + '"]', el => el.classList.contains('active'));
        assert.ok(active, key + ' 导航未高亮');
        const content = await page.$eval('#content', el => el.textContent.trim().length);
        assert.ok(content > 0, key + ' 页内容为空（白屏）');
      }
    });

    await s.check('S0-5 主题可切换，刷新后保持（E4）', async () => {
      const before = await page.$eval('html', el => el.getAttribute('data-theme'));
      assert.equal(before, 'dark', '默认应为深色');
      await h.click(page, 'theme-toggle');
      const after = await page.$eval('html', el => el.getAttribute('data-theme'));
      assert.equal(after, 'light', '切换后应为浅色');
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-app-ready="1"]');
      const kept = await page.$eval('html', el => el.getAttribute('data-theme'));
      assert.equal(kept, 'light', '刷新后主题未保持');
      const st = await h.state(page);
      assert.equal(st.settings.theme, 'light');
    });

    await s.check('S0-6 无登录、账号、密码入口（F1）', async () => {
      const pw = await h.count(page, 'input[type="password"]');
      assert.equal(pw, 0, '不应出现密码输入框');
      const body = await page.evaluate(() => document.body.innerText);
      assert.ok(!/登录|注册|账号登录/.test(body), '页面不应出现登录/注册字样');
    });

    await s.check('S0-7 浏览器本地存储可用，数据层已就位（R2 基础）', async () => {
      const usable = await page.evaluate(() => {
        try {
          localStorage.setItem('__probe__', '1');
          const v = localStorage.getItem('__probe__');
          localStorage.removeItem('__probe__');
          return v === '1' && !!window.App && !!window.App.store && typeof window.App.store.commit === 'function';
        } catch (e) { return false; }
      });
      assert.ok(usable, 'localStorage 不可用或 App.store 未就绪');
    });

    await s.check('S0-8 桌面视口无横向溢出、无白屏', async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, '横向溢出 ' + overflow + 'px');
    });

    h.assertNoErrors(errors);
    h.assertRemoteEmpty(remote);
    ok = s.finish();
  } catch (e) {
    console.log('  阶段 0 测试异常：' + (e && e.stack ? e.stack : e));
    ok = false;
  } finally {
    await h.shutdown(browser);
  }
  return ok;
}

if (require.main === module) main().then(ok => process.exit(ok ? 0 : 1));
module.exports = main;
