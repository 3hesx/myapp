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
async function blur(page) {
  await page.keyboard.press('Tab');
}

async function main() {
  console.log('\n=== 阶段 4 · 生活三模块（D4 / D5 / D6 / C1 全量 / 加入今天候选）===');
  const { browser, downloadPath } = await h.launch('stage4');
  let ok = false;
  try {
    const { page, errors, remote } = await h.openApp(browser, { clear: true, downloadPath });
    const s = h.makeSuite('阶段 4');

    const todayKey = await page.evaluate(() => {
      const p = App.todayStr().split('-').map(Number);
      const wd = new Date(p[0], p[1] - 1, p[2]).getDay();
      return wd === 0 ? 7 : wd;
    });

    await s.check('S4-1 健身：编辑周计划 → 动作库 → 一组训练 → 两次体重与趋势线（D4）', async () => {
      await h.click(page, 'nav-fitness');
      await h.fill(page, '[data-week-day="' + todayKey + '"]', '练胸 · 卧推');
      await blur(page);
      await page.waitForFunction(k => String(App.store.get().data.fitness.weekPlan[k] || '').includes('卧推'), { timeout: 10000 }, todayKey);

      await page.click('[data-fitness-tab="workouts"]');
      await h.fill(page, '[data-testid="exercise-name"]', '卧推');
      await h.fill(page, '[data-testid="exercise-part"]', '胸');
      await h.click(page, 'exercise-add');
      await page.waitForFunction(() => App.store.get().data.fitness.exercises.length === 1, { timeout: 10000 });

      await h.click(page, 'fitness-add-workout');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'sets', '4');
      await drawerFill(page, 'reps', '8');
      await drawerFill(page, 'weight', '60');
      await submitDrawer(page);
      let st = await h.state(page);
      assert.equal(st.data.fitness.workouts.length, 1, '训练记录未保存');
      assert.equal(st.data.fitness.workouts[0].sets, 4);
      assert.equal(st.data.fitness.workouts[0].reps, 8);
      assert.equal(st.data.fitness.workouts[0].weight, 60);
      assert.ok(await page.$('[data-field="date,exerciseId,sets,reps,weight"]'), '训练记录行缺少场景字段');
      assert.equal(await h.text(page, '[data-testid="fitness-planned"]'), '1 天', '本周计划天数统计错误');

      await page.click('[data-fitness-tab="body"]');
      await h.click(page, 'fitness-add-body');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'weight', '70');
      await submitDrawer(page);
      await page.waitForFunction(() => App.store.get().data.fitness.body.length === 1, { timeout: 10000 });
      const first = await page.$eval('[data-testid="body-trend"]', el => ({
        count: el.getAttribute('data-count'),
        points: el.querySelector('polyline') ? el.querySelector('polyline').getAttribute('points') : ''
      }));
      assert.equal(first.count, '1', '记录一次体重后趋势线未出现');

      await h.click(page, 'fitness-add-body');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'weight', '69.2');
      await submitDrawer(page);
      await page.waitForFunction(() => App.store.get().data.fitness.body.length === 2, { timeout: 10000 });
      const second = await page.$eval('[data-testid="body-trend"]', el => ({
        count: el.getAttribute('data-count'),
        points: el.querySelector('polyline') ? el.querySelector('polyline').getAttribute('points') : ''
      }));
      assert.equal(second.count, '2', '第二次体重未进入趋势');
      assert.notEqual(second.points, first.points, '趋势线没有随体重变化');
      assert.ok(await page.$('[data-field="date,weight,fat"]'), '身体数据行缺少场景字段');

      await h.click(page, 'nav-home');
      assert.equal(await h.text(page, '[data-testid="home-main-fitness"]'), '练胸 · 卧推', '首页今日应练未读取周计划（C1）');
    });

    await s.check('S4-2 饮食：四餐各一条 → 饮水 +1 → 小结 → 常用食物 → 刷新 → 历史只读（D5）', async () => {
      await h.click(page, 'nav-diet');
      const foods = [
        ['breakfast', '燕麦', '一碗'],
        ['lunch', '鸡胸肉', '150g'],
        ['dinner', '青菜', '一盘'],
        ['snack', '苹果', '一个']
      ];
      for (const [meal, name, amount] of foods) {
        await h.fill(page, '[data-testid="diet-name-' + meal + '"]', name);
        await h.fill(page, '[data-testid="diet-amount-' + meal + '"]', amount);
        await h.click(page, 'diet-add-' + meal);
      }
      let st = await h.state(page);
      const today = await page.evaluate(() => App.todayStr());
      const d = st.data.diet.days[today];
      assert.ok(d, '今日饮食记录未创建');
      for (const [meal, name] of foods) {
        assert.equal(d[meal].length, 1, meal + ' 餐次条数不对');
        assert.equal(d[meal][0].name, name);
      }
      assert.equal(await h.text(page, '[data-testid="diet-meal-count"]'), '4 / 4');
      assert.ok(await page.$('[data-field="name,amount"]'), '餐次区块缺少场景字段');

      await h.click(page, 'diet-water-plus');
      await h.click(page, 'diet-water-plus');
      assert.equal(await h.text(page, '[data-testid="diet-water"]'), '2', '饮水杯数不对');
      st = await h.state(page);
      assert.equal(st.data.diet.days[today].water, 2);

      await h.fill(page, '[data-testid="diet-note"]', '外食偏油');
      await blur(page);
      await page.waitForFunction(t => (App.store.get().data.diet.days[t] || {}).note === '外食偏油', { timeout: 10000 }, today);

      await h.fill(page, '[data-testid="diet-common-input"]', '鸡蛋');
      await h.click(page, 'diet-common-add');
      await page.waitForFunction(() => App.store.get().data.diet.commonFoods.length === 1, { timeout: 10000 });
      await page.select('[data-testid="diet-target-meal"]', 'lunch');
      await page.click('[data-common-use]');
      await page.waitForFunction(t => (App.store.get().data.diet.days[t] || {}).lunch.length === 2, { timeout: 10000 }, today);

      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('html[data-app-ready="1"]');
      await h.click(page, 'nav-diet');
      st = await h.state(page);
      assert.equal(st.data.diet.days[today].lunch.length, 2, '刷新后常用食物加入的记录丢失');
      assert.equal(st.data.diet.days[today].water, 2, '刷新后饮水丢失');
      assert.equal(st.data.diet.days[today].note, '外食偏油', '刷新后小结丢失');

      const before = JSON.stringify((await h.state(page)).data.diet);
      await h.click(page, 'diet-prev');
      await page.waitForSelector('[data-testid="diet-readonly"]', { timeout: 10000 });
      assert.equal(await page.$('[data-testid="diet-add-breakfast"]'), null, '历史日期仍可新增食物');
      assert.equal(await page.$('[data-testid="diet-water-plus"]'), null, '历史日期仍可改饮水');
      assert.equal(JSON.stringify((await h.state(page)).data.diet), before, '只读状态下饮食数据被改动');
      await h.click(page, 'diet-today');
    });

    await s.check('S4-3 游戏：新增 → 行内改状态 → 记时长 → 编辑评分短评 → 状态筛选（D6）', async () => {
      await h.click(page, 'nav-games');
      await h.click(page, 'primary-action');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'name', '塞尔达');
      await drawerFill(page, 'platform', 'Switch');
      await drawerFill(page, 'score', '5');
      await drawerFill(page, 'review', '好玩');
      await submitDrawer(page);
      let st = await h.state(page);
      assert.equal(st.data.games.list.length, 1);
      assert.equal(st.data.games.list[0].score, 5);
      assert.ok(await page.$('[data-field="name,platform,status,score,review"]'), '游戏行缺少场景字段');

      await page.select('[data-game-status]', 'playing');
      await page.waitForFunction(() => App.store.get().data.games.list[0].status === 'playing', { timeout: 10000 });
      assert.equal(await h.text(page, '[data-testid="games-playing"]'), '1 款', '在玩数量未更新');

      await page.click('[data-games-tab="sessions"]');
      await h.click(page, 'games-add-session');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'minutes', '90');
      await submitDrawer(page);
      st = await h.state(page);
      assert.equal(st.data.games.sessions.length, 1);
      assert.equal(st.data.games.sessions[0].minutes, 90);
      assert.ok(/90/.test(await h.text(page, '[data-testid="games-week-minutes"]')), '本周时长未更新');
      assert.ok(await page.$('[data-field="gameId,date,minutes,note"]'), '时长记录行缺少场景字段');

      await page.click('[data-games-tab="list"]');
      await page.click('[data-game-edit]');
      await page.waitForSelector('[data-testid="drawer"]');
      await drawerFill(page, 'score', '4');
      await drawerFill(page, 'review', '通关了，值得再玩');
      await submitDrawer(page);
      st = await h.state(page);
      assert.equal(st.data.games.list[0].score, 4, '评分未更新');
      assert.equal(st.data.games.list[0].review, '通关了，值得再玩', '短评未更新');
      assert.ok(/通关了/.test(await page.$eval('#content', el => el.textContent)));

      await page.select('[data-testid="games-filter"]', 'playing');
      await page.waitForFunction(() => document.querySelectorAll('[data-game-status]').length === 1, { timeout: 10000 });
      await page.select('[data-testid="games-filter"]', 'all');
    });

    await s.check('S4-4 健身与游戏的「加入今天」候选出现在抽屉（联动）', async () => {
      await h.click(page, 'nav-today');
      await h.click(page, 'today-join');
      await page.waitForSelector('[data-testid="drawer"]', { timeout: 10000 });
      const txt = await page.$eval('#drawer-form', el => el.textContent);
      assert.ok(/练胸/.test(txt), '缺少健身周计划候选');
      assert.ok(/继续玩《塞尔达》/.test(txt), '缺少在玩游戏候选');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-testid="drawer"]'), { timeout: 10000 });
    });

    await s.check('S4-5 首页六张卡片全量随数据变化，删除后数字回落（C1 全量）', async () => {
      await h.click(page, 'nav-home');
      const keys = ['media', 'dev', 'consult', 'fitness', 'diet', 'games'];
      const before = {};
      for (const k of keys) {
        assert.ok(await page.$('[data-testid="home-main-' + k + '"]'), '首页缺少卡片指标 ' + k);
        before[k] = await h.text(page, '[data-testid="home-main-' + k + '"]');
      }
      for (const k of ['media', 'dev', 'consult', 'games']) {
        assert.ok(/^\d+$/.test(before[k]), k + ' 卡片主指标不是数字：' + before[k]);
      }
      assert.equal(before.fitness, '练胸 · 卧推', '健身卡片未反映周计划');
      assert.ok(/^\d+ \/ 4$/.test(before.diet), '饮食卡片餐次格式不对：' + before.diet);
      assert.equal(before.games, '1', '游戏在玩数量不对');

      await h.click(page, 'nav-games');
      await page.click('[data-game-del]');
      await page.waitForFunction(() => App.store.get().data.games.list.length === 0, { timeout: 10000 });
      await h.click(page, 'nav-home');
      assert.equal(await h.text(page, '[data-testid="home-main-games"]'), '0', '删除游戏后卡片未回落');

      await h.click(page, 'nav-diet');
      await page.click('[data-food-del]');
      await page.waitForFunction(t => {
        const d = App.store.get().data.diet.days[t];
        return d && d.breakfast.length === 0;
      }, { timeout: 10000 }, await page.evaluate(() => App.todayStr()));
      await h.click(page, 'nav-home');
      assert.equal(await h.text(page, '[data-testid="home-main-diet"]'), '3 / 4', '删除食物后餐次未回落');

      await h.click(page, 'nav-fitness');
      await h.fill(page, '[data-week-day="' + todayKey + '"]', '');
      await blur(page);
      await page.waitForFunction(k => !String(App.store.get().data.fitness.weekPlan[k] || '').trim(), { timeout: 10000 }, todayKey);
      await h.click(page, 'nav-home');
      assert.equal(await h.text(page, '[data-testid="home-main-fitness"]'), '休息', '清空周计划后卡片未回落');
    });

    h.assertNoErrors(errors);
    h.assertRemoteEmpty(remote);
    ok = s.finish();
  } catch (e) {
    console.log('  阶段 4 测试异常：' + (e && e.stack ? e.stack : e));
    ok = false;
  } finally {
    await h.shutdown(browser);
  }
  return ok;
}

if (require.main === module) main().then(ok => process.exit(ok ? 0 : 1));
module.exports = main;
