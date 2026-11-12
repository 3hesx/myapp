'use strict';
const fs = require('fs');
const path = require('path');

const STAGES = [
  ['阶段 0 · 可打开的骨架', 'stage0.test.js'],
  ['阶段 1 · 数据层与安全网', 'stage1.test.js'],
  ['阶段 2 · 首页与今日计划', 'stage2.test.js'],
  ['阶段 3 · 工作三模块', 'stage3.test.js'],
  ['阶段 4 · 生活三模块', 'stage4.test.js'],
  ['阶段 5 · 收口与全量验收', 'stage5.test.js']
];

async function main() {
  console.log('\n########## 运行全部测试 ##########');
  const results = [];
  for (const [name, file] of STAGES) {
    const p = path.join(__dirname, file);
    if (!fs.existsSync(p)) {
      console.log('  跳过（文件不存在）：' + file);
      results.push({ name, ok: false, note: '测试文件不存在' });
      continue;
    }
    let ok = false;
    try {
      ok = await require(p)();
    } catch (e) {
      console.log('  测试运行异常 [' + name + ']：' + (e && e.stack ? e.stack : e));
      ok = false;
    }
    results.push({ name, ok });
  }
  console.log('\n########## 汇总 ##########');
  results.forEach(r => console.log('  ' + (r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.note ? ' — ' + r.note : '')));
  const failed = results.filter(r => !r.ok);
  console.log('  共 ' + results.length + ' 个阶段，' + (results.length - failed.length) + ' 个通过，' + failed.length + ' 个失败');
  if (failed.length) process.exit(1);
  console.log('全部测试通过。');
}

main().catch(e => { console.error(e); process.exit(1); });
