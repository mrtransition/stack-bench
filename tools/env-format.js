// FR-P0-14 .env / 配置格式化
import { formatEnv } from '../lib/envx.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field pane-in">
      <label>输入 .env 文本</label>
      <textarea id="ev-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field radio-row pane-full">
      <label><input type="checkbox" id="ev-sort"> 按 key 排序</label>
      <label><input type="checkbox" id="ev-mask"> 敏感 key 脱敏展示</label>
    </div>
    <div class="field pane-out">
      <label>整理结果</label>
      <pre id="ev-out" class="out"></pre>
      <div class="meta-line" id="ev-meta"></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('ev-in'), out = $('ev-out'), meta = $('ev-meta');
  const cbSort = $('ev-sort'), cbMask = $('ev-mask');

  function run() {
    const text = taIn.value;
    if (!text.trim()) { ctx.notify('请先输入 .env 内容'); return; }
    const r = formatEnv(text, { sort: cbSort.checked, mask: cbMask.checked });
    out.className = r.issues.length ? 'out err' : 'out';
    out.textContent = r.output;
    const parts = [`共 ${r.count} 个条目`];
    if (r.dups.length) parts.push(`重复 key：${r.dups.join(', ')}`);
    for (const issue of r.issues) parts.push(`第 ${issue.line} 行：${issue.message}`);
    meta.textContent = parts.join('；') || '格式正常';
  }

  cbSort.addEventListener('change', run);
  cbMask.addEventListener('change', run);

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; out.textContent = ''; out.className = 'out'; meta.textContent = ''; },
    copy() { ctx.copyText(out.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { text: taIn.value, sort: cbSort.checked, mask: cbMask.checked }; }
  };

  if (ctx.params.text) {
    taIn.value = ctx.params.text;
    cbSort.checked = !!ctx.params.sort;
    cbMask.checked = !!ctx.params.mask;
    run();
  }
}
