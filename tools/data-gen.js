// FR-P1-13 测试数据生成
import { genFromSchema, genFromExample } from '../lib/mockx.js';

const EXAMPLE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      orderNo: { type: 'string' },
      userName: { type: 'string' },
      phone: { type: 'string' },
      city: { type: 'string' },
      amount: { type: 'number' },
      paid: { type: 'boolean' },
      createdAt: { type: 'string', 'format': 'date-time' }
    }
  }
};

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field">
      <label>JSON Schema（对象或数组均可）或示例 JSON 模板</label>
      <textarea id="dg-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field radio-row">
      <label>数量 <input type="number" id="dg-count" class="num" value="5" min="1" max="500"></label>
      <button class="btn" id="dg-fill-schema" style="font-size:12px">填充订单 Schema 示例</button>
    </div>
    <div class="field">
      <label>生成结果</label>
      <pre id="dg-out" class="out" style="max-height:420px"></pre>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('dg-in'), out = $('dg-out');

  $('dg-fill-schema').addEventListener('click', () => {
    taIn.value = JSON.stringify(EXAMPLE_SCHEMA, null, 2);
    run();
  });

  function run() {
    const text = taIn.value.trim();
    if (!text) { ctx.notify('请输入 Schema 或模板'); return; }
    const count = Math.max(1, Math.min(500, Number($('dg-count').value) || 1));
    let node;
    try { node = JSON.parse(text); }
    catch (err) { out.className = 'out err'; out.textContent = '❌ JSON 解析失败：' + err.message; return; }

    try {
      // Schema 含 type 字段走 Schema 模式，否则走示例模板模式
      const isSchema = node && typeof node === 'object' && ('type' in node || 'properties' in node || 'items' in node);
      const r = isSchema ? genFromSchema(node, count) : genFromExample(node, count);
      out.className = 'out';
      out.textContent = JSON.stringify(count === 1 ? r.data[0] : r.data, null, 2);
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
    share() { return { schema: taIn.value, count: Number($('dg-count').value) }; }
  };

  if (ctx.params.schema) taIn.value = ctx.params.schema;
  if (ctx.params.count) $('dg-count').value = ctx.params.count;
  if (!taIn.value) taIn.value = ctx.tool.examples[0];
  if (taIn.value) run();
}
