// FR-P1-12 进制转换 / 二维码
import { convertAll, convertBase, isValidInBase } from '../lib/basex.js';

export async function render(body, ctx) {
  body.innerHTML = `
    <h3 style="margin:8px 0">进制转换</h3>
    <div class="field radio-row">
      <input type="text" id="bq-num" class="txt" placeholder="输入数字，如 ff2000、-101、12345678901234567890">
      <span style="color:var(--muted)">原进制：</span>
      <select id="bq-from">
        ${[16, 10, 8, 2, 32, 36, 5, 12, 20].map(b => `<option value="${b}"${b === 16 ? ' selected' : ''}>${b} 进制</option>`).join('')}
      </select>
    </div>
    <div class="field"><pre id="bq-out" class="out"></pre></div>

    <h3 style="margin:20px 0 8px">二维码生成</h3>
    <div class="field radio-row">
      <input type="text" id="bq-qr" class="txt" placeholder="二维码内容（URL / 文本）">
      <span style="color:var(--muted)">容错：</span>
      <select id="bq-ecc"><option value="L">L (7%)</option><option value="M" selected>M (15%)</option><option value="Q">Q (25%)</option><option value="H">H (30%)</option></select>
      <button class="btn" id="bq-download">下载 PNG</button>
    </div>
    <div class="field">
      <div id="bq-canvas-wrap" style="background:#fff;display:inline-block;padding:10px;border-radius:8px;border:1px solid var(--border)"></div>
      <div class="meta-line" id="bq-meta"></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const numEl = $('bq-num'), fromEl = $('bq-from'), out = $('bq-out');
  const qrEl = $('bq-qr'), eccEl = $('bq-ecc'), wrap = $('bq-canvas-wrap'), meta = $('bq-meta');
  let lastQrCanvas = null;

  function runBase() {
    const v = numEl.value.trim();
    if (!v) return;
    const from = Number(fromEl.value);
    try {
      const rows = convertAll(v, from);
      out.className = 'out';
      out.textContent = rows.map(r => `${String(r.base).padStart(2)} 进制  ${r.value}`).join('\n');
    } catch (err) {
      out.className = 'out err';
      out.textContent = '❌ ' + err.message;
    }
  }
  numEl.addEventListener('input', runBase);
  fromEl.addEventListener('change', runBase);

  function genQr() {
    const text = qrEl.value;
    if (!text.trim()) { wrap.innerHTML = ''; meta.textContent = ''; return; }
    try {
      if (typeof qrcode === 'undefined') throw new Error('二维码库未加载');
      const typeNum = text.length > 200 ? 0 : 0; // 0 = 自动
      const qr = qrcode(0, eccEl.value);
      qr.addData(text);
      qr.make();
      const count = qr.getModuleCount();
      const cell = 6, margin = 4;
      const size = (count + margin * 2) * cell;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx2 = canvas.getContext('2d');
      ctx2.fillStyle = '#fff';
      ctx2.fillRect(0, 0, size, size);
      ctx2.fillStyle = '#000';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) ctx2.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
      wrap.innerHTML = '';
      wrap.appendChild(canvas);
      lastQrCanvas = canvas;
      meta.textContent = `版本自动 · ${count}×${count} 模块 · 容错 ${eccEl.value}`;
    } catch (err) {
      wrap.innerHTML = '';
      meta.textContent = '❌ ' + err.message;
    }
  }
  qrEl.addEventListener('input', genQr);
  eccEl.addEventListener('change', genQr);

  $('bq-download').addEventListener('click', () => {
    if (!lastQrCanvas) { ctx.notify('请先生成二维码'); return; }
    const a = document.createElement('a');
    a.href = lastQrCanvas.toDataURL('image/png');
    a.download = 'qrcode.png';
    a.click();
    ctx.notify('已下载 qrcode.png');
  });

  function run() { runBase(); genQr(); }

  ctx.handlers = {
    run,
    clear() { numEl.value = ''; qrEl.value = ''; out.textContent = ''; out.className = 'out'; wrap.innerHTML = ''; meta.textContent = ''; },
    copy() { ctx.copyText(out.textContent || meta.textContent); },
    example() { numEl.value = ctx.tool.examples[0]; qrEl.value = 'https://example.com'; run(); },
    share() { return { num: numEl.value, from: Number(fromEl.value), qrText: qrEl.value, ecc: eccEl.value }; }
  };

  if (ctx.params.num) numEl.value = ctx.params.num;
  if (ctx.params.from) fromEl.value = String(ctx.params.from);
  if (ctx.params.qrText) qrEl.value = ctx.params.qrText;
  if (ctx.params.ecc) eccEl.value = ctx.params.ecc;
  if (numEl.value) runBase();
  if (qrEl.value) genQr();
}
