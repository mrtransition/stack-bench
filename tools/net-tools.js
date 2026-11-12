// FR-P1-05 CIDR / 端口 / MIME / HTTP 状态码
import { parseCidr, inCidr, COMMON_PORTS, MIME_TYPES, HTTP_STATUS, searchList } from '../lib/netx.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field radio-row">
      <span class="seg" id="nt-tab">
        <button data-v="cidr" class="on">CIDR 计算</button>
        <button data-v="port">端口</button>
        <button data-v="mime">MIME</button>
        <button data-v="status">状态码</button>
      </span>
    </div>
    <div id="nt-body"></div>`;

  const $ = id => body.querySelector('#' + id);
  const tabEl = $('nt-tab'), bodyEl = $('nt-body');
  let tab = 'cidr';

  function renderCidr(saved = '') {
    bodyEl.innerHTML = `
      <div class="field radio-row">
        <input type="text" id="nt-cidr" class="txt" placeholder="192.168.1.130/26 或裸 IP">
        <input type="text" id="nt-check" class="txt" placeholder="检查 IP 是否在网段内（可选）">
      </div>
      <pre id="nt-cidr-out" class="out"></pre>`;
    const inEl = $('nt-cidr'), checkEl = $('nt-check'), out = $('nt-cidr-out');
    inEl.value = saved;
    const calc = () => {
      const v = inEl.value.trim();
      if (!v) { out.textContent = ''; return; }
      try {
        const c = parseCidr(v);
        let s =
          `输入          ${c.input}\n` +
          `网络地址      ${c.network}/${c.prefix}\n` +
          `子网掩码      ${c.mask}\n` +
          `反掩码        ${c.wildcard}\n` +
          `广播地址      ${c.broadcast}\n` +
          `可用主机范围  ${c.firstHost} ~ ${c.lastHost}\n` +
          `主机数量      ${c.hostCount}（总地址 ${c.totalAddresses}）\n` +
          `二进制 IP     ${c.binaryIp}\n` +
          `私网地址      ${c.isPrivate ? '是' : '否'}`;
        const ip = checkEl.value.trim();
        if (ip) {
          try { s += `\n包含 ${ip}    ${inCidr(v, ip) ? '✅ 是' : '❌ 否'}`; }
          catch (err) { s += `\n包含 ${ip}    检查失败：${err.message}`; }
        }
        out.className = 'out';
        out.textContent = s;
      } catch (err) {
        out.className = 'out err';
        out.textContent = '❌ ' + err.message;
      }
    };
    inEl.addEventListener('input', calc);
    checkEl.addEventListener('input', calc);
    if (saved) calc();
  }

  function renderTable(title, list, fields, savedQ = '') {
    bodyEl.innerHTML = `
      <div class="field radio-row">
        <input type="text" id="nt-q" class="txt" placeholder="搜索 ${title}…">
      </div>
      <div class="diff-wrap"><table class="diff" id="nt-table"></table></div>`;
    const qEl = $('nt-q'), table = $('nt-table');
    const draw = () => {
      const rows = searchList(list, qEl.value, fields);
      table.innerHTML = `<tr>${fields.map(f => `<th>${{ port: '端口', name: '名称', mime: 'MIME 类型', ext: '扩展名', code: '状态码', text: '短语', desc: '说明' }[f] || f}</th>`).join('')}</tr>` +
        rows.map(r => `<tr>${fields.map(f => `<td>${String(r[f]).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</td>`).join('')}</tr>`).join('') +
        (rows.length ? '' : '<tr><td colspan="3" style="color:var(--muted)">无匹配结果</td></tr>');
    };
    qEl.value = savedQ;
    qEl.addEventListener('input', draw);
    draw();
  }

  function switchTab(t) {
    tab = t;
    tabEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === t));
    if (t === 'cidr') renderCidr();
    else if (t === 'port') renderTable('端口', COMMON_PORTS, ['port', 'name', 'desc']);
    else if (t === 'mime') renderTable('MIME', MIME_TYPES, ['mime', 'ext', 'desc']);
    else renderTable('状态码', HTTP_STATUS, ['code', 'text', 'desc']);
  }
  tabEl.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    switchTab(btn.dataset.v);
  });

  switchTab(tab);

  ctx.handlers = {
    run() { const i = bodyEl.querySelector('#nt-cidr'); if (i) i.dispatchEvent(new Event('input')); },
    clear() { const i = bodyEl.querySelector('#nt-cidr'); if (i) { i.value = ''; i.dispatchEvent(new Event('input')); } },
    copy() { const o = bodyEl.querySelector('.out'); ctx.copyText(o ? o.textContent : ''); },
    example() { switchTab('cidr'); renderCidr(ctx.tool.examples[0]); },
    share() { return tab === 'cidr' ? { tab, cidr: (bodyEl.querySelector('#nt-cidr') || {}).value || '' } : { tab }; }
  };

  if (ctx.params.tab) switchTab(ctx.params.tab);
  if (ctx.params.cidr && tab === 'cidr') renderCidr(ctx.params.cidr);
}
