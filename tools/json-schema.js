// FR-P0-13 JSON Schema 校验
import { validateSchema } from '../lib/schemav.js';

const EXAMPLE_SCHEMA = {
  type: 'object',
  required: ['name', 'age', 'email'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 20 },
    age: { type: 'integer', minimum: 0, maximum: 150 },
    email: { type: 'string', pattern: '^[\\w.+-]+@[\\w-]+\\.[\\w.]+$' },
    tags: { type: 'array', items: { type: 'string' }, uniqueItems: true, maxItems: 5 },
    active: { type: 'boolean' }
  },
  additionalProperties: false
};

const EXAMPLE_DATA = {
  name: 'huanja',
  age: 20,
  email: 'test@example.com',
  tags: ['dev', 'ops'],
  active: true
};

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="two-col">
      <div class="field">
        <label>JSON Schema</label>
        <textarea id="js-schema" class="io" spellcheck="false"></textarea>
      </div>
      <div class="field">
        <label>JSON 数据</label>
        <textarea id="js-data" class="io" spellcheck="false"></textarea>
      </div>
    </div>
    <div class="field">
      <label>校验结果</label>
      <pre id="js-out" class="out"></pre>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taSchema = $('js-schema'), taData = $('js-data'), out = $('js-out');

  function run() {
    let schema, data;
    try {
      if (!taSchema.value.trim()) throw new Error('请先输入 Schema');
      schema = JSON.parse(taSchema.value);
    } catch (e) { return fail('Schema 解析失败：' + e.message); }
    try {
      if (!taData.value.trim()) throw new Error('请先输入待校验数据');
      data = JSON.parse(taData.value);
    } catch (e) { return fail('数据 JSON 解析失败：' + e.message); }

    const errors = validateSchema(data, schema);
    if (!errors.length) {
      out.className = 'out ok';
      out.textContent = '✅ 校验通过：数据符合 Schema';
    } else {
      out.className = 'out err';
      out.textContent = `❌ 校验失败，共 ${errors.length} 处：\n` +
        errors.map(e => `  · [${e.path}] ${e.message}`).join('\n');
    }
    function fail(msg) { out.className = 'out err'; out.textContent = '❌ ' + msg; }
  }

  function loadExample() {
    taSchema.value = JSON.stringify(EXAMPLE_SCHEMA, null, 2);
    taData.value = JSON.stringify(EXAMPLE_DATA, null, 2);
    run();
  }

  ctx.handlers = {
    run,
    clear() { taSchema.value = ''; taData.value = ''; out.textContent = ''; out.className = 'out'; },
    copy() { ctx.copyText(out.textContent); },
    example: loadExample,
    share() { return { schema: taSchema.value, data: taData.value }; }
  };

  if (ctx.params.schema || ctx.params.data) {
    taSchema.value = ctx.params.schema || '';
    taData.value = ctx.params.data || '';
  } else {
    loadExample(); // 默认加载示例，降低上手成本
  }
}
