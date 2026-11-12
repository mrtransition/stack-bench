// 时间戳 / 日期解析与格式化
const pad = n => String(n).padStart(2, '0');

/** 纯数字输入 → Date；≤10 位按秒，≥11 位按毫秒 */
export function normalizeTs(input) {
  const s = String(input).trim();
  if (!/^\d{1,17}$/.test(s)) throw new Error('时间戳应为 1-17 位纯数字，当前不合法');
  const n = Number(s);
  const ms = s.length <= 10 ? n * 1000 : n;
  return fromMs(ms);
}

function fromMs(ms) {
  const d = new Date(ms);
  if (isNaN(d.getTime())) throw new Error('数值超出可表示的日期范围');
  return d;
}

/** 日期字符串或时间戳 → Date */
export function parseFlexible(input) {
  const s = String(input).trim();
  if (!s) throw new Error('输入为空');
  if (/^\d+$/.test(s)) return normalizeTs(s);
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error('无法识别的日期时间格式，请使用 ISO 8601 或 "YYYY-MM-DD HH:mm:ss"');
  return d;
}

/** 输出本地时间 / UTC / ISO 8601 / 秒与毫秒时间戳 */
export function fmtAll(d) {
  return {
    local: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    utc: d.toUTCString(),
    iso: d.toISOString(),
    ms: d.getTime(),
    sec: Math.floor(d.getTime() / 1000),
    weekdayCN: '日一二三四五六'[d.getDay()]
  };
}
