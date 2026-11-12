// .env / 配置文本解析与整理
const SENSITIVE_RE = /(KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|CREDENTIALS)/i;

/**
 * 解析 .env 文本。
 * 返回 { entries:[{key,value,line}], comments:[{text,line}], blanks:[line], issues:[{line,message}], dups:[key] }
 */
export function parseEnv(text) {
  const lines = String(text).split(/\r?\n/);
  const entries = [], comments = [], issues = [], blanks = [];
  const seen = new Map();
  const dups = new Set();
  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const t = raw.trim();
    if (t === '') { blanks.push(lineNo); return; }
    if (t.startsWith('#') || t.startsWith(';')) { comments.push({ text: raw, line: lineNo }); return; }
    const m = /^([A-Za-z_][A-Za-z0-9_.]*)\s*=(.*)$/.exec(raw);
    if (!m) {
      issues.push({ line: lineNo, message: '无法识别的行（应为 KEY=VALUE、注释或空行）' });
      return;
    }
    const key = m[1], value = m[2].trim();
    if (seen.has(key)) dups.add(key); else seen.set(key, lineNo);
    entries.push({ key, value, line: lineNo, sensitive: SENSITIVE_RE.test(key), dup: seen.has(key) && dups.has(key) });
  });
  return { entries, comments, blanks, issues, dups: [...dups] };
}

/**
 * 整理 .env 文本。
 * opts.sort: 注释置顶，条目按 key 字母序
 * opts.mask: 敏感 key 的值以 ****** 展示
 */
export function formatEnv(text, opts = {}) {
  const { sort = false, mask = false } = opts;
  const parsed = parseEnv(text);
  const dupSet = new Set(parsed.dups);
  let out = '';
  if (sort) {
    for (const c of parsed.comments) out += c.text + '\n';
    if (parsed.comments.length) out += '\n';
    const sorted = [...parsed.entries].sort((a, b) => a.key.localeCompare(b.key));
    for (const e of sorted) out += `${e.key}=${mask && e.sensitive ? '******' : e.value}\n`;
  } else {
    // 保持原始顺序：逐行重建（未识别行原样保留并标注问题）
    const lines = String(text).split(/\r?\n/);
    const entryByLine = new Map(parsed.entries.map(e => [e.line, e]));
    const issueByLine = new Map(parsed.issues.map(x => [x.line, x]));
    out = lines.map((raw, i) => {
      const lineNo = i + 1;
      const t = raw.trim();
      if (t === '' || t.startsWith('#') || t.startsWith(';')) return raw;
      const e = entryByLine.get(lineNo);
      if (e) return `${e.key}=${mask && e.sensitive ? '******' : e.value}`;
      if (issueByLine.has(lineNo)) return '# !! ' + raw; // 错误行转为注释保留
      return raw;
    }).join('\n') + '\n';
  }
  const warnings = [];
  for (const k of parsed.dups) {
    warnings.push(`重复 key：${k}（出现多次，整理结果保留最后出现的值）`);
  }
  if (mask) warnings.push('敏感 key 已脱敏展示；如需明文请关闭脱敏。');
  return {
    output: out,
    issues: parsed.issues,
    dups: parsed.dups,
    warnings,
    count: parsed.entries.length
  };
}
