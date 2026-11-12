// FR-P1-09 图片转 Base64 / 压缩（本地 Canvas 处理）

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field radio-row">
      <input type="file" id="ib-file" accept="image/*" style="color:var(--muted)">
      <label>最大宽度 <input type="number" id="ib-width" class="num" value="0" min="0" placeholder="0=原图"></label>
      <label>JPEG 质量 <input type="number" id="ib-quality" class="num" value="0.9" min="0.1" max="1" step="0.05"></label>
    </div>
    <div class="two-col">
      <div class="field">
        <label>原图预览（拖入或粘贴图片到下方输入区也可）</label>
        <div id="ib-preview"><div class="info-box">未选择图片</div></div>
        <div class="meta-line" id="ib-meta"></div>
      </div>
      <div class="field">
        <label>输出</label>
        <pre id="ib-out" class="out" style="max-height:300px"></pre>
      </div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const fileEl = $('ib-file'), widthEl = $('ib-width'), qualityEl = $('ib-quality');
  const preview = $('ib-preview'), meta = $('ib-meta'), out = $('ib-out');
  let currentDataUrl = null;

  function processFile(file) {
    if (!file || !file.type.startsWith('image/')) { ctx.notify('请选择图片文件'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = Number(widthEl.value) || 0;
        let w = img.width, h = img.height;
        if (maxW > 0 && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const q = Math.min(1, Math.max(0.1, Number(qualityEl.value) || 0.9));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const keepType = (w === img.width && h === img.height && (file.type === 'image/png' || file.type === 'image/webp')) ? file.type : 'image/jpeg';
        currentDataUrl = canvas.toDataURL(keepType, q);
        const originKB = (file.size / 1024).toFixed(1);
        const newKB = (currentDataUrl.length * 0.75 / 1024).toFixed(1);
        preview.innerHTML = `<img src="${currentDataUrl}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid var(--border)">`;
        meta.textContent = `原始 ${img.width}×${img.height} ${originKB}KB → 输出 ${w}×${h} Base64 后约 ${newKB}KB`;
        out.className = 'out';
        out.textContent = currentDataUrl;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  fileEl.addEventListener('change', e => processFile(e.target.files[0]));
  widthEl.addEventListener('change', () => { if (fileEl.files[0]) processFile(fileEl.files[0]); });
  qualityEl.addEventListener('change', () => { if (fileEl.files[0]) processFile(fileEl.files[0]); });

  // 支持粘贴图片
  taInPaste();
  function taInPaste() {
    body.addEventListener('paste', e => {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      if (item) processFile(item.getAsFile());
    });
  }

  ctx.handlers = {
    run() { if (fileEl.files[0]) processFile(fileEl.files[0]); },
    clear() { fileEl.value = ''; preview.innerHTML = ''; meta.textContent = ''; out.textContent = ''; currentDataUrl = null; },
    copy() {
      const text = out.textContent;
      if (!text) { ctx.notify('没有可复制的结果'); return; }
      // Data URL 含 base64 前缀；提供整段复制
      ctx.copyText(text);
    },
    example() { ctx.notify('请选择本地图片文件（图片不会上传）'); },
    share() { return { maxWidth: Number(widthEl.value), quality: Number(qualityEl.value) }; }
  };
}
