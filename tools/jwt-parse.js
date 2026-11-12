// FR-P0-08 JWT 解析（仅解析，不验签）
import { parseJwt, fmtDate } from '../lib/jwtx.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="warn-box" style="margin-bottom:14px">⚠ 仅解析展示，<b>不验证签名</b>。不要粘贴敏感 Token 到不信任的环境。</div>
    <div class="field">
      <label>JWT Token（三段式，支持携带 Bearer 前缀）</label>
      <textarea id="jp-in" class="io" style="min-height:90px" spellcheck="false"></textarea>
    </div>
    <div class="field"><pre id="jp-out" class="out"></pre></div>
    <div id="jp-detail"></div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('jp-in'), out = $('jp-out'), detail = $('jp-detail');

  function run() {
    const token = taIn.value.trim();
    if (!token) { ctx.notify('请输入 JWT'); return; }
    detail.innerHTML = '';
    try {
      const r = parseJwt(token);
      out.className = 'out';
      out.textContent =
        `alg: ${r.header.alg || '?'}   typ: ${r.header.typ || '?'}\n` +
        `payload 有效期：${fmtDate(r.claims.iat)} ~ ${r.claims.exp ? fmtDate(r.claims.exp) : '（未设置 exp）'}\n` +
        `签名（未验证）：${r.signature.slice(0, 40)}${r.signature.length > 40 ? '…' : ''}`;
      if (r.expired) out.className = 'out err';

      const claimBadge = (k, d, extraClass) =>
        `<span class="jwt-claim ${extraClass || ''}">${k}: ${fmtDate(d)}</span>`;

      detail.innerHTML = `
        <div class="jwt-part">
          <h4>状态</h4>
          ${r.expired ? '<span class="badge sensitive">已过期</span>' : '<span class="badge exec-browser">未过期</span>'}
          ${r.notYet ? '<span class="badge sensitive">尚未生效（nbf）</span>' : ''}
        </div>
        <div class="jwt-part">
          <h4>时间声明</h4>
          ${claimBadge('iat', r.claims.iat)}
          ${claimBadge('exp', r.claims.exp, r.expired ? 'bad' : '')}
          ${claimBadge('nbf', r.claims.nbf)}
        </div>
        <div class="jwt-part">
          <h4>Header</h4>
          <pre class="out">${JSON.stringify(r.header, null, 2).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>
        </div>
        <div class="jwt-part">
          <h4>Payload</h4>
          <pre class="out">${JSON.stringify(r.payload, null, 2).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>
        </div>`;
    } catch (err) {
      out.className = 'out err';
      out.textContent = '❌ ' + err.message;
    }
  }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; out.textContent = ''; out.className = 'out'; detail.innerHTML = ''; },
    copy() { ctx.copyText(out.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return null; } // 敏感工具：不分享
  };

  if (ctx.params.token) { taIn.value = ctx.params.token; }
  taIn.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
}
