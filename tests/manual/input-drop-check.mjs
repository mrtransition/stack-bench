import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8321';
const BROWSER = [
  process.env.BROWSER_BIN,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => existsSync(p));
const PORT = 9755;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, '--window-size=1440,940',
  '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'sb-p1f-' + Date.now()),
  'about:blank'
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
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
await send('Page.navigate', { url: BASE + '/#/tool/json-format' });
await sleep(1300);

let failed = 0;
const check = (ok, label, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' · ' + detail : ''}`);
};

// 1) 粘贴即填（焦点不在输入框）
const pasteOk = await evaluate(`(() => {
  const dt = new DataTransfer();
  dt.setData('text/plain', '{"pasted":true}');
  document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  const ta = document.querySelector('#tool-body textarea.io');
  return ta ? ta.value : '(no textarea)';
})()`);
check(pasteOk.includes('"pasted":true'), '页面粘贴即填入输入框', JSON.stringify(pasteOk.slice(0, 40)));

// 2) 拖拽文件填入
const dropOk = await evaluate(`(async () => {
  const dt = new DataTransfer();
  dt.items.add(new File(['{"dropped":42}'], 'a.json', { type: 'application/json' }));
  const body = document.getElementById('tool-body');
  body.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
  body.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
  const active = body.classList.contains('drop-active');
  body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 400));
  const ta = document.querySelector('#tool-body textarea.io');
  return { active, value: ta ? ta.value : '', cleared: !body.classList.contains('drop-active') };
})()`);
check(dropOk.active === true, '拖入文件时出现放置提示');
check(String(dropOk.value).includes('"dropped":42'), '放下文件后内容填入输入框');
check(dropOk.cleared === true, '放置后提示消失');

// 3) 下载按钮
const dl = await evaluate(`(async () => {
  document.querySelector('#act-example').click();
  await new Promise(r => setTimeout(r, 600));
  let captured = null;
  HTMLAnchorElement.prototype.click = function () { captured = this.download; };
  const btn = document.querySelector('#tool-body .copy-acts:not(.is-empty) [data-act="download"]');
  if (!btn) return { error: 'no download button' };
  btn.click();
  await new Promise(r => setTimeout(r, 200));
  return { file: captured };
})()`);
check(!!dl.file && /\.json$/.test(dl.file), '下载按钮生成 .json 文件名', dl.file || dl.error || '');

// 4) 输出区「清空」联动动作条
const cleared = await evaluate(`(() => {
  const taBefore = document.querySelector('#tool-body textarea.io').value;
  document.querySelector('#tool-body .copy-acts:not(.is-empty) [data-act="clear"]').click();
  const taAfter = document.querySelector('#tool-body textarea.io').value;
  const status = document.querySelector('#act-status').textContent;
  return { hadInput: taBefore.length > 0, emptied: taAfter === '', status };
})()`);
check(cleared.hadInput && cleared.emptied, '输出区「清空」联动动作条清空输入', JSON.stringify(cleared));

ws.close();
browser.kill();
console.log(failed ? `\n存在失败用例：${failed}` : '\n全部通过');
process.exit(failed ? 1 : 0);
