// 轻量 Markdown → HTML 渲染（先转义再解析，输出安全）
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// 只允许安全协议（http/https/mailto/tel/锚点/相对路径），挡掉 javascript:、data: 等
function safeUrl(url) {
  const u = String(url).trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) {
    return /^(?:https?|mailto|tel):/i.test(u) ? u : '#';
  }
  return u; // 相对路径、/path、#anchor、//host
}

function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => `<img alt="${alt}" src="${safeUrl(src)}">`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, href) => `<a href="${safeUrl(href)}" rel="noopener noreferrer" target="_blank">${txt}</a>`);
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return out;
}

export function renderMarkdown(md) {
  const lines = String(md).split(/\r?\n/);
  const html = [];
  let i = 0;
  let inCode = false, codeLang = '', codeBuf = [];
  let listType = null, listBuf = [];

  const closeList = () => {
    if (listType) {
      html.push(listType === 'ol' ? `<ol>${listBuf.join('')}</ol>` : `<ul>${listBuf.join('')}</ul>`);
      listType = null; listBuf = [];
    }
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    // 代码围栏
    const fence = /^```(\w*)\s*$/.exec(line.trim());
    if (fence) {
      if (!inCode) { closeList(); inCode = true; codeLang = fence[1]; codeBuf = []; }
      else {
        html.push(`<pre class="md-code" data-lang="${codeLang}"><code>${esc(codeBuf.join('\n'))}</code></pre>`);
        inCode = false;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    const trimmed = line.trim();
    if (!trimmed) { closeList(); continue; }

    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) { closeList(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }

    // 分隔线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { closeList(); html.push('<hr>'); continue; }

    // 引用
    if (/^>\s?/.test(trimmed)) {
      closeList();
      html.push(`<blockquote>${inline(trimmed.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }

    // 列表
    const ul = /^[-*+]\s+(.*)$/.exec(trimmed);
    const ol = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (ul) {
      if (listType && listType !== 'ul') closeList();
      listType = 'ul';
      listBuf.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    if (ol) {
      if (listType && listType !== 'ol') closeList();
      listType = 'ol';
      listBuf.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    // 表格（简化：| a | b | 行 + |---|---| 分隔）
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList();
      const header = trimmed.split('|').slice(1, -1).map(c => c.trim());
      let rows = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        i++;
      }
      i--;
      html.push('<table class="md-table"><tr>' + header.map(c => `<th>${inline(c)}</th>`).join('') + '</tr>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</table>');
      continue;
    }

    // 段落
    closeList();
    html.push(`<p>${inline(trimmed)}</p>`);
  }
  if (inCode) html.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`);
  closeList();
  return html.join('\n');
}
