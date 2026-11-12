// 正则测试辅助：风险提示
export function riskyHint(src) {
  const bare = String(src).replace(/\\[dDwWsSbB.]/g, 'X').replace(/\\./g, 'X');
  // 嵌套量词启发式：(a+)+、(a*)*、(a{2,})+ 等
  if (/\((?:[^()\\]|\\.)*[+*]\)\s*[+*{]/.test(bare) || /[+*]\)\s*[+*]/.test(bare)) {
    return '⚠ 疑似嵌套量词（如 (a+)+ 模式），可能引发灾难性回溯（ReDoS），长输入时会明显卡顿。';
  }
  // 交替分支中的重复前缀
  if (/\((?:[^()\\]|\\.)*[+*][^()]*\|[^\n]{30,}\)[+*]/.test(bare)) {
    return '⚠ 存在大量分支的分组量词，长输入可能触发回溯性能问题。';
  }
  return '';
}

/** 安全执行匹配（限制执行时间，防止长阻塞） */
export function matchAll(re, text, maxMatches = 500) {
  const out = [];
  let m;
  let guard = 0;
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const g = new RegExp(re.source, flags);
  while ((m = g.exec(text)) !== null) {
    out.push({
      index: m.index,
      end: m.index + m[0].length,
      text: m[0],
      groups: m.slice(1).map(x => (x === undefined ? null : x)),
      named: m.groups || null
    });
    if (m[0] === '') g.lastIndex++; // 空匹配前进
    if (++guard >= maxMatches) break;
  }
  return out;
}
