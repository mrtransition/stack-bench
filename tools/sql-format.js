// FR-P1-01 SQL 格式化
import { formatSql, compressSql, SQL_EXAMPLES } from '../lib/sqlfmt.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field pane-in">
      <label>输入 SQL</label>
      <textarea id="sq-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field radio-row pane-full">
      <span style="color:var(--muted)">操作：</span>
      <span class="seg" id="sq-mode">
        <button data-v="format" class="on">格式化</button>
        <button data-v="compress">压缩</button>
      </span>
      <span style="color:var(--muted)">关键字：</span>
      <span class="seg" id="sq-case">
        <button data-v="upper" class="on">大写</button>
        <button data-v="lower">小写</button>
      </span>
    </div>
    <div class="field pane-out">
      <label>输出</label>
      <pre id="sq-out" class="out"></pre>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('sq-in'), out = $('sq-out');
  let mode = 'format', kcase = 'upper';

  function bind(id, setter) {
    $(id).addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
      setter(btn.dataset.v);
      if (taIn.value.trim()) run();
    });
  }
  bind('sq-mode', v => mode = v);
  bind('sq-case', v => kcase = v);

  function run() {
    const sql = taIn.value;
    if (!sql.trim()) { ctx.notify('请输入 SQL'); return; }
    try {
      const result = mode === 'compress' ? compressSql(sql) : formatSql(sql, { keywordCase: kcase });
      out.className = 'out';
      out.textContent = result;
    } catch (err) {
      out.className = 'out err';
      out.textContent = '❌ ' + err.message;
    }
  }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; out.textContent = ''; out.className = 'out'; },
    copy() { ctx.copyText(out.textContent); },
    example() { taIn.value = SQL_EXAMPLES[0]; run(); },
    share() { return { sql: taIn.value, mode, keywordCase: kcase }; }
  };

  if (ctx.params.sql) taIn.value = ctx.params.sql;
  if (ctx.params.mode) {
    mode = ctx.params.mode;
    $('sq-mode').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === mode));
  }
  if (ctx.params.keywordCase) {
    kcase = ctx.params.keywordCase;
    $('sq-case').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === kcase));
  }
  if (taIn.value) run();
}
