// FR-P1-08 Docker / K8s YAML 校验（本地 Agent）
import { pingAgent, callAgent, agentStatusHtml } from '../js/agent-client.js';
import { store } from '../js/store.js';

function escHtml(s) {
  return String(s == null ? '-' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export async function render(body, ctx) {
  const saved = store.agent();
  body.innerHTML = `
    <div id="ky-status">${agentStatusHtml(false)}</div>
    <div class="field radio-row">
      <label style="color:var(--muted)">Agent 地址 <input type="text" id="ky-url" class="txt" style="max-width:220px"></label>
      <label style="color:var(--muted)">Token <input type="text" id="ky-token" class="txt" style="max-width:220px"></label>
      <button class="btn" id="ky-save">保存并检测</button>
    </div>
    <div class="field radio-row">
      <span style="color:var(--muted)">类型：</span>
      <span class="seg" id="ky-kind">
        <button data-v="k8s" class="on">Kubernetes</button>
        <button data-v="docker">docker-compose</button>
      </span>
    </div>
    <div class="field">
      <label>YAML 文本（支持 --- 多文档）</label>
      <textarea id="ky-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field">
      <label>校验结果</label>
      <div id="ky-out"><div class="info-box">等待校验</div></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const urlEl = $('ky-url'), tokenEl = $('ky-token'), statusEl = $('ky-status'), taIn = $('ky-in'), outEl = $('ky-out');
  urlEl.value = saved.url; tokenEl.value = saved.token;
  let kind = 'k8s';

  $('ky-save').addEventListener('click', async () => {
    store.setAgent({ url: urlEl.value.trim(), token: tokenEl.value.trim() });
    statusEl.innerHTML = agentStatusHtml(await pingAgent());
  });

  $('ky-kind').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $('ky-kind').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    kind = btn.dataset.v;
  });

  async function run() {
    const text = taIn.value.trim();
    if (!text) { ctx.notify('请输入 YAML 文本'); return; }
    outEl.innerHTML = '<div class="info-box">校验中…</div>';
    try {
      const r = await callAgent('/yaml-check', { text, kind });
      let html = '';
      if (!r.syntaxOk) {
        html = `<div class="err-box">❌ YAML 语法错误：${escHtml(r.syntaxError)}</div>`;
      } else {
        html = `<div class="${r.warnings.length ? 'warn-box' : 'ok-box'}">✅ YAML 语法正确（${r.docCount} 个文档）` +
          r.warnings.map(w => `<br>⚠ ${escHtml(w)}`).join('') +
          (r.warnings.length ? '' : '<br>未发现常见字段问题') + '</div>';
        if (r.docs) {
          const rows = r.docs.map(d => `<tr><td>${escHtml(d.kind)}</td><td>${escHtml(d.name)}</td><td>${escHtml(d.apiVersion)}</td></tr>`).join('');
          html += `<div class="diff-wrap" style="margin-top:10px"><table class="diff"><tr><th>Kind</th><th>Name</th><th>apiVersion</th></tr>${rows}</table></div>`;
        }
      }
      outEl.innerHTML = html;
    } catch (err) {
      outEl.innerHTML = `<div class="err-box">❌ ${escHtml(err.message)}</div>`;
    }
  }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; outEl.innerHTML = ''; },
    copy() { ctx.copyText(outEl.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { text: taIn.value, kind }; }
  };

  if (ctx.params.text) taIn.value = ctx.params.text;
  if (ctx.params.kind) {
    kind = ctx.params.kind;
    $('ky-kind').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === kind));
  }
  statusEl.innerHTML = agentStatusHtml(await pingAgent());
}
