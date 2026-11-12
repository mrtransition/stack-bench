// FR-P0-04 JSON ↔ YAML 互转
import { runWorker } from '../js/worker-client.js';

let state = { op: 'json2yaml' };

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field radio-row pane-full">
      <span style="color:var(--muted)">方向：</span>
      <span class="seg" id="jy-dir">
        <button data-v="json2yaml" class="on">JSON → YAML</button>
        <button data-v="yaml2json">YAML → JSON</button>
      </span>
    </div>
    <div class="field pane-in">
      <label id="jy-src-label">输入 JSON</label>
      <textarea id="jy-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field pane-out">
      <label>输出</label>
      <pre id="jy-out" class="out"></pre>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('jy-in'), out = $('jy-out'), srcLabel = $('jy-src-label');

  function syncLabel() {
    srcLabel.textContent = state.op === 'json2yaml' ? '输入 JSON' : '输入 YAML';
  }

  $('jy-dir').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    $('jy-dir').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    state.op = btn.dataset.v;
    syncLabel();
    if (taIn.value.trim()) run();
  });

  async function run() {
    const text = taIn.value;
    if (!text.trim()) { ctx.notify('请先输入内容'); return; }
    try {
      const r = await runWorker('workers/yaml.worker.js', { op: state.op, text, indent: 2 });
      out.className = 'out';
      out.textContent = r.result;
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
    share() { return { text: taIn.value, op: state.op }; }
  };

  syncLabel();
  if (ctx.params.text) { taIn.value = ctx.params.text; }
  if (ctx.params.op) {
    state.op = ctx.params.op;
    $('jy-dir').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === state.op));
    syncLabel();
  }
}
