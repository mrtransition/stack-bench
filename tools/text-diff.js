// FR-P0-10 文本 Diff（Web Worker）
import { runWorker } from '../js/worker-client.js';

let state = { ignoreWs: false, view: 'split' };

function escHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="two-col">
      <div class="field"><label>文本 A（原）</label><textarea id="df-a" class="io" spellcheck="false"></textarea></div>
      <div class="field"><label>文本 B（新）</label><textarea id="df-b" class="io" spellcheck="false"></textarea></div>
    </div>
    <div class="field radio-row">
      <label><input type="checkbox" id="df-ws"> 忽略空白差异</label>
      <span style="color:var(--muted)">视图：</span>
      <span class="seg" id="df-view">
        <button data-v="split" class="on">并排视图</button>
        <button data-v="unified">统一视图</button>
      </span>
    </div>
    <div class="field">
      <label>差异结果</label>
      <div id="df-out"></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taA = $('df-a'), taB = $('df-b'), outEl = $('df-out');
  let lastData = null;

  $('df-view').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $('df-view').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    state.view = btn.dataset.v;
    if (lastData) renderResult(lastData); // 切换视图即时重渲染
  });

  function splitTable(ops, rawA, rawB) {
    // 并排视图：将成对的 -/+ 对齐到同一行
    const rows = [];
    let i = 0;
    while (i < ops.length) {
      const op = ops[i];
      if (op.t === '=') { rows.push({ a: rawA[op.a], b: rawB[op.b], ta: '', tb: '', na: op.a + 1, nb: op.b + 1 }); i++; }
      else if (op.t === '-') {
        const dels = [], adds = [];
        while (i < ops.length && ops[i].t === '-') { dels.push(ops[i]); i++; }
        while (i < ops.length && ops[i].t === '+') { adds.push(ops[i]); i++; }
        const max = Math.max(dels.length, adds.length);
        for (let k = 0; k < max; k++) {
          rows.push({
            a: k < dels.length ? rawA[dels[k].a] : '',
            b: k < adds.length ? rawB[adds[k].b] : '',
            ta: k < dels.length ? 'del' : '',
            tb: k < adds.length ? 'add' : '',
            na: k < dels.length ? dels[k].a + 1 : '',
            nb: k < adds.length ? adds[k].b + 1 : ''
          });
        }
      } else { // 孤立 +
        rows.push({ a: '', b: rawB[op.b], ta: '', tb: 'add', na: '', nb: op.b + 1 });
        i++;
      }
    }
    return `<div class="diff-wrap"><table class="diff">
      <tr><th class="ln">#</th><th>文本 A</th><th class="ln">#</th><th>文本 B</th></tr>
      ${rows.map(r => `<tr class="${r.ta || r.tb ? (r.ta ? 'd-del' : 'd-add') : ''}">
        <td class="ln">${r.na}</td><td><code>${escHtml(r.a)}</code></td>
        <td class="ln">${r.nb}</td><td><code>${escHtml(r.b)}</code></td>
      </tr>`).join('')}
    </table></div>`;
  }

  function unifiedTable(ops, rawA, rawB) {
    const rows = [];
    for (const op of ops) {
      if (op.t === '=') rows.push({ c: '', na: op.a + 1, nb: op.b + 1, text: rawA[op.a] });
      else if (op.t === '-') rows.push({ c: 'del', na: op.a + 1, nb: '', text: rawA[op.a] });
      else rows.push({ c: 'add', na: '', nb: op.b + 1, text: rawB[op.b] });
    }
    return `<div class="diff-wrap"><table class="diff">
      <tr><th class="ln">A</th><th class="ln">B</th><th style="width:18px"></th><th>内容</th></tr>
      ${rows.map(r => `<tr class="${r.c ? 'd-' + r.c : ''}">
        <td class="ln">${r.na}</td><td class="ln">${r.nb}</td>
        <td class="d-tag"></td><td><code>${escHtml(r.text)}</code></td>
      </tr>`).join('')}
    </table></div>`;
  }

  async function run() {
    const aText = taA.value, bText = taB.value;
    if (!aText && !bText) { ctx.notify('请输入需要对比的文本'); return; }
    outEl.innerHTML = '<div class="info-box">计算差异中…</div>';
    try {
      const r = await runWorker('workers/diff.worker.js', {
        aText, bText, ignoreWs: $('df-ws').checked
      }, { module: true });
      lastData = r;
      renderResult(r);
    } catch (err) {
      lastData = null;
      outEl.innerHTML = `<div class="err-box">❌ ${err.message}</div>`;
    }
  }

  function renderResult(r) {
    const ops = r.ops, rawA = r.rawA, rawB = r.rawB;
    const stats = ops.reduce((s, o) => { s[o.t] = (s[o.t] || 0) + 1; return s; }, {});
    const summary = `相同 ${stats['='] || 0} 行，删除 ${stats['-'] || 0} 行，新增 ${stats['+'] || 0} 行`;
    outEl.innerHTML = `<div class="meta-line">${summary}</div>` +
      (state.view === 'split' ? splitTable(ops, rawA, rawB) : unifiedTable(ops, rawA, rawB));
    outEl.dataset.summary = summary;
  }

  ctx.handlers = {
    run,
    clear() { taA.value = ''; taB.value = ''; outEl.innerHTML = ''; },
    copy() { ctx.copyText(outEl.dataset.summary || outEl.textContent || ''); },
    example() {
      taA.value = ctx.tool.examples[0];
      taB.value = 'line 1\nline 2 new\nline 3\nline 4\nline 5 added';
      run();
    },
    share() { return { a: taA.value, b: taB.value, ignoreWs: $('df-ws').checked, view: state.view }; }
  };

  if (ctx.params.a !== undefined || ctx.params.b !== undefined) {
    taA.value = ctx.params.a || '';
    taB.value = ctx.params.b || '';
    if (ctx.params.ignoreWs) $('df-ws').checked = true;
    if (ctx.params.view === 'unified') {
      state.view = 'unified';
      $('df-view').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === 'unified'));
    }
  }
}
