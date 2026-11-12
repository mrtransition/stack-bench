#!/usr/bin/env node
/**
 * 复制按钮自测（真实浏览器 + CDP）：验证每个工具输出区的「复制」按钮能取到正确内容。
 *
 * 做法：注入 navigator.clipboard stub 捕获写入文本，点击按钮后读回，断言非空且符合预期形状。
 * 用法：BASE_URL=http://127.0.0.1:8321 node tests/manual/copy-affix-check.mjs
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
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'sb-copycheck-' + Date.now()),
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

// 覆盖 navigator.clipboard，捕获复制内容
const STUB = `
Object.defineProperty(Navigator.prototype, 'clipboard', {
  configurable: true,
  get() { return { writeText: async t => { window.__copied = t; } }; }
});
window.__copied = null;
`;

const TOOLS = [
  ['json-format', /"a"|: 1|\{/],
  ['log-parser', /INFO|ERROR|WARN/],
  ['text-diff', /相同|删除|新增|line/],
  ['net-tools', /\/|\d+\.\d+\.\d+\.\d+/],
  ['cert-parse', /BEGIN CERTIFICATE|未配置 Agent Token|CN=/]
];

let failed = 0;
for (const [id, pattern] of TOOLS) {
  await send('Page.navigate', { url: `${BASE_URL}/#/tool/${id}` });
  await sleep(900);
  await evaluate(STUB);

  const clicked = await evaluate(`(() => {
    const ex = document.querySelector('#act-example');
    if (!ex) return 'no-example-button';
    ex.click();
    return 'ok';
  })()`);

  // 等输出出现
  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(`!!document.querySelector('#tool-body .copy-chip:not(.is-empty)')`);
    if (ready) break;
    await sleep(150);
  }

  const result = await evaluate(`(async () => {
    const chip = document.querySelector('#tool-body .copy-chip:not(.is-empty)');
    if (!chip) return { error: '没有可见的复制按钮' };
    chip.click();
    await new Promise(r => setTimeout(r, 250));
    return { text: window.__copied || '', label: chip.textContent.trim() };
  })()`);

  const text = (result && result.text) || '';
  const ok = !!text && (!pattern || pattern.test(text));
  if (!ok) failed++;
  console.log(
    `${ok ? '✅' : '❌'} ${id.padEnd(14)} 按钮「${(result && result.label) || '?'}」 ` +
    `长度 ${text.length} · ${JSON.stringify(text.slice(0, 60))}`
  );
  if (clicked !== 'ok') console.log('   ⚠ 加载示例按钮缺失：' + clicked);
}

ws.close();
browser.kill();
console.log(`\n${TOOLS.length - failed}/${TOOLS.length} 通过`);
process.exit(failed ? 1 : 0);
