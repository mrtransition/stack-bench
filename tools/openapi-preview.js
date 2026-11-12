// FR-P1-02 OpenAPI / Swagger 预览与校验（主线程 js-yaml，window.jsyaml）
function escHtml(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

const METHOD_COLORS = { get: '#2f8fe6', post: '#3fb96f', put: '#e2a336', patch: '#9d7cd8', delete: '#e5484d', head: '#8b93a7', options: '#8b93a7' };

export async function render(body, ctx) {
  body.innerHTML = `
    <div class="field">
      <label>OpenAPI / Swagger 文档（JSON 或 YAML）</label>
      <textarea id="op-in" class="io" spellcheck="false"></textarea>
    </div>
    <div class="field">
      <label>解析结果</label>
      <div id="op-out"><div class="info-box">粘贴文档后点击「解析」</div></div>
    </div>`;

  const $ = id => body.querySelector('#' + id);
  const taIn = $('op-in'), outEl = $('op-out');

  function parseDoc(text) {
    try {
      return { doc: JSON.parse(text) };
    } catch {
      if (typeof jsyaml === 'undefined') throw new Error('js-yaml 未加载');
      try { return { doc: jsyaml.load(text) }; }
      catch (err) {
        const extra = err.mark ? `（第 ${err.mark.line + 1} 行，第 ${err.mark.column + 1} 列）` : '';
        throw new Error('YAML 解析失败：' + (err.reason || err.message) + extra);
      }
    }
  }

  function validate(doc) {
    const errors = [], warnings = [];
    if (!doc || typeof doc !== 'object') { errors.push('文档根节点必须是对象'); return { errors, warnings }; }
    const isOpenApi = 'openapi' in doc, isSwagger = 'swagger' in doc;
    if (!isOpenApi && !isSwagger) errors.push('缺少顶层 "openapi"（3.x）或 "swagger"（2.0）字段');
    if (isOpenApi && !/^3\./.test(String(doc.openapi))) warnings.push(`openapi 版本 "${doc.openapi}" 非 3.x，预览可能不准`);
    if (!doc.info) errors.push('缺少 "info" 字段');
    else {
      if (!doc.info.title) errors.push('缺少 "info.title"');
      if (!doc.info.version) errors.push('缺少 "info.version"');
    }
    if (!doc.paths) errors.push('缺少 "paths" 字段');
    else if (typeof doc.paths !== 'object') errors.push('"paths" 必须是对象');
    else {
      for (const [path, item] of Object.entries(doc.paths)) {
        if (!path.startsWith('/')) warnings.push(`路径 "${path}" 未以 / 开头`);
        const ops = Object.keys(item || {}).filter(k => ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(k));
        if (!ops.length) warnings.push(`路径 "${path}" 没有任何 HTTP 方法`);
        for (const op of ops) {
          const o = item[op];
          if (!o.responses) errors.push(`${op.toUpperCase()} ${path} 缺少 "responses"`);
          if (o.summary || o.description) continue;
          warnings.push(`${op.toUpperCase()} ${path} 建议补充 summary`);
        }
      }
    }
    return { errors, warnings };
  }

  function run() {
    const text = taIn.value;
    if (!text.trim()) { ctx.notify('请输入文档内容'); return; }
    let doc;
    try { doc = parseDoc(text).doc; }
    catch (err) {
      outEl.innerHTML = `<div class="err-box">❌ ${escHtml(err.message)}</div>`;
      return;
    }
    const { errors, warnings } = validate(doc);
    const info = doc.info || {};
    const servers = (doc.servers || [{ url: doc.host ? `${doc.schemes?.[0] || 'http'}://${doc.host}${doc.basePath || ''}` : '-' }]);

    let html = '';
    if (errors.length || warnings.length) {
      html += `<div class="${errors.length ? 'err-box' : 'ok-box'}">` +
        (errors.length ? `❌ 结构校验失败，共 ${errors.length} 处：\n` + errors.map(e => '  · ' + escHtml(e)).join('\n') : '✅ 结构校验通过') +
        (errors.length && warnings.length ? '\n' : '') +
        warnings.map(w => '\n⚠ ' + escHtml(w)).join('') +
        '</div>';
    } else {
      html += '<div class="ok-box">✅ 结构校验通过</div>';
    }

    html += `<div class="meta-line" style="margin:10px 0 4px">${escHtml(info.title || '未命名文档')} · v${escHtml(info.version || '?')} · ${escHtml(String(doc.openapi || doc.swagger || ''))} · 服务器 ${servers.map(s => escHtml(s.url)).join(', ')}</div>`;

    const rows = [];
    for (const [path, item] of Object.entries(doc.paths || {})) {
      for (const [method, op] of Object.entries(item || {})) {
        if (!METHOD_COLORS[method]) continue;
        rows.push(`<tr><td><span class="status-pill" style="background:${METHOD_COLORS[method]};font-size:11px">${method.toUpperCase()}</span></td>
          <td style="word-break:break-all"><code>${escHtml(path)}</code></td>
          <td style="color:var(--muted)">${escHtml(op.summary || op.operationId || '')}</td>
          <td style="color:var(--muted)">${op.deprecated ? '已弃用' : Object.keys(op.responses || {}).map(String).join(', ')}</td></tr>`);
      }
    }
    html += rows.length
      ? `<div class="diff-wrap"><table class="diff"><tr><th>方法</th><th>路径</th><th>摘要</th><th>响应码</th></tr>${rows.join('')}</table></div>`
      : '<div class="info-box">未解析到任何接口（paths 为空）</div>';

    outEl.innerHTML = html;
  }

  ctx.handlers = {
    run,
    clear() { taIn.value = ''; outEl.innerHTML = ''; },
    copy() { ctx.copyText(outEl.textContent); },
    example() { taIn.value = ctx.tool.examples[0]; run(); },
    share() { return { doc: taIn.value }; }
  };

  if (ctx.params.doc) taIn.value = ctx.params.doc;
}
