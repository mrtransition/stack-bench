// SHA-1 / SHA-256 / SHA-512（Web Crypto，Node 走 node:crypto webcrypto 兼容）
let _subtle = null;

async function subtle() {
  if (_subtle) return _subtle;
  if (globalThis.crypto && globalThis.crypto.subtle) { _subtle = globalThis.crypto.subtle; return _subtle; }
  const { webcrypto } = await import('node:crypto'); // 仅 Node 环境
  _subtle = webcrypto.subtle;
  return _subtle;
}

const ALGOS = new Set(['SHA-1', 'SHA-256', 'SHA-512']);

/** algo: 'SHA-1' | 'SHA-256' | 'SHA-512'，返回小写十六进制 */
export async function sha(algo, text) {
  if (!ALGOS.has(algo)) throw new Error('不支持的算法：' + algo);
  const s = await subtle();
  const data = new TextEncoder().encode(String(text));
  const buf = await s.digest(algo, data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
