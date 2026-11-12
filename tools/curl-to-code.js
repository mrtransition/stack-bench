// FR-P0-11 curl 转代码片段
import { parseCurl, genCode, TARGETS } from '../lib/curls.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field pane-in">
      <label>curl 命令</label>
      <textarea id="cc-in" class="io" spellcheck="false" placeholder="curl -X POST ..."></textarea>
    </div>
    <div class="field radio-row pane-full">
      <span style="color:var(--muted)">目标：</span>
      <span class="seg" id="cc-target"></span>
    </div>
    <div class="field pane-out">
      <label>生成代码</label>
      <pre id="cc-out" class="out"></pre>
      <div class="meta-line" id="cc-notes"></div>
    </div>`;

  const seg = body.querySelector('#cc-target');
  seg.innerHTML = TARGETS.map((t, i) => `<button data-v="${t.key}" class="${i === 0 ? 'on' : ''}">${t.label}</button>`).join('');

  const $ = id => body.querySelector('#' + id);
  const taIn = $('cc-in'), out = $('cc-out'), notesEl = $('cc-notes');
  let target = 'fetch';

  seg.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    target = btn.dataset.v;
    if (taIn.value.trim()) run();
  });

  function run() {
    const cmd = taIn.value;
    if (!cmd.trim()) { ctx.notify('请先输入 curl 命令'); return; }
    try {
      const parsed = parseCurl(cmd);
      const r = genCode(parsed, target);
      out.className = 'out';
      out.textContent = r.code;
      if (r.notes.length) {
        notesEl.innerHTML = '⚠ ' + r.notes.map(n => String(n).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))).join('<br>⚠ ');
      } else {
        notesEl.textContent = '';
      }
    } catch (err) {
      out.className = 'out err';
      out.textContent = '❌ 解析失败：' + err.message;
      notesEl.textContent = '';
    }
  }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; out.textContent = ''; out.className = 'out'; notesEl.textContent = ''; },
    copy() { ctx.copyText(out.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { cmd: taIn.value, target }; }
  };

  if (ctx.params.cmd) taIn.value = ctx.params.cmd;
  if (ctx.params.target) {
    target = ctx.params.target;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === target));
  }
  if (taIn.value) run();
}
