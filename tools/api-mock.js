// FR-P1-03 API Mock
import { genFromSchema, genFromExample } from '../lib/mockx.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field">
      <label>JSON Schema 或示例 JSON（示例模式：保留结构、重造标量）</label>
      <textarea id="am-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field radio-row">
      <span style="color:var(--muted)">模式：</span>
      <span class="seg" id="am-mode">
        <button data-v="schema" class="on">按 Schema</button>
        <button data-v="example">按示例</button>
      </span>
      <label>数量 <input type="number" id="am-count" class="num" value="3" min="1" max="500"></label>
    </div>
    <div class="field">
      <label>生成结果</label>
      <pre id="am-out" class="out"></pre>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('am-in'), out = $('am-out');
  let mode = 'schema';

  $('am-mode').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $('am-mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    mode = btn.dataset.v;
  });

  function run() {
    const text = taIn.value.trim();
    if (!text) { ctx.notify('请输入 Schema 或示例'); return; }
    const count = Math.max(1, Math.min(500, Number($('am-count').value) || 1));
    let node;
    try { node = JSON.parse(text); }
    catch (err) { out.className = 'out err'; out.textContent = '❌ JSON 解析失败：' + err.message; return; }

    try {
      const r = mode === 'schema' ? genFromSchema(node, count) : genFromExample(node, count);
      out.className = 'out';
      out.textContent = JSON.stringify(mode === 'schema' ? (count === 1 ? r.data[0] : r.data) : (count === 1 ? r.data[0] : r.data), null, 2);
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
    share() { return { schema: taIn.value, count: Number($('am-count').value), mode }; }
  };

  if (ctx.params.schema) taIn.value = ctx.params.schema;
  if (ctx.params.count) $('am-count').value = ctx.params.count;
  if (ctx.params.mode === 'example') {
    mode = 'example';
    $('am-mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === 'example'));
  }
}
