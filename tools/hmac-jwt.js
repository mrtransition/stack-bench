// FR-P1-07 HMAC / JWT 签名验签（本地 Agent）
import { pingAgent, callAgent, agentStatusHtml } from '../js/agent-client.js';
import { store } from '../js/store.js';

function escHtml(s) {
  return String(s == null ? '-' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export async function render(body, ctx) {
  const saved = store.agent();
  body.innerHTML = `
    <div class="warn-box" style="margin-bottom:12px">⚠ 密钥仅发送到本机 127.0.0.1 的 Agent 用于计算，不上传云端、不写入 URL。</div>
    <div id="hj-status">${agentStatusHtml(false)}</div>
    <div class="field radio-row">
      <label style="color:var(--muted)">Agent 地址 <input type="text" id="hj-url" class="txt" style="max-width:220px"></label>
      <label style="color:var(--muted)">Token <input type="text" id="hj-token" class="txt" style="max-width:220px"></label>
      <button class="btn" id="hj-save">保存并检测</button>
    </div>
    <div class="field radio-row">
      <span class="seg" id="hj-mode">
        <button data-v="hmac" class="on">HMAC 签名</button>
        <button data-v="jwt">JWT 验签</button>
      </span>
    </div>
    <div id="hj-panel"></div>`;

  const $ = id => body.querySelector('#' + id);
  const urlEl = $('hj-url'), tokenEl = $('hj-token'), statusEl = $('hj-status'), panel = $('hj-panel');
  urlEl.value = saved.url; tokenEl.value = saved.token;
  let mode = 'hmac';

  async function ping() {
    store.setAgent({ url: urlEl.value.trim(), token: tokenEl.value.trim() });
    statusEl.innerHTML = agentStatusHtml(await pingAgent());
    return statusEl.innerHTML.includes('已连接');
  }
  $('hj-save').addEventListener('click', ping);

  function renderPanel() {
    if (mode === 'hmac') {
      panel.innerHTML = `
        <div class="field radio-row">
          <span style="color:var(--muted)">算法：</span>
          <select id="hj-algo"><option>sha256</option><option>sha1</option><option>sha512</option><option>md5</option></select>
          <input type="text" id="hj-key" class="txt" placeholder="密钥（Secret）" style="max-width:260px">
        </div>
        <div class="field"><label>待签名文本</label><textarea id="hj-text" class="io" style="min-height:80px" spellcheck="false"></textarea></div>
        <div class="field"><label>签名结果</label><pre id="hj-out" class="out"></pre></div>`;
    } else {
      panel.innerHTML = `
        <div class="field">
          <label>JWT Token</label>
          <textarea id="hj-token-in" class="io" style="min-height:80px" spellcheck="false"></textarea>
        </div>
        <div class="field radio-row">
          <span style="color:var(--muted)">密钥类型：</span>
          <select id="hj-keytype"><option value="hs">HMAC 对称密钥（HS256/384/512）</option><option value="pub">公钥 PEM（RS*/ES*/PS*）</option></select>
        </div>
        <div class="field"><label>密钥</label><textarea id="hj-key2" class="io" style="min-height:70px" spellcheck="false" placeholder="对称密钥文本 或 PEM 公钥"></textarea></div>
        <div class="field"><label>验签结果</label><pre id="hj-out" class="out"></pre></div>`;
    }
  }

  $('hj-mode').addEventListener('click', async e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $('hj-mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    mode = btn.dataset.v;
    renderPanel();
  });

  function setOut(ok, text) {
    const out = panel.querySelector('#hj-out');
    out.className = ok ? 'out ok' : 'out err';
    out.textContent = text;
  }

  async function run() {
    if (!(await ping())) { ctx.notify('本地 Agent 未连接'); return; }
    const out = panel.querySelector('#hj-out');
    try {
      if (mode === 'hmac') {
        const key = panel.querySelector('#hj-key').value;
        const text = panel.querySelector('#hj-text').value;
        const algo = panel.querySelector('#hj-algo').value;
        if (!key) { ctx.notify('请输入密钥'); return; }
        if (!text.trim()) { ctx.notify('请输入待签名文本'); return; }
        out.textContent = '计算中…';
        const r = await callAgent('/hmac', { algo, key, text });
        setOut(true, `${r.algo.toUpperCase()}  ${r.signature}`);
      } else {
        const token = panel.querySelector('#hj-token-in').value.trim();
        const key = panel.querySelector('#hj-key2').value.trim();
        const keyType = panel.querySelector('#hj-keytype').value;
        if (!token) { ctx.notify('请输入 JWT'); return; }
        if (!key) { ctx.notify('请输入密钥/公钥'); return; }
        out.textContent = '验签中…';
        const r = await callAgent('/jwt-verify', { token, key });
        const lines = [
          `算法：${r.alg}`,
          `验签：${r.valid ? '✅ 通过' : '❌ 失败'}${r.reason ? '（' + r.reason + '）' : ''}`
        ];
        if (r.expired != null) lines.push(`状态：${r.expired ? '⚠ Token 已过期' : '未过期'}`);
        setOut(r.valid, lines.join('\n'));
      }
    } catch (err) {
      setOut(false, '❌ ' + err.message);
    }
  }

  ctx.handlers = {
    run,
    clear() { renderPanel(); },
    copy() { const o = panel.querySelector('#hj-out'); ctx.copyText(o ? o.textContent : ''); },
    example() {
      if (mode === 'hmac') {
        panel.querySelector('#hj-key').value = 'my-secret';
        panel.querySelector('#hj-text').value = 'hello world';
        run();
      } else {
        ctx.notify('请粘贴您自己的 JWT 与密钥（示例不含有效签名）');
      }
    },
    share() { return null; }
  };

  renderPanel();
  ping();
}
