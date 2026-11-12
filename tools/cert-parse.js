// FR-P1-06 证书 / PEM 解析（本地 Agent）
import { agentCfg, pingAgent, callAgent, agentStatusHtml } from '../js/agent-client.js';
import { store } from '../js/store.js';

function escHtml(s) {
  return String(s == null ? '-' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export async function render(body, ctx) {
  const saved = store.agent();
  body.innerHTML = `
    <div id="cp-status">${agentStatusHtml(false)}</div>
    <div class="field radio-row">
      <label style="color:var(--muted)">Agent 地址 <input type="text" id="cp-url" class="txt" style="max-width:220px"></label>
      <label style="color:var(--muted)">Token <input type="text" id="cp-token" class="txt" style="max-width:220px"></label>
      <button class="btn" id="cp-save">保存并检测</button>
    </div>
    <div class="field">
      <label>PEM 证书（-----BEGIN CERTIFICATE----- ...）</label>
      <textarea id="cp-in" class="io" spellcheck="false" placeholder="粘贴 PEM 证书文本"></textarea>
    </div>
    <div class="field">
      <label>解析结果</label>
      <div id="cp-out"><div class="info-box">等待解析</div></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const urlEl = $('cp-url'), tokenEl = $('cp-token'), taIn = $('cp-in'), outEl = $('cp-out'), statusEl = $('cp-status');
  urlEl.value = saved.url; tokenEl.value = saved.token;

  async function ping() {
    store.setAgent({ url: urlEl.value.trim(), token: tokenEl.value.trim() });
    statusEl.innerHTML = agentStatusHtml(await pingAgent());
    return statusEl.innerHTML.includes('已连接');
  }
  $('cp-save').addEventListener('click', ping);

  function show(data) {
    const rows = [
      ['主体 (Subject)', data.subject],
      ['签发者 (Issuer)', data.issuer],
      ['序列号', data.serial],
      ['有效期起', data.validFromISO || data.validFrom],
      ['有效期止', data.validToISO || data.validTo],
      ['SAN 扩展', data.subjectAltName],
      ['SHA-1 指纹', data.fingerprint],
      ['SHA-256 指纹', data.fingerprint256]
    ];
    const expired = data.expired;
    outEl.innerHTML = `
      ${expired != null ? `<div class="${expired ? 'err-box' : 'ok-box'}">${expired ? '❌ 证书已过期' : '✅ 证书在有效期内'}</div>` : ''}
      <div class="diff-wrap"><table class="diff">${rows.map(([k, v]) =>
        `<tr><td style="width:150px;color:var(--muted)">${k}</td><td><code style="word-break:break-all">${escHtml(v)}</code></td></tr>`).join('')}</table></div>`;
  }

  async function run() {
    const pem = taIn.value.trim();
    if (!pem) { ctx.notify('请输入 PEM 证书'); return; }
    outEl.innerHTML = '<div class="info-box">解析中…</div>';
    try {
      const data = await callAgent('/cert', { pem });
      if (!data.ok) throw new Error(data.error || '解析失败');
      show(data);
    } catch (err) {
      outEl.innerHTML = `<div class="err-box">❌ ${escHtml(err.message)}</div>`;
    }
  }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; outEl.innerHTML = ''; },
    copy() { const c = outEl.querySelector('code'); ctx.copyText(c ? c.textContent : outEl.textContent); },
    example() { taIn.value = ctx.tool.examples[0] || ''; if (taIn.value) run(); },
    share() { return null; }
  };

  ping();
}
