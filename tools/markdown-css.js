// FR-P1-11 Markdown / CSS 格式化
import { renderMarkdown } from '../lib/mdx.js';
import { formatCss, compressCss } from '../lib/cssfmt.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field radio-row">
      <span class="seg" id="mc-mode">
        <button data-v="markdown" class="on">Markdown 预览</button>
        <button data-v="css">CSS 格式化</button>
      </span>
      <span class="seg" id="mc-css-op" style="display:none">
        <button data-v="format" class="on">格式化</button>
        <button data-v="compress">压缩</button>
      </span>
    </div>
    <div class="two-col">
      <div class="field">
        <label>输入</label>
        <textarea id="mc-in" class="io" style="min-height:240px" spellcheck="false"></textarea>
      </div>
      <div class="field">
        <label id="mc-out-label">预览</label>
        <div id="mc-out" class="out" style="min-height:240px;max-height:420px;overflow:auto;border-radius:8px;padding:12px"></div>
      </div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('mc-in'), outEl = $('mc-out'), outLabel = $('mc-out-label'), cssOpEl = $('mc-css-op');
  let mode = 'markdown', cssOp = 'format';

  $('mc-mode').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $('mc-mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    mode = btn.dataset.v;
    cssOpEl.style.display = mode === 'css' ? '' : 'none';
    outLabel.textContent = mode === 'markdown' ? '预览' : '输出';
    if (taIn.value.trim()) run();
  });
  cssOpEl.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    cssOpEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    cssOp = btn.dataset.v;
    if (taIn.value.trim()) run();
  });

  function run() {
    const text = taIn.value;
    if (!text.trim()) { ctx.notify('请输入内容'); return; }
    if (mode === 'markdown') {
      outEl.innerHTML = renderMarkdown(text);
    } else {
      try {
        const result = cssOp === 'compress' ? compressCss(text) : formatCss(text);
        outEl.innerHTML = `<pre class="out" style="border:none;background:transparent;padding:0">${result.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>`;
      } catch (err) {
        outEl.innerHTML = `<div class="err-box">❌ ${err.message}</div>`;
      }
    }
  }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; outEl.innerHTML = ''; },
    copy() {
      if (mode === 'markdown') {
        ctx.copyText(outEl.innerHTML);
        ctx.notify('已复制 HTML 源码');
      } else {
        ctx.copyText(outEl.textContent);
      }
    },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { text: taIn.value, mode, cssOp }; }
  };

  if (ctx.params.text) taIn.value = ctx.params.text;
  if (ctx.params.mode) {
    mode = ctx.params.mode;
    $('mc-mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
    cssOpEl.style.display = mode === 'css' ? '' : 'none';
    outLabel.textContent = mode === 'markdown' ? '预览' : '输出';
  }
  if (ctx.params.cssOp) {
    cssOp = ctx.params.cssOp;
    cssOpEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === cssOp));
  }
  if (taIn.value) run();
}
