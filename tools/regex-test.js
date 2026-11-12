// FR-P0-09 正则测试
import { riskyHint, matchAll } from '../lib/regexx.js';

const TEMPLATES = [
  { label: '手机号', pattern: '1[3-9]\\d{9}', text: '联系方式：13812345678，备用 15987654321。' },
  { label: '邮箱', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.]+', text: '发给 test@example.com 或 a.b+tag@corp.com.cn。' },
  { label: 'URL', pattern: 'https?://[^\\s<>"\']+', text: '文档：https://example.com/docs?page=1#top' },
  { label: 'IPv4', pattern: '(?:\\d{1,3}\\.){3}\\d{1,3}', text: '服务器 192.168.1.10 和 10.0.0.255 在线。' },
  { label: '日期 YYYY-MM-DD', pattern: '(\\d{4})-(\\d{2})-(\\d{2})', text: '上线日期 2026-03-01，截止 2026-03-15。' },
  { label: '命名分组：key=value', pattern: '(?<key>\\w+)=(?<value>\\S+)', text: 'host=127.0.0.1 port=8080 debug=true' }
];

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field radio-row">
      <input type="text" id="rx-pat" class="txt" placeholder="正则表达式，不含两侧斜杠，如 1[3-9]\\d{9}">
      <span class="check-row" id="rx-flags">
        <label><input type="checkbox" value="g" checked> g</label>
        <label><input type="checkbox" value="i"> i</label>
        <label><input type="checkbox" value="m"> m</label>
        <label><input type="checkbox" value="s"> s</label>
        <label><input type="checkbox" value="u"> u</label>
      </span>
      <select id="rx-tpl"><option value="">常用模板…</option></select>
    </div>
    <div class="field">
      <label>测试文本</label>
      <textarea id="rx-text" class="io" style="min-height:110px" spellcheck="false"></textarea>
    </div>
    <div class="field radio-row">
      <input type="text" id="rx-repl" class="txt" placeholder="替换文本（支持 $1、$<name>）">
    </div>
    <div class="field"><pre id="rx-out" class="out"></pre></div>`;

  const $ = id => body.querySelector('#' + id);
  const taPat = $('rx-pat'), taText = $('rx-text'), taRepl = $('rx-repl'), out = $('rx-out');

  const tplSel = $('rx-tpl');
  for (const t of TEMPLATES) {
    const o = document.createElement('option');
    o.value = t.pattern; o.textContent = t.label; o.dataset.text = t.text;
    tplSel.appendChild(o);
  }
  tplSel.addEventListener('change', () => {
    const o = tplSel.selectedOptions[0];
    if (!o || !o.value) return;
    taPat.value = o.value;
    taText.value = o.dataset.text;
    run();
    tplSel.value = '';
  });

  function getFlags() {
    return [...$('rx-flags').querySelectorAll('input:checked')].map(i => i.value).join('');
  }

  function run() {
    const pat = taPat.value;
    const text = taText.value;
    if (!pat) { ctx.notify('请输入正则表达式'); return; }
    if (!text) { ctx.notify('请输入测试文本'); return; }
    let re;
    try {
      re = new RegExp(pat, getFlags());
    } catch (err) {
      out.className = 'out err';
      out.textContent = '❌ 正则不合法：' + err.message;
      return;
    }
    const hint = riskyHint(pat);
    const matches = matchAll(re, text);
    const lines = [];
    if (hint) lines.push(hint, '');
    if (!matches.length) lines.push('（无匹配）');
    else {
      lines.push(`共 ${matches.length} 处匹配（最多展示 500）：`);
      matches.forEach((m, i) => {
        const ctxStr = `${m.groups && Object.keys(m.groups).length ? '  命名分组:' + JSON.stringify(m.groups) : ''}`;
        lines.push(`  #${i + 1} [${m.index}, ${m.end}) "${m.text}"${ctxStr}`);
        m.groups.forEach((g, gi) => {
          if (g !== null) lines.push(`       分组 $${gi + 1} = "${g}"`);
        });
      });
    }
    if (taRepl.value) {
      lines.push('', '替换预览：');
      try {
        lines.push(text.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), taRepl.value));
      } catch (err) {
        lines.push('  替换失败：' + err.message);
      }
    }
    out.className = hint ? 'out' : 'out ok';
    out.textContent = lines.join('\n');
    if (hint) out.classList.add('err');
  }

  ctx.handlers = {
    run,
    clear() { taPat.value = ''; taText.value = ''; taRepl.value = ''; out.textContent = ''; out.className = 'out'; },
    copy() { ctx.copyText(out.textContent); },
    example() { taPat.value = TEMPLATES[0].pattern; taText.value = TEMPLATES[0].text; run(); },
    share() { return { pattern: taPat.value, flags: getFlags(), text: taText.value, replacement: taRepl.value }; }
  };

  if (ctx.params.pattern) {
    taPat.value = ctx.params.pattern;
    if (ctx.params.flags) {
      for (const f of ctx.params.flags) {
        const cb = $('rx-flags').querySelector(`input[value="${f}"]`);
        if (cb) cb.checked = true;
      }
    }
    taText.value = ctx.params.text || '';
    taRepl.value = ctx.params.replacement || '';
    run();
  }
}
