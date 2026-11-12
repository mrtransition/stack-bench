// CSS 格式化 / 压缩
export function formatCss(css, indent = 2) {
  const s = String(css);
  let out = '';
  let depth = 0;
  let i = 0;
  let buf = '';

  /**
   * 冲刷缓冲。
   * semi=true：声明行，补分号并规范 "prop: value" 格式
   * semi=false：选择器 / 注释 / 块结束前内容，不改写
   */
  const flush = ({ semi = false } = {}) => {
    let t = buf.trim().replace(/\s+/g, ' ');
    buf = '';
    if (!t) return;
    if (semi) {
      if (!t.endsWith(';')) t += ';';
      t = t.replace(/^([^{}]+?)\s*:\s*/, '$1: ');
    }
    out += '  '.repeat(depth) + t + '\n';
  };

  while (i < s.length) {
    const c = s[i];
    // 注释原样保留（当前缩进）
    if (c === '/' && s[i + 1] === '*') {
      flush();
      const end = s.indexOf('*/', i + 2);
      const stop = end < 0 ? s.length : end + 2;
      out += '  '.repeat(depth) + s.slice(i, stop) + '\n';
      i = stop;
      continue;
    }
    if (c === '{') {
      flush({ semi: false });
      out = out.replace(/\n$/, '') + ' {\n';
      depth++;
      i++;
      continue;
    }
    if (c === '}') {
      flush({ semi: false });
      depth = Math.max(0, depth - 1);
      out += '  '.repeat(depth) + '}\n';
      i++;
      continue;
    }
    if (c === ';') {
      buf += ';';
      flush({ semi: true });
      i++;
      continue;
    }
    if (c === '\n') { buf += ' '; i++; continue; }
    buf += c;
    i++;
  }
  // 末尾残留声明（可能缺分号）
  flush({ semi: true });
  return out.trimEnd() + '\n';
}

export function compressCss(css) {
  return String(css)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}
