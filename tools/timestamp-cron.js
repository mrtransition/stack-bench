// FR-P0-05 时间戳转换 / Cron 解析
import { parseFlexible, normalizeTs, fmtAll } from '../lib/timeu.js';
import { parseCron, nextRuns, describeCron, CRON_TEMPLATES } from '../lib/cronx.js';

const pad = n => String(n).padStart(2, '0');
const fmtD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export async function render(body, ctx) {
  body.innerHTML = `
    <h3 style="margin:8px 0">时间戳转换</h3>
    <div class="field radio-row">
      <input type="text" id="tc-ts" class="txt" placeholder="时间戳（秒/毫秒）或日期字符串，如 1765560000 / 2026-01-01 12:00:00">
      <button class="btn" id="tc-now">当前时间</button>
    </div>
    <div class="field radio-row">
      <span style="color:var(--muted)">单位：</span>
      <span class="seg" id="tc-unit">
        <button data-v="auto" class="on">自动识别</button>
        <button data-v="sec">秒</button>
        <button data-v="ms">毫秒</button>
      </span>
    </div>
    <div class="field"><pre id="tc-ts-out" class="out"></pre></div>

    <h3 style="margin:20px 0 8px">Cron 表达式解析</h3>
    <div class="field radio-row">
      <input type="text" id="tc-cron" class="txt" placeholder="5 字段：分 时 日 月 周；6 字段：秒 分 时 日 月 周">
      <select id="tc-tpl"><option value="">常用模板…</option></select>
    </div>
    <div class="field"><pre id="tc-cron-out" class="out"></pre></div>`;

  const $ = id => body.querySelector('#' + id);
  const taTs = $('tc-ts'), tsOut = $('tc-ts-out'), taCron = $('tc-cron'), cronOut = $('tc-cron-out');
  let unit = 'auto';

  const tplSel = $('tc-tpl');
  for (const t of CRON_TEMPLATES) {
    const o = document.createElement('option');
    o.value = t.expr; o.textContent = `${t.label} · ${t.expr}`;
    tplSel.appendChild(o);
  }
  tplSel.addEventListener('change', () => {
    if (!tplSel.value) return;
    taCron.value = tplSel.value;
    runCron();
    tplSel.value = '';
  });

  $('tc-unit').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    $('tc-unit').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    unit = btn.dataset.v;
    if (taTs.value.trim()) runTs();
  });

  $('tc-now').addEventListener('click', () => {
    const d = new Date();
    taTs.value = fmtD(d);
    runTs();
  });

  function runTs() {
    const s = taTs.value.trim();
    if (!s) { ctx.notify('请输入时间戳或日期'); return; }
    try {
      let d;
      if (/^\d+$/.test(s)) {
        if (unit === 'sec') d = new Date(Number(s) * 1000);
        else if (unit === 'ms') d = new Date(Number(s));
        else d = normalizeTs(s);
      } else {
        d = parseFlexible(s);
      }
      const f = fmtAll(d);
      tsOut.className = 'out';
      tsOut.textContent =
        `本地时间：${f.local}（周${f.weekdayCN}）\n` +
        `UTC 时间：${f.utc}\n` +
        `ISO 8601：${f.iso}\n` +
        `秒级时间戳：${f.sec}\n` +
        `毫秒时间戳：${f.ms}`;
    } catch (err) {
      tsOut.className = 'out err';
      tsOut.textContent = '❌ ' + err.message;
    }
  }

  function runCron() {
    const expr = taCron.value.trim();
    if (!expr) { ctx.notify('请输入 Cron 表达式'); return; }
    try {
      parseCron(expr);
      const next = nextRuns(expr, new Date(), 5);
      const lines = [`描述：${describeCron(expr)}`, '', '未来 5 次执行时间：'];
      next.forEach((d, i) => lines.push(`  ${i + 1}. ${fmtD(d)}`));
      if (next.length < 5) lines.push('（后续 5 年内未找到更多执行时间，请检查表达式）');
      cronOut.className = 'out';
      cronOut.textContent = lines.join('\n');
    } catch (err) {
      cronOut.className = 'out err';
      cronOut.textContent = '❌ ' + err.message;
    }
  }

  taTs.addEventListener('keydown', e => { if (e.key === 'Enter') runTs(); });
  taCron.addEventListener('keydown', e => { if (e.key === 'Enter') runCron(); });

  function run() {
    if (taTs.value.trim()) runTs();
    if (taCron.value.trim()) runCron();
    if (!taTs.value.trim() && !taCron.value.trim()) runTs();
  }

  ctx.handlers = {
    run,
    clear() { taTs.value = ''; taCron.value = ''; tsOut.textContent = ''; cronOut.textContent = ''; },
    copy() { ctx.copyText((tsOut.textContent || '') + (cronOut.textContent ? '\n' + cronOut.textContent : '')); },
    example() { taTs.value = ctx.tool.examples[0]; taCron.value = '*/5 * * * *'; run(); },
    share() { return { ts: taTs.value, cron: taCron.value, unit }; }
  };

  if (ctx.params.ts || ctx.params.cron) {
    taTs.value = ctx.params.ts || '';
    taCron.value = ctx.params.cron || '';
    if (ctx.params.unit) {
      unit = ctx.params.unit;
      $('tc-unit').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === unit));
    }
    run();
  } else {
    taTs.value = fmtD(new Date());
    runTs();
  }
}
