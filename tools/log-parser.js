// FR-P1-04 日志解析与时间线
import { parseLogs, buildTimeline } from '../lib/logx.js';

const LEVEL_COLOR = { FATAL: '#7d1128', ERROR: '#e5484d', WARN: '#e2a336', INFO: '#2f8fe6', DEBUG: '#8b93a7', TRACE: '#5a6273' };

function escHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function highlight(s, kw) {
  const safe = escHtml(s);
  if (!kw) return safe;
  const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return safe.replace(re, m => `<mark style="background:#f5b94255;color:inherit;border-radius:2px">${m}</mark>`);
}
function pad(n) { return String(n).padStart(2, '0'); }
function fmtTs(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field">
      <label>日志文本</label>
      <textarea id="lp-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field radio-row">
      <input type="text" id="lp-kw" class="txt" placeholder="关键词高亮 / 过滤（可选）">
      <label style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" id="lp-filter"> 只显示匹配行</label>
    </div>
    <div class="field">
      <label>解析结果</label>
      <div id="lp-out"><div class="info-box">粘贴日志后点击「解析」</div></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('lp-in'), kwIn = $('lp-kw'), cbFilter = $('lp-filter'), outEl = $('lp-out');

  function run() {
    const text = taIn.value;
    if (!text.trim()) { ctx.notify('请输入日志文本'); return; }
    const { entries, counts, range } = parseLogs(text);
    const kw = kwIn.value.trim();
    const total = entries.length;

    // 统计
    let html = `<div class="meta-line" style="margin:4px 0">共 ${total} 行，`;
    html += Object.entries(counts).filter(([, c]) => c > 0).map(([l, c]) => {
      const color = LEVEL_COLOR[l] || '#8b93a7';
      return `<span style="color:${color}">${l} ${c}</span>`;
    }).join(' · ');
    if (range) html += ` · 时间跨度 ${fmtTs(range.start)} ~ ${fmtTs(range.end)}（可解析时间 ${range.parsed} 行）`;
    html += '</div>';

    // 时间线
    const tl = buildTimeline(entries);
    if (tl.length > 1) {
      const maxC = Math.max(...tl.map(b => b.count));
      html += '<div class="field"><label>时间线（每桶聚合）</label><div class="info-box" style="font-family:ui-monospace,Consolas,monospace">';
      for (const b of tl) {
        const bar = '█'.repeat(Math.max(1, Math.round(b.count / maxC * 30))).padEnd(30, '·');
        const errMark = b.errors ? ` <span style="color:${LEVEL_COLOR.ERROR}">⚠${b.errors}</span>` : '';
        html += `${fmtTs(b.from).slice(11)}  ${bar}  ${b.count}${errMark}\n`;
      }
      html += '</div></div>';
    }

    // 明细（可选过滤）
    const shown = kw && cbFilter.checked ? entries.filter(e => kw && e.msg.toLowerCase().includes(kw.toLowerCase())) : entries;
    html += `<div class="field"><label>明细（${shown.length} 行）</label><div class="diff-wrap"><table class="diff">
      <tr><th class="ln">#</th><th style="width:64px">级别</th><th style="width:170px">时间</th><th style="width:130px">Trace</th><th>内容</th></tr>`;
    for (const e of shown.slice(0, 500)) {
      const color = LEVEL_COLOR[e.level] || '#8b93a7';
      html += `<tr><td class="ln">${e.no}</td><td><span class="status-pill" style="background:${color};font-size:10px">${e.level}</span></td>
        <td style="color:var(--muted)">${e.ts ? fmtTs(e.ts) : escHtml(e.tsStr || '-')}</td>
        <td style="color:var(--muted);word-break:break-all">${e.trace ? escHtml(e.trace) : '-'}</td>
        <td><code>${highlight(e.msg, kw)}</code></td></tr>`;
    }
    html += '</table>' + (shown.length > 500 ? `<div class="meta-line">仅展示前 500 行</div>` : '') + '</div></div>';

    outEl.innerHTML = html;
  }

  kwIn.addEventListener('input', () => { if (taIn.value.trim()) run(); });
  cbFilter.addEventListener('change', () => { if (taIn.value.trim()) run(); });

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; kwIn.value = ''; cbFilter.checked = false; outEl.innerHTML = ''; },
    copy() { ctx.copyText(outEl.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { text: taIn.value, keyword: kwIn.value }; }
  };

  if (ctx.params.text) { taIn.value = ctx.params.text; kwIn.value = ctx.params.keyword || ''; }
}
