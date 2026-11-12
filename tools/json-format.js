// FR-P0-03 JSON 格式化 / 压缩 / 校验
import { runWorker } from '../js/worker-client.js';

let state = { op: 'format', indent: 2 };

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field pane-in">
      <label>输入 JSON</label>
      <textarea id="jf-in" class="io" spellcheck="false" placeholder='粘贴 JSON，例如 {"a":1}'></textarea>
      <div class="meta-line" id="jf-meta"></div>
    </div>
    <div class="field radio-row pane-full">
      <span style="color:var(--muted)">操作：</span>
      <span class="seg" id="jf-op">
        <button data-v="format" class="on">格式化</button>
        <button data-v="compress">压缩</button>
        <button data-v="validate">校验</button>
      </span>
      <span style="color:var(--muted)">缩进：</span>
      <span class="seg" id="jf-indent">
        <button data-v="2" class="on">2 空格</button>
        <button data-v="4">4 空格</button>
        <button data-v="tab">Tab</button>
      </span>
    </div>
    <div class="field pane-out">
      <label>输出</label>
      <pre id="jf-out" class="out"></pre>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('jf-in'), out = $('jf-out'), meta = $('jf-meta');

  function bindSeg(id, key, isNum) {
    $(id).addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      state[key] = isNum ? Number(btn.dataset.v) : btn.dataset.v;
      if (key === 'indent' && state.op !== 'validate') run();
    });
  }
  bindSeg('jf-op', 'op', false);
  bindSeg('jf-indent', 'indent', true);

  async function run() {
    const text = taIn.value;
    if (!text.trim()) {
      out.className = 'out';
      out.textContent = '';
      meta.textContent = '';
      ctx.notify('请先输入 JSON');
      return;
    }
    meta.textContent = `输入 ${new Blob([text]).size} 字节…`;
    try {
      const r = await runWorker('workers/json.worker.js', { op: state.op, text, indent: state.indent }, { module: true });
      out.className = state.op === 'validate' ? 'out ok' : 'out';
      out.textContent = r.result;
      meta.textContent = `完成，输出 ${new Blob([r.result]).size} 字节`;
    } catch (err) {
      out.className = 'out err';
      out.textContent = '❌ ' + err.message;
      meta.textContent = '校验失败';
    }
  }

  taIn.addEventListener('input', () => { meta.textContent = `输入 ${new Blob([taIn.value]).size} 字节`; });

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; out.textContent = ''; out.className = 'out'; meta.textContent = ''; },
    copy() { ctx.copyText(out.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { text: taIn.value, op: state.op, indent: state.indent }; }
  };

  // 恢复分享参数
  if (ctx.params.text) taIn.value = ctx.params.text;
  if (ctx.params.op) {
    state.op = ctx.params.op;
    $('jf-op').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === state.op));
  }
  if (ctx.params.indent !== undefined) {
    state.indent = ctx.params.indent;
    $('jf-indent').querySelectorAll('button').forEach(b => b.classList.toggle('on', String(b.dataset.v) === String(state.indent)));
  }
}
