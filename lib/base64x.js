// Base64（标准 / URL-safe，UTF-8）与 URL 编解码
export function b64encode(text, urlsafe = false) {
  const bytes = new TextEncoder().encode(String(text));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  let out = btoa(bin);
  if (urlsafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return out;
}

export function b64decode(text) {
  let s = String(text).trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('包含非法 Base64 字符');
  let bin;
  try { bin = atob(s); } catch { throw new Error('Base64 解码失败：长度或填充不正确'); }
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function urlEncode(text) { return encodeURIComponent(String(text)); }

export function urlDecode(text) {
  const s = String(text).trim();
  try { return decodeURIComponent(s.replace(/\+/g, '%20')); }
  catch { throw new Error('URL 解码失败：百分号编码不合法（例如单独的 % 字符）'); }
}
