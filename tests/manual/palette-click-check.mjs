#!/usr/bin/env node
/**
 * 命令面板交互自测（真实浏览器 + CDP）
 *
 * 覆盖：
 *  1. 鼠标悬停后点击结果 → 直接跳转（回归用例：悬停重渲染导致 click 丢失）
 *  2. 输入关键词后点击第 N 项 → 跳到该项对应工具
 *  3. 键盘 ↓↓ + Enter → 跳到高亮项
 *  4. 点击遮罩空白处 → 关闭面板且不跳转
 *
 * 用法：BASE_URL=http://127.0.0.1:8321 node tests/manual/palette-click-check.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8321';
const CANDIDATES = [
  process.env.BROWSER_BIN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);
const BROWSER = CANDIDATES.find(p => existsSync(p));
if (!BROWSER) {
  console.error('未找到浏览器，可用 BROWSER_BIN 指定路径');
  process.exit(1);
}

const PORT = 9700 + Math.floor(Math.random() * 200);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--window-size=1280,900',
  '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'sb-palette-' + Date.now()),
  'about:blank'
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* 未就绪 */ }
    await sleep(250);
  }
  throw new Error('CDP 未就绪');
}

const ws = new WebSocket(await wsUrl());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pending = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise(res => {
  const id = ++seq;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
  return r.result.result.value;
};

await send('Page.enable');
await send('Runtime.enable');

let failed = 0;
function check(ok, label, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' · ' + detail : ''}`);
}

/** 回到首页并打开面板 */
async function reset(query = '') {
  await send('Page.navigate', { url: BASE_URL + '/#/' });
  await sleep(700);
  await evaluate(`document.getElementById('open-search').click()`);
  await sleep(300);
  if (query) {
    await evaluate(`(() => {
      const i = document.getElementById('palette-input');
      i.value = ${JSON.stringify(query)};
      i.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(200);
  }
}

/** 取第 n 个可见结果的中心点与名称 */
async function itemAt(n) {
  return evaluate(`(() => {
    const li = document.querySelectorAll('#palette-results li.p-item')[${n}];
    if (!li) return null;
    const r = li.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), name: li.querySelector('.t-name').textContent };
  })()`);
}

/** 真实鼠标：移动 → 按下 → 抬起 */
async function mouseClick(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await sleep(120);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(500);
}

const state = () => evaluate(`({
  hash: location.hash,
  closed: document.getElementById('palette').classList.contains('hidden'),
  title: (document.querySelector('.tool-head h1') || {}).textContent || '',
  listHidden: document.getElementById('palette-results').classList.contains('hidden')
})`);

// 1) 悬停 → 点击第一条（正是过去失效的路径）
await reset();
const first = await itemAt(0);
await mouseClick(first.x, first.y);
let s = await state();
check(s.hash.startsWith('#/tool/') && s.closed, '悬停后点击首项直接跳转', `${first.name} → ${s.hash || '未跳转'}`);
check(s.title.includes(first.name.slice(0, 4)), '落地页标题与点击项一致', s.title);

// 2) 搜索后点击第三项
await reset('http');
const third = await itemAt(2);
if (!third) {
  check(false, '搜索 http 至少返回 3 项');
} else {
  await mouseClick(third.x, third.y);
  s = await state();
  check(s.hash.startsWith('#/tool/') && s.closed, '搜索结果第 3 项可点击跳转', `${third.name} → ${s.hash || '未跳转'}`);
  check(s.title.includes(third.name.slice(0, 4)), '落地页标题与点击项一致', s.title);
}

// 3) 键盘 ↓↓ + Enter
await reset();
const expectKey = await itemAt(2);
await evaluate(`(() => {
  const fire = key => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  fire('ArrowDown'); fire('ArrowDown'); fire('Enter');
})()`);
await sleep(500);
s = await state();
check(s.hash.startsWith('#/tool/') && s.closed, '键盘 ↓↓ + Enter 跳转', `${expectKey ? expectKey.name : '?'} → ${s.hash || '未跳转'}`);
if (expectKey) check(s.title.includes(expectKey.name.slice(0, 4)), '键盘落地页与高亮项一致', s.title);

// 4) 点击遮罩空白处只关闭、不跳转
await reset();
const before = (await state()).hash;
await mouseClick(6, 6);
s = await state();
check(s.closed && s.hash === before, '点击遮罩关闭且不跳转', `hash=${s.hash || '(空)'}`);

ws.close();
browser.kill();
console.log(`\n${failed ? '存在失败用例：' + failed : '全部通过'}`);
process.exit(failed ? 1 : 0);
