// FR-P0-07 Hash / UUID 生成
import { md5 } from '../lib/md5.js';
import { sha } from '../lib/shau.js';
import { uuidv4, uuidv7 } from '../lib/uuidx.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <h3 style="margin:8px 0">文本 Hash</h3>
    <div class="field">
      <textarea id="hu-in" class="io" style="min-height:90px" spellcheck="false" placeholder="输入要计算哈希的文本"></textarea>
    </div>
    <div class="field radio-row">
      <span style="color:var(--muted)">算法：</span>
      <span class="check-row" id="hu-algos">
        <label><input type="checkbox" value="MD5" checked> MD5</label>
        <label><input type="checkbox" value="SHA-1" checked> SHA-1</label>
        <label><input type="checkbox" value="SHA-256" checked> SHA-256</label>
        <label><input type="checkbox" value="SHA-512"> SHA-512</label>
      </span>
      <span style="color:var(--muted)">大小写：</span>
      <span class="seg" id="hu-case">
        <button data-v="lower" class="on">小写</button>
        <button data-v="upper">大写</button>
      </span>
    </div>
    <div class="field"><pre id="hu-hash-out" class="out"></pre></div>

    <h3 style="margin:20px 0 8px">UUID 生成</h3>
    <div class="field radio-row">
      <span style="color:var(--muted)">版本：</span>
      <span class="seg" id="hu-ver">
        <button data-v="v4" class="on">UUID v4</button>
        <button data-v="v7">UUID v7</button>
      </span>
      <label>数量 <input type="number" id="hu-count" class="num" value="5" min="1" max="500"></label>
      <label><input type="checkbox" id="hu-hyphen" checked> 含连字符</label>
    </div>
    <div class="field"><pre id="hu-uuid-out" class="out"></pre></div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('hu-in'), hashOut = $('hu-hash-out'), uuidOut = $('hu-uuid-out');
  let uuidCase = 'lower';

  $('hu-case').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $('hu-case').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    uuidCase = btn.dataset.v;
    if (taIn.value.trim()) calcHash();
  });

  async function calcHash() {
    const text = taIn.value;
    if (!text.trim()) { ctx.notify('请输入要计算哈希的文本'); return; }
    const algos = [...$('hu-algos').querySelectorAll('input:checked')].map(i => i.value);
    if (!algos.length) { hashOut.className = 'out'; hashOut.textContent = '（请至少选择一个算法）'; return; }
    const lines = [];
    for (const a of algos) {
      let h;
      if (a === 'MD5') h = md5(text);
      else h = await sha(a, text);
      if (uuidCase === 'upper') h = h.toUpperCase();
      lines.push(`${a}  ${h}`);
    }
    hashOut.className = 'out';
    hashOut.textContent = lines.join('\n');
  }

  async function genUuid() {
    const count = Math.max(1, Math.min(500, Number($('hu-count').value) || 1));
    const ver = $('hu-ver').querySelector('button.on').dataset.v;
    const opts = { hyphen: $('hu-hyphen').checked, upper: uuidCase === 'upper' };
    const gen = ver === 'v4' ? uuidv4 : uuidv7;
    const list = [];
    for (let i = 0; i < count; i++) list.push(await gen(opts));
    uuidOut.className = 'out';
    uuidOut.textContent = list.join('\n');
  }

  $('hu-ver').addEventListener('click', genUuid);
  $('hu-count').addEventListener('change', genUuid);
  $('hu-hyphen').addEventListener('change', genUuid);
  taIn.addEventListener('input', calcHash);

  async function run() { await calcHash(); await genUuid(); }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; hashOut.textContent = ''; uuidOut.textContent = ''; },
    copy() { ctx.copyText((hashOut.textContent || '') + (uuidOut.textContent ? '\n' + uuidOut.textContent : '')); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { text: taIn.value, count: Number($('hu-count').value), ver: $('hu-ver').querySelector('button.on').dataset.v }; }
  };

  if (ctx.params.text) taIn.value = ctx.params.text;
  genUuid();
  if (taIn.value) calcHash();
}
