// UUID v4 / v7 生成（RFC 9562）
function randomBytes(n) {
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    const a = new Uint8Array(n);
    globalThis.crypto.getRandomValues(a);
    return a;
  }
  return null;
}

async function randomBytesAsync(n) {
  const direct = randomBytes(n);
  if (direct) return direct;
  const { webcrypto } = await import('node:crypto');
  return webcrypto.getRandomValues(new Uint8Array(n));
}

function format(bytes, { hyphen = true, upper = false } = {}) {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  const out = hyphen
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : hex;
  return upper ? out.toUpperCase() : out;
}

export async function uuidv4(opts) {
  const b = await randomBytesAsync(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return format(b, opts);
}

/** UUID v7：48bit unix 毫秒 + 12bit 随机 a + 62bit 随机 b */
export async function uuidv7(opts) {
  const b = await randomBytesAsync(16);
  const ts = Date.now();
  const hi = Math.floor(ts / 2 ** 32), lo = ts >>> 0;
  b[0] = (hi >>> 8) & 0xff; b[1] = hi & 0xff;
  b[2] = (lo >>> 24) & 0xff; b[3] = (lo >>> 16) & 0xff; b[4] = (lo >>> 8) & 0xff; b[5] = lo & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  return format(b, opts);
}
