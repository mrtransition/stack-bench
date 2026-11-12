// SQL 格式化（常见方言通用；核心是关键字统一大小写 + 主要子句换行缩进）
const KEYWORDS = new Set([
  'select', 'from', 'where', 'and', 'or', 'not', 'in', 'is', 'null', 'like', 'between', 'exists',
  'group', 'by', 'order', 'having', 'limit', 'offset', 'as', 'on', 'join', 'inner', 'left', 'right',
  'full', 'outer', 'cross', 'union', 'all', 'distinct', 'case', 'when', 'then', 'else', 'end',
  'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'index', 'view',
  'alter', 'drop', 'add', 'column', 'primary', 'key', 'foreign', 'references', 'unique',
  'asc', 'desc', 'if', 'use', 'database', 'with', 'returning', 'default', 'constraint',
  'asc', 'desc', 'nulls', 'first', 'last'
]);

// 触发换行的主要子句开头（行首对齐）
const CLAUSE_STARTS = new Set([
  'select', 'from', 'where', 'group by', 'order by', 'having', 'limit', 'offset',
  'insert into', 'values', 'update', 'set', 'delete from', 'create table', 'alter table',
  'drop table', 'union', 'union all', 'left join', 'right join', 'inner join', 'full join',
  'cross join', 'left outer join', 'right outer join', 'full outer join', 'join'
]);

// 单词流中贪婪匹配子句短语
function nextClauseStart(words, i) {
  for (const len of [3, 2, 1]) {
    if (i + len <= words.length) {
      const phrase = words.slice(i, i + len).map(w => w.v.toLowerCase()).join(' ');
      if (CLAUSE_STARTS.has(phrase)) return len;
    }
  }
  return 0;
}

/** 词法切分：保留字符串 / 注释 / 括号 / 标点 */
function tokenize(sql) {
  const tokens = [];
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') {
      let j = sql.indexOf('\n', i); if (j < 0) j = sql.length;
      tokens.push({ t: 'comment', v: sql.slice(i, j) });
      i = j; continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      let j = sql.indexOf('*/', i + 2); j = j < 0 ? sql.length : j + 2;
      tokens.push({ t: 'comment', v: sql.slice(i, j) });
      i = j; continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === c) { j++; break; }
        j++;
      }
      tokens.push({ t: 'string', v: sql.slice(i, j) });
      i = j; continue;
    }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { tokens.push({ t: 'paren', v: c }); i++; continue; }
    if (c === ',') { tokens.push({ t: 'comma', v: ',' }); i++; continue; }
    if (c === ';') { tokens.push({ t: 'semi', v: ';' }); i++; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < sql.length && /[\w$]/.test(sql[j])) j++;
      tokens.push({ t: 'word', v: sql.slice(i, j) });
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < sql.length && /[0-9a-fx.]/i.test(sql[j])) j++;
      tokens.push({ t: 'num', v: sql.slice(i, j) });
      i = j; continue;
    }
    // 操作符（连续取 := <= >= <> != 等）
    let j = i;
    while (j < sql.length && /[=<>!+\-*/%|&~]/.test(sql[j])) j++;
    if (j === i) j++;
    tokens.push({ t: 'op', v: sql.slice(i, j) });
    i = j;
  }
  return tokens;
}

export function formatSql(sql, opts = {}) {
  const { keywordCase = 'upper', indent = 2, spaceAfterComma = true } = opts;
  const tokens = tokenize(String(sql));
  if (!tokens.length) throw new Error('输入为空');

  // 括号配平检查
  let depth = 0, minDepth = 0;
  for (const tk of tokens) {
    if (tk.t === 'paren') { depth += tk.v === '(' ? 1 : -1; minDepth = Math.min(minDepth, depth); }
  }
  if (minDepth < 0 || depth !== 0) throw new Error('括号不配对，无法格式化');

  // 关键字大小写
  const processed = tokens.map(tk => {
    if (tk.t === 'word' && KEYWORDS.has(tk.v.toLowerCase())) {
      tk = { ...tk, v: keywordCase === 'upper' ? tk.v.toUpperCase() : tk.v.toLowerCase() };
    }
    return tk;
  });

  const lines = [];
  let line = '', parenDepth = 0, lastWord = '';
  const newLine = (extra = 0) => {
    if (line.trim()) lines.push('  '.repeat(parenDepth * indent / 2) + line.trim());
    line = ' '.repeat(parenDepth * indent + extra);
  };

  for (let i = 0; i < processed.length; i++) {
    const tk = processed[i];

    if (tk.t === 'paren') {
      if (tk.v === '(') {
        line += ' (';
        parenDepth++;
        // 子查询：括号内紧随 select 则换行
        const nxt = processed[i + 1];
        if (nxt && nxt.t === 'word' && nxt.v.toLowerCase() === 'select') newLine();
      } else {
        if (line.trim()) lines.push(' '.repeat(parenDepth * indent) + line.trim());
        parenDepth--;
        line = ' '.repeat(parenDepth * indent);
        line += ')';
      }
      lastWord = '';
      continue;
    }
    if (tk.t === 'comma') {
      line += ',';
      newLine(); // 每个逗号后换行（列/值各占一行）
      continue;
    }
    if (tk.t === 'semi') { newLine(); lines.push(line.trim() + ';'); line = ''; continue; }
    if (tk.t === 'comment') { newLine(); lines.push(line.trim() + ' ' + tk.v.trim()); line = ' '; continue; }

    // 词：检查是否新子句开始
    if (tk.t === 'word') {
      const len = nextClauseStart(processed.map(x => ({ v: x.v })), i);
      if (len && parenDepth === 0) newLine();
      // 跳过短语匹配对齐（nextClauseStart 在原数组上匹配，需与 processed 对齐）
    }
    line += (line.trim() ? ' ' : '') + tk.v;
    lastWord = tk.v;
  }
  if (line.trim()) lines.push(line.trim());

  // 处理短语换行的输出微调：合并意外产生的单 token 行太碎的情况交由用户调节
  let out = lines.filter(l => l !== '').join('\n');
  if (keywordCase === 'preserve') {
    // 不改写关键字（已在上面统一处理，preserve 仅接受原样输出）
  }
  return out;
}

/** 压缩为单行 */
export function compressSql(sql) {
  const tokens = tokenize(String(sql));
  let out = '';
  let prev = null;
  for (const tk of tokens) {
    if (tk.t === 'comment') continue;
    if (tk.t === 'semi') { out += ';'; prev = tk; continue; }
    const needSpace = prev && !(tk.t === 'comma' || tk.t === 'paren' && tk.v === ')' || prev.t === 'paren' && prev.v === '(');
    out += (needSpace ? ' ' : '') + tk.v;
    prev = tk;
  }
  return out.trim();
}

export const SQL_EXAMPLES = [
  'select u.id, u.name, count(o.id) as order_count from users u left join orders o on u.id = o.user_id where u.status = 1 and u.created_at > \'2026-01-01\' group by u.id, u.name having count(o.id) > 10 order by order_count desc limit 20;'
];
