// 日志解析与时间线（常见格式：ISO / yyyy-MM-dd HH:mm:ss.SSS / nginx）
const LEVELS = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
const LEVEL_RE = /\b(FATAL|ERROR|ERR|WARN|WARNING|INFO|INFORMATION|DEBUG|TRACE)\b/i;

const TS_PATTERNS = [
  /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?)/,
  /\[(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2}\s+[+-]\d{4})\]/,   // nginx
  /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\]/,
  /\b(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\b/
];

const TRACE_RES = [
  /trace[-_]?id[:=]\s*([0-9a-zA-Z-]{8,64})/i,
  /\bTID[:=]([0-9a-zA-Z-]{8,64})\b/,
  /\b([0-9a-f]{32})\b/i,
  /\brequest[-_]?id[:=]\s*([0-9a-zA-Z-]{8,64})/i
];

function normalizeLevel(raw) {
  if (!raw) return 'INFO';
  const u = raw.toUpperCase();
  if (u === 'ERR') return 'ERROR';
  if (u === 'WARNING' || u === 'INFORMATION') return u === 'WARNING' ? 'WARN' : 'INFO';
  return u;
}

export function parseLogs(text) {
  const lines = String(text).split(/\r?\n/);
  const entries = [];
  const counts = {};
  LEVELS.forEach(l => counts[l] = 0);

  lines.forEach((raw, i) => {
    const line = raw;
    if (!line.trim()) return;
    const lm = LEVEL_RE.exec(line);
    const level = normalizeLevel(lm ? lm[1] : null);
    let ts = null, tsStr = '';
    for (const re of TS_PATTERNS) {
      const m = re.exec(line);
      if (m) {
        tsStr = m[1];
        let d = new Date(m[1]);
        if (isNaN(d.getTime()) && m[1].includes('/')) {
          d = new Date(m[1].replace('/', ' ').replace(/:/, ' ')); // nginx 风格降级尝试
        }
        ts = isNaN(d.getTime()) ? null : d.getTime();
        if (ts === null && /^\d{2}:\d{2}:\d{2}/.test(tsStr)) {
          const base = new Date(); const p = tsStr.split(/[:.]/).map(Number);
          const t = new Date(base.getFullYear(), base.getMonth(), base.getDate(), p[0], p[1], p[2], p[3] || 0);
          ts = t.getTime();
        }
        break;
      }
    }
    let trace = null;
    for (const re of TRACE_RES) {
      const m = re.exec(line);
      if (m) { trace = m[1]; break; }
    }
    counts[level] = (counts[level] || 0) + 1;
    entries.push({ no: i + 1, level, ts, tsStr, trace, msg: line });
  });

  let range = null;
  const withTs = entries.filter(e => e.ts);
  if (withTs.length) {
    range = { start: withTs[0].ts, end: withTs[withTs.length - 1].ts, parsed: withTs.length };
  }
  return { entries, counts, range };
}

/** 按时间桶聚合（默认 60s），生成文本时间线 */
export function buildTimeline(entries, bucketMs = 60000, maxBuckets = 60) {
  const withTs = entries.filter(e => e.ts).sort((a, b) => a.ts - b.ts);
  if (withTs.length < 2) return [];
  const start = withTs[0].ts, end = withTs[withTs.length - 1].ts;
  const buckets = Math.min(maxBuckets, Math.max(1, Math.ceil((end - start) / bucketMs)));
  const span = Math.max(bucketMs, Math.ceil((end - start + 1) / buckets));
  const out = [];
  for (let i = 0; i < buckets; i++) {
    const s = start + i * span, e = s + span;
    const inB = withTs.filter(x => x.ts >= s && x.ts < e);
    if (!inB.length) continue;
    out.push({
      from: s, to: e,
      count: inB.length,
      errors: inB.filter(x => x.level === 'ERROR' || x.level === 'FATAL').length
    });
  }
  return out;
}

export const LOG_LEVELS = LEVELS;
