#!/usr/bin/env node
/**
 * 示例自测：用真实浏览器逐一点击每个工具的「加载示例」，检查是否报错。
 *
 * 前置：本地已启动静态服务（默认 http://127.0.0.1:8321）
 * 用法：node tests/manual/examples-selftest.mjs
 *      BROWSER_BIN="C:/path/to/chrome.exe" BASE_URL=http://127.0.0.1:8080 node tests/manual/examples-selftest.mjs
 *
 * 说明：Agent 类工具在 Agent 未启动时会被标记为 ⚠（预期行为），不计入失败；
 *       无示例数据的工具（如图片转 Base64）标记为 ℹ。
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
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
].filter(Boolean);
const BROWSER = CANDIDATES.find(p => existsSync(p));
if (!BROWSER) {
  console.error('未找到浏览器，可用 BROWSER_BIN 指定路径');
  process.exit(1);
}

const PORT = 9333 + Math.floor(Math.random() * 300);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'sb-selftest-' + Date.now()),
  'about:blank'
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* 未就绪 */ }
    await sleep(250);
  }
  throw new Error('CDP 未就绪：浏览器未能启动');
}

let ws;
try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
} catch (err) {
  browser.kill();
  console.error('❌ ' + err.message);
  process.exit(1);
}

let seq = 0;
const pending = new Map();
ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise(res => {
  const id = ++seq;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: BASE_URL + '/tests/manual/examples-selftest.html' });
await sleep(1800);

// 若提供 AGENT_TOKEN，则把 Agent 配置注入 localStorage，让 Agent 类工具也能真实执行
if (process.env.AGENT_TOKEN) {
  const cfg = { url: process.env.AGENT_URL || 'http://127.0.0.1:7420', token: process.env.AGENT_TOKEN };
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('wb.agent', ${JSON.stringify(JSON.stringify(cfg))})`
  });
}

const r = await send('Runtime.evaluate', { expression: 'window.__runAll()', awaitPromise: true, returnByValue: true, timeout: 240000 });
ws.close();
browser.kill();

if (r.result && r.result.exceptionDetails) {
  console.error('❌ 自测脚本异常：', JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  process.exit(1);
}

const rows = r.result.result.value || [];
let failed = 0, agentSkipped = 0, noExample = 0;
for (const row of rows) {
  const agentTool = row.executor === 'agent' || row.executor === 'hybrid';
  let mark;
  if (row.ok) mark = '✅';
  else if (agentTool) { mark = '⚠ '; agentSkipped++; }
  else if (!row.hasExamples) { mark = 'ℹ '; noExample++; }
  else { mark = '❌'; failed++; }
  const detail = row.ok ? '' : (row.err || row.js.join(' | ') || row.status || '无输出');
  console.log(`${mark} ${row.id.padEnd(18)} ${detail}`);
}

console.log(`\n合计 ${rows.length} 个工具：失败 ${failed}，Agent 未启动而跳过 ${agentSkipped}，无示例 ${noExample}`);
process.exit(failed ? 1 : 0);
