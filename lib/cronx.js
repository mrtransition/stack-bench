// Cron 表达式解析与执行时间预测（5/6 字段，可选秒字段）
const MONTH_NAMES = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const DOW_NAMES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function resolve(val, names, min, max, label) {
  const up = String(val).trim().toUpperCase();
  if (names && up in names) {
    let v = names[up];
    if (label === '星期' && v === 7) v = 0;
    return v;
  }
  if (!/^\d+$/.test(String(val).trim())) throw new Error(`字段「${label}」的值不合法: ${val}`);
  const n = Number(val);
  if (n < min || n > max) throw new Error(`字段「${label}」超出范围 ${min}-${max}: ${val}`);
  if (label === '星期' && n === 7) return 0;
  return n;
}

function parseField(field, min, max, names, label) {
  const out = new Set();
  for (const raw of String(field).trim().split(',')) {
    const part = raw.trim();
    if (!part) throw new Error(`字段「${label}」存在空片段`);
    let body = part, step = null;
    const si = part.indexOf('/');
    if (si >= 0) {
      body = part.slice(0, si);
      step = Number(part.slice(si + 1));
      if (!Number.isInteger(step) || step < 1) throw new Error(`字段「${label}」步长不合法: ${part}`);
    }
    let lo, hi;
    if (body === '*') { lo = min; hi = max; }
    else if (body.includes('-')) {
      const [a, b] = body.split('-');
      lo = resolve(a, names, min, max, label);
      hi = resolve(b, names, min, max, label);
      if (lo > hi) throw new Error(`字段「${label}」范围起点大于终点: ${part}`);
    } else {
      lo = hi = resolve(body, names, min, max, label);
    }
    if (step === null) { for (let v = lo; v <= hi; v++) out.add(v); }
    else { for (let v = lo; v <= hi; v += step) out.add(v); }
  }
  if (!out.size) throw new Error(`字段「${label}」没有有效取值`);
  return [...out].sort((a, b) => a - b);
}

/** 解析 5 字段（分 时 日 月 周）或 6 字段（秒 分 时 日 月 周） */
export function parseCron(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length === 5) parts.unshift('0');
  else if (parts.length !== 6) throw new Error('Cron 表达式应为 5 个或 6 个字段（6 字段含秒），当前为 ' + parts.length + ' 个');
  const [sec, min, hour, dom, mon, dow] = parts;
  const secAny = sec === '*', minAny = min === '*', hourAny = hour === '*';
  const domAny = dom === '*', monAny = mon === '*', dowAny = dow === '*';
  return {
    expr: String(expr).trim(),
    hasSeconds: parts.length === 6,
    sec: parseField(sec, 0, 59, null, '秒'),
    min: parseField(min, 0, 59, null, '分'),
    hour: parseField(hour, 0, 23, null, '时'),
    dom: parseField(dom, 1, 31, null, '日'),
    mon: parseField(mon, 1, 12, MONTH_NAMES, '月'),
    dow: parseField(dow, 0, 6, DOW_NAMES, '星期'),
    _any: { secAny, minAny, hourAny, domAny, monAny, dowAny }
  };
}

function dayMatches(c, d) {
  if (!c.mon.includes(d.getMonth() + 1)) return false;
  const domOk = c.dom.includes(d.getDate());
  const dowOk = c.dow.includes(d.getDay());
  const { domAny, dowAny } = c._any;
  if (domAny && dowAny) return true;
  if (domAny) return dowOk;
  if (dowAny) return domOk;
  return domOk || dowOk; // 两者同时受限时按 OR 语义
}

/** 预测未来 count 次执行时间（从 from 之后开始），最多向后搜索 5 年 */
export function nextRuns(expr, from = new Date(), count = 5) {
  const c = parseCron(expr);
  const res = [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(start.getTime() + 366 * 5 * 86400000);
  const day = new Date(start.getTime());
  outer:
  while (day < end && res.length < count) {
    if (dayMatches(c, day)) {
      for (const h of c.hour) {
        for (const mi of c.min) {
          for (const s of c.sec) {
            const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi, s);
            if (t.getTime() <= from.getTime()) continue;
            res.push(t);
            if (res.length >= count) break outer;
          }
        }
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return res;
}

/** 生成人类可读描述（简版） */
export function describeCron(expr) {
  const c = parseCron(expr);
  const { secAny, minAny, hourAny, domAny, dowAny, monAny } = c._any;
  const parts = [];
  if (!secAny) parts.push(`第 ${c.sec.join(',')} 秒`);
  if (!minAny) parts.push(`第 ${c.min.join(',')} 分`);
  if (!hourAny) parts.push(`${c.hour.join(',')} 点`);
  if (!domAny) parts.push(`${c.dom.join(',')} 号`);
  if (!monAny) parts.push(`${c.mon.join(',')} 月`);
  if (!dowAny) parts.push('星期' + c.dow.map(v => '日一二三四五六'[v]).join(','));
  return parts.length ? '在 ' + parts.join(' ') + ' 执行' : '每秒执行';
}

export const CRON_TEMPLATES = [
  { label: '每分钟（5 字段）', expr: '* * * * *' },
  { label: '每 5 分钟', expr: '*/5 * * * *' },
  { label: '每小时第 0 分', expr: '0 * * * *' },
  { label: '每天 00:00', expr: '0 0 * * *' },
  { label: '每周一 09:00', expr: '0 9 * * 1' },
  { label: '每月 1 号 00:00', expr: '0 0 1 * *' },
  { label: '每天 09:30（6 字段含秒）', expr: '0 30 9 * * *' },
  { label: '每 30 秒（6 字段含秒）', expr: '*/30 * * * * *' }
];
