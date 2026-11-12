// FR-P1-10 颜色转换
import { convertColor } from '../lib/colorx.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field radio-row">
      <input type="text" id="cl-in" class="txt" placeholder="#4f8cff / rgb(79,140,255) / hsl(220,100%,66%) / red">
      <span id="cl-swatch" style="width:42px;height:42px;border-radius:8px;border:1px solid var(--border);display:inline-block"></span>
    </div>
    <div class="field">
      <label>转换结果（点击各行复制）</label>
      <pre id="cl-out" class="out"></pre>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('cl-in'), out = $('cl-out'), swatch = $('cl-swatch');

  function run() {
    const v = taIn.value.trim();
    if (!v) return;
    try {
      const r = convertColor(v);
      out.className = 'out';
      out.textContent =
        `HEX  ${r.hex}\nRGB  ${r.rgb}\nHSL  ${r.hsl}`;
      swatch.style.background = r.hex;
    } catch (err) {
      out.className = 'out err';
      out.textContent = '❌ ' + err.message;
    }
  }

  taIn.addEventListener('input', run);
  taIn.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });

  // 无选区时整段复制，有选区时复制选中部分
  out.addEventListener('click', () => {
    const sel = window.getSelection();
    const text = sel ? sel.toString() : '';
    if (!text) ctx.copyText(out.textContent);
    else ctx.copyText(text);
  });

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; out.textContent = ''; out.className = 'out'; swatch.style.background = ''; },
    copy() { ctx.copyText(out.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { color: taIn.value }; }
  };

  if (ctx.params.color) { taIn.value = ctx.params.color; }
  if (taIn.value) run();
}
