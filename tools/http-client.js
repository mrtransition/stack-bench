// FR-P0-12 HTTP 请求调试（通过 127.0.0.1 本地 Agent 执行）
import { store } from '../js/store.js';
import { notify } from '../js/toast.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function escHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export async function render(body, ctx) {
  const saved = store.agent();

  body.innerHTML = `
    <div class="field">
      <div class="info-box" id="hc-status">正在检测本地 Agent…</div>
    </div>
    <div class="field radio-row">
      <label style="color:var(--muted)">Agent 地址 <input type="text" id="hc-agent-url" class="txt" style="max-width:220px"></label>
      <label style="color:var(--muted)">Token <input type="text" id="hc-agent-token" class="txt" style="max-width:220px" placeholder="启动 Agent 时打印的随机 token"></label>
      <button class="btn" id="hc-save-agent">保存并检测</button>
    </div>
    <div class="field radio-row">
      <select id="hc-method">${METHODS.map(m => `<option${m === 'GET' ? ' selected' : ''}>${m}</option>`).join('')}</select>
      <input type="text" id="hc-url" class="txt" placeholder="https://api.example.com/path">
    </div>
    <div class="field">
      <label>Query 参数</label>
      <div id="hc-query"></div>
      <button class="btn" id="hc-add-query" style="font-size:12px">+ 添加参数</button>
    </div>
    <div class="field">
      <label>请求 Headers</label>
      <div id="hc-headers"></div>
      <button class="btn" id="hc-add-header" style="font-size:12px">+ 添加 Header</button>
    </div>
    <div class="field">
      <label>Body（POST/PUT/PATCH）</label>
      <textarea id="hc-body" class="io" style="min-height:90px" spellcheck="false"></textarea>
    </div>
    <div class="field radio-row">
      <label>超时(ms) <input type="number" id="hc-timeout" class="num" value="30000" min="100"></label>
      <label>重试次数 <input type="number" id="hc-retries" class="num" value="0" min="0" max="5"></label>
    </div>

    <div class="field">
      <label>响应</label>
      <div id="hc-resp" class="info-box">尚未发送请求</div>
    </div>
    <div class="field">
      <label>请求历史（仅本地保存 <button id="hc-clear-hist" class="link-btn" style="background:none;border:none;color:var(--muted);cursor:pointer">清空</button>）</label>
      <div id="hc-hist"></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const agentUrl = $('hc-agent-url'), agentToken = $('hc-agent-token'), statusBox = $('hc-status');
  agentUrl.value = saved.url; agentToken.value = saved.token;

  function kvRow(container, k = '', v = '') {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `<input type="text" placeholder="key" value="${escHtml(k)}"><input type="text" placeholder="value" value="${escHtml(v)}"><button class="del" type="button">×</button>`;
    row.querySelector('.del').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }
  kvRow($('hc-query'));
  kvRow($('hc-headers'), 'Content-Type', 'application/json');
  $('hc-add-query').addEventListener('click', () => kvRow($('hc-query')));
  $('hc-add-header').addEventListener('click', () => kvRow($('hc-headers')));

  function collectKv(container) {
    const obj = {};
    container.querySelectorAll('.kv-row').forEach(row => {
      const [k, v] = row.querySelectorAll('input');
      if (k.value.trim()) obj[k.value.trim()] = v.value;
    });
    return obj;
  }

  let agentOk = false;

  async function ping() {
    const url = agentUrl.value.trim().replace(/\/+$/, '');
    statusBox.textContent = '正在检测本地 Agent…';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const resp = await fetch(url + '/ping', { signal: ctrl.signal });
      clearTimeout(t);
      const data = await resp.json();
      if (data.ok) {
        agentOk = true;
        statusBox.innerHTML = '✅ 本地 Agent 已连接（' + escHtml(url) + '）';
        if (!agentToken.value.trim()) statusBox.innerHTML += '<br>⚠ 尚未填写 Token，请先填写再发送请求';
        return true;
      }
    } catch { /* 未启动 */ }
    agentOk = false;
    statusBox.className = 'info-box';
    statusBox.innerHTML =
      '❌ 本地 Agent 未连接。<br>Agent 用于发送需要密钥 / 内网环境的 HTTP 请求，<b>请求不会经过任何云端</b>。启动方式：<br>' +
      '<pre class="out" style="margin-top:8px">cd agent\nnode agent.js</pre>' +
      '启动后终端会打印随机 Token，粘贴到上方 Token 输入框并点击「保存并检测」。<br>' +
      'Agent 未启动时本工具不会发送任何数据，也不会自动降级为云端上传。';
    return false;
  }

  $('hc-save-agent').addEventListener('click', async () => {
    store.setAgent({ url: agentUrl.value.trim(), token: agentToken.value.trim() });
    await ping();
  });

  function renderHistory() {
    const hist = store.httpHistory();
    $('hc-hist').innerHTML = hist.length
      ? hist.map(h => `
        <div class="hist-item">
          <span class="m">${escHtml(h.method)}</span>
          <span style="flex:1;word-break:break-all">${escHtml(h.url)}</span>
          <span>${h.status || 'ERR'}</span>
          <span style="color:var(--muted)">${h.timeMs != null ? h.timeMs + 'ms' : ''}</span>
        </div>`).join('')
      : '<div class="empty-tip">暂无历史记录</div>';
  }
  $('hc-clear-hist').addEventListener('click', () => { store.clearHttpHistory(); renderHistory(); });

  async function send() {
    if (!agentOk) { await ping(); if (!agentOk) { ctx.notify('本地 Agent 未连接，请求未发送'); return; } }
    const urlInput = $('hc-url').value.trim();
    if (!urlInput) { ctx.notify('请输入请求 URL'); return; }

    // 组装 query
    let url = urlInput;
    const q = collectKv($('hc-query'));
    if (Object.keys(q).length) {
      url += (url.includes('?') ? '&' : '?') + Object.entries(q).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    }

    const method = $('hc-method').value;
    const headers = collectKv($('hc-headers'));
    const bodyText = $('hc-body').value;
    const timeoutMs = Number($('hc-timeout').value) || 30000;
    const retries = Number($('hc-retries').value) || 0;

    const respBox = $('hc-resp');
    respBox.className = 'info-box';
    respBox.textContent = '请求中…';

    const t0 = performance.now();
    try {
      const resp = await fetch(agentUrl.value.trim().replace(/\/+$/, '') + '/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agent-Token': agentToken.value.trim() },
        body: JSON.stringify({ method, url, headers, body: bodyText || null, timeoutMs, retries })
      });
      const data = await resp.json();
      const elapsed = Math.round(performance.now() - t0);

      if (!data.ok) throw new Error(data.error || 'Agent 返回错误');

      let bodyStr = '';
      try {
        const bin = Uint8Array.from(atob(data.bodyB64 || ''), c => c.charCodeAt(0));
        bodyStr = new TextDecoder('utf-8').decode(bin);
      } catch { bodyStr = '（二进制响应，无法按文本展示）'; }

      const stClass = data.status < 300 ? 'status-2xx' : data.status < 400 ? 'status-3xx' : 'status-4xx';
      const isJson = /json/i.test(data.contentType || '');
      if (isJson) {
        try { bodyStr = JSON.stringify(JSON.parse(bodyStr), null, 2); } catch { /* 保持原文 */ }
      }

      respBox.className = '';
      respBox.innerHTML = `
        <div class="resp-meta">
          <span class="status-pill ${stClass}">${data.status} ${escHtml(data.statusText || '')}</span>
          <span>总耗时 ${elapsed}ms（Agent 内 ${data.timeMs}ms）</span>
          <span>大小 ${data.size} 字节</span>
          <span>${escHtml(data.contentType || '')}</span>
        </div>
        <details open><summary>响应体</summary><pre class="out">${escHtml(bodyStr)}</pre></details>
        <details><summary>响应头</summary><table class="resp-h">${Object.entries(data.headers || {}).map(([k, v]) => `<tr><td><b>${escHtml(k)}</b></td><td>${escHtml(v)}</td></tr>`).join('')}</table></details>`;

      store.pushHttpHistory({ method, url, status: data.status, timeMs: data.timeMs });
      renderHistory();
    } catch (err) {
      respBox.className = 'err-box';
      respBox.textContent = '❌ 请求失败：' + err.message +
        (err.message.includes('Failed to fetch') ? '（Agent 不可达或 Token 校验失败）' : '');
      store.pushHttpHistory({ method, url, status: 'ERR' });
      renderHistory();
    }
  }

  ctx.handlers = {
    run: send,
    clear() {
      $('hc-url').value = ''; $('hc-body').value = '';
      $('hc-query').innerHTML = ''; $('hc-headers').innerHTML = '';
      kvRow($('hc-query')); kvRow($('hc-headers'));
      $('hc-resp').className = 'info-box'; $('hc-resp').textContent = '尚未发送请求';
    },
    copy() {
      const pre = $('hc-resp').querySelector('pre.out');
      ctx.copyText(pre ? pre.textContent : '');
    },
    example() { $('hc-url').value = ctx.tool.examples[0]; },
    share() { return null; } // 敏感工具：不分享
  };

  renderHistory();
  ping();
}
