// FR-P0-06 Base64 / URL 编解码
import { b64encode, b64decode, urlEncode, urlDecode } from '../lib/base64x.js';

let state = { mode: 'b64enc', urlsafe: false };

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field radio-row pane-full">
      <span style="color:var(--muted)">模式：</span>
      <span class="seg" id="bu-mode">
        <button data-v="b64enc" class="on">Base64 编码</button>
        <button data-v="b64dec">Base64 解码</button>
        <button data-v="urlenc">URL 编码</button>
        <button data-v="urldec">URL 解码</button>
      </span>
      <label style="display:none" id="bu-us-row"><input type="checkbox" id="bu-us"> URL-safe（- _，去填充）</label>
    </div>
    <div class="field pane-in">
      <label>输入</label>
      <textarea id="bu-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field pane-out">
      <label>输出</label>
      <pre id="bu-out" class="out"></pre>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('bu-in'), out = $('bu-out'), usRow = $('bu-us-row'), us = $('bu-us');

  function syncUs() { usRow.style.display = state.mode.startsWith('b64') ? '' : 'none'; }

  $('bu-mode').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    $('bu-mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    state.mode = btn.dataset.v;
    syncUs();
    if (taIn.value.trim()) run();
  });
  us.addEventListener('change', () => { state.urlsafe = us.checked; if (taIn.value.trim()) run(); });

  function run() {
    const text = taIn.value;
    if (!text.trim()) { ctx.notify('请先输入内容'); return; }
    try {
      let result;
      switch (state.mode) {
        case 'b64enc': result = b64encode(text, us.checked); break;
        case 'b64dec': result = b64decode(text); break;
        case 'urlenc': result = urlEncode(text); break;
        case 'urldec': result = urlDecode(text); break;
      }
      out.className = 'out';
      out.textContent = result;
    } catch (err) {
      out.className = 'out err';
      out.textContent = '❌ ' + err.message;
    }
  }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; out.textContent = ''; out.className = 'out'; },
    copy() { ctx.copyText(out.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { text: taIn.value, mode: state.mode, urlsafe: us.checked }; }
  };

  syncUs();
  if (ctx.params.text) taIn.value = ctx.params.text;
  if (ctx.params.mode) {
    state.mode = ctx.params.mode;
    $('bu-mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === state.mode));
    syncUs();
  }
  if (ctx.params.urlsafe) us.checked = true;
}
