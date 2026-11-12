'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const APP_URL = pathToFileURL(path.join(ROOT, 'worklife', 'index.html')).href;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const NODE_MODULES = 'C:/Users/陈子裕/.workbuddy/binaries/node/workspace/node_modules';

function loadPuppeteer() {
  try { return require('puppeteer-core'); } catch (e) { /* fall through */ }
  return require(path.join(NODE_MODULES, 'puppeteer-core'));
}

function tmpDir(prefix) {
  const d = path.join(os.tmpdir(), prefix + '-' + crypto.randomBytes(5).toString('hex'));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

async function launch(tag, reuseProfile) {
  const puppeteer = loadPuppeteer();
  const profilePath = reuseProfile || tmpDir('worklife-profile-' + tag);
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    userDataDir: profilePath,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking']
  });
  const downloadPath = tmpDir('worklife-downloads-' + tag);
  try {
    const client = await browser.target().createCDPSession();
    await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath, eventsEnabled: true });
  } catch (e) { /* 旧版本走 Page.setDownloadBehavior */ }
  return { browser, downloadPath, profilePath };
}

async function shutdown(browser) {
  let closed = false;
  try {
    await Promise.race([
      browser.close().then(() => { closed = true; }, () => { closed = true; }),
      new Promise(r => setTimeout(r, 3000))
    ]);
  } catch (e) { /* ignore */ }
  if (!closed) {
    try {
      const proc = browser.process && browser.process();
      if (proc && proc.kill) proc.kill();
    } catch (e) { /* ignore */ }
  }
}

async function openApp(browser, opts) {
  opts = opts || {};
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  const remote = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push('console.error: ' + m.text());
  });
  page.on('request', r => { if (/^https?:/i.test(r.url())) remote.push(r.url()); });
  try {
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: opts.downloadPath || os.tmpdir() });
  } catch (e) { /* 新版本已由 Browser 级设置 */ }
  await page.goto(APP_URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('html[data-app-ready="1"]', { timeout: 15000 });
  if (opts.clear) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('html[data-app-ready="1"]', { timeout: 15000 });
  }
  return { page, errors, remote };
}

function makeSuite(name) {
  const results = [];
  return {
    async check(label, fn) {
      try {
        await fn();
        results.push({ label, ok: true });
        console.log('  PASS  ' + label);
      } catch (e) {
        results.push({ label, ok: false, err: e && e.message ? e.message : String(e) });
        console.log('  FAIL  ' + label + '\n        ' + (e && e.message ? e.message : e));
      }
    },
    finish() {
      const failed = results.filter(r => !r.ok);
      console.log('\n[' + name + '] ' + (results.length - failed.length) + '/' + results.length + ' 通过');
      return failed.length === 0;
    }
  };
}

async function click(page, testid) {
  const sel = '[data-testid="' + testid + '"]';
  const el = await page.$(sel);
  if (!el) throw new Error('找不到元素 ' + sel);
  await el.click();
}

async function fill(page, sel, value) {
  const el = await page.$(sel);
  if (!el) throw new Error('找不到输入框 ' + sel);
  await el.click();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  if (String(value) === '') await page.keyboard.press('Backspace');
  else await page.keyboard.type(String(value));
}

async function text(page, sel) {
  const el = await page.$(sel);
  if (!el) throw new Error('找不到元素 ' + sel);
  return page.evaluate(e => (e.textContent || '').trim(), el);
}

async function count(page, sel) {
  return page.$$eval(sel, els => els.length);
}

async function state(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('worklife:v1')));
}

async function waitForFile(dir, ext, timeoutMs) {
  const end = Date.now() + (timeoutMs || 10000);
  while (Date.now() < end) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith(ext) && !f.endsWith('.crdownload'));
    if (files.length) return path.join(dir, files[0]);
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('等待下载文件超时：' + dir);
}

function assertRemoteEmpty(remote) {
  if (remote.length) throw new Error('检测到远程请求：' + remote.join(', '));
}

function assertNoErrors(errors) {
  if (errors.length) throw new Error('页面错误：\n' + errors.join('\n'));
}

module.exports = {
  ROOT, APP_URL, EDGE, launch, openApp, shutdown, makeSuite,
  click, fill, text, count, state, waitForFile,
  assertRemoteEmpty, assertNoErrors
};
