'use strict';
const h = require('./harness');
const assert = require('assert/strict');

async function drawerFill(page, field, value) {
  await h.fill(page, '[data-field="' + field + '"]', value);
}
async function submitDrawer(page) {
  await h.click(page, 'drawer-submit');
  await page.waitForFunction(() => !document.querySelector('[data-testid="drawer"]'), { timeout: 10000 });
}

async function main() {
  console.log('\n=== 阶段 3 · 工作三模块（D1 / D2 / D3 / C4 / C1）===');
  const { browser, downloadPath } = await h.launch('stage3');
  let ok = false;
  try {
    const { page, errors, remote } = await h.openApp(browser, { clear: true, downloadPath });
    const s = h.makeSuite('阶段 3');

    await s.check('S3-1 自媒体：新建选题 → 转已发布 → 填发布数据 → 灵感转选题（D1）', async () => {
      await h.click(page, 'nav-media');
      await h.click(page, 'primary-action');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'title', '第一版发布');
      await drawerFill(page, 'platform', '公众号');
      await submitDrawer(page);
      let st = await h.state(page);
      assert.equal(st.data.media.topics.length, 1);
      assert.equal(st.data.media.topics[0].status, 'idea');
      assert.ok(await page.$('[data-field="title,platform,status,targetDate"]'), '选题行缺少场景字段');

      const pubBtn = await page.$('[data-topic-publish]');
      await pubBtn.click();
      await page.waitForFunction(() => window.App.store.get().data.media.posts.length === 1, { timeout: 10000 });
      st = await h.state(page);
      assert.equal(st.data.media.topics[0].status, 'published');
      assert.equal(st.data.media.posts[0].title, '第一版发布');

      await h.click(page, 'nav-media');
      await page.click('[data-media-tab="metrics"]');
      await page.waitForSelector('[data-mkey="views"]');
      await h.fill(page, '[data-mkey="views"]', '1280');
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => {
        const m = window.App.store.get().data.media.metrics;
        return m.length === 1 && m[0].views === 1280;
      }, { timeout: 10000 });

      await page.click('[data-media-tab="topics"]');
      await page.waitForSelector('[data-testid="idea-input"]');
      await h.fill(page, '[data-testid="idea-input"]', '写一次开发复盘');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.App.store.get().data.media.ideas.length === 1, { timeout: 10000 });
      const ideaBtn = await page.$('[data-idea-topic]');
      await ideaBtn.click();
      await page.waitForFunction(() => window.App.store.get().data.media.topics.length === 2, { timeout: 10000 });
      st = await h.state(page);
      assert.ok(st.data.media.topics.some(t => t.title === '写一次开发复盘'));
    });

    await s.check('S3-2 开发工作：项目 → 任务/Bug → 改状态 → 删除项目级联提示（D2）', async () => {
      await h.click(page, 'nav-dev');
      await h.click(page, 'primary-action');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'name', '本地工具');
      await submitDrawer(page);
      let st = await h.state(page);
      assert.equal(st.data.dev.projects.length, 1);
      const pid = st.data.dev.projects[0].id;

      await h.click(page, 'dev-add-task');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'title', '修掉导入边界 Bug');
      await page.select('[data-field="type"]', 'bug');
      await submitDrawer(page);
      st = await h.state(page);
      assert.equal(st.data.dev.tasks.length, 1);
      assert.equal(st.data.dev.tasks[0].projectId, pid, '任务未挂在正确项目下');
      assert.equal(st.data.dev.tasks[0].type, 'bug');
      assert.ok(await page.$('[data-field="title,type,priority,status"]'), '任务行缺少场景字段');

      await page.select('[data-task-status]', 'doing');
      await page.waitForFunction(() => window.App.store.get().data.dev.tasks[0].status === 'doing', { timeout: 10000 });

      const del = await page.$('[data-project-del]');
      await del.click();
      await page.waitForSelector('[data-testid="modal"]');
      const modal = await h.text(page, '[data-testid="modal"]');
      assert.ok(/1 条任务也会删除/.test(modal), '删除项目未提示子任务数量');
      await h.click(page, 'confirm-ok');
      await page.waitForFunction(() => window.App.store.get().data.dev.projects.length === 0, { timeout: 10000 });
      st = await h.state(page);
      assert.equal(st.data.dev.tasks.length, 0, '子任务未级联删除');
    });

    await s.check('S3-3 咨询工作：客户 → 咨询记录 → 待跟进，本月统计正确（D3）', async () => {
      await h.click(page, 'nav-consult');
      await h.click(page, 'primary-action');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'name', '张先生');
      await submitDrawer(page);
      let st = await h.state(page);
      assert.equal(st.data.consult.clients.length, 1);
      assert.ok(await page.$('[data-field="name,contact,note"]'), '客户行缺少场景字段');

      await page.click('[data-consult-tab="sessions"]');
      await h.click(page, 'consult-add-session');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'topic', '第一版需求沟通');
      await drawerFill(page, 'minutes', '45');
      await submitDrawer(page);
      st = await h.state(page);
      assert.equal(st.data.consult.sessions.length, 1);
      assert.equal(st.data.consult.sessions[0].minutes, 45);
      assert.equal(await h.text(page, '[data-testid="consult-month-count"]'), '1');
      assert.ok(/45/.test(await h.text(page, '[data-testid="consult-month-minutes"]')));
      assert.ok(await page.$('[data-field="clientId,date,topic,minutes,summary"]'), '咨询记录行缺少场景字段');

      await page.click('[data-consult-tab="followups"]');
      await h.click(page, 'consult-add-followup');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'text', '发送会议纪要');
      await submitDrawer(page);
      st = await h.state(page);
      assert.equal(st.data.consult.followups.length, 1);
      assert.ok(await page.$('[data-followup-join]'), '待跟进缺少「加入今天」按钮');
      assert.ok(await page.$('[data-field="clientId,dueDate,text,done"]'), '待跟进行缺少场景字段');
    });

    await s.check('S3-4 首页三张工作卡片随模块数据变化（C1 部分）', async () => {
      await h.click(page, 'nav-home');
      const media = await h.text(page, '[data-testid="home-main-media"]');
      const dev = await h.text(page, '[data-testid="home-main-dev"]');
      const consult = await h.text(page, '[data-testid="home-main-consult"]');
      assert.ok(/^\d+$/.test(media), '自媒体卡片未显示数字：' + media);
      assert.equal(dev, '0', '开发项目清空后应为 0');
      assert.equal(consult, '1', '待跟进数应为 1');
    });

    await s.check('S3-5 「加入今天」生成快照，删除源条目后今日事项仍在（C4）', async () => {
      await h.click(page, 'nav-media');
      await page.select('[data-testid="media-filter"]', 'all');
      await h.click(page, 'primary-action');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'title', '快照验证选题');
      await submitDrawer(page);

      await h.click(page, 'nav-today');
      await h.click(page, 'today-join');
      await page.waitForSelector('[data-testid="drawer"]');
      const idx = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('#drawer-form [data-join]'));
        return els.findIndex(el => el.closest('label').textContent.includes('快照验证选题'));
      });
      assert.ok(idx >= 0, '加入今天抽屉缺少自媒体选题候选');
      const checks = await page.$$('#drawer-form [data-join]');
      await checks[idx].click();
      await h.click(page, 'drawer-submit');
      await page.waitForFunction(() => {
        return window.App.store.get().data.today.some(x => x.title === '快照验证选题' && x.source === 'media');
      }, { timeout: 10000 });

      await h.click(page, 'nav-media');
      const topicId = await page.evaluate(() => {
        const t = window.App.store.get().data.media.topics.find(x => x.title === '快照验证选题');
        return t ? t.id : null;
      });
      assert.ok(topicId);
      await page.click('[data-topic-del="' + topicId + '"]');
      await page.waitForFunction(id => !window.App.store.get().data.media.topics.some(x => x.id === id), { timeout: 10000 }, topicId);

      await h.click(page, 'nav-today');
      const st = await h.state(page);
      const kept = st.data.today.filter(x => x.title === '快照验证选题');
      assert.equal(kept.length, 1, '删除源条目后今日事项不应消失');
      assert.equal(kept[0].source, 'media', '来源标签丢失');
      assert.ok(await page.$('[data-today-row]'), '今日计划页未显示该事项');
    });

    h.assertNoErrors(errors);
    h.assertRemoteEmpty(remote);
    ok = s.finish();
  } catch (e) {
    console.log('  阶段 3 测试异常：' + (e && e.stack ? e.stack : e));
    ok = false;
  } finally {
    await h.shutdown(browser);
  }
  return ok;
}

if (require.main === module) main().then(ok => process.exit(ok ? 0 : 1));
module.exports = main;
